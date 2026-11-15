# KIRANA-DONE — Restyle Registrar + Nav iOS Mengambang

**Oleh:** Kirana (frontend) · **Koordinator:** Tara · **Tanggal:** 15 Nov 2026
**Direktori:** `~/workspace/tpq-madin-app/pwa-v2-registrar/` (asli `pwa-v2/` dan produksi `pwa/` TIDAK disentuh)

## 1. Hasil akhir (angka)

- **SELFTEST jsdom: 251/251 PASS** — dijalankan ulang setelah SEMUA edit terakhir
  (termasuk perbaikan kartu santri mobile + alias `--rg-*` + radius modal 16px).
  Runner: `~/workspace/.tmp-kirana/selftest-runner/run.js` via HTTP `127.0.0.1:8931`
  (file:// memberi artefak 245/251 karena origin opaque → localStorage gagal).
- **Simulasi BLOK R Wira** (`cek-blokR.js`, skrip Wira belum disisipkan ke `app.js`):
  R1 PASS, R2 PASS (aturan CSS nav: fixed + radius 26px + tembus pandang + blur),
  R4 PASS (10 kartu kv, terbaik 5 baris/kartu), R4b PASS, R5 PASS (33 deklarasi
  `--rg-*`), R6 PASS (nol CDN). R3 FAIL **hanya di jsdom** karena jsdom tidak
  mem-parse properti `backdrop-filter` pada computed style — deklarasinya
  TERBUKTI ada di stylesheet (`styles.css:418-419`, `mockup.css:175-176`,
  `blur(20px) saturate(180%)`). Di BLOK R asli, R3 memang dilewati di jsdom
  (`adaLayoutTab` false). R7 butuh layout browser — dilewati, wajib dicek live.
- **`engine.js` TIDAK disentuh** — `sha256sum -c BASELINE-ENGINE.sha256`: engine.js OK
  (app.js/styles.css/index.html FAILED seperti diharapkan karena diedit; sw.js OK).

## 2. Yang berubah per layar

- **Semua layar (sistem visual Registrar):** warna teal `#0e5e61` + amber `#e3a52b`
  menggantikan biru royal; font **Figtree** (variable font lokal 20 KB,
  `fonts/Figtree.woff2`, BUKAN CDN); radius kartu 14px, tombol/input 10px;
  bayangan kalem; thead tabel uppercase 11.5px/800; badge pil dengan titik warna;
  meter/batang grafik datar `#2b8d8f`; topbar sticky putih blur.
- **Login:** gradien teal `168deg #0e5e61 → #0d4245 → #0a2f32`; `.auth-card`
  max-width 420px; `theme-color`/`manifest` `#0b3a3d`.
- **Onboarding:** struktur gradien + ilustrasi `icons/ob-illus.webp` dipertahankan,
  diwarnai teal (sesuai poin 2 tugas).
- **Dashboard mobile:** kerangka dipertahankan (sapaan + kartu profil + Menu
  Informasi 4x2 + Notifikasi + Kehadiran + Tunggakan); kartu profil + tile menu
  gaya Registrar; warna pastel kotak ikon menu SENGAJA dipertahankan (variasi
  aksen yang sudah disetujui; Registrar sendiri memakai variasi serupa).
- **Sidebar desktop:** gradien 180deg `#0d4245 → #0a2f32`, teks putih 80%,
  aktif putih 11% + bilah amber 4px + ikon amber; logo kotak amber; badge
  term-card; 16 menu + badge jumlah tetap. Berlaku di `@media ≥900px` DAN
  `body.mode-desktop`.
- **Tabel → kartu di HP (pola Registrar `.table-stack`):** 9 tabel diberi
  `class="table-stack"` + `data-label` + `.cell-main`/`.cell-actions`
  (laporan impor, santri desktop, RAPBM pos, Realita, Arus Kas, Rekap per
  jenjang, Rekap per kelas, Alokasi waktu, Jadwal KBM). Di HP tiap baris jadi
  kartu 2 kolom label-nilai; desktop tetap tabel. Tabel `kv` (detail santri,
  rekap RAPBM) dibiarkan — itu detail key-value, bukan daftar.
- **Daftar santri mobile (kartu, bukan tabel):** kartu kini memakai baris
  label-nilai `.kv-row` (NIS, Kelas, Status, SPP, Tabungan) + header
  nama/avatar/Angkatan/Rombel + tombol Detail. Ini menutup celah tes R4 Wira
  (sebelumnya kartu hanya berisi "NIS | Kelas" satu baris meta).
- **Nav bawah iOS (syarat mutlak, KEDUA varian):** `position: fixed`,
  `left/right 12px`, `bottom: calc(12px + safe-area)`, radius **26px**,
  `background: rgba(255,255,255,.70)`, `backdrop-filter: blur(20px)
  saturate(180%)`, border `1px rgba(21,34,43,.08)`, bayangan lembut.
  Berlaku di base `.bottomnav` (`styles.css`) DAN `.bottomnav.mk`
  (`mockup.css`), mode Auto ≤899px maupun mode-mobile paksa. 5 tab tetap
  (Beranda, Santri, Tabungan, Keuangan, Kelas), ikon SVG + label, aktif jelas,
  area sentuh ≥44px. `.home-indicator` tampil di bawah pil
  (`bottom: calc(4px + safe-area)`); `.bottomnav.mk.home-ind` tetap di DOM
  untuk selftest tapi `display:none`. Padding bawah konten: `.main` 132px
  (≤520px/mode-mobile 150px); toast naik ke `bottom: calc(96px + safe-area)`.
- **Modal:** radius 16px (base, ≥900px, dan `body.mode-desktop`).
- **Form:** border `--line2`, fokus `border-color: var(--blue)` +
  `box-shadow: 0 0 0 3px var(--ring)`; focus-visible 3px `--focus`.
- **Tab tersegmentasi (`.seg`):** trek surface2, aktif putih + bayangan,
  TAPI min-height dipertahankan 44px (bukan ~30px ala Registrar) demi target
  sentuh — penyimpangan disengaja, dicatat.

## 3. Token Registrar yang dipakai

File `DESIGN-TOKENS.md` (ekstrak asli demo Registrar, HTML 44 KB + CSS 77 KB /
1.113 baris, diunduh 15 Nov 08:03–08:04 WIB; implementasi ditulis ulang,
bukan salinan CSS demo).

| Nama kanonis (`--rg-*`, DESIGN-TOKENS §2) | Nilai | Alias lama di CSS |
|---|---|---|
| `--rg-primary` | `#0e5e61` | `--blue` |
| `--rg-primary-btn-hover` | `#0a4b4e` | `--blue2` |
| `--rg-primary-soft` | `#e2f0ef` | `--primary-soft` |
| `--rg-ring` | `rgba(14,94,97,.22)` | `--ring` |
| `--rg-accent` | `#e3a52b` | `--accent` |
| `--rg-accent-soft` / `--rg-accent-ink` | `#fcf0d6` / `#3b2600` | `--accent-soft` / `--accent-ink` |
| `--rg-bg` / `--rg-surface` / `--rg-surface-2` | `#f2f5f6` / `#ffffff` / `#f6f8f9` | `--bg` / `--card` / `--surface2` |
| `--rg-ink` / `--rg-ink-2` / `--rg-muted` / `--rg-faint` | `#15222b` / `#3a4853` / `#5c6a75` / `#a3adb5` | `--ink` / `--ink2` / `--muted` / `--faint` |
| `--rg-line` / `--rg-line-2` | `#e2e7eb` / `#cfd7dd` | `--line` / `--line2` |
| `--rg-good` / soft / fill | `#17703f` / `#e1f3e8` / `#22804b` | `--green` / `--good-soft` / `--good-fill` |
| `--rg-warn` / soft / fill | `#8a5300` / `#fcefd3` / `#e3a52b` | `--amber` / `--warn-soft` / `--warn-fill` |
| `--rg-bad` / soft / fill | `#b1261d` / `#fbe5e2` / `#c73e32` | `--red` / `--bad-soft` / `--bad-fill` |
| `--rg-info` / soft | `#1d5c9b` / `#e3edf9` | `--info` / `--info-soft` |
| `--rg-focus` | `#1f8589` | `--focus` |
| `--rg-sb-top` / `--rg-sb-bottom` | `#0d4245` / `#0a2f32` | `--sb-top` / `--sb-bottom` |
| `--rg-viz-bar` | `#2b8d8f` | `--viz-bar` |
| `--rg-radius` / `--rg-radius-sm` | `14px` / `10px` | `--r-card` / `--r-sm` |
| `--rg-shadow-sm` / `--rg-shadow` | `0 1px 2px rgba(21,34,43,.04), 0 1px 3px rgba(21,34,43,.04)` / `0 12px 32px rgba(21,34,43,.12)` | `--shadow` / `--shadow-lg` |

Alias `--rg-*` ditambahkan sebagai **nilai literal** di `:root` `styles.css`
(33 deklarasi) supaya nama + hex-nya bisa digrep langsung — ini menutup
ketidaksesuaian yang ditemukan saat membaca `selftest-registrar-snippet.js`
Wira: dokumen menjanjikan nama `--rg-*`, tapi CSS sebelumnya hanya punya
nama lama. Token lama dipertahankan karena seluruh komponen memakainya.

## 4. File yang disentuh

- `styles.css` — token (+alias `--rg-*`), sidebar, tombol, badge, tabel +
  `.table-stack`, `.kv-row`, tab seg, avatar, progress, topbar, nav iOS,
  toast, judul, modal 16px, auth, banner.
- `mockup.css` — token `.mk`, nav `.mk` mengambang, home-indicator.
- `app.js` — 9 tabel `table-stack` + kartu santri mobile `.kv-row` +
  stroke logo `#0a2f32` + batang negatif `#c73e32` + struk `#f6f8f9/#15222b`.
- `index.html` — `theme-color` `#0b3a3d`.
- `manifest.json` — `theme_color` + `background_color` `#0b3a3d`.
- `fonts/Figtree.woff2` (baru, 20 KB); 5 file Poppins woff2 dihapus.
- `DESIGN-TOKENS.md` (baru) — token + pola + yang tidak diambil.
- **TIDAK disentuh:** `engine.js`, `sw.js`, `pwa-v2/`, `pwa/`.
- File orang lain di direktori ini (saya baca, tidak saya ubah):
  `selftest-registrar-snippet.js` (Wira, BLOK R), `BASKARA-REPORT.md`,
  `BASKARA-FINGERPRINT.txt`.

## 5. Skill — pemakaian JUJUR

- **UI UX Pro Max — DIBACA:** `SKILL.md` (penuh, 217 baris) +
  `references/pro-rules.md` (penuh). **Dipakai:** tabel prioritas 1–10
  (kontras 4.5:1, sentuh ≥44px, tanpa horizontal scroll, bottom nav ≤5,
  label form terlihat, error dekat field) dan checklist pre-delivery
  (target sentuh, safe area, tanpa emoji sebagai ikon, token semantik,
  feedback tekan, konten tidak tertutup bar tetap). **TIDAK dipakai:**
  script `search.py` / `--design-system` — arah visual sudah ditetapkan
  riset Registrar (tugas), bukan hasil pencarian skill.
- **Addy Osmani — DIBACA:** `SKILL.md` paket + `skills/frontend-ui-engineering/SKILL.md`
  (penuh) + `AGENTS.md` paket (mengatur repo skill itu sendiri; pemetaan
  intent→skill mengonfirmasi frontend-ui-engineering untuk kerja UI).
  **Dipakai:** design-system adherence (token semantik, bukan hex mentah),
  hindari "AI aesthetic" (tanpa gradien ungu berlebihan, radius konsisten),
  skala spasi konsisten, hierarki tipografi, aksesibilitas WCAG (focus ring,
  label), mobile-first responsif, daftar verifikasi. **DITOLAK/tidak dipakai:**
  skill Addy lain (TDD, spec-driven, dsb.) — tidak relevan untuk restyle visual.
- **Ditolak dari Registrar** (dicatat di DESIGN-TOKENS.md §6): Bootstrap 5.3.8,
  mode gelap, drawer offcanvas mobile (diganti nav bawah iOS sesuai arahan
  Mas), foto/teks demo, chart SVG, varian `.table-ledger`/`.table-grades`.

## 6. Yang MASIH berbeda dari Registrar dan kenapa

- **Nav bawah BUKAN gaya Registrar** (Registrar memakai drawer/sidebar) —
  arahan mutlak Mas 15 Nov 15:03 WIB: nav iOS mengambang + blur.
- **Topbar tidak bleed selebar viewport** (terbatas padding `.main`) — struktur
  layout lama dipertahankan supaya selftest + mode desktop tidak rusak.
- **Tab seg 44px, bukan ~30px ala Registrar** — target sentuh (ui-ux-pro-max).
- **Warna pastel tile menu dipertahankan** — variasi aksen yang sudah disetujui.
- **Onboarding:** struktur gradien + ilustrasi dipertahankan (sudah di-acc),
  hanya diwarnai teal.
- **Tidak ada mode gelap** — Registrar demo memilikinya, tapi di luar tugas
  dan menambah risiko regresi.
- **Tabel `kv` tidak di-stack** — itu detail key-value, bukan daftar.

## 7. Yang TIDAK sempat / belum terverifikasi — JUJUR

- **Screenshot browser sungguhan (390px) TIDAK didapat.** Chromium sistem
  (`/opt/meta-chromium/chrome`) menolak start saat dipanggil langsung oleh
  subagent: `Hatch WebGL domain policy is required for browser startup`
  (dicoba via puppeteer-core dan via `--headless --screenshot` langsung).
  Saya TIDAK mencoba mengakali kebijakan itu. Verifikasi visual yang ada:
  cek computed-style jsdom (nav fixed/12px/radius 26px/rgba .70, topbar
  sticky, sidebar 16 item + aktif putih 11%, table-stack per layar, kartu
  santri 11 kartu/0 tabel mobile) + selftest 251/251 + simulasi BLOK R.
  **Yang masih butuh browser live (Tara/Wira):** screenshot 390px tiap layar,
  tes tap nav + tombol di HP, dan R7 (nav tidak menutupi konten terakhir).
  Verdict HP Mas tetap yang menentukan.
- **SW cache belum di-bump:** `sw.js` TIDAK disentuh — tindak lanjut deploy
  (Wira/Damar): bump cache v11→v12 + tambah `fonts/Figtree.woff2` ke
  `APP_SHELL` (Wira sudah mencatatnya di header BLOK R).
- **Penyisipan BLOK R ke `app.js` bukan tugas saya** — Wira menulis di header
  snippet: disisipkan SETELAH file ini ada. Simulasi saya (6/7 PASS, 1 FAIL
  jsdom-only pada R3) menunjukkan BLOK R akan hijau di jsdom kecuali R3/R7
  yang memang dilewati di sana.

## 8. Catatan lingkungan & alat

- `/tmp` sempat ter-wipe di tengah tugas (VM diganti) — semua pekerjaan tahan
  lama ada di `~/workspace`; runner jsdom dibangun ulang di
  `~/workspace/.tmp-kirana/selftest-runner/` (`run.js`, `cek-visual.js`,
  `cek-blokR.js`, `node_modules` jsdom 24) dan bisa dipakai ulang Wira.
- HTTP server port **8931** masih jalan dari direktori registrar
  (`python3 -m http.server 8931`, log di
  `~/workspace/.tmp-kirana/http-8931.log`) — untuk verifikasi Tara/Wira.
- Tidak ada ID/kelas selftest yang diganti.
