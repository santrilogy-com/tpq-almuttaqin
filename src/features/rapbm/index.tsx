import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { JENJANG } from '@shared/domain'
import { api } from '@/lib/api'
import { rupiah } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { useProfil } from '@/stores/profil-store'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CrudSection } from '@/components/crud-section'
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'
import { ProfilFilter } from '@/components/profil-filter'

type Realita = {
  id: string
  pos: string
  jenis: 'masuk' | 'keluar'
  jenjang: 'TPQ' | 'MI'
  rencana: number
  realisasi: number
  selisih: number
}
const lj = (j: string) => (j === 'MI' ? 'Ibtidaiyah' : 'TPQ')
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function RapbmPage() {
  const profil = useProfil((s) => s.profil)
  const cocok = (r: { jenjang: string }) => profil === 'semua' || r.jenjang === profil
  return (
    <PageShell
      title='RAPBM'
      description='Rencana Anggaran Pendapatan dan Belanja Madrasah: rencana dibanding realisasi dari kas.'
    >
      <div className='mb-3'>
        <ProfilFilter />
      </div>
      <Tabs defaultValue='pos'>
        <TabsList className='flex-wrap'>
          <TabsTrigger value='pos'>RAPBM</TabsTrigger>
          <TabsTrigger value='realita'>Realita</TabsTrigger>
          <TabsTrigger value='rekap'>Rekap</TabsTrigger>
          <TabsTrigger value='arus'>Arus Kas</TabsTrigger>
          <TabsTrigger value='biaya'>Set Biaya</TabsTrigger>
          <TabsTrigger value='target'>Target Menabung</TabsTrigger>
        </TabsList>
        <TabsContent value='pos' className='pt-4'>
          <CrudSection
            url='/anggaran/pos'
            queryKey='rapbm-pos'
            juga={['realita']}
            judul='pos'
            canEdit
            filter={cocok}
            fields={[
              { key: 'pos', label: 'Nama pos (sama dengan kategori kas)', type: 'text', required: true, placeholder: 'SPP' },
              {
                key: 'jenis',
                label: 'Jenis',
                type: 'select',
                required: true,
                options: [
                  { value: 'masuk', label: 'Masuk' },
                  { value: 'keluar', label: 'Keluar' },
                ],
              },
              { key: 'jenjang', label: 'Jenjang', type: 'select', required: true, options: JENJANG.map((j) => ({ value: j, label: lj(j) })) },
              { key: 'rencana', label: 'Rencana (Rp)', type: 'rupiah', required: true },
            ]}
            columns={[
              { label: 'Pos', cell: (r) => r.pos },
              { label: 'Jenis', cell: (r) => (r.jenis === 'masuk' ? 'Masuk' : 'Keluar') },
              { label: 'Jenjang', cell: (r) => lj(r.jenjang) },
              { label: 'Rencana', cell: (r) => rupiah(r.rencana), className: 'text-end' },
            ]}
          />
        </TabsContent>
        <TabsContent value='realita' className='pt-4'>
          <RealitaTab cocok={cocok} />
        </TabsContent>
        <TabsContent value='rekap' className='pt-4'>
          <RekapTab cocok={cocok} />
        </TabsContent>
        <TabsContent value='arus' className='pt-4'>
          <ArusKas />
        </TabsContent>
        <TabsContent value='biaya' className='pt-4'>
          <CrudSection
            url='/anggaran/biaya'
            queryKey='biaya'
            judul='biaya'
            canEdit
            fields={[
              { key: 'nama', label: 'Nama biaya', type: 'text', required: true },
              { key: 'jumlah', label: 'Jumlah (Rp)', type: 'rupiah', required: true },
              { key: 'keterangan', label: 'Keterangan', type: 'text' },
            ]}
            columns={[
              { label: 'Nama', cell: (r) => r.nama },
              { label: 'Jumlah', cell: (r) => rupiah(r.jumlah) },
              { label: 'Keterangan', cell: (r) => r.keterangan || '-' },
            ]}
          />
        </TabsContent>
        <TabsContent value='target' className='pt-4'>
          <CrudSection
            url='/anggaran/target'
            queryKey='target'
            judul='target'
            canEdit
            fields={[
              { key: 'nama', label: 'Nama target', type: 'text', required: true },
              { key: 'target', label: 'Target (Rp)', type: 'rupiah', required: true },
              { key: 'terkumpul', label: 'Terkumpul (Rp)', type: 'rupiah' },
            ]}
            columns={[
              { label: 'Nama', cell: (r) => r.nama },
              { label: 'Target', cell: (r) => rupiah(r.target) },
              { label: 'Terkumpul', cell: (r) => rupiah(r.terkumpul) },
              { label: 'Capaian', cell: (r) => `${Math.min(100, Math.round((r.terkumpul / r.target) * 100))}%` },
            ]}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}

const useRealita = () =>
  useQuery({
    queryKey: ['realita'],
    queryFn: async () => (await api.get<{ realita: Realita[] }>('/anggaran/realita')).data.realita,
  })

function RealitaTab({ cocok }: { cocok: (r: Realita) => boolean }) {
  const { data, isLoading } = useRealita()
  const rows = (data ?? []).filter(cocok)
  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pos</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Jenjang</TableHead>
            <TableHead className='text-end'>Rencana</TableHead>
            <TableHead className='text-end'>Realisasi</TableHead>
            <TableHead className='text-end'>Selisih</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className='h-14 text-center'>
                Memuat...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className='h-14 text-center'>
                Belum ada pos. Tambahkan di tab RAPBM.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className='font-medium'>{r.pos}</TableCell>
              <TableCell>{r.jenis === 'masuk' ? 'Masuk' : 'Keluar'}</TableCell>
              <TableCell>{lj(r.jenjang)}</TableCell>
              <TableCell className='text-end'>{rupiah(r.rencana)}</TableCell>
              <TableCell className='text-end'>{rupiah(r.realisasi)}</TableCell>
              {/* Masuk: kurang dari rencana = merah. Keluar: lebih dari rencana = merah. */}
              <TableCell
                className={cn(
                  'text-end',
                  (r.jenis === 'masuk' ? r.selisih < 0 : r.selisih > 0) ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                {r.selisih > 0 ? '+' : ''}
                {rupiah(r.selisih)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RekapTab({ cocok }: { cocok: (r: Realita) => boolean }) {
  const { data } = useRealita()
  const rows = (data ?? []).filter(cocok)
  const jum = (j: 'masuk' | 'keluar', f: 'rencana' | 'realisasi') =>
    rows.filter((r) => r.jenis === j).reduce((a, r) => a + r[f], 0)
  const baris = [
    ['Pendapatan', jum('masuk', 'rencana'), jum('masuk', 'realisasi')],
    ['Belanja', jum('keluar', 'rencana'), jum('keluar', 'realisasi')],
    ['Surplus / defisit', jum('masuk', 'rencana') - jum('keluar', 'rencana'), jum('masuk', 'realisasi') - jum('keluar', 'realisasi')],
  ] as const
  return (
    <div className='max-w-xl rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead className='text-end'>Rencana</TableHead>
            <TableHead className='text-end'>Realisasi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {baris.map(([l, r, s]) => (
            <TableRow key={l}>
              <TableCell className='font-medium'>{l}</TableCell>
              <TableCell className='text-end'>{rupiah(r)}</TableCell>
              <TableCell className='text-end'>{rupiah(s)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ArusKas() {
  const [tahun, setTahun] = useState(String(new Date().getFullYear()))
  const ok = /^\d{4}$/.test(tahun)
  const { data } = useQuery({
    queryKey: ['arus-kas', tahun],
    enabled: ok,
    queryFn: async () =>
      (await api.get<{ arusKas: { bulan: string; masuk: number; keluar: number; bersih: number }[] }>('/anggaran/arus-kas', { params: { tahun } })).data.arusKas,
  })
  const chart = (data ?? []).map((d, i) => ({ bulan: BULAN[i], Masuk: d.masuk, Keluar: d.keluar }))
  return (
    <div className='space-y-4'>
      <Field label='Tahun' htmlFor='ak-thn'>
        <Input id='ak-thn' className='w-28' inputMode='numeric' value={tahun} onChange={(e) => setTahun(e.target.value)} />
      </Field>
      <div className='h-64 w-full'>
        <ResponsiveContainer>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray='3 3' vertical={false} />
            <XAxis dataKey='bulan' />
            <YAxis tickFormatter={(v: number) => (v >= 1_000_000 ? `${v / 1_000_000}jt` : v >= 1000 ? `${v / 1000}rb` : String(v))} />
            <Tooltip formatter={(v) => rupiah(Number(v))} />
            <Legend />
            <Bar dataKey='Masuk' fill='#059669' />
            <Bar dataKey='Keluar' fill='#dc2626' />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bulan</TableHead>
              <TableHead className='text-end'>Masuk</TableHead>
              <TableHead className='text-end'>Keluar</TableHead>
              <TableHead className='text-end'>Bersih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((d, i) => (
              <TableRow key={d.bulan}>
                <TableCell>{BULAN[i]}</TableCell>
                <TableCell className='text-end'>{rupiah(d.masuk)}</TableCell>
                <TableCell className='text-end'>{rupiah(d.keluar)}</TableCell>
                <TableCell className={cn('text-end', d.bersih < 0 && 'text-red-600')}>{rupiah(d.bersih)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
