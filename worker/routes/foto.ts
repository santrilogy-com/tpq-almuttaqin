import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { MAKS_FOTO, gambarValid } from '../../shared/backup'
import { foto, guru, santri } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireAuth, type AppEnv } from '../middleware'

export const fotoRoutes = new Hono<AppEnv>()
fotoRoutes.use('*', requireAuth)

const jenisSkema = z.enum(['santri', 'guru'])

// Foto santri boleh diubah guru maupun Pimpinan (sama seperti data santri); foto guru hanya Pimpinan.
const boleh = (jenis: 'santri' | 'guru', peran: string) => jenis === 'santri' || peran === 'pimpinan'

// Indeks ringan: siapa yang punya foto + versinya (untuk cache-busting). Tanpa data gambar.
fotoRoutes.get('/', async (c) => {
  const rows = await c
    .get('db')
    .select({ jenis: foto.jenis, ownerId: foto.ownerId, v: foto.updatedAt })
    .from(foto)
  return c.json({ foto: rows })
})

// Menyajikan gambar. URL memuat ?v=<updatedAt>, jadi aman di-cache pribadi (bukan publik: wajib login).
fotoRoutes.get('/:jenis/:id', async (c) => {
  const j = jenisSkema.safeParse(c.req.param('jenis'))
  if (!j.success) return c.json({ error: 'Jenis tidak dikenal' }, 404)
  const row = await c
    .get('db')
    .select({ data: foto.data })
    .from(foto)
    .where(and(eq(foto.jenis, j.data), eq(foto.ownerId, c.req.param('id'))))
    .get()
  if (!row) return c.json({ error: 'Foto tidak ada' }, 404)
  const koma = row.data.indexOf(',')
  const mime = row.data.slice(5, row.data.indexOf(';'))
  const biner = Uint8Array.from(atob(row.data.slice(koma + 1)), (ch) => ch.charCodeAt(0))
  return new Response(biner, {
    headers: {
      'content-type': mime,
      'cache-control': 'private, max-age=86400',
      'x-content-type-options': 'nosniff',
      // Gambar tidak boleh dijalankan sebagai dokumen bila URL-nya dibuka langsung.
      'content-security-policy': "default-src 'none'; img-src 'self' data:; sandbox",
    },
  })
})

fotoRoutes.put('/:jenis/:id', async (c) => {
  const j = jenisSkema.safeParse(c.req.param('jenis'))
  if (!j.success) return c.json({ error: 'Jenis tidak dikenal' }, 404)
  if (!boleh(j.data, c.get('user')!.peran)) return c.json({ error: 'Tidak ada akses' }, 403)
  const p = await parseBody(
    c,
    z.object({ data: z.string().refine((v) => gambarValid(v, MAKS_FOTO), `Foto harus gambar PNG/JPEG/WebP yang valid (maks ${MAKS_FOTO / 1000} KB)`) })
  )
  if (!p.ok) return p.res
  const db = c.get('db')
  const id = c.req.param('id')
  const ada = await (j.data === 'santri'
    ? db.select({ id: santri.id }).from(santri).where(eq(santri.id, id)).get()
    : db.select({ id: guru.id }).from(guru).where(eq(guru.id, id)).get())
  if (!ada) return c.json({ error: 'Data tidak ditemukan' }, 404)
  const v = Date.now()
  await db
    .insert(foto)
    .values({ jenis: j.data, ownerId: id, data: p.data.data, updatedAt: v })
    .onConflictDoUpdate({ target: [foto.jenis, foto.ownerId], set: { data: p.data.data, updatedAt: v } })
  return c.json({ ok: true, v })
})

fotoRoutes.delete('/:jenis/:id', async (c) => {
  const j = jenisSkema.safeParse(c.req.param('jenis'))
  if (!j.success) return c.json({ error: 'Jenis tidak dikenal' }, 404)
  if (!boleh(j.data, c.get('user')!.peran)) return c.json({ error: 'Tidak ada akses' }, 403)
  await c
    .get('db')
    .delete(foto)
    .where(and(eq(foto.jenis, j.data), eq(foto.ownerId, c.req.param('id'))))
  return c.json({ ok: true })
})
