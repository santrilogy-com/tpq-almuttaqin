import { and, count, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { PERAN, sessions, users } from '../db/schema'
import { hashPassword } from '../lib/crypto'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'
import { sandi, username } from './auth'

export const userRoutes = new Hono<AppEnv>()
userRoutes.use('*', requireAuth, requirePeran('pimpinan'))

const cols = {
  id: users.id,
  username: users.username,
  nama: users.nama,
  peran: users.peran,
  aktif: users.aktif,
  wajibGantiSandi: users.wajibGantiSandi,
}

userRoutes.get('/', async (c) => {
  return c.json({ users: await c.get('db').select(cols).from(users) })
})

userRoutes.post('/', async (c) => {
  const db = c.get('db')
  const parsed = z
    .object({
      username,
      nama: z.string().trim().min(1).max(100),
      peran: z.enum(PERAN),
      sandi,
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }
  const d = parsed.data
  if (await db.select().from(users).where(eq(users.username, d.username)).get()) {
    return c.json({ error: 'ID sudah dipakai' }, 409)
  }
  const [row] = await db
    .insert(users)
    .values({
      username: d.username,
      nama: d.nama,
      peran: d.peran,
      passwordHash: await hashPassword(d.sandi),
      wajibGantiSandi: true,
    })
    .returning(cols)
  return c.json({ user: row }, 201)
})

async function pimpinanAktifLain(
  db: AppEnv['Variables']['db'],
  exceptId: string
) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(
      and(eq(users.peran, 'pimpinan'), eq(users.aktif, true), ne(users.id, exceptId))
    )
  return n
}

userRoutes.patch('/:id', async (c) => {
  const db = c.get('db')
  const me = c.get('user')!
  const id = c.req.param('id')
  const parsed = z
    .object({
      nama: z.string().trim().min(1).max(100).optional(),
      peran: z.enum(PERAN).optional(),
      aktif: z.boolean().optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }
  const target = await db.select().from(users).where(eq(users.id, id)).get()
  if (!target) return c.json({ error: 'Pengguna tidak ditemukan' }, 404)

  const turunPeran = parsed.data.peran && parsed.data.peran !== 'pimpinan'
  const nonaktif = parsed.data.aktif === false
  if (id === me.id && (turunPeran || nonaktif)) {
    return c.json({ error: 'Tidak bisa menurunkan atau menonaktifkan diri sendiri' }, 400)
  }
  if (
    target.peran === 'pimpinan' &&
    (turunPeran || nonaktif) &&
    (await pimpinanAktifLain(db, id)) === 0
  ) {
    return c.json({ error: 'Harus ada minimal satu Pimpinan aktif' }, 400)
  }

  const [row] = await db
    .update(users)
    .set(parsed.data)
    .where(eq(users.id, id))
    .returning(cols)
  if (nonaktif) await db.delete(sessions).where(eq(sessions.userId, id))
  return c.json({ user: row })
})

userRoutes.post('/:id/reset-sandi', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const parsed = z
    .object({ sandi })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }
  const res = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.sandi),
      wajibGantiSandi: true,
      gagalLogin: 0,
      terkunciSampai: null,
    })
    .where(eq(users.id, id))
    .returning({ id: users.id })
  if (res.length === 0) return c.json({ error: 'Pengguna tidak ditemukan' }, 404)
  await db.delete(sessions).where(eq(sessions.userId, id))
  return c.json({ ok: true })
})

userRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const me = c.get('user')!
  const id = c.req.param('id')
  if (id === me.id) return c.json({ error: 'Tidak bisa menghapus diri sendiri' }, 400)
  const target = await db.select().from(users).where(eq(users.id, id)).get()
  if (!target) return c.json({ error: 'Pengguna tidak ditemukan' }, 404)
  if (target.peran === 'pimpinan' && (await pimpinanAktifLain(db, id)) === 0) {
    return c.json({ error: 'Harus ada minimal satu Pimpinan aktif' }, 400)
  }
  await db.delete(users).where(eq(users.id, id))
  return c.json({ ok: true })
})
