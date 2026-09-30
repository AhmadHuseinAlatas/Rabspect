/* =============================================================================
 * Rapspect - shared core
 * Konstanta + redaction + serialisasi aman. Satu sumber kebenaran.
 *
 * KENAPA FILE INI PLAIN SCRIPT, BUKAN ES MODULE
 * File ini harus dipakai di tiga tempat dengan aturan pemuatan yang berbeda:
 *   1. content script MAIN world  -> content script statis TIDAK mendukung
 *                                    `import`, jadi ES module langsung gugur
 *   2. service worker             -> `importScripts()` hanya bisa dipakai kalau
 *                                    service worker BUKAN type: "module"
 *   3. halaman panel              -> <script src> biasa
 * Satu-satunya bentuk yang jalan di ketiganya tanpa build step adalah plain
 * script yang menempel ke satu objek global. Kalau aturan redaction (README
 * bagian 11) dipecah ke beberapa file, cepat atau lambat salah satu salinannya
 * ketinggalan - dan yang ketinggalan itu yang membocorkan token.
 *
 * KENAPA SATU GLOBAL SAJA
 * Di MAIN world, apa pun yang kita tempel ke global ikut terlihat oleh halaman.
 * Satu nama global berarti hanya ada satu jejak untuk dibersihkan, dan
 * `capture-main.js` memang menghapusnya segera setelah mengambil referensinya.
 * ========================================================================== */
