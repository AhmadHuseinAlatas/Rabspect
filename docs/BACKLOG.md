# Rapspect — Backlog

Catatan pekerjaan yang belum selesai, ditulis supaya tidak hilang saat pekerjaan
dilanjutkan di sesi lain.

Status: extension **bisa di-load unpacked dan berfungsi**, dan enam suite
pemeriksaan otomatis berjalan di CI. Masih ada **dua masalah yang diketahui**
(B-15 dan B-16 di bawah), dan satu batch pekerjaan **dihentikan di tengah jalan**
atas permintaan pemilik.

Terakhir diperbarui: 2026-09-30

---

## Batch yang dihentikan di tengah jalan

Batch ini berisi lima perbaikan ditambah dua fitur baru. Tiga di antaranya
selesai dan ter-commit, sisanya belum dimulai. **Tidak ada kode yang setengah
jadi**: pekerjaan berhenti tepat di antara dua commit, dan working tree bersih.

### Sudah selesai di batch ini

| Commit | Isi |
|---|---|
| `36eaf89` | Kejadian identik yang berurutan digabung **di buffer service worker**, bukan hanya di tampilan. Satu loop error kini memakai satu slot, jadi error lama yang biasanya penyebabnya tidak terdorong keluar. Hitungan di tab kini sama dengan jumlah baris yang tampil |
| `4f381f3` | Pembatas halaman (`PAGE`) selalu satu baris, dan tidak ada lagi pembatas untuk halaman yang tidak bisa dibaca seperti `chrome://newtab/` |
| `d3f2c35` | Error yang seluruh stack-nya milik extension lain diberi label `EXT`, plus pilihan **Hide other extensions**. Laporan tidak lagi menghitungnya sebagai error halaman |

Ketiganya lolos semua suite, tapi **belum pernah dicoba di Chrome**.

### B-13 — Badge jumlah error di ikon toolbar *(belum dimulai)*

Angka merah di ikon Rapspect saat tab yang aktif punya error, supaya terlihat
tanpa membuka apa pun.

Catatan untuk melanjutkan:

- Tambah `core.countPageErrors(list)`: jumlah **kejadian** (bukan baris) ber-level
  `error` sejak pembatas navigasi terakhir, **tidak termasuk** entri ber-`extId`.
  Tanpa pengecualian itu, badge ikut menghitung error extension lain — termasuk
  contoh yang pernah dikirim sebagai bug
- Di service worker: `chrome.action.setBadgeText({tabId, text})`,
  `setBadgeBackgroundColor`, `setBadgeTextColor`, dan `setTitle` berisi jumlahnya.
  Batasi tampilan `99+`. Tidak butuh izin baru
- Perbarui hanya saat angkanya berubah, bukan setiap batch masuk
- Reset saat navigasi, saat `Clear`, dan saat tab ditutup

**Temuan yang sudah diukur, jangan diulang:** badge tidak ikut tema panel, jadi
warnanya harus lolos di satu warna saja. Teks putih di atas:

| Latar badge | Kontras | Hasil |
|---|---|---|
| `#B3261E` (`--rp-error` light) | 6.54:1 | **pakai ini** |
| `#FF6B5E` (`--rp-error` dark) | 2.79:1 | gagal |
| `#EE3B33` (`--rp-red` brand) | 3.96:1 | gagal |

Konstanta warna di service worker harus sama dengan `--rp-error` light di
`panel.css`, dan `tools/selftest-structure.js` sebaiknya menegakkannya.

### B-14 — Penanda langkah (step marker) *(belum dimulai)*

Tombol untuk menyisipkan catatan seperti "Step 3: clicked Pay" ke timeline, supaya
laporan terbaca sebagai langkah reproduksi dengan error di antaranya.

Catatan untuk melanjutkan:

- **Keamanan, paling penting:** `'step'` **jangan** ditambahkan ke daftar `KINDS`
  yang dipakai `sanitizeEntry()`. Daftar itu juga menyaring entri dari halaman,
  jadi menambahkannya membuat halaman bisa memalsukan langkah. Entri langkah
  dibuat langsung di service worker, dan pesan `rp:step` hanya diterima kalau
  `sender.id === chrome.runtime.id` **dan** tidak ada `sender.tab` — popup dan
  side panel tidak punya tab, content script punya
- Nomor langkah otomatis per tab
- Tampil di semua lensa, tidak ikut hitungan tab maupun badge, tidak pernah
  digabung (`entrySignature` mengembalikan null), dan hanya pencarian yang bisa
  menyembunyikannya
