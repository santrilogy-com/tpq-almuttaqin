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
check('di localhost setup tidak butuh kode', r.json.perluKode === false)

// (Jalur setup terkunci/SETUP_TOKEN diuji terpisah: node scripts/smoke-setup-lock.mjs)

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

r = await a.req('POST', '/api/kelas', { nama: "Qur'ani 1", jenjang: 'TPQ' })
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
check('guru boleh menambah santri', r.status === 201 && r.json.santri.jilid === "Qur'ani 1", JSON.stringify(r))
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
r = await a.req('PATCH', `/api/santri/${s2}`, { jilid: "Qur'ani 4", wali: 'Pak Budi', status: 'keluar' })
r = await g2.req('PATCH', `/api/santri/${s2}`, { alamat: 'Jl. Mawar' })
check(
  'PATCH sebagian TIDAK mereset field lain (jilid/wali/status/kelas)',
  r.json.santri?.jilid === "Qur'ani 4" && r.json.santri?.wali === 'Pak Budi' &&
    r.json.santri?.status === 'keluar' && r.json.santri?.kelasId === kelasId,
  JSON.stringify(r.json)
)
r = await g2.req('GET', '/api/santri?jenjang=MI')
check('filter jenjang MI kosong', r.json.santri.length === 0)
r = await g2.req('GET', '/api/santri?jenjang=TPQ')
check('filter jenjang TPQ berisi 2', r.json.santri.length === 2)

