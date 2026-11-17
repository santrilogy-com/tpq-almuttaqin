import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LABEL_ABSEN, type StatusAbsen, labelJenjang } from '@shared/domain'
import { keuanganUntuk, useRingkasan } from '@/lib/laporan'
import { rupiah } from '@/lib/queries'
import { cocokProfil, useProfilAktif } from '@/stores/profil-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageShell } from '@/components/page-shell'

const lj = (j: string) => labelJenjang(j === 'MI' ? 'MI' : 'TPQ')

export function GrafikBatang(props: { data: { nama: string; jumlah: number }[] }) {
  if (props.data.length === 0) return <p className='text-sm text-muted-foreground'>Belum ada data.</p>
  return (
    <div className='h-56 w-full'>
      <ResponsiveContainer>
        <BarChart data={props.data}>
          <CartesianGrid strokeDasharray='3 3' vertical={false} />
          <XAxis dataKey='nama' interval={0} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey='jumlah' name='Santri' fill='#059669' radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const WARNA: Record<StatusAbsen, string> = { H: '#059669', I: '#0284c7', S: '#f59e0b', A: '#dc2626' }

export function LaporanPage() {
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const profil = useProfilAktif()
  const { data: r } = useRingkasan()
  const keu = r?.keuangan ? keuanganUntuk(r.keuangan, profil) : undefined
  const kelas = (r?.santriPerKelas ?? []).filter((k) => cocokProfil(profil, k.jenjang))

  // Gabungkan per angkatan lintas jenjang sesuai profil.
  const angkatan = new Map<string, number>()
  for (const a of r?.santriPerAngkatan ?? [])
    if (cocokProfil(profil, a.jenjang)) angkatan.set(a.angkatan || '(kosong)', (angkatan.get(a.angkatan || '(kosong)') ?? 0) + a.jumlah)
  const peran = new Map<string, number>()
  for (const g of r?.guruPerPeran ?? [])
    if (cocokProfil(profil, g.jenjang)) peran.set(g.peran, (peran.get(g.peran) ?? 0) + g.jumlah)
  const abs = r ? (['H', 'I', 'S', 'A'] as const).map((s) => ({ name: LABEL_ABSEN[s], value: r.absensiTotal[s], s })) : []

  const exports: [string, string, boolean][] = [
    ['santri', 'Santri', false],
    ['nilai', 'Nilai', false],
    ['absensi', 'Absensi', false],
    ['guru', 'Guru', true],
    ['keuangan', 'Keuangan', true],
    ['tabungan', 'Tabungan', true],
  ]

  return (
    <PageShell title='Laporan' description='Rekap data dan export CSV.'>

      {r?.keuangan && keu && (
        <div className='mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {(
            [
              ['Saldo kas', rupiah(keu.saldoKas)],
              [`SPP lunas ${r.keuangan.periode}`, `${keu.spp.lunas}/${keu.spp.total} (${rupiah(keu.spp.nominalLunas)})`],
              ['Total tabungan', rupiah(keu.totalTabungan)],
              ['Honor guru belum lunas', String(keu.honorBelumLunas)],
            ] as const
          ).map(([j, v]) => (
            <Card key={j}>
              <CardHeader className='pb-1'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>{j}</CardTitle>
              </CardHeader>
              <CardContent className='text-xl font-bold'>{v}</CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className='mb-4 grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Rekap per jenjang</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jenjang</TableHead>
                  <TableHead>Aktif</TableHead>
                  <TableHead>Laki-laki</TableHead>
                  <TableHead>Perempuan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(['TPQ', 'MI'] as const).filter((j) => cocokProfil(profil, j)).map((j) => (
                  <TableRow key={j}>
                    <TableCell>{lj(j)}</TableCell>
                    <TableCell>{r?.perJenjang[j].aktif ?? '...'}</TableCell>
                    <TableCell>{r?.perJenjang[j].L ?? '...'}</TableCell>
                    <TableCell>{r?.perJenjang[j].P ?? '...'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Rekap per kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Jenjang</TableHead>
                  <TableHead>Santri aktif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kelas.map((k) => (
                  <TableRow key={k.kelasId}>
                    <TableCell>{k.kelas}</TableCell>
                    <TableCell>{lj(k.jenjang)}</TableCell>
                    <TableCell>{k.jumlah}</TableCell>
                  </TableRow>
                ))}
                {kelas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className='text-center'>
                      Belum ada kelas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className='mb-4 grid gap-4 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Santri per angkatan</CardTitle>
          </CardHeader>
          <CardContent>
            <GrafikBatang data={[...angkatan].map(([nama, jumlah]) => ({ nama, jumlah }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Guru per peran</CardTitle>
          </CardHeader>
          <CardContent>
            <GrafikBatang data={[...peran].map(([nama, jumlah]) => ({ nama, jumlah }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Absensi</CardTitle>
          </CardHeader>
          <CardContent>
            {abs.every((a) => a.value === 0) ? (
              <p className='text-sm text-muted-foreground'>Belum ada absensi.</p>
            ) : (
              <div className='h-56 w-full'>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={abs} dataKey='value' nameKey='name' outerRadius={80} label={(e) => (e.value ? `${e.name} ${e.value}` : '')}>
                      {abs.map((a) => (
                        <Cell key={a.s} fill={WARNA[a.s]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className='mt-1 text-xs text-muted-foreground'>H = Hadir, I = Izin, S = Sakit, A = Alpa. L = Laki-laki, P = Perempuan. Absensi: 60 hari terakhir.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Export CSV</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-2'>
          {exports
            .filter(([, , khusus]) => pimpinan || !khusus)
            .map(([kode, label]) => (
              <Button key={kode} asChild variant='outline'>
                {/* unduh langsung dari server: tidak terbatas 500 baris, ber-BOM agar Excel membaca huruf Indonesia */}
                <a href={`/api/laporan/export/${kode}`} download>
                  <Download /> {label}
                </a>
              </Button>
            ))}
        </CardContent>
      </Card>
    </PageShell>
  )
}




