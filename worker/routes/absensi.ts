import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { type BatchItem } from 'drizzle-orm/batch'
import { Hono } from 'hono'
import { z } from 'zod'
import { STATUS_ABSEN, tglValid } from '../../shared/domain'
import { absensi, kelas, pertemuan, santri } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const absensiRoutes = new Hono<AppEnv>()
absensiRoutes.use('*', requireAuth)

const tanggal = z.string().refine(tglValid, 'Tanggal tidak valid (YYYY-MM-DD)')

// Riwayat pertemuan satu kelas + ringkasan H/I/S/A tiap pertemuan.
absensiRoutes.get('/pertemuan', async (c) => {
  const db = c.get('db')
  const kelasId = c.req.query('kelasId')
  if (!kelasId) return c.json({ error: 'kelasId wajib' }, 400)
  const rows = await db
    .select()
    .from(pertemuan)
    .where(eq(pertemuan.kelasId, kelasId))
    .orderBy(desc(pertemuan.tanggal))
    .limit(60)
  if (rows.length === 0) return c.json({ pertemuan: [] })
  const ringkas = await db
    .select({
      pertemuanId: absensi.pertemuanId,
      status: absensi.status,
      n: sql<number>`count(*)`,
    })
    .from(absensi)
    .where(inArray(absensi.pertemuanId, rows.map((r) => r.id)))
    .groupBy(absensi.pertemuanId, absensi.status)
  return c.json({
    pertemuan: rows.map((r) => {
      const ring = { H: 0, I: 0, S: 0, A: 0 }
      for (const x of ringkas) if (x.pertemuanId === r.id) ring[x.status] = x.n
      return { ...r, ringkasan: ring }
    }),
  })
})

// Detail satu pertemuan (kelas + tanggal); null bila belum pernah disimpan.
absensiRoutes.get('/detail', async (c) => {
  const db = c.get('db')
  const kelasId = c.req.query('kelasId')
  const tgl = c.req.query('tanggal') ?? ''
  if (!kelasId || !tglValid(tgl)) return c.json({ error: 'kelasId/tanggal tidak valid' }, 400)
  const p = await db
    .select()
    .from(pertemuan)
    .where(and(eq(pertemuan.kelasId, kelasId), eq(pertemuan.tanggal, tgl)))
    .get()
  if (!p) return c.json({ pertemuan: null, catatan: [] })
  const catatan = await db
    .select({ santriId: absensi.santriId, status: absensi.status })
    .from(absensi)
    .where(eq(absensi.pertemuanId, p.id))
  return c.json({ pertemuan: p, catatan })
})

const CHUNK = 30 // D1: maks ~100 parameter per statement; absensi 3 kolom

// Simpan (buat/timpa) pertemuan sekaligus absensinya, atomik dalam satu batch.
absensiRoutes.put('/pertemuan', async (c) => {
  const p = await parseBody(
    c,
    z.object({
      kelasId: z.string(),
      tanggal,
      materi: z.string().trim().max(200).optional(),
      catatan: z
        .array(z.object({ santriId: z.string(), status: z.enum(STATUS_ABSEN) }))
        .max(500),
    })
  )
  if (!p.ok) return p.res
  const { kelasId, tanggal: tgl, materi = '' } = p.data
  const db = c.get('db')

  if (!(await db.select({ id: kelas.id }).from(kelas).where(eq(kelas.id, kelasId)).get())) {
    return c.json({ error: 'Kelas tidak ditemukan' }, 404)
  }
  // Dedupe (yang terakhir menang) lalu pastikan semua santri anggota kelas ini.
  const unik = new Map(p.data.catatan.map((x) => [x.santriId, x.status]))
  const ids = [...unik.keys()]
  if (ids.length > 0) {
    const anggota = await db
      .select({ id: santri.id })
      .from(santri)
      .where(and(eq(santri.kelasId, kelasId), inArray(santri.id, ids)))
    if (anggota.length !== ids.length) {
      return c.json({ error: 'Ada santri yang bukan anggota kelas ini' }, 400)
    }
  }

  let pert = await db
    .select()
    .from(pertemuan)
    .where(and(eq(pertemuan.kelasId, kelasId), eq(pertemuan.tanggal, tgl)))
    .get()
  const pid = pert?.id ?? crypto.randomUUID()
  const stmts: BatchItem<'sqlite'>[] = [
    pert
      ? db.update(pertemuan).set({ materi }).where(eq(pertemuan.id, pid))
      : db.insert(pertemuan).values({ id: pid, kelasId, tanggal: tgl, materi }),
    db.delete(absensi).where(eq(absensi.pertemuanId, pid)),
  ]
  const baris = [...unik].map(([santriId, status]) => ({
    pertemuanId: pid,
    santriId,
    status,
  }))
  for (let i = 0; i < baris.length; i += CHUNK) {
    stmts.push(db.insert(absensi).values(baris.slice(i, i + CHUNK)))
  }
  await db.batch(stmts as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
  pert = await db.select().from(pertemuan).where(eq(pertemuan.id, pid)).get()
  return c.json({ pertemuan: pert, tersimpan: baris.length })
})

// Hanya Pimpinan: menghapus pertemuan menghilangkan seluruh absensinya.
absensiRoutes.delete('/pertemuan/:id', requirePeran('pimpinan'), async (c) => {
  const res = await c
    .get('db')
    .delete(pertemuan)
    .where(eq(pertemuan.id, c.req.param('id')))
    .returning({ id: pertemuan.id })
  if (res.length === 0) return c.json({ error: 'Pertemuan tidak ditemukan' }, 404)
  return c.json({ ok: true })
})


