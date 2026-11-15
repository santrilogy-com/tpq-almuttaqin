# API Engine — TPQ Al-Muttaqin PWA v2 (Lapisan Data)

> Kontrak antara lapisan data (`engine.js`, oleh Baskara) dan lapisan UI
> (oleh Kirana). UI dibangun di atas nama-nama di bawah ini. Jangan ubah
> nama, signature, atau bentuk hasil tanpa memberitahu Nara dan memperbarui
> dokumen ini.
>
> File: `pwa-v2/engine.js` — satu file, tanpa build, tanpa dependensi.
> Cara pakai: `<script src="engine.js"></script>` lalu panggil
> `initEngine()` sekali saat aplikasi dibuka.
> Semua data adalah **Data contoh** (`db.isContoh === true`) sampai klien
> mengisi data asli. Jangan mengarang data klien.

## Keputusan struktur

**Satu file `engine.js`** (2.313 baris), bukan pecah ke `pwa-v2/js/`.
Alasan: tanpa build step, satu tag `<script>` seperti v1; urutan muat tidak
bisa salah; satu `node --check` memverifikasi semuanya; ukuran masih
sebanding dengan v1 (2.952 baris termasuk UI) dan mudah dilacak dengan
pencarian teks biasa. Kalau nanti melewati ~2.500 baris, baru dipecah.

## Bentuk hasil mutasi (berlaku untuk semua fungsi simpan/hapus/ubah)

```js
// Berhasil:
{ ok: true, santri: {...} }        // isi tambahan tergantung fungsi
// Gagal (validasi / tidak ditemukan):
{ ok: false, error: 'kode-singkat', message: 'Penjelasan Bahasa Indonesia.' }
```

Pengecualian: `catatTabungan()` untuk tarik di atas Rp200.000 mengembalikan
`{ ok: false, needsConfirm: true, error: 'butuh-konfirmasi', message: '...' }`.
Panggil lagi dengan `{ confirmed: true }` untuk melanjutkan.

Fungsi yang mengembalikan file (export/backup/template) mengembalikan
`{ filename, csv }` atau `{ filename, json }` dan TIDAK mengunduh sendiri.
UI yang mengunduh (buat Blob + klik tautan) dan memberi tahu pengguna.

## Boot

| Nama | Signature | Keterangan |
|---|---|---|
| `initEngine()` | `() => true` | Panggil sekali saat aplikasi dibuka. Mengisi `ui.jenjang` dari penyimpanan dan memulai sinkron otomatis (`startSync()`). |
| `startSync()` | `() => boolean` | Daftarkan listener `online`/`offline`, interval kirim tiap 60 detik, dan sekali kirim saat dipanggil. Mengembalikan `false` di Node (tanpa `window`). |
| `stopSync()` | `() => void` | Hentikan listener dan interval sinkron. |

## State global

| Nama | Jenis | Keterangan |
|---|---|---|
| `db` | objek | Seluruh data aplikasi. Kunci: `version`, `isContoh`, `santri`, `guru`, `kelas`, `tabunganTx`, `target`, `keuanganTx`, `pertemuan`, `hafalanLog`, `pengumuman`, `settings`, `nilai`, `alokasiWaktu`, `jadwalKbm`, `jadwalPiket`, `absensiGuru`, `rapbm`, `biaya`, `pengguna`, `_updatedAt`. |
| `ui` | objek | State non-DOM: filter dan pilihan aktif. UI boleh baca/tulis lalu render ulang sendiri. Field: `jenjang`, `santriSearch`, `santriKelas`, `santriStatus`, `santriAngkatan`, `santriSortKey`, `santriSortDir`, `santriShown`, `guruSearch`, `tabunganSantri`, `tabunganJenis`, `keuanganTab`, `kelasId`, `kelasTanggal`, `kelasMateri`, `absDraft`, `nilaiTab`, `nilaiSantri`, `raporSantri`, `raporSemester`, `kbmTab`, `kbmHari`, `absGuruTanggal`, `absGuruKelompok`, `kemuridanTab`, `rapbmTab`, `hafalanSantri`. |

## Konstanta

| Nama | Isi |
|---|---|
| `LS_KEY` | `'tpq-madin-pwa-v1'` (sama seperti v1, supaya data v1 tetap terbaca) |
| `HARI_LIST` | `['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad']` |
| `MAPEL_LIST` | `['Iqra', 'Tahfidz', 'Fiqih', 'Tauhid', 'Akhlak', 'Bahasa Arab', 'Tajwid', 'Doa Harian']` |
| `PERAN_GURU` | `['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru']` — tulis "Guru Fan" persis seperti itu |
| `JENIS_NILAI` | `['Harian', 'Imda', 'Praktek']` |
| `JILID_LIST` | `['Iqra 1', ..., 'Iqra 6', 'Tahfidz Juz 30', 'Tahfidz Juz 29', 'Tahfidz Juz 28']` |
| `KATEGORI_MASUK` | `['SPP', 'Infaq', 'Donasi', 'Pendaftaran', 'Kitab/Seragam', 'Saldo awal']` — `'Saldo awal'` untuk saldo kas awal bulan (bukan Donasi, supaya realisasi Donasi tidak menggelembung). |
| `KATEGORI_KELUAR` | `['Honor guru', 'Operasional', 'ATK', 'Listrik dan air', 'Kegiatan']` |
| `SEMESTER_LIST` | `[{ id: 'ganjil-2627', label: 'Semester Ganjil 2026/2027', mulai: '2026-07-01', sampai: '2026-12-31' }, { id: 'genap-2627', ... }, { id: 'ganjil-2526', ... }]` |
| `CSV_TEMPLATES` | `{ murid: { header, contoh }, guru: {...}, nilai: {...} }` — kolom dan contoh isi template CSV |
| `MODULES` | Daftar 16 modul `{ id, label, icon, group }` (Beranda, Santri, Tabungan, Keuangan, RAPBM, Kelas, Hafalan/Iqra, Guru, Pengumuman, Laporan, Penilaian, KBM, Kemuridan, Sahabat Khidmah, Grafik, Pengaturan). Data saja, tanpa render. |
| `BOTTOM_NAV` | `['dashboard', 'santri', 'tabungan', 'keuangan', 'kelas']` |
| `GURU_ROUTES` | `['dashboard', 'santri', 'kelas', 'hafalan', 'penilaian', 'pengumuman', 'kbm']` — rute yang boleh dibuka peran Guru |
| `GURU_TABS` | `['dashboard', 'santri', 'hafalan', 'penilaian', 'kelas']` — tab bawah untuk peran Guru |
| `SESI_KEY` | `'tpq-madin-pwa-sesi'` — kunci localStorage sesi login (bukan bagian `db`) |
| `SESI_MASA_BERLAKU_MS` | `7 * 24 * 60 * 60 * 1000` — sesi berlaku 7 hari sejak masuk |
| `SALT_SEED_ADMIN` / `SALT_SEED_GURU1` | Salt tetap pengguna seed (`'a1b2c3d4e5f60718293a4b5c6d7e8f90'` / `'0f1e2d3c4b5a69788796a5b4c3d2e1f0'`), didokumentasikan supaya hash seed deterministis. Pengguna baru selalu memakai salt acak dari `buatSalt()`. |
| `NAV_ICONS` | Ikon SVG tiap tab bawah (`dashboard`, `santri`, `tabungan`, `keuangan`, `kelas`, `lainnya`). String SVG, UI yang menampilkannya. |
| `BULAN_PANJANG` | Nama bulan Indonesia Januari–Desember |
| `APPS_SCRIPT_HOST_DIIZINKAN` | `['script.google.com', 'script.googleusercontent.com']` — allowlist host sinkron |

## Muat / simpan / reset

