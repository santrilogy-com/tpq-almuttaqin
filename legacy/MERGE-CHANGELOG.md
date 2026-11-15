# MERGE-CHANGELOG — v22 (Sari) → v21 (Bagas) = kandidat v22 siap deploy

- **Koordinator merge:** Tari.
- **Direktori hasil:** `~/workspace/tpq-madin-app/pwa-v2-v22merged/` (salinan `pwa-v2-v21/` + semua perubahan v22).
- **Basis:** v21 (`pwa-v2-v21/`, SW `tpq-madin-v21`, selftest 751/751) + v22 (`pwa-v2-v22/`, SW `tpq-madin-v22`, selftest 649/649).
- **Metode:** `diff3` tiga-arah dengan ancestor v20 (`pwa-v2-registrar/`), karena v21 = v20 + perbaikan Bagas dan v22 = v20 + perbaikan Sari. Konflik: `app.js` 24, `engine.js` 4, `sw.js` 1; `styles.css`, `mockup.css`, `PANDUAN.md`, `API.md`, `index.html`, `manifest.json` bergabung bersih (0 konflik). Resolver: `/tmp/merge-v22/resolve.py` (otomatis; tiap konflik diputuskan eksplisit di bawah).
- **Hasil verifikasi:** `node --check` app.js + engine.js + sw.js lolos; selftest jsdom penuh **PASS 765/765, FAIL 0** (dijalankan 2× berturut-turut sesudah perbaikan, hasil sama); suite engine saja **332/332, FAIL 0**. SW `tpq-madin-v22`. `BASELINE-ENGINE.sha256` diregenerasi (`f9a6c955…7681`). Tidak ada `tes-hp.html` / `tes-hp-demo.html` di direktori ini.
- **TIDAK ADA DEPLOY dalam ronde ini.** Deploy ke preview menunggu lampu hijau parent.

## Rekonsiliasi hitungan selftest (terverifikasi eksak)

- **Engine (standalone `runEngineSelfTests`): 332/332.** Rekonsiliasi: 278 (v20) + 43 (baru v21) + 15 (baru v22: Y2×3, Y3×2, Y4×2, Y6×3, N19×2, §6×2, Y-N3×1) − 6 + 2 = 332. Yang dikurangi 6: 3 tes era-v20 yang sudah diganti v21 dengan versi baru (`Tambah pengguna sandi kurang dari 6 karakter ditolak`, `Ganti sandi dengan sandi baru kurang dari 6 karakter ditolak`, `Hapus semua data mempertahankan pengguna seed`) + 2 asersi tes S1-marker lama (ditulis ulang, lihat § "Perbaikan hanya-karena-merge" butir 2) + 1 baris log kondisional penolakan `bersih()` (diganti tes bersarang Y-N3). Yang ditambah 2: 2 asersi baru `S1-merge`. Diverifikasi dengan membandingkan daftar nama tes yang dieksekusi di keempat pohon (v20/v21/v22/merged): **tidak ada satu pun nama tes aktif yang hilang**; yang tidak ada hanya 4 nama basi yang diganti versi baru.
- **UI: 433 = 432 (v21) + 1 (asersi wizard Kirana, v22).**
- **Total: 765 = 332 + 433** (v21 751 + 16 tes baru v22 − 2 penyesuaian di atas pada level total: 1 tes WIRA2 aturan kartu diganti 1-untuk-1 + 1 baris log kondisional).
- **Determinisme:** sebelum perbaikan, 3× run penuh memberi hasil SAMA (760/765, 5 FAIL yang sama); sesudah perbaikan 2× run penuh memberi 765/765.

## Overlap dengan v21 — keputusan per butir (9 butir CHANGELOG v22)

