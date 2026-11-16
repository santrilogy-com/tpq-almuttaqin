import { type JenisNilai, type Jenjang, type StatusAbsen, type StatusSpp } from '@shared/domain'

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


export type Pertemuan = {
  id: string
  kelasId: string
  tanggal: string
  materi: string
  ringkasan: Record<StatusAbsen, number>
}

export type NilaiRow = {
  id: string
  santriId: string
  jenis: JenisNilai
  mapel: string
  nilai: number
  tanggal: string
  semester: string
}

export type Rapor = {
  santri: { id: string; nama: string; nis: string; jilid: string; kelas: string | null }
  semester: string
  daftarSemester: string[]
  harian: number | null
  imda: number | null
  praktek: number | null
  akhir: number | null
  lengkap: boolean
  predikat: string | null
  jumlahNilai: number
  kehadiran: { hadir: number; total: number; persen: number } | null
}


export type Transaksi = {
  id: string
  jenis: 'masuk' | 'keluar'
  jenjang: Jenjang
  kategori: string
  nama: string
  jumlah: number
  tanggal: string
  tagihanSppId: string | null
}

export type Tagihan = {
  id: string
  santriId: string
  nama: string
  nis: string
  jenjang: Jenjang
  periode: string
  jumlah: number
  status: StatusSpp
}

export type TabunganRow = {
  id: string
  santriId: string
  jenis: 'setor' | 'tarik'
  jumlah: number
  tanggal: string
}

export type Lembaga = {
  jenjang: Jenjang
  nama: string
  namaSingkat: string
  pimpinan: string
  alamat: string
  telepon: string
  tahunBerdiri: number | null
  nsmNpsn: string
  motto: string
  tarifSpp: number
  tahunAjaran: string
  logo: string | null
}

