import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/** Pita peringatan saat perangkat offline: aplikasi menyimpan data di server, jadi perubahan tidak bisa disimpan. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div role='status' className='fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-sm font-medium text-white'>
      <WifiOff className='size-4' />
      Tidak ada koneksi internet. Perubahan tidak dapat disimpan sampai tersambung kembali.
    </div>
  )
}
