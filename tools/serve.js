/* =============================================================================
 * Rapspect - static file server untuk pengujian
 *
 * ALAT BANTU UJI, BUKAN BAGIAN DARI EXTENSION.
 * File ini tidak pernah dimuat Chrome dan tidak disebut di manifest.json.
 *
 * KENAPA PERLU ADA
 * `test-page.html` yang dibuka lewat `file://` punya origin opaque, sehingga
 * `fetch` ke `https://` diblokir CORS. Skenario "fetch berhasil" dan
 * "fetch 404" akan sama-sama tampil gagal, dan kamu tidak bisa membedakan bug
 * Rapspect dari batasan browser. Disajikan lewat http://localhost, keduanya
 * berjalan normal.
 *
 * KENAPA TIDAK PAKAI PAKET DARI NPM
 * Hanya modul bawaan Node yang dipakai: http, fs, path, url. Tidak ada
 * package.json, tidak ada npm install, tidak ada dependency untuk di-audit.
 *
 * CARA PAKAI (dari folder proyek):
 *   node tools/serve.js
 *   node tools/serve.js 3000        <- ganti port
 * Lalu buka http://localhost:8080/test-page.html
 * Hentikan dengan Ctrl+C.
 * ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2], 10) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Query string dibuang: `/test-page.html?x=1` harus tetap menunjuk file yang sama.
  let rawPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  if (rawPath === '/') rawPath = '/test-page.html';

  // Penjagaan path traversal. `path.normalize` menyelesaikan `..` lebih dulu,
  // lalu hasilnya diverifikasi masih berada di dalam ROOT. Tanpa pemeriksaan
  // kedua ini, `/../../Windows/System32` bisa keluar dari folder proyek -
  // server uji lokal tetap tidak boleh membocorkan isi disk.
  const target = path.normalize(path.join(ROOT, rawPath));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: path is outside the project folder\n');
    return;
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + rawPath + '\n');
      return;
    }
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      // Tanpa ini Chrome menyajikan versi cache setelah kamu mengubah file,
      // dan kamu akan menguji kode lama tanpa sadar.
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' sudah dipakai. Coba: node tools/serve.js 8081');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Hanya mengikat ke 127.0.0.1, bukan 0.0.0.0. Server ini menyajikan seluruh
// folder proyek tanpa autentikasi, jadi tidak boleh terbuka ke jaringan lokal.
server.listen(PORT, '127.0.0.1', () => {
  console.log('Rapspect test server');
  console.log('  root : ' + ROOT);
  console.log('  open : http://localhost:' + PORT + '/test-page.html');
  console.log('  stop : Ctrl+C');
});
