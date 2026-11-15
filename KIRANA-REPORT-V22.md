# Laporan Kirana — Ronde Perbaikan Audit v20 → v22 (TPQ Al-Muttaqin PWA)

- **Penulis:** Kirana (frontend ronde perbaikan), koordinator Sari
- **Direktori kerja:** `~/workspace/tpq-madin-app/pwa-v2-v22/` (salinan v20; `pwa-v2-registrar/`, `pwa-v2-fix/`, `pwa/` tidak disentuh)
- **File yang diubah:** `app.js`, `styles.css`, `PANDUAN.md` (hanya itu; `engine.js` milik Baskara tidak disentuh)
- **Tidak deploy, tidak hubungi Mas.**
- **Verifikasi akhir:** selftest proyek `~/workspace/tools/jsdom-test/run_selftest.js` dengan direktori v22: **SELFTEST PASS 646/646, FAIL 0**; probe bertarget Kirana **36/36 PASS** (`probe-v22-kirana.js`); probe `gantiJenjang` **6/6 PASS** (`probe-v22-gantijenjang.js`); `node --check app.js` lolos.

Catatan kejujuran verifikasi: run selftest pertama saya tanpa argumen direktori — harness memakai default `pwa-v2` (251/251), bukan v22. Kesalahan itu saya sadari dan perbaiki: semua angka di laporan ini berasal dari run dengan argumen eksplisit `pwa-v2-v22`. Satu run v22 sempat menunjukkan 645/646 (1 gagal tanpa baris FAIL di DOM); run ulang langsung (dump DOM 10 detik) menunjukkan **646/646 PASS, 0 FAIL** — gagal itu artefak timing harness (pembacaan di detik ke-3), bukan bug kode.

## P0 — Wizard linear 6 langkah (N1, M4, keputusan Mas 20:22 WIB)

Mengganti kartu/modal checklist 5 langkah menjadi wizard berurutan sungguhan di dalam modal.

- `wizardHtml()` — `app.js:2430`. Indikator `<ol class="wz-indikator">` (selesai ✓ / aktif / Dilewati), judul `<h2 id="wz-judul" tabindex="-1">Langkah X dari 6: …</h2>` (N18: fokus pindah ke judul tiap pindah langkah via `wizardFokusJudul()`), navigasi Kembali / Lewati langkah ini / Lanjut, langkah 6: Kembali / Buka Dashboard, plus "Lewati dulu" global + "Buka panduan pengguna".
- Langkah 1 identitas lembaga: form inline (nama, kepala, tarif SPP, tahun ajaran; placeholder "Contoh: …", helper SPP "Tulis angka tanpa titik atau koma, contoh: 50000"), simpan via `simpanIdentitas` + `simpanSettings` (string SPP mentah diteruskan ke `angkaRp()` engine — tidak ada `parseInt` baru), lalu `tandaiIdentitasDikonfirmasi()`. Lanjut = simpan lalu maju.
- Langkah 2 tambah guru: form inline (`simpanGuru`, honor string mentah) + daftar guru + Hapus (`confirmModal`, kembali ke wizard langkah 2).
- Langkah 3 tambah kelas: form inline (`tambahKelas`) + daftar kelas. **Tanpa tombol Hapus** — tidak ada `hapusKelas` di engine (lihat Eskalasi).
- Langkah 4 tambah santri: form inline + **import CSV di dalam wizard** (`<input type=file>` + `importCsvText('murid', …)`, hasil tampil inline, wizard tetap terbuka) + tombol template + 5 santri terakhir + Hapus (`confirmModal`, kembali ke langkah 4).
- Langkah 5 keuangan awal: saldo awal via `simpanKeuangan` (Masuk / kategori "Saldo awal" / string mentah) + RAPBM via `simpanRapbm` (string mentah). Tidak butuh fungsi engine baru — tidak ada yang dilaporkan ke Sari untuk poin ini.
- Langkah 6 ringkasan dari data nyata + tombol "Ubah" per baris (`wizardKe(n)`), catatan langkah yang dilewati, pengingat ganti sandi bila `wajibGantiSandi` + tombol "Ganti kata sandi sekarang".
- Draft isian tidak hilang saat Kembali: `wizardDraftSimpan()` pada setiap input wizard (id `wz*`, file dilewati) ke localStorage `tpq-madin-pwa-wizard-draft`; dibaca kembali saat langkah dirender; dihapus per langkah saat simpan berhasil.
- `wizardLangkah()` mengembalikan 6 item `{no, judul, selesai, dilewati}`; indeks dipertahankan untuk selftest (1=guru, 2=kelas, 3=santri, 4=keuangan). `wizardLangkahAwal()` melanjutkan di langkah pertama yang belum selesai dan belum dilewati, atau 6.
- `wizardKartuDashboard()` (`app.js:2819`): kartu ringkas "Mulai isi data", progres 6 langkah, tombol "Mulai" + "Lewati dulu", hanya untuk Pimpinan.
- `bukaWizard(langkah)` (`app.js:2832`): gate Y5 — tolak bila tanpa sesi atau bukan Pimpinan (toast "Hanya Pimpinan yang bisa membuka panduan setup", modal tidak dibuka).
- N25: `wizardSambutanHtml()` (`app.js:2498`) — kartu menetap di Dashboard setelah wizard selesai ("Aplikasi siap dipakai — X santri, Y guru…", tombol Tutup, flag localStorage `tpq-madin-pwa-sambutan`, sekali tampil). M8: `wizardM8Html()` (`app.js:2493`) — setelah "Lewati dulu": "Aplikasi masih kosong." + "Buka panduan setup" + "Tambah santri" (hanya Pimpinan + kartu sudah ditutup + aplikasi masih kosong).
- `renderDashboard()` (`app.js:908`) menyisipkan `wizardSambutanHtml() + wizardM8Html()` setelah kartu wizard.

