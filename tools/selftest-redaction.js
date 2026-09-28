/* =============================================================================
 * Rapspect - self-test aturan redaction
 *
 * ALAT BANTU UJI, BUKAN BAGIAN DARI EXTENSION.
 * Tidak disebut di manifest.json dan tidak pernah dimuat Chrome.
 *
 * KENAPA ADA
 * Redaction adalah satu-satunya bagian Rapspect yang kalau salah, akibatnya
 * bukan "panel jelek" tapi "token bocor ke bug report". Memverifikasinya lewat
 * klik-klik manual berarti mengandalkan mata. File ini memeriksanya secara
 * mekanis dalam satu detik, tanpa Chrome dan tanpa dependency.
 *
 * Yang diperiksa bukan cuma "apakah menyensor", tapi juga "apakah TIDAK
 * menyensor berlebihan" - redaction yang terlalu rakus membuat log tidak
 * berguna dan QA berhenti mempercayainya.
 *
 * CARA PAKAI (dari folder proyek):
 *   node tools/selftest-redaction.js
 * Exit code 0 kalau semua lolos, 1 kalau ada yang gagal.
 * ========================================================================== */
'use strict';

// rapspect-core.js adalah plain script yang menempel ke globalThis, bukan modul
// CommonJS. require() tetap mengeksekusinya, dan objeknya muncul di globalThis.
require('../src/shared/rapspect-core.js');
const core = globalThis.__RAPSPECT_CORE__;

const LEAK = 'SHOULD-NOT-APPEAR';
const results = [];

function check(name, condition, detail) {
  results.push({ ok: !!condition, name, detail: detail == null ? '' : String(detail) });
}

// -----------------------------------------------------------------------------
// Header (README bagian 11)
// -----------------------------------------------------------------------------
{
  const r = core.redactHeaders({
    'Authorization': 'Bearer ' + LEAK,
    'cookie': 'session=' + LEAK,
    'Set-Cookie': 'a=' + LEAK,
    'X-API-KEY': LEAK,
    'X-Request-Id': 'visible-request-id',
    'Content-Type': 'application/json'
  });
  check('header Authorization disensor', r.headers['Authorization'] === core.REDACTED_MARK);
  check('header cookie disensor walau huruf kecil', r.headers['cookie'] === core.REDACTED_MARK);
  check('header Set-Cookie disensor', r.headers['Set-Cookie'] === core.REDACTED_MARK);
  check('header X-API-KEY disensor walau huruf besar', r.headers['X-API-KEY'] === core.REDACTED_MARK);
  check('header X-Request-Id TIDAK disensor', r.headers['X-Request-Id'] === 'visible-request-id');
  check('header Content-Type TIDAK disensor', r.headers['Content-Type'] === 'application/json');
  check('jumlah header tersensor = 4', r.redacted === 4, 'dapat ' + r.redacted);
  check('tidak ada kebocoran di header', JSON.stringify(r.headers).indexOf(LEAK) === -1);
}

// Bentuk input lain yang sah dipakai pemanggil fetch
{
  const fromArray = core.redactHeaders([['Authorization', LEAK], ['X-Ok', 'fine']]);
  check('header dari array pasangan', fromArray.headers['Authorization'] === core.REDACTED_MARK &&
                                     fromArray.headers['X-Ok'] === 'fine');
  const fromNull = core.redactHeaders(null);
  check('header null tidak melempar', fromNull && fromNull.redacted === 0);
}

// -----------------------------------------------------------------------------
// Body JSON
// -----------------------------------------------------------------------------
{
  const body = JSON.stringify({
    username: 'qa.engineer',
    password: LEAK,
    apiKey: LEAK,
    api_key: LEAK,
    refreshToken: LEAK,
    clientSecret: LEAK,
    pin: '1234',
    note: 'visible-note',
    nested: { accessToken: LEAK, keep: 7 },
    list: [{ token: LEAK }, { plain: 'visible-item' }]
  });
  const r = core.redactBodyText(body);
  check('body JSON tidak membocorkan apa pun', r.text.indexOf(LEAK) === -1, r.text);
  check('body JSON menyensor bersarang', r.text.indexOf('accessToken') !== -1);
  check('body JSON menyensor di dalam array', r.text.indexOf('visible-item') !== -1);
  check('body JSON menyimpan username', r.text.indexOf('qa.engineer') !== -1);
  check('body JSON menyimpan note', r.text.indexOf('visible-note') !== -1);
  check('body JSON menyimpan angka biasa', r.text.indexOf('7') !== -1);
  check('body JSON menyensor pin', r.text.indexOf('1234') === -1, r.text);
}

// Body form-encoded
{
  const r = core.redactBodyText('user=qa&password=' + LEAK + '&pin=9999&keep=visible');
  check('body form tidak membocorkan', r.text.indexOf(LEAK) === -1, r.text);
  check('body form menyensor pin', r.text.indexOf('9999') === -1);
  check('body form menyimpan field biasa', r.text.indexOf('keep=visible') !== -1);
}

// JSON terpotong: harus tetap tersensor lewat jaring pengaman tekstual
{
  const broken = '{"username":"qa","password":"' + LEAK + '","tok';
  const r = core.redactBodyText(broken);
  check('JSON rusak tetap tersensor', r.text.indexOf(LEAK) === -1, r.text);
}

// Body biner tidak boleh dibaca
{
  const r = core.redactBody(new ArrayBuffer(8));
  check('ArrayBuffer tidak dibaca', /binary body not captured/.test(r.text), r.text);
}