- Laporan Markdown dan Jira menampilkannya sebagai baris langkah
- **Manual saja.** Merekam klik secara otomatis berarti merekam apa yang diklik
  pengguna, dan itu melampaui apa yang dijanjikan `SECURITY.md`

### B-15 — Aksesibilitas tablist belum lengkap *(masalah yang diketahui)*

Tombol panah sudah bekerja, tapi pola ARIA-nya belum lengkap:

- ketujuh tab adalah tujuh perhentian tombol Tab. Seharusnya hanya tab yang
  terpilih (`tabindex="0"`, lainnya `"-1"`, diperbarui di `switchScope` dan
  `loadPrefs`)
- tidak ada `id` per tab, `aria-controls`, maupun pembungkus `role="tabpanel"`
  dengan `aria-labelledby` yang menunjuk tab terpilih, jadi screen reader tidak
  diberi tahu daftar mana yang dikendalikan tab

### B-16 — Kegagalan penyimpanan tidak terlihat *(masalah yang diketahui)*

Kalau `chrome.storage.session` penuh, `persistNow()` hanya menulis peringatan di
console service worker. Log berhenti bertahan saat service worker mati, tanpa tanda
apa pun di panel.

Catatan untuk melanjutkan: simpan status penyimpanan per tab saat gagal (ikut
`chrome.storage.session.getBytesInUse` dan `QUOTA_BYTES`), kirim ke panel lewat
pesan dan lewat respons `rp:snapshot`, lalu tampilkan pil peringatan di footer yang
menyebut jalan keluarnya: Clear, atau tutup tab yang tidak dipakai. Ini sekaligus
menjawab separuh B-12.

### B-17 — Dokumentasi yang tertinggal dari batch ini *(belum dikerjakan)*

Kode sudah berubah, dokumennya belum. Yang **salah** saat ini:

- `CHANGELOG.md` bagian *Unreleased* belum mencatat ketiga commit di atas. Entri
  pengelompokan di sana mengklaim pengelompokan tampilan melindungi buffer.
  Klaimnya kini benar, tapi karena `36eaf89`, bukan karena mekanisme yang
  dijelaskan di sana
- `docs/DECISIONS.md` bagian 2.6d memuat klaim yang sama
- `docs/TESTING.md` V-128 sudah tidak berlaku: mematikan **Group repeats** tidak
  lagi memecah kejadian berurutan, karena kejadian itu kini digabung saat
  ditangkap. V-129 juga: footer kini berbunyi
  `N shown (X events) / M captured (buffer 500)`
- Jumlah pemeriksaan yang disebut di dokumen sudah basi. Yang benar sekarang:
  redaction **47** (dokumen menulis 46), highlight **55** (dokumen menulis 39), dan
  suite keenam `selftest-ingest.js` (**50**) belum disebut sama sekali. Tempatnya:
  `docs/TESTING.md` 1.1, `CONTRIBUTING.md`, `SECURITY.md`,
  `docs/README-PROPOSAL.md`, `CHANGELOG.md`

Yang **belum ada**:

- langkah verifikasi di `docs/TESTING.md` untuk pembatas satu baris, tidak adanya
  pembatas `chrome://newtab/`, label `EXT`, **Hide other extensions**, durasi
  terlama pada request yang digabung, dan ringkasan laporan yang memisahkan error
  extension lain
- catatan keputusan ketiga commit di `docs/DECISIONS.md`. Alasannya sudah lengkap
  di pesan commit masing-masing, tinggal dipindahkan
- satu batas baru di `SECURITY.md`: atribusi ke extension lain adalah heuristik,
  dan halaman bisa memalsukan frame. Itu alasan baris `EXT` tetap tampil secara
  bawaan

### Urutan melanjutkan yang disarankan

1. **Coba di Chrome dulu.** Sejak versi tab, belum ada satu pun perubahan yang
   dijalankan di browser. Lima pemeriksaan tercepat: V-97, V-111, V-122 sampai
   V-124, V-120, dan V-89 di `docs/TESTING.md`. Tambahkan pembatas halaman dan
   label `EXT` dari batch ini
2. **B-17**, karena saat ini ada dokumen yang menjelaskan perilaku lama
3. **B-15** dan **B-16**, keduanya kecil dan keduanya masalah yang diketahui
4. **B-13**, lalu **B-14**

---

## Masih terbuka, menunggu keputusan atau file darimu

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
`tools/selftest-structure.js` memeriksa ini, jadi CI akan gagal kalau path itu
hilang.

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
rilisnya, tapi perlu B-17 lebih dulu supaya isinya sesuai kode.

