/* ============================================================================
   TPQ Al-Muttaqin PWA v2 - engine.js (LAPISAN DATA SAJA)
   ============================================================================
   Dibuat dari nol untuk v2 oleh Baskara (data engineer), 15 Nov 2026.
   Diekstrak dari pwa/app.js v1 (2.952 baris, selftest 73/73): semua fungsi
   data di bawah ini diambil VERBATIM dari v1 kecuali yang ditandai
   "DIUBAH v2" di komentarnya. Semua kode UI v1 (semua fungsi render*,
   renderShell, tab bar, onboarding, modal, toast, openModal) TIDAK dibawa:
   UI ditulis baru oleh Kirana di atas kontrak API.md.

   Cara pakai (satu file, tanpa build, tanpa dependensi):
     <script src="engine.js"></script>
     lalu panggil initEngine() sekali saat aplikasi dibuka.
   Di Node (untuk self-test): muat file ini, lalu panggil
     runEngineSelfTests(t) dan tunggu Promise-nya.

   Aturan yang dipertahankan dari v1:
   - Kunci localStorage SAMA (LS_KEY 'tpq-madin-pwa-v1') supaya data v1
     tetap terbaca; antrean dan konfigurasi Sheet juga kuncinya sama.
   - Semua data adalah DATA CONTOH (db.isContoh true) sampai klien mengisi
     data asli; JANGAN mengarang data klien.
   - Tanpa em dash di teks apa pun yang tampil ke pengguna.
   - "Guru Fan" ditulis persis seperti itu (lihat PERAN_GURU).
   - Tidak ada kredensial/API key Google yang diminta atau disimpan.
     Token sinkron adalah kata sandi bersama milik lembaga sendiri.
   - .xlsx TIDAK didukung (sengaja, tanpa library berat); CSV dan JSON saja.
   ========================================================================== */
'use strict';

/* ---- Penyimpanan: localStorage di browser, memori di Node (untuk test) ---- */
/* Alasan shim ini (DIUBAH v2): engine harus bisa diuji dengan node tanpa
   DOM. Di browser perilakunya sama seperti v1. Kalau localStorage ada tapi
   setItem melempar (kuota penuh), lsSet mengembalikan false dan TIDAK
   jatuh ke memori, supaya save() bisa melaporkan gagal secara jujur. */
var memStore = {};
function lsGet(k) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage.getItem(k);
  } catch (e) { /* lanjut ke memori */ }
  return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null;
}
function lsSet(k, v) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) { localStorage.setItem(k, v); return true; }
  } catch (e) { return false; }
  try { memStore[k] = v; return true; } catch (e2) { return false; }
}
function lsRemove(k) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) { localStorage.removeItem(k); return; }
  } catch (e) { /* lanjut ke memori */ }
  delete memStore[k];
}

/* ---- Konstanta ---- */
var LS_KEY = 'tpq-madin-pwa-v1';

/* Kunci sesi login lokal (JSON { id, nama, peran, masukPada, kedaluwarsa }).
   Sesi hanya tersimpan di perangkat, tidak ikut backup JSON dan tidak
   dikirim ke Sheet. Masa berlaku 7 hari sejak masuk. */
var SESI_KEY = 'tpq-madin-pwa-sesi';
var SESI_MASA_BERLAKU_MS = 7 * 24 * 60 * 60 * 1000;

/* Konstanta SHA-256 (FIPS 180-4) dan salt seed. HARUS di sini (sebelum
   load() pertama di bawah), karena seedData() sudah memanggil hashSandi()
   saat file dimuat; var di bawah titik itu belum terisi saat load() jalan. */
var SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
/* Salt TETAP untuk pengguna seed, didokumentasikan supaya hasil seed
   deterministis (tes bisa mengulang hash yang sama). Pengguna baru selalu
   memakai buatSalt() acak, bukan salt ini. */
var SALT_SEED_ADMIN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
var SALT_SEED_GURU1 = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';

/* Jumlah ronde hash sandi (lihat hashSandi). HARUS di blok konstanta ini,
   SEBELUM `var db = load()` di bawah: seed dihitung saat load, dan kalau
   konstanta ini masih undefined saat itu, hash seed jadi 1 ronde sementara
   login menghitung 1000 ronde — admin tidak bisa masuk di boot pertama. */
var HASH_RONDE = 1000;

var JENJANG_KEY = 'tpq-madin-pwa-jenjang';

/* Pilihan profil aktif yang tersimpan (lihat getProfilAktif/setProfilAktif):
   'TPQ' | 'Ibtidaiyah' | 'Semua'. Kunci baru ronde "Data kosong +
   Panduan pengguna"; bukan bagian dari db, jadi tidak ikut backup JSON. */
var PROFIL_KEY = 'tpq_profil_aktif';

/* Daftar field identitas madrasah. HARUS di blok konstanta ini, SEBELUM
   `var db = load()` di bawah: migrasiIdentitas() sudah dipanggil load()
   saat file dimuat, dan var di bawah titik itu belum terisi saat load()
   jalan (kesalahan yang sama pernah dijaga untuk SHA256_K/HASH_RONDE). */
var IDENTITAS_FIELD = ['nama', 'singkat', 'logo', 'kepala', 'alamat', 'telepon', 'tahunBerdiri', 'nsm', 'motto'];

var QUEUE_KEY = 'tpq-madin-pwa-v1-sync-queue';

/* T-13: penanda bahwa antrean sinkron pernah dipotong (batas terlampaui).
   Disimpan di localStorage supaya peringatan tetap tampil setelah muat
   ulang; perubahan yang terpotong memang hilang permanen (tidak terkirim),
   jadi penanda ini sengaja tidak dihapus otomatis saat antrean terkirim. */
var QUEUE_TRIMMED_KEY = 'tpq-madin-pwa-v1-sync-trimmed';
function antreanPernahDipotong() {
  try { return lsGet(QUEUE_TRIMMED_KEY) === '1'; } catch (e) { return false; }
}

var SHEET_CFG_KEY = 'tpq-madin-pwa-v1-sheet';

var APPS_SCRIPT_HOST_DIIZINKAN = ['script.google.com', 'script.googleusercontent.com'];

var HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];

var MAPEL_LIST = ['Iqra', 'Tahfidz', 'Fiqih', 'Tauhid', 'Akhlak', 'Bahasa Arab', 'Tajwid', 'Doa Harian'];

var PERAN_GURU = ['Pimpinan', 'Wali Kelas', 'Guru Fan', 'Guru'];

var JENIS_NILAI = ['Harian', 'Imda', 'Praktek'];

var JILID_LIST = ['Iqra 1', 'Iqra 2', 'Iqra 3', 'Iqra 4', 'Iqra 5', 'Iqra 6', 'Tahfidz Juz 30', 'Tahfidz Juz 29', 'Tahfidz Juz 28'];

var KATEGORI_MASUK = ['SPP', 'Infaq', 'Donasi', 'Pendaftaran', 'Kitab/Seragam', 'Saldo awal'];

var KATEGORI_KELUAR = ['Honor guru', 'Operasional', 'ATK', 'Listrik dan air', 'Kegiatan'];

/* ---- Seed data (verbatim v1) ---- */
function seedData() {
  return {
    version: 1,
    isContoh: true,
    santri: [
      { id: 's1', nis: '202401', nama: 'Ahmad Fauzi', jk: 'L', kelas: 'Iqra 3', jilid: 'Iqra 3', halaman: 14, hafalan: 'Juz 30 (An-Naba)', wali: 'Bpk. Slamet', hpWali: '081200000001', alamat: 'Jl. Merdeka 12', tabungan: 450000, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 96, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's2', nis: '202402', nama: 'Siti Maryam', jk: 'P', kelas: 'Tahfidz 1', jilid: 'Tahfidz Juz 30', halaman: 5, hafalan: 'Juz 30 (An-Naba)', wali: 'Ibu Aminah', hpWali: '081200000002', alamat: 'Jl. Melati 4', tabungan: 600000, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 98, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's3', nis: '202403', nama: 'Budi Santoso', jk: 'L', kelas: 'Iqra 1', jilid: 'Iqra 1', halaman: 8, hafalan: 'Belum mulai', wali: 'Bpk. Hartono', hpWali: '081200000003', alamat: 'Jl. Kenanga 8', tabungan: 150000, sppStatus: 'Belum', sppReminderSent: false, kehadiran: 82, angkatan: '2024', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's4', nis: '202404', nama: 'Aisyah Putri', jk: 'P', kelas: 'Iqra 2', jilid: 'Iqra 2', halaman: 20, hafalan: 'Juz 30 (Al-Ikhlas)', wali: 'Ibu Dewi', hpWali: '081200000004', alamat: 'Jl. Anggrek 21', tabungan: 300000, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 94, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's5', nis: '202405', nama: 'Muhammad Rizki', jk: 'L', kelas: 'Iqra 3', jilid: 'Iqra 3', halaman: 13, hafalan: 'Juz 30 (An-Naziat)', wali: 'Bpk. Bambang', hpWali: '081200000005', alamat: 'Jl. Mawar 3', tabungan: 520000, sppStatus: 'Telat', sppReminderSent: false, kehadiran: 88, angkatan: '2024', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's6', nis: '202406', nama: 'Fatimah Zahra', jk: 'P', kelas: 'Tahfidz 1', jilid: 'Tahfidz Juz 29', halaman: 3, hafalan: 'Juz 29 (Al-Mulk)', wali: 'Ibu Khadijah', hpWali: '081200000006', alamat: 'Jl. Dahlia 9', tabungan: 380000, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 97, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's7', nis: '202301', nama: 'Ahmad Hidayat', jk: 'L', kelas: 'Tahfidz 1', jilid: 'Tahfidz Juz 30', halaman: 1, hafalan: 'Juz 30 (lengkap)', wali: 'Bpk. Mahmud', hpWali: '081200000007', alamat: 'Jl. Suka Maju 2', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 95, angkatan: '2023', rombel: 'A', jenjang: 'TPQ', status: 'Lulus', statusTanggal: '2026-06-15', tahunLulus: '2026' },
      { id: 's8', nis: '202302', nama: 'Dewi Lestari', jk: 'P', kelas: 'Iqra 2', jilid: 'Iqra 2', halaman: 6, hafalan: 'Juz 30 (Al-Fatihah)', wali: 'Ibu Ratna', hpWali: '081200000008', alamat: 'Jl. Damai 7', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 80, angkatan: '2023', rombel: 'B', jenjang: 'TPQ', status: 'Keluar', statusTanggal: '2026-10-02', statusAlasan: 'Pindah domisili' },
      { id: 's9', nis: '202407', nama: 'Rizky Pratama', jk: 'L', kelas: 'Iqra 2', jilid: 'Iqra 2', halaman: 9, hafalan: 'Juz 30 (Al-Fatihah)', wali: 'Bpk. Agus', hpWali: '081200000009', alamat: 'Jl. Kenanga 2', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 93, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's10', nis: '202408', nama: 'Nur Halimah', jk: 'P', kelas: 'Iqra 1', jilid: 'Iqra 1', halaman: 6, hafalan: 'Belum mulai', wali: 'Ibu Sari', hpWali: '081200000010', alamat: 'Jl. Melati 7', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 95, angkatan: '2024', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's11', nis: '202409', nama: 'Dimas Prasetyo', jk: 'L', kelas: 'Iqra 3', jilid: 'Iqra 3', halaman: 11, hafalan: 'Juz 30 (An-Naba)', wali: 'Bpk. Joko', hpWali: '081200000011', alamat: 'Jl. Mawar 5', tabungan: 0, sppStatus: 'Belum', sppReminderSent: false, kehadiran: 91, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's12', nis: '202410', nama: 'Putri Ayu Lestari', jk: 'P', kelas: 'Tahfidz 1', jilid: 'Tahfidz Juz 30', halaman: 4, hafalan: 'Juz 30 (lengkap)', wali: 'Ibu Rina', hpWali: '081200000012', alamat: 'Jl. Anggrek 6', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 96, angkatan: '2024', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's13', nis: '202411', nama: 'Fajar Ramadhan', jk: 'L', kelas: 'Iqra 1', jilid: 'Iqra 1', halaman: 5, hafalan: 'Belum mulai', wali: 'Bpk. Hadi', hpWali: '081200000013', alamat: 'Jl. Dahlia 3', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 92, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's14', nis: '202412', nama: 'Zahra Aulia', jk: 'P', kelas: 'Iqra 2', jilid: 'Iqra 2', halaman: 15, hafalan: 'Juz 30 (Al-Ikhlas)', wali: 'Ibu Maya', hpWali: '081200000014', alamat: 'Jl. Merdeka 9', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 94, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's15', nis: '202413', nama: 'Yusuf Maulana', jk: 'L', kelas: 'Iqra 3', jilid: 'Iqra 3', halaman: 10, hafalan: 'Juz 30 (An-Naziat)', wali: 'Bpk. Udin', hpWali: '081200000015', alamat: 'Jl. Damai 4', tabungan: 0, sppStatus: 'Belum', sppReminderSent: false, kehadiran: 90, angkatan: '2024', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's16', nis: '202414', nama: 'Nadia Safitri', jk: 'P', kelas: 'Tahfidz 1', jilid: 'Tahfidz Juz 29', halaman: 2, hafalan: 'Juz 29 (Al-Mulk)', wali: 'Ibu Lilis', hpWali: '081200000016', alamat: 'Jl. Kenanga 11', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 97, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's17', nis: '202415', nama: 'Andi Wijaya', jk: 'L', kelas: 'Iqra 1', jilid: 'Iqra 1', halaman: 7, hafalan: 'Belum mulai', wali: 'Bpk. Tono', hpWali: '081200000017', alamat: 'Jl. Melati 2', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 91, angkatan: '2024', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's18', nis: '202416', nama: 'Salsabila Rahma', jk: 'P', kelas: 'Iqra 2', jilid: 'Iqra 2', halaman: 18, hafalan: 'Juz 30 (Al-Ikhlas)', wali: 'Ibu Yuni', hpWali: '081200000018', alamat: 'Jl. Mawar 8', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 95, angkatan: '2024', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's19', nis: '202417', nama: 'Ilham Saputra', jk: 'L', kelas: 'Iqra 3', jilid: 'Iqra 3', halaman: 12, hafalan: 'Juz 30 (An-Naba)', wali: 'Bpk. Budi', hpWali: '081200000019', alamat: 'Jl. Anggrek 10', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 93, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's20', nis: '202418', nama: 'Kirana Dewi', jk: 'P', kelas: 'Iqra 1', jilid: 'Iqra 1', halaman: 4, hafalan: 'Belum mulai', wali: 'Ibu Nia', hpWali: '081200000020', alamat: 'Jl. Dahlia 6', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 92, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's21', nis: '202419', nama: 'Rafi Akbar', jk: 'L', kelas: 'Iqra 2', jilid: 'Iqra 2', halaman: 13, hafalan: 'Juz 30 (Al-Fatihah)', wali: 'Bpk. Rudi', hpWali: '081200000021', alamat: 'Jl. Merdeka 15', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 94, angkatan: '2024', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's22', nis: '202420', nama: 'Melati Suci', jk: 'P', kelas: 'Tahfidz 1', jilid: 'Tahfidz Juz 30', halaman: 6, hafalan: 'Juz 30 (lengkap)', wali: 'Ibu Dewi', hpWali: '081200000022', alamat: 'Jl. Damai 9', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 96, angkatan: '2024', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's23', nis: '202501', nama: 'Bagas Wicaksono', jk: 'L', kelas: 'Iqra 1', jilid: 'Iqra 1', halaman: 3, hafalan: 'Belum mulai', wali: 'Bpk. Eko', hpWali: '081200000023', alamat: 'Jl. Kenanga 5', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 93, angkatan: '2025', rombel: 'A', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's24', nis: '202502', nama: 'Aqila Nabila', jk: 'P', kelas: 'Iqra 1', jilid: 'Iqra 1', halaman: 5, hafalan: 'Belum mulai', wali: 'Ibu Fitri', hpWali: '081200000024', alamat: 'Jl. Melati 9', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 95, angkatan: '2025', rombel: 'B', jenjang: 'TPQ', status: 'Aktif' },
      { id: 's25', nis: '202503', nama: 'Danang Setiawan', jk: 'L', kelas: 'Kelas 1', jilid: 'Iqra 2', halaman: 8, hafalan: 'Juz 30 (Al-Fatihah)', wali: 'Bpk. Slamet', hpWali: '081200000025', alamat: 'Jl. Mawar 12', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 91, angkatan: '2025', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's26', nis: '202504', nama: 'Larasati Putri', jk: 'P', kelas: 'Kelas 1', jilid: 'Iqra 2', halaman: 11, hafalan: 'Juz 30 (Al-Ikhlas)', wali: 'Ibu Ratih', hpWali: '081200000026', alamat: 'Jl. Anggrek 3', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 94, angkatan: '2025', rombel: 'B', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's27', nis: '202505', nama: 'Hafiz Alfarizi', jk: 'L', kelas: 'Kelas 2', jilid: 'Iqra 1', halaman: 6, hafalan: 'Belum mulai', wali: 'Bpk. Hasan', hpWali: '081200000027', alamat: 'Jl. Dahlia 8', tabungan: 0, sppStatus: 'Belum', sppReminderSent: false, kehadiran: 90, angkatan: '2025', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's28', nis: '202506', nama: 'Tiara Maharani', jk: 'P', kelas: 'Kelas 2', jilid: 'Iqra 3', halaman: 9, hafalan: 'Juz 30 (An-Naba)', wali: 'Ibu Sinta', hpWali: '081200000028', alamat: 'Jl. Merdeka 20', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 92, angkatan: '2025', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's29', nis: '202507', nama: 'Rizal Fahmi', jk: 'L', kelas: 'Kelas 3', jilid: 'Iqra 2', halaman: 10, hafalan: 'Juz 30 (Al-Fatihah)', wali: 'Bpk. Fajar', hpWali: '081200000029', alamat: 'Jl. Damai 6', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 93, angkatan: '2025', rombel: 'B', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's30', nis: '202508', nama: 'Anisa Rahmawati', jk: 'P', kelas: 'Kelas 3', jilid: 'Tahfidz Juz 30', halaman: 3, hafalan: 'Juz 30 (lengkap)', wali: 'Ibu Wati', hpWali: '081200000030', alamat: 'Jl. Kenanga 14', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 96, angkatan: '2025', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's31', nis: '202509', nama: 'Galih Prakoso', jk: 'L', kelas: 'Kelas 4', jilid: 'Iqra 1', halaman: 4, hafalan: 'Belum mulai', wali: 'Bpk. Dedi', hpWali: '081200000031', alamat: 'Jl. Melati 5', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 91, angkatan: '2025', rombel: 'B', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's32', nis: '202510', nama: 'Sekar Arum', jk: 'P', kelas: 'Kelas 4', jilid: 'Iqra 2', halaman: 14, hafalan: 'Juz 30 (Al-Ikhlas)', wali: 'Ibu Tari', hpWali: '081200000032', alamat: 'Jl. Mawar 17', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 95, angkatan: '2025', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's33', nis: '202303', nama: 'Eko Purnomo', jk: 'L', kelas: 'Kelas 5', jilid: 'Iqra 3', halaman: 16, hafalan: 'Juz 30 (An-Naziat)', wali: 'Bpk. Bambang', hpWali: '081200000033', alamat: 'Jl. Anggrek 8', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 92, angkatan: '2023', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's34', nis: '202304', nama: 'Wulan Sari', jk: 'P', kelas: 'Kelas 5', jilid: 'Tahfidz Juz 29', halaman: 5, hafalan: 'Juz 29 (Al-Mulk)', wali: 'Ibu Sari', hpWali: '081200000034', alamat: 'Jl. Dahlia 11', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 97, angkatan: '2023', rombel: 'B', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's35', nis: '202305', nama: 'Dedi Kurniawan', jk: 'L', kelas: 'Kelas 6', jilid: 'Iqra 2', halaman: 12, hafalan: 'Juz 30 (Al-Fatihah)', wali: 'Bpk. Karto', hpWali: '081200000035', alamat: 'Jl. Merdeka 7', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 93, angkatan: '2023', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's36', nis: '202306', nama: 'Ratna Dewi', jk: 'P', kelas: 'Kelas 6', jilid: 'Iqra 3', halaman: 13, hafalan: 'Juz 30 (An-Naba)', wali: 'Ibu Lastri', hpWali: '081200000036', alamat: 'Jl. Damai 12', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 94, angkatan: '2023', rombel: 'B', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's37', nis: '202307', nama: 'Arif Rahman', jk: 'L', kelas: 'Kelas 1', jilid: 'Iqra 1', halaman: 8, hafalan: 'Belum mulai', wali: 'Bpk. Umar', hpWali: '081200000037', alamat: 'Jl. Kenanga 9', tabungan: 0, sppStatus: 'Belum', sppReminderSent: false, kehadiran: 90, angkatan: '2023', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's38', nis: '202308', nama: 'Intan Permata', jk: 'P', kelas: 'Kelas 2', jilid: 'Iqra 2', halaman: 17, hafalan: 'Juz 30 (Al-Ikhlas)', wali: 'Ibu Nina', hpWali: '081200000038', alamat: 'Jl. Melati 11', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 95, angkatan: '2023', rombel: 'B', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's39', nis: '202309', nama: 'Yoga Pratama', jk: 'L', kelas: 'Kelas 3', jilid: 'Iqra 3', halaman: 15, hafalan: 'Juz 30 (An-Naziat)', wali: 'Bpk. Seno', hpWali: '081200000039', alamat: 'Jl. Mawar 21', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 93, angkatan: '2023', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
      { id: 's40', nis: '202310', nama: 'Laila Nur', jk: 'P', kelas: 'Kelas 4', jilid: 'Tahfidz Juz 30', halaman: 7, hafalan: 'Juz 30 (lengkap)', wali: 'Ibu Farida', hpWali: '081200000040', alamat: 'Jl. Anggrek 15', tabungan: 0, sppStatus: 'Lunas', sppReminderSent: false, kehadiran: 98, angkatan: '2023', rombel: 'A', jenjang: 'Ibtidaiyah', status: 'Aktif' },
    ],
    guru: [
      { id: 'g1', nama: 'Ustadz Ahmad', kelas: 'Iqra 1', hp: '081200000101', honor: 800000, honorStatus: 'Lunas', peran: 'Pimpinan', jenjang: 'TPQ dan Ibtidaiyah' },
      { id: 'g2', nama: 'Ustadzah Khadijah', kelas: 'Iqra 3', hp: '081200000102', honor: 900000, honorStatus: 'Belum', peran: 'Wali Kelas', jenjang: 'TPQ' },
      { id: 'g3', nama: 'Ustadz Budi', kelas: 'Tahfidz 1', hp: '081200000103', honor: 850000, honorStatus: 'Belum', peran: 'Guru Fan', jenjang: 'TPQ' },
      { id: 'g4', nama: 'Ustadzah Aisyah', kelas: 'Kelas 1', hp: '081200000104', honor: 950000, honorStatus: 'Belum', peran: 'Wali Kelas', jenjang: 'Ibtidaiyah' },
      { id: 'g5', nama: 'Ustadz Hasan', kelas: 'Kelas 3', hp: '081200000105', honor: 950000, honorStatus: 'Belum', peran: 'Guru', jenjang: 'Ibtidaiyah' }
    ],
    kelas: [
      { id: 'k1', nama: 'Iqra 1', ustadz: 'Ustadz Ahmad', jadwal: 'Senin dan Kamis, 15:30', ruang: 'Ruang A', jenjang: 'TPQ' },
      { id: 'k10', nama: 'Iqra 2', ustadz: 'Ustadzah Khadijah', jadwal: 'Selasa dan Kamis, 15:30', ruang: 'Ruang D', jenjang: 'TPQ' },
      { id: 'k2', nama: 'Iqra 3', ustadz: 'Ustadzah Khadijah', jadwal: 'Senin dan Kamis, 16:00', ruang: 'Ruang C', jenjang: 'TPQ' },
      { id: 'k3', nama: 'Tahfidz 1', ustadz: 'Ustadz Budi', jadwal: 'Selasa dan Jumat, 16:30', ruang: 'Ruang B', jenjang: 'TPQ' },
      { id: 'k4', nama: 'Kelas 1', ustadz: 'Ustadzah Aisyah', jadwal: 'Senin dan Rabu, 07:00', ruang: 'Ruang 1', jenjang: 'Ibtidaiyah' },
      { id: 'k5', nama: 'Kelas 2', ustadz: 'Ustadzah Aisyah', jadwal: 'Senin dan Rabu, 07:00', ruang: 'Ruang 2', jenjang: 'Ibtidaiyah' },
      { id: 'k6', nama: 'Kelas 3', ustadz: 'Ustadz Hasan', jadwal: 'Selasa dan Kamis, 07:00', ruang: 'Ruang 3', jenjang: 'Ibtidaiyah' },
      { id: 'k7', nama: 'Kelas 4', ustadz: 'Ustadz Hasan', jadwal: 'Selasa dan Kamis, 07:00', ruang: 'Ruang 4', jenjang: 'Ibtidaiyah' },
      { id: 'k8', nama: 'Kelas 5', ustadz: 'Ustadzah Aisyah', jadwal: 'Jumat dan Sabtu, 07:00', ruang: 'Ruang 5', jenjang: 'Ibtidaiyah' },
      { id: 'k9', nama: 'Kelas 6', ustadz: 'Ustadz Hasan', jadwal: 'Jumat dan Sabtu, 07:00', ruang: 'Ruang 6', jenjang: 'Ibtidaiyah' }
    ],
    tabunganTx: [
      { id: 't1', santriId: 's1', jenis: 'Setor', jumlah: 50000, tanggal: '2026-11-14', catatan: 'Setoran mingguan', saldoSetelah: 450000 },
      { id: 't2', santriId: 's2', jenis: 'Setor', jumlah: 100000, tanggal: '2026-11-13', catatan: 'Setoran mingguan', saldoSetelah: 600000 },
      { id: 't3', santriId: 's5', jenis: 'Tarik', jumlah: 80000, tanggal: '2026-11-12', catatan: 'Beli kitab', saldoSetelah: 520000 },
      { id: 't4', santriId: 's4', jenis: 'Setor', jumlah: 50000, tanggal: '2026-11-11', catatan: 'Setoran mingguan', saldoSetelah: 300000 },
      { id: 't5', santriId: 's3', jenis: 'Setor', jumlah: 50000, tanggal: '2026-11-10', catatan: 'Setoran pertama', saldoSetelah: 150000 }
    ],
    target: [
      { id: 'tg1', nama: 'Seragam Baru', target: 150000, terkumpul: 120000 },
      { id: 'tg2', nama: 'Kitab Iqra', target: 75000, terkumpul: 45000 }
    ],
    keuanganTx: [
      { id: 'k1', jenis: 'Masuk', kategori: 'SPP', jenjang: 'TPQ', nama: 'SPP November', jumlah: 1900000, tanggal: '2026-11-05', catatan: 'SPP bulan November (38 santri aktif x Rp50.000)' },
      { id: 'k2', jenis: 'Masuk', kategori: 'Infaq', jenjang: 'TPQ', nama: 'Infaq Jumat', jumlah: 450000, tanggal: '2026-11-07', catatan: 'Kotak infaq' },
      { id: 'k3', jenis: 'Masuk', kategori: 'Pendaftaran', jenjang: 'Ibtidaiyah', nama: 'Pendaftaran santri baru', jumlah: 200000, tanggal: '2026-11-03', catatan: '2 santri baru' },
      { id: 'k4', jenis: 'Masuk', kategori: 'Saldo awal', jenjang: 'TPQ', nama: 'Saldo awal November', jumlah: 1400000, tanggal: '2026-11-01', catatan: 'Saldo kas awal bulan' },
      { id: 'k5', jenis: 'Keluar', kategori: 'Honor guru', jenjang: 'TPQ', nama: 'Honor guru Oktober', jumlah: 2550000, tanggal: '2026-11-02', catatan: '3 guru (Rp800.000 + Rp850.000 + Rp900.000)' },
      { id: 'k6', jenis: 'Keluar', kategori: 'Operasional', jenjang: 'Ibtidaiyah', nama: 'Operasional', jumlah: 150000, tanggal: '2026-11-06', catatan: 'Kebersihan dan keamanan' },
      { id: 'k7', jenis: 'Keluar', kategori: 'ATK', jenjang: 'TPQ', nama: 'ATK', jumlah: 150000, tanggal: '2026-11-08', catatan: 'Kertas dan spidol' },
      { id: 'k8', jenis: 'Keluar', kategori: 'Listrik dan air', jenjang: 'TPQ', nama: 'Listrik dan air', jumlah: 200000, tanggal: '2026-11-09', catatan: 'Tagihan bulanan' }
    ],
    pertemuan: [
      { id: 'p1', kelasId: 'k2', tanggal: '2026-11-14', materi: 'Iqra 3, halaman 12-14 (huruf hijaiyah bersambung)', absensi: { s1: 'Hadir', s5: 'Hadir', s11: 'Hadir', s15: 'Hadir', s19: 'Hadir' } }
    ],
    hafalanLog: [
      { id: 'h1', santriId: 's1', tanggal: '2026-11-14', jenis: 'Iqra', materi: 'Iqra 3 halaman 14', nilai: 'Lancar' },
      { id: 'h2', santriId: 's2', tanggal: '2026-11-13', jenis: 'Hafalan', materi: 'Juz 30 An-Naba ayat 1-10', nilai: 'Lancar' },
      { id: 'h3', santriId: 's4', tanggal: '2026-11-12', jenis: 'Iqra', materi: 'Iqra 2 halaman 20', nilai: 'Cukup' }
    ],
    pengumuman: [
      { id: 'u1', judul: 'Pengajian Akbar', isi: 'Sabtu, 15 Nov pukul 08:00 di aula TPQ. Semua santri diharap hadir.', tanggal: '2026-11-14', aktif: true },
      { id: 'u2', judul: 'Libur Maulid Nabi', isi: 'Kelas libur Kamis, 20 Nov. Masuk kembali Jumat, 21 Nov.', tanggal: '2026-11-13', aktif: true }
    ],
    settings: { namaTpq: 'TPQ Al-Muttaqin', kepala: 'Ustadz Ahmad', tarifSpp: 50000, tahunAjaran: '2026/2027', jamMasuk: '15:30', identitasDikonfirmasi: false },
    nilai: [
      { id: 'n1', santriId: 's1', jenis: 'Harian', mapel: 'Iqra', nilai: 85, tanggal: '2026-11-12', catatan: 'Bacaan lancar' },
      { id: 'n2', santriId: 's1', jenis: 'Harian', mapel: 'Fiqih', nilai: 80, tanggal: '2026-11-13', catatan: '' },
      { id: 'n3', santriId: 's1', jenis: 'Imda', mapel: 'Iqra', nilai: 90, tanggal: '2026-11-10', catatan: 'Imda halaman 12-14' },
      { id: 'n4', santriId: 's1', jenis: 'Praktek', mapel: 'Tajwid', nilai: 88, tanggal: '2026-11-11', catatan: 'Praktek makharijul huruf' },
      { id: 'n5', santriId: 's2', jenis: 'Harian', mapel: 'Tahfidz', nilai: 95, tanggal: '2026-11-12', catatan: 'Hafalan An-Naba' },
      { id: 'n6', santriId: 's2', jenis: 'Imda', mapel: 'Tahfidz', nilai: 92, tanggal: '2026-11-10', catatan: '' },
      { id: 'n7', santriId: 's2', jenis: 'Praktek', mapel: 'Tajwid', nilai: 90, tanggal: '2026-11-11', catatan: '' },
      { id: 'n8', santriId: 's4', jenis: 'Harian', mapel: 'Iqra', nilai: 78, tanggal: '2026-11-12', catatan: '' },
      { id: 'n9', santriId: 's5', jenis: 'Harian', mapel: 'Iqra', nilai: 82, tanggal: '2026-11-13', catatan: '' },
      { id: 'n10', santriId: 's3', jenis: 'Harian', mapel: 'Iqra', nilai: 70, tanggal: '2026-11-12', catatan: 'Masih terbata' }
    ],
    alokasiWaktu: [
      { id: 'a1', kelas: 'Iqra 1', mapel: 'Iqra', jamPerMinggu: 4, hari: 'Senin, Kamis' },
      { id: 'a2', kelas: 'Iqra 1', mapel: 'Fiqih', jamPerMinggu: 2, hari: 'Kamis' },
      { id: 'a3', kelas: 'Iqra 3', mapel: 'Iqra', jamPerMinggu: 4, hari: 'Senin, Kamis' },
      { id: 'a4', kelas: 'Iqra 3', mapel: 'Tajwid', jamPerMinggu: 2, hari: 'Senin' },
      { id: 'a5', kelas: 'Tahfidz 1', mapel: 'Tahfidz', jamPerMinggu: 6, hari: 'Selasa, Jumat' },
      { id: 'a6', kelas: 'Tahfidz 1', mapel: 'Fiqih', jamPerMinggu: 2, hari: 'Jumat' },
      { id: 'a7', kelas: 'Kelas 1', mapel: 'Iqra', jamPerMinggu: 4, hari: 'Senin, Rabu' },
      { id: 'a8', kelas: 'Kelas 3', mapel: 'Tahfidz', jamPerMinggu: 4, hari: 'Selasa, Kamis' }
    ],
    jadwalKbm: [
      { id: 'j1', kelas: 'Iqra 1', hari: 'Senin', jamMulai: '15:30', jamSelesai: '16:30', mapel: 'Iqra', guru: 'Ustadz Ahmad' },
      { id: 'j2', kelas: 'Iqra 1', hari: 'Kamis', jamMulai: '15:30', jamSelesai: '16:30', mapel: 'Fiqih', guru: 'Ustadz Ahmad' },
      { id: 'j3', kelas: 'Iqra 3', hari: 'Senin', jamMulai: '16:00', jamSelesai: '17:00', mapel: 'Tajwid', guru: 'Ustadzah Khadijah' },
      { id: 'j4', kelas: 'Iqra 3', hari: 'Kamis', jamMulai: '16:00', jamSelesai: '17:00', mapel: 'Iqra', guru: 'Ustadzah Khadijah' },
      { id: 'j5', kelas: 'Tahfidz 1', hari: 'Selasa', jamMulai: '16:30', jamSelesai: '17:30', mapel: 'Tahfidz', guru: 'Ustadz Budi' },
      { id: 'j6', kelas: 'Tahfidz 1', hari: 'Jumat', jamMulai: '16:30', jamSelesai: '17:30', mapel: 'Fiqih', guru: 'Ustadz Budi' },
      { id: 'j7', kelas: 'Kelas 1', hari: 'Senin', jamMulai: '07:00', jamSelesai: '08:00', mapel: 'Iqra', guru: 'Ustadzah Aisyah' },
      { id: 'j8', kelas: 'Kelas 2', hari: 'Selasa', jamMulai: '07:00', jamSelesai: '08:00', mapel: 'Fiqih', guru: 'Ustadzah Aisyah' },
      { id: 'j9', kelas: 'Kelas 3', hari: 'Rabu', jamMulai: '07:00', jamSelesai: '08:00', mapel: 'Tahfidz', guru: 'Ustadz Hasan' },
      { id: 'j10', kelas: 'Kelas 4', hari: 'Kamis', jamMulai: '07:00', jamSelesai: '08:00', mapel: 'Bahasa Arab', guru: 'Ustadz Hasan' }
    ],
    jadwalPiket: [
      { id: 'pk1', guruId: 'g1', hari: 'Senin', keterangan: 'Piket pagi dan sore' },
      { id: 'pk2', guruId: 'g2', hari: 'Selasa', keterangan: 'Piket sore' },
      { id: 'pk3', guruId: 'g3', hari: 'Rabu', keterangan: 'Piket sore' },
      { id: 'pk4', guruId: 'g2', hari: 'Kamis', keterangan: 'Piket pagi dan sore' },
      { id: 'pk5', guruId: 'g1', hari: 'Jumat', keterangan: 'Piket sore' },
      { id: 'pk6', guruId: 'g4', hari: 'Senin', keterangan: 'Piket pagi' },
      { id: 'pk7', guruId: 'g5', hari: 'Rabu', keterangan: 'Piket pagi' }
    ],
    absensiGuru: [
      { id: 'ag1', guruId: 'g1', tanggal: '2026-11-14', status: 'Hadir', kelompok: 'Guru' },
      { id: 'ag2', guruId: 'g2', tanggal: '2026-11-14', status: 'Hadir', kelompok: 'Guru' },
      { id: 'ag3', guruId: 'g3', tanggal: '2026-11-14', status: 'Izin', kelompok: 'Guru' },
      { id: 'ag4', guruId: 'g1', tanggal: '2026-11-13', status: 'Hadir', kelompok: 'Pimpinan' }
    ],
    rapbm: [
      { id: 'r1', pos: 'SPP', jenis: 'Masuk', jenjang: 'TPQ', rencana: 3000000 },
      { id: 'r2', pos: 'Infaq', jenis: 'Masuk', jenjang: 'TPQ', rencana: 500000 },
      { id: 'r3', pos: 'Donasi', jenis: 'Masuk', jenjang: 'TPQ', rencana: 1000000 },
      { id: 'r4', pos: 'Pendaftaran', jenis: 'Masuk', jenjang: 'Ibtidaiyah', rencana: 200000 },
      { id: 'r5', pos: 'Honor guru', jenis: 'Keluar', jenjang: 'TPQ', rencana: 2700000 },
      { id: 'r6', pos: 'Operasional', jenis: 'Keluar', jenjang: 'Ibtidaiyah', rencana: 500000 },
      { id: 'r7', pos: 'ATK', jenis: 'Keluar', jenjang: 'TPQ', rencana: 200000 },
      { id: 'r8', pos: 'Listrik dan air', jenis: 'Keluar', jenjang: 'TPQ', rencana: 250000 }
    ],
    biaya: [
      { id: 'b1', nama: 'SPP Bulanan', jumlah: 50000, keterangan: 'Per santri per bulan' },
      { id: 'b2', nama: 'Pendaftaran Santri Baru', jumlah: 100000, keterangan: 'Sekali saat mendaftar' },
      { id: 'b3', nama: 'Kitab Iqra', jumlah: 75000, keterangan: 'Per jilid' },
      { id: 'b4', nama: 'Seragam TPQ', jumlah: 150000, keterangan: 'Per stel' }
    ],
    /* Pengguna login (data contoh). Kata sandi TIDAK PERNAH plaintext di sini
       sebagai data: yang tersimpan hanya salt + hash SHA-256. Dua string
       sandi awal di bawah hanya dipakai sekali saat seed untuk di-hash
       (lihat seedPengguna); setelah itu tidak ada lagi di objek db. */
    pengguna: seedPengguna()
  };
}

function emptyData() {
  return {
    version: 1, isContoh: false,
    santri: [], guru: [], kelas: [], tabunganTx: [], target: [], keuanganTx: [],
    pertemuan: [], hafalanLog: [], pengumuman: [], nilai: [], alokasiWaktu: [],
    jadwalKbm: [], jadwalPiket: [], absensiGuru: [], rapbm: [], biaya: [],
    pengguna: [],
    settings: { namaTpq: 'TPQ Al-Muttaqin', kepala: '', tarifSpp: 50000, tahunAjaran: '2026/2027', jamMasuk: '15:30', identitasDikonfirmasi: false }
  };
}


/* ---------------- State ---------------- */
/* db = seluruh data aplikasi (lihat seedData/emptyData untuk bentuknya).
   ui = state non-DOM: filter dan pilihan yang sedang aktif. UI (Kirana)
   boleh membaca/menulis field ui ini, lalu me-render ulang sendiri.
   DIUBAH v2: ui.jenjang langsung diisi dari penyimpanan saat file dimuat.
   Di v1 ui.jenjang baru diisi di init(), jadi sebelum init() jenjangCocok()
   menganggap jenjang belum dipilih. */
var db = load();
var ui = {
  jenjang: getJenjang(),
  santriSearch: '', santriKelas: 'Semua', santriStatus: 'Aktif', santriAngkatan: 'Semua',
  santriSortKey: 'nama', santriSortDir: 'asc', santriShown: 10,
  guruSearch: '',
  tabunganSantri: '', tabunganJenis: 'Setor',
  keuanganTab: 'Semua',
  kelasId: 'k2', kelasTanggal: '', kelasMateri: '', absDraft: {},
  nilaiTab: 'Harian', nilaiSantri: '', raporSantri: 's1', raporSemester: 'ganjil-2627',
  kbmTab: 'alokasi', kbmHari: 'Semua',
  absGuruTanggal: todayStr(), absGuruKelompok: 'Guru',
  kemuridanTab: 'kelas',
  rapbmTab: 'rapbm',
  hafalanSantri: ''
};


/* ---------------- Muat / simpan ---------------- */
/* DIUBAH v2 (perbaikan bug v1): load() menggabungkan data tersimpan dengan
   emptyData(), seperti yang sudah dilakukan applyBackupData(). Di v1, data
   lama yang kehilangan satu kunci (mis. tanpa rapbm) langsung dipakai apa
   adanya dan bisa membuat UI crash karena .filter pada undefined. */
function load() {
  try {
    var raw = lsGet(LS_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.santri) {
        var d = emptyData();
        Object.keys(d).forEach(function (k) { if (parsed[k] !== undefined) d[k] = parsed[k]; });
        if (d.settings && typeof d.settings === 'object') d.settings = Object.assign(emptyData().settings, d.settings);
        /* R7: pengguna dari penyimpanan adalah data tersimpan (bisa usang /
           rusak) — validasi bentuknya lewat bersihkanPengguna(), seperti
           halnya pengguna dari berkas cadangan. Entri tidak valid dibuang;
           kalau hasilnya kosong, pakai pengguna seed supaya selalu ada
           yang bisa login. */
        if (Array.isArray(d.pengguna) && d.pengguna.length) d.pengguna = bersihkanPengguna(d.pengguna);
        if (!Array.isArray(d.pengguna) || d.pengguna.length === 0) d.pengguna = seedPengguna();
        bersihkanFoto(d);
        bersihkanTanggal(d);
        migrasiIdentitas(d.settings);
        return d;
      }
    }
  } catch (e) { console.warn('Gagal memuat data lokal:', e); }
  var fresh = seedData();
  migrasiIdentitas(fresh.settings);
  lsSet(LS_KEY, JSON.stringify(fresh));
  return fresh;
}
/* Simpan db ke penyimpanan dan masukkan ke antrean sinkron.
   DIUBAH v2: mengembalikan true/false (v1 tidak mengembalikan apa-apa).
   Kalau penyimpanan gagal (mis. kuota penuh), mengembalikan false dan
   TIDAK mengantrekan perubahan, supaya sinkron tidak mengirim data yang
   tidak tersimpan. */
