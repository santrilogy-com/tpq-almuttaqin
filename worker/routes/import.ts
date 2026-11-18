/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono'
import { z } from 'zod'
import { ALIAS_CSV_SANTRI, DETAIL_GURU, DETAIL_SANTRI, detailGuruKosong, detailSantriKosong } from '../../shared/biodata'
import { toCsv } from '../../shared/csv'
import { JILID_LIST, hariIniWib, normalisasiMetode, semesterDari, tglValid, type Jenjang } from '../../shared/domain'
import { guru, guruDetail, kelas, nilai, santri, santriDetail } from '../db/schema'
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
  if (x === 'ibtidaiyah' || x === 'madrasah' || x === 'mi') return 'MI'
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

const ALIAS_CSV_GURU: Record<string, string> = {
  idguru: 'idGuru', nik: 'nik', tanggalmasuk: 'tanggalMasuk', tglmasuk: 'tanggalMasuk', status: 'status',
  jeniskelamin: 'jenisKelamin', jk: 'jenisKelamin', tempatlahir: 'tempatLahir', tanggallahir: 'tanggalLahir', tgllahir: 'tanggalLahir',
  namaibukandung: 'namaIbuKandung', namaibu: 'namaIbuKandung', jalan: 'jalan', jalandusun: 'jalan', dusun: 'jalan',
  desakecamatan: 'desaKecamatan', desa: 'desaKecamatan', kecamatan: 'desaKecamatan', kodepos: 'kodePos', rt: 'rt', rw: 'rw',
  email: 'email', noemail: 'email', emailbasmalah: 'email', nomoremail: 'email',
}

const TANGGAL = new Set(['tanggalLahir', 'tanggalMasuk'])
/** "17/05/2018" atau "17-5-2018" -> "2018-05-17"; selain itu dikembalikan apa adanya (akan divalidasi). */
const tanggalIso = (v: string) => {
  const m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v
}

/**
 * Menyusun biodata dari kolom-kolom CSV (judul sudah dinormalkan) dan memvalidasinya dengan skema yang sama
 * seperti formulir. Excel sering mengubah NIK 16 digit menjadi "3.2E+15": dikenali dan dijelaskan, bukan sekadar "tidak valid".
 */
