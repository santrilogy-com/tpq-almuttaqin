import { and, eq, gt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { sessions, users, type Peran } from './db/schema'
import { sha256Hex } from './lib/crypto'

// SETUP_TOKEN: rahasia produksi untuk membuat Pimpinan pertama.
// ALLOW_OPEN_SETUP=1: HANYA di .dev.vars lokal; tidak pernah diatur di produksi.
export type Env = { DB: D1Database; SETUP_TOKEN?: string; ALLOW_OPEN_SETUP?: string }
export type SessionUser = {
  id: string
  username: string
  nama: string
  peran: Peran
  wajibGantiSandi: boolean
}
export type AppEnv = {
  Bindings: Env
  Variables: { db: ReturnType<typeof makeDb>; user: SessionUser | null }
}

export const makeDb = (d1: D1Database) => drizzle(d1)
export const COOKIE = 'sid'

// Menolak request tulis lintas-origin (pertahanan CSRF tambahan di atas SameSite=Lax).
export const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('origin')
    if (origin && origin !== new URL(c.req.url).origin) {
      return c.json({ error: 'Origin tidak diizinkan' }, 403)
    }
  }
  await next()
})

export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  const db = makeDb(c.env.DB)
  c.set('db', db)
  c.set('user', null)
  const token = getCookie(c, COOKIE)
  if (token) {
    const row = await db
      .select({
        id: users.id,
        username: users.username,
        nama: users.nama,
        peran: users.peran,
        wajibGantiSandi: users.wajibGantiSandi,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, await sha256Hex(token)),
          gt(sessions.expiresAt, Date.now()),
          eq(users.aktif, true)
        )
      )
      .get()
    if (row) c.set('user', row)
  }
  await next()
})

// Wajib login. Selama sandi belum diganti, hanya endpoint ganti-sandi/me/logout yang terbuka.
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Belum masuk' }, 401)
  if (user.wajibGantiSandi && !c.req.path.startsWith('/api/auth/')) {
    return c.json({ error: 'Ganti kata sandi dulu' }, 403)
  }
  await next()
})

export const requirePeran = (...allowed: Peran[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user || !allowed.includes(user.peran)) {
      return c.json({ error: 'Tidak ada akses' }, 403)
    }
    await next()
  })


