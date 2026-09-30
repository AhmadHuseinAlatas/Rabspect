# Rapspect — Backlog

Catatan pekerjaan yang belum selesai, ditulis supaya tidak hilang saat pekerjaan
dilanjutkan di sesi lain.

Status: extension **bisa di-load unpacked dan berfungsi**. Semua yang masih
terbuka di bawah adalah penyempurnaan, bukan perbaikan agar bisa jalan.

Terakhir diperbarui: 2026-09-30

---

## Masih terbuka

Tiga sisa ini **tidak bisa saya selesaikan sendiri**. Dua butuh keputusanmu, satu
butuh desainer.

### B-04 — Rapikan aset logo yang menumpuk *(butuh keputusanmu)*

Tiga file berisi **byte yang identik**, ketiganya JPEG:

```
Rapspect.jpg              di root
assets/Rapspect.jpeg      hasil penamaan ulang olehmu
assets/Rapspect.jpg       saya buat ulang supaya banner README tidak broken
```

Git menyimpan blob identik hanya sekali, jadi ukuran repo tidak membengkak. Yang
mengganggu adalah working tree-nya: tiga nama untuk satu gambar.

Yang perlu kamu putuskan, dan batasannya:

- `README.MD` menunjuk `assets/Rapspect.jpg`, jadi **path itu harus tetap ada**.
  Kalau dihapus, banner di GitHub kembali broken
- `assets/branding/logo-badge-512.png` adalah versi bersih: PNG sungguhan,
  transparan, papan catur sudah hilang. Ini yang layak jadi sumber raster
- penghapusan file saya serahkan ke kamu, karena instruksi kerja melarang saya
  menghapus apa pun

Saran: pertahankan `assets/Rapspect.jpg` dan `assets/branding/logo-badge-512.png`,
hapus dua sisanya.

### B-05 — Ikon 16px dan 32px perlu digambar ulang *(butuh desainer)*

Keempat PNG sekarang hasil **pengecilan** satu gambar, bukan penyederhanaan
progresif yang diminta README bagian 9. Konsekuensinya sudah terlihat: di 16x16
wajah ontanya jadi gumpalan pucat, hanya cincin navy-nya yang masih terbaca.

Yang dibutuhkan: varian 16 dan 32 digambar dari vektor, tanpa tassel dan tanpa
gigi, sesuai tabel tingkat detail README bagian 9. Ukuran 48 dan 128 sudah
memadai apa adanya. README bagian 9 juga masih meminta `logo-master.svg`, yang
tidak bisa diturunkan dari raster.

Begitu file barunya ada, timpa saja file di `assets/icons/` dengan nama yang
sama — `manifest.json` tidak perlu diubah. Untuk membuat ulang dari sumber baru:

```powershell
powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1 -Source assets\Rapspect.jpeg
```

### B-07 — Bahasa dokumentasi *(butuh keputusanmu)*

Permintaanmu menyebut "bahasa Inggris", sedangkan `README.MD` bagian 10
menetapkan **dokumentasi Bahasa Indonesia** dan label UI Bahasa Inggris. Yang
saya lakukan: mengikuti README, jadi `docs/*.md` tetap Bahasa Indonesia,
sedangkan label UI panel dan pesan commit Git berbahasa Inggris.

Kalau seluruh dokumentasi mau dipindah ke Bahasa Inggris, `README.MD` bagian 10
harus dikoreksi lebih dulu — README adalah sumber kebenaran dan saya tidak
mengubahnya.

---

## Selesai

Dicatat supaya tidak dikerjakan dua kali.

### B-01 — Status "tidak ada yang cocok" di panel ✅

Sebelumnya, kalau filter menyembunyikan semua baris, area daftar hanya jadi
kosong tanpa penjelasan: footer menulis `1 shown / 21 captured` sementara layar
tampak kosong, dan tidak ada petunjuk bahwa penyebabnya centang **Failed only**.

Yang sekarang ada di `src/panel/panel.js`:

- `render()` membedakan **empat** keadaan: halaman terblokir, belum ada data,
  ada data tapi tersaring habis, dan ada yang bisa ditampilkan
- `hideAllNotices()` dipanggil di awal setiap cabang, supaya tidak ada sisa
  panel dari keadaan sebelumnya yang menempel
- `describeActiveFilters()` menyebut filter yang aktif satu per satu, misalnya
  `Active: "Failed only (status >= 400)" is on; muted levels: error.` Teks
  pencarian diambil dari nilai input, bukan dari `state.query` yang sudah
  dijadikan huruf kecil
- `resetFilters()` mengembalikan semua chip, centang, dan pencarian sekaligus,
  terhubung ke tombol `Reset filters` di notice

