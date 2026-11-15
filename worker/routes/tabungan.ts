import { desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  BATAS_TARIK_KONFIRMASI,
  MAKS_JUMLAH,
  hariIniWib,
  tglValid,
} from '../../shared/domain'
import { santri, tabungan } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const tabunganRoutes = new Hono<AppEnv>()
tabunganRoutes.use('*', requireAuth, requirePeran('pimpinan'))

const saldoExpr = sql<number>`coalesce(sum(case when ${tabungan.jenis} = 'setor' then ${tabungan.jumlah} else -${tabungan.jumlah} end), 0)`

// Saldo semua santri yang punya transaksi.
tabunganRoutes.get('/saldo', async (c) => {
  const rows = await c
    .get('db')
    .select({ santriId: tabungan.santriId, saldo: saldoExpr })
    .from(tabungan)
    .groupBy(tabungan.santriId)
  return c.json({ saldo: rows })
})

tabunganRoutes.get('/', async (c) => {
  const db = c.get('db')
  const santriId = c.req.query('santriId')
  if (!santriId) return c.json({ error: 'santriId wajib' }, 400)
  const rows = await db
    .select()
    .from(tabungan)
    .where(eq(tabungan.santriId, santriId))
    .orderBy(desc(tabungan.tanggal), desc(tabungan.id))
  const [r] = await db
    .select({ saldo: saldoExpr })
    .from(tabungan)
    .where(eq(tabungan.santriId, santriId))
  return c.json({ transaksi: rows, saldo: r.saldo })
})

tabunganRoutes.post('/', async (c) => {
  const p = await parseBody(
    c,
    z.object({
      santriId: z.string(),
      jenis: z.enum(['setor', 'tarik']),
      jumlah: z
        .number('Jumlah harus angka')
        .int('Jumlah harus bilangan bulat rupiah')
        .min(1, 'Jumlah harus lebih dari 0')
        .max(MAKS_JUMLAH, 'Jumlah terlalu besar'),
      tanggal: z.string().refine(tglValid, 'Tanggal tidak valid').optional(),
      // Wajib true untuk penarikan di atas batas; UI memintanya lewat dialog.
      konfirmasi: z.boolean().optional(),
    })
  )
  if (!p.ok) return p.res
  const { santriId, jenis, jumlah } = p.data
  const tgl = p.data.tanggal ?? hariIniWib()
  const db = c.get('db')

  if (!(await db.select({ id: santri.id }).from(santri).where(eq(santri.id, santriId)).get())) {
    return c.json({ error: 'Santri tidak ditemukan' }, 404)
  }
  if (jenis === 'setor') {
    const [row] = await db.insert(tabungan).values({ santriId, jenis, jumlah, tanggal: tgl }).returning()
    return c.json({ transaksi: row }, 201)
  }

  if (jumlah > BATAS_TARIK_KONFIRMASI && !p.data.konfirmasi) {
    return c.json(
      { error: `Penarikan di atas ${BATAS_TARIK_KONFIRMASI} perlu konfirmasi`, perluKonfirmasi: true },
      409
    )
  }
  // Cek saldo dan sisipkan dalam SATU perintah: dua penarikan bersamaan tidak bisa
  // sama-sama lolos dan membuat saldo minus.
  const id = crypto.randomUUID()
  const res = await db.run(sql`
    INSERT INTO tabungan (id, santri_id, jenis, jumlah, tanggal)
    SELECT ${id}, ${santriId}, 'tarik', ${jumlah}, ${tgl}
    WHERE (SELECT coalesce(sum(case when jenis = 'setor' then jumlah else -jumlah end), 0)
           FROM tabungan WHERE santri_id = ${santriId}) >= ${jumlah}`)
  if (!res.meta.changes) {
    return c.json({ error: 'Saldo tidak cukup' }, 400)
  }
  const row = await db.select().from(tabungan).where(eq(tabungan.id, id)).get()
  return c.json({ transaksi: row }, 201)
})
