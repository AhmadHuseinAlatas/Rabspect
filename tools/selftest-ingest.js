/* =============================================================================
 * Rapspect - pemeriksaan penggabungan kejadian identik
 *
 * ALAT BANTU UJI, BUKAN BAGIAN DARI EXTENSION.
 *
 * KENAPA ADA
 * Dokumentasi Rapspect pernah mengklaim bahwa pengelompokan entri berulang
 * "melindungi anggaran 500 entri". Kode di baliknya hanya mengubah tampilan;
 * service worker tetap menyimpan setiap kejadian, jadi 200 error identik tetap
 * mendorong 200 entri lama keluar dari buffer. Klaim itu tertulis di tiga tempat
 * tanpa satu pun pemeriksaan yang bisa membantahnya.
 *
 * File ini memeriksa klaim itu secara langsung, bersama dua hal yang sama
 * pentingnya:
 *
 *   1. Penggabungan tidak boleh MENYEMBUNYIKAN bukti. Pesan yang sama dari dua
 *      tempat berbeda di kode punya stack trace berbeda, dan keduanya harus tetap
 *      terlihat. Versi sebelumnya membandingkan teks pesan saja.
 *   2. Hitungan di tab harus sama dengan jumlah baris yang tampil. countRows()
 *      dan groupRows() dibandingkan pada ribuan deret acak.
 *
 * Bagian 7 memeriksa atribusi: entri mana yang dianggap berasal dari extension
 * lain. Masuk ke file ini karena atribusi juga terjadi saat entri masuk buffer,
 * di langkah yang sama dengan penggabungan.
 *
 * CARA PAKAI (dari folder proyek):
 *   node tools/selftest-ingest.js
 * Exit code 0 kalau semua lolos, 1 kalau ada yang gagal.
 * ========================================================================== */
'use strict';

require('../src/shared/rapspect-core.js');
const core = globalThis.__RAPSPECT_CORE__;

const results = [];

function check(name, ok, detail) {
  results.push({ ok: !!ok, name, detail: detail == null ? '' : String(detail) });
}

let nextT = 1000;

function consoleEntry(text, extra) {
  return Object.assign({ kind: 'console', level: 'error', t: nextT++, text: text, redacted: 0 }, extra || {});
}

function netEntry(extra) {
  return Object.assign({
    kind: 'network', level: 'error', t: nextT++, method: 'GET', url: 'https://api.test/x',
    status: 404, statusText: 'Not Found', failed: false, durationMs: 50, sizeBytes: 10,
    transport: 'fetch', requestHeaders: { Accept: 'application/json' }, redacted: 0
  }, extra || {});
}

function navEntry(url) {
  return { kind: 'navigation', level: 'info', t: nextT++, text: 'Page load: ' + url, redacted: 0 };
}

// -----------------------------------------------------------------------------
// 1. Klaim utama: kejadian berulang tidak menghabiskan buffer
// -----------------------------------------------------------------------------
{
  const list = [];
  core.ingest(list, consoleEntry('the original error that caused everything'), 500);
  for (let i = 0; i < 1000; i++) core.ingest(list, consoleEntry('noisy loop error'), 500);

  check('1000 kejadian identik memakai satu slot, bukan seribu', list.length === 2,
        'panjang buffer ' + list.length);
  check('error pertama tetap ada setelah loop 1000 kali',
        list[0].text === 'the original error that caused everything', list[0].text);
  check('hitungannya tepat 1000', list[1].repeatCount === 1000, list[1].repeatCount);
  check('waktu pertama dipertahankan, waktu terakhir dicatat',
        list[1].lastT > list[1].t, 't ' + list[1].t + ', lastT ' + list[1].lastT);
}

// Ring buffer tetap memangkas entri yang memang berbeda.
{
  const list = [];
  for (let i = 0; i < 600; i++) core.ingest(list, consoleEntry('distinct ' + i), 500);
  check('600 entri berbeda dipangkas ke 500', list.length === 500, list.length);
  check('yang terpangkas adalah yang paling lama', list[0].text === 'distinct 100', list[0].text);
}

