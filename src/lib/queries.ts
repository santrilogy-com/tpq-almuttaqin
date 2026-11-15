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
