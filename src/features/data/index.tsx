import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { parseCsv } from '@shared/csv'
import { cekRelasi, FORMAT_BACKUP, hitungBaris, KUNCI_BACKUP, pesanZod, SKEMA_BACKUP, type DataBackup } from '@shared/backup'
import { apakahV22, konversiV22 } from '@shared/v22'
import { api, pesanGalat } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'

const LABEL: Record<string, string> = {
  lembaga: 'Identitas lembaga', kelas: 'Kelas', santri: 'Santri', guru: 'Guru', pertemuan: 'Pertemuan', absensi: 'Catatan absensi',
  nilai: 'Nilai', setoran: 'Setoran hafalan', tabungan: 'Transaksi tabungan', transaksi: 'Transaksi kas', tagihanSpp: 'Tagihan SPP',
  pengumuman: 'Pengumuman', jadwalKbm: 'Jadwal KBM', alokasiWaktu: 'Alokasi waktu', piket: 'Piket', absensiGuru: 'Absensi guru',
  rapbm: 'Pos RAPBM', biaya: 'Biaya', targetTabungan: 'Target menabung',
}

const baca = (f: File) =>
  new Promise<string>((ok, gagal) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result ?? ''))
    r.onerror = () => gagal(new Error('Gagal membaca file'))
    r.readAsText(f)
  })

export function DataPage() {
  return (
    <PageShell title='Data dan Backup' description='Cadangkan, pulihkan, pindahkan dari versi lama, dan isi data massal dari CSV.'>
      <div className='grid gap-4 xl:grid-cols-2'>
        <Backup />
        <Pulihkan />
        <ImportCsv />
        <ZonaBerbahaya />
      </div>
    </PageShell>
  )
}

function Backup() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadangkan data</CardTitle>
        <CardDescription>
          Berisi seluruh data TPQ dalam satu file JSON. Akun dan kata sandi pengguna <b>tidak</b> ikut tersimpan, jadi file ini aman dari kebocoran sandi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href='/api/backup/export' download>
            <Download /> Unduh backup (JSON)
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

type Pratinjau = { sumber: 'v2' | 'v22'; data: DataBackup; peringatan: string[] }

