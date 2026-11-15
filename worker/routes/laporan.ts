import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { LABEL_ABSEN, hariIniWib } from '../../shared/domain'
import { toCsv, type Sel } from '../../shared/csv'
import {
  absensi,
  guru,
  kelas,
  nilai,
  pertemuan,
  santri,
  tabungan,
  tagihanSpp,
  transaksi,
} from '../db/schema'
import { requireAuth, type AppEnv } from '../middleware'

export const laporanRoutes = new Hono<AppEnv>()
laporanRoutes.use('*', requireAuth)

const n = (x: unknown) => Number(x ?? 0)

laporanRoutes.get('/ringkasan', async (c) => {
  const db = c.get('db')
  const pimpinan = c.get('user')!.peran === 'pimpinan'

  const perSantri = await db
    .select({ jenjang: santri.jenjang, jk: santri.jenisKelamin, jumlah: sql<number>`count(*)` })
    .from(santri)
    .where(eq(santri.status, 'aktif'))
    .groupBy(santri.jenjang, santri.jenisKelamin)
  const perJenjang = {
    TPQ: { aktif: 0, L: 0, P: 0 },
    MI: { aktif: 0, L: 0, P: 0 },
  }
  for (const r of perSantri) {
    perJenjang[r.jenjang].aktif += r.jumlah
    perJenjang[r.jenjang][r.jk] += r.jumlah
  }

  const santriPerKelas = await db
    .select({ kelasId: kelas.id, kelas: kelas.nama, jenjang: kelas.jenjang, jumlah: sql<number>`count(${santri.id})` })
    .from(kelas)
    .leftJoin(santri, and(eq(santri.kelasId, kelas.id), eq(santri.status, 'aktif')))
    .groupBy(kelas.id)
    .orderBy(asc(kelas.nama))
  const santriPerAngkatan = await db
    .select({ angkatan: santri.angkatan, jenjang: santri.jenjang, jumlah: sql<number>`count(*)` })
    .from(santri)
    .where(eq(santri.status, 'aktif'))
    .groupBy(santri.angkatan, santri.jenjang)
    .orderBy(asc(santri.angkatan))
  const guruPerPeran = await db
    .select({ peran: guru.peranGuru, jenjang: guru.jenjang, jumlah: sql<number>`count(*)` })
    .from(guru)
    .groupBy(guru.peranGuru, guru.jenjang)
  const abs = await db
    .select({ status: absensi.status, jumlah: sql<number>`count(*)` })
    .from(absensi)
    .groupBy(absensi.status)
  const absensiTotal = { H: 0, I: 0, S: 0, A: 0 }
  for (const a of abs) absensiTotal[a.status] = a.jumlah
  const totalAbs = absensiTotal.H + absensiTotal.I + absensiTotal.S + absensiTotal.A

  const [{ nGuru }] = await db.select({ nGuru: sql<number>`count(*)` }).from(guru)
  const [{ nKelas }] = await db.select({ nKelas: sql<number>`count(*)` }).from(kelas)
  const [{ nSantri }] = await db.select({ nSantri: sql<number>`count(*)` }).from(santri)

  const hasil: Record<string, unknown> = {
    perJenjang,
    santriPerKelas,
    santriPerAngkatan,
    guruPerPeran,
    absensiTotal,
    rataKehadiran: totalAbs ? Math.round((absensiTotal.H / totalAbs) * 100) : null,
    // untuk kartu "Mulai isi data": ketiganya harus terisi
    isian: { santri: nSantri, guru: nGuru, kelas: nKelas },
  }

  if (pimpinan) {
    const periode = hariIniWib().slice(0, 7)
    const [kas] = await db
      .select({
        masuk: sql<number>`coalesce(sum(case when ${transaksi.jenis} = 'masuk' then ${transaksi.jumlah} end), 0)`,
        keluar: sql<number>`coalesce(sum(case when ${transaksi.jenis} = 'keluar' then ${transaksi.jumlah} end), 0)`,
      })
      .from(transaksi)
    const spp = await db
      .select({ status: tagihanSpp.status, jumlah: sql<number>`count(*)`, total: sql<number>`sum(${tagihanSpp.jumlah})` })
      .from(tagihanSpp)
      .where(eq(tagihanSpp.periode, periode))
      .groupBy(tagihanSpp.status)
    const [tab] = await db
      .select({ total: sql<number>`coalesce(sum(case when ${tabungan.jenis} = 'setor' then ${tabungan.jumlah} else -${tabungan.jumlah} end), 0)` })
      .from(tabungan)
    const [hb] = await db
      .select({ jumlah: sql<number>`count(*)` })
      .from(guru)
      .where(and(eq(guru.honorLunas, false), sql`${guru.honor} > 0`))
    hasil.keuangan = {
      saldoKas: n(kas.masuk) - n(kas.keluar),
      masuk: n(kas.masuk),
      keluar: n(kas.keluar),
      totalTabungan: n(tab.total),
      honorBelumLunas: hb.jumlah,
      spp: {
        periode,
        lunas: spp.find((s) => s.status === 'lunas')?.jumlah ?? 0,
        total: spp.reduce((a, s) => a + s.jumlah, 0),
        nominalLunas: n(spp.find((s) => s.status === 'lunas')?.total),
        nominalTotal: spp.reduce((a, s) => a + n(s.total), 0),
      },
    }
  }
  return c.json(hasil)
})