(function (root) {
  'use strict';

  // Idempoten: di MAIN world file ini bisa dievaluasi lagi pada iframe atau
  // saat extension di-reload. Memasang ulang akan membuang referensi lama.
  if (root.__RAPSPECT_CORE__) return;

  /** Nama channel postMessage. Diberi versi supaya content script lama yang
   *  masih hidup setelah reload extension tidak diproses oleh kode baru. */
  var CHANNEL = 'rapspect:v1';

  /** Semua batas ukuran dikumpulkan di satu tempat supaya bisa diaudit.
   *  Pemotongan dilakukan SAAT CAPTURE, bukan saat render. Alasannya:
   *  entri yang sudah besar akan ikut membengkakkan postMessage, memori
   *  service worker, dan kuota chrome.storage.session sekaligus. */
  var LIMITS = {
    MAX_ENTRIES: 500,      // ring buffer per tab (README bagian 4)
    MAX_STRING: 2000,      // panjang maksimum satu nilai string
    MAX_BODY_TEXT: 4000,   // panjang maksimum body request yang dicatat
    MAX_DEPTH: 4,          // kedalaman objek saat serialisasi
    MAX_ARRAY: 50,         // jumlah elemen array yang ditampilkan
    MAX_KEYS: 40,          // jumlah key objek yang ditampilkan
    MAX_ARGS: 10,          // jumlah argumen console.* yang dicatat
    MAX_HEADERS: 40        // jumlah header request yang dicatat
  };

  var REDACTED_MARK = '[REDACTED]';

  /** Header yang disensor. Persis daftar README bagian 11, tidak ditambah.
   *  Dicocokkan case-insensitive karena nama header HTTP tidak case-sensitive. */
  var REDACTED_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

  /** Field body yang disensor. Persis daftar README bagian 11.
   *  Dipisah dua kelompok, lihat isSensitiveField() untuk alasannya. */
  var FIELDS_SUBSTRING = ['password', 'token', 'secret', 'apikey'];
  var FIELDS_EXACT = ['pin'];

  var LEVELS = ['log', 'info', 'warn', 'error', 'debug'];
  var KINDS = ['console', 'network', 'error', 'navigation'];

  // ---------------------------------------------------------------------------
  // Util dasar
  // ---------------------------------------------------------------------------

  /** Normalisasi nama key: huruf kecil, buang semua non-alfanumerik.
   *  Dengan ini `api_key`, `API-KEY`, dan `apiKey` sama-sama jadi `apikey`,
   *  jadi satu aturan cukup untuk semua gaya penamaan. */
  function normalizeKey(name) {
    return String(name == null ? '' : name).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function truncate(text, max) {
    var s = String(text == null ? '' : text);
    var limit = max || LIMITS.MAX_STRING;
    if (s.length <= limit) return s;
    return s.slice(0, limit) + '... [+' + (s.length - limit) + ' chars]';
  }

  function isSensitiveHeader(name) {
    var n = String(name == null ? '' : name).toLowerCase().trim();
    return REDACTED_HEADERS.indexOf(n) !== -1;
  }

  /** Kenapa `pin` diperlakukan berbeda dari yang lain.
   *
   *  Untuk password/token/secret/apikey dipakai pencocokan SUBSTRING, supaya
   *  nama field dunia nyata seperti `access_token`, `refreshToken`,
   *  `passwordConfirmation`, dan `clientSecret` ikut tersensor.
   *
   *  `pin` hanya dicocokkan PERSIS. Kalau ikut substring, kata biasa seperti
   *  `shipping`, `pinned`, dan `spinner` akan tersensor juga, dan log jadi tidak
   *  berguna. Redaction yang terlalu rakus sama merusaknya dengan yang bolong:
   *  QA berhenti mempercayai isi panel. */
  function isSensitiveField(key) {
    var k = normalizeKey(key);
    if (!k) return false;
    if (FIELDS_EXACT.indexOf(k) !== -1) return true;
    for (var i = 0; i < FIELDS_SUBSTRING.length; i++) {
      if (k.indexOf(FIELDS_SUBSTRING[i]) !== -1) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Redaction: header
  // ---------------------------------------------------------------------------

  /** Menerima Headers, array pasangan [[k,v]], atau objek biasa - karena ketiga
   *  bentuk itu semuanya sah dipakai pemanggil `fetch`. */
  function redactHeaders(input) {
    var out = {};
    var count = 0;
    var total = 0;

    function put(name, value) {
      if (total >= LIMITS.MAX_HEADERS) return;
      total++;
      var key = String(name);
      if (isSensitiveHeader(key)) {
        out[key] = REDACTED_MARK;
        count++;
      } else {
        out[key] = truncate(value, 300);
      }
    }

    try {
      if (!input) return { headers: out, redacted: 0 };

      // Headers punya forEach(value, name) - perhatikan urutan argumennya
      // terbalik dibanding Array.forEach. Salah urutan di sini menghasilkan
      // header bernama nilai, yang lolos dari pengecekan nama sensitif.
      if (typeof Headers !== 'undefined' && input instanceof Headers) {
        input.forEach(function (value, name) { put(name, value); });
        return { headers: out, redacted: count };
      }
      if (Array.isArray(input)) {
        for (var i = 0; i < input.length; i++) {
          var pair = input[i];
          if (pair && pair.length >= 2) put(pair[0], pair[1]);
        }
        return { headers: out, redacted: count };
      }
      if (typeof input === 'object') {
        var keys = Object.keys(input);
        for (var j = 0; j < keys.length; j++) put(keys[j], input[keys[j]]);
      }
    } catch (e) {
      // Header dari halaman bisa berupa objek aneh dengan getter yang melempar.
      // Gagal membaca header tidak boleh menggagalkan pencatatan request.
      out['[rapspect]'] = 'could not read request headers';
    }
    return { headers: out, redacted: count };
  }

  // ---------------------------------------------------------------------------
  // Redaction: URL
  // ---------------------------------------------------------------------------

  /** TAMBAHAN DI LUAR README bagian 11 (dicatat di docs/DECISIONS.md 5.4).
   *  `?token=abc` di URL sama bocornya dengan header Authorization, dan URL
   *  selalu tampil di daftar log serta ikut ke file export. */
  function redactUrl(rawUrl) {
    var url = String(rawUrl == null ? '' : rawUrl);
    var count = 0;
    var qIndex = url.indexOf('?');
    if (qIndex === -1) return { url: truncate(url, LIMITS.MAX_STRING), redacted: 0 };

    var base = url.slice(0, qIndex);
    var rest = url.slice(qIndex + 1);

    // Fragment (#...) dipisah dulu supaya tidak ikut diperlakukan sebagai query.
    var hash = '';
    var hIndex = rest.indexOf('#');
    if (hIndex !== -1) {
      hash = rest.slice(hIndex);
      rest = rest.slice(0, hIndex);
    }

    // Parsing manual, bukan URLSearchParams, karena URL relatif seperti
    // `/api?token=x` tidak bisa dipakai membuat objek URL tanpa base, dan base
    // yang benar tidak selalu kita ketahui di semua konteks.
    var parts = rest.split('&');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq === -1) continue;
      var name = parts[i].slice(0, eq);
      if (isSensitiveField(decodeSafe(name))) {
        parts[i] = name + '=' + REDACTED_MARK;
        count++;
      }
    }
    return {
      url: truncate(base + '?' + parts.join('&') + hash, LIMITS.MAX_STRING),
      redacted: count
    };
  }

  function decodeSafe(text) {
    try { return decodeURIComponent(String(text)); } catch (e) { return String(text); }
  }

  // ---------------------------------------------------------------------------
  // Serialisasi + redaction nilai
  // ---------------------------------------------------------------------------

  /** Mengubah nilai apa pun menjadi string yang aman dibawa lintas world.
   *
   *  Kenapa harus jadi string dan tidak dikirim apa adanya:
   *  postMessage memakai structured clone, yang MELEMPAR error untuk fungsi,
   *  node DOM, Proxy, dan objek dengan getter yang error. Satu objek yang tidak
   *  bisa di-clone akan mematikan seluruh pengiriman. Serialisasi manual juga
   *  memberi kita tempat untuk menerapkan redaction dan batas ukuran.
   *
   *  `seen` memakai array, bukan WeakSet, supaya bisa mendeteksi siklus
   *  berdasarkan posisi di jalur penelusuran saat ini. WeakSet global akan
   *  salah menandai objek yang dipakai dua kali secara sah sebagai siklus. */
  function stringifyValue(value, depth, seen) {
    var d = depth || 0;
    var path = seen || [];

    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    var t = typeof value;
    if (t === 'string') return truncate(value);
    if (t === 'number' || t === 'boolean') return String(value);
    if (t === 'bigint') return String(value) + 'n';
    if (t === 'symbol') { try { return value.toString(); } catch (e) { return 'Symbol()'; } }
    if (t === 'function') return 'function ' + (value.name || '(anonymous)') + '()';

    // Error diprioritaskan: stack-nya justru isi paling berguna untuk QA.
    if (isErrorLike(value)) {
      var name = safeRead(value, 'name') || 'Error';
      var message = safeRead(value, 'message') || '';
      var stack = safeRead(value, 'stack');
      return name + ': ' + message + (stack ? '\n' + truncate(stack, LIMITS.MAX_STRING) : '');
    }

    // Node DOM tidak bisa di-clone dan tidak berguna kalau di-JSON. Cukup
    // gambarkan tag-nya seperti tampilan DevTools.
    if (isElementLike(value)) return describeElement(value);

    if (path.indexOf(value) !== -1) return '[Circular]';
    if (d >= LIMITS.MAX_DEPTH) return Array.isArray(value) ? '[Array]' : '[Object]';

    var nextPath = path.concat([value]);

    if (Array.isArray(value)) {
      var items = [];
      var n = Math.min(value.length, LIMITS.MAX_ARRAY);
      for (var i = 0; i < n; i++) items.push(stringifyValue(value[i], d + 1, nextPath));
      if (value.length > n) items.push('... +' + (value.length - n) + ' more');
      return '[' + items.join(', ') + ']';
    }

    if (typeof Map !== 'undefined' && value instanceof Map) {
      return 'Map(' + value.size + ') ' + stringifyValue(mapToObject(value), d, path);
    }
    if (typeof Set !== 'undefined' && value instanceof Set) {
      return 'Set(' + value.size + ') ' + stringifyValue(setToArray(value), d, path);
    }
    if (typeof Date !== 'undefined' && value instanceof Date) {
      try { return value.toISOString(); } catch (e) { return 'Invalid Date'; }
    }
    if (typeof RegExp !== 'undefined' && value instanceof RegExp) return String(value);

    var keys;
    try { keys = Object.keys(value); } catch (e) { return '[Unreadable Object]'; }

    var shown = keys.slice(0, LIMITS.MAX_KEYS);
    var parts = [];
    for (var k = 0; k < shown.length; k++) {
      var key = shown[k];
      // REDACTION untuk argumen console. Tambahan di luar README bagian 11,
      // dicatat di docs/DECISIONS.md 5.4: console.log(config) dengan apiKey di
      // dalamnya akan ikut ke file export kalau tidak disensor di sini.
      if (isSensitiveField(key)) {
        parts.push(key + ': ' + REDACTED_MARK);
        continue;
      }
      parts.push(key + ': ' + stringifyValue(safeRead(value, key), d + 1, nextPath));
    }
    if (keys.length > shown.length) parts.push('... +' + (keys.length - shown.length) + ' more');

    var ctor = constructorName(value);
    var prefix = (ctor && ctor !== 'Object') ? ctor + ' ' : '';
    return prefix + '{ ' + parts.join(', ') + ' }';
  }

  function mapToObject(map) {
    var obj = {};
    var i = 0;
    try {
      map.forEach(function (v, k) {
        if (i++ >= LIMITS.MAX_KEYS) return;
        obj[String(k)] = v;
      });
    } catch (e) { /* Map dengan key eksotis: lewati saja */ }
    return obj;
  }

  function setToArray(set) {
    var arr = [];
    try {
      set.forEach(function (v) { if (arr.length < LIMITS.MAX_ARRAY) arr.push(v); });
    } catch (e) { /* abaikan */ }
    return arr;
  }

  /** Getter milik halaman bisa melempar error atau punya efek samping.
   *  Membaca properti lewat pembungkus ini memastikan satu properti rusak tidak
   *  menggagalkan seluruh entri log. */
  function safeRead(obj, key) {
    try { return obj[key]; } catch (e) { return '[getter threw]'; }
  }

  function constructorName(value) {
    try {
      return value.constructor && value.constructor.name ? value.constructor.name : '';
    } catch (e) { return ''; }
  }

  /** Tidak memakai `instanceof Error`. Di MAIN world, objek Error bisa berasal
   *  dari realm lain (iframe), dan `instanceof` gagal lintas realm. */
  function isErrorLike(value) {
    try {
      if (typeof Error !== 'undefined' && value instanceof Error) return true;
      return typeof value.message === 'string' && typeof value.stack === 'string';
    } catch (e) { return false; }
  }

  function isElementLike(value) {
    try { return typeof value.nodeType === 'number' && typeof value.nodeName === 'string'; }
    catch (e) { return false; }
  }

  function describeElement(el) {
    try {
      var tag = String(el.nodeName || 'node').toLowerCase();
      if (el.nodeType !== 1) return '<' + tag + '>';
      var id = el.id ? '#' + el.id : '';
      var cls = '';
      if (el.classList && el.classList.length) {
        cls = '.' + Array.prototype.slice.call(el.classList).join('.');
      }
      return '<' + tag + id + cls + '>';
    } catch (e) { return '<node>'; }
  }

  /** Gabungkan argumen console.* menjadi satu baris teks.
   *  Argumen dipisah spasi, sama seperti perilaku console asli. */
  function serializeArgs(args) {
    var list = Array.prototype.slice.call(args || [], 0, LIMITS.MAX_ARGS);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      try { out.push(stringifyValue(list[i], 0, [])); }
      catch (e) { out.push('[unserializable argument]'); }
    }
    var extra = (args && args.length > LIMITS.MAX_ARGS)
      ? ' ... +' + (args.length - LIMITS.MAX_ARGS) + ' more args'
      : '';
    return truncate(out.join(' ') + extra, LIMITS.MAX_STRING);
  }

  // ---------------------------------------------------------------------------
  // Redaction: body request
  // ---------------------------------------------------------------------------

  /** Mengubah body request menjadi teks yang sudah diredaksi.
   *
   *  Yang TIDAK dilakukan: membaca ReadableStream, Blob, atau ArrayBuffer.
   *  Membaca stream berarti MENGONSUMSI body, dan request halaman akan gagal
   *  terkirim. Alat uji tidak boleh mengubah hal yang diuji. */
  function redactBody(body) {
    var count = 0;
    try {
      if (body == null) return { text: null, redacted: 0 };

      if (typeof body === 'string') return redactBodyText(body);

      if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
        return redactBodyText(body.toString());
      }

      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        var pairs = [];
        body.forEach(function (value, key) {
          if (pairs.length >= LIMITS.MAX_KEYS) return;
          if (isSensitiveField(key)) { pairs.push(key + '=' + REDACTED_MARK); count++; return; }
          if (value && typeof value === 'object' && typeof value.name === 'string') {
            pairs.push(key + '=[File ' + value.name + ' ' + (value.size || 0) + 'B]');
          } else {
            pairs.push(key + '=' + truncate(value, 200));
          }
        });
        return { text: 'FormData: ' + pairs.join('&'), redacted: count };
      }

      if (typeof Blob !== 'undefined' && body instanceof Blob) {
        return { text: '[binary body not captured: Blob ' + body.size + 'B]', redacted: 0 };
      }
      if (typeof ArrayBuffer !== 'undefined' &&
          (body instanceof ArrayBuffer || (body.buffer instanceof ArrayBuffer))) {
        return { text: '[binary body not captured: ArrayBuffer]', redacted: 0 };
      }
      if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
        return { text: '[stream body not captured: reading it would break the request]', redacted: 0 };
      }

      // Objek biasa: lewat serializer yang sudah menerapkan redaction per key.
      return { text: truncate(stringifyValue(body, 0, []), LIMITS.MAX_BODY_TEXT), redacted: 0 };
    } catch (e) {
      return { text: '[could not read request body]', redacted: 0 };
    }
  }

  /** Body berbentuk teks. Dua format ditangani terpisah karena struktur
   *  nilainya beda: JSON bisa bersarang, form-encoded selalu datar. */
  function redactBodyText(text) {
    var raw = String(text);
    var count = 0;

    // Jalur 1: JSON. Diparse supaya redaction bekerja di kedalaman berapa pun,
    // bukan mengandalkan regex yang gampang salah pada string bertanda kutip.
    var trimmed = raw.trim();
    if (trimmed && (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[')) {
      try {
        var parsed = JSON.parse(trimmed);
        var result = redactJson(parsed, 0);
        return {
          text: truncate(JSON.stringify(result.value), LIMITS.MAX_BODY_TEXT),
          redacted: result.count
        };
      } catch (e) {
        // JSON tidak valid: jatuh ke jalur regex di bawah.
      }
    }

    // Jalur 2: form-encoded atau teks bebas. Cocokkan pola `key=value`.
    var redactedText = raw.replace(/([A-Za-z0-9_\-.\[\]]+)=([^&\r\n]*)/g, function (whole, key) {
      if (isSensitiveField(key)) { count++; return key + '=' + REDACTED_MARK; }
      return whole;
    });

    // Jaring pengaman untuk JSON yang gagal diparse (misalnya terpotong):
    // sensor pola `"token":"..."` secara tekstual.
    redactedText = redactedText.replace(
      /("([A-Za-z0-9_\-]*)"\s*:\s*)"(?:[^"\\]|\\.)*"/g,
      function (whole, head, key) {
        if (isSensitiveField(key)) { count++; return head + '"' + REDACTED_MARK + '"'; }
        return whole;
      }
    );

    return { text: truncate(redactedText, LIMITS.MAX_BODY_TEXT), redacted: count };
  }

  /** Redaksi rekursif untuk struktur JSON yang sudah diparse. */
  function redactJson(value, depth) {
    var count = 0;
    if (depth >= LIMITS.MAX_DEPTH || value === null || typeof value !== 'object') {
      return { value: value, count: 0 };
    }
    if (Array.isArray(value)) {
      var arr = [];
      var n = Math.min(value.length, LIMITS.MAX_ARRAY);
      for (var i = 0; i < n; i++) {
        var r = redactJson(value[i], depth + 1);
        arr.push(r.value);
        count += r.count;
      }
      return { value: arr, count: count };
    }
    var obj = {};
    var keys = Object.keys(value).slice(0, LIMITS.MAX_KEYS);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (isSensitiveField(key)) { obj[key] = REDACTED_MARK; count++; continue; }
      var res = redactJson(value[key], depth + 1);
      obj[key] = res.value;
      count += res.count;
    }
    return { value: obj, count: count };
  }

  // ---------------------------------------------------------------------------
  // Tokenisasi untuk pewarnaan sintaks
  // ---------------------------------------------------------------------------

  /** Pola token, digabung jadi satu ekspresi supaya teks hanya dilintasi sekali.
   *
   *  URUTAN ALTERNATIF ITU PENTING. URL harus dicoba lebih dulu daripada pola
   *  angka:angka, karena stack trace berbunyi
   *  `...remote-object-helper-content.js:27:27075` - kalau pola angka menang
   *  lebih dulu, URL-nya pecah jadi serpihan yang tidak terbaca.
   *
   *  Grup: 1 url, 2 [REDACTED], 3 nama tipe error, 4 kata "at", 5 baris:kolom. */
  var SYNTAX_PATTERN = new RegExp([
    // `blob:` boleh mendahului skema, karena blob URL berbentuk
    // `blob:https://asal/uuid`. Tanpa awalan opsional ini, kecocokan mulai dari
    // `https://` dan prefiks `blob:` tertinggal sebagai teks biasa - URL yang
    // sama jadi terlihat terbelah dua.
    //
    // `data:` SENGAJA TIDAK ADA di daftar ini. Skema itu tidak memakai `//`,
    // jadi pola ini secara struktural tidak bisa mengenainya, dan isi data URI
    // di log hampir selalu base64 raksasa yang sudah dipotong upstream -
    // mewarnainya tidak menambah informasi apa pun.
    '((?:blob:)?(?:chrome-extension|moz-extension|https?|file|ws|wss):\\/\\/[^\\s)\\]"\']+)',
    '(\\[REDACTED\\])',
    // Awalan dibuat OPSIONAL. Versi pertama menulis `[A-Z][A-Za-z]*(?:Error|...)`
    // yang menuntut ada sesuatu sebelum "Error": `TypeError` cocok, tapi `Error`
    // sendirian tidak pernah cocok - dan `Error` justru bentuk paling umum di
    // stack trace. Ditemukan oleh tools/selftest-highlight.js, bukan oleh mata.
    '(\\b(?:[A-Z][A-Za-z]*)?(?:Error|Exception)\\b)',
    '(\\bat\\s+)',
    '(\\b\\d+:\\d+\\b)'
  ].join('|'), 'g');

  /** Pecah teks log menjadi deretan token bertipe.
   *
   *  KENAPA DI SINI, BUKAN DI panel.js. Ini logika string murni tanpa DOM, dan
   *  menaruhnya bersama kode DOM membuatnya tidak bisa diuji tanpa browser.
   *  Sekarang tools/selftest-highlight.js bisa memverifikasinya langsung.
   *
   *  JAMINAN YANG DIUJI: menggabungkan kembali seluruh `v` harus menghasilkan
   *  teks masukan yang IDENTIK. Untuk alat forensik, tokenizer yang menelan satu
   *  karakter jauh lebih berbahaya daripada tokenizer yang tidak mewarnai apa
   *  pun - bukti yang hilang tidak akan pernah disadari.
   *
   *  @returns {Array<{t:string, v:string}>} t = plain|url|num|type|kw|redacted */
  function tokenizeLog(rawText) {
    var text = String(rawText == null ? '' : rawText);
    var out = [];
    var last = 0;
    var m;

    SYNTAX_PATTERN.lastIndex = 0;
    while ((m = SYNTAX_PATTERN.exec(text)) !== null) {
      if (m.index > last) out.push({ t: 'plain', v: text.slice(last, m.index) });

      if (m[1]) {
        // Stack trace menempelkan ":baris:kolom" di ujung URL. Dipisah supaya
        // lokasi baris bisa dipindai terpisah dari path filenya - itu dua
        // pertanyaan berbeda saat melacak error.
        var split = /^(.*?)(:\d+:\d+)$/.exec(m[1]);
        if (split) {
          out.push({ t: 'url', v: split[1] });
          out.push({ t: 'num', v: split[2] });
        } else {
          out.push({ t: 'url', v: m[1] });
        }
      } else if (m[2]) out.push({ t: 'redacted', v: m[2] });
      else if (m[3]) out.push({ t: 'type', v: m[3] });
      else if (m[4]) out.push({ t: 'kw', v: m[4] });
      else if (m[5]) out.push({ t: 'num', v: m[5] });

      last = m.index + m[0].length;

      // Penjaga terhadap kecocokan berpanjang nol. Tidak mungkin terjadi dengan
      // pola di atas, tapi kalau suatu saat ada alternatif yang bisa cocok
      // dengan string kosong, tanpa baris ini loopnya berputar selamanya dan
      // membekukan panel.
      if (m[0].length === 0) SYNTAX_PATTERN.lastIndex++;
    }

    if (last < text.length) out.push({ t: 'plain', v: text.slice(last) });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Sanitasi entri (dipakai service worker)
  // ---------------------------------------------------------------------------

  /** Entri yang masuk ke service worker datang lewat postMessage di halaman,
   *  jadi halaman BISA memalsukannya. Fungsi ini memperlakukan entri sebagai
   *  data tidak dipercaya: hanya field yang dikenal yang dilewatkan, tipe
   *  dipaksa, panjang dipotong, dan redaction dijalankan ulang.
   *
   *  Redaction di sini idempoten - menjalankannya pada data yang sudah bersih
   *  tidak mengubah apa pun, karena `[REDACTED]` bukan nama field sensitif. */
  function sanitizeEntry(input) {
    var src = (input && typeof input === 'object') ? input : {};

    var kind = KINDS.indexOf(src.kind) !== -1 ? src.kind : 'console';
    var level = LEVELS.indexOf(src.level) !== -1 ? src.level : 'log';
    var t = typeof src.t === 'number' && isFinite(src.t) ? src.t : Date.now();

    var entry = {
      kind: kind,
      level: level,
      t: t,
      text: truncate(src.text == null ? '' : src.text, LIMITS.MAX_STRING),
      redacted: 0
    };

    if (typeof src.stack === 'string' && src.stack) {
      entry.stack = truncate(src.stack, LIMITS.MAX_STRING);
    }
    if (typeof src.origin === 'string' && src.origin) {
      entry.origin = truncate(src.origin, 200);
    }
    if (typeof src.frameId === 'number') entry.frameId = src.frameId;

    if (kind === 'network') {
      entry.method = truncate(src.method || 'GET', 12).toUpperCase();

      var u = redactUrl(src.url || '');
      entry.url = u.url;
      entry.redacted += u.redacted;

      entry.status = typeof src.status === 'number' && isFinite(src.status)
        ? Math.max(0, Math.min(999, Math.round(src.status))) : 0;
      entry.statusText = truncate(src.statusText || '', 120);
      entry.failed = !!src.failed || entry.status === 0;
      entry.durationMs = typeof src.durationMs === 'number' && isFinite(src.durationMs)
        ? Math.max(0, Math.round(src.durationMs)) : null;
      entry.sizeBytes = typeof src.sizeBytes === 'number' && isFinite(src.sizeBytes)
        ? Math.max(0, Math.round(src.sizeBytes)) : null;
      entry.transport = src.transport === 'xhr' ? 'xhr' : 'fetch';

      var h = redactHeaders(src.requestHeaders);
      entry.requestHeaders = h.headers;
      entry.redacted += h.redacted;

      if (src.requestBody != null) {
        var b = redactBodyText(String(src.requestBody));
        entry.requestBody = b.text;
        entry.redacted += b.redacted;
      }
      entry.level = networkLevel(entry);
    }

    if (typeof src.redacted === 'number' && src.redacted > 0) {
      entry.redacted += src.redacted;
    }
    return entry;
  }

  /** Pemetaan status HTTP ke level, mengikuti README bagian 6 aturan 2
   *  (satu warna satu makna) dan README bagian 3 (status >= 400 disorot). */
  function networkLevel(entry) {
    if (entry.failed || entry.status === 0) return 'error';
    if (entry.status >= 400) return 'error';
    if (entry.status >= 300) return 'warn';
    return 'info';
  }

  // ---------------------------------------------------------------------------
  // API publik
  // ---------------------------------------------------------------------------

  root.__RAPSPECT_CORE__ = {
    CHANNEL: CHANNEL,
    LIMITS: LIMITS,
    LEVELS: LEVELS,
    KINDS: KINDS,
    REDACTED_MARK: REDACTED_MARK,
    REDACTED_HEADERS: REDACTED_HEADERS,
    REDACTED_FIELDS: FIELDS_SUBSTRING.concat(FIELDS_EXACT),
    normalizeKey: normalizeKey,
    truncate: truncate,
    isSensitiveHeader: isSensitiveHeader,
    isSensitiveField: isSensitiveField,
    redactHeaders: redactHeaders,
    redactUrl: redactUrl,
    redactBody: redactBody,
    redactBodyText: redactBodyText,
    serializeArgs: serializeArgs,
    stringifyValue: stringifyValue,
    tokenizeLog: tokenizeLog,
    sanitizeEntry: sanitizeEntry,
    networkLevel: networkLevel
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
