// Biodata tambahan santri dan guru (tabel santri_detail / guru_detail). Murni (tanpa I/O):
// dipakai Worker (validasi API + backup + import) dan frontend (formulir).
import { z } from 'zod'
import { hariIniWib, tglValid } from './domain'

const kosongAtau = (cocok: (v: string) => boolean, pesan: string) =>
  z.string().trim().refine((v) => v === '' || cocok(v), pesan)

const angka = (n: number, label: string) =>
  kosongAtau((v) => new RegExp(`^\\d{${n}}$`).test(v), `${label} harus ${n} digit angka`)

/** Tanggal lahir: tanggal nyata, tahun >= 1900, tidak di masa depan. Kosong diperbolehkan. */
export const tanggalLahirValid = (t: string, sekarang: string = hariIniWib()) =>
  tglValid(t) && t >= '1900-01-01' && t <= sekarang

const tanggalLahir = kosongAtau((v) => tanggalLahirValid(v), 'Tanggal lahir tidak valid (YYYY-MM-DD, tidak boleh di masa depan)')
const tanggalMasuk = kosongAtau((v) => tglValid(v) && v >= '1990-01-01', 'Tanggal masuk tidak valid (YYYY-MM-DD)')
const kontak = kosongAtau((v) => /^[0-9+\-\s()]{6,20}$/.test(v), 'Nomor kontak tidak valid (angka, +, -, spasi; 6-20 karakter)')
const teks = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`)

export const NIK = angka(16, 'NIK')

// ---------------------------------------------------------------- Santri
// Setiap kolom string boleh kosong. Skema ini TANPA .default() (PATCH memakai .partial(); default akan
// menimpa kolom yang tidak dikirim).
export const DETAIL_SANTRI = z.object({
  nik: NIK,
  noKk: angka(16, 'No. KK'),
  tempatLahir: teks(100),
  tanggalLahir,
  hobi: teks(100),
  citaCita: teks(100),
  statusRumah: teks(60),
  statusMukim: teks(60),
  statusAnak: teks(60),
  anakKe: z.number().int('Anak ke- harus bilangan bulat').min(1, 'Anak ke- minimal 1').max(30, 'Anak ke- maksimal 30').nullable(),
  jalan: teks(150),
  desaKecamatan: teks(150),
  kodePos: angka(5, 'Kode pos'),
  rt: kosongAtau((v) => /^\d{1,3}$/.test(v), 'RT harus angka (maks 3 digit)'),
  rw: kosongAtau((v) => /^\d{1,3}$/.test(v), 'RW harus angka (maks 3 digit)'),
  nikAyah: angka(16, 'NIK ayah'),
  namaAyah: teks(100),
  pendidikanAyah: teks(60),
  penghasilanAyah: teks(60),
  kontakAyah: kontak,
  nikIbu: angka(16, 'NIK ibu'),
  namaIbu: teks(100),
  pendidikanIbu: teks(60),
  pekerjaanIbu: teks(100),
  penghasilanIbu: teks(60),
  kontakIbu: kontak,
  tanggalMasuk,
  statusMasuk: teks(60),
  diterimaDiKelas: teks(100),
  nisn: angka(10, 'NISN'),
})
export type DetailSantri = z.infer<typeof DETAIL_SANTRI>
export const DETAIL_SANTRI_KUNCI = Object.keys(DETAIL_SANTRI.shape) as (keyof DetailSantri)[]
export const detailSantriKosong = (): DetailSantri =>
  Object.fromEntries(DETAIL_SANTRI_KUNCI.map((k) => [k, k === 'anakKe' ? null : ''])) as DetailSantri

// ---------------------------------------------------------------- Guru
export const DETAIL_GURU = z.object({
  idGuru: teks(30),
  nik: NIK,
  tanggalMasuk,
  status: teks(60),
  jenisKelamin: z.enum(['', 'L', 'P']),
  tempatLahir: teks(100),
  tanggalLahir,
  namaIbuKandung: teks(100),
  jalan: teks(150),
  desaKecamatan: teks(150),
  kodePos: angka(5, 'Kode pos'),
  rt: kosongAtau((v) => /^\d{1,3}$/.test(v), 'RT harus angka (maks 3 digit)'),
  rw: kosongAtau((v) => /^\d{1,3}$/.test(v), 'RW harus angka (maks 3 digit)'),
  noRekening: kosongAtau((v) => /^\d{5,20}$/.test(v), 'No. rekening harus 5 sampai 20 digit angka'),
  email: kosongAtau((v) => v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email tidak valid'),
})
export type DetailGuru = z.infer<typeof DETAIL_GURU>
export const DETAIL_GURU_KUNCI = Object.keys(DETAIL_GURU.shape) as (keyof DetailGuru)[]
export const detailGuruKosong = (): DetailGuru =>
  Object.fromEntries(DETAIL_GURU_KUNCI.map((k) => [k, ''])) as unknown as DetailGuru

// ---------------------------------------------------------------- Saran isian (daftar pilihan, tetap boleh diketik bebas)
export const SARAN = {
  statusRumah: ['Milik sendiri', 'Sewa / kontrak', 'Menumpang', 'Rumah dinas'],
  statusMukim: ['Mukim', 'Non-mukim (pulang-pergi)'],
  statusAnak: ['Kandung', 'Tiri', 'Angkat', 'Yatim', 'Piatu', 'Yatim piatu'],
  statusMasuk: ['Baru', 'Pindahan'],
  pendidikan: ['Tidak sekolah', 'SD / MI', 'SMP / MTs', 'SMA / MA', 'D3', 'S1', 'S2', 'S3'],
  penghasilan: ['Kurang dari Rp500.000', 'Rp500.000 - Rp1.000.000', 'Rp1.000.000 - Rp2.000.000', 'Rp2.000.000 - Rp5.000.000', 'Lebih dari Rp5.000.000'],
  statusGuru: ['Aktif', 'Nonaktif', 'Tetap', 'Honorer'],
} as const

/**
 * Alias judul kolom CSV (sudah dinormalkan: huruf kecil, tanpa spasi/tanda baca) -> kolom detail santri.
 * Dipakai import CSV supaya template dari berbagai sumber (EMIS, Dapodik, spreadsheet sendiri) terbaca.
 */
export const ALIAS_CSV_SANTRI: Record<string, keyof DetailSantri> = {
  nik: 'nik', nikmurid: 'nik', nikanak: 'nik',
  nokk: 'noKk', nomorkk: 'noKk', kk: 'noKk',
  tempatlahir: 'tempatLahir', tanggallahir: 'tanggalLahir', tgllahir: 'tanggalLahir',
  hobi: 'hobi', citacita: 'citaCita',
  statusrumah: 'statusRumah', statusmukim: 'statusMukim', statusanak: 'statusAnak',
  anakke: 'anakKe',
  jalan: 'jalan', jalandusun: 'jalan', dusun: 'jalan',
  desakecamatan: 'desaKecamatan', desa: 'desaKecamatan', kecamatan: 'desaKecamatan',
  kodepos: 'kodePos', rt: 'rt', rw: 'rw',
  nikayah: 'nikAyah', namaayah: 'namaAyah', pendidikanayah: 'pendidikanAyah', penghasilanayah: 'penghasilanAyah', kontakayah: 'kontakAyah',
  nikibu: 'nikIbu', namaibu: 'namaIbu', pendidikanibu: 'pendidikanIbu', pekerjaanibu: 'pekerjaanIbu', penghasilanibu: 'penghasilanIbu', kontakibu: 'kontakIbu',
  tanggalmasuk: 'tanggalMasuk', tglmasuk: 'tanggalMasuk',
  statusmasuk: 'statusMasuk', diterimadikelas: 'diterimaDiKelas',
  nisn: 'nisn',
}
