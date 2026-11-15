# CHANGELOG — PWA TPQ Al-Muttaqin, ronde perbaikan (v19 → v21)

> Dipakai untuk merge ke v20 (Sari) nanti. Tiap perubahan: nomor temuan,
> file, fungsi/baris, sebelum → sesudah — supaya bisa diikuti baris demi
> baris.
>
> **Snapshot akhir yang diverifikasi Wira:** `pwa-v2-fix/` —
> `app.js` sha256 `2220447b6f7f0be7c97ab7440f26c380e9371064da5adeb31d8aad73da58f6d7`
> (5.661 baris),
> `engine.js` sha256 `dc43ae0a2ea68ecab9e2a877aac3251328795a302313652231dcf809c3e4af34`
> (3.162 baris, tidak berubah sejak Jaka selesai),
> `sw.js` sha256 `f5e5b9b2b51c83324f4fcd4e055e0f24bcd038859a0bdf28bb0c15311f17294e`
> sebelum bump (lihat §7).
> Baseline: v19 murni (selftest 512/512). Perjalanan harness:
> 512/512 → 477/524 → 544/553 → 627/629 → **629/629 HIJAU**.
>
> **Catatan sumber (jujur):** laporan tertulis Kirana dan Jaka TIDAK
> tersedia bagi Wira saat CHANGELOG ini ditulis. Entri di bawah disusun
> dari: (1) inspeksi kode `pwa-v2-fix/` (nomor baris = snapshot di atas),
> (2) verifikasi behavioral jsdom Wira
> (`audit-2026-11-15/wira-verifikasi-perbaikan.js`, 35 probe),
> (3) handover Bagas (ringkasan Jaka, handover K6, catatan akurasi A4,
> keputusan edge "50,5" dan label 6 karakter).
> Yang hanya diverifikasi lewat selftest bawaan (tes ditulis Kirana)
> ditandai `[selftest 629/629]` — suite-nya lolos, bukan tiap fitur
> diuji behavioral terpisah oleh Wira.

## Status verifikasi (snapshot akhir di atas)

- Harness jsdom Wira (`wira-verifikasi-perbaikan.js`): **PASS 34 / FAIL 1**
  (35 probe). Satu-satunya FAIL: A1c (celah kecil kotak kredensial —
  lihat §7). S1c (selftest bawaan hijau) kini PASS.
- Selftest bawaan (`run_selftest.js`, harness kanonik): **PASS 629 / FAIL 0**
  (dijalankan 2× berturut-turut pada snapshot akhir, hasil sama; plus
  1× lewat probe Wira — ketiganya 629/629).
- Tes engine Jaka: **282/282 PASS** (angka Jaka; Wira memverifikasi
  independen 7 jalur engine — S1-guard, S2, S4, S5, S6, A2, A4 — semua
  lolos di harness Wira).
- `node --check` `app.js` + `engine.js` + `sw.js`: lolos semua.
- **SW di-bump ke `tpq-madin-v21`** (lihat §7) — syarat terpenuhi:
  harness hijau penuh.

## 1. Perubahan terverifikasi behavioral (harness Wira)

### S1 — KRITIS: `?selftest=1` tidak lagi menghapus data asli (Jaka + Kirana)
- `app.js:3076-3080` (pemicu di `init`), `app.js:3085-3087` `bolehSelftest()` (BARU),
  `engine.js:2393-2405` `bersih()` (di dalam `runEngineSelfTests`).
- Sebelum: `if (new URLSearchParams(location.search).get('selftest') === '1') { setTimeout(runUiSelfTest, 300); }` — tanpa penjaga apa pun; `runUiSelfTest` memanggil `runEngineSelfTests` yang menimpa db dengan seed dan mereset sandi admin ke `admin123`.
- Sesudah: pemicu hanya jalan bila `bolehSelftest()` — yaitu `db.isContoh === true`. Bila data asli: `#selftest-root` menampilkan "Self-test hanya tersedia pada data contoh." dan tidak ada yang disentuh. Pertahanan kedua di engine: `bersih()` memeriksa `db.isContoh !== true` lalu melewati SELURUH penghapusan (tanpa `seedData`, tanpa `save`, tanpa `keluarPengguna`) dan mencatatnya sebagai langkah dilewati (`engine.js:2400-2403`). Selftest engine sendiri menguji guard ini (`engine.js:2927-2941`: marker NIS 888001 bertahan bila `isContoh=false`, selftest normal bila `true`).
- Verifikasi Wira: S1a PASS (pemicu dijaga `bolehSelftest()`); S1b PASS — DOM jsdom segar dengan URL `?selftest=1`, data asli dipasang SEBELUM `app.js` di-load (marker NIS 888001 + sandi `SandiAsliKlien9` + `isContoh=false`): marker bertahan, login sandi asli berhasil, `isContoh` tetap `false`, selftest tidak jalan, pesan penolakan tampil. Catatan: guard dievaluasi saat PENJADWALAN timer (bukan saat timer jalan); panggilan LANGSUNG `runUiSelfTest()` dari DevTools tetap menjalankan selftest — itu ancaman model S3, bukan S1.
- **Peringatan terkait — lihat §6 (masalah terbuka `isContoh`):** flag ini tidak pernah dibalik saat klien mengisi data asli di atas seed.

### S2 — Sedang: CSV formula injection dinetralkan di semua jalur export (Jaka)
- `engine.js:856-859` `csvEscape(v)`.
- Sebelum: `return /[\",\\n]/.test(s) ? '\"' + s.replace(/\"/g, '\"\"') + '\"' : s;` — hanya mengutip; sel `=2+5`, `@SUM(1+1)`, `+2+2`, `-2+2` keluar mentah.
- Sesudah: `if (/^\\s*[=+\\-@]/.test(s)) s = \"'\" + s;` sebelum pengutipan — sel rumus diawali satu kutip (`'`), termasuk bila ada spasi/tab di depan. Satu tempat (`csvEscape`), semua export ikut aman karena semua lewat `csvEscape`/`toCSV`.
- Verifikasi Wira: S2a PASS (`csvEscape('=2+5')` → `"'=2+5"`, dst., 5/5 kasus); S2b PASS — CSV hasil export di-parse kembali dan dipindai per sel: 5/5 jalur (santri, guru, nilai, keuangan, absensi) bersih; S2c PASS end-to-end (santri `=2+5+cmd|'/C calc'!A0` diekspor sebagai `'=2+5+cmd|...`).

### S4 — Kecil: `buatSalt` memakai CSPRNG (Jaka)
- `engine.js:443-456` `buatSalt()`.
- Sebelum: 32 karakter hex dari `Math.random` (`engine.js:441-446` v19).
- Sesudah: jalur utama `crypto.getRandomValues(new Uint8Array(16))` lalu encode hex; fallback `Math.random` hanya bila `crypto` tidak tersedia (setelah blok `try`, `engine.js:454-455`).
- Verifikasi Wira: S4a PASS (`getRandomValues` mendahului `Math.random` di sumber fungsi); S4b PASS (tetap 32 hex + unik).

