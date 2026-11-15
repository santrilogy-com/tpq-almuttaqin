# Review Keamanan — Fitur Login ID + Kata Sandi (PWA TPQ Al-Muttaqin v2)

- **Penulis:** Wira (spesialis keamanan + QA)
- **Tanggal:** 15 Nov 2026
- **Ruang lingkup:** `~/workspace/tpq-madin-app/pwa-v2/` (`engine.js`, `app.js`,
  `index.html`, `sw.js`, `manifest.json`, `API.md`). Produksi (`pwa/`) tidak
  disentuh; `engine.js`/`app.js` tidak diubah oleh Wira.
- **Skill yang dipakai:** `security-and-hardening` (threat model STRIDE, OWASP),
  `code-review-and-quality` (review lima sumbu), `browser-testing-with-devtools`
  (prinsip verifikasi: visibilitas nyata, bukan sekadar DOM), `superpowers`
  (verification-before-completion), `ponytail` (perbaikan minimal).

## 0. Status saat review ditulis — baca ini dulu

Review ini dikerjakan dalam dua gelombang, dan itu dicatat jujur:

1. **Gelombang pertama (±11:26 WIB):** mesin auth BELUM ADA di kode
   (0 kemunculan `masukPengguna`/`sesiAktif`/dsb.). Review awal ditulis
   terhadap kontrak + kode yang ada.
2. **Gelombang kedua (±11:28–11:35 WIB):** Baskara mendaratkan mesin auth
   (`engine.js` 1.996 → 2.313 baris) dan Kirana mendaratkan UI login
   (`app.js` 2.119 → 2.550 baris) **sementara review berjalan**. Saya
   membaca ulang implementasi aslinya dan **menulis ulang review ini
   berdasarkan kode yang benar-benar ada**. Semua temuan di bawah mengutip
   nomor baris dari kode final tersebut; temuan gelombang pertama yang
   ternyata sudah dijawab oleh implementasi dipindah ke §4 ("sudah benar")
   atau dihapus.

**Yang sudah diverifikasi ada dan bekerja (diuji lewat harness jsdom,
§8):** hash SHA-256 kata sandi + salt acak, sesi 7 hari dengan cek
kedaluwarsa, pesan error login generik, normalisasi ID, tolak hapus diri +
Pimpinan terakhir, gerbang login + penjaga rute di `render()`, menu/tab
disaring per peran, layar ganti sandi paksa, `esc()` konsisten.

**Yang masih bermasalah:** backup/sinkron/reset masih membawa kredensial
(K2/K3/K4), ganti sandi paksa bisa dilewati dengan muat ulang (K1b),
selftest live meninggalkan sandi admin berubah (S10), dan engine tidak
memeriksa peran peminta (S9).

## 0b. Batasan yang wajib dipahami semua orang (bukan catatan kaki)

> **Ini pengaman lokal di perangkat, bukan auth server.** Semua data —
> termasuk hash kata sandi dan sesi login — tersimpan di localStorage
> perangkat yang sama dengan aplikasinya. Siapa pun yang memegang perangkat
> dan bisa membuka DevTools (F12) dapat membaca localStorage, menghapus
> kunci sesi, atau memanggil fungsi engine langsung dari console. Auth ini
> **hanya** menghalangi pengguna biasa yang salah peran di perangkat bersama
> (mis. guru membuka Keuangan); ia **bukan** perlindungan terhadap penyerang
> yang punya akses ke perangkat. Jangan pernah mengklaim lebih dari itu
> kepada klien.

Target keamanan yang realistis: (1) pengguna biasa tidak bisa salah masuk
modul, (2) kata sandi tidak bocor lewat jalur yang tidak disengaja (backup,
sinkron, file yang dibagikan), (3) tidak ada jalan pintas (backdoor) di kode.

## 1. Temuan KRITIS

### K1. [KODE ADA — sebagian sudah diperbaiki Kirana] Penjaga rute ada di `render()`, tapi `go()` dan fungsi render langsung tidak dijaga
- **Tingkat:** kritis (bagian yang sudah diperbaiki) + sedang (sisanya, lihat
  di bawah).
- **Yang sudah benar (terverifikasi):**
  - `app.js` `render()` (~baris 373–400): tanpa sesi → `tampilLogin()`
    dan return sebelum konten apa pun di-render; `wajibGantiSandi` →
    `tampilGantiSandi()`; rute terlarang → `toast('Tidak ada akses')` +
    kembali ke `dashboard` + hash diubah. Termasuk navigasi lewat hash
    manual (listener `hashchange` memanggil `render()`).
  - `renderShell()` (~299): sidebar difilter `modulTampil()` → `bolehRute()`
    → `bolehAkses()`; tab bar Guru memakai `GURU_TABS`; `openLainnya()`
    juga difilter. Menu terlarang tidak ada di DOM untuk Guru.
  - `bersihkanShellLogin()` mengosongkan `#view`/`#sidebar`/`#bottomnav`
    saat layar login tampil.