| Nama | Signature | Contoh |
|---|---|---|
| `load()` | `() => db` | `db = load()` — baca dari penyimpanan; kalau kosong/rusak, kembalikan data contoh. Menggabungkan dengan struktur kosong supaya kunci yang hilang dilengkapi (perbaikan dari v1). Kalau data tersimpan tidak punya `pengguna` (data lama), pengguna seed ditambahkan supaya selalu ada yang bisa login. **Pengguna dari penyimpanan divalidasi bentuknya lewat `bersihkanPengguna()`** (entri tidak valid dibuang; kalau hasilnya kosong, pakai pengguna seed). |
| `save(alasan)` | `(alasan?: string) => boolean` | `save('Tambah santri Budi')` — tulis `db` + set `_updatedAt` + masuk antrean sinkron. Mengembalikan `false` kalau penyimpanan gagal (mis. kuota penuh); saat itu perubahan TIDAK diantrekan. |
| `seedData()` | `() => db` | Kembalikan data contoh baru: 40 santri (24 TPQ + 16 Ibtidaiyah), 10 kelas (termasuk Iqra 2), 5 guru, pengumuman, jadwal, nilai, keuangan/tabungan/RAPBM, hafalan, **plus 2 pengguna seed** (`admin` Pimpinan, `guru1` Guru; sandi awal `admin123` / `guru123`, wajib ganti sandi). Verbatim v1, ditambah pengguna. Agregat seed: kas Semua masuk Rp3.950.000, keluar Rp3.050.000, saldo Rp900.000 (Ibtidaiyah masuk 200rb, keluar 150rb, saldo 50rb); SPP November Rp1.900.000 (38 santri aktif × Rp50.000); Honor guru Oktober Rp2.550.000 (3 guru); "Saldo awal November" berkategori Saldo awal (realisasi Donasi 0). |
| `emptyData()` | `() => db` | Kembalikan struktur kosong (semua list `[]`, `isContoh: false`, `pengguna: []`). Verbatim v1. |
| `resetToSeed()` | `() => db` | `resetToSeed()` — ganti seluruh data dengan data contoh (termasuk pengguna seed). UI WAJIB minta konfirmasi dulu. |
| `clearAllData()` | `() => db` | Kosongkan semua data (untuk diisi data asli). **Pengguna SAAT INI dipertahankan** (ronde perbaikan 2026-11-15): santri, guru, keuangan, dan semua data lain dikosongkan, tapi `db.pengguna` tetap berisi pengguna yang sedang login / pengguna yang ada — termasuk sandi yang sudah diganti dan `wajibGantiSandi: false`-nya — sehingga sesi yang masih berlaku tetap valid dan tidak ada paksaan ganti sandi. Kalau daftar pengguna kosong, pakai pengguna seed. UI WAJIB minta konfirmasi dulu; fungsi ini tidak bertanya lagi. |
| `resetToSeedConfirm()` | `() => db` | Pembungkus `resetToSeed()` (nama dipertahankan dari v1). UI tetap wajib konfirmasi dulu. |

## Autentikasi lokal (login di perangkat)

Login lokal tanpa server dan tanpa library luar. Kata sandi **tidak pernah**
disimpan plaintext: yang tersimpan di `db.pengguna` hanya
`{ id, nama, peran, salt, hash, wajibGantiSandi, dibuatPada }` dengan
`hash = 1000 ronde SHA-256 (ronde 1 = SHA-256(salt + ':' + sandi), ronde
berikutnya = SHA-256(hasil ronde sebelumnya); lihat `hashSandi`)`. Salt acak per pengguna (16 byte, hex),
jadi dua pengguna dengan sandi sama tetap punya hash berbeda. Belum ada
pengguna produksi (baru pratinjau + seed), jadi tidak ada hash lama yang
perlu dimigrasi saat iterasi diubah. Sesi login
hanya tersimpan di perangkat (kunci `SESI_KEY`), tidak ikut backup JSON dan
tidak dikirim ke Sheet. **Batasan jujur:** ini pengaman perangkat bersama,
bukan keamanan tingkat server; siapa pun yang bisa membaca localStorage
perangkat tetap bisa menyalin salt+hash, jadi perangkat harus dikunci.
Begitu pula pemeriksaan peran peminta di `tambahPengguna` /
`resetSandiPengguna` / `hapusPengguna` hanya menegakkan kontrak UI, BUKAN
keamanan anti-console: siapa pun yang membuka DevTools tetap bisa memanggil
fungsi engine langsung dengan `olehId` Pimpinan, karena tidak ada server
yang memverifikasi peminta.

## Batasan arsitektur — RBAC hanya ditegakkan di UI (S3, audit 15 Nov 2026)

**Pernyataan jujur, tanpa klaim berlebihan:** penegakan peran (RBAC) di
aplikasi ini hanya berlaku di lapisan UI — pengalihan rute di `render()`
(`app.js`, penjaga `bolehRute` / `bolehAkses`) dan tombol/menu yang
disembunyikan per peran. Fungsi-fungsi engine TIDAK memeriksa peran maupun
sesi sebelum bermutasi, kecuali tiga fungsi kelola pengguna di atas. Siapa
pun yang membuka DevTools (F12) di perangkatnya sendiri bisa memanggil
langsung, antara lain:

- `simpanSantri` / `hapusSantri` — tambah/hapus santri,
- `tambahKelas` — tambah kelas,
- `simpanKeuangan` / `hapusKeuangan` — tambah/hapus transaksi keuangan,
- `tambahPengumuman` / `hapusPengumuman` — tambah/hapus pengumuman,
- `simpanNilai` / `simpanRapbm` / `simpanBiaya` — tambah nilai, RAPBM, biaya.

Artinya peran Guru **tidak bisa ditegakkan penuh secara client-side**:
seorang Guru yang membuka DevTools bisa melakukan persis hal yang dilarang
UI-nya. Ini **batasan arsitektur yang diterima** untuk aplikasi
offline-first ini, bukan bug yang bisa ditambal sepenuhnya di client —
data tinggal di localStorage perangkat yang sama, dan JavaScript apa pun di
halaman itu bisa menulis localStorage langsung. Menambah cek peran di tiap
fungsi engine hanya menghalangi pemanggilan polos, bukan penyerang yang
memang membuka DevTools (ia bisa memalsukan peran atau menulis `db`
langsung). Model ancaman aplikasi ini adalah "perangkat milik TPQ,
pengguna adalah orang dalam yang dipercaya"; RBAC UI mencegah kesalahan
dan penyalahgunaan kasual, bukan serangan DevTools.

**Rencana:** bila nanti ada backend (pola server Pesantren Verse sudah
ada: API + token + SQLite), mutasi master dipindahkan ke server dengan
cek peran di sisi server — itu satu-satunya penegakan yang sesungguhnya.
Mitigasi ringan sementara yang dicatat (belum diterapkan): jangan
mengekspos fungsi engine sebagai global `window` (bungkus engine dalam
modul/IIFE dan hanya ekspos yang dibutuhkan UI) — ini menaikkan bar dari
"ketik satu baris" menjadi "baca kode dulu", tapi bukan penutup.

Terkait: temuan F1 (peran Guru mutasi master data) DITAHAN menunggu
keputusan Mas — lihat "Perilaku UI (app.js)" di bawah.

Bentuk hasil mengikuti konvensi mutasi (`{ ok: true, ... }` atau
`{ ok: false, error: 'kode-singkat', alasan: '...' }`). Fungsi auth memakai
field `alasan` (bukan `message`) untuk pesan Bahasa Indonesia. Alasan login
gagal selalu generik, `"ID atau kata sandi salah"`, baik ID tidak ditemukan
maupun sandi salah, supaya tidak membocorkan mana yang salah.

Pengguna seed (data contoh): `{ id: 'admin', nama: 'Pimpinan', peran: 'Pimpinan', sandi awal 'admin123' }`
dan `{ id: 'guru1', nama: 'Guru 1', peran: 'Guru', sandi awal 'guru123' }`,
keduanya `wajibGantiSandi: true`. Salt seed tetap dan terdokumentasi
(`SALT_SEED_ADMIN`, `SALT_SEED_GURU1`) supaya hash seed deterministis.
String sandi awal hanya muncul di kode seed saat hashing; di objek
`db.pengguna` yang tersimpan hanya ada salt+hash (diuji di self-test).
**Catatan ronde perbaikan 2026-11-15:** `admin123` dan `guru123` masuk
daftar sandi umum (`SANDI_UMUM`) — login dengan keduanya tetap jalan,
tetapi reset/ganti sandi KEMBALI ke keduanya ditolak mesin
(`'sandi-lemah'` / `'sandi-terlalu-pendek'`). Pemulihan ke keadaan seed
harus menyalin entri dari `seedPengguna()` langsung.