// -----------------------------------------------------------------------------
// 2. Penggabungan tidak boleh menyembunyikan bukti
// -----------------------------------------------------------------------------
{
  const list = [];
  core.ingest(list, consoleEntry('Cannot read properties of undefined', { stack: 'at checkout (cart.js:10:5)' }));
  core.ingest(list, consoleEntry('Cannot read properties of undefined', { stack: 'at profile (user.js:88:2)' }));
  check('pesan sama dengan stack berbeda TIDAK digabung', list.length === 2,
        'dua lokasi kode yang berbeda harus tetap terlihat terpisah');
}

{
  const list = [];
  core.ingest(list, consoleEntry('A'));
  core.ingest(list, consoleEntry('B'));
  core.ingest(list, consoleEntry('A'));
  check('entri identik yang tidak berurutan TIDAK digabung', list.length === 3,
        'menggabungkannya akan memindahkan kejadian ke posisi yang salah dalam urutan waktu');
}

{
  const list = [];
  core.ingest(list, consoleEntry('same', { level: 'warn' }));
  core.ingest(list, consoleEntry('same', { level: 'error' }));
  check('level berbeda tidak digabung', list.length === 2);
}

{
  const list = [];
  core.ingest(list, consoleEntry('same', { frameId: 0 }));
  core.ingest(list, consoleEntry('same', { frameId: 3 }));
  check('frame berbeda tidak digabung', list.length === 2);
}

{
  const list = [];
  core.ingest(list, navEntry('http://localhost/'));
  core.ingest(list, navEntry('http://localhost/'));
  check('pembatas navigasi TIDAK PERNAH digabung', list.length === 2,
        'setiap muat halaman adalah batas urutan kejadian');
}

// Tabrakan pemisah. Isi log dikendalikan halaman, jadi teks yang sengaja berisi
// karakter pemisah tidak boleh bisa membuat dua entri berbeda tampak identik.
{
  const list = [];
  core.ingest(list, consoleEntry('a","b', { stack: '' }));
  core.ingest(list, consoleEntry('a', { stack: 'b' }));
  check('teks berisi karakter pemisah tidak bisa meniru entri lain', list.length === 2);

  const list2 = [];
  core.ingest(list2, consoleEntry('x|y', { stack: '' }));
  core.ingest(list2, consoleEntry('x', { stack: 'y' }));
  check('teks berisi pipa tidak bisa meniru entri lain', list2.length === 2);
}

// -----------------------------------------------------------------------------
// 3. Network
// -----------------------------------------------------------------------------
{
  const list = [];
  core.ingest(list, netEntry({ durationMs: 40 }));
  core.ingest(list, netEntry({ durationMs: 900 }));
  core.ingest(list, netEntry({ durationMs: 60 }));
  check('request identik dengan durasi berbeda digabung', list.length === 1, list.length);
  check('durasi kejadian pertama dipertahankan', list[0].durationMs === 40, list[0].durationMs);
  check('durasi TERBESAR dicatat, bukan rata-rata',
        list[0].maxDurationMs === 900, list[0].maxDurationMs);
}

{
  const list = [];
  core.ingest(list, netEntry({ status: 404 }));
  core.ingest(list, netEntry({ status: 500 }));
  check('status berbeda tidak digabung', list.length === 2);
}

{
  const list = [];
  core.ingest(list, netEntry({ method: 'POST', requestBody: '{"step":1}' }));
  core.ingest(list, netEntry({ method: 'POST', requestBody: '{"step":2}' }));
  check('body request berbeda tidak digabung', list.length === 2);
}

{
  const list = [];
  core.ingest(list, netEntry({ requestHeaders: { A: '1', B: '2' } }));
  core.ingest(list, netEntry({ requestHeaders: { B: '2', A: '1' } }));
  check('urutan header tidak memengaruhi identitas', list.length === 1);
}

