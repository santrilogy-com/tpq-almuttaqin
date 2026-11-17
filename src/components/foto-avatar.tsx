import { type JenisFoto, fotoUrl } from '@/lib/foto'
import { useFotoIndex } from '@/lib/queries'
import { cn, inisial } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/** Foto bulat santri/guru; bila belum ada foto tampil inisial nama. */
export function FotoAvatar(props: { jenis: JenisFoto; id: string; nama: string; className?: string }) {
  const { data } = useFotoIndex()
  const v = data?.get(`${props.jenis}:${props.id}`)
  return (
    <Avatar className={cn('size-8', props.className)}>
      {v != null && <AvatarImage src={fotoUrl(props.jenis, props.id, v)} alt={props.nama} className='object-cover' />}
      <AvatarFallback className='text-xs'>{inisial(props.nama)}</AvatarFallback>
    </Avatar>
  )
}

