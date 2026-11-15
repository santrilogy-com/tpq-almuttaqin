import { LayoutDashboard, Palette, UserCog, Users } from 'lucide-react'
import { type Peran } from '@/lib/api'
import { type NavGroup } from '../types'

// Menu mengikuti peran. Ini hanya tampilan; akses sebenarnya dijaga API.
// Modul lain (Santri, Absensi, Nilai, Keuangan, ...) ditambahkan di sini
// seiring modulnya selesai.
export function navGroupsFor(peran: Peran): NavGroup[] {
  const umum: NavGroup = {
    title: 'Utama',
    items: [{ title: 'Beranda', url: '/', icon: LayoutDashboard }],
  }
  const pengaturan: NavGroup = {
    title: 'Pengaturan',
    items: [
      ...(peran === 'pimpinan'
        ? [{ title: 'Kelola pengguna', url: '/pengguna', icon: Users }]
        : []),
      { title: 'Tampilan', url: '/settings/appearance', icon: Palette },
      { title: 'Preferensi layar', url: '/settings/display', icon: UserCog },
    ],
  }
  return [umum, pengaturan]
}