| Nama | Signature | Keterangan |
|---|---|---|
| `sha256Hex(str)` | `(str) => string hex 64 karakter` | SHA-256 standar (FIPS 180-4), sinkron, murni JS. `crypto.subtle` tidak dipakai karena async. Diuji dengan vektor resmi: `sha256('')` = `e3b0c44298fc...`, `sha256('abc')` = `ba7816bf8f01...`. |
| `buatSalt()` | `() => string hex 32 karakter` | Salt acak 16 byte. Jalur utama `crypto.getRandomValues` (CSPRNG); fallback `Math.random` hanya bila `crypto` tidak tersedia. Salt hanya perlu unik, bukan rahasia. |
| `hashSandi(salt, sandi)` | `(salt, sandi) => string` | 1000 ronde SHA-256: ronde 1 = `sha256Hex(salt + ':' + sandi)`, ronde berikutnya = `sha256Hex(hasil sebelumnya)`. Deterministis; hash seed dihitung ulang otomatis saat seed. |
| `seedPengguna()` | `() => pengguna[]` | 2 pengguna seed di atas (hash dihitung dengan salt tetap). |
| `cariPengguna(id)` | `(id) => pengguna \| null` | Cocok case-insensitive setelah trim. Mengembalikan objek tersimpan (termasuk salt+hash); UI tidak boleh menampilkannya. |
| `verifikasiLogin(id, sandi)` | `(id, sandi) => { ok: true, pengguna, wajibGantiSandi } \| { ok: false, error: 'login-gagal', alasan }` | `pengguna` di sini bentuk publik `{ id, nama, peran }` (tanpa salt/hash). Gagal selalu dengan alasan generik. |
| `masukPengguna(id, sandi)` | `(id, sandi) => { ok: true, pengguna, wajibGantiSandi } \| { ok: false, error, alasan }` | Verifikasi + buat sesi. Sesi disimpan sebagai JSON `{ id, nama, peran, masukPada, kedaluwarsa }`; `kedaluwarsa = masukPada + 7 hari`. |
| `sesiAktif()` | `() => { id, nama, peran, wajibGantiSandi } \| null` | Baca sesi; sesi kedaluwarsa atau rusak dihapus dan dianggap tidak aktif. `wajibGantiSandi` dibaca LANGSUNG dari `db.pengguna` saat dipanggil (bukan dari data sesi tersimpan), jadi setelah ganti sandi berhasil flag langsung terbaca false dan layar ganti sandi paksa tidak bisa dilewati dengan reload. **Sesi batal (null + dihapus) bila penggunanya tidak ditemukan, atau bila sandi diubah setelah sesi dibuat (`sesi.masukPada < pengguna.sandiDiubahPada`).** Saat pengguna mengganti sandinya SENDIRI, `masukPada` sesinya diperbarui supaya sesinya tetap hidup. |
| `daftarPengguna()` | `() => [{ id, nama, peran, wajibGantiSandi }]` | Semua pengguna dalam bentuk publik (tanpa salt/hash), terurut berdasarkan id. Dipakai daftar Kelola Pengguna di UI. |
| `keluarPengguna()` | `() => true` | Hapus sesi. |
| `tambahPengguna({ id, nama, peran, sandi, olehId })` | `(input) => { ok: true, pengguna } \| { ok: false, error, alasan }` | `olehId` = id peminta, WAJIB Pimpinan (`error: 'bukan-pimpinan'`, alasan `'Hanya Pimpinan yang bisa menambah pengguna.'`); tanpa peminta / peminta Guru → ditolak SEBELUM validasi lain. Validasi: id tidak kosong + unik (case-insensitive setelah trim), nama tidak kosong, peran hanya `'Pimpinan'` atau `'Guru'`, sandi mengikuti aturan `sandiBaruValid` (minimal 8 karakter, tolak sandi umum, tolak sandi sama dengan ID). Pengguna baru `wajibGantiSandi: true`. Pemeriksaan peran menegakkan kontrak UI, BUKAN keamanan anti-console (lihat batasan di atas). |
| `resetSandiPengguna(id, sandiBaru, olehId)` | `(id, sandiBaru, olehId) => { ok: true, pengguna } \| { ok: false, error, alasan }` | `olehId` WAJIB Pimpinan (ditolak `'bukan-pimpinan'` kalau bukan). Salt baru + hash baru, `wajibGantiSandi: true`, sandi mengikuti aturan `sandiBaruValid` (minimal 8 karakter, tolak sandi umum, tolak sandi sama dengan ID), dan `sandiDiubahPada = Date.now()` — sesi lain pengguna itu ikut batal (lihat `sesiAktif()`). Pengguna tidak ditemukan → gagal. **Catatan:** sandi seed `admin123` / `guru123` ada di daftar sandi umum, jadi reset KEMBALI ke sandi seed ditolak — pemulihan ke keadaan seed harus menyalin entri dari `seedPengguna()` langsung, bukan lewat fungsi ini. |
| `hapusPengguna(id, idPeminta)` | `(id, idPeminta) => { ok: true, nama } \| { ok: false, error, alasan }` | `idPeminta` WAJIB Pimpinan (ditolak `'bukan-pimpinan'` kalau bukan). Tolak hapus diri sendiri; tolak hapus Pimpinan terakhir (minimal harus ada 1 Pimpinan) — penjaga ini kini praktis tidak terjangkau lewat API publik (peminta Pimpinan yang berbeda dari target berarti sudah ada minimal 2 Pimpinan), dipertahankan sebagai pertahanan berlapis. |
| `gantiSandiSendiri(id, sandiLama, sandiBaru)` | `(id, sandiLama, sandiBaru) => { ok: true, pengguna } \| { ok: false, error, alasan }` | Verifikasi sandi lama dulu (gagal = alasan generik login), sandi baru mengikuti aturan `sandiBaruValid` (minimal 8 karakter, tolak sandi umum, tolak sandi sama dengan ID), sandi baru harus berbeda dari sandi lama (`error: 'sandi-sama'`), lalu `wajibGantiSandi: false`. `sandiDiubahPada` ikut diperbarui, tapi `masukPada` sesi sendiri diperbarui juga supaya sesi tetap hidup. |
| `gantiSandiPaksa(id, sandiBaru)` | `(id, sandiBaru) => { ok: true, pengguna } \| { ok: false, error, alasan }` | **Hanya untuk layar ganti sandi paksa (T-01):** TIDAK meminta sandi lama — sesi aktif dari login yang berhasil sudah membuktikan identitas. Syarat: ada sesi aktif yang id-nya cocok + `wajibGantiSandi: true`. Sandi baru mengikuti aturan `sandiBaruValid` (minimal 8 karakter, tolak sandi umum, tolak sandi sama dengan ID) dan harus berbeda dari sandi lama (`error: 'sandi-sama'`, dicek lewat hash dengan salt lama). Berhasil → `wajibGantiSandi: false`, `sandiDiubahPada = Date.now()`, sesi sendiri tetap hidup. Alur normal tetap pakai `gantiSandiSendiri` (verifikasi sandi lama). |
| `GURU_ROUTES` / `GURU_TABS` | konstanta | Lihat tabel Konstanta. |
| `bolehAkses(peran, routeId)` | `(peran, routeId) => boolean` | Pimpinan: `true` untuk semua rute. Guru: `true` hanya jika `routeId` ada di `GURU_ROUTES`. Peran lain/tidak dikenal: `false`. Ini penjaga UI, bukan keamanan server (data tetap ada di perangkat yang sama). |

## Jenjang (TPQ / Ibtidaiyah)

| Nama | Signature | Contoh |
|---|---|---|
| `getJenjang()` | `() => 'Semua' \| 'TPQ' \| 'Ibtidaiyah'` | `getJenjang()` |
| `setJenjang(j)` | `(j) => j` | `setJenjang('TPQ')` — simpan pilihan, isi `ui.jenjang`, kembalikan `j`. TIDAK me-render (UI yang render ulang). |
| `jenjangCocok(j)` | `(jenjangData) => boolean` | `jenjangCocok(s.jenjang)` — `'Semua'` cocok dengan semua; data lama tanpa field jenjang dianggap cocok. |
| `guruCocokJenjang(g)` | `(guru) => boolean` | Guru `'TPQ dan Ibtidaiyah'` cocok di semua filter; guru yang sudah dihapus (`null`) dianggap cocok supaya baris terkait tidak hilang. |
| `kelasJenjang(nama)` | `(namaKelas) => 'TPQ' \| 'Ibtidaiyah'` | `kelasJenjang('Kelas 1')` → `'Ibtidaiyah'`; kelas tak dikenal → `'TPQ'`. |

## Identitas madrasah + profil aktif (v20, ronde "Data kosong + Panduan pengguna")

> Ditambahkan saat merge v21 — bagian ini tidak ada di API.md v19 maupun v20.
> Kontrak fungsi mengikuti komentar di `engine.js:1066-1080`.

`settings.identitas = { TPQ: {...}, Ibtidaiyah: {...} }`; tiap identitas berisi
9 string: `nama`, `singkat`, `logo`, `kepala`, `alamat`, `telepon`,
`tahunBerdiri`, `nsm`, `motto`. `logo` hanya data URL gambar (boleh `''`).

| Nama | Signature | Keterangan |
|---|---|---|
| `migrasiIdentitas(settings)` | `(settings) => void` | Migrasi dari settings lama (tanpa identitas): TPQ dari `settings.namaTpq` + `settings.kepala`; Ibtidaiyah default nama `"Madrasah Ibtidaiyah"`, singkat `"MI"`, sisanya kosong. Bila `settings.identitas` sudah ada, tidak ditimpa. |
| `identitasUntuk(jenjang)` | `('TPQ' \| 'Ibtidaiyah') => identitas` | Kembalikan identitas jenjang itu (migrasi dulu bila belum ada). |
| `simpanIdentitas(jenjang, data, olehId)` | `(jenjang, data, olehId) => { ok, identitas } \| { ok: false, error, alasan }` | Hanya Pimpinan (`olehId` wajib Pimpinan, `error: 'bukan-pimpinan'`). Jenjang harus TPQ/Ibtidaiyah; `nama` wajib. Logo divalidasi `fotoAman()` (hanya JPEG/PNG/WebP base64 — SVG ditolak karena bisa membawa script; `javascript:` ditolak). Bila jenjang TPQ, `settings.namaTpq` ikut diperbarui (satu sumber kebenaran). |
| `getProfilAktif()` | `() => 'TPQ' \| 'Ibtidaiyah' \| 'Semua'` | Profil aktif saat ini (pilihan TAMPILAN, bukan peran). |
| `setProfilAktif(p)` | `(p) => profil efektif` | Simpan pilihan ke localStorage (`PROFIL_KEY = 'tpq_profil_aktif'`) + petakan ke filter jenjang. `'Semua'` hanya untuk Pimpinan; simpanan `'Semua'` + sesi Guru jatuh ke profil efektif TPQ tanpa menimpa simpanan. |
| `logoAman(logo)` (UI, `app.js`) | `(logo) => string` | Kembalikan logo bila lolos `fotoAman()`, `''` bila kosong/tidak valid. Dipakai render (`logoHtml`) supaya logo beracun tidak pernah dirender. |

