import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  JENJANG,
  KATEGORI_KELUAR,
  KATEGORI_MASUK,
  STATUS_SPP,
  keRupiah,
  type Jenjang,
  type StatusSpp,
} from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { hariIni, rupiah } from '@/lib/queries'
import { type Tagihan, type Transaksi } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useProfil } from '@/stores/profil-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'
import { ProfilFilter } from '@/components/profil-filter'

const labelJenjang = (j: Jenjang) => (j === 'MI' ? 'Ibtidaiyah' : 'TPQ')

export function KeuanganPage() {
  return (
    <PageShell
      title='Keuangan'
      description='Kas lembaga dan tagihan SPP. SPP yang ditandai Lunas otomatis tercatat sebagai pemasukan kas.'
    >
      <div className='mb-3'>
        <ProfilFilter />
      </div>
      <Tabs defaultValue='kas'>
        <TabsList>
          <TabsTrigger value='kas'>Kas</TabsTrigger>
          <TabsTrigger value='spp'>Tagihan SPP</TabsTrigger>
        </TabsList>
        <TabsContent value='kas' className='pt-4'>
          <Kas />
        </TabsContent>
        <TabsContent value='spp' className='pt-4'>
          <Spp />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}

function Kas() {
  const qc = useQueryClient()
  const profil = useProfil((s) => s.profil)
  const [filter, setFilter] = useState<'semua' | 'masuk' | 'keluar'>('semua')
  const [hapus, setHapus] = useState<Transaksi | null>(null)

  const [jenis, setJenis] = useState<'masuk' | 'keluar'>('masuk')
  const [jenjang, setJenjang] = useState<Jenjang>('TPQ')
  const [kategori, setKategori] = useState<string>(KATEGORI_MASUK[1])
  const [nama, setNama] = useState('')
  const [teksJumlah, setTeksJumlah] = useState('')
  const [tanggal, setTanggal] = useState(hariIni())
  const jumlah = keRupiah(teksJumlah)

  const data = useQuery({
    queryKey: ['keuangan', profil],
    queryFn: async () =>
      (
        await api.get<{
          transaksi: Transaksi[]
          ringkasan: { masuk: number; keluar: number; saldo: number }
        }>('/keuangan', { params: profil === 'semua' ? {} : { jenjang: profil } })
      ).data,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['keuangan'] })
  const simpan = useMutation({
    mutationFn: () =>
      api.post('/keuangan', { jenis, jenjang, kategori, nama: nama.trim(), jumlah, tanggal }),
    onSuccess: () => {
      toast.success('Transaksi disimpan')
      setNama('')
      setTeksJumlah('')
      refresh()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/keuangan/${id}`),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })

  const r = data.data?.ringkasan
  const daftar = (data.data?.transaksi ?? []).filter(
    (t) => filter === 'semua' || t.jenis === filter
  )
  const kategoriList = jenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-3'>
        {(
          [
            ['Pemasukan', r?.masuk],
            ['Pengeluaran', r?.keluar],
            ['Saldo kas', r?.saldo],
          ] as const
        ).map(([label, v]) => (
          <Card key={label}>
            <CardHeader className='pb-1'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent
              className={cn('text-2xl font-bold', label === 'Saldo kas' && (v ?? 0) < 0 && 'text-destructive')}
            >
              {v == null ? '...' : rupiah(v)}
            </CardContent>
          </Card>
        ))}
      </div>

      <form
        className='flex flex-wrap items-end gap-3 rounded-md border p-3'
        onSubmit={(e) => {
          e.preventDefault()
          simpan.mutate()
        }}
      >
        <Field label='Jenis'>
          <Select
            value={jenis}
            onValueChange={(v) => {
              const j = v as 'masuk' | 'keluar'
              setJenis(j)
              setKategori((j === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR)[0])
            }}
          >
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='masuk'>Masuk</SelectItem>
              <SelectItem value='keluar'>Keluar</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label='Jenjang'>
          <Select value={jenjang} onValueChange={(v) => setJenjang(v as Jenjang)}>
            <SelectTrigger className='w-36'>
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
        <Field label='Kategori'>
          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger className='w-44'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kategoriList.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label='Nama transaksi' htmlFor='k-nama'>
          <Input id='k-nama' className='w-52' value={nama} onChange={(e) => setNama(e.target.value)} />
        </Field>
        <Field label='Jumlah (Rp)' htmlFor='k-jml'>
          <Input
            id='k-jml'
            className='w-36'
            inputMode='numeric'
            placeholder='50.000'
            value={teksJumlah}
            onChange={(e) => setTeksJumlah(e.target.value)}
          />
        </Field>
        <Field label='Tanggal' htmlFor='k-tgl'>
          <Input id='k-tgl' type='date' className='w-44' value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </Field>
        <Button disabled={!nama.trim() || !jumlah || !tanggal || simpan.isPending}>
          Simpan transaksi
        </Button>
        {teksJumlah !== '' && !jumlah && (
          <span className='text-sm text-destructive'>
            Jumlah harus bilangan bulat rupiah, mis. 50000 atau 50.000.
          </span>
        )}
        {jumlah && <span className='text-sm text-muted-foreground'>{rupiah(jumlah)}</span>}
      </form>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value='semua'>Semua</TabsTrigger>
          <TabsTrigger value='masuk'>Masuk</TabsTrigger>
          <TabsTrigger value='keluar'>Keluar</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Jenjang</TableHead>
              <TableHead className='text-end'>Jumlah</TableHead>
              <TableHead className='text-end'>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className='h-14 text-center'>
                  Memuat...
                </TableCell>
              </TableRow>
            )}
            {!data.isLoading && daftar.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className='h-14 text-center'>
                  Belum ada transaksi.
                </TableCell>
              </TableRow>
            )}
            {daftar.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.tanggal}</TableCell>
                <TableCell className='font-medium'>{t.nama}</TableCell>
                <TableCell>{t.kategori}</TableCell>
                <TableCell>{labelJenjang(t.jenjang)}</TableCell>
                <TableCell
                  className={cn('text-end', t.jenis === 'masuk' ? 'text-emerald-600' : 'text-red-600')}
                >
                  {t.jenis === 'masuk' ? '+' : '-'}
                  {rupiah(t.jumlah)}
                </TableCell>
                <TableCell className='text-end'>
                  {t.tagihanSppId ? (
                    <Badge variant='outline' title='Ubah lewat tab Tagihan SPP'>
                      dari SPP
                    </Badge>
                  ) : (
                    <Button size='icon' variant='ghost' onClick={() => setHapus(t)}>
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
        title='Hapus transaksi'
        desc={`Hapus "${hapus?.nama}" (${hapus ? rupiah(hapus.jumlah) : ''}) dari kas? Saldo akan berubah.`}
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

const LABEL_SPP: Record<StatusSpp, string> = { belum: 'Belum', lunas: 'Lunas', telat: 'Telat' }
const WARNA_SPP: Record<StatusSpp, string> = {
  belum: '',
  lunas: 'bg-emerald-600 text-white hover:bg-emerald-600/90',
  telat: 'bg-red-600 text-white hover:bg-red-600/90',
}

function Spp() {
  const qc = useQueryClient()
  const profil = useProfil((s) => s.profil)
  const [periode, setPeriode] = useState(hariIni().slice(0, 7))

  const q = useQuery({
    queryKey: ['spp', periode],
    enabled: /^\d{4}-\d{2}$/.test(periode),
    queryFn: async () =>
      (await api.get<{ tagihan: Tagihan[] }>('/keuangan/spp', { params: { periode } })).data
        .tagihan,
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['spp'] })
    qc.invalidateQueries({ queryKey: ['keuangan'] })
  }
  const buat = useMutation({
    mutationFn: async () => (await api.post<{ dibuat: number }>('/keuangan/spp/generate', { periode })).data,
    onSuccess: (d) => {
      toast.success(d.dibuat ? `${d.dibuat} tagihan dibuat` : 'Semua santri aktif sudah punya tagihan')
      refresh()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const ubah = useMutation({
    mutationFn: (v: { id: string; status: StatusSpp }) =>
      api.patch(`/keuangan/spp/${v.id}`, { status: v.status }),
    onSuccess: refresh,
    onError: (e) => {
      toast.error(pesanGalat(e))
      refresh()
    },
  })

  const daftar = (q.data ?? []).filter((t) => profil === 'semua' || t.jenjang === profil)
  const lunas = daftar.filter((t) => t.status === 'lunas')
  const jmlLunas = lunas.reduce((a, t) => a + t.jumlah, 0)
  const jmlTotal = daftar.reduce((a, t) => a + t.jumlah, 0)

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <Field label='Bulan' htmlFor='spp-bln'>
          <Input id='spp-bln' type='month' className='w-44' value={periode} onChange={(e) => setPeriode(e.target.value)} />
        </Field>
        <Button variant='outline' disabled={buat.isPending} onClick={() => buat.mutate()}>
          {buat.isPending && <Loader2 className='animate-spin' />}
          Buat tagihan bulan ini
        </Button>
        {daftar.length > 0 && (
          <span className='text-sm text-muted-foreground'>
            Lunas {lunas.length}/{daftar.length} · {rupiah(jmlLunas)} dari {rupiah(jmlTotal)}
          </span>
        )}
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>NIS</TableHead>
              <TableHead>Jenjang</TableHead>
              <TableHead>Tagihan</TableHead>
              <TableHead className='text-end'>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className='h-14 text-center'>
                  Memuat...
                </TableCell>
              </TableRow>
            )}
            {!q.isLoading && daftar.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className='h-14 text-center'>
                  Belum ada tagihan bulan ini. Tekan "Buat tagihan bulan ini".
                </TableCell>
              </TableRow>
            )}
            {daftar.map((t) => (
              <TableRow key={t.id}>
                <TableCell className='font-medium'>{t.nama}</TableCell>
                <TableCell>{t.nis}</TableCell>
                <TableCell>{labelJenjang(t.jenjang)}</TableCell>
                <TableCell>{rupiah(t.jumlah)}</TableCell>
                <TableCell className='space-x-1 text-end'>
                  {STATUS_SPP.map((s) => (
                    <Button
                      key={s}
                      size='sm'
                      variant={t.status === s ? 'default' : 'outline'}
                      className={cn(t.status === s && WARNA_SPP[s])}
                      aria-pressed={t.status === s}
                      disabled={ubah.isPending}
                      onClick={() => t.status !== s && ubah.mutate({ id: t.id, status: s })}
                    >
                      {LABEL_SPP[s]}
                    </Button>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