### S5 — Kecil: aturan kompleksitas sandi (Jaka)
- `engine.js:579` `SANDI_UMUM`, `engine.js:580-586` `sandiBaruValid(sandi, idPengguna)` (BARU); pemakaian di keempat jalur: `tambahPengguna` (`engine.js:598`), `resetSandiPengguna` (`engine.js:613`), `gantiSandiSendiri` (`engine.js:651`), `gantiSandiPaksa` (`engine.js:707`).
- Sebelum: semua jalur hanya memeriksa panjang minimal 6 karakter; `123456` diterima.
- Sesudah: minimal 8 karakter (`error: 'sandi-terlalu-pendek'`), tolak sandi sama dengan ID pengguna, tolak daftar sandi umum (`'12345678'`, `'password'`, `'123456'`, `'qwerty'`, `'admin123'`, `'guru123'`, `'password123'`, `'123456789'`, `'qwerty123'`, `'11111111'`) (`error: 'sandi-lemah'`). Login dengan sandi lama/seed TIDAK diperiksa aturan ini — `admin123`/`guru123` tetap bisa dipakai masuk sampai diganti.
- Verifikasi Wira: S5a PASS (7/7 sandi lemah ditolak di `tambahPengguna`); S5b PASS (sandi sama-dengan-ID ditolak, sandi kuat 8+ diterima); S5c PASS (reset + ganti-sendiri juga menolak sandi lemah); S5d PASS (login seed tetap jalan).
- **Konsekuensi yang diputuskan Bagas (bukan carve-out engine):** sandi seed `admin123`/`guru123` ada di daftar blokir, jadi reset KEMBALI ke sandi seed ditolak. Pemulihan ke keadaan seed di selftest TIDAK lewat fungsi reset/ganti sandi lagi, melainkan menyalin entri langsung dari `seedPengguna()` (Kirana: BLOK B `app.js:4142`, S10 `app.js:~4966`, S7 `app.js:5560-5570`). **Catatan Kirana (untuk laporan): tidak ada carve-out di engine; semua bypass validasi sandi hanya terjadi di dalam kode selftest (`ujiUi`), tidak pernah di alur produksi.** Label "Minimal 8 karakter" di form sudah benar di layar ganti-sandi-paksa (`app.js:275,280,305`) dan ubah-sandi (`app.js:336,355`); **label di seksi Kelola Pengguna masih "minimal 6 karakter"** — teks intro (`app.js:1705`), label tambah pengguna (`app.js:1712`), cek UI tambah pengguna `sandi.length < 6` (`app.js:~1732`), teks reset (`app.js:~1742`), cek UI reset `baru.length < 6` (`app.js:~1761`). Perbaikan label itu DISETUJUI untuk ronde ini tetapi dikerjakan Bagas SENDIRI setelah QA Wira selesai (supaya tidak menginvalidasi QA yang sedang berjalan); Bagas menjalankan ulang `node --check` + harness dan memastikan tetap hijau sebelum laporan final — lihat §7.

### S6 — Kecil: restore di perangkat segar memaksa ganti sandi + peringatan (Jaka + Kirana)
- Engine: `engine.js:1627` `applyBackupData(data)`, paksa flag di `engine.js:1659` (`penggunaCadangan.forEach(function (p) { p.wajibGantiSandi = true; })`).
- Sebelum: di perangkat segar (pengguna lokal kosong), pengguna dari berkas dipakai apa adanya (`wajibGantiSandi` dari berkas, bisa `false`) — berkas buatan berisi Pimpinan + hash yang diketahui penyerang langsung bisa login.
- Sesudah: semua pengguna dari berkas yang dipasang di perangkat segar dipaksa `wajibGantiSandi = true`. Di perangkat berisi pengguna, aturan K2 lama tetap berlaku (pengguna lokal dipertahankan, berkas diabaikan).
- UI: `app.js:2284-2288` `peringatanRestoreHtml(data)` (BARU) + dipakai di modal konfirmasi restore (`app.js:2305`): "Perhatian: berkas ini berisi N akun pengguna. Bila perangkat ini belum punya pengguna, akun dari berkas akan dipasang dan kata sandinya wajib diganti saat login pertama. Pulihkan hanya berkas dari sumber tepercaya." (selftest: `app.js:5529-5532`).
- Verifikasi Wira: S6a PASS (akun `evil` hasil restore perangkat segar `wajibGantiSandi=true`); S6b PASS (teks peringatan ada di jalur restore); S6c PASS (perangkat berisi pengguna: akun berkas tidak terpasang, login ditolak).

### A1 — MENGHALANGI: kotak kredensial awal hanya bila data contoh (Kirana)
- `app.js:157-169` `tampilLogin()`, kotak di `app.js:161`.
- Sebelum: layar login tidak memberitahu ID/sandi awal di mana pun.
- Sesudah: bila `db.isContoh`, tampil `<div class="auth-contoh" role="note">Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama.</div>`; bila data asli, kotak tidak dirender.
- Verifikasi Wira: A1a PASS (kotak tampil pada data contoh); A1b PASS (tidak tampil pada data asli). **Celah kecil (A1c, FAIL harness):** kotak hanya menyebut akun `admin`/`admin123`, TIDAK menyebut akun guru (`guru1`/`guru123`) — lihat §7.

### A2 — MENGHALANGI: "Hapus semua data" mempertahankan pengguna + sesi (Jaka + Kirana)
- Engine: `engine.js:2272` `clearAllData()`. UI: `app.js:111` `pesanHapusData`, `app.js:2397` `mintaHapusSemuaData()`, banner di `app.js:162-164,270`.
- Sebelum: `db.pengguna = seedPengguna()` — sandi kembali ke `admin123`/`guru123` dengan `wajibGantiSandi=true`; sesi yang masih berlaku ikut terbaca flag itu sehingga pengguna dilempar ke layar ganti sandi paksa tanpa penjelasan; pesan sukses hanya toast 3,2 detik.
- Sesudah: `db.pengguna` dipertahankan apa adanya (pengguna saat ini, sandi yang sudah diganti, `wajibGantiSandi: false`); kalau daftar pengguna kosong, pakai seed. Sesi tetap valid. Pesan sukses menetap: `pesanHapusData` ("Semua data sudah dihapus. Aplikasi sekarang kosong. ...") tampil sebagai banner di layar login/ganti-sandi, atau `showAlert` bila render mendarat di dashboard (`app.js:2408-2418`).
- Verifikasi Wira: A2 PASS — sesudah hapus data: login sandi baru berhasil, `sesiAktif()` tetap admin, `wajibGantiSandi=false`, santri 0.

### A3 — MENGHALANGI: draft absensi per kelas (Kirana)
- `app.js:1492` `absDraftPerKelas(kelasId)` (BARU), `app.js:1497` `adaDraftAbsensi(kelasId)` (BARU), `app.js:1501` `pindahTabKelas(kelasId)` (BARU); pemakaian di `app.js:1462-1464` (`renderKelas`: `ui.absDraft = absDraftPerKelas(kelas.id)`), tab di `app.js:1478` (`onclick="pindahTabKelas('...')"` + penanda `•` bila ada draft), `app.js:1506-1507` `setAbsensiKelas`.
- Sebelum: onclick tab `ui.kelasId='…';ui.absDraft={};render()` (`app.js:1329` v19) — pindah tab membuang semua tanda tanpa peringatan.
- Sesudah: draft disimpan per kelas di `ui.absDraftPerKelas`; `ui.absDraft` tetap dipakai sebagai penunjuk ke draft kelas yang sedang dibuka (kode lama yang membaca `ui.absDraft` tidak berubah). Tab bertanda `•` bila kelas itu punya draft belum disimpan; ada baris status "Belum disimpan: ada perubahan absensi di kelas ini yang belum disimpan."
- Verifikasi Wira: A3 PASS (tandai Alpa lewat UI → pindah tab → draft kelas asal utuh di `absDraftPerKelas`); A3b PASS (kembali ke kelas asal: tanda Alpa masih ada + tombol `on-alpa` aktif).

