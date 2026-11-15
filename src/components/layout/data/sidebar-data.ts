import {
  BarChart3,
  Database,
  BookOpen,
  Building2,
  CalendarClock,
  Megaphone,
  Scale,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Palette,
  PiggyBank,
  School,
  UserCog,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { type Peran } from '@/lib/api'
import { type NavGroup } from '../types'

// Menu mengikuti peran. Ini hanya tampilan; akses sebenarnya dijaga API.
// Modul lain (Hafalan, Pengumuman, KBM, Laporan, ...) ditambahkan di sini
// seiring modulnya selesai.
export function navGroupsFor(peran: Peran): NavGroup[] {
  const pimpinan = peran === 'pimpinan'

  const utama: NavGroup = {
    title: 'Utama',
    items: [
      { title: 'Beranda', url: '/', icon: LayoutDashboard },
      { title: 'Santri', url: '/santri', icon: GraduationCap },
      { title: 'Kelas', url: '/kelas', icon: School },
      { title: 'Absensi', url: '/absensi', icon: ClipboardCheck },
      { title: 'Penilaian dan Rapor', url: '/nilai', icon: FileText },
      { title: 'Hafalan dan Iqra', url: '/hafalan', icon: BookOpen },
      { title: 'KBM', url: '/kbm', icon: CalendarClock },
      { title: 'Pengumuman', url: '/pengumuman', icon: Megaphone },
      { title: 'Laporan', url: '/laporan', icon: BarChart3 },
      ...(pimpinan ? [{ title: 'Guru', url: '/guru', icon: UserRoundCheck }] : []),
    ],
  }
  // Guru tidak melihat keuangan (sama seperti v22); API juga menolaknya.
  const keuangan: NavGroup = {
    title: 'Keuangan',
    items: [
      { title: 'Keuangan dan SPP', url: '/keuangan', icon: Wallet },
      { title: 'Tabungan', url: '/tabungan', icon: PiggyBank },
      { title: 'RAPBM', url: '/rapbm', icon: Scale },
    ],
  }
  const pengaturan: NavGroup = {
    title: 'Pengaturan',
    items: [
      ...(pimpinan
        ? [
            { title: 'Identitas dan Tarif', url: '/identitas', icon: Building2 },
            { title: 'Kelola pengguna', url: '/pengguna', icon: Users },
            { title: 'Data dan Backup', url: '/data', icon: Database },
          ]
        : []),
      { title: 'Tampilan', url: '/settings/appearance', icon: Palette },
      { title: 'Preferensi layar', url: '/settings/display', icon: UserCog },
    ],
  }
  return pimpinan ? [utama, keuangan, pengaturan] : [utama, pengaturan]
}



