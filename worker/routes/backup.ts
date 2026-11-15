/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono'
import { z } from 'zod'
import { hariIniWib } from '../../shared/domain'
import { cekRelasi, FORMAT_BACKUP, hitungBaris, KUNCI_BACKUP, pesanZod, SKEMA_BACKUP, type DataBackup, type KunciBackup } from '../../shared/backup'
import * as S from '../db/schema'
import { hapusSemua, insertJson } from '../lib/json-insert'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'

export const backupRoutes = new Hono<AppEnv>()
backupRoutes.use('*', requireAuth, requirePeran('pimpinan'))

const TABEL: Record<KunciBackup, any> = {
  lembaga: S.lembaga,
  kelas: S.kelas,
  santri: S.santri,
  guru: S.guru,
  pertemuan: S.pertemuan,
  absensi: S.absensi,
  nilai: S.nilai,
  setoran: S.setoran,
  tabungan: S.tabungan,
  transaksi: S.transaksi,
  tagihanSpp: S.tagihanSpp,
  pengumuman: S.pengumuman,
  jadwalKbm: S.jadwalKbm,
  alokasiWaktu: S.alokasiWaktu,
  piket: S.piket,
  absensiGuru: S.absensiGuru,
  rapbm: S.rapbm,
  biaya: S.biaya,
  targetTabungan: S.targetTabungan,
}
// Urutan sisip: induk dulu. Urutan hapus: kebalikannya (anak dulu) agar kunci asing tidak melanggar.
const URUT_SISIP: KunciBackup[] = [
  'lembaga', 'kelas', 'santri', 'guru', 'pertemuan', 'absensi', 'nilai', 'setoran', 'tabungan',
  'tagihanSpp', 'transaksi', 'pengumuman', 'jadwalKbm', 'alokasiWaktu', 'piket', 'absensiGuru',
  'rapbm', 'biaya', 'targetTabungan',
]
const URUT_HAPUS = [...URUT_SISIP].reverse()

// Backup JSON seluruh data. TIDAK memuat akun/sandi/sesi (pelajaran dari kebocoran kredensial v22).
backupRoutes.get('/export', async (c) => {
  const db = c.get('db') as any
  const data: Record<string, unknown[]> = {}
  for (const k of KUNCI_BACKUP) {
    const rows = (await db.select().from(TABEL[k])) as Record<string, unknown>[]
    data[k] = k === 'guru' ? rows.map(({ userId: _u, ...sisa }) => sisa) : rows
  }
  const isi = { format: FORMAT_BACKUP, versi: 1, dibuat: new Date().toISOString(), data }
  return new Response(JSON.stringify(isi), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="tpq-backup-${hariIniWib()}.json"`,
      'cache-control': 'no-store',
    },
  })
})

// Ganti SELURUH data dengan isi backup, atomik (satu batch): gagal di tengah = data lama utuh.
backupRoutes.post('/restore', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { konfirmasi?: string; backup?: unknown } | null
  if (body?.konfirmasi !== 'PULIHKAN') return c.json({ error: 'Ketik PULIHKAN untuk mengonfirmasi' }, 400)
  const p = SKEMA_BACKUP.safeParse(body.backup)
  if (!p.success) return c.json({ error: `Format backup tidak valid — ${pesanZod(p.error)}` }, 400)
  const data = p.data.data as DataBackup
  const galat = cekRelasi(data)
  if (galat) return c.json({ error: `Backup tidak konsisten — ${galat}` }, 400)

  const d1 = c.env.DB
  const stmts = URUT_HAPUS.map((k) => hapusSemua(d1, TABEL[k]))
  for (const k of URUT_SISIP) stmts.push(...insertJson(d1, TABEL[k], data[k] as Record<string, unknown>[]))
  await d1.batch(stmts)
  return c.json({ ok: true, baris: hitungBaris(data) })
})

// Kosongkan semua data kerja. Akun pengguna dan identitas/tarif lembaga dipertahankan.
backupRoutes.post('/kosongkan', async (c) => {
  const p = z.object({ konfirmasi: z.literal('HAPUS SEMUA') }).safeParse(await c.req.json().catch(() => null))
  if (!p.success) return c.json({ error: 'Ketik HAPUS SEMUA untuk mengonfirmasi' }, 400)
  const d1 = c.env.DB
  await d1.batch(URUT_HAPUS.filter((k) => k !== 'lembaga').map((k) => hapusSemua(d1, TABEL[k])))
  return c.json({ ok: true })
})

