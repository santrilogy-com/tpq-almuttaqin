import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { pengumuman } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const pengumumanRoutes = new Hono<AppEnv>()
pengumumanRoutes.use('*', requireAuth)

const body = z.object({
  judul: z.string().trim().min(1, 'Judul wajib diisi').max(150),
  isi: z.string().trim().min(1, 'Isi wajib diisi').max(2000),
  tampil: z.boolean().optional(),
})

// Pimpinan melihat semua (termasuk yang ditutup); yang lain hanya yang ditampilkan.
pengumumanRoutes.get('/', async (c) => {
  const pimpinan = c.get('user')!.peran === 'pimpinan'
  const q = c.get('db').select().from(pengumuman)
  const rows = await (pimpinan ? q : q.where(eq(pengumuman.tampil, true))).orderBy(desc(pengumuman.createdAt))
  return c.json({ pengumuman: rows })
})

pengumumanRoutes.post('/', requirePeran('pimpinan'), async (c) => {
  const p = await parseBody(c, body)
  if (!p.ok) return p.res
  const [row] = await c.get('db').insert(pengumuman).values(p.data).returning()
  return c.json({ pengumuman: row }, 201)
})

pengumumanRoutes.patch('/:id', requirePeran('pimpinan'), async (c) => {
  const p = await parseBody(c, body.partial())
  if (!p.ok) return p.res
  if (Object.keys(p.data).length === 0) return c.json({ error: 'Tidak ada yang diubah' }, 400)
  const [row] = await c.get('db').update(pengumuman).set(p.data).where(eq(pengumuman.id, c.req.param('id'))).returning()
  if (!row) return c.json({ error: 'Pengumuman tidak ditemukan' }, 404)
  return c.json({ pengumuman: row })
})

pengumumanRoutes.delete('/:id', requirePeran('pimpinan'), async (c) => {
  const res = await c.get('db').delete(pengumuman).where(eq(pengumuman.id, c.req.param('id'))).returning({ id: pengumuman.id })
  if (res.length === 0) return c.json({ error: 'Pengumuman tidak ditemukan' }, 404)
  return c.json({ ok: true })
})
