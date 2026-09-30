# Rapspect — Panduan Pengujian Manual

Dokumen untuk QA. Tidak butuh pengetahuan build tool: tidak ada `npm install`,
tidak ada compile, tidak ada langkah build. Folder ini dimuat apa adanya.

- Chrome minimum: **114** (side panel butuh 114+, `world: "MAIN"` butuh 111+)
- Folder proyek: `C:\Users\babaj\.kiro\crew\workspace\Rabspect`

---

## 1. Menjalankan server uji lokal (lakukan ini dulu)

Alasannya penting, bukan formalitas: `test-page.html` yang dibuka lewat
`file://` tidak bisa melakukan `fetch` lintas origin karena origin-nya opaque.
Skenario "fetch 200" dan "fetch 404" akan sama-sama tampil gagal, dan kamu tidak
bisa membedakan bug Rapspect dari batasan browser.

Buka PowerShell di folder proyek:

```powershell
cd C:\Users\babaj\.kiro\crew\workspace\Rabspect
node tools/serve.js
```

Output yang diharapkan:

```
Rapspect test server
  root : C:\Users\babaj\.kiro\crew\workspace\Rabspect
  open : http://localhost:8080/test-page.html
  stop : Ctrl+C
```

Kalau port dipakai proses lain: `node tools/serve.js 8081`.
Biarkan jendela ini terbuka selama pengujian. Hentikan dengan `Ctrl+C`.

Kalau kamu memilih tetap memakai `file://`: buka `chrome://extensions`, klik
**Details** pada Rapspect, nyalakan **Allow access to file URLs**. Console,
uncaught error, unhandled rejection, XHR, dan fetch ke domain mati tetap bisa
diuji. Dua skenario fetch yang butuh CORS tidak bisa.

---

## 1.1 Dua pemeriksaan otomatis sebelum pengujian manual

Keduanya selesai dalam satu detik dan tidak butuh Chrome. Jalankan setiap kali
kode di `src/shared/rapspect-core.js` atau token warna di `src/panel/panel.css`
diubah.

```powershell
node tools/selftest-structure.js
node tools/selftest-redaction.js
node tools/selftest-contrast.js
node tools/selftest-highlight.js
node tools/selftest-report.js
```

`selftest-structure.js` memeriksa sambungan proyek: path yang dirujuk manifest,
daftar putih izin, setiap `getElementById` di `panel.js` yang harus punya
elemennya di `panel.html`, dan bahwa keempat ikon benar-benar PNG. Yang
diharapkan: `22 pemeriksaan, 0 gagal`.

`selftest-highlight.js` memeriksa tokenisasi pewarnaan sintaks. Yang diuji bukan
"warnanya benar" tapi "teksnya utuh": menggabungkan kembali seluruh token harus
menghasilkan teks asli yang identik. Yang diharapkan: `39 pemeriksaan, 0 gagal`.

`selftest-report.js` memeriksa pembangun laporan Markdown dan Jira. Yang paling
berguna: setiap baris tabel Markdown harus punya jumlah pemisah kolom yang sama —
itu yang menangkap karakter `|` di dalam isi log yang lupa diescape, dan
satu-satunya cara mengetahuinya tanpa menempelkan ke tiket sungguhan. Yang
diharapkan: `49 pemeriksaan, 0 gagal`.

`selftest-redaction.js` memeriksa 46 hal: header dan field yang wajib disensor,
**dan** nama field biasa yang tidak boleh ikut tersensor (`shipping`, `pinned`,
`spinner`). Yang diharapkan: `46 pemeriksaan, 0 gagal`.

`selftest-contrast.js` menghitung ulang seluruh rasio kontras token warna dengan
rumus WCAG 2.1. Yang diharapkan: `Semua warna yang dipakai lolos ambang 4.5:1`.
Bagian "nilai asli README" memang menampilkan `confirmed failing` — itu bukti
temuan di `docs/DECISIONS.md` bagian 1.3, bukan kegagalan.

Kalau salah satu skrip keluar dengan exit code selain 0, **hentikan pengujian
manual** dan perbaiki dulu. Khususnya yang redaction: lanjut menguji dengan
redaction bolong berarti kamu berpotensi menyalin token asli ke bug report.

---

## 2. Load unpacked di chrome://extensions

1. Buka `chrome://extensions` di address bar. Jangan lewat Google — halaman ini
   tidak bisa dibuka dari link.
2. Nyalakan **Developer mode** (toggle di kanan atas).
3. Klik **Load unpacked**.
4. Pilih folder **`Rabspect`** — folder yang berisi `manifest.json`.
   Jangan memilih `src`, dan jangan memilih file `manifest.json` itu sendiri.
5. Kartu extension bernama **Rapspect 1.0.0** akan muncul.

Yang normal terlihat setelah langkah ini:

- Ikon di toolbar berupa **logo onta**: badge navy dengan latar dalam cream.
  Kalau yang muncul puzzle piece generik, Chrome menyembunyikannya di menu
  overflow — klik ikon puzzle lalu pin Rapspect.
- Di ukuran 16px wajah ontanya memang tidak tajam. Ikon sekarang hasil
  pengecilan satu gambar, bukan digambar ulang khusus ukuran kecil; lihat
  `docs/DECISIONS.md` bagian 3.4. Ini bukan error.
- Kartu extension menampilkan tautan **service worker** (kadang tertulis
  "Inspect views service worker"). Kalau ada label **Errors** berwarna merah,
  klik dan baca isinya — itu bukan normal.

Catat **ID extension** dari kartu itu kalau nanti perlu melaporkan masalah.

---

## 3. Membuka Rapspect: dua permukaan, pilih sesuai kebutuhan