## Lookup dan agregat

| Nama | Signature | Contoh |
|---|---|---|
| `santriById(id)` | `(id) => santri \| undefined` | `santriById('s1').nama` → `'Ahmad Fauzi'` |
| `guruById(id)` | `(id) => guru \| undefined` | |
| `kelasById(id)` | `(id) => kelas \| undefined` | |
| `santriAktif()` | `() => santri[]` | Santri `status === 'Aktif'` + mengikuti filter jenjang. Seed: 38 (22 TPQ + 16 Ibtidaiyah). |
| `saldoKas(jenjang?)` | `(jenjang?: string) => { masuk, keluar, saldo }` | Seed: Semua masuk Rp3.950.000, keluar Rp3.050.000, saldo Rp900.000; `saldoKas('Ibtidaiyah').saldo` → `50000`. Tanpa argumen = menghitung semua jenjang; isi `'Semua'` untuk semua. |
| `totalTabungan()` | `() => number` | Total tabungan santri aktif (mengikuti filter jenjang). Seed: `2400000`. |
| `rataKehadiran()` | `() => number` | Rata-rata `kehadiran` santri aktif, dibulatkan. `0` kalau tidak ada santri aktif. |
| `hitungKehadiranDariPertemuan(santriId)` | `(id) => number \| null` | Persen Hadir dari `db.pertemuan`; `null` kalau belum ada pertemuan. |
| `realisasiPos(pos, jenjang)` | `(pos, jenjang) => number` | `realisasiPos('SPP', 'Semua')` → `1900000`; `realisasiPos('Donasi', 'Semua')` → `0` (saldo awal bukan Donasi). Masuk positif, keluar negatif. |
| `arusKasPerBulan(jenjang)` | `(jenjang) => { 'YYYY-MM': { masuk, keluar } }` | |
| `arusKasMingguan(jenjang)` | `(jenjang) => { bulan, minggu: [n,n,n,n] }` | Bulan = bulan terbaru dari transaksi (bukan hardcode). Minggu = selisih masuk-keluar per minggu. |
| `namaBulanPanjang(yyyymm)` | `(yyyymm) => string` | `namaBulanPanjang('2026-11')` → `'November 2026'` |

## Rapor dan nilai

| Nama | Signature | Contoh |
|---|---|---|
| `hitungRapor(santriId, semesterId?)` | `(id, semesterId?) => { harian, imda, praktek, akhir }` | `hitungRapor('s1', 'ganjil-2627')` → `{ harian: 82.5, imda: 90, praktek: 88, akhir: 86.4 }`. Rumus: akhir = 40% Harian + 30% Imda + 30% Praktek (jenis yang tidak ada nilainya dihitung 0, seperti v1). Tiap jenis `null` kalau tidak ada nilai. Tanpa `semesterId` = semua nilai. |
| `predikat(nilai)` | `(nilai) => string` | `predikat(86.4)` → `'B (Baik)'`. A ≥90, B ≥80, C ≥70, D ≥60, E di bawah itu. |
| `semesterById(id)` | `(id) => semester` | Semester tak dikenal → semester pertama (`ganjil-2627`). |
| `nilaiDalamSemester(n, semesterId)` | `(nilai, semesterId) => boolean` | `true` kalau tanggal nilai di dalam rentang semester (atau `semesterId` kosong). |
| `naikJilid(jilid)` | `(jilid) => jilid` | `naikJilid('Iqra 1')` → `'Iqra 2'`; jilid tertinggi tetap. |
| `naikJilidSantri(id)` | `(id) => { ok, jilid } \| { ok: false, error }` | Naikkan jilid santri + reset halaman ke 1. Gagal `jilid-tertinggi` kalau sudah mentok. |

## Filter tampilan (mengikuti `ui` + filter jenjang)

| Nama | Signature | Keterangan |
|---|---|---|
| `santriTampil()` | `() => santri[]` | Mengikuti `ui.santriSearch`, `santriKelas`, `santriAngkatan`, `santriStatus`, dan jenjang. |
| `guruTampil()` | `() => guru[]` | Mengikuti `ui.guruSearch` dan jenjang. |
| `nilaiExportRows()` | `() => nilai[]` | Mengikuti tab nilai (`ui.nilaiTab`: Harian/Imda/Praktek; Rapor/Semua = semua jenis) + jenjang. |
| `tabunganRiwayat()` | `() => tabunganTx[]` | Transaksi milik santri pada jenjang aktif, terbaru dulu. |
| `hafalanLogTampil()` | `() => hafalanLog[]` | Setoran milik santri pada jenjang aktif, terbaru dulu. |
| `piketTampil()` | `() => jadwalPiket[]` | Piket guru pada jenjang aktif. |
| `filterSantriList(q)` | `(q) => santri[]` | Cari nama/NIS (mengikuti jenjang). `filterSantriList('ahmad')` → 2 hasil di seed. |
| `riwayatAbsensiGuru(kelompok, batas?)` | `('Guru' \| 'Pimpinan', batas?) => absensiGuru[]` | Tanpa `batas` kembalikan SEMUA (dulu mentok 12 tanpa jalan melihat sisanya); `batas` numerik memotong. Mengikuti jenjang. UI menampilkan 12 dulu + tombol "Tampilkan lebih banyak". **Berbeda dari v1**: v1 mengembalikan string HTML; v2 mengembalikan array data. |

## CRUD santri

| Nama | Signature | Validasi |
|---|---|---|
| `simpanSantri(id, data)` | `(id \| '' \| null, { nama, nis, jenjang, kelas, jilid, angkatan, rombel, wali, hpWali, alamat, hafalan, foto }) => { ok, santri }` | `id` kosong = tambah. Nama wajib, NIS wajib, NIS unik (kecuali milik sendiri). `jenjang` di luar TPQ/Ibtidaiyah → `'TPQ'`. Foto bukan data URL gambar → dibuang (bukan ditolak). |
| `ubahStatusSantri(id, status, extra?)` | `(id, 'Aktif' \| 'Keluar' \| 'Lulus', { alasan?, tanggal?, tahun? }) => { ok, santri }` | Keluar wajib `alasan`; Lulus wajib `tahun`. Kembali ke Aktif menghapus `statusAlasan`, `statusTanggal`, dan `tahunLulus` (tidak ada data stale). |
| `hapusSantri(id)` | `(id) => { ok, nama }` | Menghapus juga nilai, transaksi tabungan, log hafalan, DAN kunci id santri itu dari setiap `p.absensi` (tidak ada absensi yatim). UI WAJIB konfirmasi dulu. |

## CRUD tabungan

| Nama | Signature | Validasi |
|---|---|---|
| `catatTabungan(santriId, jenis, jumlah, catatan?, opts?)` | `(id, 'Setor' \| 'Tarik', jumlah, catatan?, { confirmed? }) => { ok, saldo, transaksi }` | Jumlah harus > Rp0. Tarik di atas saldo → `{ ok: false, error: 'saldo-tidak-cukup' }`. Tarik di atas Rp200.000 tanpa `confirmed` → `{ ok: false, needsConfirm: true }`; ulangi dengan `{ confirmed: true }`. |
| `tambahTarget(nama, jumlah)` | `(nama, jumlah) => { ok, target }` | Nama wajib, jumlah > Rp0. |

## CRUD keuangan, RAPBM, biaya

| Nama | Signature | Validasi |
|---|---|---|
| `simpanKeuangan(data)` | `({ jenis, jenjang, kategori, nama, jumlah, tanggal?, catatan? }) => { ok, transaksi, saldoKas }` | Nama wajib, jumlah > Rp0, kategori harus ada di daftar kategori sesuai jenis. |
| `ubahKeuangan(id, data)` | `(id, { jenis?, jenjang?, kategori?, nama?, jumlah?, tanggal?, catatan? }) => { ok, transaksi, saldoKas } \| { ok: false, error, alasan }` | Ubah transaksi yang sudah ada; validasi sama seperti `simpanKeuangan`, tapi kategori divalidasi terhadap jenis BARU. Transaksi tidak ada → `error: 'tidak-ditemukan'`. |
| `hapusKeuangan(id)` | `(id) => { ok, nama }` | UI WAJIB konfirmasi dulu. |
| `toggleSpp(id)` | `(id) => { ok, sppStatus }` | Lunas ↔ Belum (Telat menjadi Lunas). |
| `simpanRapbm(id, data)` | `(id \| '', { pos, jenis, jenjang, rencana }) => { ok, rapbm }` | Pos wajib, rencana ≥ 0. |
| `hapusRapbm(id)` | `(id) => { ok, pos }` | |
| `simpanBiaya(id, data)` | `(id \| '', { nama, jumlah, keterangan? }) => { ok, biaya }` | Nama wajib, jumlah > Rp0. |
| `hapusBiaya(id)` | `(id) => { ok, nama }` | |

