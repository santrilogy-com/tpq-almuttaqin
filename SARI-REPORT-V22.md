# Laporan Akhir — Ronde Perbaikan Temuan Audit v20 (jadinya v22)

Saya **Sari**, koordinator. Semua pekerjaan selesai di `~/workspace/tpq-madin-app/pwa-v2-v22/` — `pwa/` (live), produksi, dan `pwa-v2-fix/` (salinan tim Bagas) **tidak disentuh**. Tim: **Kirana** (frontend), **Baskara** (engine), **Wira** (security/QA). Tidak ada yang menghubungi Mas; tidak ada `?selftest=1` di profil browser cloud; **TIDAK ADA DEPLOY** — v21 deploy dulu, baru merge v22 (lihat `CHANGELOG.md` § "Overlap dengan v21").

## Ringkasan hasil

- **SW cache v20 → v22** (v21 milik Bagas — tidak dipakai).
- **Selftest: PASS 649/649, FAIL 0** — rekonsiliasi: 633 (baseline v20) + 12 kasus baru Baskara (Y2/Y3/Y4/Y6/N19) + 1 asersi baru Kirana (blok wizard WIRA2) + 3 tes baru Baskara tambahan (§6 flip ×2, Y-N3 ×1) = 649. Dijalankan independen oleh Baskara, Kirana (2×), Wira, dan saya sendiri — semuanya 649/649.
- **Verifikasi akhir gabungan Wira: 22/22 probe LOLOS** + regresi Fase 2 (95/97 langsung, 2 FAIL = false positive probe lama yang diadjudikasi ulang → lolos) + repro Fase 1 (26/37 temuan v20 sudah tidak ter-repro; 11 sisanya setup/kontrol/perilaku yang diharapkan) + **mutation test 6 gerbang** (gate Panduan, cek peran `setJenjang`, `fotoAman`, `tandaiDataAsli`, guard `resetToSeed`, gate `bolehSelftest` — semua mutasi terdeteksi, semua kontrol lolos). **Tidak ada temuan baru.**
- `node --check` app.js + engine.js + sw.js: lolos semua (dijalankan saya sendiri).
- `BASELINE-ENGINE.sha256` diregenerasi 2× (setiap kali `engine.js` berubah; hash akhir `77fb9932…`).

## 1. Yang dibangun — scope awal (temuan audit v20)

**P0 — Wizard linear 6 langkah (N1, M4, keputusan Mas 20:22 WIB).** `wizardHtml()` ditulis ulang: modal berurutan dengan indikator "Langkah X dari 6", fokus ke judul (`tabindex="-1"`), Lewati global + per langkah, draft di localStorage, tetap di wizard setelah simpan. L1 identitas lembaga (form inline via `simpanIdentitas`), L2 tambah guru inline + daftar, L3 tambah kelas inline + daftar (tanpa Hapus — lihat §4), L4 tambah santri inline + import CSV DI DALAM wizard, L5 keuangan awal (saldo awal + RAPBM), L6 ringkasan data nyata + "Ubah" per baris + "Buka Dashboard" + pengingat ganti sandi. Kartu sambutan menetap di Dashboard sesudah selesai (N25) + kartu ringkas M8 sesudah "Lewati dulu".

**P0 — Aturan hilang kartu (N3, M1, M3).** `aplikasiKosong()` bentuk OR — kartu hilang hanya bila santri+guru+kelas ketiganya terisi atau dilewati. **N19:** langkah lembaga selesai hanya bila data terisi DAN (`identitasDikonfirmasi` ATAU bukan data contoh); flag diset ganda (engine `simpanIdentitas()` + funnel UI `tandaiIdentitasDikonfirmasi()`).

**P0 — Kredensial (N2, Y8, Y1).** Kotak login tampil hanya bila `isContoh` DAN admin masih `wajibGantiSandi` (teks verbatim persis, kontras 6,43:1); kedua `<li>` kredensial di Panduan digate `isContoh`; tautan "Panduan pengguna" di login; `#/panduan` bisa dibaca tanpa sesi (mode baca saja).

