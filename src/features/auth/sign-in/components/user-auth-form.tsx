import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api, pesanGalat, type SessionUser } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Isi ID pengguna'),
  sandi: z.string().min(1, 'Isi kata sandi'),
})

const setupSchema = z.object({
  nama: z.string().trim().min(1, 'Isi nama Anda'),
  namaTpq: z.string().trim().min(1, 'Isi nama TPQ'),
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{3,32}$/, 'ID 3-32 karakter: huruf, angka, titik, - atau _'),
  sandi: z.string().min(8, 'Kata sandi minimal 8 karakter'),
})

interface Props extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
  mode: 'login' | 'setup'
}

export function UserAuthForm({ className, redirectTo, mode, ...props }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const isSetup = mode === 'setup'

  const form = useForm<z.infer<typeof setupSchema>>({
    resolver: zodResolver(isSetup ? setupSchema : (loginSchema as never)),
    defaultValues: { nama: '', namaTpq: 'TPQ Al-Muttaqin', username: '', sandi: '' },
  })

  async function onSubmit(data: z.infer<typeof setupSchema>) {
    setIsLoading(true)
    try {
      const res = await api.post<{ user: SessionUser }>(
        isSetup ? '/auth/setup' : '/auth/login',
        isSetup ? data : { username: data.username, sandi: data.sandi }
      )
      auth.setUser(res.data.user)
      toast.success(`Selamat datang, ${res.data.user.nama}`)
      if (res.data.user.wajibGantiSandi) {
        navigate({ to: '/ganti-sandi', replace: true })
      } else {
        navigate({ to: redirectTo || '/', replace: true })
      }
    } catch (err) {
      toast.error(pesanGalat(err, 'Gagal masuk'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        {isSetup && (
          <>
            <FormField
              control={form.control}
              name='nama'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Anda</FormLabel>
                  <FormControl>
                    <Input placeholder='Ustadz Ahmad' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='namaTpq'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama TPQ</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID pengguna</FormLabel>
              <FormControl>
                <Input
                  autoComplete='username'
                  autoCapitalize='none'
                  placeholder='admin'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='sandi'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kata sandi</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  placeholder='********'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          {isSetup ? 'Buat akun Pimpinan' : 'Masuk'}
        </Button>
      </form>
    </Form>
  )
}
