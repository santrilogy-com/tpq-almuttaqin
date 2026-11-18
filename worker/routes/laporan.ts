import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { LABEL_ABSEN, hariIniWib } from '../../shared/domain'
import { toCsv, type Sel } from '../../shared/csv'
import {
  absensi,
  guru,
  guruDetail,
  kelas,
  nilai,
  pertemuan,
  santri,
  santriDetail,
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
  // Hanya 60 hari terakhir: memindai seluruh riwayat absensi di setiap pembukaan Beranda akan membengkak
  // (ratusan santri x ribuan pertemuan) dan menghabiskan kuota baca D1. Angkanya juga lebih relevan.
  const batasAbsen = new Date(Date.parse(hariIniWib()) - 60 * 86_400_000).toISOString().slice(0, 10)
  const abs = await db
    .select({ status: absensi.status, jumlah: sql<number>`count(*)` })
    .from(absensi)
    .innerJoin(pertemuan, eq(pertemuan.id, absensi.pertemuanId))
    .where(sql`${pertemuan.tanggal} >= ${batasAbsen}`)
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
    const JJ = ['TPQ', 'MI'] as const
    const kas = await db
      .select({
        jenjang: transaksi.jenjang,
        masuk: sql<number>`coalesce(sum(case when ${transaksi.jenis} = 'masuk' then ${transaksi.jumlah} end), 0)`,
        keluar: sql<number>`coalesce(sum(case when ${transaksi.jenis} = 'keluar' then ${transaksi.jumlah} end), 0)`,
      })
      .from(transaksi)
      .groupBy(transaksi.jenjang)
    const spp = await db
      .select({ jenjang: santri.jenjang, status: tagihanSpp.status, jumlah: sql<number>`count(*)`, total: sql<number>`sum(${tagihanSpp.jumlah})` })
      .from(tagihanSpp)
      .innerJoin(santri, eq(santri.id, tagihanSpp.santriId))
      .where(eq(tagihanSpp.periode, periode))
      .groupBy(santri.jenjang, tagihanSpp.status)
    const tab = await db
      .select({ jenjang: santri.jenjang, total: sql<number>`coalesce(sum(case when ${tabungan.jenis} = 'setor' then ${tabungan.jumlah} else -${tabungan.jumlah} end), 0)` })
      .from(tabungan)
      .innerJoin(santri, eq(santri.id, tabungan.santriId))
      .groupBy(santri.jenjang)
    const hb = await db
      .select({ jenjang: guru.jenjang, jumlah: sql<number>`count(*)` })
      .from(guru)
      .where(and(eq(guru.honorLunas, false), sql`${guru.honor} > 0`))
      .groupBy(guru.jenjang)

    // Angka per jenjang (untuk saklar lembaga) + total gabungan.
    const perJenjang = Object.fromEntries(
      JJ.map((j) => {
        const k = kas.find((x) => x.jenjang === j)
        const masuk = n(k?.masuk)
        const keluar = n(k?.keluar)
        const s = spp.filter((x) => x.jenjang === j)
        return [
          j,
          {
            saldoKas: masuk - keluar,
            masuk,
            keluar,
            totalTabungan: n(tab.find((x) => x.jenjang === j)?.total),
            honorBelumLunas: hb.find((x) => x.jenjang === j)?.jumlah ?? 0,
            spp: {
              lunas: s.find((x) => x.status === 'lunas')?.jumlah ?? 0,
              total: s.reduce((a, x) => a + x.jumlah, 0),
              nominalLunas: n(s.find((x) => x.status === 'lunas')?.total),
              nominalTotal: s.reduce((a, x) => a + n(x.total), 0),
            },
          },
        ]
      })
    ) as Record<(typeof JJ)[number], { saldoKas: number; masuk: number; keluar: number; totalTabungan: number; honorBelumLunas: number; spp: { lunas: number; total: number; nominalLunas: number; nominalTotal: number } }>
    const T = perJenjang.TPQ
    const M = perJenjang.MI
    hasil.keuangan = {
      perJenjang,
      periode,
      saldoKas: T.saldoKas + M.saldoKas,
      masuk: T.masuk + M.masuk,
      keluar: T.keluar + M.keluar,
      totalTabungan: T.totalTabungan + M.totalTabungan,
      honorBelumLunas: T.honorBelumLunas + M.honorBelumLunas,
      spp: {
        periode,
        lunas: T.spp.lunas + M.spp.lunas,
        total: T.spp.total + M.spp.total,
        nominalLunas: T.spp.nominalLunas + M.spp.nominalLunas,
        nominalTotal: T.spp.nominalTotal + M.spp.nominalTotal,
      },
    }
  }
  return c.json(hasil)
})

