// Logika domain murni (tanpa I/O), dipakai bersama oleh Worker dan frontend.

export const JENJANG = ['TPQ', 'MI'] as const
export type Jenjang = (typeof JENJANG)[number]

export const JILID_LIST = [
  'Iqra 1',
  'Iqra 2',
  'Iqra 3',
  'Iqra 4',
  'Iqra 5',
  'Iqra 6',
  'Tahfidz Juz 30',
  'Tahfidz Juz 29',
  'Tahfidz Juz 28',
] as const
export type Jilid = (typeof JILID_LIST)[number]

/** Jilid berikutnya; di jilid tertinggi (atau jilid tak dikenal) tetap sama. */
export function naikJilid(jilid: string): string {
  const i = JILID_LIST.indexOf(jilid as Jilid)
  if (i < 0 || i >= JILID_LIST.length - 1) return jilid
  return JILID_LIST[i + 1]
}

export function predikat(nilai: number): string {
  if (nilai >= 90) return 'A (Sangat Baik)'
  if (nilai >= 80) return 'B (Baik)'
  if (nilai >= 70) return 'C (Cukup)'
  if (nilai >= 60) return 'D (Kurang)'
  return 'E (Perlu Bimbingan)'
}

export const BOBOT = { harian: 0.4, imda: 0.3, praktek: 0.3 } as const

export type Komponen = {
  harian: number | null
  imda: number | null
  praktek: number | null
}

const bulat1 = (n: number) => Math.round(n * 10) / 10

/** Rata-rata satu jenis nilai (1 desimal); null bila belum ada nilai. */
export function rata(nilai: number[]): number | null {
  if (nilai.length === 0) return null
  return bulat1(nilai.reduce((a, n) => a + n, 0) / nilai.length)
}

/**
 * Nilai akhir rapor = Harian 40% + Imda 30% + Praktek 30%.
 *
 * Perbedaan dari v22: komponen yang BELUM ada tidak dihitung sebagai 0.
 * Bobot dihitung ulang dari komponen yang ada, sehingga santri yang baru
 * punya Harian 70 mendapat 70 (bukan 28). `lengkap` menandai bila ketiga
 * komponen sudah terisi, supaya UI bisa memberi label "sementara".
 */
export function nilaiAkhir(k: Komponen): { akhir: number | null; lengkap: boolean } {
  let jumlah = 0
  let bobot = 0
  let ada = 0
  for (const key of ['harian', 'imda', 'praktek'] as const) {
    const v = k[key]
    if (v == null) continue
    jumlah += v * BOBOT[key]
    bobot += BOBOT[key]
    ada++
  }
  if (ada === 0) return { akhir: null, lengkap: false }
  return { akhir: bulat1(jumlah / bobot), lengkap: ada === 3 }
}
