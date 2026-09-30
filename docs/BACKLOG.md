# Rapspect — Backlog

Catatan pekerjaan yang belum selesai, ditulis supaya tidak hilang saat pekerjaan
dilanjutkan di sesi lain.

Status: extension **bisa di-load unpacked dan berfungsi**, dan empat pemeriksaan
otomatis berjalan di CI. Tidak ada lagi bug yang diketahui.

Terakhir diperbarui: 2026-09-30

---

## Masih terbuka

Semua sisa di bawah **tidak bisa saya selesaikan sendiri**. Tiga butuh
keputusanmu, satu butuh desainer, satu butuh file yang hanya kamu punya.

### B-04 — Rapikan aset logo yang menumpuk *(butuh keputusanmu)*

Tiga file berisi **byte yang identik**, ketiganya JPEG:

```
Rapspect.jpg              di root
assets/Rapspect.jpeg      hasil penamaan ulang olehmu
assets/Rapspect.jpg       saya buat ulang supaya banner README tidak broken
```

Git menyimpan blob identik hanya sekali, jadi ukuran repo tidak membengkak. Yang
mengganggu working tree-nya: tiga nama untuk satu gambar, dan satu file gambar
tergeletak di root proyek.

Batasannya: `README.MD` menunjuk `assets/Rapspect.jpg`, jadi **path itu harus
tetap ada** — kalau dihapus, banner di GitHub kembali broken.
`tools/selftest-structure.js` sekarang memeriksa ini, jadi CI akan gagal kalau
path itu hilang.

Saran: pertahankan `assets/Rapspect.jpg` dan `assets/branding/logo-badge-512.png`,
hapus dua sisanya. Penghapusan saya serahkan ke kamu.

### B-05 — Ikon 16px dan 32px perlu digambar ulang *(butuh desainer)*

Keempat PNG sekarang hasil **pengecilan** satu gambar, bukan penyederhanaan
progresif yang diminta README bagian 9. Di 16x16 wajah ontanya jadi gumpalan
pucat; hanya cincin navy-nya yang terbaca.

Yang dibutuhkan: varian 16 dan 32 digambar dari vektor, tanpa tassel dan tanpa
gigi, sesuai tabel tingkat detail README bagian 9. Ukuran 48 dan 128 sudah
memadai. README bagian 9 juga masih meminta `logo-master.svg`, yang tidak bisa
diturunkan dari raster.

Membuat ulang dari sumber baru:

```powershell
powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1 -Source assets\Rapspect.jpeg
```

### B-07 — Bahasa dokumentasi *(butuh keputusanmu)*

`README.MD` bagian 10 menetapkan **dokumentasi Bahasa Indonesia** dan label UI
Bahasa Inggris. Yang berlaku sekarang: `docs/*.md` Bahasa Indonesia, sedangkan
label UI panel, file infrastruktur repo (`CONTRIBUTING.md`, `SECURITY.md`,
template issue), dan pesan commit berbahasa Inggris.

Kalau seluruh dokumentasi mau dipindah ke Bahasa Inggris, `README.MD` bagian 10
harus dikoreksi lebih dulu — README sumber kebenaran dan saya tidak mengubahnya.

### B-08 — Usulan perubahan README *(butuh keputusanmu)*

Baris ke-13 `README.MD` masih berbunyi **"Status: Design Phase — belum ada
kode."** Itu tidak benar, dan itu hal pertama yang dibaca pengunjung repo.

Dua usulan perubahan — memperbaiki baris status, dan menyisipkan blok pembuka di
atas bagian 1 tanpa menomori ulang apa pun — lengkap dengan teksnya ada di
[`docs/README-PROPOSAL.md`](README-PROPOSAL.md).

Di dokumen yang sama juga ada: teks deskripsi dan topics repo yang perlu ditempel
manual lewat ikon gerigi di panel **About** GitHub, karena keduanya butuh GitHub
API dan `gh` tidak terpasang di mesin ini.

### B-09 — Lisensi *(butuh keputusanmu)*

