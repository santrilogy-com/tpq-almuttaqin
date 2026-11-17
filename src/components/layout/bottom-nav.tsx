import { Link, useLocation } from '@tanstack/react-router'
import {
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useSidebar } from '@/components/ui/sidebar'

type Item = { judul: string; url: string; ikon: React.ElementType }

/**
 * Navigasi bawah untuk layar sempit (di bawah md). Empat tujuan utama menurut peran,
 * dan "Lainnya" membuka menu lengkap. Di layar lebar sidebar biasa yang dipakai.
 */
export function BottomNav() {
  const peran = useAuthStore((s) => s.auth.user?.peran)
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  if (!peran) return null

  const item: Item[] = [
    { judul: 'Beranda', url: '/', ikon: LayoutDashboard },
    { judul: 'Santri', url: '/santri', ikon: GraduationCap },
    { judul: 'Absensi', url: '/absensi', ikon: ClipboardCheck },
    peran === 'pimpinan'
      ? { judul: 'Keuangan', url: '/keuangan', ikon: Wallet }
      : { judul: 'Nilai', url: '/nilai', ikon: FileText },
  ]
  const aktif = (url: string) => (url === '/' ? pathname === '/' : pathname.startsWith(url))
  const lainnyaAktif = !item.some((i) => aktif(i.url))

  const gaya = (on: boolean) =>
    cn(
      'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors',
      on ? 'text-primary' : 'text-muted-foreground'
    )

  return (
    <nav
      aria-label='Navigasi utama'
      className='fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden'
    >
      {item.map((i) => (
        <Link key={i.url} to={i.url} className={gaya(aktif(i.url))} aria-current={aktif(i.url) ? 'page' : undefined}>
          <i.ikon className='size-5' />
          {i.judul}
        </Link>
      ))}
      <button type='button' className={gaya(lainnyaAktif)} onClick={() => setOpenMobile(true)}>
        <Menu className='size-5' />
        Lainnya
      </button>
    </nav>
  )
}
