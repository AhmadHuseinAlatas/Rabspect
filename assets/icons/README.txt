Rapspect - folder ikon extension
================================

Folder ini MASIH KOSONG dan itu disengaja.

Empat file berikut harus disiapkan manual (spesifikasi lengkap ada di
README.MD bagian 9, tabel "Ikon extension"):

  icon16.png    16x16    bentuk paling sederhana yang masih terbaca sebagai onta,
                         tanpa tassel, tanpa gigi
  icon32.png    32x32    kepala onta, outline disederhanakan
  icon48.png    48x48    kepala terbaca, tassel mulai muncul
  icon128.png   128x128  logo penuh apa adanya

Kenapa belum ada:

1. assets/Rapspect.jpg tidak bisa dipakai. Kotak-kotak abu-abu di dalam badge
   itu piksel asli, bukan transparansi - JPG tidak punya alpha channel, jadi
   pola papan catur ikut ter-render permanen. Kalau dipakai langsung, ikon
   extension benar-benar berlatar papan catur. (README.MD bagian 9)

2. Empat ukuran di atas bukan satu gambar yang diperkecil, tapi empat gambar
   dengan tingkat detail berbeda. Wajah onta lengkap dengan mata, gigi, dan
   tassel jadi gumpalan tak terbaca di 16x16.

3. Tidak ada PNG placeholder yang dibuat di sini dengan sengaja. Placeholder
   abu-abu gampang lupa diganti, lalu ikut terbit ke Chrome Web Store.

Sampai keempat file ada, manifest.json TIDAK menyebut ikon sama sekali.
Alasannya: manifest yang menunjuk file ikon yang tidak ada membuat load unpacked
GAGAL TOTAL dengan pesan "Could not load icon". Chrome akan menampilkan ikon
puzzle generik di toolbar, dan extension tetap berfungsi penuh.

Blok JSON yang harus ditempel setelah keempat PNG tersedia ada di
docs/DECISIONS.md bagian 3.3.