function save(alasan) {
  db._updatedAt = new Date().toISOString();
  if (!lsSet(LS_KEY, JSON.stringify(db))) return false;
  enqueueChange(alasan || 'Perubahan data');
  return true;
}

/* ---- §6 isContoh (b) — peralihan data contoh -> data asli (tambahan v22) ----
   Masalah (audit ulang v21, Citra Fase 3 / Yoga Y-N2): klien yang memakai
   seed lalu menambah santri asli tetap `isContoh=true` — kotak kredensial
   admin123 tetap tampil di login (padahal sandi sudah diganti) DAN gerbang
   selftest (`bolehSelftest()`, yang bersandar pada flag ini) tetap terbuka,
   sehingga `?selftest=1` masih bisa menghapus data asli klien.
   Perbaikan: mutasi tulis asli PERTAMA yang disimpan lewat aplikasi
   membalik `db.isContoh` menjadi `false` (lihat `tandaiDataAsli()`,
   dipanggil semua fungsi mutasi di bawah). Yang TIDAK membalik flag:
   seed/`emptyData`, restore backup (`applyBackupData`/`restoreFromText`),
   selftest (guard di bawah), dan reset "Hapus semua data" (`clearAllData`
   memakai `emptyData`, lalu seed yang dipulihkan membawa flagnya sendiri).
   Begitu flag false, kotak kredensial login hilang (`kredensialAwalTampil`
   di app.js) dan `bolehSelftest()` false. */
var selftestAktif = false;
/* Kedalaman panggilan runEngineSelfTests (anti-rekursi): tes Y-N3 di
   dalam suite memanggil runEngineSelfTests BERSARANG — tanpa penjaga ini,
   panggilan bersarang itu menjalankan tes Y-N3-nya sendiri, yang
   memanggil lagi, dan seterusnya tanpa henti. Tes Y-N3 hanya jalan di
   kedalaman 1 (panggilan terluar); di kedalaman lebih dalam ia dilewati. */
var kedalamanSelftest = 0;
/* Override uji (HANYA dipakai tes baru §6 di runEngineSelfTests): saat
   `?selftest=1` ada di URL, `sedangSelftest()` menganggap mode selftest
   menyala walau flag di atas mati — supaya tulis BLOK C/WIRA2 di ujiUi
   tidak membalik flag (lihat di bawah). Tes §6 menyalakan override ini
   sesaat untuk membuktikan pembalikan bekerja, lalu mengembalikannya. */
var lewatiDeteksiUrlSelftest = false;
/* Dinyalakan runEngineSelfTests selama berjalan; app.js (Kirana) juga
   memanggilnya di awal/akhir runUiSelfTest — itu mekanisme kanoniknya.
   Dipulihkan ke nilai luar saat runEngineSelfTests selesai (tumpukan
   bersarang aman: panggilan bersarang menyimpan + mengembalikan). */
function setModeSelftest(aktif) { selftestAktif = !!aktif; return selftestAktif; }
function sedangSelftest() {
  if (selftestAktif) return true;
  if (lewatiDeteksiUrlSelftest) return false;
  /* Lapisan cadangan: pemicu `?selftest=1` di URL berarti sesi ini sedang
     menjalankan selftest UI (runUiSelfTest jalan SETELAH runEngineSelfTests
     selesai, saat flag sudah dimatikan lagi). Tanpa ini, tulis BLOK C
     (simpanSantri dsb. lewat form) akan membalik flag di tengah ujiUi dan
     mematahkan tes Panduan WIRA2 yang mengharapkan data contoh. Di
     pemakaian normal URL tidak pernah berisi `?selftest=1`, jadi perilaku
     produksi tidak berubah. */
  try {
    if (typeof location !== 'undefined' && location && typeof location.search === 'string' && /(?:^|[?&])selftest=1(?:&|$)/.test(location.search)) return true;
  } catch (e) { /* abaikan */ }
  return false;
}
/* Balik `isContoh` menjadi false. No-op bila sudah false, bila db belum
   ada, atau bila sedang selftest. Dipanggil semua fungsi mutasi tulis
   asli SEBELUM `save()`-nya (hanya di jalur sukses — validasi yang gagal
   return sebelum mencapai pemanggilan ini, jadi tidak membalik). */
function tandaiDataAsli() {
  if (!db || db.isContoh !== true) return false;
  if (sedangSelftest()) return false;
  db.isContoh = false;
  return true;
}
/* S1 (gerbang selftest, semantik v21 — dulu di app.js, di v22 fungsinya
   hilang saat merge; disediakan lagi dari engine supaya gerbangnya ada di
   satu tempat dan bisa diuji dari runEngineSelfTests): selftest hanya
   boleh jalan bila db masih data contoh. app.js boleh mendefinisikan
   ulang fungsi ini dengan semantik yang sama (dimuat sesudah engine). */
function bolehSelftest() {
  try { return !!(typeof db !== 'undefined' && db && db.isContoh); } catch (e) { return false; }
}
/* Kunci array data (bukan settings/pengguna): "berisi" = ada minimal satu
   record di salah satu kunci ini. Dipakai penjaga Y-N3 di bawah. */
var KUNCI_DATA_ISI = ['santri', 'guru', 'kelas', 'tabunganTx', 'target', 'keuanganTx', 'pertemuan', 'hafalanLog', 'pengumuman', 'nilai', 'alokasiWaktu', 'jadwalKbm', 'jadwalPiket', 'absensiGuru', 'rapbm', 'biaya'];
function dbPunyaIsi() {
  if (!db) return false;
  return KUNCI_DATA_ISI.some(function (k) { return Array.isArray(db[k]) && db[k].length > 0; });
}

/* DIUBAH v2: tanpa render()/toast(); UI yang memberi tahu pengguna.
   Y-N3 (tambahan v22): JANGAN reseed data asli yang berisi — `resetToSeed`
   menolak bila `db.isContoh !== true` DAN db berisi record (data klien:
   data + pengguna dibiarkan utuh, kembalikan db apa adanya). Boleh reseed
   bila data contoh, atau bila db KOSONG (tidak ada yang bisa hilang:
   keadaan sesudah "Hapus semua data" / blok DB-KOSONG selftest — di
   sinilah reseed dibutuhkan supaya selftest tidak meninggalkan db kosong;
   perbaikan merge §10c v21).
   `kredensialAdmin` (opsional, hanya dari ekor runEngineSelfTests): salinan
   record admin SEBELUM selftest berjalan; bila diberikan, sandi admin
   dipulihkan ke keadaan itu sesudah reseed (bukan sandi uji) — lihat
   runEngineSelfTests. Panggilan lain (UI, tengah suite) tidak
   memberikannya, jadi tidak ada pemulihan di sana. */
function resetToSeed(kredensialAdmin) {
  if (db && db.isContoh !== true && dbPunyaIsi()) return db;
  db = seedData();
  if (kredensialAdmin) {
    var admin = cariPengguna('admin');
    if (admin) {
      admin.salt = kredensialAdmin.salt;
      admin.hash = kredensialAdmin.hash;
      admin.wajibGantiSandi = kredensialAdmin.wajibGantiSandi;
      admin.sandiDiubahPada = kredensialAdmin.sandiDiubahPada;
      if (kredensialAdmin.nama != null) admin.nama = kredensialAdmin.nama;
      if (kredensialAdmin.dibuatPada != null) admin.dibuatPada = kredensialAdmin.dibuatPada;
    }
  }
  save('Reset ke data contoh');
  return db;
}

/* ---------------- Autentikasi lokal (tanpa server, tanpa library) ----------------
   Prinsip: kata sandi TIDAK PERNAH disimpan plaintext. Yang tersimpan di
   db.pengguna hanya { id, nama, peran, salt, hash, wajibGantiSandi, dibuatPada }
   dengan hash = 1000 ronde SHA-256 (ronde 1 = SHA-256(salt + ':' + sandi),
   ronde berikutnya = SHA-256(hasil ronde sebelumnya); lihat hashSandi).
   Salt acak per pengguna, jadi dua pengguna dengan sandi sama tetap punya
   hash berbeda. Sesi login hanya tersimpan di perangkat (kunci SESI_KEY),
   tidak ikut backup dan tidak dikirim ke Sheet. Batasan jujur: ini pengaman
   perangkat bersama, bukan keamanan tingkat server; siapa pun yang bisa
   membaca localStorage perangkat tetap bisa menyalin salt+hash, jadi
   perangkat harus dikunci. Begitu pula pemeriksaan peran peminta di
   tambahPengguna/resetSandiPengguna/hapusPengguna hanya menegakkan kontrak
   UI, bukan keamanan anti-console: siapa pun yang membuka DevTools tetap
   bisa memanggil fungsi engine langsung (lihat pemintaAdalahPimpinan).
   Semua fungsi auth memakai SATU bentuk hasil seperti mutasi lain:
     { ok: true, ... }  atau  { ok: false, error: 'kode-singkat', alasan: '...' }
   Alasan login gagal SELALU generik ("ID atau kata sandi salah"), baik ID
   tidak ditemukan maupun sandi salah, supaya tidak membocorkan mana yang salah. */

/* SHA-256 standar (FIPS 180-4), sinkron, murni JS. crypto.subtle sengaja
   tidak dipakai karena async dan engine ini sinkron. Diuji dengan vektor
   resmi: sha256('') dan sha256('abc') (lihat self-test).
   Konstanta SHA256_K ada di blok konstanta atas (sebelum load()). */
