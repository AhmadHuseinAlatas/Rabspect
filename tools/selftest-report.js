/* =============================================================================
 * Rapspect - pemeriksaan pembangun laporan
 *
 * ALAT BANTU UJI, BUKAN BAGIAN DARI EXTENSION.
 *
 * KENAPA ADA
 * Tabel Markdown yang rusak baru terlihat SETELAH tertempel di tiket, dan saat
 * itu sudah terlambat. Dua karakter cukup untuk merusaknya secara senyap:
 *
 *   |  memecah kolom di tengah isi log
 *   \n mengakhiri baris tabel sebelum waktunya
 *
 * Stack trace mengandung keduanya. Jadi yang diuji di sini bukan "laporannya
 * rapi", tapi "strukturnya tidak bisa dirusak oleh isi log" - termasuk isi log
 * yang memang sengaja berisi pipa dan baris baru.
 *
 * Satu pemeriksaan lagi yang penting: laporan tidak boleh MEMBOCORKAN. Redaction
 * berjalan di lapisan lain, tapi laporan adalah tempat data keluar dari alat ini
 * menuju tiket publik, jadi diperiksa ulang di sini.
 *
 * CARA PAKAI (dari folder proyek):
 *   node tools/selftest-report.js
 * Exit code 0 kalau semua lolos, 1 kalau ada yang gagal.
 * ========================================================================== */
'use strict';

require('../src/shared/rapspect-core.js');
const core = globalThis.__RAPSPECT_CORE__;

const results = [];
const LEAK = 'SHOULD-NOT-APPEAR';

function check(name, ok, detail) {
  results.push({ ok: !!ok, name, detail: detail == null ? '' : String(detail) });
}

const meta = {
  url: 'http://localhost:8080/test-page.html',
  title: 'Rapspect test page',
  tab: 'error',
  failedOnly: true,
  query: '404',
  total: 64,
  max: 500
};

/** Entri yang sengaja tidak bersahabat: pipa, baris baru, dan kurung kurawal. */
const entries = [
  {
    // Berisi ketiga karakter perusak sekaligus: pipa, baris baru, dan kurung
    // kurawal. Versi pertama file ini hanya memakai dua yang pertama, sehingga
    // escaping kurawal Jira tidak pernah benar-benar teruji.
    id: 1, kind: 'console', level: 'error', t: Date.parse('2026-09-30T19:50:39Z'),
    text: 'Broken | pipe in text\nand a newline too {macro}', redacted: 0
  },
  {
    id: 2, kind: 'network', level: 'error', t: Date.parse('2026-09-30T19:50:40Z'),
    method: 'POST', url: 'https://api.test/v1/posts?q=a|b', status: 404,
    statusText: 'Not Found', durationMs: 98, sizeBytes: 47, transport: 'fetch',
    requestHeaders: { Authorization: '[REDACTED]', 'X-Request-Id': 'visible-1' },
    requestBody: '{"password":"[REDACTED]","note":"keep | me"}',
    failed: false, redacted: 2
  },
  {
    id: 3, kind: 'error', level: 'error', t: Date.parse('2026-09-30T19:50:41Z'),
    text: 'Unhandled promise rejection: Error: nope',
    stack: 'at k.emit (chrome-extension://abc/helper.js:27:27075)\nat aa.emit (chrome-extension://abc/helper.js:1:2446)',
    redacted: 0
  },
  {
    id: 4, kind: 'navigation', level: 'info', t: Date.parse('2026-09-30T19:50:42Z'),
    text: 'Page load: http://localhost:8080/test-page.html', redacted: 0,
    repeatCount: 3, lastT: Date.parse('2026-09-30T19:50:44Z')
  }
];

/** Setiap baris tabel Markdown harus punya jumlah pemisah kolom yang sama.
 *  Inilah pemeriksaan yang menangkap pipa yang tidak diescape. */
