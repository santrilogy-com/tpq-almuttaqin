/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono'
import { z } from 'zod'
import { toCsv } from '../../shared/csv'
import { JILID_LIST, hariIniWib, semesterDari, tglValid, type Jenjang } from '../../shared/domain'
import { guru, kelas, nilai, santri } from '../db/schema'
import { insertJson } from '../lib/json-insert'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const importRoutes = new Hono<AppEnv>()
importRoutes.use('*', requireAuth, requirePeran('pimpinan'))

const MAKS_BARIS = 1000
type Baris = Record<string, string>
type Tolak = { baris: number; alasan: string }

// "Hp Wali", "HP_wali", "hp-wali" -> "hpwali"
const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '')
const rapikan = (b: Baris): Baris => Object.fromEntries(Object.entries(b).map(([k, v]) => [norm(k), String(v ?? '').trim()]))

const jenjangDari = (t: string): Jenjang | null => {
  const x = t.toLowerCase()
  if (x === '' || x === 'tpq') return 'TPQ'
  if (x === 'ibtidaiyah' || x === 'mi') return 'MI'
  return null
}
const jkDari = (t: string): 'L' | 'P' | null => {
  const x = t.toLowerCase()
  if (x === 'l' || x === 'laki-laki' || x === 'laki laki' || x === 'lakilaki') return 'L'
  if (x === 'p' || x === 'perempuan') return 'P'
  return null
}
/** "50000", "50.000" -> bilangan bulat >= 0; kosong -> 0; selain itu null. */
const rupiahDari = (t: string): number | null => {
  const x = t.replace(/^rp\.?\s*/i, '').replace(/\s/g, '')
  if (x === '') return 0
  if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(x)) return null
  const n = Number(x.replace(/\./g, ''))
  return n <= 100_000_000 ? n : null
}

const bodySkema = z.object({
  baris: z.array(z.record(z.string(), z.any())).min(1, 'File kosong atau hanya berisi judul kolom').max(MAKS_BARIS, `Maksimal ${MAKS_BARIS} baris per import`),
})

async function ambil(c: any) {
  const p = bodySkema.safeParse(await c.req.json().catch(() => null))
  if (!p.success) return { galat: p.error.issues[0].message as string }
  return { baris: (p.data.baris as Baris[]).map(rapikan) }
}

