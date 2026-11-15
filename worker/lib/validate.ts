import { type Context } from 'hono'
import { type ZodType, type z } from 'zod'

/** Parse body JSON dengan zod; kembalikan data atau respons 400 berpesan jelas. */
export async function parseBody<T extends ZodType>(
  c: Context,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: Response }> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const i = parsed.error.issues[0]
    const field = i.path.length ? `${i.path.join('.')}: ` : ''
    return { ok: false, res: c.json({ error: field + i.message }, 400) }
  }
  return { ok: true, data: parsed.data }
}