**P1 — Keamanan engine (Baskara).** Y2: `setJenjang()` menolak `'Semua'` bila sesi aktif non-Pimpinan (Pimpinan tetap bisa). Y3: cap logo **1 MB** (`LOGO_MAX_BYTES`, batas `>` — tepat 1 MB diterima). Y4: magic bytes di `fotoAman()` (PNG/JPEG/WebP; HTML/JS berkedok PNG ditolak; tEXt tidak dibersihkan — jalur UI sudah re-encode via canvas). Y6: `setProfilAktif()` mereset filter terikat jenjang via `resetFilterJenjang()`; helper `gantiJenjang()` (Kirana) untuk pil dashboard/mobile/dropdown Santri. Y5: `bukaWizard()` digate ke sesi Pimpinan (Kirana).

**P1/P2 — UI (Kirana).** Hero tampil di mobile; logo `contain` di topbar/auth/brand/hero/profil; badge "✓ Dipilih/Aktif" + `aria-pressed`; grid identitas 2 kolom desktop; label `for` 20/20 + placeholder + pratinjau logo 64×64 monogram + `confirmModal` hapus logo; `role="status"` di 33 pesan kosong; tombol "Atur ulang filter"; N17 backup kosong; N23 pesan gabungan; M9/M10/M13 aksi empty state. Panduan lengkap untuk 7 tugas yang bolong + tautan `go('identitas')`/`go('santri')` + perluasan akronim (N13/N14).

## 2. Yang dibangun — tambahan scope (8 temuan audit ulang v21, Citra Fase 3)

**§6 isContoh — MENGHALANGI (P0).** (a) `wizardSelesai()` membalik `isContoh=false` + `save()` — hanya tombol Selesai L6; "Lewati" tidak membalik. (b) Helper baru `tandaiDataAsli()` (`engine.js:437`) di **43 titik pada 36 fungsi** membalik flag pada mutasi tulis asli pertama (santri/guru/kelas/transaksi/nilai/hafalan/import/simpanIdentitas/settings/RAPBM/dll; validasi gagal tidak membalik; seed/restore/selftest/hapus-data tidak membalik). Guard selftest dua lapis (flag `selftestAktif` + `setModeSelftest()` + deteksi URL cadangan). Setelah flag balik: kotak kredensial hilang dan selftest tertutup.

**Y-N3 — `resetToSeed()` tanpa guard (P0).** Temuan Baskara: v22 lebih parah dari deskripsi tugas — guard `bersih()` DAN guard ekor `resetToSeed()` v21 **keduanya hilang saat merge** (v22 bercabang dari v20). Perbaikan 4 lapis: guard `bersih()` dipulihkan (mengunci keadaan saat masuk); `resetToSeed()` menolak data asli berisi; ekor memulihkan snapshot penuh data asli (db + antrean + sesi + jenjang + profil + cfg); ekor data contoh mengembalikan sandi admin ke sebelum selftest (bukan `wirauji123`). Tes baru: selftest bersarang di data asli → santri 41→41, marker utuh, login sandi asli berhasil.

**Wiring S1 (Kirana).** Pemicu `?selftest=1` di init digate `bolehSelftest()` (`app.js:3883-3897`) + toast penolakan "Selftest hanya bisa dijalankan pada data contoh. Data asli tidak diubah." `setModeSelftest(true/false)` di awal `runUiSelfTest` / `selesai()` (bukan `try...finally` sinkron karena fungsi async — `selesai()` adalah satu-satunya titik keluar ketiga jalur). `resetToSeedConfirm()` cek hasil: gagal → toast gagal tanpa `render()`/alert sukses.

