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
    chips:        Array.prototype.slice.call(document.querySelectorAll('.rp-chip'))
  };

  var THEME_KEY = 'rp:theme';

  var state = {
    tabId: -1,
    tabUrl: '',
    tabTitle: '',
    entries: [],
    max: core.LIMITS.MAX_ENTRIES,
    levels: {},              // level -> boolean
    failedOnly: false,
    query: '',
    expanded: {},            // entry.id -> true
    blockedReason: null,
    lastFiltered: []
  };

  for (var li = 0; li < core.LEVELS.length; li++) state.levels[core.LEVELS[li]] = true;

  // ---------------------------------------------------------------------------
  // Halaman yang tidak bisa diakses extension
  // ---------------------------------------------------------------------------

  /** Mengembalikan pesan penjelas, atau null kalau halaman seharusnya bisa
   *  disuntik. Teks pesan mengikuti README bagian 10: harus menyebut jalan
   *  keluarnya, bukan sekadar mengabarkan kegagalan. */
  function restrictionFor(url) {
    var u = String(url || '');
    if (!u) return 'No active tab detected. Focus a normal web page, then reopen this panel.';

    if (/^(chrome|edge|brave|opera|about|devtools|view-source|chrome-untrusted):/i.test(u) ||
        /^chrome-extension:\/\//i.test(u)) {
      return "Can't read this page. Extensions can't access chrome:// or Web Store pages.";
    }
    if (/^https?:\/\/chrome\.google\.com\/webstore/i.test(u) ||
        /^https:\/\/chromewebstore\.google\.com/i.test(u)) {
      return "Can't read this page. Extensions can't access chrome:// or Web Store pages.";
    }
    if (/^file:\/\//i.test(u)) {
      // Kasus khusus yang paling sering bikin bingung: halaman file:// TIDAK
      // disuntik sampai izinnya dinyalakan manual, dan pesan defaultnya tidak
      // menyebut itu sama sekali.
      return 'Local file detected. Open chrome://extensions, click Details on Rapspect, ' +
             'and turn on "Allow access to file URLs". Cross-origin fetch still fails on ' +
             'file:// pages, so serve the test page over http://localhost instead.';
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

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }

  function formatTime(ts) {
    var d = new Date(ts);
    return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' +
           pad(d.getSeconds(), 2) + '.' + pad(d.getMilliseconds(), 3);
  }

  function formatBytes(n) {
    if (n == null) return null;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' kB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function tagFor(entry) {
    if (entry.kind === 'network') return 'NET';
    if (entry.kind === 'navigation') return 'PAGE';
    if (entry.kind === 'error') return 'ERROR';
    return String(entry.level || 'log').toUpperCase();
  }

  /** Satu baris teks datar untuk pencarian, Copy as text, dan pembanding. */
  function entryToLine(entry) {
    var time = formatTime(entry.t);
    var tag = tagFor(entry);
    if (entry.kind === 'network') {
      var status = entry.failed ? 'FAILED' : String(entry.status);
      var bits = [entry.method, status];
      if (entry.durationMs != null) bits.push(entry.durationMs + ' ms');
      var size = formatBytes(entry.sizeBytes);
      if (size) bits.push(size);
      bits.push(entry.url);
      if (entry.failed && entry.statusText) bits.push('(' + entry.statusText + ')');
      return '[' + time + '] ' + tag + ' ' + bits.join(' ');
    }
    return '[' + time + '] ' + tag + ' ' + String(entry.text || '');
  }

  /** Isi blok detail. Sengaja teks polos di dalam <pre>: isinya sering
   *  di-copy-paste utuh ke bug report. */
  function detailsText(entry) {
    var lines = [];
    if (entry.kind === 'network') {
      lines.push('method       : ' + entry.method);
      lines.push('url          : ' + entry.url);
      lines.push('status       : ' + (entry.failed ? '0 (failed)' : entry.status + ' ' + (entry.statusText || '')));
      lines.push('duration     : ' + (entry.durationMs == null ? '-' : entry.durationMs + ' ms'));
      lines.push('size         : ' + (formatBytes(entry.sizeBytes) || '- (no Content-Length header)'));
      lines.push('transport    : ' + entry.transport);
      if (entry.failed && entry.statusText) lines.push('failure      : ' + entry.statusText);
      var headers = entry.requestHeaders || {};
      var names = Object.keys(headers);
      if (names.length) {
        lines.push('request headers:');
        for (var i = 0; i < names.length; i++) lines.push('  ' + names[i] + ': ' + headers[names[i]]);
      }
      if (entry.requestBody) {
        lines.push('request body :');
        lines.push('  ' + String(entry.requestBody).split('\n').join('\n  '));
      }
      lines.push('note         : response body is never captured (see README section 4)');
    } else {
      lines.push(String(entry.text || ''));
      if (entry.stack) { lines.push(''); lines.push(entry.stack); }
    }
    if (entry.origin) lines.push('frame origin : ' + entry.origin);
    if (entry.redacted > 0) lines.push('redacted     : ' + entry.redacted + ' value(s) replaced with ' + core.REDACTED_MARK);
    return lines.join('\n');
  }

  function hasDetails(entry) {
    return entry.kind === 'network' || !!entry.stack || entry.redacted > 0 ||
           String(entry.text || '').length > 160;
  }

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------

  function passesFilter(entry) {
    // "Failed only" berarti benar-benar hanya request gagal: entri console dan
    // pembatas navigasi ikut disembunyikan, karena itu yang diminta filter.
    if (state.failedOnly) {
      if (entry.kind !== 'network') return false;
      if (!(entry.failed || entry.status >= 400)) return false;
    } else {
      // Pembatas navigasi dikecualikan dari filter level. Tanpa pengecualian
      // ini, mematikan level "info" akan menghilangkan penanda reload halaman
      // dan urutan kejadian jadi sulit dibaca.
      if (entry.kind !== 'navigation' && !state.levels[entry.level]) return false;
    }
    if (state.query) {
      var haystack = entryToLine(entry);
      if (entry.requestBody) haystack += ' ' + entry.requestBody;
      if (haystack.toLowerCase().indexOf(state.query) === -1) return false;
    }
    return true;
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

    if (state.failedOnly) reasons.push('"Failed only (status >= 400)" is on');

    var muted = [];
    for (var i = 0; i < core.LEVELS.length; i++) {
      if (!state.levels[core.LEVELS[i]]) muted.push(core.LEVELS[i]);
    }
    if (muted.length) reasons.push('muted levels: ' + muted.join(', '));

    // Diambil dari nilai input, bukan dari state.query, karena state.query sudah
    // dijadikan huruf kecil untuk pencarian - menampilkannya kembali apa adanya
    // membuat pengguna tidak mengenali kata yang dia ketik sendiri.
    var typed = el.search.value.trim();
    if (typed) reasons.push('search is "' + typed + '"');

    return reasons;
  }

  /** Kembalikan semua filter ke keadaan awal: seluruh level menyala, tidak ada
   *  pembatasan request gagal, pencarian kosong. */
  function resetFilters() {
    for (var i = 0; i < core.LEVELS.length; i++) state.levels[core.LEVELS[i]] = true;
    el.chips.forEach(function (chip) { chip.setAttribute('aria-pressed', 'true'); });

    state.failedOnly = false;
    el.failed.checked = false;

    state.query = '';
    el.search.value = '';

    render();
  }

  /** Sembunyikan ketiga panel penjelas sekaligus.
   *  Dipanggil di awal setiap cabang render() supaya tidak ada sisa panel dari
   *  keadaan sebelumnya yang menempel - bug klasik kalau tiap cabang hanya
   *  mengurus panelnya sendiri. */
  function hideAllNotices() {
    el.blocked.hidden = true;
    el.empty.hidden = true;
    el.nomatch.hidden = true;
  }

  function render() {
    // ---- keadaan 1: halaman tidak bisa diakses extension ----
    if (state.blockedReason) {
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
      hideAllNotices();
      el.nomatchTitle.textContent = state.entries.length +
        (state.entries.length === 1 ? ' entry captured, ' : ' entries captured, ') +
        'none match the current filter.';

      var reasons = describeActiveFilters();
      el.nomatchWhy.textContent = reasons.length
        ? 'Active: ' + reasons.join('; ') + '.'
        : 'No filter is active, so this is unexpected. Please report it.';

      el.nomatch.hidden = false;
      el.list.textContent = '';
      el.count.textContent = '0 shown / ' + state.entries.length +
                             ' captured (buffer ' + state.max + ')';
      return;
    }

    // ---- keadaan 4: ada yang bisa ditampilkan ----
    hideAllNotices();

    var frag = document.createDocumentFragment();
    for (var j = 0; j < filtered.length; j++) frag.appendChild(buildEntryNode(filtered[j]));

    // Satu penggantian isi, bukan menambah node satu per satu ke DOM hidup.
    el.list.textContent = '';
    el.list.appendChild(frag);

    el.count.textContent = filtered.length + ' shown / ' + state.entries.length +
                           ' captured (buffer ' + state.max + ')';
  }

  function buildEntryNode(entry) {
    var wrap = document.createElement('div');
    wrap.className = 'rp-entry' + (entry.kind === 'navigation' ? ' rp-entry--navigation' : '');
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

    row.appendChild(time);
    row.appendChild(tag);
    row.appendChild(msg);
    wrap.appendChild(row);

    if (hasDetails(entry)) {
      var expanded = !!state.expanded[entry.id];

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'rp-toggle';
      toggle.setAttribute('data-entry-id', String(entry.id));
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.textContent = expanded ? 'hide details' : 'details';
      row.appendChild(toggle);

      if (expanded) {
        var details = document.createElement('div');
        details.className = 'rp-details';
        var pre = document.createElement('pre');
        pre.textContent = detailsText(entry);
        details.appendChild(pre);
        wrap.appendChild(details);
      }
    }
    return wrap;
  }

  /** Isi kolom pesan. Memakai beberapa <span> supaya method dan status bisa
   *  dibuat tebal tanpa menambah warna baru - aturan "satu warna satu makna"
   *  (README bagian 6) tetap aman. */
  function fillMessage(container, entry) {
    if (entry.kind !== 'network') {
      container.textContent = String(entry.text || '');
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

    var url = document.createElement('span');
    url.textContent = entry.url;

    container.appendChild(method);
    container.appendChild(status);
    container.appendChild(meta);
    container.appendChild(url);

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
    render();
  }

  async function resolveActiveTab() {
    var tabs = [];
    try {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch (e) { tabs = []; }

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

  // Dorongan entri baru dari service worker.
  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg || msg.type !== 'rp:push') return;
    if (msg.tabId !== state.tabId) return;           // log dari tab lain, abaikan
    if (!Array.isArray(msg.entries)) return;

    for (var i = 0; i < msg.entries.length; i++) state.entries.push(msg.entries[i]);
    // Panel menegakkan batas yang sama dengan service worker, supaya keduanya
    // tidak pernah berbeda isi.
    if (state.entries.length > state.max) {
      state.entries.splice(0, state.entries.length - state.max);
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
    await ask({ type: 'rp:clear', tabId: state.tabId });
    state.entries = [];
    render();
  }

  function buildExportText() {
    var header = [
      '# Rapspect capture',
      '# page     : ' + (state.tabUrl || '-'),
      '# title    : ' + (state.tabTitle || '-'),
      '# exported : ' + new Date().toISOString(),
      '# entries  : ' + state.lastFiltered.length + ' of ' + state.entries.length +
        ' captured (buffer ' + state.max + ')',
      '# redaction: ON - headers [' + core.REDACTED_HEADERS.join(', ') + '] and fields [' +
        core.REDACTED_FIELDS.join(', ') + '] are replaced with ' + core.REDACTED_MARK,
      ''
    ];
    var lines = [];
    for (var i = 0; i < state.lastFiltered.length; i++) {
      lines.push(entryToLine(state.lastFiltered[i]));
    }
    return header.concat(lines).join('\n');
  }

  async function doCopy() {
    var text = buildExportText();
    var ok = false;
    try {
      // Butuh dokumen yang sedang fokus. Klik tombol sudah memenuhi itu, jadi
      // jalur ini yang dipakai lebih dulu dan tidak perlu izin clipboardWrite.
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      // Fallback untuk kasus dokumen kehilangan fokus atau clipboard ditolak.
      ok = copyViaTextarea(text);
    }
    flashButton(el.copy, ok ? 'Copied' : 'Copy failed', 'Copy as text');
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

  function doExport() {
    var payload = {
      tool: 'Rapspect',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      page: { url: state.tabUrl, title: state.tabTitle },
      redaction: {
        enabled: true,
        headers: core.REDACTED_HEADERS,
        fields: core.REDACTED_FIELDS,
        mark: core.REDACTED_MARK,
        note: 'Response bodies are never captured. Review this file before sharing.'
      },
      bufferLimit: state.max,
      capturedCount: state.entries.length,
      exportedCount: state.lastFiltered.length,
      filters: {
        levels: Object.keys(state.levels).filter(function (k) { return state.levels[k]; }),
        failedOnly: state.failedOnly,
        query: state.query
      },
      entries: state.lastFiltered
    };

    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = buildFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Object URL menahan blob di memori sampai dilepas. Jeda kecil memberi
    // Chrome waktu memulai unduhan sebelum URL-nya dibatalkan.
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    closeExportDialog();
    flashButton(el.exportBtn, 'Saved', 'Export JSON');
  }

  function buildFileName() {
    var host = 'page';
    try { host = new URL(state.tabUrl).hostname || 'page'; } catch (e) {}
    var d = new Date();
    var stamp = d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) + '-' +
                pad(d.getHours(), 2) + pad(d.getMinutes(), 2) + pad(d.getSeconds(), 2);
    return 'rapspect-' + host.replace(/[^a-z0-9.\-]/gi, '_') + '-' + stamp + '.json';
  }

  // ---------------------------------------------------------------------------
  // Binding event
  // ---------------------------------------------------------------------------

  el.theme.addEventListener('click', toggleTheme);
  el.reset.addEventListener('click', resetFilters);
  el.clear.addEventListener('click', doClear);
  el.copy.addEventListener('click', doCopy);
  el.exportBtn.addEventListener('click', openExportDialog);
  el.modalCancel.addEventListener('click', closeExportDialog);
  el.modalConfirm.addEventListener('click', doExport);

  el.modal.addEventListener('click', function (ev) {
    // Klik di area gelap di luar kotak dialog menutup dialog.
    if (ev.target === el.modal) closeExportDialog();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !el.modal.hidden) closeExportDialog();
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
    render();
  });

  el.chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var level = chip.getAttribute('data-level');
      var next = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', next ? 'true' : 'false');
      state.levels[level] = next;
      render();
    });
  });

  // Delegasi event: tombol "details" dibuat ulang setiap render, jadi listener
  // dipasang sekali di kontainer, bukan per tombol.
  el.list.addEventListener('click', function (ev) {
    var button = ev.target && ev.target.closest ? ev.target.closest('.rp-toggle') : null;
    if (!button) return;
    var id = parseInt(button.getAttribute('data-entry-id'), 10);
    if (!isFinite(id)) return;
    if (state.expanded[id]) delete state.expanded[id]; else state.expanded[id] = true;
    render();
  });

  el.redaction.title = 'Redaction is always on in v1. Headers: ' +
    core.REDACTED_HEADERS.join(', ') + '. Fields: ' + core.REDACTED_FIELDS.join(', ') + '.';

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  loadTheme();
  resolveActiveTab();

  // Ping sekali agar service worker yang sedang tidur bangun sebelum QA mulai
  // berinteraksi dengan halaman.
  ask({ type: 'rp:ping' });
})();