function sha256Hex(str) {
  function putarKanan(v, a) { return (v >>> a) | (v << (32 - a)); }
  function hex8(v) { return ('00000000' + (v >>> 0).toString(16)).slice(-8); }
  /* encodeURIComponent = UTF-8; unescape mengubahnya jadi string byte. */
  var s = unescape(encodeURIComponent(String(str == null ? '' : str)));
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var bytes = [], i, j;
  for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  var bitLen = s.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
  for (var off = 0; off < bytes.length; off += 64) {
    var w = [];
    for (i = 0; i < 16; i++) w[i] = ((bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3]) | 0;
    for (i = 16; i < 64; i++) {
      var s0 = putarKanan(w[i - 15], 7) ^ putarKanan(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      var s1 = putarKanan(w[i - 2], 17) ^ putarKanan(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (j = 0; j < 64; j++) {
      var S1 = putarKanan(e, 6) ^ putarKanan(e, 11) ^ putarKanan(e, 25);
      var ch = (e & f) ^ (~e & g);
      var t1 = (h + S1 + ch + SHA256_K[j] + w[j]) | 0;
      var S0 = putarKanan(a, 2) ^ putarKanan(a, 13) ^ putarKanan(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(hex8).join('');
}
/* S4 (ronde Bagas): salt acak 16 byte sebagai 32 karakter hex, dari
   crypto.getRandomValues bila tersedia; fallback Math.random (bukan
   untuk kunci enkripsi) hanya bila crypto tidak ada — jangan crash
   di lingkungan tanpa crypto (mis. jsdom lama). */
function buatSalt() {
  var hex = '0123456789abcdef', out = '', i;
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      for (i = 0; i < 16; i++) out += hex[bytes[i] >> 4] + hex[bytes[i] & 15];
      return out;
    }
  } catch (e) { /* jatuh ke fallback Math.random di bawah */ }
  for (i = 0; i < 32; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}
/* S1 (hardening): hash sandi memakai 1000 ronde SHA-256, bukan satu ronde.
   Ronde 1 = sha256Hex(salt + ':' + sandi); ronde berikutnya meng-hash hasil
   ronde sebelumnya. Deterministis; hash seed dihitung ulang otomatis saat
   seed (seedPengguna memanggil hashSandi). Belum ada pengguna produksi
   (baru pratinjau + seed), jadi tidak ada hash lama yang perlu dimigrasi. */
function hashSandi(salt, sandi) {
  var hasil = sha256Hex(String(salt) + ':' + String(sandi == null ? '' : sandi));
  for (var i = 1; i < HASH_RONDE; i++) hasil = sha256Hex(hasil);
  return hasil;
}

/* Salt seed ada di blok konstanta atas (SALT_SEED_ADMIN / SALT_SEED_GURU1). */
function seedPengguna() {
  return [
    { id: 'admin', nama: 'Pimpinan', peran: 'Pimpinan', salt: SALT_SEED_ADMIN, hash: hashSandi(SALT_SEED_ADMIN, 'admin123'), wajibGantiSandi: true, dibuatPada: '2026-11-15', sandiDiubahPada: 0 },
    { id: 'guru1', nama: 'Guru 1', peran: 'Guru', salt: SALT_SEED_GURU1, hash: hashSandi(SALT_SEED_GURU1, 'guru123'), wajibGantiSandi: true, dibuatPada: '2026-11-15', sandiDiubahPada: 0 }
  ];
}
/* Bentuk pengguna yang aman dibagikan ke UI: tanpa salt dan hash. */
function penggunaPublik(p) {
  return p ? { id: p.id, nama: p.nama, peran: p.peran } : null;
}
/* Boundary restore: entri pengguna dari file cadangan adalah input luar.
   Hanya yang bentuknya lengkap yang dipakai; sisanya dibuang. */
function penggunaValid(p) {
  return !!p && typeof p.id === 'string' && p.id.trim() !== '' &&
    typeof p.salt === 'string' && p.salt !== '' &&
    typeof p.hash === 'string' && /^[0-9a-f]{64}$/.test(p.hash) &&
    (p.peran === 'Pimpinan' || p.peran === 'Guru');
}
function bersihkanPengguna(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(penggunaValid).map(function (p) {
    return {
      id: p.id.trim(), nama: String(p.nama || p.id).trim() || p.id.trim(), peran: p.peran,
      salt: p.salt, hash: p.hash, wajibGantiSandi: p.wajibGantiSandi !== false,
      dibuatPada: String(p.dibuatPada || todayStr()),
      sandiDiubahPada: Number(p.sandiDiubahPada) || 0
    };
  });
}
function hasilAuthGagal(kode, alasan) { return { ok: false, error: kode, alasan: alasan }; }
var ALASAN_LOGIN_GAGAL = 'ID atau kata sandi salah';

function cariPengguna(id) {
  var kunci = String(id == null ? '' : id).trim().toLowerCase();
  if (!kunci || !Array.isArray(db.pengguna)) return null;
  var ketemu = db.pengguna.filter(function (p) { return String(p.id).trim().toLowerCase() === kunci; });
  return ketemu.length ? ketemu[0] : null;
}
/* Celah Kirana #2: daftar SEMUA pengguna dalam bentuk publik (tanpa
   salt/hash), terurut berdasarkan id — dipakai UI Kelola Pengguna, supaya
   pengguna baru yang ditambahkan Pimpinan ikut tampil, bukan cuma seed. */
function daftarPengguna() {
  if (!Array.isArray(db.pengguna)) return [];
  return db.pengguna.slice().sort(function (a, b) {
    return String(a.id).localeCompare(String(b.id));
  }).map(function (p) {
    return { id: p.id, nama: p.nama, peran: p.peran, wajibGantiSandi: p.wajibGantiSandi === true };
  });
}
function verifikasiLogin(id, sandi) {
  var p = cariPengguna(id);
  if (!p || !p.salt || !p.hash) return hasilAuthGagal('login-gagal', ALASAN_LOGIN_GAGAL);
  if (hashSandi(p.salt, sandi) !== p.hash) return hasilAuthGagal('login-gagal', ALASAN_LOGIN_GAGAL);
  return hasilOk({ pengguna: penggunaPublik(p), wajibGantiSandi: p.wajibGantiSandi === true });
}
function masukPengguna(id, sandi) {
  var cek = verifikasiLogin(id, sandi);
  if (!cek.ok) return cek;
  var sekarang = Date.now();
  var sesi = {
    id: cek.pengguna.id, nama: cek.pengguna.nama, peran: cek.pengguna.peran,
    masukPada: sekarang, kedaluwarsa: sekarang + SESI_MASA_BERLAKU_MS
  };
  lsSet(SESI_KEY, JSON.stringify(sesi));
  return hasilOk({ pengguna: cek.pengguna, wajibGantiSandi: cek.wajibGantiSandi });
}
function sesiAktif() {
  var mentah;
  try { mentah = lsGet(SESI_KEY); } catch (e) { return null; }
  if (!mentah) return null;
  var sesi;
  try { sesi = JSON.parse(mentah); } catch (e) { lsRemove(SESI_KEY); return null; }
  if (!sesi || !sesi.id || !sesi.kedaluwarsa || Date.now() > Number(sesi.kedaluwarsa)) {
    lsRemove(SESI_KEY);
    return null;
  }
  /* T-08: sesi batal bila pengguna sudah dihapus, atau bila sandinya
     diubah (reset Pimpinan / ganti) SETELAH sesi ini dibuat. Yang
     membedakan "diubah setelah sesi dibuat" adalah stempel
     `sandiDiubahPada` (ms sejak epoch) pada pengguna, dibandingkan dengan
     `sesi.masukPada`. Sesi yang dibuat SETELAH perubahan sandi tetap
     berlaku (masukPada >= sandiDiubahPada). */
  var p = cariPengguna(sesi.id);
  if (!p) { lsRemove(SESI_KEY); return null; }
  if (p.sandiDiubahPada && Number(sesi.masukPada) < Number(p.sandiDiubahPada)) {
    lsRemove(SESI_KEY);
    return null;
  }
  return { id: sesi.id, nama: sesi.nama, peran: sesi.peran, wajibGantiSandi: p ? p.wajibGantiSandi === true : false };
}
function keluarPengguna() { lsRemove(SESI_KEY); return true; }
/* S9: pemeriksaan peran peminta. Ketiga fungsi kelola pengguna di bawah
   WAJIB dipanggil dengan id peminta, dan peminta harus Pimpinan — kalau
   bukan, ditolak dengan error 'bukan-pimpinan' SEBELUM validasi lain.
   BATASAN JUJUR: pemeriksaan ini menegakkan kontrak UI (tombol Kelola
   Pengguna hanya tampil untuk Pimpinan), BUKAN keamanan anti-console.
   Siapa pun yang bisa membuka DevTools tetap bisa memanggil fungsi engine
   ini langsung dengan olehId 'admin', karena tidak ada server yang
   memverifikasi siapa peminta sebenarnya; data dan kredensial tetap
   tersimpan di perangkat yang sama. */
function pemintaAdalahPimpinan(olehId) {
  var peminta = cariPengguna(olehId);
  return !!peminta && peminta.peran === 'Pimpinan';
}
/* S5 (ronde Bagas): aturan sandi BARU/diubah — berlaku di tambahPengguna,
   resetSandiPengguna, gantiSandiSendiri, gantiSandiPaksa. Minimal 8
   karakter, tolak sandi umum, tolak sandi yang sama dengan ID pengguna.
   HANYA untuk sandi baru/diubah — login dengan sandi seed lama
   (admin123/guru123) tetap jalan karena verifikasiLogin tidak memakai
   aturan ini. Mengembalikan null bila valid, atau hasil gagal
   { ok:false, error, alasan } bila tidak. */
var SANDI_UMUM = ['12345678', 'password', '123456', 'qwerty', 'admin123', 'guru123', 'password123', '123456789', 'qwerty123', '11111111'];
function sandiBaruValid(sandi, idPengguna) {
  var s = String(sandi == null ? '' : sandi);
  if (s.length < 8) return hasilAuthGagal('sandi-terlalu-pendek', 'Kata sandi minimal 8 karakter.');
  if (idPengguna && s.toLowerCase() === String(idPengguna).trim().toLowerCase()) return hasilAuthGagal('sandi-lemah', 'Kata sandi tidak boleh sama dengan ID pengguna.');
  if (SANDI_UMUM.indexOf(s.toLowerCase()) !== -1) return hasilAuthGagal('sandi-lemah', 'Kata sandi ini terlalu umum. Pilih kata sandi lain.');
  return null;
}
function tambahPengguna(input) {
  var data = input || {};
  if (!pemintaAdalahPimpinan(data.olehId)) return hasilAuthGagal('bukan-pimpinan', 'Hanya Pimpinan yang bisa menambah pengguna.');
  var id = String(data.id == null ? '' : data.id).trim();
  var nama = String(data.nama == null ? '' : data.nama).trim();
  var peran = data.peran;
  var sandi = String(data.sandi == null ? '' : data.sandi);
  if (!id) return hasilAuthGagal('id-kosong', 'ID pengguna wajib diisi.');
  if (cariPengguna(id)) return hasilAuthGagal('id-duplikat', 'ID pengguna sudah dipakai.');
  if (!nama) return hasilAuthGagal('nama-kosong', 'Nama pengguna wajib diisi.');
  if (peran !== 'Pimpinan' && peran !== 'Guru') return hasilAuthGagal('peran-tidak-valid', 'Peran hanya boleh Pimpinan atau Guru.');
  var cekSandiBaru = sandiBaruValid(sandi, id);
  if (cekSandiBaru) return cekSandiBaru;
  var salt = buatSalt();
  db.pengguna.push({
    id: id, nama: nama, peran: peran, salt: salt, hash: hashSandi(salt, sandi),
    wajibGantiSandi: true, dibuatPada: todayStr(), sandiDiubahPada: 0
  });
  save('Tambah pengguna ' + id);
  return hasilOk({ pengguna: { id: id, nama: nama, peran: peran } });
}
function resetSandiPengguna(id, sandiBaru, olehId) {
  if (!pemintaAdalahPimpinan(olehId)) return hasilAuthGagal('bukan-pimpinan', 'Hanya Pimpinan yang bisa mereset kata sandi pengguna.');
  var p = cariPengguna(id);
  if (!p) return hasilAuthGagal('tidak-ditemukan', 'Pengguna tidak ditemukan.');
  var sandi = String(sandiBaru == null ? '' : sandiBaru);
  var cekSandiBaru = sandiBaruValid(sandi, id);
  if (cekSandiBaru) return cekSandiBaru;
  p.salt = buatSalt();
  p.hash = hashSandi(p.salt, sandi);
  p.wajibGantiSandi = true;
  /* T-08: reset oleh Pimpinan membatalkan sesi yang sudah berjalan
     (sesiAktif membandingkan masukPada dengan stempel ini). */
  p.sandiDiubahPada = Date.now();
  save('Reset kata sandi ' + p.id);
  return hasilOk({ pengguna: penggunaPublik(p) });
}
function hapusPengguna(id, idPeminta) {
  if (!pemintaAdalahPimpinan(idPeminta)) return hasilAuthGagal('bukan-pimpinan', 'Hanya Pimpinan yang bisa menghapus pengguna.');
  var p = cariPengguna(id);
  if (!p) return hasilAuthGagal('tidak-ditemukan', 'Pengguna tidak ditemukan.');
  if (String(idPeminta == null ? '' : idPeminta).trim().toLowerCase() === String(p.id).trim().toLowerCase()) {
    return hasilAuthGagal('hapus-diri-sendiri', 'Tidak bisa menghapus akun sendiri.');
  }
  /* Penjaga Pimpinan terakhir: lewat API publik kini praktis tidak
     terjangkau (peminta Pimpinan yang berbeda dari target berarti sudah
     ada minimal 2 Pimpinan), tapi dipertahankan sebagai pertahanan
     berlapis kalau pemeriksaan peran di atas suatu saat dilonggarkan. */
  if (p.peran === 'Pimpinan' && db.pengguna.filter(function (x) { return x.peran === 'Pimpinan'; }).length <= 1) {
    return hasilAuthGagal('pimpinan-terakhir', 'Pimpinan terakhir tidak bisa dihapus. Minimal harus ada 1 Pimpinan.');
  }
  db.pengguna = db.pengguna.filter(function (x) { return x !== p; });
  save('Hapus pengguna ' + p.id);
  return hasilOk({ nama: p.nama });
}
function gantiSandiSendiri(id, sandiLama, sandiBaru) {
  var cek = verifikasiLogin(id, sandiLama);
  if (!cek.ok) return cek;
  var sandi = String(sandiBaru == null ? '' : sandiBaru);
  /* R6: sandi baru harus berbeda dari sandi lama (sandi lama sudah
     terverifikasi benar di atas, jadi perbandingan plaintext aman di sini).
     Dicek DULU supaya sandi yang sama dengan lama selalu dilaporkan
     'sandi-sama', bukan 'sandi-lemah'. */
  if (sandi === String(sandiLama == null ? '' : sandiLama)) return hasilAuthGagal('sandi-sama', 'Kata sandi baru harus berbeda dari kata sandi lama.');
  var cekSandiBaru = sandiBaruValid(sandi, id);
  if (cekSandiBaru) return cekSandiBaru;
  var p = cariPengguna(id);
  p.salt = buatSalt();
  p.hash = hashSandi(p.salt, sandi);
  p.wajibGantiSandi = false;
  /* T-08: ganti sandi sendiri ikut menandai sandiDiubahPada, tapi sesi
     pemiliknya sendiri harus tetap hidup — perbarui masukPada sesinya
     ke sekarang supaya sesiAktif tidak membatalkannya. */
  p.sandiDiubahPada = Date.now();
  perbaruiMasukPadaSesi(id);
  save('Ganti kata sandi ' + p.id);
  return hasilOk({ pengguna: penggunaPublik(p) });
}
/* T-08: majukan `masukPada` sesi milik id ke sekarang (tanpa mengubah
   kedaluwarsa). Dipakai saat pengguna mengganti sandinya SENDIRI supaya
   sesinya tetap hidup; TIDAK dipakai saat reset oleh Pimpinan (sesi
   orang lain itu memang harus batal). */
function perbaruiMasukPadaSesi(id) {
  var mentah;
  try { mentah = lsGet(SESI_KEY); } catch (e) { return; }
  if (!mentah) return;
  var sesi;
  try { sesi = JSON.parse(mentah); } catch (e) { return; }
  if (!sesi || String(sesi.id).trim().toLowerCase() !== String(id == null ? '' : id).trim().toLowerCase()) return;
  sesi.masukPada = Date.now();
  lsSet(SESI_KEY, JSON.stringify(sesi));
}
/* T-01 (ganti sandi paksa TANPA verifikasi sandi lama): dipakai HANYA di
   layar ganti sandi paksa. Syarat: ada sesi aktif yang cocok dengan id DAN
   pengguna itu masih `wajibGantiSandi`. Sesi aktif yang dibuat dari login
   yang berhasil sudah membuktikan identitas — penyerang yang sudah memegang
   sesi itu sudah bisa melakukan segalanya, jadi verifikasi ulang sandi lama
   tidak menambah apa-apa; sebaliknya, memintanya membuat layar ini bisa
   terkunci total setelah muat ulang (sandi lama hanya tersimpan di memori).
   Alur NORMAL (modal "Ubah kata sandi saya") tetap memakai
   gantiSandiSendiri yang memverifikasi sandi lama — jangan longgarkan itu.
   Sandi baru tidak bisa dibandingkan dengan sandi lama di sini (hash
   lama tidak bisa dibalik), jadi pemeriksaan "berbeda dari lama" dilewati
   dengan sadar; minimal 8 karakter tetap ditegakkan. */
function gantiSandiPaksa(id, sandiBaru) {
  var sesi;
  try { sesi = sesiAktif(); } catch (e) { sesi = null; }
  if (!sesi) return hasilAuthGagal('sesi-tidak-valid', 'Sesi sudah tidak aktif. Masuk lagi.');
  if (String(sesi.id).trim().toLowerCase() !== String(id == null ? '' : id).trim().toLowerCase()) {
    return hasilAuthGagal('sesi-tidak-valid', 'Sesi tidak cocok dengan pengguna ini. Masuk lagi.');
  }
  var p = cariPengguna(id);
  if (!p) return hasilAuthGagal('tidak-ditemukan', 'Pengguna tidak ditemukan.');
  if (p.wajibGantiSandi !== true) return hasilAuthGagal('tidak-wajib', 'Pengguna ini tidak wajib mengganti kata sandi.');
  var sandi = String(sandiBaru == null ? '' : sandiBaru);
  /* R6 (dipertahankan dari gantiSandiSendiri): sandi baru harus berbeda
     dari sandi lama — dicek lewat hash dengan salt lama, tanpa perlu tahu
     sandi lama dalam bentuk plaintext. Dicek DULU supaya sandi yang sama
     dengan lama selalu dilaporkan 'sandi-sama', bukan 'sandi-lemah'. */
  if (hashSandi(p.salt, sandi) === p.hash) return hasilAuthGagal('sandi-sama', 'Kata sandi baru harus berbeda dari kata sandi lama.');
  var cekSandiBaru = sandiBaruValid(sandi, id);
  if (cekSandiBaru) return cekSandiBaru;
  p.salt = buatSalt();
  p.hash = hashSandi(p.salt, sandi);
  p.wajibGantiSandi = false;
  p.sandiDiubahPada = Date.now();
  perbaruiMasukPadaSesi(id);
  save('Ganti kata sandi paksa ' + p.id);
  return hasilOk({ pengguna: penggunaPublik(p) });
}

/* ---- Helper murni (verbatim v1) ---- */
function todayStr() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
}

function rupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* Batas ukuran logo yang disimpan (Y3, v22): 1 MB diukur pada string
   data URL logo yang disimpan (setelah downscale di jalur UI). Batas ini
   ditegakkan di simpanIdentitas(), BUKAN di fotoAman() — supaya logo
   valid lama yang sudah tersimpan dan foto santri/guru tetap lolos
   render (logoAman/bersihkanFoto) walau ukurannya di atas batas baru. */
var LOGO_MAX_BYTES = 1024 * 1024; /* 1 MB */

function fotoAman(f) {
  if (typeof f !== 'string') return false;
  var m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(f);
  if (!m) return false;
  /* Y4 (v22): prefix saja TIDAK cukup — isi base64 harus benar-benar
     gambar. Periksa magic bytes dari 24 karakter base64 pertama (18 byte,
     cukup untuk WebP yang butuh 12 byte) supaya string raksasa tidak
     perlu di-decode seluruhnya. PNG 89 50 4E 47 0D 0A 1A 0A, JPEG FF D8 FF,
     WebP 'RIFF' + 4 byte ukuran + 'WEBP'. Gagal decode = tidak aman.
     Metadata tEXt/iTXt PNG TIDAK dibersihkan di sini: jalur pilih-file UI
     (onPhotoChange) sudah me-render ulang lewat canvas sehingga metadata
     ikut terbuang; jalur simpan langsung hanya butuh magic bytes. */
  var awal;
  try {
    if (typeof atob !== 'function') return false;
    awal = atob(m[2].slice(0, 24));
  } catch (e) { return false; }
  function byte(i) { return awal.charCodeAt(i) & 0xff; }
  if (m[1] === 'png') {
    return awal.length >= 8 && byte(0) === 0x89 && byte(1) === 0x50 && byte(2) === 0x4e && byte(3) === 0x47 && byte(4) === 0x0d && byte(5) === 0x0a && byte(6) === 0x1a && byte(7) === 0x0a;
  }
  if (m[1] === 'jpeg') {
    return awal.length >= 3 && byte(0) === 0xff && byte(1) === 0xd8 && byte(2) === 0xff;
  }
  return awal.length >= 12 && awal.slice(0, 4) === 'RIFF' && awal.slice(8, 12) === 'WEBP';
}

function bersihkanFoto(data) {
  if (!data) return;
  (data.santri || []).forEach(function (s) { if (s.foto && !fotoAman(s.foto)) delete s.foto; });
  (data.guru || []).forEach(function (g) { if (g.foto && !fotoAman(g.foto)) delete g.foto; });
}

function tglValid(t) {
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  var b = parseInt(t.slice(5, 7), 10), h = parseInt(t.slice(8, 10), 10);
  return b >= 1 && b <= 12 && h >= 1 && h <= 31;
}

function bersihkanTanggal(data) {
  if (!data) return;
  function periksa(list, kunci) {
    (list || []).forEach(function (r) { if (r[kunci] && !tglValid(r[kunci])) r[kunci] = ''; });
  }
  periksa(data.santri, 'statusTanggal');
  periksa(data.nilai, 'tanggal');
  periksa(data.keuanganTx, 'tanggal');
  periksa(data.pertemuan, 'tanggal');
  periksa(data.tabunganTx, 'tanggal');
  periksa(data.hafalanLog, 'tanggal');
  periksa(data.pengumuman, 'tanggal');
  periksa(data.absensiGuru, 'tanggal');
}

function santriById(id) { return db.santri.find(function (s) { return s.id === id; }); }

function guruById(id) { return db.guru.find(function (g) { return g.id === id; }); }

function kelasById(id) { return db.kelas.find(function (k) { return k.id === id; }); }

function santriAktif() { return db.santri.filter(function (s) { return s.status === 'Aktif' && jenjangCocok(s.jenjang); }); }

/* ---- Jenis kelamin (jk) ---- */
/* Nilai kanonik: 'L' (Laki-laki) atau 'P' (Perempuan); '' = belum diisi
   (data lama/backup tanpa jk — TIDAK ditebak dari nama). Satu-satunya
   tempat validasi jk: normalisasiJk() dipakai di boundary input
   (simpanSantri dan importRows); di dalam engine, jk sudah kanonik. */
var JK_LABEL = { L: 'Laki-laki', P: 'Perempuan' };
function labelJk(jk) { return JK_LABEL[jk] || ''; }
function normalisasiJk(nilai) {
  if (nilai == null) return { ok: true, jk: '' };
  var t = String(nilai).trim().toLowerCase();
  if (!t) return { ok: true, jk: '' };
  if (t === 'l' || t === 'laki-laki') return { ok: true, jk: 'L' };
  if (t === 'p' || t === 'perempuan') return { ok: true, jk: 'P' };
  return { ok: false, jk: '', error: 'jk-tidak-valid', message: 'Jenis kelamin harus L, P, "Laki-laki", atau "Perempuan".' };
}
/* Hitung L/P/kosong dari daftar santri apa pun. Nilai selain 'L'/'P'
   (termasuk undefined dan '') dihitung sebagai kosong. */
function rekapGender(list) {
  var r = { l: 0, p: 0, kosong: 0 };
  (list || []).forEach(function (s) {
    if (s.jk === 'L') r.l++;
    else if (s.jk === 'P') r.p++;
    else r.kosong++;
  });
  return r;
}

function saldoKas(jenjang) {
  var masuk = 0, keluar = 0;
  db.keuanganTx.forEach(function (t) {
    if (jenjang && jenjang !== 'Semua' && t.jenjang && t.jenjang !== jenjang) return;
    if (t.jenis === 'Masuk') masuk += t.jumlah; else keluar += t.jumlah;
  });
  return { masuk: masuk, keluar: keluar, saldo: masuk - keluar };
}

function totalTabungan() {
  return santriAktif().reduce(function (a, s) { return a + (s.tabungan || 0); }, 0);
}

function rataKehadiran() {
  var a = santriAktif();
  if (!a.length) return 0;
  return Math.round(a.reduce(function (x, s) { return x + (s.kehadiran || 0); }, 0) / a.length);
}

function predikat(nilai) {
  if (nilai >= 90) return 'A (Sangat Baik)';
  if (nilai >= 80) return 'B (Baik)';
  if (nilai >= 70) return 'C (Cukup)';
  if (nilai >= 60) return 'D (Kurang)';
  return 'E (Perlu Bimbingan)';
}

function naikJilid(jilid) {
  var i = JILID_LIST.indexOf(jilid);
  if (i < 0 || i >= JILID_LIST.length - 1) return jilid;
  return JILID_LIST[i + 1];
}

function initials(nama) {
  return nama.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
}

function fmtTanggal(tgl) {
  if (!tgl) return '-';
  if (!tglValid(tgl)) return '';
  var p = tgl.split('-');
  var bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return parseInt(p[2], 10) + ' ' + bulan[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

/* ---- CSV (verbatim v1) ---- */
/* S2 (ronde Bagas, OWASP CSV Injection): sel yang (setelah spasi di depan
   dibuang) diawali =, +, - atau @ diawali kutip tunggal (') supaya
   spreadsheet tidak mengeksekusinya sebagai rumus. Satu tempat — semua
   export (toCSV) ikut aman. */
function csvEscape(v) {
  var s = String(v == null ? '' : v);
  if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function parseCSV(teks) {
  var rows = [], row = [], cur = '', inQ = false;
  var s = String(teks || '').replace(/^\uFEFF/, '');
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; } }
      else { cur += c; }
    } else if (c === '"') { inQ = true; }
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else { cur += c; }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
}

function toCSV(rows) {
  return rows.map(function (r) { return r.map(csvEscape).join(','); }).join('\n');
}

var CSV_TEMPLATES = {
  murid: {
    header: ['nama', 'nis', 'kelas', 'angkatan', 'rombel', 'jenjang', 'wali', 'hp wali', 'alamat', 'Jenis Kelamin'],
    contoh: [
      ['Ahmad Contoh', '202499', 'Iqra 1', '2024', 'A', 'TPQ', 'Bpk. Contoh', '081200000099', 'Jl. Contoh 1', 'Laki-laki'],
      ['Siti Contoh', '202498', 'Kelas 1', '2024', 'B', 'Ibtidaiyah', 'Ibu Contoh', '081200000098', 'Jl. Contoh 2', 'Perempuan']
    ]
  },
  guru: {
    header: ['nama', 'kelas', 'peran', 'jenjang', 'hp', 'honor'],
    contoh: [
      ['Ustadz Contoh', 'Iqra 1', 'Guru', 'TPQ', '081200000199', '800000'],
      ['Ustadzah Contoh', 'Kelas 1', 'Wali Kelas', 'Ibtidaiyah', '081200000198', '900000']
    ]
  },
  nilai: {
    header: ['santri (nama atau NIS)', 'jenis', 'mapel', 'nilai'],
    contoh: [
      ['Ahmad Fauzi', 'Harian', 'Iqra', '85'],
      ['202402', 'Imda', 'Tahfidz', '92']
    ]
  }
};

function normHeader(h) { return String(h || '').trim().toLowerCase(); }

function importRows(jenis, rows) {
  var lap = { jenis: jenis, berhasil: 0, gagal: [] };
  if (!rows || rows.length < 2) { lap.gagal.push({ baris: 0, alasan: 'File kosong atau hanya berisi judul kolom.' }); return lap; }
  var header = rows[0].map(normHeader);
  function col(nama) { return header.indexOf(nama); }
  var nisAda = {};
  db.santri.forEach(function (s) { nisAda[s.nis] = true; });
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i], no = i + 1;
    var v = function (nama) { var c = col(nama); return c === -1 ? '' : String(r[c] == null ? '' : r[c]).trim(); };
    try {
      if (jenis === 'murid') {
        var nama = v('nama'), nis = v('nis');
        if (!nama) { lap.gagal.push({ baris: no, alasan: 'Nama kosong.' }); continue; }
        if (!nis) { lap.gagal.push({ baris: no, alasan: 'NIS kosong.' }); continue; }
        if (nisAda[nis]) { lap.gagal.push({ baris: no, alasan: 'NIS ' + nis + ' sudah ada.' }); continue; }
        var kelas = v('kelas') || 'Iqra 1';
        var kelasRow = db.kelas.find(function (k) { return k.nama === kelas; });
        /* T-02: nama kelas pada murid adalah label; kelas yang belum ada di
           daftar kelas TIDAK ditolak — tapi sekarang benar-benar dibuatkan
           entri kelasnya (dulu hanya label, daftar kelas tetap kosong).
           Jenjang kelas baru mengikuti kolom jenjang import. */
        var jenjang = v('jenjang');
        if (!jenjang) jenjang = kelasRow ? (kelasRow.jenjang || 'TPQ') : 'TPQ'; /* kolom kosong: ikut jenjang kelasnya, atau TPQ */
        else if (jenjang !== 'TPQ' && jenjang !== 'Ibtidaiyah') { lap.gagal.push({ baris: no, alasan: 'Jenjang harus TPQ atau Ibtidaiyah.' }); continue; }
        else if (kelasRow && (kelasRow.jenjang || 'TPQ') !== jenjang) { lap.gagal.push({ baris: no, alasan: 'Kelas "' + kelas + '" adalah kelas ' + (kelasRow.jenjang || 'TPQ') + ', bukan ' + jenjang + '.' }); continue; }
        if (!kelasRow) {
          db.kelas.push({ id: uid('k'), nama: kelas, ustadz: '', jadwal: '', ruang: '', jenjang: jenjang });
        }
        /* Jenis kelamin: kolom "Jenis Kelamin" menerima L/P/Laki-laki/
           Perempuan (apa pun huruf besar/kecilnya, spasi diabaikan).
           Kolom kosong atau tidak ada = '' (diterima, dihitung
           terpisah sebagai kosong). Nilai lain menolak barisnya. */
        var jkN = normalisasiJk(v('jenis kelamin'));
        if (!jkN.ok) { lap.gagal.push({ baris: no, alasan: 'Jenis kelamin harus L, P, "Laki-laki", atau "Perempuan".' }); continue; }
        db.santri.push({
          id: uid('s'), nis: nis, nama: nama, jk: jkN.jk, kelas: kelas,
          jenjang: jenjang,
          jilid: kelas.indexOf('Tahfidz') === 0 ? 'Tahfidz Juz 30' : (JILID_LIST.indexOf(kelas) !== -1 ? kelas : 'Iqra 1'),
          halaman: 1, hafalan: 'Belum mulai', wali: v('wali'), hpWali: v('hp wali'),
          alamat: v('alamat'), tabungan: 0, sppStatus: 'Belum', sppReminderSent: false,
          kehadiran: 100, angkatan: v('angkatan') || '2026', rombel: v('rombel') || 'A', status: 'Aktif'
        });
        nisAda[nis] = true;
        lap.berhasil++;
      } else if (jenis === 'guru') {
        var gn = v('nama');
        if (!gn) { lap.gagal.push({ baris: no, alasan: 'Nama kosong.' }); continue; }
        /* T-15: guru dengan nama yang sama (abaikan huruf besar/kecil)
           ditolak — sebelumnya dua "Ustadz Ahmad" bisa masuk berdampingan. */
        if (db.guru.some(function (g) { return String(g.nama).trim().toLowerCase() === gn.toLowerCase(); })) { lap.gagal.push({ baris: no, alasan: 'Nama guru "' + gn + '" sudah ada.' }); continue; }
        var peran = v('peran');
        /* T-15: peran di luar daftar ditolak dengan alasan (bukan diam-diam
           diubah jadi "Guru"). Kolom kosong tetap memakai "Guru". */
        if (peran && PERAN_GURU.indexOf(peran) === -1) { lap.gagal.push({ baris: no, alasan: 'Peran harus salah satu dari: ' + PERAN_GURU.join(', ') + '.' }); continue; }
        if (!peran) peran = 'Guru';
        var jenjangG = v('jenjang');
        if (!jenjangG) jenjangG = 'TPQ';
        else if (jenjangG !== 'TPQ' && jenjangG !== 'Ibtidaiyah' && jenjangG !== 'TPQ dan Ibtidaiyah') { lap.gagal.push({ baris: no, alasan: 'Jenjang harus TPQ, Ibtidaiyah, atau "TPQ dan Ibtidaiyah".' }); continue; }
        var kelasG = v('kelas') || 'Iqra 1'; /* label bebas, sama seperti murid: tidak wajib terdaftar di daftar kelas */
        var honor = parseInt(v('honor').replace(/[^0-9]/g, ''), 10);
        if (isNaN(honor) || honor < 0) { lap.gagal.push({ baris: no, alasan: 'Honor harus angka 0 atau lebih.' }); continue; }
        db.guru.push({ id: uid('g'), nama: gn, kelas: kelasG, hp: v('hp'), honor: honor, honorStatus: 'Belum', peran: peran, jenjang: jenjangG });
        lap.berhasil++;
      } else if (jenis === 'nilai') {
        var kunci = v('santri (nama atau nis)') || v('santri');
        /* T-15: NIS diutamakan. Bila kunci bukan NIS, cari berdasarkan nama;
           bila nama itu dipakai lebih dari satu santri, tolak barisnya
           ("Nama kembar, pakai NIS") daripada menempelkan nilai ke santri
           pertama yang cocok secara sembarang. */
        var santri = db.santri.find(function (s) { return s.nis === kunci; });
        if (!santri) {
          var cocokNama = db.santri.filter(function (s) { return s.nama.toLowerCase() === kunci.toLowerCase(); });
          if (cocokNama.length > 1) { lap.gagal.push({ baris: no, alasan: 'Nama kembar, pakai NIS.' }); continue; }
          santri = cocokNama[0];
        }
        if (!santri) { lap.gagal.push({ baris: no, alasan: 'Santri "' + kunci + '" tidak ditemukan.' }); continue; }
        var jns = v('jenis');
        if (JENIS_NILAI.indexOf(jns) === -1) { lap.gagal.push({ baris: no, alasan: 'Jenis harus Harian, Imda, atau Praktek.' }); continue; }
        var mapel = v('mapel') || 'Iqra';
        var nil = Number(v('nilai'));
        if (isNaN(nil) || nil < 0 || nil > 100) { lap.gagal.push({ baris: no, alasan: 'Nilai harus 0 sampai 100.' }); continue; }
        db.nilai.push({ id: uid('n'), santriId: santri.id, jenis: jns, mapel: mapel, nilai: nil, tanggal: todayStr(), catatan: 'Import CSV' });
        lap.berhasil++;
      }
    } catch (e) { lap.gagal.push({ baris: no, alasan: 'Baris tidak bisa dibaca.' }); }
  }
  if (lap.berhasil > 0) { tandaiDataAsli(); save('Import CSV ' + jenis + ' (' + lap.berhasil + ' baris)'); }
  return lap;
}

/* ---- Semester (verbatim v1) ---- */
var SEMESTER_LIST = [
  { id: 'ganjil-2627', label: 'Semester Ganjil 2026/2027', mulai: '2026-07-01', sampai: '2026-12-31' },
  { id: 'genap-2627', label: 'Semester Genap 2026/2027', mulai: '2027-01-01', sampai: '2027-06-30' },
  { id: 'ganjil-2526', label: 'Semester Ganjil 2025/2026', mulai: '2025-07-01', sampai: '2025-12-31' }
];

function semesterById(id) {
  var s = SEMESTER_LIST.find(function (x) { return x.id === id; });
  return s || SEMESTER_LIST[0];
}

function nilaiDalamSemester(n, semesterId) {
  if (!semesterId) return true;
  var sem = semesterById(semesterId);
  var t = n.tanggal || '';
  return t >= sem.mulai && t <= sem.sampai;
}

/* ---- Navigasi sebagai DATA (verbatim v1, tanpa render) ---- */
var MODULES = [
  { id: 'dashboard', label: 'Beranda', icon: 'Be', group: 'Utama' },
  { id: 'santri', label: 'Santri', icon: 'Sa', group: 'Utama' },
  { id: 'tabungan', label: 'Tabungan', icon: 'Ta', group: 'Utama' },
  { id: 'keuangan', label: 'Keuangan', icon: 'Ke', group: 'Utama' },
  { id: 'rapbm', label: 'RAPBM', icon: 'Ra', group: 'Utama' },
  { id: 'kelas', label: 'Kelas', icon: 'Kl', group: 'Utama' },
  { id: 'hafalan', label: 'Hafalan/Iqra', icon: 'Ha', group: 'Utama' },
  { id: 'guru', label: 'Guru', icon: 'Gu', group: 'Utama' },
  { id: 'pengumuman', label: 'Pengumuman', icon: 'Pe', group: 'Utama' },
  { id: 'laporan', label: 'Laporan', icon: 'La', group: 'Utama' },
  { id: 'penilaian', label: 'Penilaian', icon: 'Ni', group: 'Baru' },
  { id: 'kbm', label: 'KBM', icon: 'KB', group: 'Baru' },
  { id: 'kemuridan', label: 'Kemuridan', icon: 'Mu', group: 'Baru' },
  { id: 'khidmah', label: 'Sahabat Khidmah', icon: 'Kh', group: 'Baru' },
  { id: 'grafik', label: 'Grafik', icon: 'Gr', group: 'Baru' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'Pg', group: 'Lainnya' }
];

var BOTTOM_NAV = ['dashboard', 'santri', 'tabungan', 'keuangan', 'kelas'];

/* ---- Akses berdasarkan peran (dipakai UI untuk menyembunyikan rute) ----
   Pimpinan boleh semua rute; Guru hanya 7 rute di GURU_ROUTES dan hanya
   5 tab bawah di GURU_TABS. Ini penjaga UI, bukan keamanan server: data
   tetap ada di perangkat yang sama, jadi jangan jadikan satu-satunya
   pengaman untuk data sensitif. */
var GURU_ROUTES = ['dashboard', 'santri', 'kelas', 'hafalan', 'penilaian', 'pengumuman', 'kbm'];
var GURU_TABS = ['dashboard', 'santri', 'hafalan', 'penilaian', 'kelas'];
function bolehAkses(peran, routeId) {
  if (peran === 'Pimpinan') return true;
  if (peran === 'Guru') return GURU_ROUTES.indexOf(routeId) !== -1;
  return false;
}

var NAV_ICONS = {
  dashboard: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
  santri: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M17.8 15.4c1.5.7 2.4 2.2 2.7 4.6"/></svg>',
  tabungan: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M4 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-1-2Z"/><circle cx="16.5" cy="14" r="1.2" fill="currentColor"/></svg>',
  keuangan: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 20v-6M10.5 20V7M16 20v-9M21 20V11"/><path d="M3 20h18" stroke-width="2.2"/></svg>',
  kelas: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  lainnya: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>'
};

/* ---- Jenjang ---- */
function getJenjang() {
  try { return lsGet(JENJANG_KEY) || 'Semua'; } catch (e) { return 'Semua'; }
}

function setJenjang(j) {
  if (j === 'Semua') {
    /* Y2 (v22): 'Semua' hanya untuk Pimpinan. Pola yang sama seperti
       setProfilAktif(): sesi aktif non-Pimpinan ditolak dan jatuh ke
       profil efektif (jenjang TPQ/Ibtidaiyah terakhir, atau 'TPQ');
       simpanan JENJANG_KEY ikut ditulis dengan nilai efektif itu supaya
       tidak ada jalur baca (santriTampil, export CSV) yang sempat
       memakai 'Semua' sebelum render() berikutnya. Tanpa sesi aktif
       (boot / selftest yang mengatur jenjang sebelum login) 'Semua'
       tetap diizinkan — penegakan untuk sesi terjadi di sini begitu ada
       sesi, dan di render() + setProfilAktif() saat login. */
    var sesi = null;
    try { sesi = sesiAktif(); } catch (e) { sesi = null; }
    if (sesi && sesi.peran !== 'Pimpinan') {
      var efektif = (ui.jenjang === 'TPQ' || ui.jenjang === 'Ibtidaiyah') ? ui.jenjang : 'TPQ';
      lsSet(JENJANG_KEY, efektif);
      ui.jenjang = efektif;
      return efektif;
    }
  }
  lsSet(JENJANG_KEY, j);
  ui.jenjang = j;
  return j;
}

function jenjangCocok(j) { return !j || !ui.jenjang || ui.jenjang === 'Semua' || j === ui.jenjang; }

function guruCocokJenjang(g) {
  if (!g) return true; /* guru sudah dihapus: jangan sembunyikan baris terkait */
  return !ui.jenjang || ui.jenjang === 'Semua' || !g.jenjang || g.jenjang === ui.jenjang || g.jenjang === 'TPQ dan Ibtidaiyah';
}

function kelasJenjang(nama) {
  var k = db.kelas.find(function (x) { return x.nama === nama; });
  return k ? (k.jenjang || 'TPQ') : 'TPQ';
}

/* ---- Identitas madrasah + profil aktif (ronde "Data kosong + Panduan
   pengguna") ----
   Kontrak API untuk UI (Kirana): migrasiIdentitas, identitasUntuk,
   simpanIdentitas, getProfilAktif, setProfilAktif. Nama fungsi ini persis
   seperti kontrak; jangan ganti nama tanpa koordinasi.
   settings.identitas = { TPQ: {...}, Ibtidaiyah: {...} }; tiap identitas
   berisi 9 string: nama, singkat, logo, kepala, alamat, telepon,
   tahunBerdiri, nsm, motto. logo hanya data URL gambar (boleh '').
   Profil aktif adalah pilihan TAMPILAN (bukan peran): 'TPQ' |
   'Ibtidaiyah' | 'Semua', dipetakan ke filter jenjang yang sudah ada.
   'Semua' hanya untuk Pimpinan. */
function identitasKosong(nama, singkat) {
  return {
    nama: nama || '', singkat: singkat || '', logo: '', kepala: '',
    alamat: '', telepon: '', tahunBerdiri: '', nsm: '', motto: ''
  };
}
function identitasDefault(jenjang) {
  return jenjang === 'Ibtidaiyah'
    ? identitasKosong('Madrasah Ibtidaiyah', 'MI')
    : identitasKosong('TPQ Al-Muttaqin', 'TPQ');
}
/* Lengkapi satu identitas dengan default untuk field yang kosong/hilang,
   tanpa menimpa nilai yang sudah ada. Selalu mengembalikan objek BARU. */
function lengkapiIdentitas(ada, jenjang) {
  var dflt = identitasDefault(jenjang);
  var hasil = {};
  IDENTITAS_FIELD.forEach(function (k) {
    var v = ada && ada[k];
    hasil[k] = (v == null ? '' : String(v)).trim() || dflt[k];
  });
  return hasil;
}
/* Migrasi: bangun settings.identitas bila belum ada. TPQ dibangun dari
   settings.namaTpq yang sudah ada (nama asli dari Mas); Ibtidaiyah
   memakai default generik ("Madrasah Ibtidaiyah"/"MI") — JANGAN karang
   nama resmi lain. Identitas yang sudah ada TIDAK ditimpa; jenjang yang
   belum ada dilengkapi dengan default. settings boleh diisi (dipakai
   load() yang db globalnya belum terbentuk) atau kosong (pakai
   db.settings). */
function migrasiIdentitas(settings) {
  settings = settings || db.settings;
  if (!settings || typeof settings !== 'object') return false;
  var ada = (settings.identitas && typeof settings.identitas === 'object') ? settings.identitas : {};
  var namaTpq = String(settings.namaTpq || '').trim() || 'TPQ Al-Muttaqin';
  var tpq = lengkapiIdentitas(ada.TPQ, 'TPQ');
  /* Nama TPQ dari settings yang sudah ada mengalahkan default keras,
     tapi tidak mengalahkan nama yang sudah tersimpan di identitas. */
  if (!ada.TPQ || !String(ada.TPQ.nama || '').trim()) tpq.nama = namaTpq;
  /* Kepala dari settings lama ikut dibawa (data yang sudah ada, bukan
     karangan) — supaya langkah 1 wizard tidak tampak belum selesai pada
     data contoh yang memang sudah punya kepala. */
  if (!ada.TPQ || !String(ada.TPQ.kepala || '').trim()) tpq.kepala = String(settings.kepala || '').trim();
  var ibt = lengkapiIdentitas(ada.Ibtidaiyah, 'Ibtidaiyah');
  settings.identitas = { TPQ: tpq, Ibtidaiyah: ibt };
  return true;
}
/* Baca identitas satu jenjang, lengkap dengan default bila kosong.
   Mengembalikan salinan baru supaya pemanggil tidak bisa mengubah data
   tersimpan lewat objek hasil. */
function identitasUntuk(jenjang) {
  var j = jenjang === 'Ibtidaiyah' ? 'Ibtidaiyah' : 'TPQ';
  var ada = db.settings && db.settings.identitas && db.settings.identitas[j];
  return lengkapiIdentitas(ada, j);
}
/* Simpan identitas satu jenjang (PATCH: field yang tidak dikirim
   dipertahankan). Hanya Pimpinan. Mengembalikan bentuk hasil yang sama
   seperti mutasi lain: { ok, ... } atau { ok: false, error, message }. */
function simpanIdentitas(jenjang, data, olehId) {
  if (!pemintaAdalahPimpinan(olehId)) return hasilGagal('bukan-pimpinan', 'Hanya Pimpinan yang bisa mengubah identitas madrasah.');
  if (jenjang !== 'TPQ' && jenjang !== 'Ibtidaiyah') return hasilGagal('jenjang-tidak-valid', 'Jenjang harus TPQ atau Ibtidaiyah.');
  data = data || {};
  var nama = String(data.nama == null ? '' : data.nama).trim();
  if (!nama) return hasilGagal('nama-wajib', 'Nama madrasah wajib diisi.');
  var logo = data.logo == null ? undefined : String(data.logo).trim();
  /* Y3 (v22): cap ukuran logo — data URL yang disimpan maksimal 1 MB
     (LOGO_MAX_BYTES). Dicek sebelum fotoAman() supaya string raksasa
     gagal cepat; pesan menyebut angkanya. */
  if (logo && logo.length > LOGO_MAX_BYTES) return hasilGagal('logo-terlalu-besar', 'Logo maksimal 1 MB.');
  /* Wira (ronde "Data kosong + Panduan pengguna"): 'data:image/' saja
     TIDAK cukup — 'data:image/svg+xml,...' lolos dan SVG bisa membawa
     script. Logo hanya diterima bila lolos fotoAman() yang sama seperti
     foto santri/guru (jpeg/png/webp base64). Render (logoAman) sudah
     menolak SVG, tapi data beracun tidak boleh tersimpan sejak awal. */
  if (logo && !fotoAman(logo)) return hasilGagal('logo-tidak-valid', 'Logo harus berupa data URL gambar (JPEG/PNG/WebP, base64).');
  if (!db.settings.identitas) migrasiIdentitas(db.settings);
  var lama = identitasUntuk(jenjang);
  var baru = {};
  IDENTITAS_FIELD.forEach(function (k) {
    baru[k] = data[k] == null ? lama[k] : String(data[k]).trim();
  });
  baru.nama = nama;
  db.settings.identitas[jenjang] = baru;
  /* Satu sumber kebenaran: nama TPQ juga tersimpan di settings.namaTpq,
     supaya teks lama yang memakai namaTpq tidak berbeda dengan identitas. */
  /* N19 (v22): identitas yang berhasil disimpan berarti sudah diperiksa/
     dikonfirmasi pengguna — bukan lagi nilai seed. Flag ini dipakai
     hitungSetup() (Kirana) supaya Langkah 1 wizard tidak tercoret dari
     nilai seed. Default false (lihat emptyData/seedData; backup lama
     tanpa flag mendapat false lewat Object.assign di load()). */
  db.settings.identitasDikonfirmasi = true;
  if (jenjang === 'TPQ') db.settings.namaTpq = nama;
  tandaiDataAsli();
  save('Ubah identitas ' + jenjang);
  return hasilOk({ identitas: identitasUntuk(jenjang) });
}
/* ---- Profil aktif ---- */
function peranAktifAdalahPimpinan() {
  var sesi = null;
  try { sesi = sesiAktif(); } catch (e) { sesi = null; }
  return !!sesi && sesi.peran === 'Pimpinan';
}
function bacaProfilTersimpan() {
  var p = null;
  try { p = lsGet(PROFIL_KEY); } catch (e) { p = null; }
  return (p === 'TPQ' || p === 'Ibtidaiyah' || p === 'Semua') ? p : 'TPQ';
}
/* Profil EFEKTIF: pilihan tersimpan, tapi 'Semua' hanya berlaku untuk
   Pimpinan. Bukan Pimpinan yang tersimpan 'Semua' jatuh ke jenjang
   TPQ/Ibtidaiyah terakhir, atau 'TPQ' bila tidak ada. */
function getProfilAktif() {
  var p = bacaProfilTersimpan();
  if (p === 'Semua' && !peranAktifAdalahPimpinan()) {
    return (ui.jenjang === 'TPQ' || ui.jenjang === 'Ibtidaiyah') ? ui.jenjang : 'TPQ';
  }
  return p;
}
/* Y6 (v22): filter yang terikat jenjang kembali netral. Dipanggil
   setProfilAktif() HANYA saat profil efektif berubah — filter lain
   (urutan, tab, tanggal, dsb.) tidak disentuh. */
function resetFilterJenjang() {
  ui.santriKelas = 'Semua';
  ui.santriAngkatan = 'Semua';
  ui.santriStatus = 'Aktif';
  ui.santriSearch = '';
}
function setProfilAktif(p) {
  if (p !== 'TPQ' && p !== 'Ibtidaiyah' && p !== 'Semua') p = 'TPQ';
  var sebelum = getProfilAktif();
  if (p === 'Semua' && !peranAktifAdalahPimpinan()) {
    /* Ditolak diam-diam: simpanan TIDAK ditimpa (supaya pilihan 'Semua'
       Pimpinan tidak hilang saat Guru memakai perangkat yang sama);
       hanya tampilan yang jatuh ke profil efektif yang berlaku. */
    var efektif = (ui.jenjang === 'TPQ' || ui.jenjang === 'Ibtidaiyah') ? ui.jenjang : 'TPQ';
    setJenjang(efektif);
    if (efektif !== sebelum) resetFilterJenjang();
    return efektif;
  }
  lsSet(PROFIL_KEY, p);
  simpanProfilKeSesi(p);
  setJenjang(p);
  if (p !== sebelum) resetFilterJenjang();
  return p;
}
/* Cermin pilihan ke sesi login bila ada (supaya pilihan ikut sesi);
   sumber kebenaran tetap localStorage (PROFIL_KEY). sesiAktif() hanya
   mengembalikan { id, nama, peran, wajibGantiSandi }, jadi field ini
   tidak bocor ke UI lewat sesi. */
function simpanProfilKeSesi(p) {
  var mentah;
  try { mentah = lsGet(SESI_KEY); } catch (e) { return; }
  if (!mentah) return;
  var sesi;
  try { sesi = JSON.parse(mentah); } catch (e) { return; }
  if (!sesi || !sesi.id) return;
  sesi.profilAktif = p;
  try { lsSet(SESI_KEY, JSON.stringify(sesi)); } catch (e) { /* abaikan */ }
}

/* ---- Sinkron hybrid ---- */
var syncSimOffline = false; /* dipakai self-test untuk mensimulasikan offline */
var syncBusy = false;
function getQueue() {
  try { return JSON.parse(lsGet(QUEUE_KEY) || '[]'); } catch (e) { return []; }
}

function setQueue(q) {
  lsSet(QUEUE_KEY, JSON.stringify(q));
}

function enqueueChange(alasan) {
  var q = getQueue();
  q.push({ id: uid('q'), waktu: new Date().toISOString(), alasan: alasan });
  /* T-13: batas antrean 100 -> 500. Kalau tetap terlampaui, perubahan
     terlama dibuang dan penanda dipasang supaya status sinkron memberi
     peringatan (dulu hilang diam-diam). */
  if (q.length > 500) { q = q.slice(-500); lsSet(QUEUE_TRIMMED_KEY, '1'); }
  setQueue(q);
}

function getSheetCfg() {
  try { return JSON.parse(lsGet(SHEET_CFG_KEY) || '{}'); } catch (e) { return {}; }
}

function setSheetCfg(cfg) {
  lsSet(SHEET_CFG_KEY, JSON.stringify(cfg));
}

function cekUrlAppsScript(url) {
  var u;
  try { u = new URL(String(url || '').trim()); } catch (e) { return { ok: false, kode: 'bad-url', host: '' }; }
  if (u.protocol !== 'https:' || APPS_SCRIPT_HOST_DIIZINKAN.indexOf(u.hostname) === -1) return { ok: false, kode: 'bad-host', host: u.hostname || '' };
  return { ok: true, kode: 'ok', host: u.hostname };
}

function syncState() {
  var q = getQueue();
  var cfg = getSheetCfg();
  if (!isOnline()) return { code: 'offline', text: 'Offline, tersimpan di perangkat' + (q.length ? ' (' + q.length + ' menunggu sinkron)' : '') };
  var hasil;
  if (q.length) hasil = { code: 'pending', text: 'Menunggu sinkron: ' + q.length + ' perubahan' };
  else if (cfg.appsScriptUrl) hasil = { code: 'ok', text: 'Online, tersinkron' + (cfg.lastSync ? ' (' + cfg.lastSync.slice(0, 10) + ')' : '') };
  else hasil = { code: 'idle', text: 'Sinkron nonaktif, atur Apps Script di Pengaturan' };
  /* T-13: peringatan bila antrean pernah dipotong (perubahan lama hilang
     dan tidak terkirim). */
  if (antreanPernahDipotong()) hasil.text += ' Peringatan: antrean sinkron pernah dipotong, perubahan lama hilang dan tidak terkirim.';
  return hasil;
}

function decidePull(serverUpdatedAt, localUpdatedAt, pendingCount) {
  /* Antrean lokal selalu didahulukan: apa pun waktu servernya, beri peringatan
     dulu supaya perubahan lokal tidak tertimpa diam-diam (termasuk saat server
     tidak mengirim waktu perubahan sama sekali). */
  if (pendingCount > 0) return 'warn';
  /* T-05: server tanpa waktu perubahan DAN lokal punya waktu perubahan =
     'warn' (minta konfirmasi), bukan langsung timpa. Hanya bila lokal pun
     tidak punya waktu perubahan, kembalikan 'no-server-time' (perilaku
     lama: pakai data Sheet, karena tidak ada yang bisa dibandingkan). */
  if (!serverUpdatedAt) return localUpdatedAt ? 'warn' : 'no-server-time';
  if (!localUpdatedAt) return 'apply';
  return new Date(serverUpdatedAt) > new Date(localUpdatedAt) ? 'apply' : 'skip';
}

function extractSheetId(link) {
  if (!link) return '';
  var m = String(link).match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(String(link).trim())) return link.trim();
  return '';
}

/* K3: payload sinkron TIDAK BOLEH memuat salt+hash pengguna. flushSync
   mengirim salinan db tanpa kunci `pengguna`; sesi tidak ada di db jadi
   tidak perlu dikecualikan. Salinan dangkal cukup: hanya kunci atas yang
   dihapus, isi list lain tetap referensi yang sama (tidak diubah di sini),
   dan db asli tetap memuat `pengguna` setelah pemanggilan. */
function dbUntukSinkron() {
  var salinan = Object.assign({}, db);
  delete salinan.pengguna;
  return salinan;
}
function flushSync() {
  var cfg = getSheetCfg();
  var q = getQueue();
  if (!q.length) {  return Promise.resolve('empty'); }
  if (!isOnline()) {  return Promise.resolve('offline'); }
  if (!cfg.appsScriptUrl) {
    
    return Promise.resolve('no-config');
  }
  /* URL tidak valid (salah ketik / host bukan Google) ditolak SEBELUM kirim
     dan SEBELUM syncBusy dinyalakan , jadi sinkron tidak pernah macet. */
  var cek = cekUrlAppsScript(cfg.appsScriptUrl);
  if (!cek.ok) {
    
    return Promise.resolve(cek.kode);
  }
  if (syncBusy) return Promise.resolve('busy');
  syncBusy = true;
  
  /* fetch() bisa melempar sinkron untuk URL tertentu; tangkap supaya syncBusy
     selalu di-reset dan pemanggil (interval, event online) tidak pernah crash. */
  var janji;
  try {
    janji = fetch(cfg.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'sync', app: 'tpq-madin-pwa', waktu: new Date().toISOString(), jumlahPerubahan: q.length, perubahan: q, token: cfg.syncToken || '', data: dbUntukSinkron() })
    });
  } catch (e) {
    syncBusy = false;
    
    return Promise.resolve('failed');
  }
  return janji.then(function (res) { return res.text().then(function (t) { return { status: res.status, body: t }; }); })
  .then(function (r) {
    var ok = false;
    try { ok = JSON.parse(r.body).ok === true; } catch (e) { ok = r.status >= 200 && r.status < 300; }
    if (ok) {
      setQueue([]);
      cfg.lastSync = new Date().toISOString();
      setSheetCfg(cfg);
    } else {
    }
    syncBusy = false;
    
    return ok ? 'ok' : 'failed';
  }).catch(function () {
    syncBusy = false;
    
    return 'failed';
  });
}

function applyPulledData(data) {
  if (!data || !Array.isArray(data.santri)) return false;
  /* Gabung, bukan timpa buta: hanya kunci yang dikirim Sheet yang diganti.
     Kunci yang tidak dikirim (mis. pengaturan, RAPBM, jadwal) tetap memakai data lokal. */
  ['santri', 'guru', 'nilai', 'pertemuan', 'keuanganTx', 'tabunganTx', 'hafalanLog', 'pengumuman', 'settings', 'kelas', 'rapbm', 'biaya', 'alokasiWaktu', 'jadwalKbm', 'jadwalPiket', 'absensiGuru', 'target'].forEach(function (k) {
    /* Hanya ganti kunci yang dikirim Sheet DAN berupa array/objek yang valid;
       nilai bukan-array dari Sheet (mis. sel kosong) diabaikan supaya render
       berikutnya tidak crash karena .filter/.map pada bukan-array. */
    if (data[k] === undefined) return;
    if (k === 'settings') { if (data[k] && typeof data[k] === 'object') db[k] = data[k]; return; }
    if (Array.isArray(data[k])) db[k] = data[k];
  });
  /* Sheet bisa mengubah angka menjadi teks: kembalikan ke tipe yang benar. */
  db.santri.forEach(function (s) {
    s.nis = String(s.nis == null ? '' : s.nis);
    s.tabungan = Number(s.tabungan) || 0;
    s.kehadiran = Number(s.kehadiran) || 0;
    s.halaman = Number(s.halaman) || 0;
    /* Boundary pull (Wira): jk dari Sheet adalah input luar; normalisasi
       ('Laki-laki' -> L, nilai tak dikenal -> ''), sama seperti restore. */
    s.jk = normalisasiJk(s.jk).jk;
  });
  db.guru.forEach(function (g) { g.honor = Number(g.honor) || 0; });
  db.nilai.forEach(function (n) { n.nilai = Number(n.nilai) || 0; });
  if (Array.isArray(db.keuanganTx)) db.keuanganTx.forEach(function (t) { t.jumlah = Number(t.jumlah) || 0; });
  if (Array.isArray(db.tabunganTx)) db.tabunganTx.forEach(function (t) { t.jumlah = Number(t.jumlah) || 0; t.saldoSetelah = Number(t.saldoSetelah) || 0; });
  /* Boundary pull: foto dan tanggal dari Sheet adalah input luar , bersihkan
     sebelum disimpan dan dirender. */
  bersihkanFoto(db);
  bersihkanTanggal(db);
  save('Tarik data dari Sheet');
  setQueue([]);
  var cfg = getSheetCfg();
  cfg.lastPull = new Date().toISOString();
  setSheetCfg(cfg);
  return true;
}


/* ---------------- Sinkron hybrid, lanjutan (tanpa DOM) ---------------- */
/* DIUBAH v2: isOnline() menjaga navigator yang tidak ada (Node). Di browser
   perilakunya sama seperti v1. */
function isOnline() { return !syncSimOffline && (typeof navigator === 'undefined' || navigator.onLine !== false); }

/* Tarik data terbaru dari Apps Script. DIUBAH v2: tidak lagi menampilkan
   alert/modal atau me-render; hasilnya dikembalikan sebagai objek supaya UI
   yang memutuskan tampilannya. Kalau ada perubahan lokal yang belum
   terkirim, hasilnya { status: 'warn', data } dan data TIDAK dipakai:
   UI harus bertanya dulu ke pengguna, lalu memanggil applyPulledData(data)
   hanya kalau pengguna setuju. */
function pullFromAppsScript() {
  var cfg = getSheetCfg();
  if (!cfg.appsScriptUrl) return Promise.resolve({ status: 'no-config', message: 'Apps Script belum diatur. Isi URL Web App Apps Script di Pengaturan.' });
  var cek = cekUrlAppsScript(cfg.appsScriptUrl);
  if (!cek.ok) return Promise.resolve({ status: cek.kode, message: 'URL Apps Script tidak valid. URL Web App harus dari script.google.com dan memakai https.' });
  if (!isOnline()) return Promise.resolve({ status: 'offline', message: 'Perangkat sedang offline. Data di perangkat tetap aman.' });
  var urlTarik = cfg.appsScriptUrl + (cfg.appsScriptUrl.indexOf('?') === -1 ? '?action=pull' : '&action=pull');
  if (cfg.syncToken) urlTarik += '&token=' + encodeURIComponent(cfg.syncToken);
  var janji;
  try { janji = fetch(urlTarik); } catch (e) {
    return Promise.resolve({ status: 'error', message: 'Tidak bisa mengambil data dari Sheet. Periksa koneksi dan URL Apps Script.' });
  }
  return janji.then(function (res) { return res.json(); }).then(function (j) {
    if (!j || !j.data) return { status: 'error', message: 'Sheet tidak mengembalikan data. Periksa script Apps Script: doGet harus mengembalikan data dengan action=pull.' };
    var putusan = decidePull(j.updatedAt, db._updatedAt, getQueue().length);
    if (putusan === 'skip') return { status: 'skip', message: 'Data lokal sudah yang terbaru. Tidak ada yang ditimpa.' };
    if (putusan === 'warn') {
      /* T-05: dua sebab 'warn' dibedakan pesannya. Antrean lokal = pesan
         lama. Tanpa waktu server (antrean kosong) = jelaskan bahwa Sheet
         tidak memberi info waktu, jadi tidak bisa dipastikan mana yang
         lebih baru. */
      if (getQueue().length > 0) return { status: 'warn', data: j.data, message: 'Data di Sheet lebih baru, tapi perangkat ini punya ' + getQueue().length + ' perubahan yang belum terkirim.' };
      return { status: 'warn', data: j.data, message: 'Sheet tidak memberi info waktu perubahan, jadi tidak bisa dipastikan data Sheet lebih baru dari data di perangkat ini. Pakai data Sheet hanya kalau yakin data Sheet yang benar.' };
    }
    if (applyPulledData(j.data)) return { status: 'ok', message: 'Data terbaru dari Sheet sudah dipakai.' };
    return { status: 'error', message: 'Data dari Sheet tidak valid. Data harus berisi daftar santri.' };
  }).catch(function () {
    return { status: 'error', message: 'Tidak bisa mengambil data dari Sheet. Periksa koneksi dan URL Apps Script.' };
  });
}

/* Tarik CSV dari Sheet yang di-publish (tanpa Apps Script). DIUBAH v2:
   mengembalikan Promise berisi laporan import (atau { error }) dan tidak
   menampilkan apa-apa. Batasan jujur dari v1 tetap berlaku: kalau Sheet
   belum di-publish, atau peramban memblokir akses lintas situs (CORS) dari
   docs.google.com, tarikan gagal; jalan keluarnya unduh CSV dari Sheet
   lalu import lewat importCsvText(). */
function pullCsvFromSheet(jenis) {
  var cfg = getSheetCfg();
  if (!cfg.sheetId) return Promise.resolve({ error: 'no-sheet', message: 'Link Google Sheet belum disimpan. Tempel link Sheet di Pengaturan lalu simpan.' });
  if (!isOnline()) return Promise.resolve({ error: 'offline', message: 'Perangkat sedang offline.' });
  var url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(cfg.sheetId) + '/export?format=csv&gid=' + (cfg.gid || 0);
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }).then(function (teks) {
    return importRows(jenis, parseCSV(teks));
  }).catch(function () {
    return { error: 'fetch-gagal', message: 'Tidak bisa mengambil CSV dari Sheet. Kemungkinan Sheet belum di-publish ke web, atau peramban memblokir akses lintas situs (CORS). Unduh CSV dari Sheet lalu import lewat tombol import file CSV.' };
  });
}

