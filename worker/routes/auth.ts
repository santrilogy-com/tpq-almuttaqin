import { and, count, eq, lt, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { lembaga, sessions, users } from '../db/schema'
import {
  DUMMY_HASH,
  hashPassword,
  randomToken,
  samaAman,
  sha256Hex,
  verifyPassword,
} from '../lib/crypto'
import { COOKIE, requireAuth, type AppEnv } from '../middleware'

const SESSION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_GAGAL = 5
const KUNCI_MS = 60 * 1000

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, 'ID 3-32 karakter: huruf, angka, titik, - atau _')
export const sandi = z.string().min(8, 'Kata sandi minimal 8 karakter').max(128)

async function buatSesi(
  c: Parameters<typeof setCookie>[0],
  db: AppEnv['Variables']['db'],
  userId: string
) {
  const token = randomToken()
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()))
  await db.insert(sessions).values({
    tokenHash: await sha256Hex(token),
    userId,
    expiresAt: Date.now() + SESSION_MS,
  })
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MS / 1000,
  })
}

const publicUser = (u: {
  id: string
  username: string
  nama: string
  peran: string
  wajibGantiSandi: boolean
}) => ({
  id: u.id,
  username: u.username,
  nama: u.nama,
  peran: u.peran,
  wajibGantiSandi: u.wajibGantiSandi,
})

export const authRoutes = new Hono<AppEnv>()

// Aplikasi baru belum punya pengguna: pemilik membuat akun Pimpinan pertama sendiri.
// Tidak ada kata sandi bawaan di mana pun.
// Setup TERKUNCI secara bawaan (fail-closed): tanpa ini, orang pertama yang membuka URL publik yang
// baru dideploy bisa merebut akun Pimpinan. Hanya dua cara membukanya:
//  - produksi: rahasia SETUP_TOKEN diatur pemilik, dan kodenya dikirim di form setup;
//  - lokal: ALLOW_OPEN_SETUP=1 di .dev.vars (tidak pernah ada di produksi).
// Keputusan sengaja TIDAK memakai nama host/header dari permintaan karena bisa dipalsukan.
const setupTerbuka = (env: { ALLOW_OPEN_SETUP?: string }) => env.ALLOW_OPEN_SETUP === '1'

authRoutes.get('/status', async (c) => {
  const db = c.get('db')
  const [{ n }] = await db.select({ n: count() }).from(users)
  return c.json({ needsSetup: n === 0, perluKode: !setupTerbuka(c.env) })
})

authRoutes.post('/setup', async (c) => {
  const db = c.get('db')
  const [{ n }] = await db.select({ n: count() }).from(users)
  if (n > 0) return c.json({ error: 'Aplikasi sudah disiapkan' }, 409)

  const parsed = z
    .object({
      username,
      nama: z.string().trim().min(1).max(100),
      sandi,
      namaTpq: z.string().trim().min(1).max(100).default('TPQ Al-Muttaqin'),
      kodeSetup: z.string().max(200).optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }
  const d = parsed.data

  if (!setupTerbuka(c.env)) {
    const token = c.env.SETUP_TOKEN
    if (!token) {
      return c.json({ error: 'Setup dikunci: pemilik harus mengatur rahasia SETUP_TOKEN di Cloudflare (lihat README).' }, 403)
    }
    if (!samaAman(d.kodeSetup ?? '', token)) return c.json({ error: 'Kode setup salah' }, 403)
  }

  const [user] = await db
    .insert(users)
    .values({
      username: d.username,
      nama: d.nama,
      peran: 'pimpinan',
      passwordHash: await hashPassword(d.sandi),
    })
    .returning()
  await db.insert(lembaga).values([
    { jenjang: 'TPQ', nama: d.namaTpq, namaSingkat: 'TPQ' },
    { jenjang: 'MI', nama: 'Madrasah Ibtidaiyah', namaSingkat: 'MI' },
  ])
  await buatSesi(c, db, user.id)
  return c.json({ user: publicUser(user) }, 201)
})

authRoutes.post('/login', async (c) => {
  const db = c.get('db')
  const parsed = z
    .object({ username: z.string().trim().toLowerCase(), sandi: z.string() })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'ID atau kata sandi salah' }, 401)

  const u = await db
    .select()
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .get()

  if (u?.terkunciSampai && u.terkunciSampai > Date.now()) {
    const detik = Math.ceil((u.terkunciSampai - Date.now()) / 1000)
    return c.json({ error: `Terlalu banyak percobaan. Coba lagi ${detik} detik` }, 429)
  }

  // Selalu hitung hash agar waktu respons tidak membocorkan keberadaan ID.
  const ok = await verifyPassword(parsed.data.sandi, u?.passwordHash ?? DUMMY_HASH)
  if (!u || !u.aktif || !ok) {
    if (u) {
      const gagal = u.gagalLogin + 1
      await db
        .update(users)
        .set(
          gagal >= MAX_GAGAL
            ? { gagalLogin: 0, terkunciSampai: Date.now() + KUNCI_MS }
            : { gagalLogin: gagal }
        )
        .where(eq(users.id, u.id))
    }
    return c.json({ error: 'ID atau kata sandi salah' }, 401)
  }

  await db
    .update(users)
    .set({ gagalLogin: 0, terkunciSampai: null })
    .where(eq(users.id, u.id))
  await buatSesi(c, db, u.id)
  return c.json({ user: publicUser(u) })
})

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, COOKIE)
  if (token) {
    await c
      .get('db')
      .delete(sessions)
      .where(eq(sessions.tokenHash, await sha256Hex(token)))
  }
  deleteCookie(c, COOKIE, { path: '/' })
  return c.json({ ok: true })
})

authRoutes.get('/me', (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Belum masuk' }, 401)
  return c.json({ user: publicUser(user) })
})

authRoutes.post('/ganti-sandi', requireAuth, async (c) => {
  const db = c.get('db')
  const me = c.get('user')!
  const parsed = z
    .object({ sandiLama: z.string(), sandiBaru: sandi })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }
  const { sandiLama, sandiBaru } = parsed.data
  if (sandiLama === sandiBaru) {
    return c.json({ error: 'Kata sandi baru harus berbeda' }, 400)
  }
  const row = await db.select().from(users).where(eq(users.id, me.id)).get()
  if (!row || !(await verifyPassword(sandiLama, row.passwordHash))) {
    return c.json({ error: 'Kata sandi lama salah' }, 400)
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(sandiBaru), wajibGantiSandi: false })
    .where(eq(users.id, me.id))

  // Putuskan semua sesi lain; sesi ini diganti baru.
  const token = getCookie(c, COOKIE)
  const keep = token ? await sha256Hex(token) : ''
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, me.id), ne(sessions.tokenHash, keep)))
  return c.json({ ok: true })
})