Rapspect punya **dua** tempat tampil dengan isi yang sama persis. Yang berbeda
hanya ukuran dan satu tombol.

### 3.1 Popup (klik ikon toolbar)

Klik ikon Rapspect di toolbar. Kotak Rapspect muncul menggantung di bawah ikon.
Kalau ikonnya tidak kelihatan, klik ikon puzzle di toolbar lalu pin Rapspect.

Cocok untuk: pemeriksaan cepat. Lihat error terakhir, salin, tutup.

**Yang harus kamu tahu:** popup **tertutup begitu kamu mengklik halaman.** Itu
sifat popup Chrome, bukan bug. Kalau kamu perlu mengawasi log sambil mengklik
halaman, pakai side panel.

### 3.2 Side panel (tetap terbuka)

Tiga cara:

1. Buka popup, klik tombol **Open side panel** di kanan atas. Popup menutup
   sendiri, panel terbuka di sisi kanan.
2. Klik ikon **side panel** di toolbar Chrome, lalu pilih **Rapspect**.
3. Menu tiga titik Chrome → **Extensions** → Rapspect.

Cocok untuk: sesi pengujian panjang. Panel tetap terbuka saat kamu berinteraksi
dengan halaman, dan tidak perlu membuka DevTools sama sekali.

Tombol **Open side panel** butuh Chrome 116+. Kalau Chrome-mu lebih lama,
tombolnya berubah jadi `Needs Chrome 116+` — pakai cara 2 atau 3.

### 3.3 Tab di dalam panel

Tujuh tab: `All`, `Error`, `Warn`, `Info`, `Log`, `Debug`, `Network`. Masing-masing
membawa hitungan isinya.

Tab ini **lensa ke satu aliran yang sama**, bukan tujuh laporan terpisah. `All`
adalah default dan tetap gabungan, supaya hubungan antara error console dan
request yang gagal tetap terlihat berurutan — itu masalah utama yang mau
diselesaikan Rapspect (README bagian 2). Tab lain hanya mempersempit tampilan.

Hitungan di tiap tab ikut menghormati pencarian dan centang `Failed only` yang
sedang aktif, jadi angkanya selalu sama dengan jumlah baris yang akan kamu lihat
saat tab itu dibuka.

**Urutan yang benar:** buka panel dulu, baru reload halaman. Rapspect hanya
melihat apa yang terjadi setelah dia terpasang di halaman. Itu sebabnya empty
state berbunyi "reload the page to start tracking".

---

## 4. Reload extension setelah mengubah kode

Aturannya berbeda tergantung file yang kamu ubah.

| File yang diubah | Yang harus dilakukan |
|---|---|
| `src/panel/panel.html` / `.css` / `.js` | Tutup popup atau side panel, buka lagi. Cukup itu. File yang sama dipakai kedua permukaan, jadi keduanya ikut terbarui |
| `src/background/service-worker.js` | Klik **Reload** (ikon panah melingkar) di kartu extension |
| `src/content/*.js`, `src/shared/rapspect-core.js` | Klik **Reload** di kartu extension, **lalu reload halaman yang diuji**. Dua-duanya, berurutan |
| `manifest.json` | Klik **Reload**. Kalau muncul error, hapus extension lalu Load unpacked lagi |

Kenapa content script butuh dua langkah: content script yang sudah tersuntik di
halaman tidak diganti oleh reload extension. Yang lama menjadi "zombi" —
kodenya jalan tapi `chrome.runtime` sudah mati. Rapspect mendeteksi ini dan
berhenti mengirim, jadi kamu tidak akan melihat error berantai, tapi kamu juga
tidak akan melihat log baru sampai halaman di-reload.

Gejala khasnya: setelah reload extension, panel berhenti menerima entri baru
sampai kamu menekan F5 di halaman.

---

## 5. Melihat log service worker

1. Buka `chrome://extensions`.
2. Pada kartu Rapspect, klik tautan **service worker**.
3. DevTools terbuka khusus untuk service worker. Buka tab **Console**.

Saat sehat kamu akan melihat:

```
[Rapspect] service worker aktif, buffer maksimum 500 entri per tab
```

Baris itu muncul **setiap kali** worker bangun dari tidur, bukan sekali seumur
hidup. Melihatnya berulang adalah normal di MV3.

Status **inactive** di kartu extension juga normal — worker memang dimatikan
Chrome setelah beberapa puluh detik tanpa event. Membuka jendela inspect-nya
membangunkannya kembali.

Untuk melihat log dari halaman panel (bukan service worker): klik kanan di dalam
side panel → **Inspect**.

---

## 6. Checklist verifikasi manual

Persiapan untuk semua langkah: server uji jalan (bagian 1), extension ter-load
(bagian 2), panel terbuka (bagian 3), dan `http://localhost:8080/test-page.html`
terbuka di tab aktif.

### 6.1 Dasar

| ID | Langkah | Expected Result |
|---|---|---|
| V-01 | Load unpacked folder `Rabspect` | Kartu "Rapspect 1.0.0" muncul tanpa label **Errors** merah |
| V-02 | Periksa daftar izin di kartu extension | Hanya muncul akses baca/ubah data di semua situs. Tidak ada permintaan debugger |
| V-03 | Klik ikon Rapspect di toolbar | **Popup** muncul menggantung di bawah ikon, header navy bertulisan "Rapspect" beserta logo onta |
| V-04 | Buka panel di tab kosong (`about:blank`) lalu lihat pesannya | Muncul notice, bukan daftar kosong tanpa penjelasan |
| V-05 | Buka `chrome://settings` lalu lihat panel | Tampil `Can't read this page. Extensions can't access chrome:// or Web Store pages.` |
| V-06 | Buka panel, lalu buka `test-page.html` di tab baru **tanpa** reload | Empty state: `No tracks yet — reload the page to start tracking.` |
| V-07 | Tekan F5 di `test-page.html` | Panel terisi dalam 1–2 detik, minimal 14 entri |

