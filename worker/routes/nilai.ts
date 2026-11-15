import { and, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  JENIS_NILAI,
  nilaiAkhir,
  predikat,
  rata,
  semesterDari,
  tglValid,
} from '../../shared/domain'
import { absensi, kelas, nilai, pertemuan, santri } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, type AppEnv } from '../middleware'

export const nilaiRoutes = new Hono<AppEnv>()
nilaiRoutes.use('*', requireAuth)

nilaiRoutes.get('/', async (c) => {
  const santriId = c.req.query('santriId')
  const jenis = c.req.query('jenis')
  const conds = [
    santriId ? eq(nilai.santriId, santriId) : undefined,
    jenis && (JENIS_NILAI as readonly string[]).includes(jenis)
      ? eq(nilai.jenis, jenis as (typeof JENIS_NILAI)[number])
      : undefined,
  ].filter((x) => x !== undefined)
  const rows = await c
    .get('db')
    .select()
    .from(nilai)
    .where(and(...conds))
    .orderBy(desc(nilai.tanggal))
    .limit(500)
  return c.json({ nilai: rows })
})

// Semester diturunkan otomatis dari tanggal; klien tidak mengirimnya.
nilaiRoutes.post('/', async (c) => {
  const p = await parseBody(
    c,
    z.object({
      santriId: z.string(),
      jenis: z.enum(JENIS_NILAI),
      mapel: z.string().trim().min(1, 'Mapel wajib diisi').max(100),
      nilai: z
        .number('Nilai harus angka')
        .min(0, 'Nilai 0 sampai 100')
        .max(100, 'Nilai 0 sampai 100'),
      tanggal: z.string().refine(tglValid, 'Tanggal tidak valid (YYYY-MM-DD)'),
    })
  )
  if (!p.ok) return p.res
  const db = c.get('db')
  if (!(await db.select({ id: santri.id }).from(santri).where(eq(santri.id, p.data.santriId)).get())) {
    return c.json({ error: 'Santri tidak ditemukan' }, 404)
  }
  const [row] = await db
    .insert(nilai)
    .values({ ...p.data, semester: semesterDari(p.data.tanggal) })
    .returning()
  return c.json({ nilai: row }, 201)
})

nilaiRoutes.delete('/:id', async (c) => {
  const res = await c
    .get('db')
    .delete(nilai)
    .where(eq(nilai.id, c.req.param('id')))
    .returning({ id: nilai.id })
  if (res.length === 0) return c.json({ error: 'Nilai tidak ditemukan' }, 404)
  return c.json({ ok: true })
})

export const raporRoutes = new Hono<AppEnv>()
raporRoutes.use('*', requireAuth)

// Rapor satu santri. ?semester=<label> | semua ; default = semester terbaru yang punya nilai.
raporRoutes.get('/:santriId', async (c) => {
  const db = c.get('db')
  const id = c.req.param('santriId')
  const s = await db.select().from(santri).where(eq(santri.id, id)).get()
  if (!s) return c.json({ error: 'Santri tidak ditemukan' }, 404)

  const daftar = await db
    .select({ semester: nilai.semester, terakhir: sql<string>`max(${nilai.tanggal})` })
    .from(nilai)
    .where(eq(nilai.santriId, id))
    .groupBy(nilai.semester)
    .orderBy(desc(sql`max(${nilai.tanggal})`))
  const daftarSemester = daftar.map((d) => d.semester)
  const q = c.req.query('semester')
  const semester = q === 'semua' ? 'semua' : (q ?? daftarSemester[0] ?? 'semua')

  const rows = await db
    .select({ jenis: nilai.jenis, nilai: nilai.nilai })
    .from(nilai)
    .where(
      semester === 'semua'
        ? eq(nilai.santriId, id)
        : and(eq(nilai.santriId, id), eq(nilai.semester, semester))
    )
  const per = (j: (typeof JENIS_NILAI)[number]) =>
    rata(rows.filter((r) => r.jenis === j).map((r) => r.nilai))
  const komponen = { harian: per('Harian'), imda: per('Imda'), praktek: per('Praktek') }
  const { akhir, lengkap } = nilaiAkhir(komponen)

  // Kehadiran hanya dari pertemuan di KELAS santri saat ini (cegah hitungan lintas kelas).
  let kehadiran: { hadir: number; total: number; persen: number } | null = null
  if (s.kelasId) {
    const [r] = await db
      .select({
        total: sql<number>`count(*)`,
        hadir: sql<number>`coalesce(sum(case when ${absensi.status} = 'H' then 1 else 0 end), 0)`,
      })
      .from(absensi)
      .innerJoin(pertemuan, eq(pertemuan.id, absensi.pertemuanId))
      .where(and(eq(absensi.santriId, id), eq(pertemuan.kelasId, s.kelasId)))
    if (r.total > 0) {
      kehadiran = { hadir: r.hadir, total: r.total, persen: Math.round((r.hadir / r.total) * 100) }
    }
  }
  const k = s.kelasId
    ? await db.select({ nama: kelas.nama }).from(kelas).where(eq(kelas.id, s.kelasId)).get()
    : null

  return c.json({
    santri: { id: s.id, nama: s.nama, nis: s.nis, jilid: s.jilid, kelas: k?.nama ?? null },
    semester,
    daftarSemester,
    ...komponen,
    akhir,
    lengkap,
    predikat: akhir == null ? null : predikat(akhir),
    jumlahNilai: rows.length,
    kehadiran,
  })
})
