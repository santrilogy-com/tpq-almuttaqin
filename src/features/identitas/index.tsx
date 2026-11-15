import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { keRupiah } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { rupiah, useLembaga } from '@/lib/queries'
import { type Lembaga } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/field'
import { PageShell } from '@/components/page-shell'

export function IdentitasPage() {
  const { data } = useLembaga()
  return (
    <PageShell
      title='Identitas dan Tarif'
      description='Nama lembaga, kepala, alamat, serta tarif SPP per bulan untuk TPQ dan Ibtidaiyah.'
    >
      <div className='grid gap-4 lg:grid-cols-2'>
        {(data ?? []).map((l) => (
          <Kartu key={l.jenjang} awal={l} />
        ))}
      </div>
    </PageShell>
  )
}

function Kartu({ awal }: { awal: Lembaga }) {
  const qc = useQueryClient()
  const [v, setV] = useState({
    nama: awal.nama,
    namaSingkat: awal.namaSingkat,
    pimpinan: awal.pimpinan,
    alamat: awal.alamat,
    telepon: awal.telepon,
    tahunBerdiri: awal.tahunBerdiri ? String(awal.tahunBerdiri) : '',
    nsmNpsn: awal.nsmNpsn,
    motto: awal.motto,
    tarifSpp: String(awal.tarifSpp),
    tahunAjaran: awal.tahunAjaran,
  })
  const tarif = v.tarifSpp.trim() === '0' || v.tarifSpp.trim() === '' ? 0 : keRupiah(v.tarifSpp)
  const tahun = v.tahunBerdiri.trim() === '' ? null : Number(v.tahunBerdiri)
  const tahunOk = tahun === null || (Number.isInteger(tahun) && tahun >= 1800 && tahun <= 2200)

  const simpan = useMutation({
    mutationFn: () =>
      api.patch(`/lembaga/${awal.jenjang}`, {
        ...v,
        tahunBerdiri: tahun,
        tarifSpp: tarif,
      }),
    onSuccess: () => {
      toast.success(`Identitas ${awal.namaSingkat} disimpan`)
      qc.invalidateQueries({ queryKey: ['lembaga'] })
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })
  const teks = (k: keyof typeof v) => ({
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{awal.jenjang === 'MI' ? 'Ibtidaiyah' : 'TPQ'}</CardTitle>
        <CardDescription>Tarif SPP saat ini {rupiah(awal.tarifSpp)} per bulan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className='grid gap-3 sm:grid-cols-2'
          onSubmit={(e) => {
            e.preventDefault()
            simpan.mutate()
          }}
        >
          <Field label='Nama lembaga *' htmlFor={`i-nama-${awal.jenjang}`}>
            <Input id={`i-nama-${awal.jenjang}`} required {...teks('nama')} />
          </Field>
          <Field label='Nama singkat *' htmlFor={`i-sing-${awal.jenjang}`}>
            <Input id={`i-sing-${awal.jenjang}`} required {...teks('namaSingkat')} />
          </Field>
          <Field label='Kepala / Pimpinan' htmlFor={`i-pim-${awal.jenjang}`}>
            <Input id={`i-pim-${awal.jenjang}`} {...teks('pimpinan')} />
          </Field>
          <Field label='Telepon / HP' htmlFor={`i-tel-${awal.jenjang}`}>
            <Input id={`i-tel-${awal.jenjang}`} inputMode='tel' {...teks('telepon')} />
          </Field>
          <div className='sm:col-span-2'>
            <Field label='Alamat' htmlFor={`i-alm-${awal.jenjang}`}>
              <Input id={`i-alm-${awal.jenjang}`} {...teks('alamat')} />
            </Field>
          </div>
          <Field label='Tahun berdiri' htmlFor={`i-thn-${awal.jenjang}`}>
            <Input id={`i-thn-${awal.jenjang}`} inputMode='numeric' {...teks('tahunBerdiri')} />
          </Field>
          <Field label='NSM / NPSN' htmlFor={`i-nsm-${awal.jenjang}`}>
            <Input id={`i-nsm-${awal.jenjang}`} {...teks('nsmNpsn')} />
          </Field>
          <Field label='Tarif SPP per bulan (Rp)' htmlFor={`i-tar-${awal.jenjang}`}>
            <Input id={`i-tar-${awal.jenjang}`} inputMode='numeric' {...teks('tarifSpp')} />
          </Field>
          <Field label='Tahun ajaran' htmlFor={`i-ta-${awal.jenjang}`}>
            <Input id={`i-ta-${awal.jenjang}`} placeholder='2026/2027' {...teks('tahunAjaran')} />
          </Field>
          <div className='sm:col-span-2'>
            <Field label='Motto' htmlFor={`i-mot-${awal.jenjang}`}>
              <Input id={`i-mot-${awal.jenjang}`} {...teks('motto')} />
            </Field>
          </div>
          {(tarif === null || !tahunOk) && (
            <p className='text-sm text-destructive sm:col-span-2'>
              {tarif === null
                ? 'Tarif harus bilangan bulat rupiah, mis. 50000 atau 50.000.'
                : 'Tahun berdiri tidak valid.'}
            </p>
          )}
          <div className='sm:col-span-2'>
            <Button disabled={simpan.isPending || tarif === null || !tahunOk}>
              Simpan identitas {awal.namaSingkat}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
