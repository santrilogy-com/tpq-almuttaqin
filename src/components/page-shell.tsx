import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

/** Kerangka halaman seragam: header atas + judul + tombol aksi. */
export function PageShell(props: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>
      <Main>
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