{
  const list = [];
  core.ingest(list, netEntry({ requestHeaders: { A: '1' } }));
  core.ingest(list, netEntry({ requestHeaders: { A: '2' } }));
  check('nilai header berbeda tidak digabung', list.length === 2);
}

{
  const text = core.entryDetail(Object.assign(netEntry({ durationMs: 40 }),
                                              { repeatCount: 3, maxDurationMs: 900 }));
  check('blok detail menyebut request paling lambat',
        /900 ms \(slowest of 3\)/.test(text), text.split('\n')[3]);
}

// -----------------------------------------------------------------------------
// 4. Pengelompokan tampilan
// -----------------------------------------------------------------------------
{
  const a1 = Object.assign(consoleEntry('A'), { id: 1, repeatCount: 5 });
  const a2 = Object.assign(consoleEntry('A'), { id: 2, repeatCount: 3 });
  const rows = core.groupRows([a1, a2]);

  check('hitungan dua lapis DIJUMLAHKAN: x5 + x3 = x8',
        rows.length === 1 && rows[0].repeatCount === 8,
        rows.length + ' baris, hitungan ' + (rows[0] && rows[0].repeatCount));
  check('groupRows tidak mengubah entri aslinya',
        a1.repeatCount === 5 && a2.repeatCount === 3,
        'a1 ' + a1.repeatCount + ', a2 ' + a2.repeatCount);
  check('baris hasil gabungan memakai id entri pertama', rows[0].id === 1, rows[0].id);
}

{
  const rows = core.groupRows([navEntry('http://a/'), navEntry('http://a/')]);
  check('groupRows juga tidak pernah menggabung navigasi', rows.length === 2);
}

{
  const x = consoleEntry('same', { stack: 'at one (a.js:1:1)' });
  const y = consoleEntry('same', { stack: 'at two (b.js:2:2)' });
  check('groupRows tidak menggabung stack yang berbeda', core.groupRows([x, y]).length === 2,
        'versi sebelumnya membandingkan teks saja dan menyembunyikan stack kedua');
}

{
  check('entri tanpa repeatCount dihitung satu kejadian', core.occurrencesOf(consoleEntry('x')) === 1);
  check('entri berpenghitung dihitung sesuai hitungannya',
        core.occurrencesOf(Object.assign(consoleEntry('x'), { repeatCount: 7 })) === 7);
}

// -----------------------------------------------------------------------------
// 5. Hitungan tab harus sama dengan jumlah baris
// -----------------------------------------------------------------------------
{
  // PRNG deterministik supaya kegagalan bisa diulang persis.
  let seed = 20260930;
  function random() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  const pool = [
    () => consoleEntry('alpha'),
    () => consoleEntry('alpha', { stack: 'at other (x.js:1:1)' }),
    () => consoleEntry('beta'),
    () => consoleEntry('beta', { level: 'warn' }),
    () => netEntry(),
    () => netEntry({ status: 500 }),
    () => navEntry('http://localhost/')
  ];

  let mismatch = null;
  for (let run = 0; run < 2000 && !mismatch; run++) {
    const length = Math.floor(random() * 30);
    const list = [];
    for (let i = 0; i < length; i++) {
      const entry = pool[Math.floor(random() * pool.length)]();
      if (random() < 0.3) entry.repeatCount = 1 + Math.floor(random() * 5);
      list.push(entry);
    }
    const rows = core.groupRows(list).length;
    const counted = core.countRows(list);
    if (rows !== counted) mismatch = 'run ' + run + ': groupRows ' + rows + ', countRows ' + counted;
  }
  check('countRows sama dengan groupRows pada 2000 deret acak', !mismatch, mismatch);
}

// -----------------------------------------------------------------------------
// 6. Laporan menghitung kejadian, bukan baris
// -----------------------------------------------------------------------------
{
  const looping = Object.assign(consoleEntry('loop'), { id: 1, repeatCount: 200 });
  const md = core.buildReport('markdown', { total: 1, max: 500 }, [looping]);
  check('ringkasan laporan menghitung 200 kejadian, bukan 1 baris',
        /200 error, 0 warning/.test(md), (md.match(/\| Summary \|.*/) || [''])[0]);
}

