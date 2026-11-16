import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { LABEL_ABSEN, STATUS_ABSEN, type StatusAbsen } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { hariIni, useKelas, useSantri } from '@/lib/queries'
import { type Pertemuan, type Santri } from '@/lib/types'
import { cn } from '@/lib/utils'
import { cocokProfil, useProfil } from '@/stores/profil-store'
import { useAuthStore } from '@/stores/auth-store'
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
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'
import { ProfilFilter } from '@/components/profil-filter'

type Detail = {
  pertemuan: { id: string; materi: string } | null
  catatan: { santriId: string; status: StatusAbsen }[]
}

const WARNA: Record<StatusAbsen, string> = {
  H: 'bg-emerald-600 text-white hover:bg-emerald-600/90',
  I: 'bg-sky-600 text-white hover:bg-sky-600/90',
  S: 'bg-amber-500 text-white hover:bg-amber-500/90',
  A: 'bg-red-600 text-white hover:bg-red-600/90',
}

export function AbsensiPage() {
  const profil = useProfil((s) => s.profil)
  const { data: kelas } = useKelas()
  const [kelasId, setKelasId] = useState<string>('')
  const [tanggal, setTanggal] = useState(hariIni())
  const dirty = useRef(false)
  // Perubahan kelas/tanggal yang menunggu persetujuan buang perubahan.
  const [tunda, setTunda] = useState<(() => void) | null>(null)

  const daftar = useMemo(
    () => (kelas ?? []).filter((k) => cocokProfil(profil, k.jenjang)),
    [kelas, profil]
  )
  const aktif = daftar.find((k) => k.id === kelasId) ?? daftar[0]

  // Peringatan bawaan browser saat menutup/memuat ulang dengan perubahan belum disimpan.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  const ubah = (fn: () => void) => {
    if (dirty.current) setTunda(() => fn)
    else fn()
  }

  return (
    <PageShell
      title='Kelas dan Absensi'
      description='Semua santri otomatis Hadir; ketuk hanya yang Izin, Sakit, atau Alpa.'
    >
      <div className='mb-4 flex flex-wrap items-end gap-3'>
        <ProfilFilter />
        <Field label='Kelas'>
          <Select
            value={aktif?.id ?? ''}
            onValueChange={(v) => ubah(() => setKelasId(v))}
          >
            <SelectTrigger className='w-48'>
              <SelectValue placeholder='Pilih kelas' />
            </SelectTrigger>
            <SelectContent>
              {daftar.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label='Tanggal pertemuan' htmlFor='a-tgl'>
          <Input
            id='a-tgl'
            type='date'
            className='w-44'
            value={tanggal}
            onChange={(e) => {
              const v = e.target.value
              if (v) ubah(() => setTanggal(v))
            }}
          />
        </Field>
      </div>

      {!aktif ? (
        <p className='text-muted-foreground'>
          Belum ada kelas. Pimpinan dapat menambahkannya di menu Kelas.
        </p>
      ) : (
        <>
          <Pengisi
            key={`${aktif.id}|${tanggal}`}
            kelasId={aktif.id}
            tanggal={tanggal}
            setDirty={(v) => {
              dirty.current = v
            }}
          />
          <Riwayat
            kelasId={aktif.id}
            onPilih={(t) => ubah(() => setTanggal(t))}
          />
        </>
      )}

      <ConfirmDialog
        open={!!tunda}
        onOpenChange={(o) => !o && setTunda(null)}
        title='Buang perubahan?'
        desc='Absensi yang belum disimpan akan hilang jika Anda pindah.'
        confirmText='Buang dan pindah'
        destructive
        handleConfirm={() => {
          dirty.current = false
          tunda?.()
          setTunda(null)
        }}
      />
    </PageShell>
  )
}