## P0 — Aturan hilang kartu (N3, M1, M3) + N19

- `aplikasiKosong()` (`app.js:2326`) diubah ke bentuk OR: `db.santri.length === 0 || db.guru.length === 0 || db.kelas.length === 0`. Kartu tampil bila salah satu dari ketiganya masih 0; hilang hanya bila ketiganya terisi ATAU flag `tpq-madin-pwa-wizard=lewati`. Kalimat yang sama tertulis di Panduan §1 (app + `PANDUAN.md`).
- Penyelesaian wizard TIDAK menyembunyikan kartu (sesuai spesifikasi harfiah: hilang hanya bila ketiganya terisi atau Lewati). Sinyal sukses adalah kartu sambutan N25.
- N19: `hitungSetup()` (`app.js:2336`) — langkah lembaga selesai hanya bila data terisi DAN (`db.settings.identitasDikonfirmasi === true` OR `db.isContoh === false`), dengan cek defensif `db.settings &&`. Nilai seed tidak lagi mencoret langkah 1.
- `tandaiIdentitasDikonfirmasi()` (`app.js:2665`): set `db.settings.identitasDikonfirmasi = true` + `save()`. Dipanggil dari `submitIdentitas` sukses, `submitSettings` sukses, dan wizard Langkah 1. **Flag ini belum ada di engine** — lihat Eskalasi.
- Selftest WIRA2 blok wizard diperbarui ke aturan baru: "kartu tetap tampil bila baru guru saja", "kartu tetap tampil bila guru masih kosong" (kelas+santri+transaksi tanpa guru), "kartu hilang saat santri+guru+kelas terisi" (guru ditambahkan dulu sebelum asersi). Semua lolos.

## P0 — Kredensial (N2, Y8, Y1) + M7 + N13

