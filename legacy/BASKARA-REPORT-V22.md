# Laporan Baskara — Ronde Perbaikan v22 (engine.js)

**Oleh:** Baskara (engine ronde perbaikan temuan audit v20) · **Koordinator:** Sari
**Tanggal:** 15 November 2026, ~20:25–21:05 WIB
**Direktori kerja:** `~/workspace/tpq-madin-app/pwa-v2-v22/` (hanya ini yang disentuh)
**Ruang lingkup:** `engine.js` SEPENUHNYA milik Baskara. `app.js` TIDAK disentuh
(Kirana) — kecuali catatan di §6. Tidak deploy, tidak menjalankan `?selftest=1`
di profil browser cloud, tidak menghubungi Mas.

## Ringkasan hasil

| Temuan | Status |
|---|---|
| P1 Y2 — Guru mencapai "Semua" lewat `setJenjang()` | ✅ diperbaiki + 3 selftest |
| P1 Y3 — logo tanpa cap ukuran | ✅ cap **1 MB** di `simpanIdentitas()` + 2 selftest |
| P1 Y4 — `fotoAman()` tanpa magic bytes | ✅ magic bytes PNG/JPEG/WebP + 2 selftest |
| P1 Y6 — ganti profil tidak mereset filter | ✅ reset di `setProfilAktif()` + 3 selftest |
| N19 — flag `identitasDikonfirmasi` | ✅ diset saat simpan sukses + default `false` + 2 selftest |
| Selftest | ✅ **646/646 PASS, 0 FAIL** (harness resmi `run_selftest.js`) |

Rekonsiliasi angka: baseline v20 **633** + **12** kasus baru Baskara + **1** asersi
baru Kirana di blok wizard WIRA2 `app.js` (dulu 6 `t()`, kini 7 — lihat §6)
= **646**. `node --check engine.js` lolos. `BASELINE-ENGINE.sha256`
diregenerasi (format sama, `sha256sum engine.js`):
`4dd879d112a155f7accc9f938a772aae183437a0b17070e83c424c57ec749bf4  engine.js`.

## Per temuan

### Y2 — cek peran di `setJenjang()` (engine.js, sekitar baris 1075)

**Masalah (Yoga):** `setJenjang()` hanya `lsSet` + `ui.jenjang = j`, tanpa cek
peran. Guru bisa `setJenjang('Semua')` lalu `santriTampil()` / export CSV
membocorkan Ibtidaiyah sebelum `render()` berikutnya (penjaga hanya ada di
`render()`, app.js:527).

**Perbaikan — satu tempat, pola yang sama seperti `setProfilAktif()`:**
bila `j === 'Semua'` DAN ada sesi aktif yang perannya bukan Pimpinan, tolak
dan jatuh ke profil efektif (jenjang TPQ/Ibtidaiyah terakhir, atau `'TPQ'`);
simpanan `JENJANG_KEY` ikut ditulis dengan nilai efektif itu, supaya tidak
ada jalur baca yang sempat memakai `'Semua'`. Return nilai efektif.

**Batasan jujur (dicatat, bukan disembunyikan):** tanpa sesi aktif (boot /
selftest yang mengatur jenjang sebelum login) `'Semua'` tetap diizinkan —
penegakan untuk sesi terjadi di sini begitu ada sesi, dan di `render()` +
`setProfilAktif()` saat login. Verifikasi langsung (probe jsdom):
Pimpinan `setJenjang('Semua')` → `ret='Semua'`, tampil 38, ada Ibtidaiyah;
Guru → `ret='TPQ'`, tampil 22, tanpa Ibtidaiyah. Perilaku Pimpinan tidak
berubah. `setProfilAktif()` tidak diubah.

### Y3 — cap ukuran logo 1 MB (engine.js: `LOGO_MAX_BYTES`, `simpanIdentitas()`)

**Batas yang didokumentasikan: logo yang disimpan maksimal 1 MB**
(`LOGO_MAX_BYTES = 1024 * 1024`, diukur pada string data URL logo yang
disimpan, setelah downscale). Angka ini tertulis di komentar konstanta
(`LOGO_MAX_BYTES`, di atas `fotoAman()`), di komentar cek di
`simpanIdentitas()`, dan di pesan error.