- **Sisa celah:**
  1. `go(route)` (`app.js` ~296) hanya `location.hash = ...` tanpa cek —
     perlindungannya sepenuhnya bergantung pada `render()`. Ini masih aman
     selama setiap perubahan hash memicu `render()` (terjamin oleh listener
     `hashchange` + pemanggilan eksplisit), tapi `go()` bukan titik
     pertahanan kedua. Bila ada satu jalur yang mengubah hash tanpa
     `render()`, guard lolos.
  2. Fungsi render langsung (`renderSantriOnly` ~753, `renderGuruOnly`
     ~1068) menulis ke `#view` tanpa memeriksa sesi/peran. Guru yang
     membuka console bisa memanggil `renderGuruOnly()` dan melihat modul
     Guru yang seharusnya terlarang. Di model lokal ini **tidak menambah
     risiko nyata** (localStorage sudah terbuka untuk siapa saja yang bisa
     membuka console — lihat §0b), jadi dicatat sebagai R6, bukan kritis.
- **Perbaikan yang diminta:** tambah cek `bolehRute()` di `go()` sebagai
  pertahanan kedua (murah, satu baris); pertimbangkan guard yang sama di
  `renderSantriOnly`/`renderGuruOnly` bila nanti ada pemisahan hak yang
  lebih ketat.

### K1b. [KODE ADA] Ganti sandi paksa bisa dilewati dengan muat ulang halaman
- **Tingkat:** sedang.
- **Bukti (dibaca dari kode):**
  - `engine.js` `masukPengguna()` (~467): sandi benar → sesi **langsung
    dibuat**, dan hanya mengembalikan flag `wajibGantiSandi: true`. Sesi
    tidak membawa flag itu (`sesiAktif()` ~478 mengembalikan hanya
    `{ id, nama, peran }`).
  - `app.js:289–292`: `var wajibGantiSandi = false;` — penanda ini
    **in-memory saja**. Kirana sendiri menulis di komentarnya: "sesiAktif
    tidak membawa flag ini, jadi setelah muat ulang dengan sesi lama, mesin
    yang harus menolak atau menandai ulang. Catatan untuk Baskara."
  - `app.js` `render()` (~383): `if (wajibGantiSandi) { tampilGantiSandi(); return; }`
- **Serangan (terverifikasi lewat baca kode, belum dites live):** Pimpinan
  login pertama kali → layar ganti sandi → tekan muat ulang (atau tutup
  lalu buka lagi aplikasi) **sebelum** ganti sandi → sesi 7 hari masih
  valid, flag in-memory kembali `false` → dashboard terbuka tanpa sandi
  default pernah diganti. Sandi `admin123` yang sudah diketahui semua orang
  tetap aktif, dan sesi Pimpinan hidup 7 hari.
- **Perbaikan yang diminta (pilih satu):**
  1. **(Disarankan, Baskara)** `sesiAktif()` ikut mengembalikan
     `wajibGantiSandi` dari `db.pengguna` (atau `masukPengguna` menulis
     flag itu ke objek sesi), dan `render()` memakai flag dari sesi,
     bukan dari memori.
  2. **(Alternatif, Kirana)** `render()` memeriksa ulang
     `cariPengguna(sesi.id).wajibGantiSandi` dari `db` setiap kali render.
  3. Sampai diperbaiki, JANGAN anggap "wajib ganti" sudah ditegakkan.

### K2. [KODE ADA, TERVERIFIKASI] Backup / restore bisa menjadi jalan pintas menjadi Pimpinan
- **Tingkat:** kritis.
- **Bukti (dibaca dari kode):**
  - `engine.js` `backupJSON()` (~1324): membuang **seluruh `db`**,
    termasuk `db.pengguna` (id, nama, peran, **salt + hash**). Selftest
    engine sendiri mencatatnya sebagai perilaku yang diterima:
    "Backup JSON memuat pengguna (salt+hash) tanpa kata sandi plaintext".
  - `engine.js` `applyBackupData()` (~1350–1370): bila file cadangan
    memuat `pengguna`, **pengguna lokal diganti seluruhnya** dengan isi
    file setelah `bersihkanPengguna()`.
  - `engine.js` `bersihkanPengguna()` (~444): hanya memvalidasi **bentuk**
    (`id` string, `salt` string, `hash` 64 hex, peran Pimpinan/Guru).
    Hash buatan penyerang yang bentuknya benar **lolos validasi**.
- **Serangan:** penyerang membuat file JSON cadangan berisi
  `{ ..., pengguna: [{ id:'admin', peran:'Pimpinan', salt:'x',
  hash: SHA256('x:rahasia'), wajibGantiSandi:false }] }`, pulihkan lewat
  menu Pengaturan (atau `restoreFromText()` dari console) → ia menjadi
  Pimpinan dengan sandi `rahasia`, tanpa tahu sandi lama. Validasi bentuk
  tidak bisa membedakan hash penyerang dari hash asli — itu memang bukan
  tugasnya.
- **Efek samping yang sama parahnya:** restore file cadangan lama
  **menghapus akun-akun baru** (termasuk sandi Pimpinan yang sudah diganti)
  dan mengembalikan akun dari file — termasuk akun seed `admin/admin123`
  bila file itu dari instalasi segar.