- `kredensialAwalTampil()` (`app.js:136`): kotak tampil hanya bila `db.isContoh === true` DAN admin masih `wajibGantiSandi === true` (via `cariPengguna('admin')`, dijaga; fallback ke isContoh saja bila tidak tersedia). Ini memenuhi aturan tugas (isContoh) sekaligus audit U-14.3 (kotak hilang setelah ganti sandi).
- Kotak di `tampilLogin()` (`app.js:154`): `<div class="auth-kredensial" role="status">` dengan teks verbatim persis: "Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama." (em dash di kalimat ini disengaja, tidak diubah). CSS `.auth-kredensial` (`styles.css` ~1185): teks teal di atas soft teal, kontras 6,43:1; tidak mendorong tombol Masuk keluar layar di 390px.
- `renderPanduan()` (`app.js:2847`): kedua `<li>` kredensial dibungkus `db.isContoh ? ... : ''` — di data asli Panduan tidak memuat `admin123`/`guru123` (probe: PASS).
- N13: tautan "Panduan pengguna" ditambahkan di `.auth-links` layar login (`go('panduan')`).
- M7: route guard di `render()` — `#/panduan` bisa dibaca TANPA sesi (mode baca saja; tombol bawah hanya "Masuk ke aplikasi", `location.hash='#/dashboard'` → mendarat di login). Gate kredensial isContoh tetap berlaku di mode ini. Rute lain tanpa sesi tetap ke `tampilLogin()`.

## P1 — UI

- N4: `heroIdentitasHtml()` (`app.js:2253`) — `only-desktop` dicabut dari kedua cabang (Semua + profil). Hero tampil di mobile 390px; nama/motto panjang dibungkus (`overflow-wrap: anywhere`, `styles.css`, padding/font hero dipadatkan di ≤520px).
- N5: `object-fit: contain; background: #fff` di `.topbar .logo-m img` (44px) dan `.auth-logo img` (64px); aturan baru `.brand-logo img { width:100%; height:100%; object-fit: contain; border-radius: var(--r-md); }` di blok `@media (min-width: 900px)` dan `body.mode-desktop` (sidebar 48px); `.hero-logo` dan `.profil-logo` diubah `cover` → `contain`.
- N6: penanda aktif non-warna — kartu login: badge "✓ Dipilih" (`.badge-dipilih`) + `aria-pressed`; chip hero + kartu identitas: badge "✓ Aktif" (`.badge-aktif`) + `aria-pressed` pada `.profil-card` dan chip pemilih (`profilPickerHtml` `app.js:2228`, `profilLoginHtml` `app.js:2241`).
- N21: `terapkanIdentitasShell()` (`app.js:2277`) — `img.alt = 'Logo ' + nama` mengikuti profil + fallback monogram profil (`monogramDataUrl(singkat)`) bukan ikon generik; logo login juga memakai monogram profil (alt `'Logo ' + nama`).
- N7: dua kartu identitas dibungkus `<div class="identitas-grid">` di `renderIdentitas()` (`app.js:2955`); `.identitas-grid` (`styles.css`): 1 kolom default, 2 kolom di desktop (`min-width: 900px` / `body.mode-desktop`), 1 kolom di `body.mode-mobile` / ≤520px.

## P2 — UI kecil

