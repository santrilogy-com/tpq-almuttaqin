import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { JENJANG, MAKS_JUMLAH } from '../../shared/domain'
import { biaya, rapbm, targetTabungan, transaksi } from '../db/schema'
import { crud } from '../lib/crud'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

const rupiah = (pesan: string) =>
  z.number(pesan).int('Harus bilangan bulat rupiah').min(0, 'Tidak boleh negatif').max(MAKS_JUMLAH, 'Terlalu besar')

// Seluruh anggaran hanya untuk Pimpinan (baca dan tulis).
export const anggaranRoutes = new Hono<AppEnv>()
anggaranRoutes.use('*', requireAuth, requirePeran('pimpinan'))

anggaranRoutes.route(
  '/pos',
  crud({
    table: rapbm,
    tulis: ['pimpinan'],
    schema: z.object({
      pos: z.string().trim().min(1, 'Nama pos wajib diisi').max(100),
      jenis: z.enum(['masuk', 'keluar']),
      jenjang: z.enum(JENJANG),
      rencana: rupiah('Rencana harus angka'),
    }),
  })
)
anggaranRoutes.route(
  '/biaya',
  crud({
    table: biaya,
    tulis: ['pimpinan'],
    schema: z.object({
      nama: z.string().trim().min(1, 'Nama biaya wajib diisi').max(100),
      jumlah: rupiah('Jumlah harus angka'),
      keterangan: z.string().trim().max(200).optional(),
    }),
  })
)
anggaranRoutes.route(
  '/target',
  crud({
    table: targetTabungan,
    tulis: ['pimpinan'],
    schema: z.object({
      nama: z.string().trim().min(1, 'Nama target wajib diisi').max(100),
      target: rupiah('Target harus angka').refine((n) => n > 0, 'Target harus lebih dari 0'),
      terkumpul: rupiah('Terkumpul harus angka').optional(),
    }),
  })
)

// Rencana vs realisasi per pos. Realisasi = total transaksi dengan kategori = nama pos,
// jenis sama, dan jenjang sama (v22 mencampur masuk dan keluar menjadi satu angka bersih).
anggaranRoutes.get('/realita', async (c) => {
  const db = c.get('db')
  const pos = await db.select().from(rapbm)
  const real = await db
    .select({
      kategori: transaksi.kategori,
      jenis: transaksi.jenis,
      jenjang: transaksi.jenjang,
      total: sql<number>`sum(${transaksi.jumlah})`,
    })
    .from(transaksi)
    .groupBy(transaksi.kategori, transaksi.jenis, transaksi.jenjang)
  const hasil = pos.map((p) => {
    const realisasi =
      real.find((r) => r.kategori === p.pos && r.jenis === p.jenis && r.jenjang === p.jenjang)?.total ?? 0
    return { ...p, realisasi, selisih: realisasi - p.rencana }
  })
  return c.json({ realita: hasil })
})

// Arus kas per bulan untuk satu tahun (12 bulan, bulan kosong = 0).
anggaranRoutes.get('/arus-kas', async (c) => {
  const tahun = c.req.query('tahun') ?? ''
  if (!/^\d{4}$/.test(tahun)) return c.json({ error: 'tahun harus YYYY' }, 400)
  const rows = await c
    .get('db')
    .select({
      bulan: sql<string>`substr(${transaksi.tanggal}, 1, 7)`,
      masuk: sql<number>`coalesce(sum(case when ${transaksi.jenis} = 'masuk' then ${transaksi.jumlah} end), 0)`,
      keluar: sql<number>`coalesce(sum(case when ${transaksi.jenis} = 'keluar' then ${transaksi.jumlah} end), 0)`,
    })
    .from(transaksi)
    .where(sql`substr(${transaksi.tanggal}, 1, 4) = ${tahun}`)
    .groupBy(sql`substr(${transaksi.tanggal}, 1, 7)`)
  const bulan = Array.from({ length: 12 }, (_, i) => {
    const b = `${tahun}-${String(i + 1).padStart(2, '0')}`
    const r = rows.find((x) => x.bulan === b)
    const masuk = r?.masuk ?? 0
    const keluar = r?.keluar ?? 0
    return { bulan: b, masuk, keluar, bersih: masuk - keluar }
  })
  return c.json({ arusKas: bulan })
})