1. **Kotak kredensial login ganda → SATU kotak, versi v22** (`app.js:175` `kredensialAwalTampil()`, dipakai `app.js:~210`). Teks verbatim sama + baris guru (A1c) + gate `isContoh` DAN admin masih `wajibGantiSandi`. Variabel lama v21 `kotakContoh` (admin saja) DIHAPUS dari `tampilLogin()` — tidak ada lagi string kotak kedua di file. **Pengecualian yang dipertahankan dari v21:** `bannerHapus` (A2, pesan "Semua data sudah dihapus" yang menetap) TETAP dirender di layar login sesudah kotak kredensial — v22 menghapus mekanisme itu seluruhnya, dan itu akan menjadi regresi A2. `pesanHapusData`/`bannerHapus`/`bannerHapusGanti` utuh dari v21.
2. **Gate kredensial Panduan (Y1) hanya ada di v22 → ikut** (`renderPanduan()` v22; Bagas tidak menyentuh fungsi itu). `PANDUAN.md` statis tetap memuat butir kredensial (divergensi disengaja Sari, §3.4 laporannya).
3. **`submitKeuangan`/`submitTabungan` (M2/A4) → versi v21** (`app.js:3538` `submitTabungan`, `app.js:3589` `submitKeuangan`, `bacaJumlah` `app.js:97` → `bacaRupiah` `engine.js:2034`). Input wizard BARU v22 memakai `angkaRp()` seperti semula. Kontrak kanonik tetap: "50.000"→50000, "50,000"→50000; edge "50,5"→505 diterima apa adanya (keputusan Bagas).
4. **Ekspektasi tes WIRA2 aturan kartu → versi v22** (`app.js:6980` "kartu tetap tampil bila baru guru saja"; `aplikasiKosong()` `app.js:2528` bentuk OR v22: kartu hilang hanya bila santri+guru+kelas ketiganya terisi). Tes v21 "kartu hilang begitu ada guru" DIHAPUS (basi).
5. **`csvEscape` (Y7/S2) dan `parseInt` lain → versi v21** (`engine.js:995` `csvEscape` menetralkan `=,+,-,@` dengan `'` di depan). v22 tidak menyentuh.
6. **`fotoAman()` / `simpanIdentitas()` / `setJenjang()` / `setProfilAktif()` → versi v22** (Y2/Y3/Y4/Y6; Bagas tidak menyentuh fungsi-fungsi ini). Termasuk `LOGO_MAX_BYTES` 1 MB (batas `>`), magic bytes PNG/JPEG/WebP, `resetFilterJenjang()`, helper `gantiJenjang()`.
7. **`BASELINE-ENGINE.sha256` → diregenerasi** sesudah merge (`f9a6c95593715a80470650df53c7b7e76de68708c32047036281719ff5bc7681`).
8. **Guard S1 (`bersih()` + `resetToSeed()` + `bolehSelftest()` + wiring `setModeSelftest`) → versi v22, tanpa duplikasi.** Perbandingan yang dilakukan:
   - `bersih()`: v21 memeriksa `db.isContoh` BERJALAN (menolak bila saat itu bukan contoh); v22 memeriksa `isContohAwal` (keadaan saat suite MASUK). Dipakai v22 — ini yang membuat blok DB-KOSONG di tengah suite tetap bisa reseed (v21 butuh workaround `resetToSeed()` eksplisit sebelum `bersih()` di ekor, CHANGELOG v21 §10c butir 1; workaround itu kini tidak diperlukan dan DIHAPUS dari ekor).
   - `resetToSeed(kredensialAdmin)` v22 (`engine.js:472`): menolak reseed bila `db.isContoh !== true` DAN db berisi record; ekor data contoh memulihkan sandi admin ke sebelum selftest (bukan `wirauji123`); ekor data asli memulihkan snapshot penuh via `pulihkanSnapshotAsli()`. Dipakai v22.
   - `bolehSelftest()`: definisi di `app.js:4149` (v21) dan `engine.js:448` (v22) BERISI SAMA PERSIS (`db.isContoh === true`); keduanya dipertahankan (definisi app.js menaungi yang engine karena dimuat belakangan; semantik identik, tidak ada konflik perilaku).
   - Wiring `?selftest=1` di init `app.js` → versi v22 (fail-closed `typeof bolehSelftest === 'function'`, toast penolakan "Selftest hanya bisa dijalankan pada data contoh. Data asli tidak diubah.").
   - `setModeSelftest()` (`engine.js:417`) + `tandaiDataAsli()` (`engine.js:437`, 43 titik/36 fungsi) + `kedalamanSelftest`/`selftestAktif` → v22; diekspor di `module.exports` bersama `bacaRupiah` v21 (gabungan, lihat bawah).
