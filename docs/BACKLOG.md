# Rapspect — Backlog

Catatan pekerjaan yang belum selesai, ditulis supaya tidak hilang saat pekerjaan
dilanjutkan di sesi lain.

Status commit ini: extension **bisa di-load unpacked dan berfungsi**. Semua yang
ada di bawah adalah penyempurnaan, bukan perbaikan agar bisa jalan.

Terakhir diperbarui: 2026-09-29

---

## Sedang dikerjakan, tertunda di tengah jalan

### B-01 — Status "tidak ada yang cocok" di panel *(setengah selesai)*

**Masalah.** Kalau filter menyembunyikan semua baris, area daftar hanya jadi
kosong tanpa penjelasan. Ini yang bikin bingung saat pengujian: footer menulis
`1 shown / 21 captured` sementara layar tampak kosong, dan tidak ada petunjuk
bahwa penyebabnya centang **Failed only (status >= 400)**.

**Sudah dikerjakan.**
- `src/panel/panel.html` — section `#rp-nomatch` beserta `#rp-nomatch-title`,
  `#rp-nomatch-why`, dan tombol `#rp-reset` sudah ada
- `src/panel/panel.js` — keempat elemen itu sudah dibaca ke dalam objek `el`

**Belum dikerjakan.**
- `render()` di `src/panel/panel.js` masih membedakan dua keadaan saja
  (terblokir, dan belum ada data). Perlu keadaan ketiga: `state.entries.length > 0`
  tetapi `filtered.length === 0` → tampilkan `#rp-nomatch`, sembunyikan
  `#rp-empty`, dan kosongkan daftar
- Setiap cabang `render()` perlu menyembunyikan `#rp-nomatch` secara eksplisit,
  supaya tidak menempel saat keadaan berubah
- Fungsi `resetFilters()` belum ada: kembalikan semua chip level ke `aria-pressed="true"`,
  hapus centang `#rp-failed`, kosongkan `#rp-search`, lalu `render()`
- Tombol `#rp-reset` belum dipasangi listener
- Teks penjelas perlu menyebut filter mana yang sedang aktif, bukan kalimat
  umum. Contoh: `21 entries captured, none match the current filter.` diikuti
  `Active: "Failed only (status >= 400)" is on; search is "404".`

Sebelum ditandai selesai, verifikasi lewat `docs/TESTING.md` V-34 dan tambahkan
baris checklist baru untuk keadaan ini.

---

## Belum disentuh

### B-02 — Sinkronkan dokumentasi dengan keadaan ikon sekarang

Ikon sudah ada, tapi tiga dokumen masih menulis sebaliknya.

| File | Yang harus diubah |
|---|---|
| `docs/DECISIONS.md` | Temuan **T4** di bagian 0 sudah selesai — manifest sekarang memang menyebut ikon. Bagian **3.3** ("blok ikon yang harus ditempel nanti") sudah tidak berlaku, ganti jadi catatan bahwa bloknya sudah terpasang. Bagian **6** masih menulis "ikon extension di toolbar" sebagai fitur yang dikorbankan |
| `docs/TESTING.md` | Bagian **7.4** masih menyebut ikon puzzle generik sebagai perilaku yang diharapkan. Bagian **2** juga masih menulis hal yang sama |
| `assets/icons/README.txt` | Masih menulis "folder ini MASIH KOSONG dan itu disengaja" |

Tambahkan juga bagian baru di `docs/DECISIONS.md` **1.6** tentang keputusan warna
`--rp-debug` (lihat B-03), karena perubahan itu sudah dilakukan di kode tapi
belum ada jejak auditnya.

### B-03 — Catat keputusan warna `--rp-debug` di jejak audit

Kodenya **sudah** diubah dan `tools/selftest-contrast.js` sudah membuktikannya
lolos, tapi alasannya baru ada sebagai komentar di `src/panel/panel.css`, belum
masuk `docs/DECISIONS.md`.

Ringkasnya, untuk ditulis ulang di dokumen:

| Tema | README bagian 6 | Dipakai | Alasan |
|---|---|---|---|
| dark | `#9AA8BC` | `#7EA8DB` | Nilai README lolos kontras (7.09:1) tapi hampir identik dengan `--rp-text-muted #A8BACD`. Dua token berwarna sama dengan makna berbeda melanggar aturan "satu warna, satu makna". Akibat nyatanya: chip filter Debug yang **aktif** terlihat seperti chip mati |
| light | (tidak ada) | `#3F5A80` | Percobaan pertama `#5A6B7F` **persis sama** dengan `--rp-text-muted`, jadi chip aktif dan chip mati benar-benar tidak bisa dibedakan |

Catat juga bahwa `tools/selftest-contrast.js` sekarang punya pemeriksaan kedua di
luar kontras: jarak minimum antar token yang berisiko bertabrakan. Kontras 4.5:1
bisa lolos sempurna sementara UI-nya tetap tidak terpakai — itu yang terjadi di
kasus ini, dan sekarang ada yang menjaganya.

