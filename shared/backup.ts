// Format backup v2 + validasinya. Murni (tanpa I/O): dipakai Worker (restore) dan
// frontend (pratinjau). Akun pengguna/sandi SENGAJA tidak termasuk dalam backup.
import { z } from 'zod'
import { DETAIL_GURU, DETAIL_SANTRI } from './biodata'
import { JENJANG, JENIS_NILAI, JENIS_SETORAN, MAKS_JUMLAH, STATUS_ABSEN, STATUS_SPP, normalisasiMetode, periodeValid, tglValid } from './domain'

export const FORMAT_BACKUP = 'tpq-v2'
/** Logo: hanya raster base64 (PNG/JPEG/WebP). SVG ditolak karena dapat memuat skrip. */
export const LOGO_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/
export const MAKS_LOGO = 150_000
export const MAKS_FOTO = 150_000

/**
 * Gambar sah: data URL PNG/JPEG/WebP base64, tidak melebihi maks karakter, DAN byte awal file cocok
 * dengan tipe yang diklaim (mencegah berkas lain/HTML disamarkan sebagai gambar).
 */
export function gambarValid(url: string, maks: number): boolean {
  if (typeof url !== 'string' || url.length > maks || !LOGO_REGEX.test(url)) return false
  try {
    const mime = url.slice(5, url.indexOf(';'))
    const awal = atob(url.slice(url.indexOf(',') + 1).slice(0, 16)) // 16 karakter base64 = 12 byte
    if (mime === 'image/png') return awal.charCodeAt(0) === 0x89 && awal.slice(1, 4) === 'PNG'
    if (mime === 'image/jpeg') return awal.charCodeAt(0) === 0xff && awal.charCodeAt(1) === 0xd8 && awal.charCodeAt(2) === 0xff
    if (mime === 'image/webp') return awal.slice(0, 4) === 'RIFF' && awal.slice(8, 12) === 'WEBP'
    return false
  } catch {
    return false
  }
}
export const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const

const id = z.string().min(1).max(64)
const tgl = z.string().refine(tglValid, 'tanggal tidak valid')
const teks = (n = 300) => z.string().max(n)
const rp = z.number().int().min(0).max(MAKS_JUMLAH)
const rpPositif = z.number().int().min(1).max(MAKS_JUMLAH)
const jenjang = z.enum(JENJANG)
const jam = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const nullId = id.nullable()

