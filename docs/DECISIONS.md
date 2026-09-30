# Rapspect — Decision Log (jejak audit)

Dokumen ini adalah **jejak audit**, bukan ringkasan fitur. Setiap keputusan
ditulis beserta alasannya, opsi yang ditolak, dan konsekuensinya.

Sumber kebenaran: `README.MD`. Kalau dokumen ini bertentangan dengan `README.MD`,
`README.MD` yang menang dan dokumen ini yang salah.

- Tanggal: 2026-09-29
- Target versi: v1.0 (lihat roadmap README bagian 13)
- `README.MD` tidak diubah sama sekali.

---

## 0. Temuan yang perlu keputusan kamu

Empat hal di bawah ini tidak bisa saya selesaikan sendiri tanpa menabrak sesuatu.
Saya ambil keputusan sementara agar v1 bisa jalan, tapi semuanya perlu kamu
konfirmasi.

| # | Temuan | Keputusan sementara |
|---|---|---|
| T1 | Nama folder proyek `Rabspect`, sedangkan README menyebut `Rapspect` dan struktur folder di bagian 9 memakai `rapspect/` | Kode ditulis di folder yang ada (`Rabspect`). Nama produk di manifest tetap `Rapspect` sesuai README. Rename folder saya serahkan ke kamu |
| T2 | README bagian 6 menyatakan `#B58600` adalah perbaikan untuk kuning di light mode. Hasil hitung: `#B58600` **masih gagal** 4.5:1 (rasio 2.96:1 di `--rp-bg`) | Dipakai `#8A6100`. Detail di bagian 1 |
| T3 | Empty state: kamu menulis `No tracks yet -- reload...` (dua tanda hubung), README bagian 10 menulis `No tracks yet — reload...` (em dash) | Dipakai versi README (em dash), karena README adalah sumber kebenaran |
| T4 | ~~Ikon `icon16/32/48/128.png` belum ada~~ **SELESAI.** Awalnya manifest dikirim tanpa blok `icons` karena menunjuk file yang tidak ada membuat load unpacked gagal total dengan `Could not load icon` | Keempat PNG sekarang dibuat dari file logo sumber oleh `tools/make-icons.ps1`, dan blok `icons` serta `default_icon` sudah terpasang di `manifest.json`. Detail di bagian 3.3. Sisa pekerjaan desain dicatat di bagian 3.4 |

Tambahan yang saya lakukan **di luar** daftar eksplisit README, supaya kamu tahu
dan bisa menolak:

- Redaction diperluas ke **query string URL** dan ke **argumen objek `console.*`**,
  tidak hanya header dan body. Alasan di bagian 5.3.
- `assets/Rapspect.jpg` dibuat sebagai **salinan** dari `Rapspect.jpg` di root,
  supaya banner di README (`<img src="assets/Rapspect.jpg">`) tidak broken. File
  asli tidak dihapus dan tidak dipindah.
- `tools/serve.js` ditambahkan: static file server memakai **modul bawaan Node
  saja**, tanpa dependency. Alasan di bagian 7.2 (halaman `file://` tidak bisa
  melakukan fetch lintas origin, jadi sebagian skenario uji tidak bisa dites dari
  `file://`).
- `tools/selftest-redaction.js` dan `tools/selftest-contrast.js` ditambahkan:
  dua pemeriksaan mekanis, modul bawaan Node saja, tidak ada dependency dan
  tidak ada test framework. Alasan di bagian 7.6.
- `tools/make-icons.ps1` ditambahkan: mengubah file logo JPEG menjadi empat PNG
  ikon dengan alpha channel, sekaligus membuang papan catur di dalam badge.
  Hanya memakai `System.Drawing` yang sudah ada di Windows. Alasan di bagian 3.3.
- `assets/Rapspect.jpg` dibuat ulang sebagai salinan dari `assets/Rapspect.jpeg`,
  karena banner di `README.MD` menunjuk path `.jpg` dan README tidak boleh saya
  ubah. Git menyimpan blob identik satu kali, jadi ukuran repo tidak bertambah.

---

## 1. Audit kontras warna (README bagian 6)

### 1.1 Cara mengukur

Rasio dihitung dengan rumus WCAG 2.1: relative luminance per kanal
(`c/12.92` kalau `c <= 0.03928`, selain itu `((c+0.055)/1.055)^2.4`), lalu
`L = 0.2126R + 0.7152G + 0.0722B`, lalu `(Lterang+0.05)/(Lgelap+0.05)`.

Ambang yang dipakai: **4.5:1** untuk teks, sesuai aturan wajib README bagian 6
nomor 3. Semua warna semantik diuji terhadap **dua** latar, karena daftar log
memakai zebra striping: baris ganjil `--rp-surface`/`--rp-bg`, baris genap
`--rp-surface-alt`. Warna yang hanya lolos di satu latar tetap dihitung gagal,
karena posisi baris tidak bisa diprediksi.

### 1.2 Dark mode — semua lolos, tidak ada yang diganti

Latar: `--rp-bg #101C2E` dan `--rp-surface-alt #1D3352` (baris zebra).

| Token | Nilai | vs `--rp-bg` | vs `--rp-surface-alt` | Status |
|---|---|---|---|---|
| `--rp-text` | `#FAF0DC` | 15.12:1 | 11.27:1 | lolos |
| `--rp-text-muted` | `#A8BACD` | 8.61:1 | 6.42:1 | lolos |
| `--rp-error` | `#FF6B5E` | 6.12:1 | **4.56:1** | lolos, margin tipis |
| `--rp-warn` | `#FFD21E` | 11.80:1 | 8.80:1 | lolos |
| `--rp-info` | `#3FBFC7` | 7.73:1 | 5.76:1 | lolos |
| `--rp-success` | `#4FC98A` | 8.19:1 | 6.10:1 | lolos |
| `--rp-debug` | `#9AA8BC` | 7.09:1 | 5.28:1 | lolos |

Catatan `--rp-error` di dark mode: 4.56:1 hanya 0.06 di atas ambang. Itu lolos,
jadi saya **tidak mengubahnya** — mengubah nilai yang sudah lolos berarti
mengarang. Tapi kalau nanti `--rp-surface-alt` dicerahkan sedikit saja, warna ini
langsung jatuh di bawah 4.5:1. Kalau kamu mau margin lebih lega,
`--rp-error: #FF8578` memberi 5.39:1 di zebra dan 7.23:1 di `--rp-bg`. Keputusan
ini saya tinggalkan untuk kamu.

### 1.3 Light mode — empat token gagal, satu token hilang

Latar: `--rp-bg #F0F3F7`, `--rp-surface #FFFFFF`, `--rp-surface-alt #F7F9FB`.

| Token | Nilai README | vs `--rp-bg` | vs `#FFFFFF` | vs `--rp-surface-alt` | Status |
|---|---|---|---|---|---|
| `--rp-text` | `#16293F` | 13.26:1 | 14.76:1 | 13.99:1 | lolos |
| `--rp-text-muted` | `#5A6B7F` | 4.91:1 | 5.46:1 | 5.18:1 | lolos |
| `--rp-error` | `#D32F27` | **4.49:1** | 4.99:1 | 4.73:1 | **GAGAL** di `--rp-bg` |
| `--rp-warn` | `#B58600` | **2.96:1** | **3.29:1** | **3.12:1** | **GAGAL** di semua latar |
| `--rp-info` | `#0E7C85` | **4.45:1** | 4.95:1 | 4.69:1 | **GAGAL** di `--rp-bg` |
| `--rp-success` | `#1E8E5A` | **3.72:1** | **4.14:1** | **3.92:1** | **GAGAL** di semua latar |
| `--rp-debug` | — | — | — | — | **TIDAK ADA** di blok light |

Dua hal yang penting dari tabel ini:

`--rp-error #D32F27` dan `--rp-info #0E7C85` gagal **tipis** dan hanya di
`--rp-bg`. Mudah terlewat kalau diuji cuma di atas putih, karena di atas putih
keduanya lolos. Ini persis alasan README bagian 6 menulis "verifikasi sebelum
implementasi".

`--rp-warn #B58600` adalah masalah yang lebih serius, karena README
memperkenalkannya **sebagai perbaikan**: "kuning tassel TIDAK terbaca di latar
putih... di light mode wajib diperdalam ke `#B58600`". Arah perbaikannya benar
(`#FFD21E` di atas putih hanya 1.45:1, jadi memang parah), tapi nilai
penggantinya belum cukup dalam. `#B58600` masih 3.29:1 di atas putih. README
bagian 6 perlu dikoreksi; saya tidak menyentuhnya karena dilarang.

### 1.4 Warna pengganti yang dipakai di kode

Semua nilai di bawah ini sudah saya hitung ulang dan lolos 4.5:1 di **ketiga**
latar light mode. Hue dipertahankan supaya aturan "satu warna, satu makna"
(README bagian 6 nomor 2) tidak rusak: merah tetap merah, kuning tetap kuning
keemasan, teal tetap teal.

| Token | README | Dipakai | vs `--rp-bg` | vs `#FFFFFF` | vs `--rp-surface-alt` |
|---|---|---|---|---|---|
| `--rp-error` | `#D32F27` | **`#B3261E`** | 5.87:1 | 6.54:1 | 6.19:1 |
| `--rp-warn` | `#B58600` | **`#8A6100`** | 4.98:1 | 5.54:1 | 5.25:1 |
| `--rp-info` | `#0E7C85` | **`#0B6C74`** | 5.53:1 | 6.16:1 | 5.83:1 |
| `--rp-success` | `#1E8E5A` | **`#1A7A4D`** | 4.80:1 | 5.34:1 | 5.06:1 |
| `--rp-debug` | (tidak ada) | **`#5A6B7F`** | 4.91:1 | 5.46:1 | 5.18:1 |

