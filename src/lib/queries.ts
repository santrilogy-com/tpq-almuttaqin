import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { type Guru, type Kelas, type Santri } from './types'

export const useKelas = () =>
  useQuery({
    queryKey: ['kelas'],
    queryFn: async () => (await api.get<{ kelas: Kelas[] }>('/kelas')).data.kelas,
  })

export const useSantri = () =>
  useQuery({
    queryKey: ['santri'],
    queryFn: async () =>
      (await api.get<{ santri: Santri[] }>('/santri')).data.santri,
  })

export const useGuru = () =>
  useQuery({
    queryKey: ['guru'],
    queryFn: async () => (await api.get<{ guru: Guru[] }>('/guru')).data.guru,
  })

export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

/** Tanggal lokal perangkat (WIB di Indonesia) sebagai YYYY-MM-DD. */
export const hariIni = () => new Date().toLocaleDateString('sv-SE')

export const useLembaga = () =>
  useQuery({
    queryKey: ['lembaga'],
    queryFn: async () =>
      (await api.get<{ lembaga: import('./types').Lembaga[] }>('/lembaga')).data.lembaga,
  })

export type GuruRef = { id: string; nama: string; peranGuru: string; jenjang: 'TPQ' | 'MI' }
/** Nama guru tanpa honor/HP; boleh dibaca semua pengguna yang login. */
export const useGuruRef = () =>
  useQuery({
    queryKey: ['guru-ref'],
    queryFn: async () => (await api.get<{ guru: GuruRef[] }>('/kbm/guru')).data.guru,
  })

export type Pengumuman = {
  id: string
  judul: string
  isi: string
  tampil: boolean
  createdAt: number
}

export const usePengumuman = () =>
  useQuery({
    queryKey: ['pengumuman'],
    queryFn: async () => (await api.get<{ pengumuman: Pengumuman[] }>('/pengumuman')).data.pengumuman,
  })
