# TPQ Al-Muttaqin (v2)

Aplikasi pengelolaan TPQ dan Madrasah Ibtidaiyah Al-Muttaqin: santri, kelas, absensi, penilaian dan rapor,
hafalan Qur'ani, tabungan, keuangan dan SPP, RAPBM, KBM, pengumuman, laporan, foto santri dan ustadz, saklar lembaga (TPQ / Madrasah), navigasi bawah untuk HP, import/export CSV, serta backup.

Menggantikan v22 (aplikasi statis berbasis localStorage). Panduan pengguna: [PANDUAN.md](PANDUAN.md).

## Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React + Vite + TypeScript, shadcn/ui + Tailwind (dari template [shadcn-admin](https://github.com/satnaing/shadcn-admin), MIT), TanStack Router/Query, Recharts |
| Backend | Hono di Cloudflare Workers (satu Worker melayani frontend statis dan API) |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM |
| PWA | manifest + service worker yang hanya menyimpan berkas statis (tidak pernah `/api/*`) |

Logika bisnis murni (nilai akhir, predikat, jilid, parser rupiah/tanggal, CSV, skema backup, konverter v22) ada di
`shared/` dan dipakai bersama oleh Worker dan frontend, dengan tes unit.

## Jalankan lokal

```bash
pnpm install
cp .dev.vars.example .dev.vars   # membuka setup tanpa kode, HANYA untuk lokal
pnpm db:migrate:local            # buat tabel di D1 lokal
pnpm dev                         # http://localhost:5173
```

Saat pertama dibuka, aplikasi meminta pembuatan akun Pimpinan. **Tidak ada kata sandi bawaan.**

## Tes

```bash
pnpm test:unit                          # logika murni (shared/)
pnpm typecheck && pnpm lint
node scripts/smoke-api.mjs http://localhost:5173    # API end-to-end; butuh DB lokal KOSONG + .dev.vars (mode lokal terbuka)
node scripts/smoke-setup-lock.mjs terkunci|token    # uji pengunci setup; lihat komentar di skripnya
```

`smoke-api.mjs` menguji auth, peran, aturan bisnis, backup/restore (roundtrip 19 tabel), dan import CSV. Hasilnya harus 0 gagal.

## Deploy ke Cloudflare

Prasyarat: akun Cloudflare dan `npx wrangler login`.

```bash
npx wrangler d1 create tpq-al-muttaqin     # salin database_id yang tampil ke wrangler.jsonc
pnpm db:migrate:remote                     # buat tabel di D1 produksi

# WAJIB sebelum URL dibuka pertama kali: kode rahasia untuk membuat akun Pimpinan pertama.
npx wrangler secret put SETUP_TOKEN        # ketik/tempel kode panjang acak, simpan di tempat aman
# Jangan memasukkannya lewat pipa PowerShell (`$kode | wrangler secret put`): bisa menyelipkan baris baru.
# Pakai kode tanpa karakter yang membingungkan (I/l/O/0). Server mengabaikan spasi di awal/akhir kode.

pnpm deploy                                # build + wrangler deploy
```

Buka URL hasil deploy, isi form setup (termasuk **Kode setup** = nilai `SETUP_TOKEN`), lalu masuk. Setelah akun
Pimpinan terbentuk, kode itu tidak dipakai lagi (setup hanya bisa sekali).

**Setup terkunci secara bawaan.** Tanpa `SETUP_TOKEN` di server, setup selalu ditolak. Ini mencegah orang lain
membuat akun Pimpinan di URL yang baru dideploy. `ALLOW_OPEN_SETUP` hanya untuk `.dev.vars` lokal; jangan pernah
mengaturnya di produksi.

Domain sendiri: Cloudflare dashboard > Workers & Pages > `tpq-al-muttaqin` > Settings > Domains & Routes.

### Pindah dari v22

1. Di aplikasi lama: Pengaturan > Cadangkan semua data (JSON).
2. Di v2 (sebagai Pimpinan): **Data dan Backup** > pilih file itu > baca pratinjau dan peringatan > ketik `PULIHKAN`.

Yang dipetakan: santri, guru, kelas, nilai, absensi, hafalan, tabungan (saldo v22 dipertahankan), kas, SPP bulan berjalan,
RAPBM, biaya, target, KBM, pengumuman, identitas dan logo, serta foto santri/guru (PNG/JPEG/WebP maks 150 KB; yang lebih besar dilewati dengan peringatan). Istilah "Iqra" diganti "Qur'ani" (nama kelas, jilid, jenis setoran, mapel). Yang **tidak** ikut: akun login (sandi v22 tidak kompatibel,
buat ulang di Kelola pengguna) dan antrean sinkron Google Sheet. Konverter diuji dengan data contoh v22 yang asli.

## Keamanan