- N9: `kartuIdentitasHtml()` (`app.js:2967`) — SEMUA label identitas memakai `for="<id>"` (9 label eksplisit per kartu + label "Pilih logo" yang membungkus input = 20/20 terasosiasi). Form santri/guru/kelas tidak diubah (warisan v19, di luar scope).
- N10: `hapusLogoIdentitas()` (`app.js:3003`) dibungkus `confirmModal()` ("Logo baru terhapus permanen setelah Simpan ditekan"); pratinjau direset ke monogram placeholder.
- N11/N12: pratinjau logo 64×64 (`.logo-preview-img`, contain + latar putih + border) sama seperti hero; bila belum ada logo: monogram yang sama dengan hero/login (`logoHtml(idn,'logo-preview-img')`) + teks kecil "Belum ada logo". `#logo-preview-id-tpq img, #logo-preview-id-mi img` 64×64 contain (mencakup pratinjau `onPhotoChange` yang menulis `<img class="avatar">`).
- N20: placeholder informatif per field identitas (nama "Contoh: TPQ Al-Muttaqin", singkat "Contoh: TPQ", kepala "Contoh: Ustadz Ahmad", alamat "Contoh: Jl. Merdeka No. 1", telepon "Contoh: 0812-3456-7890", tahun "Contoh: 2010", nsm "Contoh: 411234567890", motto "Contoh: Menuntut ilmu dengan ikhlas").
- N15: `emptyState()` (`app.js:2138`) memakai `<p class="empty" role="status">`; semua 33 kemunculan literal `<p class="empty">` di `app.js` diubah ke bentuk ber-`role="status"` (0 tersisa, diverifikasi dengan hitung string).
- N16: `aturUlangFilter(rute)` (`app.js:2145`) + tombol "Atur ulang filter" di blok filter-0 Santri, Keuangan, KBM, Guru (mengosongkan pencarian + semua select rute itu ke "Semua", lalu `render()`; jenjang/profil aktif TIDAK direset — itu filter profil, resetnya saat ganti profil adalah jalur Baskara di engine).
- N17: `renderPengaturan()` (`app.js:1716`) — kartu "Cadangkan dan pulihkan" menampilkan "Belum ada data untuk dicadangkan." bila santri/guru/kelas/keuanganTx/nilai semuanya 0; tombol tetap aktif.
- N23: pesan kosong gabungan — Tabungan (`app.js:1234`), Hafalan (`app.js:1478`), Khidmah (`app.js:2036`): bila `santriAktif().length === 0` (Tabungan/Hafalan) atau `db.guru.length === 0` (Khidmah), tampil SATU pesan gabungan + satu aksi ("Tambah santri" / "Tambah guru"); sub-pesan turunan disembunyikan. N23 memakai `santriAktif().length === 0` (mencakup 0 santri dan semua non-aktif), bukan `db.santri.length === 0`.
- M9: Penilaian (`app.js:1781`) — tab Harian/Imda/Praktek tanpa santri aktif: `emptyState` + "Tambah santri" (seperti tab Rapor); tombol "Pilih murid" tidak dirender bila `santriAktif().length === 0`; teks "Pilih murid dulu untuk mencatat nilai." di bawah tombol "Simpan nilai …" yang disabled. **Tambahan dari probe:** tab Rapor ternyata masih menampilkan tombol "Pilih murid" (picker kosong) saat santri 0 — tombol itu kini juga digate (`db.santri.length`); hanya pesan + "Tambah santri" yang tampil.
- M10: Keuangan kosong — `emptyState` mendapat tombol "Tambah transaksi" → `fokusFormKeuangan()` (`app.js:2158`, gulir + fokus ke `#ku-nama`).
- M13: RAPBM "Arus Kas" kosong → `emptyState` + "Tambah transaksi" (`go('keuangan')`); Kemuridan Rombel/Kelas/Keluar/Lulus kosong → `emptyState` + aksi relevan ("Tambah santri" / "Buka daftar santri") + teks penjelas bahwa status diubah dari Detail santri; Hafalan "Simpan setoran" dan Tabungan "Simpan transaksi" yang disabled mendapat teks "Pilih murid dulu untuk mencatat setoran/transaksi." di bawahnya.

## Y5 — Gate wizard (bersama P0)

- `bukaWizard()` menolak tanpa sesi atau bukan Pimpinan (toast "Hanya Pimpinan yang bisa membuka panduan setup", modal tidak dibuka). Tombol "Buka panduan setup" di Pengaturan disembunyikan untuk non-Pimpinan.

## Y6 lanjutan — `gantiJenjang()` (tambahan dari Baskara, 15 Nov ~21:0x WIB)

Baskara menemukan 2 jalur lain yang memanggil `setJenjang()` langsung tanpa mereset filter kelas: pil jenjang di dashboard dan dropdown jenjang di layar Santri. Gejala sama seperti Y6: ganti jenjang dengan filter kelas basi → daftar kosong menyesatkan.

