/* =============================================================================
 * Rapspect - service worker (MV3 background)
 *
 * TUGAS FILE INI
 *   1. menerima entri dari jembatan content script
 *   2. memperlakukannya sebagai data TIDAK DIPERCAYA, lalu menyanitasi dan
 *      meredaksi ulang
 *   3. menyimpannya di ring buffer 500 entri per tab
 *   4. mendorongnya ke side panel kalau panelnya terbuka
 *
 * KENAPA FILE INI BUKAN ES MODULE
 * `importScripts()` hanya tersedia kalau service worker TIDAK dideklarasikan
 * `"type": "module"`. Kita butuh importScripts supaya aturan redaction
 * (README bagian 11) benar-benar dipakai bersama dengan content script, bukan
 * disalin. Satu salinan aturan = satu tempat untuk diaudit.
 *
 * ASUMSI PALING PENTING: WORKER INI BISA MATI KAPAN SAJA
 * Di MV3 service worker dimatikan setelah beberapa puluh detik tanpa event, dan
 * seluruh variabel di memori hilang. Karena itu tidak ada satu pun handler di
 * bawah yang berasumsi `buffers` sudah terisi - semuanya menunggu
 * `ensureLoaded()` lebih dulu, yang membaca ulang dari chrome.storage.session.
 * ========================================================================== */
'use strict';

importScripts('/src/shared/rapspect-core.js');

var core = globalThis.__RAPSPECT_CORE__;

var MAX_ENTRIES = core.LIMITS.MAX_ENTRIES;   // 500, README bagian 4
var STORAGE_PREFIX = 'rp:buf:';
var PERSIST_DEBOUNCE_MS = 300;

// Batas jumlah tab yang dilacak sekaligus. Tanpa ini, sesi kerja panjang dengan
// puluhan tab bisa mendekati kuota chrome.storage.session (sekitar 10 MB).
var MAX_TRACKED_TABS = 25;

/** tabId -> Array<entry> */
var buffers = new Map();
/** tabId -> timestamp update terakhir, untuk memilih tab mana yang dibuang */
var lastTouched = new Map();
/** tabId -> { url, t } untuk dedupe pembatas navigasi */
var lastNav = new Map();
/** tabId -> timeout id, debounce penulisan ke storage */
var persistTimers = new Map();

var nextId = 1;
var loadPromise = null;

// -----------------------------------------------------------------------------
// Pemuatan ulang state setelah worker bangun
// -----------------------------------------------------------------------------

/** Dipanggil di awal SETIAP handler.
 *
 *  Kenapa memakai satu promise yang di-cache, bukan flag boolean: beberapa
 *  pesan bisa tiba dalam tick yang sama saat worker baru bangun. Dengan flag,
 *  masing-masing akan memulai pembacaan storage sendiri dan yang terakhir
 *  menang - entri dari pembacaan lain hilang. Satu promise bersama membuat
 *  semuanya menunggu pembacaan yang sama. */
function ensureLoaded() {
  if (loadPromise) return loadPromise;
  loadPromise = (async function () {
    try {
      var all = await chrome.storage.session.get(null);
      var keys = Object.keys(all || {});
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf(STORAGE_PREFIX) !== 0) continue;
        var tabId = parseInt(key.slice(STORAGE_PREFIX.length), 10);
        if (!isFinite(tabId)) continue;
        var list = Array.isArray(all[key]) ? all[key] : [];
        buffers.set(tabId, list);
        lastTouched.set(tabId, Date.now());
        for (var j = 0; j < list.length; j++) {
          if (typeof list[j].id === 'number' && list[j].id >= nextId) nextId = list[j].id + 1;
        }
      }
    } catch (e) {
      // storage.session tidak tersedia atau korup. Lebih baik jalan dengan
      // buffer kosong daripada mati total.
      console.warn('[Rapspect] gagal memuat buffer dari storage.session:', e);
    }
  })();
  return loadPromise;
}

// -----------------------------------------------------------------------------
// Penulisan ke storage
// -----------------------------------------------------------------------------

/** Menulis ke storage jauh lebih mahal daripada menulis ke array. Buffer di
 *  memori selalu paling baru; salinan di storage boleh tertinggal sedikit,
 *  karena gunanya hanya untuk bertahan saat worker mati. */