## CRUD kelas, hafalan, guru, pengumuman, nilai, KBM

| Nama | Signature | Validasi |
|---|---|---|
| `simpanPertemuan(kelasId, tanggal, materi, absensi?)` | `(kelasId, tanggal, materi, { santriId: 'Hadir' \| 'Izin' \| 'Sakit' \| 'Alpa' }) => { ok, pertemuan, hadir, total, diperbarui? }` | Kelas harus ada (perbaikan: v1 bisa melempar kalau kelas tidak ada). Materi wajib. Minimal 1 santri aktif di kelas. Absensi yang tidak diisi = `'Hadir'`. Kehadiran santri ikut diperbarui (dihitung ulang dari riwayat pertemuan). **Upsert:** tanggal+kelas yang sama menimpa pertemuan lama (materi + absensi), mengembalikan `diperbarui: true`, supaya koreksi tetap bisa — bukan duplikat, bukan tolak. `hitungKehadiranDariPertemuan` hanya menghitung pertemuan yang kelasnya cocok dengan kelas santri. |
| `catatHafalan(santriId, jenis, materi, nilai)` | `(id, 'Iqra' \| 'Hafalan', materi, 'Lancar' \| 'Cukup' \| 'Perlu Bimbingan') => { ok, hafalan }` | Materi wajib. |
| `simpanGuru(id, data)` | `(id \| '', { nama, kelas, peran, jenjang, hp, honor, foto? }) => { ok, guru }` | Nama wajib, honor ≥ 0. `peran` di luar daftar → `'Guru'`; `jenjang` di luar 3 pilihan → `'TPQ'`. |
| `toggleHonor(id)` | `(id) => { ok, honorStatus }` | Lunas ↔ Belum. |
| `hapusGuru(id)` | `(id) => { ok, nama, jadwalDibersihkan, kelasDibersihkan }` | Jadwal piket guru itu ikut terhapus; `j.guru` pada jadwal KBM yang memakainya dikosongkan + `kelas.ustadz` yang cocok dikosongkan (jumlahnya dikembalikan supaya UI bisa menyebutkannya di konfirmasi). |
| `tambahPengumuman(judul, isi)` | `(judul, isi) => { ok, pengumuman }` | Judul dan isi wajib. |
| `togglePengumuman(id)` | `(id) => { ok, aktif }` | |
| `hapusPengumuman(id)` | `(id) => { ok, judul }` | |
| `simpanNilai(santriId, jenis, mapel, nilai, tanggal?, catatan?)` | `(id, 'Harian' \| 'Imda' \| 'Praktek', mapel, nilai, tanggal?, catatan?) => { ok, nilai }` | Nilai harus 0–100. |
| `ubahNilai(id, data)` | `(id, { mapel?, nilai, catatan? }) => { ok, nilai }` | Nilai harus 0–100. |
| `hapusNilai(id)` | `(id) => { ok }` | |
| `simpanAlokasi(id, data)` | `(id \| '', { kelas, mapel, jamPerMinggu, hari }) => { ok, alokasi }` | Jam per minggu ≥ 1, dibaca dengan `parseFloat` (4.5 jam tetap 4.5, tidak dibulatkan ke bawah). |
| `hapusAlokasi(id)` | `(id) => { ok }` | |
| `simpanJadwal(id, data)` | `(id \| '', { kelas, hari, jamMulai, jamSelesai, mapel, guru }) => { ok, jadwal }` | Hari di luar daftar → `'Senin'`. `jamSelesai <= jamMulai` ditolak; bentrok kelas+hari yang sama (rentang jam tumpang tindih) ditolak — edit diri sendiri dikecualikan. |
| `hapusJadwal(id)` | `(id) => { ok }` | |
| `tambahPiket(guruId, hari, keterangan?)` | `(guruId, hari, keterangan?) => { ok, piket }` | Guru harus ada, hari harus ada di `HARI_LIST`. |
| `hapusPiket(id)` | `(id) => { ok }` | |
| `simpanAbsensiGuru(kelompok, tanggal, draft)` | `('Guru' \| 'Pimpinan', tanggal, { guruId: status }) => { ok, disimpan, tanggal }` | Hanya guru yang tampil (filter jenjang + peran) yang disimpan; entri draft yang tidak ada di daftar tampil diabaikan. |
| `simpanSettings(data)` | `({ namaTpq, kepala?, tarifSpp, tahunAjaran?, jamMasuk? }) => { ok, settings }` | Nama TPQ wajib, tarif SPP ≥ 0. |

## CSV

| Nama | Signature | Contoh |
|---|---|---|
| `parseCSV(teks)` | `(teks) => string[][]` | Parser CSV lengkap (kutip ganda, koma di dalam nilai, BOM). Verbatim v1. |
| `toCSV(rows)` | `(rows) => string` | Sel yang (setelah spasi/tab di depan) diawali `=` / `+` / `-` / `@` diawali satu kutip (`'`) — mitigasi CSV formula injection (OWASP); berlaku untuk semua export karena semua lewat `csvEscape`/`toCSV`. |
| `importRows(jenis, rows)` | `('murid' \| 'guru' \| 'nilai', rows) => { jenis, berhasil, gagal: [{ baris, alasan }] }` | Baris gagal dilewati, data lama tidak rusak. Aturan: murid wajib nama + NIS unik + jenjang TPQ/Ibtidaiyah (kelas yang belum terdaftar dibuat otomatis dari kolom kelas — `tambahKelas`); guru: nama duplikat ditolak, peran asing ditolak dengan alasan (bukan diam-diam jadi "Guru"; kolom peran kosong tetap default "Guru"), honor ≥ 0; nilai: utamakan NIS — bila hanya nama dan nama kembar, baris ditolak "Nama kembar, pakai NIS."; jenis valid + nilai 0–100. Berhasil > 0 → otomatis `save()`. |
| `tambahKelas(data)` | `({ nama, jenjang?, ustadz?, jadwal?, ruang? }) => { ok, kelas } \| { ok: false, error, alasan }` | Nama wajib, duplikat case-insensitive ditolak (`error: 'nama-duplikat'`); jenjang default `'TPQ'`. |
| `importCsvText(jenis, teks)` | `(jenis, teks) => laporan` | `importCsvText('murid', isiFileCsv)` — pengganti `handleImportFile()` v1 (yang membaca input DOM). UI yang membaca file. |
| `downloadTemplate(jenis)` | `('murid' \| 'guru' \| 'nilai') => { filename, csv }` | Jenis tak dikenal → `{ ok: false, error: 'template-tidak-dikenali' }`. |
| `exportSantriCSV()` | `() => { filename, csv, count }` | Menghormati filter `santriTampil()`. |
| `exportGuruCSV()` | `() => { filename, csv, count }` | Menghormati filter jenjang. |
| `exportNilaiCSV()` | `() => { filename, csv, count }` | Menghormati `nilaiExportRows()`. |
| `exportAbsensiCSV()` | `() => { filename, csv, count }` | Menyaring dengan `ui.kelasId` dan `ui.kelasTanggal` (bila diisi). Entri yang santrinya tidak ditemukan dilewati (ID mentah tidak dicetak). |
| `exportKeuanganCSV()` | `() => { filename, csv, count }` | Menghormati filter jenjang + `ui.keuanganTab` (Semua/Masuk/Keluar). |
| `exportRaporCSV(santriId, semesterId?)` | `(id, semesterId?) => { filename, csv, count }` | Santri tak dikenal → `{ ok: false, error: 'tidak-ditemukan' }`. |
| `csvTextFor(jenis)` | `('murid' \| 'guru' \| 'nilai') => { csv, count }` | Teks CSV untuk disalin ke clipboard / ditempel ke Sheets. Pengganti `copyCsvToClipboard()` v1. |

## Backup / restore