### Keputusan produk yang masih terbuka

- **Copy as cURL** untuk baris network. Karena header disensor, perintahnya tidak
  bisa langsung dijalankan, dan itu harus tertulis di perintahnya sendiri
- **Screenshot di dalam extension.** Butuh izin `activeTab` dan di luar lingkup
  README. Tangkapan layar melewati redaction sepenuhnya, jadi butuh peringatannya
  sendiri
- **Chrome Web Store atau portofolio GitHub** (README bagian 12). Kalau Store,
  kebijakan privasi wajib ada walaupun data tidak pernah keluar dari komputer
- Kecil, tanpa izin baru: shortcut keyboard untuk membuka Rapspect, pilihan urutan
  terbaru di atas, sembunyikan request per host, dan penanda `SLOW` untuk request
  di atas satu detik

---

## Risiko yang perlu diukur, bukan ditebak

### B-12 — Jejak memori `chrome.storage.session`

`chrome.storage.session` punya anggaran sekitar 10 MB. Rapspect menyimpan sampai
500 entri per tab termasuk header dan body request, untuk maksimum 25 tab
terlacak.

Belum ada yang mengukur ukuran entri sebenarnya, jadi tidak diketahui apakah kita
di 5% atau 80% anggaran. Penggabungan kejadian identik di `36eaf89` mengurangi
tekanannya, tapi angka sebenarnya tetap belum ada.

Cara mengukurnya: di console service worker, jalankan
`chrome.storage.session.getBytesInUse(null).then(console.log)` setelah sesi
pengujian yang berat. Bagian "tidak terlihat di panel" dari risiko ini ada di
B-16.

---

## Selesai

Dicatat supaya tidak dikerjakan dua kali.

### Batch terakhir (dihentikan di tengah)

- Penggabungan kejadian identik di buffer (`36eaf89`), 33 pemeriksaan baru
- Pembatas halaman satu baris, tanpa pembatas untuk halaman terlarang (`4f381f3`)
- Label `EXT` dan **Hide other extensions** (`d3f2c35`), 17 pemeriksaan baru

### Ronde sebelumnya

- Ekspor Markdown dan Jira beserta tombol Copy di dialog export
- Pause yang membekukan tampilan tanpa menghentikan penangkapan
- Pengelompokan tampilan, salin satu baris, field redaction tambahan yang hanya
  bisa menambah, dan preferensi yang diingat
- **B-01** status "tidak ada yang cocok", **B-02** dokumentasi ikon, **B-03**
  keputusan `--rp-debug`, **B-06** `.gitignore`
- Penanganan gulir beserta tombol `jump to latest`, cache teks pencarian, dan
  ambang animasi yang dihitung dari seluruh entri
- Pewarnaan sintaks dengan dua hue di luar palet level
- CI GitHub Actions dan file infrastruktur repo

### Sebelumnya

- Lapisan penangkap: `console.*`, `fetch`, `XMLHttpRequest`, uncaught error,
  unhandled rejection, resource gagal muat
- Jembatan MAIN world → ISOLATED → service worker, termasuk penanganan context
  yang batal setelah reload extension
- Ring buffer 500 entri per tab, dicerminkan ke `chrome.storage.session`
- Redaction dua lapis, diperluas ke query string URL dan argumen objek `console.*`
- Popup toolbar dan side panel dari satu dokumen, tujuh tab dengan hitungan,
  search, filter request gagal, Clear, Copy as text, Export, toggle tema, tombol
  tutup
- Ikon 16/32/48/128 sebagai PNG sungguhan dengan alpha channel
- `test-page.html` dengan 14 skenario yang sengaja gagal

---

## Cara melanjutkan

```powershell
cd C:\Users\babaj\.kiro\crew\workspace\Rabspect
node tools/selftest-structure.js      # harus: 22 pemeriksaan, 0 gagal
node tools/selftest-redaction.js      # harus: 47 pemeriksaan, 0 gagal
node tools/selftest-contrast.js       # harus: semua warna lolos 4.5:1
node tools/selftest-highlight.js      # harus: 55 pemeriksaan, 0 gagal
node tools/selftest-report.js         # harus: 49 pemeriksaan, 0 gagal
node tools/selftest-ingest.js         # harus: 50 pemeriksaan, 0 gagal
node tools/serve.js                   # lalu buka http://localhost:8080/test-page.html
```

Mulai dari bagian **Urutan melanjutkan yang disarankan** di atas.
