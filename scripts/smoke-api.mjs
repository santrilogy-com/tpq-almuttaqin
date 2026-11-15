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
check('hapus pertemuan tak ada -> 404', r.status === 404)

// Logout
r = await a.req('POST', '/api/auth/logout')
r = await a.req('GET', '/api/auth/me')
check('logout menghapus sesi', r.status === 401)

console.log(`\n${pass} lulus, ${fail} gagal`)
process.exit(fail ? 1 : 0)
