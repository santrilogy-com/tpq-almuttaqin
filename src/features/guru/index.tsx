import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { JENJANG, type Jenjang, labelJenjang } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { simpanFoto } from '@/lib/foto'
import { rupiah, useGuru, useKelas } from '@/lib/queries'
import { type Guru } from '@/lib/types'
import { cocokProfil, useProfilAktif, jenjangAwal } from '@/stores/profil-store'
import { Badge } from '@/components/ui/badge'
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
import { FotoAvatar } from '@/components/foto-avatar'
import { FotoField } from '@/components/foto-field'
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'

const PERAN_GURU = ['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru'] as const

export function GuruPage() {
  const qc = useQueryClient()
  const profil = useProfilAktif()
  const { data: guru, isLoading } = useGuru()
  const { data: kelas } = useKelas()
  const [form, setForm] = useState<Guru | 'baru' | null>(null)
  const [hapus, setHapus] = useState<Guru | null>(null)

  const namaKelas = useMemo(
    () => new Map((kelas ?? []).map((k) => [k.id, k.nama])),
    [kelas]
  )
  const refresh = () => qc.invalidateQueries({ queryKey: ['guru'] })
  const aksi = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const tampil = (guru ?? []).filter((g) => cocokProfil(profil, g.jenjang))

  return (
    <PageShell
      title='Guru'
      description='Daftar guru dan status honor. Hak akses login diatur di Kelola pengguna.'
      actions={
        <Button onClick={() => setForm('baru')}>
          <Plus /> Tambah guru
        </Button>
      }
    >
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Jenjang</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>HP</TableHead>
              <TableHead>Honor</TableHead>
              <TableHead className='text-end'>Aksi</TableHead>
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
                  Belum ada guru.
                </TableCell>
              </TableRow>
            )}
            {tampil.map((g) => (
              <TableRow key={g.id}>
                <TableCell className='font-medium'>
                  <div className='flex items-center gap-2'>
                    <FotoAvatar jenis='guru' id={g.id} nama={g.nama} />
                    {g.nama}
                  </div>
                </TableCell>
                <TableCell>{g.peranGuru}</TableCell>
                <TableCell>{labelJenjang(g.jenjang)}</TableCell>
                <TableCell>{(g.kelasId && namaKelas.get(g.kelasId)) || '-'}</TableCell>
                <TableCell>{g.hp || '-'}</TableCell>
                <TableCell className='space-x-2'>
                  {rupiah(g.honor)}
                  <Badge
                    className='cursor-pointer'
                    variant={g.honorLunas ? 'default' : 'secondary'}
                    title='Ketuk untuk mengubah status'
                    onClick={() =>
                      aksi.mutate(() =>
                        api.patch(`/guru/${g.id}`, { honorLunas: !g.honorLunas })
                      )
                    }
                  >
                    {g.honorLunas ? 'Lunas' : 'Belum'}
                  </Badge>
                </TableCell>
                <TableCell className='space-x-1 text-end'>
                  <Button size='icon' variant='ghost' onClick={() => setForm(g)}>
                    <Pencil />
                  </Button>
                  <Button size='icon' variant='ghost' onClick={() => setHapus(g)}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {form && (
        <FormGuru
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
        title='Hapus guru'
        desc={`Hapus ${hapus?.nama} dari daftar guru? Akun login tidak ikut terhapus.`}
        confirmText='Hapus'
        destructive
        handleConfirm={() => {
          const id = hapus!.id
          setHapus(null)
          aksi.mutate(() => api.delete(`/guru/${id}`))
        }}
      />
    </PageShell>
  )
}

function FormGuru(props: {
  awal: Guru | null
  onClose: () => void
  onDone: () => void
}) {
  const { data: kelas } = useKelas()
  const profilAktif = useProfilAktif()
  const [v, setV] = useState({
    nama: props.awal?.nama ?? '',
    peranGuru: props.awal?.peranGuru ?? ('Guru' as Guru['peranGuru']),
    jenjang: (props.awal?.jenjang ?? jenjangAwal(profilAktif)) as Jenjang,
    kelasId: props.awal?.kelasId ?? (null as string | null),
    hp: props.awal?.hp ?? '',
    honor: String(props.awal?.honor ?? 0),
  })
  const qc = useQueryClient()
  // undefined = foto tidak diubah; null = hapus; string = foto baru (diunggah setelah data tersimpan)
  const [fotoBaru, setFotoBaru] = useState<string | null | undefined>(undefined)
  const m = useMutation({
    mutationFn: async () => {
      const data = { ...v, honor: Number(v.honor) }
      const res = props.awal
        ? await api.patch<{ guru: Guru }>(`/guru/${props.awal.id}`, data)
        : await api.post<{ guru: Guru }>('/guru', data)
      try {
        await simpanFoto('guru', res.data.guru.id, fotoBaru)
      } catch (e) {
        toast.error(`Data tersimpan, tetapi foto gagal: ${pesanGalat(e)}`)
      }
      qc.invalidateQueries({ queryKey: ['foto-index'] })
      return res
    },
    onSuccess: () => {
      toast.success('Guru disimpan')
      props.onDone()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{props.awal ? 'Ubah guru' : 'Tambah guru'}</DialogTitle>
        </DialogHeader>
        <form
          className='grid gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            m.mutate()
          }}
        >
          <FotoField jenis='guru' id={props.awal?.id} nama={v.nama} nilai={fotoBaru} onChange={setFotoBaru} />
          <Field label='Nama *' htmlFor='g-nama'>
            <Input
              id='g-nama'
              required
              value={v.nama}
              onChange={(e) => setV({ ...v, nama: e.target.value })}
            />
          </Field>
          <Field label='Peran'>
            <Select
              value={v.peranGuru}
              onValueChange={(x) => setV({ ...v, peranGuru: x as Guru['peranGuru'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERAN_GURU.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='Jenjang mengajar'>
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
          <Field label='Kelas'>
            <Select
              value={v.kelasId ?? 'none'}
              onValueChange={(x) => setV({ ...v, kelasId: x === 'none' ? null : x })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>(tidak ada)</SelectItem>
                {kelas?.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='HP' htmlFor='g-hp'>
            <Input
              id='g-hp'
              inputMode='tel'
              value={v.hp}
              onChange={(e) => setV({ ...v, hp: e.target.value })}
            />
          </Field>
          <Field label='Honor (rupiah, tanpa titik)' htmlFor='g-honor'>
            <Input
              id='g-honor'
              inputMode='numeric'
              pattern='[0-9]*'
              value={v.honor}
              onChange={(e) => setV({ ...v, honor: e.target.value })}
            />
          </Field>
          <DialogFooter>
            <Button disabled={m.isPending}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}




