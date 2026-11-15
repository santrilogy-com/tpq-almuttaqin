# DESIGN TOKENS — Registrar (uiCookies) untuk TPQ Al-Muttaqin PWA

Sumber: demo live Registrar yang dipelajari langsung —
`https://uicookies.com/demo/theme/registrar` (HTML demo 44 KB, diunduh
`/tmp/registrar-demo.html`, HTTP 200) dan `css/style.css?v=20261103.1`
(77 KB, 1.113 baris, diunduh `/tmp/registrar-style.css`).
Lisensi uiCookies: gratis untuk pemakaian pribadi dan komersial
(`https://uicookies.com/license/`).

**Yang dilakukan di sini: mengekstrak token + pola, lalu menulis ulang
implementasi sendiri di `styles.css` / `mockup.css` / `app.js`. TIDAK ada
file CSS demo yang disalin mentah ke repo ini (bukan redistribusi template).**

## 1. Tipografi

- Font demo: **Figtree** (Google Fonts di demo: `Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400`).
  BUKAN Poppins — jadi font aplikasi diganti ke Figtree.
- PWA harus offline: file font di-bundle lokal di `fonts/` sebagai **satu
  file variable font `Figtree.woff2` (20 KB, subset latin, sumbu wght
  300–900, terverifikasi fontTools)** — diunduh dari `fonts.gstatic.com`,
  BUKAN CDN Google Fonts saat runtime.
- Stack: `"Figtree", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- Body: `0.9375rem` (15px), `line-height: 1.5`, `-webkit-font-smoothing: antialiased`.
- Judul halaman: `clamp(1.5rem, 1.25rem + .9vw, 1.875rem)`, weight 800,
  `letter-spacing: -.02em`. Judul panel: `1rem`, weight 700.
- Angka: `font-variant-numeric: tabular-nums` (kelas `.num` / `.mono`).

## 2. Warna

| Token | Nilai | Pakai |
|---|---|---|
| `--rg-primary` | `#0e5e61` | teal gelap: link, status aktif, tombol utama |
| `--rg-primary-btn-hover` | `#0a4b4e` | hover tombol utama |
| `--rg-primary-soft` | `#e2f0ef` | latar lembut teal (chip, ikon panel, meter) |
| `--rg-ring` | `rgba(14,94,97,.22)` | ring fokus |
| `--rg-accent` | `#e3a52b` | amber hangat: sorotan, bilah aktif sidebar |
| `--rg-accent-soft` | `#fcf0d6` | latar lembut amber |
| `--rg-accent-ink` | `#3b2600` | teks di atas amber |
| `--rg-bg` | `#f2f5f6` | latar aplikasi |
| `--rg-surface` | `#ffffff` | kartu / panel |
| `--rg-surface-2` | `#f6f8f9` | permukaan kedua (kepala tabel, trek segmen) |
| `--rg-ink` | `#15222b` | teks utama |
| `--rg-ink-2` | `#3a4853` | teks sekunder |
| `--rg-muted` | `#5c6a75` | teks redup |
| `--rg-faint` | `#a3adb5` | teks paling redup |
| `--rg-line` | `#e2e7eb` | garis / border |
| `--rg-line-2` | `#cfd7dd` | border kontrol |
| `--rg-good` / soft / fill | `#17703f` / `#e1f3e8` / `#22804b` | sukses |
| `--rg-warn` / soft / fill | `#8a5300` / `#fcefd3` / `#e3a52b` | peringatan |
| `--rg-bad` / soft / fill | `#b1261d` / `#fbe5e2` / `#c73e32` | bahaya |
| `--rg-info` / soft | `#1d5c9b` / `#e3edf9` | info |
| `--rg-focus` | `#1f8589` | outline fokus (3px, offset 2px) |
| `--rg-sb-top` / `--rg-sb-bottom` | `#0d4245` / `#0a2f32` | gradien sidebar/drawer (180deg) |
| `--tip-bg` | `#15222b` | latar toast / tooltip |

Warna aksen avatar (inisial, dipakai Registrar untuk membedakan orang):
`#d8eeec/#0b4f52`, `#fbe8c2/#74480a`, `#dce7f7/#1d4f8a`,
`#ebe0f6/#57378a`, `#f7e0e4/#8a2f45`, `#ddefe0/#235d34`.

