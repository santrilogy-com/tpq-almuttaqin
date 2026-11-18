import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DETAIL_GURU, DETAIL_GURU_KUNCI, SARAN, type DetailGuru } from '@shared/biodata'
import { JENJANG, type Jenjang, labelJenjang } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { simpanFoto } from '@/lib/foto'
import { useKelas } from '@/lib/queries'
import { type Guru } from '@/lib/types'
import { jenjangAwal, useProfilAktif } from '@/stores/profil-store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Kolom, GridKolom } from '@/components/biodata-form'
import { Field } from '@/components/field'
import { FotoField } from '@/components/foto-field'

const PERAN_GURU = ['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru'] as const

const K_PRIBADI_1: Kolom[] = [
  { k: 'idGuru', label: 'ID Guru', placeholder: 'mis. G-001' },
  { k: 'nik', label: 'NIK', jenis: 'angka', maks: 16, placeholder: '16 digit' },
]
const K_PRIBADI_2: Kolom[] = [
  { k: 'tempatLahir', label: 'Tempat lahir' },
  { k: 'tanggalLahir', label: 'Tanggal lahir', jenis: 'tanggal' },
  { k: 'namaIbuKandung', label: 'Nama ibu kandung', penuh: true },
]
const K_ALAMAT: Kolom[] = [
  { k: 'jalan', label: 'Jalan / Dusun', penuh: true },
  { k: 'desaKecamatan', label: 'Desa / Kecamatan', penuh: true },
  { k: 'kodePos', label: 'Kode pos', jenis: 'angka', maks: 5 },
  { k: 'rt', label: 'RT', jenis: 'angka', maks: 3 },
  { k: 'rw', label: 'RW', jenis: 'angka', maks: 3 },
]
const K_EMAIL: Kolom[] = [{ k: 'email', label: 'Email', jenis: 'email', penuh: true, placeholder: 'nama@contoh.id' }]
const K_KEPEGAWAIAN: Kolom[] = [
  { k: 'tanggalMasuk', label: 'Tanggal masuk', jenis: 'tanggal' },
  { k: 'status', label: 'Status', saran: SARAN.statusGuru },
  { k: 'noRekening', label: 'No. Rekening Basmalah', jenis: 'angka', maks: 20, penuh: true, placeholder: 'hanya angka' },
]

type NamaTab = 'pribadi' | 'kontak' | 'kepegawaian'
const TAB_KOLOM: Record<NamaTab, string[]> = {
  pribadi: ['nama', ...[...K_PRIBADI_1, ...K_PRIBADI_2].map((x) => x.k), 'jenisKelamin'],
  kontak: [...K_ALAMAT, ...K_EMAIL].map((x) => x.k).concat('hp'),
  kepegawaian: [...K_KEPEGAWAIAN.map((x) => x.k), 'honor', 'jenjang'],
}
const tabDari = (k: string): NamaTab => (Object.keys(TAB_KOLOM) as NamaTab[]).find((t) => TAB_KOLOM[t].includes(k)) ?? 'pribadi'

const keTeks = (d: DetailGuru | null): Record<string, string> =>
  Object.fromEntries(DETAIL_GURU_KUNCI.map((k) => [k, d?.[k] == null ? '' : String(d[k])]))

