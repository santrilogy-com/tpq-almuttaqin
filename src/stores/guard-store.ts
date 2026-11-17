import { create } from 'zustand'

/**
 * Penanda "ada perubahan belum disimpan" lintas komponen (mis. absensi yang sedang diisi).
 * Dipakai saklar lembaga agar tidak membuang isian secara diam-diam.
 */
export const useGuard = create<{ kotor: boolean; setKotor: (v: boolean) => void }>()((set) => ({
  kotor: false,
  setKotor: (kotor) => set({ kotor }),
}))
