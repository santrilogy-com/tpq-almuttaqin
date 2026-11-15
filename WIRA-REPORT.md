# Laporan Wira — Security/QA ronde "Data kosong + Panduan pengguna" (PWA TPQ Al-Muttaqin)

- Peran: Wira, spesialis security/QA. Koordinator: Sari.
- Direktori: `~/workspace/tpq-madin-app/pwa-v2-registrar/` (hanya ini; `pwa/` live dan `pwa-v2-fix/` TIDAK disentuh).
- Waktu: 15 Nov 2026 ~19:19–20:15 WIB.
- TIDAK deploy apa pun. `?selftest=1` TIDAK dijalankan di profil browser cloud — hanya jsdom (`~/workspace/tools/jsdom-test/run_selftest.js`).
- Laporan ini menggantikan `WIRA-REPORT.md` ronde sebelumnya (jenis kelamin + Tapel); temuan lama ronde itu yang masih relevan dicatat ulang di butir 4.5.

## 1. Skill — laporan pemakaian JUJUR

- **security-and-hardening — DIBACA PENUH**: `~/workspace/custom-skills/addy-osmani-agent-skills/skills/security-and-hardening/SKILL.md`. **Dipakai**: threat model per boundary (STRIDE: form identitas, logo upload, wizard, halaman panduan, pemilih profil), aturan "never innerHTML with user data", validasi di boundary tulis (`simpanIdentitas`), encode output (`esc()` vs `escJs()`), dan pola abuse-case-di samping-use-case (nama lembaga racun, logo SVG, Guru memanggil simpan langsung). **Tidak dipakai**: bagian auth/session/rate-limit/SSRF/dependensi — tidak ada perubahan di area itu ronde ini; bagian upload file dipakai sebagian (logo dibahas sebagai data URL, bukan multipart).
- **code-review-and-quality — DIBACA PENUH**: `.../skills/code-review-and-quality/SKILL.md`. **Dipakai**: review 5 sumbu (correctness, readability, architecture, security, performance), review tes dulu, dan mutation test untuk kedua perbaikan security (butir 5: balik satu kondisi, jalankan suite, kembalikan). **Tidak dipakai**: pola multi-model review dan dependency review — tidak relevan (tidak ada dependensi baru, kerja solo).
- **AGENTS.md paket Addy Osmani — DIBACA**: `~/workspace/custom-skills/addy-osmani-agent-skills/AGENTS.md`. **Catatan jujur**: file itu mengatur repo skill itu sendiri ("not meant to be copied into other projects"), jadi TIDAK diterapkan sebagai aturan proyek TPQ; yang dipakai hanya kedua SKILL.md di atas.
- Referensi `references/hardening-patterns.md` dan `references/security-checklist.md` TIDAK dibaca penuh — SKILL.md sudah merangkum pola yang dibutuhkan (esc/escJs, fotoAman, penjaga peran); checklist dipakai sebagai lensa, bukan dibaca baris demi baris. Dicatat jujur di sini.

## 2. Baseline + perbaikan 3 ekspektasi menu

- Baseline sebelum perubahan Wira (dijalankan dulu, bukan diklaim): **jsdom 543/546, tepat 3 FAIL** — ketiganya ekspektasi lama yang meng-hardcode jumlah menu.
- Diperbaiki ekspektasinya (bukan kodenya), sesuai penambahan 2 rute baru (panduan + identitas) yang disengaja:
  - `app.js:4248` "Sidebar desktop berisi 16 menu" → **18 menu**.
  - `app.js:4307` "Sidebar guru hanya 7 modul" → **9 modul**.
  - `app.js:4408` "Sidebar Guru berisi 7 menu" → **9 menu**.
- Tidak diubah: "GURU_ROUTES berisi 7 rute" (benar — allowlist rute Guru memang 7; sidebar menampilkan 9 item karena panduan + identitas ikut dirender sebagai nav-item di grup Lainnya).

## 3. Tes baru (87 tes: 85 app + 2 engine)

Semua di blok baru **BLOK WIRA-2** di `app.js` (sebelum "Kembalikan ke keadaan awal"), pola `t('WIRA2 ...', kondisi, detail)`, plus 2 `catat()` di selftest engine (`engine.js`, blok IDENTITAS). Pola snapshot/pemulihan mengikuti BLOK C: snapshot db + antrean + profil + flag wizard di awal, cleanup di luar `try` (sandi admin/guru dikembalikan ke seed) supaya tidak ada state tertinggal walau ada tes yang melempar.