### B-04 — Rapikan aset logo yang menumpuk

Tiga file berisi **byte yang identik**, semuanya JPEG:

```
Rapspect.jpg              (root)
assets/Rapspect.jpeg
assets/Rapspect.jpg       ditambahkan supaya banner di README tidak broken
```

Git menyimpan blob identik hanya sekali, jadi ukuran repo tidak membengkak, tapi
working tree-nya tetap membingungkan. Yang perlu diputuskan:

- `README.MD` menunjuk `assets/Rapspect.jpg`, jadi path itu harus tetap ada
- `assets/branding/logo-badge-512.png` adalah versi bersih: PNG sungguhan,
  transparan, papan catur sudah hilang. Ini yang seharusnya jadi sumber raster
- penghapusan file saya serahkan ke kamu, karena instruksi kerja melarang saya
  menghapus apa pun

README bagian 9 juga masih meminta `logo-master.svg`. Belum ada, dan tidak bisa
dibuat dari raster — perlu file vektor asli.

### B-05 — Ikon 16px dan 32px perlu digambar ulang

Keempat PNG sekarang hasil **pengecilan** dari satu gambar, bukan penyederhanaan
progresif yang diminta README bagian 9. Konsekuensinya sudah terlihat: di 16x16
wajah ontanya jadi gumpalan pucat, hanya cincin navy-nya yang masih terbaca.

Yang dibutuhkan: varian 16 dan 32 digambar dari vektor tanpa tassel dan tanpa
gigi, sesuai tabel tingkat detail di README bagian 9. Setelah file barunya ada,
taruh langsung di `assets/icons/` — `manifest.json` tidak perlu diubah.

`tools/make-icons.ps1` bisa dijalankan ulang kapan saja kalau file sumber
diperbarui:

```powershell
powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1 -Source assets\Rapspect.jpeg
```

### B-06 — `.gitignore` belum ada

Repo belum punya `.gitignore`. Belum ada yang bocor karena proyek ini tidak punya
build step dan tidak punya `node_modules`, tapi sebaiknya ditambahkan sebelum
ada berkas hasil ekspor atau file sementara editor yang ikut ter-commit.
Kandidat isi: `Thumbs.db`, `desktop.ini`, `.DS_Store`, `*.log`,
`rapspect-*.json` (hasil Export JSON dari panel).

### B-07 — Bahasa dokumentasi

Permintaan terakhir menyebut "bahasa Inggris", sedangkan `README.MD` bagian 10
menetapkan **dokumentasi Bahasa Indonesia** dan label UI Bahasa Inggris. Saya
mengikuti README dan membiarkan `docs/*.md` dalam Bahasa Indonesia; label UI di
panel sudah Bahasa Inggris.

Ini perlu keputusanmu: kalau seluruh dokumentasi mau dipindah ke Bahasa Inggris,
`README.MD` bagian 10 harus dikoreksi lebih dulu, karena README adalah sumber
kebenaran dan saya tidak mengubahnya.

---

## Yang sudah selesai dan terverifikasi

Dicatat supaya tidak dikerjakan dua kali.

- Lapisan penangkap data: `console.*`, `fetch`, `XMLHttpRequest`, uncaught error,
  unhandled rejection, dan gagal muat resource
- Jembatan MAIN world → ISOLATED → service worker, termasuk penanganan
  "extension context invalidated" setelah reload
- Ring buffer 500 entri per tab, dicerminkan ke `chrome.storage.session`
- Redaction dua lapis sesuai README bagian 11, diperluas ke query string URL dan
  argumen objek `console.*`. Diverifikasi 46 pemeriksaan di
  `tools/selftest-redaction.js`, semuanya lolos
- Side panel: filter level, filter request gagal, search, Clear, Copy as text,
  Export JSON beserta dialog peringatan, dan toggle tema
- Audit kontras seluruh token, termasuk pembuktian bahwa empat nilai light mode
  di README bagian 6 gagal ambang 4.5:1
- Chip filter: status nyala/mati dibedakan **bentuk** (titik terisi versus titik
  berongga plus label dicoret), bukan hanya warna
- Ikon extension 16/32/48/128 sebagai PNG sungguhan dengan alpha channel, papan
  catur di dalam badge diganti warna solid cream, latar luar transparan
- `test-page.html` dengan 14 skenario yang sengaja gagal
- `docs/TESTING.md`: 60 baris checklist verifikasi manual dan troubleshooting

---

## Cara melanjutkan

```powershell
cd C:\Users\babaj\.kiro\crew\workspace\Rabspect
node tools/selftest-redaction.js      # harus: 46 pemeriksaan, 0 gagal
node tools/selftest-contrast.js       # harus: semua warna lolos 4.5:1
node tools/serve.js                   # lalu buka http://localhost:8080/test-page.html
```

Urutan yang disarankan: **B-01** lebih dulu karena itu satu-satunya yang
tertunda di tengah jalan, lalu **B-03** dan **B-02** karena keduanya hanya
menulis dokumen, lalu sisanya.
