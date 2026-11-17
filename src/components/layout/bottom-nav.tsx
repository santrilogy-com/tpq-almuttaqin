import { useEffect, useState } from 'react'
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

// Elemen yang memunculkan keyboard layar di HP.
const KOLOM_ISIAN =
  'textarea, select, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]):not([type="range"])'

/**
 * Navigasi bawah untuk layar sempit (di bawah md). Empat tujuan utama menurut peran,
 * dan "Lainnya" membuka menu lengkap. Di layar lebar sidebar biasa yang dipakai.
 *
 * Dibuat stabil: tinggi tetap (tidak ikut berubah oleh isi), latar solid (blur di atas elemen fixed
 * bisa berkedip di iOS), dan DISEMBUNYIKAN saat keyboard layar terbuka, karena di HP keyboard
 * mengecilkan viewport sehingga elemen fixed naik dan menutupi kolom yang sedang diisi.
 */
export function BottomNav() {
  const peran = useAuthStore((s) => s.auth.user?.peran)
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const [mengetik, setMengetik] = useState(false)

  useEffect(() => {
    let tunda: number | undefined
    const masuk = (e: FocusEvent) => {
      window.clearTimeout(tunda)
      if (e.target instanceof Element && e.target.matches(KOLOM_ISIAN)) setMengetik(true)
    }
    const keluar = () => {
      // jeda kecil: perpindahan fokus antar kolom tidak boleh membuat navigasi berkedip
      window.clearTimeout(tunda)
      tunda = window.setTimeout(() => {
        const a = document.activeElement
        setMengetik(!!a && a.matches(KOLOM_ISIAN))
      }, 120)
    }
    document.addEventListener('focusin', masuk)
    document.addEventListener('focusout', keluar)
    return () => {
      window.clearTimeout(tunda)
      document.removeEventListener('focusin', masuk)
      document.removeEventListener('focusout', keluar)
    }
  }, [])

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
      'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-none font-medium whitespace-nowrap',
      on ? 'text-primary' : 'text-muted-foreground'
    )

  return (
    <nav
      aria-label='Navigasi utama'
      hidden={mengetik}
      // Tinggi = 3.5rem + area aman; sama dengan ruang yang disisakan di layout (--bottom-nav-h).
      className='fixed inset-x-0 bottom-0 z-40 flex transform-gpu border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden'
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
