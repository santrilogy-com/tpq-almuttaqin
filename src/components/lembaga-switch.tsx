import { useState } from 'react'
import { type Jenjang } from '@shared/domain'
import { useLembaga } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Logo } from '@/assets/logo'
import { useAuthStore } from '@/stores/auth-store'
import { useGuard } from '@/stores/guard-store'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useProfil, useProfilAktif, type Profil } from '@/stores/profil-store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function Lambang({ logo, className }: { logo?: string | null; className?: string }) {
  return logo ? (
    <img src={logo} alt='' className={cn('size-5 shrink-0 rounded object-contain', className)} />
  ) : (
    <Logo className={cn('size-5 shrink-0', className)} />
  )
}

/**
 * Saklar lembaga global (TPQ / Madrasah / Semua). Mengubah seluruh daftar, ringkasan, dan
 * nilai awal formulir di semua halaman. Guru tidak melihat pilihan "Semua".
 */
export function LembagaSwitch() {
  const { data } = useLembaga()
  const pimpinan = useAuthStore((s) => s.auth.user?.peran) === 'pimpinan'
  const setProfil = useProfil((s) => s.setProfil)
  const aktif = useProfilAktif()
  const kotor = useGuard((s) => s.kotor)
  // Ada isian belum tersimpan (mis. absensi): minta konfirmasi sebelum pindah lembaga.
  const [tunda, setTunda] = useState<Profil | null>(null)
  const info = (j: Jenjang) => data?.find((l) => l.jenjang === j)

  const opsi: { v: Profil; label: string; logo?: string | null }[] = [
    ...(pimpinan ? [{ v: 'semua' as Profil, label: 'Semua lembaga' }] : []),
    { v: 'TPQ', label: info('TPQ')?.nama ?? 'TPQ', logo: info('TPQ')?.logo },
    { v: 'MI', label: info('MI')?.nama ?? 'Madrasah', logo: info('MI')?.logo },
  ]

  const pilih = (v: Profil) => {
    if (v === aktif) return
    if (kotor) setTunda(v)
    else setProfil(v)
  }

  return (
    <>
    <Select value={aktif} onValueChange={(v) => pilih(v as Profil)}>
      <SelectTrigger className='h-8 w-44 sm:w-56' aria-label='Pilih lembaga'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align='end'>
        {opsi.map((o) => (
          <SelectItem key={o.v} value={o.v}>
            <span className='flex items-center gap-2'>
              <Lambang logo={o.logo} />
              <span className='truncate'>{o.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <ConfirmDialog
      open={!!tunda}
      onOpenChange={(o) => !o && setTunda(null)}
      title='Buang perubahan?'
      desc='Ada isian yang belum disimpan. Pindah lembaga akan membuangnya.'
      confirmText='Buang dan pindah'
      destructive
      handleConfirm={() => {
        useGuard.getState().setKotor(false)
        if (tunda) setProfil(tunda)
        setTunda(null)
      }}
    />
    </>
  )
}