// -----------------------------------------------------------------------------
// 7. Atribusi: error milik extension lain
// -----------------------------------------------------------------------------
// Aturannya sengaja sempit. Label yang salah lebih merusak daripada label yang
// tidak ada, karena label itu yang menentukan apakah developer menanggapi
// sebuah bug report atau menutupnya.
{
  const OWN = 'rapspectownidrapspectownidabcdef';
  const OTHER = 'ljdobmomdgdljniojadhoplhkpialdid';
  const THIRD = 'aaaabbbbccccddddeeeeffffgggghhhh';

  // Kasus nyata: stack trace yang pernah dikirim sebagai contoh bug. Unhandled
  // rejection menyimpan stack Error-nya di dalam teks pesan, bukan di `stack`.
  const real = {
    kind: 'error', level: 'error',
    text: 'Unhandled promise rejection: Error: Method not found: "object.extension.inIncognitoContext.toJSON"\n' +
          'Error: Method not found: "object.extension.inIncognitoContext.toJSON"\n' +
          '    at k.<anonymous> (chrome-extension://' + OTHER + '/common/remote-object-helper-content.js:27:27075)\n' +
          '    at k.emit (chrome-extension://' + OTHER + '/common/remote-object-helper-content.js:1:2446)\n' +
          '    at aa.emit (chrome-extension://' + OTHER + '/common/remote-object-helper-content.js:27:12679)'
  };
  check('contoh nyata dikenali sebagai extension lain',
        core.foreignExtensionId(real, OWN) === OTHER, core.foreignExtensionId(real, OWN));

  // Frame milik Rapspect sendiri tidak pernah dihitung sebagai "extension lain".
  check('frame milik Rapspect sendiri tidak membuat entri dianggap asing',
        core.foreignExtensionId(real, OTHER) === null,
        'kalau id-nya milik Rapspect, tidak ada frame asing yang tersisa');

  // Error extension lain yang melewati pembungkus fetch Rapspect: frame Rapspect
  // diabaikan, jadi atribusinya tetap benar.
  const throughOurWrapper = {
    kind: 'error', level: 'error', text: 'Unhandled promise rejection: TypeError: Failed to fetch',
    stack: '    at window.fetch (chrome-extension://' + OWN + '/src/content/capture-main.js:320:14)\n' +
           '    at poll (chrome-extension://' + OTHER + '/inject.js:5:9)'
  };
  check('frame Rapspect diabaikan, frame asing tetap dikenali',
        core.foreignExtensionId(throughOurWrapper, OWN) === OTHER);

  // Satu saja frame halaman berarti halaman ikut terlibat.
  const mixed = {
    kind: 'console', level: 'error', text: 'boom',
    stack: '    at wrapped (chrome-extension://' + OTHER + '/hook.js:1:1)\n' +
           '    at checkout (https://shop.test/app.js:88:12)'
  };
  check('campuran frame halaman dan extension TIDAK dilabeli',
        core.foreignExtensionId(mixed, OWN) === null);

  const pageOnly = {
    kind: 'console', level: 'error', text: 'boom',
    stack: '    at checkout (https://shop.test/app.js:88:12)'
  };
  check('frame halaman saja tidak dilabeli', core.foreignExtensionId(pageOnly, OWN) === null);

  // URL extension yang hanya DISEBUT di pesan, bukan di baris frame.
  const mentioned = {
    kind: 'console', level: 'error',
    text: 'Denying load of chrome-extension://' + OTHER + '/icon.html. Resources must be listed.'
  };
  check('URL extension yang hanya disebut di pesan tidak dilabeli',
        core.foreignExtensionId(mentioned, OWN) === null);

  check('entri tanpa frame tidak bisa diatribusikan',
        core.foreignExtensionId({ kind: 'console', level: 'log', text: 'hello' }, OWN) === null);

  const anonymous = {
    kind: 'error', level: 'error', text: 'x',
    stack: '    at new Promise (<anonymous>)\n' +
           '    at run (chrome-extension://' + OTHER + '/a.js:2:3)\n' +
           '    at Array.forEach (<anonymous>)'
  };
  check('frame tanpa lokasi diabaikan', core.foreignExtensionId(anonymous, OWN) === OTHER);

  // Dua extension lain: yang dilaporkan adalah frame paling atas, tempat
  // error-nya dilempar.
  const twoOthers = {
    kind: 'error', level: 'error', text: 'x',
    stack: '    at top (chrome-extension://' + THIRD + '/t.js:1:1)\n' +
           '    at below (chrome-extension://' + OTHER + '/b.js:1:1)'
  };
  check('dari dua extension lain, frame paling atas yang dipakai',
        core.foreignExtensionId(twoOthers, OWN) === THIRD);

  // Frame halaman di dalam eval tetap frame halaman.
  const evalFrame = {
    kind: 'error', level: 'error', text: 'x',
    stack: '    at eval (eval at <anonymous> (https://shop.test/app.js:1:1), <anonymous>:1:1)\n' +
           '    at run (chrome-extension://' + OTHER + '/a.js:2:3)'
  };
  check('frame eval milik halaman tetap dihitung frame halaman',
        core.foreignExtensionId(evalFrame, OWN) === null);

  check('entri null tidak melempar', core.foreignExtensionId(null, OWN) === null);

  // Label ikut di baris datar yang disalin ke tiket.
  const labelled = Object.assign({ t: 1000, extId: OTHER }, real);
  check('baris datar menyebut asalnya',
        core.entryToLine(labelled).indexOf('ERROR (other extension)') !== -1,
        core.entryToLine(labelled).slice(0, 60));

  check('blok detail menunjuk halaman chrome://extensions untuk id itu',
        core.entryDetail(labelled).indexOf('chrome://extensions/?id=' + OTHER) !== -1);

  // Ringkasan laporan tidak menghitung error extension lain sebagai error halaman.
  const pageError = Object.assign(consoleEntry('real page bug'), { id: 1 });
  const foreignError = Object.assign(consoleEntry('not ours'), { id: 2, extId: OTHER, repeatCount: 3 });
  const md = core.buildReport('markdown', { total: 2, max: 500 }, [pageError, foreignError]);
  check('ringkasan hanya menghitung error halaman',
        /\| Summary \| 1 error, 0 warning, 0 failed request; plus 3 from other browser extensions, not counted \|/.test(md),
        (md.match(/\| Summary \|.*/) || [''])[0]);
  check('tabel laporan melabeli barisnya',
        md.indexOf('`ERROR` _other extension_') !== -1);

  const jira = core.buildReport('jira', { total: 2, max: 500 }, [pageError, foreignError]);
  check('laporan Jira juga melabeli barisnya', jira.indexOf('ERROR (other extension)') !== -1);

  // Halaman tidak bisa menandai error-nya sendiri sebagai milik extension lain
  // dengan mengirim extId langsung.
  const forgedExt = core.sanitizeEntry({ kind: 'console', level: 'error', text: 'mine', extId: OTHER });
  check('extId palsu dari halaman dibuang', forgedExt.extId === undefined);
}

// -----------------------------------------------------------------------------
// 8. Halaman tidak bisa memalsukan hitungan
// -----------------------------------------------------------------------------
{
  // Entri dari halaman melewati sanitizeEntry di service worker. Kalau
  // repeatCount ikut lolos, halaman bisa menulis "x1000000" di laporan QA.
  const forged = core.sanitizeEntry({
    kind: 'console', level: 'error', text: 'forged', repeatCount: 999999,
    lastT: 1, maxDurationMs: 99999
  });
  check('repeatCount palsu dari halaman dibuang', forged.repeatCount === undefined, forged.repeatCount);
  check('lastT palsu dari halaman dibuang', forged.lastT === undefined);
  check('maxDurationMs palsu dari halaman dibuang', forged.maxDurationMs === undefined);
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
