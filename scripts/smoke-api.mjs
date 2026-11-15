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

// Logout
r = await a.req('POST', '/api/auth/logout')
r = await a.req('GET', '/api/auth/me')
check('logout menghapus sesi', r.status === 401)

console.log(`\n${pass} lulus, ${fail} gagal`)
process.exit(fail ? 1 : 0)
