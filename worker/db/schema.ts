import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

// Konvensi: id = teks acak (crypto.randomUUID), waktu = epoch ms, uang = rupiah (integer).
const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())
const createdAt = () =>
  integer('created_at', { mode: 'number' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)

import { JENJANG } from '../../shared/domain'
export { JENJANG }
export const PERAN = ['pimpinan', 'guru'] as const
export type Peran = (typeof PERAN)[number]

// ---------- Auth ----------
export const users = sqliteTable('users', {
  id: id(),
  username: text('username').notNull().unique(),
  nama: text('nama').notNull(),
  peran: text('peran', { enum: PERAN }).notNull(),
  passwordHash: text('password_hash').notNull(),
  wajibGantiSandi: integer('wajib_ganti_sandi', { mode: 'boolean' })
    .notNull()
    .default(false),
  aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
  gagalLogin: integer('gagal_login').notNull().default(0),
  terkunciSampai: integer('terkunci_sampai'),
  createdAt: createdAt(),
})

export const sessions = sqliteTable(
  'sessions',
  {
    // SHA-256 dari token; token mentah hanya ada di cookie pengguna.
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
)

// ---------- Lembaga ----------
export const lembaga = sqliteTable('lembaga', {
  jenjang: text('jenjang', { enum: JENJANG }).primaryKey(),
  nama: text('nama').notNull(),
  namaSingkat: text('nama_singkat').notNull(),
  pimpinan: text('pimpinan').notNull().default(''),
  alamat: text('alamat').notNull().default(''),
  telepon: text('telepon').notNull().default(''),
  tahunBerdiri: integer('tahun_berdiri'),
  nsmNpsn: text('nsm_npsn').notNull().default(''),
  motto: text('motto').notNull().default(''),
  logo: text('logo'), // data URL kecil; pindah ke R2 bila perlu
  tarifSpp: integer('tarif_spp').notNull().default(0),
  tahunAjaran: text('tahun_ajaran').notNull().default(''),
})

// ---------- Akademik ----------
export const kelas = sqliteTable('kelas', {
  id: id(),
  nama: text('nama').notNull(),
  jenjang: text('jenjang', { enum: JENJANG }).notNull(),
  pengajar: text('pengajar').notNull().default(''),
  jadwal: text('jadwal').notNull().default(''),
  ruang: text('ruang').notNull().default(''),
})

export const santri = sqliteTable(
  'santri',
  {
    id: id(),
    nis: text('nis').notNull(),
    nama: text('nama').notNull(),
    jenisKelamin: text('jenis_kelamin', { enum: ['L', 'P'] }).notNull(),
    jenjang: text('jenjang', { enum: JENJANG }).notNull(),
    kelasId: text('kelas_id').references(() => kelas.id, {
      onDelete: 'set null',
    }),
    jilid: text('jilid').notNull().default('Iqra 1'),
    angkatan: text('angkatan').notNull().default(''),
    rombel: text('rombel').notNull().default(''),
    status: text('status', { enum: ['aktif', 'keluar', 'lulus'] })
      .notNull()
      .default('aktif'),
    wali: text('wali').notNull().default(''),
    hpWali: text('hp_wali').notNull().default(''),
    alamat: text('alamat').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('santri_nis_uq').on(t.nis),
    index('santri_kelas_idx').on(t.kelasId),
  ]
)

export const guru = sqliteTable('guru', {
  id: id(),
  nama: text('nama').notNull().unique(),
  // 'Guru Fan' hanya label daftar guru; hak akses ditentukan users.peran.
  peranGuru: text('peran_guru', {
    enum: ['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru'],
  })
    .notNull()
    .default('Guru'),
  kelasId: text('kelas_id').references(() => kelas.id, {
    onDelete: 'set null',
  }),
  jenjang: text('jenjang', { enum: JENJANG }).notNull(),
  hp: text('hp').notNull().default(''),
  honor: integer('honor').notNull().default(0),
  honorLunas: integer('honor_lunas', { mode: 'boolean' })
    .notNull()
    .default(false),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
})

export const pertemuan = sqliteTable(
  'pertemuan',
  {
    id: id(),
    kelasId: text('kelas_id')
      .notNull()
      .references(() => kelas.id, { onDelete: 'cascade' }),
    tanggal: text('tanggal').notNull(), // YYYY-MM-DD
    materi: text('materi').notNull().default(''),
  },
  (t) => [uniqueIndex('pertemuan_kelas_tgl_uq').on(t.kelasId, t.tanggal)]
)

export const absensi = sqliteTable(
  'absensi',
  {
    pertemuanId: text('pertemuan_id')
      .notNull()
      .references(() => pertemuan.id, { onDelete: 'cascade' }),
    santriId: text('santri_id')
      .notNull()
      .references(() => santri.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['H', 'I', 'S', 'A'] }).notNull(),
  },
  (t) => [uniqueIndex('absensi_uq').on(t.pertemuanId, t.santriId)]
)

export const nilai = sqliteTable(
  'nilai',
  {
    id: id(),
    santriId: text('santri_id')
      .notNull()
      .references(() => santri.id, { onDelete: 'cascade' }),
    jenis: text('jenis', { enum: ['Harian', 'Imda', 'Praktek'] }).notNull(),
    mapel: text('mapel').notNull(),
    nilai: integer('nilai').notNull(), // 0..100 (divalidasi di API)
    tanggal: text('tanggal').notNull(),
    semester: text('semester').notNull().default(''),
  },
  (t) => [index('nilai_santri_idx').on(t.santriId)]
)

export const setoran = sqliteTable(
  'setoran',
  {
    id: id(),
    santriId: text('santri_id')
      .notNull()
      .references(() => santri.id, { onDelete: 'cascade' }),
    jenis: text('jenis', { enum: ['Iqra', 'Hafalan'] }).notNull(),
    materi: text('materi').notNull(),
    nilai: text('nilai', {
      enum: ['Lancar', 'Cukup', 'Perlu Bimbingan'],
    }).notNull(),
    tanggal: text('tanggal').notNull(),
  },
  (t) => [index('setoran_santri_idx').on(t.santriId)]
)

// ---------- Keuangan ----------
export const tabungan = sqliteTable(
  'tabungan',
  {
    id: id(),
    santriId: text('santri_id')
      .notNull()
      .references(() => santri.id, { onDelete: 'cascade' }),
    jenis: text('jenis', { enum: ['setor', 'tarik'] }).notNull(),
    jumlah: integer('jumlah').notNull(),
    tanggal: text('tanggal').notNull(),
  },
  (t) => [index('tabungan_santri_idx').on(t.santriId)]
)

export const transaksi = sqliteTable(
  'transaksi',
  {
    id: id(),
    jenis: text('jenis', { enum: ['masuk', 'keluar'] }).notNull(),
    jenjang: text('jenjang', { enum: JENJANG }).notNull(),
    kategori: text('kategori').notNull(),
    nama: text('nama').notNull(),
    jumlah: integer('jumlah').notNull(),
    tanggal: text('tanggal').notNull(),
    // Terisi bila transaksi dibuat otomatis dari pelunasan SPP.
    tagihanSppId: text('tagihan_spp_id'),
  },
  (t) => [index('transaksi_tgl_idx').on(t.tanggal)]
)

export const tagihanSpp = sqliteTable(
  'tagihan_spp',
  {
    id: id(),
    santriId: text('santri_id')
      .notNull()
      .references(() => santri.id, { onDelete: 'cascade' }),
    periode: text('periode').notNull(), // YYYY-MM
    jumlah: integer('jumlah').notNull(),
    status: text('status', { enum: ['belum', 'lunas', 'telat'] })
      .notNull()
      .default('belum'),
  },
  (t) => [uniqueIndex('spp_santri_periode_uq').on(t.santriId, t.periode)]
)

export const pengumuman = sqliteTable('pengumuman', {
  id: id(),
  judul: text('judul').notNull(),
  isi: text('isi').notNull(),
  tampil: integer('tampil', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
})

