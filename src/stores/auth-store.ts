import { create } from 'zustand'
import { type SessionUser } from '@/lib/api'

// Hanya menyimpan data pengguna untuk tampilan. Keabsahan sesi selalu
// diputuskan server lewat cookie HttpOnly, bukan oleh state ini.
interface AuthState {
  auth: {
    user: SessionUser | null
    setUser: (user: SessionUser | null) => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    setUser: (user) =>
      set((state) => ({ ...state, auth: { ...state.auth, user } })),
    reset: () =>
      set((state) => ({ ...state, auth: { ...state.auth, user: null } })),
  },
}))