`--rp-debug` light saya set sama dengan `--rp-text-muted`, karena level `debug`
memang bermakna "kurang penting" dan README tidak menyediakan warna untuk itu.
Ini kesimpulan paling dekat dengan maksud README, bukan warna baru.

Nilai asli README **tetap saya tulis di file CSS sebagai komentar** di sebelah
nilai yang dipakai, supaya audit bisa dilakukan tanpa membuka dokumen ini.

### 1.5 Batas audit ini

- Yang diuji hanya kontras **teks terhadap latar**. Kontras elemen non-teks
  (batas input, focus ring) punya ambang 3:1 yang terpisah.
- `--rp-border #2C4A70` di atas `--rp-surface #16293F` hanya 1.63:1. Untuk garis
  pemisah antar panel itu tidak masalah, tapi **tidak cukup** sebagai satu-satunya
  penanda batas sebuah kontrol. Karena itu input dan tombol di panel memakai
  `--rp-text-muted` untuk bordernya, bukan `--rp-border`.
- Warna brand (`--rp-navy`, `--rp-sand`, `--rp-cream`, `--rp-brown`) tidak diaudit
  sebagai warna teks dalam daftar log, karena README bagian 6 aturan 1 melarang
  pemakaiannya sebagai penanda makna di sana. Yang saya periksa hanya satu
  kombinasi yang benar-benar dipakai: `--rp-cream` di atas `--rp-navy` untuk
  header dan tombol utama = 10.15:1, lolos.
- Angka di atas dihitung dari nilai hex di README, yang oleh README sendiri
  disebut "perkiraan yang diambil dari file JPG". Kalau nanti nilai brand
  diperbarui dari file sumber vektor, **audit ini harus diulang**.

### 1.6 Kontras lolos, UI tetap rusak: kasus `--rp-debug`

Temuan ini muncul **setelah** audit di bagian 1.2 sampai 1.4 selesai, dari
pengujian nyata di Chrome, bukan dari perhitungan. Layak ditulis panjang karena
pelajarannya bukan tentang satu warna.

**Gejalanya.** Di panel, chip filter `Debug` yang sedang **aktif** terlihat sama
seperti chip yang sudah dimatikan. Tidak ada cara tahu apakah level debug sedang
ditampilkan atau tidak.

**Dua sebab yang menumpuk.**

Pertama, `--rp-debug` di dark mode bernilai `#9AA8BC`, sementara
`--rp-text-muted` bernilai `#A8BACD`. Jarak keduanya hanya 28 dalam ruang RGB —
untuk mata, praktis warna yang sama. Karena `--rp-text-muted` dipakai sebagai
warna chip yang **mati**, chip debug yang hidup memakai warna yang artinya
"mati". Di light mode lebih parah: saya sendiri menetapkan `--rp-debug` ke
`#5A6B7F` di bagian 1.4, yang **persis sama** dengan `--rp-text-muted`. Jaraknya
nol. Tidak ada mata yang bisa membedakannya.

Kedua, dan ini kesalahan desain yang lebih mendasar: status nyala/mati chip
disampaikan **hanya oleh warna**. Begitu dua warna berdekatan, satu-satunya
saluran informasi yang ada langsung runtuh. Cara itu juga tidak pernah bekerja
untuk siapa pun yang kesulitan membedakan warna.

**Yang diperbaiki.**

| Tema | README bagian 6 | Dipakai | Kontras | Jarak ke `--rp-text-muted` |
|---|---|---|---|---|
| dark | `#9AA8BC` | **`#7EA8DB`** | 6.93:1 di bg, 5.17:1 di zebra | 28 → **48** |
| light | (tidak ada) | **`#3F5A80`** | 6.32:1 di bg | 0 → **32** |

Hue digeser ke biru, bukan diberi warna baru yang mencolok, supaya tetap terbaca
sebagai "kurang penting" dan tidak bertabrakan dengan teal `--rp-info` (jarak 70
di dark, 56 di light).

Selain itu status chip sekarang dibedakan oleh **bentuk**, dan warna hanya
menambah informasi:

- aktif → titik penanda **terisi penuh**
- mati → titik **berongga** (hanya cincin), label dicoret, chip diredupkan

Bentuknya tetap terbaca walaupun warnanya tidak terbaca sama sekali.

**Yang berubah dari cara audit ini bekerja.** `tools/selftest-contrast.js`
sekarang punya pemeriksaan kedua yang bukan soal kontras: **jarak minimum antar
token** yang berisiko bertabrakan, dengan ambang 25. Pemeriksaan pertama tidak
akan pernah menangkap masalah ini — `#5A6B7F` lolos 4.91:1 dengan nyaman, dan
tetap membuat UI tidak terpakai.

Pelajarannya, dan ini yang sebenarnya penting: **lolos WCAG bukan bukti sebuah
antarmuka bisa dipakai.** Ambang 4.5:1 hanya menjawab "apakah teks ini terbaca
di atas latarnya". Ambang itu tidak menjawab "apakah dua hal yang berbeda makna
terlihat berbeda". Aturan README bagian 6 nomor 2 — satu warna, satu makna —
justru menjawab pertanyaan kedua, dan sampai temuan ini tidak ada apa pun yang
menegakkannya. Sekarang ada.

---

## 2. Arsitektur yang dipilih

### 2.1 Syarat yang harus dipenuhi

1. Tanpa `chrome.debugger` (README bagian 4, dan instruksi kerja).
2. Panel tetap terlihat walaupun DevTools tidak dibuka (README bagian 3).
3. Cukup sederhana untuk dibaca orang yang tidak menulis kode setiap hari.
4. Vanilla JS, tanpa framework, tanpa build step, langsung load unpacked.

### 2.2 Keputusan

> **REVISI 2026-09-30.** Tempat UI berubah dari side panel menjadi **popup
> toolbar**, atas permintaan pemilik produk, dengan side panel tetap tersedia.
> Alasan lengkap dan harganya ada di bagian 2.6. Bagian 2.2 sampai 2.5 di bawah
> tetap ditulis apa adanya sebagai catatan keputusan awal, bukan dihapus —
> menghapusnya akan menghilangkan jejak audit yang justru jadi guna dokumen ini.

**Penangkap data: monkey-patch di MAIN world.**
Satu content script di `world: "MAIN"`, `run_at: "document_start"`, menambal
`console.*`, `fetch`, `XMLHttpRequest.prototype`, ditambah listener `error` dan
`unhandledrejection`.

**Jembatan: `window.postMessage` → content script ISOLATED → service worker.**
Dua lapis, karena MAIN world tidak punya akses ke `chrome.*` sama sekali.

**Penyimpanan: ring buffer 500 entri per tab di service worker**, dicerminkan ke
`chrome.storage.session`.

**UI: side panel (`chrome.sidePanel`).**

### 2.3 Kenapa MAIN world, dan kenapa ini satu-satunya jalan tanpa debugger

Content script biasa berjalan di **isolated world**: DOM-nya sama dengan halaman,
tapi variabel dan objek global JavaScript-nya **terpisah**. `console` yang dilihat
content script biasa adalah `console` milik isolated world, bukan milik halaman.
Menambalnya tidak menghasilkan apa pun — `console.log` di kode halaman tetap
memanggil fungsi aslinya.

Pemisahan ini memang sengaja dibuat Chrome supaya extension tidak bisa dirusak
oleh halaman dan sebaliknya. Konsekuensinya untuk kita: satu-satunya cara
menangkap `console.log` milik halaman tanpa Chrome DevTools Protocol adalah
menjalankan kode **di dalam world yang sama dengan halaman**, yaitu MAIN world.

Sejak Chrome 111, `world: "MAIN"` bisa dideklarasikan langsung di
`manifest.json`. Sebelum itu orang harus menyuntik `<script>` ke DOM halaman —
cara lama yang rapuh dan sering diblokir CSP halaman. Kita pakai cara deklaratif.

`run_at: "document_start"` penting: tambalan harus terpasang **sebelum** script
halaman jalan. Kalau terlambat, log yang terjadi saat halaman baru dimuat hilang.

### 2.4 Kenapa `window.postMessage` sebagai jembatan

Kode di MAIN world tidak melihat `chrome.runtime`, jadi tidak bisa mengirim apa
pun ke service worker secara langsung. Yang dibagi antara MAIN world dan isolated
world hanya **DOM dan event loop**. Jadi jalurnya:

```
MAIN world  --window.postMessage-->  ISOLATED content script
ISOLATED    --chrome.runtime.sendMessage-->  service worker
service worker --chrome.runtime.sendMessage--> side panel
```

`window.postMessage` dipilih karena:

- Bekerja lintas world tanpa menyentuh DOM halaman (tidak ada elemen tambahan,
  tidak ada atribut aneh, tidak mengganggu snapshot DOM saat QA).
- Asinkron dan tidak memblokir, jadi `console.log` halaman tidak jadi lambat.
- Payload dibatasi ke struktur yang bisa di-structured-clone, yang memaksa kita
  men-serialize data lebih dulu. Itu justru bagus: objek raksasa dan node DOM
  tidak akan pernah ikut terkirim.

Alternatif `CustomEvent` dengan `detail` juga bisa, tapi tidak lebih aman:
halaman tetap bisa menyadapnya. Dan `postMessage` lebih sedikit kejutannya karena
tidak perlu memikirkan event bubbling.

