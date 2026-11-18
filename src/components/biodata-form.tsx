import { cn } from '@/lib/utils'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'

export type Kolom = {
  k: string
  label: string
  jenis?: 'teks' | 'angka' | 'tanggal' | 'tel' | 'email'
  /** Pilihan yang disarankan; tetap boleh mengetik bebas. */
  saran?: readonly string[]
  maks?: number
  penuh?: boolean
  placeholder?: string
}

// Ketikan dibatasi sesuai jenis isian supaya salah ketik tercegah sejak awal (server tetap memvalidasi ulang).
const saring = (jenis: Kolom['jenis'], v: string, maks?: number) => {
  let x = v
  if (jenis === 'angka') x = x.replace(/\D/g, '')
  if (jenis === 'tel') x = x.replace(/[^0-9+\-\s()]/g, '')
  return maks ? x.slice(0, maks) : x
}

/** Susunan kolom dua lajur (satu lajur di HP) untuk satu kelompok isian biodata. */
export function GridKolom(props: {
  kolom: Kolom[]
  nilai: Record<string, string>
  onChange: (k: string, v: string) => void
  galat: Record<string, string>
  prefix: string
}) {
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      {props.kolom.map((c) => {
        const id = `${props.prefix}-${c.k}`
        return (
          <div key={c.k} className={cn(c.penuh && 'sm:col-span-2')}>
            <Field label={c.label} htmlFor={id} galat={props.galat[c.k]}>
              <Input
                id={id}
                type={c.jenis === 'tanggal' ? 'date' : c.jenis === 'email' ? 'email' : 'text'}
                inputMode={c.jenis === 'angka' ? 'numeric' : c.jenis === 'tel' ? 'tel' : undefined}
                autoComplete='off'
                maxLength={c.maks}
                placeholder={c.placeholder}
                list={c.saran ? `${id}-saran` : undefined}
                aria-invalid={!!props.galat[c.k]}
                className={cn(props.galat[c.k] && 'border-destructive')}
                value={props.nilai[c.k] ?? ''}
                onChange={(e) => props.onChange(c.k, saring(c.jenis, e.target.value, c.maks))}
              />
              {c.saran && (
                <datalist id={`${id}-saran`}>
                  {c.saran.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </Field>
          </div>
        )
      })}
    </div>
  )
}