| Nama | Signature | Contoh |
|---|---|---|
| `backupJSON()` | `() => { filename, json }` | Satu file JSON berisi seluruh `db` + `exportedAt`. Termasuk `pengguna` (salt+hash saja, tanpa kata sandi plaintext). Sesi login TIDAK ikut (sesi hanya di perangkat). |
| `applyBackupData(data)` | `(data) => boolean` | Ganti `db` dengan isi cadangan; **kunci yang TIDAK ADA di berkas dipertahankan dari data lokal** (bedakan dari kunci yang ada tapi kosong — yang kosong tetap dipakai dari berkas); kunci yang hilang lainnya dilengkapi dari `emptyData()` (cadangan sebagian tetap bisa dipulihkan). Foto/tanggal beracun dibersihkan. **Pengguna (aturan K2): kalau daftar pengguna lokal TIDAK kosong, pengguna lokal dipertahankan dan `pengguna` dari berkas diabaikan sepenuhnya** — berkas buatan tangan berisi Pimpinan + hash yang diketahui penyerang tidak bisa menimpa pengguna lokal. Hanya kalau daftar lokal kosong, `pengguna` dari berkas dipakai (entri tidak valid dibuang); kalau itu pun kosong, pakai pengguna seed. **Ronde perbaikan 2026-11-15 (S6):** pengguna dari berkas yang dipasang di perangkat segar dipaksa `wajibGantiSandi = true` untuk SEMUA akun — akun curian tetap harus diganti sandinya sebelum bisa dipakai. `false` kalau data tidak valid. |
| `restoreFromText(teks)` | `(teks) => { ok, santri, guru }` | Parse JSON lalu `applyBackupData`. Pengganti `handleRestoreFile()` v1. UI WAJIB konfirmasi dulu (data saat ini ditimpa). |

## Picker murid / guru

| Nama | Signature | Contoh |
|---|---|---|
| `santriPickerItems(hanyaAktif?)` | `(hanyaAktif?) => { title, items, chips }` | Item: `{ id, nama, cari, sub, foto, chipVal }`, terurut nama. `chips` = nama kelas pada jenjang aktif. |
| `guruPickerItems()` | `() => { title, items, chips }` | `chips` = `PERAN_GURU`. |
| `filterPickerItems(items, search, chip)` | `(items, search, chip) => items[]` | Filter picker berdasarkan kata kunci + chip (`'Semua'` = semua). |
| `openSantriPicker(onPick, hanyaAktif?)` | `(onPick, hanyaAktif?) => { title, items, chips, onPick }` | **Berbeda dari v1**: tidak membuka modal; mengembalikan konfigurasi picker. UI yang me-render dan memanggil `onPick(item)` saat dipilih. |
| `openGuruPicker(onPick)` | `(onPick) => { title, items, chips, onPick }` | Sama seperti di atas. |

## Teks siap bagikan

| Nama | Signature | Contoh |
|---|---|---|
| `strukTabungan(santriId)` | `(id) => string \| null` | Struk 5 transaksi terakhir + saldo. Pengganti `bukaStruk()` v1. |
| `teksRapor(santriId, semesterId?)` | `(id, semesterId?) => string \| null` | `null` kalau santri tak dikenal atau belum ada nilai. Pengganti `bagikanRapor()` v1. |
| `pengingatSPP(santriId)` | `(id) => string \| null` | Teks WA pengingat SPP + menandai `sppReminderSent = true` dan menyimpan. Dashboard membaca flag ini: kartu Tunggakan SPP menampilkan badge "Sudah diingatkan". Pengganti `kirimPengingatSPP()` v1. |

## Sinkron hybrid (offline-first)

Prinsip (sama seperti v1): data selalu tersimpan dulu di perangkat.
Setiap `save()` masuk antrean. Saat online dan Apps Script sudah diatur,
antrean otomatis terkirim. Kalau Apps Script belum diatur, sinkron mati
dengan penjelasan dan aplikasi TIDAK BOLEH terblokir. Tidak ada kredensial
atau API key Google yang diminta atau disimpan.

| Nama | Signature | Contoh |
|---|---|---|
| `getQueue()` / `setQueue(q)` | `() => [{ id, waktu, alasan }]` | Antrean maks. 500 entri (terbaru dipertahankan). Bila antrean pernah dipotong, flag `tpq-madin-pwa-v1-sync-trimmed` disetel dan `syncState()` menambahkan peringatan "Peringatan: antrean sinkron pernah dipotong, perubahan lama hilang dan tidak terkirim." — flag TIDAK dihapus otomatis saat antrean terkirim (kerugian permanen). |
| `antreanPernahDipotong()` | `() => boolean` | `true` bila antrean sinkron pernah dipotong dari 500. |
| `enqueueChange(alasan)` | `(alasan) => void` | Dipanggil otomatis oleh `save()`. |
| `getSheetCfg()` / `setSheetCfg(cfg)` | `() => { sheetLink?, sheetId?, gid?, appsScriptUrl?, syncToken?, lastSync?, lastPull? }` | Konfigurasi tersimpan di kunci terpisah (`tpq-madin-pwa-v1-sheet`). |
| `cekUrlAppsScript(url)` | `(url) => { ok, kode, host }` | `kode`: `'ok'`, `'bad-url'` (tidak bisa diurai / bukan URL), `'bad-host'` (bukan https atau host di luar allowlist). Hanya host `script.google.com` dan `script.googleusercontent.com` yang diterima. |
| `isOnline()` | `() => boolean` | `false` kalau `syncSimOffline` true atau `navigator.onLine === false`. |
| `syncState()` | `() => { code, text }` | `code`: `'offline'`, `'pending'`, `'ok'`, `'idle'`. Teks (tanpa em dash, sama seperti v1): `'Offline, tersimpan di perangkat'`, `'Menunggu sinkron: X perubahan'`, `'Online, tersinkron'`, `'Sinkron nonaktif, atur Apps Script di Pengaturan'`. UI membaca ini tiap render untuk pil status. |
| `flushSync()` | `() => Promise<string>` | Kode hasil: `'empty'` (antrean kosong), `'offline'`, `'no-config'` (Apps Script belum diatur), `'bad-url'` / `'bad-host'` (URL ditolak sebelum kirim), `'busy'`, `'ok'`, `'failed'` (gagal jaringan / server menolak; antrean tetap ada). Tidak pernah melempar untuk URL malformed. **Payload sinkron TIDAK memuat `pengguna`** (tanpa salt+hash): yang dikirim adalah `dbUntukSinkron()`, salinan `db` tanpa kunci `pengguna`. |
| `dbUntukSinkron()` | `() => db tanpa kunci pengguna` | Salinan dangkal `db` dengan kunci `pengguna` dihapus; `db` asli tetap utuh. Dipakai `flushSync()`; diekspor untuk tes. |
| `decidePull(serverUpdatedAt, localUpdatedAt, pendingCount)` | `(string, string, number) => 'apply' \| 'skip' \| 'warn' \| 'no-server-time'` | Aturan konflik: ada antrean lokal → `'warn'` (beri peringatan, jangan timpa diam-diam); server lebih baru → `'apply'`; lokal lebih baru → `'skip'`; server tanpa waktu DAN lokal punya waktu → `'warn'` (Sheet tidak memberi info waktu, jadi tidak bisa dipastikan mana yang lebih baru — UI minta konfirmasi); server tanpa waktu DAN lokal pun tanpa waktu → `'no-server-time'` (tetap pakai data). |
| `pullFromAppsScript()` | `() => Promise<{ status, message, data? }>` | `status`: `'ok'` (sudah dipakai), `'skip'`, `'warn'` (data ikut dikembalikan; UI bertanya dulu lalu panggil `applyPulledData(data)`), `'no-config'`, `'bad-url'` / `'bad-host'`, `'offline'`, `'error'`. |
| `applyPulledData(data)` | `(data) => boolean` | Gabung, bukan timpa buta: hanya kunci yang dikirim Sheet yang diganti; kunci lain tetap lokal. Angka dari Sheet (teks) dikembalikan ke angka. Foto/tanggal dibersihkan. `false` kalau data tidak berisi daftar santri. |
| `pullCsvFromSheet(jenis)` | `(jenis) => Promise<laporan \| { error, message }>` | Tarik CSV dari Sheet yang di-publish (`https://docs.google.com/spreadsheets/d/.../export?format=csv`). Batasan: kalau Sheet belum di-publish atau peramban memblokir CORS, kembalikan `error: 'fetch-gagal'`; jalan keluarnya unduh CSV lalu `importCsvText()`. |
| `extractSheetId(link)` | `(link) => string` | `extractSheetId('https://docs.google.com/spreadsheets/d/ABC123/edit')` → `'ABC123'`. Link kosong / tak dikenal → `''`. |
| `saveSheetConfig(input)` | `({ sheetLink?, appsScriptUrl?, syncToken?, gid? }) => { ok, cfg? } \| { ok: false, error, message }` | Validasi dulu, simpan kemudian. URL tidak valid atau link tak dikenal → TIDAK disimpan (perbaikan kecil dari v1 yang sempat menyimpan lalu mengeluh). `syncToken` = kata sandi bersama milik lembaga (BUKAN API key Google); hanya tersimpan di perangkat dan hanya dikirim ke URL Apps Script di atas. |
| `sendToAppsScriptNow()` | `() => Promise<{ status }>` | Antrekan sekali lalu `flushSync()`. |
| `syncSimOffline` | `boolean` (variabel) | `true` = simulasikan offline (dipakai self-test). |
| `syncBusy` | `boolean` (variabel) | `true` saat pengiriman sedang berjalan. |

## Util

