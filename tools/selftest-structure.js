/* =============================================================================
 * Rapspect - pemeriksaan struktur proyek
 *
 * ALAT BANTU UJI, BUKAN BAGIAN DARI EXTENSION.
 *
 * KENAPA ADA
 * Sebagian besar kesalahan yang membuat extension GAGAL DIMUAT sama sekali
 * bukan kesalahan logika, tapi kesalahan sambungan: manifest menunjuk file yang
 * tidak ada, panel.js mencari elemen yang sudah dihapus dari panel.html, atau
 * izin menyelinap masuk tanpa sengaja. Semuanya tidak terlihat sampai Chrome
 * menolak folder ini.
 *
 * Sebelum file ini ada, saya memeriksanya manual dengan perintah PowerShell
 * sekali jalan. Pemeriksaan yang hanya hidup di riwayat terminal tidak bisa
 * diulang orang lain dan tidak bisa dijalankan CI. Sekarang bisa keduanya.
 *
 * Hanya memakai modul bawaan Node, berjalan di Windows maupun Linux.
 *
 * CARA PAKAI (dari folder proyek):
 *   node tools/selftest-structure.js
 * Exit code 0 kalau semua lolos, 1 kalau ada yang gagal.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = [];

function check(name, ok, detail) {
  results.push({ ok: !!ok, name, detail: detail == null ? '' : String(detail) });
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

// -----------------------------------------------------------------------------
// 1. manifest.json
// -----------------------------------------------------------------------------
let manifest = null;
try {
  manifest = JSON.parse(read('manifest.json'));
  check('manifest.json adalah JSON yang sah', true);
} catch (e) {
  check('manifest.json adalah JSON yang sah', false, e.message);
}

if (manifest) {
  check('manifest_version adalah 3', manifest.manifest_version === 3, manifest.manifest_version);
  check('punya name dan version', !!manifest.name && !!manifest.version,
        manifest.name + ' ' + manifest.version);

  // Izin yang DIBOLEHKAN. Daftar putih, bukan daftar hitam: izin baru harus
  // ditambahkan di sini dengan sadar, dan setiap penambahan wajib punya
  // pembenaran di docs/DECISIONS.md bagian 3.1.
  const ALLOWED = ['storage', 'sidePanel', 'tabs'];
  const requested = manifest.permissions || [];
  const unexpected = requested.filter((p) => ALLOWED.indexOf(p) === -1);
  check('tidak ada izin di luar daftar putih', unexpected.length === 0,
        'tidak terduga: ' + unexpected.join(', '));

  // Aturan keras v1: README bagian 4 mengeluarkan chrome.debugger dari lingkup
  // karena memunculkan banner "sedang di-debug" dan bentrok dengan DevTools.
  check('izin debugger TIDAK diminta (aturan v1)',
        requested.indexOf('debugger') === -1);

  check('tidak ada host_permissions terpisah',
        !manifest.host_permissions,
        'matches di content_scripts sudah cukup, entri terpisah hanya memperbesar dialog izin');

  // Semua path yang dirujuk manifest harus benar-benar ada. Ikon yang hilang
  // membuat Chrome menolak extension SEPENUHNYA dengan "Could not load icon",
  // bukan sekadar menampilkan ikon kosong.
  const referenced = [];

  if (manifest.background && manifest.background.service_worker) {
    referenced.push(manifest.background.service_worker);
  }
  if (manifest.side_panel && manifest.side_panel.default_path) {
    referenced.push(manifest.side_panel.default_path);
  }
  if (manifest.action && manifest.action.default_popup) {
    // Query string dibuang: panel.html?surface=popup menunjuk file panel.html.
    referenced.push(manifest.action.default_popup.split('?')[0]);
  }
  for (const size of Object.keys(manifest.icons || {})) {
    referenced.push(manifest.icons[size]);
  }
  for (const size of Object.keys((manifest.action || {}).default_icon || {})) {
    referenced.push(manifest.action.default_icon[size]);
  }
  for (const cs of manifest.content_scripts || []) {
    for (const js of cs.js || []) referenced.push(js);
    for (const css of cs.css || []) referenced.push(css);
  }

  const missing = referenced.filter((p) => !exists(p));
  check('semua file yang dirujuk manifest ada (' + referenced.length + ' path)',
        missing.length === 0, 'hilang: ' + missing.join(', '));

  // Content script MAIN world adalah inti arsitekturnya. Kalau world-nya hilang
  // atau berubah, console halaman berhenti tertangkap tanpa pesan error apa pun.
  const worlds = (manifest.content_scripts || []).map((cs) => cs.world || 'ISOLATED');
  check('ada content script di world MAIN', worlds.indexOf('MAIN') !== -1, worlds.join(', '));
  check('ada content script di world ISOLATED', worlds.indexOf('ISOLATED') !== -1, worlds.join(', '));

  const allAtStart = (manifest.content_scripts || [])
    .every((cs) => cs.run_at === 'document_start');
  check('semua content script berjalan di document_start', allAtStart,
        'tambalan harus terpasang sebelum script halaman jalan');
}

// -----------------------------------------------------------------------------
// 2. panel.js <-> panel.html
// -----------------------------------------------------------------------------
try {
  const js = read('src/panel/panel.js');
  const html = read('src/panel/panel.html');

  const ids = [];
  const idPattern = /getElementById\('([^']+)'\)/g;
  let m;
  while ((m = idPattern.exec(js)) !== null) ids.push(m[1]);

  const orphans = ids.filter((id) => html.indexOf('id="' + id + '"') === -1);
  check('semua getElementById punya elemennya (' + ids.length + ' id)',
        orphans.length === 0, 'tidak ada di html: ' + orphans.join(', '));

  // Daftar lensa di JS dan tab di HTML harus sama persis. Kalau tidak, akan ada
  // tab yang tidak bisa dipilih atau lensa yang tidak punya tombolnya.
  const scopeMatch = js.match(/var SCOPES = \[([^\]]+)\]/);
  const jsScopes = scopeMatch
    ? scopeMatch[1].split(',').map((s) => s.trim().replace(/'/g, ''))
    : [];

  const htmlScopes = [];
  const scopePattern = /data-scope="([a-z]+)"/g;
  while ((m = scopePattern.exec(html)) !== null) htmlScopes.push(m[1]);

  check('daftar tab di html sama dengan SCOPES di js',
        jsScopes.length > 0 && jsScopes.join(',') === htmlScopes.join(','),
        'js: ' + jsScopes.join(',') + ' | html: ' + htmlScopes.join(','));

  // CSP halaman extension MV3 melarang script inline dan handler atribut.
  // Pelanggarannya tidak terlihat sampai tombolnya diklik dan tidak terjadi apa-apa.
  //
  // Komentar HTML dibuang lebih dulu. Versi pertama pemeriksaan ini gagal justru
  // pada file yang benar, karena komentar di panel.html MENJELASKAN aturan CSP
  // dan menyebut kata <script> di dalam penjelasannya. Komentar tidak bisa
  // dieksekusi, jadi mencocokkannya adalah positif palsu.
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');

  const inlineHandler = /\son[a-z]+\s*=\s*["']/i.test(markup);
  check('tidak ada handler event inline di html', !inlineHandler,
        'atribut seperti onclick= dilarang CSP MV3');

  const inlineScript = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(markup);
  check('tidak ada blok script inline di html', !inlineScript,
        'CSP MV3 hanya mengizinkan <script src>');
} catch (e) {
  check('bisa membaca panel.js dan panel.html', false, e.message);
}

// -----------------------------------------------------------------------------
// 3. panel.css: tidak ada nilai warna di luar blok token
// -----------------------------------------------------------------------------
try {
  // Komentar dibuang lebih dulu. Blok token memang MENYEBUT nilai hex di
  // komentar sebagai catatan audit (misalnya "README #D32F27 = 4.49:1 GAGAL"),
  // dan itu bukan pelanggaran.
  const css = read('src/panel/panel.css').replace(/\/\*[\s\S]*?\*\//g, '');

  // Penentu batas BUKAN nomor baris atau teks komentar - keduanya gampang
  // bergeser. Yang dipakai adalah selektor pembungkusnya: nilai warna hanya
  // boleh berada di dalam :root atau [data-theme=...].
  const offenders = [];
  let selector = '';
  let buffer = '';
  let depth = 0;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) selector = buffer.trim().split('\n').pop().trim();
      depth++;
      buffer = '';
      continue;
    }
    if (ch === '}') {
      depth--;
      buffer = '';
      continue;
    }
    if (ch === '\n') {
      if (depth > 0 && /#[0-9A-Fa-f]{3,8}\b|\brgba?\(/.test(buffer)) {
        const allowed = /^:root/.test(selector) || /^\[data-theme/.test(selector);
        if (!allowed) offenders.push(selector + ' -> ' + buffer.trim());
      }
      buffer = '';
      continue;
    }
    buffer += ch;
  }

  check('tidak ada nilai warna di luar blok token', offenders.length === 0,
        offenders.slice(0, 5).join(' | '));

  // Setiap token warna wajib punya nilai di KEDUA tema. Token yang hanya ada di
  // dark akan mewarisi nilai dark saat light mode aktif, dan itu justru cara
  // paling gampang menghasilkan teks yang tidak terbaca.
  const rootBlock = css.match(/:root\s*\{([^}]*)\}\s*$/m);
  const lightBlock = css.match(/\[data-theme="light"\]\s*\{([^}]*)\}/);
  if (lightBlock) {
    const themeTokens = ['--rp-bg', '--rp-surface', '--rp-surface-alt', '--rp-border',
                         '--rp-text', '--rp-text-muted', '--rp-error', '--rp-warn',
                         '--rp-info', '--rp-success', '--rp-debug',
                         '--rp-syn-url', '--rp-syn-num'];
    const absent = themeTokens.filter((t) => lightBlock[1].indexOf(t + ':') === -1);
    check('semua token tema punya nilai light mode', absent.length === 0,
          'belum ada di light: ' + absent.join(', '));
  } else {
    check('blok [data-theme="light"] ditemukan', false);
  }
} catch (e) {
  check('bisa membaca panel.css', false, e.message);
}

// -----------------------------------------------------------------------------
// 4. Tidak ada penanda pekerjaan yang belum selesai di kode produksi
// -----------------------------------------------------------------------------
try {
  const sourceFiles = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      const rel = dir + '/' + name;
      const stat = fs.statSync(path.join(ROOT, rel));
      if (stat.isDirectory()) walk(rel);
      else if (/\.(js|css|html)$/.test(name)) sourceFiles.push(rel);
    }
  })('src');

  const marked = sourceFiles.filter((f) => /\bTODO\b|\bFIXME\b|\bXXX\b/.test(read(f)));
  check('tidak ada TODO/FIXME di src (' + sourceFiles.length + ' file diperiksa)',
        marked.length === 0, marked.join(', '));
} catch (e) {
  check('bisa menelusuri folder src', false, e.message);
}

// -----------------------------------------------------------------------------
// 5. Ikon extension
// -----------------------------------------------------------------------------
for (const size of [16, 32, 48, 128]) {
  const rel = 'assets/icons/icon' + size + '.png';
  if (!exists(rel)) {
    check('icon' + size + '.png ada', false);
    continue;
  }
  // Penanda PNG adalah 89 50 4E 47. Mengganti ekstensi file JPEG menjadi .png
  // TIDAK mengubah isinya, dan itu kesalahan yang sudah pernah benar-benar
  // terjadi di proyek ini.
  const head = fs.readFileSync(path.join(ROOT, rel)).subarray(0, 4);
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  check('icon' + size + '.png benar-benar PNG, bukan JPEG yang diganti nama', isPng,
        'byte awal: ' + head.toString('hex'));
}

// -----------------------------------------------------------------------------
// 6. Banner README
// -----------------------------------------------------------------------------
// README.MD tidak boleh diubah, jadi path gambar yang dirujuknya harus tetap
// ada. Kalau tidak, banner di halaman GitHub broken - hal pertama yang dilihat
// pengunjung.
try {
  const readme = read('README.md');
  const imgMatch = readme.match(/<img\s+src="([^"]+)"/);
  if (imgMatch) {
    check('gambar banner README ada: ' + imgMatch[1], exists(imgMatch[1]));
  } else {
    check('README menyebut gambar banner', true, 'tidak ada banner, tidak apa-apa');
  }
} catch (e) {
  check('bisa membaca README.md', false, e.message);
}

// -----------------------------------------------------------------------------
// Laporan
// -----------------------------------------------------------------------------
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + r.name +
              (r.ok || !r.detail ? '' : '\n      -> ' + r.detail));
}
console.log('');
console.log(results.length + ' pemeriksaan, ' + failed + ' gagal');
process.exit(failed ? 1 : 0);
