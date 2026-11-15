import { useNavigate, useLocation } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api, pesanGalat } from '@/lib/api'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { auth } = useAuthStore()

  const handleSignOut = async () => {
    try {
      await api.post('/auth/logout')
    } catch (err) {
      toast.error(pesanGalat(err, 'Gagal keluar'))
      return
    }
    auth.reset()
    navigate({
      to: '/sign-in',
      search: { redirect: location.href },
      replace: true,
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Keluar'
      desc='Yakin ingin keluar? Anda perlu masuk lagi untuk memakai aplikasi.'
      confirmText='Keluar'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
