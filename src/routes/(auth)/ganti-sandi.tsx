import { createFileRoute, redirect } from '@tanstack/react-router'
import { ambilSesi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { GantiSandi } from '@/features/auth/ganti-sandi'

export const Route = createFileRoute('/(auth)/ganti-sandi')({
  beforeLoad: async () => {
    const user = await ambilSesi()
    if (!user) throw redirect({ to: '/sign-in' })
    useAuthStore.getState().auth.setUser(user)
  },
  component: GantiSandi,
})
