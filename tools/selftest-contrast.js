/* =============================================================================
 * Rapspect - audit kontras warna
 *
 * ALAT BANTU UJI, BUKAN BAGIAN DARI EXTENSION.
 *
 * KENAPA ADA
 * docs/DECISIONS.md bagian 1.5 menyatakan: kalau nilai token di README bagian 6
 * nanti diperbarui dari file sumber vektor, audit kontras HARUS diulang. Kalau
 * audit itu hanya hidup sebagai tabel di dokumen, tidak ada yang akan
 * mengulanginya. File ini membuatnya bisa dijalankan ulang dalam satu detik.
 *
 * Rumus: WCAG 2.1 relative luminance dan contrast ratio.
 * Ambang: 4.5:1 untuk teks (README bagian 6 aturan 3).
 *
 * Setiap warna semantik diuji terhadap SEMUA latar yang mungkin berada di
 * bawahnya, termasuk baris zebra - warna yang hanya lolos di satu latar tetap
 * dihitung gagal, karena posisi baris tidak bisa diprediksi.
 *
 * CARA PAKAI (dari folder proyek):
 *   node tools/selftest-contrast.js
 * Exit code 0 kalau semua lolos, 1 kalau ada yang gagal.
 * ========================================================================== */
'use strict';

const THRESHOLD = 4.5;

function channel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

const fmt = (n) => n.toFixed(2) + ':1';

/* Nilai di bawah harus SAMA dengan blok token di src/panel/panel.css.
   Kalau salah satu diubah, ubah juga di sini - itu memang titik gesekannya,
   dan lebih baik terasa daripada audit jadi bohong. */
const themes = [
  {
    name: 'dark',
    backgrounds: { '--rp-bg': '#101C2E', '--rp-surface': '#16293F', '--rp-surface-alt': '#1D3352' },
    colors: {
      '--rp-text': '#FAF0DC',
      '--rp-text-muted': '#A8BACD',
      '--rp-error': '#FF6B5E',
      '--rp-warn': '#FFD21E',
      '--rp-info': '#3FBFC7',
      '--rp-success': '#4FC98A',
      '--rp-debug': '#7EA8DB'
    }
  },
  {
    name: 'light',
    backgrounds: { '--rp-bg': '#F0F3F7', '--rp-surface': '#FFFFFF', '--rp-surface-alt': '#F7F9FB' },
    colors: {
      '--rp-text': '#16293F',
      '--rp-text-muted': '#5A6B7F',
      '--rp-error': '#B3261E',
      '--rp-warn': '#8A6100',
      '--rp-info': '#0B6C74',
      '--rp-success': '#1A7A4D',
      '--rp-debug': '#3F5A80'
    }
  }
];

/* Pemeriksaan kedua yang bukan soal kontras: DUA TOKEN BERBEDA TIDAK BOLEH
   BERWARNA SAMA. Kontras 4.5:1 bisa lolos sempurna sementara UI-nya tetap tidak
   bisa dipakai - itu yang terjadi waktu --rp-debug light disetel persis sama
   dengan --rp-text-muted: chip filter Debug yang aktif jadi tidak bisa
   dibedakan dari chip yang mati. Jarak minimum 25 dipilih karena di bawah itu
   perbedaannya tidak terbaca pada titik penanda berukuran 8px. */
const MIN_TOKEN_DISTANCE = 25;