- Helper baru `gantiJenjang(j)` (`app.js:23`): simpan jenjang lama → `setJenjang(j)` → bila `ui.jenjang` benar-benar berubah, panggil `resetFilterJenjang()` (engine Baskara: `santriKelas='Semua'`, `santriAngkatan='Semua'`, `santriStatus='Aktif'`, `santriSearch=''`) → `render()`. Guard "berubah" penting karena `setJenjang('Semua')` untuk Guru mengembalikan jenjang efektif (bukan 'Semua') — dalam hal itu filter tidak direset.
- Tiga handler dialihkan ke `gantiJenjang`: pil dashboard desktop `jenjangBarHtml()` (`app.js:14`), pil dashboard mobile `.jenjang-slim` (`app.js:953` — kembaran kontrol yang sama di layout mobile, bug yang sama), dropdown jenjang layar Santri (`app.js:1030`, `onchange="gantiJenjang(this.value)"`).
- TIDAK diubah: `setProfilAktifUi()` (`app.js:2208`) — jalurnya sudah lewat `setProfilAktif()` engine yang mereset filter; `setJenjang` di sana hanya fallback defensif. Guard `render()` untuk Guru + 'Semua' (`app.js:568`) juga dibiarkan (jalur koreksi, bukan kontrol pengguna).
- Probe `probe-v22-gantijenjang.js` 6/6 PASS: reset saat pindah TPQ→Ibtidaiyah; tidak reset saat jenjang sama; Guru pilih "Semua" → tetap TPQ + tidak reset; handler terpasang di HTML dashboard + Santri; klik pil "Ibtidaiyah" E2E mereset + pindah jenjang.

## P2 — Panduan (teks): `renderPanduan()` + `PANDUAN.md`

Isi keduanya disamakan (kecuali divergensi kredensial di bawah):

- §1: "Enam langkah" (langkah 6: periksa ringkasan + "Buka Dashboard"); "Identitas Madrasah" dan "Tambah santri" menjadi tombol berfungsi (`go('identitas')`, `go('santri')`); kalimat aturan kartu yang sama seperti kode.
- §3: "Identitas Madrasah" menjadi tombol berfungsi.
- §4 Santri: "Kelas = rombongan belajar; Jilid = level Iqra Jilid 1–6, lalu Tahfidz Juz 30, 29, 28. Santri satu kelas bisa beda jilid."
- §4 Guru: arti peran — Pimpinan memimpin dan mengelola aplikasi; Wali Kelas memegang satu kelas; Guru mengajar santri; "Guru Fan adalah nama peran yang ada di daftar peran aplikasi, sama seperti Guru. Bila ragu memilih peran, tanyakan ke Pimpinan." (Tidak ada arti "Guru Fan" yang tertulis di kode — tidak dikarang.)
- §4 Kelas dan Absensi: default Hadir (semua santri otomatis Hadir); nasib draf — pindah kelas lain menghapus pilihan belum disimpan, muat ulang halaman juga menghapusnya, pindah rute lain tidak menghapusnya; "Naik Jilid" langsung menaikkan satu tingkat tanpa konfirmasi tambahan (kode memang tidak punya dialog konfirmasi — tidak diklaim ada).
- §4 Penilaian: skala predikat (A ≥90 Sangat Baik, B ≥80 Baik, C ≥70 Cukup, D ≥60 Kurang, E <60 Perlu Bimbingan) + aturan 1 komponen (Harian 70 → Nilai Akhir 28; komponen kosong dihitung 0).
- §4 Tabungan + Keuangan: "Tulis angka tanpa titik atau koma, contoh: 50000." (Tidak pernah menulis "50.000" sebagai contoh benar — itu bug A4 jalur Bagas.)
- §4 Keuangan: "Menandai SPP Lunas TIDAK menambah saldo kas" + tombol "Catat ke kas" (`go('keuangan')`) menuju form Keuangan yang sudah ada (tidak ada transaksi otomatis — T-09 ditahan).
- §4 RAPBM: "RAPBM = Rencana Anggaran Pendapatan dan Belanja Madrasah." KBM: "KBM = Kegiatan Belajar Mengajar." Grafik: "Imda adalah salah satu jenis nilai di aplikasi, bersama Harian dan Praktek; tidak ada kepanjangan Imda yang tertulis di aplikasi. Imda ikut dihitung dalam Nilai Akhir dengan bobot 30 persen." (Tidak ada perluasan "Imda" di kode — tidak dikarang.)
- §4 Pengumuman: "Pengumuman yang disimpan tampil di Beranda (bagian Notifikasi)…"
- §6 Backup: nama file cadangan `tpq-madin-backup-YYYY-MM-DD.json`; nama file export CSV (`murid/guru/nilai/absensi/keuangan-tpq-madin.csv`); nama file template CSV (`template-<jenis>-tpq-madin.csv`); folder Unduhan HP (folder Download); beda export CSV (satu daftar, untuk spreadsheet) vs backup JSON (seluruh data, untuk memulihkan).
- §8 FAQ baru: "Saya bingung, harus tanya ke siapa?" → "Tanyakan ke Pimpinan…" (tanpa nama/nomor karangan). Tombol bawah: tanpa sesi hanya "Masuk ke aplikasi"; dengan sesi "Buka Dashboard" + "Buka Pengaturan".

