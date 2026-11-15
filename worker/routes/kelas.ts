import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { JENJANG, kelas } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const kelasRoutes = new Hono<AppEnv>()
kelasRoutes.use('*', requireAuth)

const teks = (max = 100) => z.string().trim().max(max)
const body = z.object({
  nama: teks().min(1, 'Nama kelas wajib diisi'),
  jenjang: z.enum(JENJANG),
  pengajar: teks().optional(),
  jadwal: teks().optional(),
  ruang: teks().optional(),
})

kelasRoutes.get('/', async (c) => {
  return c.json({ kelas: await c.get('db').select().from(kelas) })
})

kelasRoutes.post('/', requirePeran('pimpinan'), async (c) => {
  const p = await parseBody(c, body)
  if (!p.ok) return p.res
  const [row] = await c.get('db').insert(kelas).values(p.data).returning()
  return c.json({ kelas: row }, 201)
})

kelasRoutes.patch('/:id', requirePeran('pimpinan'), async (c) => {
  const p = await parseBody(c, body.partial())
  if (!p.ok) return p.res
  const [row] = await c
    .get('db')
    .update(kelas)
    .set(p.data)
    .where(eq(kelas.id, c.req.param('id')))
    .returning()
  if (!row) return c.json({ error: 'Kelas tidak ditemukan' }, 404)
  return c.json({ kelas: row })
})

// Santri/guru di kelas ini tidak ikut terhapus; kelasId mereka menjadi kosong (set null).
kelasRoutes.delete('/:id', requirePeran('pimpinan'), async (c) => {
  const res = await c
    .get('db')
    .delete(kelas)
    .where(eq(kelas.id, c.req.param('id')))
    .returning({ id: kelas.id })
  if (res.length === 0) return c.json({ error: 'Kelas tidak ditemukan' }, 404)
  return c.json({ ok: true })
})