// -----------------------------------------------------------------------------
// URL query (tambahan di luar README, docs/DECISIONS.md 5.4)
// -----------------------------------------------------------------------------
{
  const r = core.redactUrl('https://api.test/v1/users?token=' + LEAK +
                           '&api_key=' + LEAK + '&page=2&q=hello#frag');
  check('URL tidak membocorkan', r.url.indexOf(LEAK) === -1, r.url);
  check('URL menyimpan page', r.url.indexOf('page=2') !== -1);
  check('URL menyimpan q', r.url.indexOf('q=hello') !== -1);
  check('URL menyimpan fragment', r.url.indexOf('#frag') !== -1);
  check('URL tanpa query tidak berubah',
        core.redactUrl('https://api.test/v1/users').url === 'https://api.test/v1/users');
}

// -----------------------------------------------------------------------------
// Pencocokan nama field: jangan sampai berlebihan
// -----------------------------------------------------------------------------
{
  const sensitive = ['password', 'Password', 'passwordConfirmation', 'token', 'access_token',
                     'refreshToken', 'secret', 'clientSecret', 'apiKey', 'api-key', 'API_KEY', 'pin'];
  const harmless = ['shipping', 'pinned', 'spinner', 'shipment', 'username', 'email',
                    'note', 'pincode_label_text_only_no_match'];

  let allSensitive = true;
  sensitive.forEach(k => { if (!core.isSensitiveField(k)) { allSensitive = false; } });
  check('semua nama sensitif terdeteksi', allSensitive);

  let noFalsePositive = true;
  const offenders = [];
  harmless.forEach(k => { if (core.isSensitiveField(k)) { noFalsePositive = false; offenders.push(k); } });
  check('tidak ada penyensoran berlebihan', noFalsePositive, offenders.join(', '));
}

// -----------------------------------------------------------------------------
// Serialisasi argumen console
// -----------------------------------------------------------------------------
{
  const text = core.serializeArgs(['config dump', {
    endpoint: 'https://api.test',
    apiKey: LEAK,
    nested: { accessToken: LEAK, retries: 3 },
    pin: '4321',
    safeValue: 'visible-value'
  }]);
  check('argumen console tidak membocorkan', text.indexOf(LEAK) === -1, text);
  check('argumen console menyimpan nilai aman', text.indexOf('visible-value') !== -1);
  check('argumen console menyensor pin', text.indexOf('4321') === -1, text);
}

// Objek bersiklus tidak boleh membuat serializer hang atau melempar
{
  const circular = { name: 'root' };
  circular.self = circular;
  const text = core.serializeArgs([circular]);
  check('objek bersiklus ditangani', text.indexOf('[Circular]') !== -1, text);
}

// Error harus membawa stack
{
  const text = core.serializeArgs([new Error('boom')]);
  check('Error diserialisasi dengan pesan', text.indexOf('boom') !== -1);
}

// String sangat panjang harus dipotong
{
  const text = core.serializeArgs(['x'.repeat(10000)]);
  check('string panjang dipotong', text.length < core.LIMITS.MAX_STRING + 200, 'panjang ' + text.length);
}

// -----------------------------------------------------------------------------
// sanitizeEntry: data dari halaman diperlakukan tidak dipercaya
// -----------------------------------------------------------------------------
{
  const e = core.sanitizeEntry({
    kind: 'network', method: 'get', url: 'https://api.test/x?token=' + LEAK,
    status: 404, requestHeaders: { Authorization: LEAK },
    requestBody: 'password=' + LEAK, t: Date.now()
  });
  check('sanitize meredaksi ulang seluruh entri', JSON.stringify(e).indexOf(LEAK) === -1, JSON.stringify(e));
  check('method dinormalkan ke huruf besar', e.method === 'GET');
  check('status 404 dipetakan ke level error', e.level === 'error');
}
{
  check('status 200 -> info', core.sanitizeEntry({ kind: 'network', status: 200 }).level === 'info');
  check('status 301 -> warn', core.sanitizeEntry({ kind: 'network', status: 301 }).level === 'warn');
  const failed = core.sanitizeEntry({ kind: 'network', failed: true });
  check('failed -> error dan status 0', failed.level === 'error' && failed.status === 0);
}
{
  // Entri palsu dari halaman jahat: kind dan level asing harus dipaksa ke nilai
  // yang dikenal, dan teks raksasa harus dipotong.
  const e = core.sanitizeEntry({ kind: 'evil', level: 'evil', text: 'y'.repeat(50000), extraField: 'dropped' });
  check('kind asing dipaksa ke console', e.kind === 'console');
  check('level asing dipaksa ke log', e.level === 'log');
  check('teks raksasa dipotong', e.text.length < core.LIMITS.MAX_STRING + 200, 'panjang ' + e.text.length);
  check('field tak dikenal dibuang', e.extraField === undefined);
}
{
  const e = core.sanitizeEntry(null);
  check('entri null tidak melempar', e && e.kind === 'console');
}

// -----------------------------------------------------------------------------
// Laporan
// -----------------------------------------------------------------------------
let failed = 0;
results.forEach(r => {
  if (!r.ok) failed++;
  const mark = r.ok ? 'PASS' : 'FAIL';
  console.log(mark + '  ' + r.name + (r.ok || !r.detail ? '' : '\n      -> ' + r.detail));
});
console.log('');
console.log(results.length + ' pemeriksaan, ' + failed + ' gagal');
process.exit(failed ? 1 : 0);
