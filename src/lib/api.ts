import axios, { AxiosError } from 'axios'

export type Peran = 'pimpinan' | 'guru'

export type SessionUser = {
  id: string
  username: string
  nama: string
  peran: Peran
  wajibGantiSandi: boolean
}

// Cookie sesi HttpOnly dikirim otomatis (same-origin); tidak ada token di JS.
export const api = axios.create({ baseURL: '/api' })

/** Ambil pesan galat dari respons API (`{ error }`), dengan cadangan umum. */
export function pesanGalat(err: unknown, fallback = 'Terjadi kesalahan') {
  if (err instanceof AxiosError) {
    const m = err.response?.data?.error
    if (typeof m === 'string' && m) return m
    if (!err.response) return 'Tidak bisa terhubung ke server'
  }
  return fallback
}

/** Sesi saat ini, atau null bila belum masuk. */
export async function ambilSesi(): Promise<SessionUser | null> {
  try {
    const { data } = await api.get<{ user: SessionUser }>('/auth/me')
    return data.user
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 401) return null
    throw err
  }
}
