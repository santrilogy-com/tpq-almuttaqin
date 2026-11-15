import { and, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { JENJANG, guru } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const guruRoutes = new Hono<AppEnv>()
guruRoutes.use('*', requireAuth, requirePeran('pimpinan'))

const teks = (max = 100) => z.string().trim().max(max)
const body = z.object({
  nama: teks().min(1, 'Nama wajib diisi'),
  peranGuru: z.enum(['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru']).optional(),
  kelasId: z.string().nullable().optional(),
  jenjang: z.enum(JENJANG),
  hp: teks(30).optional(),
  honor: z.number().int().min(0, 'Honor tidak boleh negatif').optional(),
  honorLunas: z.boolean().optional(),
})

const namaSudahAda = async (
  db: AppEnv['Variables']['db'],
  nama: string,
  exceptId?: string
) => {
  const cond = exceptId
    ? and(eq(guru.nama, nama), ne(guru.id, exceptId))
    : eq(guru.nama, nama)
  return !!(await db.select({ id: guru.id }).from(guru).where(cond).get())
}

guruRoutes.get('/', async (c) => {
  return c.json({ guru: await c.get('db').select().from(guru) })
})

guruRoutes.post('/', async (c) => {
  const p = await parseBody(c, body)
  if (!p.ok) return p.res
  const db = c.get('db')
  if (await namaSudahAda(db, p.data.nama)) {
    return c.json({ error: 'Nama guru sudah ada' }, 409)
  }
  const [row] = await db.insert(guru).values(p.data).returning()
  return c.json({ guru: row }, 201)
})

guruRoutes.patch('/:id', async (c) => {
  const p = await parseBody(c, body.partial())
  if (!p.ok) return p.res
  const db = c.get('db')
  const id = c.req.param('id')
  if (p.data.nama && (await namaSudahAda(db, p.data.nama, id))) {
    return c.json({ error: 'Nama guru sudah ada' }, 409)
  }
  const [row] = await db.update(guru).set(p.data).where(eq(guru.id, id)).returning()
  if (!row) return c.json({ error: 'Guru tidak ditemukan' }, 404)
  return c.json({ guru: row })
})

guruRoutes.delete('/:id', async (c) => {
  const res = await c
    .get('db')
    .delete(guru)
    .where(eq(guru.id, c.req.param('id')))
    .returning({ id: guru.id })
  if (res.length === 0) return c.json({ error: 'Guru tidak ditemukan' }, 404)
  return c.json({ ok: true })
})

