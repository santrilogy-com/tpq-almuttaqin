import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { DataPage } from '@/features/data'

export const Route = createFileRoute('/_authenticated/data/')({
  // Tampilan saja; API menolak non-Pimpinan dengan 403.
  beforeLoad: () => {
    if (useAuthStore.getState().auth.user?.peran !== 'pimpinan') {
      throw redirect({ to: '/403' })
    }
  },
  component: DataPage,
})
