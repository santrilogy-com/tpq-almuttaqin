import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { naikJilid, labelJenjang } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { useKelas, useSantri } from '@/lib/queries'
import { type Santri } from '@/lib/types'
import { cocokProfil, useProfilAktif } from '@/stores/profil-store'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FotoAvatar } from '@/components/foto-avatar'
import { PageShell } from '@/components/page-shell'
import { FormSantri } from './form-santri'

export function SantriPage() {
  const qc = useQueryClient()
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const profil = useProfilAktif()
  const { data: santri, isLoading } = useSantri()
  const { data: kelas } = useKelas()
  const [q, setQ] = useState('')
  const [fKelas, setFKelas] = useState('semua')
  const [form, setForm] = useState<Santri | 'baru' | null>(null)
  const [naik, setNaik] = useState<Santri | null>(null)
  const [hapus, setHapus] = useState<Santri | null>(null)

  const namaKelas = useMemo(
    () => new Map((kelas ?? []).map((k) => [k.id, k.nama])),
    [kelas]
  )
  const refresh = () => qc.invalidateQueries({ queryKey: ['santri'] })
  const aksi = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => {
      toast.error(pesanGalat(e))
      refresh() // data bisa sudah berubah di perangkat lain
    },
  })

  const tampil = (santri ?? []).filter(
    (s) =>
      cocokProfil(profil, s.jenjang) &&
      (fKelas === 'semua' || s.kelasId === fKelas) &&
      `${s.nama} ${s.nis}`.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <PageShell
      title='Santri'
      description='Data santri TPQ dan Madrasah.'
      actions={
        <Button onClick={() => setForm('baru')}>
          <Plus /> Tambah santri
        </Button>
      }
    >
      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <Input
          className='w-56'
          placeholder='Cari nama atau NIS'
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={fKelas} onValueChange={setFKelas}>
          <SelectTrigger className='w-44'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='semua'>Semua kelas</SelectItem>
            {kelas?.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className='text-sm text-muted-foreground'>
          {tampil.length} santri
        </span>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NIS</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>L/P</TableHead>
              <TableHead>Jenjang</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Jilid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-end'>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className='h-16 text-center'>
                  Memuat...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && tampil.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className='h-16 text-center'>
                  Belum ada santri.
                </TableCell>
              </TableRow>
            )}
            {tampil.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.nis}</TableCell>
                <TableCell className='font-medium'>
                  <div className='flex items-center gap-2'>
                    <FotoAvatar jenis='santri' id={s.id} nama={s.nama} />
                    {s.nama}
                  </div>
                </TableCell>
                <TableCell>{s.jenisKelamin}</TableCell>
                <TableCell>{labelJenjang(s.jenjang)}</TableCell>
                <TableCell>{(s.kelasId && namaKelas.get(s.kelasId)) || '-'}</TableCell>
                <TableCell>{s.jilid}</TableCell>
                <TableCell>
                  <Badge variant={s.status === 'aktif' ? 'default' : 'secondary'}>
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell className='space-x-1 text-end'>
                  <Button
                    size='icon'
                    variant='ghost'
                    title='Naik jilid'
                    disabled={naikJilid(s.jilid) === s.jilid}
                    onClick={() => setNaik(s)}
                  >
                    <ArrowUpCircle />
                  </Button>
                  <Button
                    size='icon'
                    variant='ghost'
                    title='Ubah'
                    onClick={() => setForm(s)}
                  >
                    <Pencil />
                  </Button>
                  {pimpinan && (
                    <Button
                      size='icon'
                      variant='ghost'
                      title='Hapus'
                      onClick={() => setHapus(s)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {form && (
        <FormSantri
          awal={form === 'baru' ? null : form}
          onClose={() => setForm(null)}
          onDone={() => {
            setForm(null)
            refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={!!naik}
        onOpenChange={(o) => !o && setNaik(null)}
        title='Naik jilid'
        desc={
          naik
            ? `Naikkan ${naik.nama} dari ${naik.jilid} ke ${naikJilid(naik.jilid)}?`
            : ''
        }
        confirmText='Naikkan'
        handleConfirm={() => {
          const s = naik!
          setNaik(null)
          aksi.mutate(async () => {
            await api.post(`/santri/${s.id}/naik-jilid`, { dari: s.jilid })
            toast.success(`${s.nama} naik ke ${naikJilid(s.jilid)}`)
          })
        }}
      />
      <ConfirmDialog
        open={!!hapus}
        onOpenChange={(o) => !o && setHapus(null)}
        title='Hapus santri'
        desc={`Hapus ${hapus?.nama} beserta nilai, absensi, dan tabungannya secara permanen?`}
        confirmText='Hapus'
        destructive
        handleConfirm={() => {
          const id = hapus!.id
          setHapus(null)
          aksi.mutate(() => api.delete(`/santri/${id}`))
        }}
      />
    </PageShell>
  )
}