function Pengisi(props: {
  kelasId: string
  tanggal: string
  setDirty: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const { data: semua } = useSantri()
  const detail = useQuery({
    queryKey: ['absen-detail', props.kelasId, props.tanggal],
    queryFn: async () =>
      (
        await api.get<Detail>('/absensi/detail', {
          params: { kelasId: props.kelasId, tanggal: props.tanggal },
        })
      ).data,
    staleTime: 0,
    gcTime: 0,
  })

  const murid = useMemo(
    () =>
      (semua ?? [])
        .filter((s) => s.kelasId === props.kelasId && s.status === 'aktif')
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    [semua, props.kelasId]
  )

  if (detail.isLoading || !semua) {
    return <Loader2 className='my-6 animate-spin' />
  }
  if (detail.isError) {
    return <p className='text-destructive'>{pesanGalat(detail.error)}</p>
  }
  return (
    <Form
      {...props}
      murid={murid}
      awal={detail.data!}
      onSaved={() => {
        qc.invalidateQueries({ queryKey: ['absen-riwayat', props.kelasId] })
        qc.invalidateQueries({ queryKey: ['rapor'] })
      }}
    />
  )
}

function Form(props: {
  kelasId: string
  tanggal: string
  setDirty: (v: boolean) => void
  murid: Santri[]
  awal: Detail
  onSaved: () => void
}) {
  const sudahAda = !!props.awal.pertemuan
  const [materi, setMateri] = useState(props.awal.pertemuan?.materi ?? '')
  const [status, setStatus] = useState<Record<string, StatusAbsen>>(() => {
    const dasar = Object.fromEntries(props.murid.map((s) => [s.id, 'H' as StatusAbsen]))
    for (const c of props.awal.catatan) if (c.santriId in dasar) dasar[c.santriId] = c.status
    return dasar
  })

  const tandai = () => {
    props.setDirty(true)
  }
  const m = useMutation({
    mutationFn: () =>
      api.put('/absensi/pertemuan', {
        kelasId: props.kelasId,
        tanggal: props.tanggal,
        materi,
        catatan: props.murid.map((s) => ({ santriId: s.id, status: status[s.id] })),
      }),
    onSuccess: () => {
      props.setDirty(false)
      toast.success(sudahAda ? 'Absensi diperbarui' : 'Absensi tersimpan')
      props.onSaved()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })

  const hitung = (st: StatusAbsen) =>
    props.murid.filter((s) => status[s.id] === st).length

  return (
    <div className='mb-6 space-y-3'>
      <Field label='Materi hari ini' htmlFor='a-materi'>
        <Input
          id='a-materi'
          className='max-w-md'
          value={materi}
          onChange={(e) => {
            setMateri(e.target.value)
            tandai()
          }}
        />
      </Field>

      {sudahAda && (
        <p className='text-sm text-amber-600'>
          Pertemuan tanggal ini sudah tersimpan. Menyimpan akan memperbaruinya.
        </p>
      )}

      {props.murid.length === 0 ? (
        <p className='text-muted-foreground'>Belum ada santri aktif di kelas ini.</p>
      ) : (
        <div className='rounded-md border'>
          {props.murid.map((s) => (
            <div
              key={s.id}
              className='flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0'
            >
              <span className='font-medium'>{s.nama}</span>
              <div className='flex gap-1'>
                {STATUS_ABSEN.map((st) => (
                  <Button
                    key={st}
                    type='button'
                    size='sm'
                    variant={status[s.id] === st ? 'default' : 'outline'}
                    className={cn(status[s.id] === st && WARNA[st])}
                    title={LABEL_ABSEN[st]}
                    aria-pressed={status[s.id] === st}
                    onClick={() => {
                      setStatus({ ...status, [s.id]: st })
                      tandai()
                    }}
                  >
                    {LABEL_ABSEN[st]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className='flex flex-wrap items-center gap-3'>
        <Button
          disabled={m.isPending || props.murid.length === 0}
          onClick={() => m.mutate()}
        >
          {m.isPending && <Loader2 className='animate-spin' />}
          Simpan pertemuan
        </Button>
        <span className='text-sm text-muted-foreground'>
          Hadir {hitung('H')} Â· Izin {hitung('I')} Â· Sakit {hitung('S')} Â· Alpa{' '}
          {hitung('A')}
        </span>
      </div>
    </div>
  )
}

function Riwayat(props: { kelasId: string; onPilih: (tgl: string) => void }) {
  const qc = useQueryClient()
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const [hapus, setHapus] = useState<Pertemuan | null>(null)
  const { data } = useQuery({
    queryKey: ['absen-riwayat', props.kelasId],
    queryFn: async () =>
      (
        await api.get<{ pertemuan: Pertemuan[] }>('/absensi/pertemuan', {
          params: { kelasId: props.kelasId },
        })
      ).data.pertemuan,
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/absensi/pertemuan/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absen-riwayat', props.kelasId] })
      qc.invalidateQueries({ queryKey: ['absen-detail'] })
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })

  return (
    <div>
      <h2 className='mb-2 text-lg font-semibold'>Riwayat pertemuan</h2>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Materi</TableHead>
              <TableHead>H</TableHead>
              <TableHead>I</TableHead>
              <TableHead>S</TableHead>
              <TableHead>A</TableHead>
              <TableHead className='text-end'>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className='h-14 text-center'>
                  Belum ada pertemuan.
                </TableCell>
              </TableRow>
            )}
            {data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.tanggal}</TableCell>
                <TableCell>{p.materi || '-'}</TableCell>
                <TableCell>{p.ringkasan.H}</TableCell>
                <TableCell>{p.ringkasan.I}</TableCell>
                <TableCell>{p.ringkasan.S}</TableCell>
                <TableCell>{p.ringkasan.A}</TableCell>
                <TableCell className='space-x-1 text-end'>
                  <Button size='sm' variant='ghost' onClick={() => props.onPilih(p.tanggal)}>
                    Buka
                  </Button>
                  {pimpinan && (
                    <Button size='icon' variant='ghost' onClick={() => setHapus(p)}>
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog
        open={!!hapus}
        onOpenChange={(o) => !o && setHapus(null)}
        title='Hapus pertemuan'
        desc={`Hapus pertemuan ${hapus?.tanggal} beserta seluruh absensinya secara permanen?`}
        confirmText='Hapus'
        destructive
        handleConfirm={() => {
          const id = hapus!.id
          setHapus(null)
          del.mutate(id)
        }}
      />
    </div>
  )
}

