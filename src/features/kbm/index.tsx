import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { LABEL_ABSEN, STATUS_ABSEN, type StatusAbsen } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { hariIni, useGuruRef, useKelas } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CrudSection } from '@/components/crud-section'
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const opsiHari = HARI.map((h) => ({ value: h, label: h }))
const WARNA: Record<StatusAbsen, string> = {
  H: 'bg-emerald-600 text-white hover:bg-emerald-600/90',
  I: 'bg-sky-600 text-white hover:bg-sky-600/90',
  S: 'bg-amber-500 text-white hover:bg-amber-500/90',
  A: 'bg-red-600 text-white hover:bg-red-600/90',
}

export function KbmPage() {
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const { data: kelas } = useKelas()
  const { data: guru } = useGuruRef()
  const nk = useMemo(() => new Map((kelas ?? []).map((k) => [k.id, k.nama])), [kelas])
  const ng = useMemo(() => new Map((guru ?? []).map((g) => [g.id, g.nama])), [guru])
  const opsiKelas = (kelas ?? []).map((k) => ({ value: k.id, label: k.nama }))
  const opsiGuru = (guru ?? []).map((g) => ({ value: g.id, label: g.nama }))

  return (
    <PageShell title='KBM' description='Kegiatan Belajar Mengajar: jadwal, alokasi waktu, piket, dan absensi guru.'>
      <Tabs defaultValue='jadwal'>
        <TabsList className='flex-wrap'>
          <TabsTrigger value='jadwal'>Jadwal KBM</TabsTrigger>
          <TabsTrigger value='alokasi'>Alokasi Waktu</TabsTrigger>
          <TabsTrigger value='piket'>Guru Piket</TabsTrigger>
          {pimpinan && <TabsTrigger value='absen-guru'>Absensi Guru</TabsTrigger>}
          {pimpinan && <TabsTrigger value='absen-pimpinan'>Absensi Pimpinan</TabsTrigger>}
        </TabsList>

        <TabsContent value='jadwal' className='pt-4'>
          <CrudSection
            url='/kbm/jadwal'
            queryKey='kbm-jadwal'
            judul='jadwal'
            canEdit={pimpinan}
            fields={[
              { key: 'kelasId', label: 'Kelas', type: 'select', options: opsiKelas, nullable: true },
              { key: 'hari', label: 'Hari', type: 'select', options: opsiHari, required: true },
              { key: 'jamMulai', label: 'Jam mulai', type: 'time', required: true },
              { key: 'jamSelesai', label: 'Jam selesai', type: 'time', required: true },
              { key: 'mapel', label: 'Mapel', type: 'text', required: true },
              { key: 'guruId', label: 'Guru', type: 'select', options: opsiGuru, nullable: true },
            ]}
            columns={[
              { label: 'Hari', cell: (r) => r.hari },
              { label: 'Jam', cell: (r) => `${r.jamMulai}-${r.jamSelesai}` },
              { label: 'Kelas', cell: (r) => nk.get(r.kelasId) ?? '-' },
              { label: 'Mapel', cell: (r) => r.mapel },
              { label: 'Guru', cell: (r) => ng.get(r.guruId) ?? '-' },
            ]}
          />
        </TabsContent>
        <TabsContent value='alokasi' className='pt-4'>
          <CrudSection
            url='/kbm/alokasi'
            queryKey='kbm-alokasi'
            judul='alokasi'
            canEdit={pimpinan}
            fields={[
              { key: 'kelasId', label: 'Kelas', type: 'select', options: opsiKelas, nullable: true },
              { key: 'mapel', label: 'Mapel', type: 'text', required: true },
              { key: 'jamPerMinggu', label: 'Jam per minggu', type: 'int', required: true },
              { key: 'hari', label: 'Hari', type: 'text', placeholder: 'Senin, Kamis' },
            ]}
            columns={[
              { label: 'Kelas', cell: (r) => nk.get(r.kelasId) ?? '-' },
              { label: 'Mapel', cell: (r) => r.mapel },
              { label: 'Jam/minggu', cell: (r) => r.jamPerMinggu },
              { label: 'Hari', cell: (r) => r.hari || '-' },
            ]}
          />
        </TabsContent>
        <TabsContent value='piket' className='pt-4'>
          <CrudSection
            url='/kbm/piket'
            queryKey='kbm-piket'
            judul='piket'
            canEdit={pimpinan}
            fields={[
              { key: 'guruId', label: 'Guru', type: 'select', options: opsiGuru, required: true },
              { key: 'hari', label: 'Hari', type: 'select', options: opsiHari, required: true },
              { key: 'keterangan', label: 'Keterangan', type: 'text', placeholder: 'Piket sore' },
            ]}
            columns={[
              { label: 'Hari', cell: (r) => r.hari },
              { label: 'Guru', cell: (r) => ng.get(r.guruId) ?? '-' },
              { label: 'Keterangan', cell: (r) => r.keterangan || '-' },
            ]}
          />
        </TabsContent>
        {pimpinan && (
          <>
            <TabsContent value='absen-guru' className='pt-4'>
              <AbsensiGuru kelompok='Guru' />
            </TabsContent>
            <TabsContent value='absen-pimpinan' className='pt-4'>
              <AbsensiGuru kelompok='Pimpinan' />
            </TabsContent>
          </>
        )}
      </Tabs>
    </PageShell>
  )
}