export const SKEMA = {
  lembaga: z.object({
    jenjang,
    nama: teks(100).min(1),
    namaSingkat: teks(20).min(1),
    pimpinan: teks(100),
    alamat: teks(300),
    telepon: teks(30),
    tahunBerdiri: z.number().int().min(1800).max(2200).nullable(),
    nsmNpsn: teks(30),
    motto: teks(200),
    logo: z.string().refine((v) => gambarValid(v, MAKS_LOGO), 'logo harus gambar PNG/JPEG/WebP yang valid (maks 150 KB)').nullable(),
    tarifSpp: z.number().int().min(0).max(100_000_000),
    tahunAjaran: teks(20),
  }),
  kelas: z.object({ id, nama: teks(100).min(1), jenjang, pengajar: teks(100), jadwal: teks(100), ruang: teks(100) }),
  santri: z.object({
    id,
    nis: teks(30).min(1),
    nama: teks(100).min(1),
    jenisKelamin: z.enum(['L', 'P']),
    jenjang,
    kelasId: nullId,
    jilid: teks(30),
    angkatan: teks(20),
    rombel: teks(30),
    status: z.enum(['aktif', 'keluar', 'lulus']),
    wali: teks(100),
    hpWali: teks(30),
    alamat: teks(300),
    createdAt: z.number().int(),
  }),
  guru: z.object({
    id,
    nama: teks(100).min(1),
    peranGuru: z.enum(['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru']),
    kelasId: nullId,
    jenjang,
    hp: teks(30),
    honor: rp,
    honorLunas: z.boolean(),
  }),
  pertemuan: z.object({ id, kelasId: id, tanggal: tgl, materi: teks(200) }),
  absensi: z.object({ pertemuanId: id, santriId: id, status: z.enum(STATUS_ABSEN) }),
  nilai: z.object({
    id,
    santriId: id,
    jenis: z.enum(JENIS_NILAI),
    mapel: teks(100).min(1),
    nilai: z.number().min(0).max(100),
    tanggal: tgl,
    semester: teks(30),
  }),
  setoran: z.object({
    id,
    santriId: id,
    jenis: z.preprocess((v) => (typeof v === 'string' ? normalisasiMetode(v) : v), z.enum(JENIS_SETORAN)),
    materi: teks(200).min(1),
    nilai: z.enum(['Lancar', 'Cukup', 'Perlu Bimbingan']),
    tanggal: tgl,
  }),
  tabungan: z.object({
    id,
    santriId: id,
    jenis: z.enum(['setor', 'tarik']),
    jumlah: rpPositif,
    tanggal: tgl,
    catatan: teks(200),
  }),
  transaksi: z.object({
    id,
    jenis: z.enum(['masuk', 'keluar']),
    jenjang,
    kategori: teks(100).min(1),
    nama: teks(200).min(1),
    jumlah: rpPositif,
    tanggal: tgl,
    catatan: teks(300),
    tagihanSppId: nullId,
  }),
  tagihanSpp: z.object({
    id,
    santriId: id,
    periode: z.string().refine(periodeValid, 'periode tidak valid'),
    jumlah: rpPositif,
    status: z.enum(STATUS_SPP),
  }),
  pengumuman: z.object({ id, judul: teks(150).min(1), isi: teks(2000).min(1), tampil: z.boolean(), createdAt: z.number().int() }),
  jadwalKbm: z.object({ id, kelasId: nullId, hari: z.enum(HARI_LIST), jamMulai: jam, jamSelesai: jam, mapel: teks(100).min(1), guruId: nullId }),
  alokasiWaktu: z.object({ id, kelasId: nullId, mapel: teks(100).min(1), jamPerMinggu: z.number().int().min(1).max(60), hari: teks(60) }),
  piket: z.object({ id, guruId: id, hari: z.enum(HARI_LIST), keterangan: teks(200) }),
  absensiGuru: z.object({ tanggal: tgl, guruId: id, status: z.enum(STATUS_ABSEN), kelompok: z.enum(['Guru', 'Pimpinan']) }),
  rapbm: z.object({ id, pos: teks(100).min(1), jenis: z.enum(['masuk', 'keluar']), jenjang, rencana: rp }),
  biaya: z.object({ id, nama: teks(100).min(1), jumlah: rp, keterangan: teks(200) }),
  targetTabungan: z.object({ id, nama: teks(100).min(1), target: rpPositif, terkumpul: rp }),
  // Biodata tambahan 1:1 dengan santri/guru (kolomnya didefinisikan di shared/biodata.ts).
  santriDetail: z.object({ santriId: id, ...DETAIL_SANTRI.shape }),
  guruDetail: z.object({ guruId: id, ...DETAIL_GURU.shape }),
  foto: z.object({
    jenis: z.enum(['santri', 'guru']),
    ownerId: id,
    data: z.string().refine((v) => gambarValid(v, MAKS_FOTO), 'foto harus gambar PNG/JPEG/WebP yang valid (maks 150 KB)'),
    updatedAt: z.number().int(),
  }),
} as const

export type KunciBackup = keyof typeof SKEMA
export const KUNCI_BACKUP = Object.keys(SKEMA) as KunciBackup[]
export type DataBackup = { [K in KunciBackup]: z.infer<(typeof SKEMA)[K]>[] }

export const SKEMA_BACKUP = z.object({
  format: z.literal(FORMAT_BACKUP),
  versi: z.literal(1),
  dibuat: z.string(),
  data: z.object(Object.fromEntries(KUNCI_BACKUP.map((k) => [k, z.array(SKEMA[k]).max(50_000)])) as {
    [K in KunciBackup]: z.ZodArray<(typeof SKEMA)[K]>
  }),
})

/** Pesan galat pertama yang mudah dibaca dari hasil safeParse. */
export function pesanZod(err: z.ZodError): string {
  const i = err.issues[0]
  return `${i.path.join('.') || 'data'}: ${i.message}`
}

/**
 * Integritas antar-tabel: setiap rujukan harus menunjuk baris yang ada, tanpa duplikat kunci,
 * dan saldo tabungan tiap santri tidak boleh minus. Mengembalikan pesan galat pertama, atau null.
 * Dicek SEBELUM menyentuh database agar restore yang gagal tidak merusak data yang ada.
 */
