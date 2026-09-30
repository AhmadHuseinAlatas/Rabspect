# Usulan perubahan README.MD — menunggu persetujuanmu

Dokumen ini **bukan** README baru. Ini usulan perubahan, ditulis terpisah karena
instruksimu jelas: `README.MD` adalah satu-satunya sumber kebenaran dan tidak
boleh saya ubah atau timpa.

Saya tidak mengusulkan menulis ulang README. Isi bagian 1 sampai 14 adalah brief
desain yang masih berlaku, dan seluruh dokumen lain merujuknya dengan nomor
bagian ("README bagian 6", "README bagian 11"). Menggeser isinya akan memutus
puluhan rujukan itu.

Yang diusulkan hanya **dua** perubahan.

---

## Perubahan 1: satu baris yang salah, dan ini yang paling merusak

Baris ke-13 `README.MD` saat ini:

```
**Status:** Design Phase — belum ada kode. Dokumen ini adalah brief desain dan
spesifikasi aset.
```

Itu tidak lagi benar. Ada extension Manifest V3 yang berjalan penuh di repo ini:
capture console dan network, redaction dua lapis, popup dan side panel, 68 file,
dan empat pemeriksaan otomatis yang berjalan di CI.

Ini hal pertama yang dibaca pengunjung setelah judul. Selama masih berbunyi
"belum ada kode", repo ini terbaca sebagai proyek yang ditinggalkan di tahap
dokumen — berapa pun bagusnya kode di dalamnya.

**Ganti dengan:**

```
**Status:** v1.0.0 — extension berjalan. Dokumen ini tetap menjadi brief desain
dan sumber kebenaran; di mana kode menyimpang darinya, alasannya dicatat di
[docs/DECISIONS.md](docs/DECISIONS.md).
```

Kalimat kedua penting: itu yang menjaga peran README sebagai sumber kebenaran
sekaligus mengakui bahwa ada penyimpangan yang terdokumentasi — empat warna light
mode, `--rp-debug`, dan keputusan tempat UI.

---

## Perubahan 2: blok pembuka untuk halaman GitHub

Disisipkan **setelah** baris status, **sebelum** `## 1. Deskripsi`. Tidak ada satu
bagian pun yang dihapus atau dinomori ulang.

Isinya menjawab tiga pertanyaan yang ditanyakan setiap pengunjung repo dalam
sepuluh detik pertama: apakah ini hidup, apa yang dilakukannya, dan bagaimana
saya menjalankannya.

````markdown
<p align="center">
  <a href="https://github.com/AhmadHuseinAlatas/Rabspect/actions/workflows/checks.yml">
    <img alt="checks" src="https://github.com/AhmadHuseinAlatas/Rabspect/actions/workflows/checks.yml/badge.svg">
  </a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-1F3A5F">
  <img alt="Chrome 116+" src="https://img.shields.io/badge/Chrome-116%2B-1F3A5F">
  <img alt="dependencies: none" src="https://img.shields.io/badge/dependencies-none-1A7A4D">
  <img alt="build step: none" src="https://img.shields.io/badge/build%20step-none-1A7A4D">
</p>

---

## Sekilas

Chrome extension (Manifest V3) yang menampilkan **console log dan network request
dalam satu panel**, tanpa perlu membuka DevTools. Dibuat dari sudut pandang QA
engineer yang menguji manual setiap hari: yang disorot default hanya yang penting
— `error`, `warn`, dan request dengan status `>= 400` — dan ekspor satu klik siap
ditempel ke bug report.

**Tanpa dependency. Tanpa build step. Tanpa `npm install`.** Vanilla JavaScript,
HTML, dan CSS yang dimuat langsung sebagai unpacked folder.

### Coba dalam satu menit

```bash
git clone https://github.com/AhmadHuseinAlatas/Rabspect.git
cd Rabspect
node tools/serve.js
```

Lalu di Chrome: `chrome://extensions` → nyalakan **Developer mode** →
**Load unpacked** → pilih folder yang berisi `manifest.json`. Klik ikon Rapspect
di toolbar, lalu buka `http://localhost:8080/test-page.html` dan reload.

Panduan lengkap: **[docs/TESTING.md](docs/TESTING.md)**

### Yang dilakukan

| | |
|---|---|
| **Console** | `log` `info` `warn` `error` `debug`, uncaught error, unhandled promise rejection, resource gagal muat |
| **Network** | `fetch()` dan `XMLHttpRequest`: method, URL, status, durasi, ukuran, header request |
| **Filter** | tujuh tab per level dan network, masing-masing dengan hitungan, plus filter khusus request gagal |
| **Ekspor** | Copy as text dan Export JSON, keduanya sudah diredaksi |
| **Keamanan** | redaction dua lapis, selalu aktif, diverifikasi 46 assertion |

### Yang sengaja TIDAK dilakukan

Batasnya disebut di muka, karena batas yang disembunyikan akan terbaca sebagai
bug. Alasan lengkap di [docs/DECISIONS.md](docs/DECISIONS.md) bagian 6.

- **Response body tidak dibaca.** Membacanya berarti mengonsumsi stream dan
  merusak halaman yang sedang diuji.