## 3. Radius, bayangan, spacing

- `--rg-radius: 14px` (panel/kartu), `--rg-radius-sm: 10px`
  (tombol, input, ikon panel). Modal: 16px. Pil: 999px.
- `--rg-shadow-sm: 0 1px 2px rgba(21,34,43,.04), 0 1px 3px rgba(21,34,43,.04)`
  (panel/kartu). `--rg-shadow: 0 12px 32px rgba(21,34,43,.12)` (menu, modal).
- `--rg-gap: 16px` (24px pada ≥1400px). Sidebar 256px, topbar 64px.
- Fokus: `outline: 3px solid #1f8589; outline-offset: 2px`; input fokus
  `border-color: #0e5e61; box-shadow: 0 0 0 3px rgba(14,94,97,.22)`.

## 4. Komponen

- **Panel/KPI**: panel putih, border 1px `--rg-line`, radius 14px,
  shadow-sm. KPI: padding 18px 20px; ikon 36px di kotak 10px latar
  `--rg-primary-soft`; label 0.875rem weight 700 warna `--rg-ink-2`;
  nilai 1.9rem weight 700, `letter-spacing: -.02em`; catatan 0.8125rem muted.
  Di HP (≤575px): KPI jadi 2 kolom, padding 14px, nilai 1.5rem.
- **Tombol**: radius 10px, padding `.5rem .95rem`, font 0.875rem weight 700,
  gap ikon 8px. Utama: bg `#0e5e61`, hover `#0a4b4e`,
  `box-shadow: 0 1px 2px rgba(14,94,97,.25)`. Sekunder: putih + border
  `--rg-line-2`. Kecil: radius 8px, font 0.8125rem.
- **Form**: `min-height: 40px`, border `--rg-line-2`, radius 10px,
  font 0.9063rem, bg permukaan. Label: 0.8438rem weight 700 warna ink-2.
  Checkbox tercentang: bg `#0e5e61`.
- **Tabel**: kepala `background: var(--rg-surface-2)`, teks muted
  0.7188rem weight 800, `letter-spacing: .06em`, UPPERCASE, `white-space: nowrap`;
  sel `padding: 11px 14px`, border bawah `--rg-line`; baris hover
  `color-mix(in srgb, var(--rg-primary) 4%, transparent)`; tfoot tebal
  di atas `--rg-surface-2`; angka `tabular-nums`.
- **Badge/status (pil)**: `inline-flex`, gap 6px, `padding: 3px 9px 3px 8px`,
  radius 999px, font 0.75rem weight 700, titik 6px `currentColor` di depan
  (`::before`). Varian sukses/peringatan/bahaya/info/netral = warna soft.
  `.class-tag`: padding 2px 8px, radius 6px, bg primary-soft, weight 800.
- **Avatar**: kotak membulat (BUKAN lingkaran), 36px, radius 10px,
  inisial weight 800; varian lg 44px/radius 12px, xl 76px/radius 20px.
- **Topbar**: sticky, `background: color-mix(in srgb, surface 88%, transparent)`,
  `backdrop-filter: saturate(1.4) blur(10px)`, border bawah `--rg-line`.
- **Kontrol tersegmentasi (`.seg`)**: trek `--rg-surface-2`, border
  `--rg-line`, radius 11px, padding 3px; tombol aktif putih + bayangan
  `0 1px 2px rgba(21,34,43,.1), 0 0 0 1px var(--rg-line)`.
- **Meter/progress**: tinggi 6px, radius 3px, trek primary-soft,
  isi `#2b8d8f` (viz-bar); varian baik/kurang/rendah pakai fill hijau/amber/merah.
- **Toast**: bg `#15222b`, teks putih, radius 12px, padding 12px 16px.
- **Sign-in**: kartu maks 420px; ikon gembok 48px di kotak 14px
  primary-soft; judul 1.75rem weight 800; kicker amber 0.75rem weight 800
  `letter-spacing: .1em` UPPERCASE; panel samping desktop gradien teal
  gelap + headline putih.
