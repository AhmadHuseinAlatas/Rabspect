/* =============================================================================
 * Rapspect - panel logic
 *
 * Tidak ada framework, tidak ada build step. Semua render lewat DOM API biasa.
 *
 * KENAPA TIDAK ADA VIRTUAL SCROLLING
 * Buffer dibatasi 500 baris (README bagian 4). 500 baris DOM sederhana adalah
 * beban yang tidak terasa. Menambah virtualisasi berarti menambah kode yang
 * harus dibaca dan di-debug tanpa manfaat terukur.
 * ========================================================================== */
(function () {
  'use strict';

  var core = window.__RAPSPECT_CORE__;

  // ---------------------------------------------------------------------------
  // Permukaan: popup toolbar atau side panel
  // ---------------------------------------------------------------------------

  // Ditulis PALING AWAL, sebelum apa pun yang lain, karena CSS memakai atribut
  // ini untuk menentukan ukuran popup. CSS tidak bisa membaca query string, dan
  // CSP MV3 melarang script inline yang bisa menuliskannya lebih dulu di <head>,
  // jadi baris ini adalah kesempatan paling awal yang tersedia.
  var surface = 'panel';
  try {
    if (new URLSearchParams(window.location.search).get('surface') === 'popup') {
      surface = 'popup';
    }
  } catch (e) { /* URL aneh: perlakukan sebagai side panel */ }
  document.documentElement.setAttribute('data-surface', surface);

  // ---------------------------------------------------------------------------
  // Elemen
  // ---------------------------------------------------------------------------
  var el = {
    theme:        document.getElementById('rp-theme'),
    target:       document.getElementById('rp-target'),
    search:       document.getElementById('rp-search'),
    failed:       document.getElementById('rp-failed'),
    clear:        document.getElementById('rp-clear'),
    copy:         document.getElementById('rp-copy'),
    exportBtn:    document.getElementById('rp-export'),
    pause:        document.getElementById('rp-pause'),
    pausedBadge:  document.getElementById('rp-paused'),
    group:        document.getElementById('rp-group'),
    hideExt:      document.getElementById('rp-hide-ext'),
    extra:        document.getElementById('rp-extra'),
    format:       document.getElementById('rp-format'),
    modalCopy:    document.getElementById('rp-modal-copy'),
    list:         document.getElementById('rp-list'),
    empty:        document.getElementById('rp-empty'),
    nomatch:      document.getElementById('rp-nomatch'),
    nomatchTitle: document.getElementById('rp-nomatch-title'),
    nomatchWhy:   document.getElementById('rp-nomatch-why'),
    reset:        document.getElementById('rp-reset'),
    blocked:      document.getElementById('rp-blocked'),
    blockedText:  document.getElementById('rp-blocked-text'),
    count:        document.getElementById('rp-count'),
    redaction:    document.getElementById('rp-redaction'),
    modal:        document.getElementById('rp-modal'),
    modalHeaders: document.getElementById('rp-modal-headers'),
    modalFields:  document.getElementById('rp-modal-fields'),
    modalCancel:  document.getElementById('rp-modal-cancel'),
    modalConfirm: document.getElementById('rp-modal-confirm'),
    main:         document.getElementById('rp-main'),
    jump:         document.getElementById('rp-jump'),
    jumpText:     document.getElementById('rp-jump-text'),
    openPanel:    document.getElementById('rp-open-panel'),
    close:        document.getElementById('rp-close'),
    closeHint:    document.getElementById('rp-close-hint'),
    netHint:      document.getElementById('rp-net-hint'),
    tabs:         Array.prototype.slice.call(document.querySelectorAll('.rp-tab')),
    counts:       Array.prototype.slice.call(document.querySelectorAll('.rp-tab__count'))
  };

  var THEME_KEY = 'rp:theme';

  /** Daftar lensa yang tersedia. Urutannya sama dengan urutan tab di HTML.
   *  'all' sengaja pertama dan jadi default: README bagian 3 meminta console dan
   *  network tampil "dalam satu panel yang sama", dan bagian 2 menyebut
   *  informasi yang tersebar antar tab sebagai masalah yang mau diselesaikan.
   *  Tab di sini adalah LENSA ke satu aliran, bukan tujuh laporan terpisah. */
  var SCOPES = ['all', 'error', 'warn', 'info', 'log', 'debug', 'network'];

  var state = {
    tabId: -1,
    tabUrl: '',
    tabTitle: '',
    entries: [],
    max: core.LIMITS.MAX_ENTRIES,
    scope: 'all',
    failedOnly: false,
    group: true,
    // Baris milik extension lain disembunyikan atau tidak. Bawaannya TIDAK:
    // atribusinya heuristik, jadi baris itu diberi label, bukan dihilangkan.
    hideForeign: false,
    paused: false,
    // Entri yang masuk selagi dibekukan. Dihitung supaya penanda PAUSED bisa
    // menyebut angkanya - "dibekukan" tanpa angka tidak memberi tahu apakah
    // halaman masih hidup.
    pausedCount: 0,
    query: '',
    expanded: {},            // entry.id -> true
    blockedReason: null,
    lastFiltered: [],
    // Id entri tertinggi yang sudah pernah dirender. Dipakai untuk menandai
    // baris mana yang benar-benar BARU, supaya isyarat kedatangan hanya jalan
    // di baris itu dan bukan di seluruh daftar setiap render.
    maxRenderedId: 0,
    primed: false,
    // Hitungan per tab pada render sebelumnya, untuk mendeteksi kenaikan.
    prevCounts: {},
    // Jumlah entri baru yang tiba sementara pengguna sedang membaca bagian atas
    // daftar. Dipakai tombol "jump to latest".
    pendingBelow: 0,
    // Id entri LAMA yang hitungannya bertambah sejak render terakhir. Entri yang
    // digabung di buffer tidak mendapat id baru, jadi tanpa ini kejadian ulangan
    // di bawah lipatan tidak memunculkan tombol "jump to latest" sama sekali.
    bumped: new Set(),
    // Baris yang terakhir dirender, per id. Tombol copy harus menyalin baris
    // SEPERTI YANG TERLIHAT - termasuk hitungan hasil pengelompokan tampilan -
    // bukan entri buffer mentah di baliknya.
    rowsById: new Map()
  };

  /** Cache teks pencarian per id entri.
   *
   *  KENAPA PERLU. `passesCommon()` membangun ulang teks pencarian dengan
   *  `entryToLine()` setiap kali dipanggil, dan `countsByScope()` memanggilnya
   *  untuk KETUJUH lensa. Dengan buffer penuh, satu ketikan berarti sekitar
   *  4.000 pembangunan string - masing-masing memformat timestamp dan
   *  menggabungkan field. Hasilnya lag mengetik yang muncul justru saat buffer
   *  besar, yaitu saat pencarian paling dibutuhkan.
   *
   *  Aman di-cache karena entri tidak pernah berubah setelah masuk buffer:
   *  service worker mengirim salinan yang sudah disanitasi dan panel tidak
   *  menyuntingnya. */
  var searchCache = new Map();

  function haystackFor(entry) {
    var cached = searchCache.get(entry.id);
    if (cached !== undefined) return cached;
    var text = entryToLine(entry);
    if (entry.requestBody) text += ' ' + entry.requestBody;
    text = text.toLowerCase();
    searchCache.set(entry.id, text);
    return text;
  }

  /** Cache tanda tangan identitas per id, dengan alasan yang sama seperti cache
   *  pencarian: countsByScope memanggilnya untuk ketujuh lensa, dan tanda tangan
   *  sekarang memakai JSON.stringify atas seluruh isi entri.
   *
   *  Aman walaupun entri bisa DIGANTI oleh pembaruan dari service worker:
   *  entri hanya pernah digabung dengan kejadian yang tanda tangannya identik,
   *  jadi tanda tangannya tidak pernah berubah. Yang berubah hanya hitungan,
   *  waktu terakhir, dan durasi terbesar - tiga hal yang sengaja dikecualikan
   *  dari tanda tangan. */
  var signatureCache = new Map();

  function signatureFor(entry) {
    if (signatureCache.has(entry.id)) return signatureCache.get(entry.id);
    var sig = core.entrySignature(entry);
    signatureCache.set(entry.id, sig);
    return sig;
  }

  /** Lupakan entri dari semua cache sekaligus. Satu fungsi, supaya cache yang
   *  ditambahkan nanti tidak terlupa dibersihkan di salah satu jalur. */
  function forgetEntries(list) {
    for (var i = 0; i < list.length; i++) {
      searchCache.delete(list[i].id);
      signatureCache.delete(list[i].id);
    }
  }

  function forgetAllEntries() {
    searchCache.clear();
    signatureCache.clear();
    state.rowsById = new Map();
    state.bumped = new Set();
  }

  // ---------------------------------------------------------------------------
  // Halaman yang tidak bisa diakses extension
  // ---------------------------------------------------------------------------

  /** Mengembalikan pesan penjelas, atau null kalau halaman seharusnya bisa
   *  disuntik. Teks pesan mengikuti README bagian 10: harus menyebut jalan
   *  keluarnya, bukan sekadar mengabarkan kegagalan. */
  function restrictionFor(url) {
    var u = String(url || '');
    if (!u) return 'No active tab detected. Focus a normal web page, then reopen this panel.';

    if (/^file:\/\//i.test(u)) {
      // Kasus khusus yang paling sering bikin bingung: halaman file:// TIDAK
      // disuntik sampai izinnya dinyalakan manual, dan pesan defaultnya tidak
      // menyebut itu sama sekali. Diperiksa SEBELUM isRestrictedUrl, yang
      // menganggap file:// bisa dibaca justru supaya pesan ini yang muncul.
      return 'Local file detected. Open chrome://extensions, click Details on Rapspect, ' +
             'and turn on "Allow access to file URLs". Cross-origin fetch still fails on ' +
             'file:// pages, so serve the test page over http://localhost instead.';
    }

    // Definisinya di core, dipakai bersama service worker. Dulu daftar di sini
    // dan penyaring di worker bisa berbeda; sekarang satu fungsi.
    if (core.isRestrictedUrl(u)) {
      return "Can't read this page. Extensions can't access chrome:// or Web Store pages.";
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Tema (kulit aplikasi saja, README bagian 5)
  // ---------------------------------------------------------------------------

  function applyTheme(theme) {
    var value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    // Label tombol menyebut tema yang akan DITUJU, bukan yang sedang aktif.
    el.theme.textContent = value === 'dark' ? 'Light mode' : 'Dark mode';
  }

  function loadTheme() {
    // storage.local, bukan storage.session: ini preferensi tampilan, bukan data
    // log. README bagian 4 hanya mengeluarkan penyimpanan LOG lintas sesi.
    try {
      chrome.storage.local.get(THEME_KEY, function (res) {
        applyTheme(res && res[THEME_KEY] ? res[THEME_KEY] : 'dark');
      });
    } catch (e) { applyTheme('dark'); }
  }

  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    var payload = {};
    payload[THEME_KEY] = next;
    try { chrome.storage.local.set(payload); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Format
  // ---------------------------------------------------------------------------

  // Semua pemformat pindah ke rapspect-core.js: logika string murni yang di
  // panel.js tidak bisa diuji tanpa browser. Alias pendek di bawah hanya supaya
  // pemanggilnya tetap terbaca.
  var formatTime = core.formatTime;
  var formatBytes = core.formatBytes;
  var tagFor = core.tagFor;
  var entryToLine = core.entryToLine;

  /** Isi blok detail di panel. Sengaja teks polos di dalam <pre>: isinya sering
   *  di-copy-paste utuh ke bug report.
   *
   *  Dibangun di atas core.entryDetail() dan hanya menambahkan keterangan yang
   *  khusus untuk tampilan panel - laporan Markdown dan Jira tidak
   *  membutuhkannya. */
  function detailsText(entry) {
    var lines = [core.entryDetail(entry)];
    if (entry.repeatCount > 1) {
      lines.push('');
      lines.push('repeated     : ' + entry.repeatCount + ' times in a row, first at ' +
                 formatTime(entry.t) +
                 (entry.lastT ? ', last at ' + formatTime(entry.lastT) : ''));
      // Harga penggabungan disebut terang-terangan: waktu tiap kejadian di
      // tengah deret tidak disimpan. Yang disimpan hanya pertama dan terakhir.
      lines.push('               individual times between first and last are not kept');
    }
    if (entry.origin) lines.push('frame origin : ' + entry.origin);
    if (entry.kind === 'network') {
      lines.push('note         : response body is never captured (README section 4)');
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Pengelompokan entri identik berulang
  // ---------------------------------------------------------------------------

  /** Pengelompokan TAMPILAN: satu dari dua lapis penggabungan.
   *
   *  KOREKSI atas versi sebelumnya. Komentar di sini dulu mengklaim fungsi ini
   *  "melindungi anggaran 500 entri". Itu keliru: fungsi ini hanya mengubah
   *  tampilan, sementara service worker tetap menyimpan setiap kejadian. Yang
   *  benar-benar melindungi buffer sekarang adalah core.ingest() di service
   *  worker, yang menggabungkan kejadian identik berurutan SEBELUM disimpan.
   *
   *  Yang tersisa untuk lapis ini: entri identik yang baru BERSEBELAHAN karena
   *  tab atau pencarian menyembunyikan baris di antaranya. Di buffer mereka
   *  tidak berurutan, jadi ingest() sengaja tidak menyentuhnya.
   *
   *  Dua perbaikan lain ikut di sini:
   *  - identitasnya kini ketat. Dulu hanya teks pesan yang dibandingkan, jadi
   *    pesan sama dari dua tempat berbeda di kode digabung dan stack trace yang
   *    kedua hilang dari tampilan
   *  - hitungan DIJUMLAHKAN. Entri buffer x5 dan x3 menjadi satu baris x8,
   *    bukan x2 */
  function groupRepeats(list) {
    if (!state.group) return list;
    return core.groupRows(list, signatureFor);
  }

  function hasDetails(entry) {
    // Pembatas navigasi yang URL-nya diringkas WAJIB punya tombol details.
    // Tanpa itu, query string yang dipotong dari baris tidak bisa dilihat di
    // mana pun kecuali lewat tooltip - dan tooltip tidak bisa disalin.
    if (entry.kind === 'navigation') return core.compactUrl(navigationUrl(entry)).trimmed;
    // repeatCount ikut: waktu kejadian terakhir hanya ada di blok detail, jadi
    // baris berpenghitung tanpa tombol details akan menyembunyikannya.
    return entry.kind === 'network' || !!entry.stack || entry.redacted > 0 ||
           entry.repeatCount > 1 || String(entry.text || '').length > 160;
  }

  // ---------------------------------------------------------------------------
  // Pewarnaan sintaks
  // ---------------------------------------------------------------------------

  /** Peta tipe token dari core ke nama kelas CSS. Token bertipe 'plain' tidak
   *  ada di sini dengan sengaja: dia ditulis sebagai text node tanpa span, jadi
   *  mayoritas isi log tetap teks biasa berwarna default. */
  var TOKEN_CLASS = {
    url:      'rp-syn-url',
    num:      'rp-syn-num',
    type:     'rp-syn-type',
    kw:       'rp-syn-kw',
    redacted: 'rp-syn-redacted'
  };

  /** Tulis teks ke dalam container dengan bagian berstrukturnya diwarnai.
   *
   *  Tokenisasinya ada di rapspect-core.js supaya bisa diuji tanpa browser;
   *  fungsi ini hanya menerjemahkan token menjadi node DOM.
   *
   *  SELALU textContent, NIHIL innerHTML. Teks ini berasal dari halaman yang
   *  sedang diuji. Memasukkannya sebagai HTML akan menjadikan panel Rapspect
   *  target injeksi dari halaman mana pun yang dibuka QA - dan panel ini adalah
   *  halaman extension dengan akses penuh ke chrome.*. */
  function appendHighlighted(container, rawText) {
    var tokens = core.tokenizeLog(rawText);
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var cls = TOKEN_CLASS[token.t];
      if (!cls) {
        container.appendChild(document.createTextNode(token.v));
        continue;
      }
      var node = document.createElement('span');
      node.className = cls;
      node.textContent = token.v;
      container.appendChild(node);
    }
  }

  /** Dipakai untuk URL network yang sudah berdiri sendiri sebagai satu nilai. */
  function appendUrlToken(container, url) {
    appendHighlighted(container, url);
  }

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------

  /** Apakah entri termasuk dalam lensa yang diminta.
   *
   *  Pembatas navigasi (PAGE) hanya muncul di lensa 'all'. Secara teknis
   *  levelnya 'info', tapi menampilkannya di tab Info membuat tab itu tercampur
   *  hal yang bukan pesan aplikasi. Di tab All dia tetap penting sebagai penanda
   *  urutan kejadian. */
  function matchesScope(entry, scope) {
    if (scope === 'all') return true;
    if (scope === 'network') return entry.kind === 'network';
    if (entry.kind === 'navigation') return false;
    return entry.level === scope;
  }

  /** Filter yang berlaku di SEMUA lensa: pencarian teks dan "Failed only".
   *  Dipisah dari matchesScope supaya hitungan tiap tab bisa dihitung dengan
   *  aturan yang sama persis seperti isi tab itu saat dibuka - hitungan yang
   *  tidak cocok dengan isinya lebih buruk daripada tidak ada hitungan. */
  function passesCommon(entry) {
    // Diperiksa di sini, bukan di matchesScope, supaya berlaku di SEMUA lensa
    // dan ikut dihitung angka tab dengan aturan yang sama.
    if (state.hideForeign && entry.extId) return false;
    if (state.failedOnly) {
      if (entry.kind !== 'network') return false;
      if (!(entry.failed || entry.status >= 400)) return false;
    }
    if (state.query && haystackFor(entry).indexOf(state.query) === -1) return false;
    return true;
  }

  function passesFilter(entry) {
    return matchesScope(entry, state.scope) && passesCommon(entry);
  }

  /** Hitung isi setiap tab: jumlah BARIS yang akan terlihat saat tab itu dibuka.
   *
   *  KOREKSI atas versi sebelumnya, yang menghitung entri SEBELUM pengelompokan.
   *  Dengan "Group repeats" menyala - dan itu bawaannya - tab Error bisa menulis
   *  8 sementara isinya satu baris x8. Itu melanggar jaminan V-81: angka tab
   *  selalu sama dengan jumlah baris yang tampil.
   *
   *  Penghitungnya core.countRows(), yang aturannya diuji identik dengan
   *  core.groupRows() di tools/selftest-ingest.js. Menulis ulang logika yang sama
   *  di sini akan membuat keduanya pelan-pelan berbeda.
   *
   *  500 entri kali 7 lensa tetap tidak terasa: tanda tangan dan teks pencarian
   *  sama-sama di-cache per id. */
  function countsByScope() {
    var out = {};
    for (var s = 0; s < SCOPES.length; s++) {
      var scope = SCOPES[s];
      var matched = [];
      for (var i = 0; i < state.entries.length; i++) {
        if (matchesScope(state.entries[i], scope) && passesCommon(state.entries[i])) {
          matched.push(state.entries[i]);
        }
      }
      out[scope] = state.group ? core.countRows(matched, signatureFor) : matched.length;
    }
    return out;
  }

  function renderCounts() {
    var counts = countsByScope();

    el.counts.forEach(function (node) {
      var scope = node.getAttribute('data-count-for');
      var value = counts[scope] || 0;
      var before = state.prevCounts[scope];

      node.textContent = String(value);
      // Angka nol diredupkan supaya mata langsung menemukan tab yang ada isinya.
      node.classList.toggle('rp-tab__count--zero', value === 0);

      // Isyarat singkat kalau hitungan naik. Hanya saat NAIK: turun karena
      // pengguna mengubah filter bukan kabar baru, jadi tidak perlu ditandai.
      if (typeof before === 'number' && value > before) {
        node.classList.remove('rp-tab__count--bump');
        // Reflow dipaksa sekali supaya animasi bisa dijalankan ulang walaupun
        // kelasnya baru saja dilepas pada frame yang sama.
        void node.offsetWidth;
        node.classList.add('rp-tab__count--bump');
      }
      state.prevCounts[scope] = value;
    });
  }

  function switchScope(scope) {
    if (SCOPES.indexOf(scope) === -1) return;
    state.scope = scope;
    el.tabs.forEach(function (tab) {
      tab.setAttribute('aria-selected', tab.getAttribute('data-scope') === scope ? 'true' : 'false');
    });
    savePrefs();
    render();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  var renderTimer = null;

  /** Render dikumpulkan dalam satu tick. Halaman berisik bisa mengirim banyak
   *  batch berurutan; merender tiap batch akan membuat panel berkedip dan
   *  membuang CPU. */
  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(function () { renderTimer = null; render(); }, 60);
  }

  /** Sebut satu per satu filter yang sedang menyembunyikan baris.
   *
   *  Kalimat umum seperti "no results" tidak menolong: yang dibutuhkan QA adalah
   *  tahu SEBAB-nya. Kasus nyata yang memicu fungsi ini: centang "Failed only"
   *  masih aktif dari pemeriksaan sebelumnya, 20 dari 21 baris hilang, dan tidak
   *  ada apa pun di layar yang menjelaskan kenapa. */
  function describeActiveFilters() {
    var reasons = [];

    if (state.scope !== 'all') reasons.push('tab "' + state.scope + '" is selected');
    if (state.failedOnly) reasons.push('"Failed only (status >= 400)" is on');
    if (state.hideForeign) reasons.push('"Hide other extensions" is on');

    // Diambil dari nilai input, bukan dari state.query, karena state.query sudah
    // dijadikan huruf kecil untuk pencarian - menampilkannya kembali apa adanya
    // membuat pengguna tidak mengenali kata yang dia ketik sendiri.
    var typed = el.search.value.trim();
    if (typed) reasons.push('search is "' + typed + '"');

    return reasons;
  }

  /** Kembalikan semua filter ke keadaan awal: lensa All, tidak ada pembatasan
   *  request gagal, pencarian kosong, baris extension lain tampil.
   *
   *  "Hide other extensions" ikut direset walaupun lebih mirip preferensi. Tombol
   *  ini muncul tepat saat SEMUA baris tersembunyi, dan janjinya "tampilkan
   *  semuanya lagi". Tombol reset yang menyisakan satu filter tersembunyi akan
   *  meninggalkan pengguna di depan daftar kosong yang sama. */
  function resetFilters() {
    state.failedOnly = false;
    el.failed.checked = false;

    state.hideForeign = false;
    el.hideExt.checked = false;
    savePrefs();

    state.query = '';
    el.search.value = '';

    // switchScope sudah memanggil render(), jadi tidak perlu dipanggil dua kali.
    switchScope('all');
  }

  /** Sembunyikan semua panel penjelas sekaligus.
   *  Dipanggil di awal setiap cabang render() supaya tidak ada sisa panel dari
   *  keadaan sebelumnya yang menempel - bug klasik kalau tiap cabang hanya
   *  mengurus panelnya sendiri. */
  function hideAllNotices() {
    el.blocked.hidden = true;
    el.empty.hidden = true;
    el.nomatch.hidden = true;
    el.netHint.hidden = true;
  }

  /** Rekam posisi gulir SEBELUM isi daftar diganti.
   *
   *  Ambang 24px untuk "di dasar" bukan nol: dengan pembulatan subpiksel dan
   *  zoom browser, scrollTop nyaris tidak pernah sama persis dengan
   *  scrollHeight - clientHeight, jadi perbandingan ketat akan gagal terus. */
  function captureScroll() {
    var m = el.main;
    return {
      top: m.scrollTop,
      height: m.scrollHeight,
      atBottom: (m.scrollHeight - m.scrollTop - m.clientHeight) <= 24
    };
  }

  /** Pulihkan posisi gulir setelah isi daftar diganti.
   *
   *  DUA PERILAKU YANG BERBEDA, dan membedakannya yang penting:
   *
   *  Kalau pengguna sedang di dasar, dia sedang MENGIKUTI aliran log - seperti
   *  tab Console DevTools. Tetap tempel di dasar supaya entri baru terlihat.
   *
   *  Kalau dia sedang membaca di tengah, posisinya tidak boleh bergeser. Yang
   *  rumit: ring buffer membuang baris dari ATAS saat penuh, jadi tinggi konten
   *  menyusut dan baris yang sedang dibaca bergerak naik di bawah kursor.
   *  Selisih tinggi dipakai untuk mengoreksinya. */
  function restoreScroll(before) {
    var m = el.main;
    if (before.atBottom) {
      m.scrollTop = m.scrollHeight;
      return;
    }
    var delta = m.scrollHeight - before.height;
    // delta negatif berarti ada konten yang dibuang. Selama yang dibuang berada
    // di atas viewport - dan ring buffer memang selalu membuang dari depan -
    // menambahkan delta membuat baris yang sedang dibaca tetap di tempatnya.
    m.scrollTop = delta < 0 ? Math.max(0, before.top + delta) : before.top;
  }

  function showJump(count) {
    if (count <= 0) { hideJump(); return; }
    el.jumpText.textContent = count === 1 ? '1 new entry' : count + ' new entries';
    el.jump.hidden = false;
  }

  function hideJump() {
    state.pendingBelow = 0;
    el.jump.hidden = true;
  }

  function render() {
    renderCounts();

    // Ambang animasi dikunci SEBELUM state diperbarui, dan dihitung dari
    // SELURUH entri, bukan hanya yang lolos filter.
    //
    // Versi sebelumnya hanya memajukan maxRenderedId sepanjang baris yang
    // tampil. Akibatnya: duduk di tab Error sementara entri log terus masuk,
    // maxRenderedId tidak pernah melewati entri-entri itu, lalu berpindah ke tab
    // All membuat puluhan baris lama ikut beranimasi seolah baru datang.
    var animateAbove = state.primed ? state.maxRenderedId : Infinity;
    var globalMax = state.maxRenderedId;
    for (var g = 0; g < state.entries.length; g++) {
      if (state.entries[g].id > globalMax) globalMax = state.entries[g].id;
    }
    state.maxRenderedId = globalMax;
    state.primed = true;

    // ---- keadaan 1: halaman tidak bisa diakses extension ----
    if (state.blockedReason) {
      hideJump();
      hideAllNotices();
      el.blockedText.textContent = state.blockedReason;
      el.blocked.hidden = false;
      el.list.textContent = '';
      el.count.textContent = '0 shown / 0 captured';
      // Dikosongkan juga, supaya Copy dan Export tidak memakai hasil filter
      // dari tab sebelumnya setelah pindah ke halaman yang tidak bisa dibaca.
      state.lastFiltered = [];
      return;
    }

    var filtered = [];
    for (var i = 0; i < state.entries.length; i++) {
      if (passesFilter(state.entries[i])) filtered.push(state.entries[i]);
    }
    state.lastFiltered = filtered;

    // ---- keadaan 2: belum ada data sama sekali ----
    if (!state.entries.length) {
      hideJump();
      hideAllNotices();
      el.empty.hidden = false;
      el.list.textContent = '';
      el.count.textContent = '0 shown / 0 captured';
      return;
    }

    // ---- keadaan 3: ada data, tapi filter menyembunyikan semuanya ----
    // Ini keadaan yang BERBEDA dari keadaan 2, dan membedakannya penting:
    // "belum ada apa-apa yang tertangkap" menyuruh pengguna reload halaman,
    // sedangkan "tertangkap tapi tersaring" menyuruh pengguna mengubah filter.
    // Menyamakan keduanya mengirim pengguna ke arah yang salah.
    if (!filtered.length) {
      hideJump();
      hideAllNotices();
      el.nomatchTitle.textContent = state.entries.length +
        (state.entries.length === 1 ? ' entry captured, ' : ' entries captured, ') +
        'none match the current filter.';

      var reasons = describeActiveFilters();
      el.nomatchWhy.textContent = reasons.length
        ? 'Active: ' + reasons.join('; ') + '.'
        : 'No filter is active, so this is unexpected. Please report it.';

      el.nomatch.hidden = false;

      // Kalau yang kosong adalah tab Network, penjelasan filter saja tidak
      // cukup. Penyebab paling sering bukan filter, tapi kesalahpahaman: DevTools
      // memperlihatkan puluhan baris network sementara Rapspect kosong, karena
      // stylesheet, gambar, dan script tidak pernah lewat fetch atau XHR.
      if (state.scope === 'network') el.netHint.hidden = false;

      el.list.textContent = '';
      el.count.textContent = '0 shown / ' + state.entries.length +
                             ' captured (buffer ' + state.max + ')';
      return;
    }

    // ---- keadaan 4: ada yang bisa ditampilkan ----
    hideAllNotices();

    // Posisi gulir direkam sebelum DOM diganti. Sebelum ini ada, tidak ada
    // penanganan gulir sama sekali: entri baru tiba di bawah lipatan tanpa
    // pemberitahuan, dan pemangkasan ring buffer menggeser baris yang sedang
    // dibaca.
    var before = captureScroll();

    var rows = groupRepeats(filtered);

    var frag = document.createDocumentFragment();
    var arrived = 0;
    var occurrences = 0;
    var rowsById = new Map();
    for (var j = 0; j < rows.length; j++) {
      // Baris dianggap "ada kabar baru" kalau entrinya baru, ATAU entri lamanya
      // bertambah hitungan. Yang kedua tidak mendapat animasi kedatangan -
      // barisnya sudah ada, dan menggerakkannya lagi akan membuat daftar
      // berkedip selama halaman berada di dalam loop error.
      if (rows[j].id > animateAbove || state.bumped.has(rows[j].id)) arrived++;
      occurrences += core.occurrencesOf(rows[j]);
      rowsById.set(rows[j].id, rows[j]);
      frag.appendChild(buildEntryNode(rows[j], animateAbove));
    }
    state.rowsById = rowsById;
    state.bumped = new Set();

    // Satu penggantian isi, bukan menambah node satu per satu ke DOM hidup.
    el.list.textContent = '';
    el.list.appendChild(frag);

    restoreScroll(before);

    // Tombol "jump to latest" hanya berarti kalau pengguna TIDAK sedang di dasar.
    // Kalau dia di dasar, entri barunya sudah terlihat.
    if (before.atBottom) {
      hideJump();
    } else if (arrived > 0) {
      state.pendingBelow += arrived;
      showJump(state.pendingBelow);
    }

    // Dua angka, dua pertanyaan berbeda. "shown" adalah jumlah baris di layar;
    // "events" adalah jumlah kejadian sebenarnya di balik baris-baris itu, dan
    // hanya disebut kalau berbeda. "captured" adalah slot ring buffer yang
    // terpakai - satu kejadian berulang memakai SATU slot, dan justru itu yang
    // membuat angka events bisa melebihi angka captured.
    var shown = rows.length + ' shown' +
      (occurrences !== rows.length ? ' (' + occurrences + ' events)' : '');
    el.count.textContent = shown + ' / ' + state.entries.length +
                           ' captured (buffer ' + state.max + ')';
  }

  function buildEntryNode(entry, animateAbove) {
    var wrap = document.createElement('div');
    var classes = 'rp-entry';
    if (entry.kind === 'navigation') classes += ' rp-entry--navigation';
    if (entry.extId) classes += ' rp-entry--foreign';
    // Isyarat kedatangan hanya untuk baris yang benar-benar baru. Ambangnya
    // diterima sebagai argumen, bukan dibaca dari state, karena state sudah
    // diperbarui ke nilai terbaru di awal render() - membacanya di sini akan
    // selalu menghasilkan false.
    if (entry.id > animateAbove) classes += ' rp-entry--new';
    wrap.className = classes;
    wrap.setAttribute('data-level', entry.level);
    wrap.setAttribute('role', 'listitem');

    var row = document.createElement('div');
    row.className = 'rp-row';

    var time = document.createElement('span');
    time.className = 'rp-row__time';
    time.textContent = formatTime(entry.t);

    var tag = document.createElement('span');
    tag.className = 'rp-row__tag';
    tag.textContent = tagFor(entry);

    var msg = document.createElement('span');
    msg.className = 'rp-row__msg';
    fillMessage(msg, entry);

    // Label asal diletakkan di AWAL pesan, bukan di akhir. Error dari extension
    // lain hampir selalu unhandled rejection yang stack-nya ikut di dalam teks,
    // jadi akhir pesannya bisa sepuluh baris di bawah - label di sana tidak akan
    // terlihat saat mata memindai daftar.
    if (entry.extId) {
      var ext = document.createElement('span');
      ext.className = 'rp-ext';
      ext.textContent = 'EXT';
      ext.title = 'From another browser extension, not from this page. ' +
                  'Every stack frame belongs to extension ' + entry.extId + '. ' +
                  'Open chrome://extensions/?id=' + entry.extId + ' to see which one.';
      msg.insertBefore(ext, msg.firstChild);
    }

    // Penghitung pengulangan. Waktu yang ditampilkan adalah kemunculan PERTAMA;
    // yang terakhir ada di blok detail. Menampilkan yang terakhir di baris akan
    // membuat urutan waktu di kolom kiri terlihat melompat.
    if (entry.repeatCount > 1) {
      var repeat = document.createElement('span');
      repeat.className = 'rp-repeat';
      repeat.textContent = '\u00d7' + entry.repeatCount;
      repeat.title = 'Repeated ' + entry.repeatCount + ' times in a row';
      msg.appendChild(repeat);
    }

    row.appendChild(time);
    row.appendChild(tag);
    row.appendChild(msg);
    wrap.appendChild(row);

    var actions = document.createElement('div');
    actions.className = 'rp-rowactions';
    row.appendChild(actions);

    // Salin satu baris. README bagian 2 menyebut menyalin bukti ke bug report
    // sebagai masalah nomor dua; sering yang dibutuhkan hanya SATU baris, dan
    // menyeleksinya dengan kursor di panel sempit itu menjengkelkan.
    var rowCopy = document.createElement('button');
    rowCopy.type = 'button';
    rowCopy.className = 'rp-toggle';
    rowCopy.setAttribute('data-copy-id', String(entry.id));
    rowCopy.textContent = 'copy';
    actions.appendChild(rowCopy);

    if (hasDetails(entry)) {
      var expanded = !!state.expanded[entry.id];

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'rp-toggle';
      toggle.setAttribute('data-entry-id', String(entry.id));
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.textContent = expanded ? 'hide details' : 'details';
      actions.appendChild(toggle);

      if (expanded) {
        var details = document.createElement('div');
        details.className = 'rp-details';
        var pre = document.createElement('pre');
        // Di sinilah pewarnaan paling terasa: blok detail berisi stack trace
        // penuh, dan itu bentuk teks yang paling sulit dipindai tanpa struktur.
        appendHighlighted(pre, detailsText(entry));
        details.appendChild(pre);
        wrap.appendChild(details);
      }
    }
    return wrap;
  }

  /** Isi kolom pesan. Memakai beberapa <span> supaya method dan status bisa
   *  dibuat tebal tanpa menambah warna baru - aturan "satu warna satu makna"
   *  (README bagian 6) tetap aman. */
  /** URL lengkap sebuah pembatas navigasi. Entri dari versi sebelumnya belum
   *  punya field url, jadi diambil dari teksnya sebagai cadangan. */
  function navigationUrl(entry) {
    return entry.url || String(entry.text || '').replace(/^Page load:\s*/, '');
  }

  function fillMessage(container, entry) {
    if (entry.kind === 'navigation') {
      // Satu baris, selalu. Pembatas halaman seharusnya baris paling tenang di
      // daftar; URL pencarian Google yang dulu tampil utuh membungkus sampai
      // lima baris dan mendorong semua log lain ke bawah.
      //
      // Lokasinya tetap diwarnai sama seperti URL di stack trace dan baris NET,
      // supaya "ini sebuah lokasi" berarti hal yang sama di mana pun. Yang
      // dipotong dari baris - query, fragment, bagian tengah path yang panjang -
      // tetap utuh di blok detail dan di tooltip.
      var full = navigationUrl(entry);
      var compact = core.compactUrl(full);
      container.appendChild(document.createTextNode('Page load: '));
      var place = document.createElement('span');
      place.className = 'rp-syn-url';
      place.textContent = compact.text;
      container.appendChild(place);
      container.title = full;
      return;
    }
    if (entry.kind !== 'network') {
      appendHighlighted(container, entry.text);
      return;
    }
    var method = document.createElement('span');
    method.className = 'rp-strong';
    method.textContent = entry.method + ' ';

    var status = document.createElement('span');
    status.className = 'rp-strong';
    status.textContent = (entry.failed ? 'FAILED' : String(entry.status)) + ' ';

    var meta = document.createElement('span');
    meta.className = 'rp-meta';
    var bits = [];
    if (entry.durationMs != null) bits.push(entry.durationMs + ' ms');
    var size = formatBytes(entry.sizeBytes);
    if (size) bits.push(size);
    meta.textContent = bits.length ? bits.join(' \u00b7 ') + ' \u00b7 ' : '';

    container.appendChild(method);
    container.appendChild(status);
    container.appendChild(meta);
    // URL diwarnai dengan token yang sama seperti di stack trace, jadi "ini
    // sebuah lokasi" berarti hal yang sama di mana pun ia muncul.
    appendUrlToken(container, entry.url);

    if (entry.redacted > 0) {
      var flag = document.createElement('span');
      flag.className = 'rp-redacted-flag';
      flag.textContent = ' [' + entry.redacted + ' redacted]';
      container.appendChild(flag);
    }
  }

  // ---------------------------------------------------------------------------
  // Komunikasi dengan service worker
  // ---------------------------------------------------------------------------

  /** Pembungkus sendMessage berbasis promise yang TIDAK pernah reject.
   *  Service worker yang sedang tidur, panel yang baru dibuka, dan extension
   *  yang baru di-reload semuanya menghasilkan error di sini, dan semuanya
   *  adalah keadaan normal - bukan alasan untuk menampilkan error ke QA. */
  function ask(message) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (response) {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(response || null);
        });
      } catch (e) { resolve(null); }
    });
  }

  async function requestSnapshot() {
    var res = await ask({ type: 'rp:snapshot', tabId: state.tabId });
    if (!res) {
      // Percobaan kedua: pesan pertama sering dipakai hanya untuk MEMBANGUNKAN
      // service worker yang sudah mati, dan pesan itu sendiri hilang.
      res = await ask({ type: 'rp:snapshot', tabId: state.tabId });
    }
    state.entries = (res && Array.isArray(res.entries)) ? res.entries : [];
    if (res && typeof res.max === 'number') state.max = res.max;

    // Snapshot berarti seluruh isi berganti - biasanya karena pengguna pindah
    // tab. Dua hal harus di-reset:
    //  - cache pencarian, karena entrinya tidak lagi ada di daftar
    //  - penanda primed, supaya render pertama untuk tab baru tidak
    //    menganimasikan ratusan baris sekaligus hanya karena id-nya lebih tinggi
    //    daripada yang pernah dirender di tab sebelumnya
    forgetAllEntries();
    state.primed = false;
    state.maxRenderedId = 0;
    hideJump();

    render();
  }

  async function resolveActiveTab() {
    var tabs = [];
    try {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch (e) { tabs = []; }
    // Isi cache milik tab sebelumnya tidak boleh terbawa ke tab yang baru.
    // Id entri unik secara global, jadi tidak akan salah cocok, tapi Map-nya akan
    // terus tumbuh selama pengguna berpindah tab.
    forgetAllEntries();

    var tab = tabs && tabs[0];
    if (!tab) {
      state.tabId = -1;
      state.blockedReason = restrictionFor('');
      render();
      return;
    }

    state.tabId = tab.id;
    state.tabUrl = tab.url || '';
    state.tabTitle = tab.title || '';
    state.blockedReason = restrictionFor(state.tabUrl);

    el.target.textContent = state.tabTitle
      ? state.tabTitle + ' - ' + state.tabUrl
      : (state.tabUrl || 'No active tab');
    el.target.title = state.tabUrl;

    if (state.blockedReason) { state.entries = []; render(); return; }
    await requestSnapshot();
  }

  /** Cari posisi entri berdasarkan id, mulai dari belakang. Pembaruan dari
   *  service worker hampir selalu mengenai entri TERAKHIR - hanya entri itu yang
   *  bisa digabung - jadi pencarian dari belakang selesai di langkah pertama. */
  function indexOfEntryId(id) {
    for (var i = state.entries.length - 1; i >= 0; i--) {
      if (state.entries[i].id === id) return i;
    }
    return -1;
  }

  // Dorongan dari service worker: entri baru, dan entri lama yang hitungannya
  // bertambah karena kejadian identik digabung di buffer.
  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg || msg.type !== 'rp:push') return;
    if (msg.tabId !== state.tabId) return;           // log dari tab lain, abaikan

    var fresh = Array.isArray(msg.entries) ? msg.entries : [];
    var changed = Array.isArray(msg.updated) ? msg.updated : [];
    if (!fresh.length && !changed.length) return;

    // Jumlah KEJADIAN yang baru tiba, bukan jumlah pesan. Dipakai penanda
    // PAUSED supaya "+N" tetap jujur walaupun kejadiannya digabung.
    var arrivedEvents = 0;

    for (var u = 0; u < changed.length; u++) {
      var index = indexOfEntryId(changed[u].id);
      // -1 berarti entrinya sudah terpangkas dari salinan panel. Wajar, dan
      // bukan alasan untuk menambahkannya kembali di posisi yang salah.
      if (index === -1) continue;
      arrivedEvents += Math.max(0,
        core.occurrencesOf(changed[u]) - core.occurrencesOf(state.entries[index]));
      // Diganti utuh, bukan ditambal field per field, supaya panel tidak perlu
      // tahu aturan penggabungan apa pun. Cache tetap sah: tanda tangan dan teks
      // pencarian entri yang digabung tidak pernah berubah.
      state.entries[index] = changed[u];
      state.bumped.add(changed[u].id);
    }

    for (var i = 0; i < fresh.length; i++) {
      state.entries.push(fresh[i]);
      arrivedEvents += core.occurrencesOf(fresh[i]);
    }

    // Panel menegakkan batas yang sama dengan service worker, supaya keduanya
    // tidak pernah berbeda isi.
    if (state.entries.length > state.max) {
      // Cache dibersihkan bersama entrinya. Tanpa ini, id terus bertambah
      // sepanjang sesi dan Map-nya tumbuh tanpa batas untuk entri yang sudah
      // tidak pernah dilihat lagi.
      forgetEntries(state.entries.splice(0, state.entries.length - state.max));
    }

    // Saat dibekukan, entri tetap MASUK tapi tidak dirender. Hitungan tab juga
    // ikut beku dengan sendirinya, karena renderCounts() dipanggil dari render().
    // Angka yang bergerak sementara daftarnya diam justru membingungkan.
    if (state.paused) {
      state.pausedCount += arrivedEvents;
      updatePausedBadge();
      return;
    }

    scheduleRender();
  });

  chrome.tabs.onActivated.addListener(function () { resolveActiveTab(); });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (tabId !== state.tabId) return;
    // URL berubah berarti status "halaman terlarang" bisa berubah juga, jadi
    // seluruh penyelesaian tab dijalankan ulang, bukan cuma label judulnya.
    if (changeInfo.url) { resolveActiveTab(); return; }
    if (changeInfo.title) {
      state.tabTitle = changeInfo.title;
      el.target.textContent = state.tabTitle + ' - ' + state.tabUrl;
    }
  });

  // ---------------------------------------------------------------------------
  // Aksi
  // ---------------------------------------------------------------------------

  async function doClear() {
    state.expanded = {};
    forgetAllEntries();
    hideJump();
    await ask({ type: 'rp:clear', tabId: state.tabId });
    state.entries = [];
    render();
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /** Pause membekukan TAMPILAN, bukan penangkapan.
   *
   *  Dua tafsir mungkin untuk "pause", dan pilihannya bukan sepele: menyetop
   *  capture juga akan mencegah ring buffer terisi noise, tapi bukti yang tidak
   *  tertangkap tidak bisa dikembalikan. Tampilan yang tertahan bisa. Jadi entri
   *  tetap mengalir masuk ke state; hanya render yang ditahan.
   *
   *  Penanda PAUSED dibuat mencolok karena panel yang dibekukan dan panel yang
   *  rusak terlihat sama persis dari luar. */
  function setPaused(paused) {
    state.paused = !!paused;
    el.pause.setAttribute('aria-pressed', state.paused ? 'true' : 'false');
    el.pause.textContent = state.paused ? 'Resume' : 'Pause';

    if (!state.paused) {
      state.pausedCount = 0;
      el.pausedBadge.hidden = true;
      render();
      return;
    }
    updatePausedBadge();
  }

  function updatePausedBadge() {
    el.pausedBadge.hidden = false;
    el.pausedBadge.textContent = state.pausedCount > 0
      ? 'PAUSED +' + state.pausedCount
      : 'PAUSED';
  }

  // ---------------------------------------------------------------------------
  // Preferensi yang diingat
  // ---------------------------------------------------------------------------

  var PREFS_KEY = 'rp:prefs';

  /** Yang diingat: tab, filter request gagal, pengelompokan, dan field redaction
   *  tambahan.
   *
   *  Yang SENGAJA TIDAK diingat, dan ini yang penting:
   *
   *  - Teks pencarian. Panel yang terbuka dengan pencarian aktif dari sesi lain
   *    tampak seperti panel yang kehilangan data.
   *  - Status paused. Membuka panel dalam keadaan dibekukan adalah cara tercepat
   *    menyimpulkan bahwa capture-nya rusak. */
  function savePrefs() {
    var payload = {};
    payload[PREFS_KEY] = {
      scope: state.scope,
      failedOnly: state.failedOnly,
      group: state.group,
      hideForeign: state.hideForeign,
      extra: el.extra.value
    };
    try { chrome.storage.local.set(payload); } catch (e) {}
  }

  function loadPrefs() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(PREFS_KEY, function (res) {
          var p = (res && res[PREFS_KEY]) || {};

          if (typeof p.failedOnly === 'boolean') {
            state.failedOnly = p.failedOnly;
            el.failed.checked = p.failedOnly;
          }
          if (typeof p.group === 'boolean') {
            state.group = p.group;
            el.group.checked = p.group;
          }
          if (typeof p.hideForeign === 'boolean') {
            state.hideForeign = p.hideForeign;
            el.hideExt.checked = p.hideForeign;
          }
          if (typeof p.extra === 'string' && p.extra) {
            el.extra.value = p.extra;
            core.setExtraFields(parseExtraFields(p.extra));
          }
          if (typeof p.scope === 'string' && SCOPES.indexOf(p.scope) !== -1) {
            state.scope = p.scope;
            el.tabs.forEach(function (tab) {
              tab.setAttribute('aria-selected',
                tab.getAttribute('data-scope') === p.scope ? 'true' : 'false');
            });
          }
          resolve();
        });
      } catch (e) { resolve(); }
    });
  }

  function parseExtraFields(raw) {
    return String(raw || '').split(',').map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function applyExtraFields() {
    var list = parseExtraFields(el.extra.value);
    var applied = core.setExtraFields(list);

    // Ditulis ke storage.local, bukan dikirim sebagai pesan. Service worker
    // membacanya saat bangun DAN mendengarkan storage.onChanged, jadi setelan
    // tetap berlaku walaupun worker sedang mati saat ini disimpan.
    var payload = {};
    payload['rp:extraRedact'] = applied;
    try { chrome.storage.local.set(payload); } catch (e) {}

    updateRedactionIndicator();
    savePrefs();
  }

  function updateRedactionIndicator() {
    var extra = core.getExtraFields();
    el.redaction.textContent = extra.length ? 'Redaction ON +' + extra.length : 'Redaction ON';
    el.redaction.title = 'Redaction is always on in v1 and cannot be turned off.\n' +
      'Headers: ' + core.REDACTED_HEADERS.join(', ') + '\n' +
      'Fields: ' + core.REDACTED_FIELDS.join(', ') +
      (extra.length ? '\nAdded by you: ' + extra.join(', ') : '');
  }

  function reportMeta() {
    return {
      url: state.tabUrl,
      title: state.tabTitle,
      tab: state.scope,
      failedOnly: state.failedOnly,
      query: el.search.value.trim(),
      total: state.entries.length,
      max: state.max
    };
  }

  /** Entri yang diekspor mengikuti apa yang TERLIHAT, termasuk pengelompokan.
   *  Laporan yang tidak cocok dengan panel saat dibuat akan membingungkan orang
   *  yang membacanya di tiket. */
  function reportEntries() {
    return groupRepeats(state.lastFiltered);
  }

  /** Satu pintu untuk menulis ke clipboard, dipakai semua tombol salin. */
  async function writeClipboard(text) {
    try {
      // Butuh dokumen yang sedang fokus. Klik tombol sudah memenuhi itu, jadi
      // jalur ini yang dipakai lebih dulu dan tidak perlu izin clipboardWrite.
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback untuk kasus dokumen kehilangan fokus atau clipboard ditolak.
      return copyViaTextarea(text);
    }
  }

  async function doCopy() {
    var ok = await writeClipboard(core.buildReport('text', reportMeta(), reportEntries()));
    flashButton(el.copy, ok ? 'Copied' : 'Copy failed', 'Copy as text');
  }

  /** Salin satu baris saja, beserta detailnya kalau ada.
   *  Ini bentuk yang paling sering ditempelkan ke komentar tiket.
   *
   *  Yang disalin adalah baris SEPERTI YANG TERLIHAT. Versi sebelumnya mencari
   *  entri buffer mentah, sehingga baris hasil pengelompokan tampilan x8 tersalin
   *  sebagai entri pertamanya saja dengan hitungannya sendiri - teks di clipboard
   *  berbeda dari yang dilihat pengguna saat mengklik. */
  async function copySingle(id) {
    var entry = state.rowsById.get(id);
    if (!entry) {
      var index = indexOfEntryId(id);
      if (index !== -1) entry = state.entries[index];
    }
    if (!entry) return;

    var text = entryToLine(entry);
    if (entry.repeatCount > 1) text += '  (x' + entry.repeatCount + ')';
    if (hasDetails(entry)) text += '\n' + detailsText(entry);
    await writeClipboard(text);
  }

  function copyViaTextarea(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function flashButton(button, temporary, original) {
    button.textContent = temporary;
    button.disabled = true;
    setTimeout(function () {
      button.textContent = original;
      button.disabled = false;
    }, 1200);
  }

  var lastFocused = null;

  function openExportDialog() {
    el.modalHeaders.textContent = 'Redacted headers: ' + core.REDACTED_HEADERS.join(', ');
    el.modalFields.textContent = 'Redacted fields: ' + core.REDACTED_FIELDS.join(', ');
    lastFocused = document.activeElement;
    el.modal.hidden = false;
    el.modalConfirm.focus();
  }

  function closeExportDialog() {
    el.modal.hidden = true;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  var FORMAT_META = {
    markdown: { ext: 'md',   mime: 'text/markdown' },
    jira:     { ext: 'txt',  mime: 'text/plain' },
    json:     { ext: 'json', mime: 'application/json' },
    text:     { ext: 'txt',  mime: 'text/plain' }
  };

  function currentFormat() {
    var value = el.format.value;
    return FORMAT_META[value] ? value : 'markdown';
  }

  async function doExportCopy() {
    var format = currentFormat();
    var ok = await writeClipboard(core.buildReport(format, reportMeta(), reportEntries()));
    flashButton(el.modalCopy, ok ? 'Copied' : 'Failed', 'Copy');
    if (ok) setTimeout(closeExportDialog, 400);
  }

  function doExport() {
    var format = currentFormat();
    var meta = FORMAT_META[format];
    var text = core.buildReport(format, reportMeta(), reportEntries());

    var blob = new Blob([text], { type: meta.mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = buildFileName(meta.ext);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Object URL menahan blob di memori sampai dilepas. Jeda kecil memberi
    // Chrome waktu memulai unduhan sebelum URL-nya dibatalkan.
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    closeExportDialog();
    flashButton(el.exportBtn, 'Saved', 'Export');
  }

  function buildFileName(ext) {
    var host = 'page';
    try { host = new URL(state.tabUrl).hostname || 'page'; } catch (e) {}
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    var stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
                p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    // Pola nama ini yang diabaikan .gitignore lewat rapspect-*.json. Ekstensi
    // baru (md, txt) TIDAK tercakup pola itu - dicatat sebagai hal yang perlu
    // dilihat kalau nanti hasil ekspor mulai bocor ke commit.
    return 'rapspect-' + host.replace(/[^a-z0-9.\-]/gi, '_') + '-' + stamp + '.' + ext;
  }

  // ---------------------------------------------------------------------------
  // Binding event
  // ---------------------------------------------------------------------------

  el.jump.addEventListener('click', function () {
    el.main.scrollTop = el.main.scrollHeight;
    hideJump();
  });

  // Begitu pengguna menggulir sendiri sampai dasar, tombolnya tidak relevan lagi
  // dan hitungannya harus dilupakan - kalau tidak, angkanya akan terus menumpuk
  // dari kunjungan sebelumnya.
  el.main.addEventListener('scroll', function () {
    var m = el.main;
    if ((m.scrollHeight - m.scrollTop - m.clientHeight) <= 24) hideJump();
  }, { passive: true });

  el.theme.addEventListener('click', toggleTheme);
  el.reset.addEventListener('click', resetFilters);
  el.clear.addEventListener('click', doClear);
  el.copy.addEventListener('click', doCopy);
  el.exportBtn.addEventListener('click', openExportDialog);
  el.modalCancel.addEventListener('click', closeExportDialog);
  el.modalConfirm.addEventListener('click', doExport);
  el.modalCopy.addEventListener('click', doExportCopy);

  el.pause.addEventListener('click', function () { setPaused(!state.paused); });

  el.group.addEventListener('change', function () {
    state.group = el.group.checked;
    savePrefs();
    render();
  });

  var extraTimer = null;
  el.extra.addEventListener('input', function () {
    // Debounce lebih panjang daripada pencarian: setiap perubahan menulis ke
    // storage dan membangunkan service worker, jadi tidak perlu per karakter.
    if (extraTimer) clearTimeout(extraTimer);
    extraTimer = setTimeout(applyExtraFields, 500);
  });

  el.modal.addEventListener('click', function (ev) {
    // Klik di area gelap di luar kotak dialog menutup dialog.
    if (ev.target === el.modal) closeExportDialog();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;

    // Urutannya penting: kalau dialog export terbuka, Escape menutup DIALOG,
    // bukan seluruh panel. Menutup panel sementara dialog masih terbuka akan
    // membuang konfirmasi yang belum dijawab pengguna.
    if (!el.modal.hidden) { closeExportDialog(); return; }

    // Kalau keterangan gagal-tutup sedang tampil, Escape membersihkannya dulu.
    if (!el.closeHint.hidden) { el.closeHint.hidden = true; return; }

    closeSurface();
  });

  var searchTimer = null;
  el.search.addEventListener('input', function () {
    // Debounce supaya mengetik di panel tidak memicu render per karakter.
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = el.search.value.trim().toLowerCase();
      render();
    }, 120);
  });

  el.failed.addEventListener('change', function () {
    state.failedOnly = el.failed.checked;
    savePrefs();
    render();
  });

  el.hideExt.addEventListener('change', function () {
    state.hideForeign = el.hideExt.checked;
    savePrefs();
    render();
  });

  el.tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      switchScope(tab.getAttribute('data-scope'));
    });

    // Navigasi panah antar tab adalah perilaku yang diharapkan dari sebuah
    // tablist, dan tanpa ini pengguna keyboard harus menekan Tab tujuh kali
    // untuk mencapai Network.
    tab.addEventListener('keydown', function (ev) {
      var delta = 0;
      if (ev.key === 'ArrowRight') delta = 1;
      else if (ev.key === 'ArrowLeft') delta = -1;
      else if (ev.key === 'Home') delta = -index;
      else if (ev.key === 'End') delta = el.tabs.length - 1 - index;
      else return;

      ev.preventDefault();
      var next = (index + delta + el.tabs.length) % el.tabs.length;
      el.tabs[next].focus();
      switchScope(el.tabs[next].getAttribute('data-scope'));
    });
  });

  /** Menutup permukaan tempat Rapspect sedang tampil.
   *
   *  DUA PERMUKAAN, DUA KEPASTIAN YANG BERBEDA.
   *
   *  Popup: `window.close()` dijamin bekerja. Dokumen popup memang milik kita.
   *
   *  Side panel: TIDAK ADA `chrome.sidePanel.close()`. API-nya tidak simetris -
   *  hanya menyediakan `open()` - dan permintaan untuk menambahkan `close()`
   *  masih terbuka di w3c/webextensions issue 521. `window.close()` adalah satu-
   *  satunya cara yang tersedia dari dalam dokumen, dan Chrome tidak menjanjikan
   *  akan menurutinya.
   *
   *  Karena itu hasilnya diperiksa, bukan diasumsikan: kalau setelah 250 ms
   *  dokumen ini masih hidup, berarti permintaan tutup ditolak, dan pengguna
   *  diberi tahu jalan keluarnya. Diam saat gagal akan membuat tombolnya
   *  terlihat rusak, dan itu lebih buruk daripada tidak punya tombol. */
  function closeSurface() {
    var hintTimer = setTimeout(function () {
      el.closeHint.hidden = false;
      // Keterangan menghilang sendiri: sekali dibaca tidak perlu terus memakan
      // ruang vertikal di panel yang sudah sempit.
      setTimeout(function () { el.closeHint.hidden = true; }, 8000);
    }, 250);

    try {
      window.close();
    } catch (e) {
      // Diabaikan: penanganannya sudah diurus oleh timer di atas.
    }

    // Kalau dokumen benar-benar ditutup, timer di atas tidak akan pernah jalan
    // karena seluruh konteksnya ikut hilang. Pembersihan ini hanya untuk kasus
    // window.close() yang melempar secara sinkron tanpa menutup apa pun.
    if (typeof window.closed === 'boolean' && window.closed) clearTimeout(hintTimer);
  }

  el.close.addEventListener('click', closeSurface);

  // Escape menutup permukaan, tapi HANYA kalau dialog export tidak sedang
  // terbuka - kalau terbuka, Escape harus menutup dialognya lebih dulu. Urutan
  // itu ditangani oleh listener keydown di bawah.

  // Popup tertutup begitu pengguna mengklik halaman. Untuk sesi pengujian yang
  // panjang side panel yang dibutuhkan, jadi tombol ini memindahkannya.
  el.openPanel.addEventListener('click', async function () {
    try {
      if (!chrome.sidePanel || !chrome.sidePanel.open) {
        flashButton(el.openPanel, 'Needs Chrome 116+', 'Open side panel');
        return;
      }
      // Panggilan ini WAJIB berasal dari gerakan pengguna. Klik tombol memenuhi
      // syarat itu; memanggilnya dari service worker tidak akan bekerja.
      if (state.tabId >= 0) await chrome.sidePanel.open({ tabId: state.tabId });
      else await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      window.close();
    } catch (e) {
      flashButton(el.openPanel, 'Could not open', 'Open side panel');
    }
  });

  // Delegasi event: tombol "details" dibuat ulang setiap render, jadi listener
  // dipasang sekali di kontainer, bukan per tombol.
  el.list.addEventListener('click', function (ev) {
    if (!ev.target || !ev.target.closest) return;

    // Salin satu baris diperiksa lebih dulu: tombolnya juga berkelas rp-toggle,
    // jadi kalau pengecekan details jalan dulu, klik copy ikut membuka detail.
    var copyButton = ev.target.closest('[data-copy-id]');
    if (copyButton) {
      var copyId = parseInt(copyButton.getAttribute('data-copy-id'), 10);
      if (isFinite(copyId)) {
        copySingle(copyId);
        flashButton(copyButton, 'copied', 'copy');
      }
      return;
    }

    var button = ev.target.closest('[data-entry-id]');
    if (!button) return;
    var id = parseInt(button.getAttribute('data-entry-id'), 10);
    if (!isFinite(id)) return;
    if (state.expanded[id]) delete state.expanded[id]; else state.expanded[id] = true;
    render();
  });

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  loadTheme();
  updateRedactionIndicator();

  // Preferensi dimuat SEBELUM tab diselesaikan, supaya render pertama sudah
  // memakai tab dan filter yang benar. Kalau dibalik, panel berkedip sekali dari
  // tampilan default ke tampilan tersimpan.
  loadPrefs().then(function () {
    updateRedactionIndicator();
    resolveActiveTab();
  });

  // Ping sekali agar service worker yang sedang tidur bangun sebelum QA mulai
  // berinteraksi dengan halaman.
  ask({ type: 'rp:ping' });
})();