| Nama | Signature | Contoh |
|---|---|---|
| `todayStr()` | `() => 'YYYY-MM-DD'` | Tanggal hari ini (waktu perangkat). |
| `uid(prefix)` | `(prefix) => string` | ID unik (`prefix` + waktu + acak). |
| `rupiah(n)` | `(n) => string` | `rupiah(1500)` → `'Rp1.500'`. |
| `esc(s)` | `(s) => string` | Escape `& < > " '` untuk HTML. |
| `fmtTanggal(tgl)` | `(tgl) => string` | `fmtTanggal('2026-11-14')` → `'14 Nov 2026'`; tanggal tidak valid/beracun → `''` (bukan mentah). |
| `tglValid(t)` | `(t) => boolean` | `true` hanya untuk `YYYY-MM-DD` kalender (bulan 1–12, hari 1–31). |
| `fotoAman(f)` | `(f) => boolean` | `true` hanya untuk data URL gambar `data:image/(jpeg\|png\|webp);base64,...`. |
| `bersihkanFoto(data)` / `bersihkanTanggal(data)` | `(data) => void` | Hapus foto/tanggal yang tidak lolos validasi dari satu objek data. Dipakai otomatis di `load()`, `applyBackupData()`, `applyPulledData()`. |
| `initials(nama)` | `(nama) => string` | `initials('Ahmad Fauzi')` → `'AF'` (untuk avatar huruf). |

## Self-test mesin

```js
// Di browser (UI nanti memanggil dari suite ?selftest=1):
runEngineSelfTests(function (nama, ok, detail) {
  // catat: tampilkan "PASS | nama | detail" atau "FAIL | ..."
}).then(function (r) {
  console.log('PASS ' + r.pass + ' | FAIL ' + r.fail);
});
```

- Tidak menyentuh DOM, jadi bisa jalan di browser maupun Node.
- Menguji: seed 40 santri, NIS unik, validasi nilai, tarik di atas saldo
  ditolak, tarik di atas Rp200.000 minta konfirmasi, rapor s1 ganjil-2627
  (Harian 82.5, Imda 90, Praktek 88, Akhir 86.4), CSV round-trip, antrean
  sinkron saat offline, URL Apps Script malformed ditolak tanpa throw,
  plus jenjang, backup/restore, aturan konflik, sanitasi foto/tanggal.
- Menguji autentikasi lokal (40 uji): vektor SHA-256 (`''`, `'abc'`, vektor
  NIST 56 karakter), login benar/salah dengan alasan generik yang identik,
  sesi dibuat lalu `sesiAktif()` mengembalikannya, sesi kedaluwarsa ditolak,
  matriks peran (Guru ditolak 9 rute, diizinkan 7 rute; Pimpinan semua rute),
  tambah pengguna duplikat ditolak, reset sandi lalu login sandi baru,
  hapus diri sendiri dan hapus Pimpinan terakhir ditolak, ganti sandi
  membersihkan flag `wajibGantiSandi`, seed pengguna tersimpan sebagai hash
  (tanpa string sandi awal), backup/restore pengguna, dan `clearAllData()`
  yang mempertahankan pengguna seed.
- Setelah selesai, data selalu dikembalikan ke data contoh dan antrean
  dikosongkan.
- Hasil terakhir yang diverifikasi (Node, 15 Nov 2026): **PASS 120 | FAIL 0**
  (mesin saja). Harness jsdom lengkap (mesin + UI): **PASS 154 | FAIL 0**.

## Perubahan nama / perilaku vs v1 (yang wajib diketahui Kirana)

| Nama v1 | Status v2 | Alasan |
|---|---|---|
| Semua `render*`, `renderShell`, `go`, `routeFromHash`, `openModal`, `closeModal`, `openLainnya`, `closeSheet`, `confirmModal`, `runConfirm`, `showAlert`, `toast`, `shareText`, `fallbackCopy`, `downloadFile` | **Dihapus** | Kode UI. UI baru ditulis Kirana dari mockup. |
| `cekOnboarding`, `tutupOnboarding`, `ONBOARD_KEY`, `OB_SLIDES`, `obSlide` | **Dihapus** | Onboarding = UI. Flag `tpq_onboarded` tetap dipakai UI kalau mau. |
| `getMode`, `setMode`, `applyMode`, `isDesktopMode`, `MODE_KEY` | **Dihapus** | Mode tampilan (desktop/mobile/otomatis) = urusan UI. |
| `updateSyncStatus` | **Dihapus** | Menulis ke `#sync-status` (DOM). UI membaca `syncState()` tiap render. |
| `avatarHtml`, `statusBadge`, `sppBadge`, `barChartHtml`, `jenjangBarHtml` | **Dihapus** | Menghasilkan HTML. UI yang membangun markup. |
| Semua `submit*`, `open*Form`, `openSantriDetail`, `openStatusForm`, `setAbsensiKelas`, `setAbsensiGuru`, `isiKategoriKeuangan`, `openPicker`, `renderPickerModal*`, `pickerSet*`, `pickerPick`, `onPhotoChange`, `sortSantri`, `sortArrow`, `renderSantriOnly`, `renderGuruOnly`, `bukaHasilBelajar`, `toggleSem`, `setRaporSemester`, `toggleNotifSemua`, `tutupPengumuman`, `kirimPengingatSPP`, `bukaStruk`, `bagikanRapor` | **Dihapus, diganti fungsi data di bawah** | Membaca input DOM / membuka modal / me-render. |
| `simpanSantri`, `ubahStatusSantri`, `catatTabungan`, `tambahTarget`, `simpanKeuangan`, `simpanRapbm`, `simpanBiaya`, `simpanPertemuan`, `catatHafalan`, `simpanGuru`, `tambahPengumuman`, `simpanNilai`, `ubahNilai`, `simpanAlokasi`, `simpanJadwal`, `tambahPiket`, `simpanAbsensiGuru`, `simpanSettings` | **Baru** | Pengganti `submit*`/`open*Form`. Terima objek data, kembalikan `{ ok, ... }`. |
| `tambahKelas`, `ubahKeuangan`, `gantiSandiPaksa`, `antreanPernahDipotong` | **Baru (ronde 2026-11-15)** | Lihat tabel masing-masing di atas. |
| `exportSantriCSV`, `exportGuruCSV`, `exportNilaiCSV`, `exportAbsensiCSV`, `exportKeuanganCSV`, `exportRaporCSV`, `downloadTemplate`, `backupJSON` | **Nama dipertahankan, hasil berubah** | Dulu mengunduh + toast; kini mengembalikan `{ filename, csv/json, count }`. UI yang mengunduh. |
| `openSantriPicker`, `openGuruPicker` | **Nama dipertahankan, hasil berubah** | Dulu membuka modal; kini mengembalikan `{ title, items, chips, onPick }`. UI yang me-render. |
| `flushSync(showToast)` | **Nama dipertahankan, signature berubah** | Kini `flushSync()` tanpa argumen; hasil tetap Promise kode string. Toast = urusan UI. |
| `pullFromAppsScript`, `pullCsvFromSheet`, `sendToAppsScriptNow`, `saveSheetConfig` | **Nama dipertahankan, hasil berubah** | Dulu menampilkan alert/modal + render; kini mengembalikan objek/Promise. `saveSheetConfig` kini menerima objek `{ sheetLink, appsScriptUrl, syncToken, gid }`, bukan membaca input DOM. |
| `copyCsvToClipboard` | **Diganti `csvTextFor(jenis)`** | Clipboard + toast = urusan UI; engine hanya membangun teks CSV. |
| `handleImportFile`, `handleRestoreFile` | **Diganti `importCsvText`, `restoreFromText`** | Membaca file = urusan UI (input file + FileReader). |
| `sandiBaruValid(sandi, idPengguna)` | `(sandi, idPengguna) => null \| { ok: false, error, alasan }` | Aturan sandi baru (ronde perbaikan 2026-11-15, dipakai keempat jalur: `tambahPengguna`, `resetSandiPengguna`, `gantiSandiSendiri`, `gantiSandiPaksa`): minimal 8 karakter (`error: 'sandi-terlalu-pendek'`), tolak sandi sama dengan ID pengguna, tolak daftar sandi umum `SANDI_UMUM` (`'12345678'`, `'password'`, `'123456'`, `'qwerty'`, `'admin123'`, `'guru123'`, `'password123'`, `'123456789'`, `'qwerty123'`, `'11111111'`) (`error: 'sandi-lemah'`). `null` = lolos. Login dengan sandi lama/seed TIDAK diperiksa aturan ini — `admin123` / `guru123` tetap bisa dipakai masuk sampai diganti. |
| `clearAllData` | **Nama dipertahankan, perilaku berubah** | Dulu mengosongkan semuanya lalu kembali ke pengguna seed; kini **pengguna saat ini dipertahankan** (sandi + sesi tetap berlaku, tanpa paksaan ganti sandi). Data lain tetap dikosongkan. UI WAJIB konfirmasi dulu. |
| `load()` | **Nama dipertahankan, perbaikan** | Kini menggabungkan data tersimpan dengan `emptyData()` supaya kunci yang hilang dilengkapi (v1 bisa crash di UI kalau kunci hilang). Data tersimpan tanpa `pengguna` dilengkapi pengguna seed. **Pengguna dari penyimpanan kini divalidasi bentuknya lewat `bersihkanPengguna()` (R7).** |
| `applyBackupData` | **Nama dipertahankan, perilaku berubah** | **Aturan K2:** pengguna lokal yang masih ada TIDAK PERNAH ditimpa berkas cadangan; `pengguna` dari berkas hanya dipakai kalau daftar lokal kosong (lalu divalidasi bentuknya); kalau kosong juga, pakai pengguna seed. **Ronde 2026-11-15:** kunci yang TIDAK ADA di berkas dipertahankan dari data lokal (dulu dilengkapi dari `emptyData()` sehingga RAPBM/biaya/target ikut terhapus). |
| `backupJSON` | **Nama dipertahankan, isi berubah** | Kini memuat `pengguna` (salt+hash saja); sesi login tidak ikut. |
| `setJenjang(j)` | **Nama dipertahankan** | Kini mengembalikan `j` dan TIDAK me-render. |
| `save()` | **Nama dipertahankan, hasil baru** | Kini mengembalikan `boolean` (`false` kalau penyimpanan gagal). |
| `simpanPertemuan` | **Nama dipertahankan, signature berubah** | Kini `simpanPertemuan(kelasId, tanggal, materi, absensi)`; kelas tak dikenal dikembalikan sebagai error, bukan melempar (bug v1). **Ronde 2026-11-15:** tanggal+kelas sama di-upsert (timpa), bukan duplikat; kehadiran hanya dihitung dari pertemuan yang kelasnya cocok. |
| `simpanAbsensiGuru` | **Nama dipertahankan, signature berubah** | Kini `simpanAbsensiGuru(kelompok, tanggal, draft)` dengan `draft = { guruId: status }`. |
| `riwayatAbsensiGuru` | **Nama dipertahankan, hasil berubah** | Dulu string HTML; kini array data. **Ronde 2026-11-15:** tanpa `batas` kembalikan semua (dulu 12 terbaru). |
| `runSelfTest`, `selftestLog` | **Diganti `runEngineSelfTests(t)`** | Dulu memakai DOM + render layar; kini murni data, mengembalikan `Promise<{ pass, fail }>`. |
| `init` | **Diganti `initEngine()`** | Dulu me-render + daftar service worker; kini hanya isi jenjang + mulai sinkron. |
| `initSyncIndicator` | **Diganti `startSync()` / `stopSync()`** | Dulu membuat elemen `#sync-status`; kini hanya siklus sinkron. |
| `dismissedAnn` | **Dihapus** | State UI (pengumuman yang ditutup). |
| `currentRoute`, `RENDERERS` | **Dihapus** | Router = urusan UI. |