Pesannya sengaja dibedakan dari empty state: `No tracks yet` menyuruh reload
halaman, notice filter menyuruh mengubah filter. Diverifikasi lewat
`docs/TESTING.md` V-61 sampai V-66.

### B-02 — Sinkronkan dokumentasi dengan keadaan ikon ✅

- `docs/DECISIONS.md` — temuan **T4** ditandai selesai; bagian **3.3** ditulis
  ulang menjadi catatan cara ikon dibuat; bagian **3.4** baru berisi batas ikon
  sekarang; baris "fitur yang dikorbankan" di bagian 6 diperbarui dari "ikon
  belum ada" menjadi "ketajaman di 16x16"
- `docs/TESTING.md` — bagian **2** dan **7.4** tidak lagi menyebut puzzle icon
  sebagai perilaku yang diharapkan. Bagian 7.4 sekarang juga menjawab dua
  kebingungan nyata: ganti ekstensi `.jpg` ke `.png` yang tidak mengubah apa pun,
  dan `Could not load icon` yang menolak extension sepenuhnya
- `assets/icons/README.txt` — ditulis ulang: isi folder, cara membuatnya ulang,
  dan apa yang masih perlu desainer

### B-03 — Keputusan warna `--rp-debug` masuk jejak audit ✅

Ada di `docs/DECISIONS.md` bagian **1.6**, ditulis sebagai temuan lengkap karena
pelajarannya bukan tentang satu warna.

| Tema | README bagian 6 | Dipakai | Kontras | Jarak ke `--rp-text-muted` |
|---|---|---|---|---|
| dark | `#9AA8BC` | `#7EA8DB` | 6.93:1 di bg, 5.17:1 di zebra | 28 → 48 |
| light | (tidak ada) | `#3F5A80` | 6.32:1 di bg | 0 → 32 |

Inti temuannya: `#5A6B7F` lolos kontras 4.91:1 dengan nyaman, dan tetap membuat
UI tidak terpakai — karena nilainya persis sama dengan warna chip yang mati,
sehingga chip Debug yang aktif terlihat seperti chip mati. Ambang 4.5:1 hanya
menjawab "apakah teks terbaca di atas latarnya", bukan "apakah dua hal yang
berbeda makna terlihat berbeda".

`tools/selftest-contrast.js` sekarang menegakkan keduanya: kontras, **dan** jarak
minimum antar token yang berisiko bertabrakan.

Status chip juga tidak lagi bergantung pada warna saja: aktif memakai titik
terisi, mati memakai titik berongga ditambah label dicoret.

### B-06 — `.gitignore` ✅

Ditambahkan. Yang paling penting di dalamnya: `rapspect-*.json`, yaitu pola nama
file hasil **Export JSON** dari panel. Isinya log dari halaman yang diuji, dan
walaupun redaction selalu aktif, file itu tetap tidak layak ikut ter-commit ke
repo publik. Sisanya sampah bawaan sistem dan editor.

### Sudah selesai sejak sebelumnya

- Lapisan penangkap data: `console.*`, `fetch`, `XMLHttpRequest`, uncaught error,
  unhandled rejection, dan gagal muat resource
- Jembatan MAIN world → ISOLATED → service worker, termasuk penanganan
  "extension context invalidated" setelah reload extension
- Ring buffer 500 entri per tab, dicerminkan ke `chrome.storage.session`
- Redaction dua lapis sesuai README bagian 11, diperluas ke query string URL dan
  argumen objek `console.*`. Diverifikasi 46 pemeriksaan, semuanya lolos
- Side panel: filter level, filter request gagal, search, Clear, Copy as text,
  Export JSON beserta dialog peringatan, dan toggle tema
- Audit kontras seluruh token, termasuk pembuktian bahwa empat nilai light mode
  di README bagian 6 gagal ambang 4.5:1
- Ikon extension 16/32/48/128 sebagai PNG sungguhan dengan alpha channel, papan
  catur di dalam badge diganti cream solid, latar luar transparan
- `test-page.html` dengan 14 skenario yang sengaja gagal
- `docs/TESTING.md`: 68 baris checklist verifikasi manual dan troubleshooting

---

## Cara melanjutkan

```powershell
cd C:\Users\babaj\.kiro\crew\workspace\Rabspect
node tools/selftest-redaction.js      # harus: 46 pemeriksaan, 0 gagal
node tools/selftest-contrast.js       # harus: semua warna lolos 4.5:1
node tools/serve.js                   # lalu buka http://localhost:8080/test-page.html
```

Tidak ada lagi item yang tertunda di tengah jalan. B-04 dan B-07 menunggu
keputusanmu, B-05 menunggu desainer.
