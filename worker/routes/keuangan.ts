import { desc, eq, sql } from 'drizzle-orm'
import { type BatchItem } from 'drizzle-orm/batch'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  JENJANG,
  KATEGORI_KELUAR,
  KATEGORI_MASUK,
  MAKS_JUMLAH,
  STATUS_SPP,
  hariIniWib,
  periodeValid,
  tglValid,
} from '../../shared/domain'
import { lembaga, santri, tagihanSpp, transaksi } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

// Seluruh keuangan hanya untuk Pimpinan.
export const keuanganRoutes = new Hono<AppEnv>()
keuanganRoutes.use('*', requireAuth, requirePeran('pimpinan'))

const tanggal = z.string().refine(tglValid, 'Tanggal tidak valid (YYYY-MM-DD)')
const jumlah = z
  .number('Jumlah harus angka')
  .int('Jumlah harus bilangan bulat rupiah')
  .min(1, 'Jumlah harus lebih dari 0')
  .max(MAKS_JUMLAH, 'Jumlah terlalu besar')

const isJenjang = (x?: string): x is (typeof JENJANG)[number] =>
  !!x && (JENJANG as readonly string[]).includes(x)

// ---------- Kas ----------
keuanganRoutes.get('/', async (c) => {
  const db = c.get('db')
  const j = c.req.query('jenjang')
  const where = isJenjang(j) ? eq(transaksi.jenjang, j) : undefined
  const rows = await db
    .select()
    .from(transaksi)
    .where(where)
    .orderBy(desc(transaksi.tanggal), desc(transaksi.id))
    .limit(500)
  // Ringkasan dihitung dari SELURUH transaksi (bukan hanya 500 terbaru).
  const [r] = await db
    .select({
      masuk: sql<number>`coalesce(sum(case when ${transaksi.jenis} = 'masuk' then ${transaksi.jumlah} end), 0)`,
      keluar: sql<number>`coalesce(sum(case when ${transaksi.jenis} = 'keluar' then ${transaksi.jumlah} end), 0)`,
    })
    .from(transaksi)
    .where(where)
  return c.json({
    transaksi: rows,
    ringkasan: { masuk: r.masuk, keluar: r.keluar, saldo: r.masuk - r.keluar },
  })
})

keuanganRoutes.post('/', async (c) => {
  const p = await parseBody(
    c,
    z.object({
      jenis: z.enum(['masuk', 'keluar']),
      jenjang: z.enum(JENJANG),
      kategori: z.string(),
      nama: z.string().trim().min(1, 'Nama transaksi wajib diisi').max(200),
      jumlah,
      tanggal,
      catatan: z.string().trim().max(300).optional(),
    })
  )
  if (!p.ok) return p.res
  const valid: readonly string[] =
    p.data.jenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR
  if (!valid.includes(p.data.kategori)) {
    return c.json({ error: `Kategori tidak valid untuk transaksi ${p.data.jenis}` }, 400)
  }
  const [row] = await c.get('db').insert(transaksi).values(p.data).returning()
  return c.json({ transaksi: row }, 201)
})

keuanganRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const t = await db.select().from(transaksi).where(eq(transaksi.id, id)).get()
  if (!t) return c.json({ error: 'Transaksi tidak ditemukan' }, 404)
  if (t.tagihanSppId) {
    return c.json(
      { error: 'Transaksi ini berasal dari pelunasan SPP. Ubah status tagihannya di tab SPP.' },
      409
    )
  }
  await db.delete(transaksi).where(eq(transaksi.id, id))
  return c.json({ ok: true })
})

// ---------- SPP ----------
keuanganRoutes.get('/spp', async (c) => {
  const periode = c.req.query('periode') ?? ''
  if (!periodeValid(periode)) return c.json({ error: 'periode harus YYYY-MM' }, 400)
  const rows = await c
    .get('db')
    .select({
      id: tagihanSpp.id,
      santriId: tagihanSpp.santriId,
      nama: santri.nama,
      nis: santri.nis,
      jenjang: santri.jenjang,
      periode: tagihanSpp.periode,
      jumlah: tagihanSpp.jumlah,
      status: tagihanSpp.status,
    })
    .from(tagihanSpp)
    .innerJoin(santri, eq(santri.id, tagihanSpp.santriId))
    .where(eq(tagihanSpp.periode, periode))
    .orderBy(santri.nama)
  return c.json({ tagihan: rows })
})

