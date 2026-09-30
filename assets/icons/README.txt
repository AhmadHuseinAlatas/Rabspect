Rapspect - folder ikon extension
================================

ISI SEKARANG
------------

  icon16.png    16x16    dipakai di toolbar Chrome
  icon32.png    32x32
  icon48.png    48x48    dipakai juga sebagai logo di header side panel
  icon128.png   128x128  dipakai di halaman chrome://extensions

Keempatnya PNG sungguhan dengan alpha channel (Format32bppArgb), dan sudah
dirujuk oleh manifest.json pada blok "icons" dan "action.default_icon".

JANGAN hapus salah satu di antaranya. Manifest yang menunjuk file ikon yang
tidak ada membuat Chrome menolak extension SEPENUHNYA dengan pesan
"Could not load icon" - bukan sekadar menampilkan ikon kosong.


CARA FILE INI DIBUAT
--------------------

Dibuat dari file logo sumber oleh:

  powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1

Jalankan ulang perintah itu setiap kali file logo sumber diperbarui. Skripnya
hanya memakai System.Drawing yang sudah ada di Windows, tidak ada yang perlu
diinstal.

Dua masalah yang diselesaikan skrip itu, keduanya dicatat di README.MD bagian 9:

1. File sumber berformat JPEG, jadi tidak punya alpha channel. Mengganti
   ekstensinya menjadi .png tidak mengubah apa pun - isinya tetap JPEG.
2. Kotak-kotak abu-abu di dalam lingkaran badge adalah PIKSEL ASLI, bukan
   transparansi. Dipakai langsung, ikon extension benar-benar berlatar papan
   catur. Skrip menggantinya dengan warna solid --rp-cream.

Ikut dihasilkan assets/branding/logo-badge-512.png: versi bersih dari logo yang
seharusnya menggantikan JPEG sebagai aset sumber raster.


YANG MASIH PERLU DESAINER
-------------------------

Keempat file di atas adalah hasil PENGECILAN satu gambar, bukan PENYEDERHANAAN
PROGRESIF yang diminta README.MD bagian 9. Akibatnya terlihat di 16x16: wajah
ontanya jadi gumpalan pucat, hanya cincin navy-nya yang masih terbaca.

Yang belum ada:

  icon16.png    perlu digambar ulang dari vektor: bentuk paling sederhana yang
                masih terbaca sebagai onta, tanpa tassel, tanpa gigi
  icon32.png    perlu digambar ulang: kepala onta, outline disederhanakan
  logo-master.svg   tidak bisa diturunkan dari raster, perlu file vektor asli

Ukuran 48 dan 128 sudah memadai apa adanya.

Begitu file baru tersedia, cukup timpa file di folder ini dengan nama yang sama.
manifest.json tidak perlu diubah.

Catatan pembuatan yang lebih lengkap ada di docs/DECISIONS.md bagian 3.3 dan 3.4.