- **Perbaikan yang diminta:**
  1. **(Disarankan)** `applyBackupData`/`restoreFromText` JANGAN PERNAH
     mengganti `db.pengguna` dari file. Selalu pertahankan pengguna lokal
     (cabang `data.pengguna === undefined` sudah melakukan ini — jadikan
     itu satu-satunya perilaku). Bila file membawa pengguna, abaikan
     dengan pesan "pengguna dari cadangan diabaikan demi keamanan".
  2. Bila poin 1 ditolak (butuh migrasi akun antar perangkat): restore
     pengguna hanya boleh dilakukan Pimpinan yang **sudah login**, dan
     file harus ditandai/ diverifikasi — ini butuh desain baru, jangan
     diakali dengan validasi bentuk.
  3. `backupJSON()` sebaiknya membuang `db.pengguna` dari file (atau
     memberi peringatan eksplisit di UI bahwa file mengandung hash
     kredensial).
  4. Tambah selftest engine: restore file dengan pengguna Pimpinan
     buatan → pengguna lokal tidak berubah.

### K3. [KODE ADA, TERVERIFIKASI] Sinkron mengirim seluruh `db` (termasuk salt+hash) ke Google Apps Script
- **Tingkat:** kritis.
- **Bukti:** `engine.js` `flushSync()` (~950): body POST adalah
  `JSON.stringify({ ..., token: cfg.syncToken || '', data: db })`.
  `db` memuat `db.pengguna` lengkap. Setiap `save()` mengantrekan
  perubahan (`enqueueChange`), jadi setiap tambah/reset/ganti sandi
  memicu pengiriman hash ke Sheet saat online.
- **Serangan:** hash + salt tersimpan di Google Sheet / log Apps Script —
  dibaca siapa saja yang punya akses Sheet, dan bisa di-brute-force
  offline (lihat S1). Ini kebocoran kredensial ke pihak ketiga (Google)
  yang tidak pernah disetujui dalam desain.
- **Perbaikan yang diminta:** bentuk payload sinkron dari allowlist kunci
  (seperti pola `applyPulledData` yang sudah benar), dan **jangan pernah**
  sertakan `pengguna`. Selftest: payload yang dibangun `flushSync` tidak
  mengandung kata `pengguna`/`hash`/`salt`. Perhatian: `syncToken` sudah
  dikirim sebagai field terpisah — itu memang dirancang begitu (kata sandi
  bersama lembaga), bukan bagian dari temuan ini.

### K4. [KODE ADA, TERVERIFIKASI] Reset / hapus data mengembalikan kredensial default
- **Tingkat:** kritis (dengan nuansa di bawah).
- **Bukti:**
  - `engine.js` `clearAllData()` (~1845): `db = emptyData(); db.pengguna = seedPengguna();`
    — komentarnya jujur: "Pengguna seed dipertahankan: kalau semua pengguna
    ikut terhapus, tidak ada lagi yang bisa login". `resetToSeed()` →
    `seedData()` juga memuat `seedPengguna()`.
  - Tombol ada di Pengaturan (`app.js` ~943 "Reset ke data contoh" /
    "Hapus semua data") — rute Pengaturan dijaga untuk Pimpinan, jadi
    jalur UI-nya sudah benar.
- **Serangan:** siapa pun yang bisa menekan tombol itu (Pimpinan — atau
  siapa saja lewat console: `clearAllData()` tidak memeriksa peran)
  mengembalikan `admin/admin123` + `guru1/guru123` dengan
  `wajibGantiSandi=true`. Dikombinasikan dengan K1b (muat ulang melewati
  ganti paksa), akun default bisa dipakai tanpa pernah ganti sandi.
- **Perbaikan yang diminta:**
  1. Akun di luar `db` (seperti K2) — maka reset/hapus tidak menyentuh akun.
  2. Bila tetap di `db`: `clearAllData`/`resetToSeed` harus **mempertahankan
     pengguna yang sudah ada beserta sandinya** (seperti `applyBackupData`
     saat file tanpa pengguna), bukan me-reset ke seed. Alasan "supaya tidak
     terkunci" bisa dipenuhi dengan: bila tidak ada pengguna sama sekali,
     baru pakai seed.
  3. Engine: `clearAllData`/`resetToSeed` sebaiknya menolak bila peminta
     bukan Pimpinan (lihat S9).

### K5. [KODE ADA — SUDAH DITANGANI, TINGGAL DIJAGA] `?selftest=1` bukan backdoor
- **Tingkat:** sudah ditangani (dulu kritis).
- **Bukti:** `render()` memeriksa sesi SEBELUM me-render apa pun; tanpa
  sesi, `?selftest=1` hanya menampilkan layar login. Selftest Kirana
  login lewat form asli (`submitLogin`, `app.js` ~2351–2371) — bukan
  dengan memalsukan sesi. Snippet Wira (`selftest-auth-snippet.js`)
  memakai jalur yang sama lewat `masukPengguna` (fungsi yang sama dengan
  form).