### 6.2 Penangkapan console

| ID | Langkah | Expected Result |
|---|---|---|
| V-08 | Klik **console.log** di halaman uji | Baris baru, tag `LOG`, teks `T-01 plain log from the test page { step: 1, ok: true }` |
| V-09 | Klik **console.info** | Tag `INFO`, garis tepi kiri warna info (teal) |
| V-10 | Klik **console.warn** | Tag `WARN`, garis tepi kiri kuning |
| V-11 | Klik **console.error** | Tag `ERROR`, garis tepi kiri merah, tombol `details` tersedia |
| V-12 | Klik `details` pada baris V-11 | Blok detail menampilkan stack trace. Tidak ada baris yang menyebut `capture-main.js` atau `rapspect-core.js` |
| V-13 | Klik **console.debug** | Tag `DEBUG`, warna debug (abu-abu kebiruan) |
| V-14 | Buka DevTools halaman uji (F12), ulangi V-08 | Log muncul di **kedua** tempat: Console DevTools dan panel Rapspect. Rapspect tidak menelan log |

### 6.3 Penangkapan network

| ID | Langkah | Expected Result |
|---|---|---|
| V-15 | Klik **fetch 200** | Baris `NET`, `GET 200`, durasi dalam ms, URL `.../todos/1`. Level info |
| V-16 | Klik **fetch 404** | Baris `NET`, `GET 404`, level error (garis tepi merah) |
| V-17 | Klik **fetch to a domain that does not exist** | Baris `NET` dengan `FAILED`, bukan angka status. `details` menyebut `network error: ...` |
| V-18 | Klik **XMLHttpRequest** | Baris `NET`, `GET 200`, `details` menampilkan `transport : xhr` dan header `X-Test-Case: T-10` |
| V-19 | Periksa kolom ukuran pada V-15 | Ukuran tampil dalam B/kB, atau tanda hubung kalau server tidak mengirim `Content-Length`. Keduanya sah |
| V-20 | Buka `details` pada request apa pun | Ada baris `note : response body is never captured`. Tidak ada isi response di mana pun |

### 6.4 Crash

| ID | Langkah | Expected Result |
|---|---|---|
| V-21 | Klik **uncaught error** | Baris `ERROR` berisi `Uncaught ... T-12 uncaught error from the test page` beserta nama file, baris, dan kolom |
| V-22 | Klik **unhandled promise rejection** | Baris `ERROR` berisi `Unhandled promise rejection: Error: T-13 ...` |
| V-23 | Klik **broken image (resource error)** | Baris `ERROR` berisi `Failed to load resource: <img> https://rapspect-this-host-does-not-exist.invalid/missing-image.png` |

### 6.5 Redaction (README bagian 11 — wajib lolos semua)

| ID | Langkah | Expected Result |
|---|---|---|
| V-24 | Klik **POST with fake Authorization**, buka `details` | `Authorization: [REDACTED]` dan `X-Api-Key: [REDACTED]` |
| V-25 | Pada baris yang sama, periksa header `X-Request-Id` | Tampil apa adanya: `visible-request-id-T11`. Redaction tidak boleh menyensor berlebihan |
| V-26 | Pada baris yang sama, periksa request body | `password`, `apiKey`, `refreshToken`, dan `pin` semuanya `[REDACTED]`. `username` dan `note` tetap terbaca |
| V-27 | Pada baris yang sama, lihat kolom pesan | Ada penanda `[N redacted]` dengan N minimal 6 |
| V-28 | Klik **console.log with secret object**, baca barisnya | `apiKey`, `accessToken`, dan `pin` jadi `[REDACTED]`. `safeValue` dan `endpoint` tetap terbaca |
| V-29 | Cari `SHOULD-NOT-APPEAR` di kotak Search | **0 hasil.** Ini pemeriksaan paling penting di seluruh dokumen ini |
| V-30 | Export JSON, buka file hasilnya di editor, cari `SHOULD-NOT-APPEAR` | **0 hasil** |
| V-31 | Lihat indikator di footer panel | `Redaction ON` dengan border hijau. Hover menampilkan daftar header dan field yang disensor |

### 6.6 Filter, search, dan aksi

| ID | Langkah | Expected Result |
|---|---|---|
| V-32 | Klik **Run all scenarios**, lalu matikan chip `Log` | Semua baris tag `LOG` hilang. Hitungan "shown" turun, "captured" tidak berubah |
| V-33 | Matikan semua chip kecuali `Error` | Hanya baris error dan pembatas `PAGE` yang tampil. Pembatas navigasi memang dikecualikan dari filter level |
| V-34 | Centang **Failed only (status >= 400)** | Hanya baris `NET` dengan `404` dan `FAILED`. Semua entri console hilang, termasuk `console.error` |
| V-35 | Hapus centang Failed only, ketik `404` di Search | Hanya baris yang memuat teks `404` |
| V-36 | Ketik `T-11` di Search | Baris POST dengan Authorization muncul, termasuk kecocokan di dalam request body |
| V-37 | Kosongkan Search | Seluruh baris kembali |
| V-38 | Klik **Copy as text**, tempel ke Notepad | Ada 6 baris header berawalan `#`, lalu satu baris per entri dengan format `[hh:mm:ss.mmm] TAG ...` |
| V-39 | Klik **Export JSON** | Muncul dialog peringatan yang menyebut daftar header dan field tersensor. Belum ada file terunduh |
| V-40 | Klik **Cancel** di dialog | Dialog tertutup, tidak ada file terunduh |
| V-41 | Klik **Export JSON** lalu **Download** | File `rapspect-localhost-<tanggal>-<waktu>.json` terunduh. Isinya punya `redaction.enabled: true` |
| V-42 | Nyalakan Failed only, lalu Export JSON | File hanya berisi entri yang sedang tampil. `filters.failedOnly` bernilai `true` |
| V-43 | Klik **Clear** | Panel kembali ke empty state. Hitungan jadi `0 shown / 0 captured` |
| V-44 | Reload halaman uji setelah Clear | Entri baru masuk kembali |

