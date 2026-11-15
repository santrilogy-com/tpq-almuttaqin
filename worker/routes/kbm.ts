import { and, eq } from 'drizzle-orm'
import { type BatchItem } from 'drizzle-orm/batch'
import { Hono } from 'hono'
import { z } from 'zod'
import { STATUS_ABSEN, tglValid } from '../../shared/domain'
import { absensiGuru, alokasiWaktu, guru, HARI, jadwalKbm, piket } from '../db/schema'
import { crud } from '../lib/crud'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

const jam = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam harus HH:MM (00:00-23:59)')
const teks = (n = 100) => z.string().trim().max(n)

export const kbmRoutes = new Hono<AppEnv>()
kbmRoutes.use('*', requireAuth)

// Daftar nama guru untuk jadwal/absensi. Sengaja TANPA honor/HP (data itu khusus Pimpinan).
kbmRoutes.get('/guru', async (c) => {
  const rows = await c
    .get('db')
    .select({ id: guru.id, nama: guru.nama, peranGuru: guru.peranGuru, jenjang: guru.jenjang })
    .from(guru)
  return c.json({ guru: rows })
})

// Semua orang yang login boleh melihat; hanya Pimpinan yang mengubah.
kbmRoutes.route(
  '/jadwal',
  crud({
    table: jadwalKbm,
    tulis: ['pimpinan'],
    schema: z.object({
      kelasId: z.string().nullable().optional(),
      hari: z.enum(HARI),
      jamMulai: jam,
      jamSelesai: jam,
      mapel: teks().min(1, 'Mapel wajib diisi'),
      guruId: z.string().nullable().optional(),
    }),
    cek: (d) =>
      d.jamMulai && d.jamSelesai && d.jamSelesai <= d.jamMulai
        ? 'Jam selesai harus setelah jam mulai'
        : null,
  })
)
kbmRoutes.route(
  '/alokasi',
  crud({
    table: alokasiWaktu,
    tulis: ['pimpinan'],
    schema: z.object({
      kelasId: z.string().nullable().optional(),
      mapel: teks().min(1, 'Mapel wajib diisi'),
      jamPerMinggu: z.number().int().min(1, 'Minimal 1 jam').max(60),
      hari: teks(60).optional(),
    }),
  })
)
kbmRoutes.route(
  '/piket',
  crud({
    table: piket,
    tulis: ['pimpinan'],
    schema: z.object({
      guruId: z.string(),
      hari: z.enum(HARI),
      keterangan: teks(200).optional(),
    }),
  })
)

// Absensi guru/pimpinan per tanggal.
kbmRoutes.get('/absensi-guru', async (c) => {
  const tgl = c.req.query('tanggal') ?? ''
  const kelompok = c.req.query('kelompok') === 'Pimpinan' ? 'Pimpinan' : 'Guru'
  if (!tglValid(tgl)) return c.json({ error: 'tanggal tidak valid' }, 400)
  const rows = await c
    .get('db')
    .select({ guruId: absensiGuru.guruId, status: absensiGuru.status })
    .from(absensiGuru)
    .where(and(eq(absensiGuru.tanggal, tgl), eq(absensiGuru.kelompok, kelompok)))
  return c.json({ catatan: rows })
})

kbmRoutes.put('/absensi-guru', requirePeran('pimpinan'), async (c) => {
  const p = await parseBody(
    c,
    z.object({
      tanggal: z.string().refine(tglValid, 'Tanggal tidak valid (YYYY-MM-DD)'),
      kelompok: z.enum(['Guru', 'Pimpinan']),
      catatan: z.array(z.object({ guruId: z.string(), status: z.enum(STATUS_ABSEN) })).max(300),
    })
  )
  if (!p.ok) return p.res
  const db = c.get('db')
  const unik = new Map(p.data.catatan.map((x) => [x.guruId, x.status]))
  const semua = new Set((await db.select({ id: guru.id }).from(guru)).map((g) => g.id))
  if ([...unik.keys()].some((id) => !semua.has(id))) {
    return c.json({ error: 'Ada guru yang tidak dikenal' }, 400)
  }
  const stmts: BatchItem<'sqlite'>[] = [
    db
      .delete(absensiGuru)
      .where(and(eq(absensiGuru.tanggal, p.data.tanggal), eq(absensiGuru.kelompok, p.data.kelompok))),
  ]
  const baris = [...unik].map(([guruId, status]) => ({
    tanggal: p.data.tanggal,
    kelompok: p.data.kelompok,
    guruId,
    status,
  }))
  for (let i = 0; i < baris.length; i += 20) stmts.push(db.insert(absensiGuru).values(baris.slice(i, i + 20)))
  await db.batch(stmts as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
  return c.json({ tersimpan: baris.length })
})