`README.MD` bagian 12 masih menandai ini sebagai open question ("Lisensi repo
(MIT?)"). GitHub menampilkan peringatan "No license" di sidebar, dan tanpa lisensi
secara hukum tidak ada yang boleh memakai kodenya.

Kalau MIT cocok, bilang saja dan saya buat file `LICENSE`-nya. Saya tidak memilih
sendiri karena lisensi keputusan pemilik, bukan keputusan teknis.

### B-10 — Screenshot *(butuh file darimu)*

Tidak ada satu pun screenshot di repo. Untuk alat yang seluruh gunanya visual, itu
lubang nyata: pengunjung tidak punya gambaran seperti apa panelnya tanpa
meng-clone dulu.

Kamu sudah punya screenshot yang bagus dari pengujian. Yang dibutuhkan: simpan ke
`assets/store/` lalu rujuk dari README. Saya tidak bisa mengambil gambar dari
percakapan menjadi file.

Yang paling berguna, urut prioritas: panel dengan log terisi di dark mode, popup
toolbar, tab Network, dan satu perbandingan dark/light.

### B-11 — Rilis v1.0.0 *(butuh keputusanmu)*

Halaman **Releases** masih kosong, jadi repo terbaca sebagai deretan commit
ketimbang sesuatu yang berversi. `CHANGELOG.md` sudah menyiapkan isi catatan
rilisnya.

---

## Risiko yang perlu diukur, bukan ditebak

### B-12 — Jejak memori `chrome.storage.session`

`chrome.storage.session` punya anggaran sekitar 10 MB. Rapspect menyimpan sampai
500 entri per tab termasuk header dan body request, untuk maksimum 25 tab
terlacak.

`persistNow()` menangkap kegagalan kuota dan menulis peringatan, artinya sistemnya
**merosot diam-diam**: buffer di memori tetap benar, tapi ketahanan terhadap
service worker yang mati hilang tanpa tanda apa pun di UI.

Belum ada yang mengukur ukuran entri sebenarnya, jadi tidak diketahui apakah kita
di 5% atau 80% anggaran. Angkanya layak dimiliki sebelum jadi masalah.

Cara mengukurnya: di console service worker, jalankan
`chrome.storage.session.getBytesInUse(null).then(console.log)` setelah sesi
pengujian yang berat.

---

## Selesai

Dicatat supaya tidak dikerjakan dua kali.

### Ronde terakhir

- **B-01 status "tidak ada yang cocok"** — `render()` membedakan empat keadaan,
  menyebut filter yang aktif satu per satu, dan menyediakan `Reset filters`
- **B-02 dokumentasi ikon** — tiga dokumen tidak lagi menulis ikon belum ada
- **B-03 keputusan `--rp-debug`** — masuk `docs/DECISIONS.md` bagian 1.6
- **B-06 `.gitignore`** — ditambahkan, termasuk pola `rapspect-*.json`
- **Tiga bug dari review** — penanganan gulir beserta tombol `jump to latest`,
  cache teks pencarian per id, dan ambang animasi yang dihitung dari seluruh entri
- **Pewarnaan sintaks** — dua hue baru terpisah dari palet level, ditegakkan
  `selftest-contrast.js` terhadap setiap warna semantik
- **CI** — GitHub Actions menjalankan empat suite pada setiap push. Run pertama
  hijau dalam 13 detik
- **File infrastruktur repo** — `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`,
  template issue dan pull request, `.gitattributes`, `dependabot.yml`

### Sebelumnya

- Lapisan penangkap: `console.*`, `fetch`, `XMLHttpRequest`, uncaught error,
  unhandled rejection, resource gagal muat
- Jembatan MAIN world → ISOLATED → service worker, termasuk penanganan context
  yang batal setelah reload extension
- Ring buffer 500 entri per tab, dicerminkan ke `chrome.storage.session`
- Redaction dua lapis, diperluas ke query string URL dan argumen objek `console.*`
- Popup toolbar dan side panel dari satu dokumen, tujuh tab dengan hitungan,
  search, filter request gagal, Clear, Copy as text, Export JSON, toggle tema,
  tombol tutup
- Ikon 16/32/48/128 sebagai PNG sungguhan dengan alpha channel
- `test-page.html` dengan 14 skenario yang sengaja gagal
- `docs/TESTING.md`: 109 langkah verifikasi manual dan troubleshooting

---

## Cara melanjutkan

```powershell
cd C:\Users\babaj\.kiro\crew\workspace\Rabspect
node tools/selftest-structure.js      # harus: 22 pemeriksaan, 0 gagal
node tools/selftest-redaction.js      # harus: 46 pemeriksaan, 0 gagal
node tools/selftest-contrast.js       # harus: semua warna lolos 4.5:1
node tools/selftest-highlight.js      # harus: 39 pemeriksaan, 0 gagal
node tools/serve.js                   # lalu buka http://localhost:8080/test-page.html
```

Tidak ada item yang tertunda di tengah jalan, dan tidak ada bug yang diketahui.
Semua sisa menunggu keputusanmu, desainer, atau file screenshot.