export function cekRelasi(d: DataBackup): string | null {
  const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id))
  const unik = (nama: string, nilai: string[]) => {
    const s = new Set<string>()
    for (const v of nilai) {
      if (s.has(v)) return `${nama}: duplikat "${v}"`
      s.add(v)
    }
    return null
  }
  const dup =
    unik('kelas.id', d.kelas.map((x) => x.id)) ??
    unik('santri.id', d.santri.map((x) => x.id)) ??
    unik('santri.nis', d.santri.map((x) => x.nis)) ??
    unik('guru.id', d.guru.map((x) => x.id)) ??
    unik('guru.nama', d.guru.map((x) => x.nama)) ??
    unik('pertemuan.id', d.pertemuan.map((x) => x.id)) ??
    unik('pertemuan (kelas+tanggal)', d.pertemuan.map((x) => `${x.kelasId}|${x.tanggal}`)) ??
    unik('absensi (pertemuan+santri)', d.absensi.map((x) => `${x.pertemuanId}|${x.santriId}`)) ??
    unik('tagihanSpp (santri+periode)', d.tagihanSpp.map((x) => `${x.santriId}|${x.periode}`)) ??
    unik('absensiGuru', d.absensiGuru.map((x) => `${x.tanggal}|${x.guruId}|${x.kelompok}`)) ??
    unik('lembaga.jenjang', d.lembaga.map((x) => x.jenjang)) ??
    unik('foto (jenis+pemilik)', d.foto.map((x) => `${x.jenis}|${x.ownerId}`)) ??
    unik('santriDetail.santriId', d.santriDetail.map((x) => x.santriId)) ??
    unik('guruDetail.guruId', d.guruDetail.map((x) => x.guruId)) ??
    unik('transaksi.id', d.transaksi.map((x) => x.id)) ??
    unik('transaksi.tagihanSppId', d.transaksi.filter((x) => x.tagihanSppId).map((x) => x.tagihanSppId!))
  if (dup) return dup

  const kelas = ids(d.kelas)
  const santri = ids(d.santri)
  const guru = ids(d.guru)
  const pertemuan = ids(d.pertemuan)
  const cek = (nama: string, ada: boolean, nilai: string) => (ada ? null : `${nama}: rujukan "${nilai}" tidak ada`)
  const salah =
    d.santri.map((x) => x.kelasId && cek('santri.kelasId', kelas.has(x.kelasId), x.kelasId)).find(Boolean) ??
    d.guru.map((x) => x.kelasId && cek('guru.kelasId', kelas.has(x.kelasId), x.kelasId)).find(Boolean) ??
    d.pertemuan.map((x) => cek('pertemuan.kelasId', kelas.has(x.kelasId), x.kelasId)).find(Boolean) ??
    d.absensi.map((x) => cek('absensi.pertemuanId', pertemuan.has(x.pertemuanId), x.pertemuanId) ?? cek('absensi.santriId', santri.has(x.santriId), x.santriId)).find(Boolean) ??
    d.nilai.map((x) => cek('nilai.santriId', santri.has(x.santriId), x.santriId)).find(Boolean) ??
    d.setoran.map((x) => cek('setoran.santriId', santri.has(x.santriId), x.santriId)).find(Boolean) ??
    d.tabungan.map((x) => cek('tabungan.santriId', santri.has(x.santriId), x.santriId)).find(Boolean) ??
    d.tagihanSpp.map((x) => cek('tagihanSpp.santriId', santri.has(x.santriId), x.santriId)).find(Boolean) ??
    d.jadwalKbm.map((x) => (x.kelasId && cek('jadwalKbm.kelasId', kelas.has(x.kelasId), x.kelasId)) || (x.guruId && cek('jadwalKbm.guruId', guru.has(x.guruId), x.guruId))).find(Boolean) ??
    d.alokasiWaktu.map((x) => x.kelasId && cek('alokasiWaktu.kelasId', kelas.has(x.kelasId), x.kelasId)).find(Boolean) ??
    d.piket.map((x) => cek('piket.guruId', guru.has(x.guruId), x.guruId)).find(Boolean) ??
    d.absensiGuru.map((x) => cek('absensiGuru.guruId', guru.has(x.guruId), x.guruId)).find(Boolean) ??
    d.santriDetail.map((x) => cek('santriDetail.santriId', santri.has(x.santriId), x.santriId)).find(Boolean) ??
    d.guruDetail.map((x) => cek('guruDetail.guruId', guru.has(x.guruId), x.guruId)).find(Boolean) ??
    d.foto.map((x) => cek('foto.ownerId', (x.jenis === 'santri' ? santri : guru).has(x.ownerId), `${x.jenis}:${x.ownerId}`)).find(Boolean)
  if (salah) return salah

  const saldo = new Map<string, number>()
  for (const t of d.tabungan) saldo.set(t.santriId, (saldo.get(t.santriId) ?? 0) + (t.jenis === 'setor' ? t.jumlah : -t.jumlah))
  for (const [sid, v] of saldo) if (v < 0) return `tabungan: saldo santri "${sid}" menjadi minus (${v})`
  return null
}

/** Jumlah baris per tabel, untuk pratinjau sebelum memulihkan. */
export const hitungBaris = (d: DataBackup) => Object.fromEntries(KUNCI_BACKUP.map((k) => [k, d[k].length])) as Record<KunciBackup, number>

export const dataKosong = (): DataBackup => Object.fromEntries(KUNCI_BACKUP.map((k) => [k, []])) as unknown as DataBackup