### A4 — MENGHALANGI: input uang format Indonesia (Jaka + Kirana)
- Engine: `engine.js:1704-1716` `bacaRupiah(str)` (BARU) + selftest engine `engine.js:2986-2993`. UI: `app.js:75-100` `bacaJumlah(teks)` (BARU) + pemakaian di 8 titik: `submitTabungan` (`app.js:2439`), `submitTarget` (`app.js:2465`), `submitKeuangan` (`app.js:2486`), `submitKeuanganEdit` (`app.js:2530`), `submitRapbm` (`app.js:2574`), `submitBiaya` (`app.js:2599`), honor guru (`app.js:2684`), tarif SPP (`app.js:2908`). Input uang kini `type=text inputmode=decimal` (bukan `type=number`).
- Sebelum: semua kolom uang `parseInt(document.getElementById('tb-jumlah').value, 10)` dst. — ketik "50.000" tercatat Rp50 (8 titik `parseInt` uang: `tb-jumlah`, `tg-jumlah`, `ku-jumlah`, `ke-jumlah`, `rp-rencana`, `by-jumlah`, `g-honor`, `st-spp`).
- Sesudah (efektif): `bacaRupiah` membuang semua spasi + awalan `Rp`, lalu menghapus SEMUA `.` dan `,` — `"50.000"`→50000, `"50000"`→50000, `"50,000"`→50000, `"50.000.000"`→50000000, `"Rp 50.000"`→50000, kosong/teks→`NaN` (bukan 0, supaya UI menampilkan error, bukan mencatat Rp0 diam-diam). `bacaJumlah` mendelegasikan ke `bacaRupiah` bila ada; nilai tidak valid → error di dalam form (`tampilErrorForm`), bukan toast. Tidak ada `parseInt` tersisa pada input uang (hanya `sheet-gid` dan `al-jam` yang bukan uang).
- Verifikasi Wira: A4a PASS (fungsi ada); A4b PASS (7/7 kasus angka + NaN untuk kosong/teks, sesuai kontrak engine); A4c PASS (0 `parseInt` uang tersisa); A4d PASS (UI tabungan: "50.000" → +Rp50.000); A4e PASS (UI: "50,000" → +Rp50.000, konsisten dengan engine); A4f PASS (parser fallback lokal — bila helper engine tidak ada — kini mengikuti kontrak engine yang SAMA: "50,000" → 50000; komentar `app.js:74-83` sudah diperbaiki Kirana sehingga menyatakan kontrak engine dengan benar, bukan lagi `"'50,000' -> error"`).
- **Edge yang diketahui + didokumentasikan (keputusan Bagas, 15 Nov):** `"50,5"` → 505 — `bacaRupiah` menghapus koma begitu saja, jadi `"50,5"` dibaca 505, bukan 50,5. **DITERIMA apa adanya, tanpa perubahan engine.** Alasan: `"50,5"` bukan input rupiah yang realistis (jumlah selalu ribuan bulat); kedua pembacaan alternatifnya sama-sama edge case. Dicatat di sini sebagai edge yang diketahui, BUKAN sebagai bug.
- **Catatan akurasi (keputusan Bagas — lihat §4):** efektif `"50,000"`→50000 (sesuai brief). Komentar di `app.js:74-83` yang menulis `"'50,000' -> error"` hanya menggambarkan parser fallback lokal (yang hanya jalan bila helper engine tidak ada — saat ini helper ADA, jadi fallback tidak terpakai). Jangan tulis di CHANGELOG bahwa koma ditolak; tulis: koma diterima sebagai pemisah ribuan via `bacaRupiah`.

### A5 — MEMBINGUNGKAN: SPP Lunas dijelaskan + "Catat ke kas" (Kirana)
- `app.js:1343` (penjelasan di daftar SPP), `app.js:1345` (tombol per baris Lunas), `app.js:1356` `catatSppKeKas(id)` (BARU), `app.js:2616` (toast).
- Sebelum: menandai Lunas hanya mengubah status; saldo kas tidak berubah tanpa penjelasan.
- Sesudah: di bawah daftar SPP tertulis "Menandai Lunas tidak menambah saldo kas. Kalau uang SPP sudah diterima, catat ke kas lewat tombol \"Catat ke kas\" di baris santri yang Lunas, atau isi form Tambah transaksi di atas." Baris santri berstatus Lunas punya tombol "Catat ke kas" yang membuat transaksi Masuk; toast Lunas mengingatkan hal yang sama.
- Verifikasi Wira: A5 PASS (tombol + teks penjelasan ditemukan di layar SPP/Keuangan). Perilaku catat-ke-kas end-to-end (transaksi Masuk tercipta) BELUM diuji behavioral oleh Wira — lihat §7.

### A7 — MEMBINGUNGKAN: "Naik Jilid" minta konfirmasi (Kirana)
- `app.js:2691` `naikJilidSantriUI(id)`.
- Sebelum: langsung `naikJilidSantri(id)` tanpa konfirmasi; jilid tertinggi hanya toast sesudah gagal.
- Sesudah: hitung jilid berikut dari `JILID_LIST`; bila sudah tertinggi, `showAlert` menetap ("Sudah di jilid tertinggi. ... tidak ada jilid di atasnya."); bila belum, `confirmModal` ("Naikkan jilid ...? ... naik dari ... ke ....", `okLabel: 'Ya, naikkan'`) dan mutasi hanya di `onOk` (data pengguna di-escape dengan `esc()` di judul/isi modal).
- Verifikasi Wira: A7 PASS — klik "Naik Jilid": modal konfirmasi muncul, jilid BELUM berubah sebelum konfirmasi.

### K1 — Sedang: "Murid per kelas" di Dashboard (Kirana)
- `app.js:910-917` `rekapKelasDashboardHtml()` (BARU), dipakai `renderDashboard`.
- Sebelum: dashboard hanya total (38 santri aktif, dst.); rincian L/P per kelas hanya di Laporan dan Grafik.
- Sesudah: seksi kartu "Murid per kelas" di bawah kartu statistik: `Iqra 1 — 7 santri (L 4 · P 3)`, mengikuti filter jenjang; pesan kosong bila tidak ada kelas pada jenjang itu.
- Verifikasi Wira: K1 PASS (seksi + rincian L/P ditemukan di `#view` dashboard).

