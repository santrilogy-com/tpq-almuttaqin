import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Jenjang } from '@shared/domain'

// Profil hanya FILTER TAMPILAN (bukan peran). 'semua' = gabungan kedua jenjang.
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

export const cocokProfil = (profil: Profil, jenjang: Jenjang) =>
  profil === 'semua' || profil === jenjang
