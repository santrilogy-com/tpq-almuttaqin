import { and, eq, ne } from 'drizzle-orm'
import { type BatchItem } from 'drizzle-orm/batch'
import { Hono } from 'hono'
import { z } from 'zod'
import { DETAIL_GURU, detailGuruKosong } from '../../shared/biodata'
import { JENJANG, foto, guru, guruDetail } from '../db/schema'
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
  detail: DETAIL_GURU.partial().optional(),
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

// ID Guru (opsional) harus unik bila diisi.
const idGuruSudahAda = async (db: AppEnv['Variables']['db'], idGuru: string, exceptId?: string) => {
  if (!idGuru) return false
  const cond = exceptId
    ? and(eq(guruDetail.idGuru, idGuru), ne(guruDetail.guruId, exceptId))
    : eq(guruDetail.idGuru, idGuru)
  return !!(await db.select({ id: guruDetail.guruId }).from(guruDetail).where(cond).get())
}

const ambilDetail = async (db: AppEnv['Variables']['db'], id: string) => {
  const row = await db.select().from(guruDetail).where(eq(guruDetail.guruId, id)).get()
  if (!row) return detailGuruKosong()
  const { guruId: _id, ...isi } = row
  return isi
}

guruRoutes.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const row = await db.select().from(guru).where(eq(guru.id, id)).get()
  if (!row) return c.json({ error: 'Guru tidak ditemukan' }, 404)
  return c.json({ guru: row, detail: await ambilDetail(db, id) })
})

guruRoutes.post('/', async (c) => {
  const p = await parseBody(c, body)
  if (!p.ok) return p.res
  const { detail, ...utama } = p.data
  const db = c.get('db')
  if (await namaSudahAda(db, utama.nama)) {
    return c.json({ error: 'Nama guru sudah ada' }, 409)
  }
  if (await idGuruSudahAda(db, detail?.idGuru ?? '')) {
    return c.json({ error: 'ID Guru sudah dipakai guru lain' }, 409)
  }
  const id = crypto.randomUUID()
  const [dibuat] = await db.batch([
    db.insert(guru).values({ ...utama, id }).returning(),
    db.insert(guruDetail).values({ guruId: id, ...(detail ?? {}) }),
  ])
  return c.json({ guru: dibuat[0], detail: await ambilDetail(db, id) }, 201)
})

guruRoutes.patch('/:id', async (c) => {
  const p = await parseBody(c, body.partial())
  if (!p.ok) return p.res
  const { detail, ...utama } = p.data
  const db = c.get('db')
  const id = c.req.param('id')
  if (!(await db.select({ id: guru.id }).from(guru).where(eq(guru.id, id)).get())) {
    return c.json({ error: 'Guru tidak ditemukan' }, 404)
  }
  if (utama.nama && (await namaSudahAda(db, utama.nama, id))) {
    return c.json({ error: 'Nama guru sudah ada' }, 409)
  }
  if (detail?.idGuru !== undefined && (await idGuruSudahAda(db, detail.idGuru, id))) {
    return c.json({ error: 'ID Guru sudah dipakai guru lain' }, 409)
  }
  const stmts: BatchItem<'sqlite'>[] = []
  if (Object.keys(utama).length > 0) stmts.push(db.update(guru).set(utama).where(eq(guru.id, id)))
  if (detail && Object.keys(detail).length > 0) {
    stmts.push(db.insert(guruDetail).values({ guruId: id, ...detail }).onConflictDoUpdate({ target: guruDetail.guruId, set: detail }))
  }
  if (stmts.length > 0) await db.batch(stmts as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
  const row = await db.select().from(guru).where(eq(guru.id, id)).get()
  return c.json({ guru: row, detail: await ambilDetail(db, id) })
})

guruRoutes.delete('/:id', async (c) => {
  const res = await c
    .get('db')
    .delete(guru)
    .where(eq(guru.id, c.req.param('id')))
    .returning({ id: guru.id })
  if (res.length === 0) return c.json({ error: 'Guru tidak ditemukan' }, 404)
  // Foto tidak punya FK: hapus bersama pemiliknya.
  await c.get('db').delete(foto).where(and(eq(foto.jenis, 'guru'), eq(foto.ownerId, res[0].id)))
  return c.json({ ok: true })
})