- **Hanya `fetch` dan XHR yang tertangkap.** Stylesheet, gambar, script, dan font
  dimuat browser sendiri dan tidak pernah melewati keduanya — itu sebabnya
  DevTools Network menampilkan jauh lebih banyak baris.
- **Tidak memakai `chrome.debugger`.** Izin itu memunculkan banner "sedang
  di-debug" dan bentrok dengan DevTools. Ditunda ke v2.
- **Tidak ada penyimpanan lintas sesi.** Buffer hilang saat Chrome ditutup, dan
  itu memang disengaja untuk data yang bisa mengandung rahasia.

### Dokumentasi

| Dokumen | Isi |
|---|---|
| **[docs/TESTING.md](docs/TESTING.md)** | Load unpacked, membaca log service worker, 95 langkah verifikasi manual, troubleshooting |
| **[docs/DECISIONS.md](docs/DECISIONS.md)** | Jejak audit: audit kontras, arsitektur yang ditolak dan alasannya, batasan MV3, pembenaran tiap izin |
| **[SECURITY.md](SECURITY.md)** | Apa yang ditangkap, apa yang tidak, dan cara melaporkan kebocoran redaction |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Cara menjalankan, empat pemeriksaan wajib, tiga aturan khusus proyek ini |
| **[CHANGELOG.md](CHANGELOG.md)** | Riwayat versi dan masalah yang masih diketahui |
| **[docs/BACKLOG.md](docs/BACKLOG.md)** | Pekerjaan yang masih terbuka |

### Cara kerjanya

```
halaman web
  │  console.log / fetch / XHR / uncaught error
  ▼
capture-main.js         world MAIN, document_start
  │  content script biasa TIDAK bisa melihat console halaman -
  │  world-nya terpisah. MAIN world satu-satunya jalan tanpa chrome.debugger.
  │  redaction dijalankan DI SINI, sebelum data meninggalkan halaman
  ▼  window.postMessage
bridge-isolated.js      world ISOLATED
  │  MAIN world tidak punya akses chrome.*; isolated world punya.
  │  dikirim per batch 120 ms, bukan satu per satu
  ▼  chrome.runtime.sendMessage
service-worker.js
  │  sanitasi entri sebagai data tidak dipercaya, redaction dijalankan ulang
  │  ring buffer 500 per tab, dicerminkan ke chrome.storage.session
  ▼  karena MV3 mematikan service worker saat idle
panel.html              popup toolbar dan side panel
```
````

---

## Cara menerapkannya

Kalau kamu setuju, kamu bisa mengeditnya sendiri — dua sisipan di atas — atau
bilang **"terapkan usulan README"** dan saya kerjakan. Saya tidak melakukannya
sekarang karena kamu melarang saya menyentuh file itu, dan saya tidak akan
melanggarnya diam-diam.

## Dua hal yang masih perlu kamu putuskan

**Lisensi.** `README.MD` bagian 12 masih menandai ini sebagai open question
("Lisensi repo (MIT?)"). GitHub menampilkan peringatan "No license" di sidebar
repo, dan tanpa lisensi secara hukum tidak ada yang boleh memakai kodenya. Kalau
kamu setuju MIT, bilang saja dan saya buat file `LICENSE`-nya. Saya tidak memilih
sendiri karena lisensi adalah keputusan pemilik, bukan keputusan teknis.

**Deskripsi dan topics repo.** Keduanya tidak bisa saya ubah dari sini — perlu
GitHub CLI atau API, dan `gh` tidak terpasang di mesin ini. Buka
`https://github.com/AhmadHuseinAlatas/Rabspect` → ikon gerigi di sebelah **About**
di kanan atas, lalu tempel:

*Description:*

```
Chrome extension (Manifest V3) that shows console logs and network requests in one readable panel. No dependencies, no build step.
```

*Topics:*

```
chrome-extension  manifest-v3  devtools  qa-tools  debugging  javascript  vanilla-js  side-panel  logging
```

*Website:* biarkan kosong sampai ada halaman Chrome Web Store.

Sekalian: **Releases** masih kosong. Menandai `v1.0.0` membuat repo terlihat punya
versi yang dirilis, bukan hanya deretan commit. `CHANGELOG.md` sudah menyiapkan
isi catatan rilisnya.

## Satu hal yang masih membuat root repo terlihat berantakan

Tiga file berisi byte yang **identik**, ketiganya JPEG:

```
Rapspect.jpg              di root
assets/Rapspect.jpeg
assets/Rapspect.jpg       dipertahankan karena banner README menunjuk path ini
```

Git menyimpan blob identik satu kali, jadi ukuran repo tidak membengkak — tapi
folder root proyek yang profesional tidak menampilkan file gambar tergeletak di
sana. Penghapusan saya serahkan ke kamu, sesuai instruksi bahwa saya tidak boleh
menghapus apa pun. Yang perlu dipertahankan hanya `assets/Rapspect.jpg`, karena
README menunjuknya, dan `assets/branding/logo-badge-512.png` sebagai sumber
raster yang sudah bersih.
