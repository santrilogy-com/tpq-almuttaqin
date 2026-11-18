import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { labelJenjang } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { rupiah, useGuru, useKelas } from '@/lib/queries'
import { type Guru } from '@/lib/types'
import { cocokProfil, useProfilAktif } from '@/stores/profil-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FotoAvatar } from '@/components/foto-avatar'
import { PageShell } from '@/components/page-shell'
import { FormGuru } from './form-guru'

export function GuruPage() {
  const qc = useQueryClient()
  const profil = useProfilAktif()
  const { data: guru, isLoading } = useGuru()
  const { data: kelas } = useKelas()
  const [form, setForm] = useState<Guru | 'baru' | null>(null)
  const [hapus, setHapus] = useState<Guru | null>(null)

  const namaKelas = useMemo(
    () => new Map((kelas ?? []).map((k) => [k.id, k.nama])),
    [kelas]
  )
  const refresh = () => qc.invalidateQueries({ queryKey: ['guru'] })
  const aksi = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const tampil = (guru ?? []).filter((g) => cocokProfil(profil, g.jenjang))

  return (
    <PageShell
      title='Guru'
      description='Daftar guru dan status honor. Hak akses login diatur di Kelola pengguna.'
      actions={
        <Button onClick={() => setForm('baru')}>
          <Plus /> Tambah guru
        </Button>
      }
    >
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Jenjang</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>HP</TableHead>
              <TableHead>Honor</TableHead>
              <TableHead className='text-end'>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className='h-16 text-center'>
                  Memuat...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && tampil.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className='h-16 text-center'>
                  Belum ada guru.
                </TableCell>
              </TableRow>
            )}
            {tampil.map((g) => (
              <TableRow key={g.id}>
                <TableCell className='font-medium'>
                  <div className='flex items-center gap-2'>
                    <FotoAvatar jenis='guru' id={g.id} nama={g.nama} />
                    {g.nama}
                  </div>
                </TableCell>
                <TableCell>{g.peranGuru}</TableCell>
                <TableCell>{labelJenjang(g.jenjang)}</TableCell>
                <TableCell>{(g.kelasId && namaKelas.get(g.kelasId)) || '-'}</TableCell>
                <TableCell>{g.hp || '-'}</TableCell>
                <TableCell className='space-x-2'>
                  {rupiah(g.honor)}
                  <Badge
                    className='cursor-pointer'
                    variant={g.honorLunas ? 'default' : 'secondary'}
                    title='Ketuk untuk mengubah status'
                    onClick={() =>
                      aksi.mutate(() =>
                        api.patch(`/guru/${g.id}`, { honorLunas: !g.honorLunas })
                      )
                    }
                  >
                    {g.honorLunas ? 'Lunas' : 'Belum'}
                  </Badge>
                </TableCell>
                <TableCell className='space-x-1 text-end'>
                  <Button size='icon' variant='ghost' onClick={() => setForm(g)}>
                    <Pencil />
                  </Button>
                  <Button size='icon' variant='ghost' onClick={() => setHapus(g)}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {form && (
        <FormGuru
          awal={form === 'baru' ? null : form}
          onClose={() => setForm(null)}
          onDone={() => {
            setForm(null)
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={!!hapus}
        onOpenChange={(o) => !o && setHapus(null)}
        title='Hapus guru'
        desc={`Hapus ${hapus?.nama} dari daftar guru? Akun login tidak ikut terhapus.`}
        confirmText='Hapus'
        destructive
        handleConfirm={() => {
          const id = hapus!.id
          setHapus(null)
          aksi.mutate(() => api.delete(`/guru/${id}`))
        }}
      />
    </PageShell>
  )
}