function rakitDetail(b: Baris, alias: Record<string, string>, skema: z.ZodObject<any>): { detail: Record<string, unknown>; galat?: string } {
  const detail: Record<string, unknown> = {}
  for (const [kolom, nilai] of Object.entries(b)) {
    const f = alias[kolom]
    if (!f || nilai === '') continue
    if (/^\d+([.,]\d+)?e\+?\d+$/i.test(nilai)) {
      return { detail, galat: `Kolom ${kolom}: terbaca sebagai angka ilmiah ("${nilai}"). Ubah format kolom menjadi Teks di spreadsheet, lalu ketik ulang.` }
    }
    if (f === 'anakKe') {
      if (!/^\d+$/.test(nilai)) return { detail, galat: 'anakKe: harus angka bulat' }
      detail[f] = Number(nilai)
    } else if (f === 'jenisKelamin') {
      const jk = jkDari(nilai)
      if (!jk) return { detail, galat: 'jenisKelamin: harus L, P, Laki-laki, atau Perempuan' }
      detail[f] = jk
    } else detail[f] = TANGGAL.has(f) ? tanggalIso(nilai) : nilai
  }
  const p = skema.partial().safeParse(detail)
  if (!p.success) {
    const i = p.error.issues[0]
    return { detail, galat: `${i.path.join('.') || 'biodata'}: ${i.message}` }
  }
  return { detail: p.data as Record<string, unknown> }
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
  const detailBaru: any[] = []
  const nisFile = new Set<string>()

  a.baris!.forEach((b, i) => {
    const no = i + 2 // baris 1 = judul kolom
    const nama = b.nama
    const nis = b.nis || b.idmurid // "ID Murid" = NIS
    const namaKelas = normalisasiMetode(b.kelas ?? '')
    const jk = jkDari(b.jeniskelamin ?? b.jk ?? '')
    const jenjang = jenjangDari(b.jenjang ?? '')
    if (!nama) return ditolak.push({ baris: no, alasan: 'Nama kosong' })
    if (!nis) return ditolak.push({ baris: no, alasan: 'NIS kosong' })
    if (!namaKelas) return ditolak.push({ baris: no, alasan: 'Kelas kosong' })
    if (!jk) return ditolak.push({ baris: no, alasan: 'Jenis kelamin harus L, P, Laki-laki, atau Perempuan' })
    if (!jenjang) return ditolak.push({ baris: no, alasan: 'Jenjang harus TPQ atau Madrasah' })
    if (nisAda.has(nis)) return ditolak.push({ baris: no, alasan: `NIS ${nis} sudah ada` })
    if (nisFile.has(nis)) return ditolak.push({ baris: no, alasan: `NIS ${nis} kembar di dalam file` })
    // Biodata divalidasi SEBELUM apa pun dicatat (baris yang ditolak tidak boleh membuat kelas baru).
    const dt = rakitDetail(b, ALIAS_CSV_SANTRI, DETAIL_SANTRI)
    if (dt.galat) return ditolak.push({ baris: no, alasan: dt.galat })
    nisFile.add(nis)

    const kunci = `${jenjang}|${namaKelas.toLowerCase()}`
    let kelasId = kelasAda.get(kunci)
    if (!kelasId) {
      kelasId = crypto.randomUUID()
      kelasAda.set(kunci, kelasId)
      kelasBaru.push({ id: kelasId, nama: namaKelas.slice(0, 100), jenjang, pengajar: '', jadwal: '', ruang: '' })
    }
    const jilidIsi = normalisasiMetode(b.jilid ?? '')
    const id = crypto.randomUUID()
    detailBaru.push({ ...detailSantriKosong(), ...dt.detail, santriId: id })
    baru.push({
      id,
      nis: nis.slice(0, 30),
      nama: nama.slice(0, 100),
      jenisKelamin: jk,
      jenjang,
      kelasId,
      jilid: (JILID_LIST as readonly string[]).includes(jilidIsi) ? jilidIsi : (JILID_LIST as readonly string[]).includes(namaKelas) ? namaKelas : JILID_LIST[0],
      angkatan: (b.angkatan ?? '').slice(0, 20),
      rombel: (b.rombel ?? '').slice(0, 30),
      status: 'aktif',
      wali: (b.wali || b.namawali || '').slice(0, 100),
      hpWali: (b.hpwali ?? '').slice(0, 30),
      alamat: (b.alamat ?? '').slice(0, 300),
      createdAt: Date.now(),
    })
  })

  // Kelas baru + santri dalam satu batch: gagal = tidak ada yang tersimpan.
  const stmts = [
    ...insertJson(c.env.DB, kelas, kelasBaru),
    ...insertJson(c.env.DB, santri, baru),
    ...insertJson(c.env.DB, santriDetail, detailBaru),
  ]
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
  const idGuruAda = new Set<string>(
    ((await db.select({ id: guruDetail.idGuru }).from(guruDetail)) as { id: string }[]).map((x) => x.id).filter(Boolean)
  )
  const idGuruFile = new Set<string>()

  const ditolak: Tolak[] = []
  const baru: any[] = []
  const detailBaru: any[] = []
  a.baris!.forEach((b, i) => {
    const no = i + 2
    if (!b.nama) return ditolak.push({ baris: no, alasan: 'Nama kosong' })
    if (namaAda.has(b.nama.toLowerCase())) return ditolak.push({ baris: no, alasan: `Guru "${b.nama}" sudah ada` })
    const peran = b.peran ? PERAN.find((p) => p.toLowerCase() === b.peran.toLowerCase()) : 'Guru'
    if (!peran) return ditolak.push({ baris: no, alasan: 'Peran harus Pimpinan, Wali Kelas, Guru Fan, atau Guru' })
    const jenjang = jenjangDari(b.jenjang ?? '')
    if (!jenjang) return ditolak.push({ baris: no, alasan: 'Jenjang harus TPQ atau Madrasah' })
    const honor = rupiahDari(b.honor ?? '')
    if (honor === null) return ditolak.push({ baris: no, alasan: 'Honor harus angka 0 atau lebih (mis. 800000 atau 800.000)' })
    const dt = rakitDetail(b, ALIAS_CSV_GURU, DETAIL_GURU)
    if (dt.galat) return ditolak.push({ baris: no, alasan: dt.galat })
    const idGuru = String((dt.detail as { idGuru?: string }).idGuru ?? '')
    if (idGuru && (idGuruAda.has(idGuru) || idGuruFile.has(idGuru))) {
      return ditolak.push({ baris: no, alasan: `ID Guru ${idGuru} sudah dipakai` })
    }
    if (idGuru) idGuruFile.add(idGuru)
    namaAda.add(b.nama.toLowerCase())
    const id = crypto.randomUUID()
    detailBaru.push({ ...detailGuruKosong(), ...dt.detail, guruId: id })
    baru.push({
      id,
      nama: b.nama.slice(0, 100),
      peranGuru: peran,
      kelasId: kelasAda.get(`${jenjang}|${normalisasiMetode(b.kelas ?? '').toLowerCase()}`) ?? null,
      jenjang,
      hp: (b.hp || b.telepon || '').slice(0, 30),
      honor,
      honorLunas: false,
    })
  })
  const stmts = [...insertJson(c.env.DB, guru, baru), ...insertJson(c.env.DB, guruDetail, detailBaru)]
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
    baru.push({ id: crypto.randomUUID(), santriId: s.id, jenis, mapel: normalisasiMetode(b.mapel || 'Umum').slice(0, 100), nilai: angka, tanggal, semester: semesterDari(tanggal) })
  })
  const stmts = insertJson(c.env.DB, nilai, baru)
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ dibuat: baru.length, ditolak })
})

