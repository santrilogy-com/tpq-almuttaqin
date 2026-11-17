import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { JENJANG, type Jenjang, labelJenjang } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { useKelas, useSantri } from '@/lib/queries'
import { type Kelas } from '@/lib/types'
import { cocokProfil, useProfilAktif, jenjangAwal } from '@/stores/profil-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'

export function KelasPage() {
  const qc = useQueryClient()
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const profil = useProfilAktif()
  const { data: kelas, isLoading } = useKelas()
  const { data: santri } = useSantri()
  const [form, setForm] = useState<Kelas | 'baru' | null>(null)
  const [hapus, setHapus] = useState<Kelas | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['kelas'] })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/kelas/${id}`),
    onSuccess: () => {
      refresh()
      qc.invalidateQueries({ queryKey: ['santri'] })
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const jumlah = (id: string) =>
    (santri ?? []).filter((s) => s.kelasId === id && s.status === 'aktif').length
  const tampil = (kelas ?? []).filter((k) => cocokProfil(profil, k.jenjang))

  return (
    <PageShell
      title='Kelas'
      description='Rombongan belajar TPQ dan Madrasah.'
      actions={
        pimpinan && (
          <Button onClick={() => setForm('baru')}>
            <Plus /> Tambah kelas
          </Button>
        )
      }
    >
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kelas</TableHead>
              <TableHead>Jenjang</TableHead>
              <TableHead>Pengajar</TableHead>
              <TableHead>Jadwal</TableHead>
              <TableHead>Ruang</TableHead>
              <TableHead>Santri aktif</TableHead>
              {pimpinan && <TableHead className='text-end'>Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className='h-16 text-center'>
                  Memuat...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && tampil.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className='h-16 text-center'>
                  Belum ada kelas.
                </TableCell>
              </TableRow>
            )}
            {tampil.map((k) => (
              <TableRow key={k.id}>
                <TableCell className='font-medium'>{k.nama}</TableCell>
                <TableCell>{labelJenjang(k.jenjang)}</TableCell>
                <TableCell>{k.pengajar || '-'}</TableCell>
                <TableCell>{k.jadwal || '-'}</TableCell>
                <TableCell>{k.ruang || '-'}</TableCell>
                <TableCell>{jumlah(k.id)}</TableCell>
                {pimpinan && (
                  <TableCell className='space-x-1 text-end'>
                    <Button size='icon' variant='ghost' onClick={() => setForm(k)}>
                      <Pencil />
                    </Button>
                    <Button size='icon' variant='ghost' onClick={() => setHapus(k)}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {form && (
        <FormKelas
          awal={form === 'baru' ? null : form}
          onClose={() => setForm(null)}
          onDone={() => {
            setForm(null)
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={!!hapus}
        onOpenChange={(o) => !o && setHapus(null)}
        title='Hapus kelas'
        desc={`Hapus kelas ${hapus?.nama}? Santri di kelas ini tidak ikut terhapus, hanya kelasnya yang dikosongkan.`}
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

function FormKelas(props: {
  awal: Kelas | null
  onClose: () => void
  onDone: () => void
}) {
  const profilAktif = useProfilAktif()
  const [v, setV] = useState({
    nama: props.awal?.nama ?? '',
    jenjang: (props.awal?.jenjang ?? jenjangAwal(profilAktif)) as Jenjang,
    pengajar: props.awal?.pengajar ?? '',
    jadwal: props.awal?.jadwal ?? '',
    ruang: props.awal?.ruang ?? '',
  })
  const m = useMutation({
    mutationFn: () =>
      props.awal ? api.patch(`/kelas/${props.awal.id}`, v) : api.post('/kelas', v),
    onSuccess: () => {
      toast.success('Kelas disimpan')
      props.onDone()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const teks = (k: 'nama' | 'pengajar' | 'jadwal' | 'ruang') => ({
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setV({ ...v, [k]: e.target.value }),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.awal ? 'Ubah kelas' : 'Tambah kelas'}</DialogTitle>
        </DialogHeader>
        <form
          className='grid gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            m.mutate()
          }}
        >
          <Field label='Nama kelas *' htmlFor='k-nama'>
            <Input id='k-nama' required {...teks('nama')} />
          </Field>
          <Field label='Jenjang *'>
            <Select
              value={v.jenjang}
              onValueChange={(x) => setV({ ...v, jenjang: x as Jenjang })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JENJANG.map((j) => (
                  <SelectItem key={j} value={j}>
                    {labelJenjang(j)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='Pengajar' htmlFor='k-p'>
            <Input id='k-p' {...teks('pengajar')} />
          </Field>
          <Field label='Jadwal' htmlFor='k-j'>
            <Input id='k-j' placeholder='Senin-Kamis 15.30' {...teks('jadwal')} />
          </Field>
          <Field label='Ruang' htmlFor='k-r'>
            <Input id='k-r' {...teks('ruang')} />
          </Field>
          <DialogFooter>
            <Button disabled={m.isPending}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}




