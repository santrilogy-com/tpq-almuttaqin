import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Jenjang } from '@shared/domain'
import { useAuthStore } from '@/stores/auth-store'

// Lembaga aktif = FILTER TAMPILAN (bukan peran dan bukan keamanan; akses tetap dijaga API).
// 'semua' = gabungan TPQ + Madrasah. Disimpan per perangkat.
export type Profil = Jenjang | 'semua'

export const useProfil = create<{
  profil: Profil
  setProfil: (p: Profil) => void
}>()(
  persist(
    (set) => ({ profil: 'semua', setProfil: (profil) => set({ profil }) }),
    { name: 'tpq-profil' }
  )
)

/**
 * Lembaga yang berlaku saat ini. Guru tidak punya pilihan "Semua" (sama seperti v22),
 * jadi bila tersimpan 'semua' di perangkat guru, dianggap TPQ.
 */
export function useProfilAktif(): Profil {
  const profil = useProfil((s) => s.profil)
  const peran = useAuthStore((s) => s.auth.user?.peran)
  return peran === 'guru' && profil === 'semua' ? 'TPQ' : profil
}

export const cocokProfil = (profil: Profil, jenjang: Jenjang) =>
  profil === 'semua' || profil === jenjang

/** Jenjang awal untuk formulir "tambah": lembaga aktif, atau TPQ bila "semua". */
export const jenjangAwal = (profil: Profil): Jenjang => (profil === 'semua' ? 'TPQ' : profil)
