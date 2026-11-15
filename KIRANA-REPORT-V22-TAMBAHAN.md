# KIRANA-REPORT-V22-TAMBAHAN — Frontend ronde v22 (tambahan scope audit ulang v21)

**Koordinator:** Sari · **Pelaksana:** Kirana · **Tanggal:** 2026-11-15
**Direktori:** `~/workspace/tpq-madin-app/pwa-v2-v22/` (SW tetap `tpq-madin-v22`, tidak diubah)
**Tidak disentuh:** `pwa-v2-registrar/`, `pwa-v2-fix/`, `pwa/`, `engine.js` · **Tidak deploy** · **`?selftest=1` tidak dijalankan di browser cloud.**

## Verifikasi

- `node --check app.js` — lolos.
- Selftest proyek `~/workspace/tools/jsdom-test/run_selftest.js` dengan direktori v22 eksplisit: **SELFTEST PASS 646/646, FAIL 0** (baseline 646 tetap hijau penuh).
- Probe bertarget `~/workspace/tools/jsdom-test/probe-v22-tambahan-kirana.js`: **PASS 42 / FAIL 0 / TOTAL 42**.

## Per butir

### 1. §6 isContoh (a) — P0 — SELESAI
- `app.js` `wizardSelesai()` (baris 2490): bila `db.isContoh`, balik jadi `false` lalu `save('Wizard selesai')` (persist ke `localStorage`, kunci `tpq-madin-pwa-v1`).
- Hanya jalur tombol Selesai Langkah 6 (`wizardSelesai`, dipanggil tombol "Buka Dashboard" langkah 6 dan `wizardLanjut()` di langkah 6). `wizardLewati()` ("Lewati dulu") **tidak** disentuh dan tidak membalik — pembalikan untuk yang melewati ditangani Baskara lewat mutasi tulis pertama.
- Probe: klik Selesai → `isContoh===false` + tersimpan (`localStorage` ikut `false`); klik Lewati → tetap `true` (db + storage).

### 2. A1c — kotak login tambah akun guru — SELESAI
- `app.js` `tampilLogin()` (~baris 164), di dalam `<div class="auth-kredensial">` yang sama: kalimat admin **tetap persis** (`Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama.`) lalu ditambah `Akun guru — ID awal: guru1, kata sandi awal: guru123.`
- Gate tidak berubah: kotak tetap tampil hanya bila `kredensialAwalTampil()` (data contoh + admin masih `wajibGantiSandi`); hilang saat data asli.
- Probe: kotak memuat guru1/guru123 + teks admin persis; hilang saat `isContoh=false`.

### 3. Y-N1 — "minimal 8 karakter" — SELESAI (teks saja; lihat "Yang tidak dikerjakan")
- Grep `6 karakter` di `app.js` dan `PANDUAN.md` sebelum ubah: **11 kemunculan di `app.js` + 1 di `PANDUAN.md`, semuanya soal batas sandi** (ganti sandi pertama, ubah sandi, tambah/reset pengguna, Panduan §2) — tidak ada `6 karakter` non-sandi, jadi semua diubah.
- Sesudah ubah: nol `6 karakter` tersisa di kedua file; `8 karakter` muncul 11x di `app.js`, 1x di `PANDUAN.md` (baris 34). Lokasi: `app.js` 11 titik (sebelum edit di baris 266, 270, 295, 326, 345, 1634, 1641, 1661, 1671, 1690, 2881; nomor tugas `app.js:2498`/`PANDUAN.md:33` sudah bergeser di file saat ini).
- Probe: sumber + render Panduan memuat `minimal 8 karakter`, tanpa `6 karakter`.

### 4. A12 — nama file di toast export/backup — SELESAI
- `app.js` `exportSantri()`, `exportGuru()`, `exportNilai()`, `exportAbsensi()`, `exportKeuangan()`, `exportRapor()`, `unduhTemplate()`, `unduhBackup()` (baris 3112–3126): tiap toast sukses kini menambahkan `File: ` + `r.filename` — nama file yang sebenarnya dipakai fungsi export/backup itu (bukan hardcode): `murid-tpq-madin.csv`, `guru-tpq-madin.csv`, `nilai-tpq-madin.csv`, `absensi-tpq-madin.csv`, `keuangan-tpq-madin.csv`, `rapor-<NIS>.csv`, `template-<jenis>-tpq-madin.csv`, `tpq-madin-backup-YYYY-MM-DD.json`.
- Contoh: `Export murid: 22 baris (mengikuti filter yang tampil). File: murid-tpq-madin.csv.` — kalimat awal tiap toast tidak diubah; teks penjelas di bawah tombol (mis. tombol `Cadangkan semua data (JSON)` di Pengaturan) tetap seperti sekarang.
- Probe: semua 8 toast memuat nama file yang benar (backup teruji `tpq-madin-backup-2026-11-15.json`).

### 5. A16 — jelaskan "Guru Fan" — SELESAI (penjelasan dari kode, tanpa karangan)
- **Sumber dari kode (dicek dulu):**
  - `engine.js:121` `PERAN_GURU = ['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru']` — Guru Fan hanya satu dari 4 opsi peran **data guru** (seed: `g3` Ustadz Budi, peran `Guru Fan`).
  - `engine.js:1058–1062` `bolehAkses(peran, route)`: hanya `'Pimpinan'` → semua rute, `'Guru'` → 7 rute; **`bolehAkses('Guru Fan', x) === false` untuk semua rute** — jadi sebagai peran akses Guru Fan TIDAK sama dengan Guru.
  - `engine.js:585` `tambahPengguna`: peran pengguna login hanya boleh `'Pimpinan'` atau `'Guru'` — peran login `Guru Fan` bahkan tidak bisa dibuat.
  - `app.js:2044` `renderKhidmah`: guru Guru Fan dikelompokkan di kartunya sendiri (bukan digabung dengan Guru).
