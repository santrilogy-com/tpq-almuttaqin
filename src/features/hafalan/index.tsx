import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, pesanGalat } from '@/lib/api'
import { hariIni, useSantri } from '@/lib/queries'
import { cocokProfil, useProfil } from '@/stores/profil-store'
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
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'
import { ProfilFilter } from '@/components/profil-filter'

type Setoran = {
  id: string
  santriId: string
  jenis: 'Iqra' | 'Hafalan'
  materi: string
  nilai: 'Lancar' | 'Cukup' | 'Perlu Bimbingan'
  tanggal: string
}
const NILAI = ['Lancar', 'Cukup', 'Perlu Bimbingan'] as const

export function HafalanPage() {
  const qc = useQueryClient()
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const profil = useProfil((s) => s.profil)
  const { data: semua } = useSantri()
  const murid = useMemo(
    () =>
      (semua ?? [])
        .filter((s) => s.status === 'aktif' && cocokProfil(profil, s.jenjang))
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    [semua, profil]
  )
  const [santriId, setSantriId] = useState('')
  const [jenis, setJenis] = useState<'Iqra' | 'Hafalan'>('Iqra')
  const [materi, setMateri] = useState('')
  const [nilai, setNilai] = useState<(typeof NILAI)[number]>('Lancar')
  const [tanggal, setTanggal] = useState(hariIni())

  const riwayat = useQuery({
    queryKey: ['setoran', santriId],
    enabled: !!santriId,
    queryFn: async () =>
      (await api.get<{ setoran: Setoran[] }>('/setoran', { params: { santriId } })).data.setoran,
  })
  const progres = useQuery({
    queryKey: ['setoran-progres'],
    queryFn: async () =>
      (await api.get<{ progres: { santriId: string; jumlah: number; terakhir: string }[] }>('/setoran/progres'))
        .data.progres,
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['setoran'] })
    qc.invalidateQueries({ queryKey: ['setoran-progres'] })
  }
  const simpan = useMutation({
    mutationFn: () => api.post('/setoran', { santriId, jenis, materi: materi.trim(), nilai, tanggal }),
    onSuccess: () => {
      toast.success('Setoran dicatat')
      setMateri('')
      refresh()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const hapus = useMutation({
    mutationFn: (id: string) => api.delete(`/setoran/${id}`),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const pm = new Map((progres.data ?? []).map((p) => [p.santriId, p]))

  return (
    <PageShell title='Hafalan dan Iqra' description='Catat setoran bacaan Iqra dan hafalan santri.'>
      <div className='mb-3'>
        <ProfilFilter />
      </div>
      <form
        className='mb-4 flex flex-wrap items-end gap-3'
        onSubmit={(e) => {
          e.preventDefault()
          simpan.mutate()
        }}
      >
        <Field label='Murid'>
          <Select value={santriId} onValueChange={setSantriId}>
            <SelectTrigger className='w-64'>
              <SelectValue placeholder='Pilih murid' />
            </SelectTrigger>
            <SelectContent>
              {murid.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label='Jenis'>
          <Select value={jenis} onValueChange={(v) => setJenis(v as typeof jenis)}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='Iqra'>Iqra</SelectItem>
              <SelectItem value='Hafalan'>Hafalan</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label='Materi' htmlFor='h-materi'>
          <Input id='h-materi' className='w-60' placeholder='Iqra 3 halaman 14' value={materi} onChange={(e) => setMateri(e.target.value)} />
        </Field>
        <Field label='Nilai'>
          <Select value={nilai} onValueChange={(v) => setNilai(v as typeof nilai)}>
            <SelectTrigger className='w-44'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NILAI.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label='Tanggal' htmlFor='h-tgl'>
          <Input id='h-tgl' type='date' className='w-44' value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </Field>
        <Button disabled={!santriId || !materi.trim() || !tanggal || simpan.isPending}>Simpan setoran</Button>
      </form>

      {santriId && (
        <div className='mb-6 rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Materi</TableHead>
                <TableHead>Nilai</TableHead>
                {pimpinan && <TableHead className='text-end'>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {riwayat.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className='h-14 text-center'>
                    Belum ada setoran.
                  </TableCell>
                </TableRow>
              )}
              {riwayat.data?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.tanggal}</TableCell>
                  <TableCell>{s.jenis}</TableCell>
                  <TableCell>{s.materi}</TableCell>
                  <TableCell>
                    <Badge variant={s.nilai === 'Lancar' ? 'default' : 'secondary'}>{s.nilai}</Badge>
                  </TableCell>
                  {pimpinan && (
                    <TableCell className='text-end'>
                      <Button size='icon' variant='ghost' onClick={() => hapus.mutate(s.id)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h2 className='mb-2 text-lg font-semibold'>Progres santri</h2>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Jilid</TableHead>
              <TableHead>Jumlah setoran</TableHead>
              <TableHead>Setoran terakhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {murid.map((s) => (
              <TableRow key={s.id} className='cursor-pointer' onClick={() => setSantriId(s.id)}>
                <TableCell className='font-medium'>{s.nama}</TableCell>
                <TableCell>{s.jilid}</TableCell>
                <TableCell>{pm.get(s.id)?.jumlah ?? 0}</TableCell>
                <TableCell>{pm.get(s.id)?.terakhir ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  )
}
