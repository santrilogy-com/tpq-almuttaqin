import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api, pesanGalat } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PasswordInput } from '@/components/password-input'
import { AuthLayout } from '../auth-layout'

const schema = z
  .object({
    sandiLama: z.string().min(1, 'Isi kata sandi lama'),
    sandiBaru: z.string().min(8, 'Kata sandi baru minimal 8 karakter'),
    ulangi: z.string(),
  })
  .refine((v) => v.sandiBaru === v.ulangi, {
    message: 'Kata sandi tidak sama',
    path: ['ulangi'],
  })

export function GantiSandi() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const wajib = auth.user?.wajibGantiSandi ?? false

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { sandiLama: '', sandiBaru: '', ulangi: '' },
  })

  async function onSubmit(v: z.infer<typeof schema>) {
    setLoading(true)
    try {
      await api.post('/auth/ganti-sandi', {
        sandiLama: v.sandiLama,
        sandiBaru: v.sandiBaru,
      })
      if (auth.user) auth.setUser({ ...auth.user, wajibGantiSandi: false })
      toast.success('Kata sandi diganti')
      navigate({ to: '/', replace: true })
    } catch (err) {
      toast.error(pesanGalat(err, 'Gagal mengganti kata sandi'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Ganti kata sandi
          </CardTitle>
          <CardDescription>
            {wajib
              ? 'Demi keamanan, ganti kata sandi sementara Anda sebelum melanjutkan.'
              : 'Masukkan kata sandi lama dan kata sandi baru.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='grid gap-3'>
              {(['sandiLama', 'sandiBaru', 'ulangi'] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {name === 'sandiLama'
                          ? 'Kata sandi lama'
                          : name === 'sandiBaru'
                            ? 'Kata sandi baru'
                            : 'Ulangi kata sandi baru'}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete={
                            name === 'sandiLama'
                              ? 'current-password'
                              : 'new-password'
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button className='mt-2' disabled={loading}>
                {loading && <Loader2 className='animate-spin' />}
                Simpan kata sandi
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
