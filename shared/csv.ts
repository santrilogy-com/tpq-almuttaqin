// CSV murni (tanpa I/O): dipakai Worker untuk export dan frontend untuk import.

export type Sel = string | number | null | undefined

/**
 * Sel teks yang berawalan = + - @ (atau tab/CR) dapat dieksekusi sebagai rumus oleh
 * Excel/Sheets ("CSV injection"). Diberi awalan apostrof agar dibaca sebagai teks.
 * Angka bertipe number tidak disentuh.
 */
function aman(x: Sel): string {
  if (x == null) return ''
  if (typeof x === 'number') return String(x)
  return /^[=+\-@\t\r]/.test(x) ? `'${x}` : x
}

const kutip = (s: string) => (/[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** Baris -> teks CSV (CRLF, BOM UTF-8 agar Excel membaca huruf Indonesia dengan benar). */
export function toCsv(baris: Sel[][], opsi: { bom?: boolean } = {}): string {
  const isi = baris.map((b) => b.map((x) => kutip(aman(x))).join(',')).join('\r\n')
  return (opsi.bom === false ? '' : '\uFEFF') + isi + '\r\n'
}

/**
 * Teks CSV -> baris. Mendukung kutip ganda ("" = kutip), sel berisi koma/baris baru,
 * CRLF/LF, BOM, dan pembatas koma / titik-koma / tab (dideteksi dari baris pertama).
 * Baris yang seluruhnya kosong dibuang.
 */
export function parseCsv(teks: string): string[][] {
  const t = teks.replace(/^\uFEFF/, '')
  const baris1 = t.split(/\r?\n/, 1)[0] ?? ''
  const hitung = (c: string) => baris1.split(c).length - 1
  const pemisah = [',', ';', '\t'].reduce((a, c) => (hitung(c) > hitung(a) ? c : a), ',')

  const hasil: string[][] = []
  let baris: string[] = []
  let sel = ''
  let dalamKutip = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (dalamKutip) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          sel += '"'
          i++
        } else dalamKutip = false
      } else sel += ch
    } else if (ch === '"' && sel === '') dalamKutip = true
    else if (ch === pemisah) {
      baris.push(sel)
      sel = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      baris.push(sel)
      sel = ''
      hasil.push(baris)
      baris = []
    } else sel += ch
  }
  if (sel !== '' || baris.length > 0) {
    baris.push(sel)
    hasil.push(baris)
  }
  return hasil.filter((b) => b.some((s) => s.trim() !== ''))
}
