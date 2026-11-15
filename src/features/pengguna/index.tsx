import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Trash2, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { api, pesanGalat, type Peran } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type Row = {
  id: string
  username: string
  nama: string
  peran: Peran
  aktif: boolean
  wajibGantiSandi: boolean
}

const KEY = ['users']

export function Pengguna() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.auth.user)
  const [tambah, setTambah] = useState(false)
  const [reset, setReset] = useState<Row | null>(null)
  const [hapus, setHapus] = useState<Row | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<{ users: Row[] }>('/users')).data.users,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: KEY })
  const aksi = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              Kelola pengguna
            </h1>
            <p className='text-muted-foreground'>
              Akun yang bisa masuk ke aplikasi. Pengguna baru wajib mengganti
              kata sandi saat masuk pertama.
            </p>
          </div>
          <Button onClick={() => setTambah(true)}>
            <Plus /> Tambah pengguna
          </Button>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='text-end'>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className='h-16 text-center'>
                    Memuat...
                  </TableCell>
                </TableRow>
              )}
              {data?.map((u) => {
                const diri = u.id === me?.id
                return (
                  <TableRow key={u.id}>
                    <TableCell className='font-medium'>
                      {u.nama} {diri && <Badge variant='outline'>Anda</Badge>}
                    </TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>
                      {u.peran === 'pimpinan' ? 'Pimpinan' : 'Guru'}
                    </TableCell>
                    <TableCell className='space-x-1'>
                      <Badge variant={u.aktif ? 'default' : 'secondary'}>
                        {u.aktif ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      {u.wajibGantiSandi && (
                        <Badge variant='outline'>Belum ganti sandi</Badge>
                      )}
                    </TableCell>
                    <TableCell className='space-x-1 text-end'>
                      <Button
                        size='icon'
                        variant='ghost'
                        title='Reset kata sandi'
                        onClick={() => setReset(u)}
                      >
                        <KeyRound />
                      </Button>
                      <Button
                        size='icon'
                        variant='ghost'
                        disabled={diri}
                        title={u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        onClick={() =>
                          aksi.mutate(() =>
                            api.patch(`/users/${u.id}`, { aktif: !u.aktif })
                          )
                        }
                      >
                        {u.aktif ? <UserX /> : <UserCheck />}
                      </Button>
                      <Button
                        size='icon'
                        variant='ghost'
                        disabled={diri}
                        title='Hapus'
                        onClick={() => setHapus(u)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Main>

      <FormTambah
        open={tambah}
        onOpenChange={setTambah}
        onDone={() => {
          setTambah(false)
          refresh()
        }}
      />
      {reset && (
        <FormReset
          user={reset}
          onClose={() => setReset(null)}
          onDone={() => {
            setReset(null)
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={!!hapus}
        onOpenChange={(o) => !o && setHapus(null)}
        title='Hapus pengguna'
        desc={`Hapus akun ${hapus?.nama} (${hapus?.username}) secara permanen?`}
        confirmText='Hapus'
        destructive
        handleConfirm={() => {
          const id = hapus!.id
          setHapus(null)
          aksi.mutate(() => api.delete(`/users/${id}`))
        }}
      />
    </>
  )
}

function FormTambah(props: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [v, setV] = useState({
    username: '',
    nama: '',
    peran: 'guru' as Peran,
    sandi: '',
  })
  const m = useMutation({
    mutationFn: () => api.post('/users', v),
    onSuccess: () => {
      toast.success('Pengguna ditambahkan')
      setV({ username: '', nama: '', peran: 'guru', sandi: '' })
      props.onDone()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah pengguna</DialogTitle>
          <DialogDescription>
            Kata sandi ini sementara; pengguna wajib menggantinya saat masuk
            pertama.
          </DialogDescription>
        </DialogHeader>
        <form
          className='grid gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            m.mutate()
          }}
        >
          <div className='grid gap-1.5'>
            <Label htmlFor='p-nama'>Nama</Label>
            <Input id='p-nama' value={v.nama} onChange={set('nama')} required />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='p-user'>ID pengguna</Label>
            <Input
              id='p-user'
              value={v.username}
              onChange={set('username')}
              autoCapitalize='none'
              required
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>Peran</Label>
            <Select
              value={v.peran}
              onValueChange={(p) => setV({ ...v, peran: p as Peran })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='guru'>Guru</SelectItem>
                <SelectItem value='pimpinan'>Pimpinan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='p-sandi'>Kata sandi sementara</Label>
            <Input
              id='p-sandi'
              type='text'
              value={v.sandi}
              onChange={set('sandi')}
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button disabled={m.isPending}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FormReset(props: {
  user: Row
  onClose: () => void
  onDone: () => void
}) {
  const [sandi, setSandi] = useState('')
  const m = useMutation({
    mutationFn: () => api.post(`/users/${props.user.id}/reset-sandi`, { sandi }),
    onSuccess: () => {
      toast.success('Kata sandi direset. Pengguna wajib menggantinya.')
      props.onDone()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset kata sandi</DialogTitle>
          <DialogDescription>
            {props.user.nama} ({props.user.username}) akan keluar dari semua
            perangkat dan wajib mengganti kata sandi ini.
          </DialogDescription>
        </DialogHeader>
        <form
          className='grid gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            m.mutate()
          }}
        >
          <div className='grid gap-1.5'>
            <Label htmlFor='r-sandi'>Kata sandi sementara baru</Label>
            <Input
              id='r-sandi'
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button disabled={m.isPending}>Reset</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
