import { createFileRoute } from '@tanstack/react-router'
import { SantriPage } from '@/features/santri'

export const Route = createFileRoute('/_authenticated/santri/')({
  component: SantriPage,
})
