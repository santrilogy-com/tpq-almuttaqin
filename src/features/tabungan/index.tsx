import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BATAS_TARIK_KONFIRMASI, keRupiah } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { hariIni, rupiah, useSantri } from '@/lib/queries'
import { type TabunganRow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { cocokProfil, useProfil } from '@/stores/profil-store'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'
import { ProfilFilter } from '@/components/profil-filter'

export function TabunganPage() {
  const qc = useQueryClient()
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
  const [jenis, setJenis] = useState<'setor' | 'tarik'>('setor')
  const [teks, setTeks] = useState('')
  const [tanggal, setTanggal] = useState(hariIni())
  const [konfirmasi, setKonfirmasi] = useState(false)
  const jumlah = keRupiah(teks)

  const total = useQuery({
    queryKey: ['tabungan-saldo'],
    queryFn: async () =>
      (await api.get<{ saldo: { santriId: string; saldo: number }[] }>('/tabungan/saldo')).data.saldo,
  })
  const riwayat = useQuery({
    queryKey: ['tabungan', santriId],
    enabled: !!santriId,
    queryFn: async () =>
      (await api.get<{ transaksi: TabunganRow[]; saldo: number }>('/tabungan', { params: { santriId } })).data,
  })

  const kirim = useMutation({
    mutationFn: (konf: boolean) =>
      api.post('/tabungan', { santriId, jenis, jumlah, tanggal, konfirmasi: konf }),
    onSuccess: () => {
      toast.success(jenis === 'setor' ? 'Setoran dicatat' : 'Penarikan dicatat')
      setTeks('')
      qc.invalidateQueries({ queryKey: ['tabungan'] })
      qc.invalidateQueries({ queryKey: ['tabungan-saldo'] })
    },
    onError: (e) => {
      toast.error(pesanGalat(e))
      // Saldo bisa berubah dari perangkat lain.
      qc.invalidateQueries({ queryKey: ['tabungan', santriId] })
    },
  })

  const saldo = riwayat.data?.saldo
  const lebih = jenis === 'tarik' && jumlah != null && saldo != null && jumlah > saldo
  const totalSemua = (total.data ?? []).reduce((a, x) => a + x.saldo, 0)

  const kirimAtauKonfirmasi = () => {
    if (jenis === 'tarik' && jumlah! > BATAS_TARIK_KONFIRMASI) setKonfirmasi(true)
    else kirim.mutate(false)
  }

  return (
    <PageShell title='Tabungan' description='Setoran dan penarikan tabungan santri.'>
      <div className='mb-3'>
        <ProfilFilter />
      </div>
      <div className='mb-4 grid gap-3 sm:grid-cols-2'>
        <Card>
          <CardHeader className='pb-1'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              Total tabungan semua santri
            </CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {total.data ? rupiah(totalSemua) : '...'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-1'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              Saldo santri terpilih
            </CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-bold'>
            {saldo == null ? '-' : rupiah(saldo)}
          </CardContent>
        </Card>
      </div>

      <form
        className='mb-4 flex flex-wrap items-end gap-3'
        onSubmit={(e) => {
          e.preventDefault()
          kirimAtauKonfirmasi()
        }}
      >
        <Field label='Murid'>
          <Select value={santriId} onValueChange={setSantriId}>
            <SelectTrigger className='w-72'>
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
          <Select value={jenis} onValueChange={(v) => setJenis(v as 'setor' | 'tarik')}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='setor'>Setor</SelectItem>
              <SelectItem value='tarik'>Tarik</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label='Jumlah (Rp)' htmlFor='t-jml'>
          <Input
            id='t-jml'
            className='w-36'
            inputMode='numeric'
            placeholder='50.000'
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
          />
        </Field>
        <Field label='Tanggal' htmlFor='t-tgl'>
          <Input id='t-tgl' type='date' className='w-44' value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </Field>
        <Button disabled={!santriId || !jumlah || !tanggal || lebih || kirim.isPending}>
          Simpan transaksi
        </Button>
      </form>
      {lebih && (
        <p className='mb-3 text-sm text-destructive'>
          Penarikan melebihi saldo ({rupiah(saldo!)}).
        </p>
      )}
      {teks !== '' && !jumlah && (
        <p className='mb-3 text-sm text-destructive'>
          Jumlah harus bilangan bulat rupiah, mis. 50000 atau 50.000.
        </p>
      )}

      {santriId && (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead className='text-end'>Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riwayat.data?.transaksi.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className='h-14 text-center'>
                    Belum ada transaksi.
                  </TableCell>
                </TableRow>
              )}
              {riwayat.data?.transaksi.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.tanggal}</TableCell>
                  <TableCell>{t.jenis === 'setor' ? 'Setor' : 'Tarik'}</TableCell>
                  <TableCell
                    className={cn('text-end', t.jenis === 'setor' ? 'text-emerald-600' : 'text-red-600')}
                  >
                    {t.jenis === 'setor' ? '+' : '-'}
                    {rupiah(t.jumlah)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={konfirmasi}
        onOpenChange={setKonfirmasi}
        title='Konfirmasi penarikan besar'
        desc={`Tarik ${jumlah ? rupiah(jumlah) : ''} dari tabungan? Jumlah ini di atas ${rupiah(BATAS_TARIK_KONFIRMASI)}.`}
        confirmText='Ya, tarik'
        handleConfirm={() => {
          setKonfirmasi(false)
          kirim.mutate(true)
        }}
      />
    </PageShell>
  )
}