// ---------- Santri ----------
importRoutes.post('/santri', async (c) => {
  const a = await ambil(c)
  if (a.galat) return c.json({ error: a.galat }, 400)
  const db = c.get('db') as any

  const nisAda = new Set<string>((await db.select({ nis: santri.nis }).from(santri)).map((x: any) => x.nis))
  const kelasAda = new Map<string, string>() // "jenjang|nama" -> id
  for (const k of (await db.select().from(kelas)) as any[]) kelasAda.set(`${k.jenjang}|${k.nama.toLowerCase()}`, k.id)

  const ditolak: Tolak[] = []
  const baru: any[] = []
  const kelasBaru: any[] = []
  const nisFile = new Set<string>()

  a.baris!.forEach((b, i) => {
    const no = i + 2 // baris 1 = judul kolom
    const nama = b.nama
    const nis = b.nis
    const namaKelas = b.kelas
    const jk = jkDari(b.jeniskelamin ?? b.jk ?? '')
    const jenjang = jenjangDari(b.jenjang ?? '')
    if (!nama) return ditolak.push({ baris: no, alasan: 'Nama kosong' })
    if (!nis) return ditolak.push({ baris: no, alasan: 'NIS kosong' })
    if (!namaKelas) return ditolak.push({ baris: no, alasan: 'Kelas kosong' })
    if (!jk) return ditolak.push({ baris: no, alasan: 'Jenis kelamin harus L, P, Laki-laki, atau Perempuan' })
    if (!jenjang) return ditolak.push({ baris: no, alasan: 'Jenjang harus TPQ atau Ibtidaiyah' })
    if (nisAda.has(nis)) return ditolak.push({ baris: no, alasan: `NIS ${nis} sudah ada` })
    if (nisFile.has(nis)) return ditolak.push({ baris: no, alasan: `NIS ${nis} kembar di dalam file` })
    nisFile.add(nis)

    const kunci = `${jenjang}|${namaKelas.toLowerCase()}`
    let kelasId = kelasAda.get(kunci)
    if (!kelasId) {
      kelasId = crypto.randomUUID()
      kelasAda.set(kunci, kelasId)
      kelasBaru.push({ id: kelasId, nama: namaKelas.slice(0, 100), jenjang, pengajar: '', jadwal: '', ruang: '' })
    }
    const jilidIsi = b.jilid ?? ''
    baru.push({
      id: crypto.randomUUID(),
      nis: nis.slice(0, 30),
      nama: nama.slice(0, 100),
      jenisKelamin: jk,
      jenjang,
      kelasId,
      jilid: (JILID_LIST as readonly string[]).includes(jilidIsi) ? jilidIsi : (JILID_LIST as readonly string[]).includes(namaKelas) ? namaKelas : 'Iqra 1',
      angkatan: (b.angkatan ?? '').slice(0, 20),
      rombel: (b.rombel ?? '').slice(0, 30),
      status: 'aktif',
      wali: (b.wali ?? '').slice(0, 100),
      hpWali: (b.hpwali ?? '').slice(0, 30),
      alamat: (b.alamat ?? '').slice(0, 300),
      createdAt: Date.now(),
    })
  })

  // Kelas baru + santri dalam satu batch: gagal = tidak ada yang tersimpan.
  const stmts = [...insertJson(c.env.DB, kelas, kelasBaru), ...insertJson(c.env.DB, santri, baru)]
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ dibuat: baru.length, kelasBaru: kelasBaru.length, ditolak })
})

// ---------- Guru ----------
importRoutes.post('/guru', async (c) => {
  const a = await ambil(c)
  if (a.galat) return c.json({ error: a.galat }, 400)
  const db = c.get('db') as any
  const namaAda = new Set<string>((await db.select({ n: guru.nama }).from(guru)).map((x: any) => x.n.toLowerCase()))
  const kelasAda = new Map<string, string>()
  for (const k of (await db.select().from(kelas)) as any[]) kelasAda.set(`${k.jenjang}|${k.nama.toLowerCase()}`, k.id)
  const PERAN = ['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru']

  const ditolak: Tolak[] = []
  const baru: any[] = []
  a.baris!.forEach((b, i) => {
    const no = i + 2
    if (!b.nama) return ditolak.push({ baris: no, alasan: 'Nama kosong' })
    if (namaAda.has(b.nama.toLowerCase())) return ditolak.push({ baris: no, alasan: `Guru "${b.nama}" sudah ada` })
    const peran = b.peran ? PERAN.find((p) => p.toLowerCase() === b.peran.toLowerCase()) : 'Guru'
    if (!peran) return ditolak.push({ baris: no, alasan: 'Peran harus Pimpinan, Wali Kelas, Guru Fan, atau Guru' })
    const jenjang = jenjangDari(b.jenjang ?? '')
    if (!jenjang) return ditolak.push({ baris: no, alasan: 'Jenjang harus TPQ atau Ibtidaiyah' })
    const honor = rupiahDari(b.honor ?? '')
    if (honor === null) return ditolak.push({ baris: no, alasan: 'Honor harus angka 0 atau lebih (mis. 800000 atau 800.000)' })
    namaAda.add(b.nama.toLowerCase())
    baru.push({
      id: crypto.randomUUID(),
      nama: b.nama.slice(0, 100),
      peranGuru: peran,
      kelasId: kelasAda.get(`${jenjang}|${(b.kelas ?? '').toLowerCase()}`) ?? null,
      jenjang,
      hp: (b.hp ?? '').slice(0, 30),
      honor,
      honorLunas: false,
    })
  })
  const stmts = insertJson(c.env.DB, guru, baru)
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ dibuat: baru.length, ditolak })
})