### 6.7 Tema dan keterbacaan

| ID | Langkah | Expected Result |
|---|---|---|
| V-45 | Klik **Light mode** | Panel jadi terang. Label tombol berubah jadi `Dark mode` |
| V-46 | Tutup panel, buka lagi | Tema terang masih terpakai (tersimpan di `storage.local`) |
| V-47 | Di light mode, baca baris warning | Teks `WARN` berwarna kuning gelap (`#8A6100`), jelas terbaca. Bukan kuning cerah yang memudar |
| V-48 | Di kedua tema, perhatikan baris ganjil dan genap | Zebra striping terlihat, dan teks isi log sama terbacanya di kedua warna baris |
| V-49 | Periksa isi teks baris log di kedua tema | Teks pesan selalu warna teks normal, tidak pernah diwarnai per level. Warna hanya di badge dan garis tepi kiri |
| V-50 | Cari istilah bertema gurun di seluruh UI | Tidak ada. `Network`, `Error`, `404` apa adanya. Karakter onta hanya di empty state |

### 6.8 Ketahanan (bagian yang paling sering luput diuji)

| ID | Langkah | Expected Result |
|---|---|---|
| V-51 | Biarkan Chrome idle 1 menit sampai service worker `inactive`, lalu reload halaman uji | Log baru tetap masuk. Entri lama masih ada, tidak hilang |
| V-52 | Klik **Reload** di kartu extension **tanpa** reload halaman | Panel berhenti menerima entri baru. Tidak ada error bertumpuk di console halaman |
| V-53 | Lanjutan V-52: reload halaman uji | Entri masuk normal kembali |
| V-54 | Buka dua tab `test-page.html`, jalankan skenario di masing-masing | Panel hanya menampilkan log tab yang aktif. Tidak ada log tab lain yang bocor |
| V-55 | Pindah antar tab dengan panel terbuka | Header panel ikut berubah, dan daftar log ikut berganti mengikuti tab aktif |
| V-56 | Tutup salah satu tab uji, buka lagi | Tab baru mulai dari nol. Buffer tab yang ditutup dibuang |
| V-57 | Klik **Run all scenarios** 40 kali (tahan Enter di tombol) | Hitungan "captured" berhenti di 500, tidak terus naik. Panel tetap responsif |
| V-58 | Di halaman uji buka DevTools, jalankan `history.pushState({}, '', '/fake-route')` | Muncul baris `PAGE` berisi `Page load: .../fake-route`. Log sebelumnya tidak terhapus |
| V-59 | Reload halaman uji, hitung baris `PAGE` | Tepat **satu** baris per reload, bukan dua. Dedupe bekerja |
| V-60 | Di DevTools halaman uji jalankan `console.log('after devtools')` | Baris masuk ke panel. Rapspect dan DevTools bisa hidup bersamaan tanpa konflik |

### 6.9 Keadaan kosong, penanda filter, dan ikon

Delapan langkah ini menguji perbaikan yang lahir dari pengujian nyata, bukan dari
spesifikasi awal. Keduanya pernah benar-benar membingungkan saat dipakai.

| ID | Langkah | Expected Result |
|---|---|---|
| V-61 | Setelah **Run all scenarios**, centang **Failed only** lalu matikan chip `Error` | Daftar kosong **dengan penjelasan**, bukan area kosong tanpa keterangan. Muncul `21 entries captured, none match the current filter.` (angka mengikuti jumlah sebenarnya) |
| V-62 | Baca baris kedua pada notice V-61 | Menyebut filter yang aktif satu per satu, misalnya `Active: "Failed only (status >= 400)" is on; muted levels: error.` |
| V-63 | Periksa footer saat notice V-61 tampil | `0 shown / 21 captured (buffer 500)`. Jumlah captured tidak berubah — filter menyembunyikan, bukan menghapus |
| V-64 | Klik **Reset filters** pada notice itu | Semua chip menyala kembali, centang Failed only hilang, kotak Search kosong, dan seluruh baris muncul |
| V-65 | Ketik `zzzzz` di Search pada halaman yang sudah punya log | Notice yang sama muncul, dan penjelasnya menyebut `search is "zzzzz"` dengan huruf apa adanya seperti yang diketik |
| V-66 | Bandingkan notice ini dengan empty state di V-06 | Dua teks yang **berbeda**. `No tracks yet` menyuruh reload halaman; notice filter menyuruh mengubah filter. Keduanya tidak boleh tertukar |
| V-67 | Perhatikan chip level yang menyala dan yang mati | Chip menyala punya titik **terisi penuh**. Chip mati punya titik **berongga**, labelnya dicoret, dan tampak lebih redup. Perbedaannya terlihat tanpa mengandalkan warna |
| V-68 | Nyalakan dan matikan chip `Debug` bergantian | Perbedaan nyala dan mati jelas terlihat. Sebelum perbaikan, chip Debug yang aktif tampak seperti chip mati karena warnanya nyaris sama dengan warna chip nonaktif |

