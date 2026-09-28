/* =============================================================================
 * Rapspect - bridge (ISOLATED world)
 *
 * TUGAS FILE INI
 * Satu-satunya pekerjaan: memindahkan entri dari MAIN world ke service worker.
 * Tidak menambal apa pun, tidak menyentuh DOM, tidak menyimpan apa pun.
 *
 * KENAPA PERLU FILE TERPISAH
 * `capture-main.js` berjalan di MAIN world supaya bisa menambal console dan
 * fetch milik halaman. Harganya: di MAIN world `chrome.runtime` TIDAK ADA, jadi
 * file itu tidak punya jalan untuk bicara dengan extension-nya sendiri.
 * File ini berjalan di isolated world, yang punya `chrome.runtime` tapi TIDAK
 * bisa melihat console halaman. Dua world, dua kemampuan yang saling melengkapi,
 * dan `window.postMessage` adalah satu-satunya jembatan yang tersedia di antara
 * keduanya tanpa menyentuh DOM halaman.
 * ========================================================================== */
(function () {
  'use strict';

  var CHANNEL = 'rapspect:v1';

  // Kirim per batch, bukan per entri. Halaman yang berisik bisa memanggil
  // console.log ratusan kali dalam sekejap; satu sendMessage per log akan
  // membangunkan service worker terus-menerus dan membuat halaman terasa berat.
  var FLUSH_MS = 120;

  // Batas antrean lokal. Kalau service worker sedang bangun atau sedang sibuk,
  // antrean tidak boleh tumbuh tanpa batas sampai memakan memori tab.
  var MAX_QUEUE = 1000;

  var queue = [];
  var timer = null;
  var alive = true;
  var dropped = 0;

  /** Cek apakah context extension masih hidup.
   *
   *  Setelah extension di-reload atau di-disable, content script yang sudah
   *  tersuntik tetap hidup di halaman sebagai "zombi": kodenya jalan, tapi
   *  `chrome.runtime.id` hilang dan setiap `sendMessage` melempar
   *  "Extension context invalidated". Mengakses `chrome.runtime.id` sendiri
   *  bisa melempar, jadi harus di dalam try. */
  function contextAlive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
    catch (e) { return false; }
  }

  /** Berhenti total, dan beri tahu MAIN world supaya ikut berhenti.
   *  Tanpa pemberitahuan itu, tambalan di MAIN world akan terus men-serialize
   *  dan mem-postMessage selama tab dibuka, untuk data yang tidak ada
   *  penerimanya. */
  function stop() {
    if (!alive) return;
    alive = false;
    queue.length = 0;
    if (timer) { clearTimeout(timer); timer = null; }
    try { window.postMessage({ __rapspect: CHANNEL, control: 'stop' }, '*'); } catch (e) {}
  }

  function schedule() {
    if (timer || !alive) return;
    timer = setTimeout(flush, FLUSH_MS);
  }

  function flush() {
    timer = null;
    if (!alive || !queue.length) return;

    if (!contextAlive()) { stop(); return; }

    var batch = queue.splice(0, queue.length);
    try {
      // Callback disertakan supaya `chrome.runtime.lastError` terbaca dan tidak
      // muncul sebagai "Unchecked runtime.lastError" di console service worker.
      // Tidak adanya penerima adalah keadaan NORMAL di sini: service worker
      // yang baru bangun sesekali menolak pesan pertama.
      chrome.runtime.sendMessage(
        { type: 'rp:entries', entries: batch, dropped: dropped },
        function () {
          if (chrome.runtime.lastError) {
            // Diabaikan dengan sengaja. Entri yang gagal terkirim tidak
            // di-retry: menahannya berarti menumpuk memori di tab yang sedang
            // diuji, dan log yang datang terlambat lebih membingungkan
            // daripada log yang hilang.
            return;
          }
        }
      );
      dropped = 0;
    } catch (e) {
      // sendMessage melempar sinkron hanya kalau context sudah mati.
      stop();
    }
  }

  window.addEventListener('message', function (ev) {
    if (!alive) return;

    // Saring tiga hal, berurutan dari yang paling murah:
    // (1) ev.source harus window ini sendiri. Tanpa ini, pesan dari iframe lain
    //     atau dari window pembuka bisa ikut masuk dan tercatat di tab yang salah.
    if (ev.source !== window) return;

    var data = ev.data;
    // (2) harus punya penanda channel kita, termasuk versinya. Setelah reload
    //     extension, content script versi lama masih bisa hidup di tab lain.
    if (!data || data.__rapspect !== CHANNEL) return;

    // (3) pesan kontrol (misalnya 'stop') dikirim OLEH file ini, jadi harus
    //     diabaikan di sini - kalau tidak, kita memproses gema kita sendiri.
    if (!data.entry || typeof data.entry !== 'object') return;

    if (queue.length >= MAX_QUEUE) {
      // Buang yang paling lama, pertahankan yang paling baru. Untuk QA, log
      // terbaru hampir selalu lebih relevan daripada log satu menit lalu.
      queue.shift();
      dropped++;
    }
    queue.push(data.entry);
    schedule();
  }, false);

  // Saat tab ditutup atau pindah halaman, kirim sisa antrean segera. Tanpa ini,
  // error terakhir sebelum redirect - yang justru paling sering jadi penyebab
  // bug - hilang karena timer 120 ms tidak pernah kesampaian.
  window.addEventListener('pagehide', function () {
    if (timer) { clearTimeout(timer); timer = null; }
    flush();
  }, false);
})();