// ---------- Template ----------
const TEMPLATE: Record<string, string[][]> = {
  santri: [
    ['Nama', 'NIS', 'Kelas', 'Jenis Kelamin', 'Jenjang', 'Angkatan', 'Rombel', 'Wali', 'HP Wali', 'Alamat',
      'NIK', 'No KK', 'Tempat Lahir', 'Tanggal Lahir', 'Hobi', 'Cita-cita', 'Status Rumah', 'Status Mukim', 'Status Anak', 'Anak Ke',
      'Jalan/Dusun', 'Desa/Kecamatan', 'Kode Pos', 'RT', 'RW',
      'NIK Ayah', 'Nama Ayah', 'Pendidikan Ayah', 'Penghasilan Ayah', 'Kontak Ayah',
      'NIK Ibu', 'Nama Ibu', 'Pendidikan Ibu', 'Pekerjaan Ibu', 'Penghasilan Ibu', 'Kontak Ibu',
      'Tanggal Masuk', 'Status Masuk', 'Diterima di Kelas', 'NISN'],
    ['Ahmad Fauzi', '202401', "Qur'ani 3", 'L', 'TPQ', '2024', 'A', 'Bpk. Slamet', '081200000001', 'Jl. Merdeka 12',
      '3201234567890123', '3201234567890100', 'Surabaya', '2018-05-17', 'Menggambar', 'Dokter', 'Milik sendiri', 'Non-mukim (pulang-pergi)', 'Kandung', '2',
      'Jl. Merdeka 12', 'Wonokromo / Wonokromo', '60243', '3', '5',
      '3201234567890111', 'Slamet', 'SMA / MA', 'Rp1.000.000 - Rp2.000.000', '081200000011',
      '3201234567890122', 'Aminah', 'SMP / MTs', 'Ibu rumah tangga', 'Kurang dari Rp500.000', '081200000022',
      '2024-07-15', 'Baru', "Qur'ani 1", '0123456789'],
  ],
  guru: [
    ['Nama', 'Kelas', 'Peran', 'Jenjang', 'HP', 'Honor',
      'ID Guru', 'NIK', 'Tanggal Masuk', 'Status', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Nama Ibu Kandung',
      'Jalan/Dusun', 'Desa/Kecamatan', 'Kode Pos', 'RT', 'RW', 'Email'],
    ['Ustadz Ahmad', "Qur'ani 1", 'Wali Kelas', 'TPQ', '081200000101', '800000',
      'G-001', '3201234567890199', '2015-07-01', 'Tetap', 'L', 'Malang', '1988-03-20', 'Siti Aisyah',
      'Jl. Melati 4', 'Gubeng / Gubeng', '60281', '2', '7', 'ahmad@contoh.id'],
  ],
  nilai: [['Santri', 'Jenis', 'Mapel', 'Nilai', 'Tanggal'], ['202401', 'Harian', "Qur'ani", '85,5', hariIniWib()]],
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