r = await g2.req('POST', `/api/santri/${sId}/naik-jilid`, { dari: "Qur'ani 1" })
check("naik jilid Qur'ani 1 -> Qur'ani 2", r.status === 200 && r.json.santri.jilid === "Qur'ani 2", JSON.stringify(r))
r = await g2.req('POST', `/api/santri/${sId}/naik-jilid`, { dari: "Qur'ani 1" })
check('ketukan ganda tidak naik dua tingkat (409)', r.status === 409)
r = await g2.req('GET', '/api/santri')
check("jilid tetap Qur'ani 2", r.json.santri.find((x) => x.id === sId).jilid === "Qur'ani 2")

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
r = await a.req('POST', '/api/kelas', { nama: "Qur'ani 9", jenjang: 'MI', pengajar: 'Ustadz X', ruang: 'R1' })
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
r = await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Harian', mapel: "Qur'ani", nilai: 80, tanggal: '2026-11-10' })
check('nilai: semester turun otomatis dari tanggal', r.status === 201 && r.json.nilai.semester === '2026/2027 Ganjil', JSON.stringify(r))
const nilaiId = r.json.nilai?.id
for (const [n, msg] of [[101, '>100'], [-1, '<0']]) {
  r = await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Harian', mapel: "Qur'ani", nilai: n, tanggal: '2026-11-10' })
  check(`nilai ${msg} ditolak`, r.status === 400)
}
r = await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Harian', mapel: "Qur'ani", nilai: '80', tanggal: '2026-11-10' })
check('nilai berupa teks ditolak', r.status === 400)
r = await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Ujian', mapel: "Qur'ani", nilai: 80, tanggal: '2026-11-10' })
check('jenis nilai tidak dikenal ditolak', r.status === 400)
r = await g2.req('POST', '/api/nilai', { santriId: 'tidak-ada', jenis: 'Harian', mapel: "Qur'ani", nilai: 80, tanggal: '2026-11-10' })
check('nilai untuk santri tak ada -> 404', r.status === 404)
r = await g2.req('GET', `/api/rapor/${sa1}`)
check('rapor: Harian 80 saja = 80, bukan 32 (sementara)', r.json.akhir === 80 && r.json.lengkap === false, JSON.stringify(r.json))
await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Imda', mapel: "Qur'ani", nilai: 60, tanggal: '2026-11-11' })
await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Praktek', mapel: "Qur'ani", nilai: 85.5, tanggal: '2026-11-12' })
r = await g2.req('GET', `/api/rapor/${sa1}`)
// 80*.4 + 60*.3 + 85.5*.3 = 32 + 18 + 25.65 = 75.65 -> 75.7 (dibulatkan 1 desimal)
check('rapor lengkap: 40/30/30 + desimal diterima', r.json.lengkap === true && r.json.akhir === 75.7 && r.json.predikat === 'C (Cukup)', JSON.stringify(r.json))
check('rapor: kehadiran dari pertemuan kelasnya (1/1 = 100%)', r.json.kehadiran?.persen === 100 && r.json.kehadiran?.total === 1, JSON.stringify(r.json.kehadiran))
await g2.req('POST', '/api/nilai', { santriId: sa1, jenis: 'Harian', mapel: "Qur'ani", nilai: 50, tanggal: '2027-02-01' })
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
check("guru mencatat setoran (masukan lama 'Iqra' otomatis menjadi Qur'ani)", r.status === 201 && r.json.setoran.jenis === "Qur'ani", JSON.stringify(r))
const setId = r.json.setoran?.id
r = await g2.req('POST', '/api/setoran', { santriId: sid, jenis: 'Iqra', materi: 'x', nilai: 'Sempurna', tanggal: '2026-11-14' })
check('nilai setoran tak dikenal ditolak', r.status === 400)
r = await g2.req('POST', '/api/setoran', { santriId: sid, jenis: "Qur'ani", materi: "Qur'ani 3 hal 15", nilai: 'Cukup', tanggal: '2026-11-15' })
check("jenis setoran Qur'ani diterima langsung", r.status === 201 && r.json.setoran.jenis === "Qur'ani", JSON.stringify(r))
const setId2 = r.json.setoran?.id
r = await g2.req('POST', '/api/setoran', { santriId: sid, jenis: 'Hafalan Palsu', materi: 'x', nilai: 'Cukup', tanggal: '2026-11-15' })
check('jenis setoran tak dikenal ditolak', r.status === 400)
r = await g2.req('POST', '/api/setoran', { santriId: sid, jenis: 'Hafalan', materi: '', nilai: 'Cukup', tanggal: '2026-11-14' })
check('materi kosong ditolak', r.status === 400)
r = await g2.req('GET', `/api/setoran?santriId=${sid}`)
check('riwayat setoran terbaca (2 setoran)', r.json.setoran.length === 2)
r = await g2.req('GET', '/api/setoran/progres')
check('progres: jumlah + terakhir', r.json.progres.find((x) => x.santriId === sid)?.jumlah === 2)
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
r = await a.req('POST', '/api/kbm/jadwal', { kelasId: kls, hari: 'Senin', jamMulai: '15:30', jamSelesai: '16:30', mapel: "Qur'ani", guruId: gr })
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
r = await a.req('POST', '/api/kbm/alokasi', { kelasId: kls, mapel: "Qur'ani", jamPerMinggu: 0 })
check('alokasi 0 jam ditolak', r.status === 400)
r = await a.req('POST', '/api/kbm/alokasi', { kelasId: kls, mapel: "Qur'ani", jamPerMinggu: 4, hari: 'Senin, Kamis' })
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
{
  // Absensi lama (di luar 60 hari) tidak boleh ikut terhitung di Beranda (dan tidak dipindai).
  const sebelum = rk.absensiTotal.A
  await a.req('PUT', '/api/absensi/pertemuan', { kelasId: kA, tanggal: '2025-01-01', catatan: [{ santriId: sa2, status: 'A' }] })
  const sesudah = (await a.req('GET', '/api/laporan/ringkasan')).json.absensiTotal.A
  check('ringkasan hanya menghitung absensi 60 hari terakhir (absensi 2025 diabaikan)', sesudah === sebelum, `${sebelum} -> ${sesudah}`)
}
check('saldo kas ringkasan = saldo halaman Keuangan', rk.keuangan.saldoKas === (await a.req('GET', '/api/keuangan')).json.ringkasan.saldo)
{
  const pj = rk.keuangan.perJenjang
  check('ringkasan per jenjang: TPQ + MI = total (kas, tabungan, honor, SPP)', pj.TPQ.saldoKas + pj.MI.saldoKas === rk.keuangan.saldoKas && pj.TPQ.totalTabungan + pj.MI.totalTabungan === rk.keuangan.totalTabungan && pj.TPQ.honorBelumLunas + pj.MI.honorBelumLunas === rk.keuangan.honorBelumLunas && pj.TPQ.spp.total + pj.MI.spp.total === rk.keuangan.spp.total, JSON.stringify(pj))
  for (const j of ['TPQ', 'MI']) {
    const k = (await a.req('GET', `/api/keuangan?jenjang=${j}`)).json.ringkasan
    check(`saldo kas ${j} di Beranda = saldo di halaman Keuangan (filter ${j})`, pj[j].saldoKas === k.saldo && pj[j].masuk === k.masuk && pj[j].keluar === k.keluar, `${JSON.stringify(pj[j])} vs ${JSON.stringify(k)}`)
  }
  r = await g2.req('GET', '/api/laporan/ringkasan')
  check('guru tetap tidak menerima data keuangan per jenjang', r.json.keuangan === undefined)
}

