import { type Jenjang } from '@shared/domain'

export type Kelas = {
  id: string
  nama: string
  jenjang: Jenjang
  pengajar: string
  jadwal: string
  ruang: string
}

export type Santri = {
  id: string
  nis: string
  nama: string
  jenisKelamin: 'L' | 'P'
  jenjang: Jenjang
  kelasId: string | null
  jilid: string
  angkatan: string
  rombel: string
  status: 'aktif' | 'keluar' | 'lulus'
  wali: string
  hpWali: string
  alamat: string
}

export type Guru = {
  id: string
  nama: string
  peranGuru: 'Pimpinan' | 'Wali Kelas' | 'Guru Fan' | 'Guru'
  kelasId: string | null
  jenjang: Jenjang
  hp: string
  honor: number
  honorLunas: boolean
}