- **Yang harus dijaga:** jangan pernah menambahkan jalan pintas "mode tes"
  di `render()` atau `authTersedia()`; bila `authTersedia()` false
  (engine belum ada), aplikasi berjalan tanpa gerbang — itu fallback
  Kirana yang disengaja saat engine belum mendarat, dan **harus dicabut**
  sekarang karena engine sudah ada (bila tidak, menghapus/mengganti
  `engine.js` mematikan login).

## 2. Temuan SEDANG

### S1. [KODE ADA, TERVERIFIKASI] SHA-256 satu ronde tanpa peregangan
- **Tingkat:** sedang.
- **Bukti:** `engine.js` `hashSandi()` = `sha256Hex(salt + ':' + sandi)`,
  satu ronde, implementasi murni JS yang sudah diuji dengan vektor FIPS
  180-4 (kosong, `abc`, 56 karakter NIST). Baskara mendokumentasikan
  alasannya: `crypto.subtle` sengaja tidak dipakai karena async dan
  engine ini sinkron.
- **Risiko:** hash cepat = brute force offline mudah bila hash bocor
  (backup K2, sinkron K3, localStorage). Salt acak per pengguna sudah
  benar (dua pengguna dengan sandi sama punya hash berbeda).
- **Perbaikan yang diminta:** iterasi berulang (mis. 10.000x
  `hash(salt + hash)`) di dalam `hashSandi` sinkron — murah, tidak
  mengubah API, dan memperlambat brute force ~10.000x. Catat jumlah
  iterasi sebagai konstanta + migrasi hash lama (tandai versi di entri
  pengguna). Bila suatu hari engine menjadi async, pindah ke PBKDF2
  `crypto.subtle`.

### S2. [KODE ADA, TERVERIFIKASI] Tanpa batas percobaan login
- **Tingkat:** sedang.
- **Bukti:** `verifikasiLogin()`/`masukPengguna()` (`engine.js` ~462–476)
  tidak menghitung percobaan gagal; tidak ada jeda/kunci. Pesan error
  sudah generik (bagus, lihat §4).
- **Perbaikan yang diminta:** hitung gagal per ID (memori + localStorage);
  setelah 5 gagal, kunci ID itu 5 menit. Pesan tetap generik.

### S8. [KODE ADA, BARU] Salt seed TETAP dan PUBLIK — hash seed adalah nilai yang sudah diketahui
- **Tingkat:** sedang.
- **Bukti:** `engine.js:77–81` — `SALT_SEED_ADMIN =
  'a1b2c3d4e5f60718293a4b5c6d7e8f90'` dan `SALT_SEED_GURU1 =
  '0f1e2d3c4b5a69788796a5b4c3d2e1f0'` adalah konstanta di source,
  didokumentasikan "supaya hasil seed deterministis (tes bisa mengulang
  hash yang sama)". Seed hash = `SHA256(salt-publik + ':' + 'admin123')`
  — bisa dihitung siapa saja yang membaca source.
- **Risiko konkret:** dari SATU file backup / payload sinkron yang bocor,
  penyerang langsung tahu apakah sandi default masih aktif (hash cocok
  dengan nilai yang sudah diketahui) → langsung login sebagai Pimpinan
  tanpa brute force. Jendela risikonya persis saat akun paling rentan
  (sebelum ganti sandi pertama).
- **Perbaikan yang diminta:** seed salt dibuat acak saat instalasi
  pertama dan disimpan (bukan konstanta); atau, minimal, `seedPengguna()`
  memakai `buatSalt()` tiap kali seed dibuat dan salt itu disimpan
  bersama akun (sudah terjadi untuk pengguna baru — samakan untuk seed).
  Catatan: setelah ganti sandi pertama, salt baru yang acak sudah dipakai
  (`gantiSandiSendiri`/`resetSandiPengguna` memanggil `buatSalt()`),
  jadi perbaikan ini hanya menutup jendela awal.

### S9. [KODE ADA, BARU] Engine tidak memeriksa peran peminta pada tambah / reset / hapus pengguna
- **Tingkat:** sedang (di model lokal; lihat §0b).
- **Bukti:**
  - `tambahPengguna(input)` dan `resetSandiPengguna(id, sandiBaru)`
    tidak menerima parameter peminta sama sekali.
  - `hapusPengguna(id, idPeminta)` memeriksa hapus-diri dan Pimpinan
    terakhir, tapi **tidak memeriksa apakah `idPeminta` adalah Pimpinan**.
    `hapusPengguna('guru1', 'guru2')` (Guru menghapus Guru lain) akan
    BERHASIL menurut kode.
  - UI Kirana sudah benar (tombol hanya di Pengaturan = rute Pimpinan),
    tapi UI bukan batas keamanan untuk pemanggil console.
- **Serangan:** Guru yang membuka DevTools bisa memanggil
  `tambahPengguna({id:'x', peran:'Pimpinan', ...})` atau
  `resetSandiPengguna('admin','...')` lalu masuk sebagai Pimpinan.
  Di model lokal ini butuh akses console (setara akses perangkat), jadi
  sedang — tapi ini pertahanan berlapis yang murah dan seharusnya ada.
