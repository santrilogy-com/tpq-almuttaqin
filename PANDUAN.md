# Panduan Pengguna: TPQ Al-Muttaqin (v2)

## 1. Mulai

1. Buka alamat aplikasi dan masuk dengan ID dan kata sandi dari Pimpinan.
2. Pengguna baru **wajib mengganti kata sandi** pada login pertama (minimal 8 karakter).
3. Lupa kata sandi: minta Pimpinan mereset di **Kelola pengguna** > ikon kunci. Kata sandi sementara itu harus diganti lagi.
4. Setelah 5 kali salah, login dikunci 60 detik.

Aplikasi menyimpan data di server, jadi butuh internet. Saat offline muncul pita kuning dan perubahan tidak tersimpan.

## 2. Peran

| | Pimpinan | Guru |
|---|---|---|
| Santri (lihat, tambah, ubah) | ya | ya (tidak bisa menghapus) |
| Kelas | kelola | lihat |
| Absensi, Nilai, Hafalan | ya | ya (hapus pertemuan hanya Pimpinan) |
| KBM | kelola | lihat |
| Pengumuman | kelola | baca |
| Guru, Keuangan, SPP, Tabungan, RAPBM | ya | tidak |
| Identitas, Pengguna, Data dan Backup, Import | ya | tidak |

Pilihan TPQ / Ibtidaiyah di atas tiap halaman hanya **filter tampilan**, bukan peran.

## 3. Isi data pertama kali

Kartu **Mulai isi data** di Beranda memandu: tambah kelas, guru, dan santri (atau import CSV, lihat bagian 8).
Lalu isi **Identitas dan Tarif**: nama lembaga, kepala, logo, dan tarif SPP per jenjang.

## 4. Kegiatan harian

- **Absensi**: pilih kelas dan tanggal. Semua santri otomatis Hadir; ketuk hanya yang Izin, Sakit, atau Alpa, lalu
  *Simpan pertemuan*. Jika pindah kelas/tanggal sebelum menyimpan, aplikasi menanyakan apakah perubahan dibuang.
  Hanya santri anggota kelas itu yang bisa dicatat.
- **Naik jilid** (di Santri): selalu meminta konfirmasi.
- **Penilaian**: nilai 0 sampai 100 (boleh desimal, mis. 85,5). Semester dihitung otomatis dari tanggal
  (Juli-Desember = Ganjil, Januari-Juni = Genap).
  Nilai akhir = Harian 40% + Imda 30% + Praktek 30%. Jika baru ada sebagian jenis nilai, nilai akhir dihitung dari yang ada
  (bobot disesuaikan) dan ditandai **Sementara**.
- **Rapor murid**: pilih murid dan semester, lalu *Bagikan rapor (teks)*.
- **Hafalan dan Iqra**: catat setoran dengan nilai Lancar / Cukup / Perlu Bimbingan.

## 5. Keuangan (Pimpinan)

- **Kas**: catat pemasukan/pengeluaran. Jumlah boleh `50000` atau `50.000`, tanpa desimal.
- **Tagihan SPP**: tekan *Buat tagihan bulan ini* (tarif dari Identitas dan Tarif). Menandai **Lunas** otomatis menambah
  pemasukan kas kategori SPP; mengembalikan ke Belum/Telat menarik catatan kas itu lagi. Transaksi dari SPP tidak bisa
  dihapus manual; ubah lewat status tagihannya.
- **Tabungan**: Setor/Tarik. Penarikan melebihi saldo ditolak; penarikan di atas Rp200.000 meminta konfirmasi.
- **RAPBM**: nama pos harus sama dengan kategori kas agar realisasinya terhitung. Jenis dan jenjang juga harus cocok.

## 6. Laporan

Beranda menampilkan ringkasan; menu **Laporan** memuat rekap dan tombol **Export CSV** (santri, nilai, absensi, guru,
keuangan, tabungan). File CSV ber-BOM sehingga terbuka benar di Excel.

## 7. Backup dan pindah dari v22

Menu **Data dan Backup**:

- **Cadangkan**: unduh file JSON seluruh data. Akun dan sandi **tidak** ikut tersimpan.
- **Pulihkan**: pilih file backup v2 **atau** file backup v22 (`tpq-madin-backup-*.json`). Pratinjau menampilkan jumlah
  data dan peringatan. Ketik `PULIHKAN` untuk mengganti seluruh data. Jika file bermasalah, ditolak dan data lama tidak berubah.
  Setelah memulihkan dari v22, buat ulang akun login di Kelola pengguna.
- **Hapus semua data**: ketik `HAPUS SEMUA`. Permanen; unduh backup dulu. Akun dan identitas lembaga tetap ada.

## 8. Import CSV

Data > Import CSV: pilih jenis (santri / guru / nilai), unduh **template**, isi, simpan sebagai CSV (koma, titik-koma, atau tab
tidak masalah), lalu pilih file. Baris yang gagal dilewati dan alasannya ditampilkan; baris lain tetap masuk.

- **Santri**: wajib Nama, NIS, Kelas, Jenis Kelamin (L/P/Laki-laki/Perempuan). Jenjang kosong = TPQ. Kelas yang belum ada
  dibuat otomatis. NIS harus unik.
- **Guru**: wajib Nama (unik). Peran kosong = Guru. Honor angka (boleh `800.000`).
- **Nilai**: kolom Santri berisi NIS atau nama (nama kembar harus pakai NIS), Jenis (Harian/Imda/Praktek), Nilai 0 sampai 100.
- Maksimal 1000 baris per import.

## 9. Tanya jawab

**Tidak bisa masuk.** Periksa huruf besar/kecil. Bila terkunci, tunggu 60 detik atau minta Pimpinan mereset sandi.

**Saldo kas tidak cocok dengan SPP.** Pastikan SPP ditandai Lunas lewat tab Tagihan SPP (bukan hanya dicatat manual), karena
hanya cara itu yang otomatis masuk kas tanpa risiko dobel.

**Pindah kelas, apakah absensi lama ikut?** Absensi tetap milik kelas lama; kehadiran di rapor hanya dihitung dari
pertemuan di kelas santri saat ini.

**Grafik kosong.** Tambah kelas, guru, dan santri dulu.