/* Simpan konfigurasi Sheet/Apps Script. DIUBAH v2: menerima objek, bukan
   membaca input DOM; mengembalikan { ok, cfg } atau { ok: false, error }.
   Perbaikan kecil dari v1: di v1, link Sheet yang tidak dikenali tetap
   tersimpan dulu baru dilaporkan; di v2, konfigurasi TIDAK disimpan kalau
   ada yang tidak valid, supaya tidak ada konfigurasi setengah benar. */
function saveSheetConfig(input) {
  input = input || {};
  var link = String(input.sheetLink || '').trim();
  var apps = String(input.appsScriptUrl || '').trim();
  var token = String(input.syncToken || '').trim();
  var gid = parseInt(input.gid, 10);
  if (apps && !cekUrlAppsScript(apps).ok) return { ok: false, error: 'url-tidak-valid', message: 'URL Apps Script tidak valid. URL Web App harus dari script.google.com dan memakai https (contoh: https://script.google.com/macros/s/.../exec). Pengaturan tidak disimpan.' };
  var sheetId = extractSheetId(link);
  if (link && !sheetId) return { ok: false, error: 'link-tidak-dikenali', message: 'Link Sheet tidak dikenali. Tempel link lengkap Google Sheet, contoh: https://docs.google.com/spreadsheets/d/ABC123/edit' };
  var cfg = getSheetCfg();
  cfg.sheetLink = link;
  cfg.sheetId = sheetId;
  cfg.appsScriptUrl = apps;
  cfg.syncToken = token;
  cfg.gid = isNaN(gid) ? 0 : gid;
  setSheetCfg(cfg);
  return { ok: true, cfg: cfg };
}

/* Kirim antrean sekarang. DIUBAH v2: mengembalikan Promise berisi kode
   hasil flushSync ('ok', 'offline', 'no-config', 'failed', ...), bukan
   menampilkan alert. */
function sendToAppsScriptNow() {
  var cfg = getSheetCfg();
  if (!cfg.appsScriptUrl) return Promise.resolve({ status: 'no-config', message: 'Apps Script belum diatur. Isi URL Web App Apps Script, lalu simpan pengaturan Sheet.' });
  if (!isOnline()) return Promise.resolve({ status: 'offline', message: 'Perangkat sedang offline. Perubahan tetap tersimpan di antrean dan akan terkirim saat online.' });
  enqueueChange('Kirim manual ke Sheet');
  return flushSync().then(function (hasil) { return { status: hasil }; });
}

/* Siklus sinkron otomatis: kirim antrean saat online, tiap 60 detik, dan
   sekali saat dipanggil. DIUBAH v2: dipisah dari init() menjadi startSync()
   supaya UI yang menentukan kapan dimulai; di Node (tanpa window) tidak
   melakukan apa-apa dan mengembalikan false. */
var syncIntervalId = null;
var syncOnlineHandler = null;
var syncOfflineHandler = null;
function startSync() {
  if (typeof window === 'undefined' || !window.addEventListener) return false;
  stopSync();
  syncOnlineHandler = function () { flushSync(); };
  syncOfflineHandler = function () {};
  window.addEventListener('online', syncOnlineHandler);
  window.addEventListener('offline', syncOfflineHandler);
  syncIntervalId = setInterval(function () { if (isOnline()) flushSync(); }, 60000);
  if (isOnline()) flushSync();
  return true;
}
function stopSync() {
  if (typeof window !== 'undefined' && window.removeEventListener) {
    if (syncOnlineHandler) window.removeEventListener('online', syncOnlineHandler);
    if (syncOfflineHandler) window.removeEventListener('offline', syncOfflineHandler);
  }
  if (syncIntervalId != null) { clearInterval(syncIntervalId); syncIntervalId = null; }
  syncOnlineHandler = null;
  syncOfflineHandler = null;
}

/* ---- Filter dan agregat tampilan (verbatim v1) ---- */
function santriTampil() {
  var q = (ui.santriSearch || '').toLowerCase();
  return db.santri.filter(function (s) {
    if (!jenjangCocok(s.jenjang)) return false;
    if (ui.santriKelas !== 'Semua' && s.kelas !== ui.santriKelas) return false;
    if (ui.santriAngkatan && ui.santriAngkatan !== 'Semua' && s.angkatan !== ui.santriAngkatan) return false;
    if (ui.santriStatus !== 'Semua' && s.status !== ui.santriStatus) return false;
    if (q && (s.nama + ' ' + s.nis).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

function guruTampil() {
  var q = (ui.guruSearch || '').toLowerCase();
  return db.guru.filter(function (g) {
    return guruCocokJenjang(g) && (!q || (g.nama + ' ' + g.kelas + ' ' + g.peran).toLowerCase().indexOf(q) !== -1);
  });
}

function nilaiExportRows() {
  return db.nilai.filter(function (n) {
    if (JENIS_NILAI.indexOf(ui.nilaiTab) !== -1 && n.jenis !== ui.nilaiTab) return false;
    var s = santriById(n.santriId);
    return s && jenjangCocok(s.jenjang);
  });
}

function tabunganRiwayat() {
  return db.tabunganTx.filter(function (t) {
    var s = santriById(t.santriId);
    return s && jenjangCocok(s.jenjang);
  }).slice().sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal); });
}

function hafalanLogTampil() {
  return db.hafalanLog.filter(function (h) {
    var s = santriById(h.santriId);
    return s && jenjangCocok(s.jenjang);
  }).slice().sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal); });
}

function arusKasPerBulan(jenjang) {
  var bulan = {};
  db.keuanganTx.forEach(function (t) {
    if (jenjang && jenjang !== 'Semua' && t.jenjang && t.jenjang !== jenjang) return;
    var b = (t.tanggal || '').slice(0, 7);
    bulan[b] = bulan[b] || { masuk: 0, keluar: 0 };
    if (t.jenis === 'Masuk') bulan[b].masuk += t.jumlah; else bulan[b].keluar += t.jumlah;
  });
  return bulan;
}

var BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function namaBulanPanjang(yyyymm) {
  var p = String(yyyymm || '').split('-');
  if (p.length !== 2) return yyyymm || '';
  var b = parseInt(p[1], 10);
  if (b < 1 || b > 12) return yyyymm;
  return BULAN_PANJANG[b - 1] + ' ' + p[0];
}

function arusKasMingguan(jenjang) {
  var tx = db.keuanganTx.filter(function (t) { return !(jenjang && jenjang !== 'Semua' && t.jenjang && t.jenjang !== jenjang); });
  var bulan = '';
  tx.forEach(function (t) {
    var b = (t.tanggal || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(b) && b > bulan) bulan = b;
  });
  if (!bulan) bulan = todayStr().slice(0, 7);
  var minggu = [0, 0, 0, 0];
  tx.forEach(function (t) {
    if ((t.tanggal || '').slice(0, 7) !== bulan) return;
    var d = parseInt((t.tanggal || '').split('-')[2], 10) || 1;
    var idx = Math.min(3, Math.floor((d - 1) / 7));
    minggu[idx] += t.jenis === 'Masuk' ? t.jumlah : -t.jumlah;
  });
  return { bulan: bulan, minggu: minggu };
}

function piketTampil() {
  return db.jadwalPiket.filter(function (p) { return guruCocokJenjang(guruById(p.guruId)); });
}

function filterSantriList(q) {
  var query = (q || '').toLowerCase();
  return db.santri.filter(function (s) { return jenjangCocok(s.jenjang) && (s.nama + ' ' + s.nis).toLowerCase().indexOf(query) !== -1; });
}

/* ---- Rapor dan hitung (verbatim v1) ---- */
function hitungRapor(santriId, semesterId) {
  function rata(jenis) {
    var ns = db.nilai.filter(function (n) { return n.santriId === santriId && n.jenis === jenis && nilaiDalamSemester(n, semesterId); });
    if (!ns.length) return null;
    return Math.round(ns.reduce(function (a, n) { return a + n.nilai; }, 0) / ns.length * 10) / 10;
  }
  var h = rata('Harian'), im = rata('Imda'), pr = rata('Praktek');
  var akhir = null;
  if (h != null || im != null || pr != null) {
    akhir = Math.round(((h || 0) * 0.4 + (im || 0) * 0.3 + (pr || 0) * 0.3) * 10) / 10;
  }
  return { harian: h, imda: im, praktek: pr, akhir: akhir };
}

function hitungKehadiranDariPertemuan(santriId) {
  var s = santriById(santriId);
  var total = 0, hadir = 0;
  db.pertemuan.forEach(function (p) {
    if (!p.absensi || !p.absensi[santriId]) return;
    /* T-07: hanya pertemuan yang kelasnya cocok dengan kelas santri yang
       dihitung. Dulu entri absensi lintas kelas (mis. santri Iqra 1 di
       pertemuan Iqra 3) ikut terhitung. */
    if (s) {
      var k = kelasById(p.kelasId);
      if (!k || k.nama !== s.kelas) return;
    }
    total++; if (p.absensi[santriId] === 'Hadir') hadir++;
  });
  if (!total) return null;
  return Math.round(hadir / total * 100);
}

function realisasiPos(pos, jenjang) {
  return db.keuanganTx.filter(function (t) {
    if (t.kategori !== pos) return false;
    if (jenjang && jenjang !== 'Semua' && t.jenjang && t.jenjang !== jenjang) return false;
    return true;
  }).reduce(function (a, t) { return a + (t.jenis === 'Masuk' ? t.jumlah : -t.jumlah); }, 0);
}


/* ---------------- Export CSV / template / backup (tanpa DOM) ---------------- */
/* DIUBAH v2: semua fungsi export di bawah ini MENGEMBALIKAN { filename,
   csv, count } dan tidak lagi mengunduh file atau menampilkan toast.
   UI (Kirana) yang mengunduhnya (buat Blob + klik tautan) dan memberi tahu
   pengguna. Isi dan filter sama persis seperti v1: export menghormati
   filter yang sedang aktif (jenjang, tab nilai, pencarian, dan lain-lain). */
function exportSantriCSV() {
  var rows = [['nama', 'nis', 'kelas', 'angkatan', 'rombel', 'jenjang', 'wali', 'hp wali', 'alamat', 'status', 'tabungan', 'spp', 'kehadiran', 'Jenis Kelamin']];
  santriTampil().forEach(function (s) {
    rows.push([s.nama, s.nis, s.kelas, s.angkatan, s.rombel, s.jenjang || 'TPQ', s.wali, s.hpWali, s.alamat, s.status, s.tabungan, s.sppStatus, s.kehadiran, labelJk(s.jk)]);
  });
  return { filename: 'murid-tpq-madin.csv', csv: toCSV(rows), count: rows.length - 1 };
}
function exportGuruCSV() {
  var rows = [['nama', 'kelas', 'peran', 'jenjang', 'hp', 'honor', 'status honor']];
  guruTampil().forEach(function (g) { rows.push([g.nama, g.kelas, g.peran, g.jenjang || 'TPQ', g.hp, g.honor, g.honorStatus]); });
  return { filename: 'guru-tpq-madin.csv', csv: toCSV(rows), count: rows.length - 1 };
}
function exportNilaiCSV() {
  var rows = [['santri', 'nis', 'jenis', 'mapel', 'nilai', 'tanggal', 'catatan']];
  nilaiExportRows().forEach(function (n) {
    var s = santriById(n.santriId);
    rows.push([s ? s.nama : '-', s ? s.nis : '-', n.jenis, n.mapel, n.nilai, n.tanggal, n.catatan || '']);
  });
  return { filename: 'nilai-tpq-madin.csv', csv: toCSV(rows), count: rows.length - 1 };
}
function exportAbsensiCSV() {
  var rows = [['tanggal', 'kelas', 'santri', 'nis', 'status']];
  db.pertemuan.forEach(function (p) {
    var k = kelasById(p.kelasId);
    if (k && !jenjangCocok(k.jenjang)) return;
    /* T-10: export mengikuti filter yang tampil di layar Kelas & Absensi:
       tab kelas (ui.kelasId) dan tanggal bila diisi (ui.kelasTanggal). */
    if (ui.kelasId && p.kelasId !== ui.kelasId) return;
    if (ui.kelasTanggal && p.tanggal !== ui.kelasTanggal) return;
    Object.keys(p.absensi).forEach(function (sid) {
      var s = santriById(sid);
      /* T-11: entri yang santrinya tidak ditemukan dilewati, jangan cetak
         ID mentah (mis. "s1") sebagai nama. */
      if (!s) return;
      rows.push([p.tanggal, k ? k.nama : '-', s.nama, s.nis, p.absensi[sid]]);
    });
  });
  return { filename: 'absensi-tpq-madin.csv', csv: toCSV(rows), count: rows.length - 1 };
}
function exportKeuanganCSV() {
  var rows = [['tanggal', 'jenis', 'jenjang', 'kategori', 'nama', 'jumlah', 'catatan']];
  /* T-10: export mengikuti tab Keuangan yang tampil (ui.keuanganTab:
     Semua/Masuk/Keluar), bukan selalu semua transaksi. */
  db.keuanganTx.filter(function (t) {
    if (!jenjangCocok(t.jenjang)) return false;
    if (ui.keuanganTab === 'Masuk' || ui.keuanganTab === 'Keluar') return t.jenis === ui.keuanganTab;
    return true;
  }).forEach(function (t) { rows.push([t.tanggal, t.jenis, t.jenjang || 'TPQ', t.kategori, t.nama, t.jumlah, t.catatan || '']); });
  return { filename: 'keuangan-tpq-madin.csv', csv: toCSV(rows), count: rows.length - 1 };
}
/* semesterId opsional: bila diisi, rapor CSV mengikuti semester yang dipilih
   di layar Hasil Belajar. Tanpa semesterId, perilaku lama (semua nilai). */
function exportRaporCSV(santriId, semesterId) {
  var s = santriById(santriId);
  if (!s) return { ok: false, error: 'tidak-ditemukan', message: 'Santri tidak ditemukan.' };
  var r = hitungRapor(santriId, semesterId);
  var rows = [
    ['Rapor Murid', s.nama], ['NIS', s.nis], ['Kelas', s.kelas], ['Tahun Ajaran', db.settings.tahunAjaran],
    semesterId ? ['Semester', semesterById(semesterId).label] : [], [],
    ['Jenis', 'Rata-rata'],
    ['Harian', r.harian == null ? '-' : r.harian],
    ['Imda', r.imda == null ? '-' : r.imda],
    ['Praktek', r.praktek == null ? '-' : r.praktek],
    ['Nilai Akhir (40% Harian + 30% Imda + 30% Praktek)', r.akhir == null ? '-' : r.akhir],
    ['Predikat', r.akhir == null ? '-' : predikat(r.akhir)]
  ];
  return { filename: 'rapor-' + s.nis + '.csv', csv: toCSV(rows), count: rows.length };
}
function downloadTemplate(jenis) {
  var t = CSV_TEMPLATES[jenis];
  if (!t) return { ok: false, error: 'template-tidak-dikenali', message: 'Template tidak dikenali: ' + jenis + '. Pilihan: murid, guru, nilai.' };
  return { filename: 'template-' + jenis + '-tpq-madin.csv', csv: toCSV([t.header].concat(t.contoh)) };
}
/* Cadangkan seluruh data sebagai satu file JSON. DIUBAH v2: mengembalikan
   { filename, json } dan tidak mengunduh sendiri. */
function backupJSON() {
  var isi = JSON.stringify({ app: 'tpq-madin-pwa', version: 1, exportedAt: new Date().toISOString(), data: db }, null, 2);
  return { filename: 'tpq-madin-backup-' + todayStr() + '.json', json: isi };
}
/* Teks CSV untuk disalin ke clipboard atau ditempel ke Google Sheets.
   Menggantikan copyCsvToClipboard() v1 (yang memakai navigator.clipboard
   dan toast); UI yang menyalinnya. Jenis: 'murid', 'guru', 'nilai'. */
function csvTextFor(jenis) {
  var rows;
  if (jenis === 'murid') {
    rows = [['nama', 'nis', 'kelas', 'angkatan', 'rombel', 'jenjang', 'wali', 'hp wali', 'alamat', 'jenis kelamin']];
    santriTampil().forEach(function (s) { rows.push([s.nama, s.nis, s.kelas, s.angkatan, s.rombel, s.jenjang || 'TPQ', s.wali, s.hpWali, s.alamat, labelJk(s.jk)]); });
  } else if (jenis === 'guru') {
    rows = [['nama', 'kelas', 'peran', 'hp', 'honor']];
    guruTampil().forEach(function (g) { rows.push([g.nama, g.kelas, g.peran, g.hp, g.honor]); });
  } else if (jenis === 'nilai') {
    rows = [['santri', 'nis', 'jenis', 'mapel', 'nilai', 'tanggal']];
    nilaiExportRows().forEach(function (n) { var s = santriById(n.santriId); rows.push([s ? s.nama : '-', s ? s.nis : '-', n.jenis, n.mapel, n.nilai, n.tanggal]); });
  } else {
    return { ok: false, error: 'jenis-tidak-dikenali', message: 'Jenis tidak dikenali: ' + jenis + '. Pilihan: murid, guru, nilai.' };
  }
  return { csv: toCSV(rows), count: rows.length - 1 };
}

function applyBackupData(data) {
  if (!data || !Array.isArray(data.santri) || !Array.isArray(data.guru) || !data.settings) return false;
  /* T-06: kunci yang TIDAK ADA di berkas dipertahankan dari data lokal
     (bedakan dari kunci yang ada tapi kosong — yang kosong tetap dipakai
     apa adanya dari berkas). Dulu semua kunci yang hilang diisi dari
     emptyData(), jadi restore cadangan lama menghapus RAPBM/biaya/target
     lokal tanpa peringatan. */
  var d = emptyData();
  Object.keys(d).forEach(function (k) {
    if (data[k] !== undefined) d[k] = data[k];
    else if (db && db[k] !== undefined) d[k] = db[k];
  });
  if (!d.settings || typeof d.settings !== 'object') d.settings = emptyData().settings;
  d.settings = Object.assign(emptyData().settings, d.settings);
  /* K2 (KRITIS): pengguna lokal TIDAK BOLEH ditimpa oleh berkas cadangan.
     Berkas buatan tangan berisi Pimpinan + hash sandi yang diketahui
     penyerang langsung jadi Pimpinan kalau dipakai. Aturan: kalau daftar
     pengguna lokal TIDAK kosong, pertahankan pengguna lokal dan abaikan
     `pengguna` dari berkas sepenuhnya; hanya kalau daftar lokal kosong
     (mis. perangkat baru / data rusak) pengguna dari berkas dipakai
     (setelah divalidasi bentuknya lewat bersihkanPengguna); kalau itu pun
     kosong, pakai pengguna seed. */
  var penggunaAktif = (db && Array.isArray(db.pengguna)) ? db.pengguna : [];
  if (penggunaAktif.length) {
    d.pengguna = penggunaAktif;
  } else {
    var penggunaCadangan = bersihkanPengguna(data.pengguna);
    if (penggunaCadangan.length) {
      /* S6 (ronde Bagas): pengguna dari berkas cadangan adalah akun yang
         belum terverifikasi asalnya — paksa wajibGantiSandi untuk SEMUA
         pengguna hasil restore, supaya akun curian dari berkas penyerang
         tidak bisa langsung dipakai sebelum sandinya diganti. */
      penggunaCadangan.forEach(function (p) { p.wajibGantiSandi = true; });
      d.pengguna = penggunaCadangan;
    } else {
      d.pengguna = seedPengguna();
    }
  }
  /* Boundary restore: foto dan tanggal dari file cadangan adalah input luar ,
     bersihkan sebelum dipakai. */
  bersihkanFoto(d);
  bersihkanTanggal(d);
  /* Boundary restore (Wira): jk dari berkas cadangan adalah input luar;
     normalisasi (nilai tak dikenal -> ''), supaya tidak ada jk mentah di db.
     Render memang sudah aman (labelJk hanya kenal L/P), tapi db tidak boleh
     menyimpan nilai yang tidak lolos validasi boundary. */
  (d.santri || []).forEach(function (s) { s.jk = normalisasiJk(s.jk).jk; });
  db = d;
  if (!db.version) db.version = 1;
  save('Pulihkan dari cadangan');
  setQueue([]);
  return true;
}


/* ---------------- Mutasi data (pengganti semua submit* v1) ---------------- */
/* Di v1, fungsi submit* membaca nilai dari input DOM, menampilkan toast,
   menutup modal, dan me-render ulang. Di v2, UI (Kirana) membaca form dan
   memanggil fungsi di bawah ini dengan objek data biasa. Semua fungsi di
   sini memakai SATU bentuk hasil (lihat api-and-interface-design):
     { ok: true, ...data hasil }  atau
     { ok: false, error: 'kode-singkat', message: 'penjelasan Indonesia' }
   Pengecualian: catatTabungan() untuk tarik di atas Rp200.000 mengembalikan
   { ok: false, needsConfirm: true, ... } supaya UI bisa bertanya dulu;
   panggil lagi dengan { confirmed: true } untuk melanjutkan. */

function hasilGagal(kode, pesan) { return { ok: false, error: kode, message: pesan }; }
function hasilOk(extra) { return Object.assign({ ok: true }, extra || {}); }
function angkaRp(v) {
  var n = Number(String(v == null ? '' : v).replace(/[^0-9-]/g, ''));
  return isNaN(n) ? null : n;
}
/* A4 (ronde Bagas, dipakai app.js di semua kolom uang): baca angka
   rupiah format Indonesia — "50.000" -> 50000. Algoritma: buang semua
   spasi + awalan "Rp"/"rp", hapus SEMUA "." dan ",", lalu parseInt.
   Kosong atau sisa bukan digit -> NaN (bukan 0, supaya UI bisa
   menampilkan error, bukan mencatat Rp0 diam-diam).
   Kontrak: bacaRupiah(str) -> number | NaN. Contoh: "50.000"->50000,
   "50000"->50000, "50,000"->50000, "50.000.000"->50000000, ""->NaN,
   "abc"->NaN, "Rp 50.000"->50000. */
function bacaRupiah(str) {
  var s = String(str == null ? '' : str).replace(/\s/g, '');
  s = s.replace(/^[Rr][Pp]/, '');
  s = s.replace(/[.,]/g, '');
  if (s === '' || !/^\d+$/.test(s)) return NaN;
  return parseInt(s, 10);
}
function bersihFotoInput(foto) {
  return fotoAman(foto) ? foto : undefined;
}

/* --- Santri --- */
function simpanSantri(id, data) {
  data = data || {};
  var nama = String(data.nama || '').trim();
  var nis = String(data.nis || '').trim();
  if (!nama) return hasilGagal('nama-wajib', 'Nama wajib diisi.');
  if (!nis) return hasilGagal('nis-wajib', 'NIS wajib diisi.');
  var duplikat = db.santri.find(function (s) { return s.nis === nis && s.id !== id; });
  if (duplikat) return hasilGagal('nis-duplikat', 'NIS ' + nis + ' sudah dipakai ' + duplikat.nama + '.');
  /* Jenis kelamin: form mengirim 'L'/'P' dari select; 'Laki-laki'/
     'Perempuan' (apa pun huruf besar/kecilnya) juga diterima. Kosong
     atau tidak dikirim = '' (data lama tanpa jk, bukan ditebak).
     Nilai lain ditolak — jangan simpan jk yang tidak dikenal. */
  var jkN = normalisasiJk(data.jk);
  if (!jkN.ok) return hasilGagal(jkN.error, jkN.message);
  var isi = {
    nama: nama, nis: nis, jk: jkN.jk,
    jenjang: (data.jenjang === 'Ibtidaiyah' ? 'Ibtidaiyah' : 'TPQ'),
    kelas: String(data.kelas || 'Iqra 1').trim() || 'Iqra 1',
    jilid: String(data.jilid || 'Iqra 1').trim() || 'Iqra 1',
    angkatan: String(data.angkatan || '2026').trim() || '2026',
    rombel: String(data.rombel || 'A').trim() || 'A',
    wali: String(data.wali || '').trim(),
    hpWali: String(data.hpWali || '').trim(),
    alamat: String(data.alamat || '').trim(),
    hafalan: String(data.hafalan || 'Belum mulai').trim() || 'Belum mulai'
  };
  /* T-21: kunci `foto` hanya disertakan bila ada foto baru yang valid.
     Dulu `foto: undefined` ikut tertimpa saat edit tanpa foto, jadi foto
     lama hilang di engine (UI menambal lewat hidden field, tapi engine
     tetap cacat laten). Foto yang tidak valid juga tidak menghapus foto
     lama — hanya foto baru yang valid yang menimpa. */
  if (data.foto) { var fotoBaru = bersihFotoInput(data.foto); if (fotoBaru) isi.foto = fotoBaru; }
  if (id) {
    var s = santriById(id);
    if (!s) return hasilGagal('tidak-ditemukan', 'Santri tidak ditemukan.');
    Object.keys(isi).forEach(function (k) { s[k] = isi[k]; });
    tandaiDataAsli();
    save('Ubah santri ' + nama);
    return hasilOk({ santri: s });
  }
  var baru = Object.assign({ id: uid('s'), halaman: 1, tabungan: 0, sppStatus: 'Belum', sppReminderSent: false, kehadiran: 100, status: 'Aktif' }, isi);
  db.santri.push(baru);
  tandaiDataAsli();
  save('Tambah santri ' + nama);
  return hasilOk({ santri: baru });
}
function ubahStatusSantri(id, status, extra) {
  var s = santriById(id);
  if (!s) return hasilGagal('tidak-ditemukan', 'Santri tidak ditemukan.');
  extra = extra || {};
  if (status === 'Keluar') {
    var alasan = String(extra.alasan || '').trim();
    if (!alasan) return hasilGagal('alasan-wajib', 'Alasan keluar wajib diisi.');
    s.status = 'Keluar'; s.statusAlasan = alasan; s.statusTanggal = extra.tanggal || todayStr();
  } else if (status === 'Lulus') {
    var th = String(extra.tahun || '').trim();
    if (!th) return hasilGagal('tahun-wajib', 'Tahun lulus wajib diisi.');
    s.status = 'Lulus'; s.tahunLulus = th; s.statusTanggal = todayStr();
  } else if (status === 'Aktif') {
    s.status = 'Aktif';
    /* T-17: kembali Aktif menghapus jejak status lama (alasan/tanggal
       keluar dan tahun lulus) supaya tidak basi dan muncul lagi nanti. */
    delete s.statusAlasan; delete s.statusTanggal; delete s.tahunLulus;
  } else {
    return hasilGagal('status-tidak-dikenali', 'Status harus Aktif, Keluar, atau Lulus.');
  }
  tandaiDataAsli();
  save('Ubah status ' + s.nama + ' menjadi ' + status);
  return hasilOk({ santri: s });
}
function hapusSantri(id) {
  var s = santriById(id);
  if (!s) return hasilGagal('tidak-ditemukan', 'Santri tidak ditemukan.');
  db.santri = db.santri.filter(function (x) { return x.id !== id; });
  db.nilai = db.nilai.filter(function (n) { return n.santriId !== id; });
  db.tabunganTx = db.tabunganTx.filter(function (t) { return t.santriId !== id; });
  db.hafalanLog = db.hafalanLog.filter(function (h) { return h.santriId !== id; });
  /* T-11: hapus juga entri santri ini dari peta absensi tiap pertemuan,
     supaya riwayat/export tidak menampilkan ID mentah sebagai nama. */
  db.pertemuan.forEach(function (p) { if (p.absensi) delete p.absensi[id]; });
  tandaiDataAsli();
  save('Hapus santri ' + s.nama);
  return hasilOk({ nama: s.nama });
}

/* --- Tabungan --- */
function catatTabungan(santriId, jenis, jumlah, catatan, opts) {
  var s = santriById(santriId);
  if (!s) return hasilGagal('tidak-ditemukan', 'Santri tidak ditemukan.');
  if (jenis !== 'Setor' && jenis !== 'Tarik') return hasilGagal('jenis-tidak-dikenali', 'Jenis harus Setor atau Tarik.');
  var jml = angkaRp(jumlah);
  if (jml == null || jml <= 0) return hasilGagal('jumlah-tidak-valid', 'Jumlah harus lebih dari Rp0.');
  if (jenis === 'Tarik' && jml > s.tabungan) return hasilGagal('saldo-tidak-cukup', 'Penarikan ditolak: saldo ' + s.nama + ' hanya ' + rupiah(s.tabungan) + '.');
  if (jenis === 'Tarik' && jml > 200000 && !(opts && opts.confirmed)) {
    return { ok: false, needsConfirm: true, error: 'butuh-konfirmasi', message: 'Tarik ' + rupiah(jml) + ' dari tabungan ' + s.nama + ' (saldo ' + rupiah(s.tabungan) + '). Lanjutkan?' };
  }
  if (jenis === 'Setor') s.tabungan += jml; else s.tabungan -= jml;
  var tx = { id: uid('t'), santriId: s.id, jenis: jenis, jumlah: jml, tanggal: todayStr(), catatan: String(catatan || '').trim(), saldoSetelah: s.tabungan };
  db.tabunganTx.push(tx);
  tandaiDataAsli();
  save(jenis + ' tabungan ' + s.nama + ' ' + rupiah(jml));
  return hasilOk({ saldo: s.tabungan, transaksi: tx });
}
function tambahTarget(nama, jumlah) {
  var nm = String(nama || '').trim();
  var jml = angkaRp(jumlah);
  if (!nm) return hasilGagal('nama-wajib', 'Nama target wajib diisi.');
  if (jml == null || jml <= 0) return hasilGagal('jumlah-tidak-valid', 'Jumlah target harus lebih dari Rp0.');
  var t = { id: uid('tg'), nama: nm, target: jml, terkumpul: 0 };
  db.target.push(t);
  tandaiDataAsli();
  save('Tambah target ' + nm);
  return hasilOk({ target: t });
}

/* --- Keuangan --- */
function simpanKeuangan(data) {
  data = data || {};
  var nama = String(data.nama || '').trim();
  var jumlah = angkaRp(data.jumlah);
  var jenis = data.jenis === 'Keluar' ? 'Keluar' : 'Masuk';
  if (!nama) return hasilGagal('nama-wajib', 'Nama transaksi wajib diisi.');
  if (jumlah == null || jumlah <= 0) return hasilGagal('jumlah-tidak-valid', 'Jumlah harus lebih dari Rp0.');
  var daftarKat = jenis === 'Masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;
  var kategori = String(data.kategori || '').trim();
  if (daftarKat.indexOf(kategori) === -1) return hasilGagal('kategori-tidak-valid', 'Kategori harus salah satu dari: ' + daftarKat.join(', ') + '.');
  var tx = { id: uid('k'), jenis: jenis, jenjang: (data.jenjang === 'Ibtidaiyah' ? 'Ibtidaiyah' : 'TPQ'), kategori: kategori, nama: nama, jumlah: jumlah, tanggal: (tglValid(data.tanggal) ? data.tanggal : todayStr()), catatan: String(data.catatan || '').trim() };
  db.keuanganTx.push(tx);
  tandaiDataAsli();
  save('Tambah transaksi keuangan ' + nama);
  return hasilOk({ transaksi: tx, saldoKas: saldoKas().saldo });
}
function hapusKeuangan(id) {
  var t = db.keuanganTx.find(function (x) { return x.id === id; });
  if (!t) return hasilGagal('tidak-ditemukan', 'Transaksi tidak ditemukan.');
  db.keuanganTx = db.keuanganTx.filter(function (x) { return x.id !== id; });
  tandaiDataAsli();
  save('Hapus transaksi keuangan ' + t.nama);
  return hasilOk({ nama: t.nama });
}
/* T-22: ubah transaksi keuangan (seperti ubah RAPBM/biaya/nilai yang sudah
   ada). Validasi sama seperti simpanKeuangan; kategori divalidasi terhadap
   jenis BARU bila jenis ikut diubah. */
function ubahKeuangan(id, data) {
  var t = db.keuanganTx.find(function (x) { return x.id === id; });
  if (!t) return hasilGagal('tidak-ditemukan', 'Transaksi tidak ditemukan.');
  data = data || {};
  var nama = String(data.nama != null ? data.nama : t.nama).trim();
  var jumlah = data.jumlah != null ? angkaRp(data.jumlah) : t.jumlah;
  var jenis = data.jenis === 'Keluar' ? 'Keluar' : (data.jenis === 'Masuk' ? 'Masuk' : t.jenis);
  if (!nama) return hasilGagal('nama-wajib', 'Nama transaksi wajib diisi.');
  if (jumlah == null || jumlah <= 0) return hasilGagal('jumlah-tidak-valid', 'Jumlah harus lebih dari Rp0.');
  var daftarKat = jenis === 'Masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;
  var kategori = String(data.kategori != null ? data.kategori : t.kategori).trim();
  if (daftarKat.indexOf(kategori) === -1) return hasilGagal('kategori-tidak-valid', 'Kategori harus salah satu dari: ' + daftarKat.join(', ') + '.');
  t.jenis = jenis;
  t.jenjang = (data.jenjang === 'Ibtidaiyah' ? 'Ibtidaiyah' : (data.jenjang === 'TPQ' ? 'TPQ' : t.jenjang));
  t.kategori = kategori;
  t.nama = nama;
  t.jumlah = jumlah;
  if (data.tanggal != null && tglValid(data.tanggal)) t.tanggal = data.tanggal;
  if (data.catatan != null) t.catatan = String(data.catatan).trim();
  tandaiDataAsli();
  save('Ubah transaksi keuangan ' + nama);
  return hasilOk({ transaksi: t, saldoKas: saldoKas().saldo });
}
function toggleSpp(id) {
  var s = santriById(id);
  if (!s) return hasilGagal('tidak-ditemukan', 'Santri tidak ditemukan.');
  s.sppStatus = s.sppStatus === 'Lunas' ? 'Belum' : 'Lunas';
  tandaiDataAsli();
  save('Ubah status SPP ' + s.nama + ' menjadi ' + s.sppStatus);
  return hasilOk({ sppStatus: s.sppStatus });
}

/* --- RAPBM dan biaya --- */
function simpanRapbm(id, data) {
  data = data || {};
  var pos = String(data.pos || '').trim();
  var rencana = angkaRp(data.rencana);
  if (!pos) return hasilGagal('pos-wajib', 'Nama pos wajib diisi.');
  if (rencana == null || rencana < 0) return hasilGagal('rencana-tidak-valid', 'Rencana harus angka 0 atau lebih.');
  var isi = { pos: pos, jenis: (data.jenis === 'Keluar' ? 'Keluar' : 'Masuk'), jenjang: (data.jenjang === 'Ibtidaiyah' ? 'Ibtidaiyah' : 'TPQ'), rencana: rencana };
  if (id) {
    var r = db.rapbm.find(function (x) { return x.id === id; });
    if (!r) return hasilGagal('tidak-ditemukan', 'Pos RAPBM tidak ditemukan.');
    Object.assign(r, isi);
    tandaiDataAsli();
    save('Simpan pos RAPBM ' + pos);
    return hasilOk({ rapbm: r });
  }
  var baru = Object.assign({ id: uid('r') }, isi);
  db.rapbm.push(baru);
  tandaiDataAsli();
  save('Simpan pos RAPBM ' + pos);
  return hasilOk({ rapbm: baru });
}
function hapusRapbm(id) {
  var r = db.rapbm.find(function (x) { return x.id === id; });
  if (!r) return hasilGagal('tidak-ditemukan', 'Pos RAPBM tidak ditemukan.');
  db.rapbm = db.rapbm.filter(function (x) { return x.id !== id; });
  tandaiDataAsli();
  save('Hapus pos RAPBM ' + r.pos);
  return hasilOk({ pos: r.pos });
}
function simpanBiaya(id, data) {
  data = data || {};
  var nama = String(data.nama || '').trim();
  var jumlah = angkaRp(data.jumlah);
  if (!nama) return hasilGagal('nama-wajib', 'Nama biaya wajib diisi.');
  if (jumlah == null || jumlah <= 0) return hasilGagal('jumlah-tidak-valid', 'Jumlah harus lebih dari Rp0.');
  var isi = { nama: nama, jumlah: jumlah, keterangan: String(data.keterangan || '').trim() };
  if (id) {
    var b = db.biaya.find(function (x) { return x.id === id; });
    if (!b) return hasilGagal('tidak-ditemukan', 'Biaya tidak ditemukan.');
    Object.assign(b, isi);
    tandaiDataAsli();
    save('Simpan biaya ' + nama);
    return hasilOk({ biaya: b });
  }
  var baru = Object.assign({ id: uid('b') }, isi);
  db.biaya.push(baru);
  tandaiDataAsli();
  save('Simpan biaya ' + nama);
  return hasilOk({ biaya: baru });
}
function hapusBiaya(id) {
  var b = db.biaya.find(function (x) { return x.id === id; });
  if (!b) return hasilGagal('tidak-ditemukan', 'Biaya tidak ditemukan.');
  db.biaya = db.biaya.filter(function (x) { return x.id !== id; });
  tandaiDataAsli();
  save('Hapus biaya ' + b.nama);
  return hasilOk({ nama: b.nama });
}

/* --- Kelas dan absensi --- */
/* T-02: tambah kelas baru (dipakai tombol "Tambah kelas" di layar Kelas).
   Nama wajib dan unik (abaikan huruf besar/kecil + spasi tepi); jenjang
   di luar TPQ/Ibtidaiyah memakai TPQ. */
function tambahKelas(data) {
  data = data || {};
  var nama = String(data.nama || '').trim();
  if (!nama) return hasilGagal('nama-wajib', 'Nama kelas wajib diisi.');
  if (db.kelas.some(function (k) { return String(k.nama).trim().toLowerCase() === nama.toLowerCase(); })) {
    return hasilGagal('nama-duplikat', 'Kelas "' + nama + '" sudah ada.');
  }
  var k = {
    id: uid('k'), nama: nama,
    ustadz: String(data.ustadz || '').trim(),
    jadwal: String(data.jadwal || '').trim(),
    ruang: String(data.ruang || '').trim(),
    jenjang: (data.jenjang === 'Ibtidaiyah' ? 'Ibtidaiyah' : 'TPQ')
  };
  db.kelas.push(k);
  tandaiDataAsli();
  save('Tambah kelas ' + nama);
  return hasilOk({ kelas: k });
}
/* DIUBAH v2 (perbaikan bug v1): di v1 simpanPertemuan() memakai kelas dari
   ui.kelasId tanpa memeriksa; kalau kelas tidak ada, kelas.nama melempar.
   Di v2 kelasId diperiksa dulu dan kegagalan dikembalikan sebagai hasil. */
