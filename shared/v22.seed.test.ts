/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { cekRelasi, FORMAT_BACKUP, SKEMA_BACKUP } from './backup'
import { normalisasiMetode } from './domain'
import seed from './fixtures/v22-seed.json'
import { konversiV22 } from './v22'

// Data contoh ASLI dari engine v22 (40 santri, 5 guru, 10 kelas), dihasilkan oleh seedData().
const HASIL = konversiV22(seed, Date.UTC(2026, 10, 16, 3, 0))
const d = HASIL.data
const lama = seed as any

describe('konversi data contoh v22 yang asli', () => {
  it('lolos validasi skema dan integritas relasi v2', () => {
    const p = SKEMA_BACKUP.safeParse({ format: FORMAT_BACKUP, versi: 1, dibuat: 'x', data: d })
    expect(p.success, p.success ? '' : JSON.stringify(p.error.issues[0])).toBe(true)
    expect(cekRelasi(d)).toBeNull()
  })

  it('jumlah baris tabel inti sama dengan v22 (tidak ada yang hilang diam-diam)', () => {
    expect(d.santri).toHaveLength(lama.santri.length)
    expect(d.guru).toHaveLength(lama.guru.length)
    expect(d.kelas).toHaveLength(lama.kelas.length)
    expect(d.transaksi).toHaveLength(lama.keuanganTx.length)
    expect(d.nilai).toHaveLength(lama.nilai.length)
    expect(d.setoran).toHaveLength(lama.hafalanLog.length)
    expect(d.pengumuman).toHaveLength(lama.pengumuman.length)
    expect(d.rapbm).toHaveLength(lama.rapbm.length)
    expect(d.biaya).toHaveLength(lama.biaya.length)
    expect(d.targetTabungan).toHaveLength(lama.target.length)
    expect(d.alokasiWaktu).toHaveLength(lama.alokasiWaktu.length)
    expect(d.jadwalKbm).toHaveLength(lama.jadwalKbm.length)
    expect(d.piket).toHaveLength(lama.jadwalPiket.length)
    expect(d.absensiGuru).toHaveLength(lama.absensiGuru.length)
  })

  it('saldo kas v2 = saldo kas v22 (dihitung independen dari data mentah)', () => {
    const v22 = lama.keuanganTx.reduce((a: number, t: any) => a + (t.jenis === 'Masuk' ? t.jumlah : -t.jumlah), 0)
    const v2 = d.transaksi.reduce((a, t) => a + (t.jenis === 'masuk' ? t.jumlah : -t.jumlah), 0)
    expect(v2).toBe(v22)
  })

  it('tabungan: saldo tiap santri v2 = angka tabungan yang tampil di v22', () => {
    const saldo = new Map<string, number>()
    for (const t of d.tabungan) saldo.set(t.santriId, (saldo.get(t.santriId) ?? 0) + (t.jenis === 'setor' ? t.jumlah : -t.jumlah))
    for (const s of lama.santri) expect(saldo.get(s.id) ?? 0, `santri ${s.nama}`).toBe(s.tabungan ?? 0)
    const total = [...saldo.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(lama.santri.reduce((a: number, s: any) => a + (s.tabungan ?? 0), 0))
  })

  it('setiap santri punya kelas yang benar (nama kelas v22 = nama kelas v2)', () => {
    const kelasById = new Map(d.kelas.map((k) => [k.id, k.nama]))
    for (const s of lama.santri) {
      const baru = d.santri.find((x) => x.id === s.id)!
      expect(kelasById.get(baru.kelasId!), `santri ${s.nama}`).toBe(normalisasiMetode(s.kelas))
    }
  })

  it('status santri dan jenjang dipetakan', () => {
    const lulus = lama.santri.filter((s: any) => s.status === 'Lulus').length
    const keluar = lama.santri.filter((s: any) => s.status === 'Keluar').length
    expect(d.santri.filter((s) => s.status === 'lulus')).toHaveLength(lulus)
    expect(d.santri.filter((s) => s.status === 'keluar')).toHaveLength(keluar)
    expect(d.santri.filter((s) => s.jenjang === 'MI')).toHaveLength(lama.santri.filter((s: any) => s.jenjang === 'Ibtidaiyah').length)
  })

  it('akun login tidak ikut dan tidak ada hash sandi di hasil', () => {
    expect(JSON.stringify(d)).not.toMatch(/hash|salt|sandi/i)
  })

  it('melaporkan temuan nyata ke pengguna (tidak diam)', () => {
    // data contoh punya guru "TPQ dan Ibtidaiyah" -> harus ada peringatannya
    expect(HASIL.peringatan.join('\n')).toMatch(/TPQ dan Ibtidaiyah/)
  })
})


