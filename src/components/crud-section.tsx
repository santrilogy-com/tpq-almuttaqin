/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { keRupiah } from '@shared/domain'
import { api, pesanGalat } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field as FieldBlock } from '@/components/field'

export type CrudField = {
  key: string
  label: string
  type: 'text' | 'select' | 'rupiah' | 'int' | 'time'
  options?: { value: string; label: string }[]
  /** select: izinkan "(kosong)" yang dikirim sebagai null */
  nullable?: boolean
  required?: boolean
  placeholder?: string
}

export type CrudColumn = { label: string; cell: (row: any) => React.ReactNode; className?: string }

const NONE = '__none__'

/** Tabel + form tambah/ubah/hapus generik untuk endpoint CRUD (`{rows}` / `{row}`). */
export function CrudSection(props: {
  url: string
  queryKey: string
  judul: string
  fields: CrudField[]
  columns: CrudColumn[]
  canEdit: boolean
  /** Query lain yang ikut di-refresh setelah perubahan (mis. 'realita'). */
  juga?: string[]
  filter?: (row: any) => boolean
  kosong?: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<any | 'baru' | null>(null)
  const [hapus, setHapus] = useState<any | null>(null)

  const q = useQuery({
    queryKey: [props.queryKey],
    queryFn: async () => (await api.get<{ rows: any[] }>(props.url)).data.rows,
  })
  const refresh = () => {
    for (const k of [props.queryKey, ...(props.juga ?? [])]) qc.invalidateQueries({ queryKey: [k] })
  }
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`${props.url}/${id}`),
    onSuccess: refresh,
    onError: (e) => toast.error(pesanGalat(e)),
  })

  const rows = (q.data ?? []).filter(props.filter ?? (() => true))
  const cols = props.columns.length + (props.canEdit ? 1 : 0)

  return (
    <div className='space-y-3'>
      {props.canEdit && (
        <Button onClick={() => setForm('baru')}>
          <Plus /> Tambah {props.judul}
        </Button>
      )}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              {props.columns.map((c) => (
                <TableHead key={c.label} className={c.className}>
                  {c.label}
                </TableHead>
              ))}
              {props.canEdit && <TableHead className='text-end'>Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={cols} className='h-14 text-center'>
                  Memuat...
                </TableCell>
              </TableRow>
            )}
            {!q.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={cols} className='h-14 text-center'>
                  {props.kosong ?? `Belum ada ${props.judul}.`}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                {props.columns.map((c) => (
                  <TableCell key={c.label} className={c.className}>
                    {c.cell(r)}
                  </TableCell>
                ))}
                {props.canEdit && (
                  <TableCell className='space-x-1 text-end'>
                    <Button size='icon' variant='ghost' title='Ubah' onClick={() => setForm(r)}>
                      <Pencil />
                    </Button>
                    <Button size='icon' variant='ghost' title='Hapus' onClick={() => setHapus(r)}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {form && (
        <FormDialog
          {...props}
          awal={form === 'baru' ? null : form}
          onClose={() => setForm(null)}
          onDone={() => {
            setForm(null)
            refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={!!hapus}
        onOpenChange={(o) => !o && setHapus(null)}
        title={`Hapus ${props.judul}`}
        desc='Data ini akan dihapus permanen.'
        confirmText='Hapus'
        destructive
        handleConfirm={() => {
          const id = hapus.id
          setHapus(null)
          del.mutate(id)
        }}
      />
    </div>
  )
}

function FormDialog(props: {
  url: string
  judul: string
  fields: CrudField[]
  awal: any | null
  onClose: () => void
  onDone: () => void
}) {
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      props.fields.map((f) => {
        const x = props.awal?.[f.key]
        return [f.key, x == null ? (f.type === 'select' && f.nullable ? NONE : '') : String(x)]
      })
    )
  )

  // String formulir -> nilai JSON sesuai tipe; null bila ada yang tidak valid.
  const susun = (): { data?: Record<string, unknown>; galat?: string } => {
    const data: Record<string, unknown> = {}
    for (const f of props.fields) {
      const s = (v[f.key] ?? '').trim()
      if (f.type === 'select' && f.nullable) data[f.key] = s === NONE || s === '' ? null : s
      else if (f.type === 'rupiah') {
        if (s === '' && !f.required) continue
        const n = s === '0' ? 0 : keRupiah(s)
        if (n === null) return { galat: `${f.label}: harus bilangan bulat rupiah, mis. 50000 atau 50.000` }
        data[f.key] = n
      } else if (f.type === 'int') {
        if (s === '' && !f.required) continue
        const n = Number(s)
        if (!Number.isInteger(n)) return { galat: `${f.label}: harus bilangan bulat` }
        data[f.key] = n
      } else {
        if (s === '' && f.required) return { galat: `${f.label} wajib diisi` }
        data[f.key] = s
      }
    }
    return { data }
  }

  const m = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      props.awal ? api.patch(`${props.url}/${props.awal.id}`, data) : api.post(props.url, data),
    onSuccess: () => {
      toast.success('Tersimpan')
      props.onDone()
    },
    onError: (e) => toast.error(pesanGalat(e)),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {props.awal ? 'Ubah' : 'Tambah'} {props.judul}
          </DialogTitle>
        </DialogHeader>
        <form
          className='grid gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            const { data, galat } = susun()
            if (galat) toast.error(galat)
            else m.mutate(data!)
          }}
        >
          {props.fields.map((f) => (
            <FieldBlock key={f.key} label={f.label + (f.required ? ' *' : '')} htmlFor={`f-${f.key}`}>
              {f.type === 'select' ? (
                <Select value={v[f.key]} onValueChange={(x) => setV({ ...v, [f.key]: x })}>
                  <SelectTrigger id={`f-${f.key}`}>
                    <SelectValue placeholder='Pilih' />
                  </SelectTrigger>
                  <SelectContent>
                    {f.nullable && <SelectItem value={NONE}>(kosong)</SelectItem>}
                    {f.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`f-${f.key}`}
                  type={f.type === 'time' ? 'time' : 'text'}
                  inputMode={f.type === 'rupiah' || f.type === 'int' ? 'numeric' : undefined}
                  placeholder={f.placeholder}
                  value={v[f.key]}
                  onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
                />
              )}
            </FieldBlock>
          ))}
          <DialogFooter>
            <Button disabled={m.isPending}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
