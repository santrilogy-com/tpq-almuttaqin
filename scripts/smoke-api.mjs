// Smoke test API auth terhadap server yang sedang jalan.
// Pakai DB lokal yang KOSONG:  node scripts/smoke-api.mjs http://localhost:5199
const base = process.argv[2] ?? 'http://localhost:5199'
let pass = 0
let fail = 0

class Client {
  cookie = ''
  async req(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    })
    const set = res.headers.get('set-cookie')
    if (set) {
      const [pair] = set.split(';')
      this.cookie = pair.endsWith('=') ? '' : pair
    }
    const json = await res.json().catch(() => ({}))
    return { status: res.status, json, headers: res.headers, set }
  }
}

function check(name, cond, extra = '') {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`)
}

const a = new Client() // pimpinan
const g = new Client() // guru

let r = await a.req('GET', '/api/auth/status')
check('status: belum disiapkan', r.json.needsSetup === true, JSON.stringify(r))

r = await a.req('GET', '/api/users')
check('tanpa login -> 401', r.status === 401)

r = await a.req('POST', '/api/auth/setup', { username: 'admin', nama: 'Admin', sandi: 'short' })
check('setup: sandi <8 ditolak', r.status === 400)

r = await a.req('POST', '/api/auth/setup', { username: 'admin', nama: 'Ketua', sandi: 'rahasia-123' })
check('setup: Pimpinan pertama dibuat', r.status === 201 && r.json.user.peran === 'pimpinan', JSON.stringify(r))
check('cookie sesi HttpOnly + SameSite=Lax', /HttpOnly/i.test(r.set) && /SameSite=Lax/i.test(r.set), r.set)
check('respons tidak memuat hash sandi', !JSON.stringify(r.json).includes('pbkdf2'))

r = await new Client().req('POST', '/api/auth/setup', { username: 'x1', nama: 'X', sandi: 'rahasia-123' })
check('setup kedua ditolak (409)', r.status === 409)

r = await a.req('GET', '/api/auth/status')
check('status: sudah disiapkan', r.json.needsSetup === false)

r = await a.req('GET', '/api/auth/me')
check('me: sesi valid', r.status === 200 && r.json.user.username === 'admin')

// CSRF: origin asing ditolak
r = await a.req('POST', '/api/users', { username: 'evil', nama: 'E', peran: 'pimpinan', sandi: 'password-1' }, { origin: 'https://evil.example' })
check('origin asing ditolak (403)', r.status === 403)

// Tambah guru
r = await a.req('POST', '/api/users', { username: 'guru1', nama: 'Ustadz Ali', peran: 'guru', sandi: 'sementara-1' })
check('Pimpinan menambah guru', r.status === 201 && r.json.user.wajibGantiSandi === true, JSON.stringify(r))
const guruId = r.json.user?.id

r = await a.req('POST', '/api/users', { username: 'GURU1', nama: 'Dup', peran: 'guru', sandi: 'sementara-1' })
check('ID kembar (case-insensitive) ditolak', r.status === 409)

// Login guru + ganti sandi paksa
r = await g.req('POST', '/api/auth/login', { username: 'guru1', sandi: 'sementara-1' })
check('guru login', r.status === 200 && r.json.user.wajibGantiSandi === true)
r = await g.req('GET', '/api/users')
check('guru wajib ganti sandi -> 403 di endpoint lain', r.status === 403)
r = await g.req('POST', '/api/auth/ganti-sandi', { sandiLama: 'salah-salah', sandiBaru: 'baru-12345' })
check('ganti sandi: sandi lama salah ditolak', r.status === 400)
r = await g.req('POST', '/api/auth/ganti-sandi', { sandiLama: 'sementara-1', sandiBaru: 'sementara-1' })
check('ganti sandi: sama dengan lama ditolak', r.status === 400)
r = await g.req('POST', '/api/auth/ganti-sandi', { sandiLama: 'sementara-1', sandiBaru: 'baru-12345' })
check('ganti sandi berhasil', r.status === 200)
r = await g.req('GET', '/api/auth/me')
check('setelah ganti: flag wajib hilang', r.json.user?.wajibGantiSandi === false, JSON.stringify(r))

// Peran dicek di SERVER
r = await g.req('GET', '/api/users')
check('guru tidak boleh lihat daftar pengguna (403)', r.status === 403)
r = await g.req('POST', '/api/users', { username: 'jahat', nama: 'J', peran: 'pimpinan', sandi: 'password-1' })
check('guru tidak boleh membuat Pimpinan (403)', r.status === 403)
r = await g.req('PATCH', `/api/users/${guruId}`, { peran: 'pimpinan' })
check('guru tidak boleh menaikkan diri jadi Pimpinan (403)', r.status === 403)

// Aturan Pimpinan
const me = (await a.req('GET', '/api/auth/me')).json.user
r = await a.req('DELETE', `/api/users/${me.id}`)
check('tidak bisa hapus diri sendiri', r.status === 400)
r = await a.req('PATCH', `/api/users/${me.id}`, { peran: 'guru' })
check('tidak bisa turunkan diri sendiri', r.status === 400)
r = await a.req('PATCH', `/api/users/${me.id}`, { aktif: false })
check('tidak bisa nonaktifkan diri sendiri', r.status === 400)

// Login: pesan generik + lockout
const bad = new Client()
r = await bad.req('POST', '/api/auth/login', { username: 'tidak-ada', sandi: 'apa-saja-1' })
const pesanA = r.json.error
r = await bad.req('POST', '/api/auth/login', { username: 'guru1', sandi: 'salah-salah' })
check('pesan error sama untuk ID tak ada / sandi salah', r.status === 401 && r.json.error === pesanA)
for (let i = 0; i < 4; i++) r = await bad.req('POST', '/api/auth/login', { username: 'guru1', sandi: 'salah-salah' })
r = await bad.req('POST', '/api/auth/login', { username: 'guru1', sandi: 'baru-12345' })
check('setelah 5 gagal, akun terkunci walau sandi benar (429)', r.status === 429, JSON.stringify(r))

// Reset sandi oleh Pimpinan memutus sesi guru
r = await a.req('POST', `/api/users/${guruId}/reset-sandi`, { sandi: 'reset-12345' })
check('Pimpinan reset sandi guru', r.status === 200)
r = await g.req('GET', '/api/auth/me')
check('sesi guru lama diputus setelah reset', r.status === 401)

// Nonaktifkan guru
r = await a.req('PATCH', `/api/users/${guruId}`, { aktif: false })
check('Pimpinan menonaktifkan guru', r.status === 200 && r.json.user.aktif === false)

// ---------- Kelas / Santri / Guru ----------
const g2 = new Client()
await a.req('POST', '/api/users', { username: 'guru2', nama: 'Ustadzah Siti', peran: 'guru', sandi: 'sementara-2' })
await g2.req('POST', '/api/auth/login', { username: 'guru2', sandi: 'sementara-2' })
await g2.req('POST', '/api/auth/ganti-sandi', { sandiLama: 'sementara-2', sandiBaru: 'baru-67890' })

r = await a.req('POST', '/api/kelas', { nama: 'Iqra 1', jenjang: 'TPQ' })
check('Pimpinan membuat kelas', r.status === 201, JSON.stringify(r))
const kelasId = r.json.kelas?.id
r = await a.req('POST', '/api/kelas', { nama: '', jenjang: 'TPQ' })
check('kelas: nama kosong ditolak', r.status === 400)
r = await g2.req('POST', '/api/kelas', { nama: 'Liar', jenjang: 'TPQ' })
check('guru tidak boleh membuat kelas (403)', r.status === 403)
r = await g2.req('GET', '/api/kelas')
check('guru boleh melihat kelas', r.status === 200 && r.json.kelas.length === 1)

const santriBody = { nis: '001', nama: 'Ahmad', jenisKelamin: 'L', jenjang: 'TPQ', kelasId }
r = await g2.req('POST', '/api/santri', santriBody)
check('guru boleh menambah santri', r.status === 201 && r.json.santri.jilid === 'Iqra 1', JSON.stringify(r))
const sId = r.json.santri?.id
r = await a.req('POST', '/api/santri', { ...santriBody, nama: 'Budi' })
check('NIS kembar ditolak (409)', r.status === 409)
r = await a.req('POST', '/api/santri', { ...santriBody, nis: '002', jenisKelamin: 'X' })
check('jenis kelamin tidak valid ditolak', r.status === 400)
r = await a.req('POST', '/api/santri', { ...santriBody, nis: '002', nama: 'Budi' })
const s2 = r.json.santri?.id
r = await g2.req('PATCH', `/api/santri/${s2}`, { nis: '001' })
check('ubah NIS jadi milik santri lain ditolak', r.status === 409)
r = await g2.req('PATCH', `/api/santri/${s2}`, { nis: '002', nama: 'Budi S.' })
check('ubah santri tanpa mengganti NIS sendiri OK', r.status === 200 && r.json.santri.nama === 'Budi S.')
r = await a.req('PATCH', `/api/santri/${s2}`, { jilid: 'Iqra 4', wali: 'Pak Budi', status: 'keluar' })
r = await g2.req('PATCH', `/api/santri/${s2}`, { alamat: 'Jl. Mawar' })
check(
  'PATCH sebagian TIDAK mereset field lain (jilid/wali/status/kelas)',
  r.json.santri?.jilid === 'Iqra 4' && r.json.santri?.wali === 'Pak Budi' &&
    r.json.santri?.status === 'keluar' && r.json.santri?.kelasId === kelasId,
  JSON.stringify(r.json)
)
r = await g2.req('GET', '/api/santri?jenjang=MI')
check('filter jenjang MI kosong', r.json.santri.length === 0)
r = await g2.req('GET', '/api/santri?jenjang=TPQ')
check('filter jenjang TPQ berisi 2', r.json.santri.length === 2)

r = await g2.req('POST', `/api/santri/${sId}/naik-jilid`, { dari: 'Iqra 1' })
check('naik jilid Iqra 1 -> Iqra 2', r.status === 200 && r.json.santri.jilid === 'Iqra 2', JSON.stringify(r))
r = await g2.req('POST', `/api/santri/${sId}/naik-jilid`, { dari: 'Iqra 1' })
check('ketukan ganda tidak naik dua tingkat (409)', r.status === 409)
r = await g2.req('GET', '/api/santri')
check('jilid tetap Iqra 2', r.json.santri.find((x) => x.id === sId).jilid === 'Iqra 2')

r = await g2.req('DELETE', `/api/santri/${sId}`)
check('guru tidak boleh menghapus santri (403)', r.status === 403)
r = await g2.req('GET', '/api/guru')
check('guru tidak boleh melihat daftar guru (403)', r.status === 403)
r = await a.req('POST', '/api/guru', { nama: 'Ustadz Ali', jenjang: 'TPQ', honor: 500000 })
check('Pimpinan menambah guru (data)', r.status === 201 && r.json.guru.peranGuru === 'Guru', JSON.stringify(r))
const gId = r.json.guru?.id
r = await a.req('POST', '/api/guru', { nama: 'Ustadz Ali', jenjang: 'TPQ' })
check('nama guru kembar ditolak', r.status === 409)
r = await a.req('POST', '/api/guru', { nama: 'Negatif', jenjang: 'TPQ', honor: -1 })
check('honor negatif ditolak', r.status === 400)
r = await a.req('PATCH', `/api/guru/${gId}`, { honorLunas: true })
check('tandai honor lunas', r.status === 200 && r.json.guru.honorLunas === true)
check('PATCH guru tidak mereset honor/peran', r.json.guru?.honor === 500000, JSON.stringify(r.json))
r = await a.req('POST', '/api/kelas', { nama: 'Iqra 9', jenjang: 'MI', pengajar: 'Ustadz X', ruang: 'R1' })
const k9 = r.json.kelas?.id
r = await a.req('PATCH', `/api/kelas/${k9}`, { jadwal: 'Senin' })
check('PATCH kelas tidak mereset pengajar/ruang', r.json.kelas?.pengajar === 'Ustadz X' && r.json.kelas?.ruang === 'R1', JSON.stringify(r.json))
await a.req('DELETE', `/api/kelas/${k9}`)

r = await a.req('DELETE', `/api/kelas/${kelasId}`)
check('hapus kelas OK', r.status === 200)
r = await a.req('GET', '/api/santri')
check('santri tetap ada, kelasId jadi null', r.json.santri.length === 2 && r.json.santri.every((x) => x.kelasId === null), JSON.stringify(r.json))
r = await a.req('DELETE', `/api/santri/${sId}`)
check('Pimpinan menghapus santri', r.status === 200)

// ---------- Absensi / Nilai / Rapor ----------
const kA = (await a.req('POST', '/api/kelas', { nama: 'Kelas A', jenjang: 'TPQ' })).json.kelas.id
const kB = (await a.req('POST', '/api/kelas', { nama: 'Kelas B', jenjang: 'TPQ' })).json.kelas.id
const mk = async (nis, nama, kelasId) =>
  (await a.req('POST', '/api/santri', { nis, nama, jenisKelamin: 'P', jenjang: 'TPQ', kelasId })).json.santri.id
const sa1 = await mk('A01', 'Aisyah', kA)
const sa2 = await mk('A02', 'Bilqis', kA)
const sb1 = await mk('B01', 'Citra', kB)

r = await g2.req('PUT', '/api/absensi/pertemuan', { kelasId: kA, tanggal: '2026-11-10', materi: 'Makhraj', catatan: [{ santriId: sa1, status: 'H' }, { santriId: sa2, status: 'S' }] })
check('guru menyimpan absensi', r.status === 200 && r.json.tersimpan === 2, JSON.stringify(r))
r = await g2.req('PUT', '/api/absensi/pertemuan', { kelasId: kA, tanggal: '2026-11-11', catatan: [{ santriId: sb1, status: 'H' }] })
check('santri kelas lain ditolak (anti lintas-kelas)', r.status === 400, JSON.stringify(r))
r = await g2.req('PUT', '/api/absensi/pertemuan', { kelasId: kA, tanggal: '2026-02-31', catatan: [] })
check('tanggal fiktif ditolak', r.status === 400)
r = await g2.req('PUT', '/api/absensi/pertemuan', { kelasId: kA, tanggal: '2026-11-10', catatan: [{ santriId: sa1, status: 'Z' }] })
check('status absen tidak valid ditolak', r.status === 400)
r = await g2.req('PUT', '/api/absensi/pertemuan', { kelasId: kA, tanggal: '2026-11-10', materi: 'Makhraj 2', catatan: [{ santriId: sa1, status: 'H' }, { santriId: sa2, status: 'H' }] })
check('simpan ulang tanggal sama menimpa (bukan duplikat)', r.status === 200)
r = await g2.req('GET', `/api/absensi/pertemuan?kelasId=${kA}`)
check('hanya 1 pertemuan, ringkasan benar', r.json.pertemuan.length === 1 && r.json.pertemuan[0].ringkasan.H === 2 && r.json.pertemuan[0].ringkasan.S === 0, JSON.stringify(r.json))
r = await g2.req('GET', `/api/absensi/detail?kelasId=${kA}&tanggal=2026-11-10`)
check('detail memuat materi + catatan terbaru', r.json.pertemuan?.materi === 'Makhraj 2' && r.json.catatan.length === 2)
r = await g2.req('GET', `/api/absensi/detail?kelasId=${kA}&tanggal=2026-11-12`)
check('detail tanggal kosong -> null', r.json.pertemuan === null)

// 65 santri sekaligus (melewati batas parameter D1 jika tidak di-chunk)
const banyak = []
for (let i = 0; i < 65; i++) banyak.push(await mk(`M${i}`, `Murid ${i}`, kB))
r = await g2.req('PUT', '/api/absensi/pertemuan', { kelasId: kB, tanggal: '2026-11-10', catatan: banyak.map((id) => ({ santriId: id, status: 'H' })) })
check('absensi 65 santri sekaligus tersimpan semua', r.status === 200 && r.json.tersimpan === 65, JSON.stringify(r).slice(0, 200))

// Nilai
r = await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Harian', mapel: 'Iqra', nilai: 80, tanggal: '2026-11-10' })
check('nilai: semester turun otomatis dari tanggal', r.status === 201 && r.json.nilai.semester === '2026/2027 Ganjil', JSON.stringify(r))
const nilaiId = r.json.nilai?.id
for (const [n, msg] of [[101, '>100'], [-1, '<0']]) {
  r = await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Harian', mapel: 'Iqra', nilai: n, tanggal: '2026-11-10' })
  check(`nilai ${msg} ditolak`, r.status === 400)
}
r = await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Harian', mapel: 'Iqra', nilai: '80', tanggal: '2026-11-10' })
check('nilai berupa teks ditolak', r.status === 400)
r = await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Ujian', mapel: 'Iqra', nilai: 80, tanggal: '2026-11-10' })
check('jenis nilai tidak dikenal ditolak', r.status === 400)
r = await g2.req('POST', '/api/nilai', { santriId: 'tidak-ada', jenis: 'Harian', mapel: 'Iqra', nilai: 80, tanggal: '2026-11-10' })
check('nilai untuk santri tak ada -> 404', r.status === 404)
r = await g2.req('GET', `/api/rapor/${sa1}`)
check('rapor: Harian 80 saja = 80, bukan 32 (sementara)', r.json.akhir === 80 && r.json.lengkap === false, JSON.stringify(r.json))
await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Imda', mapel: 'Iqra', nilai: 60, tanggal: '2026-11-11' })
await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Praktek', mapel: 'Iqra', nilai: 85.5, tanggal: '2026-11-12' })
r = await g2.req('GET', `/api/rapor/${sa1}`)
// 80*.4 + 60*.3 + 85.5*.3 = 32 + 18 + 25.65 = 75.65 -> 75.7 (dibulatkan 1 desimal)
check('rapor lengkap: 40/30/30 + desimal diterima', r.json.lengkap === true && r.json.akhir === 75.7 && r.json.predikat === 'C (Cukup)', JSON.stringify(r.json))
check('rapor: kehadiran dari pertemuan kelasnya (1/1 = 100%)', r.json.kehadiran?.persen === 100 && r.json.kehadiran?.total === 1, JSON.stringify(r.json.kehadiran))
await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Harian', mapel: 'Iqra', nilai: 50, tanggal: '2027-02-01' })
r = await g2.req('GET', `/api/rapor/${sa1}`)
check('rapor default = semester terbaru (Genap 2026/2027), hanya Harian 50', r.json.semester === '2026/2027 Genap' && r.json.akhir === 50, JSON.stringify(r.json))
r = await g2.req('GET', `/api/rapor/${sa1}?semester=${encodeURIComponent('2026/2027 Ganjil')}`)
check('rapor bisa pilih semester lain', r.json.akhir === 75.7)
check('daftar semester terurut terbaru dulu', r.json.daftarSemester[0] === '2026/2027 Genap' && r.json.daftarSemester.length === 2)
// pindah kelas -> kehadiran lama (kelas A) tidak ikut terhitung
await a.req('PATCH', `/api/santri/${sa1}`, { kelasId: kB })
r = await g2.req('GET', `/api/rapor/${sa1}`)
check('pindah kelas: absensi kelas lama tidak dihitung', r.json.kehadiran === null, JSON.stringify(r.json.kehadiran))
r = await g2.req('DELETE', `/api/nilai/${nilaiId}`)
check('hapus nilai', r.status === 200)
r = await g2.req('DELETE', `/api/absensi/pertemuan/tidak-ada`)
check('guru tidak boleh hapus pertemuan (403)', r.status === 403)
r = await a.req('DELETE', `/api/absensi/pertemuan/tidak-ada`)
check('Pimpinan hapus pertemuan tak ada -> 404', r.status === 404)

// ---------- Lembaga / Keuangan / SPP / Tabungan ----------
r = await g2.req('GET', '/api/lembaga')
check('guru boleh melihat identitas lembaga', r.status === 200 && r.json.lembaga.length === 2)
r = await g2.req('PATCH', '/api/lembaga/TPQ', { tarifSpp: 1 })
check('guru tidak boleh ubah tarif (403)', r.status === 403)
for (const [m, p] of [['GET', '/api/keuangan'], ['GET', '/api/keuangan/spp?periode=2026-11'], ['GET', '/api/tabungan/saldo']]) {
  r = await g2.req(m, p)
  check(`guru ditolak ${p} (403)`, r.status === 403)
}

r = await a.req('PATCH', '/api/lembaga/TPQ', { tarifSpp: -5 })
check('tarif negatif ditolak', r.status === 400)
r = await a.req('POST', '/api/keuangan/spp/generate', { periode: '2026-11' })
check('generate SPP tanpa tarif ditolak (jelas)', r.status === 400 && /Tarif/.test(r.json.error), JSON.stringify(r))
r = await a.req('PATCH', '/api/lembaga/TPQ', { tarifSpp: 50000, tahunAjaran: '2026/2027' })
check('Pimpinan atur tarif TPQ', r.status === 200 && r.json.lembaga.tarifSpp === 50000)

// Kas manual
r = await a.req('POST', '/api/keuangan', { jenis: 'masuk', jenjang: 'TPQ', kategori: 'Saldo awal', nama: 'Saldo awal', jumlah: 1000000, tanggal: '2026-11-01' })
check('catat pemasukan', r.status === 201)
r = await a.req('POST', '/api/keuangan', { jenis: 'keluar', jenjang: 'TPQ', kategori: 'SPP', nama: 'x', jumlah: 1000, tanggal: '2026-11-01' })
check('kategori pemasukan dipakai di pengeluaran ditolak', r.status === 400)
for (const [j, msg] of [[0, '0'], [-5, 'negatif'], [10.5, 'desimal'], ['5000', 'teks'], [2e9, 'terlalu besar']]) {
  r = await a.req('POST', '/api/keuangan', { jenis: 'masuk', jenjang: 'TPQ', kategori: 'Infaq', nama: 'x', jumlah: j, tanggal: '2026-11-01' })
  check(`jumlah ${msg} ditolak`, r.status === 400)
}
r = await a.req('POST', '/api/keuangan', { jenis: 'keluar', jenjang: 'TPQ', kategori: 'ATK', nama: 'Spidol', jumlah: 150000, tanggal: '2026-11-02' })
const atkId = r.json.transaksi?.id
r = await a.req('GET', '/api/keuangan')
check('saldo kas = 1.000.000 - 150.000', r.json.ringkasan.saldo === 850000 && r.json.ringkasan.masuk === 1000000, JSON.stringify(r.json.ringkasan))

// SPP -> kas otomatis
r = await a.req('POST', '/api/keuangan/spp/generate', { periode: '2026-11' })
const aktifTpq = (await a.req('GET', '/api/santri?jenjang=TPQ')).json.santri.filter((s) => s.status === 'aktif').length
check('generate tagihan SPP untuk semua santri aktif', r.status === 200 && r.json.dibuat === aktifTpq && aktifTpq > 60, JSON.stringify(r.json) + ' aktif=' + aktifTpq)
r = await a.req('POST', '/api/keuangan/spp/generate', { periode: '2026-11' })
check('generate ulang tidak menggandakan', r.json.dibuat === 0)
r = await a.req('GET', '/api/keuangan/spp?periode=2026-11')
const tag = r.json.tagihan[0]
check('tagihan berisi tarif 50.000 status belum', tag.jumlah === 50000 && tag.status === 'belum')
const saldoSebelum = (await a.req('GET', '/api/keuangan')).json.ringkasan.saldo
r = await a.req('PATCH', `/api/keuangan/spp/${tag.id}`, { status: 'lunas', tanggal: '2026-11-15' })
check('SPP ditandai lunas', r.status === 200)
r = await a.req('GET', '/api/keuangan')
check('SPP LUNAS MENAMBAH SALDO KAS (+50.000)', r.json.ringkasan.saldo === saldoSebelum + 50000, JSON.stringify(r.json.ringkasan))
const trxSpp = r.json.transaksi.find((t) => t.tagihanSppId === tag.id)
check('transaksi kas SPP tercatat benar', trxSpp?.kategori === 'SPP' && trxSpp?.jenis === 'masuk' && trxSpp?.jumlah === 50000 && trxSpp?.tanggal === '2026-11-15', JSON.stringify(trxSpp))
r = await a.req('PATCH', `/api/keuangan/spp/${tag.id}`, { status: 'lunas' })
r = await a.req('GET', '/api/keuangan')
check('lunas dua kali TIDAK menggandakan kas', r.json.ringkasan.saldo === saldoSebelum + 50000)
const par = await Promise.all([1, 2, 3].map(() => a.req('PATCH', `/api/keuangan/spp/${(r.json && tag.id)}`, { status: 'lunas' })))
r = await a.req('GET', '/api/keuangan')
check('permintaan lunas paralel tetap tidak menggandakan kas', r.json.ringkasan.saldo === saldoSebelum + 50000, JSON.stringify(r.json.ringkasan))
r = await a.req('DELETE', `/api/keuangan/${trxSpp.id}`)
check('transaksi dari SPP tidak bisa dihapus manual (409)', r.status === 409)
r = await a.req('PATCH', `/api/keuangan/spp/${tag.id}`, { status: 'belum' })
r = await a.req('GET', '/api/keuangan')
check('batal lunas -> kas kembali (-50.000)', r.json.ringkasan.saldo === saldoSebelum && !r.json.transaksi.some((t) => t.tagihanSppId === tag.id))
r = await a.req('PATCH', `/api/keuangan/spp/${tag.id}`, { status: 'telat' })
check('status telat tidak menyentuh kas', r.status === 200 && (await a.req('GET', '/api/keuangan')).json.ringkasan.saldo === saldoSebelum)
r = await a.req('GET', '/api/keuangan/spp?periode=2026-13')
check('periode tidak valid ditolak', r.status === 400)
r = await a.req('DELETE', `/api/keuangan/${atkId}`)
check('hapus transaksi manual OK', r.status === 200)

// Tabungan
const murid = (await a.req('GET', '/api/santri?jenjang=TPQ')).json.santri[0].id
r = await a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'setor', jumlah: 500000, tanggal: '2026-11-10' })
check('setor tabungan', r.status === 201)
r = await a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'tarik', jumlah: 600000 })
check('tarik melebihi saldo ditolak (saldo tidak cukup)', r.status === 409 || r.status === 400)
r = await a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'tarik', jumlah: 300000, konfirmasi: true })
check('tarik 300.000 dengan konfirmasi OK (saldo 200.000)', r.status === 201)
r = await a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'tarik', jumlah: 250000, konfirmasi: true })
check('tarik > saldo walau dikonfirmasi tetap ditolak (400)', r.status === 400 && /Saldo/.test(r.json.error), JSON.stringify(r))
r = await a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'setor', jumlah: 1000000 })
const par2 = await Promise.all([1, 2, 3, 4].map(() => a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'tarik', jumlah: 500000, konfirmasi: true })))
check('4 penarikan paralel: hanya yang cukup saldo lolos', par2.filter((x) => x.status === 201).length === 2, par2.map((x) => x.status).join(','))
r = await a.req('GET', `/api/tabungan?santriId=${murid}`)
check('saldo tidak pernah minus setelah balapan', r.json.saldo === 200000 && r.json.saldo >= 0, JSON.stringify(r.json.saldo))
r = await a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'tarik', jumlah: 150000 })
check('tarik <= 200.000 tanpa konfirmasi OK', r.status === 201)
r = await a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'tarik', jumlah: 40000 })
check('tarik 40.000 OK (saldo 10.000 sisa)', r.status === 201)
r = await a.req('POST', '/api/tabungan', { santriId: murid, jenis: 'setor', jumlah: -1 })
check('setor negatif ditolak', r.status === 400)
r = await a.req('POST', '/api/tabungan', { santriId: 'tidak-ada', jenis: 'setor', jumlah: 1000 })
check('santri tak ada -> 404', r.status === 404)
r = await a.req('GET', '/api/tabungan/saldo')
check('daftar saldo per santri', r.json.saldo.find((x) => x.santriId === murid)?.saldo === 10000, JSON.stringify(r.json))

// ---------- Hafalan / Pengumuman / KBM / Anggaran ----------
const sid = (await a.req('GET', '/api/santri?jenjang=TPQ')).json.santri[0].id
r = await g2.req('POST', '/api/setoran', { santriId: sid, jenis: 'Iqra', materi: 'Iqra 3 hal 14', nilai: 'Lancar', tanggal: '2026-11-14' })
check('guru mencatat setoran', r.status === 201, JSON.stringify(r))
const setId = r.json.setoran?.id
r = await g2.req('POST', '/api/setoran', { santriId: sid, jenis: 'Iqra', materi: 'x', nilai: 'Sempurna', tanggal: '2026-11-14' })
check('nilai setoran tak dikenal ditolak', r.status === 400)
r = await g2.req('POST', '/api/setoran', { santriId: sid, jenis: 'Hafalan', materi: '', nilai: 'Cukup', tanggal: '2026-11-14' })
check('materi kosong ditolak', r.status === 400)
r = await g2.req('GET', `/api/setoran?santriId=${sid}`)
check('riwayat setoran terbaca', r.json.setoran.length === 1)
r = await g2.req('GET', '/api/setoran/progres')
check('progres: jumlah + terakhir', r.json.progres.find((x) => x.santriId === sid)?.jumlah === 1)
r = await g2.req('DELETE', `/api/setoran/${setId}`)
check('guru tidak boleh hapus setoran (403)', r.status === 403)

r = await a.req('POST', '/api/pengumuman', { judul: 'Libur', isi: 'Libur Kamis' })
const pgId = r.json.pengumuman?.id
check('Pimpinan membuat pengumuman (tampil default)', r.status === 201 && r.json.pengumuman.tampil === true, JSON.stringify(r))
r = await g2.req('POST', '/api/pengumuman', { judul: 'Liar', isi: 'x' })
check('guru tidak boleh membuat pengumuman (403)', r.status === 403)
r = await g2.req('GET', '/api/pengumuman')
check('guru melihat pengumuman yang tampil', r.json.pengumuman.length === 1)
r = await a.req('PATCH', `/api/pengumuman/${pgId}`, { tampil: false })
check('PATCH tampil=false tidak mereset judul/isi', r.json.pengumuman?.judul === 'Libur' && r.json.pengumuman?.isi === 'Libur Kamis' && r.json.pengumuman?.tampil === false, JSON.stringify(r.json))
r = await g2.req('GET', '/api/pengumuman')
check('pengumuman ditutup hilang dari guru', r.json.pengumuman.length === 0)
r = await a.req('GET', '/api/pengumuman')
check('Pimpinan masih melihat yang ditutup', r.json.pengumuman.length === 1)

const kls = (await a.req('POST', '/api/kelas', { nama: 'Kelas KBM', jenjang: 'TPQ' })).json.kelas.id
const gr = (await a.req('POST', '/api/guru', { nama: 'Ustadz KBM', jenjang: 'TPQ' })).json.guru.id
r = await a.req('POST', '/api/kbm/jadwal', { kelasId: kls, hari: 'Senin', jamMulai: '15:30', jamSelesai: '16:30', mapel: 'Iqra', guruId: gr })
check('jadwal KBM dibuat', r.status === 201, JSON.stringify(r))
const jdId = r.json.row?.id
r = await a.req('POST', '/api/kbm/jadwal', { kelasId: kls, hari: 'Senin', jamMulai: '16:30', jamSelesai: '15:30', mapel: 'X' })
check('jam selesai sebelum mulai ditolak', r.status === 400)
r = await a.req('POST', '/api/kbm/jadwal', { hari: 'Senin', jamMulai: '25:00', jamSelesai: '26:00', mapel: 'X' })
check('jam tidak valid (25:00) ditolak', r.status === 400)
r = await a.req('POST', '/api/kbm/jadwal', { hari: 'Hari Raya', jamMulai: '15:30', jamSelesai: '16:30', mapel: 'X' })
check('hari tidak dikenal ditolak', r.status === 400)
r = await a.req('PATCH', `/api/kbm/jadwal/${jdId}`, { mapel: 'Tajwid' })
check('PATCH jadwal tidak mereset jam/hari/guru', r.json.row?.mapel === 'Tajwid' && r.json.row?.jamMulai === '15:30' && r.json.row?.hari === 'Senin' && r.json.row?.guruId === gr, JSON.stringify(r.json))
r = await a.req('PATCH', `/api/kbm/jadwal/${jdId}`, { jamMulai: '17:00' })
r = await a.req('PATCH', `/api/kbm/jadwal/${jdId}`, { jamSelesai: '16:00', jamMulai: '17:00' })
check('PATCH jam terbalik ditolak', r.status === 400)
r = await g2.req('GET', '/api/kbm/jadwal')
check('guru boleh melihat jadwal', r.status === 200 && r.json.rows.length === 1)
r = await g2.req('POST', '/api/kbm/jadwal', { hari: 'Senin', jamMulai: '15:30', jamSelesai: '16:30', mapel: 'X' })
check('guru tidak boleh ubah jadwal (403)', r.status === 403)
r = await a.req('POST', '/api/kbm/piket', { guruId: gr, hari: 'Rabu', keterangan: 'Piket sore' })
check('piket dibuat', r.status === 201)
r = await a.req('POST', '/api/kbm/alokasi', { kelasId: kls, mapel: 'Iqra', jamPerMinggu: 0 })
check('alokasi 0 jam ditolak', r.status === 400)
r = await a.req('POST', '/api/kbm/alokasi', { kelasId: kls, mapel: 'Iqra', jamPerMinggu: 4, hari: 'Senin, Kamis' })
check('alokasi dibuat', r.status === 201)

r = await a.req('PUT', '/api/kbm/absensi-guru', { tanggal: '2026-11-14', kelompok: 'Guru', catatan: [{ guruId: gr, status: 'H' }] })
check('Pimpinan menyimpan absensi guru', r.status === 200 && r.json.tersimpan === 1)
r = await a.req('PUT', '/api/kbm/absensi-guru', { tanggal: '2026-11-14', kelompok: 'Guru', catatan: [{ guruId: gr, status: 'I' }] })
r = await a.req('GET', `/api/kbm/absensi-guru?tanggal=2026-11-14&kelompok=Guru`)
check('simpan ulang menimpa (bukan dobel)', r.json.catatan.length === 1 && r.json.catatan[0].status === 'I')
r = await a.req('PUT', '/api/kbm/absensi-guru', { tanggal: '2026-11-14', kelompok: 'Guru', catatan: [{ guruId: 'hantu', status: 'H' }] })
check('guru tak dikenal ditolak', r.status === 400)
r = await g2.req('PUT', '/api/kbm/absensi-guru', { tanggal: '2026-11-14', kelompok: 'Guru', catatan: [] })
check('guru tidak boleh isi absensi guru (403)', r.status === 403)

for (const p of ['/api/anggaran/pos', '/api/anggaran/realita', '/api/anggaran/biaya', '/api/anggaran/target', '/api/anggaran/arus-kas?tahun=2026']) {
  r = await g2.req('GET', p)
  check(`guru ditolak ${p} (403)`, r.status === 403)
}
r = await a.req('POST', '/api/anggaran/pos', { pos: 'Infaq', jenis: 'masuk', jenjang: 'TPQ', rencana: 500000 })
check('pos RAPBM dibuat', r.status === 201, JSON.stringify(r))
const posId = r.json.row?.id
r = await a.req('POST', '/api/anggaran/pos', { pos: 'Infaq', jenis: 'masuk', jenjang: 'TPQ', rencana: -1 })
check('rencana negatif ditolak', r.status === 400)
await a.req('POST', '/api/keuangan', { jenis: 'masuk', jenjang: 'TPQ', kategori: 'Infaq', nama: 'Infaq Jumat', jumlah: 200000, tanggal: '2026-11-07', catatan: 'Kotak infaq' })
await a.req('POST', '/api/keuangan', { jenis: 'masuk', jenjang: 'MI', kategori: 'Infaq', nama: 'Infaq MI', jumlah: 99000, tanggal: '2026-11-07' })
await a.req('POST', '/api/keuangan', { jenis: 'keluar', jenjang: 'TPQ', kategori: 'ATK', nama: 'Spidol', jumlah: 30000, tanggal: '2026-12-02' })
r = await a.req('GET', '/api/anggaran/realita')
const infaq = r.json.realita.find((x) => x.id === posId)
check('realisasi hanya jenis+jenjang yang cocok (Rp200.000, tanpa Infaq MI)', infaq?.realisasi === 200000 && infaq?.selisih === -300000, JSON.stringify(infaq))
r = await a.req('GET', '/api/anggaran/arus-kas?tahun=2026')
const nov = r.json.arusKas.find((x) => x.bulan === '2026-11')
const des = r.json.arusKas.find((x) => x.bulan === '2026-12')
check('arus kas 12 bulan, Nov masuk 299.000+ & Des keluar 30.000', r.json.arusKas.length === 12 && nov.masuk >= 299000 && des.keluar === 30000 && des.bersih === -30000, JSON.stringify([nov, des]))
r = await a.req('GET', '/api/anggaran/arus-kas?tahun=abcd')
check('tahun tidak valid ditolak', r.status === 400)
r = await a.req('POST', '/api/anggaran/biaya', { nama: 'Seragam', jumlah: 150000 })
check('biaya dibuat', r.status === 201)
r = await a.req('POST', '/api/anggaran/target', { nama: 'Kitab', target: 0 })
check('target 0 ditolak', r.status === 400)
r = await a.req('POST', '/api/anggaran/target', { nama: 'Kitab', target: 75000, terkumpul: 45000 })
const tgId = r.json.row?.id
r = await a.req('PATCH', `/api/anggaran/target/${tgId}`, { terkumpul: 60000 })
check('PATCH target tidak mereset nama/target', r.json.row?.nama === 'Kitab' && r.json.row?.target === 75000 && r.json.row?.terkumpul === 60000, JSON.stringify(r.json))
r = await a.req('PATCH', `/api/anggaran/target/${tgId}`, {})
check('PATCH kosong ditolak', r.status === 400)
r = await a.req('DELETE', `/api/anggaran/pos/${posId}`)
check('hapus pos', r.status === 200)
r = await a.req('POST', '/api/tabungan', { santriId: sid, jenis: 'setor', jumlah: 25000, catatan: 'Setoran mingguan' })
r = await a.req('GET', `/api/tabungan?santriId=${sid}`)
check('catatan tabungan tersimpan', r.json.transaksi.some((t) => t.catatan === 'Setoran mingguan'))

// ---------- Laporan / Export ----------
r = await g2.req('GET', '/api/kbm/guru')
check('nama guru untuk jadwal: tanpa honor/HP', r.status === 200 && r.json.guru.length > 0 && r.json.guru.every((x) => !('honor' in x) && !('hp' in x)), JSON.stringify(r.json).slice(0, 160))
r = await g2.req('GET', '/api/laporan/ringkasan')
check('guru: ringkasan tanpa data keuangan', r.status === 200 && r.json.keuangan === undefined && r.json.perJenjang.TPQ.aktif > 0, JSON.stringify(Object.keys(r.json)))
r = await a.req('GET', '/api/laporan/ringkasan')
const rk = r.json
check('Pimpinan: ringkasan memuat keuangan', rk.keuangan && typeof rk.keuangan.saldoKas === 'number' && rk.keuangan.spp.periode.length === 7, JSON.stringify(rk.keuangan))
check('ringkasan: L+P = aktif per jenjang', rk.perJenjang.TPQ.L + rk.perJenjang.TPQ.P === rk.perJenjang.TPQ.aktif)
check('ringkasan: isian santri/guru/kelas terhitung', rk.isian.santri > 0 && rk.isian.guru > 0 && rk.isian.kelas > 0)
check('ringkasan: rata kehadiran 0-100', rk.rataKehadiran >= 0 && rk.rataKehadiran <= 100)
check('saldo kas ringkasan = saldo halaman Keuangan', rk.keuangan.saldoKas === (await a.req('GET', '/api/keuangan')).json.ringkasan.saldo)

await a.req('POST', '/api/santri', { nis: 'INJ1', nama: '=HYPERLINK("http://evil")', jenisKelamin: 'L', jenjang: 'TPQ' })
const csvRes = await fetch('http://localhost:5199/api/laporan/export/santri', { headers: { cookie: a.cookie } })
const csvBuf = new Uint8Array(await csvRes.clone().arrayBuffer())
const csv = await csvRes.text()
check('export santri: header CSV + nama file', csvRes.status === 200 && /text\/csv/.test(csvRes.headers.get('content-type')) && /filename="tpq-santri-\d{4}-\d{2}-\d{2}\.csv"/.test(csvRes.headers.get('content-disposition')))
check('export santri: byte BOM UTF-8 (EF BB BF) terkirim + kepala kolom', csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf && csv.startsWith('NIS,Nama,'))
check('export santri: CSV injection dinetralkan (apostrof)', csv.includes(`"'=HYPERLINK(""http://evil"")"`) && !/,=HYPERLINK/.test(csv), csv.split('\r\n').find((l) => l.includes('INJ1')))
for (const j of ['nilai', 'absensi', 'keuangan', 'tabungan', 'guru']) {
  const x = await fetch(`http://localhost:5199/api/laporan/export/${j}`, { headers: { cookie: a.cookie } })
  check(`export ${j} berhasil (Pimpinan)`, x.status === 200 && (await x.text()).split('\r\n').length > 1)
}
for (const j of ['guru', 'keuangan', 'tabungan']) {
  r = await g2.req('GET', `/api/laporan/export/${j}`)
  check(`guru ditolak export ${j} (403)`, r.status === 403)
}
r = await g2.req('GET', '/api/laporan/export/santri')
check('guru boleh export santri', r.status === 200)
r = await a.req('GET', '/api/laporan/export/rahasia')
check('jenis export tak dikenal -> 404', r.status === 404)

// Logout
r = await a.req('POST', '/api/auth/logout')
r = await a.req('GET', '/api/auth/me')
check('logout menghapus sesi', r.status === 401)

console.log(`\n${pass} lulus, ${fail} gagal`)
process.exit(fail ? 1 : 0)