**Perbaikan:** di `simpanIdentitas()`, sebelum cek `fotoAman()`:
`if (logo && logo.length > LOGO_MAX_BYTES) return hasilGagal('logo-terlalu-besar', 'Logo maksimal 1 MB.')`.
Perhatikan: **`>` bukan `>=`** — tepat 1.048.576 byte DITERIMA (Wira, poin 2).
Cap hanya di `simpanIdentitas()`, BUKAN di `fotoAman()` — supaya logo valid
lama yang sudah tersimpan dan foto santri/guru tetap lolos render
(`logoAman()`/`bersihkanFoto()`).

### Y4 — magic bytes di `fotoAman()` (engine.js, sekitar baris 721)

**Perbaikan:** sesudah regex prefix, decode 24 karakter base64 pertama
(18 byte — cukup untuk WebP yang butuh 12 byte) lewat `atob` dan periksa:
PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, WebP `'RIFF' + 4 byte +
'WEBP'`. Gagal decode / `atob` tidak ada / magic tidak cocok → `false`.
Hanya 24 karakter pertama yang di-decode supaya string raksasa tidak perlu
di-decode seluruhnya. SVG tetap ditolak (regex tidak berubah), JPEG/PNG/WebP
valid lama tetap lolos (data uji lama `iVBORw0KGgo=` dan `/9j/4AAQSkZJRg==`
lolos; `fotoAman()` dipakai `logoAman()`/`bersihkanFoto()` — tidak ada
regresi render logo lama).

**Tidak dikerjakan (sengaja):** chunk metadata tEXt/iTXt PNG TIDAK dibersihkan
di jalur simpan langsung — sesuai instruksi tugas (jangan over-engineering);
jalur pilih-file UI (`onPhotoChange`) sudah me-render ulang lewat canvas
sehingga metadata ikut terbuang. Dicatat di komentar kode.

**Jebakan yang ditemukan & diperbaiki (bukan di audit):** base64 TIDAK boleh
mengandung `'='` di tengah — `'iVBORw0KGgo=' + 'A'...` membuat `atob`
melempar sehingga logo 1 MB yang valid ikut ditolak. Data uji 1 MB/3 MB
dibangun dengan `'iVBORw0KGgoA'` (magic PNG + 1 byte nol, tanpa padding
tengah). Ini menjelaskan FAIL awal "logo 1 MB ditolak" — penyebabnya data
uji, bukan batas `>` (batasnya sudah benar `>`).

### Y6 — reset filter saat ganti profil (engine.js: `setProfilAktif()`)

**Perbaikan:** fungsi baru `resetFilterJenjang()` (satu-satunya fungsi baru
dalam ronde ini — belum ada helper reset filter di codebase):
`santriKelas='Semua'`, `santriAngkatan='Semua'`, `santriStatus='Aktif'`,
`santriSearch=''`. Dipanggil `setProfilAktif()` HANYA bila profil efektif
BERUBAH (dibandingkan dengan `getProfilAktif()` sebelum perubahan, di kedua
cabang — diterima maupun ditolak-diam-diam). Filter lain (urutan, tab,
tanggal, dsb.) tidak disentuh — tidak ada filter lain yang terikat jenjang
di `ui` selain keempat itu.

**Verifikasi choke point:** `pilihProfil()` (app.js:2127) → `setProfilAktifUi()`
(app.js:2115) → `setProfilAktif()` (engine). **Jalur lain yang mengubah
jenjang tanpa lewat sini (dilaporkan ke Sari, TIDAK diperbaiki — di luar
scope tugas):** pil jenjang di dashboard (app.js:14) dan dropdown filter
jenjang di layar Santri (app.js:989) memanggil `setJenjang()` langsung +
`render()` — mengganti jenjang tanpa mereset filter kelas. Gejala yang sama
(filter kelas basi → daftar kosong) bisa muncul lewat jalur itu; perlu
keputusan Sari/Kirana apakah pil jenjang juga harus mereset filter.

### N19 — flag `identitasDikonfirmasi` (dukung Kirana)