/** Pembungkus: untuk "Ubah", biodata lengkap dimuat dulu (daftar guru sengaja tanpa biodata). */
export function FormGuru(props: { awal: Guru | null; onClose: () => void; onDone: () => void }) {
  const detail = useQuery({
    queryKey: ['guru-detail', props.awal?.id],
    enabled: !!props.awal,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => (await api.get<{ detail: DetailGuru }>(`/guru/${props.awal!.id}`)).data.detail,
  })
  if (props.awal && !detail.data) {
    return (
      <Dialog open onOpenChange={(o) => !o && props.onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah guru</DialogTitle>
          </DialogHeader>
          {detail.isError ? (
            <p className='text-sm text-destructive'>{pesanGalat(detail.error, 'Biodata gagal dimuat')}</p>
          ) : (
            <Loader2 className='mx-auto my-6 animate-spin' />
          )}
        </DialogContent>
      </Dialog>
    )
  }
  return <FormIsi {...props} detailAwal={detail.data ?? null} />
}

function FormIsi(props: { awal: Guru | null; detailAwal: DetailGuru | null; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient()
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
  const [d, setD] = useState(() => keTeks(props.detailAwal))
  const [tab, setTab] = useState<NamaTab>('pribadi')
  const [galat, setGalat] = useState<Record<string, string>>({})
  // undefined = foto tidak diubah; null = hapus; string = foto baru (diunggah setelah data tersimpan)
  const [fotoBaru, setFotoBaru] = useState<string | null | undefined>(undefined)

  const ubahD = (k: string, x: string) => {
    setD((s) => ({ ...s, [k]: x }))
    setGalat((g) => (g[k] ? { ...g, [k]: '' } : g))
  }
  const ubahV = (p: Partial<typeof v>) => {
    setV((s) => ({ ...s, ...p }))
    setGalat((g) => ({ ...g, ...Object.fromEntries(Object.keys(p).map((k) => [k, ''])) }))
  }

  const m = useMutation({
    mutationFn: async (payload: { utama: Record<string, unknown>; detail: Record<string, unknown> }) => {
      const data = { ...payload.utama, detail: payload.detail }
      const res = props.awal
        ? await api.patch<{ guru: Guru }>(`/guru/${props.awal.id}`, data)
        : await api.post<{ guru: Guru }>('/guru', data)
      try {
        await simpanFoto('guru', res.data.guru.id, fotoBaru)
      } catch (e) {
        toast.error(`Data tersimpan, tetapi foto gagal: ${pesanGalat(e)}`)
      }
      qc.invalidateQueries({ queryKey: ['foto-index'] })
      qc.invalidateQueries({ queryKey: ['guru-detail'] })
      return res
    },
    onSuccess: () => {
      toast.success('Guru disimpan')
      props.onDone()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })

  const kirim = () => {
    const g: Record<string, string> = {}
    if (!v.nama.trim()) g.nama = 'Nama wajib diisi'
    const honor = Number(v.honor.replace(/\./g, ''))
    if (!Number.isInteger(honor) || honor < 0) g.honor = 'Honor harus bilangan bulat rupiah (mis. 800000)'
    const detail = Object.fromEntries(DETAIL_GURU_KUNCI.map((k) => [k, (d[k] ?? '').trim()]))
    const cek = DETAIL_GURU.safeParse(detail)
    if (!cek.success) for (const i of cek.error.issues) g[String(i.path[0])] ??= i.message
    if (Object.keys(g).length > 0) {
      setGalat(g)
      const pertama = Object.keys(g)[0]
      setTab(tabDari(pertama))
      toast.error(`Periksa isian: ${g[pertama]}`)
      return
    }
    m.mutate({
      utama: { nama: v.nama.trim(), peranGuru: v.peranGuru, jenjang: v.jenjang, kelasId: v.kelasId, hp: v.hp.trim(), honor },
      detail,
    })
  }

  const ada = (nama: NamaTab) => TAB_KOLOM[nama].some((k) => galat[k])

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className='max-h-[92svh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{props.awal ? 'Ubah guru' : 'Tambah guru'}</DialogTitle>
        </DialogHeader>
        <form
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            kirim()
          }}
        >
          <FotoField jenis='guru' id={props.awal?.id} nama={v.nama} nilai={fotoBaru} onChange={setFotoBaru} />

          <Tabs value={tab} onValueChange={(x) => setTab(x as NamaTab)}>
            <TabsList className='grid h-auto w-full grid-cols-3'>
              {(
                [
                  ['pribadi', 'Pribadi'],
                  ['kontak', 'Alamat & kontak'],
                  ['kepegawaian', 'Kepegawaian'],
                ] as const
              ).map(([n, label]) => (
                <TabsTrigger key={n} value={n} className='px-1 text-xs sm:text-sm'>
                  {label}
                  {ada(n) && <span className='ms-1 size-1.5 rounded-full bg-destructive' aria-label='ada isian salah' />}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value='pribadi' className='grid gap-3 pt-3'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='sm:col-span-2'>
                  <Field label='Nama lengkap *' htmlFor='g-nama' galat={galat.nama}>
                    <Input id='g-nama' autoComplete='off' value={v.nama} onChange={(e) => ubahV({ nama: e.target.value })} />
                  </Field>
                </div>
              </div>
              <GridKolom kolom={K_PRIBADI_1} nilai={d} onChange={ubahD} galat={galat} prefix='g' />
              <div className='grid gap-3 sm:grid-cols-2'>
                <Field label='Jenis kelamin' galat={galat.jenisKelamin}>
                  <Select value={d.jenisKelamin || 'none'} onValueChange={(x) => ubahD('jenisKelamin', x === 'none' ? '' : x)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>(belum diisi)</SelectItem>
                      <SelectItem value='L'>Laki-laki</SelectItem>
                      <SelectItem value='P'>Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <GridKolom kolom={K_PRIBADI_2} nilai={d} onChange={ubahD} galat={galat} prefix='g' />
            </TabsContent>

            <TabsContent value='kontak' className='grid gap-3 pt-3'>
              <GridKolom kolom={K_ALAMAT} nilai={d} onChange={ubahD} galat={galat} prefix='g' />
              <div className='grid gap-3 sm:grid-cols-2'>
                <Field label='Telepon / HP' htmlFor='g-hp'>
                  <Input id='g-hp' inputMode='tel' value={v.hp} onChange={(e) => ubahV({ hp: e.target.value })} />
                </Field>
              </div>
              <GridKolom kolom={K_EMAIL} nilai={d} onChange={ubahD} galat={galat} prefix='g' />
            </TabsContent>

            <TabsContent value='kepegawaian' className='grid gap-3 pt-3'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <Field label='Peran'>
                  <Select value={v.peranGuru} onValueChange={(x) => ubahV({ peranGuru: x as Guru['peranGuru'] })}>
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
                <Field label='Jenjang mengajar *'>
                  <Select value={v.jenjang} onValueChange={(x) => ubahV({ jenjang: x as Jenjang })}>
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
                  <Select value={v.kelasId ?? 'none'} onValueChange={(x) => ubahV({ kelasId: x === 'none' ? null : x })}>
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
                <Field label='Honor (rupiah, tanpa titik)' htmlFor='g-honor' galat={galat.honor}>
                  <Input id='g-honor' inputMode='numeric' value={v.honor} onChange={(e) => ubahV({ honor: e.target.value.replace(/[^\d.]/g, '') })} />
                </Field>
              </div>
              <GridKolom kolom={K_KEPEGAWAIAN} nilai={d} onChange={ubahD} galat={galat} prefix='g' />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button disabled={m.isPending}>{m.isPending && <Loader2 className='animate-spin' />} Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