function schedulePersist(tabId) {
  if (persistTimers.has(tabId)) return;
  var timer = setTimeout(function () {
    persistTimers.delete(tabId);
    persistNow(tabId);
  }, PERSIST_DEBOUNCE_MS);
  persistTimers.set(tabId, timer);
}

async function persistNow(tabId) {
  try {
    var list = buffers.get(tabId);
    var payload = {};
    if (!list || !list.length) {
      await chrome.storage.session.remove(STORAGE_PREFIX + tabId);
      return;
    }
    payload[STORAGE_PREFIX + tabId] = list;
    await chrome.storage.session.set(payload);
  } catch (e) {
    // Kuota penuh adalah kemungkinan paling nyata. Buffer di memori tetap utuh,
    // jadi panel tetap benar selama worker hidup.
    console.warn('[Rapspect] gagal menyimpan buffer tab', tabId, e);
  }
}

async function forgetTab(tabId) {
  buffers.delete(tabId);
  lastTouched.delete(tabId);
  lastNav.delete(tabId);
  var timer = persistTimers.get(tabId);
  if (timer) { clearTimeout(timer); persistTimers.delete(tabId); }
  try { await chrome.storage.session.remove(STORAGE_PREFIX + tabId); } catch (e) {}
}

/** Buang tab yang paling lama tidak aktif kalau jumlah tab terlacak berlebih. */
function evictIfNeeded() {
  if (buffers.size <= MAX_TRACKED_TABS) return;
  var oldestTab = null;
  var oldestTime = Infinity;
  lastTouched.forEach(function (t, tabId) {
    if (t < oldestTime) { oldestTime = t; oldestTab = tabId; }
  });
  if (oldestTab !== null) forgetTab(oldestTab);
}

// -----------------------------------------------------------------------------
// Penambahan entri
// -----------------------------------------------------------------------------

async function addEntries(tabId, rawEntries, frameId) {
  await ensureLoaded();

  var list = buffers.get(tabId);
  if (!list) { list = []; buffers.set(tabId, list); }

  var accepted = [];
  for (var i = 0; i < rawEntries.length; i++) {
    // sanitizeEntry adalah garis pertahanan terhadap halaman yang memalsukan
    // pesan: hanya field yang dikenal lewat, tipe dipaksa, panjang dipotong,
    // dan redaction dijalankan ulang (idempoten).
    var entry = core.sanitizeEntry(rawEntries[i]);
    entry.id = nextId++;
    if (typeof frameId === 'number') entry.frameId = frameId;

    if (entry.kind === 'navigation') {
      // Satu reload memicu DUA sinyal: content script baru (kind navigation)
      // dan chrome.tabs.onUpdated. Tanpa dedupe, setiap reload menghasilkan dua
      // pembatas yang identik.
      if (isDuplicateNav(tabId, entry)) continue;
      lastNav.set(tabId, { url: entry.text, t: entry.t });
    }
    list.push(entry);
    accepted.push(entry);
  }

  if (!accepted.length) return;

  // Ring buffer: buang dari depan begitu melewati batas. `splice` sekali lebih
  // murah daripada `shift` berulang.
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);

  lastTouched.set(tabId, Date.now());
  evictIfNeeded();
  schedulePersist(tabId);
  pushToPanel(tabId, accepted);
}

function isDuplicateNav(tabId, entry) {
  var prev = lastNav.get(tabId);
  if (!prev) return false;
  return prev.url === entry.text && (entry.t - prev.t) < 1500;
}

/** Panel yang tertutup adalah keadaan normal, bukan error. `sendMessage` akan
 *  gagal dengan "Receiving end does not exist" dan itu harus ditelan. */
function pushToPanel(tabId, entries) {
  try {
    chrome.runtime
      .sendMessage({ type: 'rp:push', tabId: tabId, entries: entries })
      .catch(function () {});
  } catch (e) {}
}