**A1c / Y-N1 / A12 / A16 / N-K1 / N-K4 (Kirana).** Kotak login tambah baris guru (teks admin persis). "Minimal 8 karakter" di `app.js` (11 tempat) + `PANDUAN.md:34` — **teks saja** (lihat §3 keputusan Y-N1). 8 toast export/backup menyebut `File: <nama-asli>`. Penjelasan "Guru Fan" (dicek kode — lihat §4). Judul Kemuridan hitung Aktif saja (Iqra 2: 6 → 5). Jarak opsi dropdown semester 8px (`mockup.css:367` + `styles.css:1221`; tinggi tidak diubah).

## 3. Keputusan koordinator (Sari)

1. **Y-N1 — teks 8 tetap, penegakan 8 TIDAK dibuat di v22.** Penegakan min-8 adalah perbaikan S5 Bagas di jalur v21; membuatnya juga di v22 menduplikasi pekerjaan di baris yang sama (cek sandi engine, pesan error, fixture selftest `guru456`/`admin`). Merge: penegakan + pesan error engine + `API.md` dari v21; teks Panduan/`app.js` dari v22. Salinan v22 sendiri sementara tidak konsisten (teks 8, penegakan 6) — v22 tidak pernah di-deploy sendiri.
2. **`hapusKelas` tidak dibuat.** Fungsi itu tidak ada di mana pun di aplikasi (layar Kelas utama pun tidak punya hapus kelas) — wizard L3 daftar-tanpa-hapus konsisten dengan aplikasi. Menambah hapus kelas adalah scope baru yang destruktif (nasib santri/jadwal di kelas yang dihapus butuh desain sendiri).
3. **Eskalasi Kirana #1 tidak berdasar.** `identitasDikonfirmasi=true` SUDAH diset Baskara di engine `simpanIdentitas()` (`engine.js:1215`) — Kirana membaca salinan sebelum edit Baskara mendarat. Panggilan UI-nya hanya lapis kedua; keduanya diverifikasi bekerja.
4. **Divergensi `PANDUAN.md` statis disengaja.** File statis tetap memuat butir kredensial; penguncian diterapkan di `renderPanduan()` aplikasi. `PANDUAN.md` bukan bagian app shell SW — sama seperti `app.js` sendiri yang memuat string seed. Desain yang diterima (Wira v19): sandi default bersifat publik + gerbang ganti-sandi-paksa.
5. **Wira diarahkan** untuk TIDAK menjadikan temuan kegagalan: penegakan min-8 (bergantung merge v21), suite bersarang Y-N3 119/140 (di luar scope), perilaku `Guru Fan` (bawaan pra-v22), `PANDUAN.md` statis, pesan sukses via toast fallback `showAlert`, M2/Y7 (jalur Bagas).

## 4. Observasi untuk Mas (bukan bagian scope — perlu keputusan)

- **"Guru Fan" tanpa hak akses apa pun.** Dicek kode Kirana: `bolehAkses('Guru Fan', x)===false` semua rute; peran login hanya Pimpinan/Guru (`engine.js:585`). Guru yang diberi peran "Guru Fan" praktis terkunci dari semua. Teks Panduan sudah dikoreksi jujur ("hanya nama peran di daftar guru, bukan peran login… tidak mengubah hak akses apa pun"). Pertanyaan: apakah Guru Fan memang seharusnya tanpa akses, atau setara Guru? (Berkaitan dengan F1 yang masih ditahan.)
- **Nama resmi + logo Ibtidaiyah masih placeholder** (warisan v20 — butuh dari klien, isi via `#/identitas`).

## 5. Verifikasi (angka)

| Pemeriksa | Hasil |
|---|---|
| Selftest resmi (Baskara) | 649/649 |
| Selftest resmi (Kirana, awal + tambahan + wiring) | 646/646 → 646/646 → 649/649 |
| Selftest resmi (Wira, independen) | 649/649 (runner resmi + pembaca per-div) |
| Selftest resmi (Sari, verifikasi akhir) | **649/649, FAIL 0** |
| Probe bertarget Kirana | 36/36; `gantiJenjang` 6/6; tambahan 42/42; wiring 18/18 |
| Probe final independen Wira | **22/22 LOLOS** |
| Mutation test Wira (6 gerbang) | Semua mutasi terdeteksi, semua kontrol lolos |
| `node --check` app.js + engine.js + sw.js | Lolos (Sari) |