### K5 — Kecil: aria-label batang grafik menyebut hitungan gender (Kirana)
- `app.js:2138` `rincianGenderAria(d)` (BARU); pemakaian di `barChartHtml` (`app.js:~2155-2165`).
- Sebelum: `aria-label="Lihat santri kelas Iqra 1"` (`app.js:1983` v19).
- Sesudah: `"Lihat santri kelas Iqra 1 — 7 santri: 4 laki-laki, 3 perempuan"` (ditambah `, N belum diisi` bila ada jk kosong). Teks visual batang tidak berubah.
- Verifikasi Wira: K5 PASS (aria-label batang mengandung "4 laki-laki, 3 perempuan"). **Efek samping pada selftest (lihat §7):** 3 lookup lama di selftest masih memakai pencocokan persis label lama sehingga FAIL — test-nya yang basi, bukan fiturnya.

### A11 — MEMBINGUNGKAN: tombol Import CSV di layar Santri (Kirana)
- `app.js:1070` (toolbar Santri).
- Sebelum: layar Santri hanya "Tambah santri | Export CSV (yang tampil) | Template CSV murid"; import hanya di Pengaturan.
- Sesudah: label tombol "Import CSV" (input file `.csv`, `onchange="importFileCsv('murid', this)"`) di samping Template.
- Verifikasi Wira: A11 PASS (tombol ditemukan di `#view` Santri).

### A14 — Gesekan kecil: jenjang transaksi wajib dipilih bila filter "Semua" (Kirana)
- `app.js:1328` (select `#ku-jenjang`: opsi kosong "Pilih jenjang" bila `ui.jenjang === 'Semua'`, selain itu mengikuti filter aktif), `app.js:2537-2538` (`submitKeuangan`: `if (!jenjangKu) { tampilErrorForm(..., 'Pilih dulu jenjang transaksi.', 'ku-jenjang'); return false; }`).
- Sebelum: select selalu default TPQ (opsi pertama) tanpa mengikuti filter jenjang aktif.
- Sesudah: bila filter "Semua", pengguna wajib memilih jenjang (error di dalam form bila kosong); bila filter TPQ/Ibtidaiyah, select mengikuti filter itu.
- Verifikasi Wira: A14 diuji tidak langsung — probe BLOK C `submitKeuangan` tanpa jenjang TIDAK menyimpan (guard bekerja), dengan `ku-jenjang='TPQ'` menyimpan (lihat §7, butir 7-8: tes BLOK C-nya sendiri yang basi karena tidak mengisi jenjang).

## 2. S3 — dokumentasi batasan arsitektur (Wira)
- `API.md`: bagian baru "Batasan arsitektur — RBAC hanya ditegakkan di UI (S3, audit 15 Nov 2026)" + pembaruan baris-baris yang basi oleh ronde ini (`buatSalt`, `sandiBaruValid` (baru), `tambahPengguna`/`resetSandiPengguna`/`gantiSandiSendiri`/`gantiSandiPaksa` (aturan sandi 8 karakter + daftar umum), `clearAllData` (pengguna saat ini, bukan seed), `applyBackupData` (S6), `toCSV` (netralisasi rumus), catatan seed vs daftar blokir, masalah terbuka `isContoh`).
- Isi S3 (jujur, tanpa klaim berlebihan): RBAC hanya ditegakkan di UI (rute + tombol); fungsi engine bisa dipanggil langsung dari DevTools sehingga peran Guru tidak bisa ditegakkan penuh client-side; ini batasan yang diterima untuk aplikasi offline-first ini; penegakan peran sisi server direncanakan bila backend dipakai. Fungsi yang tidak memeriksa peran: `simpanSantri`/`hapusSantri`, `tambahKelas`, `simpanKeuangan`/`hapusKeuangan`, `tambahPengumuman`/`hapusPengumuman`, `simpanNilai`, `simpanRapbm`, `simpanBiaya`. Yang memeriksa peran hanya `tambahPengguna`/`resetSandiPengguna`/`hapusPengguna` (via `pemintaAdalahPimpinan`).

## 3. Terverifikasi lolos di selftest bawaan 629/629 [selftest 629/629]
Perubahan-perubahan di bawah ini lolos sebagai tes bernama di selftest
bawaan (suite hijau penuh pada snapshot akhir). Tesnya ditulis Kirana;
Wira memverifikasi suite-nya lolos, bukan tiap fitur diuji behavioral
terpisah. Nama tes dikutip dari output `SELFTEST DONE | PASS 629`.
- **A6** — tombol Simpan yang mati menjelaskan kenapa (tes: "A6: tombol Simpan nilai yang mati menjelaskan kenapa", "A6: tombol Simpan setoran yang mati menjelaskan kenapa"; teks bantuan di Penilaian/Hafalan/Tabungan, `app.js:1570,1931`).
- **A8** — rumus rapor di bawah Nilai Akhir (`app.js:1902`: "Nilai Akhir = 40% Harian + 30% Imda + 30% Praktek. ..."; tes: "A8: rumus rapor 40/30/30 dijelaskan di Penilaian").
- **A9** — sub-teks tile "Lainnya" (`app.js:919`, komentar A9; tes: "A9: tile \"Lainnya\" menyebut modul tersembunyi (dan 8 lagi)").
- **A12** — toast sukses export/backup menyebut folder Unduhan (`app.js:2247-2249`, dst.; tes: "A12: toast export menyebut folder Unduhan", "A12: toast backup menyebut folder Unduhan").
- **A13** — form santri dikelompokkan (Data diri / Kelas & jenjang / Wali) + penjelasan Kelas vs Jilid (tes: "A13: form santri dikelompokkan ...", "A13: form menjelaskan Kelas vs Jilid").
- **A16** — penjelasan istilah RAPBM / Realita / Set Biaya / Tapel / Saldo awal / Imda (tes: 6 tes A16, semua lolos).
- **A17** — ganti mode menyebut jalan kembali + memakai konfirmasi (tes: 4 tes A17, semua lolos).
- **A18** — tombol pengumuman "Simpan & tampilkan di Beranda" (tes: "A18: tombol pengumuman ...").
- **A19** — absensi menjelaskan default Hadir; label Materi terikat ke inputnya (tes: "A19: absensi menjelaskan default Hadir", "A19: label Materi terikat ke inputnya (for=kl-materi)").
- **K2** — label Rapor terlihat di tombol grid Beranda (tes statis CSS: "K2: tombol grid Beranda menampilkan label Rapor yang terlihat"; plus "K2-statis: label tab non-aktif ink2 + pil nav 0,85").
- **K3** — pesan kosong Santri menawarkan "Atur ulang filter" + mereset filter; toolbar punya select Urutkan (Nama/NIS/Kelas/Tabungan) dan sortir Tabungan numerik (tes: "K3: pesan kosong menyarankan ...", "K3: \"Atur ulang filter\" benar-benar mereset filter", "K3: toolbar Santri punya select Urutkan ...", "K3: Urutkan Tabungan mengurutkan kartu HP menaik secara angka").
- **K4** — dropdown semester 44px (tes statis CSS) + kartu santri HP punya tombol Ubah di samping Detail (tes: "K4: kartu santri HP punya tombol Ubah di samping Detail").
- **K6** — gagal toggle/simpan memberi pesan menetap (`showAlert`), bukan toast-only — penanda komentar di `app.js:2611,2682,2753,2791,2879` (tes: "K6: toggle SPP gagal memberi pesan menetap", "K6/A15: simpan absensi tanpa materi memberi error menetap", "K6: toggle honor gagal memberi pesan menetap", "K6: toggle pengumuman gagal memberi pesan menetap"; handover reproduksi lengkap di §5).
- **K7** — home indicator ala iOS disembunyikan di perangkat non-iOS (tes: "K7: home indicator ala iOS disembunyikan di perangkat non-iOS").
- **K8** — input foto santri/guru dibungkus label "Pilih foto" + nama file terpilih (tes: "K8: input foto santri ...", "K8: input foto guru ...").
- **K10** — riwayat pertemuan ringkas + rincian per santri di modal (tes: "K10: riwayat pertemuan ringkas ...", "K10: Lihat rincian membuka daftar per santri dengan badge status").
- **F3** — export gagal menampilkan modal fallback berisi CSV + tombol salin; `downloadFile` mengembalikan false/true sesuai ketersediaan `createObjectURL` (tes: "K6: dl-note TIDAK tampil bila export rapor gagal", "F3: export gagal menampilkan modal fallback ...", "F3: downloadFile mengembalikan false ...", "F3: downloadFile mengembalikan true ...").
- **S11 / S14 / K1 (CSS)** — baris aksi tabel 140px + tinggi min 44px; titik onboarding 44px area ketuk (titik 8px); kontrol sering diketuk 44px (tes statis CSS, semua lolos).
- **T-02 / T-03 / T-05 / T-06 / T-12 / T-13 / T-15 / T-22 / T-23 / F2 / F6** — tombol Tambah kelas; tab Iqra 2 (5 santri aktif); `decidePull` tanpa `updatedAt` server = warn; restore cadangan sebagian (RAPBM/biaya/target utuh); sortir Tabungan numerik; antrean sinkron dibatasi 500; import nilai pakai NIS (nama kembar ditolak); kolom Catatan + tombol Ubah keuangan; kelas berikutnya dari jadwal KBM nyata; F2 blokir login 60 detik setelah 5 gagal; F6: 16 renderer rute mengembalikan string kosong tanpa sesi (semua tes lolos).
- **S7 (audit Wira v19):** kondisi sudah tidak ada di kode saat ini — `render()` memanggil `renderShell()` sebelum `return` di jalur pengalihan rute terlarang (dengan komentar S7); tes: "S7: Guru ke Keuangan dialihkan ke dashboard + sidebar tanpa Keuangan (shell di-render)". Ronde mana yang memperbaikinya tidak bisa dipastikan dari berkas ini saja.