9. **Password minimal 8 karakter (Y-N1/S5) → penegakan + pesan error engine + `API.md` dari v21; teks Panduan/`app.js` dari v22.** `sandiBaruValid()` (`engine.js:689`, min 8 + tolak sandi umum/sama-ID) dari v21; semua label/placeholder/teks "minimal 8 karakter" dari v22 (11 tempat `app.js` + `PANDUAN.md:34`). **Koreksi atas v22:** di 4 tempat v22 menulis cek `length < 6` dengan pesan "minimal 8 karakter" (bug teks-vs-cek di `gantiSandiSendiri`, ubah-sandi, tambah-pengguna, reset-sandi) — merge memakai cek v21 (`< 8`).

## Keputusan gabungan lain (konflik kecil, kedua sisi dipertahankan)

- **Toast export/backup (A12): gabungan** — "File: `<nama>` . File tersimpan di folder Unduhan perangkat ini." (nama file v22 + folder Unduhan v21; keduanya dites).
- **Judul Kemuridan (N-K1 + K1): gabungan** — hitung santri AKTIF saja (v22) + rincian gender dihitung dari daftar aktif yang sama (v21): `Iqra 2 (5 murid, L 2 · P 3)`.
- **Pesan kosong Santri (K3 + N15/N16): gabungan** — tombol "Atur ulang filter" hanya bila filter aktif (K3, `resetFilterSantri()`) + `role="status"` (v22). `aturUlangFilter()` v22 tetap ada dan dipakai rute Keuangan/KBM/Guru.
- **Tabungan/Setoran/Nilai (A6 + M9/M10/M13):** teks penjelas A6 v21 (tanpa syarat) dipertahankan; teks kondisional v22 ("Pilih murid dulu…") dipertahankan hanya di Tabungan (satu-satunya tempat v21 tidak punya teks setara). Input uang tetap `type=text inputmode=decimal` (A4 v21).
- **Penjelasan peran guru (A16):** kedua baris dipertahankan — daftar peran v21 + koreksi jujur "Guru Fan hanya nama peran…" v22.
- **Khidmah (N23 + A16):** struktur early-return N23 v22 + kalimat daftar peran v21 di kedua kalimat pembuka.
- **`module.exports` engine: gabungan** — `bacaRupiah` (v21) + `setModeSelftest`, `bolehSelftest`, `tandaiDataAsli` (v22).

## Perbaikan hanya-karena-merge (bukan bug salah satu pihak)

Tiga perbaikan ini HANYA muncul dari penggabungan; di masing-masing jalur (v21 751/751, v22 649/649) semuanya hijau. Perjalanan: 760/765 (3× run identik) → **765/765**.

1. **T-02 reset pasca-import: `resetToSeed()` → `bersih()`** (`engine.js:~3224`). Setelah `clearAllData()` + import, `tandaiDataAsli()` v22 sudah membalik `isContoh=false`, sehingga guard Y-N3 di `resetToSeed()` v22 MENOLAK reseed dan db tertinggal berisi 1 santri impor → T-03 gagal (3/3). `bersih()` v22 memakai `isContohAwal=true` sehingga me-reseed dengan benar (ini persis kode v20/v22 di titik itu; v21 menggantinya karena `bersih()` v21 memakai keadaan berjalan). Komentar S1 lama di titik itu diganti penjelasan merge. `bersih()` sudah memanggil `setQueue([])` di dalamnya.
2. **Tes S1-marker ditulis ulang ke semantik v22** (`engine.js:~3382`, `S1-merge…`). Tes v21 mengasumsikan `bersih()` menolak bila db BERJALAN bukan contoh; `bersih()` v22 menolak hanya bila suite MASUK dengan data asli (keadaan awal). Premis lama tidak berlaku lagi — perlindungan data asli kini diuji tes bersarang Y-N3 (masuk dengan data asli → snapshot dipulihkan, marker + sandi asli utuh). Tes baru menegaskan perilaku yang diganti: suite masuk-contoh me-reseed walau db sempat asli (marker ikut tereset, kembali 40 santri). Fitur tidak diubah; hanya tes yang diperbarui (preseden: CHANGELOG v21 §10c).
3. **Tes A1: pulihkan flag `wajibGantiSandi` admin dulu** (`app.js:~6338`). Kotak v22 mensyaratkan admin masih `wajibGantiSandi`, tetapi blok KIRANA-FIX v21 yang berjalan SEBELUM tes A1 sudah mengganti sandi admin (flag jadi false) → kotak tidak tampil → tes gagal. Perbaikan hanya di tes: simpan flag, set `true` untuk asersi, kembalikan sesudahnya sebelum `kfMasukAdmin()`. Perilaku produksi tidak diubah.

