import { createFileRoute } from '@tanstack/react-router'
import { KbmPage } from '@/features/kbm'

export const Route = createFileRoute('/_authenticated/kbm/')({
  component: KbmPage,
})
