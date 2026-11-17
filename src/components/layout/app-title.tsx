import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useLembaga } from '@/lib/queries'
import { useProfilAktif } from '@/stores/profil-store'
import { cn } from '@/lib/utils'
import { Logo } from '@/assets/logo'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '../ui/button'

export function AppTitle() {
  const { setOpenMobile } = useSidebar()
  const aktif = useProfilAktif()
  const semua = useLembaga().data
  // Judul sidebar mengikuti lembaga aktif; pada "Semua" tampil gabungan nama singkat.
  const lembaga = aktif === 'semua' ? undefined : semua?.find((l) => l.jenjang === aktif)
  const nama =
    lembaga?.nama ??
    (semua && semua.length === 2 ? semua.map((l) => l.namaSingkat).join(' & ') : 'Al-Muttaqin')
  const logo = lembaga?.logo ?? null
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='gap-0 py-0 hover:bg-transparent active:bg-transparent'
          asChild
        >
          <div>
            <Link
              to='/'
              onClick={() => setOpenMobile(false)}
              className='flex flex-1 items-center gap-2 text-start text-sm leading-tight'
            >
              {/* logo yang diunggah di Identitas; bila belum ada, lambang aplikasi */}
              {logo ? (
                <img src={logo} alt='' className='size-8 shrink-0 rounded object-contain' />
              ) : (
                <Logo className='size-8 shrink-0' />
              )}
              <span className='grid min-w-0'>
                <span className='truncate font-bold'>{nama}</span>
                <span className='truncate text-xs'>Aplikasi pengelolaan TPQ</span>
              </span>
            </Link>
            <ToggleSidebar />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function ToggleSidebar({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar='trigger'
      data-slot='sidebar-trigger'
      variant='ghost'
      size='icon'
      className={cn('aspect-square size-8 max-md:scale-125', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <X className='md:hidden' />
      <Menu className='max-md:hidden' />
      <span className='sr-only'>Toggle Sidebar</span>
    </Button>
  )
}


