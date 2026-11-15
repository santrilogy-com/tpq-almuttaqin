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

