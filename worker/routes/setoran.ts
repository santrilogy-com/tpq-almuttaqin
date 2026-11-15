import { desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { tglValid } from '../../shared/domain'
import { santri, setoran } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const setoranRoutes = new Hono<AppEnv>()
setoranRoutes.use('*', requireAuth)

// Ringkasan progres semua santri: jumlah setoran + setoran terakhir.
setoranRoutes.get('/progres', async (c) => {
  const db = c.get('db')
  const rows = await db
    .select({
      santriId: setoran.santriId,
      jumlah: sql<number>`count(*)`,
      terakhir: sql<string>`max(${setoran.tanggal})`,
    })
    .from(setoran)
    .groupBy(setoran.santriId)
  return c.json({ progres: rows })
})

setoranRoutes.get('/', async (c) => {
  const santriId = c.req.query('santriId')
  const q = c.get('db').select().from(setoran)
  const rows = await (santriId ? q.where(eq(setoran.santriId, santriId)) : q)
    .orderBy(desc(setoran.tanggal), desc(setoran.id))
    .limit(300)
  return c.json({ setoran: rows })
})

setoranRoutes.post('/', async (c) => {
  const p = await parseBody(
    c,
    z.object({
      santriId: z.string(),
      jenis: z.enum(['Iqra', 'Hafalan']),
      materi: z.string().trim().min(1, 'Materi wajib diisi').max(200),
      nilai: z.enum(['Lancar', 'Cukup', 'Perlu Bimbingan']),
      tanggal: z.string().refine(tglValid, 'Tanggal tidak valid (YYYY-MM-DD)'),
    })
  )
  if (!p.ok) return p.res
  const db = c.get('db')
  if (!(await db.select({ id: santri.id }).from(santri).where(eq(santri.id, p.data.santriId)).get())) {
    return c.json({ error: 'Santri tidak ditemukan' }, 404)
  }
  const [row] = await db.insert(setoran).values(p.data).returning()
  return c.json({ setoran: row }, 201)
})

setoranRoutes.delete('/:id', requirePeran('pimpinan'), async (c) => {
  const res = await c
    .get('db')
    .delete(setoran)
    .where(eq(setoran.id, c.req.param('id')))
    .returning({ id: setoran.id })
  if (res.length === 0) return c.json({ error: 'Setoran tidak ditemukan' }, 404)
  return c.json({ ok: true })
})
