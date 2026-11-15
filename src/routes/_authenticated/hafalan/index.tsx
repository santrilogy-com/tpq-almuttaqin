import { createFileRoute } from '@tanstack/react-router'
import { HafalanPage } from '@/features/hafalan'

export const Route = createFileRoute('/_authenticated/hafalan/')({
  component: HafalanPage,
})