### 6.10 Popup, side panel, tab, dan animasi

| ID | Langkah | Expected Result |
|---|---|---|
| V-69 | Klik ikon toolbar | Popup terbuka, lebar kira-kira 460px, tinggi 580px. Tidak ada scrollbar horizontal |
| V-70 | Dengan popup terbuka, klik di halaman | Popup tertutup. Ini sifat popup Chrome, bukan bug |
| V-71 | Buka popup, klik **Open side panel** | Popup menutup sendiri, side panel terbuka di kanan dengan isi yang sama |
| V-72 | Bandingkan popup dan side panel | Isi identik: tab yang sama, tombol yang sama, daftar yang sama. Bedanya hanya ukuran, dan tombol **Open side panel** tidak ada di side panel |
| V-73 | Periksa baris log yang timestamp-nya panjang, misalnya `19:06:44.859` | Timestamp dan badge level **tidak bertumpuk**. Ada jarak yang jelas di antaranya, dan angka rata kolom antar baris |
| V-74 | Jalankan **Run all scenarios**, lihat hitungan di tiap tab | Setiap tab punya angka. Tab yang kosong angkanya `0` dan tampak lebih redup |
| V-75 | Klik tab **Error** | Hanya baris level error: `console.error`, uncaught error, unhandled rejection, resource gagal, dan request dengan status >= 400 |
| V-76 | Klik tab **Network** | Hanya baris `NET`. Tidak ada entri console |
| V-77 | Klik tab **Network** pada halaman yang belum punya request `fetch`/XHR | Muncul keterangan bahwa hanya `fetch()` dan `XMLHttpRequest` yang ditangkap, dan bahwa stylesheet, gambar, serta script tidak akan pernah muncul |
| V-78 | Klik tab **All** | Semua kembali, termasuk pembatas `PAGE` |
| V-79 | Klik tab **Info**, cari baris `PAGE` | Pembatas navigasi **tidak** muncul di tab Info, hanya di tab All |
| V-80 | Tekan Tab sampai fokus ada di salah satu tab, lalu tekan panah kanan dan kiri | Tab berpindah mengikuti panah, dan isinya ikut berganti. `Home` ke tab pertama, `End` ke terakhir |
| V-81 | Ketik `404` di Search, lalu lihat hitungan tab | Angka di tiap tab ikut menyusut mengikuti pencarian. Angka tab selalu sama dengan jumlah baris yang tampil saat tab itu dibuka |
| V-82 | Biarkan panel terbuka, lalu picu log baru dari halaman uji | Baris baru masuk dengan fade singkat. Baris yang sudah ada **tidak** berkedip |
| V-83 | Lanjutan V-82: perhatikan hitungan tab yang bertambah | Angkanya berdenyut sekali saat naik. Saat turun karena filter, tidak berdenyut |
| V-84 | Nyalakan Windows Settings → Accessibility → Visual effects → matikan animasi, lalu buka panel lagi | Tidak ada animasi sama sekali. Panel tetap berfungsi penuh |
| V-85 | Klik tombol apa pun dan tahan | Tombol mengecil sedikit selama ditekan, lalu kembali |

### 6.11 Tombol tutup

Perilakunya **memang berbeda** antara popup dan side panel, dan itu bukan bug.
`chrome.sidePanel` tidak menyediakan `close()`; alasannya di
`docs/DECISIONS.md` bagian 2.6b.

| ID | Langkah | Expected Result |
|---|---|---|
| V-86 | Buka popup, lihat kanan atas header | Ada tombol `×` bundar di sebelah tombol tema |
| V-87 | Arahkan kursor ke tombol `×` | Latar bundarnya menjadi navy lebih gelap. Tooltip berbunyi `Close` |
| V-88 | Klik `×` di popup | Popup tertutup. Tidak ada keterangan apa pun yang muncul |
| V-89 | Buka side panel, klik `×` di header Rapspect | **Salah satu dari dua ini, dua-duanya sah:** panel tertutup, **atau** panel tetap terbuka dan muncul satu baris keterangan yang menunjuk `×` milik Chrome di atas |
| V-90 | Kalau keterangan di V-89 muncul, tunggu 8 detik | Keterangan hilang sendiri tanpa perlu diklik |
| V-91 | Kalau keterangan di V-89 muncul, tekan `Escape` | Keterangan langsung hilang |
| V-92 | Di popup, tekan `Escape` | Popup tertutup |
| V-93 | Klik **Export JSON** lalu tekan `Escape` | Yang tertutup **dialognya**, bukan panelnya. Panel tetap terbuka |
| V-94 | Lanjutan V-93: tekan `Escape` sekali lagi | Sekarang permukaannya yang tertutup |
| V-95 | Dengan screen reader aktif, fokuskan tombol `×` | Dibacakan sebagai `Close Rapspect`, bukan sekadar "x" atau "times" |

### 6.12 Gulir, pencarian, dan pewarnaan sintaks

