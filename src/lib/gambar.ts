import { LOGO_REGEX, MAKS_LOGO } from '@shared/backup'

/**
 * Kecilkan gambar logo di perangkat sebelum diunggah (maks 256 px). Mencoba PNG dulu; bila masih
 * lebih besar dari batas (foto), beralih ke JPEG lalu memperkecil ukuran sampai muat.
 */
export async function kecilkanLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Pilih gambar PNG, JPEG, atau WebP.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    for (let maks = 256; maks >= 64; maks = Math.round(maks * 0.75)) {
      const k = Math.min(1, maks / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * k))
      c.height = Math.max(1, Math.round(img.height * k))
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      for (const hasil of [c.toDataURL('image/png'), c.toDataURL('image/jpeg', 0.85)]) {
        if (hasil.length <= MAKS_LOGO && LOGO_REGEX.test(hasil)) return hasil
      }
    }
    throw new Error('Gambar terlalu rumit untuk dijadikan logo. Pilih gambar yang lebih sederhana.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