**Perbaikan:** `simpanIdentitas()` saat sukses (sebelum `save()`):
`db.settings.identitasDikonfirmasi = true`. Default `false`:
ditambahkan ke `emptyData().settings` dan `seedData().settings`; backup
lama tanpa flag mendapat `false` lewat `Object.assign(emptyData().settings,
d.settings)` di `load()`/`applyBackupData()` (teruji lewat selftest).
Flag ini dipakai `hitungSetup()` di `app.js` (sudah ditulis Kirana —
`hitungSetup()` di v22 ini memang sudah membaca flag ini; Baskara hanya
menyediakan sisi engine-nya). Simpan yang DITOLAK tidak mengubah flag.

## Selftest (12 kasus baru, semua di `runEngineSelfTests`)

| # | Kasus | Hasil |
|---|---|---|
| 1 | N19 default `false` (seed + emptyData + backup lama tanpa flag) | PASS |
| 2 | Y6 filter basi mengosongkan daftar sebelum pindah profil | PASS |
| 3 | Y6 ganti profil Semua → TPQ mereset filter + santri TPQ tampil (22) | PASS |
| 4 | Y6 profil TIDAK berubah → filter dipertahankan | PASS |
| 5 | Y2 Guru `setJenjang('Semua')` tanpa render → tampil tanpa Ibtidaiyah | PASS |
| 6 | Y2 export CSV Guru tetap tanpa Ibtidaiyah | PASS |
| 7 | Y2 Pimpinan `setJenjang('Semua')` tetap bisa + Ibtidaiyah tampil | PASS |
| 8 | Y4 `fotoAman` tolak PNG-berisi-HTML; terima PNG 1×1 + JPEG + WebP | PASS |
| 9 | Y4 `simpanIdentitas` tolak PNG-berisi-HTML (logo lama utuh) | PASS |
| 10 | Y3 logo 1 MB (tepat di batas) diterima | PASS |
| 11 | Y3 logo 3 MB ditolak, pesan menyebut 1 MB (logo 1 MB utuh) | PASS |
| 12 | N19 simpan sukses menandai `identitasDikonfirmasi=true` | PASS |

**Hasil harness resmi:** `node run_selftest.js ~/workspace/tpq-madin-app/pwa-v2-v22`
→ `SELFTEST PASS (646/646)` (juga dikonfirmasi pembaca per-div Wira:
646 div, 0 FAIL). Baseline sebelum edit di direktori yang sama: 633/633.

**Dua pelajaran dari proses (dicatat supaya tidak terulang):**
1. **Konteks db kosong.** Blok IDENTITAS berjalan sesudah blok DB-KOSONG
   (`clearAllData`, tanpa `bersih()` pemulih) — asersi "santri tampil" di
   blok baru vakum bila db kosong. Blok v22 diawali `bersih()` +
   `migrasiIdentitas(db.settings)` (menegakkan invarian `load()`: seed
   segar selalu dimigrasi) + login admin + `setProfilAktif('Semua')`.
   Tanpa ini, 5 tes gagal palsu (tampil 0).
2. **Throw di tengah `jalankan()` mematikan semua tes sesudahnya.**
   Asersi Y4 awal membaca `db.settings.identitas.TPQ` langsung — setelah
   `bersih()`, `identitas` belum ada dan `simpanIdentitas` yang DITOLAK
   return sebelum `migrasiIdentitas`, sehingga asersi melempar dan 3 tes
   sesudahnya hilang diam-diam (total turun ke 643). Diperbaiki dengan
   migrasi di atas + asersi memakai pembaca aman `identitasUntuk('TPQ')`
   + tes Y4 dibuat mandiri (simpan dulu logo awal, baru coba logo HTML).

## Catatan Wira (follow-up, 20:42 WIB) — sudah ditindaklanjuti

1. **Y2 Pimpinan ikut tertolak?** TIDAK — implementasi hanya menolak bila
   ada sesi aktif non-Pimpinan; dibuktikan probe langsung (Pimpinan
   `'Semua'`, tampil 38, ada Ibtidaiyah). FAIL awal di selftest adalah
   artefak db kosong (butir 1 di atas), bukan penolakan Pimpinan.
2. **Logo tepat 1 MB ditolak?** Batas sudah `>` (tepat 1 MB diterima);
   FAIL awal disebabkan data uji base64 ber-padding di tengah (lihat Y4
   di atas). Sudah diperbaiki di data uji; tes Y3 1 MB kini PASS.