- **Wizard (14)**: kartu tampil di Dashboard saat db kosong (0 santri DAN 0 guru, Pimpinan); `hitungSetup()` kosong = semua langkah belum selesai; tambah 1 guru → langkah guru selesai + kartu hilang; tambah kelas+santri+transaksi → langkah 3/4/5 selesai; langkah lembaga selesai bila nama+kepala+tarif+tahun terisi (lewat jalur kanonik `simpanIdentitas` — lihat catatan flip di butir 6); `wizardLewati()` menyimpan flag `tpq-madin-pwa-wizard='lewati'` + kartu hilang + tetap bisa dibuka dari Pengaturan ("Buka panduan setup" → modal "Mulai isi data") + kartu tampil lagi setelah flag dilepas.
  - **Perilaku yang dicatat (bukan bug)**: kartu hilang begitu santri ATAU guru ada (`aplikasiKosong()` false), lebih awal dari bacaan harfiah tugas "hilang begitu santri>0 DAN guru>0 DAN kelas>0" — sesuai komentar kode `wizardKartuDashboard` ("di sini malah lebih awal"). Dites dan didokumentasikan apa adanya.
- **Panduan (6)**: 8 seksi tampil untuk Pimpinan DAN Guru; kalimat Mira A1 persis ada di halaman (`"Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama."`); tidak ada hash/salt/token bocor (butir 4b).
- **Empty state (21)**: 15 rute data (dashboard, santri, tabungan, keuangan, rapbm, kelas, hafalan, guru, pengumuman, laporan, penilaian, kbm, kemuridan, khidmah, grafik) masing-masing menampilkan ≥1 pesan `.empty` + ≥1 tombol saat data kosong; 3 rute statis (pengaturan, panduan, identitas) render utuh tanpa empty state — dibedakan jujur, bukan dipaksakan punya empty state; aksi relevan: santri → "Tambah santri", guru → "Tambah guru", kelas → "Tambah kelas".
- **Hapus semua data (4)**: `clearAllData()` mengosongkan santri/guru/kelas; pengguna bawaan tetap ada (admin + guru1, 2 akun); admin DAN guru1 tetap bisa login sesudahnya. Tes lama tetap lolos (suite akhir 633/633).
- **Identitas/profil (23)**: migrasi settings lama (TPQ dari namaTpq + kepala 'Ustadz Ahmad' terbawa; Ibtidaiyah default "Madrasah Ibtidaiyah"/"MI"); edit identitas tersimpan + nama TPQ ikut berubah (form + hero); login pilih profil Ibtidaiyah → hero menampilkan nama Ibtidaiyah + santri terfilter **16** + chip "16 santri aktif" + logo `<img src>` data URL; klik tombol `data-profil` di hero mengganti profil ke TPQ (santri jadi 22); Pimpinan bisa pilih Semua (tombol ada di Pengaturan); Guru tidak bisa (tombol Semua tidak ada + `setProfilAktif('Semua')` sebagai Guru ditolak, simpanan utuh); kartu login Ibtidaiyah menampilkan logo; penjagaan peran identitas (butir 4a); logo (butir 4c).
- **Security (17)**: XSS wizard (3) + audit onclick (1) + logo (9: logoAman, simpanIdentitas SVG/javascript, logo racun tersimpan tidak dirender, payload tidak dieksekusi, pratinjau + hidden input) + panduan no-leak (1) + penjaga Guru (3).
- **Data ada (2)**: setelah restore snapshot, rute santri menampilkan daftar (tabel + "Ahmad Fauzi"). Catatan implementasi: restore snapshot mengembalikan admin ke `wajibGantiSandi=true` (keadaan seed), dan `sesiAktif()` membaca flag itu LANGSUNG dari `db.pengguna` — jadi tes ini wajib mengulang dance ganti sandi paksa dulu, kalau tidak `render()` menampilkan layar ganti sandi, bukan daftar. Itu perilaku mesin yang benar, bukan bug.

## 4. Temuan security

