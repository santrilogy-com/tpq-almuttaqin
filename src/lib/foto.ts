import { MAKS_FOTO, gambarValid } from '@shared/backup'
import { api } from '@/lib/api'

export type JenisFoto = 'santri' | 'guru'

/**
 * Foto dari kamera/galeri bisa 5 MB lebih: dipotong persegi di tengah, dikecilkan di PERANGKAT, lalu
 * dikodekan JPEG sampai muat batas server (150 KB). Hasilnya data URL siap kirim.
 */
export async function kecilkanFoto(file: File): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error('Pilih berkas gambar.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const sisi = Math.min(img.width, img.height)
    const sx = (img.width - sisi) / 2
    const sy = (img.height - sisi) / 2
    for (let ukuran = 320; ukuran >= 96; ukuran = Math.round(ukuran * 0.8)) {
      const c = document.createElement('canvas')
      c.width = c.height = ukuran
      c.getContext('2d')!.drawImage(img, sx, sy, sisi, sisi, 0, 0, ukuran, ukuran)
      for (const mutu of [0.85, 0.7, 0.55]) {
        const hasil = c.toDataURL('image/jpeg', mutu)
        if (gambarValid(hasil, MAKS_FOTO)) return hasil
      }
    }
    throw new Error('Gambar tidak bisa dikecilkan. Coba foto lain.')
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Gambar')) throw e
    throw new Error('Gambar tidak bisa dibaca. Pakai JPEG, PNG, atau WebP.', { cause: e })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** undefined = tidak berubah; null = hapus; string = unggah data URL baru. */
export async function simpanFoto(jenis: JenisFoto, id: string, foto: string | null | undefined) {
  if (foto === undefined) return
  if (foto === null) await api.delete(`/foto/${jenis}/${id}`)
  else await api.put(`/foto/${jenis}/${id}`, { data: foto })
}

export const fotoUrl = (jenis: JenisFoto, id: string, v: number) => `/api/foto/${jenis}/${id}?v=${v}`
