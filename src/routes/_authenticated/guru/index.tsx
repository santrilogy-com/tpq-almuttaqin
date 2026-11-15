import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { GuruPage } from '@/features/guru'

export const Route = createFileRoute('/_authenticated/guru/')({
  // Tampilan saja; API menolak non-Pimpinan dengan 403.
  beforeLoad: () => {
    if (useAuthStore.getState().auth.user?.peran !== 'pimpinan') {
      throw redirect({ to: '/403' })
    }
  },
  component: GuruPage,
})