- **Perbaikan yang diminta:** `tambahPengguna`/`resetSandiPengguna` terima
  `idPeminta` (atau peran peminta) dan tolak bila bukan Pimpinan;
  `hapusPengguna` tolak bila `idPeminta` bukan Pimpinan; `resetSandiPengguna`
  untuk diri sendiri tetap harus lewat `gantiSandiSendiri` (butuh sandi
  lama).

### S10. [KODE ADA, BARU] Selftest live meninggalkan sandi admin berubah menjadi 'sandiuji9'
- **Tingkat:** sedang (kritis bila seseorang menjalankan `?selftest=1` di
  browser dengan data asli).
- **Bukti:** `app.js` ujiUi blok auth Kirana (~2355–2371): login admin →
  ganti sandi paksa ke `'sandiuji9'` → dashboard. Tidak ada langkah yang
  mengembalikan sandi admin ke `'admin123'`. (Alur Guru MENGEMBALIKAN
  guru1 ke `'guru123'` di akhir — admin tidak.) Blok "Kembalikan ke
  keadaan awal" juga tidak menyentuh sandi.
- **Dampak:** di jsdom (harness) tidak masalah — state dibuang tiap run.
  Di browser sungguhan dengan `?selftest=1`, selesai selftest sandi admin
  menjadi `'sandiuji9'` dan `wajibGantiSandi=false`. Mas/Pimpinan akan
  mengira sandinya masih `'admin123'` dan terkunci.
- **Perbaikan yang diminta:** di akhir selftest, kembalikan admin dengan
  `resetSandiPengguna('admin','admin123')` (ini sekaligus mengaktifkan
  lagi `wajibGantiSandi=true` — perilaku yang benar untuk seed). Snippet
  Wira (`selftest-auth-snippet.js` BLOK B) sudah melakukan ini; jadikan
  itu bagian dari FASE 2. Aturan umum: selftest TIDAK BOLEH mengubah
  kredensial nyata tanpa mengembalikan.

### S7. [DESAIN, MASIH BERLAKU] Kredensial default terkenal
- **Tingkat:** sedang.
- **Alasan:** `admin/admin123`, `guru1/guru123` bisa ditebak siapa saja
  yang membaca dokumen ini. Mitigasi (wajib ganti saat login pertama)
  sudah direncanakan — tapi K1b melemahkannya, dan S8 memperpendek
  jendela serangannya.
- **Perbaikan yang diminta:** selesaikan K1b + S8; tambahkan di panduan:
  Pimpinan wajib ganti sandi default SEBELUM perangkat dipakai bersama /
  sebelum data asli dimasukkan.

## 3. Temuan RENDAH

### R1. [KODE ADA — bagus, tinggal dijaga] XSS lewat nama / ID pengguna
- **Tingkat:** rendah.
- **Bukti pola yang sudah benar:** `esc()` (`engine.js` ~343) dipakai di
  semua tempat baru: `tampilLogin` (`esc(_loginIdTerakhir)`),
  `kelolaPenggunaHtml`/`barisPenggunaHtml` (`esc(u.nama)`, `esc(u.id)`,
  `esc(u.peran)` — termasuk di dalam atribut `onclick`), `akunSayaHtml`,
  chip pengguna di sidebar. `fotoAman()` + re-encode canvas di
  `onPhotoChange` juga sudah benar.
- **Sisa:** daftar pengguna UI (`daftarPenggunaUi`, `app.js` ~1151) hanya
  menampilkan `admin` + `guru1` (hardcode) karena engine BELUM menyediakan
  `daftarPengguna()`. Pengguna baru tidak terlihat di UI — jadi tidak bisa
  di-reset/dihapus lewat UI (hanya lewat console). Ini celah fungsional
  (dan keamanan: akun tak terlihat = akun tak terkelola). Minta Baskara
  menambah `daftarPengguna()` yang mengembalikan `penggunaPublik()` +
  `wajibGantiSandi` (tanpa salt/hash).

### R6. [KODE ADA] `gantiSandiSendiri` tidak menolak sandi baru yang sama dengan lama
- **Tingkat:** rendah.
- **Bukti:** `engine.js` `gantiSandiSendiri()` (~534): verifikasi sandi
  lama + minimal 6 karakter, tapi tidak menolak `baru === lama` atau
  `baru === 'admin123'`.
- **Perbaikan yang diminta:** tolak bila sandi baru sama dengan sandi lama
  atau sama dengan sandi default. Pertimbangkan minimal 8 karakter
  (saat ini 6 — keputusan Baskara, dicatat).

### R7. [KODE ADA] `load()` tidak memvalidasi bentuk `pengguna` tersimpan
- **Tingkat:** rendah.
- **Bukti:** `load()` (~290) menggabungkan semua kunci `emptyData()` dari
  localStorage apa adanya; `tambahPengguna` memanggil `db.pengguna.push`
  tanpa memeriksa array. localStorage yang korup/diubah tangan bisa
  membuat crash saat tambah pengguna (bukan kebocoran, tapi kerapuhan).
- **Perbaikan yang diminta:** di `load()`, jalankan `bersihkanPengguna()`
  untuk `d.pengguna` (atau fallback ke seed bila bukan array).

