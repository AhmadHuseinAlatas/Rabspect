/* =============================================================================
 * Rapspect - pemeriksaan tokenisasi pewarnaan sintaks
 *
 * ALAT BANTU UJI, BUKAN BAGIAN DARI EXTENSION.
 *
 * KENAPA ADA
 * Satu jaminan jauh lebih penting daripada "warnanya benar": menggabungkan
 * kembali seluruh token harus menghasilkan teks masukan yang IDENTIK.
 *
 * Untuk alat forensik, tokenizer yang menelan satu karakter jauh lebih berbahaya
 * daripada tokenizer yang tidak mewarnai apa pun. Log yang salah warna langsung
 * kelihatan; log yang kehilangan satu digit dari nomor baris, atau memotong ujung
 * sebuah URL, akan dipercaya apa adanya dan menyesatkan orang yang sedang mencari
 * penyebab bug.
 *
 * Karena itu setiap kasus di bawah memeriksa dua hal: struktur token yang
 * diharapkan, DAN keutuhan teks.
 *
 * CARA PAKAI (dari folder proyek):
 *   node tools/selftest-highlight.js
 * Exit code 0 kalau semua lolos, 1 kalau ada yang gagal.
 * ========================================================================== */
'use strict';

require('../src/shared/rapspect-core.js');
const core = globalThis.__RAPSPECT_CORE__;

const results = [];

function check(name, ok, detail) {
  results.push({ ok: !!ok, name, detail: detail == null ? '' : String(detail) });
}

/** Jaminan utama: tokenisasi tidak boleh mengubah satu karakter pun. */
function checkLossless(label, text) {
  const rebuilt = core.tokenizeLog(text).map((t) => t.v).join('');
  check('utuh: ' + label, rebuilt === text,
        rebuilt === text ? '' : 'panjang asli ' + text.length + ', hasil ' + rebuilt.length);
}

/** Ambil semua nilai token dengan tipe tertentu. */
function valuesOf(text, type) {
  return core.tokenizeLog(text).filter((t) => t.t === type).map((t) => t.v);
}

// -----------------------------------------------------------------------------
// Kasus nyata: stack trace yang memicu fitur ini
// -----------------------------------------------------------------------------
{
  const trace = [
    'Unhandled promise rejection: Error: Method not found: "object.extension.inIncognitoContext.toJSON"',
    '    at k.emit (chrome-extension://ljdobmomdgdljniojadhoplhkpialdid/common/remote-object-helper-content.js:27:27075)',
    '    at aa.handleRawMessage (chrome-extension://ljdobmomdgdljniojadhoplhkpialdid/common/remote-object-helper-content.js:1:2446)'
  ].join('\n');

  checkLossless('stack trace chrome-extension', trace);

  const urls = valuesOf(trace, 'url');
  const nums = valuesOf(trace, 'num');

  check('dua URL frame terdeteksi', urls.length === 2, 'dapat ' + urls.length);

  // Inti persoalan urutan pola. Kalau angka:angka menang lebih dulu, URL-nya
  // pecah dan berakhir tanpa nama file.
  check('URL tidak terpotong di ujung nama file',
        urls.every((u) => u.endsWith('remote-object-helper-content.js')),
        urls.join(' | '));

  check('baris:kolom dipisah dari URL',
        nums.indexOf(':27:27075') !== -1 && nums.indexOf(':1:2446') !== -1,
        nums.join(' '));

  check('nama tipe error ditandai',
        valuesOf(trace, 'type').indexOf('Error') !== -1,
        valuesOf(trace, 'type').join(' '));

  check('kata "at" ditandai sebagai kerangka',
        valuesOf(trace, 'kw').length === 2,
        'dapat ' + valuesOf(trace, 'kw').length);

  // Pesan utamanya harus tetap teks biasa. Kalau seluruh baris ikut diwarnai,
  // aturan README bagian 5 soal area data yang tenang jadi tidak berarti.
  check('isi pesan tetap teks biasa',
        core.tokenizeLog(trace).some(
          (t) => t.t === 'plain' && t.v.indexOf('Method not found') !== -1));
}

