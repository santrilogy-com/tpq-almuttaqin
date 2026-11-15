import { Label } from '@/components/ui/label'

/** Label + kontrol dalam satu blok form. */
export function Field(props: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className='grid gap-1.5'>
      <Label htmlFor={props.htmlFor}>{props.label}</Label>
      {props.children}
    </div>
  )
}