// ---------- Export CSV (dari server, tanpa batas 500 baris) ----------
type Pembuat = { pimpinan: boolean; buat: (db: AppEnv['Variables']['db'], peran: string) => Promise<Sel[][]> }

const EXPORT: Record<string, Pembuat> = {
  santri: {
    pimpinan: false,
    buat: async (db, peran) => {
      const rows = await db
        .select({ s: santri, kelas: kelas.nama, d: santriDetail })
        .from(santri)
        .leftJoin(kelas, eq(kelas.id, santri.kelasId))
        .leftJoin(santriDetail, eq(santriDetail.santriId, santri.id))
        .orderBy(asc(santri.nama))
      const dasar = ['NIS', 'Nama', 'Jenis Kelamin', 'Jenjang', 'Kelas', 'Jilid', 'Angkatan', 'Rombel', 'Status', 'Wali', 'HP Wali', 'Alamat']
      // Biodata sensitif (NIK, KK, penghasilan orang tua) hanya untuk Pimpinan; guru mendapat kolom dasar saja.
      const lengkap = peran === 'pimpinan'
      const tambahan = [
        'NIK', 'No KK', 'Tempat Lahir', 'Tanggal Lahir', 'Hobi', 'Cita-cita', 'Status Rumah', 'Status Mukim', 'Status Anak', 'Anak Ke',
        'Jalan/Dusun', 'Desa/Kecamatan', 'Kode Pos', 'RT', 'RW',
        'NIK Ayah', 'Nama Ayah', 'Pendidikan Ayah', 'Penghasilan Ayah', 'Kontak Ayah',
        'NIK Ibu', 'Nama Ibu', 'Pendidikan Ibu', 'Pekerjaan Ibu', 'Penghasilan Ibu', 'Kontak Ibu',
        'Tanggal Masuk', 'Status Masuk', 'Diterima di Kelas', 'NISN',
      ]
      return [
        lengkap ? [...dasar, ...tambahan] : dasar,
        ...rows.map(({ s, kelas: k, d }) => {
          const utama: Sel[] = [s.nis, s.nama, s.jenisKelamin, s.jenjang, k, s.jilid, s.angkatan, s.rombel, s.status, s.wali, s.hpWali, s.alamat]
          if (!lengkap) return utama
          return [
            ...utama,
            d?.nik, d?.noKk, d?.tempatLahir, d?.tanggalLahir, d?.hobi, d?.citaCita, d?.statusRumah, d?.statusMukim, d?.statusAnak, d?.anakKe,
            d?.jalan, d?.desaKecamatan, d?.kodePos, d?.rt, d?.rw,
            d?.nikAyah, d?.namaAyah, d?.pendidikanAyah, d?.penghasilanAyah, d?.kontakAyah,
            d?.nikIbu, d?.namaIbu, d?.pendidikanIbu, d?.pekerjaanIbu, d?.penghasilanIbu, d?.kontakIbu,
            d?.tanggalMasuk, d?.statusMasuk, d?.diterimaDiKelas, d?.nisn,
          ]
        }),
      ]
    },
  },
  guru: {
    pimpinan: true,
    buat: async (db) => {
      const rows = await db
        .select({ g: guru, kelas: kelas.nama, d: guruDetail })
        .from(guru)
        .leftJoin(kelas, eq(kelas.id, guru.kelasId))
        .leftJoin(guruDetail, eq(guruDetail.guruId, guru.id))
        .orderBy(asc(guru.nama))
      return [
        [
          'Nama', 'Peran', 'Jenjang', 'Kelas', 'HP', 'Honor', 'Honor Lunas',
          'ID Guru', 'NIK', 'Tanggal Masuk', 'Status', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Nama Ibu Kandung',
          'Jalan/Dusun', 'Desa/Kecamatan', 'Kode Pos', 'RT', 'RW', 'No. Email Basmalah',
        ],
        ...rows.map(({ g, kelas: k, d }) => [
          g.nama, g.peranGuru, g.jenjang, k, g.hp, g.honor, g.honorLunas ? 'Lunas' : 'Belum',
          d?.idGuru, d?.nik, d?.tanggalMasuk, d?.status, d?.jenisKelamin, d?.tempatLahir, d?.tanggalLahir, d?.namaIbuKandung,
          d?.jalan, d?.desaKecamatan, d?.kodePos, d?.rt, d?.rw, d?.email,
        ]),
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
  const csv = toCsv(await def.buat(c.get('db'), c.get('user')!.peran))
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="tpq-${c.req.param('jenis')}-${hariIniWib()}.csv"`,
      'cache-control': 'no-store',
    },
  })
})