| ID | Langkah | Expected Result |
|---|---|---|
| V-96 | Isi panel sampai melebihi tinggi layar, gulir ke dasar, lalu picu log baru | Tampilan tetap menempel di dasar. Entri baru langsung terlihat tanpa menggulir |
| V-97 | Gulir ke tengah daftar, lalu picu log baru | Posisi baca **tidak bergeser**. Muncul tombol mengapung di bawah bertuliskan `N new entries` |
| V-98 | Klik tombol mengapung itu | Melompat ke dasar, tombolnya hilang |
| V-99 | Gulir sendiri ke dasar tanpa mengklik tombol | Tombolnya hilang sendiri dan hitungannya lupa, tidak menumpuk dari sebelumnya |
| V-100 | Klik **Run all scenarios** 40 kali sampai hitungan mencapai 500, sambil membaca baris di tengah | Baris yang sedang dibaca tetap di tempatnya walaupun ring buffer membuang baris dari atas |
| V-101 | Dengan 500 entri, ketik perlahan di kotak Search | Tidak ada lag mengetik. Sebelum perbaikan, satu ketikan memicu sekitar 4.000 pembangunan string |
| V-102 | Klik **console.error** di halaman uji, buka `details` | Nama tipe `Error` **tebal**. Kata `at` dan tanda kurung lebih redup daripada teks sekitarnya |
| V-103 | Pada stack trace yang sama, perhatikan path file | Path berwarna violet. Angka `:27:27075` di ujungnya berwarna berbeda dari path-nya |
| V-104 | Bandingkan warna violet path dengan warna teal level `Info` | Jelas dua warna berbeda. Ini yang menjaga aturan satu warna satu makna |
| V-105 | Klik **POST with fake Authorization**, buka `details` | `[REDACTED]` berwarna kuning dan tebal, menonjol di antara header lain |
| V-106 | Periksa baris `NET` | URL-nya diwarnai sama seperti path di stack trace — "ini sebuah lokasi" berarti hal yang sama di mana pun muncul |
| V-107 | Baca isi pesan log biasa, misalnya `T-01 plain log...` | Teks pesannya **tidak** diwarnai. Hanya bagian berstruktur yang berwarna; sisanya warna teks normal |
| V-108 | Ganti ke light mode, ulangi V-102 sampai V-107 | Semua bagian tetap terbaca. Violet jadi lebih gelap, angka jadi olive |
| V-109 | Jalankan `node tools/selftest-highlight.js` | `39 pemeriksaan, 0 gagal` |

### 6.13 Ekspor siap tempel, pause, pengelompokan, dan preferensi

| ID | Langkah | Expected Result |
|---|---|---|
| V-110 | Klik **Export** | Dialog muncul dengan pemilih format, default **Markdown**. Ada tombol **Copy** dan **Download** |
| V-111 | Pilih Markdown, klik **Copy**, tempel ke editor Markdown atau komentar GitHub | Tabel ter-render rapi. Tidak ada kolom yang bergeser, tidak ada baris tabel yang terpotong |
| V-112 | Pada hasil V-111, periksa baris tabel metadata | Ada Page, Title, Captured, View, Entries, Summary, Redaction |
| V-113 | Pada hasil V-111, cari blok `<details>` | Stack trace dan detail request ada di dalamnya, bukan di tabel utama |
| V-114 | Picu log yang isinya mengandung karakter `\|`, lalu ekspor Markdown | Tabelnya tetap utuh. Karakter pipa muncul sebagai `\\\|` di sumbernya |
| V-115 | Pilih **Jira wiki markup**, Copy, tempel ke deskripsi tiket Jira | Tabel ter-render. Stack trace tampil di blok `{noformat}`, bukan `{code}` |
| V-116 | Pilih **JSON**, klik **Download** | File `rapspect-<host>-<waktu>.json` terunduh, isinya JSON yang sah |
| V-117 | Pilih **Markdown**, klik **Download** | File berekstensi `.md`, bukan `.json` |
| V-118 | Nyalakan tab `Error`, lalu ekspor Markdown | Baris `View` menyebut `tab error`. Isi laporan hanya yang terlihat di tab itu |
| V-119 | Klik **copy** pada satu baris log, tempel | Hanya baris itu, beserta blok detailnya kalau ada. Tombolnya berubah jadi `copied` sesaat |
| V-120 | Klik **copy** pada baris yang punya `details` | Detailnya **tidak** ikut terbuka di panel. Klik copy tidak memicu toggle |
| V-121 | Klik **Pause** | Tombol berubah jadi `Resume` dan mewarna warn. Penanda `PAUSED` muncul di footer |
| V-122 | Selagi paused, picu banyak log dari halaman uji | Daftar **tidak berubah sama sekali**. Penanda berubah jadi `PAUSED +N` dengan N bertambah |
| V-123 | Selagi paused, perhatikan hitungan di tab | Angkanya **beku**, tidak ikut bertambah. Angka bergerak sementara daftar diam itu membingungkan |
| V-124 | Klik **Resume** | Semua entri yang tertahan muncul sekaligus. Penanda hilang. Tidak ada yang hilang |
| V-125 | Tutup panel selagi paused, buka lagi | Panel **tidak** paused. Status ini sengaja tidak diingat |
| V-126 | Di halaman uji, klik **console.error** delapan kali berturut-turut | Satu baris saja dengan penanda `×8`, bukan delapan baris |
| V-127 | Buka `details` pada baris V-126 | Ada baris `repeated : 8 times, first at ..., last at ...` |
| V-128 | Hapus centang **Group repeats** | Delapan baris terpisah muncul kembali. Hitungan di footer ikut berubah |
| V-129 | Dengan grouping aktif, periksa hitungan footer | Berbunyi seperti `12 rows (19 entries) / 64 captured` saat pengelompokan benar-benar menggabungkan sesuatu |
| V-130 | Buka blok **Extra redaction**, ketik `sessionId`, tunggu satu detik | Penanda footer berubah jadi `Redaction ON +1`. Hover menampilkan nama yang kamu tambahkan |
| V-131 | Di halaman uji, jalankan di console: `fetch('/x',{method:'POST',body:JSON.stringify({sessionId:'SECRET-ABC'})})` | Baris network-nya muncul dengan `sessionId` tersensor `[REDACTED]` |
| V-132 | Coba masukkan `ab` di Extra redaction | Ditolak, penanda tidak bertambah. Nama di bawah tiga karakter akan menyensor hampir semua field |
| V-133 | Kosongkan Extra redaction | Penanda kembali `Redaction ON`. Daftar bawaan **tetap** berlaku — uji ulang V-24 sampai V-29 |
| V-134 | Pilih tab `Warn`, centang Failed only, tutup panel, buka lagi | Tab `Warn` dan centang Failed only masih terpasang |
| V-135 | Ketik sesuatu di Search, tutup panel, buka lagi | Kotak Search **kosong**. Pencarian sengaja tidak diingat |
| V-136 | Jalankan `node tools/selftest-report.js` | `49 pemeriksaan, 0 gagal` |