## Yang TIDAK dibawa dari v1 (sengaja)

- Semua render dan markup, tab bar, sidebar, onboarding, modal, toast.
- `.xlsx` (tanpa library berat; CSV + JSON saja).
- Foto: engine hanya menyimpan data URL gambar yang sudah diperkecil
  (maks 480px, JPEG) — pengecilan gambar dari file tetap urusan UI saat
  memilih foto, dengan `fotoAman()` sebagai penjaga saat data masuk.
- Mode tampilan desktop/mobile, router hash, dan service worker (urusan UI/PWA shell).

## Batasan jujur (belum bisa dipastikan di sini)

- **Sinkron live ke Apps Script asli klien belum terverifikasi** — belum ada
  URL Web App asli dari klien. Yang terverifikasi: logika antrean, allowlist
  host, penolakan URL malformed/host luar tanpa throw, dan aturan konflik
  (diuji di Node). Uji kirim/terima sungguhan butuh URL asli + Sheet klien.
- **Pull dari Sheet hanya mengembalikan** santri, guru, nilai, pertemuan,
  keuangan (lihat `google-apps-script-contoh.js`); tabunganTx, hafalanLog,
  pengumuman, pengaturan, RAPBM, jadwal, absensi guru, dan target tetap di
  perangkat dan hanya terkirim saat sync. Ini batasan skrip contoh v1 yang
  dipertahankan, bukan bug.
- **Tarik CSV dari Sheet yang di-publish bisa gagal karena CORS** dari
  `docs.google.com`; jalan keluarnya unduh CSV lalu import.
- **`save()` memakai jam perangkat** untuk `_updatedAt`; kalau jam dua
  perangkat jauh berbeda, aturan "terbaru menang" bisa salah. Ini batasan
  v1 yang dipertahankan.
- **Token sinkron** (`TPQ_SYNC_TOKEN`) adalah kata sandi bersama, bukan
  API key Google; URL Web App yang bocor tetap bisa dipakai orang lain
  kalau token belum diatur di Apps Script.
- **MASALAH TERBUKA — `isContoh` tidak pernah dibalik saat klien mulai
  mengisi data asli (temuan sampingan Jaka, ronde perbaikan 2026-11-15,
  diverifikasi Wira lewat grep):** tidak ada satu pun alur aplikasi yang
  mengubah `db.isContoh` menjadi `false` saat klien mulai mengisi data
  asli di atas data seed. Satu-satunya tempat `isContoh: false` muncul di
  luar selftest adalah `emptyData()` (`engine.js:295`) — jadi flag hanya
  menjadi `false` lewat "Hapus semua data" (`clearAllData()` →
  `emptyData()`) atau lewat restore backup yang `isContoh`-nya `false`.
  Klien yang memakai aplikasi di atas data seed dan mengisinya tanpa
  pernah menghapus data akan TETAP `isContoh === true` — padahal sebagian
  datanya sudah data asli. Akibatnya penjaga S1 (`bolehSelftest()` di
  `app.js` + `bersih()` di `engine.js`) bersandar pada flag yang tidak
  pernah dibalik: `?selftest=1` masih bisa menghapus data klien seperti
  itu. Ini BUKAN tugas ronde ini; butuh pemilik — ronde wizard (Sari)
  atau ronde berikut: tetapkan momen peralihan contoh → asli (mis. saat
  wizard selesai / saat "Hapus semua data" / saat santri asli pertama
  disimpan) dan balik flag di sana. Sampai itu dikerjakan, JANGAN
  membagikan link `?selftest=1` ke klien.

## Perilaku UI (app.js) — ronde perbaikan 2026-11-15

- **F2 lockout login (hanya jalur UI `submitLogin`, BUKAN engine
  `verifikasiLogin`):** penghitung gagal per ID di localStorage
  (`tpq-madin-pwa-login-gagal`); 5 gagal beruntun → blokir 60 detik dengan
  pesan sisa waktu; reset saat login berhasil; setelah masa blokir lewat,
  penghitung mulai lagi dari 0. **Batasan jujur:** penghitung client-side
  bisa dihapus dengan membersihkan storage perangkat — ini penahan
  percobaan asal-asalan, bukan keamanan tingkat server.
- **F6 guard renderer:** tiap renderer rute top-level mengembalikan `''`
  bila tidak ada sesi atau rute tidak diizinkan peran
  (`if (!sesiSaya() || !bolehRute(id)) return '';`). Ini pertahanan UI;
  `render()` tetap penjaga utama. Bukan keamanan server.
- **Kelas Berikutnya (dashboard):** `kelasBerikutnya()` menghitung jadwal
  berikutnya yang sesungguhnya dari `jadwalKbm` + hari/jam sekarang (7 hari
  ke depan, hari ini hanya jam yang belum lewat), menghormati filter
  jenjang; fallback ke kelas pertama bila tidak ada jadwal. Label "Kelas
  Berikutnya" dipertahankan.
- **Picker guru di form piket:** `openPicker` memakai `openModal`, jadi
  picker menimpa modal form. Callback picker TIDAK BOLEH menyentuh elemen
  form — pilihan guru + draf isian disimpan di `piketGuruDipilih` /
  `piketDraf`, lalu form dibuka lagi dengan isian terisi
  (`bukaPickerGuruPiket()` / `openPiketForm()`); Batal di picker
  mengembalikan form lewat `picker.onCancel` (`pickerBatal()`).
- **Keuangan (T-22):** form tambah punya kolom catatan; `submitKeuangan`
  memakai pola error S5 (error di dalam form via `gagalForm`, bukan hanya
  toast); riwayat transaksi punya tombol Ubah (modal `openKeuanganForm` +
  `submitKeuanganEdit` → `ubahKeuangan`).
- **Kelas (T-02):** tombol "Tambah kelas" + form (`openKelasForm` /
  `submitKelas` → `tambahKelas`); teks pesan kosong tidak lagi mengklaim
  kelas dibuat otomatis saat import tanpa menyebut tombol.
- **DITUNDA (keputusan, bukan lupa):** N04/N05 — menyamakan `kelas.ustadz`
  dengan profil guru tidak bisa diselesaikan bersih (5 guru vs 10 kelas;
  `kelas.ustadz` satu string tidak bisa cocok untuk semua kelas yang
  diajar guru yang sama); T-04 (rapor parsial), T-09 (SPP Lunas vs kas),
  F1 (peran Guru mutasi master data) — ditahan menunggu Mas.