// -----------------------------------------------------------------------------
// Pesan masuk
// -----------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || typeof msg.type !== 'string') return false;

  switch (msg.type) {
    case 'rp:entries': {
      // Harus datang dari sebuah tab. Pesan tanpa sender.tab berarti bukan dari
      // content script, jadi tidak jelas milik tab mana - dibuang.
      if (!sender || !sender.tab || typeof sender.tab.id !== 'number') return false;
      var entries = Array.isArray(msg.entries) ? msg.entries : [];
      if (entries.length) addEntries(sender.tab.id, entries, sender.frameId);
      // Tidak ada respons: content script tidak menunggu apa pun, dan menahan
      // channel terbuka hanya memperpanjang hidup worker tanpa guna.
      return false;
    }

    case 'rp:snapshot': {
      // Panel baru dibuka atau pindah tab: kirim seluruh isi buffer.
      var wantedTab = typeof msg.tabId === 'number' ? msg.tabId : -1;
      ensureLoaded().then(function () {
        var list = buffers.get(wantedTab) || [];
        sendResponse({
          ok: true,
          tabId: wantedTab,
          entries: list,
          max: MAX_ENTRIES
        });
      }).catch(function (e) {
        sendResponse({ ok: false, error: String(e), entries: [], max: MAX_ENTRIES });
      });
      // `return true` WAJIB untuk respons asinkron. Tanpa ini channel ditutup
      // sebelum sendResponse dipanggil dan panel menerima undefined.
      return true;
    }

    case 'rp:clear': {
      var clearTab = typeof msg.tabId === 'number' ? msg.tabId : -1;
      ensureLoaded().then(async function () {
        buffers.set(clearTab, []);
        lastNav.delete(clearTab);
        await persistNow(clearTab);
        sendResponse({ ok: true });
      }).catch(function (e) {
        sendResponse({ ok: false, error: String(e) });
      });
      return true;
    }

    case 'rp:ping': {
      // Dipakai panel untuk memastikan worker hidup, sekaligus membangunkannya.
      sendResponse({ ok: true, at: Date.now() });
      return false;
    }

    default:
      return false;
  }
});

// -----------------------------------------------------------------------------
// Siklus hidup tab
// -----------------------------------------------------------------------------

chrome.tabs.onRemoved.addListener(function (tabId) {
  // Buffer tab yang sudah tidak ada tidak berguna, dan isinya bisa mengandung
  // sisa data sensitif. Dibuang segera.
  forgetTab(tabId);
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  // Hanya peduli saat URL berubah. Perubahan `status`, `title`, atau `favIconUrl`
  // terjadi sangat sering dan tidak berarti apa-apa untuk log.
  if (!changeInfo.url) return;

  // Ini yang menangkap navigasi SPA (history.pushState): content script TIDAK
  // dimuat ulang pada kasus itu, jadi tanpa listener ini pembatasnya tidak
  // pernah muncul. Untuk reload biasa, dedupe di isDuplicateNav yang bekerja.
  addEntries(tabId, [{
    kind: 'navigation',
    level: 'info',
    t: Date.now(),
    text: 'Page load: ' + core.redactUrl(changeInfo.url).url
  }]);
});

// -----------------------------------------------------------------------------
// Side panel
// -----------------------------------------------------------------------------

/** Membuat klik ikon toolbar membuka side panel.
 *  Dipanggil di onInstalled DAN onStartup: setelan ini bertahan, tapi
 *  memanggilnya dua kali tidak berbahaya, sedangkan tidak terpanggil sama
 *  sekali membuat ikon terasa rusak. */
async function enablePanelOnActionClick() {
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (e) {
    console.warn('[Rapspect] setPanelBehavior gagal:', e);
  }
}

chrome.runtime.onInstalled.addListener(function () { enablePanelOnActionClick(); });
chrome.runtime.onStartup.addListener(function () { enablePanelOnActionClick(); });

// Jaring pengaman: kalau setPanelBehavior gagal (misalnya Chrome yang lebih
// tua), onClicked tetap terpasang sehingga ikon masih melakukan sesuatu.
// Kalau setPanelBehavior berhasil, listener ini tidak akan pernah terpanggil.
chrome.action.onClicked.addListener(function (tab) {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open && tab && typeof tab.id === 'number') {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (e) {
    console.warn('[Rapspect] tidak bisa membuka side panel:', e);
  }
});

// Satu baris agar mudah dikenali di halaman "Inspect service worker".
console.log('[Rapspect] service worker aktif, buffer maksimum', MAX_ENTRIES, 'entri per tab');
