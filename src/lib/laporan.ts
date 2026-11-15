import { useQuery } from '@tanstack/react-query'
import { type Jenjang } from '@shared/domain'
import { api } from './api'

export type Ringkasan = {
  perJenjang: Record<Jenjang, { aktif: number; L: number; P: number }>
  santriPerKelas: { kelasId: string; kelas: string; jenjang: Jenjang; jumlah: number }[]
  santriPerAngkatan: { angkatan: string; jenjang: Jenjang; jumlah: number }[]
  guruPerPeran: { peran: string; jenjang: Jenjang; jumlah: number }[]
  absensiTotal: { H: number; I: number; S: number; A: number }
  rataKehadiran: number | null
  isian: { santri: number; guru: number; kelas: number }
  keuangan?: {
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
  })