function Pulihkan() {
  const qc = useQueryClient()
  const [pr, setPr] = useState<Pratinjau | null>(null)
  const [galat, setGalat] = useState('')
  const [konf, setKonf] = useState('')

  const pilih = async (f: File | undefined) => {
    setPr(null)
    setGalat('')
    setKonf('')
    if (!f) return
    try {
      const json = JSON.parse(await baca(f))
      let data: DataBackup
      let peringatan: string[] = []
      let sumber: 'v2' | 'v22' = 'v2'
      if (apakahV22(json)) {
        const h = konversiV22(json)
        data = h.data
        peringatan = h.peringatan
        sumber = 'v22'
      } else {
        const p = SKEMA_BACKUP.safeParse(json)
        if (!p.success) return setGalat(`File bukan backup yang valid: ${pesanZod(p.error)}`)
        data = p.data.data as DataBackup
      }
      const rel = cekRelasi(data)
      if (rel) return setGalat(`Data tidak konsisten: ${rel}`)
      setPr({ sumber, data, peringatan })
    } catch {
      setGalat('File tidak bisa dibaca. Pastikan ini file backup JSON.')
    }
  }

  const pulihkan = useMutation({
    mutationFn: () =>
      api.post('/backup/restore', {
        konfirmasi: 'PULIHKAN',
        backup: { format: FORMAT_BACKUP, versi: 1, dibuat: new Date().toISOString(), data: pr!.data },
      }),
    onSuccess: () => {
      toast.success('Data dipulihkan')
      setPr(null)
      setKonf('')
      qc.invalidateQueries()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pulihkan atau pindahkan dari v22</CardTitle>
        <CardDescription>
          Pilih file backup v2 atau file <code>tpq-madin-backup-*.json</code> dari aplikasi lama. Seluruh data saat ini diganti.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Input type='file' accept='.json,application/json' onChange={(e) => pilih(e.target.files?.[0])} />
        {galat && (
          <Alert variant='destructive'>
            <AlertTriangle className='size-4' />
            <AlertTitle>Tidak bisa dipakai</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        )}
        {pr && (
          <>
            <p className='text-sm'>
              Terbaca sebagai backup <b>{pr.sumber === 'v22' ? 'v22 (akan dikonversi)' : 'v2'}</b>:
            </p>
            <div className='max-h-48 overflow-auto rounded-md border'>
              <Table>
                <TableBody>
                  {KUNCI_BACKUP.map((k) => (
                    <TableRow key={k}>
                      <TableCell className='py-1'>{LABEL[k]}</TableCell>
                      <TableCell className='py-1 text-end'>{hitungBaris(pr.data)[k]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pr.peringatan.length > 0 && (
              <Alert>
                <AlertTriangle className='size-4' />
                <AlertTitle>Baca dulu sebelum memulihkan</AlertTitle>
                <AlertDescription>
                  <ul className='ms-4 list-disc space-y-1'>
                    {pr.peringatan.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <Field label='Ketik PULIHKAN untuk mengonfirmasi (data saat ini akan diganti)' htmlFor='pulih-konf'>
              <Input id='pulih-konf' value={konf} onChange={(e) => setKonf(e.target.value)} placeholder='PULIHKAN' />
            </Field>
            <Button variant='destructive' disabled={konf !== 'PULIHKAN' || pulihkan.isPending} onClick={() => pulihkan.mutate()}>
              <Upload /> Pulihkan data
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

type HasilImport = { dibuat: number; kelasBaru?: number; ditolak: { baris: number; alasan: string }[] }

function ImportCsv() {
  const qc = useQueryClient()
  const [jenis, setJenis] = useState<'santri' | 'guru' | 'nilai'>('santri')
  const [baris, setBaris] = useState<Record<string, string>[] | null>(null)
  const [hasil, setHasil] = useState<HasilImport | null>(null)
  const [galat, setGalat] = useState('')

  const pilih = async (f: File | undefined) => {
    setBaris(null)
    setHasil(null)
    setGalat('')
    if (!f) return
    const rows = parseCsv(await baca(f))
    if (rows.length < 2) return setGalat('File kosong atau hanya berisi judul kolom.')
    const [kepala, ...isi] = rows
    setBaris(isi.map((r) => Object.fromEntries(kepala.map((h, i) => [h.trim(), r[i] ?? '']).filter(([h]) => h))))
  }

  const kirim = useMutation({
    mutationFn: async () => (await api.post<HasilImport>(`/import/${jenis}`, { baris })).data,
    onSuccess: (d) => {
      setHasil(d)
      setBaris(null)
      toast.success(`${d.dibuat} baris diimpor${d.ditolak.length ? `, ${d.ditolak.length} ditolak` : ''}`)
      qc.invalidateQueries()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import CSV</CardTitle>
        <CardDescription>
          Unduh template, isi di spreadsheet, simpan sebagai CSV. Baris yang gagal dilewati dan dilaporkan; baris lain tetap masuk. Maksimal 1000 baris per import.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex flex-wrap items-end gap-3'>
          <Field label='Jenis data'>
            <Select value={jenis} onValueChange={(v) => { setJenis(v as typeof jenis); setBaris(null); setHasil(null) }}>
              <SelectTrigger className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='santri'>Santri</SelectItem>
                <SelectItem value='guru'>Guru</SelectItem>
                <SelectItem value='nilai'>Nilai</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button asChild variant='outline'>
            <a href={`/api/import/template/${jenis}`} download>
              <Download /> Template {jenis}
            </a>
          </Button>
        </div>
        <Input key={jenis} type='file' accept='.csv,text/csv' onChange={(e) => pilih(e.target.files?.[0])} />
        {galat && <p className='text-sm text-destructive'>{galat}</p>}
        {baris && (
          <div className='flex items-center gap-3'>
            <span className='text-sm'>{baris.length} baris siap diimpor.</span>
            <Button disabled={kirim.isPending} onClick={() => kirim.mutate()}>
              <Upload /> Impor sekarang
            </Button>
          </div>
        )}
        {hasil && (
          <div className='space-y-2'>
            <p className='text-sm'>
              <b>{hasil.dibuat}</b> baris berhasil
              {hasil.kelasBaru ? ` · ${hasil.kelasBaru} kelas baru dibuat otomatis` : ''} · <b>{hasil.ditolak.length}</b> ditolak
            </p>
            {hasil.ditolak.length > 0 && (
              <div className='max-h-56 overflow-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-20'>Baris</TableHead>
                      <TableHead>Alasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hasil.ditolak.map((d) => (
                      <TableRow key={d.baris}>
                        <TableCell>{d.baris}</TableCell>
                        <TableCell>{d.alasan}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ZonaBerbahaya() {
  const qc = useQueryClient()
  const [konf, setKonf] = useState('')
  const hapus = useMutation({
    mutationFn: () => api.post('/backup/kosongkan', { konfirmasi: 'HAPUS SEMUA' }),
    onSuccess: () => {
      toast.success('Semua data dihapus')
      setKonf('')
      qc.invalidateQueries()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  return (
    <Card className='border-destructive/50'>
      <CardHeader>
        <CardTitle className='text-destructive'>Zona berbahaya</CardTitle>
        <CardDescription>
          Menghapus <b>permanen</b> semua santri, guru, kelas, nilai, absensi, keuangan, dan data lain. Akun pengguna serta identitas dan tarif lembaga tetap ada. Unduh backup dulu.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Field label='Ketik HAPUS SEMUA untuk mengonfirmasi' htmlFor='hapus-konf'>
          <Input id='hapus-konf' value={konf} onChange={(e) => setKonf(e.target.value)} placeholder='HAPUS SEMUA' />
        </Field>
        <Button variant='destructive' disabled={konf !== 'HAPUS SEMUA' || hapus.isPending} onClick={() => hapus.mutate()}>
          Hapus semua data
        </Button>
      </CardContent>
    </Card>
  )
}
