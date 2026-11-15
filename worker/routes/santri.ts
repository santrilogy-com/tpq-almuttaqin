import { and, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { naikJilid } from '../../shared/domain'
import { JENJANG, santri } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const santriRoutes = new Hono<AppEnv>()
santriRoutes.use('*', requireAuth)

const teks = (max = 200) => z.string().trim().max(max)
const body = z.object({
  nis: teks(30).min(1, 'NIS wajib diisi'),
  nama: teks(100).min(1, 'Nama wajib diisi'),
  jenisKelamin: z.enum(['L', 'P']),
  jenjang: z.enum(JENJANG),
  kelasId: z.string().nullable().optional(),
  jilid: teks(30).optional(),
  angkatan: teks(20).optional(),
  rombel: teks(30).optional(),
  status: z.enum(['aktif', 'keluar', 'lulus']).optional(),
  wali: teks(100).optional(),
  hpWali: teks(30).optional(),
  alamat: teks(300).optional(),
})

const nisSudahAda = async (
  db: AppEnv['Variables']['db'],
  nis: string,
  exceptId?: string
) => {
  const cond = exceptId
    ? and(eq(santri.nis, nis), ne(santri.id, exceptId))
    : eq(santri.nis, nis)
  return !!(await db.select({ id: santri.id }).from(santri).where(cond).get())
}

santriRoutes.get('/', async (c) => {
  const jenjang = c.req.query('jenjang')
  const q = jenjang && (JENJANG as readonly string[]).includes(jenjang)
    ? eq(santri.jenjang, jenjang as (typeof JENJANG)[number])
    : undefined
  return c.json({ santri: await c.get('db').select().from(santri).where(q) })
})

// Guru boleh menambah dan mengubah santri; hanya Pimpinan yang boleh menghapus.
santriRoutes.post('/', async (c) => {
  const p = await parseBody(c, body)
  if (!p.ok) return p.res
  const db = c.get('db')
  if (await nisSudahAda(db, p.data.nis)) {
    return c.json({ error: 'NIS sudah dipakai santri lain' }, 409)
  }
  const [row] = await db.insert(santri).values(p.data).returning()
  return c.json({ santri: row }, 201)
})

santriRoutes.patch('/:id', async (c) => {
  const p = await parseBody(c, body.partial())
  if (!p.ok) return p.res
  const db = c.get('db')
  const id = c.req.param('id')
  if (p.data.nis && (await nisSudahAda(db, p.data.nis, id))) {
    return c.json({ error: 'NIS sudah dipakai santri lain' }, 409)
  }
  const [row] = await db.update(santri).set(p.data).where(eq(santri.id, id)).returning()
  if (!row) return c.json({ error: 'Santri tidak ditemukan' }, 404)
  return c.json({ santri: row })
})

// Naik jilid wajib menyebut jilid asal. Bila data sudah berubah (mis. ketukan ganda
// atau guru lain sudah menaikkan), ditolak 409 sehingga tidak naik dua tingkat.
santriRoutes.post('/:id/naik-jilid', async (c) => {
  const p = await parseBody(c, z.object({ dari: z.string() }))
  if (!p.ok) return p.res
  const db = c.get('db')
  const id = c.req.param('id')
  const s = await db.select().from(santri).where(eq(santri.id, id)).get()
  if (!s) return c.json({ error: 'Santri tidak ditemukan' }, 404)
  if (s.jilid !== p.data.dari) {
    return c.json({ error: `Jilid sudah berubah menjadi ${s.jilid}. Muat ulang.` }, 409)
  }
  const baru = naikJilid(s.jilid)
  if (baru === s.jilid) return c.json({ error: 'Sudah di jilid tertinggi' }, 400)
  const [row] = await db
    .update(santri)
    .set({ jilid: baru })
    .where(and(eq(santri.id, id), eq(santri.jilid, p.data.dari)))
    .returning()
  if (!row) return c.json({ error: 'Jilid baru saja berubah. Muat ulang.' }, 409)
  return c.json({ santri: row })
})

santriRoutes.delete('/:id', requirePeran('pimpinan'), async (c) => {
  const res = await c
    .get('db')
    .delete(santri)
    .where(eq(santri.id, c.req.param('id')))
    .returning({ id: santri.id })
  if (res.length === 0) return c.json({ error: 'Santri tidak ditemukan' }, 404)
  return c.json({ ok: true })
})

