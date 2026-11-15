import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { JENJANG } from '../../shared/domain'
import { lembaga } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const lembagaRoutes = new Hono<AppEnv>()
lembagaRoutes.use('*', requireAuth)

lembagaRoutes.get('/', async (c) => {
  return c.json({ lembaga: await c.get('db').select().from(lembaga) })
})

const teks = (max = 200) => z.string().trim().max(max)
const body = z.object({
  nama: teks(100).min(1, 'Nama lembaga wajib diisi'),
  namaSingkat: teks(20).min(1, 'Nama singkat wajib diisi'),
  pimpinan: teks(100),
  alamat: teks(300),
  telepon: teks(30),
  tahunBerdiri: z.number().int().min(1800).max(2200).nullable(),
  nsmNpsn: teks(30),
  motto: teks(200),
  tarifSpp: z.number().int().min(0).max(100_000_000),
  tahunAjaran: teks(20),
})

lembagaRoutes.patch('/:jenjang', requirePeran('pimpinan'), async (c) => {
  const jenjang = c.req.param('jenjang')
  if (!(JENJANG as readonly string[]).includes(jenjang)) {
    return c.json({ error: 'Jenjang tidak dikenal' }, 404)
  }
  const p = await parseBody(c, body.partial())
  if (!p.ok) return p.res
  const [row] = await c
    .get('db')
    .update(lembaga)
    .set(p.data)
    .where(eq(lembaga.jenjang, jenjang as (typeof JENJANG)[number]))
    .returning()
  if (!row) return c.json({ error: 'Lembaga tidak ditemukan' }, 404)
  return c.json({ lembaga: row })
})