function simpanPertemuan(kelasId, tanggal, materi, absensi) {
  var kelas = kelasById(kelasId);
  if (!kelas) return hasilGagal('tidak-ditemukan', 'Kelas tidak ditemukan.');
  var mt = String(materi || '').trim();
  if (!mt) return hasilGagal('materi-wajib', 'Isi dulu materi hari ini.');
  var tgl = tglValid(tanggal) ? tanggal : todayStr();
  var muridKelas = santriAktif().filter(function (s) { return s.kelas === kelas.nama; });
  if (!muridKelas.length) return hasilGagal('kelas-kosong', 'Tidak ada santri aktif di kelas ini.');
  var abs = {};
  muridKelas.forEach(function (s) { abs[s.id] = (absensi && absensi[s.id]) || 'Hadir'; });
  /* T-20: satu tanggal + satu kelas hanya boleh punya SATU pertemuan.
     Diputuskan: UPSERT — pertemuan tanggal+kelas yang sama ditimpa (materi
     + absensi diperbarui), supaya koreksi absensi tetap bisa dilakukan
     tanpa duplikat. Bukan ditolak, karena koreksi adalah kebutuhan nyata
     (salah ketik kehadiran). */
  var sudahAda = db.pertemuan.find(function (x) { return x.kelasId === kelas.id && x.tanggal === tgl; });
  var p;
  if (sudahAda) {
    sudahAda.materi = mt;
    sudahAda.absensi = abs;
    p = sudahAda;
  } else {
    p = { id: uid('p'), kelasId: kelas.id, tanggal: tgl, materi: mt, absensi: abs };
    db.pertemuan.push(p);
  }
  /* Catatan jujur (T-20): field `s.kehadiran` di bawah ini memang ditulis
     ulang dari riwayat pertemuan setiap kali pertemuan disimpan — jadi angka
     itu hasil hitung, bukan angka yang diinput manual. Layar Kelas
     menjelaskannya ("Kehadiran dihitung dari riwayat pertemuan"). */
  muridKelas.forEach(function (s) {
    var baru = hitungKehadiranDariPertemuan(s.id);
    if (baru != null) s.kehadiran = baru;
  });
  ui.absDraft = {}; ui.kelasMateri = '';
  tandaiDataAsli();
  save('Simpan pertemuan ' + kelas.nama + ' ' + tgl);
  var hadir = Object.keys(abs).filter(function (k) { return abs[k] === 'Hadir'; }).length;
  return hasilOk({ pertemuan: p, hadir: hadir, total: muridKelas.length, diperbarui: !!sudahAda });
}
function naikJilidSantri(id) {
  var s = santriById(id);
  if (!s) return hasilGagal('tidak-ditemukan', 'Santri tidak ditemukan.');
  var lama = s.jilid;
  var baru = naikJilid(lama);
  if (baru === lama) return hasilGagal('jilid-tertinggi', s.nama + ' sudah di jilid tertinggi.');
  s.jilid = baru; s.halaman = 1;
  tandaiDataAsli();
  save('Naik jilid ' + s.nama);
  return hasilOk({ jilid: baru, jilidLama: lama });
}

/* --- Hafalan --- */
function catatHafalan(santriId, jenis, materi, nilai) {
  var s = santriById(santriId);
  if (!s) return hasilGagal('tidak-ditemukan', 'Santri tidak ditemukan.');
  var mt = String(materi || '').trim();
  if (!mt) return hasilGagal('materi-wajib', 'Materi wajib diisi.');
  if (jenis !== 'Iqra' && jenis !== 'Hafalan') return hasilGagal('jenis-tidak-dikenali', 'Jenis harus Iqra atau Hafalan.');
  if (['Lancar', 'Cukup', 'Perlu Bimbingan'].indexOf(nilai) === -1) return hasilGagal('nilai-tidak-valid', 'Nilai harus Lancar, Cukup, atau Perlu Bimbingan.');
  var h = { id: uid('h'), santriId: s.id, tanggal: todayStr(), jenis: jenis, materi: mt, nilai: nilai };
  db.hafalanLog.push(h);
  tandaiDataAsli();
  save('Catat setoran ' + s.nama);
  return hasilOk({ hafalan: h });
}

/* --- Guru --- */
function simpanGuru(id, data) {
  data = data || {};
  var nama = String(data.nama || '').trim();
  var honor = angkaRp(data.honor);
  if (!nama) return hasilGagal('nama-wajib', 'Nama guru wajib diisi.');
  if (honor == null || honor < 0) return hasilGagal('honor-tidak-valid', 'Honor harus angka 0 atau lebih.');
  var isi = {
    nama: nama,
    kelas: String(data.kelas || 'Iqra 1').trim() || 'Iqra 1',
    peran: (PERAN_GURU.indexOf(data.peran) !== -1 ? data.peran : 'Guru'),
    jenjang: (['TPQ', 'Ibtidaiyah', 'TPQ dan Ibtidaiyah'].indexOf(data.jenjang) !== -1 ? data.jenjang : 'TPQ'),
    hp: String(data.hp || '').trim(),
    honor: honor
  };
  /* T-21: sama seperti simpanSantri — foto hanya ditimpa bila ada foto
     baru yang valid; edit tanpa foto tidak menghapus foto lama. */
  if (data.foto) { var fotoBaruG = bersihFotoInput(data.foto); if (fotoBaruG) isi.foto = fotoBaruG; }
  if (id) {
    var g = guruById(id);
    if (!g) return hasilGagal('tidak-ditemukan', 'Guru tidak ditemukan.');
    Object.keys(isi).forEach(function (k) { g[k] = isi[k]; });
    tandaiDataAsli();
    save('Ubah guru ' + nama);
    return hasilOk({ guru: g });
  }
  var baru = Object.assign({ id: uid('g'), honorStatus: 'Belum' }, isi);
  db.guru.push(baru);
  tandaiDataAsli();
  save('Tambah guru ' + nama);
  return hasilOk({ guru: baru });
}
function toggleHonor(id) {
  var g = guruById(id);
  if (!g) return hasilGagal('tidak-ditemukan', 'Guru tidak ditemukan.');
  g.honorStatus = g.honorStatus === 'Lunas' ? 'Belum' : 'Lunas';
  tandaiDataAsli();
  save('Ubah status honor ' + g.nama);
  return hasilOk({ honorStatus: g.honorStatus });
}
function hapusGuru(id) {
  var g = guruById(id);
  if (!g) return hasilGagal('tidak-ditemukan', 'Guru tidak ditemukan.');
  db.guru = db.guru.filter(function (x) { return x.id !== id; });
  db.jadwalPiket = db.jadwalPiket.filter(function (p) { return p.guruId !== id; });
  /* T-18: bersihkan pemakaian guru di jadwal KBM dan daftar kelas (dulu
     jadwal tetap menyebut nama guru yang sudah dihapus dan kelas.ustadz
     tetap menunjuknya). Jumlah pemakaian dikembalikan supaya UI bisa
     menyebutkannya di teks konfirmasi hapus. */
  var jadwalDibersihkan = 0;
  db.jadwalKbm.forEach(function (j) { if (j.guru === g.nama) { j.guru = ''; jadwalDibersihkan++; } });
  var kelasDibersihkan = 0;
  db.kelas.forEach(function (k) { if (k.ustadz === g.nama) { k.ustadz = ''; kelasDibersihkan++; } });
  tandaiDataAsli();
  save('Hapus guru ' + g.nama);
  return hasilOk({ nama: g.nama, jadwalDibersihkan: jadwalDibersihkan, kelasDibersihkan: kelasDibersihkan });
}

/* --- Pengumuman --- */
function tambahPengumuman(judul, isi) {
  var jd = String(judul || '').trim();
  var is = String(isi || '').trim();
  if (!jd || !is) return hasilGagal('judul-isi-wajib', 'Judul dan isi pengumuman wajib diisi.');
  var p = { id: uid('u'), judul: jd, isi: is, tanggal: todayStr(), aktif: true };
  db.pengumuman.push(p);
  tandaiDataAsli();
  save('Tambah pengumuman ' + jd);
  return hasilOk({ pengumuman: p });
}
function togglePengumuman(id) {
  var p = db.pengumuman.find(function (x) { return x.id === id; });
  if (!p) return hasilGagal('tidak-ditemukan', 'Pengumuman tidak ditemukan.');
  p.aktif = !p.aktif;
  tandaiDataAsli();
  save('Ubah pengumuman ' + p.judul);
  return hasilOk({ aktif: p.aktif });
}
function hapusPengumuman(id) {
  var p = db.pengumuman.find(function (x) { return x.id === id; });
  if (!p) return hasilGagal('tidak-ditemukan', 'Pengumuman tidak ditemukan.');
  db.pengumuman = db.pengumuman.filter(function (x) { return x.id !== id; });
  tandaiDataAsli();
  save('Hapus pengumuman ' + p.judul);
  return hasilOk({ judul: p.judul });
}

/* --- Nilai --- */
function simpanNilai(santriId, jenis, mapel, nilai, tanggal, catatan) {
  var s = santriById(santriId);
  if (!s) return hasilGagal('tidak-ditemukan', 'Santri tidak ditemukan.');
  if (JENIS_NILAI.indexOf(jenis) === -1) return hasilGagal('jenis-tidak-dikenali', 'Jenis harus Harian, Imda, atau Praktek.');
  var nil = Number(nilai);
  if (isNaN(nil) || nil < 0 || nil > 100) return hasilGagal('nilai-tidak-valid', 'Nilai harus 0 sampai 100.');
  var n = { id: uid('n'), santriId: s.id, jenis: jenis, mapel: String(mapel || 'Iqra').trim() || 'Iqra', nilai: nil, tanggal: (tglValid(tanggal) ? tanggal : todayStr()), catatan: String(catatan || '').trim() };
  db.nilai.push(n);
  tandaiDataAsli();
  save('Tambah nilai ' + jenis + ' ' + s.nama);
  return hasilOk({ nilai: n });
}
function ubahNilai(id, data) {
  var n = db.nilai.find(function (x) { return x.id === id; });
  if (!n) return hasilGagal('tidak-ditemukan', 'Nilai tidak ditemukan.');
  data = data || {};
  var nil = Number(data.nilai);
  if (isNaN(nil) || nil < 0 || nil > 100) return hasilGagal('nilai-tidak-valid', 'Nilai harus 0 sampai 100.');
  if (data.mapel != null) n.mapel = String(data.mapel).trim() || n.mapel;
  n.nilai = nil;
  if (data.catatan != null) n.catatan = String(data.catatan).trim();
  tandaiDataAsli();
  save('Ubah nilai ' + (santriById(n.santriId) || {}).nama);
  return hasilOk({ nilai: n });
}
function hapusNilai(id) {
  var n = db.nilai.find(function (x) { return x.id === id; });
  if (!n) return hasilGagal('tidak-ditemukan', 'Nilai tidak ditemukan.');
  db.nilai = db.nilai.filter(function (x) { return x.id !== id; });
  tandaiDataAsli();
  save('Hapus nilai ' + ((santriById(n.santriId) || {}).nama || ''));
  return hasilOk({});
}

/* --- KBM: alokasi, jadwal, piket, absensi guru --- */
function simpanAlokasi(id, data) {
  data = data || {};
  /* T-16: pakai parseFloat (bukan parseInt) supaya "4.5" tetap 4.5 jam,
     bukan diam-diam dibulatkan jadi 4. */
  var jam = parseFloat(data.jamPerMinggu);
  if (isNaN(jam) || jam < 1) return hasilGagal('jam-tidak-valid', 'Jam per minggu harus 1 atau lebih.');
  var isi = { kelas: String(data.kelas || 'Iqra 1').trim() || 'Iqra 1', mapel: String(data.mapel || 'Iqra').trim() || 'Iqra', jamPerMinggu: jam, hari: String(data.hari || '').trim() };
  if (id) {
    var a = db.alokasiWaktu.find(function (x) { return x.id === id; });
    if (!a) return hasilGagal('tidak-ditemukan', 'Alokasi tidak ditemukan.');
    Object.assign(a, isi);
    tandaiDataAsli();
    save('Simpan alokasi waktu ' + isi.kelas + ' ' + isi.mapel);
    return hasilOk({ alokasi: a });
  }
  var baru = Object.assign({ id: uid('a') }, isi);
  db.alokasiWaktu.push(baru);
  tandaiDataAsli();
  save('Simpan alokasi waktu ' + isi.kelas + ' ' + isi.mapel);
  return hasilOk({ alokasi: baru });
}
function hapusAlokasi(id) {
  if (!db.alokasiWaktu.some(function (x) { return x.id === id; })) return hasilGagal('tidak-ditemukan', 'Alokasi tidak ditemukan.');
  db.alokasiWaktu = db.alokasiWaktu.filter(function (x) { return x.id !== id; });
  tandaiDataAsli();
  save('Hapus alokasi waktu');
  return hasilOk({});
}
function simpanJadwal(id, data) {
  data = data || {};
  var isi = {
    kelas: String(data.kelas || 'Iqra 1').trim() || 'Iqra 1',
    hari: (HARI_LIST.indexOf(data.hari) !== -1 ? data.hari : 'Senin'),
    jamMulai: String(data.jamMulai || '15:30'),
    jamSelesai: String(data.jamSelesai || '16:30'),
    mapel: String(data.mapel || 'Iqra').trim() || 'Iqra',
    guru: String(data.guru || '').trim()
  };
  /* T-16: jam selesai harus sesudah jam mulai (format "HH:MM" bisa
     dibandingkan sebagai string). */
  if (isi.jamSelesai <= isi.jamMulai) return hasilGagal('jam-tidak-valid', 'Jam selesai harus sesudah jam mulai (' + isi.jamMulai + ' - ' + isi.jamSelesai + ' tidak masuk akal).');
  /* T-16: tolak bentrok dengan jadwal lain di kelas + hari yang sama
     (rentang jam tumpang tindih). Jadwal yang sedang diubah dikecualikan. */
  var bentrok = db.jadwalKbm.some(function (j) {
    if (id && j.id === id) return false;
    if (j.kelas !== isi.kelas || j.hari !== isi.hari) return false;
    return isi.jamMulai < j.jamSelesai && isi.jamSelesai > j.jamMulai;
  });
  if (bentrok) return hasilGagal('jadwal-bentrok', 'Jadwal bentrok: kelas ' + isi.kelas + ' sudah punya jadwal hari ' + isi.hari + ' pada jam yang tumpang tindih.');
  if (id) {
    var j = db.jadwalKbm.find(function (x) { return x.id === id; });
    if (!j) return hasilGagal('tidak-ditemukan', 'Jadwal tidak ditemukan.');
    Object.assign(j, isi);
    tandaiDataAsli();
    save('Simpan jadwal KBM ' + isi.kelas + ' ' + isi.hari);
    return hasilOk({ jadwal: j });
  }
  var baru = Object.assign({ id: uid('j') }, isi);
  db.jadwalKbm.push(baru);
  tandaiDataAsli();
  save('Simpan jadwal KBM ' + isi.kelas + ' ' + isi.hari);
  return hasilOk({ jadwal: baru });
}
function hapusJadwal(id) {
  if (!db.jadwalKbm.some(function (x) { return x.id === id; })) return hasilGagal('tidak-ditemukan', 'Jadwal tidak ditemukan.');
  db.jadwalKbm = db.jadwalKbm.filter(function (x) { return x.id !== id; });
  tandaiDataAsli();
  save('Hapus jadwal KBM');
  return hasilOk({});
}
function tambahPiket(guruId, hari, keterangan) {
  var g = guruById(guruId);
  if (!g) return hasilGagal('tidak-ditemukan', 'Guru tidak ditemukan.');
  if (HARI_LIST.indexOf(hari) === -1) return hasilGagal('hari-tidak-valid', 'Hari harus salah satu dari: ' + HARI_LIST.join(', ') + '.');
  var p = { id: uid('pk'), guruId: guruId, hari: hari, keterangan: String(keterangan || '').trim() };
  db.jadwalPiket.push(p);
  tandaiDataAsli();
  save('Tambah piket ' + g.nama);
  return hasilOk({ piket: p });
}
function hapusPiket(id) {
  if (!db.jadwalPiket.some(function (x) { return x.id === id; })) return hasilGagal('tidak-ditemukan', 'Piket tidak ditemukan.');
  db.jadwalPiket = db.jadwalPiket.filter(function (x) { return x.id !== id; });
  tandaiDataAsli();
  save('Hapus jadwal piket');
  return hasilOk({});
}
/* draft = { guruId: 'Hadir'|'Izin'|'Sakit'|'Alpa' }. Hanya guru yang tampil
   (sudah difilter jenjang + peran) yang disimpan, seperti di v1. */
function simpanAbsensiGuru(kelompok, tanggal, draft) {
  if (kelompok !== 'Guru' && kelompok !== 'Pimpinan') return hasilGagal('kelompok-tidak-dikenali', 'Kelompok harus Guru atau Pimpinan.');
  var tgl = tglValid(tanggal) ? tanggal : todayStr();
  var daftar = (kelompok === 'Pimpinan' ? db.guru.filter(function (g) { return g.peran === 'Pimpinan'; }) : db.guru).filter(guruCocokJenjang);
  var disimpan = 0;
  daftar.forEach(function (g) {
    var st = draft && draft[g.id];
    if (!st) return;
    if (['Hadir', 'Izin', 'Sakit', 'Alpa'].indexOf(st) === -1) return;
    var rec = db.absensiGuru.find(function (a) { return a.guruId === g.id && a.tanggal === tgl && a.kelompok === kelompok; });
    if (rec) rec.status = st;
    else db.absensiGuru.push({ id: uid('ag'), guruId: g.id, tanggal: tgl, status: st, kelompok: kelompok });
    disimpan++;
  });
  if (disimpan > 0) tandaiDataAsli();
  save('Simpan absensi ' + kelompok + ' ' + tgl);
  return hasilOk({ disimpan: disimpan, tanggal: tgl });
}
/* T-19: `batas` opsional. Tanpa batas, kembalikan SEMUA riwayat (UI yang
   membatasi tampilan awal 12 baris + tombol "Tampilkan lebih banyak").
   Dulu fungsi ini memotong di 12 tanpa jalan melihat sisanya. */
function riwayatAbsensiGuru(kelompok, batas) {
  var semua = db.absensiGuru.filter(function (a) {
    if (a.kelompok !== kelompok) return false;
    var g = guruById(a.guruId);
    return g && guruCocokJenjang(g);
  }).slice().sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal); });
  if (typeof batas === 'number' && batas >= 0) return semua.slice(0, batas);
  return semua;
}

/* --- Pengaturan --- */
function simpanSettings(data) {
  data = data || {};
  var nama = String(data.namaTpq || '').trim();
  var spp = angkaRp(data.tarifSpp);
  if (!nama) return hasilGagal('nama-wajib', 'Nama TPQ wajib diisi.');
  if (spp == null || spp < 0) return hasilGagal('spp-tidak-valid', 'Tarif SPP harus angka 0 atau lebih.');
  db.settings.namaTpq = nama;
  if (data.kepala != null) db.settings.kepala = String(data.kepala).trim();
  db.settings.tarifSpp = spp;
  if (data.tahunAjaran != null) db.settings.tahunAjaran = String(data.tahunAjaran).trim() || '2026/2027';
  if (data.jamMasuk != null) db.settings.jamMasuk = String(data.jamMasuk) || '15:30';
  tandaiDataAsli();
  save('Ubah pengaturan');
  return hasilOk({ settings: db.settings });
}

/* --- Hapus semua / reset --- */
/* DIUBAH v2: clearAllData() langsung mengosongkan (v1 menampilkan modal
   konfirmasi dulu). UI WAJIB meminta konfirmasi pengguna sebelum memanggil
   fungsi ini; fungsi ini tidak bertanya lagi.
   A2 (ronde Bagas): pengguna SAAT INI dipertahankan apa adanya (bukan
   direset ke seed) dan sesi TIDAK dihapus — pengguna tetap login di
   aplikasi kosong, tanpa dipaksa ganti sandi. */
function clearAllData() {
  var penggunaAktif = (db && Array.isArray(db.pengguna) && db.pengguna.length) ? db.pengguna : seedPengguna();
  db = emptyData();
  db.pengguna = penggunaAktif;
  save('Hapus semua data');
  setQueue([]);
  lsRemove(QUEUE_TRIMMED_KEY);
  return db;
}
function resetToSeedConfirm() {
  /* Nama dipertahankan supaya UI lama yang memanggilnya tidak patah, tapi
     isinya hanya mengembalikan db contoh: UI WAJIB meminta konfirmasi dulu
     (checkbox + tombol), seperti perilaku v1. */
  return resetToSeed();
}

/* --- Pulihkan cadangan / import dari teks (pengganti handle*File v1) --- */
/* UI membaca file (input file / FileReader) lalu memanggil fungsi ini.
   Mengembalikan { ok, santri, guru } atau { ok: false, error, message }. */
function restoreFromText(teks) {
  var parsed;
  try { parsed = JSON.parse(teks); } catch (e) {
    return hasilGagal('file-tidak-valid', 'File cadangan tidak bisa dibaca. Pastikan file yang dipilih adalah file JSON cadangan dari aplikasi ini.');
  }
  var data = parsed.data || parsed;
  if (applyBackupData(data)) return hasilOk({ santri: db.santri.length, guru: db.guru.length });
  return hasilGagal('data-tidak-valid', 'File cadangan tidak valid. Isi file tidak berisi data TPQ Al-Muttaqin yang lengkap.');
}
function importCsvText(jenis, teks) {
  return importRows(jenis, parseCSV(teks));
}


/* ---------------- Picker murid / guru (data murni, tanpa modal) ---------------- */
/* DIUBAH v2: openSantriPicker()/openGuruPicker() v1 membuka modal DOM dan
   me-render daftar. Di v2 keduanya MENGEMBALIKAN konfigurasi picker
   { title, items, chips, onPick }; UI (Kirana) yang me-render daftar,
   kotak cari, chip, dan tombol "tampilkan lebih banyak", lalu memanggil
   onPick(item) saat pengguna memilih. Item diurutkan berdasarkan nama
   (locale 'id'), sama seperti v1. */
