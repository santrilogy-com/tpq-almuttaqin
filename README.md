# TPQ Al-Muttaqin (v2)

Aplikasi pengelolaan TPQ + Madrasah Ibtidaiyah Al-Muttaqin.
Kode versi lama (v22, localStorage) ada di `legacy/` sebagai acuan porting fitur dan akan dihapus.

## Stack
React + Vite + TypeScript, shadcn/ui + Tailwind (template [shadcn-admin](https://github.com/satnaing/shadcn-admin), MIT),
TanStack Router/Query. Backend Hono di Cloudflare Workers, database Cloudflare D1 + Drizzle ORM.
Frontend dan API dilayani satu Worker (Workers + Assets).

## Jalankan lokal
```
pnpm install
pnpm db:migrate:local   # buat tabel di D1 lokal
pnpm dev                # http://localhost:5173
```
Saat pertama dibuka, aplikasi meminta pembuatan akun Pimpinan. Tidak ada kata sandi bawaan.

## Tes
`node scripts/smoke-api.mjs http://localhost:5173` (butuh DB lokal kosong) menguji auth, peran, dan aturan pengguna.

## Deploy ke Cloudflare
```
npx wrangler login
npx wrangler d1 create tpq-al-muttaqin   # salin database_id ke wrangler.jsonc
pnpm db:migrate:remote
pnpm deploy
```

## Keamanan
Sandi di-hash PBKDF2-SHA256 di server; sesi berupa cookie HttpOnly (token disimpan sebagai hash);
peran dicek di API, bukan hanya di menu; akun terkunci 60 detik setelah 5 kali gagal.