// Buat tagihan bulan ini untuk semua santri aktif (yang belum punya), tarif dari Identitas.
keuanganRoutes.post('/spp/generate', async (c) => {
  const p = await parseBody(c, z.object({ periode: z.string().refine(periodeValid, 'periode harus YYYY-MM') }))
  if (!p.ok) return p.res
  const db = c.get('db')
  const tarif = new Map(
    (await db.select().from(lembaga)).map((l) => [l.jenjang, l.tarifSpp])
  )
  const aktif = await db.select().from(santri).where(eq(santri.status, 'aktif'))
  const ada = new Set(
    (
      await db
        .select({ id: tagihanSpp.santriId })
        .from(tagihanSpp)
        .where(eq(tagihanSpp.periode, p.data.periode))
    ).map((x) => x.id)
  )
  const baru = aktif.filter((s) => !ada.has(s.id))
  const tanpaTarif = baru.filter((s) => !(tarif.get(s.jenjang) ?? 0))
  if (tanpaTarif.length > 0) {
    return c.json({ error: 'Tarif SPP belum diatur untuk jenjang santri aktif. Isi di Identitas dan Tarif.' }, 400)
  }
  const stmts: BatchItem<'sqlite'>[] = []
  for (let i = 0; i < baru.length; i += 15) {
    stmts.push(
      db
        .insert(tagihanSpp)
        .values(
          baru.slice(i, i + 15).map((s) => ({
            santriId: s.id,
            periode: p.data.periode,
            jumlah: tarif.get(s.jenjang)!,
          }))
        )
        .onConflictDoNothing()
    )
  }
  if (stmts.length) await db.batch(stmts as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
  return c.json({ dibuat: baru.length })
})

// Ubah status tagihan. 'lunas' otomatis mencatat pemasukan kas (kategori SPP);
// keluar dari 'lunas' membatalkan catatan kas itu. Satu batch = atomik.
keuanganRoutes.patch('/spp/:id', async (c) => {
  const p = await parseBody(
    c,
    z.object({ status: z.enum(STATUS_SPP), tanggal: tanggal.optional() })
  )
  if (!p.ok) return p.res
  const db = c.get('db')
  const id = c.req.param('id')
  const t = await db
    .select({
      id: tagihanSpp.id,
      status: tagihanSpp.status,
      jumlah: tagihanSpp.jumlah,
      periode: tagihanSpp.periode,
      nama: santri.nama,
      jenjang: santri.jenjang,
    })
    .from(tagihanSpp)
    .innerJoin(santri, eq(santri.id, tagihanSpp.santriId))
    .where(eq(tagihanSpp.id, id))
    .get()
  if (!t) return c.json({ error: 'Tagihan tidak ditemukan' }, 404)
  if (t.status === p.data.status) return c.json({ ok: true, status: t.status })

  const set = db.update(tagihanSpp).set({ status: p.data.status }).where(eq(tagihanSpp.id, id))
  try {
    if (p.data.status === 'lunas') {
      await db.batch([
        set,
        db.insert(transaksi).values({
          jenis: 'masuk',
          jenjang: t.jenjang,
          kategori: 'SPP',
          nama: `SPP ${t.nama} ${t.periode}`,
          jumlah: t.jumlah,
          tanggal: p.data.tanggal ?? hariIniWib(),
          tagihanSppId: id,
        }),
      ])
    } else if (t.status === 'lunas') {
      await db.batch([db.delete(transaksi).where(eq(transaksi.tagihanSppId, id)), set])
    } else {
      await set
    }
  } catch {
    // Mis. dua permintaan "lunas" bersamaan: indeks unik mencegah kas ganda.
    return c.json({ error: 'Status baru saja berubah. Muat ulang.' }, 409)
  }
  return c.json({ ok: true, status: p.data.status })
})