**Harga yang harus dibayar, dan mitigasinya.** Pesan `postMessage` ke window
sendiri bisa dibaca oleh halaman itu sendiri. Artinya dua hal:

1. Halaman bisa **membaca** apa yang kita kirim. Praktis tidak berbahaya, karena
   isinya adalah data milik halaman itu sendiri — dia sudah tahu token-nya. Tapi
   supaya bukan kita yang menyebarkannya, **redaction dilakukan di MAIN world
   sebelum `postMessage`**, bukan nanti di service worker.
2. Halaman bisa **memalsukan** pesan dan menyuntik entri log bohong. Ini risiko
   yang saya terima secara sadar untuk v1: halaman yang diuji dianggap bukan
   penyerang aktif. Mitigasinya, service worker memperlakukan semua entri yang
   masuk sebagai **data tidak dipercaya** — tipe divalidasi, field di luar
   whitelist dibuang, panjang string dipotong, dan redaction dijalankan ulang.
   Jadi halaman jahat paling banter bisa membuat baris log palsu, tidak bisa
   membuat panel error atau membengkakkan memori.

`targetOrigin` di `postMessage` diisi `'*'`, bukan origin spesifik. Alasannya
teknis: pada frame dengan origin opaque (`about:blank`, iframe sandbox,
`data:`), origin bernilai `"null"` dan pencocokan target origin tidak akan
pernah berhasil, sehingga capture mati tanpa pesan error di halaman-halaman itu.
Karena penerima yang dituju adalah window yang sama dan datanya sudah
diredaksi, `'*'` tidak menambah paparan baru.

### 2.5 Opsi yang ditolak

**Penangkap network**

| Opsi | Alasan ditolak |
|---|---|
| `chrome.devtools.network` | Hanya hidup selama DevTools terbuka, dan matinya tidak terlihat oleh pengguna. Langsung melanggar syarat 2 dan tujuan README bagian 3 |
| `chrome.webRequest` | Di MV3 tinggal versi observasi saja. Dapat method, URL, status, header — tapi **tidak** dapat durasi seakurat titik panggilan di halaman, tidak tahu request itu berasal dari `fetch` atau `<img>`, dan izinnya terasa berat di mata pengguna. Ditolak karena menambah izin tanpa menambah kemampuan yang kita butuhkan |
| `chrome.debugger` | Dilarang di v1. README bagian 4 sudah mencatat alasannya: banner "sedang di-debug" dan bentrok dengan DevTools |
| `PerformanceObserver` (resource timing) | Timing-nya bagus dan gratis, tapi **tidak memberi status code**. Filter "hanya request gagal (status >= 400)" adalah fitur inti v1, jadi opsi ini gugur sendiri |
| Monkey-patch `fetch` + XHR di MAIN world | **DIPILIH.** Status, durasi, header request, dan konteks pemanggil semuanya ada di satu titik, tanpa izin tambahan |

**Penangkap console**

| Opsi | Alasan ditolak |
|---|---|
| `chrome.debugger` CDP (`Runtime.consoleAPICalled`) | Dilarang di v1 |
| Hanya `window.onerror` + `unhandledrejection` | Menangkap crash, tapi tidak menangkap `console.log/warn/error` biasa. Tidak cukup untuk ruang lingkup README bagian 4 |
| Monkey-patch `console.*` di MAIN world | **DIPILIH**, dan `error`/`unhandledrejection` dipakai sebagai **pelengkap**, bukan pengganti. Keduanya menangkap hal berbeda: `console.error` adalah laporan sadar dari kode, uncaught error adalah kecelakaan |

**Tempat UI** (README bagian 12 masih menandai ini sebagai open question; keputusan
diturunkan dari syarat di README bagian 3)

| Opsi | Alasan ditolak |
|---|---|
| Popup | Tertutup begitu kamu klik di luar. Untuk QA yang harus mengklik-klik halaman sambil melihat log, ini fatal |
| DevTools panel | Melanggar syarat "tetap terlihat tanpa membuka DevTools" |
| Overlay di dalam halaman | Mengubah DOM halaman yang sedang diuji. Bisa tertimpa CSS halaman, bisa mengubah layout, bisa ikut tertangkap screenshot bug. Untuk alat QA ini merusak objektivitas |
| Side panel (`chrome.sidePanel`) | **DIPILIH.** Menempel di samping tab, tetap terbuka saat kamu berinteraksi dengan halaman, tidak menyentuh DOM halaman, dan punya lebar yang layak untuk teks monospace |

Harga side panel: butuh Chrome 114+ dan lebarnya terbatas (kira-kira 300–500px),
jadi tabel harus dirancang sempit. Karena itu URL panjang dipotong di tengah dan
detail dibuka lewat expand baris, bukan kolom tambahan.

### 2.6 Revisi: popup toolbar jadi muka utama, side panel tetap ada

Keputusan ini **membatalkan** pilihan di bagian 2.2 dan 2.5. Dicatat sebagai
revisi, bukan diam-diam ditimpa.

**Apa yang diminta.** Rapspect muncul sebagai kotak yang menggantung dari ikon
toolbar, seperti FuseBase Troubleshooter.

**Apakah ini melanggar README.** Tidak. README bagian 12 masih menandai tempat UI
sebagai open question dan menyebut popup sebagai salah satu opsi yang sah:
"Tempat UI: side panel (`chrome.sidePanel`), DevTools panel, atau popup?".
Yang dibatalkan adalah kesimpulan saya di bagian 2.5, bukan aturan README.
Keputusan atas open question memang milik pemilik produk.

**Harganya, dan ini nyata.** Popup **tertutup begitu halaman diklik**. Untuk alur
kerja di README bagian 2 — QA yang mengklik-klik halaman sambil mengawasi error —
itu kehilangan yang serius. Ini persis alasan popup ditolak di bagian 2.5.

**Cara menutup kekurangannya.** Kedua permukaan dipertahankan:

| Permukaan | Cara membuka | Untuk apa |
|---|---|---|
| Popup | klik ikon toolbar | pemeriksaan cepat: lihat error terakhir, salin, tutup |
| Side panel | tombol `Open side panel` di dalam popup, atau menu side panel Chrome | sesi panjang: tetap terbuka sambil halaman diklik |

**Satu dokumen untuk dua permukaan.** `panel.html` dipakai keduanya:

```
manifest: action.default_popup    = src/panel/panel.html?surface=popup
manifest: side_panel.default_path = src/panel/panel.html
```

Isi UI-nya sama persis; yang berbeda hanya ukuran dan satu tombol. Menyalin
markup ke dua file berarti setiap perbaikan dikerjakan dua kali, dan cepat atau
lambat salah satunya ketinggalan. Pembedanya dibaca dari query string oleh
`panel.js`, lalu ditulis ke atribut `data-surface` pada `<html>` supaya CSS bisa
menanganinya. CSS tidak bisa membaca query string, dan CSP MV3 melarang script
inline yang bisa menuliskannya lebih awal di `<head>` — jadi baris pertama
`panel.js` adalah kesempatan paling awal yang tersedia. Konsekuensinya ada satu
frame sebelum ukuran popup diterapkan; itu tidak terlihat dalam praktik.

**Yang ikut berubah.**

- `minimum_chrome_version` naik dari 114 ke **116**, karena
  `chrome.sidePanel.open()` yang dipakai tombol itu baru ada di 116. Menaikkannya
  membuat Chrome lama menolak dengan pesan versi yang jelas, bukan gagal
  misterius saat tombol diklik
- `setPanelBehavior({ openPanelOnActionClick: ... })` sekarang disetel **false**
  secara eksplisit. Sejak `default_popup` ada, Chrome mengabaikan setelan ini —
  tapi nilainya **bertahan di profil pengguna**, jadi siapa pun yang sudah pernah
  memasang versi sebelumnya masih menyimpan `true`. Meninggalkannya begitu saja
  membuat perilaku ikon berbeda antar mesin tanpa sebab yang terlihat
- listener `chrome.action.onClicked` **dihapus**, tidak disimpan sebagai jaring
  pengaman. Dengan `default_popup` terpasang Chrome tidak pernah memicunya, jadi
  itu hanya akan jadi kode mati yang menyesatkan pembaca berikutnya

### 2.6b Tombol tutup di header, dan kenapa perilakunya tidak bisa dijanjikan sama

**Apa yang diminta.** Header dengan logo dan tombol tutup, seperti ekstensi Jam.

**Yang sebenarnya hilang.** Popup Rapspect tidak punya tombol tutup sama sekali.
Satu-satunya cara menutupnya adalah mengklik di luar — yang untuk alat QA justru
sering tidak disengaja. Di side panel, Chrome menyediakan `✕` sendiri di
header-nya, jadi di sana kebutuhannya lebih kecil.

