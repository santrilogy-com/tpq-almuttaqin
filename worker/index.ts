import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { loadSession, sameOrigin, type AppEnv } from './middleware'
import { authRoutes } from './routes/auth'
import { guruRoutes } from './routes/guru'
import { kelasRoutes } from './routes/kelas'
import { santriRoutes } from './routes/santri'
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
api.notFound((c) => c.json({ error: 'Endpoint tidak ditemukan' }, 404))
api.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Terjadi kesalahan di server' }, 500)
})

app.route('/api', api)

export default app