await a.req('POST', '/api/santri', { nis: 'INJ1', nama: '=HYPERLINK("http://evil")', jenisKelamin: 'L', jenjang: 'TPQ' })
const csvRes = await fetch(base + '/api/laporan/export/santri', { headers: { cookie: a.cookie } })
const csvBuf = new Uint8Array(await csvRes.clone().arrayBuffer())
const csv = await csvRes.text()
check('export santri: header CSV + nama file', csvRes.status === 200 && /text\/csv/.test(csvRes.headers.get('content-type')) && /filename="tpq-santri-\d{4}-\d{2}-\d{2}\.csv"/.test(csvRes.headers.get('content-disposition')))
check('export santri: byte BOM UTF-8 (EF BB BF) terkirim + kepala kolom', csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf && csv.startsWith('NIS,Nama,'))
check('export santri: CSV injection dinetralkan (apostrof)', csv.includes(`"'=HYPERLINK(""http://evil"")"`) && !/,=HYPERLINK/.test(csv), csv.split('\r\n').find((l) => l.includes('INJ1')))
for (const j of ['nilai', 'absensi', 'keuangan', 'tabungan', 'guru']) {
  const x = await fetch(`${base}/api/laporan/export/${j}`, { headers: { cookie: a.cookie } })
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

// ---------- Foto santri / guru ----------
{
  const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const fs = (await a.req('GET', '/api/santri?jenjang=TPQ')).json.santri
  const fSantri = fs[0].id
  const fGuru = (await a.req('GET', '/api/guru')).json.guru[0].id
  r = await new Client().req('GET', '/api/foto')
  check('foto: tanpa login ditolak (401)', r.status === 401)
  r = await new Client().req('GET', `/api/foto/santri/${fSantri}`)
  check('foto: gambar tanpa login ditolak (401)', r.status === 401)

  r = await g2.req('PUT', `/api/foto/santri/${fSantri}`, { data: JPEG })
  check('guru boleh mengunggah foto santri', r.status === 200 && typeof r.json.v === 'number', JSON.stringify(r))
  r = await g2.req('PUT', `/api/foto/guru/${fGuru}`, { data: JPEG })
  check('guru TIDAK boleh mengunggah foto guru (403)', r.status === 403)
  r = await g2.req('DELETE', `/api/foto/guru/${fGuru}`)
  check('guru TIDAK boleh menghapus foto guru (403)', r.status === 403)
  r = await a.req('PUT', `/api/foto/guru/${fGuru}`, { data: PNG })
  check('Pimpinan mengunggah foto guru (PNG)', r.status === 200)

  for (const [nama, data] of [
    ['SVG', 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+'],
    ['HTML menyamar sebagai JPEG', 'data:image/jpeg;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64')],
    ['klaim PNG, isi JPEG', 'data:image/png;base64,' + JPEG.split(',')[1]],
    ['bukan data URL', 'http://evil.example/foto.jpg'],
    ['terlalu besar (>150 KB)', 'data:image/jpeg;base64,/9j/' + 'A'.repeat(160000)],
    ['base64 rusak', 'data:image/jpeg;base64,/9j/"><b>'],
  ]) {
    r = await g2.req('PUT', `/api/foto/santri/${fSantri}`, { data })
    check(`foto ditolak: ${nama}`, r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`)
  }
  r = await g2.req('PUT', '/api/foto/santri/tidak-ada', { data: JPEG })
  check('foto untuk santri yang tak ada -> 404', r.status === 404)
  r = await g2.req('PUT', `/api/foto/kelas/${fSantri}`, { data: JPEG })
  check('jenis foto tak dikenal -> 404', r.status === 404)

  const img = await fetch(`${base}/api/foto/santri/${fSantri}`, { headers: { cookie: g2.cookie } })
  const bytes = new Uint8Array(await img.arrayBuffer())
  check('gambar disajikan sebagai image/jpeg dengan byte JPEG asli', img.status === 200 && img.headers.get('content-type') === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, `${img.status} ${img.headers.get('content-type')}`)
  check('gambar: cache privat (bukan publik) + nosniff + CSP sandbox', /private/.test(img.headers.get('cache-control')) && !/public/.test(img.headers.get('cache-control')) && img.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(img.headers.get('content-security-policy')), JSON.stringify([...img.headers]))
  const png = await fetch(`${base}/api/foto/guru/${fGuru}`, { headers: { cookie: a.cookie } })
  check('foto PNG disajikan sebagai image/png', png.headers.get('content-type') === 'image/png')

  r = await g2.req('GET', '/api/foto')
  const ent = r.json.foto.find((x) => x.jenis === 'santri' && x.ownerId === fSantri)
  check('indeks foto: ada pemilik + versi, TANPA data gambar', ent && typeof ent.v === 'number' && !('data' in ent) && r.json.foto.length === 2, JSON.stringify(r.json))
  await new Promise((s) => setTimeout(s, 15))
  r = await g2.req('PUT', `/api/foto/santri/${fSantri}`, { data: PNG })
  check('ganti foto: versi naik (cache-busting) dan isi berganti', r.json.v > ent.v)
  const baru = await fetch(`${base}/api/foto/santri/${fSantri}`, { headers: { cookie: g2.cookie } })
  check('setelah diganti, gambar yang disajikan = PNG baru', baru.headers.get('content-type') === 'image/png')

  r = await g2.req('DELETE', `/api/foto/santri/${fSantri}`)
  check('guru boleh menghapus foto santri', r.status === 200)
  r = await g2.req('GET', `/api/foto/santri/${fSantri}`)
  check('foto yang dihapus -> 404', r.status === 404)

  // Hapus santri ikut menghapus fotonya (tabel foto tanpa FK)
  const tmp = (await a.req('POST', '/api/santri', { nis: 'FOTO1', nama: 'Santri Foto', jenisKelamin: 'P', jenjang: 'TPQ' })).json.santri.id
  await a.req('PUT', `/api/foto/santri/${tmp}`, { data: JPEG })
  r = await a.req('DELETE', `/api/santri/${tmp}`)
  r = await a.req('GET', '/api/foto')
  check('hapus santri ikut menghapus fotonya', !r.json.foto.some((x) => x.ownerId === tmp))
  const tg = (await a.req('POST', '/api/guru', { nama: 'Ustadz Foto', jenjang: 'TPQ' })).json.guru.id
  await a.req('PUT', `/api/foto/guru/${tg}`, { data: JPEG })
  await a.req('DELETE', `/api/guru/${tg}`)
  r = await a.req('GET', '/api/foto')
  check('hapus guru ikut menghapus fotonya', !r.json.foto.some((x) => x.ownerId === tg))
  // sisakan 2 foto agar ikut diuji pada backup/restore berikut
  await a.req('PUT', `/api/foto/santri/${fSantri}`, { data: JPEG })
}

// ---------- Backup / Restore / Import ----------
const BASE = base
const ambilBackup = async () => {
  const x = await fetch(`${BASE}/api/backup/export`, { headers: { cookie: a.cookie } })
  const teks = await x.text()
  return { status: x.status, disp: x.headers.get('content-disposition'), teks, json: JSON.parse(teks) }
}
for (const [m, p] of [['GET', '/api/backup/export'], ['POST', '/api/backup/restore'], ['POST', '/api/backup/kosongkan'], ['POST', '/api/import/santri'], ['GET', '/api/import/template/santri']]) {
  r = await g2.req(m, p, m === 'POST' ? {} : undefined)
  check(`guru ditolak ${m} ${p} (403)`, r.status === 403)
}

const b1 = await ambilBackup()
check('export backup: file JSON bernama tanggal', b1.status === 200 && /filename="tpq-backup-\d{4}-\d{2}-\d{2}\.json"/.test(b1.disp) && b1.json.format === 'tpq-v2')
check('backup TIDAK memuat sandi/akun/sesi', !/pbkdf2|passwordHash|password_hash|"sessions"|"users"|tokenHash/.test(b1.teks))
check('backup: guru tanpa userId', b1.json.data.guru.length > 0 && b1.json.data.guru.every((g) => !('userId' in g)))
const hitung = (j) => Object.fromEntries(Object.entries(j.data).map(([k, v]) => [k, v.length]))
const n1 = hitung(b1.json)
check('backup memuat 20 tabel, santri banyak, 2 foto', Object.keys(n1).length === 20 && n1.santri > 60 && n1.transaksi > 0 && n1.nilai > 0 && n1.foto === 2, JSON.stringify(n1))

r = await a.req('POST', '/api/backup/restore', { backup: b1.json })
check('restore tanpa konfirmasi ditolak', r.status === 400)
r = await a.req('POST', '/api/backup/kosongkan', { konfirmasi: 'ya' })
check('kosongkan tanpa konfirmasi tepat ditolak', r.status === 400)

// Backup rusak harus ditolak TANPA menyentuh data
const rusak = (mut) => { const c = JSON.parse(b1.teks); mut(c.data); return c }
const tolak = async (nama, mut, pola) => {
  const res = await a.req('POST', '/api/backup/restore', { konfirmasi: 'PULIHKAN', backup: rusak(mut) })
  const sama = JSON.stringify(hitung(await ambilBackup().then((x) => x.json))) === JSON.stringify(n1)
  check(`restore rusak ditolak + data utuh: ${nama}`, res.status === 400 && pola.test(res.json.error) && sama, `${res.status} ${res.json.error}`)
}
await tolak('enum tidak valid', (d) => { d.santri[0].jenjang = 'XYZ' }, /santri/)
await tolak('NIS kembar', (d) => { d.santri[1].nis = d.santri[0].nis }, /nis/)
await tolak('rujukan hantu', (d) => { d.nilai[0].santriId = 'hantu' }, /rujukan/)
await tolak('tanggal fiktif', (d) => { d.nilai[0].tanggal = '2026-02-31' }, /nilai|tanggal/)
await tolak('saldo tabungan minus', (d) => { d.tabungan.push({ id: 'zz', santriId: d.santri[0].id, jenis: 'tarik', jumlah: 99999999, tanggal: '2026-01-01', catatan: '' }) }, /minus/)
await tolak('tabel hilang', (d) => { delete d.santri }, /santri/)
await tolak('logo bukan gambar', (d) => { d.lembaga[0].logo = 'javascript:alert(1)' }, /logo|lembaga/)
r = await a.req('POST', '/api/backup/restore', { konfirmasi: 'PULIHKAN', backup: { format: 'lain' } })
check('format asing ditolak', r.status === 400)

// Roundtrip: pulihkan backup sendiri -> ekspor ulang identik
r = await a.req('POST', '/api/backup/restore', { konfirmasi: 'PULIHKAN', backup: b1.json })
check('restore backup valid berhasil', r.status === 200 && r.json.baris.santri === n1.santri, JSON.stringify(r.json).slice(0, 200))
const b2 = await ambilBackup()
const urut = (rows) => [...rows].map((x) => JSON.stringify(x)).sort()
const beda = Object.keys(b1.json.data).filter((k) => JSON.stringify(urut(b1.json.data[k])) !== JSON.stringify(urut(b2.json.data[k])))
check('roundtrip: semua 20 tabel (termasuk foto) identik setelah restore', beda.length === 0, 'beda: ' + beda.join(','))
r = await a.req('GET', '/api/auth/me')
check('akun/sesi tidak terganggu oleh restore', r.status === 200 && r.json.user.username === 'admin')

// Kosongkan lalu pulihkan
r = await a.req('POST', '/api/backup/kosongkan', { konfirmasi: 'HAPUS SEMUA' })
check('kosongkan berhasil', r.status === 200)
const b3 = await ambilBackup()
const n3 = hitung(b3.json)
check('setelah kosongkan: data kerja 0, identitas lembaga tetap', n3.santri === 0 && n3.transaksi === 0 && n3.kelas === 0 && n3.lembaga === 2, JSON.stringify(n3))
r = await a.req('GET', '/api/auth/me')
check('akun tetap ada setelah kosongkan', r.status === 200)
r = await a.req('POST', '/api/backup/restore', { konfirmasi: 'PULIHKAN', backup: b1.json })
check('pulihkan dari backup setelah kosongkan', r.status === 200 && hitung((await ambilBackup()).json).santri === n1.santri)

// ---- Import CSV
await a.req('POST', '/api/backup/kosongkan', { konfirmasi: 'HAPUS SEMUA' })
r = await a.req('POST', '/api/import/santri', { baris: [] })
check('import: file kosong ditolak', r.status === 400)
r = await a.req('POST', '/api/import/santri', {
  baris: [
    { Nama: 'Ahmad Fauzi', NIS: '9001', Kelas: 'Iqra 3', 'Jenis Kelamin': 'L', Jenjang: 'TPQ', Angkatan: '2024' },
    { nama: 'Siti', nis: '9002', kelas: 'iqra 3', jenis_kelamin: 'Perempuan', jenjang: 'Ibtidaiyah' },
    { Nama: 'Budi', NIS: '9001', Kelas: 'Iqra 1', 'Jenis Kelamin': 'L' },
    { Nama: '', NIS: '9003', Kelas: 'Iqra 1', 'Jenis Kelamin': 'L' },
    { Nama: 'Tanpa JK', NIS: '9004', Kelas: 'Iqra 1', 'Jenis Kelamin': 'X' },
    { Nama: 'Jenjang Salah', NIS: '9005', Kelas: 'Iqra 1', 'Jenis Kelamin': 'L', Jenjang: 'SMA' },
    { Nama: 'Tanpa Kelas', NIS: '9006', Kelas: '', 'Jenis Kelamin': 'L' },
    { Nama: 'Laki', NIS: '9007', Kelas: 'Iqra 1', 'Jenis Kelamin': 'Laki-laki' },
  ],
})
check('import santri: 3 valid, 5 ditolak dengan alasan jelas', r.status === 200 && r.json.dibuat === 3 && r.json.ditolak.length === 5, JSON.stringify(r.json))
check("import: CSV lama bertuliskan 'Iqra' -> 3 kelas dibuat otomatis per (jenjang,nama): Qur'ani 3 TPQ, Qur'ani 3 MI, Qur'ani 1 TPQ", r.json.kelasBaru === 3)
check('import: nomor baris sesuai file (judul = baris 1) -> 4,5,6,7,8', r.json.ditolak.map((x) => x.baris).join() === '4,5,6,7,8', r.json.ditolak.map((x) => x.baris).join())
check('import: alasan NIS kembar & jenis kelamin', r.json.ditolak.some((x) => /NIS 9001 kembar/.test(x.alasan)) && r.json.ditolak.some((x) => /Jenis kelamin/.test(x.alasan)) && r.json.ditolak.some((x) => /Jenjang/.test(x.alasan)), JSON.stringify(r.json.ditolak))
r = await a.req('GET', '/api/santri')
check("import: jilid dari nama kelas (Iqra 3 -> Qur'ani 3), jenis kelamin dinormalkan", r.json.santri.find((s) => s.nis === '9001')?.jilid === "Qur'ani 3" && r.json.santri.find((s) => s.nis === '9002')?.jenisKelamin === 'P' && r.json.santri.find((s) => s.nis === '9007')?.jenisKelamin === 'L', JSON.stringify(r.json.santri.map((s) => [s.nis, s.jilid, s.jenisKelamin])))
{
  const kl = (await a.req('GET', '/api/kelas')).json.kelas.map((k) => k.nama)
  check(`import: nama kelas tersimpan sebagai Qur'ani, tidak ada yang tetap 'Iqra'`, kl.includes("Qur'ani 3") && kl.includes("Qur'ani 1") && !kl.some((n) => /iqra/i.test(n)), JSON.stringify(kl))
}
r = await a.req('POST', '/api/import/santri', { baris: [{ Nama: 'Ahmad Lagi', NIS: '9001', Kelas: 'Iqra 3', 'Jenis Kelamin': 'L' }] })
check('import ulang: NIS yang sudah ada ditolak, tidak digandakan', r.json.dibuat === 0 && /sudah ada/.test(r.json.ditolak[0].alasan))

const banyak600 = Array.from({ length: 600 }, (_, i) => ({ Nama: `Massal ${i}`, NIS: `M${i}`, Kelas: 'Massal', 'Jenis Kelamin': i % 2 ? 'L' : 'P' }))
r = await a.req('POST', '/api/import/santri', { baris: banyak600 })
check('import 600 santri sekaligus (JSON insert) tersimpan semua', r.status === 200 && r.json.dibuat === 600, JSON.stringify(r.json).slice(0, 120))
r = await a.req('POST', '/api/import/santri', { baris: Array.from({ length: 1001 }, (_, i) => ({ Nama: 'x', NIS: String(i), Kelas: 'k', 'Jenis Kelamin': 'L' })) })
check('import > 1000 baris ditolak', r.status === 400)
r = await a.req('POST', '/api/import/santri', { baris: [{ Nama: "O'Brien; DROP TABLE santri;--", NIS: 'SQL1', Kelas: 'Iqra 1', 'Jenis Kelamin': 'L' }] })
r = await a.req('GET', '/api/santri')
check('import: apostrof/SQL di nama tersimpan apa adanya (tidak ada injeksi)', r.json.santri.some((s) => s.nama === "O'Brien; DROP TABLE santri;--") && r.json.santri.length === 604)

r = await a.req('POST', '/api/import/guru', { baris: [
  { Nama: 'Ustadz Ali', Kelas: 'Iqra 1', Peran: 'wali kelas', Jenjang: 'TPQ', HP: '0812', Honor: '800.000' },
  { Nama: 'ustadz ali', Honor: '1' },
  { Nama: 'Ustadzah X', Peran: 'Dewa' },
  { Nama: 'Ustadzah Y', Honor: 'banyak' },
  { Nama: 'Ustadzah Z' },
] })
check('import guru: 2 valid (peran dinormalkan, honor 800.000), 3 ditolak', r.json.dibuat === 2 && r.json.ditolak.length === 3, JSON.stringify(r.json))
r = await a.req('GET', '/api/guru')
const ali = r.json.guru.find((g) => g.nama === 'Ustadz Ali')
check('import guru: peran Wali Kelas, honor 800000, kelas terhubung', ali?.peranGuru === 'Wali Kelas' && ali?.honor === 800000 && ali?.kelasId !== null, JSON.stringify(ali))

r = await a.req('POST', '/api/import/santri', { baris: [{ Nama: 'Anak Madrasah', NIS: 'MD1', Kelas: 'Kelas 1', 'Jenis Kelamin': 'L', Jenjang: 'Madrasah' }, { Nama: 'Anak MI', NIS: 'MD2', Kelas: 'Kelas 1', 'Jenis Kelamin': 'P', Jenjang: 'mi' }] })
check("import: jenjang 'Madrasah' dan 'MI' diterima sebagai Madrasah", r.json.dibuat === 2 && (await a.req('GET', '/api/santri?jenjang=MI')).json.santri.filter((s) => s.nis.startsWith('MD')).length === 2, JSON.stringify(r.json))
await a.req('POST', '/api/import/santri', { baris: [{ Nama: 'Kembar', NIS: 'K1', Kelas: 'Iqra 1', 'Jenis Kelamin': 'L' }, { Nama: 'Kembar', NIS: 'K2', Kelas: 'Iqra 1', 'Jenis Kelamin': 'L' }] })
r = await a.req('POST', '/api/import/nilai', { baris: [
  { Santri: '9001', Jenis: 'Harian', Mapel: 'Iqra', Nilai: '85,5', Tanggal: '2026-11-12' },
  { Santri: 'Ahmad Fauzi', Jenis: 'imda', Nilai: '90' },
  { Santri: 'Kembar', Jenis: 'Harian', Nilai: '80' },
  { Santri: 'Hantu', Jenis: 'Harian', Nilai: '80' },
  { Santri: '9001', Jenis: 'Ujian', Nilai: '80' },
  { Santri: '9001', Jenis: 'Harian', Nilai: '101' },
  { Santri: '9001', Jenis: 'Harian', Nilai: '80', Tanggal: '2026-02-31' },
] })
check('import nilai: 2 valid, 5 ditolak (kembar->pakai NIS, hantu, jenis, >100, tanggal)', r.json.dibuat === 2 && r.json.ditolak.length === 5 && r.json.ditolak.some((x) => /kembar.*NIS/.test(x.alasan)), JSON.stringify(r.json))
const sidA = (await a.req('GET', '/api/santri')).json.santri.find((s) => s.nis === '9001').id
r = await a.req('GET', `/api/nilai?santriId=${sidA}`)
check('import nilai: desimal koma 85,5 -> 85.5; mapel kosong -> Umum; semester otomatis', r.json.nilai.some((n) => n.nilai === 85.5 && n.semester === '2026/2027 Ganjil') && r.json.nilai.some((n) => n.mapel === 'Umum' && n.jenis === 'Imda'), JSON.stringify(r.json.nilai))
for (const j of ['santri', 'guru', 'nilai']) {
  const x = await fetch(`${BASE}/api/import/template/${j}`, { headers: { cookie: a.cookie } })
  const t = await x.text()
  check(`template ${j}: CSV dengan contoh baris`, x.status === 200 && /text\/csv/.test(x.headers.get('content-type')) && t.split('\r\n').filter(Boolean).length === 2)
}
r = await a.req('GET', '/api/import/template/hantu')
check('template tak dikenal -> 404', r.status === 404)

// kembalikan data awal agar tes lain/penjelajahan manual tetap punya isi
await a.req('POST', '/api/backup/restore', { konfirmasi: 'PULIHKAN', backup: b1.json })

// ---------- Logo lembaga ----------
const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
for (const [nama, logo] of [
  ['SVG (bisa memuat skrip)', 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+'],
  ['skema javascript:', 'javascript:alert(1)'],
  ['URL eksternal', 'https://evil.example/pelacak.png'],
  ['base64 dengan sisipan HTML', 'data:image/png;base64,AAAA"><script>alert(1)</script>'],
  ['terlalu besar (>150 KB)', 'data:image/png;base64,' + 'A'.repeat(160000)],
]) {
  r = await a.req('PATCH', '/api/lembaga/TPQ', { logo })
  check(`logo ditolak: ${nama}`, r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`)
}
r = await a.req('PATCH', '/api/lembaga/TPQ', { logo: PNG1 })
check('logo PNG valid diterima', r.status === 200 && r.json.lembaga.logo === PNG1)
r = await a.req('PATCH', '/api/lembaga/TPQ', { motto: 'Berilmu dan beradab' })
check('PATCH motto TIDAK menghapus logo', r.json.lembaga.logo === PNG1 && r.json.lembaga.motto === 'Berilmu dan beradab', JSON.stringify(r.json).slice(0, 120))
const bl = await ambilBackup()
check('logo ikut backup dan lolos validasi restore', bl.json.data.lembaga.find((l) => l.jenjang === 'TPQ').logo === PNG1)
r = await a.req('POST', '/api/backup/restore', { konfirmasi: 'PULIHKAN', backup: bl.json })
check('restore dengan logo berhasil', r.status === 200)
r = await a.req('PATCH', '/api/lembaga/TPQ', { logo: null })
check('logo bisa dihapus (null)', r.status === 200 && r.json.lembaga.logo === null)

// Logout
r = await a.req('POST', '/api/auth/logout')
r = await a.req('GET', '/api/auth/me')
check('logout menghapus sesi', r.status === 401)

console.log(`\n${pass} lulus, ${fail} gagal`)
process.exit(fail ? 1 : 0)