---

## 7. Masalah umum dan solusinya

### 7.1 Panel kosong

Urutkan dari kemungkinan terbesar.

| Gejala | Penyebab | Solusi |
|---|---|---|
| Empty state `No tracks yet` padahal halaman sudah dipakai | Panel dibuka **setelah** halaman dimuat. Rapspect hanya melihat kejadian setelah dia terpasang | Reload halaman (F5). Ini memang yang diinstruksikan teks empty state |
| Muncul notice `Can't read this page...` | Tab aktif adalah `chrome://`, `chrome-extension://`, `about:`, `view-source:`, atau Chrome Web Store. Chrome melarang semua extension menyuntik ke sana | Buka halaman web biasa. Bukan bug, dan tidak bisa diperbaiki dari sisi kode |
| Notice menyebut **Allow access to file URLs** | Halaman dibuka dari `file://` | `chrome://extensions` → **Details** pada Rapspect → nyalakan **Allow access to file URLs** → reload halaman. Lebih baik lagi: pakai `node tools/serve.js` |
| Header panel menampilkan judul tab yang **salah** | Panel masih menunjuk tab sebelumnya | Klik tab yang dituju sekali lagi. Panel mengikuti `chrome.tabs.onActivated` |
| Muncul `N entries captured, none match the current filter.` | Datanya ada, tapi filter yang aktif menyembunyikan semuanya. Penyebab paling sering: centang **Failed only (status >= 400)** masih menyala dari pemeriksaan sebelumnya | Baris kedua notice itu menyebut filter mana yang aktif. Klik **Reset filters** untuk mengembalikan semuanya sekaligus |
| Panel kosong tanpa teks apa pun, padahal footer menulis `0 shown / N captured` | Seharusnya tidak terjadi lagi — keadaan ini sekarang selalu memunculkan notice beserta tombol Reset filters | Kalau masih terjadi, itu bug. Sertakan isi console panel (klik kanan di panel lalu Inspect) saat melaporkannya |

### 7.2 Log tidak muncul

| Gejala | Penyebab | Solusi |
|---|---|---|
| Entri berhenti masuk setelah kamu mengubah kode | Extension di-reload, tapi content script di halaman masih versi lama dan context-nya sudah mati | Reload halaman yang diuji. Selalu dua langkah: reload extension, lalu reload halaman |
| **DevTools Network penuh, tab Network Rapspect kosong** | Lihat kolom **Type** di DevTools. Kalau isinya `stylesheet`, `script`, `img`, `font`, atau `document`, resource itu dimuat browser sendiri lewat tag HTML dan **tidak pernah** melewati `fetch` atau `XMLHttpRequest`. Hanya baris bertipe `fetch` dan `xhr` yang bisa ditangkap Rapspect | Bukan bug. Batas yang diketahui, tercatat di `docs/DECISIONS.md` bagian 6 dan 2.8. Menambahnya butuh izin `webRequest` atau `chrome.debugger`, keduanya di luar lingkup v1. Tab Network menampilkan keterangan ini saat kosong |
| Request yang kamu cari tidak ada padahal dibuat dengan `fetch` | Request terjadi **sebelum** Rapspect terpasang di halaman | Reload halaman dengan panel sudah terbuka |
| Semua console masuk, tapi request tidak ada | Sama seperti dua baris di atas: `<img>`, `<script>`, `sendBeacon`, dan WebSocket tidak lewat `fetch`/XHR | Batas yang diketahui, `docs/DECISIONS.md` bagian 6 |
| Request masuk, tapi console tidak ada | Halaman menambal ulang `console.*` **setelah** Rapspect | Cek di DevTools: `console.log.toString()`. Kalau bukan milik Rapspect, halaman menimpanya. Tidak bisa diatasi tanpa CDP |
| Beberapa log hilang di halaman yang sangat berisik | Antrean jembatan penuh (batas 1000 entri antar-flush) dan yang tertua dibuang | Wajar. Kalau mengganggu, naikkan `MAX_QUEUE` di `src/content/bridge-isolated.js` |
| Hitungan berhenti di 500 | Ring buffer sudah penuh, entri tertua dibuang. Ini memang spesifikasinya | Klik **Clear**, atau Export JSON sebelum buffer meluap |
| Tidak ada apa pun, dan kartu extension menunjukkan **Errors** | Ada error load, biasanya salah path di `manifest.json` | Klik **Errors** di kartu, baca pesannya, perbaiki, lalu **Reload** |
| Log dari dalam iframe tidak muncul | Untuk iframe `about:blank` atau `srcdoc`, content script bisa tidak tersuntik | Batas yang diketahui. Iframe dengan URL http/https normal tetap tertangkap |

### 7.3 Service worker inactive

Yang paling penting: **`inactive` itu normal, bukan kerusakan.** MV3 memang
mematikan service worker setelah beberapa puluh detik tanpa event.

