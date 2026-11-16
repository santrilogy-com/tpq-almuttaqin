// Uji pengunci setup. Server harus dijalankan TANPA ALLOW_OPEN_SETUP (hapus/ubah nama .dev.vars) dan DB kosong.
//   mode "terkunci": tidak ada SETUP_TOKEN  -> setup harus selalu 403
//   mode "token":    .dev.vars berisi SETUP_TOKEN=kode-uji-12345 -> kode salah 403, kode benar 201
//   node scripts/smoke-setup-lock.mjs terkunci|token http://localhost:5199
const mode = process.argv[2]
const base = process.argv[3] ?? 'http://localhost:5199'
const KODE = 'kode-uji-12345'
let pass = 0, fail = 0
const check = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + x}`) }
const post = async (body, headers = {}) => {
  const r = await fetch(base + '/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}
const akun = { username: 'pemilik', nama: 'Pemilik', sandi: 'sandi-pemilik-1' }
const st = await (await fetch(base + '/api/auth/status')).json()
check('status: perlu kode setup', st.needsSetup === true && st.perluKode === true, JSON.stringify(st))

// Header Host / X-Forwarded-Host palsu tidak boleh membuka kunci
for (const h of [{ host: 'localhost' }, { 'x-forwarded-host': 'localhost' }, { 'x-forwarded-for': '127.0.0.1' }]) {
  const r = await post(akun, h)
  check(`header palsu ${Object.keys(h)[0]}=${Object.values(h)[0]} tidak membuka setup`, r.status === 403, JSON.stringify(r))
}
let r = await post({ ...akun, kodeSetup: 'tebakan' })
check('kode salah ditolak (403)', r.status === 403, JSON.stringify(r))
r = await post({ ...akun, kodeSetup: '' })
check('kode kosong ditolak (403)', r.status === 403)

if (mode === 'terkunci') {
  r = await post({ ...akun, kodeSetup: KODE })
  check('tanpa SETUP_TOKEN di server: bahkan kode "benar" ditolak, pesan menyebut SETUP_TOKEN', r.status === 403 && /SETUP_TOKEN/.test(r.json.error), JSON.stringify(r))
} else {
  r = await post({ ...akun, kodeSetup: KODE + 'x' })
  check('kode hampir benar (beda 1 karakter) ditolak', r.status === 403)
  r = await post({ ...akun, kodeSetup: KODE })
  check('kode benar membuat Pimpinan (201)', r.status === 201 && r.json.user.peran === 'pimpinan', JSON.stringify(r))
  r = await post({ ...akun, username: 'kedua', kodeSetup: KODE })
  check('setelah setup, kode benar pun tidak bisa membuat akun lagi (409)', r.status === 409)
}
const st2 = await (await fetch(base + '/api/auth/status')).json()
check(mode === 'terkunci' ? 'tidak ada akun terbentuk' : 'akun pemilik terbentuk', st2.needsSetup === (mode === 'terkunci'))
console.log(`\n${pass} lulus, ${fail} gagal`)
process.exit(fail ? 1 : 0)