// ---------- Export CSV (dari server, tanpa batas 500 baris) ----------
type Pembuat = { pimpinan: boolean; buat: (db: AppEnv['Variables']['db']) => Promise<Sel[][]> }

const EXPORT: Record<string, Pembuat> = {
  santri: {
    pimpinan: false,
    buat: async (db) => {
      const rows = await db
        .select({ s: santri, kelas: kelas.nama })
        .from(santri)
        .leftJoin(kelas, eq(kelas.id, santri.kelasId))
        .orderBy(asc(santri.nama))
      return [
        ['NIS', 'Nama', 'Jenis Kelamin', 'Jenjang', 'Kelas', 'Jilid', 'Angkatan', 'Rombel', 'Status', 'Wali', 'HP Wali', 'Alamat'],
        ...rows.map(({ s, kelas: k }) => [s.nis, s.nama, s.jenisKelamin, s.jenjang, k, s.jilid, s.angkatan, s.rombel, s.status, s.wali, s.hpWali, s.alamat]),
      ]
    },
  },
  guru: {
    pimpinan: true,
    buat: async (db) => {
      const rows = await db.select({ g: guru, kelas: kelas.nama }).from(guru).leftJoin(kelas, eq(kelas.id, guru.kelasId)).orderBy(asc(guru.nama))
      return [
        ['Nama', 'Peran', 'Jenjang', 'Kelas', 'HP', 'Honor', 'Honor Lunas'],
        ...rows.map(({ g, kelas: k }) => [g.nama, g.peranGuru, g.jenjang, k, g.hp, g.honor, g.honorLunas ? 'Lunas' : 'Belum']),
      ]
    },
  },
  nilai: {
    pimpinan: false,
    buat: async (db) => {
      const rows = await db
        .select({ nis: santri.nis, nama: santri.nama, jenis: nilai.jenis, mapel: nilai.mapel, nilai: nilai.nilai, tanggal: nilai.tanggal, semester: nilai.semester })
        .from(nilai)
        .innerJoin(santri, eq(santri.id, nilai.santriId))
        .orderBy(asc(santri.nama), asc(nilai.tanggal))
      return [['NIS', 'Nama', 'Jenis', 'Mapel', 'Nilai', 'Tanggal', 'Semester'], ...rows.map((r) => [r.nis, r.nama, r.jenis, r.mapel, r.nilai, r.tanggal, r.semester])]
    },
  },
  absensi: {
    pimpinan: false,
    buat: async (db) => {
      const rows = await db
        .select({ tanggal: pertemuan.tanggal, kelas: kelas.nama, materi: pertemuan.materi, nis: santri.nis, nama: santri.nama, status: absensi.status })
        .from(absensi)
        .innerJoin(pertemuan, eq(pertemuan.id, absensi.pertemuanId))
        .innerJoin(kelas, eq(kelas.id, pertemuan.kelasId))
        .innerJoin(santri, eq(santri.id, absensi.santriId))
        .orderBy(asc(pertemuan.tanggal), asc(kelas.nama), asc(santri.nama))
      return [['Tanggal', 'Kelas', 'Materi', 'NIS', 'Nama', 'Status'], ...rows.map((r) => [r.tanggal, r.kelas, r.materi, r.nis, r.nama, LABEL_ABSEN[r.status]])]
    },
  },
  keuangan: {
    pimpinan: true,
    buat: async (db) => {
      const rows = await db.select().from(transaksi).orderBy(asc(transaksi.tanggal))
      return [['Tanggal', 'Jenis', 'Jenjang', 'Kategori', 'Nama', 'Jumlah', 'Catatan'], ...rows.map((t) => [t.tanggal, t.jenis, t.jenjang, t.kategori, t.nama, t.jumlah, t.catatan])]
    },
  },
  tabungan: {
    pimpinan: true,
    buat: async (db) => {
      const rows = await db
        .select({ nis: santri.nis, nama: santri.nama, jenis: tabungan.jenis, jumlah: tabungan.jumlah, tanggal: tabungan.tanggal, catatan: tabungan.catatan })
        .from(tabungan)
        .innerJoin(santri, eq(santri.id, tabungan.santriId))
        .orderBy(asc(tabungan.tanggal))
      return [['Tanggal', 'NIS', 'Nama', 'Jenis', 'Jumlah', 'Catatan'], ...rows.map((r) => [r.tanggal, r.nis, r.nama, r.jenis, r.jumlah, r.catatan])]
    },
  },
}

laporanRoutes.get('/export/:jenis', async (c) => {
  const def = EXPORT[c.req.param('jenis')]
  if (!def) return c.json({ error: 'Jenis export tidak dikenal' }, 404)
  if (def.pimpinan && c.get('user')!.peran !== 'pimpinan') {
    return c.json({ error: 'Tidak ada akses' }, 403)
  }
  const csv = toCsv(await def.buat(c.get('db')))
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="tpq-${c.req.param('jenis')}-${hariIniWib()}.csv"`,
      'cache-control': 'no-store',
    },
  })
})


