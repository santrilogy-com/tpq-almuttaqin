import { useQuery } from '@tanstack/react-query'
import { type Jenjang } from '@shared/domain'
import { api } from './api'

export type KeuanganJenjang = {
  saldoKas: number
  masuk: number
  keluar: number
  totalTabungan: number
  honorBelumLunas: number
  spp: { lunas: number; total: number; nominalLunas: number; nominalTotal: number }
}

export type Ringkasan = {
  perJenjang: Record<Jenjang, { aktif: number; L: number; P: number }>
  santriPerKelas: { kelasId: string; kelas: string; jenjang: Jenjang; jumlah: number }[]
  santriPerAngkatan: { angkatan: string; jenjang: Jenjang; jumlah: number }[]
  guruPerPeran: { peran: string; jenjang: Jenjang; jumlah: number }[]
  absensiTotal: { H: number; I: number; S: number; A: number }
  rataKehadiran: number | null
  isian: { santri: number; guru: number; kelas: number }
  keuangan?: {
    perJenjang: Record<Jenjang, KeuanganJenjang>
    periode: string
    saldoKas: number
    masuk: number
    keluar: number
    totalTabungan: number
    honorBelumLunas: number
    spp: { periode: string; lunas: number; total: number; nominalLunas: number; nominalTotal: number }
  }
}

export const useRingkasan = () =>
  useQuery({
    queryKey: ['ringkasan'],
    queryFn: async () => (await api.get<Ringkasan>('/laporan/ringkasan')).data,
    // Ringkasan berat dihitung; tidak perlu dihitung ulang tiap berpindah halaman.
    staleTime: 2 * 60 * 1000,
  })


import { cocokProfil, type Profil } from '@/stores/profil-store'

/** Angka keuangan untuk lembaga aktif: satu jenjang, atau jumlah keduanya pada "Semua". */
export function keuanganUntuk(k: NonNullable<Ringkasan['keuangan']>, profil: Profil): KeuanganJenjang {
  const hasil: KeuanganJenjang = { saldoKas: 0, masuk: 0, keluar: 0, totalTabungan: 0, honorBelumLunas: 0, spp: { lunas: 0, total: 0, nominalLunas: 0, nominalTotal: 0 } }
  for (const j of ['TPQ', 'MI'] as const) {
    if (!cocokProfil(profil, j)) continue
    const x = k.perJenjang[j]
    hasil.saldoKas += x.saldoKas
    hasil.masuk += x.masuk
    hasil.keluar += x.keluar
    hasil.totalTabungan += x.totalTabungan
    hasil.honorBelumLunas += x.honorBelumLunas
    hasil.spp.lunas += x.spp.lunas
    hasil.spp.total += x.spp.total
    hasil.spp.nominalLunas += x.spp.nominalLunas
    hasil.spp.nominalTotal += x.spp.nominalTotal
  }
  return hasil
}