**Divergensi yang disengaja (dicatat, bukan lupa):** `PANDUAN.md` (dokumen statis) tetap memuat butir kredensial admin123/guru123 seperti dokumen aslinya, sedangkan `renderPanduan()` di aplikasi menguncinya dengan `db.isContoh`. Alasan: `PANDUAN.md` adalah berkas paket/dokumentasi yang dibaca di luar aplikasi; penguncian kredensial diterapkan di lapisan aplikasi tempat data asli benar-benar dipakai. Bila Sari/Mas memutuskan dokumen statis juga harus digate, itu keputusan terpisah.

## Yang TIDAK dikerjakan dan kenapa

- **M2 ("50.000"→Rp50):** tidak mengubah satu pun `parseInt` di `submit*` — jalur Bagas. Wizard Langkah 5 memakai `angkaRp()` pada string mentah.
- **Y7 (CSV formula injection):** jalur Bagas, tidak disentuh.
- **Yang lolos audit:** kontras, target sentuh 44px, isolasi data TPQ/MI via UI, kedua perbaikan keamanan ronde lalu — tidak diubah.
- **Butir DITAHAN:** S13/A10 tile Informasi, K9 penamaan modul, T-04 rapor parsial, T-09 SPP↔kas otomatis, F1 peran Guru — tidak diubah.
- **Tidak ada em dash di UI baru**, kecuali kalimat kredensial verbatim.
- **Semua nilai interpolasi ke HTML lewat `esc()`** (atribut/onclick lewat `escJs()`); tes racun XSS WIRA2 (nama/kepala/tahun berisi `<img src=x>` / `<script>`) tetap lolos — nilai di-escape, tidak dieksekusi.
- **Tidak ada tombol Hapus kelas di wizard Langkah 3** — tidak ada `hapusKelas` di engine (lihat Eskalasi).
- **Form santri/guru/kelas tidak diubah** untuk label `for` (N9 hanya identitas; form lain warisan v19, di luar scope).

## Eskalasi ke Sari (butuh keputusan/koordinasi, bukan diselesaikan sendiri)

1. **`identitasDikonfirmasi` belum diset di engine.** Baskara belum menyetel flag ini di `simpanIdentitas()` (grep: tidak ada di `engine.js`). Saya menyetelnya dari funnel UI (`submitIdentitas`, `submitSettings`, wizard Langkah 1) lewat `tandaiIdentitasDikonfirmasi()` (`app.js:2665`). Minta Baskara juga menyetelnya di engine `simpanIdentitas()` untuk pemanggil engine langsung; penyetelan ganda tidak berbahaya (nilai yang sama).
2. **Tidak ada `hapusKelas` di engine.** Wizard Langkah 3 (daftar kelas) tidak punya tombol Hapus, padahal audit U-04 menginginkannya. Butuh Baskara menambahkan `hapusKelas`, atau terima daftar-tanpa-hapus.
3. **Konfirmasi dari Baskara (15 Nov, selftest 646/646):** ekspektasi WIRA2 lama sudah saya perbarui sendiri ke aturan kartu baru; batas logo 1 MB sudah `>` (tepat 1 MB diterima); Pimpinan tetap bisa `setJenjang('Semua')` — kedua flag Wira tadi ternyata artefak, bukan bug. Tidak ada tindakan dari saya.