function rgbDistance(a, b) {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const d = parseInt(pa.substr(i * 2, 2), 16) - parseInt(pb.substr(i * 2, 2), 16);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/* Nilai asli README bagian 6 untuk light mode. Diperiksa terpisah untuk
   MEMBUKTIKAN temuan di docs/DECISIONS.md 1.3: nilai-nilai ini gagal ambang,
   termasuk #B58600 yang README sebut sebagai perbaikan. */
const readmeLight = {
  '--rp-error': '#D32F27',
  '--rp-warn': '#B58600',
  '--rp-info': '#0E7C85',
  '--rp-success': '#1E8E5A'
};

let failures = 0;

themes.forEach((theme) => {
  console.log('');
  console.log('=== tema ' + theme.name + ' (ambang ' + THRESHOLD + ':1) ===');
  Object.keys(theme.colors).forEach((token) => {
    const fg = theme.colors[token];
    const parts = [];
    let worst = Infinity;
    Object.keys(theme.backgrounds).forEach((bgToken) => {
      const r = ratio(fg, theme.backgrounds[bgToken]);
      if (r < worst) worst = r;
      parts.push(bgToken + ' ' + fmt(r));
    });
    const ok = worst >= THRESHOLD;
    if (!ok) failures++;
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + token.padEnd(16) + fg + '  ' + parts.join('  |  '));
  });
});

themes.forEach((theme) => {
  console.log('');
  console.log('=== tema ' + theme.name + ': token harus bisa dibedakan satu sama lain ===');
  // Pasangan yang diperiksa adalah yang benar-benar pernah bertabrakan atau
  // berisiko bertabrakan di UI, bukan seluruh kombinasi. Memeriksa semua
  // pasangan akan menghasilkan kegagalan palsu untuk warna yang memang tidak
  // pernah muncul bersebelahan.
  const pairs = [
    ['--rp-debug', '--rp-text-muted'],   // chip Debug aktif vs chip mati
    ['--rp-debug', '--rp-info'],         // dua-duanya kebiruan
    ['--rp-debug', '--rp-text'],         // Debug vs level Log
    ['--rp-error', '--rp-warn'],
    ['--rp-info', '--rp-success']
  ];
  pairs.forEach(([a, b]) => {
    const d = rgbDistance(theme.colors[a], theme.colors[b]);
    const ok = d >= MIN_TOKEN_DISTANCE;
    if (!ok) failures++;
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + a + ' vs ' + b +
                '  jarak ' + d.toFixed(0) + ' (minimum ' + MIN_TOKEN_DISTANCE + ')');
  });
});

console.log('');
console.log('=== nilai asli README bagian 6 untuk light mode (bukti temuan) ===');
Object.keys(readmeLight).forEach((token) => {
  const fg = readmeLight[token];
  const parts = [];
  let worst = Infinity;
  Object.keys(themes[1].backgrounds).forEach((bgToken) => {
    const r = ratio(fg, themes[1].backgrounds[bgToken]);
    if (r < worst) worst = r;
    parts.push(bgToken + ' ' + fmt(r));
  });
  // Di sini GAGAL adalah hasil yang DIHARAPKAN. Kalau salah satu nilai README
  // ternyata lolos, berarti audit di docs/DECISIONS.md keliru dan harus
  // dikoreksi - itu yang dilaporkan baris di bawah.
  const expectedToFail = worst < THRESHOLD;
  if (!expectedToFail) {
    failures++;
    console.log('UNEXPECTED  ' + token + ' ' + fg + ' ternyata LOLOS (' + fmt(worst) +
                ') - koreksi docs/DECISIONS.md bagian 1.3');
  } else {
    console.log('confirmed failing  ' + token.padEnd(16) + fg + '  ' + parts.join('  |  '));
  }
});

console.log('');
console.log('=== kombinasi brand yang benar-benar dipakai ===');
[
  ['--rp-cream di atas --rp-navy', '#FAF0DC', '#1F3A5F'],
  ['--rp-navy-deep di atas --rp-sand', '#16293F', '#E8C68F'],
  ['--rp-yellow #FFD21E di atas putih (klaim README)', '#FFD21E', '#FFFFFF']
].forEach(([label, fg, bg]) => {
  const r = ratio(fg, bg);
  console.log((r >= THRESHOLD ? 'PASS' : 'note') + '  ' + label + ' = ' + fmt(r));
});

console.log('');
console.log(failures === 0
  ? 'Semua warna yang dipakai lolos ambang ' + THRESHOLD + ':1'
  : failures + ' masalah kontras ditemukan');
process.exit(failures ? 1 : 0);
