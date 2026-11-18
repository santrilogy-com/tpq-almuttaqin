import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DETAIL_SANTRI, DETAIL_SANTRI_KUNCI, SARAN, type DetailSantri } from '@shared/biodata'
import { JENJANG, JILID_LIST, type Jenjang, labelJenjang } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { simpanFoto } from '@/lib/foto'
import { useKelas } from '@/lib/queries'
import { type Santri } from '@/lib/types'
import { jenjangAwal, useProfilAktif } from '@/stores/profil-store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Kolom, GridKolom } from '@/components/biodata-form'
import { Field } from '@/components/field'
import { FotoField } from '@/components/foto-field'

// ---- Kolom biodata per tab (urutan mengikuti daftar kebutuhan data murid)
const K_IDENTITAS: Kolom[] = [
  { k: 'nik', label: 'NIK murid', jenis: 'angka', maks: 16, placeholder: '16 digit' },
  { k: 'noKk', label: 'No. KK', jenis: 'angka', maks: 16, placeholder: '16 digit' },
  { k: 'nisn', label: 'NISN', jenis: 'angka', maks: 10, placeholder: '10 digit' },
  { k: 'tempatLahir', label: 'Tempat lahir' },
  { k: 'tanggalLahir', label: 'Tanggal lahir', jenis: 'tanggal' },
  { k: 'hobi', label: 'Hobi' },
  { k: 'citaCita', label: 'Cita-cita' },
]
const K_SEKOLAH: Kolom[] = [
  { k: 'tanggalMasuk', label: 'Tanggal masuk', jenis: 'tanggal' },
  { k: 'statusMasuk', label: 'Status masuk', saran: SARAN.statusMasuk },
]
const K_KELUARGA: Kolom[] = [
  { k: 'statusAnak', label: 'Status anak', saran: SARAN.statusAnak },
  { k: 'anakKe', label: 'Anak ke-', jenis: 'angka', maks: 2 },
  { k: 'statusRumah', label: 'Status rumah', saran: SARAN.statusRumah },
  { k: 'statusMukim', label: 'Status mukim', saran: SARAN.statusMukim },
  { k: 'jalan', label: 'Jalan / Dusun', penuh: true },
  { k: 'desaKecamatan', label: 'Desa / Kecamatan', penuh: true },
  { k: 'kodePos', label: 'Kode pos', jenis: 'angka', maks: 5 },
  { k: 'rt', label: 'RT', jenis: 'angka', maks: 3 },
  { k: 'rw', label: 'RW', jenis: 'angka', maks: 3 },
]
const K_AYAH: Kolom[] = [
  { k: 'nikAyah', label: 'NIK ayah', jenis: 'angka', maks: 16 },
  { k: 'namaAyah', label: 'Nama ayah' },
  { k: 'pendidikanAyah', label: 'Pendidikan ayah', saran: SARAN.pendidikan },
  { k: 'penghasilanAyah', label: 'Penghasilan ayah', saran: SARAN.penghasilan },
  { k: 'kontakAyah', label: 'Kontak ayah', jenis: 'tel' },
]
const K_IBU: Kolom[] = [
  { k: 'nikIbu', label: 'NIK ibu', jenis: 'angka', maks: 16 },
  { k: 'namaIbu', label: 'Nama ibu' },
  { k: 'pendidikanIbu', label: 'Pendidikan ibu', saran: SARAN.pendidikan },
  { k: 'pekerjaanIbu', label: 'Pekerjaan ibu' },
  { k: 'penghasilanIbu', label: 'Penghasilan ibu', saran: SARAN.penghasilan },
  { k: 'kontakIbu', label: 'Kontak ibu', jenis: 'tel' },
]

type NamaTab = 'identitas' | 'sekolah' | 'keluarga' | 'ortu'
const TAB_KOLOM: Record<NamaTab, string[]> = {
  identitas: ['nama', 'nis', ...K_IDENTITAS.map((x) => x.k)],
  sekolah: ['jenjang', ...K_SEKOLAH.map((x) => x.k), 'diterimaDiKelas'],
  keluarga: K_KELUARGA.map((x) => x.k),
  ortu: [...K_AYAH, ...K_IBU].map((x) => x.k),
}
const tabDari = (k: string): NamaTab => (Object.keys(TAB_KOLOM) as NamaTab[]).find((t) => TAB_KOLOM[t].includes(k)) ?? 'identitas'