// ---------- Nilai ----------
importRoutes.post('/nilai', async (c) => {
  const a = await ambil(c)
  if (a.galat) return c.json({ error: a.galat }, 400)
  const db = c.get('db') as any
  const semua = (await db.select({ id: santri.id, nis: santri.nis, nama: santri.nama }).from(santri)) as any[]
  const perNis = new Map(semua.map((s) => [s.nis, s]))
  const perNama = new Map<string, any[]>()
  for (const s of semua) perNama.set(s.nama.toLowerCase(), [...(perNama.get(s.nama.toLowerCase()) ?? []), s])
  const JENIS = ['Harian', 'Imda', 'Praktek']

  const ditolak: Tolak[] = []
  const baru: any[] = []
  a.baris!.forEach((b, i) => {
    const no = i + 2
    const ref = b.santri ?? ''
    const s = perNis.get(ref) ?? (perNama.get(ref.toLowerCase())?.length === 1 ? perNama.get(ref.toLowerCase())![0] : undefined)
    if (!ref) return ditolak.push({ baris: no, alasan: 'Kolom santri kosong' })
    if (!s) {
      const n = perNama.get(ref.toLowerCase())?.length ?? 0
      return ditolak.push({ baris: no, alasan: n > 1 ? `Nama "${ref}" kembar (${n} santri); pakai NIS` : `Santri "${ref}" tidak ditemukan` })
    }
    const jenis = JENIS.find((j) => j.toLowerCase() === (b.jenis ?? '').toLowerCase())
    if (!jenis) return ditolak.push({ baris: no, alasan: 'Jenis harus Harian, Imda, atau Praktek' })
    const angka = Number((b.nilai ?? '').replace(',', '.'))
    if ((b.nilai ?? '') === '' || !Number.isFinite(angka) || angka < 0 || angka > 100) return ditolak.push({ baris: no, alasan: 'Nilai harus angka 0 sampai 100' })
    const tanggal = b.tanggal || hariIniWib()
    if (!tglValid(tanggal)) return ditolak.push({ baris: no, alasan: 'Tanggal harus YYYY-MM-DD yang valid' })
    baru.push({ id: crypto.randomUUID(), santriId: s.id, jenis, mapel: (b.mapel || 'Umum').slice(0, 100), nilai: angka, tanggal, semester: semesterDari(tanggal) })
  })
  const stmts = insertJson(c.env.DB, nilai, baru)
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ dibuat: baru.length, ditolak })
})

// ---------- Template ----------
const TEMPLATE: Record<string, string[][]> = {
  santri: [['Nama', 'NIS', 'Kelas', 'Jenis Kelamin', 'Jenjang', 'Angkatan', 'Rombel', 'Wali', 'HP Wali', 'Alamat'], ['Ahmad Fauzi', '202401', 'Iqra 3', 'L', 'TPQ', '2024', 'A', 'Bpk. Slamet', '081200000001', 'Jl. Merdeka 12']],
  guru: [['Nama', 'Kelas', 'Peran', 'Jenjang', 'HP', 'Honor'], ['Ustadz Ahmad', 'Iqra 1', 'Wali Kelas', 'TPQ', '081200000101', '800000']],
  nilai: [['Santri', 'Jenis', 'Mapel', 'Nilai', 'Tanggal'], ['202401', 'Harian', 'Iqra', '85,5', hariIniWib()]],
}
importRoutes.get('/template/:jenis', (c) => {
  const t = TEMPLATE[c.req.param('jenis')]
  if (!t) return c.json({ error: 'Jenis template tidak dikenal' }, 404)
  return new Response(toCsv(t), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="template-${c.req.param('jenis')}.csv"`,
    },
  })
})