- **Sidebar/drawer**: gradien 180deg `#0d4245 → #0a2f32`, teks
  `rgba(255,255,255,.8)`; judul kelompok 0.6875rem weight 700
  `letter-spacing: .08em` UPPERCASE, `rgba(255,255,255,.62)`; item
  padding 10px 12px, radius 10px, gap 12px, ikon 20px; hover
  `rgba(255,255,255,.07)`; aktif `rgba(255,255,255,.11)` + bilah amber
  4px di kiri + ikon amber.

## 5. Pola utama — tabel jadi kartu di HP

Diambil verbatim sebagai pola (bukan salinan mentah file):

```css
@media (max-width: 767.98px) {
  .table-stack thead { /* sembunyikan visual, tetap untuk pembaca layar */ }
  .table-stack, .table-stack tbody, .table-stack tfoot { display: block; width: 100%; }
  .table-stack tr { display: grid; grid-template-columns: repeat(2, minmax(0,1fr));
                    gap: 12px 16px; padding: 14px 16px; border-bottom: 1px solid var(--rg-line); }
  .table-stack td, .table-stack th { display: block; padding: 0; border: 0; }
  .table-stack [data-label]::before { content: attr(data-label); display: block;
                    margin-bottom: 3px; color: var(--rg-muted); font-size: .6875rem;
                    font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
  .table-stack .cell-main { grid-column: 1 / -1; order: -1; }  /* baris judul kartu */
  .table-stack .cell-actions { position: absolute; top: 14px; right: 16px; }
}
```

Markup yang dibutuhkan: `class="table-stack"` di `<table>`,
`data-label="Nama Kolom"` di tiap `<td>`, `class="cell-main"` di sel
judul, `class="cell-actions"` di sel aksi. Varian demo: `.table-ledger`
(grid 3 kolom) dan `.table-grades` — tidak dipakai di sini, pola dasar
2 kolom cukup untuk semua tabel aplikasi.

## 6. Yang TIDAK diambil dari Registrar

- Bootstrap 5.3.8 (demo dibangun di atasnya; aplikasi ini tanpa framework).
- Mode gelap demo (aplikasi ini terang saja; token gelap tidak dipakai).
- Drawer offcanvas mobile (aplikasi memakai nav bawah 5 tab — dipertahankan
  sesuai arahan, dan dibuat gaya iOS mengambang + blur, BUKAN gaya Registrar).
- Foto/aset demo, teks demo (Harbourview Academy), logo crest.
- Chart SVG demo (aplikasi memakai grafik batang sendiri).
- Pola `.table-ledger` / `.table-grades` (tidak diperlukan).

## 7. Pemetaan ke token aplikasi

Token lama (`--blue`, `--blue2`, `--purple`, `--bg`, `--ink`, `--muted`,
`--line`, `--green`, `--amber`, `--red`) dipertahankan namanya supaya
semua pemakaian lama ikut berubah, nilainya dipetakan ke Registrar:

`--blue: #0e5e61`, `--blue2: #0a4b4e`, `--purple: #0d4245`,
`--bg: #f2f5f6`, `--ink: #15222b`, `--muted: #5c6a75`, `--line: #e2e7eb`,
`--green: #17703f`, `--amber: #8a5300`, `--red: #b1261d`.
Token baru: `--ink2, --line2, --faint, --focus, --surface2, --primary-soft,
--accent, --accent-soft, --accent-ink, --good-soft, --good-fill, --warn-soft,
--warn-fill, --bad-soft, --bad-fill, --info, --info-soft, --sb-top, --sb-bottom,
--ring, --shadow-lg, --viz-bar`.

Token `.mk` (mockup v3, dipakai dashboard mobile) dipetakan sama:
`--blue: #0e5e61`, `--blue-dark: #0a4b4e`, `--purple: #0d4245`,
`--lav: #f2f5f6`, `--ink: #15222b`, `--ink2: #3a4853`, `--muted: #5c6a75`,
`--faint: #a3adb5`, `--grad: linear-gradient(135deg, #0e5e61, #0a4b4e 55%, #0d4245)`,
`--green: #17703f`, `--red: #b1261d`, `--red-tint: #fbe5e2`.
Warna pastel kotak ikon menu (inline di `app.js`) dan warna aksen
per-poster tile DIBIARKAN — itu variasi aksen mockup yang sudah disetujui,
dan Registrar sendiri memakai variasi serupa untuk subjek/avatar.