const UTAMA_KOSONG = {
  nis: '',
  nama: '',
  jenisKelamin: 'L' as 'L' | 'P',
  jenjang: 'TPQ' as Jenjang,
  kelasId: null as string | null,
  jilid: JILID_LIST[0] as string,
  angkatan: '',
  status: 'aktif' as Santri['status'],
  wali: '',
  hpWali: '',
  alamat: '',
}

const keTeks = (d: DetailSantri | null): Record<string, string> =>
  Object.fromEntries(DETAIL_SANTRI_KUNCI.map((k) => [k, d?.[k] == null ? '' : String(d[k])]))

/** Pembungkus: untuk "Ubah", biodata lengkap dimuat dulu (daftar santri sengaja tanpa biodata). */
export function FormSantri(props: { awal: Santri | null; onClose: () => void; onDone: () => void }) {
  const detail = useQuery({
    queryKey: ['santri-detail', props.awal?.id],
    enabled: !!props.awal,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => (await api.get<{ detail: DetailSantri }>(`/santri/${props.awal!.id}`)).data.detail,
  })

  if (props.awal && !detail.data) {
    return (
      <Dialog open onOpenChange={(o) => !o && props.onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah santri</DialogTitle>
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

function FormIsi(props: { awal: Santri | null; detailAwal: DetailSantri | null; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient()
  const { data: kelas } = useKelas()
  const profilAktif = useProfilAktif()
  const [v, setV] = useState({ ...UTAMA_KOSONG, jenjang: jenjangAwal(profilAktif), ...props.awal })
  const [d, setD] = useState(() => keTeks(props.detailAwal))
  const [tab, setTab] = useState<NamaTab>('identitas')
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
    mutationFn: async (payload: { utama: typeof v; detail: Record<string, unknown> }) => {
      const { id: _id, rombel: _r, ...utama } = payload.utama as Santri & typeof UTAMA_KOSONG
      const data = { ...utama, detail: payload.detail }
      const res = props.awal
        ? await api.patch<{ santri: Santri }>(`/santri/${props.awal.id}`, data)
        : await api.post<{ santri: Santri }>('/santri', data)
      try {
        await simpanFoto('santri', res.data.santri.id, fotoBaru)
      } catch (e) {
        toast.error(`Data tersimpan, tetapi foto gagal: ${pesanGalat(e)}`)
      }
      qc.invalidateQueries({ queryKey: ['foto-index'] })
      qc.invalidateQueries({ queryKey: ['santri-detail'] })
      return res
    },
    onSuccess: () => {
      toast.success(props.awal ? 'Santri diperbarui' : 'Santri ditambahkan')
      props.onDone()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })

  const kirim = () => {
    const g: Record<string, string> = {}
    if (!v.nama.trim()) g.nama = 'Nama wajib diisi'
    if (!v.nis.trim()) g.nis = 'ID Murid (NIS) wajib diisi'
    const detail = Object.fromEntries(
      DETAIL_SANTRI_KUNCI.map((k) => [k, k === 'anakKe' ? (d.anakKe === '' ? null : Number(d.anakKe)) : (d[k] ?? '').trim()])
    )
    const cek = DETAIL_SANTRI.safeParse(detail)
    if (!cek.success) for (const i of cek.error.issues) g[String(i.path[0])] ??= i.message
    if (Object.keys(g).length > 0) {
      setGalat(g)
      const pertama = Object.keys(g)[0]
      setTab(tabDari(pertama))
      toast.error(`Periksa isian: ${g[pertama]}`)
      return
    }
    m.mutate({ utama: v, detail })
  }

  const t = (k: keyof typeof v) => ({
    value: (v[k] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => ubahV({ [k]: e.target.value } as Partial<typeof v>),
  })
  const namaKelasSaran = (kelas ?? []).map((k) => k.nama)
  const kolomDiterima: Kolom[] = [{ k: 'diterimaDiKelas', label: 'Diterima di kelas', saran: namaKelasSaran, penuh: true }]
  const ada = (nama: NamaTab) => TAB_KOLOM[nama].some((k) => galat[k])

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className='max-h-[92svh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{props.awal ? 'Ubah santri' : 'Tambah santri'}</DialogTitle>
        </DialogHeader>
        <form
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            kirim()
          }}
        >
          <FotoField jenis='santri' id={props.awal?.id} nama={v.nama} nilai={fotoBaru} onChange={setFotoBaru} />

          <Tabs value={tab} onValueChange={(x) => setTab(x as NamaTab)}>
            <TabsList className='grid h-auto w-full grid-cols-4'>
              {(
                [
                  ['identitas', 'Identitas'],
                  ['sekolah', 'Sekolah'],
                  ['keluarga', 'Keluarga'],
                  ['ortu', 'Orang tua'],
                ] as const
              ).map(([n, label]) => (
                <TabsTrigger key={n} value={n} className='px-1 text-xs sm:text-sm'>
                  {label}
                  {ada(n) && <span className='ms-1 size-1.5 rounded-full bg-destructive' aria-label='ada isian salah' />}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value='identitas' className='grid gap-3 pt-3'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <Field label='Nama lengkap *' htmlFor='s-nama' galat={galat.nama}>
                  <Input id='s-nama' autoComplete='off' {...t('nama')} />
                </Field>
                <Field label='ID Murid (NIS) *' htmlFor='s-nis' galat={galat.nis}>
                  <Input id='s-nis' autoComplete='off' {...t('nis')} />
                </Field>
                <Field label='Jenis kelamin *'>
                  <Select value={v.jenisKelamin} onValueChange={(x) => ubahV({ jenisKelamin: x as 'L' | 'P' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='L'>Laki-laki</SelectItem>
                      <SelectItem value='P'>Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <GridKolom kolom={K_IDENTITAS} nilai={d} onChange={ubahD} galat={galat} prefix='s' />
            </TabsContent>

            <TabsContent value='sekolah' className='grid gap-3 pt-3'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <Field label='Jenjang *'>
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
                <Field label='Kelas saat ini'>
                  <Select value={v.kelasId ?? 'none'} onValueChange={(x) => ubahV({ kelasId: x === 'none' ? null : x })}>
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
                  <Select value={v.jilid} onValueChange={(x) => ubahV({ jilid: x })}>
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
                  <Input id='s-ang' {...t('angkatan')} />
                </Field>
                <Field label='Status santri'>
                  <Select value={v.status} onValueChange={(x) => ubahV({ status: x as Santri['status'] })}>
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
              </div>
              <GridKolom kolom={[...K_SEKOLAH, ...kolomDiterima]} nilai={d} onChange={ubahD} galat={galat} prefix='s' />
            </TabsContent>

            <TabsContent value='keluarga' className='grid gap-3 pt-3'>
              <GridKolom kolom={K_KELUARGA} nilai={d} onChange={ubahD} galat={galat} prefix='s' />
              <Field label='Alamat lengkap (catatan tambahan)' htmlFor='s-alamat'>
                <Input id='s-alamat' {...t('alamat')} />
              </Field>
            </TabsContent>

            <TabsContent value='ortu' className='grid gap-4 pt-3'>
              <section className='grid gap-2'>
                <h3 className='text-sm font-semibold'>Ayah</h3>
                <GridKolom kolom={K_AYAH} nilai={d} onChange={ubahD} galat={galat} prefix='s' />
              </section>
              <section className='grid gap-2'>
                <h3 className='text-sm font-semibold'>Ibu</h3>
                <GridKolom kolom={K_IBU} nilai={d} onChange={ubahD} galat={galat} prefix='s' />
              </section>
              <section className='grid gap-2'>
                <h3 className='text-sm font-semibold'>Wali</h3>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <Field label='Nama wali' htmlFor='s-wali'>
                    <Input id='s-wali' {...t('wali')} />
                  </Field>
                  <Field label='HP wali' htmlFor='s-hp'>
                    <Input id='s-hp' inputMode='tel' {...t('hpWali')} />
                  </Field>
                </div>
              </section>
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