| Gejala | Penyebab | Solusi |
|---|---|---|
| Kartu extension menulis **service worker (inactive)** | Perilaku normal MV3 | Tidak perlu diapa-apakan. Worker bangun sendiri saat ada pesan masuk |
| Log yang lama hilang setelah idle | Buffer memori ikut hilang saat worker mati, dan cerminan di `storage.session` gagal termuat | Periksa console service worker. Kalau ada `gagal memuat buffer dari storage.session`, pastikan izin `storage` masih ada di `manifest.json` |
| Log hilang total setelah Chrome ditutup dan dibuka | `chrome.storage.session` memang dibuang saat browser tutup | Sesuai desain (README bagian 4: tidak ada penyimpanan lintas sesi). Export JSON sebelum menutup Chrome |
| `[Rapspect] service worker aktif` muncul berulang di console | Worker bangun-tidur berkali-kali | Normal. Baris itu ditulis setiap kali worker dievaluasi |
| Console service worker kosong, dan tidak ada yang bereaksi | Worker crash saat evaluasi, biasanya karena `importScripts` gagal | Cek path `/src/shared/rapspect-core.js` benar-benar ada. Path di `importScripts` diawali `/` dan dihitung dari root extension |
| Panel dibuka tapi entri pertama tidak masuk | Pesan pertama dipakai untuk membangunkan worker dan hilang bersamanya | Sudah ditangani: panel meminta snapshot dua kali dan mengirim `rp:ping` saat start. Kalau masih terjadi, reload halaman |

### 7.3b Popup dan side panel

| Gejala | Penyebab | Solusi |
|---|---|---|
| Popup menutup sendiri terus | Kamu mengklik halaman. Popup Chrome selalu menutup saat kehilangan fokus | Pakai side panel: buka popup lalu klik **Open side panel** |
| Tombol **Open side panel** menampilkan `Needs Chrome 116+` | `chrome.sidePanel.open()` baru tersedia di Chrome 116 | Buka side panel dari ikon side panel di toolbar Chrome, lalu pilih Rapspect |
| Klik ikon toolbar membuka side panel, bukan popup | Sisa setelan `openPanelOnActionClick: true` dari versi Rapspect sebelumnya. Setelan itu bertahan di profil | Klik **Reload** di kartu extension. Service worker menyetelnya ke `false` saat dimuat |
| Popup terlihat terlalu sempit sesaat lalu melebar | Ukuran popup ditulis oleh `panel.js` dari query string, karena CSP MV3 melarang script inline yang bisa menuliskannya lebih awal | Kosmetik, satu frame. Tercatat di `docs/DECISIONS.md` bagian 2.6 |
| Side panel dan popup menampilkan isi berbeda | Seharusnya tidak mungkin: keduanya memuat file yang sama dan membaca buffer yang sama | Kalau terjadi, itu bug. Sertakan isi console kedua permukaan saat melaporkan |

### 7.4 Ikon tidak tampil

| Gejala | Penyebab | Solusi |
|---|---|---|
| Ikon Rapspect tidak terlihat di toolbar sama sekali | Chrome menyembunyikannya di menu overflow, bukan masalah ikon | Klik ikon puzzle di toolbar, lalu pin Rapspect |
| Extension gagal di-load dengan `Could not load icon` | Salah satu dari keempat PNG hilang atau namanya berubah. Chrome menolak extension **sepenuhnya**, bukan cuma mengosongkan ikonnya | Pastikan `assets/icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` ada, semua huruf kecil. Buat ulang dengan `powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1` |
| Ikon muncul sebagai papan catur abu-abu | Ikon dibuat dari file JPEG apa adanya. Pola papan catur itu piksel asli, bukan transparansi — JPEG tidak punya alpha channel | Jalankan `tools\make-icons.ps1`; skrip itu mengganti papan catur dengan cream solid dan membuat latarnya transparan |
| Ganti nama file dari `.jpg` ke `.png` tapi tidak ada yang berubah | Mengganti ekstensi tidak mengubah isi file. Isinya tetap JPEG, penanda byte-nya masih `FF D8 FF` | Konversi sungguhan diperlukan. `tools\make-icons.ps1` melakukannya dan menghasilkan PNG asli dengan alpha channel |
| Ikon 16x16 tidak tajam | Hasil pengecilan satu gambar, bukan empat gambar dengan tingkat detail berbeda | Batas yang diketahui, tercatat di `docs/DECISIONS.md` bagian 3.4. Perlu varian 16 dan 32 digambar ulang dari vektor sesuai README bagian 9 |
| Logo di banner README GitHub tidak muncul | README menunjuk `assets/Rapspect.jpg`, dan nama file itu sempat berubah | Pastikan `assets/Rapspect.jpg` ada. README tidak boleh diubah, jadi nama path itu yang harus dipertahankan |
| Logo di header panel tidak muncul | `src/panel/panel.html` memuat `../../assets/icons/icon48.png` | Periksa file itu ada. Halaman extension boleh memuat aset sendiri tanpa `web_accessible_resources` |

---

## 8. Sebelum melaporkan bug Rapspect

Sertakan enam hal ini, supaya tidak perlu tanya-jawab bolak-balik:

1. Versi Chrome (`chrome://version`, baris pertama)
2. URL halaman yang diuji, atau sebut "test-page.html via localhost"
3. Isi console **service worker** (bagian 5)
4. Isi console **panel** (klik kanan di panel → Inspect)
5. File hasil **Export JSON** — sudah diredaksi, aman dilampirkan
6. ID checklist yang gagal, misalnya "V-24 gagal"