### R3. [DESAIN] Tidak ada jejak audit login
- **Tingkat:** rendah (opsional, boleh ditunda tanpa menunda rilis).
- **Perbaikan yang diminta:** log lokal sederhana (maks. 50 entri, kunci
  terpisah): waktu, ID, berhasil/gagal.

### R4. [KODE ADA] Fallback `authTersedia() === false` mematikan gerbang login
- **Tingkat:** rendah (sekarang), kritis bila dibiarkan.
- **Bukti:** `app.js` `authTersedia()` + `bolehRute()` (`~269–280`):
  bila engine tidak menyediakan fungsi auth, aplikasi berjalan seperti
  dulu tanpa login. Ini fallback yang disengaja saat Baskara masih
  membangun — sekarang engine sudah ada, fallback ini harus dicabut
  (atau dibuat gagal tertutup: tanpa engine auth, tampilkan layar
  "aplikasi rusak, hubungi Pimpinan", bukan dashboard terbuka).

### R5. [KODE ADA] Tidak ada CSP
- **Tingkat:** rendah. Tidak ada `meta` CSP di `index.html`. Catatan lama
  tetap berlaku: CSP penuh butuh refactor `onclick` inline — jangan
  dipaksakan ronde ini.

## 4. Yang sudah BENAR di kode yang ada (jangan dirusak)

- **Sesi (S3, dulu sedang):** `sesiAktif()` memeriksa `kedaluwarsa`
  (7 hari, `SESI_MASA_BERLAKU_MS`), menghapus sesi kedaluwarsa, dan
  mengembalikan hanya `{ id, nama, peran }` tanpa hash/salt. Sesi tidak
  ikut backup dan tidak dikirim ke Sheet (komentar di `engine.js:61`
  dan selftest engine membuktikannya).
- **Error login generik (R2, dulu rendah):** `verifikasiLogin` selalu
  mengembalikan `"ID atau kata sandi salah"` untuk ID salah, sandi salah,
  maupun tanpa sandi — diuji engine.
- **Normalisasi ID (S4, dulu sedang):** `cariPengguna` memakai
  `trim().toLowerCase()`; `tambahPengguna` menolak duplikat
  case-insensitive (diuji engine: `ADMIN` ditolak).
- **Hapus pengguna (S5, dulu sedang):** `hapusPengguna` menolak hapus
  diri dan Pimpinan terakhir (diuji engine).
- **Gerbang login + penjaga rute (K1/K5):** `render()` + `bersihkanShellLogin()`
  + filter menu/tab/Lainnya (lihat §1).
- **Forced change di jalur normal (S6):** `masukPengguna` mengembalikan
  flag; `submitLogin` → `tampilGantiSandi()`; `submitGantiSandiPaksa`
  memvalidasi panjang + konfirmasi + memanggil `gantiSandiSendiri`
  dengan sandi lama dari memori (`_sandiLoginTerakhir`, dibersihkan
  setelah dipakai dan saat keluar — tidak pernah ke localStorage/DOM).
- **`esc()` + `fotoAman()` + pembersihan boundary** (foto/tanggal di
  `load`/`applyBackupData`/`applyPulledData`) — pola yang benar.
- **`applyPulledData` memakai allowlist kunci** — pola yang benar;
  `backupJSON`/`flushSync` belum mengikutinya (K2/K3).
- **SHA-256 diuji dengan vektor FIPS** (kosong, `abc`, NIST 56 karakter).
- **Selftest lama memeriksa visibilitas nyata** (tinggi > 0) — snippet
  auth mengikuti pola yang sama.

## 5. Daftar periksa untuk Baskara (engine) — status per 15 Nov ~11:35 WIB

- [x] Akun sebagai hash + salt acak; sesi 7 hari + cek kedaluwarsa; error
      generik; normalisasi ID; tolak hapus diri + Pimpinan terakhir.
- [ ] **K2:** `applyBackupData` jangan pernah ganti `db.pengguna` dari file.
- [ ] **K3:** `flushSync` strip `pengguna` dari payload (allowlist kunci).
- [ ] **K2/K4:** `backupJSON` buang `pengguna` (atau beri peringatan);
      `clearAllData`/`resetToSeed` pertahankan pengguna yang ada.
- [ ] **S1:** iterasi hash (mis. 10.000x) di `hashSandi`.
- [ ] **S2:** batas percobaan login (5 gagal → kunci 5 menit).
- [ ] **S8:** salt seed acak per instalasi (bukan konstanta publik).
- [ ] **S9:** `tambah`/`reset`/`hapus` periksa peran peminta (Pimpinan).
- [ ] **K1b:** sertakan `wajibGantiSandi` di hasil `sesiAktif()` (atau
      izinkan `render()` memeriksanya dari `db`).
- [ ] **R1:** tambah `daftarPengguna()` (publik, tanpa salt/hash).
- [ ] **R6:** tolak sandi baru sama dengan lama/default di
      `gantiSandiSendiri`.
- [ ] **R7:** validasi `d.pengguna` di `load()` dengan `bersihkanPengguna()`.