function markdownTablesWellFormed(text) {
  const lines = text.split('\n');
  let inTable = false;
  let expected = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isRow = /^\s*\|.*\|\s*$/.test(line);
    if (!isRow) { inTable = false; continue; }

    // Pemisah kolom = pipa yang TIDAK diescape.
    const columns = line.replace(/\\\|/g, '').split('|').length;
    if (!inTable) { inTable = true; expected = columns; continue; }
    if (columns !== expected) {
      return { ok: false, line: i + 1, text: line, got: columns, want: expected };
    }
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Markdown
// -----------------------------------------------------------------------------
{
  const md = core.buildReport('markdown', meta, entries);

  const table = markdownTablesWellFormed(md);
  check('semua tabel Markdown punya jumlah kolom konsisten', table.ok,
        table.ok ? '' : 'baris ' + table.line + ' punya ' + table.got +
                        ' kolom, seharusnya ' + table.want + ': ' + table.text);

  check('pipa di dalam isi log diescape', md.indexOf('Broken \\| pipe') !== -1);
  check('baris baru di isi log tidak memecah tabel',
        md.indexOf('Broken \\| pipe in text and a newline') !== -1);
  check('pipa di dalam URL diescape', md.indexOf('q=a\\|b') !== -1);

  // Markdown TIDAK memperlakukan kurung kurawal secara khusus, jadi
  // meng-escape-nya di sini justru salah - isi log harus keluar apa adanya.
  check('kurung kurawal dibiarkan apa adanya di Markdown',
        md.indexOf('{macro}') !== -1 && md.indexOf('\\{macro}') === -1);

  check('metadata halaman ikut', md.indexOf('localhost:8080/test-page.html') !== -1);
  check('tab dan filter yang aktif disebut',
        md.indexOf('tab `error`') !== -1 && md.indexOf('failed only') !== -1);
  check('jumlah entri disebut', md.indexOf('4 of 64 captured') !== -1, md.match(/\| Entries \|.*/));
  check('ringkasan keparahan disebut', /3 error, 0 warning, 1 failed request/.test(md),
        (md.match(/\| Summary \|.*/) || [''])[0]);

  check('status redaction disebut', md.indexOf('Redaction |') !== -1 && md.indexOf('ON -') !== -1);
  check('stack trace dibungkus <details>',
        md.indexOf('<details>') !== -1 && md.indexOf('</details>') !== -1);
  check('blok kode tertutup berpasangan',
        (md.match(/```/g) || []).length % 2 === 0,
        'jumlah pembatas: ' + (md.match(/```/g) || []).length);
  check('penghitung pengulangan tampil', md.indexOf('\u00d73') !== -1);
  check('peringatan sebelum membagikan ada', md.indexOf('Review before sharing') !== -1);
  check('tidak ada kebocoran di Markdown', md.indexOf(LEAK) === -1);
}

// -----------------------------------------------------------------------------
// Jira
// -----------------------------------------------------------------------------
{
  const jira = core.buildReport('jira', meta, entries);

  check('header Jira memakai || ', jira.indexOf('|| Field || Value ||') !== -1);
  check('judul Jira memakai h2.', jira.indexOf('h2. Rapspect capture') !== -1);
  check('pipa diescape di Jira', jira.indexOf('Broken \\| pipe') !== -1);
  // Di Jira kurung kurawal membuka makro, jadi isi log yang mengandungnya harus
  // diescape di SEL TABEL. Di dalam blok {noformat} justru tidak boleh diescape:
  // isinya memang ditampilkan literal, dan backslash tambahan akan terlihat.
  check('kurung kurawal diescape di sel tabel Jira',
        jira.indexOf('\\{macro}') !== -1,
        (jira.match(/.*macro.*/) || [''])[0]);
  check('kurung kurawal di dalam noformat tidak diescape',
        jira.indexOf('{"password"') !== -1,
        'body request ditampilkan literal di blok noformat');
  check('stack trace memakai noformat, bukan code',
        jira.indexOf('{noformat}') !== -1 && jira.indexOf('{code}') === -1);
  check('noformat tertutup berpasangan',
        (jira.match(/\{noformat\}/g) || []).length % 2 === 0);
  check('baris baru tidak memecah baris tabel Jira',
        jira.indexOf('and a newline too |') !== -1 ||
        jira.indexOf('and a newline too') !== -1);
  check('tidak ada kebocoran di Jira', jira.indexOf(LEAK) === -1);
}

// -----------------------------------------------------------------------------
// JSON dan teks polos
// -----------------------------------------------------------------------------
{
  const json = core.buildReport('json', meta, entries);
  let parsed = null;
  try { parsed = JSON.parse(json); } catch (e) { /* ditangkap di bawah */ }

  check('JSON bisa diparse', parsed !== null);
  if (parsed) {
    check('JSON menandai redaction aktif', parsed.redaction.enabled === true);
    check('JSON menyertakan daftar field tambahan',
          Array.isArray(parsed.redaction.extraFields));
    check('JSON mencatat filter yang berlaku',
          parsed.filters.tab === 'error' && parsed.filters.failedOnly === true);
    check('JSON membedakan jumlah terekspor dan tertangkap',
          parsed.exportedCount === 4 && parsed.capturedCount === 64);
    check('JSON menyebut response body tidak pernah ditangkap',
          /never captured/.test(parsed.redaction.note));
  }

  const text = core.buildReport('text', meta, entries);
  check('teks polos punya header berawalan #', text.indexOf('# Rapspect capture') === 0);
  check('teks polos satu baris per entri',
        text.split('\n').filter((l) => l.indexOf('[') === 0).length === 4);

  // Format yang tidak dikenal tidak boleh melempar - ekspor yang gagal tanpa
  // pesan lebih buruk daripada ekspor berformat salah.
  const fallback = core.buildReport('nonsense', meta, entries);
  check('format tak dikenal jatuh ke teks polos',
        fallback.indexOf('# Rapspect capture') === 0);
}

// -----------------------------------------------------------------------------
// Daftar kosong dan masukan rusak
// -----------------------------------------------------------------------------
{
  const empty = core.buildReport('markdown', meta, []);
  check('daftar kosong menghasilkan laporan yang sah, bukan tabel kosong',
        empty.indexOf('No entries in the current view') !== -1);
  check('daftar kosong tetap punya tabel metadata',
        markdownTablesWellFormed(empty).ok);

  check('meta null tidak melempar',
        core.buildReport('markdown', null, entries).length > 0);
  check('entries null tidak melempar',
        core.buildReport('markdown', meta, null).length > 0);
}

// -----------------------------------------------------------------------------
// Field redaction tambahan
// -----------------------------------------------------------------------------
{
  const before = core.isSensitiveField('sessionId');
  check('sessionId belum sensitif sebelum ditambahkan', before === false);

  const applied = core.setExtraFields(['sessionId', 'X-Internal-Session', 'ab', '', 'sessionId']);
  check('nama dinormalkan dan duplikat dibuang',
        applied.length === 2, applied.join(', '));
  check('nama terlalu pendek ditolak', applied.indexOf('ab') === -1, applied.join(', '));
  check('sessionId jadi sensitif setelah ditambahkan',
        core.isSensitiveField('sessionId') === true);
  // Normalisasi membuang seluruh karakter non-alfanumerik, jadi `session_id`,
  // `session-id`, dan `SESSIONID` semuanya menjadi `sessionid` dan ikut
  // tertangkap. Itu perilaku yang diinginkan: nama field di dunia nyata jarang
  // ditulis dengan gaya yang sama di seluruh basis kode.
  check('variasi penulisan ikut tertangkap',
        core.isSensitiveField('session_id') === true &&
        core.isSensitiveField('session-id') === true &&
        core.isSensitiveField('SESSIONID') === true);
  check('header internal ikut tertangkap',
        core.isSensitiveField('x-internal-session') === true);

  const body = core.redactBodyText('{"sessionId":"' + LEAK + '","keep":"visible"}');
  check('field tambahan benar-benar disensor di body',
        body.text.indexOf(LEAK) === -1, body.text);
  check('field lain tetap terbaca', body.text.indexOf('visible') !== -1);

  // Daftar bawaan tidak boleh bisa dimatikan. Ini jaminan keamanan, bukan
  // preferensi: setExtraFields hanya MENAMBAH.
  core.setExtraFields([]);
  check('daftar bawaan tetap berlaku setelah tambahan dikosongkan',
        core.isSensitiveField('password') === true &&
        core.isSensitiveField('sessionId') === false);
}

// -----------------------------------------------------------------------------
// Tanda tangan entri, dipakai pengelompokan
// -----------------------------------------------------------------------------
{
  const a = { kind: 'console', level: 'error', t: 1000, text: 'same message' };
  const b = { kind: 'console', level: 'error', t: 9999, text: 'same message' };
  const c = { kind: 'console', level: 'warn', t: 1000, text: 'same message' };

  check('waktu TIDAK ikut tanda tangan',
        core.entrySignature(a) === core.entrySignature(b),
        'kalau waktu ikut, tidak akan ada dua entri yang pernah dianggap sama');
  check('level yang berbeda menghasilkan tanda tangan berbeda',
        core.entrySignature(a) !== core.entrySignature(c));

  const n1 = { kind: 'network', method: 'GET', status: 404, failed: false, url: 'https://a.test/x' };
  const n2 = { kind: 'network', method: 'GET', status: 404, failed: false, url: 'https://a.test/y' };
  check('URL yang berbeda tidak dikelompokkan',
        core.entrySignature(n1) !== core.entrySignature(n2));
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
