import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProfil, type Profil } from '@/stores/profil-store'

export function ProfilFilter() {
  const { profil, setProfil } = useProfil()
  return (
    <Tabs value={profil} onValueChange={(v) => setProfil(v as Profil)}>
      <TabsList>
        <TabsTrigger value='semua'>Semua</TabsTrigger>
        <TabsTrigger value='TPQ'>TPQ</TabsTrigger>
        <TabsTrigger value='MI'>Ibtidaiyah</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