**Kenyataan teknis yang tidak bisa disembunyikan.** `chrome.sidePanel` **tidak
punya** `close()`. API-nya tidak simetris: hanya `open()` yang tersedia, dan
permintaan untuk menambahkan `close()` masih terbuka di
[w3c/webextensions issue 521](https://github.com/w3c/webextensions/issues/521).
Artinya:

| Permukaan | `window.close()` | Kepastian |
|---|---|---|
| Popup | dokumen milik kita sendiri | **dijamin** bekerja |
| Side panel | satu-satunya cara dari dalam dokumen | **tidak dijanjikan** Chrome |

**Cara menanganinya tanpa berpura-pura.** Hasil `window.close()` **diperiksa**,
bukan diasumsikan. Kalau setelah 250 ms dokumen masih hidup, berarti permintaan
tutup ditolak, dan satu baris keterangan muncul yang menunjuk `✕` milik Chrome di
header side panel. Keterangan itu hilang sendiri setelah 8 detik supaya tidak
terus memakan ruang vertikal.

Alasannya sederhana: tombol yang tidak berefek dan tidak berkata apa-apa lebih
buruk daripada tidak ada tombol. Pengguna akan menyimpulkan ekstensinya rusak.
Ini juga mengikuti README bagian 10 — pesan harus menyebut jalan keluarnya.

**Detail yang diputuskan sendiri.**

- Karakter `&times;` (U+00D7), **bukan** emoji dan bukan gambar. README bagian 8
  melarang menggambar ikon UI sendiri, dan emoji akan dirender berwarna oleh
  Windows sehingga merusak nada "membosankan dan sangat terbaca". `aria-label`
  wajib ada, karena "x" sendirian tidak berarti apa pun bagi screen reader
- Bentuknya **bundar tanpa border**, berbeda dari tombol aksi data (`Clear`,
  `Export JSON`) yang kotak berbingkai. Dua jenis kontrol dengan akibat yang
  sangat berbeda tidak boleh terlihat sama
- `Escape` juga menutup, dengan urutan prioritas: dialog export lebih dulu, lalu
  keterangan gagal-tutup, baru permukaannya. Menutup panel sementara dialog
  export masih terbuka akan membuang konfirmasi yang belum dijawab

**Yang belum dikerjakan dan sengaja dibiarkan.** Di side panel, header Rapspect
menduplikasi header Chrome — keduanya menampilkan nama "Rapspect", dan sekarang
keduanya punya tombol tutup. Itu memakan sekitar 38px ruang vertikal di panel
yang memang sempit. Meringkasnya berarti header berbeda antar permukaan, dan itu
keputusan tampilan yang perlu persetujuan pemilik produk lebih dulu.

### 2.6c Pewarnaan sintaks di area data, dan kenapa ini bukan pelanggaran

**Apa yang diminta.** Isi log diwarnai seperti di VS Code, supaya tidak terlalu
plain.

**Pertentangan dengan README, disebut lebih dulu.** README bagian 5 punya tabel
Boleh/Jangan, dan di kolom **Jangan** tertulis persis *"Efek dekoratif di dalam
baris log"*, dengan aturan induk *"Area data harus membosankan dan sangat
terbaca."* README bagian 6 aturan 2 menambah *"Satu warna, satu makna... tidak
ada pengecualian."*

**Kenapa tetap dikerjakan.** Kata kuncinya **dekoratif**. Pewarnaan yang menandai
struktur bukan hiasan — dia menjawab pertanyaan yang memang dicari mata saat
membaca stack trace: file mana, baris berapa, frame ini milik halaman atau milik
extension lain. Tujuan yang ditulis README sendiri adalah *"pengguna harus bisa
memindai status 404 dalam sepersekian detik"*. Struktur yang terlihat melayani
tujuan itu; yang dilarang adalah hiasan yang tidak membawa informasi.

**Aturan "satu warna satu makna" ditegakkan, bukan dilonggarkan.** Ini bagian yang
paling mudah dirusak. Kalau URL diwarnai teal, maka di dalam satu baris log teal
berarti dua hal: level info **dan** sebuah lokasi. Karena itu:

- palet sintaks **terpisah penuh** dari warna level. Tidak ada satu token level
  yang dipakai ulang
- hanya **dua** hue baru, bukan palet penuh gaya editor

| Token | Dark | Light | Kontras terburuk | Jarak terdekat ke warna semantik |
|---|---|---|---|---|
| `--rp-syn-url` | `#C9A0F5` | `#6B3FA0` | 5.97:1 / 6.63:1 | 58 |
| `--rp-syn-num` | `#E8C68F` | `#5F6B00` | 7.83:1 / 5.26:1 | 44 |

`--rp-syn-num` di dark mode **adalah** `--rp-sand` dari logo, jadi satu dari dua
hue baru itu sebenarnya sudah ada di palet brand.

Di light mode angka memakai olive, bukan coklat keemasan yang lebih dekat ke sand.
Coklat keemasan hanya berjarak 34 dari `--rp-warn` `#8A6100` dan akan terlihat
mirip; olive berjarak 44. Ini pelajaran yang sama dengan bagian 1.6 — **jarak
menang atas kemiripan hue antar tema.**

`tools/selftest-contrast.js` sekarang menguji setiap warna sintaks terhadap
**setiap** warna semantik, bukan sebagian. Jarak terdekat yang sebenarnya 44,
ambangnya 25. Pemeriksaan kontras tidak akan pernah menangkap tabrakan semacam
ini: dua warna bisa lolos 4.5:1 dengan nyaman dan tetap salah.

**Yang justru diredupkan, bukan diwarnai.** Kerangka stack trace — kata `at`,
tanda kurung, titik — memakai `--rp-text-muted`. Ini yang membuat lokasi file
menonjol tanpa menambah hue: menaikkan yang penting dilakukan dengan menurunkan
yang tidak penting.

Nama tipe error (`Error`, `TypeError`, `DOMException`) dibedakan dengan
**ketebalan huruf**, bukan warna. Merah sudah dipakai untuk level error di badge
dan garis tepi; memakainya lagi untuk nama tipe akan membuat merah berarti dua
hal, dan memakai warna lain akan membingungkan.

**Tidak ada animasi per token.** Diminta, tapi tidak dikerjakan, dan ini satu-
satunya bagian permintaan yang saya tolak. Teks yang bergerak lebih sulit dibaca,
dan di sinilah larangan README bagian 5 benar-benar berlaku tanpa tafsir. Animasi
yang ditambahkan justru di kulit: tombol `jump to latest` yang meluncur masuk.

**Tokenizer dipindah ke `rapspect-core.js`.** Awalnya saya tulis di `panel.js`,
lalu sadar logika string murni itu jadi tidak bisa diuji tanpa browser. Sekarang
`core.tokenizeLog(text)` mengembalikan deretan `{t, v}` dan `panel.js` hanya
menerjemahkannya menjadi node DOM.

Jaminan yang diuji **bukan** "warnanya benar", tapi **teksnya utuh**: menggabungkan
kembali seluruh token harus menghasilkan masukan yang identik. Untuk alat
forensik, tokenizer yang menelan satu karakter jauh lebih berbahaya daripada yang
tidak mewarnai apa pun — log salah warna langsung kelihatan, log yang kehilangan
satu digit dari nomor baris akan dipercaya apa adanya.

`tools/selftest-highlight.js` menjalankan 39 pemeriksaan dan **langsung menemukan
dua bug yang lolos dari mata saya**:

1. Pola `[A-Z][A-Za-z]*(?:Error|Exception)` menuntut ada awalan sebelum `Error`,
   jadi `TypeError` cocok tapi **`Error` sendirian tidak pernah cocok** — padahal
   itu bentuk paling umum di stack trace. Awalannya kini opsional.
2. `data:` masuk daftar skema URL padahal tidak memakai `//`, jadi secara
   struktural tidak mungkin dikenali. Dihapus dengan sadar: isi data URI di log
   hampir selalu base64 raksasa yang tidak membawa informasi untuk dipindai.
   Sekalian ditemukan bahwa `blob:https://...` terbelah dua karena kecocokan mulai
   dari `https://`; prefiks `blob:` kini ikut.

**Keamanan.** Setiap token ditulis dengan `textContent`, tidak pernah
`innerHTML`. Teks ini berasal dari halaman yang sedang diuji, dan panel Rapspect
adalah halaman extension dengan akses penuh ke `chrome.*` — memasukkannya sebagai
HTML akan menjadikan panel target injeksi dari halaman mana pun yang dibuka QA.
Ada pemeriksaan khusus untuk ini: teks berisi `<script>` dan `onerror=` harus
keluar dari tokenizer tanpa berubah satu karakter pun.

### 2.6d Enam fitur dari roadmap, dan batas yang dipasang pada dua di antaranya

Ruang lingkup v1 di README bagian 4 sudah selesai seluruhnya sebelum ronde ini —
kesepuluh item di daftar "Termasuk" terpenuhi. Yang ditambahkan di sini diambil
dari README bagian 13, ditambah tiga hal kecil yang menyerang langsung alur kerja
di README bagian 2.

#### Ekspor Markdown dan Jira (roadmap v2.1, dimajukan)

Alasan dimajukan: ini yang paling langsung menjawab **masalah nomor dua** di
README bagian 2 — *"Menyalin bukti ke bug report itu lambat dan manual."* Export
JSON bagus untuk arsip, tapi tidak ada yang menempelkan JSON mentah ke tiket.

Dialog export sekarang punya pemilih format, dengan Markdown sebagai default,
serta tombol **Copy** di samping **Download** — menyalin ke clipboard adalah
jalur yang sebenarnya dipakai untuk menempel ke tiket.

Dua karakter cukup untuk merusak tabel secara senyap: `|` memecah kolom, dan
baris baru mengakhiri baris tabel sebelum waktunya. Stack trace mengandung
keduanya. Di Jira, `{` juga membuka makro. Jadi:

| Konteks | Yang diescape | Yang TIDAK diescape, dan kenapa |
|---|---|---|
| Sel tabel Markdown | `\|`, baris baru → spasi | `{` — Markdown tidak memperlakukannya khusus, meng-escape-nya justru mengubah isi log |
| Sel tabel Jira | `\|`, `{`, baris baru → spasi | — |
| Blok `{noformat}` Jira | tidak ada | isinya ditampilkan literal; backslash tambahan akan terlihat di tiket |

Stack trace dibungkus `<details>` di Markdown supaya tiket tidak membengkak
sampai tidak terbaca. Untuk Jira dipakai `{noformat}`, **bukan** `{code}`:
`{code}` mencoba menebak bahasa dan bisa salah mewarnai stack trace.

`tools/selftest-report.js` menjalankan 49 pemeriksaan. Yang paling berguna bukan
"laporannya rapi", tapi **setiap baris tabel Markdown harus punya jumlah pemisah
kolom yang sama** — itu pemeriksaan yang menangkap pipa yang lupa diescape, dan
satu-satunya cara mengetahuinya tanpa menempelkan ke tiket sungguhan.

#### Pause capture (roadmap v1.1)

Ada dua tafsir, dan pilihannya bukan sepele.

Pause bisa berarti **menyetop penangkapan**, yang punya keuntungan nyata: ring
buffer tidak terisi noise selagi kamu membaca. Atau **membekukan tampilan**, yang
menahan render tapi tetap menyimpan semuanya.

Dipilih yang kedua, dengan alasan tunggal: **bukti yang tidak tertangkap tidak
bisa dikembalikan; tampilan yang tertahan bisa.** Untuk alat yang gunanya
mengumpulkan bukti bug, kehilangan data adalah kegagalan yang lebih mahal
daripada tampilan yang ketinggalan.

Penanda `PAUSED` dibuat mencolok di footer beserta jumlah entri yang tertahan
(`PAUSED +12`). Panel yang dibekukan dan panel yang rusak terlihat **sama persis**
dari luar, dan itu cara tercepat membuang waktu seseorang. Angkanya juga menjawab
"apakah halaman masih hidup".

#### Redaction yang bisa dikonfigurasi (roadmap v1.1), tapi hanya satu arah

**Hanya bisa MENAMBAH nama field, tidak pernah mengurangi.** Ini batas yang saya
pasang sendiri, dan bukan karena malas mengerjakan tombol OFF.

README bagian 11 menyebut redaction "wajib ada sejak v1, bukan ditambahkan
nanti", dan roadmap v1.1 menyebut "redaction yang bisa dikonfigurasi". Tafsir yang
paling mudah adalah menambahkan tombol mati. Tapi tombol itu membuat kebocoran
token hanya berjarak satu klik dari pengguna yang sedang tergesa menyiapkan
tiket — dan kebocoran token tidak bisa ditarik kembali setelah tertempel di repo
publik. Daftar bawaan selalu berlaku; konfigurasi hanya memperketatnya.

Nama di bawah tiga karakter ditolak. Alasannya sama dengan `pin` di bagian 5.3:
satu atau dua karakter akan cocok sebagai substring di hampir semua nama field
dan menyensor seluruh log sampai tidak berguna.

**Diterapkan di service worker, bukan di titik capture**, dan ini perlu dicatat
jujur. Kode capture berjalan di MAIN world yang tidak punya akses `chrome.*` sama
sekali, jadi tidak bisa membaca storage; menyalurkan konfigurasi ke sana berarti
menambah kanal pesan baru menuju halaman. Konsekuensinya: nilai bernama sensitif
tambahan **masih melintasi jembatan di dalam halaman** sebelum disensor. Itu data
milik halaman itu sendiri, yang sudah dia pegang sejak awal, dan tidak ada nilai
itu yang pernah masuk buffer atau tampil di panel.

#### Pengelompokan entri identik berulang

Hanya yang **berurutan**. Mengelompokkan entri yang berjauhan akan mengacak
urutan waktu, dan urutan kejadian justru inti dari membaca log saat melacak bug.

Kenapa ini bukan sekadar kosmetik: halaman yang melempar error yang sama 200 kali
menghabiskan 40% ring buffer untuk satu informasi. Pengelompokan melindungi
anggaran 500 entri.

Waktu yang ditampilkan di baris adalah kemunculan **pertama**; yang terakhir ada
di blok detail. Menampilkan yang terakhir akan membuat kolom waktu terlihat
melompat-lompat. Entri asli tidak pernah disentuh — yang dikelompokkan salinan
dangkal, karena state harus tetap mencerminkan apa yang benar-benar terjadi.

#### Salin satu baris

README bagian 2 masalah nomor dua lagi. Sering yang dibutuhkan hanya **satu**
baris, dan menyeleksinya dengan kursor di panel selebar 400px itu menjengkelkan.

Satu detail implementasi yang sempat jadi bug: tombol `copy` dan `details`
dua-duanya berkelas `rp-toggle`, jadi delegasi event harus memeriksa `copy`
**lebih dulu** — kalau tidak, mengklik copy ikut membuka blok detail. Keduanya
juga dibungkus satu wadah flex, bukan diletakkan langsung sebagai anak grid:
grid akan menaruh dua anak di kolom yang sama pada dua baris berbeda, dan satu
baris log jadi memakan tinggi tiga baris.

#### Preferensi yang diingat

Diingat: tab, filter request gagal, pengelompokan, dan field redaction tambahan.

**Sengaja tidak diingat**, dan ini bagian yang lebih penting:

- **Teks pencarian.** Panel yang terbuka dengan pencarian aktif dari sesi lain
  tampak seperti panel yang kehilangan data.
- **Status paused.** Membuka panel dalam keadaan dibekukan adalah cara tercepat
  menyimpulkan bahwa capture-nya rusak.

#### Pemindahan ke core, dan satu temuan

`formatTime`, `formatBytes`, `tagFor`, dan `entryToLine` dipindah dari `panel.js`
ke `rapspect-core.js`, dengan alasan yang sama seperti `tokenizeLog` di bagian
2.6c: logika string murni yang di `panel.js` tidak bisa diuji tanpa browser.

Dua pemeriksaan pertama `selftest-report.js` gagal saat dijalankan, dan **keduanya
kesalahan test saya, bukan kodenya** — dicatat karena lebih berguna daripada
narasi yang bersih. Entri ujinya tidak mengandung kurung kurawal di kolom tabel,
sehingga escaping Jira tidak pernah benar-benar teruji. Dan saya mengira
`session_id` tidak akan cocok dengan field tambahan `sessionId`, padahal
normalisasi membuang garis bawah sehingga keduanya menjadi `sessionid` — cocok,
dan itu memang perilaku yang diinginkan.

### 2.7 Tab per level: lensa, bukan tujuh laporan

**Apa yang diminta.** Menu terpisah untuk error, warn, info, log, dan debug,
"jangan dalam satu laporan".

**Di sini ada pertentangan dengan README, dan tidak saya diamkan.** README
bagian 2 menyebut masalah nomor tiga yang mau diselesaikan: "Informasi tersebar
di dua tab. Error console dan request yang gagal sering berkaitan, tapi harus
dilihat bergantian." README bagian 3 meminta semuanya "dalam satu panel yang
sama". Memecah tiap level menjadi laporan terpisah membangun ulang persis masalah
yang jadi alasan produk ini ada.

**Jalan tengah yang diambil.** Tab dibuat sebagai **lensa ke satu aliran yang
sama**, bukan tujuh penyimpanan terpisah:

- `All` tetap default dan tetap gabungan, jadi hubungan antara error console dan
  request gagal tetap terlihat berurutan
- tab lain hanya mempersempit tampilan. Datanya satu, ring buffer-nya satu
- tiap tab membawa **hitungan**, sehingga pemisahan yang diminta tercapai tanpa
  harus berpindah tab dulu untuk tahu ada isinya atau tidak
- satu klik untuk memisahkan, satu klik untuk kembali menggabungkan

Kalau yang kamu maksud benar-benar tujuh laporan terpisah tanpa tampilan
gabungan, itu perlu koreksi README bagian 2 dan 3 lebih dulu, dan saya tidak
mengubah README.

**Detail perilaku yang perlu dicatat.** Pembatas navigasi (`PAGE`) hanya muncul
di tab `All`. Secara teknis levelnya `info`, tapi menampilkannya di tab Info
membuat tab itu tercampur hal yang bukan pesan aplikasi. Di `All` dia tetap
penting sebagai penanda urutan kejadian.

Hitungan tiap tab dihitung dengan aturan yang **sama persis** seperti isi tab itu
saat dibuka — termasuk pencarian dan `Failed only` yang sedang aktif. Hitungan
yang tidak cocok dengan isinya lebih buruk daripada tidak ada hitungan.

### 2.8 Tab Network, dan kenapa isinya lebih sedikit daripada DevTools

Pertanyaan yang muncul saat dipakai: DevTools Network menampilkan puluhan baris,
Rapspect kosong. Ini bukan bug, tapi sebelumnya tidak ada apa pun di UI yang
menjelaskannya — dan itu bug tersendiri.

Penyebabnya ada di bagian 6: Rapspect menambal `fetch` dan `XMLHttpRequest`.
Stylesheet, gambar, script, font, dan navigasi dimuat oleh browser sendiri dan
tidak pernah melewati keduanya. Pada contoh nyata yang diperiksa, seluruh baris
di DevTools bertipe `stylesheet` dan `text/css` kecuali satu yang bertipe `fetch`.

Dua hal ditambahkan:

1. **Tab `Network`.** Sebelumnya tidak ada cara meminta "tampilkan request saja".
   Lebih buruk lagi, baris network dipetakan ke level `info`/`warn`/`error`, jadi
   ikut hilang begitu level itu disaring — pengguna bisa menyimpulkan network
   tidak tertangkap padahal hanya tersembunyi.
2. **Keterangan di dalam tab itu** saat kosong, menyebut bahwa hanya `fetch()` dan
   `XMLHttpRequest` yang ditangkap. Menjelaskan di tempat kebingungan muncul,
   bukan di dokumen yang harus dicari lebih dulu.

### 2.9 Animasi: hanya di kulit aplikasi

README bagian 5 melarang dua hal secara eksplisit: "Maskot beranimasi
terus-menerus" dan "Efek dekoratif di dalam baris log". Jadi animasi ditempatkan
begini:

| Dianimasikan | Apa | Kenapa boleh |
|---|---|---|
| ya | popup/panel saat dibuka: fade + geser 4px | kulit aplikasi |
| ya | garis penanda tab: `scaleX` | kulit aplikasi. Memakai `transform`, bukan `width`, supaya tidak memicu layout ulang tiap frame |
| ya | hitungan tab saat **naik**: satu denyut | kulit aplikasi. Hanya saat naik — turun karena pengguna mengubah filter bukan kabar baru |
| ya | tombol saat ditekan: `scale(0.97)` | umpan balik, bukan hiasan |
| ya | notice dan modal: fade + geser | kulit aplikasi |
| **batas** | baris log baru: fade 140ms | ini **di dalam** area data, jadi perlu dibenarkan. Fungsinya menandai data yang baru tiba, bukan menghias. Dua penjaga dipasang: hanya baris dengan id lebih tinggi dari yang pernah dirender, dan tidak pada render pertama — tanpa keduanya, membuka panel pada halaman dengan 500 entri akan menjalankan 500 animasi sekaligus |
| tidak | baris log yang sudah ada, badge level, isi detail | area data harus tenang |

Seluruh animasi dan transisi **dimatikan total** — bukan dipercepat — kalau
sistem meminta `prefers-reduced-motion: reduce`.

Durasi dikumpulkan sebagai token (`--rp-motion-fast`, `--rp-motion`, `--rp-ease`)
dengan alasan yang sama seperti warna: supaya bisa diaudit sekaligus dan tidak
ada angka ms yang tersebar di tengah file.

### 2.10 Tabrakan teks di kolom waktu

Bug yang terlihat langsung di layar: timestamp menumpuk di atas badge level.

Penyebabnya lebar kolom yang dipaku: `grid-template-columns: 5.5em 4.2em ...`.
Timestamp lengkap `19:06:44.859` adalah 12 karakter monospace, sekitar 7.2em —
melebihi 5.5em. Karena kolom waktu juga diberi `white-space: nowrap`, teksnya
tidak membungkus tapi meluber ke kolom sebelahnya.

Diperbaiki dengan `max-content max-content minmax(0, 1fr)`: dua kolom pertama
mengambil lebar yang memang dibutuhkan isinya, kolom pesan menyerap sisanya.
Ditambah `font-variant-numeric: tabular-nums` pada kolom waktu supaya angka
benar-benar rata kolom, dan `align-items: baseline` supaya badge sejajar dengan
garis dasar teks.

Pelajaran yang sama dengan bagian 1.6: satuan `em` untuk kolom berisi teks
monospace dengan panjang yang sudah diketahui adalah taruhan yang tidak perlu.

---

## 3. Batasan Manifest V3 yang membentuk desain ini

| Batasan MV3 | Efek ke desain Rapspect |
|---|---|
| **Service worker mati saat idle** (kira-kira 30 detik tanpa event) | Buffer tidak boleh hanya di memori. Buffer dicerminkan ke `chrome.storage.session`, dan setiap handler menunggu `ensureLoaded()` sebelum bekerja, karena worker bisa baru saja bangun dengan memori kosong |
| **Tidak ada `setInterval` yang bisa diandalkan** di service worker | Tidak ada polling. Semua alur digerakkan event: pesan masuk, tab ditutup, tab pindah URL |
| **Larangan remote code** | Tidak ada CDN. Font Inter dan JetBrains Mono **tidak** diambil dari jaringan; dipakai stack fallback yang sudah ditulis README bagian 7 (`system-ui`, `Consolas`, `Cascadia Code`, `monospace`). Ikon Lucide juga tidak diambil dari jaringan |
| **CSP halaman extension: tidak ada inline script, tidak ada `eval`** | `panel.html` tidak punya satu pun `onclick=` atau `<script>` inline. Semua event di-bind dari `panel.js`, semua JS berupa file terpisah |
| **Content script default di isolated world** | Butuh entri `world: "MAIN"` terpisah. Ini alasan utama arsitektur dua lapis di bagian 2 |
| **Content script statis tidak mendukung ES module** | Kode bersama tidak bisa pakai `import`. `src/shared/rapspect-core.js` ditulis sebagai plain script yang menempel ke satu global, lalu dimuat lewat `content_scripts`, `importScripts()`, dan `<script src>`. Satu file, satu aturan redaction, tanpa build step |
| **Service worker tidak bisa `importScripts` kalau dideklarasikan `type: "module"`** | Karena itu service worker **bukan** module. Trade-off yang diambil sadar: sintaksnya lebih tua, tapi file redaction bisa dipakai bersama tanpa duplikasi |
| **`chrome.runtime.sendMessage` gagal kalau tidak ada penerima** | Setiap pengiriman ke panel dibungkus `.catch(() => {})`. Panel yang tertutup adalah keadaan normal, bukan error |
| **Reload extension membatalkan context content script** | Content script lama jadi zombi: `chrome.runtime.id` hilang dan `sendMessage` melempar "Extension context invalidated". Jembatan mendeteksi ini, berhenti mengirim, dan memberi tahu MAIN world supaya ikut berhenti |
| **Extension tidak boleh menyuntik ke halaman tertentu** | `chrome://*`, `chrome-extension://*`, Chrome Web Store, `view-source:`, `about:` tidak bisa diakses. Panel mendeteksi ini dan menampilkan pesan dari README bagian 10, bukan empty state yang menyesatkan |
| **`file://` butuh izin manual** | Content script tidak jalan di `file://` sebelum "Allow access to file URLs" dinyalakan. Panel mendeteksi skema `file:` dan menampilkan petunjuknya |
| **Kuota `chrome.storage.session`** (kira-kira 10 MB) | Semua string dipotong saat capture (2000 karakter per nilai, 4000 untuk body), array dibatasi, kedalaman objek dibatasi 4. Entri kecil sejak awal, bukan dipotong belakangan |

Yang saya **tidak** yakin dan tidak saya klaim: angka persis idle timeout service
worker dan kuota `storage.session` bisa berubah antar versi Chrome. Desainnya
dibuat supaya tidak peduli angka persisnya — worker boleh mati kapan saja.

---

## 3.1 Izin yang diminta, satu per satu

Prinsipnya: kalau sebuah izin dihapus dan tidak ada yang rusak, izin itu tidak
boleh ada di manifest.

| Izin | Kenapa dibutuhkan | Yang rusak kalau dihapus |
|---|---|---|
| `storage` | Mencerminkan ring buffer ke `chrome.storage.session` supaya isi panel tidak hilang saat service worker mati, dan menyimpan pilihan tema di `chrome.storage.local` | Setiap kali service worker idle (sekitar 30 detik tanpa aktivitas), seluruh log hilang dan panel jadi kosong tanpa sebab yang terlihat. Pilihan tema juga kembali ke dark setiap kali panel dibuka |
| `sidePanel` | Memakai `chrome.sidePanel.setPanelBehavior()` supaya klik ikon toolbar membuka panel | `chrome.sidePanel` jadi `undefined`. Klik ikon tidak melakukan apa pun. Panel masih bisa dibuka manual dari menu Chrome, tapi jalur utamanya mati |
| `tabs` | Membaca `tab.url` dan `tab.title` untuk (a) judul di header panel, (b) mendeteksi halaman terlarang seperti `chrome://` supaya pesan errornya benar, (c) mendeteksi perubahan URL untuk menaruh pembatas navigasi | `tab.url` dan `tab.title` datang kosong. Panel tidak bisa membedakan "halaman ini tidak menghasilkan log" dari "halaman ini tidak bisa disuntik" — dan itu tepat keluhan yang jadi masalah nomor satu di troubleshooting |

Izin yang **sengaja tidak** diminta, supaya jelas ini bukan kelupaan:

| Tidak diminta | Alasan |
|---|---|
| `debugger` | Dilarang di v1 |
| `webRequest` | Data network sudah didapat dari tambalan `fetch`/XHR |
| `scripting` | Content script dideklarasikan statis di manifest, tidak ada penyuntikan dinamis |
| `activeTab` | Tidak dipakai. Akses halaman datang dari `matches` di `content_scripts` |
| `host_permissions` | Tidak perlu entri terpisah. `matches: ["<all_urls>"]` di `content_scripts` sudah memberi akses yang dibutuhkan. Menambahkannya hanya memperbesar dialog izin tanpa menambah kemampuan |
| `downloads` | Export JSON memakai `Blob` + `URL.createObjectURL` + `<a download>`, tidak butuh izin |
| `clipboardWrite` | `navigator.clipboard.writeText()` di halaman extension yang sedang fokus sudah cukup. Ada fallback `document.execCommand('copy')` kalau ditolak |
| `unlimitedStorage` | Buffer dibatasi 500 entri dan semua string dipotong. Tidak akan mendekati kuota |

`matches: ["<all_urls>"]` memang lebar, dan Chrome akan menampilkannya sebagai
"Read and change data on all sites". Itu tidak bisa dihindari untuk alat yang
tugasnya memeriksa halaman apa saja yang sedang diuji. Kalau kamu mau dialog
izinnya lebih kecil, alternatifnya mempersempit `matches` ke domain kerjamu
sendiri — tapi itu keputusanmu, bukan kesimpulan dari README.

## 3.2 Kenapa `minimum_chrome_version: "114"`

`world: "MAIN"` di content script butuh Chrome 111+. `chrome.sidePanel` butuh
Chrome 114+. Angka 114 adalah yang lebih tinggi. Menuliskannya membuat Chrome
lama menolak extension dengan pesan versi yang jelas, bukan gagal misterius
dengan `chrome.sidePanel is undefined`.

## 3.3 Ikon extension: sudah terpasang

Blok `icons` dan `action.default_icon` sudah ada di `manifest.json` dan menunjuk
`assets/icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`. Keempatnya
ada di repo, jadi load unpacked berjalan tanpa error.

**Kenapa awalnya tidak ada.** Manifest yang menunjuk file ikon yang tidak ada
membuat Chrome menolak extension sepenuhnya dengan
`Could not load icon '...' specified in 'icons'` — bukan sekadar ikon kosong,
tapi extension tidak muncul sama sekali. Selama keempat PNG belum ada, tidak
menyebut ikon adalah satu-satunya cara agar extension tetap bisa dimuat. Saya
juga tidak membuat PNG placeholder abu-abu, karena placeholder gampang lupa
diganti lalu ikut terbit ke Chrome Web Store.

**Bagaimana file-nya dibuat.** File sumber yang tersedia adalah JPEG
(`assets/Rapspect.jpeg`, 1686x2528, `Format24bppRgb`, tanpa alpha channel).
Mengganti ekstensinya menjadi `.png` tidak mengubah apa pun — isinya tetap JPEG,
dan header byte-nya masih `FF D8 FF E0`. Dua masalah harus diselesaikan lebih
dulu:

1. **Papan catur.** Seperti yang ditulis README bagian 9, kotak-kotak abu-abu di
   dalam badge itu piksel asli, bukan transparansi. Dipakai langsung, ikonnya
   benar-benar berlatar papan catur.
2. **Tidak ada alpha channel.** Ikon toolbar harus menyatu dengan warna toolbar
   yang bisa terang atau gelap, jadi latarnya wajib transparan.

`tools/make-icons.ps1` menyelesaikan keduanya tanpa dependency apa pun, hanya
`System.Drawing` yang sudah ada di Windows:

- mendeteksi lingkaran badge navy **secara otomatis** dari baris navy terlebar di
  bagian atas gambar, jadi tidak ada koordinat yang ditulis manual dan skripnya
  tetap jalan kalau logo diekspor ulang dengan komposisi berbeda
- mengganti piksel papan catur dengan `--rp-cream` solid. Pembedanya: piksel
  papan catur **netral** (selisih kanal maksimum 22) dan **terang**. Moncong onta
  yang warnanya cream punya selisih R-B sekitar 30 dan gigi lebih kuning lagi,
  jadi keduanya tidak ikut tertimpa
- membuat latar di luar badge transparan dengan tepi bergradasi, supaya tidak
  bergerigi setelah dikecilkan. Tassel merah/kuning/teal yang menggantung di
  luar lingkaran jaraknya jauh dari warna latar, jadi tetap utuh
- memotong persegi lalu mengecilkan bertahap (halving), karena bicubic sekali
  langkah dari 1752px ke 16px hasilnya berbintik

Hasilnya diverifikasi: keempat file benar PNG (`89 50 4E 47`),
`Format32bppArgb`, dan berukuran tepat 16/32/48/128 piksel. Skripnya bisa
dijalankan ulang kapan saja:

```powershell
powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1 -Source assets\Rapspect.jpeg
```

Ikut dihasilkan `assets/branding/logo-badge-512.png`: versi bersih dari logo yang
seharusnya menggantikan JPEG sebagai aset sumber raster.

## 3.4 Batas ikon yang sekarang, dan apa yang masih perlu desainer

Yang sekarang ada adalah **hasil pengecilan satu gambar**, bukan
**penyederhanaan progresif** yang diminta README bagian 9. Bedanya nyata dan
sudah terlihat: di 16x16 wajah ontanya jadi gumpalan pucat, hanya cincin
navy-nya yang masih terbaca sebagai bentuk.

Yang sudah bisa dilakukan tanpa menggambar: ukuran 128 dan 48 memakai potongan
yang menyertakan tassel, sedangkan 32 dan 16 memakai potongan badge saja — README
bagian 9 memang menyebut ikon 16 tanpa tassel, dan di ukuran itu tassel hanya
menjadi tiga bintik yang mengaburkan bentuk kepala.

Yang **tidak** bisa diselesaikan dengan pengecilan, dan tetap butuh desainer:

- varian 16 dan 32 digambar ulang dari vektor, tanpa tassel dan tanpa gigi,
  sesuai tabel tingkat detail README bagian 9
- `logo-master.svg`. Tidak bisa diturunkan dari raster; perlu file vektor asli

Begitu file baru tersedia, cukup taruh di `assets/icons/` dengan nama yang sama.
`manifest.json` tidak perlu diubah.

---

## 4. Alur data lengkap

```
halaman web
  │  console.log / fetch / XHR / uncaught error / unhandled rejection
  ▼
[1] src/content/capture-main.js          world: MAIN, document_start
  │  - tambal console.*, fetch, XMLHttpRequest.prototype
  │  - listener 'error' (capture) + 'unhandledrejection'
  │  - REDACTION DIJALANKAN DI SINI, sebelum data meninggalkan halaman
  │  - serialize ke bentuk yang aman di-clone
  ▼  window.postMessage({ __rapspect: 'rapspect:v1', entry })
[2] src/content/bridge-isolated.js       world: ISOLATED, document_start
  │  - saring pesan: hanya dari window ini, hanya channel kita
  │  - kumpulkan jadi batch, kirim tiap 120 ms (bukan satu-satu)
  │  - deteksi context invalidated -> berhenti + suruh MAIN berhenti
  ▼  chrome.runtime.sendMessage({ type: 'rp:entries' })
[3] src/background/service-worker.js
  │  - sanitasi entri (data dari halaman = tidak dipercaya)
  │  - redaction dijalankan ULANG (idempoten, defense in depth)
  │  - ring buffer 500 per tab
  │  - cermin ke chrome.storage.session (debounce 300 ms)
  ▼  chrome.runtime.sendMessage({ type: 'rp:push' })   <- diabaikan kalau panel tutup
[4] src/panel/panel.html + panel.js
     - filter level, filter failed-only, search
     - Clear, Copy as text, Export JSON, toggle tema
```

Kenapa batch 120 ms di langkah 2: halaman yang berisik bisa memanggil
`console.log` ratusan kali dalam sekejap. Satu `sendMessage` per log akan
membangunkan service worker terus-menerus dan membuat halaman terasa berat.
Batching membuat beban konstan tanpa terasa lambat di mata manusia.

Kenapa debounce 300 ms di langkah 3: menulis ke `storage` jauh lebih mahal
daripada menulis ke array. Buffer di memori selalu up to date; salinan di
storage boleh tertinggal sedikit, karena gunanya hanya untuk bertahan saat
service worker mati.

---

## 5. Redaction (README bagian 11)

### 5.1 Tempat penegakan

Redaction dijalankan **dua kali**, dan itu sengaja:

1. Di MAIN world, sebelum data keluar dari halaman. Ini yang utama — data mentah
   tidak pernah masuk ke jembatan.
2. Di service worker, sekali lagi sebelum masuk buffer. Ini jaring pengaman
   untuk entri yang tidak datang dari kode kita (halaman yang memalsukan pesan).

Fungsinya idempoten: menjalankannya dua kali pada data yang sudah bersih tidak
mengubah apa pun.

### 5.2 Daftar sesuai README, tanpa tambahan

Header: `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key` — dicocokkan
case-insensitive. Saya **tidak** menambahkan header lain (misalnya
`Proxy-Authorization`), karena README menyebut daftarnya secara eksplisit dan
menambah diam-diam berarti dokumen dan kode tidak lagi sinkron.

Field body: `password`, `token`, `secret`, `apiKey`, `pin`.

### 5.3 Cara pencocokan nama field, dan kenapa `pin` diperlakukan berbeda

Nama field dinormalkan lebih dulu: huruf kecil, semua karakter non-alfanumerik
dibuang. Jadi `api_key`, `API-KEY`, dan `apiKey` sama-sama jadi `apikey`.

Untuk `password`, `token`, `secret`, `apikey` dipakai pencocokan **substring**,
supaya `access_token`, `refreshToken`, `passwordConfirmation`, dan `clientSecret`
ikut tersensor. Ini penting karena nama field di dunia nyata jarang persis.

`pin` **hanya** dicocokkan persis. Kalau `pin` ikut substring, kata seperti
`shipping`, `pinned`, dan `spinner` akan tersensor dan log jadi tidak berguna.
Kehati-hatian ini juga yang membuat redaction tidak pernah menyensor lebih dari
yang perlu — QA harus tetap bisa membaca datanya.

### 5.4 Yang saya tambahkan di luar README (silakan tolak)

**Query string URL.** `?token=abc` di URL sama bocornya dengan header
`Authorization`, dan URL selalu tampil di daftar log. Nilai query dengan nama
sensitif diganti `[REDACTED]`. README bagian 11 hanya menyebut "field body", jadi
ini perluasan tafsir dari saya.

**Argumen objek `console.*`.** `console.log(config)` dengan `config.apiKey` di
dalamnya akan ikut masuk file export. Saat serialisasi argumen console, key
sensitif juga disensor.

Keduanya membuat redaction lebih ketat, bukan lebih longgar, dan mudah dimatikan
(satu pemanggilan di `rapspect-core.js`). Tapi tetap perubahan yang tidak
tertulis di README, jadi saya catat di sini dan di laporan akhir.

### 5.5 Batas yang jujur

- **Response body tidak dibaca sama sekali**, jadi tidak ada yang perlu
  diredaksi di sana. Ini sesuai README bagian 4.
- Body request yang berupa `ReadableStream`, `Blob`, atau `ArrayBuffer` dicatat
  sebagai `[binary body not captured]`. Membaca stream akan **mengonsumsi** body
  dan merusak request halaman. Alat uji tidak boleh mengubah hal yang diuji.
- Password yang diketik di form login **tidak** tertangkap kecuali ikut terkirim
  di body `fetch`/XHR yang kita lihat. Kita tidak memasang listener ke input
  form, dan tidak akan.
- Redaction di v1 **selalu aktif dan tidak bisa dimatikan**. Indikator di panel
  menampilkan statusnya sesuai README bagian 11. README bagian 13 menempatkan
  "redaction yang bisa dikonfigurasi" di v1.1, jadi tombol mematikannya tidak
  saya buat sekarang.
- `console.*` masih bisa ditambal ulang oleh halaman setelah kita. Halaman yang
  sengaja melakukan itu bisa menyembunyikan lognya dari Rapspect. Tidak ada
  pertahanan penuh untuk ini tanpa CDP.

---

## 6. Fitur yang dikorbankan karena pilihan arsitektur ini

| Dikorbankan | Penyebab | Kapan bisa balik |
|---|---|---|
| **Response body** | Butuh `chrome.debugger` atau `chrome.devtools.network` | v2, sesuai README bagian 13 |
| **Ukuran response yang selalu akurat** | Hanya dibaca dari header `Content-Length`. Kalau server tidak mengirimnya (umum pada respons `gzip` atau `chunked`), ukuran tampil `—`. Untuk XHR ada fallback ke panjang `responseText`. Menghitung ukuran sebenarnya berarti membaca body, yang berarti merusak stream halaman | v2 bersama response body |
| **Error CORS dan pelanggaran CSP** | Ini log tingkat browser, tidak pernah lewat console API halaman. Yang kita dapat hanya "request gagal" tanpa alasan persisnya. Ini sudah dicatat README bagian 4 sebagai di luar lingkup | v2 |
| **Request yang bukan `fetch`/XHR** | `<img>`, `<script>`, `<link>`, CSS `url()`, navigasi, WebSocket, `sendBeacon` tidak lewat tambalan kita. Sebagian kegagalan muat resource tetap tertangkap lewat event `error`, tapi tanpa status code | butuh `webRequest` atau CDP |
| **Log dari sebelum content script terpasang** | `document_start` sudah paling awal yang tersedia, tapi tetap ada celah sangat kecil, dan sepenuhnya kosong untuk log yang terjadi sebelum halaman di-reload. Ini alasan empty state berbunyi "reload the page to start tracking" | tidak bisa, sifat bawaan |
| **Log lintas sesi** | Buffer di `storage.session`, hilang saat Chrome ditutup. Sengaja: isinya bisa mengandung sisa data sensitif, dan README bagian 4 mengeluarkan penyimpanan lintas sesi dari v1 | keputusan desain, bukan kekurangan |
| **Ikon Lucide di UI** | README bagian 8 mewajibkan Lucide dan melarang menggambar ikon sendiri. Tanpa `npm install` dan tanpa mengambil file dari internet, saya tidak punya path SVG Lucide yang bisa saya jamin benar. Menggambar sendiri melanggar README. Jadi v1 memakai **label teks** (`Clear`, `Export JSON`, `Failed only`) yang justru persis gaya yang diminta README bagian 10 | begitu file SVG Lucide ditaruh manual di `assets/ui/`. Daftar ikon yang dibutuhkan ada di README bagian 8 |
| **Virtual scrolling di daftar log** | Tidak dibuat, dan tidak dibutuhkan: buffer dibatasi 500 baris. Menambah virtualisasi hanya menambah kode yang harus kamu baca tanpa manfaat terukur | kalau buffer nanti dinaikkan jauh di atas 500 |
| **Pause capture** | README bagian 13 menempatkannya di v1.1 | v1.1 |
| **Ketajaman ikon di 16x16** | Keempat PNG sudah ada dan terpasang, tapi hasil pengecilan satu gambar. Di 16px wajah onta jadi gumpalan; hanya cincin navy yang terbaca | butuh varian 16 dan 32 digambar ulang dari vektor, lihat bagian 3.4 |

---

## 7. Keputusan kecil yang tetap perlu jejak

### 7.1 Pembatas navigasi, bukan auto-clear

Saat halaman di-reload atau URL berubah, buffer **tidak** dikosongkan. Yang
disisipkan adalah satu entri `navigation` sebagai pembatas. Alasannya dari sudut
pandang QA: error yang muncul **sebelum** redirect sering justru penyebab
masalahnya. Menghapusnya otomatis berarti membuang bukti. Untuk mengosongkan ada
tombol `Clear` yang eksplisit.

Reload memicu dua sinyal sekaligus (content script baru dan `tabs.onUpdated`),
jadi ada dedupe: pembatas dengan URL sama dalam 1500 ms terakhir tidak
digandakan.

### 7.2 `tools/serve.js`

Halaman `file://` punya origin opaque, jadi `fetch` ke `https://` dari sana
diblokir CORS. Akibatnya skenario "fetch berhasil" dan "fetch 404" di
`test-page.html` **tidak bisa** diuji dari `file://` — keduanya akan tampil
sebagai gagal, dan kamu tidak bisa membedakan bug Rapspect dari batasan browser.

Karena itu `test-page.html` sebaiknya dibuka lewat `http://localhost`.
`tools/serve.js` memakai modul bawaan Node (`http`, `fs`, `path`) saja: tidak ada
`npm install`, tidak ada `package.json`, tidak ada dependency. Node terdeteksi
ada di mesin ini (`C:\Program Files\nodejs\node.exe`). File ini murni alat bantu
uji dan **tidak** menjadi bagian dari extension.

Kalau kamu memilih tetap memakai `file://`, nyalakan "Allow access to file URLs"
di halaman detail extension. Console, uncaught error, unhandled rejection, dan
fetch ke domain tidak ada tetap bisa diuji; dua skenario fetch sisanya tidak.

### 7.3 Font

README bagian 7 mewajibkan Inter untuk UI dan JetBrains Mono untuk isi log.
Kedua font tidak dibundel dan tidak diambil dari jaringan: MV3 melarang remote
code dan menambah file font berarti menambah aset yang harus di-review
lisensinya. Yang dipakai adalah nama font lebih dulu, lalu fallback yang sudah
ditulis README sendiri. Di Windows hasil praktisnya `Segoe UI` untuk UI dan
`Consolas` atau `Cascadia Code` untuk log — keduanya monospace sejati, jadi
syarat "timestamp, status code, dan JSON harus rata kolom" tetap terpenuhi.

### 7.4 Tema hanya di kulit aplikasi (README bagian 5)

Aturan ini ditegakkan begini: warna level (`--rp-error`, `--rp-warn`,
`--rp-info`, `--rp-debug`) dipakai **hanya** untuk badge level dan garis tipis di
tepi kiri baris. Teks isi log selalu `--rp-text`. Tidak ada latar baris berwarna
merah atau kuning, tidak ada emoji, tidak ada animasi, tidak ada gradient di
area daftar.

Navy dan cream hanya hidup di header, toolbar, dan tombol utama. Tidak ada satu
pun istilah teknis yang diterjemahkan ke kosakata gurun: `Network` tetap
`Network`, `Error` tetap `Error`, `404` tetap `404`. Satu-satunya tempat karakter
onta muncul adalah empty state, persis seperti yang diizinkan README bagian 10.

### 7.5 Tidak ada hex di tengah kode

Seluruh nilai warna hidup di satu blok token di awal `panel.css`. Termasuk hal
yang gampang lolos: warna shadow dan overlay modal punya tokennya sendiri
(`--rp-shadow`, `--rp-overlay`), supaya tidak ada `rgba(0,0,0,.4)` nyempil di
tengah file.

### 7.6 Dua self-test, dan kenapa hanya dua

Instruksi kerja melarang menambah test suite yang tidak diminta, dan saya setuju
dengan alasannya. Tapi ada dua hal di proyek ini yang kalau salah, akibatnya
bukan "UI jelek":

**`tools/selftest-redaction.js`** — 46 pemeriksaan. Redaction yang bolong berarti
token masuk ke file export, lalu menempel di bug report atau repo publik. Itu
tidak bisa diverifikasi dengan mata: yang harus dibuktikan bukan hanya "menyensor
yang sensitif", tapi juga "TIDAK menyensor yang biasa" — dan yang kedua justru
lebih mudah rusak. Hasil terakhir: 46 pemeriksaan, 0 gagal.

**`tools/selftest-contrast.js`** — audit kontras yang bisa dijalankan ulang.
Bagian 1.5 di dokumen ini menyatakan audit harus diulang kalau nilai token
diperbarui dari file sumber vektor. Kalau audit itu hanya hidup sebagai tabel di
dokumen, tidak ada yang akan mengulanginya. Skrip ini juga sengaja memeriksa
nilai **asli README** dan melaporkan kalau ternyata lolos — artinya kalau temuan
di bagian 1.3 keliru, skripnya sendiri yang memberi tahu.

Keduanya memakai modul bawaan Node saja, tidak ada `npm install`, tidak ada
framework, dan tidak dimuat Chrome. Selain dua ini tidak ada test lain, karena
sisanya memang lebih cepat dan lebih jujur diverifikasi manual lewat
`docs/TESTING.md`.