## 4. Catatan akurasi A4 — SELESAI (kontrak kanonik: koma diterima)
Efektif: "50,000"→50000 (sesuai brief) — karena bacaJumlah (app.js:84) mendelegasikan ke bacaRupiah engine (engine.js:1707) yang menghapus semua "." dan ",". Komentar di app.js:74-83 SUDAH diperbaiki Kirana: kini menyatakan kontrak engine dengan benar ("titik/koma pemisah dihapus: \"50.000\" -> 50000, \"50,000\" -> 50000"), dan parser fallback lokal diselaraskan ke kontrak yang sama (hapus `[\\s.,]`, lalu cek digit). Tes KIRANA-FIX A4 yang dulu menegaskan `"50,000" ditolak` sudah diubah Kirana menjadi `bacaJumlah("50,000") = 50000 (kontrak engine: koma dihapus)` dan tes UI `"50,000" ditolak` diganti `"abc" ditolak dengan error di dalam form (saldo tetap)` — keduanya lolos di 629/629. **Ranjau §4 lama (tes vs engine) sudah tidak ada.**
**Edge yang diketahui (keputusan Bagas, 15 Nov):** `"50,5"` → 505 (koma dihapus begitu saja). DITERIMA apa adanya, tanpa perubahan engine — `"50,5"` bukan input rupiah yang realistis (jumlah selalu ribuan bulat); kedua pembacaan alternatifnya sama-sama edge case. Bukan bug.

## 5. Handover K6 — cara persis menggagalkan tiap toggle (v21, build pwa-v2-fix/)
> Handover reproduksi dari Citra/tim audit lanjutan — dimasukkan apa adanya
> supaya tim audit bisa menjalankan langkah K6 persis di v21.

=== HANDOVER K6 — cara persis menggagalkan tiap toggle (v21, build pwa-v2-fix/) ===
Definisi "menetap": showAlert (app.js:666) menulis ke #alert-root tanpa timeout — pesan bertahan sampai render/navigasi berikutnya atau showAlert lain. toast (app.js:68) hilang sendiri setelah 3,2 detik. Cara verifikasi: setelah memicu gagal, tunggu >5 detik → `document.querySelector('#alert-root .alert-error')` harus tetap ada berisi judul + pesan. Prasyarat umum: login admin (Pimpinan), data contoh aktif. Keenam fungsi UI bersifat global (classic script) → bisa dipanggil dari konsol DevTools di browser live maupun jsdom. Untuk mengembalikan data setelah langkah "hapus ... lalu klik": Pengaturan → "Reset ke data contoh".