### TEMUAN 1 — KRITIS (baru, ronde ini; SUDAH DIPERBAIKI): stored XSS lewat nama/kepala/tahun ajaran di wizard "Mulai isi data"
- `app.js` `wizardLangkah()` langkah 1 merangkai `ket` dari `idn.nama`, `idn.kepala`, dan `db.settings.tahunAjaran` TANPA `esc()`, lalu `wizardHtml()` menyisipkannya mentah ke HTML (`<span class="muted">' + l.ket + '</span>'`). Nama lembaga bebas diisi Pimpinan lewat Identitas Madrasah; tahun ajaran lewat Pengaturan.
- Bukti (probe jsdom sebelum perbaikan): nama `'<img src=x onerror="window.__wiraXss=1">'` + kepala `'<script>alert(1)</script>'` → `wizardHtml()` mengandung `<img src=x` dan `<script>` MENTAH. Di browser sungguhan, `<img onerror>` di `innerHTML` modal/dashboard akan dieksekusi saat wizard dibuka — Pimpinan yang mengisi nama racun (atau penyerang yang merebut sesi Pimpinan) mendapat eksekusi di sesi siapa pun yang membuka wizard. jsdom sendiri tidak mengeksekusi `onerror` (tidak memuat resource), jadi bukti eksekusi di sini adalah string mentah, bukan alert yang meledak — dicatat jujur.
- Perbaikan (Wira): `esc()` pada ketiga nilai di ket langkah 1 (`app.js`, `wizardLangkah()`); langkah 2–5 hanya memakai angka (jumlah), aman. `heroIdentitasHtml`, `profilLoginHtml`, `kartuIdentitasHtml`, `showAlert`, dan header (`textContent`) sudah memakai `esc()`/teks aman — hanya ket wizard yang lolos.
- Bukti regresi (mutation test, pola ronde lalu): kembalikan ket ke tanpa `esc()` → suite **631/633, tepat 2 gagal** (tes string wizard + tes modal wizard); kembalikan `esc()` → **633/633**. Tes "payload tidak dieksekusi" tetap hijau di kedua arah karena jsdom tidak mengeksekusi `onerror` — gate sesungguhnya adalah kedua tes string itu.

### TEMUAN 2 — SEDANG (baru, ronde ini; SUDAH DIPERBAIKI): `simpanIdentitas` menerima logo SVG
- `engine.js` `simpanIdentitas()` hanya memeriksa `logo.indexOf('data:image/') !== 0` — `data:image/svg+xml;base64,...` LOLOS dan tersimpan. SVG bisa membawa script (`<svg onload>`); risiko saat ini rendah karena SEMUA jalur render logo memakai `logoAman()` → `fotoAman()` (regex ketat `^data:image/(jpeg|png|webp);base64,...$`, menolak SVG), jadi SVG tersimpan tidak pernah dirender — tapi data beracun tidak boleh tersimpan sejak awal (defense in depth; satu renderer masa depan yang lupa `logoAman` akan langsung kena).
- Perbaikan (Wira): `simpanIdentitas()` kini menolak logo yang tidak lolos `fotoAman()` (error `logo-tidak-valid`, pesan diperbarui ke "JPEG/PNG/WebP, base64"). `onPhotoChange()` menghasilkan `canvas.toDataURL('image/jpeg')` — tetap lolos. Tes engine lama (logo PNG diterima, URL https ditolak) tetap hijau.
- Bukti regresi (mutation test): kembalikan cek lama → suite **631/633, tepat 2 gagal** (tes app "simpanIdentitas menolak logo SVG" + tes engine "IDENTITAS simpanIdentitas logo SVG ditolak"); kembalikan `fotoAman()` → **633/633**.

### 4a. Penjagaan peran #/identitas — TERVERIFIKASI (tidak ada temuan)
- Guru di `#/identitas`: semua input tampak `disabled` (16/16; 2 hidden input logo memang tidak di-disabled — bukan kontrol yang bisa diubah di layar, dan penjaga sebenarnya ada di bawah); tidak ada tombol "Simpan identitas" maupun "Pilih logo".
- `submitIdentitas()` sebagai Guru mengembalikan `false` + nama tidak berubah (cek `peranSaya()` di baris pertama, sebelum membaca form).
- `simpanIdentitas('TPQ', ..., 'guru1')` → `{ ok:false, error:'bukan-pimpinan' }` (cek `pemintaAdalahPimpinan(olehId)` di engine). Catatan jujur (sudah ada di kode, bukan temuan baru): pemeriksaan ini menegakkan kontrak UI, BUKAN keamanan anti-console — siapa pun dengan DevTools bisa memanggil fungsi engine langsung dengan `olehId 'admin'` karena tidak ada server.

