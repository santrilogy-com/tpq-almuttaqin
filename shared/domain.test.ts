import { describe, expect, it } from 'vitest'
import { naikJilid, nilaiAkhir, predikat, rata } from './domain'

describe('predikat', () => {
  it('batas nilai', () => {
    expect(predikat(90)).toBe('A (Sangat Baik)')
    expect(predikat(89.9)).toBe('B (Baik)')
    expect(predikat(86.4)).toBe('B (Baik)')
    expect(predikat(80)).toBe('B (Baik)')
    expect(predikat(70)).toBe('C (Cukup)')
    expect(predikat(60)).toBe('D (Kurang)')
    expect(predikat(59.9)).toBe('E (Perlu Bimbingan)')
  })
})

describe('naikJilid', () => {
  it('naik satu tingkat', () => {
    expect(naikJilid('Iqra 1')).toBe('Iqra 2')
    expect(naikJilid('Iqra 6')).toBe('Tahfidz Juz 30')
  })
  it('jilid tertinggi atau tak dikenal tetap', () => {
    expect(naikJilid('Tahfidz Juz 28')).toBe('Tahfidz Juz 28')
    expect(naikJilid('Entah')).toBe('Entah')
  })
})

describe('rata', () => {
  it('kosong -> null, dibulatkan 1 desimal', () => {
    expect(rata([])).toBeNull()
    expect(rata([80, 85, 90])).toBe(85)
    expect(rata([70, 71])).toBe(70.5)
  })
})

describe('nilaiAkhir', () => {
  it('semua komponen: 40/30/30', () => {
    expect(nilaiAkhir({ harian: 80, imda: 70, praktek: 90 })).toEqual({
      akhir: 80,
      lengkap: true,
    })
  })
  it('komponen kosong TIDAK dihitung 0 (perbaikan v22: Harian 70 saja = 70, bukan 28)', () => {
    expect(nilaiAkhir({ harian: 70, imda: null, praktek: null })).toEqual({
      akhir: 70,
      lengkap: false,
    })
  })
  it('bobot dihitung ulang dari komponen yang ada', () => {
    // (80*0.4 + 60*0.3) / 0.7 = 50 / 0.7 = 71.4
    expect(nilaiAkhir({ harian: 80, imda: 60, praktek: null })).toEqual({
      akhir: 71.4,
      lengkap: false,
    })
  })
  it('nilai 0 yang sungguhan tetap dihitung', () => {
    expect(nilaiAkhir({ harian: 0, imda: 100, praktek: 100 }).akhir).toBe(60)
  })
  it('tanpa nilai -> null', () => {
    expect(nilaiAkhir({ harian: null, imda: null, praktek: null })).toEqual({
      akhir: null,
      lengkap: false,
    })
  })
})


import { semesterDari, tglValid } from './domain'

describe('tglValid', () => {
  it('menerima tanggal nyata, menolak yang tidak ada', () => {
    expect(tglValid('2026-11-16')).toBe(true)
    expect(tglValid('2028-02-29')).toBe(true) // kabisat
    expect(tglValid('2026-02-29')).toBe(false)
    expect(tglValid('2026-02-31')).toBe(false)
    expect(tglValid('2026-13-01')).toBe(false)
    expect(tglValid('16-11-2026')).toBe(false)
    expect(tglValid('')).toBe(false)
  })
})

describe('semesterDari', () => {
  it('Juli-Desember = Ganjil, Januari-Juni = Genap tahun ajaran sebelumnya', () => {
    expect(semesterDari('2026-07-01')).toBe('2026/2027 Ganjil')
    expect(semesterDari('2026-12-31')).toBe('2026/2027 Ganjil')
    expect(semesterDari('2027-01-01')).toBe('2026/2027 Genap')
    expect(semesterDari('2027-06-30')).toBe('2026/2027 Genap')
  })
})

import { hariIniWib, keRupiah, periodeValid } from './domain'

describe('keRupiah', () => {
  it('menerima angka polos dan format ribuan', () => {
    expect(keRupiah('50000')).toBe(50000)
    expect(keRupiah('50.000')).toBe(50000)
    expect(keRupiah('1.250.000')).toBe(1250000)
    expect(keRupiah('Rp 50.000')).toBe(50000)
    expect(keRupiah(' rp. 7.500 ')).toBe(7500)
  })
  it('menolak desimal, huruf, nol, negatif, titik salah tempat, dan terlalu besar', () => {
    for (const x of ['50,5', '50.5', 'abc', '0', '-5000', '', '12.34', '1.2345', '5e3', '2.000.000.000'])
      expect(keRupiah(x), x).toBeNull()
  })
})

describe('hariIniWib', () => {
  it('memakai WIB (UTC+7): 17:30 UTC sudah hari berikutnya di WIB', () => {
    expect(hariIniWib(Date.UTC(2026, 10, 16, 17, 30))).toBe('2026-11-17')
    expect(hariIniWib(Date.UTC(2026, 10, 16, 16, 59))).toBe('2026-11-16')
  })
})

describe('periodeValid', () => {
  it('YYYY-MM dengan bulan 01-12', () => {
    expect(periodeValid('2026-11')).toBe(true)
    expect(periodeValid('2026-00')).toBe(false)
    expect(periodeValid('2026-13')).toBe(false)
    expect(periodeValid('2026-1')).toBe(false)
  })
})
