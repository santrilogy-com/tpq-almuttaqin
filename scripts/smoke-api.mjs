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

// Logout
r = await a.req('POST', '/api/auth/logout')
r = await a.req('GET', '/api/auth/me')
check('logout menghapus sesi', r.status === 401)

console.log(`\n${pass} lulus, ${fail} gagal`)
process.exit(fail ? 1 : 0)