// -----------------------------------------------------------------------------
// Skema URL lain
// -----------------------------------------------------------------------------
{
  const cases = [
    ['https', 'GET 404 https://api.test/v1/users?page=2'],
    ['http', 'POST 200 http://localhost:8080/test-page.html'],
    ['file', 'at fn (file:///C:/work/app.js:10:5)'],
    ['blob', 'at fn (blob:https://x.test/abc-123:1:1)'],
    ['ws', 'connecting to wss://socket.test/stream']
  ];
  for (const [label, text] of cases) {
    checkLossless('skema ' + label, text);
    check('skema ' + label + ' terdeteksi sebagai url',
          valuesOf(text, 'url').length >= 1, text);
  }

  // blob URL harus utuh, termasuk prefiks blob:. Versi pertama mulai mencocokkan
  // dari https:// sehingga prefiksnya tertinggal sebagai teks biasa, dan satu URL
  // terlihat seperti dua hal berbeda.
  const blob = valuesOf('at fn (blob:https://x.test/abc-123:1:1)', 'url')[0];
  check('blob URL diambil utuh termasuk prefiksnya',
        blob === 'blob:https://x.test/abc-123', blob);

  // data: TIDAK diwarnai, dan itu keputusan sadar: skemanya tidak memakai //,
  // dan isinya base64 raksasa yang tidak membawa informasi untuk dipindai.
  const dataUri = 'img src data:image/png;base64,iVBORw0KGgo=';
  checkLossless('data uri', dataUri);
  check('data uri sengaja dibiarkan teks biasa',
        valuesOf(dataUri, 'url').length === 0, valuesOf(dataUri, 'url').join(''));

  // Port pada http://localhost:8080 JANGAN dipisah sebagai baris:kolom - itu
  // bagian dari URL dan hanya ada satu titik dua, bukan dua.
  const url = valuesOf('open http://localhost:8080/test-page.html', 'url')[0];
  check('port tidak dipotong dari URL',
        url === 'http://localhost:8080/test-page.html', url);
}

// -----------------------------------------------------------------------------
// Penanda redaction
// -----------------------------------------------------------------------------
{
  const text = 'request headers:\n  Authorization: [REDACTED]\n  X-Request-Id: visible';
  checkLossless('header dengan redaction', text);
  check('[REDACTED] ditandai',
        valuesOf(text, 'redacted').length === 1, valuesOf(text, 'redacted').join(''));
  check('header yang tidak disensor tetap teks biasa',
        core.tokenizeLog(text).some((t) => t.t === 'plain' && t.v.indexOf('visible') !== -1));
}

// -----------------------------------------------------------------------------
// Kasus batas dan masukan yang tidak bersahabat
// -----------------------------------------------------------------------------
{
  check('string kosong menghasilkan nol token', core.tokenizeLog('').length === 0);
  check('null tidak melempar', core.tokenizeLog(null).length === 0);
  check('undefined tidak melempar', core.tokenizeLog(undefined).length === 0);
  check('angka diperlakukan sebagai teks',
        core.tokenizeLog(12345).map((t) => t.v).join('') === '12345');

  checkLossless('teks polos tanpa pola apa pun', 'just a plain log line with nothing special');
  checkLossless('hanya spasi', '   \n\t  ');
  checkLossless('tanda kurung berlapis', 'at fn ((((deep))))');
  checkLossless('URL di dalam tanda kutip', 'fetch failed for "https://x.test/a" retrying');
  checkLossless('dua URL bersebelahan', 'https://a.test/1 https://b.test/2');
  checkLossless('URL di akhir tanpa spasi', 'see https://a.test/end');

  // Tokenizer dipanggil ulang berkali-kali pada regex global yang sama. Kalau
  // lastIndex tidak direset di awal, pemanggilan kedua akan melewatkan awal
  // teks - bug klasik regex /g yang dipakai bersama.
  const twice = 'at fn (https://a.test/x:1:2)';
  const first = core.tokenizeLog(twice).map((t) => t.t + ':' + t.v).join('|');
  const second = core.tokenizeLog(twice).map((t) => t.t + ':' + t.v).join('|');
  check('pemanggilan berulang menghasilkan hasil sama (lastIndex direset)',
        first === second, first + '  vs  ' + second);

  // Teks sangat panjang tidak boleh membuat tokenizer berhenti bekerja.
  const long = ('at fn (https://a.test/file.js:12:34) ').repeat(300);
  checkLossless('teks panjang 300 frame', long);
  check('teks panjang tetap menghasilkan token',
        valuesOf(long, 'url').length === 300, 'dapat ' + valuesOf(long, 'url').length);
}

// -----------------------------------------------------------------------------
// Keamanan: teks berisi HTML tidak boleh berubah bentuk
// -----------------------------------------------------------------------------
{
  // panel.js menulis setiap token dengan textContent, bukan innerHTML. Tokenizer
  // tidak boleh diam-diam mengubah atau membuang markup, karena teks aslinya
  // adalah bukti - QA perlu melihat persis apa yang dicetak halaman.
  const hostile = '<img src=x onerror="alert(1)"> <script>alert(2)</script>';
  checkLossless('teks berisi markup', hostile);
  check('markup tidak diubah sama sekali',
        core.tokenizeLog(hostile).map((t) => t.v).join('') === hostile);
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