1. toggleSppUI(id) — app.js; engine toggleSpp engine.js:1876 (gagal hanya bila santri tidak ditemukan → 'Santri tidak ditemukan.'). Tombol: kartu Tunggakan SPP di Dashboard (tombol status SPP). Deterministik: konsol `toggleSppUI('id-tidak-ada')` → showAlert "SPP tidak bisa diubah." + "Santri tidak ditemukan." Realistis: Dashboard → konsol `hapusSantri('s1')` → TANPA refresh/navigasi, klik tombol status SPP baris Ahmad Fauzi yang masih tampil → pesan yang sama.
2. simpanPertemuanUI() — app.js; engine simpanPertemuan engine.js:1963 (gagal bila: kelas tidak ditemukan / materi kosong / kelas tanpa santri aktif). PENTING: ketiga kondisi itu SUDAH dijaga di UI dengan showAlert sebelum memanggil engine — jadi cabang `!r.ok` TIDAK BISA dicapai lewat klik UI murni. Audit cabang engine via stub; audit ketiga penjaga via UI: (a) materi kosong: Kelas & Absensi → pilih kelas → kosongkan field Materi → klik "Simpan pertemuan" → "Materi belum diisi. Isi dulu materi hari ini." (b) kelas tanpa santri aktif: Kelas → Tambah kelas "Kelas Uji" (tanpa santri) → buka tab kelas itu → isi materi → klik Simpan → "Tidak ada santri aktif. Tidak ada santri aktif di kelas ini." (c) kelas belum dipilih: konsol `ui.kelasId='bogus'; simpanPertemuanUI();` → "Kelas belum dipilih. Pilih dulu kelasnya." Cabang engine (stub, jsdom/konsol): `var _sp=simpanPertemuan; simpanPertemuan=function(){return {ok:false, message:'uji gagal simpan'};};` → isi materi → klik "Simpan pertemuan" → "Pertemuan tidak bisa disimpan. uji gagal simpan" (menetap) → kembalikan `simpanPertemuan=_sp;`.
3. naikJilidSantriUI(id) — app.js; engine naikJilidSantri engine.js:2001, naikJilid engine.js:833, JILID_LIST engine.js:114 (tertinggi 'Tahfidz Juz 28'). Titik gagal 1 — penjaga UI jilid tertinggi: TIDAK ADA santri seed di 'Tahfidz Juz 28' (seed Tahfidz: 4× 'Tahfidz Juz 30', 2× 'Tahfidz Juz 29', semua di kelas Tahfidz 1). Repro: konsol `santriById('s1').jilid='Tahfidz Juz 28'; render();` → Kelas & Absensi → tab Iqra 3 → klik "Naik Jilid" pada Ahmad Fauzi → "Sudah di jilid tertinggi. Ahmad Fauzi sudah di Tahfidz Juz 28, tidak ada jilid di atasnya." (Kembalikan via Reset ke data contoh.) Titik gagal 2 — cabang engine di dalam modal konfirmasi: Kelas & Absensi → klik "Naik Jilid" pada santri Iqra → modal "Naikkan jilid ...?" terbuka → konsol `hapusSantri('<id santri itu>')` → klik "Ya, naikkan" → "Jilid tidak bisa dinaikkan. Santri tidak ditemukan." (menetap). Deterministik level engine: `naikJilidSantri('id-tidak-ada')` → {ok:false, error:'tidak-ditemukan'}. Catatan: error engine 'jilid-tertinggi' tidak bisa dicapai lewat UI karena penjaga UI memblokirnya dulu dengan pesan menetap yang sama — verifikasi lewat panggilan engine langsung (set jilid 'Tahfidz Juz 28' lalu `naikJilidSantri('s1')` → {ok:false, error:'jilid-tertinggi'}).
4. toggleHonorUI(id) — app.js; engine toggleHonor engine.js:2056 (gagal hanya bila guru tidak ditemukan → 'Guru tidak ditemukan.'). Tombol: daftar Guru ("Tandai honor ..."). Deterministik: konsol `toggleHonorUI('id-tidak-ada')` → "Honor tidak bisa diubah. Guru tidak ditemukan." Realistis: Guru → konsol `hapusGuru('<id>')` (catatan: hapusGuru juga mengosongkan jadwal KBM + kelas.ustadz guru itu — pakai guru uji lalu Reset ke data contoh) → klik tombol "Tandai honor ..." guru itu yang masih tampil → pesan yang sama.
5. togglePengumumanUI(id) — app.js; engine togglePengumuman engine.js:2090 (gagal hanya bila pengumuman tidak ditemukan → 'Pengumuman tidak ditemukan.'). Tombol: daftar Pengumuman ("Tutup"/"Tampilkan lagi"). Deterministik: konsol `togglePengumumanUI('id-tidak-ada')` → "Pengumuman tidak bisa diubah. Pengumuman tidak ditemukan." Realistis: Pengumuman → konsol `hapusPengumuman('<id>')` → klik tombol "Tutup"/"Tampilkan lagi" pengumuman itu yang masih tampil → pesan yang sama.
6. simpanAbsensiGuruUI(kelompok) — app.js; engine simpanAbsensiGuru engine.js:2219 (gagal HANYA bila kelompok bukan 'Guru'/'Pimpinan' → 'kelompok-tidak-dikenali'). UI hanya pernah memanggil dengan 'Guru'/'Pimpinan' (dari tab KBM); draft kosong BUKAN gagal (ok:true, disimpan 0 + alert sukses) — jangan jadikan ekspektasi gagal. Deterministik: konsol `simpanAbsensiGuruUI('KelompokSalah')` → "Absensi guru tidak bisa disimpan. Kelompok harus Guru atau Pimpinan." (menetap; UI tidak memvalidasi kelompok sebelum memanggil engine, jadi panggilan langsung ini mencapai cabang engine). Alternatif stub jsdom: ganti sementara `simpanAbsensiGuru` dengan yang mengembalikan {ok:false}.

## 6. Masalah terbuka — `isContoh` tidak pernah dibalik (temuan sampingan Jaka)
TIDAK ADA satu pun alur aplikasi yang mengubah `isContoh` jadi `false` saat klien mulai mengisi data asli (hanya `emptyData()` yang `false`). Jadi klien yang memakai aplikasi di atas data seed tetap `isContoh=true` — penjaga S1 + gate `?selftest=1` bersandar pada flag yang tidak pernah dibalik. Diverifikasi Wira lewat grep `isContoh\s*=` di `app.js` + `engine.js` (snapshot di atas): satu-satunya penulisan `false` di luar selftest adalah `emptyData()` (`engine.js:295`); penulisan lain hanya di dalam selftest itu sendiri (`app.js:5219-5231`, `engine.js:2933,2939`, sementara untuk pengujian). Nuansa: flag MENJADI `false` lewat "Hapus semua data" (`clearAllData()` → `emptyData()`) atau lewat restore backup yang `isContoh`-nya `false` — tetapi klien yang mengedit data seed tanpa pernah menghapus data tetap `isContoh=true` padahal sebagian datanya sudah data asli. Akibat: `?selftest=1` masih bisa menghapus data klien seperti itu. **Bukan tugas ronde ini; butuh pemilik (ronde wizard Sari / ronde berikut):** tetapkan momen peralihan contoh → asli (mis. saat wizard selesai / saat santri asli pertama disimpan) dan balik flag di sana. Juga dicatat di `API.md` (§ Batasan jujur). Sampai itu dikerjakan: JANGAN membagikan link `?selftest=1` ke klien.

## 7. Yang BELUM selesai / sudah diselesaikan di akhir ronde
### 7a. Riwayat 9 FAIL (544/553) — SEMUA SUDAH DISELESAIKAN Kirana
Sembilan FAIL di snapshot tengah ronde (544/553, semuanya di kode selftest
`app.js`, 0 dari engine) diperbaiki Kirana sebelum harness hijau 629/629.
Dicatat di sini supaya jejaknya tidak hilang:
  1-3. `Grafik: klik batang Iqra 1 / Kelas 1 / nama kelas racun (escJs)` — lookup selftest memakai pencocokan persis label lama; K5 mengubah aria-label menjadi `"... — 7 santri: 4 laki-laki, 3 perempuan"`. Diperbaiki: lookup jadi pencocokan awalan (tes K5 baru `app.js:5413` sudah lolos sejak awal).
  4-5. `Guru lewat go() ke rute terlarang` + `Sidebar Guru berisi 7 menu` — pemulihan seed langsung mengembalikan guru1 ke `wajibGantiSandi=true`; `render()` menampilkan layar ganti sandi paksa dulu (benar dan aman — tidak ada kebocoran konten Keuangan). Diperbaiki di BLOK B (flag dibersihkan lewat alur UI yang benar sebelum tes `go()`).
  6. `Nama pengguna berisi tag HTML tampil sebagai teks di daftar pengguna` — lolos bila direproduksi terpisah; artefak kaskade dari keadaan sesi pada titik itu. Hilang setelah butir 4-5 diperbaiki.
  7-8. `BLOK C: submitKeuangan` + `keuangan: hapus transaksi BC` — tes tidak mengisi `#ku-jenjang`, yang kini wajib bila filter "Semua" (A14). Diperbaiki: tes BLOK C mengisi jenjang (seperti tes A4 Kirana di `app.js:5306`).
  9. `KIRANA-FIX: masuk sebagai admin untuk blok perbaikan` — BASKARA T-01 mengubah sandi admin menjadi `baskara123` tanpa cleanup; `masukSebagaiAdmin()` hanya mencoba `['admin123','sandiuji9']`. Diperbaiki: kandidat ditambah `'baskara123'` (`app.js:~5225`, "coba semua kandidat yang dikenal") — seluruh blok KIRANA-FIX kini jalan dan lolos.
