import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { JENIS_NILAI, METODE, semesterDari, type JenisNilai } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { hariIni, useKelas, useSantri } from '@/lib/queries'
import { type NilaiRow, type Rapor, type Santri } from '@/lib/types'
import { cocokProfil, useProfilAktif } from '@/stores/profil-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field } from '@/components/field'
import { FotoAvatar } from '@/components/foto-avatar'
import { PageShell } from '@/components/page-shell'

/** "85,5" atau "85.5" -> 85.5; teks kosong/tak valid -> NaN. */
const keAngka = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(',', '.')))
const fmt = (n: number | null) => (n == null ? '-' : String(n).replace('.', ','))

function useMuridAktif() {
  const profil = useProfilAktif()
  const { data } = useSantri()
  return useMemo(
    () =>
      (data ?? [])
        .filter((s) => s.status === 'aktif' && cocokProfil(profil, s.jenjang))
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    [data, profil]
  )
}

function PilihMurid(props: {
  murid: Santri[]
  value: string
  onChange: (id: string) => void
}) {
  const { data: kelas } = useKelas()
  const nama = new Map((kelas ?? []).map((k) => [k.id, k.nama]))
  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger className='w-72'>
        <SelectValue placeholder='Pilih murid' />
      </SelectTrigger>
      <SelectContent>
        {props.murid.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.nama}
            {s.kelasId && nama.get(s.kelasId) ? ` Â· ${nama.get(s.kelasId)}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function NilaiPage() {
  return (
    <PageShell
      title='Penilaian dan Rapor'
      description='Nilai akhir = Harian 40% + Imda 30% + Praktek 30%. Semester dihitung otomatis dari tanggal nilai.'
    >
      <Tabs defaultValue='input'>
        <TabsList>
          <TabsTrigger value='input'>Input nilai</TabsTrigger>
          <TabsTrigger value='rapor'>Rapor murid</TabsTrigger>
        </TabsList>
        <TabsContent value='input' className='pt-4'>
          <InputNilai />
        </TabsContent>
        <TabsContent value='rapor' className='pt-4'>
          <RaporMurid />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}

function InputNilai() {
  const qc = useQueryClient()
  const murid = useMuridAktif()
  const [santriId, setSantriId] = useState('')
  const [jenis, setJenis] = useState<JenisNilai>('Harian')
  const [mapel, setMapel] = useState(METODE)
  const [nilai, setNilai] = useState('')
  const [tanggal, setTanggal] = useState(hariIni())

  const riwayat = useQuery({
    queryKey: ['nilai', santriId],
    enabled: !!santriId,
    queryFn: async () =>
      (await api.get<{ nilai: NilaiRow[] }>('/nilai', { params: { santriId } })).data.nilai,
  })
  const angka = keAngka(nilai)
  const valid = santriId && mapel.trim() && angka >= 0 && angka <= 100

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['nilai', santriId] })
    qc.invalidateQueries({ queryKey: ['rapor'] })
  }
  const simpan = useMutation({
    mutationFn: () =>
      api.post('/nilai', { santriId, jenis, mapel: mapel.trim(), nilai: angka, tanggal }),
    onSuccess: () => {
      toast.success(`Nilai ${jenis} disimpan`)
      setNilai('')
      refresh()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const hapus = useMutation({
    mutationFn: (id: string) => api.delete(`/nilai/${id}`),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })

  return (
    <div className='space-y-4'>
      <form
        className='flex flex-wrap items-end gap-3'
        onSubmit={(e) => {
          e.preventDefault()
          simpan.mutate()
        }}
      >
        <Field label='Murid'>
          <PilihMurid murid={murid} value={santriId} onChange={setSantriId} />
        </Field>
        <Field label='Jenis'>
          <Select value={jenis} onValueChange={(v) => setJenis(v as JenisNilai)}>
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JENIS_NILAI.map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label='Mapel' htmlFor='n-mapel'>
          <Input
            id='n-mapel'
            className='w-40'
            value={mapel}
            onChange={(e) => setMapel(e.target.value)}
          />
        </Field>
        <Field label='Nilai (0-100)' htmlFor='n-nilai'>
          <Input
            id='n-nilai'
            className='w-28'
            inputMode='decimal'
            value={nilai}
            onChange={(e) => setNilai(e.target.value)}
          />
        </Field>
        <Field label='Tanggal' htmlFor='n-tgl'>
          <Input
            id='n-tgl'
            type='date'
            className='w-44'
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </Field>
        <Button disabled={!valid || simpan.isPending}>Simpan nilai {jenis}</Button>
      </form>
      {tanggal && (
        <p className='text-sm text-muted-foreground'>
          Masuk semester {semesterDari(tanggal)}.
          {nilai !== '' && !(angka >= 0 && angka <= 100) && (
            <span className='ms-2 text-destructive'>Nilai harus 0 sampai 100.</span>
          )}
        </p>
      )}

      {santriId && (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Mapel</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead className='text-end'>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riwayat.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className='h-14 text-center'>
                    Memuat...
                  </TableCell>
                </TableRow>
              )}
              {riwayat.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='h-14 text-center'>
                    Belum ada nilai.
                  </TableCell>
                </TableRow>
              )}
              {riwayat.data?.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{n.tanggal}</TableCell>
                  <TableCell>{n.jenis}</TableCell>
                  <TableCell>{n.mapel}</TableCell>
                  <TableCell>{fmt(n.nilai)}</TableCell>
                  <TableCell>{n.semester}</TableCell>
                  <TableCell className='text-end'>
                    <Button
                      size='icon'
                      variant='ghost'
                      title='Hapus nilai'
                      onClick={() => hapus.mutate(n.id)}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function teksRapor(r: Rapor) {
  return [
    `Rapor ${r.santri.nama} (NIS ${r.santri.nis})`,
    `Kelas: ${r.santri.kelas ?? '-'} Â· Jilid: ${r.santri.jilid}`,
    `Semester: ${r.semester === 'semua' ? 'Semua' : r.semester}`,
    `Harian: ${fmt(r.harian)}`,
    `Imda: ${fmt(r.imda)}`,
    `Praktek: ${fmt(r.praktek)}`,
    `Nilai akhir: ${fmt(r.akhir)}${r.akhir != null && !r.lengkap ? ' (sementara)' : ''}`,
    `Predikat: ${r.predikat ?? '-'}`,
    `Kehadiran: ${r.kehadiran ? `${r.kehadiran.persen}% (${r.kehadiran.hadir}/${r.kehadiran.total})` : '-'}`,
  ].join('\n')
}

function RaporMurid() {
  const murid = useMuridAktif()
  const [santriId, setSantriId] = useState('')
  const [semester, setSemester] = useState<string | undefined>(undefined)
  const rapor = useQuery({
    queryKey: ['rapor', santriId, semester],
    enabled: !!santriId,
    queryFn: async () =>
      (
        await api.get<Rapor>(`/rapor/${santriId}`, {
          params: semester ? { semester } : {},
        })
      ).data,
  })
  const r = rapor.data

  const bagikan = async () => {
    if (!r) return
    const teks = teksRapor(r)
    try {
      if (navigator.share) await navigator.share({ title: 'Rapor', text: teks })
      else {
        await navigator.clipboard.writeText(teks)
        toast.success('Teks rapor disalin')
      }
    } catch {
      /* dibatalkan pengguna */
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <Field label='Murid'>
          <PilihMurid
            murid={murid}
            value={santriId}
            onChange={(id) => {
              setSantriId(id)
              setSemester(undefined)
            }}
          />
        </Field>
        {r && (
          <Field label='Semester'>
            <Select value={r.semester} onValueChange={setSemester}>
              <SelectTrigger className='w-52'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='semua'>Semua semester</SelectItem>
                {r.daftarSemester.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      {rapor.isLoading && <Loader2 className='animate-spin' />}
      {r && (
        <Card className='max-w-xl'>
          <CardHeader>
            <CardTitle className='flex items-center gap-3'>
              <FotoAvatar jenis='santri' id={r.santri.id} nama={r.santri.nama} className='size-12' />
              {r.santri.nama}
            </CardTitle>
            <CardDescription>
              NIS {r.santri.nis} Â· Kelas {r.santri.kelas ?? '-'} Â· {r.santri.jilid}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='grid grid-cols-3 gap-3 text-center'>
              {(
                [
                  ['Harian', r.harian, '40%'],
                  ['Imda', r.imda, '30%'],
                  ['Praktek', r.praktek, '30%'],
                ] as const
              ).map(([label, v, bobot]) => (
                <div key={label} className='rounded-md border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    {label} ({bobot})
                  </div>
                  <div className='text-xl font-semibold'>{fmt(v)}</div>
                </div>
              ))}
            </div>
            <div className='rounded-md bg-muted p-4 text-center'>
              <div className='text-sm text-muted-foreground'>Nilai akhir</div>
              <div className='text-3xl font-bold'>{fmt(r.akhir)}</div>
              <div className='mt-1 flex items-center justify-center gap-2'>
                <span>{r.predikat ?? 'Belum ada nilai'}</span>
                {r.akhir != null && !r.lengkap && (
                  <Badge variant='secondary' title='Belum ada ketiga jenis nilai'>
                    Sementara
                  </Badge>
                )}
              </div>
              {r.akhir != null && !r.lengkap && (
                <p className='mt-2 text-xs text-muted-foreground'>
                  Dihitung dari komponen yang sudah ada; bobot disesuaikan.
                </p>
              )}
            </div>
            <div className='text-sm'>
              Kehadiran:{' '}
              {r.kehadiran
                ? `${r.kehadiran.persen}% (${r.kehadiran.hadir} dari ${r.kehadiran.total} pertemuan)`
                : 'belum ada data absensi'}
            </div>
            <Button variant='outline' onClick={bagikan}>
              <Copy /> Bagikan rapor (teks)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}






