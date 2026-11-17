import { describe, expect, it } from 'vitest'
import { MAKS_FOTO, SKEMA_BACKUP, cekRelasi, dataKosong, gambarValid } from './backup'
import { konversiV22 } from './v22'

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const WEBP = 'data:image/webp;base64,UklGRgAAAABXRUJQVlA4IA=='

describe('gambarValid', () => {
  it('menerima JPEG, PNG, WebP dengan byte awal yang cocok', () => {
    expect(gambarValid(JPEG, MAKS_FOTO)).toBe(true)
    expect(gambarValid(PNG, MAKS_FOTO)).toBe(true)
    expect(gambarValid(WEBP, MAKS_FOTO)).toBe(true)
  })
  it('menolak SVG, tipe lain, dan data tanpa awalan', () => {
    expect(gambarValid('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', MAKS_FOTO)).toBe(false)
    expect(gambarValid('data:text/html;base64,PGgxPmhpPC9oMT4=', MAKS_FOTO)).toBe(false)
    expect(gambarValid(JPEG.split(',')[1], MAKS_FOTO)).toBe(false)
    expect(gambarValid('javascript:alert(1)', MAKS_FOTO)).toBe(false)
    expect(gambarValid('', MAKS_FOTO)).toBe(false)
  })
  it('menolak berkas yang menyamar: tipe diklaim tidak cocok dengan isi', () => {
    expect(gambarValid('data:image/png;base64,' + JPEG.split(',')[1], MAKS_FOTO)).toBe(false) // isi JPEG, klaim PNG
    expect(gambarValid('data:image/jpeg;base64,' + btoa('<script>alert(1)</script>'), MAKS_FOTO)).toBe(false)
    expect(gambarValid('data:image/webp;base64,' + btoa('RIFF....JPEG1234'), MAKS_FOTO)).toBe(false)
  })
  it('menolak yang melebihi batas ukuran dan base64 yang rusak', () => {
    expect(gambarValid(JPEG, JPEG.length - 1)).toBe(false)
    expect(gambarValid(JPEG, JPEG.length)).toBe(true)
    expect(gambarValid('data:image/png;base64,iVBORw0KGgo"><b>', MAKS_FOTO)).toBe(false)
  })
})

describe('skema backup: foto', () => {
  const bungkus = (foto: unknown[]) => ({ format: 'tpq-v2', versi: 1, dibuat: 'x', data: { ...dataKosong(), foto } })
  it('foto valid lolos; gambar palsu ditolak', () => {
    expect(SKEMA_BACKUP.safeParse(bungkus([{ jenis: 'santri', ownerId: 's1', data: JPEG, updatedAt: 1 }])).success).toBe(true)
    expect(SKEMA_BACKUP.safeParse(bungkus([{ jenis: 'santri', ownerId: 's1', data: 'data:image/png;base64,AAAA', updatedAt: 1 }])).success).toBe(false)
    expect(SKEMA_BACKUP.safeParse(bungkus([{ jenis: 'kelas', ownerId: 's1', data: JPEG, updatedAt: 1 }])).success).toBe(false)
  })
  it('cekRelasi: pemilik foto harus ada dan tidak boleh ganda', () => {
    const d = dataKosong()
    d.foto = [{ jenis: 'santri', ownerId: 'hantu', data: JPEG, updatedAt: 1 }]
    expect(cekRelasi(d)).toMatch(/foto\.ownerId/)
    d.foto = [
      { jenis: 'santri', ownerId: 's1', data: JPEG, updatedAt: 1 },
      { jenis: 'santri', ownerId: 's1', data: JPEG, updatedAt: 2 },
    ]
    expect(cekRelasi(d)).toMatch(/foto \(jenis\+pemilik\)/)
  })
})

describe('konversiV22: foto', () => {
  const lama = {
    santri: [
      { id: 's1', nis: '1', nama: 'A', jk: 'L', foto: JPEG },
      { id: 's2', nis: '2', nama: 'B', jk: 'P', foto: 'bukan-gambar' },
      { id: 's3', nis: '3', nama: 'C', jk: 'P', foto: 'data:image/jpeg;base64,' + 'A'.repeat(MAKS_FOTO) },
      { id: 's4', nis: '4', nama: 'D', jk: 'L' },
    ],
    guru: [{ id: 'g1', nama: 'Ustadz G', foto: PNG }],
  }
  const h = konversiV22(lama)
  it('foto santri/guru yang sah ikut, yang rusak/terlalu besar dilewati dengan peringatan', () => {
    expect(h.data.foto.map((f) => `${f.jenis}:${f.ownerId}`).sort()).toEqual(['guru:g1', 'santri:s1'])
    expect(h.peringatan.join('\n')).toMatch(/2 foto tidak ikut dimigrasi/)
    expect(h.peringatan.join('\n')).toMatch(/2 foto santri\/guru ikut dimigrasi/)
  })
  it('hasil tetap lolos skema dan relasi', () => {
    expect(SKEMA_BACKUP.safeParse({ format: 'tpq-v2', versi: 1, dibuat: 'x', data: h.data }).success).toBe(true)
    expect(cekRelasi(h.data)).toBeNull()
  })
})
