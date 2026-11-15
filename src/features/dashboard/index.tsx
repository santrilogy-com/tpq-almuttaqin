import { useAuthStore } from '@/stores/auth-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export function Dashboard() {
  const user = useAuthStore((s) => s.auth.user)
  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main>
        <h1 className='mb-4 text-2xl font-bold tracking-tight'>
          Assalamu'alaikum, {user?.nama}
        </h1>
        <Card className='max-w-xl'>
          <CardHeader>
            <CardTitle>Fondasi v2 siap</CardTitle>
            <CardDescription>
              Login, peran, dan manajemen pengguna sudah berjalan di server.
              Modul Santri, Absensi, Nilai, dan Keuangan menyusul.
            </CardDescription>
          </CardHeader>
          <CardContent className='text-sm text-muted-foreground'>
            Masuk sebagai {user?.peran === 'pimpinan' ? 'Pimpinan' : 'Guru'}.
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