- **Perubahan:** kalimat Panduan § Guru dipertegas (sebelumnya "…sama seperti Guru", yang tidak akurat untuk akses) menjadi: *"Guru Fan hanya nama peran di daftar guru, bukan peran login (peran login hanya Pimpinan dan Guru), jadi tidak mengubah hak akses apa pun."* — di `app.js` (baris 2908) **dan** `PANDUAN.md` (baris 60), tetap sinkron. Ditambah catatan singkat yang sama di form guru (`app.js` `openGuruForm()`, di bawah select Peran): *"Guru Fan hanya nama peran di daftar guru, bukan peran login — tidak mengubah hak akses."*
- Probe: penjelasan ada di Panduan (render + `PANDUAN.md`) dan form guru; `bolehAkses('Guru Fan','dashboard')===false`, `bolehAkses('Guru','dashboard')===true`.
- Catatan: penjelasan A16 ini sudah ada sebagian sejak v22 (kalimat lama); yang dikerjakan di ronde tambahan ini adalah koreksi isinya ke fakta kode + penambahan di form guru.

### 6. N-K1 — judul Kemuridan hitung santri AKTIF saja — SELESAI
- `app.js` `renderKemuridan()` (baris 2014, 2025): penghitung judul tab Kelas dan tab Rombel kini memakai `murid.filter(s => s.status === 'Aktif').length`; format judul tetap `(N murid)`.
- Daftar di bawah judul **tidak diubah** (isi/filter tetap: semua santri kelas/rombel itu termasuk Lulus/Keluar masih tampil). Tab Murid Keluar / Murid Lulus tidak diubah (sudah menghitung per status).
- Bukti seed: Iqra 2 semula `(6 murid)` (5 Aktif + 1 Keluar: Dewi Lestari) → kini `(5 murid)`, konsisten dengan Dashboard (`santriAktif()`, 5). Rombel A: judul = 13 aktif.
- Probe: `Iqra 2 (5 murid)` ada, `Iqra 2 (6 murid)` tidak ada, Dewi Lestari tetap ada di daftar kelas maupun rombel.

### 7. N-K4 — jarak opsi dropdown semester 8px — SELESAI
- **Temuan lokasi:** styling dropdown semester ternyata hanya ada di `mockup.css` (`.mk .sem-list`, mode `.mk`/mobile); `styles.css` tidak punya aturan `.sem-list` sama sekali (mode desktop tidak bergaya). Karena itu perbaikan ada di **dua** file:
  - `mockup.css` (baris 367): `.mk .sem-list button + button { margin-top:8px; }`
  - `styles.css` (akhir file): `.sem-list button + button { margin-top: 8px; }` — untuk mode desktop di luar `.mk`.
- Tinggi opsi **tidak diubah**: aturan `.mk .sem-list button` (`padding:11px 12px; min-height:42px;`) dibiarkan persis; `margin-top` antar opsi tidak memengaruhi tinggi opsi.
- Probe: aturan ada di kedua CSS; `getComputedStyle` opsi ke-2 `margin-top: 8px`, opsi pertama `0px`.

## Yang tidak dikerjakan / perlu keputusan Sari (dan Baskara)

1. **Y-N1 — teks vs penegakan batas sandi (masih 6, bukan 8).** Yang diubah di ronde ini hanya **teks** "minimal 8 karakter" (sesuai scope tugas). Penegakan batasnya masih 6 karakter:
   - `app.js` cek UI `baru.length < 6` / `sandi.length < 6` (4 tempat: ganti sandi pertama, ubah sandi, tambah pengguna, reset sandi) — tidak diubah.
   - `engine.js` (Baskara; tidak disentuh) `tambahPengguna`/`resetSandiPengguna`/`gantiSandiSendiri`/`gantiSandiPaksa` masih menolak di bawah 6 dengan pesan error `"Kata sandi minimal 6 karakter."` (`engine.js:586, 600, 632, 685`); `API.md` juga masih mendokumentasikan "sandi minimal 6 karakter".
   - **Akibat saat ini:** teks bilang 8, tapi sandi 6–7 karakter masih diterima dan pesan error engine masih bilang 6. Mengubah penegakan ke 8 butuh keputusan + penyesuaian selftest (saat ini selftest memakai sandi 7 karakter `guru456` dan reset ke `admin` 5 karakter — keduanya akan gagal bila ambang jadi 8). Mohon Sari/Baskara putuskan apakah ambang ditegakkan jadi 8 (engine + UI + selftest) atau teks dikembalikan ke 6.
2. **Butir ditahan H-1–H-5:** tidak diubah (sesuai instruksi).
3. **`engine.js`:** tidak diedit sama sekali; tidak ada fungsi engine baru yang diminta dari sisi ini.
4. **N-K4 — `mockup.css` ikut diedit** (di luar daftar `app.js`/`styles.css`/`PANDUAN.md` di tugas) karena aturan dropdown semester memang hanya hidup di sana; tanpa itu perbaikan tidak berpengaruh di mode mobile. Dilaporkan di sini supaya Sari tahu.

## File diubah

- `app.js` — §6, A1c, Y-N1 (teks), A12, A16 (Panduan + form guru), N-K1.
- `PANDUAN.md` — Y-N1 (baris 34), A16 (baris 60).
- `styles.css` — N-K4 (aturan `.sem-list`, akhir file).
- `mockup.css` — N-K4 (aturan `.mk .sem-list`, satu baris; file ini yang benar-benar menata dropdown).
- Baru: `~/workspace/tools/jsdom-test/probe-v22-tambahan-kirana.js` (probe 42 butir, di luar direktori v22 seperti probe Kirana sebelumnya).
