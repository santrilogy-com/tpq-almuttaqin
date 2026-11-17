import { Link } from '@tanstack/react-router'
import { Check, Circle } from 'lucide-react'
import { rupiah, usePengumuman } from '@/lib/queries'
import { keuanganUntuk, useRingkasan } from '@/lib/laporan'
import { cocokProfil, useProfilAktif, type Profil } from '@/stores/profil-store'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageShell } from '@/components/page-shell'
import { GrafikBatang } from '@/features/laporan'

const aktifProfil = (p: Profil, r: { TPQ: { aktif: number }; MI: { aktif: number } }) =>
  (cocokProfil(p, 'TPQ') ? r.TPQ.aktif : 0) + (cocokProfil(p, 'MI') ? r.MI.aktif : 0)

function Kartu(props: { judul: string; nilai: React.ReactNode; ket?: string }) {
  return (
    <Card>
      <CardHeader className='pb-1'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>{props.judul}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{props.nilai}</div>
        {props.ket && <p className='text-xs text-muted-foreground'>{props.ket}</p>}
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const user = useAuthStore((s) => s.auth.user)
  const profil = useProfilAktif()
  const { data: r } = useRingkasan()
  const { data: pengumuman } = usePengumuman()
  const pimpinan = user?.peran === 'pimpinan'
  const keu = r?.keuangan ? keuanganUntuk(r.keuangan, profil) : undefined
  const deskripsi =
    profil === 'semua'
      ? 'Ringkasan seluruh lembaga: TPQ dan Madrasah.'
      : `Ringkasan ${profil === 'MI' ? 'Madrasah' : 'TPQ'}.`
  const tampilPengumuman = (pengumuman ?? []).filter((p) => p.tampil)

  const langkah = r
    ? [
        { ok: r.isian.kelas > 0, teks: 'Tambah kelas', url: '/kelas' },
        { ok: r.isian.guru > 0, teks: 'Tambah guru', url: '/guru' },
        { ok: r.isian.santri > 0, teks: 'Tambah santri', url: '/santri' },
      ].filter((l) => pimpinan || l.url !== '/guru')
    : []
  const belumLengkap = langkah.some((l) => !l.ok)
  const kelasTampil = (r?.santriPerKelas ?? []).filter((k) => cocokProfil(profil, k.jenjang))

  return (
    <PageShell title={`Assalamu'alaikum, ${user?.nama ?? ''}`} description={deskripsi}>

      {r && belumLengkap && (
        <Card className='mb-4 border-primary/40'>
          <CardHeader>
            <CardTitle>Mulai isi data</CardTitle>
            <CardDescription>Langkah awal agar aplikasi siap dipakai. Hilang sendiri setelah ketiganya terisi.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-4'>
            {langkah.map((l) => (
              <Link key={l.url} to={l.url} className='flex items-center gap-2 text-sm hover:underline'>
                {l.ok ? <Check className='size-4 text-emerald-600' /> : <Circle className='size-4 text-muted-foreground' />}
                <span className={l.ok ? 'text-muted-foreground line-through' : ''}>{l.teks}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className='mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Kartu judul='Santri aktif' nilai={r ? aktifProfil(profil, r.perJenjang) : '...'} ket={r ? `TPQ ${r.perJenjang.TPQ.aktif} · Madrasah ${r.perJenjang.MI.aktif}` : undefined} />
        <Kartu judul='Rata-rata kehadiran' nilai={r ? (r.rataKehadiran == null ? '-' : `${r.rataKehadiran}%`) : '...'} ket='Dari absensi 60 hari terakhir' />
        <Kartu judul='Kelas' nilai={r ? kelasTampil.length : '...'} />
        {pimpinan ? (
          <Kartu judul='Saldo kas' nilai={keu ? rupiah(keu.saldoKas) : '...'} ket={keu && r?.keuangan ? `SPP ${r.keuangan.periode}: ${keu.spp.lunas}/${keu.spp.total} lunas` : undefined} />
        ) : (
          <Kartu judul='Guru' nilai={r ? r.guruPerPeran.filter((g) => cocokProfil(profil, g.jenjang)).reduce((a, g) => a + g.jumlah, 0) : '...'} />
        )}
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Pengumuman</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {tampilPengumuman.length === 0 && <p className='text-sm text-muted-foreground'>Tidak ada pengumuman.</p>}
            {tampilPengumuman.slice(0, 4).map((p) => (
              <div key={p.id}>
                <div className='font-medium'>{p.judul}</div>
                <p className='text-sm whitespace-pre-wrap text-muted-foreground'>{p.isi}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Santri per kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <GrafikBatang data={kelasTampil.map((k) => ({ nama: k.kelas, jumlah: k.jumlah }))} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}




