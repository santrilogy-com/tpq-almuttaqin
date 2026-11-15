/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { type z } from 'zod'
import { requireAuth, requirePeran, type AppEnv } from '../middleware'
import { type Peran } from '../db/schema'
import { parseBody } from './validate'

/**
 * CRUD generik untuk tabel sederhana.
 * - GET dibuka untuk semua yang login; tulis (POST/PATCH/DELETE) hanya peran `tulis`.
 * - `schema` TIDAK boleh memakai .default(): PATCH memakai schema.partial(), dan default
 *   akan ikut menimpa field yang tidak dikirim (bug yang sudah pernah terjadi di v2).
 * - `cek` (opsional) validasi lintas-field; dijalankan di POST dan di PATCH bila datanya cukup.
 */
export function crud(opts: {
  table: any
  schema: z.ZodObject<any>
  tulis: Peran[]
  baca?: Peran[]
  cek?: (d: any) => string | null
  urut?: any
}) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth)
  if (opts.baca) r.use('/', async (c, next) => (c.req.method === 'GET' ? requirePeran(...opts.baca!)(c, next) : next()))
  const t = opts.table
  const tulis = requirePeran(...opts.tulis)

  r.get('/', async (c) => {
    const q = (c.get('db') as any).select().from(t)
    return c.json({ rows: await (opts.urut ? q.orderBy(opts.urut) : q) })
  })

  r.post('/', tulis, async (c) => {
    const p = await parseBody(c, opts.schema)
    if (!p.ok) return p.res
    const err = opts.cek?.(p.data)
    if (err) return c.json({ error: err }, 400)
    const [row] = (await (c.get('db') as any).insert(t).values(p.data).returning()) as any[]
    return c.json({ row }, 201)
  })

  r.patch('/:id', tulis, async (c) => {
    const p = await parseBody(c, opts.schema.partial())
    if (!p.ok) return p.res
    if (Object.keys(p.data).length === 0) return c.json({ error: 'Tidak ada yang diubah' }, 400)
    const err = opts.cek?.(p.data)
    if (err) return c.json({ error: err }, 400)
    const [row] = (await (c.get('db') as any).update(t).set(p.data).where(eq(t.id, c.req.param('id'))).returning()) as any[]
    if (!row) return c.json({ error: 'Data tidak ditemukan' }, 404)
    return c.json({ row })
  })

  r.delete('/:id', tulis, async (c) => {
    const res = (await (c.get('db') as any).delete(t).where(eq(t.id, c.req.param('id'))).returning({ id: t.id })) as any[]
    if (res.length === 0) return c.json({ error: 'Data tidak ditemukan' }, 404)
    return c.json({ ok: true })
  })
  return r
}

