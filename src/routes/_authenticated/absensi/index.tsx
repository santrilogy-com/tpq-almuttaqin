import { createFileRoute } from '@tanstack/react-router'
import { AbsensiPage } from '@/features/absensi'

export const Route = createFileRoute('/_authenticated/absensi/')({
  component: AbsensiPage,
})
