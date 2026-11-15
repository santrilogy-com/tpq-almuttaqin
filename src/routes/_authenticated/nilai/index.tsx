import { createFileRoute } from '@tanstack/react-router'
import { NilaiPage } from '@/features/nilai'

export const Route = createFileRoute('/_authenticated/nilai/')({
  component: NilaiPage,
})
