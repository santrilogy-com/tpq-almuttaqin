import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

/** Lambang aplikasi (buku terbuka); sama dengan public/icon.svg. */
export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox='0 0 512 512'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      className={cn('size-6', className)}
      {...props}
    >
      <title>TPQ Al-Muttaqin</title>
      <rect width='512' height='512' rx='112' fill='#047857' />
      <path d='M256 150c-40-28-92-36-136-22v226c44-14 96-6 136 22 40-28 92-36 136-22V128c-44-14-96-6-136 22z' fill='#fff' />
      <path d='M256 150v226' stroke='#047857' strokeWidth='14' />
    </svg>
  )
}
