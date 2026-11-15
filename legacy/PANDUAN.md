# Panduan Pengguna: Aplikasi TPQ Al-Muttaqin

Panduan memakai aplikasi TPQ Al-Muttaqin: mengisi data pertama kali, memakai tiap menu, import data, cadangan, dan sinkron. Angka yang disebut sebagai contoh ditandai dengan kata contoh.

## Daftar isi

1. [Mulai cepat](#1-mulai-cepat)
2. [Login dan kata sandi](#2-login-dan-kata-sandi)
3. [Profil aktif dan Identitas Madrasah](#3-profil-aktif-dan-identitas-madrasah)
4. [Cara pakai tiap modul](#4-cara-pakai-tiap-modul)
5. [Isi data massal](#5-isi-data-massal)
6. [Backup dan pulihkan](#6-backup-dan-pulihkan)
7. [Offline dan sinkron](#7-offline-dan-sinkron)
8. [Tanya jawab](#8-tanya-jawab)

## 1. Mulai cepat

Enam langkah pertama supaya aplikasi siap dipakai:

1. Buka tombol "Identitas Madrasah", periksa nama TPQ dan isi nama Ibtidaiyah. Lihat bagian 3.
2. Tambah guru lewat menu Guru, tombol "Tambah guru".
3. Tambah kelas lewat menu Kelas dan Absensi, tombol "Tambah kelas".
4. Tambah santri lewat tombol "Tambah santri" di menu Santri, atau import CSV (lihat bagian 5).
5. Catat saldo awal di menu Keuangan, tombol "Simpan transaksi", lalu susun RAPBM di menu RAPBM.
6. Periksa ringkasan di langkah Selesai wizard, lalu tekan "Buka Dashboard".

Kartu "Mulai isi data" di Beranda memandu langkah yang sama, lengkap dengan centang progres dari data yang sudah tersimpan. Kartu itu hilang sendiri setelah ada santri, guru, dan kelas (ketiganya terisi). Kalau dilewati, kartu hilang tapi bisa dibuka lagi dari Pengaturan, tombol "Buka panduan setup".

## 2. Login dan kata sandi

1. Pilih profil dulu di layar login: kartu TPQ atau Ibtidaiyah.
2. Masuk dengan ID pengguna dan kata sandi. Akun bawaan: ID admin (Pimpinan) dengan kata sandi bawaan admin123, dan ID guru1 (Guru) dengan kata sandi bawaan guru123.
3. Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama.
4. Saat login pertama, aplikasi meminta ganti kata sandi. Kata sandi baru minimal 8 karakter. Sampai diganti, menu lain tidak bisa dibuka.
5. Lupa kata sandi: tekan "Lupa kata sandi?" di layar login, lalu minta Pimpinan mereset lewat Pengaturan, Kelola pengguna, tombol "Reset sandi".
6. Ganti kata sandi sendiri: menu Lainnya atau Pengaturan, tombol "Ubah kata sandi saya". Keluar dari aplikasi: tombol "Keluar".
7. Pimpinan menambah pengguna baru: Pengaturan, Kelola pengguna, isi ID, Nama, Peran, dan Kata sandi, lalu tombol "Tambah pengguna". Pengguna baru juga wajib ganti kata sandi saat login pertama.

## 3. Profil aktif dan Identitas Madrasah

1. Pilih profil TPQ atau Ibtidaiyah di layar login (dua kartu besar), di hero Beranda, atau di Pengaturan, bagian "Profil aktif".
2. Semua angka, daftar, jadwal, dan grafik mengikuti profil yang dipilih. Pimpinan bisa memilih "Semua (ringkasan)" untuk melihat gabungan kedua jenjang. Guru tidak melihat pilihan Semua.
3. Profil hanya filter tampilan, bukan peran. Guru tetap hanya bisa membuka 7 menu: Beranda, Santri, Kelas dan Absensi, Hafalan/Iqra, Penilaian dan Rapor, Pengumuman, dan KBM.
4. Logo dan nama tiap profil diatur di menu "Identitas Madrasah" (tombol "Identitas Madrasah" di wizard langkah 1, di Pengaturan, atau di Menu Lainnya). Dua kartu: TPQ dan Ibtidaiyah. Isi Nama lembaga, Nama singkat, Kepala/Pimpinan, Alamat, Telepon/HP, Tahun berdiri, NSM/NPSN (boleh kosong), dan Motto/tagline. Logo: tekan "Pilih logo", pilih gambar dari galeri atau kamera HP, pratinjau muncul sebelum disimpan, lalu tekan "Simpan identitas TPQ" atau "Simpan identitas Ibtidaiyah". Logo dikecilkan otomatis dan tersimpan di perangkat.
5. Nama Ibtidaiyah masih placeholder: "Madrasah Ibtidaiyah", singkat "MI", sisanya kosong. Klien yang mengisi nama dan logo resminya lewat menu ini. Hanya Pimpinan yang bisa mengubah identitas, Guru hanya bisa melihat.
6. Nama TPQ yang diubah di Identitas Madrasah juga mengubah nama yang tampil di header aplikasi.

## 4. Cara pakai tiap modul

### Santri

1. Cari lewat kolom "Cari nama atau NIS". Saring lewat Kelas, Angkatan, Status, dan Jenjang.
2. Tombol "Tambah santri": isi Nama lengkap, NIS, Jenis kelamin, Jenjang, dan Kelas. Kolom bertanda * wajib diisi. NIS harus unik, tidak boleh sama dengan santri lain.
3. "Detail" melihat data santri, "Ubah" mengubahnya. "Export CSV (yang tampil)" mengunduh daftar yang sedang tampil. "Tampilkan lebih banyak" memuat 10 santri berikutnya.
4. Kelas dan Jilid itu beda: Kelas = rombongan belajar (contoh: Iqra 1, Iqra 2); Jilid = level Iqra santri itu (Jilid 1 sampai Jilid 6, lalu Tahfidz Juz 30, 29, 28). Santri satu kelas bisa beda jilid.

### Guru

1. Tombol "Tambah guru": isi Nama, Kelas, Peran, Jenjang mengajar, HP, dan Honor. Peran: Pimpinan, Wali Kelas, Guru Fan, atau Guru.
2. Arti peran: Pimpinan memimpin dan mengelola aplikasi; Wali Kelas memegang satu kelas; Guru mengajar santri; Guru Fan hanya nama peran di daftar guru, bukan peran login (peran login hanya Pimpinan dan Guru), jadi tidak mengubah hak akses apa pun. Bila ragu memilih peran, tanyakan ke Pimpinan.
3. "Tandai honor Lunas" atau "Tandai honor Belum" mengubah status honor. "Ubah" mengubah data, "Hapus" menghapus guru.
4. "Export CSV guru" mengunduh daftar guru, "Template CSV guru" mengunduh template import.

### Kelas dan Absensi

1. Pilih kelas lewat tab nama kelas.
2. Isi Tanggal pertemuan dan Materi hari ini, ketuk Hadir, Izin, Sakit, atau Alpa untuk tiap santri, lalu "Simpan pertemuan".
3. Semua santri otomatis Hadir; hanya yang Izin, Sakit, atau Alpa yang perlu diketuk.
4. Absensi baru tersimpan setelah tekan "Simpan pertemuan". Sebelum disimpan, pilihan hanya tersimpan sementara: pindah ke kelas lain menghapus pilihan yang belum disimpan, dan muat ulang halaman juga menghapusnya.
5. "Naik Jilid" langsung menaikkan jilid santri satu tingkat tanpa konfirmasi tambahan (contoh: Iqra 2 menjadi Iqra 3). Periksa nama santri sebelum mengetuknya.
6. "Lihat rincian" melihat kehadiran satu pertemuan. "Tambah kelas" menambah kelas baru (Nama kelas, Jenjang, Ustadz/pengajar, Jadwal, Ruang).

### Penilaian dan Rapor

1. Tab "Nilai Harian", "Nilai Imda", "Nilai Praktek": pilih murid lewat "Pilih murid", isi Mapel, Nilai 0 sampai 100, dan Tanggal, lalu "Simpan nilai Harian", "Simpan nilai Imda", atau "Simpan nilai Praktek".
2. Nilai akhir rapor = 40 persen rata-rata Harian + 30 persen rata-rata Imda + 30 persen rata-rata Praktek.
3. Predikat Nilai Akhir: A (Sangat Baik) 90 ke atas, B (Baik) 80 sampai 89, C (Cukup) 70 sampai 79, D (Kurang) 60 sampai 69, E (Perlu Bimbingan) di bawah 60.
4. Bila santri baru punya 1 komponen nilai saja (misalnya hanya Harian), Nilai Akhir tetap dihitung dari komponen yang ada: contoh Harian 70, Nilai Akhir 28 (70 kali 40 persen); komponen yang belum ada dihitung 0.
5. Tab "Rapor Murid": pilih murid lewat "Pilih murid" atau "Ganti murid", pilih semester, lihat Nilai Iqra, Halaman, Kehadiran, dan Nilai Akhir. "Download File" mengunduh rapor, "Bagikan rapor (teks)" membagikannya lewat HP.

### Hafalan / Iqra

1. "Pilih murid", isi Jenis (Iqra atau Hafalan), Materi, dan Nilai (Lancar, Cukup, atau Perlu Bimbingan), lalu "Simpan setoran".
2. Progres tiap santri tampil di bagian "Progres santri", riwayat setoran di bagian "Riwayat setoran".

### Tabungan

1. "Pilih murid", isi Jenis (Setor atau Tarik) dan Jumlah, lalu "Simpan transaksi". Penarikan di atas saldo ditolak. Penarikan di atas Rp200.000 minta konfirmasi.
2. Tulis angka tanpa titik atau koma, contoh: 50000.
3. "Struk" melihat struk santri. "Tambah target" menambah target menabung.

### Keuangan

1. Isi Jenis (Masuk atau Keluar), Jenjang, Kategori, Nama transaksi, Jumlah, dan Tanggal, lalu "Simpan transaksi".
2. Tulis angka tanpa titik atau koma, contoh: 50000.
3. Kategori pemasukan: SPP, Infaq, Donasi, Pendaftaran, Kitab/Seragam, Saldo awal. Kategori pengeluaran: Honor guru, Operasional, ATK, Listrik dan air, Kegiatan.
4. Menandai SPP Lunas TIDAK menambah saldo kas. Uang SPP baru masuk kas bila dicatat sebagai transaksi Masuk lewat tombol "Catat ke kas": buka menu Keuangan, isi form "Tambah transaksi" dengan Jenis Masuk dan Kategori SPP, lalu tekan "Simpan transaksi".
5. Tab Semua, Masuk, dan Keluar menyaring riwayat. "Export CSV keuangan" mengunduh riwayat. Bagian Tagihan SPP: ketuk status Lunas, Belum, atau Telat untuk mengubahnya. "Buka RAPBM dan Keuangan Lanjutan" membuka menu RAPBM.

### RAPBM

RAPBM = Rencana Anggaran Pendapatan dan Belanja Madrasah.

1. Tab RAPBM: "Tambah pos" (Nama pos, Jenis Masuk/Keluar, Jenjang, Rencana).
2. Tab Realita: rencana dibanding realisasi per pos. Tab Set Biaya: "Tambah biaya". Tab Arus Kas: pemasukan dan pengeluaran per bulan. Tab Rekap: ringkasan rencana dan realisasi.

### KBM

KBM = Kegiatan Belajar Mengajar.

1. Tab Alokasi Waktu: "Tambah alokasi". Tab Jadwal KBM: "Tambah jadwal", saring per hari.
2. Tab Jadwal Guru Piket: "Tambah piket". Tab Absensi Guru dan Absensi Pimpinan: pilih tanggal, ketuk Hadir, Izin, Sakit, atau Alpa per orang, lalu "Simpan absensi".

### Kemuridan

1. Tab Murid Kelas, Murid Rombel, Murid Keluar, dan Murid Lulus menampilkan santri menurut kelompoknya.
2. Status santri (Aktif, Keluar, Lulus) diubah dari Detail santri di menu Santri.

### Sahabat Khidmah

1. Daftar guru dikelompokkan menurut peran: Pimpinan, Wali Kelas, Guru Fan, dan Guru.
2. Ubah peran guru lewat menu Guru, tombol "Ubah".

### Pengumuman

1. Isi Judul dan Isi, tekan "Tampilkan pengumuman".
2. Pengumuman yang disimpan tampil di Beranda (bagian Notifikasi) dan bisa dibaca semua pengguna yang masuk.
3. "Tutup" menyembunyikan pengumuman dari Beranda, "Tampilkan lagi" memunculkannya, "Hapus" menghapusnya.

### Laporan

1. Kartu Saldo kas, SPP lunas, Rata-rata kehadiran, dan Total tabungan.
2. Tombol "Export murid", "Export guru", "Export nilai", "Export absensi", dan "Export keuangan" mengunduh CSV. Tabel Rekap per jenjang dan Rekap per kelas menampilkan ringkasan.

### Grafik

1. Grafik Murid per kelas (ketuk batang untuk melihat santri kelas itu), Grafik Murid per angkatan, Grafik Guru per peran, dan Grafik Absensi.
2. Label L dan P berarti Laki-laki dan Perempuan. Label Tapel menunjukkan tahun pelajaran Hijriah.
3. Istilah: Imda adalah salah satu jenis nilai di aplikasi, bersama Harian dan Praktek; tidak ada kepanjangan Imda yang tertulis di aplikasi. Imda ikut dihitung dalam Nilai Akhir dengan bobot 30 persen.

### Pengaturan

1. Profil TPQ: Nama TPQ, Kepala TPQ, Tarif SPP per bulan, Tahun ajaran, Jam masuk. Tekan "Simpan pengaturan".
2. Tampilan: Otomatis, Mode Desktop, atau Mode Mobile. Install aplikasi: pasang di layar utama HP.
3. Google Sheet dan sinkron hybrid, Import data (CSV), Export data (CSV), Cadangkan dan pulihkan, Zona berbahaya. Lihat bagian 5, 6, dan 7.

## 5. Isi data massal

### Template CSV

1. Pengaturan, bagian "Import data (CSV)", tombol "Template" untuk Murid, Guru, atau Nilai.
2. Unduh dulu template-nya, isi di spreadsheet, simpan sebagai CSV, lalu import lewat "Pilih file CSV".
3. Kolom template Murid (contoh): nama, nis, kelas, angkatan, rombel, jenjang, wali, hp wali, alamat, Jenis Kelamin. Kolom wajib: Nama, NIS, Kelas, Jenis Kelamin. Kelas yang belum ada dibuat otomatis dari kolom kelas.
4. Kolom template Guru (contoh): nama, kelas, peran, jenjang, hp, honor.
5. Kolom template Nilai (contoh): santri (nama atau NIS), jenis, mapel, nilai.

### Kenapa baris ditolak

Baris yang gagal dilewati dan dilaporkan di layar hasil import, data yang sudah ada tidak rusak. Alasan yang umum:

1. Nama kosong, NIS kosong, atau NIS sudah ada.
2. Jenjang bukan TPQ atau Ibtidaiyah.
3. Jenis kelamin bukan L, P, "Laki-laki", atau "Perempuan".
4. Guru: nama guru sudah ada, peran bukan Pimpinan, Wali Kelas, Guru Fan, atau Guru, atau honor bukan angka 0 atau lebih.
5. Nilai: santri tidak ditemukan, nama kembar sehingga harus pakai NIS, jenis bukan Harian, Imda, atau Praktek, atau nilai bukan 0 sampai 100.
6. File kosong atau hanya berisi judul kolom.

### Google Sheet

1. Pengaturan, bagian "Google Sheet dan sinkron hybrid". Isi Link Google Sheet dan Nomor sheet (gid, biasanya 0), tekan "Simpan pengaturan Sheet".
2. Untuk tarik murid dari Sheet: di Google Sheet buka File lalu Publish to web, pilih sheet dan format CSV, lalu Publish. Kembali ke aplikasi, tekan "Tarik murid dari Sheet (CSV publish)".
3. Kalau gagal, periksa apakah Sheet sudah di-publish, atau unduh CSV dari Sheet (File, Download, CSV) lalu import lewat "Pilih file CSV".
4. "Tarik data terbaru dari Sheet" memakai Apps Script. Kalau perangkat ini punya perubahan yang belum terkirim, aplikasi memberi peringatan dulu dan tidak menimpa diam-diam.

### Apps Script (opsional)

1. Apps Script menghubungkan aplikasi dengan Google Sheet secara otomatis.
2. Salin kode contoh Apps Script yang disertakan di paket aplikasi, deploy sebagai Web App, lalu tempel URL Web App di Pengaturan, kolom "URL Web App Google Apps Script", dan tekan "Simpan pengaturan Sheet".
3. Token rahasia sinkron (opsional) diisi sama dengan yang diatur di Apps Script supaya sinkron diterima. Aplikasi tidak pernah meminta kata sandi Google atau kredensial lain.

### Kirim data ke Sheet tanpa Apps Script

Unduh CSV lewat "Export data (CSV)", lalu buka Google Sheets baru (tombol "Buka Google Sheets baru") dan upload file itu. Atau salin isi CSV lewat tombol "Salin CSV murid" atau "Salin CSV nilai".

## 6. Backup dan pulihkan

1. Cadangkan: Pengaturan, bagian "Cadangkan dan pulihkan", tombol "Cadangkan semua data (JSON)". Simpan file itu baik-baik.
2. Nama file cadangan: tpq-madin-backup-YYYY-MM-DD.json (YYYY-MM-DD adalah tanggal hari ini, contoh: tpq-madin-backup-2026-11-15.json). Nama file export CSV: murid-tpq-madin.csv, guru-tpq-madin.csv, nilai-tpq-madin.csv, absensi-tpq-madin.csv, keuangan-tpq-madin.csv. Nama file template CSV: template-murid-tpq-madin.csv, template-guru-tpq-madin.csv, template-nilai-tpq-madin.csv.
3. File hasil unduhan tersimpan di folder Unduhan HP (folder Download). Buka aplikasi File atau pengelola file di HP, lalu buka folder Unduhan untuk menemukan file itu.
4. Bedanya export CSV dan backup JSON: export CSV hanya berisi satu daftar (murid, guru, nilai, absensi, atau keuangan) untuk dibaca di spreadsheet; backup JSON berisi seluruh data aplikasi dan dipakai untuk memulihkan.
5. Pulihkan: tombol "Pulihkan dari cadangan", pilih file JSON cadangan. Data saat ini diganti seluruhnya dengan isi file. Kalau file tidak memuat sebagian bagian, bagian itu tetap dipertahankan dari data lokal.
6. Reset ke data contoh: Pengaturan, Zona berbahaya, "Reset ke data contoh". Semua data diganti dengan data contoh (contoh: 40 murid contoh, 5 guru contoh). Minta konfirmasi dan centang persetujuan dulu.
7. Hapus semua data: Pengaturan, Zona berbahaya, "Hapus semua data". Semua murid, guru, nilai, keuangan, dan data lain dihapus permanen dari perangkat. Yang tetap ada: akun login bawaan (ID admin dan guru1) supaya aplikasi tidak terkunci, dan pengaturan dasar lembaga (nama TPQ, tarif SPP contoh Rp50.000, tahun ajaran). Minta konfirmasi dan centang persetujuan dulu. Cadangkan dulu bila ragu.
8. Bedanya: Reset mengganti data dengan data contoh. Hapus mengosongkan aplikasi supaya bisa diisi data asli.

## 7. Offline dan sinkron

1. Aplikasi bekerja offline: data selalu tersimpan dulu di perangkat.
2. Status sinkron tampil di Beranda ("Status sinkron") dan di Pengaturan: "Offline, tersimpan di perangkat", "Menunggu sinkron: N perubahan", "Online, tersinkron", atau "Sinkron nonaktif, atur Apps Script di Pengaturan".
3. Setiap perubahan masuk antrean (maksimal 500 perubahan). Begitu online dan Apps Script sudah diatur, antrean terkirim otomatis ke Google Sheet. Tekan "Sinkron sekarang" untuk mengirim manual, atau "Kirim data ke Apps Script".
4. Kalau antrean pernah dipotong karena melebihi 500, status memberi peringatan bahwa perubahan lama hilang dan tidak terkirim.

## 8. Tanya jawab

**Data saya hilang setelah Hapus semua data. Bisa kembali?**

Tidak, hapus itu permanen. Pulihkan dari file cadangan JSON bila punya. Kalau tidak punya, isi ulang lewat wizard "Mulai isi data" atau import CSV.

**Saya tidak bisa masuk, kata sandi salah terus.**

Periksa huruf besar dan kecil. Setelah 5 kali gagal, login diblokir 60 detik. Kalau tetap tidak bisa, minta Pimpinan mereset kata sandi (Pengaturan, Kelola pengguna, "Reset sandi").

**Grafik kosong.**

Grafik terisi dari data yang ada. Tambah santri, guru, dan kelas dulu, grafik terisi otomatis.

**Import CSV banyak baris gagal.**

Baca alasan tiap baris di layar hasil import (lihat bagian 5). Yang paling umum: NIS sudah ada, nama kosong, atau jenis kelamin bukan L atau P.

**Aplikasi tidak sinkron ke Sheet.**

Periksa status sinkron di Pengaturan. Sinkron butuh URL Web App Apps Script yang sudah disimpan dan perangkat online. Tanpa Apps Script, kirim data lewat export CSV (lihat bagian 5).

**Bagaimana ganti dari TPQ ke Ibtidaiyah?**

Pilih kartu Ibtidaiyah di layar login, atau pemilih profil di hero Beranda, atau Pengaturan, bagian "Profil aktif". Semua menu langsung menampilkan data Ibtidaiyah.

**Saya bingung, harus tanya ke siapa?**

Tanyakan ke Pimpinan. Pimpinan bisa mereset kata sandi (Pengaturan, Kelola pengguna, "Reset sandi"), menambah pengguna, dan mengubah identitas lembaga. Panduan ini juga bisa dibuka lagi kapan saja dari menu Lainnya atau dari Pengaturan, tombol "Buka panduan pengguna".