## Yang TIDAK diubah (sengaja)

- M2 (A4) dan Y7 (S2) — dari jalur Bagas (v21); terverifikasi ada di hasil merge (`bacaRupiah` `engine.js:2034`, `csvEscape` `engine.js:995`; tes A4 + S2 lolos di 765/765).
- Butir DITAHAN: H-1–H-5, S13/A10 (tile Informasi), K9 (label modul — diverifikasi identik dengan v21), T-04 (rapor parsial), T-09 (SPP Lunas TIDAK otomatis ke kas — teks penjelasan + tombol manual A5 utuh), F1 (peran Guru). Observasi Sari soal "Guru Fan tanpa hak akses" diteruskan apa adanya (bukan scope merge; perlu keputusan Mas).
- Nama resmi + logo Ibtidaiyah masih placeholder (butuh dari klien).
- `pwa/`, `pwa-v2-registrar/`, `pwa-v2-fix/`, `pwa-v2-v21/`, `pwa-v2-v22/` tidak disentuh.

## Verifikasi merge

- `node --check` app.js + engine.js + sw.js: lolos.
- Harness jsdom (`~/workspace/tools/jsdom-test/run_selftest.js`, via `dump-selftest.js` yang mencetak isi lengkap): **PASS 765/765, FAIL 0** (2× sesudah perbaikan); suite engine saja (`probe-engine.js`): **332/332, FAIL 0**.
- Probe tambahan: replikasi urutan T-02 di jsdom (import pasca-hapus → `bersih()` → seed 40 kembali, `s2.hafalan` utuh); daftar nama tes yang dieksekusi dibandingkan di keempat pohon (v20/v21/v22/merged) — tidak ada nama tes aktif yang hilang.
- Snapshot akhir `pwa-v2-v22merged/`: `app.js` sha256 `a4922feb802eb9ccb20d431f084c4dbf243e84d3a220cf54c3e3f5c9d5f5120c` (7.125 baris), `engine.js` sha256 `f9a6c95593715a80470650df53c7b7e76de68708c32047036281719ff5bc7681` (3.925 baris), `sw.js` sha256 `6bda89b792243ffb84dfd85dd87e59a126e6d273c6faf76d6b91cd93ecdcd091` (`tpq-madin-v22`).
- Yang BELUM terverifikasi (sama seperti sebelumnya, butuh perangkat nyata / live): tampilan 390px/desktop nyata, sentuhan nyata, keyboard virtual HP, pilih logo dari galeri/kamera (perlu verdict Mas dari HP); sinkron Sheet end-to-end dengan URL Apps Script sungguhan; A5 end-to-end penuh (transaksi Masuk dari "Catat ke kas").

## Berkas

- `~/workspace/tpq-madin-app/pwa-v2-v22merged/` — kandidat deploy (app shell + `MERGE-CHANGELOG.md` ini + `CHANGELOG.md` v21 + laporan tim v22 `SARI-REPORT-V22.md`, `KIRANA-REPORT-V22*.md`, `BASKARA-REPORT-V22*.md` sebagai dokumentasi).
- Skrip merge + probe: `/tmp/merge-v22/resolve.py`, `probe-t02.js`, `probe-engine.js`, `dump-selftest.js`, `dump-engine-names.js`, `probe-full.js` (scratch di /tmp; keputusan tiap konflik sudah ditulis lengkap di atas).
- Laporan Sari: `pwa-v2-v22/SARI-REPORT-V22.md`; CHANGELOG v22: `pwa-v2-v22/CHANGELOG.md` (§ "Overlap dengan v21"); CHANGELOG v21: `pwa-v2-v21/CHANGELOG.md` (§10 merge v20→v21).