**Adjudikasi Wira (FAIL yang ditelusuri sampai akar):** (1) Probe tambahan Kirana 37/42 di tangan Wira — 5 FAIL adalah artefak urutan probe itu sendiri (`wizardSelesai()` membalik `isContoh=false`, lalu `resetToSeed()` menolak reseed karena guard Y-N3 → kaskade). Perilaku LOLOS di probe final independen (perangkat segar per butir). Probe itu kini order-dependent — perlu perangkat segar per seksi bila dipakai lagi. (2) 3 FAIL awal probe final Wira — artefak asersi Wira (`masukPengguna` mengembalikan `{ok:false}` yang truthy; klaim "0 guru berjenjang Ibtidaiyah" salah — seed punya 2 guru Ibtidaiyah-only (Aisyah, Hasan), tetapi TIDAK bocor ke CSV Guru/TPQ). Keduanya diperbaiki → 22/22. Koreksi atas laporan Fase 2 Wira dicatat di laporan final.

## 6. Yang TIDAK dikerjakan (sengaja)

- M2 ("50.000"→Rp50, A4) dan Y7 (CSV formula injection, S2) — jalur Bagas; tidak satu pun `parseInt`/`csvEscape`/`angkaRp()` yang sudah ada disentuh. (Catatan: input BARU wizard memakai `angkaRp()` pada string mentah — itu kode baru yang benar, bukan perbaikan M2.)
- Butir DITAHAN: S13/A10, K9, T-04, T-09, F1, H-1–H-5.
- Yang lolos audit v20: kontras, target sentuh 44px, isolasi data TPQ/MI via UI, kedua perbaikan keamanan ronde Sari.
- Form santri/guru/kelas tidak diubah untuk label `for` (warisan v19, di luar scope — hanya identitas).

## 7. Yang belum terverifikasi / tersisa

- **Tampilan 390px/desktop nyata, sentuhan nyata, keyboard virtual HP, alur pilih logo dari galeri/kamera** — perlu verdict Mas dari HP (form wizard + kotak kredensial di 390px fisik).
- **M2 + Y7** — jalur Bagas; verifikasi setelah merge v21.
- **Penegakan min-8** — bergantung merge v21 (lihat §3.1).
- **Merge v22 → v21** — ikuti `CHANGELOG.md` § "Overlap dengan v21" (9 butir, termasuk: kotak kredensial login ganda — pakai satu; guard S1 ada di kedua jalur — bandingkan, jangan duplikasi; `BASELINE-ENGINE.sha256` regenerasi ulang setelah merge).

## Berkas

- `~/workspace/tpq-madin-app/pwa-v2-v22/` — `app.js`, `engine.js`, `styles.css`, `mockup.css`, `PANDUAN.md`, `sw.js` (`tpq-madin-v22`), `BASELINE-ENGINE.sha256`, `CHANGELOG.md`, laporan ini.
- Laporan tim: `KIRANA-REPORT-V22.md`, `BASKARA-REPORT-V22.md`, `KIRANA-REPORT-V22-TAMBAHAN.md`, `BASKARA-REPORT-V22-TAMBAHAN.md`, `KIRANA-REPORT-V22-WIRING.md` (semua di `pwa-v2-v22/`).
- Laporan audit: `~/workspace/tpq-madin-app/audit-2026-11-15/WIRA-REPORT-V22-FINAL.md` (+ `wira-probe-v22-final.js/.json`, `wira-probe-v22-verify.json`, `wira-probe-v22-repro.json`, `WIRA-REPORT-V22.md` Fase 1).

**Tidak ada anggota tim yang diam >20 menit tanpa tindak lanjut. Tidak ada deploy. Siap digabung ke v21 setelah Bagas deploy v21.**
