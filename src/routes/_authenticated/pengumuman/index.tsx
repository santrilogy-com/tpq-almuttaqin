import { createFileRoute } from '@tanstack/react-router'
import { PengumumanPage } from '@/features/pengumuman'

export const Route = createFileRoute('/_authenticated/pengumuman/')({
  component: PengumumanPage,
})
