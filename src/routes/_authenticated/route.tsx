import { createFileRoute, redirect } from '@tanstack/react-router'
import { ambilSesi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

// Penjaga rute: sesi diperiksa ke server pada tiap navigasi.
// (Pengaman sebenarnya tetap di API; ini hanya untuk pengalaman pengguna.)
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()
    const user = await ambilSesi()
    if (!user) {
      auth.reset()
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
    if (user.wajibGantiSandi) throw redirect({ to: '/ganti-sandi' })
    auth.setUser(user)
  },
  component: AuthenticatedLayout,
})
