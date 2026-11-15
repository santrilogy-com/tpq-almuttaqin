import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { data, isLoading } = useQuery({
    queryKey: ['auth-status'],
    queryFn: async () =>
      (await api.get<{ needsSetup: boolean }>('/auth/status')).data,
    staleTime: 0,
  })

  const needsSetup = data?.needsSetup ?? false

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {needsSetup ? 'Siapkan aplikasi' : 'Masuk'}
          </CardTitle>
          <CardDescription>
            {needsSetup
              ? 'Belum ada pengguna. Buat akun Pimpinan pertama. Tidak ada kata sandi bawaan.'
              : 'Masukkan ID pengguna dan kata sandi. Lupa kata sandi? Minta Pimpinan mereset.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex justify-center py-6'>
              <Loader2 className='animate-spin' />
            </div>
          ) : (
            <UserAuthForm
              key={needsSetup ? 'setup' : 'login'}
              mode={needsSetup ? 'setup' : 'login'}
              redirectTo={redirect}
            />
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