3. **2 FAIL ekspektasi WIRA2 lama:** SUDAH DIPERBARUI OLEH KIRANA di
   `app.js` saat Baskara bekerja (ditemukan 20:4x WIB — `app.js` kini
   memuat ekspektasi aturan baru: "kartu tetap tampil bila baru guru
   saja", "kartu tetap tampil bila guru masih kosong", "kartu hilang
   saat santri+guru+kelas terisi" dengan guru ditambahkan kembali).
   **Baskara TIDAK mengedit `app.js`** — pembaruan itu pekerjaan Kirana.
   Catatan: `run_selftest.js` kehilangan baris FAIL bila detail mengandung
   `\n` — verifikasi akhir Baskara memakai pembaca per-div (cara Wira).

## Yang TIDAK dikerjakan (dan kenapa)

- **M2 ("50.000" → Rp50):** TIDAK disentuh — jalur Bagas. Tidak satu pun
  `parseInt` di `submit*`/engine diubah; `angkaRp()` tidak disentuh.
- **Y7 (CSV formula injection, `csvEscape`):** TIDAK disentuh — jalur Bagas.
- **Y1/Y5/Y8 (Panduan, `bukaWizard`, kotak kredensial login):** TIDAK
  dikerjakan — semuanya di `app.js` (milik Kirana).
- **S1–S7 (kecuali yang disebutkan di atas), logika seed,
  `dbUntukSinkron()`:** tidak diubah.
- **Pembersihan tEXt/iTXt PNG:** tidak dikerjakan — lihat Y4 di atas.
- **Reset filter lewat pil jenjang (`setJenjang` langsung):** tidak
  dikerjakan — dilaporkan ke Sari di §Y6; butuh keputusan pemilik UI.
- **Tidak ada fungsi/helper baru** selain `resetFilterJenjang()` (memang
  belum ada; prinsip Ponytail — reuse pola yang ada).

## Skill yang dibaca/dipakai (jujur)

- **Ponytail** (`~/workspace/custom-skills/ponytail/SKILL.md` — dibaca penuh
  versi ringkas setempat): dipakai — perubahan sekecil mungkin di satu
  tempat per temuan; reuse `setProfilAktif()` sebagai pola penegakan Y2
  (bukan mekanisme baru), reuse `fotoAman()`/`hasilGagal()`/`identitasUntuk()`
  yang sudah ada; satu-satunya fungsi baru adalah `resetFilterJenjang()`
  karena memang belum ada; tEXt-stripping sengaja TIDAK dibuat (YAGNI —
  jalur UI sudah menetralkan lewat canvas). Sub-skill ponytail di `skills/`
  tidak dibaca satu per satu — hanya SKILL.md induk yang tersedia di path
  itu.
- **Addy `api-design`** (`.../addy-osmani-agent-skills/skills/api-and-interface-design/SKILL.md`
  — dibaca penuh; catatan: path di tugas tertulis `api-design`, yang ada
  di repo adalah `api-and-interface-design`): dipakai — validasi di
  boundary (`fotoAman()` + cap di `simpanIdentitas()` sebagai benteng
  kedua lapis), error konsisten `{ok:false, error, message}` dengan kode
  baru `'logo-terlalu-besar'` mengikuti konvensi `'logo-tidak-valid'`
  yang sudah ada, tidak ada perubahan bentuk hasil yang sudah ada
  (Hyrum's Law — perilaku `simpanIdentitas`/`setJenjang` yang sudah
  diandalkan tes lama dipertahankan; penolakan `'Semua'` mengembalikan
  nilai efektif seperti `setProfilAktif()`).
- **Addy `AGENTS.md`** di repo skill (`.../addy-osmani-agent-skills/AGENTS.md`)
  sempat dibaca atas permintaan runtime — isinya mengatur repo skill itu
  sendiri, TIDAK diterapkan ke proyek TPQ.

## Berkas yang diubah (hanya di `pwa-v2-v22/`)

- `engine.js` (satu-satunya file kode yang diubah Baskara)
- `BASELINE-ENGINE.sha256` (diregenerasi, format sama)
- `BASKARA-REPORT-V22.md` (laporan ini)

**Tidak disentuh:** `app.js` (milik Kirana — termasuk pembaruan ekspektasi
WIRA2 yang sudah ia lakukan sendiri), `pwa-v2-registrar/`, `pwa-v2-fix/`,
`pwa/`. Tidak ada deploy. Wira dapat memverifikasi dengan probe independen.
