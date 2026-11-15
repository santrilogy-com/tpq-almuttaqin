import { createFileRoute } from '@tanstack/react-router'
import { LaporanPage } from '@/features/laporan'

export const Route = createFileRoute('/_authenticated/laporan/')({
  component: LaporanPage,
})