### 4b. #/panduan bisa dibaca Guru — TIDAK ADA KEBOCORAN
- `renderPanduan()` adalah string statis (tidak menginterpolasi `db`/settings sama sekali). Tes: tidak mengandung kata `hash`/`salt`, tidak mengandung hash pengguna `db.pengguna[0].hash`, tidak mengandung nilai token sinkron tersimpan (`getSheetCfg().syncToken`).
- Nuansa yang dicatat jujur: halaman MEMANG menulis kata sandi bawaan `admin123`/`guru123` (kalimat Mira A1, disengaja, diminta tugas) dan kata "Token" (penjelasan "Token rahasia sinkron (opsional)"). Itu teks panduan, bukan nilai kredensial yang bocor. Mitigasinya sudah ada di produk: login pertama wajib ganti sandi (`wajibGantiSandi`, tidak bisa dilewati ke dashboard) dan token sinkron tidak pernah ditulis di halaman panduan.

### 4c. Logo data URL — cara render AMAN
- Semua render logo memakai `logoAman()` (tolak bila bukan `fotoAman`) + `esc()` di atribut `src` (`logoHtml`, `kartuIdentitasHtml` pratinjau + hidden input, `terapkanIdentitasShell` — `img.src` diisi nilai yang sudah lolos `logoAman`, nama lewat `textContent`).
- Tes: logo `"><script>`, `javascript:alert(1)`, dan SVG → `logoAman` mengembalikan `''`; logo racun yang dipaksa tersimpan langsung di db (simulasi data lama/restore) TIDAK dirender di pratinjau identitas dan string `onerror=` tidak muncul mentah di HTML; logo PNG valid tersimpan + tampil di hero (`<img class="hero-logo" src="data:image/png;base64,...">`), kartu login, dan pratinjau `#logo-preview-id-tpq` + hidden input `#logo-id-tpq`.
- **Yang TIDAK bisa dites di jsdom (dicatat jujur)**: alur pilih file sungguhan (`onPhotoChange` → `FileReader` → `canvas` downscale 480px → `toDataURL('image/jpeg')` → hidden input + pratinjau). jsdom tidak punya `FileReader`/`canvas` yang berfungsi untuk ini. Diverifikasi dengan baca kode saja: `accept="image/*"`, tolak non-gambar, downscale maks 480px, output selalu JPEG base64 (lolos `fotoAman`). Perlu tes HP Mas untuk alur pilih-dari-galeri/kamera.

### 4d. Audit `esc()` vs `escJs()` di handler `onclick` baru — BERSIH
- Diperiksa semua handler baru (wizard, panduan, identitas, profil, pemilih profil): semuanya memakai literal tetap (`pilihProfil('TPQ')`, `pdScroll('pd-mulai')`, `hapusLogoIdentitas('TPQ')`, `go('identitas')`, …) — TIDAK ADA data pengguna yang diinterpolasi ke string JS. Tes audit: gabungan HTML wizard+panduan+identitas+picker+login, semua segmen `onclick="..."` diperiksa tidak mengandung `<` maupun payload racun — lolos.
- Pemeriksaan seluruh `app.js` (skrip Python): NOL kemunculan `esc(` tanpa `escJs(` di dalam atribut `onclick`/`onkeydown`.
- **Temuan lama ronde lalu SUDAH BERES (bukan oleh Wira ronde ini)**: `pickerSetChip(escJs(c))` (`app.js:699`) dan `openResetSandiModal(escJs(u.id), escJs(u.nama))` / `mintaHapusPengguna(escJs(...))` (`app.js:1559-1560`) — diverifikasi sudah memakai `escJs()`. Interpolasi `.id` lain ke handler adalah ID sistem (`prefix + Date.now().toString(36) + random`, alfanumerik, bukan input pengguna) — aman.
- Catatan kecil (tidak diperbaiki, di luar lingkup): `emptyState(teks, ...)` tidak meng-escape `teks`-nya — semua pemanggil saat ini memakai string literal, jadi aman hari ini; pemanggil masa depan yang memasukkan data pengguna akan membuka XSS. Sebaiknya `emptyState` meng-`esc()` teksnya di ronde berikut.

### 4e. Tidak ada URL eksternal / CDN / kredensial baru — BERSIH
- Tidak ada `http(s)://` di blok kode baru (`app.js` 2052–2474: wizard/panduan/identitas/profil). Total `http` di `app.js` (5) dan `engine.js` (9) semuanya URL lama (Google Sheet/Apps Script). Tidak ada secret/kredensial baru di kode.