### 7b. Yang masih tersisa
- **A1c (celah kecil, masih terbuka):** kotak kredensial contoh (`app.js:161`) hanya menyebut `admin`/`admin123`, TIDAK menyebut akun guru (`guru1`/`guru123`). Harness Wira 34/35 — satu-satunya FAIL. Dampak kecil (pola kredensial guru sama dengan admin; admin bisa melihat/mengelola pengguna). Perlu keputusan: tambah penyebutan guru1 ke kotak, atau biarkan.
- **Label "minimal 6 karakter" di Kelola Pengguna (masih terbuka, pemilik: Bagas):** 5 titik — teks intro (`app.js:1705`), label tambah pengguna (`app.js:1712`), cek UI tambah pengguna `sandi.length < 6` (`app.js:~1732`), teks reset (`app.js:~1742`), cek UI reset `baru.length < 6` (`app.js:~1761`). Engine menegakkan 8, jadi sandi 6–7 karakter lolos cek UI lalu ditolak engine (`'sandi-terlalu-pendek'`) — inkonsistensi UX, bukan celah keamanan. DISETUJUI diperbaiki di ronde ini, TAPI dikerjakan Bagas SENDIRI setelah QA Wira selesai (supaya tidak menginvalidasi QA yang sedang berjalan). Setelah edit itu, Bagas menjalankan ulang `node --check` + harness dan memastikan tetap hijau sebelum laporan final.
- **A5 end-to-end belum diuji behavioral oleh Wira:** tombol "Catat ke kas" + teks penjelasan terverifikasi ada; transaksi Masuk yang tercipta belum diuji Wira (tes bawaan: "A5: \"Catat ke kas\" mengisi form (SPP, Rp50.000) tanpa membuat transaksi" — lolos; pembuatan transaksi dari form itu sendiri diuji di tempat lain).
### 7c. SW bump — DILAKUKAN (syarat terpenuhi: harness 629/629 hijau)
`sw.js:2` `CACHE_VERSION`: `tpq-madin-v19` → **`tpq-madin-v21`** (v20 milik Sari — tidak dipakai). Verifikasi pasca-bump (15 Nov 2026 12:58:26 UTC, berkas di disk saat itu): hanya ada satu `sw.js` di `pwa-v2-fix/` (`./sw.js`, sha256 `67dc280da2ef5dfdc7b151b8ede7dd0fec14daafe8519959291f98d38169bfca`, baris 2 `const CACHE_VERSION = 'tpq-madin-v21';`); `node --check app.js + engine.js + sw.js` lolos semua; harness jsdom penuh SETELAH bump: **SELFTEST PASS 629/629, FAIL 0** (`app.js` `2220447b…`, `engine.js` `dc43ae0a…` — keduanya tidak berubah oleh bump). Perhatian: bump dilakukan atas snapshot akhir (`app.js` `2220447b…`); bila ada edit `app.js`/`engine.js` setelah ini sebelum deploy, jalankan ulang harness — versi SW sudah v21, tidak perlu bump lagi selama masih ronde yang sama.

## 8. DITAHAN — tidak diimplementasikan ronde ini
- **S13** (tile Menu Informasi → tujuan ganda), **K9** (tiga label modul berbeda), **T-04** (rapor parsial), **T-09 otomatis** (SPP Lunas otomatis buat transaksi kas — hanya penjelasan + tombol manual A5 yang dikerjakan), **F1** (peran Guru mutasi master data — lihat S3 §2). Menunggu keputusan Mas.

## 9. Berkas verifikasi
- Harness Wira: `audit-2026-11-15/wira-verifikasi-perbaikan.js` (+ hasil `wira-verifikasi-perbaikan.json`): 35 probe, **PASS 34 / FAIL 1** (hanya A1c — kotak kredensial contoh tidak menyebut guru1; S1c kini PASS karena selftest bawaan hijau). Probe A4f diperbarui di akhir ronde: fallback lokal kini mengikuti kontrak engine (koma → 50000), bukan lagi menolak koma.
- Selftest bawaan (`~/workspace/tools/jsdom-test/run_selftest.js`): **PASS 629 / FAIL 0** pada snapshot akhir (`app.js` `2220447b…`, `engine.js` `dc43ae0a…`), dijalankan 2× berturut-turut + 1× lewat probe Wira — ketiganya hijau. Perjalanan: 512/512 (v19) → 477/524 → 544/553 → 627/629 → 629/629.
- SW bump: `sw.js:2` `tpq-madin-v19` → `tpq-madin-v21`; `node --check sw.js` lolos; harness dijalankan ulang setelah bump dan tetap 629/629.
- Laporan audit v19 yang menjadi dasar ronde ini: `audit-2026-11-15/wira-security-audit-v19.md` (S1–S7), `mira-alur-pengguna-v19.md` (A1–A19), `kirana-uiux-audit-v19.md` (K1–K6).
- Skill yang dipakai Wira: Addy `security-and-hardening` + `code-review-and-quality` (SKILL.md dibaca penuh; AGENTS.md paket Addy dibaca — isinya mengatur repo skill itu sendiri, bukan proyek TPQ).

## 10. MERGE v20 → v21 (Bagas, 15 Nov 2026 — hasil merge di `pwa-v2-v21/`)

> Bagian ini hanya ada di salinan merge (`pwa-v2-v21/CHANGELOG.md`), bukan di
> `pwa-v2-fix/CHANGELOG.md`.

### 10a. Label "minimal 6 karakter" — SELESAI (Bagas, setelah QA Wira)
§7b di atas kini kedaluwarsa: label diperbaiki Bagas di `pwa-v2-fix/app.js`
(5 titik: teks intro `app.js:1705`, label tambah pengguna `app.js:1712`, cek
UI `sandi.length < 6` → `< 8` + pesan error `app.js:1732`, teks reset
`app.js:1742`, cek UI `baru.length < 6` → `< 8` + pesan `app.js:1761`) +
1 komentar basi di `engine.js:690` ("minimal 6 karakter tetap ditegakkan" →
8, sesuai `sandiBaruValid`). Setelah edit: `node --check` lolos,
harness `pwa-v2-fix/` tetap **629/629** (`app.js` sha256 berubah
`2220447b…` → `c7a663ea…`, `engine.js` tidak berubah isi kecuali komentar).

### 10b. Cara merge (bukan salin manual)
- Basis: salinan pohon v20 (`pwa-v2-registrar/`, SW `tpq-madin-v20`,
  harness v20 sendiri **633/633**) → direktori baru `pwa-v2-v21/`;
  `tes-hp.html` + `tes-hp-demo.html` DIBUANG dari salinan merge (halaman
  tes sementara, tidak boleh ikut deploy).
