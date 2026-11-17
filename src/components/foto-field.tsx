import { useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { type JenisFoto, fotoUrl, kecilkanFoto } from '@/lib/foto'
import { useFotoIndex } from '@/lib/queries'
import { inisial } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

/**
 * Kolom foto di formulir. `nilai`: undefined = tidak diubah, null = dihapus, string = foto baru.
 * Foto sebenarnya diunggah saat formulir disimpan (lihat simpanFoto).
 */
export function FotoField(props: {
  jenis: JenisFoto
  id?: string
  nama: string
  nilai: string | null | undefined
  onChange: (v: string | null | undefined) => void
}) {
  const { data } = useFotoIndex()
  const [sibuk, setSibuk] = useState(false)
  const v = props.id ? data?.get(`${props.jenis}:${props.id}`) : undefined
  const src = props.nilai === undefined ? (v != null && props.id ? fotoUrl(props.jenis, props.id, v) : null) : props.nilai
  const ada = props.nilai !== null && !!src

  const pilih = async (f: File | undefined) => {
    if (!f) return
    setSibuk(true)
    try {
      props.onChange(await kecilkanFoto(f))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membaca gambar')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className='flex items-center gap-3'>
      <Avatar className='size-16'>
        {ada && <AvatarImage src={src!} alt={props.nama} className='object-cover' />}
        <AvatarFallback>{inisial(props.nama || '?')}</AvatarFallback>
      </Avatar>
      <div className='flex flex-wrap gap-2'>
        <Button type='button' variant='outline' size='sm' disabled={sibuk} asChild>
          <label className='cursor-pointer'>
            <Camera /> {ada ? 'Ganti foto' : 'Tambah foto'}
            <input
              type='file'
              accept='image/*'
              className='sr-only'
              onChange={(e) => {
                pilih(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </Button>
        {ada && (
          <Button type='button' variant='ghost' size='sm' onClick={() => props.onChange(null)}>
            <Trash2 /> Hapus
          </Button>
        )}
      </div>
    </div>
  )
}
