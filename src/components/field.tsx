import { Label } from '@/components/ui/label'

/** Label + kontrol dalam satu blok form; `galat` menampilkan pesan kesalahan di bawah kontrol. */
export function Field(props: {
  label: string
  htmlFor?: string
  galat?: string
  children: React.ReactNode
}) {
  return (
    <div className='grid gap-1.5'>
      <Label htmlFor={props.htmlFor}>{props.label}</Label>
      {props.children}
      {props.galat && (
        <p role='alert' className='text-xs text-destructive'>
          {props.galat}
        </p>
      )}
    </div>
  )
}
