/* eslint-disable @typescript-eslint/no-explicit-any */
// Konverter backup v22 (localStorage, `tpq-madin-backup-*.json`) -> format backup v2.
// Murni (tanpa I/O). Baris tak valid DILEWATI dengan peringatan; tidak ada data yang dikarang.
// Akun login (`pengguna`) sengaja tidak dimigrasi: hash v22 tidak kompatibel dan sandi harus
// dibuat ulang lewat Kelola pengguna.
import { type DataBackup, dataKosong, HARI_LIST } from './backup'
import { JILID_LIST, semesterDari, tglValid, type Jenjang } from './domain'

export type HasilKonversi = { data: DataBackup; peringatan: string[]; dilewati: number }

const S = (x: unknown, max = 300) => String(x ?? '').trim().slice(0, max)
const jenjangDari = (x: unknown): Jenjang => (/ibtidaiyah|^mi$/i.test(S(x)) && !/tpq/i.test(S(x)) ? 'MI' : 'TPQ')
const ABSEN: Record<string, 'H' | 'I' | 'S' | 'A'> = { hadir: 'H', izin: 'I', sakit: 'S', alpa: 'A', alpha: 'A' }
const absenDari = (x: unknown) => ABSEN[S(x).toLowerCase()] ?? null
const rupiahBulat = (x: unknown) => {
  const n = Math.round(Number(x))
  return Number.isFinite(n) ? n : NaN
}
const jamOk = (j: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(j)

/** Tanda legacy: objek dengan larik `santri` dan tanpa `format` v2. */
export function apakahV22(x: any): boolean {
  return !!x && typeof x === 'object' && Array.isArray(x.santri) && x.format !== 'tpq-v2'
}

export function konversiV22(lama: any, sekarang: number = Date.now()): HasilKonversi {
  const out = dataKosong()
  const w: string[] = []
  let dilewati = 0
  const lewati = (alasan: string) => {
    dilewati++
    contoh.set(alasan, (contoh.get(alasan) ?? 0) + 1)
  }
  const contoh = new Map<string, number>()
  const hariIni = new Date(sekarang + 7 * 3600_000).toISOString().slice(0, 10)
  // Hanya objek biasa; elemen null/angka/teks/larik di dalam larik diabaikan (data berantakan tidak boleh melempar galat).
  const arr = (k: string): any[] =>
    Array.isArray(lama?.[k]) ? lama[k].filter((x: unknown) => x && typeof x === 'object' && !Array.isArray(x)) : []

  // id unik per tabel (id legacy dipertahankan bila bisa)
  const pakai = new Map<string, Set<string>>()
  const idUnik = (tabel: string, asal: unknown, awalan: string, i: number) => {
    const s = pakai.get(tabel) ?? new Set<string>()
    pakai.set(tabel, s)
    let id = S(asal, 60) || `${awalan}${i + 1}`
    while (s.has(id)) id += '_'
    s.add(id)
    return id
  }

  // ----- lembaga (identitas + tarif)
  const set = lama?.settings ?? {}
  const ident = set.identitas ?? {}
  const rakit = (j: Jenjang): DataBackup['lembaga'][number] => {
    const i = ident[j === 'MI' ? 'Ibtidaiyah' : 'TPQ'] ?? {}
    let logo: string | null = S(i.logo, 1_000_000) || null
    if (logo && (!logo.startsWith('data:image/') || logo.length > 400_000)) {
      w.push(`Logo ${j === 'MI' ? 'Ibtidaiyah' : 'TPQ'} tidak ikut dimigrasi (bukan gambar valid atau lebih dari 400 KB). Unggah ulang nanti.`)
      logo = null
    }
    const thn = Number(i.tahunBerdiri)
    const tarif = Number(set.tarifSpp)
    return {
      jenjang: j,
      nama: S(i.nama || (j === 'TPQ' ? set.namaTpq : ''), 100) || (j === 'TPQ' ? 'TPQ Al-Muttaqin' : 'Madrasah Ibtidaiyah'),
      namaSingkat: S(i.singkat, 20) || (j === 'TPQ' ? 'TPQ' : 'MI'),
      pimpinan: S(i.kepala || (j === 'TPQ' ? set.kepala : ''), 100),
      alamat: S(i.alamat),
      telepon: S(i.telepon, 30),
      tahunBerdiri: Number.isInteger(thn) && thn >= 1800 && thn <= 2200 ? thn : null,
      nsmNpsn: S(i.nsm, 30),
      motto: S(i.motto, 200),
      logo,
      tarifSpp: Number.isFinite(tarif) && tarif >= 0 && tarif <= 100_000_000 ? Math.round(tarif) : 0,
      tahunAjaran: S(set.tahunAjaran, 20),
    }
  }
  out.lembaga = [rakit('TPQ'), rakit('MI')]

  // ----- kelas
  const kelasIdByNama = new Map<string, string>() // "jenjang|nama" dan "nama"
  const kelasSemua = new Set<string>()
  const kelasLegacyKeBaru = new Map<string, string>()
  arr('kelas').forEach((k, i) => {
    const nama = S(k.nama, 100)
    if (!nama) return lewati('kelas tanpa nama')
    const id = idUnik('kelas', k.id, 'kelas', i)
    const jenjang = jenjangDari(k.jenjang)
    out.kelas.push({ id, nama, jenjang, pengajar: S(k.ustadz, 100), jadwal: S(k.jadwal, 100), ruang: S(k.ruang, 100) })
    kelasIdByNama.set(`${jenjang}|${nama.toLowerCase()}`, id)
    if (!kelasIdByNama.has(nama.toLowerCase())) kelasIdByNama.set(nama.toLowerCase(), id)
    kelasSemua.add(id)
    kelasLegacyKeBaru.set(S(k.id), id)
  })
  const cariKelas = (nama: unknown, jenjang?: Jenjang) => {
    const n = S(nama).toLowerCase()
    if (!n) return null
    return (jenjang && kelasIdByNama.get(`${jenjang}|${n}`)) || kelasIdByNama.get(n) || null
  }

  // ----- santri
  const santriIdLegacy = new Map<string, string>()
  const nisPakai = new Set<string>()
  const tanpaKelas: string[] = []
  const tanpaJk: string[] = []
  arr('santri').forEach((s, i) => {
    const nama = S(s.nama, 100)
    const nis = S(s.nis, 30)
    if (!nama || !nis) return lewati('santri tanpa nama/NIS')
    if (nisPakai.has(nis)) return lewati('santri dengan NIS kembar')
    nisPakai.add(nis)
    const id = idUnik('santri', s.id, 'santri', i)
    const jenjang = jenjangDari(s.jenjang)
    const kelasId = cariKelas(s.kelas, jenjang)
    if (!kelasId && S(s.kelas)) tanpaKelas.push(nama)
    let jk = S(s.jk).toUpperCase()
    if (jk !== 'L' && jk !== 'P') {
      tanpaJk.push(nama)
      jk = 'L'
    }
    const jilid = (JILID_LIST as readonly string[]).includes(S(s.jilid)) ? S(s.jilid) : 'Iqra 1'
    const status = S(s.status).toLowerCase()
    out.santri.push({
      id,
      nis,
      nama,
      jenisKelamin: jk as 'L' | 'P',
      jenjang,
      kelasId,
      jilid,
      angkatan: S(s.angkatan, 20),
      rombel: S(s.rombel, 30),
      status: status === 'keluar' ? 'keluar' : status === 'lulus' ? 'lulus' : 'aktif',
      wali: S(s.wali, 100),
      hpWali: S(s.hpWali, 30),
      alamat: S(s.alamat),
      createdAt: sekarang,
    })
    santriIdLegacy.set(S(s.id), id)
  })
  if (tanpaKelas.length) w.push(`${tanpaKelas.length} santri menyebut kelas yang tidak ada di daftar kelas; kelasnya dikosongkan (mis. ${tanpaKelas.slice(0, 3).join(', ')}).`)
  if (tanpaJk.length) w.push(`${tanpaJk.length} santri tanpa jenis kelamin L/P diisi sementara L. Periksa dan koreksi (mis. ${tanpaJk.slice(0, 3).join(', ')}).`)
  const santriBaru = (x: unknown) => santriIdLegacy.get(S(x)) ?? null
  const santriById = new Map(out.santri.map((s) => [s.id, s]))

  // ----- guru
  const guruByNama = new Map<string, string>()
  const guruLegacyKeBaru = new Map<string, string>()
  let guruDwiJenjang = 0
  arr('guru').forEach((g, i) => {
    const nama = S(g.nama, 100)
    if (!nama) return lewati('guru tanpa nama')
    if (guruByNama.has(nama.toLowerCase())) return lewati('guru dengan nama kembar')
    const id = idUnik('guru', g.id, 'guru', i)
    if (/tpq/i.test(S(g.jenjang)) && /ibtidaiyah/i.test(S(g.jenjang))) guruDwiJenjang++
    const honor = rupiahBulat(g.honor)
    out.guru.push({
      id,
      nama,
      peranGuru: (['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru'] as const).find((p) => p === S(g.peran)) ?? 'Guru',
      kelasId: cariKelas(g.kelas),
      jenjang: jenjangDari(g.jenjang),
      hp: S(g.hp, 30),
      honor: Number.isFinite(honor) && honor >= 0 ? honor : 0,
      honorLunas: S(g.honorStatus).toLowerCase() === 'lunas',
    })
    guruByNama.set(nama.toLowerCase(), id)
    guruLegacyKeBaru.set(S(g.id), id)
  })
  if (guruDwiJenjang) w.push(`${guruDwiJenjang} guru mengajar "TPQ dan Ibtidaiyah"; v2 menyimpan satu jenjang per guru, jadi dicatat sebagai TPQ.`)
  const guruBaru = (x: unknown) => guruLegacyKeBaru.get(S(x)) ?? null

  // ----- pertemuan + absensi (anggota kelas saja: menutup bug absensi lintas-kelas v22)
  const kunciPert = new Map<string, string>()
  let lintasKelas = 0
  arr('pertemuan').forEach((p, i) => {
    const kelasId = kelasLegacyKeBaru.get(S(p.kelasId))
    const tanggal = S(p.tanggal)
    if (!kelasId || !tglValid(tanggal)) return lewati('pertemuan tanpa kelas/tanggal valid')
    const kunci = `${kelasId}|${tanggal}`
    let pid = kunciPert.get(kunci)
    if (!pid) {
      pid = idUnik('pertemuan', p.id, 'pertemuan', i)
      kunciPert.set(kunci, pid)
      out.pertemuan.push({ id: pid, kelasId, tanggal, materi: S(p.materi, 200) })
    }
    for (const [sidLama, st] of Object.entries(p.absensi ?? {})) {
      const sid = santriBaru(sidLama)
      const status = absenDari(st)
      if (!sid || !status) {
        lewati('catatan absensi tanpa santri/status valid')
        continue
      }
      if (santriById.get(sid)?.kelasId !== kelasId) {
        lintasKelas++
        continue
      }
      if (!out.absensi.some((a) => a.pertemuanId === pid && a.santriId === sid)) out.absensi.push({ pertemuanId: pid, santriId: sid, status })
    }
  })
  if (lintasKelas) w.push(`${lintasKelas} catatan absensi dibuang karena santrinya bukan anggota kelas pertemuan itu (absensi lintas-kelas).`)

  // ----- nilai
  arr('nilai').forEach((n, i) => {
    const sid = santriBaru(n.santriId)
    const nilai = Number(n.nilai)
    const tanggal = S(n.tanggal)
    const jenis = (['Harian', 'Imda', 'Praktek'] as const).find((j) => j === S(n.jenis))
    if (!sid || !jenis || !Number.isFinite(nilai) || nilai < 0 || nilai > 100 || !tglValid(tanggal)) return lewati('nilai tidak valid')
    out.nilai.push({ id: idUnik('nilai', n.id, 'nilai', i), santriId: sid, jenis, mapel: S(n.mapel, 100) || 'Umum', nilai, tanggal, semester: semesterDari(tanggal) })
  })

  // ----- setoran (hafalanLog)
  arr('hafalanLog').forEach((h, i) => {
    const sid = santriBaru(h.santriId)
    const jenis = (['Iqra', 'Hafalan'] as const).find((j) => j === S(h.jenis))
    const nilai = (['Lancar', 'Cukup', 'Perlu Bimbingan'] as const).find((j) => j === S(h.nilai))
    const tanggal = S(h.tanggal)
    if (!sid || !jenis || !nilai || !S(h.materi) || !tglValid(tanggal)) return lewati('setoran tidak valid')
    out.setoran.push({ id: idUnik('setoran', h.id, 'setoran', i), santriId: sid, jenis, materi: S(h.materi, 200), nilai, tanggal })
  })

  // ----- tabungan: riwayat + saldo pembuka agar saldo v2 = saldo tercatat v22
  const bersih = new Map<string, number>()
  const tertua = new Map<string, string>()
  arr('tabunganTx').forEach((t, i) => {
    const sid = santriBaru(t.santriId)
    const jenis = S(t.jenis).toLowerCase() === 'setor' ? 'setor' : S(t.jenis).toLowerCase() === 'tarik' ? 'tarik' : null
    const jumlah = rupiahBulat(t.jumlah)
    const tanggal = S(t.tanggal)
    if (!sid || !jenis || !(jumlah > 0) || !tglValid(tanggal)) return lewati('transaksi tabungan tidak valid')
    out.tabungan.push({ id: idUnik('tabungan', t.id, 'tab', i), santriId: sid, jenis, jumlah, tanggal, catatan: S(t.catatan, 200) })
    bersih.set(sid, (bersih.get(sid) ?? 0) + (jenis === 'setor' ? jumlah : -jumlah))
    if (!tertua.has(sid) || tanggal < tertua.get(sid)!) tertua.set(sid, tanggal)
  })
  let selisihBesar = 0
  arr('santri').forEach((s) => {
    const sid = santriBaru(s.id)
    if (!sid) return
    const saldo = rupiahBulat(s.tabungan)
    if (!Number.isFinite(saldo) || saldo < 0) return
    const net = bersih.get(sid) ?? 0
    if (saldo > net) {
      out.tabungan.push({ id: idUnik('tabungan', '', 'saldoawal-', out.tabungan.length), santriId: sid, jenis: 'setor', jumlah: saldo - net, tanggal: tertua.get(sid) ?? hariIni, catatan: 'Saldo awal (migrasi dari v22)' })
      bersih.set(sid, saldo)
    } else if (saldo < net) {
      // Yang dilihat pengguna di v22 adalah saldo tersimpan; pertahankan lewat penarikan penyesuaian.
      out.tabungan.push({ id: idUnik('tabungan', '', 'penyesuaian-', out.tabungan.length), santriId: sid, jenis: 'tarik', jumlah: net - saldo, tanggal: hariIni, catatan: 'Penyesuaian saldo (migrasi dari v22)' })
      bersih.set(sid, saldo)
      selisihBesar++
    }
  })
  if (selisihBesar) w.push(`${selisihBesar} santri: riwayat tabungan lebih besar dari saldo tercatat di v22. Saldo v22 dipertahankan lewat satu transaksi "Penyesuaian saldo"; periksa di menu Tabungan.`)

  // ----- keuangan
  arr('keuanganTx').forEach((t, i) => {
    const jenis = S(t.jenis).toLowerCase() === 'masuk' ? 'masuk' : S(t.jenis).toLowerCase() === 'keluar' ? 'keluar' : null
    const jumlah = rupiahBulat(t.jumlah)
    const tanggal = S(t.tanggal)
    if (!jenis || !(jumlah > 0) || !tglValid(tanggal) || !S(t.nama)) return lewati('transaksi kas tidak valid')
    out.transaksi.push({ id: idUnik('transaksi', t.id, 'kas', i), jenis, jenjang: jenjangDari(t.jenjang), kategori: S(t.kategori, 100) || 'Lainnya', nama: S(t.nama, 200), jumlah, tanggal, catatan: S(t.catatan, 300), tagihanSppId: null })
  })

  // ----- SPP bulan berjalan dari status per-santri v22 (tanpa membuat kas: kas v22 sudah punya catatannya)
  const tarif = out.lembaga[0].tarifSpp
  const periode = hariIni.slice(0, 7)
  if (tarif > 0) {
    let n = 0
    arr('santri').forEach((s, i) => {
      const sid = santriBaru(s.id)
      if (!sid || santriById.get(sid)?.status !== 'aktif') return
      const st = S(s.sppStatus).toLowerCase()
      out.tagihanSpp.push({ id: idUnik('tagihanSpp', '', 'spp-', i), santriId: sid, periode, jumlah: out.lembaga.find((l) => l.jenjang === santriById.get(sid)!.jenjang)!.tarifSpp || tarif, status: st === 'lunas' ? 'lunas' : st === 'telat' ? 'telat' : 'belum' })
      n++
    })
    if (n) w.push(`Status SPP ${n} santri dijadikan tagihan ${periode}. Yang berstatus Lunas TIDAK membuat transaksi kas baru (kas v22 sudah berisi catatannya).`)
  } else w.push('Tarif SPP di v22 kosong/0; tagihan SPP tidak dibuat. Atur tarif di Identitas dan Tarif lalu buat tagihan.')

  // ----- pengumuman
  arr('pengumuman').forEach((p, i) => {
    if (!S(p.judul) || !S(p.isi)) return lewati('pengumuman kosong')
    const ms = Date.parse(S(p.tanggal))
    out.pengumuman.push({ id: idUnik('pengumuman', p.id, 'umum', i), judul: S(p.judul, 150), isi: S(p.isi, 2000), tampil: p.aktif !== false, createdAt: Number.isFinite(ms) ? ms : sekarang })
  })

  // ----- KBM
  arr('alokasiWaktu').forEach((a, i) => {
    const jam = rupiahBulat(a.jamPerMinggu)
    if (!S(a.mapel) || !(jam >= 1 && jam <= 60)) return lewati('alokasi waktu tidak valid')
    out.alokasiWaktu.push({ id: idUnik('alokasiWaktu', a.id, 'alo', i), kelasId: cariKelas(a.kelas), mapel: S(a.mapel, 100), jamPerMinggu: jam, hari: S(a.hari, 60) })
  })
  arr('jadwalKbm').forEach((j, i) => {
    const hari = HARI_LIST.find((h) => h === S(j.hari))
    if (!hari || !jamOk(S(j.jamMulai)) || !jamOk(S(j.jamSelesai)) || S(j.jamSelesai) <= S(j.jamMulai) || !S(j.mapel)) return lewati('jadwal KBM tidak valid')
    out.jadwalKbm.push({ id: idUnik('jadwalKbm', j.id, 'jdw', i), kelasId: cariKelas(j.kelas), hari, jamMulai: S(j.jamMulai), jamSelesai: S(j.jamSelesai), mapel: S(j.mapel, 100), guruId: guruByNama.get(S(j.guru).toLowerCase()) ?? null })
  })
  arr('jadwalPiket').forEach((p, i) => {
    const hari = HARI_LIST.find((h) => h === S(p.hari))
    const gid = guruBaru(p.guruId)
    if (!hari || !gid) return lewati('piket tidak valid')
    out.piket.push({ id: idUnik('piket', p.id, 'pkt', i), guruId: gid, hari, keterangan: S(p.keterangan, 200) })
  })
  const kunciAg = new Set<string>()
  arr('absensiGuru').forEach((a) => {
    const gid = guruBaru(a.guruId)
    const status = absenDari(a.status)
    const tanggal = S(a.tanggal)
    const kelompok = S(a.kelompok) === 'Pimpinan' ? 'Pimpinan' : 'Guru'
    const kunci = `${tanggal}|${gid}|${kelompok}`
    if (!gid || !status || !tglValid(tanggal) || kunciAg.has(kunci)) return lewati('absensi guru tidak valid/kembar')
    kunciAg.add(kunci)
    out.absensiGuru.push({ tanggal, guruId: gid, status, kelompok })
  })

  // ----- anggaran
  arr('rapbm').forEach((r, i) => {
    const jenis = S(r.jenis).toLowerCase() === 'masuk' ? 'masuk' : S(r.jenis).toLowerCase() === 'keluar' ? 'keluar' : null
    const rencana = rupiahBulat(r.rencana)
    if (!S(r.pos) || !jenis || !(rencana >= 0)) return lewati('pos RAPBM tidak valid')
    out.rapbm.push({ id: idUnik('rapbm', r.id, 'rap', i), pos: S(r.pos, 100), jenis, jenjang: jenjangDari(r.jenjang), rencana })
  })
  arr('biaya').forEach((b, i) => {
    const jumlah = rupiahBulat(b.jumlah)
    if (!S(b.nama) || !(jumlah >= 0)) return lewati('biaya tidak valid')
    out.biaya.push({ id: idUnik('biaya', b.id, 'biaya', i), nama: S(b.nama, 100), jumlah, keterangan: S(b.keterangan, 200) })
  })
  arr('target').forEach((t, i) => {
    const target = rupiahBulat(t.target)
    const kumpul = rupiahBulat(t.terkumpul)
    if (!S(t.nama) || !(target > 0)) return lewati('target menabung tidak valid')
    out.targetTabungan.push({ id: idUnik('targetTabungan', t.id, 'tgt', i), nama: S(t.nama, 100), target, terkumpul: kumpul >= 0 ? kumpul : 0 })
  })

  for (const [alasan, n] of contoh) w.push(`Dilewati ${n}: ${alasan}.`)
  if (arr('pengguna').length) w.push(`${arr('pengguna').length} akun login v22 TIDAK dimigrasi (sandi dari v22 tidak kompatibel). Buat ulang di Kelola pengguna.`)
  return { data: out, peringatan: w, dilewati }
}
