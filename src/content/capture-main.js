/* =============================================================================
 * Rapspect - capture layer (MAIN world)
 *
 * KENAPA FILE INI HARUS DI MAIN WORLD
 * Content script biasa berjalan di "isolated world": DOM-nya sama dengan
 * halaman, tapi global JavaScript-nya TERPISAH. `console` yang dilihat content
 * script biasa adalah console milik isolated world. Menambalnya tidak ada
 * gunanya - `console.log` di kode halaman tetap memanggil fungsi aslinya.
 * Hal yang sama berlaku untuk `fetch` dan `XMLHttpRequest`.
 *
 * Pemisahan itu memang sengaja dibuat Chrome supaya extension dan halaman tidak
 * bisa saling merusak. Konsekuensinya: satu-satunya cara menangkap console dan
 * network milik halaman TANPA chrome.debugger adalah menjalankan kode di world
 * yang sama dengan halaman. Itu yang dilakukan `"world": "MAIN"` di manifest.
 *
 * KENAPA run_at: document_start
 * Tambalan harus terpasang SEBELUM script halaman dijalankan. Kalau terlambat,
 * log dan request yang terjadi saat halaman baru dimuat hilang tanpa jejak -
 * dan justru di situ bug paling sering muncul.
 *
 * KENAPA window.postMessage
 * MAIN world tidak melihat `chrome.*` sama sekali, jadi file ini tidak bisa
 * bicara langsung ke service worker. Yang dibagi antara MAIN world dan isolated
 * world hanya DOM dan event loop. `window.postMessage` memakai jalur itu tanpa
 * menyentuh DOM halaman (tidak ada elemen atau atribut tambahan yang bisa
 * mengacaukan pengujian), asinkron sehingga tidak memperlambat halaman, dan
 * payloadnya dibatasi ke data yang bisa di-structured-clone.
 * ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Ambil core, lalu hapus jejaknya dari global halaman
  // ---------------------------------------------------------------------------

  var core = window.__RAPSPECT_CORE__;
  if (!core) return; // core gagal dimuat: lebih baik tidak menyentuh halaman

  // Referensi disimpan di closure, lalu globalnya dihapus. Dua alasan:
  // (1) halaman tidak bisa memonkey-patch fungsi redaction kita untuk
  //     membocorkan token, karena tidak ada lagi yang bisa dia pegang;
  // (2) kita tidak meninggalkan variabel global asing di halaman yang diuji,
  //     yang bisa mengacaukan pengujian itu sendiri.
  try { delete window.__RAPSPECT_CORE__; } catch (e) { window.__RAPSPECT_CORE__ = undefined; }

  // Jangan menambal dua kali. Reload extension atau iframe yang mewarisi
  // dokumen bisa membuat file ini dievaluasi ulang; tambalan berlapis akan
  // menghasilkan entri ganda dan, lebih buruk, rekursi.
  if (window.__RAPSPECT_INSTALLED__) return;
  try {
    Object.defineProperty(window, '__RAPSPECT_INSTALLED__', {
      value: true, enumerable: false, configurable: true, writable: false
    });
  } catch (e) { window.__RAPSPECT_INSTALLED__ = true; }

  // ---------------------------------------------------------------------------
  // 2. Simpan referensi asli SEBELUM apa pun ditambal
  // ---------------------------------------------------------------------------
  // Halaman bisa menambal `postMessage`, `fetch`, atau `Date.now` kapan saja
  // setelah kita. Kalau kita memanggil versi global pada saat kejadian, kita
  // bisa memanggil tambalan halaman, yang bisa berujung rekursi atau data
  // palsu. Mengikat referensi asli sekarang menghilangkan risiko itu.
  var _postMessage = window.postMessage.bind(window);
  var _nativeFetch = window.fetch;
  var _NativeXHR = window.XMLHttpRequest;
  var _dateNow = Date.now.bind(Date);
  var _perfNow = (window.performance && window.performance.now)
    ? window.performance.now.bind(window.performance)
    : function () { return _dateNow(); };
  var _setTimeout = window.setTimeout.bind(window);

  var CHANNEL = core.CHANNEL;
  var enabled = true;

  var frameOrigin = '';
  try { frameOrigin = String(window.location.origin || ''); } catch (e) { frameOrigin = ''; }

  // ---------------------------------------------------------------------------
  // 3. Jalur keluar
  // ---------------------------------------------------------------------------

  /** targetOrigin diisi '*' dengan sadar, bukan karena malas.
   *  Pada frame dengan origin opaque (about:blank, iframe sandbox, data:),
   *  origin bernilai "null" dan pencocokan targetOrigin tidak akan pernah
   *  berhasil - capture akan mati diam-diam di halaman-halaman itu.
   *  Karena penerimanya window yang sama dan datanya SUDAH diredaksi sebelum
   *  titik ini, '*' tidak menambah paparan baru: halaman memang sudah memiliki
   *  data itu sejak awal. */
  function send(entry) {
    if (!enabled) return;
    try {
      entry.origin = frameOrigin;
      _postMessage({ __rapspect: CHANNEL, entry: entry }, '*');
    } catch (e) {
      // Structured clone gagal seharusnya tidak mungkin terjadi karena semua
      // nilai sudah jadi string/number. Kalau tetap terjadi, capture tidak
      // boleh melempar error ke dalam kode halaman.
    }
  }

  // Jembatan (isolated world) memberi tahu kita kalau context extension sudah
  // mati, misalnya setelah extension di-reload. Tanpa ini kita akan terus
  // memanggil postMessage seumur hidup tab untuk data yang tidak ada
  // penerimanya.
  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.__rapspect !== CHANNEL) return;
    if (d.control === 'stop') enabled = false;
  }, false);

  // ---------------------------------------------------------------------------
  // 4. console.*
  // ---------------------------------------------------------------------------

  // Penjaga rekursi. Kalau kode kita sendiri (atau serializer) memanggil
  // console.*, tanpa penjaga ini akan terjadi rekursi tak berujung yang
  // membekukan tab.
  var inside = false;

  function patchConsole(name) {
    var original = console[name];
    if (typeof original !== 'function') return;

    console[name] = function () {
      if (enabled && !inside) {
        inside = true;
        try {
          var entry = {
            kind: 'console',
            level: name,
            t: _dateNow(),
            text: core.serializeArgs(arguments)
          };
          // Stack hanya diambil untuk error dan warn. Mengambil stack itu
          // relatif mahal, dan untuk `console.log` biasa hampir tidak pernah
          // dipakai QA.
          if (name === 'error' || name === 'warn') entry.stack = captureStack();
          send(entry);
        } catch (e) {
          // Apa pun yang salah di sini tidak boleh membuat console halaman
          // melempar error.
        } finally {
          inside = false;
        }
      }
      // WAJIB: console asli tetap dipanggil. Rapspect adalah pengamat, bukan
      // pengganti. DevTools bawaan harus tetap menampilkan log seperti biasa.
      return original.apply(console, arguments);
    };

    // Supaya kode halaman yang memeriksa `console.log.name` tidak bingung.
    try { Object.defineProperty(console[name], 'name', { value: name }); } catch (e) {}
  }

  /** Ambil stack pemanggil, buang baris milik Rapspect sendiri supaya QA
   *  melihat baris kode halaman, bukan isi extension ini. */
  function captureStack() {
    try {
      var stack = new Error().stack;
      if (!stack) return '';
      var lines = String(stack).split('\n');
      var keep = [];
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('capture-main.js') !== -1) continue;
        if (lines[i].indexOf('rapspect-core.js') !== -1) continue;
        keep.push(lines[i]);
      }
      return core.truncate(keep.join('\n'), 1200);
    } catch (e) { return ''; }
  }

  var consoleLevels = ['log', 'info', 'warn', 'error', 'debug'];
  for (var ci = 0; ci < consoleLevels.length; ci++) patchConsole(consoleLevels[ci]);

  // ---------------------------------------------------------------------------
  // 5. Uncaught error + unhandled promise rejection
  // ---------------------------------------------------------------------------

  // Dipakai addEventListener, BUKAN `window.onerror = ...`.
  // Menugaskan window.onerror akan MENIMPA handler milik halaman, dan banyak
  // aplikasi memakainya untuk melaporkan error ke server. Alat uji tidak boleh
  // mematikan fungsi yang sedang diuji.
  //
  // Argumen ketiga `true` (capture phase) penting: event error untuk resource
  // gagal muat (<img>, <script>, <link>) TIDAK bubble, jadi hanya terlihat di
  // fase capture di window.
  window.addEventListener('error', function (ev) {
    if (!enabled) return;
    try {
      // Dua jenis event berbeda memakai nama yang sama.
      // (a) error JavaScript: punya `message`
      // (b) resource gagal muat: `target` berupa elemen, `message` kosong
      var isResourceError = !ev.message && ev.target && ev.target !== window;

      if (isResourceError) {
        var el = ev.target;
        var src = '';
        try { src = String(el.src || el.href || ''); } catch (e2) { src = ''; }
        send({
          kind: 'error',
          level: 'error',
          t: _dateNow(),
          text: 'Failed to load resource: <' +
                String(el.tagName || 'element').toLowerCase() + '> ' +
                core.redactUrl(src).url
        });
        return;
      }

      var where = '';
      if (ev.filename) {
        where = ' (' + ev.filename + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0) + ')';
      }
      send({
        kind: 'error',
        level: 'error',
        t: _dateNow(),
        text: 'Uncaught ' + core.truncate(ev.message || 'Error', 600) + where,
        stack: ev.error ? core.stringifyValue(ev.error, 0, []) : ''
      });
    } catch (e) {}
  }, true);

  window.addEventListener('unhandledrejection', function (ev) {
    if (!enabled) return;
    try {
      var reason = ev && ev.reason;
      send({
        kind: 'error',
        level: 'error',
        t: _dateNow(),
        // Teks dibedakan dari uncaught error biasa. Bedanya penting untuk QA:
        // yang ini artinya ada Promise tanpa .catch(), bukan exception sinkron.
        text: 'Unhandled promise rejection: ' + core.stringifyValue(reason, 0, [])
      });
    } catch (e) {}
  }, false);

  // ---------------------------------------------------------------------------
  // 6. fetch
  // ---------------------------------------------------------------------------

  /** Baca method, URL, header, dan body dari argumen fetch.
   *  `fetch` menerima dua bentuk: (url, init) dan (Request). Keduanya harus
   *  ditangani, karena banyak library memakai objek Request. */
  function describeFetchArgs(input, init) {
    var desc = { method: 'GET', url: '', headers: null, body: null };
    try {
      if (typeof Request !== 'undefined' && input instanceof Request) {
        desc.method = input.method || 'GET';
        desc.url = input.url || '';
        desc.headers = input.headers || null;
        // Body pada objek Request adalah stream. Tidak dibaca dengan sengaja:
        // membacanya mengonsumsi body dan request halaman akan gagal.
        desc.body = (init && init.body != null) ? init.body : null;
      } else {
        desc.url = String(input && input.url ? input.url : input);
        desc.method = (init && init.method) ? init.method : 'GET';
        desc.headers = (init && init.headers) ? init.headers : null;
        desc.body = (init && init.body != null) ? init.body : null;
      }
    } catch (e) {
      desc.url = '[unreadable request]';
    }
    return desc;
  }

  /** Ukuran response hanya dibaca dari header Content-Length.
   *  Menghitung ukuran sebenarnya berarti membaca (atau meng-clone lalu
   *  membaca) body, yang mengubah perilaku halaman dan membuang memori.
   *  Kalau server tidak mengirim Content-Length - umum pada respons gzip atau
   *  chunked - ukuran dilaporkan null dan panel menampilkan tanda hubung.
   *  Ini keterbatasan yang dicatat sadar di docs/DECISIONS.md bagian 6. */
  function readContentLength(res) {
    try {
      var raw = res.headers ? res.headers.get('content-length') : null;
      if (raw == null) return null;
      var n = parseInt(raw, 10);
      return isFinite(n) ? n : null;
    } catch (e) { return null; }
  }

  function buildNetworkEntry(desc, started) {
    var u = core.redactUrl(desc.url);
    var h = core.redactHeaders(desc.headers);
    var b = core.redactBody(desc.body);
    return {
      kind: 'network',
      transport: 'fetch',
      t: _dateNow(),
      method: String(desc.method || 'GET').toUpperCase(),
      url: u.url,
      requestHeaders: h.headers,
      requestBody: b.text,
      redacted: u.redacted + h.redacted + b.redacted,
      durationMs: Math.round(_perfNow() - started)
    };
  }

  window.fetch = function (input, init) {
    if (!enabled) return _nativeFetch.apply(this, arguments);

    var started = _perfNow();
    var desc = describeFetchArgs(input, init);
    var promise;

    try {
      promise = _nativeFetch.apply(this, arguments);
    } catch (err) {
      // fetch bisa melempar sinkron untuk argumen yang tidak valid.
      var bad = buildNetworkEntry(desc, started);
      bad.status = 0;
      bad.statusText = 'invalid request';
      bad.failed = true;
      bad.level = 'error';
      send(bad);
      throw err;
    }

    // Promise-nya tidak diganti, hanya diamati. `then` mengembalikan promise
    // baru yang meneruskan nilai dan error apa adanya, jadi kode halaman tidak
    // melihat perbedaan perilaku.
    return promise.then(function (res) {
      try {
        var entry = buildNetworkEntry(desc, started);
        entry.status = typeof res.status === 'number' ? res.status : 0;
        entry.statusText = res.statusText || '';
        entry.sizeBytes = readContentLength(res);
        entry.failed = false;
        send(entry);
      } catch (e) {}
      return res;
    }, function (err) {
      try {
        var entry = buildNetworkEntry(desc, started);
        entry.status = 0;
        // Ini titik di mana kegagalan DNS, CORS, dan koneksi terputus semuanya
        // terlihat sama: fetch hanya melempar TypeError generik. Alasan
        // sebenarnya ada di log tingkat browser yang tidak bisa kita baca tanpa
        // chrome.debugger (README bagian 4).
        entry.statusText = 'network error: ' + core.truncate(
          (err && err.message) ? err.message : String(err), 200);
        entry.failed = true;
        send(entry);
      } catch (e) {}
      throw err;
    });
  };

  // Supaya pemeriksaan sederhana seperti `fetch.name` tidak berubah.
  try { Object.defineProperty(window.fetch, 'name', { value: 'fetch' }); } catch (e) {}

  // ---------------------------------------------------------------------------
  // 7. XMLHttpRequest
  // ---------------------------------------------------------------------------

  // Yang ditambal adalah prototype-nya, bukan konstruktornya. Dengan begitu
  // instance yang dibuat halaman tetap XMLHttpRequest asli - `instanceof`,
  // event handler, dan properti lain berperilaku normal. Mengganti
  // konstruktor dengan kelas pembungkus jauh lebih gampang merusak halaman.
  var xhrProto = _NativeXHR && _NativeXHR.prototype;

  if (xhrProto) {
    var _open = xhrProto.open;
    var _send = xhrProto.send;
    var _setRequestHeader = xhrProto.setRequestHeader;

    // Metadata disimpan di WeakMap, bukan sebagai properti pada objek xhr.
    // Alasan: (1) tidak menaruh properti asing di objek milik halaman, yang
    // bisa terlihat saat halaman men-inspeksi xhr-nya sendiri; (2) WeakMap
    // otomatis melepas entri saat objek xhr di-GC, jadi tidak ada kebocoran
    // memori di halaman yang membuat ribuan request.
    var meta = new WeakMap();

    xhrProto.open = function (method, url) {
      try {
        meta.set(this, {
          method: String(method || 'GET'),
          url: String(url == null ? '' : url),
          headers: {},
          started: 0,
          body: null,
          reported: false
        });
      } catch (e) {}
      return _open.apply(this, arguments);
    };

    xhrProto.setRequestHeader = function (name, value) {
      try {
        var m = meta.get(this);
        if (m) m.headers[String(name)] = String(value);
      } catch (e) {}
      return _setRequestHeader.apply(this, arguments);
    };

    xhrProto.send = function (body) {
      var self = this;
      try {
        var m = meta.get(self);
        if (m && enabled) {
          m.started = _perfNow();
          m.body = (body == null) ? null : body;

          // `loadend` dipilih karena satu event ini mencakup SEMUA akhir:
          // sukses, error jaringan, abort, dan timeout. Memasang empat
          // listener terpisah berisiko ada jalur yang terlewat atau dicatat
          // dua kali.
          self.addEventListener('loadend', function () {
            if (m.reported) return;
            m.reported = true;
            reportXhr(self, m);
          }, { once: true });
        }
      } catch (e) {}
      return _send.apply(this, arguments);
    };

    function reportXhr(xhr, m) {
      try {
        var u = core.redactUrl(m.url);
        var h = core.redactHeaders(m.headers);
        var b = core.redactBody(m.body);

        var status = 0;
        try { status = xhr.status || 0; } catch (e) { status = 0; }

        var entry = {
          kind: 'network',
          transport: 'xhr',
          t: _dateNow(),
          method: m.method.toUpperCase(),
          url: u.url,
          requestHeaders: h.headers,
          requestBody: b.text,
          redacted: u.redacted + h.redacted + b.redacted,
          durationMs: Math.round(_perfNow() - (m.started || _perfNow())),
          status: status,
          statusText: '',
          failed: status === 0,
          sizeBytes: xhrSize(xhr)
        };
        try { entry.statusText = xhr.statusText || ''; } catch (e) {}
        if (status === 0) entry.statusText = entry.statusText || 'network error, aborted, or timeout';
        send(entry);
      } catch (e) {}
    }

    /** Untuk XHR ukuran bisa lebih akurat daripada fetch: body sudah selesai
     *  di-buffer, jadi membaca panjangnya tidak mengonsumsi apa pun.
     *  Content-Length tetap didahulukan karena itu angka dari server. */
    function xhrSize(xhr) {
      try {
        var cl = xhr.getResponseHeader ? xhr.getResponseHeader('content-length') : null;
        if (cl != null) {
          var n = parseInt(cl, 10);
          if (isFinite(n)) return n;
        }
      } catch (e) {}
      try {
        // responseText hanya sah untuk responseType '' atau 'text'. Untuk
        // 'blob'/'arraybuffer'/'json' mengaksesnya MELEMPAR error, jadi harus
        // dijaga - bukan sekadar dibungkus try.
        var rt = xhr.responseType;
        if (rt === '' || rt === 'text') {
          var text = xhr.responseText;
          if (typeof text === 'string') return text.length;
        }
        if (rt === 'arraybuffer' && xhr.response && typeof xhr.response.byteLength === 'number') {
          return xhr.response.byteLength;
        }
        if (rt === 'blob' && xhr.response && typeof xhr.response.size === 'number') {
          return xhr.response.size;
        }
      } catch (e) {}
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Penanda awal halaman
  // ---------------------------------------------------------------------------

  // Hanya frame paling atas yang melaporkan ini, supaya satu reload tidak
  // menghasilkan sepuluh pembatas navigasi di halaman yang penuh iframe.
  // Dikirim lewat setTimeout 0 agar jembatan di isolated world sempat memasang
  // listener-nya lebih dulu - keduanya berjalan di document_start dan urutan
  // antar-world tidak dijamin.
  if (window.top === window) {
    _setTimeout(function () {
      send({
        kind: 'navigation',
        level: 'info',
        t: _dateNow(),
        text: 'Page load: ' + core.redactUrl(String(window.location.href)).url
      });
    }, 0);
  }
})();