- `diff3` tiga-arah: `pwa-v2-fix/` (v19+perbaikan) vs ancestor v19 vs
  `pwa-v2-registrar/` (v20). Ancestor v19 sempat hilang dari `/tmp`
  (tmpfs dibersihkan antar-turn) — dipulihkan dari deployment Cloudflare
  v19 `1c4f87ec` (dibuat 2026-11-15T11:41:04Z = 18:41 WIB;
  `https://1c4f87ec.tpq-al-muttaqin-preview.pages.dev/`, diunduh via curl ke
  `v19-reconstructed/`) dan diverifikasi: `sw.js` = `tpq-madin-v19`,
  `jk` 112× di `engine.js`, `labelTapel` 5× di `app.js`, tanpa kode
  wizard/panduan/identitas/profil, harness **512/512** (baseline v19 yang
  diketahui). Catatan: sha256 `engine.js` hasil unduh (`d29eaf03…`) TIDAK
  sama dengan `BASELINE-ENGINE.sha256` di `pwa-v2-fix/` (`74e7f761…`) —
  berkas baseline itu tidak cocok dengan deployment v19; verifikasi
  perilaku (512/512 + marker) yang dipakai sebagai bukti v19.
- Hasil `diff3`: `app.js` 6 konflik, `engine.js` 2 konflik, `styles.css`
  0, `mockup.css` 0, `index.html`/`manifest.json` identik. Kedelapan
  konflik diselesaikan sebagai GABUNGAN (kedua sisi dipertahankan),
  oleh skrip `merge-v21-notes/resolve.py`:
  1. Santri kosong (K3 vs empty state Sari): cabang `db.santri.length===0`
     Sari + saran "Atur ulang filter" K3 di cabang else.
  2. SPP (A5 vs empty state Sari): baris emptyState + paragraf A5.
  3. Realita (A16 vs struktur `rapbmTampil`+emptyState Sari): struktur v20
     + paragraf penjelasan A16.
  4. Set Biaya (A16 vs emptyState Sari): keduanya.
  5. Rekap per kelas (A16 Tapel vs `kelasLaporan`+emptyState Sari):
     struktur v20 + paragraf A16.
  6. Khidmah (A16 peran vs emptyState guru Sari): kalimat peran FIX +
     kartu emptyState v20.
  7. Blok tes engine: blok "Perbaikan ronde Bagas" (S1/S2/S4/S5/S6/A4/A2)
     lalu blok "DB-KOSONG" + "IDENTITAS" Sari, berurutan.
  8. `module.exports`: baris identitas v20 + `csvEscape: csvEscape` FIX.
- `sw.js`: diambil dari fix (sudah `tpq-madin-v21`, sha256 `67dc280d…` —
  sama dengan bump Wira). `API.md`: diambil dari fix (memuat S3 + semua
  baris yang diperbarui ronde ini) + seksi baru "Identitas madrasah +
  profil aktif (v20)" (dokumentasi `migrasiIdentitas`,
  `identitasUntuk`, `simpanIdentitas`, `getProfilAktif`,
  `setProfilAktif`, `logoAman` — sebelumnya tidak terdokumentasi di
  API.md mana pun).

### 10c. Tiga perbaikan HANYA-karena-merge (bukan bug salah satu pihak)
1. **Interaksi S1 × DB-KOSONG (KRITIS, 22 FAIL):** blok DB-KOSONG v20
   memanggil `clearAllData()` sehingga `isContoh=false`; `bersih()` di
   akhir `runEngineSelfTests` (penjaga S1 Jaka) lalu MELEWATI pemulihan
   dan db tertinggal KOSONG — 22 uji UI yang butuh data contoh gagal
   (Dashboard, D-02, S5, JK, Grafik, CSV, S7 + abort di klik S7).
   Diperbaiki di `pwa-v2-v21/engine.js` (akhir `runEngineSelfTests`):
   `resetToSeed();` eksplisit sebelum `bersih();` di `.then()` dan
   `.catch()`, dengan komentar alasan. Bukan perubahan perilaku produksi
   (hanya jalur akhir selftest; `resetToSeed` mengembalikan data contoh
   sesuai kontrak § "data selalu dikembalikan ke data contoh").
   Perjalanan harness merge: **386/408 → 748/751 → 751/751**.
2. **A9 (tes basi):** `lainnyaSubteks()` menghitung dinamis; v20 menambah
   2 modul (Panduan + Identitas) sehingga sisa 8 → 10. Tes diubah
   menghitung ekspektasi live dari `MODULES` (bukan hardcode "dan 8
   lagi"). Fitur tidak diubah.
3. **WIRA2 hapus (asumsi basi):** tes memakai sandi seed
   (`admin123`/`guru123`) setelah `clearAllData()` — benar di semantik
   lama (seed dikembalikan), salah di semantik baru A2 (pengguna + sandi
   SAAT INI dipertahankan). Tes diubah login dengan sandi terlacak
   (`wira2SandiAdmin`/`wira2SandiGuru`); komentar helper `wira2Masuk`
   diperbarui. Fitur tidak diubah.

### 10d. Verifikasi akhir merge
- `node --check app.js + engine.js + sw.js` (di `pwa-v2-v21/`): lolos.
- Harness jsdom penuh (`run_selftest.js`): **SELFTEST PASS (751/751)**,
  0 FAIL (dijalankan 2× — run3 748/751 sebelum perbaikan §10c butir
  2–3, run4 751/751 sesudahnya). Perjalanan merge: v19 512/512 →
  fix 629/629 → v20 633/633 → merge 386/408 → 748/751 → **751/751**.
- Snapshot akhir `pwa-v2-v21/`: `app.js` sha256
  `990d7fdccf916025de48b104bbac0225d9224ee8b115753193f2f5bc437932e5`
  (6.464 baris), `engine.js` sha256
  `505727113c656c881d348e167893835cf65802149c23c57a8910d4685bc7e989`
  (3.428+ baris), `sw.js` sha256 `67dc280d…` (`tpq-madin-v21`).
- Verifikasi render independen (probe jsdom, tanpa selftest, login
  admin + data contoh): Dashboard (Ahmad Fauzi, badge SPP, tombol
  Ingatkan, seksi K1 L 4 · P 3), Santri mobile (kartu kv, "Santri (38)",
  pill TPQ → "Santri (22)"), Laporan ("(L 4 · P 3)", Tapel 1448/1449),
  Grafik (petunjuk ketuk batang, 10 batang klikable, "L 19") — semua
  PASS. Satu catatan probe: teks tombol Hafalan tidak cocok dengan
  tebakan probe ("Tampil lebih banyak") — BUKAN temuan; tes S7 bawaan
  (yang memeriksa tombol dengan benar) lolos di 751/751.
- Yang BELUM terverifikasi (sama seperti sebelumnya, butuh perangkat
  nyata / live): perilaku di HP Mas (SW cache-first, virtual keyboard,
  target sentuh), sinkron Sheet end-to-end dengan URL Apps Script
  sungguhan, A5 end-to-end penuh (transaksi Masuk dari "Catat ke kas").
- Handover K6 (reproduksi keenam toggle) tetap berlaku untuk v21 —
  lihat §5 di atas; nomor baris di sana mengacu ke `pwa-v2-fix/`,
  fungsi yang sama ada di `pwa-v2-v21/` (posisi baris bergeser karena
  kode v20).
- **TIDAK ADA deploy dalam ronde ini.** `pwa-v2-v21/` adalah kandidat
  deploy; deploy ke preview menunggu lampu hijau parent. Preview saat
  ini masih v20, produksi masih R4 (v5).