## 6. Daftar periksa untuk Kirana (UI) — status per 15 Nov ~11:35 WIB

- [x] Guard di `render()` + filter menu/tab/Lainnya; layar login
      (`#login-form`) + ganti sandi paksa; `esc()` untuk nilai pengguna;
      tombol reset/hapus data di Pengaturan (rute Pimpinan).
- [ ] **S10:** selftest JANGAN tinggalkan sandi admin `'sandiuji9'` —
      kembalikan ke `'admin123'` di akhir (snippet Wira BLOK B sudah
      melakukannya; jadikan bagian FASE 2).
- [ ] **R4:** cabut fallback "tanpa engine auth = tanpa gerbang" (fail-closed).
- [ ] **K1:** tambah cek `bolehRute()` di `go()` sebagai pertahanan kedua.
- [ ] **K1b:** bila Baskara belum mengirim flag di sesi, `render()`
      periksa `cariPengguna(sesi.id).wajibGantiSandi` dari `db`.
- [ ] **(Info)** Layar ganti sandi tidak punya id form sendiri — form-nya
      `<form onsubmit="return submitGantiSandiPaksa(event)">` di dalam
      `#auth-root .auth-screen`, field `#ganti-baru`/`#ganti-ulang`.
      Snippet Wira sudah disesuaikan (cek `#ganti-baru`).

## 7. Lampiran: hasil cek `icons/icon-192.png`

- `file`: `PNG image data, 192 x 192, 8-bit/color RGB, non-interlaced`.
- Ukuran: 3.602 byte; SHA-256:
  `a5859932140b15d580c82d9ccc610cca0f39828f2e42c89135baf545dc8c5c2b`.
- Parse header manual (python3, `struct`+`zlib`): signature PNG benar;
  chunk `IHDR` 13 byte (192x192, bit depth 8, color type 2/RGB,
  compression 0, filter 0, interlace 0); chunk `IDAT` 3.545 byte;
  `IEND`; **semua CRC chunk cocok**; `IDAT` berhasil di-decompress
  menjadi tepat 110.784 byte sesuai rumus (192 baris x (1 + 192x3)).
  Pillow juga berhasil membuka: format PNG, 192x192, mode RGB.
- **Kesimpulan: file VALID, tidak rusak.** Laporan "decode gagal di
  browser cloud" TIDAK dapat direproduksi dari file di disk.
- **Rekomendasi (jangan buat ulang ikon):** kemungkinan penyebabnya adalah
  cache lama Service Worker (cache v6) atau file yang tersaji berbeda dari
  file di disk. Sebelum membuat ulang ikon: (1) bandingkan SHA-256 file
  yang disajikan browser cloud dengan `a58599...` di atas; (2) bila
  berbeda, bersihkan cache / naikkan versi cache SW; (3) bila sama tapi
  tetap gagal, baru pertimbangkan export ulang dari sumber yang sama.
  Catatan: `icon-512.png` juga dicek sepintas (`file`: PNG 512x512 valid,
  9.365 byte) — tidak ada keluhan untuk file itu.

## 8. Metode, baseline selftest, dan kejujuran laporan

- Ini review **statis (baca kode)** + **harness jsdom** (bukan browser
  live). Verifikasi live di browser cloud dilakukan koordinator.
- **Baseline harness jsdom** (`~/workspace/tools/jsdom-test/run_selftest.js`,
  dijalankan Wira, bukan bagian dari FASE 1 tapi sebagai pembanding):
  - Satu run di tengah Baskara/Kirana masih menyimpan file:
    `SELFTEST FAIL (153/154)` — 1 FAIL "Sidebar desktop berisi 16 menu |
    0 menu". Run ini TIDAK bisa dijadikan kesimpulan karena file berubah
    di tengah jalan.
  - Dua run berurutan setelah file menetap: **`SELFTEST PASS (173/173)`**,
    dua kali. Itu baseline jsdom saat ini.
  - Catatan: total tes naik dari 116 (brief) menjadi 173 karena Baskara +
    Kirana menambahkan tes auth engine + UI.
- **Keterbatasan yang masih berlaku:**
  - Auth engine + UI mendarat di tengah review; bila Baskara/Kirana
    menyimpan perubahan lagi setelah ~11:35 WIB, sebagian nomor baris di
    laporan ini bisa bergeser — isi temuannya tetap berlaku sampai
    perbaikannya diverifikasi ulang.
  - Temuan K1b (muat ulang) dan K2 (backup buatan) **terverifikasi lewat
    baca kode**, belum dites live di browser. Snippet selftest FASE 2
    menguji K1b lewat UI; K2 butuh tes restore file buatan (sudah diminta
    di §5).
  - Tidak ada kredensial asli yang dipakai atau ditampilkan di laporan ini
    selain pasangan default yang sudah didokumentasikan di brief
    (`admin/admin123`, `guru1/guru123`) dan sandi uji selftest
    (`sandiuji9`, `sandiuji1`) yang memang tertulis di `app.js`.
- Skill `browser-testing-with-devtools` tidak bisa dipakai penuh di sini
  karena subagent tidak menjalankan browser — prinsipnya yang dipakai
  (verifikasi visibilitas nyata, jangan percaya DOM saja), dan verifikasi
  live-nya diserahkan ke koordinator sesuai brief.

