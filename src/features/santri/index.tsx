import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { JENJANG, JILID_LIST, naikJilid, type Jenjang } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { useKelas, useSantri } from '@/lib/queries'
import { type Santri } from '@/lib/types'
import { cocokProfil, useProfil } from '@/stores/profil-store'
import { useAuthStore } from '@/stores/auth-store'
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
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'
import { ProfilFilter } from '@/components/profil-filter'

const KOSONG = {
  nis: '',
  nama: '',
  jenisKelamin: 'L' as 'L' | 'P',
  jenjang: 'TPQ' as Jenjang,
  kelasId: null as string | null,
  jilid: 'Iqra 1',
  angkatan: '',
  status: 'aktif' as Santri['status'],
  wali: '',
  hpWali: '',
  alamat: '',
}

export function SantriPage() {
  const qc = useQueryClient()
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const profil = useProfil((s) => s.profil)
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
      description='Data santri TPQ dan Ibtidaiyah.'
      actions={
        <Button onClick={() => setForm('baru')}>
          <Plus /> Tambah santri
        </Button>
      }
    >
      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <ProfilFilter />
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
                <TableCell className='font-medium'>{s.nama}</TableCell>
                <TableCell>{s.jenisKelamin}</TableCell>
                <TableCell>{s.jenjang === 'MI' ? 'Ibtidaiyah' : 'TPQ'}</TableCell>
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

function FormSantri(props: {
  awal: Santri | null
  onClose: () => void
  onDone: () => void
}) {
  const { data: kelas } = useKelas()
  const [v, setV] = useState({ ...KOSONG, ...props.awal })
  const m = useMutation({
    mutationFn: () => {
      const { id: _id, rombel: _r, ...data } = v as Santri & typeof KOSONG
      return props.awal
        ? api.patch(`/santri/${props.awal.id}`, data)
        : api.post('/santri', data)
    },
    onSuccess: () => {
      toast.success(props.awal ? 'Santri diperbarui' : 'Santri ditambahkan')
      props.onDone()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const teks = (k: keyof typeof KOSONG) => ({
    value: (v[k] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setV({ ...v, [k]: e.target.value }),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{props.awal ? 'Ubah santri' : 'Tambah santri'}</DialogTitle>
        </DialogHeader>
        <form
          className='grid gap-3 sm:grid-cols-2'
          onSubmit={(e) => {
            e.preventDefault()
            m.mutate()
          }}
        >
          <Field label='Nama lengkap *' htmlFor='s-nama'>
            <Input id='s-nama' required {...teks('nama')} />
          </Field>
          <Field label='NIS *' htmlFor='s-nis'>
            <Input id='s-nis' required {...teks('nis')} />
          </Field>
          <Field label='Jenis kelamin *'>
            <Select
              value={v.jenisKelamin}
              onValueChange={(x) => setV({ ...v, jenisKelamin: x as 'L' | 'P' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='L'>Laki-laki</SelectItem>
                <SelectItem value='P'>Perempuan</SelectItem>
              </SelectContent>
            </Select>
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
                    {j === 'MI' ? 'Ibtidaiyah' : 'TPQ'}
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
                <SelectItem value='none'>(belum ada kelas)</SelectItem>
                {kelas?.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='Jilid'>
            <Select value={v.jilid} onValueChange={(x) => setV({ ...v, jilid: x })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JILID_LIST.map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='Angkatan' htmlFor='s-ang'>
            <Input id='s-ang' {...teks('angkatan')} />
          </Field>
          <Field label='Status'>
            <Select
              value={v.status}
              onValueChange={(x) => setV({ ...v, status: x as Santri['status'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='aktif'>Aktif</SelectItem>
                <SelectItem value='keluar'>Keluar</SelectItem>
                <SelectItem value='lulus'>Lulus</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label='Nama wali' htmlFor='s-wali'>
            <Input id='s-wali' {...teks('wali')} />
          </Field>
          <Field label='HP wali' htmlFor='s-hp'>
            <Input id='s-hp' inputMode='tel' {...teks('hpWali')} />
          </Field>
          <div className='sm:col-span-2'>
            <Field label='Alamat' htmlFor='s-alamat'>
              <Input id='s-alamat' {...teks('alamat')} />
            </Field>
          </div>
          <DialogFooter className='sm:col-span-2'>
            <Button disabled={m.isPending}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