## Skill yang dibaca dan dipakai (jujur)

- `~/workspace/custom-skills/ui-ux-pro-max/SKILL.md` (wrapper) + `ui-ux-pro-max/ui-ux-pro-max/SKILL.md` — dipakai: tabel prioritas P1 aksesibilitas (`role="status"`, `aria-pressed`, fokus ke judul langkah), P2 target sentuh (badge bukan hanya warna, tombol 44px dipertahankan), P5 responsif (grid identitas 1→2 kolom, hero mobile), P8 formulir/umpan balik (placeholder informatif, error in-form dipertahankan, teks di bawah tombol disabled), P9 navigasi (indikator "Langkah X dari 6", bisa dibuka lagi dari Pengaturan). `scripts/search.py` TIDAK dijalankan — ambang audit (kontras ≥4,5:1, 44px, 390px/1280px) sudah ditetapkan di `checklist-v20.md` §0.
- `~/workspace/custom-skills/addy-osmani-agent-skills/skills/frontend-ui-engineering/SKILL.md` — dibaca penuh; dipakai: WCAG 2.1 AA (kontras kotak kredensial 6,43:1, badge hijau 5,31:1), navigasi keyboard + manajemen fokus (N18), empty/error state yang bermakna (N15/N17/N23/M9/M10/M13), token semantik (hanya token Registrar yang sudah ada, tanpa warna/font baru), bukan indikator warna-saja (N6).
- Audit yang dibaca penuh: `nadia-uiux-audit-v20.md` (N1–N25), `mira-alur-audit-v20.md` (M1–M13), `yoga-security-audit-v20.md` (Y1–Y8), `checklist-v20.md` §0.

## Verifikasi yang dijalankan

- `node --check app.js` — lolos (setelah setiap perubahan besar).
- Selftest proyek (`~/workspace/tools/jsdom-test/run_selftest.js`, direktori v22 eksplisit, jsdom lokal — BUKAN `?selftest=1` di browser cloud): **SELFTEST PASS 646/646, FAIL 0** (termasuk blok wizard WIRA2 yang diperbarui + tes racun XSS).
- Probe bertarget Kirana (`~/workspace/tools/jsdom-test/probe-v22-kirana.js`): **36/36 PASS** — aturan kartu (0/1/2/3 terisi), gate `bukaWizard` (Guru + tanpa sesi), kotak kredensial (isContoh true/false, setelah ganti sandi), gate kredensial Panduan, `#/panduan` tanpa sesi, hero tanpa `only-desktop`, `role="status"`, indikator wizard 6 langkah + `tabindex="-1"`, `aturUlangFilter`, N17, N23 Tabungan, M9 Penilaian, badge login.
- Probe `gantiJenjang` (`~/workspace/tools/jsdom-test/probe-v22-gantijenjang.js`): **6/6 PASS**.
- CSS tidak punya parser terpasang — divalidasi dengan review cermat + smoke test jsdom (kelas-kelas baru muncul di DOM; tidak ada warna/font/token baru — hanya token Registrar: `--rg-primary`, `--rg-primary-soft`, `--good-soft`, `--green`, `--good-fill`, `--line`, `--r-md`, `--r-tile`, `--sp-*`, `--fs-*`).
- Belum diuji di perangkat nyata: tampilan form wizard di HP Mas (keyboard virtual + ukuran form), dan `.auth-kredensial` di 390px fisik — jsdom tidak punya layout. Perlu cek Mas dari HP seperti biasa.