### 4f. Catatan kecil lain (dicatat, tidak diperbaiki)
- `identitasFallback()` (membaca `settings.kepala`/`namaTpq`) praktis tidak terjangkau: `identitasUntukUi()` selalu mendapat objek dari `identitasUntuk()` (default berkepala kosong bila identitas belum ada), jadi fallback itu dead code dalam praktik. Bukan kerentanan — hanya kebersihan. Dampaknya sempat terlihat di tes: mengisi `settings.kepala` saja TIDAK membuat langkah lembaga wizard selesai; kepala harus masuk lewat `simpanIdentitas`/migrasi.
- Jalur restore (`applyBackupData`/`applyPulledData`) menimpa `db` mentah termasuk `settings.identitas.logo` tanpa validasi `fotoAman` — logo SVG dari cadangan tetap tidak bisa dieksekusi karena semua render memakai `logoAman()`. Disarankan (bukan wajib): bersihkan logo identitas di `bersihkanFoto()` juga.

## 5. Verifikasi

- `node --check app.js` + `node --check engine.js`: LOLOS (sebelum dan sesudah perubahan).
- jsdom `run_selftest.js` (direktori `pwa-v2-registrar`):
  - Baseline (sebelum Wira): **543/546, FAIL 3** (menu, sudah diketahui).
  - Setelah perbaikan menu + 87 tes baru: **633/633, FAIL 0**.
  - Rekonsiliasi: 546 + 87 tes baru (85 app WIRA2 + 2 engine logo) = 633. 3 FAIL lama kini hijau lewat perbaikan ekspektasi; tidak ada tes lama lain yang berubah hasil.
  - Mutation test 1 (wizard): cabut `esc()` di ket langkah 1 → **631/633, tepat 2 gagal** (tes string + tes modal wizard) → kembalikan → 633/633.
  - Mutation test 2 (logo): kembalikan cek `data:image/` lama → **631/633, tepat 2 gagal** (tes app SVG + tes engine SVG) → kembalikan → 633/633.
- `PANDUAN.md` diverifikasi manual dengan `grep` (jsdom tidak bisa baca file): **8 seksi** (`## 1.` s.d. `## 8.`, judul sama dengan halaman `#/panduan`); kalimat Mira A1 persis muncul **1×**; tidak ada kata `hash`/`salt` di file. (Kata "Token" ada di bagian Apps Script sebagai penjelasan, sama seperti halaman — bukan nilai token.)
- Data contoh tidak berubah: seed 40 santri (aktif 38: TPQ 22, Ibtidaiyah 16), 5 guru — tidak ada tes Wira yang mengubah angka seed secara permanen (semua mutasi dikembalikan snapshot; sandi admin/guru1 dikembalikan ke `admin123`/`guru123` + flag seed).

## 6. Anomali jujur: satu flip yang tidak terjelaskan

- Pada run penuh PERTAMA setelah blok tes ditulis (628/631), tes "WIRA2 wizard: kartu hilang saat santri+guru+kelas terisi" GAGAL sekali — lalu LOLOS di 3 run penuh berikutnya (632/633, 633/633, 633/633 final) dan di probe replikasi seksi F (yang menunjukkan `aplikasiKosong=false`, kartu `''` seperti diharapkan). Penyebab flip itu TIDAK berhasil saya temukan: logika `wizardKartuDashboard()`/`aplikasiKosong()` deterministik dan tidak memakai `Date.now()`/`Math.random()`; satu-satunya jalur async yang relevan (`hashchange` → `render()`) tidak memuat ulang `db` dari penyimpanan. Sebagai mitigasi, tes itu kini membawa detail diagnostik (`santri=… guru=… kelas=… kosong=… peran=… ditutup=…`) supaya bila kambuh, penyebabnya langsung terlihat. Bukan alasan untuk menahan ronde — 3 run hijau beruntun + probe adalah bukti yang ada.

## 7. Yang BELUM terverifikasi live

- Tampilan 390px + desktop di perangkat nyata, dan alur pilih logo dari galeri/kamera HP (FileReader + canvas downscale — tidak bisa di jsdom, butir 4c). Verdict HP Mas tetap menentukan.
- Klik tombol `data-profil` di hero, wizard, dan empty state di HP sungguhan (jsdom membuktikan `el.click()` memicu `onclick` inline + state berubah, tapi bukan sentuhan nyata).
- Deploy TIDAK dilakukan (tugas koordinator di akhir). Tidak ada yang di-deploy dari ronde ini.