- Sandi di-hash PBKDF2-SHA256 + salt acak di server; sesi berupa cookie `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS);
  token sesi hanya disimpan sebagai hash di database.
- Peran (Pimpinan/Guru) dicek di API, bukan hanya di menu. Keuangan, tabungan, anggaran, guru, import, dan backup hanya Pimpinan.
- Akun terkunci 60 detik setelah 5 kali gagal login. Pesan galat login sama untuk ID tak dikenal dan sandi salah.
- Backup tidak memuat akun, sandi, atau sesi. Restore diperiksa penuh (skema + relasi + saldo) sebelum menyentuh database
  dan berjalan atomik.
- Ekspor CSV menetralkan "CSV injection". Logo dan foto hanya PNG/JPEG/WebP (SVG ditolak), diperiksa tipe, ukuran, dan byte awal berkas; disajikan hanya untuk yang sudah login dengan cache privat.
- Header: CSP ketat (tanpa skrip/font pihak ketiga), `X-Frame-Options: DENY`, `nosniff`, `Cache-Control: no-store` untuk API.

Keterbatasan yang perlu diketahui:

- **Iterasi PBKDF2 = 100.000**, batas maksimum Workers. Itu di bawah rekomendasi OWASP saat ini (600.000), jadi sandi
  harus panjang. Pertimbangkan Argon2/scrypt (WASM) bila kelak dibutuhkan.
- Penguncian akun bersifat per akun, bukan per IP. Untuk perlindungan brute-force tingkat jaringan, tambahkan aturan
  Rate Limiting di Cloudflare untuk `/api/auth/login`.
- Aplikasi **online-first**: data ada di server. Service worker hanya membuat aplikasi terbuka saat sinyal buruk;
  perubahan tidak bisa disimpan saat offline (ada pita peringatan). Ini berbeda dari v22 yang menyimpan semua di perangkat.
- Satu lembaga (TPQ dan Ibtidaiyah) per deployment. Satu guru = satu jenjang.
- Periksa batas D1/Workers pada paket Cloudflare Anda (ukuran database, jumlah query per permintaan) di dokumentasi Cloudflare
  sebelum memuat data sangat besar; import dan restore sudah dirancang memakai sedikit query.

## Struktur

```
shared/    logika murni + skema backup + konverter v22 (dites dengan vitest)
worker/    API Hono, skema Drizzle (worker/db/schema.ts), middleware, rute
src/       frontend React (features/, components/, routes/ berbasis berkas TanStack Router)
migrations/ migrasi SQL D1 (drizzle-kit)
scripts/   smoke test API
public/    manifest, service worker, ikon, _headers (CSP)
```

Ubah skema: edit `worker/db/schema.ts` > `pnpm db:generate` > `pnpm db:migrate:local`.



## Biaya (perkiraan)

Perhitungan memakai tarif resmi Cloudflare ([Workers](https://developers.cloudflare.com/workers/platform/pricing/),
[D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/); dicek 17 Nov 2026,
tarif bisa berubah) dan asumsi: sekitar 300 santri, 30 ustadz, 15 pengguna aktif.

| Komponen | Batas gratis | Pemakaian perkiraan | Biaya |
|---|---|---|---|
| Workers (API) | 100.000 permintaan/hari, **10 ms CPU per permintaan** | beberapa ribu/hari | Rp 0 |
| File statis (tampilan) | tak terbatas dan gratis | semua | Rp 0 |
| D1 baca/tulis | 5 juta baca/hari, 100.000 tulis/hari | puluhan ribu baca/hari | Rp 0 |
| D1 penyimpanan (termasuk foto) | 5 GB | sekitar 10 MB foto + data | Rp 0 |

Jadi pada skala TPQ biasa, **biaya perkiraan Rp 0 per bulan** di paket gratis. Bila perlu paket berbayar:
**Workers Paid US$5 per bulan** (sekitar Rp 80.000 pada kurs kasar), yang memuat 10 juta permintaan, 30 juta ms CPU, dan
D1 25 miliar baca / 50 juta tulis / 5 GB.

Hal yang perlu dipantau:

- **Batas CPU 10 ms per permintaan di paket gratis.** Login memakai hash PBKDF2 yang cukup berat; pembuatan akun pertama berhasil
  di produksi, tetapi bila kelak ada galat saat masuk, ini penyebab pertama yang perlu dicurigai, dan pindah ke paket US$5 menyelesaikannya.
- **Foto** disimpan di D1 (tabel `foto`), bukan R2: 330 foto x sekitar 30 KB = sekitar 10 MB, jauh di bawah 5 GB. Bila kelak butuh
  foto resolusi tinggi atau puluhan ribu berkas, pindahkan ke R2 (10 GB gratis, lalu US$0,015 per GB-bulan, tanpa biaya keluar data).
- **Baca D1**: Beranda hanya memindai absensi 60 hari terakhir dan di-cache 2 menit di sisi klien supaya tidak menghabiskan kuota baca.
- **Domain sendiri** (opsional) dibayar ke registrar, bukan ke Cloudflare Workers.
