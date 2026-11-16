import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { loadSession, sameOrigin, type AppEnv } from './middleware'
import { authRoutes } from './routes/auth'
import { absensiRoutes } from './routes/absensi'
import { anggaranRoutes } from './routes/anggaran'
import { backupRoutes } from './routes/backup'
import { guruRoutes } from './routes/guru'
import { importRoutes } from './routes/import'
import { kbmRoutes } from './routes/kbm'
import { keuanganRoutes } from './routes/keuangan'
import { kelasRoutes } from './routes/kelas'
import { laporanRoutes } from './routes/laporan'
import { lembagaRoutes } from './routes/lembaga'
import { nilaiRoutes, raporRoutes } from './routes/nilai'
import { pengumumanRoutes } from './routes/pengumuman'
import { santriRoutes } from './routes/santri'
import { setoranRoutes } from './routes/setoran'
import { tabunganRoutes } from './routes/tabungan'
import { userRoutes } from './routes/users'

const app = new Hono<AppEnv>()

app.use('*', secureHeaders())

const api = new Hono<AppEnv>()
api.use('*', async (c, next) => {
  // Respons API tidak boleh di-cache oleh browser/CDN.
  await next()
  c.header('Cache-Control', 'no-store')
})
api.use('*', sameOrigin)
api.use('*', loadSession)
api.route('/auth', authRoutes)
api.route('/users', userRoutes)
api.route('/kelas', kelasRoutes)
api.route('/santri', santriRoutes)
api.route('/guru', guruRoutes)
api.route('/absensi', absensiRoutes)
api.route('/nilai', nilaiRoutes)
api.route('/rapor', raporRoutes)
api.route('/lembaga', lembagaRoutes)
api.route('/keuangan', keuanganRoutes)
api.route('/tabungan', tabunganRoutes)
api.route('/setoran', setoranRoutes)
api.route('/pengumuman', pengumumanRoutes)
api.route('/kbm', kbmRoutes)
api.route('/anggaran', anggaranRoutes)
api.route('/laporan', laporanRoutes)
api.route('/backup', backupRoutes)
api.route('/import', importRoutes)
api.notFound((c) => c.json({ error: 'Endpoint tidak ditemukan' }, 404))
api.onError((err, c) => {
  // eslint-disable-next-line no-console -- log galat server untuk observability Cloudflare
  console.error(err)
  return c.json({ error: 'Terjadi kesalahan di server' }, 500)
})

app.route('/api', api)

export default app