function santriPickerItems(hanyaAktif) {
  var list = (hanyaAktif ? santriAktif() : db.santri.filter(function (s) { return jenjangCocok(s.jenjang); })).map(function (s) {
    return { id: s.id, nama: s.nama, cari: s.nis, sub: 'NIS ' + s.nis + ' | ' + s.kelas + ' | Angkatan ' + s.angkatan + ' | Rombel ' + s.rombel, foto: s.foto, chipVal: s.kelas };
  });
  list.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  var chips = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); }).map(function (k) { return k.nama; });
  return { title: 'Pilih murid', items: list, chips: chips };
}
function guruPickerItems() {
  var list = db.guru.filter(guruCocokJenjang).map(function (g) {
    return { id: g.id, nama: g.nama, cari: g.hp, sub: g.peran + ' | ' + g.kelas + ' | ' + g.hp, foto: g.foto, chipVal: g.peran };
  });
  list.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  return { title: 'Pilih guru', items: list, chips: PERAN_GURU.slice() };
}
function filterPickerItems(items, search, chip) {
  var q = String(search || '').toLowerCase();
  return (items || []).filter(function (it) {
    if (chip && chip !== 'Semua' && it.chipVal !== chip) return false;
    if (q && (it.nama + ' ' + (it.cari || '')).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}
function openSantriPicker(onPick, hanyaAktif) {
  var cfg = santriPickerItems(hanyaAktif);
  cfg.onPick = onPick;
  return cfg;
}
function openGuruPicker(onPick) {
  var cfg = guruPickerItems();
  cfg.onPick = onPick;
  return cfg;
}

/* ---------------- Teks siap bagikan (pengganti shareText/modal v1) ---------------- */
/* Fungsi-fungsi ini hanya MEMBANGUN teks; UI yang membagikan/menyalinnya
   (navigator.share / clipboard). */
function strukTabungan(santriId) {
  var s = santriById(santriId);
  if (!s) return null;
  var tx = db.tabunganTx.filter(function (t) { return t.santriId === santriId; }).slice(-5);
  return 'STRUK TABUNGAN\n' + db.settings.namaTpq + '\n' + s.nama + ' (NIS ' + s.nis + ')\nSaldo: ' + rupiah(s.tabungan) + '\n' +
    tx.map(function (t) { return fmtTanggal(t.tanggal) + ' ' + t.jenis + ' ' + rupiah(t.jumlah); }).join('\n');
}
function teksRapor(santriId, semesterId) {
  var s = santriById(santriId);
  if (!s) return null;
  var r = hitungRapor(santriId, semesterId);
  if (r.akhir == null) return null;
  return 'RAPOR ' + db.settings.namaTpq + '\n' + s.nama + ' (NIS ' + s.nis + ', ' + s.kelas + ')\nTahun ajaran ' + db.settings.tahunAjaran +
    (semesterId ? '\n' + semesterById(semesterId).label : '') +
    '\nHarian: ' + (r.harian == null ? '-' : r.harian) + '\nImda: ' + (r.imda == null ? '-' : r.imda) + '\nPraktek: ' + (r.praktek == null ? '-' : r.praktek) +
    '\nNilai akhir: ' + r.akhir + '\nPredikat: ' + predikat(r.akhir);
}
function pengingatSPP(santriId) {
  var s = santriById(santriId);
  if (!s) return null;
  var teks = 'Assalamu\'alaikum ' + s.wali + ', kami dari ' + db.settings.namaTpq + ' mengingatkan SPP ' + s.nama + ' (' + s.kelas + ') sebesar ' + rupiah(db.settings.tarifSpp) + ' bulan ini belum lunas. Terima kasih.';
  s.sppReminderSent = true;
  tandaiDataAsli();
  save('Kirim pengingat SPP ' + s.nama);
  return teks;
}


/* ---------------- Self-test level mesin ---------------- */
/* DIUBAH v2: menggantikan runSelfTest() v1 (yang memakai DOM: #selftest-root,
   renderDashboard/renderKeuangan/renderPenilaian, setMode, onboarding).
   runEngineSelfTests(t) hanya menguji LAPISAN DATA dan tidak menyentuh DOM
   sama sekali, jadi bisa jalan di browser maupun di Node.
   t = fungsi pencatat seperti di v1: t(nama, ok, detail).
   Mengembalikan Promise<{ pass, fail }>. Setelah selesai:
   - bila masuk dengan data contoh: data dikembalikan ke data contoh dan
     antrean dikosongkan; sandi admin dipulihkan ke keadaan SEBELUM
     selftest (Y-N3) supaya tidak tertinggal sandi uji.
   - bila masuk dengan data ASLI (panggilan langsung, model S3): TIDAK
     ADA yang diubah — bersih() menolak menghapus, dan ekor mengembalikan
     snapshot yang diambil saat masuk (data + pengguna + sesi + antrean
     + jenjang + profil + konfigurasi sinkron). */
function runEngineSelfTests(t) {
  var pass = 0, fail = 0;
  function catat(nama, ok, detail) {
    if (ok) pass++; else fail++;
    try { t(nama, !!ok, detail); } catch (e) { /* pencatat tidak boleh menggagalkan uji */ }
  }
  /* Guard mode selftest (§6): dinyalakan selama suite berjalan; fungsi
     pembalik isContoh (tandaiDataAsli) menjadi no-op selama flag menyala.
     Disimpan + dipulihkan (bukan sekadar dimatikan) supaya panggilan
     bersarang (tes Y-N3 memanggil runEngineSelfTests di dalam suite)
     tidak mematikan guard milik pemanggil luarnya. */
  var flagSelftestLuar = selftestAktif;
  selftestAktif = true;
  var kedalamanLuar = kedalamanSelftest;
  kedalamanSelftest++;
  var cfgAwal = getSheetCfg();
  var jenjangAwal = getJenjang();
  /* Keadaan saat masuk — penentu perilaku bersih() dan ekor:
     - isContohAwal true (data contoh): suite jalan normal seperti biasa.
     - isContohAwal false (data asli): suite tetap jalan (asersi-asersinya
       dicatat ke pencatat yang diberikan), TAPI tidak satu pun bersih()
       boleh menghapus, dan ekor memulihkan snapshot di bawah. Kunci
       memakai keadaan AWAL, bukan keadaan berjalan: blok DB-KOSONG di
       tengah suite sengaja memanggil clearAllData() (isContoh=false, db
       kosong) dan suite sesudahnya tetap butuh reseed — jadi guard tidak
       boleh membaca isContoh berjalan. */
  var isContohAwal = db.isContoh === true;
  /* Kredensial admin SEBELUM selftest (Y-N3): hanya salt/hash/flag yang
     disalin — tidak pernah kata sandi plaintext. Dipulihkan resetToSeed()
     di ekor bila masuk dengan data contoh. */
  var kredensialAdminAwal = null;
  try {
    var adminAwal = cariPengguna('admin');
    if (adminAwal) kredensialAdminAwal = JSON.parse(JSON.stringify(adminAwal));
  } catch (e) { kredensialAdminAwal = null; }
  /* Snapshot penuh untuk jalur data asli (Y-N3): db + antrean + sesi +
     jenjang + profil + konfigurasi sinkron. Diambil HANYA bila masuk
     dengan data asli; di jalur contoh tidak dibutuhkan (ekor me-reseed). */
  var snapshotAsli = null;
  if (!isContohAwal) {
    try {
      snapshotAsli = {
        db: JSON.parse(JSON.stringify(db)),
        antrean: JSON.parse(JSON.stringify(getQueue())),
        sesi: lsGet(SESI_KEY),
        jenjang: lsGet(JENJANG_KEY),
        profil: lsGet(PROFIL_KEY),
        cfg: JSON.parse(JSON.stringify(getSheetCfg()))
      };
    } catch (e) { snapshotAsli = null; }
  }
  /* Kembalikan SEMUA keadaan ke snapshot masuk (jalur data asli). Isi
     dikembalikan persis; yang berubah hanya metadata teknis save()
     (_updatedAt baru + satu entri antrean yang langsung ditimpa lagi
     oleh setQueue snapshot). Kembalikan true bila snapshot ada. */
  function pulihkanSnapshotAsli() {
    if (!snapshotAsli) return false;
    try {
      db = JSON.parse(JSON.stringify(snapshotAsli.db));
      save('Self-test: pulihkan data asli');
    } catch (e) { /* abaikan */ }
    try { setQueue(JSON.parse(JSON.stringify(snapshotAsli.antrean))); } catch (e) { /* abaikan */ }
    try { if (snapshotAsli.sesi == null) lsRemove(SESI_KEY); else lsSet(SESI_KEY, snapshotAsli.sesi); } catch (e) { /* abaikan */ }
    try { if (snapshotAsli.jenjang == null) lsRemove(JENJANG_KEY); else lsSet(JENJANG_KEY, snapshotAsli.jenjang); } catch (e) { /* abaikan */ }
    try { if (snapshotAsli.profil == null) lsRemove(PROFIL_KEY); else lsSet(PROFIL_KEY, snapshotAsli.profil); } catch (e) { /* abaikan */ }
    try { setSheetCfg(JSON.parse(JSON.stringify(snapshotAsli.cfg))); } catch (e) { /* abaikan */ }
    try { ui.jenjang = getJenjang(); } catch (e) { /* abaikan */ }
    syncSimOffline = false;
    return true;
  }
  function bersih() {
    /* Y-N3 / S1 (tambahan v22 — mengembalikan penjaga v21 yang hilang
       saat merge v22): self-test TIDAK BOLEH menghapus data bila masuk
       dengan data asli. Bila data asli, lewati SELURUH penghapusan
       (tanpa seedData, tanpa save, tanpa keluarPengguna) dan catat
       sebagai langkah dilewati. Kirana meng-gate pemicu ?selftest=1 di
       app.js (v21: bolehSelftest()); ini pertahanan keduanya bila
       pemicu itu tetap terpanggil — dan satu-satunya yang menahan
       panggilan langsung runEngineSelfTests dari DevTools. */
    if (!isContohAwal) {
      catat('Self-test dilewati: data bukan contoh — bersih() menolak menghapus data asli', true, 'isContoh saat masuk=' + isContohAwal);
      return;
    }
    db = seedData();
    save('Self-test: kembalikan data contoh');
    setQueue([]);
    keluarPengguna();
    setSheetCfg(cfgAwal);
    setJenjang('Semua');
    ui.santriStatus = 'Aktif';
    ui.santriSearch = '';
    ui.santriKelas = 'Semua';
    ui.santriAngkatan = 'Semua';
    ui.nilaiTab = 'Harian';
    syncSimOffline = false;
  }
  function jalankan() {
    bersih();
    /* Seed */
    catat('Seed berisi 40 santri', db.santri.length === 40, db.santri.length + ' santri');
    catat('Seed: 24 santri TPQ dan 16 santri Ibtidaiyah', db.santri.filter(function (s) { return s.jenjang === 'TPQ'; }).length === 24 && db.santri.filter(function (s) { return s.jenjang === 'Ibtidaiyah'; }).length === 16, 'TPQ ' + db.santri.filter(function (s) { return s.jenjang === 'TPQ'; }).length + ', Ibtidaiyah ' + db.santri.filter(function (s) { return s.jenjang === 'Ibtidaiyah'; }).length);
    catat('Seed berisi 10 kelas dan 5 guru', db.kelas.length === 10 && db.guru.length === 5, db.kelas.length + ' kelas, ' + db.guru.length + ' guru');
    catat('Seed ditandai Data contoh', db.isContoh === true);
    catat('6 santri asli tetap ada', ['Ahmad Fauzi', 'Siti Maryam', 'Budi Santoso', 'Aisyah Putri', 'Muhammad Rizki', 'Fatimah Zahra'].every(function (n) { return db.santri.some(function (s) { return s.nama === n; }); }));
    /* Jenis kelamin (jk): seed 20 L / 20 P, aktif 19 L / 19 P
       (s7 Lulus, s8 Keluar). Rekap per kelas aktif harus cocok. */
    catat('Seed: semua 40 santri punya jk L/P', db.santri.every(function (s) { return s.jk === 'L' || s.jk === 'P'; }));
    var rkSemua = rekapGender(db.santri);
    catat('Seed: 20 L / 20 P', rkSemua.l === 20 && rkSemua.p === 20 && rkSemua.kosong === 0, 'L' + rkSemua.l + '/P' + rkSemua.p + '/kosong ' + rkSemua.kosong);
    var rkKelas = function (nama) { return rekapGender(db.santri.filter(function (s) { return s.kelas === nama && s.status === 'Aktif'; })); };
    var rkOk = function (nama, l, p) { var r = rkKelas(nama); return r.l === l && r.p === p && r.kosong === 0; };
    catat('Rekap jk per kelas: Iqra 1 L4/P3', rkOk('Iqra 1', 4, 3));
    catat('Rekap jk per kelas: Iqra 2 L2/P3', rkOk('Iqra 2', 2, 3));
    catat('Rekap jk per kelas: Iqra 3 L5/P0', rkOk('Iqra 3', 5, 0));
    catat('Rekap jk per kelas: Tahfidz 1 L0/P5', rkOk('Tahfidz 1', 0, 5));
    catat('Rekap jk per kelas: Kelas 1 L2/P1', rkOk('Kelas 1', 2, 1));
    catat('Rekap jk per kelas: Kelas 2 L1/P2', rkOk('Kelas 2', 1, 2));
    catat('Rekap jk per kelas: Kelas 3 L2/P1', rkOk('Kelas 3', 2, 1));
    catat('Rekap jk per kelas: Kelas 4 L1/P2', rkOk('Kelas 4', 1, 2));
    catat('Rekap jk per kelas: Kelas 5 L1/P1', rkOk('Kelas 5', 1, 1));
    catat('Rekap jk per kelas: Kelas 6 L1/P1', rkOk('Kelas 6', 1, 1));
    var rkTpq = rekapGender(db.santri.filter(function (s) { return s.jenjang === 'TPQ' && s.status === 'Aktif'; }));
    var rkIbt = rekapGender(db.santri.filter(function (s) { return s.jenjang === 'Ibtidaiyah' && s.status === 'Aktif'; }));
    catat('Rekap jk: TPQ aktif L11/P11', rkTpq.l === 11 && rkTpq.p === 11 && rkTpq.kosong === 0, 'L' + rkTpq.l + '/P' + rkTpq.p);
    catat('Rekap jk: Ibtidaiyah aktif L8/P8', rkIbt.l === 8 && rkIbt.p === 8 && rkIbt.kosong === 0, 'L' + rkIbt.l + '/P' + rkIbt.p);
    var rkAktif = rekapGender(db.santri.filter(function (s) { return s.status === 'Aktif'; }));
    catat('Rekap jk: semua aktif L19/P19', rkAktif.l === 19 && rkAktif.p === 19 && rkAktif.kosong === 0, 'L' + rkAktif.l + '/P' + rkAktif.p);
    catat('rekapGender menghitung undefined/"" sebagai kosong', (function () { var r = rekapGender([{ jk: 'L' }, { jk: 'P' }, {}, { jk: '' }, { jk: 'X' }]); return r.l === 1 && r.p === 1 && r.kosong === 3; })());
    /* Jenjang */
    setJenjang('TPQ');
    catat('Jenjang TPQ: 22 santri aktif', santriAktif().length === 22, santriAktif().length + ' aktif');
    catat('Guru TPQ: 3 guru (termasuk kepala dua jenjang)', db.guru.filter(guruCocokJenjang).length === 3, db.guru.filter(guruCocokJenjang).length + ' guru');
    setJenjang('Ibtidaiyah');
    catat('Jenjang Ibtidaiyah: 16 santri aktif', santriAktif().length === 16, santriAktif().length + ' aktif');
    catat('Guru Ibtidaiyah: 3 guru (termasuk kepala dua jenjang)', db.guru.filter(guruCocokJenjang).length === 3, db.guru.filter(guruCocokJenjang).length + ' guru');
    setJenjang('Semua');
    catat('Jenjang Semua: 38 santri aktif', santriAktif().length === 38, santriAktif().length + ' aktif');
    /* T-24: seed dirapikan 15 Nov 2026 — Ibtidaiyah masuk 200rb, keluar
       150rb (Operasional 400rb -> 150rb, saldo tidak lagi negatif);
       Semua masuk 3,95jt, keluar 3,05jt (SPP November 2,8jt -> 1,9jt
       = 38 santri aktif x 50rb; Honor guru Oktober 1,2jt -> 2,55jt
       = 3 guru termurah). Saldo Semua Rp900.000. */
    catat('Saldo kas Ibtidaiyah sesuai data contoh (masuk 200rb, keluar 150rb)', saldoKas('Ibtidaiyah').saldo === 50000, rupiah(saldoKas('Ibtidaiyah').saldo));
    catat('Saldo kas Semua sesuai data contoh (masuk 3,95jt, keluar 3,05jt)', saldoKas('Semua').saldo === 900000, rupiah(saldoKas('Semua').saldo));
    catat('Total tabungan santri aktif Rp2.400.000', totalTabungan() === 2400000, rupiah(totalTabungan()));
    var arusIb = arusKasPerBulan('Ibtidaiyah')['2026-11'];
    catat('Arus kas per bulan mengikuti filter jenjang (Ibtidaiyah Nov: masuk 200rb, keluar 150rb)', arusIb && arusIb.masuk === 200000 && arusIb.keluar === 150000, arusIb ? 'masuk ' + arusIb.masuk + ', keluar ' + arusIb.keluar : 'tidak ada');
    setJenjang('TPQ');
    catat('Jadwal piket mengikuti filter jenjang TPQ (5 piket)', piketTampil().length === 5, piketTampil().length + ' piket');
    setJenjang('Semua');
    catat('Jadwal piket jenjang Semua (7 piket)', piketTampil().length === 7, piketTampil().length + ' piket');
    /* Rapor 40/30/30 */
    var r = hitungRapor('s1', 'ganjil-2627');
    catat('Rapor s1 semester ganjil-2627: Harian 82.5, Imda 90, Praktek 88, Akhir 86.4', r.harian === 82.5 && r.imda === 90 && r.praktek === 88 && r.akhir === 86.4, 'Harian ' + r.harian + ', Imda ' + r.imda + ', Praktek ' + r.praktek + ', Akhir ' + r.akhir);
    catat('Predikat 86.4 adalah B (Baik)', predikat(86.4) === 'B (Baik)', predikat(86.4));
    var rGenap = hitungRapor('s1', 'genap-2627');
    catat('Semester Genap 2026/2027 jujur kosong (belum ada nilai di rentang itu)', rGenap.harian == null && rGenap.imda == null && rGenap.praktek == null && rGenap.akhir == null);
    var rKosong = hitungRapor('s3', 'ganjil-2627');
    catat('Rapor santri tanpa Imda/Praktek tetap terhitung dari yang ada', rKosong.harian === 70 && rKosong.imda == null && rKosong.akhir === 28, 'Harian ' + rKosong.harian + ', Akhir ' + rKosong.akhir);
    var sebelum = hitungRapor('s1');
    var tambah = simpanNilai('s1', 'Harian', 'Iqra', 100, todayStr(), 'Self-test');
    var sesudah = hitungRapor('s1');
    catat('Rapor berubah setelah tambah nilai Harian 100', tambah.ok === true && sesudah.harian !== sebelum.harian, 'Harian ' + sebelum.harian + ' menjadi ' + sesudah.harian);
    db.nilai = db.nilai.filter(function (n) { return !(n.santriId === 's1' && n.nilai === 100 && n.catatan === 'Self-test'); });
    save('Self-test: bersihkan nilai uji');
    /* Validasi */
    catat('NIS unik: simpan santri dengan NIS duplikat ditolak', simpanSantri('', { nama: 'Duplikat', nis: '202401' }).ok === false);
    catat('Validasi: nama kosong ditolak', simpanSantri('', { nama: '', nis: '202499' }).ok === false);
    catat('Validasi: NIS kosong ditolak', simpanSantri('', { nama: 'Tanpa NIS', nis: '' }).ok === false);
    catat('Validasi nilai: 150 ditolak', simpanNilai('s1', 'Harian', 'Iqra', 150).ok === false);
    catat('Validasi nilai: -1 ditolak', simpanNilai('s1', 'Harian', 'Iqra', -1).ok === false);
    catat('Validasi nilai: 100 diterima', (function () { var h = simpanNilai('s1', 'Harian', 'Iqra', 100); if (h.ok) { db.nilai = db.nilai.filter(function (n) { return n.id !== h.nilai.id; }); save('Self-test: bersihkan nilai uji'); return true; } return false; })());
    catat('Validasi tabungan: setor Rp0 ditolak', catatTabungan('s1', 'Setor', 0).ok === false);
    catat('Validasi tabungan: tarik di atas saldo ditolak', catatTabungan('s1', 'Tarik', 999999999).ok === false, 'saldo s1 ' + rupiah(santriById('s1').tabungan));
    var tarikBesar = catatTabungan('s2', 'Tarik', 250000);
    catat('Tarik di atas Rp200.000 tanpa konfirmasi minta konfirmasi dulu', tarikBesar.ok === false && tarikBesar.needsConfirm === true);
    var tarikOk = catatTabungan('s2', 'Tarik', 250000, 'Self-test', { confirmed: true });
    catat('Tarik di atas Rp200.000 dengan konfirmasi berhasil, saldo berkurang', tarikOk.ok === true && santriById('s2').tabungan === 350000, 'saldo s2 ' + rupiah(santriById('s2').tabungan));
    bersih();
    /* Muat / simpan */
    save('Self-test: simpan');
    var dariDisk = load();
    catat('Nilai bertahan di penyimpanan setelah simpan', dariDisk.santri.length === 40 && dariDisk.nilai.length === db.nilai.length, dariDisk.santri.length + ' santri');
    /* CSV */
    ui.santriStatus = 'Semua';
    var exp = exportSantriCSV();
    var barisExp = parseCSV(exp.csv);
    catat('CSV round-trip: export lalu parse kembali berisi 40 murid', barisExp.length === 41 && barisExp[0][0] === 'nama' && barisExp.some(function (x) { return x[1] === '202401'; }), barisExp.length + ' baris');
    catat('CSV round-trip: nama berkoma tetap satu kolom', (function () { var t2 = toCSV([['nama', 'nis'], ['Uji, Koma', '202499']]); var p2 = parseCSV(t2); return p2.length === 2 && p2[1][0] === 'Uji, Koma'; })());
    var lap = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,wali,hp wali,alamat\nBudi Uji,202499,Iqra 1,2024,A,Bpk. Uji,081200000099,Jl. Uji 1\nSiti Uji,202498,Iqra 2,2024,B,Ibu Uji,081200000098,Jl. Uji 2'));
    catat('Import CSV 2 murid baru berhasil', lap.berhasil === 2 && lap.gagal.length === 0, lap.berhasil + ' berhasil, ' + lap.gagal.length + ' gagal');
    var lap2 = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,wali,hp wali,alamat\nDuplikat,202499,Iqra 1,2024,A,Bpk. D,081200000001,Jl. D 1'));
    catat('Import NIS duplikat ditolak dengan alasan', lap2.berhasil === 0 && lap2.gagal.length === 1 && lap2.gagal[0].alasan.indexOf('sudah ada') !== -1, lap2.gagal.length ? lap2.gagal[0].alasan : 'tidak ada alasan');
    var lapCampur = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,jenjang,wali,hp wali,alamat\nBudi Baru,202497,Iqra 1,2024,A,TPQ,Bpk. Baru,081200000097,Jl. Baru 1\nSiti Baru,202496,Kelas 1,2024,B,Ibtidaiyah,Ibu Baru,081200000096,Jl. Baru 2\n,202495,Iqra 1,2024,A,TPQ,Bpk. Rusak,081200000095,Jl. Rusak 1'));
    catat('Import template 2 murid baru + 1 baris rusak: 2 berhasil, 1 gagal (nama kosong)', lapCampur.berhasil === 2 && lapCampur.gagal.length === 1 && lapCampur.gagal[0].alasan === 'Nama kosong.', lapCampur.berhasil + ' berhasil, ' + lapCampur.gagal.length + ' gagal');
    catat('Baris gagal tidak merusak data: murid rusak (NIS 202495) tidak masuk', !db.santri.some(function (s) { return s.nis === '202495'; }));
    catat('Murid baru Ibtidaiyah ikut jenjang dari kolom jenjang', (function () { var s = db.santri.find(function (x) { return x.nis === '202496'; }); return s && s.jenjang === 'Ibtidaiyah' && s.kelas === 'Kelas 1'; })());
    var lapJenjangSalah = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,jenjang,wali,hp wali,alamat\nSalah Jenjang,202494,Iqra 1,2024,A,SD,Bpk. S,081200000094,Jl. S 1'));
    catat('Import jenjang tidak dikenal (SD) ditolak', lapJenjangSalah.berhasil === 0 && lapJenjangSalah.gagal.length === 1, lapJenjangSalah.gagal[0] ? lapJenjangSalah.gagal[0].alasan : '-');
    var lapKelasBaru = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,jenjang,wali,hp wali,alamat\nKelas Baru,202493,Iqra 2,2024,A,TPQ,Bpk. K,081200000093,Jl. K 1'));
    catat('Import kelas yang belum terdaftar (Iqra 2, seperti data contoh) tetap diterima', lapKelasBaru.berhasil === 1 && lapKelasBaru.gagal.length === 0, lapKelasBaru.berhasil + ' berhasil, ' + lapKelasBaru.gagal.length + ' gagal');
    var expRapor = exportRaporCSV('s1', 'ganjil-2627');
    catat('Export rapor CSV memuat nilai akhir 86.4', expRapor.csv.indexOf('86.4') !== -1);
    var lapNilaiCampur = importRows('nilai', parseCSV('santri (nama atau NIS),jenis,mapel,nilai\nAhmad Fauzi,Harian,Iqra,88\nAhmad Fauzi,Harian,Iqra,150'));
    catat('Import nilai: 1 berhasil, 1 gagal (nilai 150 di luar 0-100)', lapNilaiCampur.berhasil === 1 && lapNilaiCampur.gagal.length === 1, lapNilaiCampur.berhasil + ' berhasil, ' + lapNilaiCampur.gagal.length + ' gagal');
    var tpl = downloadTemplate('murid');
    catat('Template CSV murid berisi judul kolom nama,nis', tpl.csv.indexOf('nama,nis') === 0);
    /* Backup / restore */
    var cadangan = backupJSON();
    var pulih = JSON.parse(cadangan.json);
    catat('Backup JSON berisi 45 murid (40 contoh + 5 hasil import)', pulih.data.santri.length === 45, pulih.data.santri.length + ' murid');
    db.santri = db.santri.filter(function (s) { return ['202499', '202498', '202497', '202496', '202493'].indexOf(s.nis) === -1; });
    db.nilai = db.nilai.filter(function (n) { return !(n.santriId === 's1' && n.nilai === 88 && n.catatan === 'Import CSV'); });
    var okRestore = applyBackupData(pulih.data);
    catat('Pulihkan dari cadangan mengembalikan data', okRestore && db.santri.length === 45, db.santri.length + ' murid');
    var cadanganSebagian = JSON.parse(JSON.stringify(seedData()));
    delete cadanganSebagian.rapbm; delete cadanganSebagian.biaya; delete cadanganSebagian.target;
    var okSebagian = applyBackupData(cadanganSebagian);
    /* T-06: kunci yang TIDAK ADA di berkas dipertahankan dari lokal
       (rapbm 8, biaya 4, target 2 tetap), bukan diisi kosong. Kunci yang
       ada di berkas tetap dipakai dari berkas (santri 40 dari seed). */
    catat('Pulihkan cadangan sebagian (tanpa rapbm/biaya/target): kunci yang hilang dipertahankan dari lokal', okSebagian && Array.isArray(db.rapbm) && db.rapbm.length === 8 && Array.isArray(db.biaya) && db.biaya.length === 4 && Array.isArray(db.target) && db.target.length === 2 && db.santri.length === 40, 'rapbm=' + (db.rapbm ? db.rapbm.length : 'hilang') + ', biaya=' + (db.biaya ? db.biaya.length : 'hilang') + ', target=' + (db.target ? db.target.length : 'hilang'));
    /* Jenis kelamin: import, simpan, export, template, backup. */
    var lapJk = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,jenjang,wali,hp wali,alamat,jenis kelamin\nUji L,202490,Iqra 1,2024,A,TPQ,Bpk. L,081200000090,Jl. L 1,L\nUji P,202489,Iqra 1,2024,A,TPQ,Bpk. P,081200000089,Jl. P 1,P\nUji Laki,202488,Iqra 1,2024,A,TPQ,Bpk. Laki,081200000088,Jl. Laki 1,Laki-laki\nUji Perempuan,202487,Iqra 1,2024,A,TPQ,Bpk. Perempuan,081200000087,Jl. Perempuan 1,Perempuan\nUji Trim,202486,Iqra 1,2024,A,TPQ,Bpk. Trim,081200000086,Jl. Trim 1, laki-laki \nUji Kosong,202485,Iqra 1,2024,A,TPQ,Bpk. Kosong,081200000085,Jl. Kosong 1,\nUji X,202484,Iqra 1,2024,A,TPQ,Bpk. X,081200000084,Jl. X 1,X'));
    catat('Import jk: 6 berhasil, 1 gagal (nilai X)', lapJk.berhasil === 6 && lapJk.gagal.length === 1, lapJk.berhasil + ' berhasil, ' + lapJk.gagal.length + ' gagal');
    catat('Import jk: baris X ditolak dengan alasan jenis kelamin', lapJk.gagal.length === 1 && lapJk.gagal[0].alasan.indexOf('Jenis kelamin') !== -1, lapJk.gagal.length ? lapJk.gagal[0].alasan : '-');
    var jkTersimpan = function (nis) { var s = db.santri.find(function (x) { return x.nis === nis; }); return s ? s.jk : null; };
    catat('Import jk: L, P, "Laki-laki", "Perempuan", " laki-laki " tersimpan sebagai L/P', jkTersimpan('202490') === 'L' && jkTersimpan('202489') === 'P' && jkTersimpan('202488') === 'L' && jkTersimpan('202487') === 'P' && jkTersimpan('202486') === 'L', '202490=' + jkTersimpan('202490') + ', 202489=' + jkTersimpan('202489') + ', 202488=' + jkTersimpan('202488') + ', 202487=' + jkTersimpan('202487') + ', 202486=' + jkTersimpan('202486'));
    catat('Import jk: kolom kosong diterima sebagai jk kosong', jkTersimpan('202485') === '');
    catat('Import jk: baris ditolak (X) tidak masuk db', jkTersimpan('202484') === null);
    var smpP = simpanSantri('', { nama: 'Simpan Perempuan', nis: '202483', jk: 'Perempuan' });
    catat('simpanSantri: "Perempuan" dinormalisasi ke P', smpP.ok === true && smpP.santri.jk === 'P');
    var smpL = simpanSantri('', { nama: 'Simpan L', nis: '202482', jk: 'l' });
    catat('simpanSantri: "l" (huruf kecil) dinormalisasi ke L', smpL.ok === true && smpL.santri.jk === 'L');
    var smpX = simpanSantri('', { nama: 'Simpan X', nis: '202481', jk: 'X' });
    catat('simpanSantri: jk "X" ditolak dengan pesan jelas', smpX.ok === false && smpX.error === 'jk-tidak-valid' && smpX.message.indexOf('Jenis kelamin') !== -1, smpX.ok ? 'lolos' : smpX.message);
    var smpK = simpanSantri('', { nama: 'Simpan Kosong', nis: '202480' });
    catat('simpanSantri: tanpa jk tersimpan sebagai kosong', smpK.ok === true && smpK.santri.jk === '');
    /* Wira (QA ronde jk): import CSV berisi <script> di kolom Jenis Kelamin
       harus ditolak sebaris, bukan lolos ke db. */
    var lapJkRacun = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,jenjang,wali,hp wali,alamat,jenis kelamin\nUji Script,202479,Iqra 1,2024,A,TPQ,Bpk. S,081200000079,Jl. S 1,<script>alert(1)</script>'));
    catat('Import jk: "<script>" di kolom Jenis Kelamin ditolak, santri tidak masuk db', lapJkRacun.berhasil === 0 && lapJkRacun.gagal.length === 1 && !db.santri.some(function (s) { return s.nis === '202479'; }), lapJkRacun.berhasil + ' berhasil, ' + lapJkRacun.gagal.length + ' gagal');
    ui.santriStatus = 'Semua';
    var expJk = exportSantriCSV();
    var barisJk = parseCSV(expJk.csv);
    var idxJk = barisJk[0].indexOf('Jenis Kelamin');
    catat('Export CSV santri mengandung kolom "Jenis Kelamin"', idxJk !== -1, 'kolom ke-' + (idxJk + 1) + ' dari ' + barisJk[0].length);
    var selJk = function (nis) { var r = barisJk.find(function (x) { return x[1] === nis; }); return r ? r[idxJk] : null; };
    catat('Export CSV santri: s1 Laki-laki, s2 Perempuan, jk kosong tetap kosong', selJk('202401') === 'Laki-laki' && selJk('202402') === 'Perempuan' && selJk('202485') === '', '202401=' + selJk('202401') + ', 202402=' + selJk('202402') + ', 202485="' + selJk('202485') + '"');
    var tplJk = downloadTemplate('murid');
    catat('Template CSV murid mengandung kolom "Jenis Kelamin"', tplJk.csv.indexOf('Jenis Kelamin') !== -1);
    var bkJk = backupJSON();
    var bkJkData = JSON.parse(bkJk.json).data;
    catat('Backup JSON menyimpan jk santri (s1=L)', bkJkData.santri.some(function (s) { return s.id === 's1' && s.jk === 'L'; }));
    santriById('s1').jk = '';
    var okBkJk = applyBackupData(bkJkData);
    catat('Restore backup memulihkan jk santri (s1 kembali L)', okBkJk === true && santriById('s1').jk === 'L');
    bersih();
    /* Keamanan: foto dan tanggal dari luar */
    var FOTO_RACUN = '"><img src=x onerror="window.__xssFoto=1">';
    var FOTO_VALID = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    catat('Foto valid (data:image/jpeg) dikenali sebagai aman', fotoAman(FOTO_VALID) === true);
    catat('Foto beracun ditolak fotoAman()', fotoAman(FOTO_RACUN) === false);
    var cadanganRacun = JSON.parse(JSON.stringify(seedData()));
    cadanganRacun.santri[0].foto = FOTO_RACUN;
    cadanganRacun.guru[0].foto = FOTO_RACUN;
    cadanganRacun.santri[1].foto = FOTO_VALID;
    cadanganRacun.santri[0].statusTanggal = '"><img src=x onerror=1>';
    cadanganRacun.keuanganTx[0].tanggal = '2026-13-45';
    /* Wira: jk racun di berkas cadangan (script + nilai tak dikenal). */
    cadanganRacun.santri[0].jk = '<script>alert(1)</script>';
    cadanganRacun.santri[2].jk = 'X';
    cadanganRacun.santri[3].jk = 'Laki-laki';
    var okRacun = applyBackupData(cadanganRacun);
    catat('Pulihkan cadangan: foto beracun dikosongkan, foto valid dipertahankan', okRacun && !db.santri[0].foto && !db.guru[0].foto && db.santri[1].foto === FOTO_VALID);
    catat('Pulihkan cadangan: tanggal beracun/tidak valid dikosongkan', !db.santri[0].statusTanggal && !db.keuanganTx[0].tanggal, 'statusTanggal=' + db.santri[0].statusTanggal + ', tgl keuangan=' + db.keuanganTx[0].tanggal);
    catat('Pulihkan cadangan: jk racun dinormalisasi ("<script>"/"X" -> kosong, "Laki-laki" -> L)', db.santri[0].jk === '' && db.santri[2].jk === '' && db.santri[3].jk === 'L', 'jk0="' + db.santri[0].jk + '", jk2="' + db.santri[2].jk + '", jk3="' + db.santri[3].jk + '"');
    bersih();
    var dataTarikRacun = JSON.parse(JSON.stringify(seedData()));
    dataTarikRacun.santri[0].foto = FOTO_RACUN;
    dataTarikRacun.keuanganTx[0].tanggal = '2026-13-45';
    /* Wira: jk dari Sheet ('Laki-laki' -> L, tag img -> kosong). */
    dataTarikRacun.santri[0].jk = 'Laki-laki';
    dataTarikRacun.santri[1].jk = '<img src=x onerror=1>';
    applyPulledData(dataTarikRacun);
    catat('Tarik dari Sheet: foto beracun dan tanggal tidak valid dikosongkan', !db.santri[0].foto && !db.keuanganTx[0].tanggal);
    catat('Tarik dari Sheet: jk dinormalisasi ("Laki-laki" -> L, tag img -> kosong)', db.santri[0].jk === 'L' && db.santri[1].jk === '', 'jk0="' + db.santri[0].jk + '", jk1="' + db.santri[1].jk + '"');
    bersih();
    catat('Tanggal valid tetap tampil (2026-11-14 menjadi 14 Nov 2026)', fmtTanggal('2026-11-14') === '14 Nov 2026', fmtTanggal('2026-11-14'));
    catat('Tanggal beracun dikembalikan kosong, bukan mentah', fmtTanggal('"><img src=x onerror="window.__xssTgl=1">') === '');
    /* Helper murni */
    catat('rupiah(1500) menjadi Rp1.500', rupiah(1500) === 'Rp1.500', rupiah(1500));
    catat('esc() mengamankan < dan >', esc('<a>') === '&lt;a&gt;', esc('<a>'));
    catat('naikJilid(Iqra 1) menjadi Iqra 2', naikJilid('Iqra 1') === 'Iqra 2');
    catat('naikJilid di jilid tertinggi tetap', naikJilid('Tahfidz Juz 28') === 'Tahfidz Juz 28');
    catat('hitungKehadiranDariPertemuan s1 = 100 (1 pertemuan, hadir)', hitungKehadiranDariPertemuan('s1') === 100);
    catat('realisasiPos SPP = Rp1.900.000 (T-24: 38 santri aktif x Rp50.000)', realisasiPos('SPP', 'Semua') === 1900000, rupiah(realisasiPos('SPP', 'Semua')));
    catat('Pencarian murid "ahmad" menemukan Ahmad Fauzi dan Ahmad Hidayat', filterSantriList('ahmad').length === 2, filterSantriList('ahmad').length + ' hasil');
    catat('extractSheetId membaca ID dari link Sheet', extractSheetId('https://docs.google.com/spreadsheets/d/ABC123/edit') === 'ABC123');
    catat('uid() selalu unik', uid('x') !== uid('x'));
    var pk = santriPickerItems(true);
    catat('Picker murid aktif: 38 item terurut nama, chip kelas tersedia', pk.items.length === 38 && pk.items[0].nama === 'Ahmad Fauzi' && pk.chips.length > 0, pk.items.length + ' item');
    /* Aturan konflik */
    catat('Aturan konflik: server lebih baru tanpa antrean = pakai Sheet', decidePull('2026-11-15T00:00:00.000Z', '2026-11-14T00:00:00.000Z', 0) === 'apply');
    catat('Aturan konflik: ada antrean lokal = beri peringatan', decidePull('2026-11-15T00:00:00.000Z', '2026-11-14T00:00:00.000Z', 3) === 'warn');
    catat('Aturan konflik: lokal lebih baru = lewati', decidePull('2026-11-13T00:00:00.000Z', '2026-11-14T00:00:00.000Z', 0) === 'skip');
    catat('Aturan konflik: tanpa waktu server + ada antrean = peringatan', decidePull('', '2026-11-14T00:00:00.000Z', 2) === 'warn');
    catat('Aturan konflik: tanpa waktu server + tanpa antrean = peringatan (T-05: tidak langsung timpa)', decidePull('', '2026-11-14T00:00:00.000Z', 0) === 'warn');
    catat('Aturan konflik: tanpa waktu server + tanpa waktu lokal = pakai data', decidePull('', '', 0) === 'no-server-time');
    /* URL Apps Script */
    catat('URL Apps Script valid diterima', cekUrlAppsScript('https://script.google.com/macros/s/ABC/exec').ok === true);
    catat('URL Apps Script http ditolak', cekUrlAppsScript('http://script.google.com/macros/s/ABC/exec').ok === false);
    catat('URL Apps Script host lain ditolak', cekUrlAppsScript('https://example.com/exec').ok === false);
    catat('URL Apps Script malformed ditolak tanpa throw', (function () { try { return cekUrlAppsScript('ht!tp://:::buruk').ok === false; } catch (e) { return false; } })());
    /* Autentikasi lokal */
    catat('SHA-256: vektor kosong e3b0c442...', sha256Hex('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', sha256Hex(''));
    catat('SHA-256: vektor abc ba7816bf...', sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', sha256Hex('abc'));
    catat('SHA-256: vektor 56 karakter (NIST) 248d6a61...', sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq') === '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    catat('hashSandi deterministis dan salt berbeda menghasilkan hash berbeda', hashSandi('salt-a', 'rahasia') === hashSandi('salt-a', 'rahasia') && hashSandi('salt-a', 'rahasia') !== hashSandi('salt-b', 'rahasia'));
    catat('hashSandi memakai 1000 ronde (berbeda dari satu ronde SHA-256)', hashSandi('salt-a', 'rahasia') !== sha256Hex('salt-a:rahasia') && hashSandi('salt-a', 'rahasia').length === 64);
    catat('dbUntukSinkron() menyalin db tanpa kunci pengguna, db asli tetap utuh', (function () { var d = dbUntukSinkron(); return !('pengguna' in d) && Array.isArray(d.santri) && d.santri.length === db.santri.length && Array.isArray(db.pengguna) && db.pengguna.length > 0; })());
    catat('Seed berisi 2 pengguna (admin Pimpinan, guru1 Guru) dengan wajibGantiSandi', db.pengguna.length === 2 && cariPengguna('admin').peran === 'Pimpinan' && cariPengguna('guru1').peran === 'Guru' && cariPengguna('admin').wajibGantiSandi === true, db.pengguna.length + ' pengguna');
    catat('daftarPengguna() memuat 2 seed terurut id, tanpa salt/hash', (function () { var d = daftarPengguna(); return d.length === 2 && d[0].id === 'admin' && d[1].id === 'guru1' && d[0].wajibGantiSandi === true && !d[0].hash && !d[0].salt; })());
    catat('Seed pengguna tersimpan sebagai hash: kata sandi awal tidak ada di db.pengguna', JSON.stringify(db.pengguna).indexOf('admin123') === -1 && JSON.stringify(db.pengguna).indexOf('guru123') === -1 && cariPengguna('admin').hash.length === 64);
    catat('Login admin dengan sandi benar berhasil', verifikasiLogin('admin', 'admin123').ok === true && verifikasiLogin('admin', 'admin123').pengguna.peran === 'Pimpinan');
    catat('Login guru1 dengan sandi benar berhasil', verifikasiLogin('guru1', 'guru123').ok === true && verifikasiLogin('guru1', 'guru123').pengguna.peran === 'Guru');
    catat('Login ID salah ditolak dengan alasan generik', (function () { var r = verifikasiLogin('tidak-ada', 'admin123'); return r.ok === false && r.alasan === 'ID atau kata sandi salah'; })());
    catat('Login sandi salah ditolak dengan alasan generik yang sama', (function () { var r = verifikasiLogin('admin', 'salah'); return r.ok === false && r.alasan === 'ID atau kata sandi salah'; })());
    catat('Alasan ID salah dan sandi salah identik (tidak membocorkan mana yang salah)', verifikasiLogin('tidak-ada', 'x').alasan === verifikasiLogin('admin', 'x').alasan);
    catat('Login tanpa sandi juga ditolak generik', verifikasiLogin('admin', '').alasan === 'ID atau kata sandi salah');
    catat('cariPengguna cocok case-insensitive setelah trim', cariPengguna('  ADMIN ') !== null && cariPengguna('Admin').id === 'admin' && cariPengguna('tidak-ada') === null);
    var masuk = masukPengguna('admin', 'admin123');
    catat('masukPengguna admin berhasil dan menandai wajibGantiSandi', masuk.ok === true && masuk.wajibGantiSandi === true && masuk.pengguna.id === 'admin');
    catat('sesiAktif() mengembalikan pengguna yang masuk', (function () { var s = sesiAktif(); return !!s && s.id === 'admin' && s.nama === 'Pimpinan' && s.peran === 'Pimpinan' && !s.hash && !s.salt; })());
    catat('sesiAktif() membawa wajibGantiSandi=true untuk admin seed', (function () { var s = sesiAktif(); return !!s && s.wajibGantiSandi === true; })());
    var sesiMentah = JSON.parse(lsGet(SESI_KEY));
    catat('Sesi tersimpan berisi kedaluwarsa 7 hari dari masuk', sesiMentah && sesiMentah.kedaluwarsa - sesiMentah.masukPada === 7 * 24 * 60 * 60 * 1000);
    sesiMentah.kedaluwarsa = Date.now() - 1000;
    lsSet(SESI_KEY, JSON.stringify(sesiMentah));
    catat('Sesi kedaluwarsa ditolak dan dihapus dari penyimpanan', sesiAktif() === null && lsGet(SESI_KEY) === null);
    masukPengguna('guru1', 'guru123');
    keluarPengguna();
    catat('keluarPengguna() menghapus sesi', sesiAktif() === null && lsGet(SESI_KEY) === null);
    var ruteDitolakGuru = ['tabungan', 'keuangan', 'rapbm', 'pengaturan', 'guru', 'kemuridan', 'khidmah', 'grafik', 'laporan'];
    catat('Guru ditolak untuk 9 rute (tabungan/keuangan/rapbm/pengaturan/guru/kemuridan/khidmah/grafik/laporan)', ruteDitolakGuru.every(function (r) { return bolehAkses('Guru', r) === false; }), ruteDitolakGuru.length + ' rute ditolak');
    catat('Guru diizinkan untuk 7 rute (dashboard/santri/kelas/hafalan/penilaian/pengumuman/kbm)', GURU_ROUTES.length === 7 && GURU_ROUTES.every(function (r) { return bolehAkses('Guru', r) === true; }));
    catat('Guru hanya punya 5 tab bawah', GURU_TABS.length === 5 && GURU_TABS.indexOf('tabungan') === -1 && GURU_TABS.indexOf('keuangan') === -1);
    catat('Pimpinan diizinkan semua 16 rute', MODULES.every(function (m) { return bolehAkses('Pimpinan', m.id) === true; }));
    catat('Peran tidak dikenal ditolak semua rute', bolehAkses('Tamu', 'dashboard') === false && bolehAkses('', 'dashboard') === false && bolehAkses(null, 'dashboard') === false);
    catat('Tambah pengguna duplikat (ADMIN, beda huruf besar) ditolak', tambahPengguna({ id: 'ADMIN', nama: 'Duplikat', peran: 'Guru', sandi: 'rahasia1', olehId: 'admin' }).ok === false);
    catat('Tambah pengguna sandi kurang dari 8 karakter ditolak', tambahPengguna({ id: 'baru1', nama: 'Baru', peran: 'Guru', sandi: '12345', olehId: 'admin' }).ok === false);
    catat('Tambah pengguna peran tidak valid ditolak', tambahPengguna({ id: 'baru1', nama: 'Baru', peran: 'Wali Kelas', sandi: 'rahasia1', olehId: 'admin' }).ok === false);
    catat('Tambah pengguna nama kosong ditolak', tambahPengguna({ id: 'baru1', nama: '  ', peran: 'Guru', sandi: 'rahasia1', olehId: 'admin' }).ok === false);
    catat('Tambah pengguna tanpa peminta Pimpinan ditolak', tambahPengguna({ id: 'baru1', nama: 'Baru', peran: 'Guru', sandi: 'rahasia1' }).ok === false && cariPengguna('baru1') === null);
    catat('Tambah pengguna oleh Guru (bukan Pimpinan) ditolak', tambahPengguna({ id: 'baru1', nama: 'Baru', peran: 'Guru', sandi: 'rahasia1', olehId: 'guru1' }).ok === false && cariPengguna('baru1') === null);
    var tambahBaru = tambahPengguna({ id: 'guru2', nama: 'Guru 2', peran: 'Guru', sandi: 'guru4567', olehId: 'admin' });
    catat('Tambah pengguna baru berhasil dan wajibGantiSandi true', tambahBaru.ok === true && cariPengguna('guru2').wajibGantiSandi === true && verifikasiLogin('guru2', 'guru4567').ok === true);
    catat('daftarPengguna() bertambah setelah tambahPengguna (2 jadi 3)', (function () { var d = daftarPengguna(); return d.length === 3 && d.some(function (u) { return u.id === 'guru2'; }); })());
    var reset = resetSandiPengguna('guru2', 'sandi-baru-9', 'admin');
    catat('Reset sandi lalu login sandi baru berhasil, sandi lama ditolak', reset.ok === true && cariPengguna('guru2').wajibGantiSandi === true && verifikasiLogin('guru2', 'sandi-baru-9').ok === true && verifikasiLogin('guru2', 'guru4567').ok === false);
    catat('Setelah reset sandi, sesiAktif() membawa wajibGantiSandi=true saat login berikutnya', (function () { var m = masukPengguna('guru2', 'sandi-baru-9'); if (!m.ok) return false; var s = sesiAktif(); keluarPengguna(); return !!s && s.id === 'guru2' && s.wajibGantiSandi === true; })());
    catat('Reset sandi pengguna tidak ada ditolak', resetSandiPengguna('tidak-ada', 'sandi-baru-9', 'admin').ok === false);
    catat('Reset sandi oleh Guru (bukan Pimpinan) ditolak, sandi lama tetap berlaku', resetSandiPengguna('guru2', 'coba-reset-1', 'guru1').ok === false && verifikasiLogin('guru2', 'sandi-baru-9').ok === true);
    catat('Reset sandi tanpa peminta ditolak, sandi lama tetap berlaku', resetSandiPengguna('guru2', 'coba-reset-1').ok === false && verifikasiLogin('guru2', 'sandi-baru-9').ok === true);
    catat('Hapus diri sendiri ditolak', (function () { var r = hapusPengguna('admin', 'admin'); return r.ok === false && r.error === 'hapus-diri-sendiri' && cariPengguna('admin') !== null; })());
    catat('Hapus pengguna oleh Guru (bukan Pimpinan) ditolak', hapusPengguna('guru2', 'guru1').ok === false && cariPengguna('guru2') !== null);
    catat('Hapus pengguna tanpa peminta ditolak', hapusPengguna('guru2', '').ok === false && cariPengguna('guru2') !== null);
    /* Penjaga Pimpinan terakhir kini praktis tidak terjangkau lewat API
       publik (peminta Pimpinan yang berbeda dari target berarti sudah ada
       minimal 2 Pimpinan) — yang dites: Guru yang mencoba menghapus admin
       ditolak sebagai bukan-Pimpinan, bukan karena aturan itu. */
    catat('Hapus admin oleh Guru ditolak sebagai bukan-Pimpinan', (function () { var r = hapusPengguna('admin', 'guru2'); return r.ok === false && r.error === 'bukan-pimpinan' && cariPengguna('admin') !== null; })());
    catat('Hapus pengguna biasa oleh orang lain berhasil', hapusPengguna('guru2', 'admin').ok === true && cariPengguna('guru2') === null);
    catat('Ganti sandi dengan sandi lama salah ditolak', gantiSandiSendiri('admin', 'salah', 'baru12345').ok === false);
    catat('Ganti sandi dengan sandi baru kurang dari 8 karakter ditolak', gantiSandiSendiri('admin', 'admin123', '123').ok === false);
    catat('Ganti sandi dengan sandi baru sama dengan sandi lama ditolak', gantiSandiSendiri('admin', 'admin123', 'admin123').ok === false && verifikasiLogin('admin', 'admin123').ok === true);
    var ganti = gantiSandiSendiri('admin', 'admin123', 'pimpinan-baru-1');
    catat('Ganti sandi sendiri berhasil, flag wajibGantiSandi bersih, login sandi baru berhasil', ganti.ok === true && cariPengguna('admin').wajibGantiSandi === false && verifikasiLogin('admin', 'pimpinan-baru-1').ok === true && verifikasiLogin('admin', 'admin123').ok === false);
    catat('Setelah ganti sandi berhasil, sesiAktif() membaca wajibGantiSandi=false langsung dari db.pengguna', (function () { var m = masukPengguna('admin', 'pimpinan-baru-1'); if (!m.ok) return false; var s = sesiAktif(); keluarPengguna(); return !!s && s.wajibGantiSandi === false; })());
    var cadanganAuth = backupJSON();
    catat('Backup JSON memuat pengguna (salt+hash) tanpa kata sandi plaintext', cadanganAuth.json.indexOf('"pengguna"') !== -1 && cadanganAuth.json.indexOf('admin123') === -1 && cadanganAuth.json.indexOf('guru123') === -1 && cadanganAuth.json.indexOf('pimpinan-baru-1') === -1);
    var cadanganTanpaPengguna = JSON.parse(JSON.stringify(seedData()));
    delete cadanganTanpaPengguna.pengguna;
    tambahPengguna({ id: 'tetap1', nama: 'Tetap', peran: 'Guru', sandi: 'tetap123', olehId: 'admin' });
    var okTanpaPengguna = applyBackupData(cadanganTanpaPengguna);
    catat('Pulihkan cadangan tanpa pengguna: pengguna aktif dipertahankan', okTanpaPengguna && cariPengguna('tetap1') !== null && cariPengguna('admin') !== null);
    /* K2: berkas berisi admin palsu (Pimpinan + hash sandi yang diketahui
       penyerang) TIDAK BOLEH menimpa pengguna lokal yang masih ada. */
    var cadanganDenganPengguna = JSON.parse(JSON.stringify(seedData()));
    var saltCad = '11111111111111111111111111111111';
    var saltPalsu = '22222222222222222222222222222222';
    cadanganDenganPengguna.pengguna = [
      { id: 'cad1', nama: 'Cadangan 1', peran: 'Guru', salt: saltCad, hash: hashSandi(saltCad, 'cadangan1'), wajibGantiSandi: false, dibuatPada: '2026-11-15' },
      { id: 'admin', nama: 'Pimpinan Palsu', peran: 'Pimpinan', salt: saltPalsu, hash: hashSandi(saltPalsu, 'penyerang1'), wajibGantiSandi: false, dibuatPada: '2026-11-15' }
    ];
    var okDenganPengguna = applyBackupData(cadanganDenganPengguna);
    catat('Pulihkan cadangan berisi admin palsu: pengguna lokal dipertahankan, admin palsu tidak masuk', okDenganPengguna && cariPengguna('tetap1') !== null && cariPengguna('cad1') === null && cariPengguna('admin') !== null && cariPengguna('admin').nama === 'Pimpinan' && verifikasiLogin('admin', 'penyerang1').ok === false && verifikasiLogin('admin', 'pimpinan-baru-1').ok === true);
    /* K2: hanya kalau daftar lokal kosong, pengguna dari berkas dipakai. */
    db.pengguna = [];
    var okLokalKosong = applyBackupData(cadanganDenganPengguna);
    catat('Pulihkan cadangan saat pengguna lokal kosong: pengguna berkas dipakai', okLokalKosong && cariPengguna('cad1') !== null && verifikasiLogin('cad1', 'cadangan1').ok === true && verifikasiLogin('admin', 'penyerang1').ok === true);
    bersih();
    /* R7: load() memvalidasi bentuk pengguna dari penyimpanan. */
    var mentahR7 = JSON.parse(JSON.stringify(seedData()));
    mentahR7.pengguna = [
      { id: 'baik1', nama: 'Baik', peran: 'Guru', salt: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', hash: hashSandi('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'baik1234'), wajibGantiSandi: false, dibuatPada: '2026-11-15' },
      { id: '', nama: 'Tanpa ID', peran: 'Guru', salt: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', hash: hashSandi('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'baik1234'), wajibGantiSandi: false, dibuatPada: '2026-11-15' },
      { id: 'jahat', nama: 'Jahat', peran: 'SuperAdmin', salt: 'cccccccccccccccccccccccccccccccc', hash: hashSandi('cccccccccccccccccccccccccccccccc', 'baik1234'), wajibGantiSandi: false, dibuatPada: '2026-11-15' }
    ];
    lsSet(LS_KEY, JSON.stringify(mentahR7));
    var muatR7 = load();
    catat('load() membuang entri pengguna tidak valid (tanpa id / peran tidak dikenal)', muatR7.pengguna.length === 1 && muatR7.pengguna[0].id === 'baik1', muatR7.pengguna.length + ' pengguna');
    var mentahR7Kosong = JSON.parse(JSON.stringify(seedData()));
    mentahR7Kosong.pengguna = [{ id: '', nama: 'Rusak', peran: 'Guru', salt: 'dddddddddddddddddddddddddddddddd', hash: hashSandi('dddddddddddddddddddddddddddddddd', 'baik1234'), wajibGantiSandi: false, dibuatPada: '2026-11-15' }];
    lsSet(LS_KEY, JSON.stringify(mentahR7Kosong));
    var muatR7Kosong = load();
    catat('load() dengan semua entri pengguna tidak valid memakai pengguna seed', muatR7Kosong.pengguna.length === 2 && muatR7Kosong.pengguna.some(function (p) { return p.id === 'admin'; }), muatR7Kosong.pengguna.length + ' pengguna');
    bersih();
    /* Reset / hapus */
    var kosong = clearAllData();
    catat('Hapus semua data mengosongkan santri dan guru', kosong.santri.length === 0 && kosong.guru.length === 0);
    catat('Hapus semua data mempertahankan pengguna saat ini (login admin tetap bisa)', kosong.pengguna.length === 2 && verifikasiLogin('admin', 'admin123').ok === true && verifikasiLogin('guru1', 'guru123').ok === true);
    var kembali = resetToSeed();
    catat('Reset ke data contoh mengembalikan 40 santri', kembali.santri.length === 40);

    /* ---- Regresi ronde perbaikan Baskara (audit 15 Nov 2026, T-01 dst.) ----
       Blok ini jalan di atas seed segar (bersih() dulu) dan diakhiri bersih()
       supaya tidak meninggalkan data uji untuk uji asinkron sesudahnya. */
    bersih();
    /* T-01: ganti sandi paksa tanpa sandi lama (sesi aktif = bukti identitas). */
    catat('T-01 gantiSandiPaksa tanpa sesi ditolak', gantiSandiPaksa('admin', 'paksa-baru-1').ok === false);
    var masukT01 = masukPengguna('admin', 'admin123');
    catat('T-01 login admin seed berhasil (wajibGantiSandi)', masukT01.ok === true && masukT01.wajibGantiSandi === true);
    catat('T-01 gantiSandiPaksa untuk id lain dari sesi ditolak', gantiSandiPaksa('guru1', 'paksa-baru-1').ok === false);
    var paksaT01 = gantiSandiPaksa('admin', 'paksa-baru-1');
    catat('T-01 gantiSandiPaksa berhasil tanpa sandi lama, flag bersih', paksaT01.ok === true && cariPengguna('admin').wajibGantiSandi === false && verifikasiLogin('admin', 'paksa-baru-1').ok === true && verifikasiLogin('admin', 'admin123').ok === false);
    catat('T-01 sesi tetap hidup setelah ganti sandi paksa', (function () { var s = sesiAktif(); return !!s && s.id === 'admin'; })());
    catat('T-01 gantiSandiPaksa kedua kali ditolak (sudah tidak wajib)', gantiSandiPaksa('admin', 'paksa-baru-2').ok === false);
    catat('T-01 gantiSandiSendiri normal tetap minta sandi lama benar', gantiSandiSendiri('admin', 'salah', 'paksa-baru-2').ok === false && verifikasiLogin('admin', 'paksa-baru-1').ok === true);
    /* R6: gantiSandiPaksa juga menolak sandi baru yang sama dengan lama
       (dulu tertutup gantiSandiSendiri; jangan sampai lolos diam-diam dan
       membersihkan flag wajibGantiSandi). */
    /* S5: reset memakai sandi kuat — admin123 kini masuk daftar sandi umum
       yang ditolak untuk sandi BARU (login seed tetap jalan, tapi tidak
       boleh dipakai lagi sebagai sandi baru). */
    resetSandiPengguna('admin', 'paksa-lama-1', 'admin');
    masukPengguna('admin', 'paksa-lama-1');
    var paksaSama = gantiSandiPaksa('admin', 'paksa-lama-1');
    catat('T-01 gantiSandiPaksa sandi baru sama dengan lama ditolak (sandi-sama)', paksaSama.ok === false && paksaSama.error === 'sandi-sama' && cariPengguna('admin').wajibGantiSandi === true);
    keluarPengguna();
    bersih();
    /* T-02: tambahKelas + import membuat kelas. */
    var tambahKelasOk = tambahKelas({ nama: 'Iqra 4', jenjang: 'TPQ', ustadz: 'Ustadzah Khadijah' });
    catat('T-02 tambahKelas berhasil', tambahKelasOk.ok === true && db.kelas.some(function (k) { return k.nama === 'Iqra 4'; }));
    catat('T-02 tambahKelas duplikat (beda huruf besar) ditolak', tambahKelas({ nama: 'iqra 4', jenjang: 'TPQ' }).ok === false);
    catat('T-02 tambahKelas nama kosong ditolak', tambahKelas({ nama: '  ', jenjang: 'TPQ' }).ok === false);
    var lapKelasBaru2 = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,jenjang,wali,hp wali,alamat\nAnak Iqra 5,202492,Iqra 5,2024,A,TPQ,Bpk. I,081200000092,Jl. I 1'));
    catat('T-02 import murid membuat entri kelas baru (Iqra 5)', lapKelasBaru2.berhasil === 1 && db.kelas.some(function (k) { return k.nama === 'Iqra 5' && k.jenjang === 'TPQ'; }), 'kelas=' + db.kelas.length);
    clearAllData();
    var lapSetelahHapus = importRows('murid', parseCSV('nama,nis,kelas,angkatan,rombel,jenjang,wali,hp wali,alamat\nAnak Baru,202491,Iqra 1,2024,A,TPQ,Bpk. B,081200000091,Jl. B 1'));
    catat('T-02 setelah Hapus semua data, import membuat kelas lagi (tidak mati permanen)', lapSetelahHapus.berhasil === 1 && db.kelas.length === 1 && db.kelas[0].nama === 'Iqra 1');
    /* MERGE v22: reset ke data contoh di sini memakai bersih(), BUKAN
       resetToSeed(). bersih() v22 memakai keadaan AWAL suite
       (isContohAwal=true) sehingga me-reseed walau clearAllData() +
       import di atas sudah membalik isContoh=false; resetToSeed() v22
       justru MENOLAK bila db berisi data asli (guard Y-N3) dan akan
       meninggalkan db berisi 1 santri impor (T-03 gagal). bersih()
       sudah memanggil setQueue([]) di dalamnya. */
    bersih();
    /* T-03: kelas Iqra 2 ada di seed; 5 santri aktifnya terhitung. */
    catat('T-03 seed punya kelas Iqra 2', db.kelas.some(function (k) { return k.nama === 'Iqra 2' && k.jenjang === 'TPQ'; }));
    catat('T-03 5 santri aktif Iqra 2', db.santri.filter(function (s) { return s.kelas === 'Iqra 2' && s.status === 'Aktif'; }).length === 5);
    catat('T-03 total murid per kelas = 38 santri aktif', db.kelas.reduce(function (a, k) { return a + db.santri.filter(function (s) { return s.kelas === k.nama && s.status === 'Aktif'; }).length; }, 0) === 38);
    /* T-05: decidePull tanpa waktu server + lokal punya waktu = warn. */
    catat('T-05 decidePull tanpa waktu server + lokal punya waktu = warn', decidePull('', '2026-11-14T00:00:00.000Z', 0) === 'warn');
    /* T-06: kunci ADA tapi kosong di berkas tetap dipakai dari berkas. */
    var cadanganKosong = JSON.parse(JSON.stringify(seedData()));
    cadanganKosong.rapbm = [];
    var okKosong = applyBackupData(cadanganKosong);
    catat('T-06 kunci ada tapi kosong di berkas dipakai (rapbm=0)', okKosong && db.rapbm.length === 0, 'rapbm=' + db.rapbm.length);
    bersih();
    /* T-07: pertemuan p1 hanya santri Iqra 3 aktif; hitung lintas kelas ditolak. */
    var p1kunci = Object.keys(db.pertemuan[0].absensi).sort().join(',');
    catat('T-07 seed p1 hanya berisi 5 santri Iqra 3 aktif', p1kunci === 's1,s11,s15,s19,s5', p1kunci);
    catat('T-07 hitungKehadiran s3 = null (tidak ada pertemuan di kelasnya sendiri)', hitungKehadiranDariPertemuan('s3') === null);
    catat('T-07 hitungKehadiran s4 = null (Iqra 2, tidak ada pertemuan)', hitungKehadiranDariPertemuan('s4') === null);
    catat('T-07 hitungKehadiran s1 tetap 100', hitungKehadiranDariPertemuan('s1') === 100);
    /* T-08: sesi batal saat pengguna dihapus / sandi direset; ganti sendiri tetap hidup. */
    tambahPengguna({ id: 'sesiuji', nama: 'Sesi Uji', peran: 'Guru', sandi: 'sesiuji1', olehId: 'admin' });
    var masukS8 = masukPengguna('sesiuji', 'sesiuji1');
    catat('T-08 login sesiuji berhasil', masukS8.ok === true && sesiAktif() !== null && sesiAktif().id === 'sesiuji');
    hapusPengguna('sesiuji', 'admin');
    catat('T-08 sesi batal setelah pengguna dihapus', sesiAktif() === null);
    tambahPengguna({ id: 'sesiuji', nama: 'Sesi Uji', peran: 'Guru', sandi: 'sesiuji1', olehId: 'admin' });
    masukPengguna('sesiuji', 'sesiuji1');
    resetSandiPengguna('sesiuji', 'sesiuji2', 'admin');
    catat('T-08 sesi batal setelah sandi direset Pimpinan', sesiAktif() === null);
    masukPengguna('sesiuji', 'sesiuji2');
    var gantiS8 = gantiSandiSendiri('sesiuji', 'sesiuji2', 'sesiuji3');
    catat('T-08 ganti sandi sendiri: sesi tetap hidup', gantiS8.ok === true && sesiAktif() !== null && sesiAktif().id === 'sesiuji' && sesiAktif().wajibGantiSandi === false);
    keluarPengguna();
    hapusPengguna('sesiuji', 'admin');
    bersih();
    /* T-10: export mengikuti filter. */
    ui.keuanganTab = 'Keluar';
    catat('T-10 exportKeuanganCSV tab Keluar = 4 baris', exportKeuanganCSV().count === 4, exportKeuanganCSV().count + ' baris');
    ui.keuanganTab = 'Masuk';
    catat('T-10 exportKeuanganCSV tab Masuk = 4 baris', exportKeuanganCSV().count === 4);
    ui.keuanganTab = 'Semua';
    catat('T-10 exportKeuanganCSV tab Semua = 8 baris', exportKeuanganCSV().count === 8);
    ui.kelasId = 'k1';
    catat('T-10 exportAbsensiCSV kelas k1 = 0 baris (p1 milik k2)', exportAbsensiCSV().count === 0);
    ui.kelasId = 'k2';
    catat('T-10 exportAbsensiCSV kelas k2 = 5 baris (p1, 5 santri)', exportAbsensiCSV().count === 5, exportAbsensiCSV().count + ' baris');
    ui.kelasTanggal = '2026-11-15';
    catat('T-10 exportAbsensiCSV tanggal lain = 0 baris', exportAbsensiCSV().count === 0);
    ui.kelasTanggal = '';
    ui.kelasId = 'k2';
    /* T-11: hapus santri membersihkan absensi; export lewati yatim. */
    hapusSantri('s1');
    catat('T-11 hapusSantri menghapus entri absensi s1 di p1', db.pertemuan[0].absensi['s1'] === undefined);
    db.pertemuan[0].absensi['tidak-ada'] = 'Hadir';
    catat('T-11 exportAbsensiCSV melewati entri yatim (tanpa ID mentah)', exportAbsensiCSV().csv.indexOf('tidak-ada') === -1 && exportAbsensiCSV().count === 4);
    bersih();
    /* T-13: antrean cap 500 + peringatan. */
    lsRemove(QUEUE_TRIMMED_KEY);
    setQueue([]);
    for (var qi = 0; qi < 505; qi++) enqueueChange('uji-' + qi);
    catat('T-13 antrean dibatasi 500 (bukan 100)', getQueue().length === 500, getQueue().length + ' antrean');
    catat('T-13 antrean pernah dipotong tercatat', antreanPernahDipotong() === true);
    catat('T-13 status sinkron memberi peringatan pemotongan', syncState().text.indexOf('dipotong') !== -1, syncState().text);
    setQueue([]);
    lsRemove(QUEUE_TRIMMED_KEY);
    /* T-15: import nilai kembar / guru duplikat / peran asing. */
    var lapGuruDuplikat = importRows('guru', parseCSV('nama,kelas,peran,jenjang,hp,honor\nUstadz Ahmad,Iqra 1,Guru,TPQ,081200000101,800000'));
    catat('T-15 import guru nama duplikat ditolak', lapGuruDuplikat.berhasil === 0 && lapGuruDuplikat.gagal.length === 1 && lapGuruDuplikat.gagal[0].alasan.indexOf('sudah ada') !== -1, lapGuruDuplikat.gagal[0] ? lapGuruDuplikat.gagal[0].alasan : '-');
    var lapGuruPeran = importRows('guru', parseCSV('nama,kelas,peran,jenjang,hp,honor\nUstadz Baru,Iqra 1,Kepala Sekolah,TPQ,081200000111,800000'));
    catat('T-15 import guru peran asing ditolak dengan alasan', lapGuruPeran.berhasil === 0 && lapGuruPeran.gagal.length === 1 && lapGuruPeran.gagal[0].alasan.indexOf('Peran harus') !== -1, lapGuruPeran.gagal[0] ? lapGuruPeran.gagal[0].alasan : '-');
    var kembar = simpanSantri('', { nama: 'Ahmad Fauzi', nis: '202499', jenjang: 'TPQ', kelas: 'Iqra 3', jilid: 'Iqra 3' });
    catat('T-15 santri kembar nama bisa ditambah (NIS beda)', kembar.ok === true);
    var lapNilaiKembar = importRows('nilai', parseCSV('santri (nama atau nis),jenis,mapel,nilai\nAhmad Fauzi,Harian,Iqra,77'));
    catat('T-15 import nilai nama kembar ditolak "Nama kembar, pakai NIS"', lapNilaiKembar.berhasil === 0 && lapNilaiKembar.gagal.length === 1 && lapNilaiKembar.gagal[0].alasan === 'Nama kembar, pakai NIS.', lapNilaiKembar.gagal[0] ? lapNilaiKembar.gagal[0].alasan : '-');
    var lapNilaiNis = importRows('nilai', parseCSV('santri (nama atau nis),jenis,mapel,nilai\n202499,Harian,Iqra,77'));
    catat('T-15 import nilai pakai NIS menempel ke santri yang benar', lapNilaiNis.berhasil === 1 && db.nilai.some(function (n) { return n.santriId === kembar.santri.id && n.nilai === 77; }));
    bersih();
    /* T-16: validasi jadwal + alokasi. */
    catat('T-16 simpanJadwal jam selesai <= jam mulai ditolak', simpanJadwal('', { kelas: 'Iqra 1', hari: 'Senin', jamMulai: '15:30', jamSelesai: '14:00', mapel: 'Iqra', guru: 'Ustadz Ahmad' }).ok === false);
    catat('T-16 simpanJadwal bentrok kelas+hari sama ditolak', simpanJadwal('', { kelas: 'Iqra 1', hari: 'Senin', jamMulai: '16:00', jamSelesai: '17:00', mapel: 'Iqra', guru: 'Ustadz Ahmad' }).ok === false);
    var jadwalOk = simpanJadwal('', { kelas: 'Iqra 1', hari: 'Selasa', jamMulai: '15:30', jamSelesai: '16:30', mapel: 'Iqra', guru: 'Ustadz Ahmad' });
    catat('T-16 simpanJadwal hari lain diterima', jadwalOk.ok === true);
    if (jadwalOk.ok) hapusJadwal(jadwalOk.jadwal.id);
    var alokasiOk = simpanAlokasi('', { kelas: 'Iqra 1', mapel: 'Iqra', jamPerMinggu: '4.5', hari: 'Senin' });
    catat('T-16 simpanAlokasi 4.5 jam tidak dibulatkan', alokasiOk.ok === true && alokasiOk.alokasi.jamPerMinggu === 4.5, alokasiOk.ok ? String(alokasiOk.alokasi.jamPerMinggu) : 'gagal');
    if (alokasiOk.ok) hapusAlokasi(alokasiOk.alokasi.id);
    catat('T-16 simpanAlokasi jam 0 ditolak', simpanAlokasi('', { kelas: 'Iqra 1', mapel: 'Iqra', jamPerMinggu: '0', hari: 'Senin' }).ok === false);
    bersih();
    /* T-17: kembali Aktif membersihkan jejak status lama. */
    var aktifLagi = ubahStatusSantri('s8', 'Aktif');
    catat('T-17 kembali Aktif menghapus statusAlasan/statusTanggal', aktifLagi.ok === true && santriById('s8').statusAlasan === undefined && santriById('s8').statusTanggal === undefined);
    bersih();
    /* T-18: hapus guru membersihkan jadwal + kelas.ustadz. */
    var hapusG3 = hapusGuru('g3');
    catat('T-18 hapusGuru membersihkan 2 jadwal + 1 kelas', hapusG3.ok === true && hapusG3.jadwalDibersihkan === 2 && hapusG3.kelasDibersihkan === 1, 'jadwal=' + hapusG3.jadwalDibersihkan + ', kelas=' + hapusG3.kelasDibersihkan);
    catat('T-18 jadwal KBM ex-Ustadz Budi kosong gurunya', db.jadwalKbm.filter(function (j) { return j.guru === 'Ustadz Budi'; }).length === 0);
    catat('T-18 kelas Tahfidz 1 kosong ustadznya', (db.kelas.find(function (k) { return k.nama === 'Tahfidz 1'; }) || {}).ustadz === '');
    bersih();
    /* T-19: riwayat absensi guru tanpa batas default. */
    catat('T-19 riwayatAbsensiGuru tanpa batas = semua (3 Guru)', riwayatAbsensiGuru('Guru').length === 3);
    catat('T-19 riwayatAbsensiGuru batas 2 = 2 baris', riwayatAbsensiGuru('Guru', 2).length === 2);
    /* T-20: simpanPertemuan upsert tanggal+kelas sama. */
    var temu1 = simpanPertemuan('k2', '2026-11-15', 'Materi uji 1', { s1: 'Hadir' });
    catat('T-20 pertemuan pertama tersimpan', temu1.ok === true && !temu1.diperbarui);
    var temu2 = simpanPertemuan('k2', '2026-11-15', 'Materi uji 2', { s1: 'Izin' });
    var temuK2Tgl = db.pertemuan.filter(function (p) { return p.kelasId === 'k2' && p.tanggal === '2026-11-15'; });
    catat('T-20 pertemuan tanggal+kelas sama ditimpa (upsert), bukan duplikat', temu2.ok === true && temu2.diperbarui === true && temuK2Tgl.length === 1 && temuK2Tgl[0].materi === 'Materi uji 2', temuK2Tgl.length + ' pertemuan');
    catat('T-20 kehadiran s1 dihitung ulang dari riwayat (1 Hadir + 1 Izin = 50)', santriById('s1').kehadiran === 50, 'kehadiran=' + santriById('s1').kehadiran);
    bersih();
    /* T-21: edit tanpa foto tidak menghapus foto lama. */
    var FOTO_UJI = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    santriById('s1').foto = FOTO_UJI;
    save('Self-test: pasang foto uji s1');
    var editTanpaFoto = simpanSantri('s1', { nama: 'Ahmad Fauzi', nis: '202401', jenjang: 'TPQ', kelas: 'Iqra 3', jilid: 'Iqra 3' });
    catat('T-21 edit santri tanpa foto mempertahankan foto lama', editTanpaFoto.ok === true && santriById('s1').foto === FOTO_UJI);
    var editFotoBaru = simpanSantri('s1', { nama: 'Ahmad Fauzi', nis: '202401', jenjang: 'TPQ', kelas: 'Iqra 3', jilid: 'Iqra 3', foto: 'data:image/png;base64,iVBORw0KGgo=' });
    catat('T-21 edit santri dengan foto baru mengganti foto', editFotoBaru.ok === true && santriById('s1').foto === 'data:image/png;base64,iVBORw0KGgo=');
    var editFotoRacun = simpanSantri('s1', { nama: 'Ahmad Fauzi', nis: '202401', jenjang: 'TPQ', kelas: 'Iqra 3', jilid: 'Iqra 3', foto: '"><img src=x onerror=1>' });
    catat('T-21 edit santri foto tidak valid tidak menghapus foto lama', editFotoRacun.ok === true && santriById('s1').foto === 'data:image/png;base64,iVBORw0KGgo=');
    guruById('g1').foto = FOTO_UJI;
    save('Self-test: pasang foto uji g1');
    var editGuruTanpaFoto = simpanGuru('g1', { nama: 'Ustadz Ahmad', kelas: 'Iqra 1', peran: 'Pimpinan', jenjang: 'TPQ dan Ibtidaiyah', hp: '081200000101', honor: 800000 });
    catat('T-21 edit guru tanpa foto mempertahankan foto lama', editGuruTanpaFoto.ok === true && guruById('g1').foto === FOTO_UJI);
    bersih();
    /* T-22: ubah transaksi keuangan. */
    var txBaru = simpanKeuangan({ jenis: 'Masuk', jenjang: 'TPQ', kategori: 'Infaq', nama: 'Uji ubah', jumlah: 100000, tanggal: '2026-11-15', catatan: 'awal' });
    catat('T-22 simpan transaksi uji berhasil', txBaru.ok === true);
    var ubahTx = ubahKeuangan(txBaru.transaksi.id, { nama: 'Uji ubah 2', jumlah: 150000, catatan: 'diubah' });
    catat('T-22 ubahKeuangan mengubah nama/jumlah/catatan', ubahTx.ok === true && ubahTx.transaksi.nama === 'Uji ubah 2' && ubahTx.transaksi.jumlah === 150000 && ubahTx.transaksi.catatan === 'diubah');
    catat('T-22 saldo kas ikut berubah setelah ubah transaksi', saldoKas().saldo === 1050000, rupiah(saldoKas().saldo));
    catat('T-22 ubahKeuangan jumlah 0 ditolak', ubahKeuangan(txBaru.transaksi.id, { jumlah: 0 }).ok === false);
    catat('T-22 ubahKeuangan kategori tidak cocok jenis ditolak', ubahKeuangan(txBaru.transaksi.id, { jenis: 'Keluar', kategori: 'Infaq' }).ok === false);
    catat('T-22 ubahKeuangan transaksi tidak ada ditolak', ubahKeuangan('tidak-ada', { nama: 'x', jumlah: 1000 }).ok === false);
    bersih();
    /* T-24: angka seed yang dirapikan. */
    catat('T-24 realisasi Donasi = 0 (Saldo awal bukan Donasi lagi)', realisasiPos('Donasi', 'Semua') === 0, rupiah(realisasiPos('Donasi', 'Semua')));
    catat('T-24 Saldo awal November berkategori Saldo awal', (db.keuanganTx.find(function (t) { return t.id === 'k4'; }) || {}).kategori === 'Saldo awal');
    catat('T-24 realisasi Honor guru = Rp2.550.000 (3 guru)', realisasiPos('Honor guru', 'Semua') === -2550000, rupiah(realisasiPos('Honor guru', 'Semua')));
    catat('T-24 hafalan s2 konsisten dengan log setoran (An-Naba)', santriById('s2').hafalan === 'Juz 30 (An-Naba)');
    /* ---- Perbaikan ronde Bagas (audit 15 Nov 2026: Wira S1/S2/S4/S5/S6,
       Mira A2/A4) — blok ini jalan di atas seed segar dan diakhiri bersih()
       supaya tidak meninggalkan data uji. ---- */
    /* S1 [KRITIS, MERGE v22]: bersih() memakai keadaan AWAL suite
       (isContohAwal), bukan keadaan berjalan. Suite yang masuk dengan
       data contoh me-reseed walau db sempat jadi data asli/kosong di
       tengah jalan (perilaku DB-KOSONG; lihat T-02). Perlindungan data
       asli yang sesungguhnya — suite yang masuk dengan data asli —
       diuji oleh tes bersarang Y-N3 di bawah (snapshot dipulihkan).
       Tes lama di sini (v21: bersih() menolak bila db berjalan bukan
       contoh) diganti karena premisnya sudah tidak berlaku. */
    (function () {
      var jumlahAwal = db.santri.length;
      db.isContoh = false;
      var tambahMarker = simpanSantri('', { nama: 'DATA ASLI MARKER', nis: '888001', jenjang: 'TPQ', kelas: 'Iqra 1', jilid: 'Iqra 1' });
      var loginSebelum = verifikasiLogin('admin', 'admin123').ok === true;
      bersih();
      catat('S1-merge bersih() masuk-contoh me-reseed walau db sempat asli (marker ikut tereset, kembali 40 santri)', tambahMarker.ok === true && !db.santri.some(function (s) { return s.nis === '888001'; }) && db.santri.length === 40 && db.isContoh === true, db.santri.length + ' santri');
      catat('S1-merge login admin tetap berlaku sesudah reseed', loginSebelum && verifikasiLogin('admin', 'admin123').ok === true);
      db.isContoh = true;
      bersih();
      catat('S1 bersih() dengan data contoh bekerja normal (kembali 40 santri)', db.santri.length === 40 && !db.santri.some(function (s) { return s.nis === '888001'; }) && db.isContoh === true, db.santri.length + ' santri');
    })();
    /* S2: csvEscape menetralkan sel rumus. */
    catat('S2 csvEscape menetralkan = di awal sel', csvEscape('=2+5').indexOf("'=") === 0, csvEscape('=2+5'));
    catat('S2 csvEscape menetralkan + di awal sel', csvEscape('+2+2').indexOf("'+") === 0, csvEscape('+2+2'));
    catat('S2 csvEscape menetralkan - di awal sel', csvEscape('-2+2').indexOf("'-") === 0, csvEscape('-2+2'));
    catat('S2 csvEscape menetralkan @ di awal sel', csvEscape('@SUM(1+1)').indexOf("'@") === 0, csvEscape('@SUM(1+1)'));
    catat('S2 csvEscape menetralkan rumus setelah spasi di depan', csvEscape('  =2+5').indexOf("'") === 0, csvEscape('  =2+5'));
    catat('S2 csvEscape tidak mengubah sel biasa', csvEscape('Budi Santoso') === 'Budi Santoso' && csvEscape(50000) === '50000' && csvEscape('') === '');
    ui.santriStatus = 'Semua'; ui.santriKelas = 'Semua'; setJenjang('Semua');
    simpanSantri('', { nama: "=2+5+cmd|'/C calc'!A0", nis: '999020', jenjang: 'TPQ', kelas: 'Iqra 1', jilid: 'Iqra 1' });
    simpanSantri('', { nama: '@SUM(1+1)', nis: '999021', jenjang: 'TPQ', kelas: 'Iqra 1', jilid: 'Iqra 1' });
    var csvRumus = exportSantriCSV().csv;
    catat('S2 export santri rumus diekspor dengan awalan kutip', csvRumus.indexOf("'=2+5+cmd|") !== -1 && csvRumus.indexOf("'@SUM(1+1)") !== -1, csvRumus.split('\n').filter(function (b) { return b.indexOf('99902') !== -1; }).join(' | '));
    bersih();
    /* S4: buatSalt memakai crypto.getRandomValues (fallback Math.random). */
    catat('S4 buatSalt menghasilkan 32 hex dan dua salt berbeda', (function () { var a = buatSalt(), b = buatSalt(); return /^[0-9a-f]{32}$/.test(a) && /^[0-9a-f]{32}$/.test(b) && a !== b; })());
    /* S5: sandi baru minimal 8 karakter + tolak sandi umum / sama ID. */
    catat('S5 tambahPengguna sandi umum 12345678 ditolak', tambahPengguna({ id: 'lemah1', nama: 'Lemah', peran: 'Guru', sandi: '12345678', olehId: 'admin' }).ok === false && cariPengguna('lemah1') === null);
    catat('S5 tambahPengguna sandi umum password ditolak', tambahPengguna({ id: 'lemah1', nama: 'Lemah', peran: 'Guru', sandi: 'password', olehId: 'admin' }).ok === false);
    catat('S5 tambahPengguna sandi umum admin123 ditolak', tambahPengguna({ id: 'lemah1', nama: 'Lemah', peran: 'Guru', sandi: 'admin123', olehId: 'admin' }).ok === false);
    catat('S5 tambahPengguna sandi 7 karakter ditolak', tambahPengguna({ id: 'lemah1', nama: 'Lemah', peran: 'Guru', sandi: 'tujuh77', olehId: 'admin' }).ok === false);
    catat('S5 tambahPengguna sandi sama dengan ID ditolak', tambahPengguna({ id: 'samaku12', nama: 'Sama', peran: 'Guru', sandi: 'samaku12', olehId: 'admin' }).ok === false && cariPengguna('samaku12') === null);
    var tambahKuat = tambahPengguna({ id: 'kuat1', nama: 'Kuat', peran: 'Guru', sandi: 'KuatBaru-99', olehId: 'admin' });
    catat('S5 tambahPengguna sandi kuat (>=8, tidak umum) berhasil', tambahKuat.ok === true && verifikasiLogin('kuat1', 'KuatBaru-99').ok === true);
    catat('S5 resetSandiPengguna ke sandi umum ditolak, sandi lama tetap berlaku', resetSandiPengguna('kuat1', 'password123', 'admin').ok === false && verifikasiLogin('kuat1', 'KuatBaru-99').ok === true);
    var resetKuat = resetSandiPengguna('kuat1', 'reset-kuat-9', 'admin');
    catat('S5 resetSandiPengguna ke sandi kuat berhasil', resetKuat.ok === true && verifikasiLogin('kuat1', 'reset-kuat-9').ok === true);
    catat('S5 gantiSandiSendiri ke sandi umum ditolak', gantiSandiSendiri('kuat1', 'reset-kuat-9', 'password').ok === false && verifikasiLogin('kuat1', 'reset-kuat-9').ok === true);
    var gantiKuat = gantiSandiSendiri('kuat1', 'reset-kuat-9', 'ganti-kuat-9');
    catat('S5 gantiSandiSendiri ke sandi kuat berhasil', gantiKuat.ok === true && verifikasiLogin('kuat1', 'ganti-kuat-9').ok === true);
    catat('S5 login seed admin123/guru123 tetap jalan (aturan hanya untuk sandi baru)', verifikasiLogin('admin', 'admin123').ok === true && verifikasiLogin('guru1', 'guru123').ok === true);
    tambahPengguna({ id: 'paksa1', nama: 'Paksa', peran: 'Guru', sandi: 'PaksaAwal-9', olehId: 'admin' });
    masukPengguna('paksa1', 'PaksaAwal-9');
    catat('S5 gantiSandiPaksa ke sandi umum ditolak, flag tetap wajib', gantiSandiPaksa('paksa1', '12345678').ok === false && cariPengguna('paksa1').wajibGantiSandi === true);
    var paksaKuat = gantiSandiPaksa('paksa1', 'paksa-kuat-9');
    catat('S5 gantiSandiPaksa ke sandi kuat berhasil', paksaKuat.ok === true && verifikasiLogin('paksa1', 'paksa-kuat-9').ok === true);
    keluarPengguna();
    hapusPengguna('kuat1', 'admin');
    hapusPengguna('paksa1', 'admin');
    /* S6: restore di perangkat segar (pengguna lokal kosong) memaksa ganti sandi. */
    var cadanganS6 = JSON.parse(JSON.stringify(seedData()));
    cadanganS6.pengguna = [
      { id: 'pulih1', nama: 'Pulih 1', peran: 'Guru', salt: '33333333333333333333333333333333', hash: hashSandi('33333333333333333333333333333333', 'pulihkuat1'), wajibGantiSandi: false, dibuatPada: '2026-11-15' },
      { id: 'pulih2', nama: 'Pulih 2', peran: 'Pimpinan', salt: '44444444444444444444444444444444', hash: hashSandi('44444444444444444444444444444444', 'pulihkuat2'), wajibGantiSandi: false, dibuatPada: '2026-11-15' }
    ];
    db.pengguna = [];
    var okS6 = applyBackupData(cadanganS6);
    catat('S6 restore perangkat segar: semua pengguna hasil restore wajib ganti sandi', okS6 && cariPengguna('pulih1') !== null && cariPengguna('pulih1').wajibGantiSandi === true && cariPengguna('pulih2') !== null && cariPengguna('pulih2').wajibGantiSandi === true, 'pulih1=' + (cariPengguna('pulih1') || {}).wajibGantiSandi);
    catat('S6 restore perangkat segar: sandi dari berkas tetap bisa login (untuk lalu ganti)', verifikasiLogin('pulih1', 'pulihkuat1').ok === true && verifikasiLogin('pulih2', 'pulihkuat2').ok === true);
    bersih();
    /* A4: bacaRupiah — format Indonesia. */
    catat('A4 bacaRupiah "50.000" -> 50000', bacaRupiah('50.000') === 50000);
    catat('A4 bacaRupiah "50000" -> 50000', bacaRupiah('50000') === 50000);
    catat('A4 bacaRupiah "50,000" -> 50000', bacaRupiah('50,000') === 50000);
    catat('A4 bacaRupiah "50.000.000" -> 50000000', bacaRupiah('50.000.000') === 50000000);
    catat('A4 bacaRupiah "" -> NaN', isNaN(bacaRupiah('')));
    catat('A4 bacaRupiah "abc" -> NaN', isNaN(bacaRupiah('abc')));
    catat('A4 bacaRupiah "Rp 50.000" -> 50000', bacaRupiah('Rp 50.000') === 50000);
    catat('A4 bacaRupiah "rp50.000" -> 50000', bacaRupiah('rp50.000') === 50000);
    catat('A4 bacaRupiah "12a3" -> NaN', isNaN(bacaRupiah('12a3')));
    /* A2: Hapus semua data mempertahankan pengguna + sandi SAAT INI dan sesi. */
    var masukA2 = masukPengguna('admin', 'admin123');
    var gantiA2 = gantiSandiSendiri('admin', 'admin123', 'pimpinan-baru-9');
    catat('A2 persiapan: ganti sandi admin dulu berhasil', masukA2.ok === true && gantiA2.ok === true);
    var sesiSebelumHapus = sesiAktif();
    var kosongA2 = clearAllData();
    catat('A2 Hapus semua data mengosongkan semua array data', kosongA2.santri.length === 0 && kosongA2.guru.length === 0 && kosongA2.kelas.length === 0 && kosongA2.tabunganTx.length === 0 && kosongA2.keuanganTx.length === 0 && kosongA2.nilai.length === 0 && kosongA2.pertemuan.length === 0 && kosongA2.pengumuman.length === 0);
    catat('A2 Hapus semua data mempertahankan pengguna + sandi saat ini', cariPengguna('admin') !== null && verifikasiLogin('admin', 'pimpinan-baru-9').ok === true && verifikasiLogin('admin', 'admin123').ok === false);
    catat('A2 sesi tetap valid setelah Hapus semua data', sesiSebelumHapus !== null && sesiAktif() !== null && sesiAktif().id === 'admin');
    keluarPengguna();
    resetToSeed();
    /* ---- DB-KOSONG (ronde "Data kosong + Panduan pengguna", Baskara) ----
       Setelah clearAllData(): semua array data kosong, settings kembali ke
       default, pengguna seed tetap bisa login, dan semua fungsi yang dipakai
       UI tidak melempar / tidak menghasilkan NaN / Infinity. Tidak ada
       perbaikan kode yang dibutuhkan di ronde ini (probe Node 60+ panggilan
       lolos 0 masalah) — blok ini mengunci perilaku itu supaya regresi
       ketahuan. Wizard/panduan (Kirana) tidak butuh helper engine baru:
       hitungannya sudah ada (santriAktif().length, db.guru.length,
       db.kelas.length, saldoKas()), jadi tidak ada API baru. */
    clearAllData();
    var kosongArr = ['santri', 'guru', 'kelas', 'tabunganTx', 'target', 'keuanganTx', 'pertemuan', 'hafalanLog', 'pengumuman', 'nilai', 'alokasiWaktu', 'jadwalKbm', 'jadwalPiket', 'absensiGuru', 'rapbm', 'biaya'];
    catat('DB-KOSONG hapus semua data mengosongkan 16 array data', kosongArr.every(function (k) { return Array.isArray(db[k]) && db[k].length === 0; }), kosongArr.filter(function (k) { return !db[k] || db[k].length; }).join(',') || '16/16 kosong');
    catat('DB-KOSONG settings kembali ke default (TPQ Al-Muttaqin, SPP 50000, 2026/2027)', db.settings.namaTpq === 'TPQ Al-Muttaqin' && db.settings.tarifSpp === 50000 && db.settings.tahunAjaran === '2026/2027' && db.settings.kepala === '' && db.settings.jamMasuk === '15:30' && db.isContoh === false, JSON.stringify(db.settings));
    catat('DB-KOSONG login seed tetap bisa: verifikasiLogin admin+guru1', verifikasiLogin('admin', 'admin123').ok === true && verifikasiLogin('guru1', 'guru123').ok === true);
    catat('DB-KOSONG login seed tetap bisa: masukPengguna admin + sesiAktif', (function () { var m = masukPengguna('admin', 'admin123'); var s = sesiAktif(); keluarPengguna(); return m.ok === true && !!s && s.id === 'admin'; })());
    catat('DB-KOSONG sandi salah tetap ditolak setelah hapus data', verifikasiLogin('admin', 'salah').ok === false && verifikasiLogin('tidak-ada', 'admin123').ok === false);
    catat('DB-KOSONG agregat nol tanpa NaN: saldoKas/totalTabungan/rataKehadiran', (function () { var k = saldoKas(); return k.masuk === 0 && k.keluar === 0 && k.saldo === 0 && totalTabungan() === 0 && rataKehadiran() === 0; })());
    catat('DB-KOSONG hitungRapor santri tak ada = semua null, kehadiran = null', (function () { var r = hitungRapor('tidak-ada', 'ganjil-2627'); return r.harian === null && r.imda === null && r.praktek === null && r.akhir === null && hitungKehadiranDariPertemuan('tidak-ada') === null; })());
    catat('DB-KOSONG rekapGender([]) nol; arusKasPerBulan {} ; arusKasMingguan minggu nol', (function () { var g = rekapGender([]); var b = arusKasPerBulan(); var m = arusKasMingguan(); return g.l === 0 && g.p === 0 && g.kosong === 0 && Object.keys(b).length === 0 && m.minggu.length === 4 && m.minggu.every(function (x) { return x === 0; }) && isFinite(m.minggu[0]); })());
    catat('DB-KOSONG export CSV murid/guru/nilai/absensi/keuangan = 0 baris (header saja)', exportSantriCSV().count === 0 && exportGuruCSV().count === 0 && exportNilaiCSV().count === 0 && exportAbsensiCSV().count === 0 && exportKeuanganCSV().count === 0);
    catat('DB-KOSONG exportRaporCSV santri tak ada gagal sopan (bukan throw)', exportRaporCSV('tidak-ada').ok === false);
    catat('DB-KOSONG tampil/filter/picker kosong: 0 baris, item picker []', santriTampil().length === 0 && guruTampil().length === 0 && nilaiExportRows().length === 0 && tabunganRiwayat().length === 0 && hafalanLogTampil().length === 0 && piketTampil().length === 0 && filterSantriList('').length === 0 && santriPickerItems().items.length === 0 && guruPickerItems().items.length === 0);
    catat('DB-KOSONG struk/teksRapor/pengingatSPP santri tak ada = null', strukTabungan('tidak-ada') === null && teksRapor('tidak-ada') === null && pengingatSPP('tidak-ada') === null);
    catat('DB-KOSONG import teks kosong gagal sopan (berhasil 0, tanpa throw)', (function () { var lap = importCsvText('murid', ''); return lap.berhasil === 0 && lap.gagal.length === 1; })());
    catat('DB-KOSONG angka hasil hitung berhingga (tanpa NaN/Infinity)', (function () { var angka = [saldoKas().saldo, totalTabungan(), rataKehadiran(), arusKasMingguan().minggu[0], realisasiPos('Donasi', 'Semua')]; return angka.every(function (x) { return typeof x === 'number' && isFinite(x); }); })());
    /* ---- IDENTITAS MADRASAH + PROFIL AKTIF (ronde "Data kosong +
       Panduan pengguna", Baskara) ---- */
    var profilAwal = null;
    try { profilAwal = lsGet(PROFIL_KEY); } catch (e) { profilAwal = null; }
    function pulihkanProfil() {
      try { if (profilAwal == null) lsRemove(PROFIL_KEY); else lsSet(PROFIL_KEY, profilAwal); } catch (e) { /* abaikan */ }
      keluarPengguna();
    }
    /* Migrasi dari settings lama (tanpa identitas). */
    var sLama = { namaTpq: 'TPQ Al-Muttaqin' };
    migrasiIdentitas(sLama);
    catat('IDENTITAS migrasi settings lama: TPQ dari namaTpq (TPQ Al-Muttaqin/TPQ)', !!sLama.identitas && sLama.identitas.TPQ.nama === 'TPQ Al-Muttaqin' && sLama.identitas.TPQ.singkat === 'TPQ', JSON.stringify(sLama.identitas && sLama.identitas.TPQ));
    catat('IDENTITAS migrasi settings lama: Ibtidaiyah default (Madrasah Ibtidaiyah/MI)', !!sLama.identitas && sLama.identitas.Ibtidaiyah.nama === 'Madrasah Ibtidaiyah' && sLama.identitas.Ibtidaiyah.singkat === 'MI' && sLama.identitas.Ibtidaiyah.kepala === '' && sLama.identitas.Ibtidaiyah.logo === '', JSON.stringify(sLama.identitas && sLama.identitas.Ibtidaiyah));
    var sKustom = { namaTpq: 'TPQ Nurul Huda' };
    migrasiIdentitas(sKustom);
    catat('IDENTITAS migrasi memakai namaTpq kustom bila ada', sKustom.identitas.TPQ.nama === 'TPQ Nurul Huda' && sKustom.identitas.TPQ.singkat === 'TPQ');
    var sKepala = { namaTpq: 'TPQ Al-Muttaqin', kepala: 'Ustadz Ahmad' };
    migrasiIdentitas(sKepala);
    catat('IDENTITAS migrasi membawa settings.kepala ke identitas TPQ', sKepala.identitas.TPQ.kepala === 'Ustadz Ahmad', JSON.stringify(sKepala.identitas.TPQ));
    var sAda = { namaTpq: 'TPQ Al-Muttaqin', identitas: { TPQ: { nama: 'TPQ Sudah Ada', singkat: 'TSA', logo: '', kepala: 'Ust. X', alamat: '', telepon: '', tahunBerdiri: '', nsm: '', motto: '' }, Ibtidaiyah: { nama: 'MI Sudah Ada', singkat: 'MSA', logo: '', kepala: '', alamat: '', telepon: '', tahunBerdiri: '', nsm: '', motto: '' } } };
    migrasiIdentitas(sAda);
    catat('IDENTITAS migrasi tidak menimpa identitas yang sudah ada', sAda.identitas.TPQ.nama === 'TPQ Sudah Ada' && sAda.identitas.TPQ.kepala === 'Ust. X' && sAda.identitas.Ibtidaiyah.nama === 'MI Sudah Ada');
    var sParsial = { namaTpq: 'TPQ Al-Muttaqin', identitas: { TPQ: { nama: 'TPQ Parsial', singkat: 'TP', logo: '', kepala: '', alamat: '', telepon: '', tahunBerdiri: '', nsm: '', motto: '' } } };
    migrasiIdentitas(sParsial);
    catat('IDENTITAS migrasi melengkapi jenjang yang belum ada (Ibtidaiyah default)', sParsial.identitas.TPQ.nama === 'TPQ Parsial' && sParsial.identitas.Ibtidaiyah.nama === 'Madrasah Ibtidaiyah' && sParsial.identitas.Ibtidaiyah.singkat === 'MI');
    /* identitasUntuk: defensif saat identitas belum ada (mis. db seed
       yang diganti bersih() tanpa lewat load()). */
    catat('IDENTITAS identitasUntuk tanpa identitas tersimpan memberi default lengkap TPQ', (function () { delete db.settings.identitas; var id = identitasUntuk('TPQ'); return id.nama === 'TPQ Al-Muttaqin' && id.singkat === 'TPQ' && id.logo === '' && id.kepala === '' && id.motto === ''; })());
    catat('IDENTITAS identitasUntuk Ibtidaiyah default (Madrasah Ibtidaiyah/MI)', (function () { var id = identitasUntuk('Ibtidaiyah'); return id.nama === 'Madrasah Ibtidaiyah' && id.singkat === 'MI'; })());
    migrasiIdentitas(db.settings);
    /* simpanIdentitas. */
    masukPengguna('admin', 'admin123');
    var simpanTpq = simpanIdentitas('TPQ', { nama: '  TPQ Al-Muttaqin Baru  ', singkat: 'TPQ', kepala: 'Ustadz Ahmad', motto: 'Menuntut ilmu' }, 'admin');
    catat('IDENTITAS simpanIdentitas Pimpinan berhasil + namaTpq ikut berubah (satu sumber kebenaran)', simpanTpq.ok === true && db.settings.identitas.TPQ.nama === 'TPQ Al-Muttaqin Baru' && db.settings.namaTpq === 'TPQ Al-Muttaqin Baru' && db.settings.identitas.TPQ.kepala === 'Ustadz Ahmad' && db.settings.identitas.TPQ.motto === 'Menuntut ilmu', JSON.stringify(db.settings.identitas.TPQ));
    var simpanIbt = simpanIdentitas('Ibtidaiyah', { nama: 'Madrasah Ibtidaiyah Al-Muttaqin', singkat: 'MI' }, 'admin');
    catat('IDENTITAS simpanIdentitas Ibtidaiyah berhasil + namaTpq TIDAK berubah', simpanIbt.ok === true && db.settings.identitas.Ibtidaiyah.nama === 'Madrasah Ibtidaiyah Al-Muttaqin' && db.settings.namaTpq === 'TPQ Al-Muttaqin Baru');
    keluarPengguna();
    masukPengguna('guru1', 'guru123');
    var simpanOlehGuru = simpanIdentitas('TPQ', { nama: 'TPQ Guru' }, 'guru1');
    catat('IDENTITAS simpanIdentitas sebagai Guru ditolak', simpanOlehGuru.ok === false && simpanOlehGuru.error === 'bukan-pimpinan' && db.settings.identitas.TPQ.nama === 'TPQ Al-Muttaqin Baru');
    keluarPengguna();
    masukPengguna('admin', 'admin123');
    catat('IDENTITAS simpanIdentitas nama kosong ditolak', simpanIdentitas('TPQ', { nama: '   ' }, 'admin').ok === false);
    catat('IDENTITAS simpanIdentitas jenjang tidak dikenal ditolak', simpanIdentitas('SD', { nama: 'X' }, 'admin').ok === false);
    catat('IDENTITAS simpanIdentitas logo bukan data URL ditolak', simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru', logo: 'https://contoh.id/logo.png' }, 'admin').ok === false && db.settings.identitas.TPQ.logo === '');
    var simpanLogo = simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru', logo: 'data:image/png;base64,iVBORw0KGgo=' }, 'admin');
    catat('IDENTITAS simpanIdentitas logo data URL diterima', simpanLogo.ok === true && db.settings.identitas.TPQ.logo === 'data:image/png;base64,iVBORw0KGgo=');
    /* Wira (ronde "Data kosong + Panduan pengguna"): SVG lolos cek lama
       'data:image/' — ditolak sekarang (fotoAman: jpeg/png/webp base64). */
    var simpanLogoSvg = simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru', logo: 'data:image/svg+xml;base64,PHN2Zz4=' }, 'admin');
    catat('IDENTITAS simpanIdentitas logo SVG ditolak (bukan jpeg/png/webp base64)', simpanLogoSvg.ok === false && simpanLogoSvg.error === 'logo-tidak-valid' && db.settings.identitas.TPQ.logo === 'data:image/png;base64,iVBORw0KGgo=');
    var simpanLogoJs = simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru', logo: 'javascript:alert(1)' }, 'admin');
    catat('IDENTITAS simpanIdentitas logo javascript: ditolak', simpanLogoJs.ok === false && simpanLogoJs.error === 'logo-tidak-valid');
    keluarPengguna();
    /* Profil aktif. */
    lsRemove(PROFIL_KEY);
    keluarPengguna();
    catat('PROFIL getProfilAktif default TPQ bila belum ada simpanan', getProfilAktif() === 'TPQ');
    var setIbt = setProfilAktif('Ibtidaiyah');
    catat('PROFIL setProfilAktif Ibtidaiyah bertahan di localStorage + jenjang ikut', setIbt === 'Ibtidaiyah' && lsGet(PROFIL_KEY) === 'Ibtidaiyah' && getJenjang() === 'Ibtidaiyah' && ui.jenjang === 'Ibtidaiyah' && getProfilAktif() === 'Ibtidaiyah');
    masukPengguna('guru1', 'guru123');
    var tolakSemua = setProfilAktif('Semua');
    catat('PROFIL setProfilAktif Semua sebagai Guru ditolak (efektif tetap Ibtidaiyah, simpanan tidak berubah)', tolakSemua === 'Ibtidaiyah' && getProfilAktif() === 'Ibtidaiyah' && ui.jenjang === 'Ibtidaiyah' && lsGet(PROFIL_KEY) === 'Ibtidaiyah');
    keluarPengguna();
    /* Boot: simpanan 'Semua' + sesi Guru -> jatuh ke TPQ, simpanan utuh. */
    lsSet(PROFIL_KEY, 'Semua');
    setJenjang('Semua');
    masukPengguna('guru1', 'guru123');
    var bootGuru = setProfilAktif(bacaProfilTersimpan());
    catat('PROFIL boot simpanan Semua + Guru: efektif TPQ, simpanan Semua tidak tertimpa', bootGuru === 'TPQ' && ui.jenjang === 'TPQ' && lsGet(PROFIL_KEY) === 'Semua' && getProfilAktif() === 'TPQ');
    keluarPengguna();
    masukPengguna('admin', 'admin123');
    var terimaSemua = setProfilAktif('Semua');
    catat('PROFIL setProfilAktif Semua sebagai Pimpinan diterima + jenjang Semua', terimaSemua === 'Semua' && lsGet(PROFIL_KEY) === 'Semua' && getJenjang() === 'Semua' && ui.jenjang === 'Semua' && getProfilAktif() === 'Semua');
    /* ---- Perbaikan v22 (Baskara): Y2, Y3, Y4, Y6, N19 ----
       Mulai dari data seed segar: blok IDENTITAS berjalan sesudah blok
       DB-KOSONG (clearAllData, db kosong), jadi tanpa bersih() semua
       asersi "santri tampil" di bawah ini vakum (tampil 0). */
    bersih();
    /* seedData() dari bersih() belum dimigrasi (tanpa identitas) —
       load() selalu memigrasi; tegakkan invarian yang sama di sini
       supaya asersi logo di bawah tidak membaca identitas undefined
       (simpanIdentitas yang DITOLAK return sebelum migrasi). */
    migrasiIdentitas(db.settings);
    masukPengguna('admin', 'admin123');
    setProfilAktif('Semua');
    /* N19: flag default false — seed, emptyData, dan backup lama yang
       settings-nya tanpa flag (Object.assign di load() mengambil false
       dari emptyData). Di titik ini db.settings flag-nya sudah true
       karena simpanIdentitas di atas, jadi default diuji lewat objek
       segar, bukan lewat db. */
    catat('N19 identitasDikonfirmasi default false (seed + emptyData + backup lama tanpa flag)', emptyData().settings.identitasDikonfirmasi === false && seedData().settings.identitasDikonfirmasi === false && Object.assign(emptyData().settings, { namaTpq: 'TPQ Lama' }).identitasDikonfirmasi === false);
    /* Y6: profil 'Semua', filter basi (kelas Ibtidaiyah + cari yang tidak
       ada) -> daftar kosong; pindah TPQ -> filter reset + daftar tampil. */
    ui.santriKelas = 'Kelas 1'; ui.santriAngkatan = '2025'; ui.santriSearch = 'zzz-tidak-ada'; ui.santriStatus = 'Aktif';
    catat('Y6 filter basi mengosongkan daftar sebelum pindah profil', santriTampil().length === 0);
    var y6pindah = setProfilAktif('TPQ');
    catat('Y6 ganti profil Semua -> TPQ mereset filter jenjang + santri TPQ tampil', y6pindah === 'TPQ' && ui.santriKelas === 'Semua' && ui.santriAngkatan === 'Semua' && ui.santriStatus === 'Aktif' && ui.santriSearch === '' && santriTampil().length > 0, 'tampil ' + santriTampil().length);
    ui.santriKelas = 'Iqra 1';
    setProfilAktif('TPQ');
    catat('Y6 profil TIDAK berubah -> filter dipertahankan (tidak direset)', ui.santriKelas === 'Iqra 1');
    ui.santriKelas = 'Semua';
    /* Y2: sebagai Guru, setJenjang('Semua') lalu santriTampil() TANPA
       render() di antaranya — harus tetap tanpa data Ibtidaiyah, dan
       export CSV Guru juga. Pimpinan tetap bisa 'Semua'. */
    keluarPengguna();
    masukPengguna('guru1', 'guru123');
    setProfilAktif('TPQ');
    var y2tolak = setJenjang('Semua');
    catat('Y2 Guru setJenjang Semua ditolak tanpa render: santriTampil tanpa Ibtidaiyah', y2tolak !== 'Semua' && ui.jenjang !== 'Semua' && santriTampil().length > 0 && santriTampil().every(function (s) { return s.jenjang !== 'Ibtidaiyah'; }), 'setJenjang=' + y2tolak + ', tampil ' + santriTampil().length);
    catat('Y2 export CSV Guru tetap tanpa Ibtidaiyah', exportSantriCSV().csv.indexOf('Ibtidaiyah') === -1);
    keluarPengguna();
    masukPengguna('admin', 'admin123');
    setJenjang('Semua');
    catat('Y2 Pimpinan setJenjang Semua tetap bisa + Ibtidaiyah tampil', ui.jenjang === 'Semua' && santriTampil().some(function (s) { return s.jenjang === 'Ibtidaiyah'; }));
    /* Y4: magic bytes — HTML berkedok PNG ditolak, PNG 1x1 + JPEG +
       WebP valid diterima. */
    var logoHtml = 'data:image/png;base64,PGh0bWw+PHNjcmlwdD53aW5kb3cuX194c3M9MTwvc2NyaXB0PjwvaHRtbD4=';
    catat('Y4 fotoAman menolak PNG berisi HTML; menerima PNG 1x1 + JPEG + WebP valid', fotoAman(logoHtml) === false && fotoAman('data:image/png;base64,iVBORw0KGgo=') === true && fotoAman('data:image/jpeg;base64,/9j/4AAQSkZJRg==') === true && fotoAman('data:image/webp;base64,UklGRhAAAABXRUJQ') === true);
    var simpanLogoAwalY4 = simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru', logo: 'data:image/png;base64,iVBORw0KGgo=' }, 'admin');
    var simpanLogoHtml = simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru', logo: logoHtml }, 'admin');
    catat('Y4 simpanIdentitas menolak PNG berisi HTML (logo lama utuh)', simpanLogoAwalY4.ok === true && simpanLogoHtml.ok === false && simpanLogoHtml.error === 'logo-tidak-valid' && identitasUntuk('TPQ').logo === 'data:image/png;base64,iVBORw0KGgo=');
    /* Y3: cap 1 MB — logo tepat 1.048.576 byte diterima, 3.000.000 byte
       ditolak dengan pesan yang menyebut 1 MB. Base64 dibangun TANPA
       padding '=' di tengah ('iVBORw0KGgoA' = 8 byte magic PNG + 1 byte
       nol; '=' hanya boleh di ujung base64 — 'iVBORw0KGgo=' + 'A'... di
       tengah membuat atob melempar dan fotoAman menolak logo yang
       sebenarnya valid). */
    var logo1MB = 'data:image/png;base64,iVBORw0KGgoA' + 'A'.repeat(LOGO_MAX_BYTES - 22 - 12);
    var simpanLogo1MB = simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru', logo: logo1MB }, 'admin');
    catat('Y3 logo 1 MB (tepat di batas) diterima', simpanLogo1MB.ok === true && identitasUntuk('TPQ').logo === logo1MB, 'panjang ' + logo1MB.length);
    var logo3MB = 'data:image/png;base64,iVBORw0KGgoA' + 'A'.repeat(3000000 - 22 - 12);
    var simpanLogo3MB = simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru', logo: logo3MB }, 'admin');
    catat('Y3 logo 3 MB ditolak, pesan menyebut 1 MB (logo 1 MB utuh)', simpanLogo3MB.ok === false && simpanLogo3MB.error === 'logo-terlalu-besar' && simpanLogo3MB.message.indexOf('1 MB') !== -1 && identitasUntuk('TPQ').logo === logo1MB);
    /* N19: simpan sukses menandai flag (diuji dari false supaya tidak
       vakum — simpanIdentitas di atas sudah menandainya true). */
    db.settings.identitasDikonfirmasi = false;
    var simpanN19 = simpanIdentitas('TPQ', { nama: 'TPQ Al-Muttaqin Baru' }, 'admin');
    catat('N19 simpanIdentitas sukses menandai identitasDikonfirmasi=true', simpanN19.ok === true && db.settings.identitasDikonfirmasi === true);
    /* ---- §6 isContoh (b) — mutasi tulis asli pertama membalik flag
       (tambahan v22, Baskara) ----
       Guard selftest dimatikan SEMENTARA di dalam tes ini saja (flag +
       deteksi URL), lalu dikembalikan — supaya tes sesudahnya tidak
       terpengaruh. Snapshot db + antrean dipulihkan sesudahnya, jadi
       santri uji tidak menempel. Di Node (tanpa DOM) sub-cek tampilLogin
       dilewati; di harness jsdom ia diperiksa sungguhan. */
    (function () {
      var snapDb6 = JSON.parse(JSON.stringify(db));
      var snapQueue6 = JSON.parse(JSON.stringify(getQueue()));
      var flagAwal6 = selftestAktif;
      var lewatiAwal6 = lewatiDeteksiUrlSelftest;
      var ok6 = false, detail6 = '';
      try {
        selftestAktif = false;
        lewatiDeteksiUrlSelftest = true;
        var tambah6 = simpanSantri(null, { nama: 'Santri Asli Uji', nis: '777001', jk: 'L', kelas: 'Iqra 1', jenjang: 'TPQ' });
        var gate6 = null;
        try { gate6 = (typeof bolehSelftest === 'function') ? bolehSelftest() : null; } catch (e) { gate6 = null; }
        var kotak6 = null, kotakDetail6 = '';
        try {
          if (typeof tampilLogin === 'function' && typeof document !== 'undefined' && document) {
            tampilLogin();
            var htmlLogin6 = '';
            try { htmlLogin6 = (document.getElementById('auth-root') || {}).innerHTML || ''; } catch (e2) { htmlLogin6 = ''; }
            kotak6 = htmlLogin6.indexOf('auth-kredensial') === -1 && htmlLogin6.indexOf('admin123') === -1;
            kotakDetail6 = kotak6 ? 'kotak kredensial tidak ada di layar login' : 'kotak kredensial MASIH ada di layar login';
          } else { kotak6 = null; kotakDetail6 = 'tanpa DOM (Node): sub-cek tampilLogin dilewati'; }
        } catch (e) { kotak6 = false; kotakDetail6 = 'LEMPAR tampilLogin: ' + e.message; }
        ok6 = tambah6.ok === true && db.isContoh === false && gate6 === false && (kotak6 === true || kotak6 === null);
        detail6 = 'santri=' + (tambah6.ok === true) + ', isContoh=' + db.isContoh + ', bolehSelftest=' + gate6 + ', ' + kotakDetail6;
      } catch (e) { ok6 = false; detail6 = 'LEMPAR: ' + e.message; }
      selftestAktif = flagAwal6;
      lewatiDeteksiUrlSelftest = lewatiAwal6;
      try {
        Object.keys(db).forEach(function (k) { delete db[k]; });
        Object.keys(snapDb6).forEach(function (k) { db[k] = snapDb6[k]; });
        save('Self-test §6: kembalikan snapshot');
      } catch (e) { /* abaikan */ }
      try { setQueue(snapQueue6); } catch (e) { /* abaikan */ }
      catat('§6 tambah santri asli membalik isContoh=false, kotak login hilang, bolehSelftest()=false', ok6, detail6);
      /* Guard menyala lagi: tulis berikutnya TIDAK boleh membalik. */
      var jaga6 = simpanSantri(null, { nama: 'Santri Jaga Uji', nis: '777002', jk: 'L', kelas: 'Iqra 1', jenjang: 'TPQ' });
      catat('§6 guard selftest menyala: tulis saat selftest TIDAK membalik isContoh', jaga6.ok === true && db.isContoh === true, 'isContoh=' + db.isContoh);
      try { if (jaga6.ok === true && jaga6.santri) hapusSantri(jaga6.santri.id); } catch (e) { /* abaikan */ }
    })();
    keluarPengguna();
    pulihkanProfil();
    bersih();
  }
  function jalankanAsync() {
    /* Antrean sinkron saat offline */
    syncSimOffline = true;
    setQueue([]);
    save('Self-test: perubahan saat offline');
    var q = getQueue();
    catat('Perubahan saat offline masuk antrean', q.length >= 1, q.length + ' antrean');
    catat('Status saat offline menyebut tersimpan di perangkat', syncState().code === 'offline' && syncState().text.indexOf('Offline') === 0, syncState().text);
    syncSimOffline = false;
    /* URL malformed: flushSync tidak boleh throw dan tidak boleh macet */
    var cfgUrlAsli = getSheetCfg().appsScriptUrl;
    enqueueChange('Self-test: uji URL buruk');
    setSheetCfg(Object.assign(getSheetCfg(), { appsScriptUrl: 'ht!tp://:::buruk' }));
    var hasilUrlBuruk = null, urlBurukLempar = false;
    return Promise.resolve().then(function () {
      try { return flushSync(); } catch (e) { urlBurukLempar = true; return 'throw:' + e.message; }
    }).then(function (hasil) {
      hasilUrlBuruk = hasil;
      catat('URL Apps Script malformed ditolak tanpa throw dan syncBusy tetap false', !urlBurukLempar && !syncBusy && getQueue().length >= 1, 'hasil=' + hasilUrlBuruk + ', lempar=' + urlBurukLempar + ', syncBusy=' + syncBusy + ', antrean=' + getQueue().length);
      setSheetCfg(Object.assign(getSheetCfg(), { appsScriptUrl: cfgUrlAsli }));
      setQueue([]);
      /* Host di luar allowlist ditolak SEBELUM kirim (antrean harus ada dulu,
         karena flushSync mengembalikan 'empty' kalau antrean kosong). */
      enqueueChange('Self-test: uji host di luar allowlist');
      var cfg = getSheetCfg();
      var cfgAsli = cfg.appsScriptUrl;
      cfg.appsScriptUrl = 'http://127.0.0.1:9/exec';
      setSheetCfg(cfg);
      var janjiSinkron;
      try { janjiSinkron = flushSync(); } catch (e) { janjiSinkron = Promise.resolve('throw:' + e.message); }
      return Promise.resolve(janjiSinkron).then(function (hasil2) {
        catat('Sinkron ke host di luar allowlist ditolak sebelum kirim, antrean tetap ada', hasil2 === 'bad-host' && getQueue().length >= 1, 'hasil=' + hasil2 + ', antrean=' + getQueue().length);
        cfg.appsScriptUrl = cfgAsli;
        setSheetCfg(cfg);
        setQueue([]);
        /* Tanpa konfigurasi: flushSync mengembalikan no-config, bukan throw */
        return Promise.resolve(flushSync()).then(function (hasil3) {
          catat('Sinkron tanpa antrean mengembalikan empty', hasil3 === 'empty', 'hasil=' + hasil3);
        });
      });
    }).then(function () {
      /* ---- Y-N3 (tambahan v22): selftest langsung di atas data asli ----
         Bangun data asli (marker santri + sandi admin asli + isContoh
         false — flag disetel langsung seperti probe Yoga, karena guard
         selftest yang sedang menyala menahan pembalikan lewat jalur
         tulis), lalu panggil runEngineSelfTests BERSARANG dengan pencatat
         dummy (asersi bersarang TIDAK masuk hitungan luar). Sesudahnya
         data + pengguna harus utuh dan admin tetap bisa login dengan
         sandi asli (bukan wirauji123 / admin123). Snapshot luar
         dipulihkan sesudahnya supaya ekor suite tetap melihat seed. */
      var snapDbY = JSON.parse(JSON.stringify(db));
      var snapQueueY = JSON.parse(JSON.stringify(getQueue()));
      var flagLuarY = selftestAktif;
      var lewatiLuarY = lewatiDeteksiUrlSelftest;
      /* Siapkan data asli secara idempotent (TANPA bersih() — di jalur
         data asli bersih() memang dilewati, jadi setup tidak boleh
         bergantung padanya): singkirkan marker lama bila sudah ada,
         paksa sandi admin ke admin123 dulu (resetSandiPengguna tidak
         memverifikasi sandi lama), lalu ganti ke sandi asli. */
      try {
        var adaY = db.santri.find(function (s) { return s.nis === '888001'; });
        if (adaY) hapusSantri(adaY.id);
      } catch (e) { /* abaikan */ }
      try { resetSandiPengguna('admin', 'admin123', 'admin'); } catch (e) { /* abaikan */ }
      var tambahY = simpanSantri(null, { nama: 'DATA ASLI MARKER', nis: '888001', jk: 'L', kelas: 'Iqra 1', jenjang: 'TPQ' });
      var gantiY = null;
      try { gantiY = gantiSandiSendiri('admin', 'admin123', 'SandiAsliKlien9'); } catch (e) { gantiY = null; }
      db.isContoh = false;
      try { save('Self-test Y-N3: siapkan data asli'); } catch (e) { /* abaikan */ }
      var santriAwalY = db.santri.length, guruAwalY = db.guru.length, nilaiAwalY = db.nilai.length, keuAwalY = db.keuanganTx.length;
      var siapY = tambahY.ok === true && gantiY && gantiY.ok === true && db.isContoh === false && db.santri.some(function (s) { return s.nis === '888001'; });
      return Promise.resolve().then(function () {
        if (!siapY) return { pass: 0, fail: 0, dilewati: 'setup-gagal' };
        /* Anti-rekursi: panggilan bersarang (kedalaman > 1) TIDAK boleh
           memanggil lagi — tes Y-N3-nya dilewati. Tanpa ini, setiap
           tingkat memanggil tingkat berikutnya tanpa henti. */
        if (kedalamanSelftest !== 1) return { pass: 0, fail: 0, dilewati: 'bersarang-kedalaman-' + kedalamanSelftest };
        return runEngineSelfTests(function () { /* pencatat dummy: buang */ });
      }).then(function (hasilY) {
        if (hasilY.dilewati) {
          catat('Y-N3 selftest langsung di atas data asli: data + pengguna utuh, login sandi asli berhasil', true, 'dilewati di panggilan ' + hasilY.dilewati + ' (anti-rekursi; verifikasi penuh hanya di kedalaman 1)');
          selftestAktif = flagLuarY;
          lewatiDeteksiUrlSelftest = lewatiLuarY;
          try {
            Object.keys(db).forEach(function (k) { delete db[k]; });
            Object.keys(snapDbY).forEach(function (k) { db[k] = snapDbY[k]; });
            save('Self-test Y-N3: kembalikan snapshot');
          } catch (e) { /* abaikan */ }
          try { setQueue(snapQueueY); } catch (e) { /* abaikan */ }
          return;
        }
        var markerY = db.santri.some(function (s) { return s.nis === '888001'; });
        var loginAsliY = false, loginUjiY = false, loginSeedY = false;
        try { loginAsliY = verifikasiLogin('admin', 'SandiAsliKlien9').ok === true; } catch (e) { /* abaikan */ }
        try { loginUjiY = verifikasiLogin('admin', 'wirauji123').ok === true; } catch (e) { /* abaikan */ }
        try { loginSeedY = verifikasiLogin('admin', 'admin123').ok === true; } catch (e) { /* abaikan */ }
        var utuhY = siapY && db.santri.length === santriAwalY && db.guru.length === guruAwalY && db.nilai.length === nilaiAwalY && db.keuanganTx.length === keuAwalY &&
          markerY && db.isContoh === false && loginAsliY && !loginUjiY && !loginSeedY;
        catat('Y-N3 selftest langsung di atas data asli: data + pengguna utuh, login sandi asli berhasil', utuhY,
          'siap=' + siapY + ', santri ' + santriAwalY + '->' + db.santri.length + ', marker=' + markerY + ', isContoh=' + db.isContoh +
          ', loginAsli=' + loginAsliY + ', loginUji=' + loginUjiY + ', loginSeed=' + loginSeedY +
          ', nested pass=' + hasilY.pass + '/' + (hasilY.pass + hasilY.fail));
        selftestAktif = flagLuarY;
        lewatiDeteksiUrlSelftest = lewatiLuarY;
        try {
          Object.keys(db).forEach(function (k) { delete db[k]; });
          Object.keys(snapDbY).forEach(function (k) { db[k] = snapDbY[k]; });
          save('Self-test Y-N3: kembalikan snapshot');
        } catch (e) { /* abaikan */ }
        try { setQueue(snapQueueY); } catch (e) { /* abaikan */ }
      });
    });
  }
  /* Regresi S1 (urutan boot): hash seed HARUS dihitung dengan 1000 ronde.
     Dulu tes ini login ke db hasil load() — gagal di profil yang sandi
     adminnya sudah diganti pengguna (15 Nov: profil browser cloud pakai
     admin1234). Itu BUKAN cacat: sandi seed memang harus ditolak kalau
     sudah diganti. Sekarang uji seed SEGAR di memori: seedPengguna()
     dihitung dari HASH_RONDE saat ini, dan login terhadap db seed segar
     harus berhasil — tanpa menyentuh db aktif maupun sesi. */
  (function () {
    var dbSimpan = db;
    var s1ok = false, s1info = '';
    try {
      db = Object.assign({}, db, { pengguna: seedPengguna() });
      s1ok = verifikasiLogin('admin', 'admin123').ok === true && verifikasiLogin('guru1', 'guru123').ok === true;
      s1info = 'seed segar, login admin+guru1';
    } catch (e) { s1ok = false; s1info = 'throw: ' + e.message; }
    db = dbSimpan;
    catat('Login admin+guru1 berhasil terhadap db seed segar (regresi S1 urutan boot)', s1ok, s1info);
  })();
  try {
    jalankan();
  } catch (e) {
    catat('Self-test sinkron (bagian atas) tidak melempar', false, e.message);
  }
  return Promise.resolve().then(function () { return jalankanAsync(); }).then(function () {
    /* Ekor Y-N3 (tambahan v22): resetToSeed() v21 di sini me-reseed TANPA
       cek isContoh — panggilan selftest langsung menghapus data asli dan
       meninggalkan admin dengan sandi uji. Sekarang:
       - data asli (masuk isContoh=false): pulihkan snapshot masuk —
         resetToSeed/bersih TIDAK dipanggil sama sekali.
       - data contoh: bersih() dulu (sesi/antrean/jenjang kembali netral),
         BARU resetToSeed(kredensialAdminAwal) — urutan ini penting:
         resetToSeed me-reseed + memulihkan sandi admin ke keadaan sebelum
         selftest, dan pemulihan itu harus terjadi SETELAH bersih() terakhir
         (bersih() me-reseed lagi dan akan menghapus pemulihan bila
         dipanggil sesudahnya). */
    if (!isContohAwal) {
      pulihkanSnapshotAsli();
    } else {
      bersih();
      resetToSeed(kredensialAdminAwal);
    }
    selftestAktif = flagSelftestLuar;
    kedalamanSelftest = kedalamanLuar;
    return { pass: pass, fail: fail };
  }).catch(function (e) {
    catat('Self-test asinkron (sinkron) tidak melempar', false, e.message);
    try {
      if (!isContohAwal) {
        pulihkanSnapshotAsli();
      } else {
        bersih();
        resetToSeed(kredensialAdminAwal);
      }
    } catch (e2) { /* abaikan */ }
    selftestAktif = flagSelftestLuar;
    kedalamanSelftest = kedalamanLuar;
    return { pass: pass, fail: fail };
  });
}


/* ---------------- Boot ---------------- */
/* UI memanggil initEngine() sekali saat aplikasi dibuka: mengisi jenjang
   dari penyimpanan dan memulai siklus sinkron otomatis. Di v1 semua ini
   terjadi di init() bersama render(); di v2 render adalah urusan UI. */
function initEngine() {
  /* Profil tersimpan mengalahkan default lama 'Semua': default aplikasi
     kini TPQ. setProfilAktif menegakkan 'Semua' hanya untuk Pimpinan
     (simpanan 'Semua' + sesi Guru jatuh ke profil efektif tanpa
     menimpa simpanan). */
  setProfilAktif(bacaProfilTersimpan());
  startSync();
  return true;
}

/* Ekspor untuk Node (dipakai self-test lewat node dan alat uji lain).
   Di browser blok ini tidak jalan (module tidak ada). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    db: db, ui: ui, seedData: seedData, emptyData: emptyData, load: load, save: save,
    resetToSeed: resetToSeed, clearAllData: clearAllData, todayStr: todayStr, uid: uid,
    setModeSelftest: setModeSelftest, bolehSelftest: bolehSelftest, tandaiDataAsli: tandaiDataAsli,
    rupiah: rupiah, bacaRupiah: bacaRupiah, esc: esc, fmtTanggal: fmtTanggal, tglValid: tglValid, fotoAman: fotoAman,
    santriById: santriById, guruById: guruById, kelasById: kelasById,
    santriAktif: santriAktif, rekapGender: rekapGender, normalisasiJk: normalisasiJk, labelJk: labelJk, saldoKas: saldoKas, totalTabungan: totalTabungan,
    rataKehadiran: rataKehadiran, predikat: predikat, naikJilid: naikJilid,
    hitungRapor: hitungRapor, hitungKehadiranDariPertemuan: hitungKehadiranDariPertemuan,
    realisasiPos: realisasiPos, getJenjang: getJenjang, setJenjang: setJenjang,
    jenjangCocok: jenjangCocok, guruCocokJenjang: guruCocokJenjang, kelasJenjang: kelasJenjang,
    migrasiIdentitas: migrasiIdentitas, identitasUntuk: identitasUntuk,
    simpanIdentitas: simpanIdentitas, getProfilAktif: getProfilAktif,
    setProfilAktif: setProfilAktif, PROFIL_KEY: PROFIL_KEY,
    parseCSV: parseCSV, toCSV: toCSV, csvEscape: csvEscape, importRows: importRows,
    exportSantriCSV: exportSantriCSV, exportGuruCSV: exportGuruCSV,
    exportNilaiCSV: exportNilaiCSV, exportAbsensiCSV: exportAbsensiCSV,
    exportKeuanganCSV: exportKeuanganCSV, exportRaporCSV: exportRaporCSV,
    downloadTemplate: downloadTemplate, backupJSON: backupJSON,
    applyBackupData: applyBackupData, restoreFromText: restoreFromText,
    importCsvText: importCsvText, getQueue: getQueue, setQueue: setQueue,
    enqueueChange: enqueueChange, getSheetCfg: getSheetCfg, setSheetCfg: setSheetCfg,
    antreanPernahDipotong: antreanPernahDipotong,
    cekUrlAppsScript: cekUrlAppsScript, isOnline: isOnline, syncState: syncState,
    flushSync: flushSync, dbUntukSinkron: dbUntukSinkron, decidePull: decidePull, pullFromAppsScript: pullFromAppsScript,
    applyPulledData: applyPulledData, pullCsvFromSheet: pullCsvFromSheet,
    extractSheetId: extractSheetId, saveSheetConfig: saveSheetConfig,
    sendToAppsScriptNow: sendToAppsScriptNow, startSync: startSync, stopSync: stopSync,
    simpanSantri: simpanSantri, ubahStatusSantri: ubahStatusSantri, hapusSantri: hapusSantri,
    catatTabungan: catatTabungan, tambahTarget: tambahTarget,
    simpanKeuangan: simpanKeuangan, hapusKeuangan: hapusKeuangan, ubahKeuangan: ubahKeuangan, toggleSpp: toggleSpp,
    simpanRapbm: simpanRapbm, hapusRapbm: hapusRapbm, simpanBiaya: simpanBiaya, hapusBiaya: hapusBiaya,
    tambahKelas: tambahKelas, simpanPertemuan: simpanPertemuan, naikJilidSantri: naikJilidSantri,
    catatHafalan: catatHafalan, simpanGuru: simpanGuru, toggleHonor: toggleHonor, hapusGuru: hapusGuru,
    tambahPengumuman: tambahPengumuman, togglePengumuman: togglePengumuman, hapusPengumuman: hapusPengumuman,
    simpanNilai: simpanNilai, ubahNilai: ubahNilai, hapusNilai: hapusNilai,
    simpanAlokasi: simpanAlokasi, hapusAlokasi: hapusAlokasi,
    simpanJadwal: simpanJadwal, hapusJadwal: hapusJadwal,
    tambahPiket: tambahPiket, hapusPiket: hapusPiket,
    simpanAbsensiGuru: simpanAbsensiGuru, riwayatAbsensiGuru: riwayatAbsensiGuru,
    simpanSettings: simpanSettings, santriTampil: santriTampil, guruTampil: guruTampil,
    nilaiExportRows: nilaiExportRows, tabunganRiwayat: tabunganRiwayat,
    hafalanLogTampil: hafalanLogTampil, arusKasPerBulan: arusKasPerBulan,
    namaBulanPanjang: namaBulanPanjang, arusKasMingguan: arusKasMingguan,
    piketTampil: piketTampil, filterSantriList: filterSantriList,
    santriPickerItems: santriPickerItems, guruPickerItems: guruPickerItems,
    filterPickerItems: filterPickerItems, openSantriPicker: openSantriPicker,
    openGuruPicker: openGuruPicker, strukTabungan: strukTabungan,
    teksRapor: teksRapor, pengingatSPP: pengingatSPP, csvTextFor: csvTextFor,
    semesterById: semesterById, nilaiDalamSemester: nilaiDalamSemester,
    initEngine: initEngine, runEngineSelfTests: runEngineSelfTests,
    sha256Hex: sha256Hex, buatSalt: buatSalt, hashSandi: hashSandi,
    seedPengguna: seedPengguna, cariPengguna: cariPengguna,
    daftarPengguna: daftarPengguna,
    verifikasiLogin: verifikasiLogin, masukPengguna: masukPengguna,
    sesiAktif: sesiAktif, keluarPengguna: keluarPengguna,
    tambahPengguna: tambahPengguna, resetSandiPengguna: resetSandiPengguna,
    hapusPengguna: hapusPengguna, gantiSandiSendiri: gantiSandiSendiri,
    gantiSandiPaksa: gantiSandiPaksa,
    GURU_ROUTES: GURU_ROUTES, GURU_TABS: GURU_TABS, bolehAkses: bolehAkses,
    SESI_KEY: SESI_KEY, SESI_MASA_BERLAKU_MS: SESI_MASA_BERLAKU_MS
  };
}
