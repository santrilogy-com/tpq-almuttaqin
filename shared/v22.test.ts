import { describe, expect, it } from 'vitest'
import { cekRelasi, SKEMA_BACKUP, FORMAT_BACKUP } from './backup'
import { apakahV22, konversiV22 } from './v22'

const SEKARANG = Date.UTC(2026, 10, 16, 3, 0)

const lama = {
  version: 1,
  settings: { namaTpq: 'TPQ Al-Muttaqin', kepala: 'Ustadz Ahmad', tarifSpp: 50000, tahunAjaran: '2026/2027', identitas: { Ibtidaiyah: { nama: 'MI Al-Muttaqin', singkat: 'MI', kepala: 'Bpk. Hasan', tahunBerdiri: '2010', logo: 'bukan-gambar' } } },
  kelas: [
    { id: 'k1', nama: 'Iqra 1', ustadz: 'Ustadz Ahmad', jadwal: 'Senin', ruang: 'A', jenjang: 'TPQ' },
    { id: 'k2', nama: 'Iqra 3', ustadz: 'Ustadzah Khadijah', jadwal: 'Kamis', ruang: 'C', jenjang: 'TPQ' },
    { id: 'k4', nama: 'Kelas 1', ustadz: 'Ustadzah Aisyah', jadwal: 'Rabu', ruang: '1', jenjang: 'Ibtidaiyah' },
  ],
  guru: [
    { id: 'g1', nama: 'Ustadz Ahmad', kelas: 'Iqra 1', hp: '0812', honor: 800000, honorStatus: 'Lunas', peran: 'Pimpinan', jenjang: 'TPQ dan Ibtidaiyah' },
    { id: 'g2', nama: 'Ustadzah Khadijah', kelas: 'Iqra 3', hp: '0813', honor: '900000', honorStatus: 'Belum', peran: 'Wali Kelas', jenjang: 'TPQ' },
    { id: 'g3', nama: 'ustadz ahmad', peran: 'Guru', jenjang: 'TPQ' }, // nama kembar (beda huruf besar)
  ],
  santri: [
    { id: 's1', nis: '001', nama: 'Ahmad Fauzi', jk: 'L', kelas: 'Iqra 3', jilid: 'Iqra 3', jenjang: 'TPQ', status: 'Aktif', tabungan: 450000, sppStatus: 'Lunas', angkatan: '2024' },
    { id: 's2', nis: '002', nama: 'Siti Maryam', jk: 'P', kelas: 'Iqra 1', jilid: 'Tahfidz Juz 30', jenjang: 'TPQ', status: 'Aktif', tabungan: 0, sppStatus: 'Belum' },
    { id: 's3', nis: '001', nama: 'NIS Kembar', jk: 'L', kelas: 'Iqra 1', jenjang: 'TPQ', status: 'Aktif' },
    { id: 's4', nis: '004', nama: 'Tanpa JK', jk: '', kelas: 'Kelas Hantu', jenjang: 'Ibtidaiyah', status: 'Lulus', tabungan: 0 },
    { id: 's5', nis: '005', nama: 'Dewi', jk: 'P', kelas: 'Kelas 1', jilid: 'Entah', jenjang: 'Ibtidaiyah', status: 'Keluar', tabungan: 100000, sppStatus: 'Telat' },
    { nis: '', nama: 'Tanpa NIS', jk: 'L' },
  ],
  tabunganTx: [
    { id: 't1', santriId: 's1', jenis: 'Setor', jumlah: 50000, tanggal: '2026-11-14', catatan: 'mingguan' },
    { id: 't2', santriId: 's5', jenis: 'Setor', jumlah: 300000, tanggal: '2026-10-01' },
    { id: 't3', santriId: 'hantu', jenis: 'Setor', jumlah: 1000, tanggal: '2026-10-01' },
    { id: 't4', santriId: 's1', jenis: 'Setor', jumlah: -5, tanggal: '2026-10-01' },
  ],
  keuanganTx: [
    { id: 'x1', jenis: 'Masuk', kategori: 'SPP', jenjang: 'TPQ', nama: 'SPP November', jumlah: 1900000, tanggal: '2026-11-05', catatan: 'ok' },
    { id: 'x2', jenis: 'Keluar', kategori: 'ATK', jenjang: 'Ibtidaiyah', nama: 'Spidol', jumlah: 150000, tanggal: '2026-11-08' },
    { id: 'x3', jenis: 'Masuk', kategori: 'Infaq', jenjang: 'TPQ', nama: 'Tanggal rusak', jumlah: 1000, tanggal: '2026-02-31' },
  ],
  pertemuan: [
    // s1 (Iqra 3, k2) ada di pertemuan k2; s2 (Iqra 1) tercatat di pertemuan Iqra 3 = lintas kelas
    { id: 'p1', kelasId: 'k2', tanggal: '2026-11-14', materi: 'Iqra 3 hal 12', absensi: { s1: 'Hadir', s2: 'Hadir', hantu: 'Hadir', s5: 'Bolos' } },
    { id: 'p2', kelasId: 'k2', tanggal: '2026-11-14', materi: 'dobel', absensi: { s1: 'Sakit' } }, // kelas+tanggal sama
    { id: 'p3', kelasId: 'k99', tanggal: '2026-11-14', absensi: {} },
  ],
  nilai: [
    { id: 'n1', santriId: 's1', jenis: 'Harian', mapel: 'Iqra', nilai: 85, tanggal: '2026-11-12' },
    { id: 'n2', santriId: 's1', jenis: 'Imda', mapel: '', nilai: 90.5, tanggal: '2027-02-01' },
    { id: 'n3', santriId: 's1', jenis: 'Harian', mapel: 'Iqra', nilai: 101, tanggal: '2026-11-12' },
    { id: 'n4', santriId: 's1', jenis: 'Ujian', mapel: 'Iqra', nilai: 80, tanggal: '2026-11-12' },
  ],
  hafalanLog: [{ id: 'h1', santriId: 's1', jenis: 'Iqra', materi: 'Iqra 3 hal 14', nilai: 'Lancar', tanggal: '2026-11-14' }],
  pengumuman: [{ id: 'u1', judul: 'Pengajian', isi: 'Sabtu 08:00', tanggal: '2026-11-14', aktif: false }],
  alokasiWaktu: [{ id: 'a1', kelas: 'Iqra 1', mapel: 'Iqra', jamPerMinggu: 4, hari: 'Senin, Kamis' }],
  jadwalKbm: [
    { id: 'j1', kelas: 'Iqra 1', hari: 'Senin', jamMulai: '15:30', jamSelesai: '16:30', mapel: 'Iqra', guru: 'Ustadz Ahmad' },
    { id: 'j2', kelas: 'Iqra 1', hari: 'Senin', jamMulai: '17:00', jamSelesai: '16:00', mapel: 'Terbalik' },
  ],
  jadwalPiket: [{ id: 'pk1', guruId: 'g1', hari: 'Senin', keterangan: 'pagi' }, { id: 'pk2', guruId: 'g99', hari: 'Senin' }],
  absensiGuru: [{ id: 'ag1', guruId: 'g1', tanggal: '2026-11-14', status: 'Hadir', kelompok: 'Guru' }, { id: 'ag2', guruId: 'g1', tanggal: '2026-11-14', status: 'Izin', kelompok: 'Guru' }],
  rapbm: [{ id: 'r1', pos: 'SPP', jenis: 'Masuk', jenjang: 'TPQ', rencana: 3000000 }],
  biaya: [{ id: 'b1', nama: 'SPP Bulanan', jumlah: 50000, keterangan: 'per santri' }],
  target: [{ id: 'tg1', nama: 'Seragam', target: 150000, terkumpul: 120000 }],
  pengguna: [{ id: 'u1', username: 'admin', sandiHash: 'xxx' }],
}

