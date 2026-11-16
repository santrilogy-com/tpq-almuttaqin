import { getTableColumns, getTableName } from 'drizzle-orm'
import { type SQLiteTable } from 'drizzle-orm/sqlite-core'

const MAKS_BARIS = 150
const MAKS_BYTE = 400_000 // parameter D1 maks ~2 MB; sisakan ruang

const q = (nama: string) => `"${nama.replace(/"/g, '""')}"`

/**
 * INSERT massal lewat SATU parameter JSON:
 *   INSERT INTO t (cols) SELECT json_extract(value,'$.k')... FROM json_each(?)
 * Dibanding INSERT multi-baris biasa (maks 100 parameter/statement ~ 7 baris santri), ini memakai
 * jauh lebih sedikit statement, sehingga tahan batas query per invocation di Cloudflare.
 * Kolom ditentukan dari kunci baris pertama; kolom yang tidak ada memakai default database.
 * Nama tabel/kolom berasal dari definisi skema (bukan input pengguna); nilai selalu lewat bind.
 * Mengembalikan statement D1 mentah untuk dijalankan lewat `DB.batch()` (atomik).
 */
export function insertJson(d1: D1Database, table: SQLiteTable, rows: Record<string, unknown>[]): D1PreparedStatement[] {
  if (rows.length === 0) return []
  const kolom = getTableColumns(table) as Record<string, { name: string }>
  const kunci = Object.keys(rows[0]).filter((k) => k in kolom)
  const teksSql = `INSERT INTO ${q(getTableName(table))} (${kunci.map((k) => q(kolom[k].name)).join(', ')}) SELECT ${kunci
    .map((k) => `json_extract(value, '$.${k}')`)
    .join(', ')} FROM json_each(?)`

  const stmts: D1PreparedStatement[] = []
  let potong: Record<string, unknown>[] = []
  let byte = 0
  const tutup = () => {
    if (potong.length === 0) return
    const json = JSON.stringify(potong.map((r) => Object.fromEntries(kunci.map((k) => [k, r[k] ?? null]))))
    stmts.push(d1.prepare(teksSql).bind(json))
    potong = []
    byte = 0
  }
  for (const r of rows) {
    const b = JSON.stringify(r).length
    if (potong.length >= MAKS_BARIS || (potong.length > 0 && byte + b > MAKS_BYTE)) tutup()
    potong.push(r)
    byte += b
  }
  tutup()
  return stmts
}

/** DELETE seluruh baris sebuah tabel, sebagai statement D1 mentah untuk DB.batch(). */
export const hapusSemua = (d1: D1Database, table: SQLiteTable): D1PreparedStatement =>
  d1.prepare(`DELETE FROM ${q(getTableName(table))}`)

