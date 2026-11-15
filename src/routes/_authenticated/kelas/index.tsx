import { createFileRoute } from '@tanstack/react-router'
import { KelasPage } from '@/features/kelas'

export const Route = createFileRoute('/_authenticated/kelas/')({
  component: KelasPage,
})