const hasil = konversiV22(lama, SEKARANG)
const d = hasil.data

describe('konversiV22', () => {
  it('mengenali format v22, bukan v2', () => {
    expect(apakahV22(lama)).toBe(true)
    expect(apakahV22({ format: 'tpq-v2', santri: [] })).toBe(false)
    expect(apakahV22(null)).toBe(false)
  })

  it('hasil lolos validasi skema + integritas relasi v2', () => {
    const bungkus = { format: FORMAT_BACKUP, versi: 1, dibuat: 'x', data: d }
    const p = SKEMA_BACKUP.safeParse(bungkus)
    expect(p.success, p.success ? '' : JSON.stringify(p.error.issues[0])).toBe(true)
    expect(cekRelasi(d)).toBeNull()
  })

  it('jenjang Ibtidaiyah -> MI; guru dua jenjang -> TPQ + peringatan', () => {
    expect(d.kelas.find((k) => k.nama === 'Kelas 1')?.jenjang).toBe('MI')
    expect(d.guru.find((g) => g.nama === 'Ustadz Ahmad')?.jenjang).toBe('TPQ')
    expect(hasil.peringatan.join('\n')).toMatch(/TPQ dan Ibtidaiyah/)
  })

  it('santri: NIS kembar & tanpa NIS dilewati; kelas dipetakan via nama; jilid tak dikenal -> Qur\'ani 1', () => {
    expect(d.santri.map((s) => s.nis)).toEqual(['001', '002', '004', '005'])
    expect(d.santri.find((s) => s.nis === '001')?.kelasId).toBe('k2')
    expect(d.santri.find((s) => s.nis === '004')?.kelasId).toBeNull() // kelas tak ada
    expect(d.santri.find((s) => s.nis === '005')?.jilid).toBe("Qur'ani 1")
    expect(d.santri.find((s) => s.nis === '005')?.status).toBe('keluar')
    expect(d.santri.find((s) => s.nis === '004')?.status).toBe('lulus')
    expect(d.santri.find((s) => s.nis === '002')?.jilid).toBe('Tahfidz Juz 30')
  })

  it('santri tanpa jenis kelamin diisi L DAN diperingatkan', () => {
    expect(d.santri.find((s) => s.nis === '004')?.jenisKelamin).toBe('L')
    expect(hasil.peringatan.join('\n')).toMatch(/tanpa jenis kelamin/)
  })

  it('guru: nama kembar dilewati; honor teks diubah; honorLunas dari status', () => {
    expect(d.guru.map((g) => g.nama)).toEqual(['Ustadz Ahmad', 'Ustadzah Khadijah'])
    expect(d.guru.find((g) => g.nama === 'Ustadzah Khadijah')?.honor).toBe(900000)
    expect(d.guru.find((g) => g.nama === 'Ustadz Ahmad')?.honorLunas).toBe(true)
  })

  it('tabungan: saldo v2 = saldo tercatat v22 (saldo pembuka), transaksi rusak dibuang', () => {
    const saldo = (sid: string) => d.tabungan.filter((t) => t.santriId === sid).reduce((a, t) => a + (t.jenis === 'setor' ? t.jumlah : -t.jumlah), 0)
    expect(saldo('s1')).toBe(450000) // riwayat 50.000 + pembuka 400.000
    expect(saldo('s5')).toBe(100000) // riwayat 300.000 > saldo tercatat 100.000: saldo v22 dipertahankan via penyesuaian
    expect(d.tabungan.some((t) => t.santriId === 's5' && t.jenis === 'tarik' && t.jumlah === 200000 && t.catatan.includes('Penyesuaian'))).toBe(true)
    expect(d.tabungan.some((t) => t.catatan.includes('Saldo awal') && t.santriId === 's1' && t.jumlah === 400000)).toBe(true)
    expect(hasil.peringatan.join('\n')).toMatch(/riwayat tabungan lebih besar/)
  })

  it('absensi lintas-kelas dibuang; pertemuan kelas+tanggal kembar digabung; kelas tak ada dilewati', () => {
    expect(d.pertemuan).toHaveLength(1)
    const a = d.absensi
    expect(a.map((x) => x.santriId)).toEqual(['s1']) // s2 beda kelas, hantu & s5 tak valid
    expect(a[0].status).toBe('H') // yang pertama menang
    expect(hasil.peringatan.join('\n')).toMatch(/lintas-kelas/)
  })

  it('nilai: semester dari tanggal; mapel kosong -> Umum; nilai/jenis tidak valid dilewati', () => {
    expect(d.nilai).toHaveLength(2)
    expect(d.nilai[1]).toMatchObject({ mapel: 'Umum', nilai: 90.5, semester: '2026/2027 Genap' })
  })

  it('kas: tanggal fiktif dilewati; SPP per-santri menjadi tagihan bulan ini tanpa kas baru', () => {
    expect(d.transaksi).toHaveLength(2)
    expect(d.transaksi.every((t) => t.tagihanSppId === null)).toBe(true)
    expect(d.tagihanSpp.map((t) => [t.santriId, t.status])).toEqual([['s1', 'lunas'], ['s2', 'belum']]) // hanya aktif
    expect(d.tagihanSpp.every((t) => t.periode === '2026-11' && t.jumlah === 50000)).toBe(true)
  })

  it('KBM: jadwal jam terbalik & piket guru tak ada dilewati; absensi guru kembar dibuang', () => {
    expect(d.jadwalKbm).toHaveLength(1)
    expect(d.jadwalKbm[0].guruId).toBe('g1')
    expect(d.piket).toHaveLength(1)
    expect(d.absensiGuru).toHaveLength(1)
  })

  it('lembaga: identitas dari settings, logo palsu dibuang + peringatan, tarif dibawa', () => {
    const mi = d.lembaga.find((l) => l.jenjang === 'MI')!
    expect(mi).toMatchObject({ nama: 'MI Al-Muttaqin', pimpinan: 'Bpk. Hasan', tahunBerdiri: 2010, logo: null, tarifSpp: 50000 })
    expect(d.lembaga.find((l) => l.jenjang === 'TPQ')).toMatchObject({ nama: 'TPQ Al-Muttaqin', pimpinan: 'Ustadz Ahmad' })
    expect(hasil.peringatan.join('\n')).toMatch(/Logo/)
  })

  it('pengumuman aktif=false -> tampil=false; akun login TIDAK dimigrasi dan diperingatkan', () => {
    expect(d.pengumuman[0].tampil).toBe(false)
    expect(hasil.peringatan.join('\n')).toMatch(/akun login v22 TIDAK dimigrasi/)
  })

  it('input kosong/berantakan tidak melempar galat', () => {
    expect(() => konversiV22({ santri: [] })).not.toThrow()
    expect(() => konversiV22({ santri: [null, 1, 'x'], kelas: [{}], guru: [[]] })).not.toThrow()
    expect(konversiV22({ santri: [] }).data.santri).toEqual([])
  })
})


describe("konversiV22: Iqra -> Qur'ani", () => {
  it('nama kelas, jilid santri, jenis & materi setoran, mapel diganti; peringatan menyebut jumlahnya', () => {
    expect(d.kelas.map((k) => k.nama)).toEqual(["Qur'ani 1", "Qur'ani 3", 'Kelas 1'])
    expect(d.santri.find((s) => s.nis === '001')?.jilid).toBe("Qur'ani 3")
    expect(d.setoran[0]).toMatchObject({ jenis: "Qur'ani", materi: "Qur'ani 3 hal 14" })
    expect(d.nilai[0].mapel).toBe("Qur'ani")
    expect(d.alokasiWaktu[0].mapel).toBe("Qur'ani")
    expect(d.jadwalKbm[0].mapel).toBe("Qur'ani")
    expect(hasil.peringatan.join('\n')).toMatch(/"Iqra" diganti "Qur'ani"/)
  })
  it('santri tetap terhubung ke kelas yang sudah berganti nama (cocok lewat nama ternormalisasi)', () => {
    expect(d.santri.find((s) => s.nis === '001')?.kelasId).toBe('k2')
    expect(d.guru.find((g) => g.nama === 'Ustadz Ahmad')?.kelasId).toBe('k1')
  })
})