function AbsensiGuru({ kelompok }: { kelompok: 'Guru' | 'Pimpinan' }) {
  const [tanggal, setTanggal] = useState(hariIni())
  const { data: guru } = useGuruRef()
  const daftar = (guru ?? [])
    .filter((g) => (kelompok === 'Pimpinan' ? g.peranGuru === 'Pimpinan' : g.peranGuru !== 'Pimpinan'))
    .sort((a, b) => a.nama.localeCompare(b.nama))

  const detail = useQuery({
    queryKey: ['absen-guru', kelompok, tanggal],
    queryFn: async () =>
      (
        await api.get<{ catatan: { guruId: string; status: StatusAbsen }[] }>('/kbm/absensi-guru', {
          params: { tanggal, kelompok },
        })
      ).data.catatan,
    gcTime: 0,
  })

  return (
    <div className='space-y-3'>
      <Field label='Tanggal' htmlFor={`ag-${kelompok}`}>
        <Input id={`ag-${kelompok}`} type='date' className='w-44' value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
      </Field>
      {detail.isLoading || !guru ? (
        <Loader2 className='animate-spin' />
      ) : daftar.length === 0 ? (
        <p className='text-muted-foreground'>Belum ada {kelompok === 'Pimpinan' ? 'pimpinan' : 'guru'} di daftar Guru.</p>
      ) : (
        <Form key={`${kelompok}|${tanggal}`} kelompok={kelompok} tanggal={tanggal} guru={daftar} awal={detail.data ?? []} />
      )}
    </div>
  )
}

function Form(props: {
  kelompok: 'Guru' | 'Pimpinan'
  tanggal: string
  guru: { id: string; nama: string }[]
  awal: { guruId: string; status: StatusAbsen }[]
}) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<Record<string, StatusAbsen>>(() => {
    const d = Object.fromEntries(props.guru.map((g) => [g.id, 'H' as StatusAbsen]))
    for (const c of props.awal) if (c.guruId in d) d[c.guruId] = c.status
    return d
  })
  const simpan = useMutation({
    mutationFn: () =>
      api.put('/kbm/absensi-guru', {
        tanggal: props.tanggal,
        kelompok: props.kelompok,
        catatan: props.guru.map((g) => ({ guruId: g.id, status: status[g.id] })),
      }),
    onSuccess: () => {
      toast.success('Absensi tersimpan')
      qc.invalidateQueries({ queryKey: ['absen-guru'] })
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  return (
    <div className='space-y-3'>
      <div className='rounded-md border'>
        {props.guru.map((g) => (
          <div key={g.id} className='flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0'>
            <span className='font-medium'>{g.nama}</span>
            <div className='flex gap-1'>
              {STATUS_ABSEN.map((st) => (
                <Button
                  key={st}
                  type='button'
                  size='sm'
                  variant={status[g.id] === st ? 'default' : 'outline'}
                  className={cn(status[g.id] === st && WARNA[st])}
                  aria-pressed={status[g.id] === st}
                  onClick={() => setStatus({ ...status, [g.id]: st })}
                >
                  {LABEL_ABSEN[st]}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button disabled={simpan.isPending} onClick={() => simpan.mutate()}>
        Simpan absensi
      </Button>
    </div>
  )
}
