import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, pesanGalat } from '@/lib/api'
import { usePengumuman, type Pengumuman } from '@/lib/queries'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'

const tgl = (ms: number) => new Date(ms).toLocaleDateString('id-ID', { dateStyle: 'long' })

export function PengumumanPage() {
  const qc = useQueryClient()
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const { data, isLoading } = usePengumuman()
  const [judul, setJudul] = useState('')
  const [isi, setIsi] = useState('')
  const [hapus, setHapus] = useState<Pengumuman | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['pengumuman'] })

  const buat = useMutation({
    mutationFn: () => api.post('/pengumuman', { judul: judul.trim(), isi: isi.trim() }),
    onSuccess: () => {
      toast.success('Pengumuman ditampilkan')
      setJudul('')
      setIsi('')
      refresh()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const ubah = useMutation({
    mutationFn: (v: { id: string; tampil: boolean }) => api.patch(`/pengumuman/${v.id}`, { tampil: v.tampil }),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/pengumuman/${id}`),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })

  return (
    <PageShell title='Pengumuman' description='Pengumuman yang ditampilkan muncul di Beranda semua pengguna.'>
      {pimpinan && (
        <form
          className='mb-6 grid max-w-xl gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            buat.mutate()
          }}
        >
          <Field label='Judul' htmlFor='p-judul'>
            <Input id='p-judul' value={judul} onChange={(e) => setJudul(e.target.value)} />
          </Field>
          <Field label='Isi' htmlFor='p-isi'>
            <Textarea id='p-isi' rows={3} value={isi} onChange={(e) => setIsi(e.target.value)} />
          </Field>
          <Button className='w-fit' disabled={!judul.trim() || !isi.trim() || buat.isPending}>
            Tampilkan pengumuman
          </Button>
        </form>
      )}

      <div className='grid gap-3 md:grid-cols-2'>
        {isLoading && <p>Memuat...</p>}
        {data?.length === 0 && <p className='text-muted-foreground'>Belum ada pengumuman.</p>}
        {data?.map((p) => (
          <Card key={p.id}>
            <CardHeader className='pb-2'>
              <CardTitle className='flex items-center justify-between gap-2 text-base'>
                <span>{p.judul}</span>
                {!p.tampil && <Badge variant='secondary'>Ditutup</Badge>}
              </CardTitle>
              <p className='text-xs text-muted-foreground'>{tgl(p.createdAt)}</p>
            </CardHeader>
            <CardContent className='space-y-2'>
              {/* teks biasa: React meng-escape, tidak ada HTML dari pengguna */}
              <p className='text-sm whitespace-pre-wrap'>{p.isi}</p>
              {pimpinan && (
                <div className='flex gap-2'>
                  <Button size='sm' variant='outline' onClick={() => ubah.mutate({ id: p.id, tampil: !p.tampil })}>
                    {p.tampil ? <EyeOff /> : <Eye />}
                    {p.tampil ? 'Tutup' : 'Tampilkan lagi'}
                  </Button>
                  <Button size='sm' variant='ghost' onClick={() => setHapus(p)}>
                    <Trash2 /> Hapus
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={!!hapus}
        onOpenChange={(o) => !o && setHapus(null)}
        title='Hapus pengumuman'
        desc={`Hapus "${hapus?.judul}" secara permanen?`}
        confirmText='Hapus'
        destructive
        handleConfirm={() => {
          const id = hapus!.id
          setHapus(null)
          del.mutate(id)
        }}
      />
    </PageShell>
  )
}

