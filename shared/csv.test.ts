import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'

describe('toCsv', () => {
  it('menulis baris, BOM, CRLF', () => {
    expect(toCsv([['a', 'b'], ['1', 2]])).toBe('\uFEFFa,b\r\n1,2\r\n')
    expect(toCsv([['a']], { bom: false })).toBe('a\r\n')
  })
  it('mengutip koma, kutip, titik-koma, dan baris baru', () => {
    expect(toCsv([['a,b', 'c"d', 'e;f', 'g\nh']], { bom: false })).toBe('"a,b","c""d","e;f","g\nh"\r\n')
  })
  it('null/undefined menjadi kosong', () => {
    expect(toCsv([[null, undefined, 'x']], { bom: false })).toBe(',,x\r\n')
  })
  it('CSV injection: teks berawalan = + - @ diberi apostrof, angka tidak', () => {
    expect(toCsv([['=HYPERLINK("http://x")', '+1', '-2', '@SUM(A1)', 'aman']], { bom: false }))
      .toBe('"\'=HYPERLINK(""http://x"")",\'+1,\'-2,\'@SUM(A1),aman\r\n')
    expect(toCsv([[-5000, 0]], { bom: false })).toBe('-5000,0\r\n')
  })
})

describe('parseCsv', () => {
  it('dasar, CRLF dan LF, BOM', () => {
    expect(parseCsv('\uFEFFnama,nis\r\nAhmad,001\nBudi,002')).toEqual([['nama', 'nis'], ['Ahmad', '001'], ['Budi', '002']])
  })
  it('sel berkutip berisi koma, kutip ganda, dan baris baru', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nbaris2"')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nbaris2']])
  })
  it('mendeteksi titik-koma (Excel Indonesia) dan tab', () => {
    expect(parseCsv('nama;nis\nAhmad;001')).toEqual([['nama', 'nis'], ['Ahmad', '001']])
    expect(parseCsv('nama\tnis\nAhmad\t001')).toEqual([['nama', 'nis'], ['Ahmad', '001']])
  })
  it('membuang baris kosong, mempertahankan sel kosong di tengah', () => {
    expect(parseCsv('a,b,c\n\n1,,3\n,,\n')).toEqual([['a', 'b', 'c'], ['1', '', '3']])
  })
  it('tanpa baris baru di akhir; teks kosong', () => {
    expect(parseCsv('a,b')).toEqual([['a', 'b']])
    expect(parseCsv('')).toEqual([])
  })
  it('roundtrip dengan toCsv', () => {
    const data = [['nama', 'catatan'], ['Ahmad', 'lancar, "baik"\nsekali'], ['', 'x']]
    expect(parseCsv(toCsv(data))).toEqual(data)
  })
})