## 9. Addendum FASE 2 (Wira, 15 Nov 2026 ~12:00 WIB) — status temuan setelah hardening + penyisipan

Hardening Baskara yang diverifikasi Wira dengan membaca kode (bukan klaim):
- **K2 DITUTUP:** `applyBackupData()` mempertahankan pengguna lokal bila
  tidak kosong; hanya bila lokal kosong pengguna dari berkas dipakai
  (setelah `bersihkanPengguna()`). Sisa: `backupJSON()` MASIH memuat
  salt+hash di file (didokumentasikan di selftest engine sebagai perilaku
  yang diterima) — file cadangan tetap mengandung hash kredensial
  (1000 ronde). Rendah–sedang, dicatat, bukan FAIL.
- **K3 DITUTUP:** `flushSync()` mengirim `dbUntukSinkron()` (salinan tanpa
  kunci `pengguna`); db asli tetap utuh (diuji engine).
- **K1b DITUTUP:** `sesiAktif()` membaca `wajibGantiSandi` langsung dari
  `db.pengguna` tiap dipanggil; `render()` memakai `sesi.wajibGantiSandi`.
  Diverifikasi Wira dengan probe muat-ulang dua-fase jsdom
  (`tools/jsdom-test/probe_k1b_reload.js`): setelah "muat ulang", layar
  ganti sandi tetap tampil, dashboard tidak tampil. LULUS.
- **S9 DITUTUP (dengan catatan):** `tambah`/`reset`/`hapus` memeriksa
  `pemintaAdalahPimpinan(olehId)` SEBELUM validasi lain; UI mengirim
  `sesiSaya().id` sebagai peminta. Catatan: `olehId` adalah klaim identitas
  berupa string — engine tidak mengikatnya ke sesi hidup. Pemanggil console
  bisa memalsukan `olehId: 'admin'` tanpa sesi. Di model lokal (console =
  akses perangkat) ini sedang–rendah; perbaikan ideal: engine memeriksa
  `sesiAktif().id === olehId`.
- **S1 (sebagian):** `HASH_RONDE = 1000`, `hashSandi` iterasi 1000x.
  Sisa migrasi: tidak ada penanda versi hash — perangkat yang menyimpan
  hash 1-ronde dari sebelum hardening tidak akan bisa login lagi (tidak
  ada kode migrasi; jalan keluar: hapus data/reset). Dampak nyata kecil
  (aplikasi belum diserahkan ke klien; hanya perangkat tes), tapi Sinta
  perlu tahu.
- **R6 DITUTUP:** `gantiSandiSendiri` menolak sandi baru sama dengan lama
  (diuji engine).
- **R7 DITUTUP:** `load()` memvalidasi `d.pengguna` lewat
  `bersihkanPengguna()`, fallback seed bila kosong/bukan array.
- **R4 DITUTUP:** `render()` fail-closed — bila engine auth tidak tersedia,
  tampilkan layar login + kosongkan shell, return (dulu: jalan tanpa
  gerbang).
- **R1 (catatan kedaluwarsa):** `daftarPengguna()` kini ADA (publik, tanpa
  salt/hash, terurut id); UI daftar pengguna memakainya.
- **S10 DITUTUP + DIVERIFIKASI END-TO-END:** cleanup BLOK B
  (`resetSandiPengguna('admin','admin123','admin')`) mengembalikan sandi
  admin + flag. Probe `tools/jsdom-test/probe_s10.js`: setelah selftest
  penuh 242/242, `masukPengguna('admin','admin123')` → ok:true,
  `wajibGantiSandi: true`. LULUS.
- **Masih terbuka (tidak disentuh hardening ini):** S2 (tanpa batas
  percobaan login — sedang), S8 (salt seed tetap + publik — sedang),
  S7 (kredensial default terkenal — sedang, mitigasi: wajib ganti +
  K1b kini tertutup), `go()` tanpa cek peran (pertahanan kedua, rendah),
  `renderSantriOnly`/`renderGuruOnly` tanpa guard (rendah, model lokal),
  variabel in-memory `wajibGantiSandi` di app.js kini hanya dibaca tes
  (nit — tidak lagi dipakai gate; hapus bila sempat, jangan buru-buru).
- **Hasil selftest jsdom setelah penyisipan:** `node --check` engine.js +
  app.js + sw.js lolos; harness `run_selftest.js`:
  **SELFTEST PASS (242/242), FAIL 0** (dua run berurutan; sebelum
  penyisipan 191/191). Semua 30+ tes baru BLOK A/B lolos, termasuk
  S10 dan uji K1b (ganti sandi paksa untuk akun sementara).
- **Tidak ada FAIL.** Tidak ada kode Baskara/Kirana yang diam-diam
  diperbaiki Wira — satu-satunya perubahan Wira pada `app.js` adalah
  penyisipan snippet (byte-identik dengan berkas snippet), dan pada
  berkas snippet hanya perbaikan uji XSS + komentar (didokumentasikan
  di header snippet).
