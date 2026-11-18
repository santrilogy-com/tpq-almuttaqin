import { describe, expect, it } from 'vitest'
import { DETAIL_GURU, DETAIL_SANTRI, detailGuruKosong, detailSantriKosong, tanggalLahirValid } from './biodata'

const ok = (s: { safeParse: (x: unknown) => { success: boolean } }, x: unknown) => s.safeParse(x).success
const pesan = (s: { safeParse: (x: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, x: unknown) => s.safeParse(x).error?.issues[0].message

describe('detail santri: format angka identitas', () => {
  const dasar = detailSantriKosong()
  it('semua kolom kosong adalah sah (semua opsional)', () => {
    expect(ok(DETAIL_SANTRI, dasar)).toBe(true)
  })
  it('NIK / No. KK / NIK ayah / NIK ibu harus tepat 16 digit', () => {
    for (const k of ['nik', 'noKk', 'nikAyah', 'nikIbu'] as const) {
      expect(ok(DETAIL_SANTRI, { ...dasar, [k]: '3201234567890123' }), `${k} 16 digit`).toBe(true)
      for (const salah of ['123', '320123456789012', '32012345678901234', '320123456789012a', '3201 2345 6789 0123']) {
        expect(ok(DETAIL_SANTRI, { ...dasar, [k]: salah }), `${k}="${salah}"`).toBe(false)
      }
    }
    expect(pesan(DETAIL_SANTRI, { ...dasar, nik: '123' })).toBe('NIK harus 16 digit angka')
  })
  it('NISN 10 digit, kode pos 5 digit, RT/RW 1-3 digit', () => {
    expect(ok(DETAIL_SANTRI, { ...dasar, nisn: '0123456789', kodePos: '60111', rt: '5', rw: '012' })).toBe(true)
    expect(ok(DETAIL_SANTRI, { ...dasar, nisn: '012345678' })).toBe(false)
    expect(ok(DETAIL_SANTRI, { ...dasar, kodePos: '6011' })).toBe(false)
    expect(ok(DETAIL_SANTRI, { ...dasar, rt: '1234' })).toBe(false)
    expect(ok(DETAIL_SANTRI, { ...dasar, rw: 'A1' })).toBe(false)
  })
  it('kontak: angka, +, -, spasi, kurung; 6-20 karakter', () => {
    expect(ok(DETAIL_SANTRI, { ...dasar, kontakAyah: '+62 812-3456-7890' })).toBe(true)
    expect(ok(DETAIL_SANTRI, { ...dasar, kontakIbu: '0812345' })).toBe(true)
    expect(ok(DETAIL_SANTRI, { ...dasar, kontakAyah: '12345' })).toBe(false)
    expect(ok(DETAIL_SANTRI, { ...dasar, kontakIbu: '0812-abc-123' })).toBe(false)
    expect(ok(DETAIL_SANTRI, { ...dasar, kontakAyah: '<script>' })).toBe(false)
  })
  it('anak ke: bilangan bulat 1-30 atau kosong (null)', () => {
    expect(ok(DETAIL_SANTRI, { ...dasar, anakKe: 3 })).toBe(true)
    expect(ok(DETAIL_SANTRI, { ...dasar, anakKe: null })).toBe(true)
    for (const salah of [0, -1, 31, 2.5, '3']) expect(ok(DETAIL_SANTRI, { ...dasar, anakKe: salah }), String(salah)).toBe(false)
  })
  it('batas panjang teks', () => {
    expect(ok(DETAIL_SANTRI, { ...dasar, hobi: 'x'.repeat(100) })).toBe(true)
    expect(ok(DETAIL_SANTRI, { ...dasar, hobi: 'x'.repeat(101) })).toBe(false)
  })
  it('spasi di tepi dipangkas', () => {
    const r = DETAIL_SANTRI.parse({ ...dasar, namaAyah: '  Slamet  ', nik: ' 3201234567890123 ' })
    expect(r.namaAyah).toBe('Slamet')
    expect(r.nik).toBe('3201234567890123')
  })
})

describe('tanggal lahir & tanggal masuk', () => {
  it('tanggalLahirValid: nyata, >= 1900, tidak di masa depan', () => {
    const hariIni = '2026-11-18'
    expect(tanggalLahirValid('2018-05-17', hariIni)).toBe(true)
    expect(tanggalLahirValid('2026-11-18', hariIni)).toBe(true)
    expect(tanggalLahirValid('2026-11-19', hariIni)).toBe(false)
    expect(tanggalLahirValid('1899-12-31', hariIni)).toBe(false)
    expect(tanggalLahirValid('2018-02-30', hariIni)).toBe(false)
    expect(tanggalLahirValid('17-05-2018', hariIni)).toBe(false)
  })
  it('skema: tanggal lahir masa depan ditolak, kosong diperbolehkan', () => {
    const d = detailSantriKosong()
    expect(ok(DETAIL_SANTRI, { ...d, tanggalLahir: '2999-01-01' })).toBe(false)
    expect(ok(DETAIL_SANTRI, { ...d, tanggalLahir: '' })).toBe(true)
    expect(ok(DETAIL_SANTRI, { ...d, tanggalMasuk: '2024-07-15' })).toBe(true)
    expect(ok(DETAIL_SANTRI, { ...d, tanggalMasuk: '2024-02-31' })).toBe(false)
    expect(ok(DETAIL_SANTRI, { ...d, tanggalMasuk: '1980-01-01' })).toBe(false)
  })
})

describe('detail guru', () => {
  const dasar = detailGuruKosong()
  it('kosong sah; NIK 16 digit; jenis kelamin hanya L/P/kosong', () => {
    expect(ok(DETAIL_GURU, dasar)).toBe(true)
    expect(ok(DETAIL_GURU, { ...dasar, nik: '3201234567890123', jenisKelamin: 'P' })).toBe(true)
    expect(ok(DETAIL_GURU, { ...dasar, nik: '123' })).toBe(false)
    expect(ok(DETAIL_GURU, { ...dasar, jenisKelamin: 'X' })).toBe(false)
  })
  it('email harus berformat email atau kosong', () => {
    expect(ok(DETAIL_GURU, { ...dasar, email: 'ustadz@basmalah.id' })).toBe(true)
    for (const salah of ['ustadz', 'ustadz@', '@basmalah.id', 'a b@c.id', 'a@b']) expect(ok(DETAIL_GURU, { ...dasar, email: salah }), salah).toBe(false)
  })
  it('kode pos, RT, RW, tanggal sama aturannya dengan santri', () => {
    expect(ok(DETAIL_GURU, { ...dasar, kodePos: '60111', rt: '1', rw: '2', tanggalLahir: '1990-01-01', tanggalMasuk: '2015-07-01' })).toBe(true)
    expect(ok(DETAIL_GURU, { ...dasar, kodePos: '601' })).toBe(false)
    expect(ok(DETAIL_GURU, { ...dasar, tanggalLahir: '2999-01-01' })).toBe(false)
  })
})
