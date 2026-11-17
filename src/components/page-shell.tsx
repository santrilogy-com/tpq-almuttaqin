import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { LembagaSwitch } from '@/components/lembaga-switch'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useProfilAktif } from '@/stores/profil-store'

/** Kerangka halaman seragam: header atas + judul + tombol aksi. */
export function PageShell(props: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  // Konten dibuat ulang saat lembaga berganti: pilihan, filter, dan nilai awal formulir kembali bersih.
  const profil = useProfilAktif()
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <LembagaSwitch />
        <ThemeSwitch />
        {/* konfigurasi tata letak hanya berguna di layar lebar; di HP membuat header meluber */}
        <div className='max-md:hidden'>
          <ConfigDrawer />
        </div>
        <ProfileDropdown />
      </Header>
      <Main key={profil}>
        <div className='mb-4 flex flex-wrap items-start justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{props.title}</h1>
            {props.description && (
              <p className='text-muted-foreground'>{props.description}</p>
            )}
          </div>
          {props.actions}
        </div>
        {props.children}
      </Main>
    </>
  )
}



