/* ============================================================================
   selftest-auth-snippet.js — UJI AUTH TAMBAHAN untuk runUiSelfTest() di app.js
   Penulis: Wira (keamanan + QA) — FASE 1, 15 Nov 2026 (diperbarui setelah
   Baskara + Kirana mendaratkan auth, ~11:35 WIB).
   STATUS: SUDAH disisipkan ke app.js pada FASE 2 (15 Nov 2026, oleh Wira
   lewat tools/jsdom-test/insert_auth_snippet.py). BLOK A di paling awal
   ujiUi() sebelum komentar Kirana; BLOK B setelah tes "Keluar guru
   menampilkan layar login", sebelum "Kembalikan ke keadaan awal."
   Berkas ini dipertahankan sebagai sumber kebenaran snippet; isi yang
   tersisip di app.js sama persis (byte-identik, diverifikasi).
   Perubahan Wira saat penyisipan (bukan oleh Baskara): perbaikan uji XSS
   (dicek via chip sidebar + daftar pengguna, karena Guru ditolak masuk
   Pengaturan — versi lama salah mengecek #view sebagai Guru) dan
   pembaruan komentar tentang daftarPengguna() yang kini sudah ada.

   HUBUNGAN DENGAN TES YANG SUDAH ADA (Kirana, di ujiUi):
   Kirana SUDAH menulis tes auth di ujiUi: layar login tanpa sesi, shell
   dikosongkan, login salah, login admin + ganti sandi paksa (pendek /
   tidak cocok / berhasil), alur Guru (tab bar, tile, redirect Keuangan +
   Pengaturan, sidebar 7, chip pengguna, Lainnya), kembalikan sandi guru1,
   keluar. Snippet ini MELENGKAPI, bukan menduplikasi:
   - (a) login salah LEWAT MESIN (masukPengguna langsung, ID tidak ada +
     sandi salah) + sesi yang ada tidak rusak;
   - (b) login guru1 LEWAT MESIN; (c) sesi bertahan + isi mentah
     localStorage (kedaluwarsa 7 hari);
   - (d) keluar menghapus kunci sesi;
   - (e) Guru ditolak untuk Tabungan + RAPBM juga (Kirana baru Keuangan +
     Pengaturan), plus cek engine bolehAkses/GURU_ROUTES/GURU_TABS dan
     menu terlarang TIDAK ADA di DOM;
   - (f) Pimpinan tambah pengguna + reset sandi (BELUM dites siapa pun);
   - (g) ganti sandi paksa untuk akun SEMENTARA lewat gate render()
     (Kirana mengetesnya untuk admin lewat form; ini mengetesnya untuk
     akun lain + penolakan sandi lama);
   - (h) TIDAK ADA bypass lewat ?selftest=1 + login programatik lewat
     masukPengguna (fungsi yang sama dengan form);
   - (i) visibilitas NYATA form login (tinggi > 0);
   - bonus: hapus diri + Pimpinan terakhir LEWAT MESIN, XSS nama pengguna,
     dan PERBAIKAN S10: kembalikan sandi admin ke 'admin123' di akhir
     (tes Kirana meninggalkannya 'sandiuji9'!).

   CARA MENYISIPKAN (dua blok, di dalam fungsi ujiUi() di runUiSelfTest):
   - BLOK A: di PALING AWAL ujiUi(), SEBELUM blok komentar Kirana
     "Gerbang login + peran (Kirana, ronde siap produksi)."
     Alasan: BLOK A membuktikan tidak ada bypass SEBELUM tes apa pun, lalu
     login programatik sebagai admin. Blok Kirana setelahnya tetap jalan
     (ia memanggil keluar() dulu, lalu login lewat form).
   - BLOK B: SETELAH tes Kirana "Keluar guru menampilkan layar login"
     (tes terakhir alur Guru), dan SEBELUM blok komentar
     "Kembalikan ke keadaan awal."
     Alasan: BLOK B memakai akun sementara + keluar/masuk berulang kali;
     ia harus jalan setelah semua tes UI lama + alur Guru selesai, dan
     sebelum keadaan dikembalikan. Cleanup BLOK B mengembalikan sandi
     admin (perbaikan S10) lalu keluar.

   DEPENDENSI ANTAR BLOK: BLOK A mendeklarasikan `var authUji = {...}`
   (state bersama). BLOK B membaca `authUji`. Jangan sisipkan BLOK B
   tanpa BLOK A. BLOK B juga memakai `adaLayoutTab` (dideklarasikan di
   bagian tab bar, sebelum BLOK B) untuk pola lewati-uji-geometri di jsdom.

   FAKTA TERVERIFIKASI TENTANG API (dibaca dari engine.js/app.js final,
   bukan asumsi — sesuaikan HANYA bila Baskara/Kirana mengubahnya lagi):
   1. Semua fungsi auth SYNCHRON (SHA-256 murni JS). Tidak perlu varian async.
   2. `masukPengguna(id, sandi)` → `{ ok:true, pengguna, wajibGantiSandi }`
      atau `{ ok:false, error:'login-gagal', alasan:'ID atau kata sandi salah' }`.
      PENTING: sandi benar + `wajibGantiSandi=true` TETAP membuat sesi
      (ok:true); gate ganti sandi ada di render(), bukan di login.
   3. `tambahPengguna(input)` memakai OBJEK: `{ id, nama, peran, sandi, olehId }`
      (sandi min 6, wajibGantiSandi=true, salt acak; `olehId` WAJIB Pimpinan).
   4. `resetSandiPengguna(id, sandiBaru, olehId)` → sandi baru min 6 +
      `wajibGantiSandi=true` lagi; `olehId` WAJIB Pimpinan. Inilah cara
      mengembalikan akun seed.
   5. `hapusPengguna(id, idPeminta)` → tolak hapus diri + Pimpinan terakhir,
      DAN tolak bila peminta bukan Pimpinan (S9, hardening Baskara).
   6. `gantiSandiSendiri(id, lama, baru)` → cek sandi lama, min 6, flag bersih.
   7. `sesiAktif()` → `{ id, nama, peran }` atau null; kedaluwarsa 7 hari
      (`SESI_MASA_BERLAKU_MS`); sesi mentah di localStorage kunci
      'tpq-madin-pwa-sesi' berisi field `kedaluwarsa` + `masukPada`.
   8. Layar login: `#auth-root .auth-screen` + `#login-form` (submitLogin).
      Layar ganti sandi: form TANPA id di dalam `#auth-root .auth-screen`,
      field `#ganti-baru` / `#ganti-ulang` / `#ganti-error`.
   9. Rute terlarang untuk Guru: render() → toast 'Tidak ada akses' +
      kembali ke dashboard + hash '#/dashboard'.
   10. Sandi admin SAAT BLOK B berjalan adalah 'sandiuji9' (blok Kirana
      mengubahnya dari 'admin123' dan tidak mengembalikan). BLOK B memakai
      daftar coba ['admin123', 'sandiuji9'] supaya tetap jalan bila
      Kirana mengubah sandi ujinya; cleanup mengembalikannya ke 'admin123'.
   11. `daftarPengguna()` kini ADA di engine (Baskara, hardening): daftar
      pengguna UI menampilkan semua akun (bukan hanya admin+guru1).
      Uji XSS tetap memakai kartu "Akun saya" (nama pengguna sesi tampil
      di Pengaturan) untuk jalur pertama, DITAMBAH cek baris daftar
      pengguna sebagai Pimpinan untuk jalur kedua.

   KEAMANAN SNIPPET INI SENDIRI:
   - Semua perubahan sandi hanya pada akun SEMENTARA 'ujites'/'ujixss',
     KECUALI pemulihan admin di cleanup (kembali ke seed 'admin123').
   - Bila `db.isContoh` false (data ASLI), tes-tes yang mengubah akun
     DILEWATI (t(... , true, 'data-asli')) supaya selftest tidak pernah
     mengutak-atik kredensial asli.
   - Login selftest HANYA lewat `masukPengguna` (fungsi yang sama dengan
     form login). Tidak ada pemalsuan sesi, flag, atau pemanggilan
     render() yang melewati login.

   POLA YANG DIIKUTI: fungsi `t(nama, ok, detail)` yang sudah ada, dan
   pola lewati-uji-geometri-di-jsdom lewat `adaLayoutTab` yang sudah ada.
   ========================================================================== */

/* ================= BLOK A — sisipkan di PALING AWAL ujiUi() =================
   Anchor: SEBELUM komentar "Gerbang login + peran (Kirana, ronde siap
   produksi)." */

      /* ---- AUTH (BLOK A, Wira): tidak ada bypass; login programatik ---- */
      /* State bersama BLOK A/B: sandi sementara bila suatu saat terpakai. */
      var authUji = { adminDiubah: false, guruDiubah: false, sandiTempAdmin: '', sandiTempGuru: '' };
      var dataContohAuth = false;
      try { dataContohAuth = !!db.isContoh; } catch (e) { dataContohAuth = false; }

      /* Helper: elemen layar login / ganti sandi (id dari Kirana). */
      function adaLayarLogin() {
        return document.querySelector('#auth-root .auth-screen #login-form') ||
          document.getElementById('login-form');
      }
      function adaLayarGantiSandi() {
        /* Form ganti sandi tidak punya id sendiri; field-nya yang dicari. */
        return document.getElementById('ganti-baru') ||
          document.getElementById('ganti-sandi-form');
      }
      /* Helper: masuk sebagai id tertentu. Bentuk yang dipakai engine:
         sandi benar SELALU membuat sesi (ok:true), walau wajibGantiSandi.
         Bila suatu saat engine menahan sesi sampai ganti sandi, helper ini
         mencoba jalur ganti-ke-sandi-sementara lalu masuk lagi; catat
         supaya BLOK B mengembalikannya. Kembalikan true bila sesi aktif
         untuk id itu. */
      function masukSebagai(id, sandiAwal) {
        var sandiTemp = 'UjiSementara123';
        var r = null;
        try { r = masukPengguna(id, sandiAwal); } catch (e) { return false; }
        var sesi = null;
        try { sesi = sesiAktif(); } catch (e) { sesi = null; }
        if (sesi && sesi.id === id) return true;
        /* Jalur cadangan (tidak terpakai di engine saat ini): sandi benar
           tapi sesi belum ada karena wajib ganti sandi. */
        var wajib = !!(r && (r.error === 'wajib-ganti-sandi' || r.wajibGantiSandi));
        if (wajib) {
          var g = null;
          try { g = gantiSandiSendiri(id, sandiAwal, sandiTemp); } catch (e) { g = null; }
          if (g && g.ok) {
            if (id === 'admin') { authUji.adminDiubah = true; authUji.sandiTempAdmin = sandiTemp; }
            if (id === 'guru1') { authUji.guruDiubah = true; authUji.sandiTempGuru = sandiTemp; }
            try { r = masukPengguna(id, sandiTemp); } catch (e) { r = null; }
            try { sesi = sesiAktif(); } catch (e) { sesi = null; }
            return !!(sesi && sesi.id === id);
          }
        }
        return false;
      }
      /* Helper: masuk sebagai admin dengan sandi yang sedang berlaku.
         Blok Kirana mengubah sandi admin 'admin123' -> 'sandiuji9'; daftar
         coba ini membuat BLOK B tahan terhadap keduanya. */
      function masukSebagaiAdmin() {
        var daftar = ['admin123', 'sandiuji9'];
        if (authUji.adminDiubah && authUji.sandiTempAdmin) daftar.unshift(authUji.sandiTempAdmin);
        for (var i = 0; i < daftar.length; i++) {
          if (masukSebagai('admin', daftar[i])) return true;
        }
        return false;
      }

      /* (h) TIDAK ADA bypass lewat ?selftest=1: hapus sesi, render(),
         yang tampil HARUS layar login, bukan dashboard. Ini uji eksplisit
         untuk ?selftest=1: selftest TIDAK boleh melewati login. */
      try { keluarPengguna(); } catch (e) {}
      try { localStorage.removeItem('tpq_onboarded'); } catch (e) {}
      try { tutupOnboarding(); } catch (e) {}
      go('dashboard'); render();
      t('Tanpa sesi (?selftest=1), render() menampilkan layar login, bukan dashboard',
        !!adaLayarLogin() && document.getElementById('view').textContent.indexOf('Selamat datang di,') === -1,
        adaLayarLogin() ? 'layar login tampil' : 'layar login TIDAK ada');
      t('Tanpa sesi, sidebar/tab/view dikosongkan (tidak ada konten modul)',
        document.getElementById('sidebar').innerHTML === '' &&
        document.getElementById('bottomnav').innerHTML === '' &&
        document.getElementById('view').innerHTML === '');

      /* Selftest login secara programatik LEWAT FUNGSI LOGIN YANG SAMA
         (masukPengguna) sebelum menjalankan uji-uji lama. */
      var masukAdmin = masukSebagai('admin', 'admin123');
      t('Selftest login programatik sebagai admin lewat masukPengguna', masukAdmin);
      var sesiAdminAwal = null;
      try { sesiAdminAwal = sesiAktif(); } catch (e) {}
      t('Sesi admin aktif setelah login programatik',
        !!(sesiAdminAwal && sesiAdminAwal.id === 'admin' && sesiAdminAwal.peran === 'Pimpinan'),
        sesiAdminAwal ? sesiAdminAwal.id + '/' + sesiAdminAwal.peran : 'tidak ada sesi');
      /* (c) Sesi tersimpan dan punya kedaluwarsa (kontrak: 7 hari). */
      var sesiMentah = null;
      try { sesiMentah = JSON.parse(localStorage.getItem('tpq-madin-pwa-sesi') || 'null'); } catch (e) { sesiMentah = null; }
      t('Sesi tersimpan di localStorage kunci tpq-madin-pwa-sesi',
        !!(sesiMentah && sesiMentah.id === 'admin'),
        sesiMentah ? 'id=' + sesiMentah.id : 'kunci tidak ada');
      t('Sesi punya kedaluwarsa 7 hari dari masuk',
        !!(sesiMentah && sesiMentah.kedaluwarsa && sesiMentah.masukPada &&
          sesiMentah.kedaluwarsa - sesiMentah.masukPada === 7 * 24 * 60 * 60 * 1000),
        sesiMentah && sesiMentah.kedaluwarsa ? new Date(sesiMentah.kedaluwarsa).toISOString() : 'field kedaluwarsa tidak ada');
      t('Sesi tidak menyimpan hash/sandi',
        !!(sesiMentah && !sesiMentah.hash && !sesiMentah.salt && !sesiMentah.sandi),
        sesiMentah ? Object.keys(sesiMentah).join(',') : 'tidak ada sesi');

/* ================= BLOK B — sisipkan SETELAH tes Kirana "Keluar guru
   menampilkan layar login", SEBELUM blok "Kembalikan ke keadaan awal." ================= */

      /* ---- AUTH (BLOK B, Wira): penolakan, peran, tambah/reset, ganti sandi ---- */
      /* Mulai dari sesi admin (blok Kirana mengubah sandinya jadi 'sandiuji9';
         masukSebagaiAdmin mencoba 'admin123' dulu lalu 'sandiuji9'). */
      try { keluarPengguna(); } catch (e) {}
      var adminMasukB = masukSebagaiAdmin();
      t('BLOK B: masuk kembali sebagai admin (sandi uji Kirana diterima)', adminMasukB);

      /* (a) Login salah ditolak LEWAT MESIN (ID salah + sandi salah); sesi
         yang sudah ada TIDAK boleh rusak oleh percobaan gagal. */
      var gagalSandi = null, gagalId = null;
      try { gagalSandi = masukPengguna('admin', 'sandi-salah-123'); } catch (e) { gagalSandi = { ok: false }; }
      try { gagalId = masukPengguna('akun-tidak-ada', 'admin123'); } catch (e) { gagalId = { ok: false }; }
      t('Login admin dengan sandi salah ditolak (mesin)', !!(gagalSandi && gagalSandi.ok === false),
        gagalSandi && gagalSandi.alasan ? gagalSandi.alasan : '');
      t('Login dengan ID yang tidak ada ditolak (mesin)', !!(gagalId && gagalId.ok === false),
        gagalId && gagalId.alasan ? gagalId.alasan : '');
      t('Alasan gagal login generik (tidak membocorkan mana yang salah)',
        !!(gagalSandi && gagalId && gagalSandi.alasan === gagalId.alasan), 'alasan: ' + (gagalSandi && gagalSandi.alasan));
      var sesiSetelahGagal = null;
      try { sesiSetelahGagal = sesiAktif(); } catch (e) {}
      t('Percobaan login gagal tidak merusak sesi admin yang sudah ada',
        !!(sesiSetelahGagal && sesiSetelahGagal.id === 'admin'),
        sesiSetelahGagal ? sesiSetelahGagal.id : 'sesi hilang');

      /* (b) Login benar masuk sebagai guru1 (admin sudah dibuktikan BLOK A). */
      try { keluarPengguna(); } catch (e) {}
      var masukGuru = masukSebagai('guru1', 'guru123');
      t('Login benar masuk sebagai guru1 (mesin)', masukGuru);
      var sesiGuru = null;
      try { sesiGuru = sesiAktif(); } catch (e) {}
      t('Sesi guru1 berperal Guru', !!(sesiGuru && sesiGuru.id === 'guru1' && sesiGuru.peran === 'Guru'),
        sesiGuru ? sesiGuru.id + '/' + sesiGuru.peran : 'tidak ada sesi');
      /* (c) Sesi bertahan: sesiAktif() mengembalikan pengguna setelah login. */
      t('Sesi bertahan: sesiAktif() mengembalikan guru1 setelah login',
        !!(sesiGuru && sesiGuru.id === 'guru1'));

      /* (e) Guru ditolak masuk Keuangan / Tabungan / RAPBM / Pengaturan.
         Kirana sudah mengetes Keuangan + Pengaturan; di sini Tabungan +
         RAPBM juga, plus cek engine dan menu di DOM. */
      var ruteTerlarangGuru = ['keuangan', 'tabungan', 'rapbm', 'pengaturan'];
      var boleh = null;
      try { boleh = bolehAkses('Guru', 'keuangan'); } catch (e) { boleh = null; }
      t('bolehAkses(Guru, keuangan) = false', boleh === false, String(boleh));
      try { boleh = bolehAkses('Guru', 'tabungan'); } catch (e) { boleh = null; }
      t('bolehAkses(Guru, tabungan) = false', boleh === false, String(boleh));
      try { boleh = bolehAkses('Guru', 'rapbm'); } catch (e) { boleh = null; }
      t('bolehAkses(Guru, rapbm) = false', boleh === false, String(boleh));
      try { boleh = bolehAkses('Pimpinan', 'keuangan'); } catch (e) { boleh = null; }
      t('bolehAkses(Pimpinan, keuangan) = true', boleh === true, String(boleh));
      try { boleh = bolehAkses('Guru', 'dashboard'); } catch (e) { boleh = null; }
      t('bolehAkses(Guru, dashboard) = true', boleh === true, String(boleh));
      var gRoutes = null;
      try { gRoutes = GURU_ROUTES; } catch (e) { gRoutes = null; }
      t('GURU_ROUTES berisi 7 rute dan tidak memuat keuangan/tabungan/rapbm/pengaturan',
        !!(gRoutes && gRoutes.length === 7 && ruteTerlarangGuru.every(function (r) { return gRoutes.indexOf(r) === -1; })),
        gRoutes ? gRoutes.join(',') : 'GURU_ROUTES tidak ada');
      var gTabs = null;
      try { gTabs = GURU_TABS; } catch (e) { gTabs = null; }
      t('GURU_TABS berisi 5 tab dan tidak memuat tabungan/keuangan',
        !!(gTabs && gTabs.length === 5 && gTabs.indexOf('tabungan') === -1 && gTabs.indexOf('keuangan') === -1),
        gTabs ? gTabs.join(',') : 'GURU_TABS tidak ada');
      /* Lewat go(): harus kembali ke dashboard + toast. */
      var tolakGoOk = true, tolakGoDetail = [];
      ruteTerlarangGuru.forEach(function (rute) {
        try { document.getElementById('toast-root').innerHTML = ''; } catch (e) {}
        go(rute); render();
        var kembali = (currentRoute === 'dashboard');
        var adaToast = false;
        try { adaToast = (document.getElementById('toast-root').textContent || '').indexOf('Tidak ada akses') !== -1; } catch (e) {}
        if (!kembali || !adaToast) tolakGoOk = false;
        tolakGoDetail.push(rute + ':' + (kembali ? 'dashboard' : currentRoute) + (adaToast ? '+toast' : '-toast'));
      });
      t('Guru lewat go() ke rute terlarang kembali ke dashboard + toast', tolakGoOk, tolakGoDetail.join(' '));
      /* Lewat menu: tombol/menu terlarang tidak ada di DOM untuk Guru. */
      go('dashboard'); render();
      var sbTeks = '';
      try { sbTeks = document.getElementById('sidebar').textContent || ''; } catch (e) {}
      var menuGuruOk = ['Keuangan', 'Tabungan', 'RAPBM', 'Pengaturan'].every(function (label) { return sbTeks.indexOf(label) === -1; });
      t('Menu terlarang tidak ada di sidebar untuk Guru', menuGuruOk, 'sidebar: ' + sbTeks.slice(0, 80));
      var jmlMenuGuru = 0;
      try { jmlMenuGuru = document.querySelectorAll('#sidebar .nav-item').length; } catch (e) {}
      t('Sidebar Guru berisi 7 menu', jmlMenuGuru === 7, jmlMenuGuru + ' menu');
      var tabTerlarangAda = false;
      try {
        tabTerlarangAda = !!document.querySelector('#bottomnav .tab-btn[data-goto="tabungan"]') ||
          !!document.querySelector('#bottomnav .tab-btn[data-goto="keuangan"]');
      } catch (e) {}
      t('Tab bar Guru tidak punya tombol Tabungan/Keuangan', !tabTerlarangAda);
      /* (i) Menu terlarang tidak terlihat untuk Guru — karena tidak ada di
         DOM (bukan hanya disembunyikan), tidak ada yang bisa terlihat. */
      t('Menu terlarang tidak terlihat untuk Guru (tidak ada di DOM)',
        !document.querySelector('#sidebar .nav-item[onclick*="keuangan"]') &&
        !document.querySelector('#sidebar .nav-item[onclick*="pengaturan"]') &&
        !document.querySelector('#sidebar .nav-item[onclick*="tabungan"]') &&
        !document.querySelector('#sidebar .nav-item[onclick*="rapbm"]'));

      /* Kembali ke admin untuk tes (f) dan (g). */
      try { keluarPengguna(); } catch (e) {}
      masukSebagaiAdmin();

      /* (f) + (g) hanya pada data contoh: jangan utak-atik kredensial asli. */
      if (dataContohAuth) {
        /* (f) Pimpinan bisa tambah pengguna + reset sandi (lalu login
           dengan sandi baru berhasil). Akun sementara 'ujites'.
           tambahPengguna memakai OBJEK { id, nama, peran, sandi, olehId }
           dengan olehId = id Pimpinan peminta (S9). */
        var tambahUji = null;
        try { tambahUji = tambahPengguna({ id: 'ujites', nama: 'Uji Selftest', peran: 'Guru', sandi: 'UjiAwal123', olehId: 'admin' }); } catch (e) { tambahUji = null; }
        t('Pimpinan bisa tambah pengguna ujites', !!(tambahUji && tambahUji.ok !== false),
          tambahUji && tambahUji.error ? tambahUji.error : '');
        var cariUji = null;
        try { cariUji = cariPengguna('ujites'); } catch (e) {}
        t('Pengguna ujites ditemukan setelah ditambah', !!(cariUji && cariUji.id === 'ujites'));
        t('Pengguna baru wajibGantiSandi=true', !!(cariUji && cariUji.wajibGantiSandi === true));
        /* Duplikat case-insensitive ditolak (lihat review S4 — sudah benar). */
        var duplikatUji = null;
        try { duplikatUji = tambahPengguna({ id: 'UJITES', nama: 'Duplikat', peran: 'Guru', sandi: 'Xyz12345', olehId: 'admin' }); } catch (e) { duplikatUji = null; }
        t('Tambah pengguna duplikat case-insensitive (UJITES) ditolak',
          !!(duplikatUji && duplikatUji.ok === false), duplikatUji && duplikatUji.error ? duplikatUji.error : '');
        /* (g) Ganti sandi pertama dipaksa: ujites baru wajib ganti sandi —
           login berhasil (sesi ada) tapi render() menahan di layar ganti
           sandi, bukan dashboard. */
        try { keluarPengguna(); } catch (e) {}
        var masukUji = masukSebagai('ujites', 'UjiAwal123');
        t('Login ujites dengan sandi awal berhasil (akun ada)', masukUji);
        go('dashboard'); render();
        var diLayarGanti = !!adaLayarGantiSandi();
        var diDashboard = document.getElementById('view').textContent.indexOf('Selamat datang di,') !== -1;
        t('Pengguna wajibGantiSandi tidak bisa sampai ke dashboard sebelum ganti sandi',
          diLayarGanti && !diDashboard,
          'layarGanti=' + diLayarGanti + ' dashboard=' + diDashboard);
        var gantiUji = null;
        try { gantiUji = gantiSandiSendiri('ujites', 'UjiAwal123', 'UjiBaru123'); } catch (e) { gantiUji = null; }
        t('Ganti sandi pertama ujites berhasil', !!(gantiUji && gantiUji.ok !== false),
          gantiUji && gantiUji.error ? gantiUji.error : '');
        /* Setelah ganti sandi, flag bersih dan dashboard tampil. */
        try { keluarPengguna(); } catch (e) {}
        masukSebagai('ujites', 'UjiBaru123');
        go('dashboard'); render();
        t('Setelah ganti sandi, ujites sampai ke dashboard',
          document.getElementById('view').textContent.indexOf('Selamat datang di,') !== -1);
        /* Sandi lama sudah tidak berlaku, sandi baru berlaku. */
        try { keluarPengguna(); } catch (e) {}
        var loginLama = null;
        try { loginLama = masukPengguna('ujites', 'UjiAwal123'); } catch (e) { loginLama = { ok: false }; }
        t('Sandi lama ujites ditolak setelah ganti sandi', !!(loginLama && loginLama.ok === false));
        /* Reset sandi oleh Pimpinan, lalu login dengan sandi baru berhasil. */
        masukSebagaiAdmin();
        var resetUji = null;
        try { resetUji = resetSandiPengguna('ujites', 'UjiReset123', 'admin'); } catch (e) { resetUji = null; }
        t('Pimpinan bisa reset sandi ujites', !!(resetUji && resetUji.ok !== false),
          resetUji && resetUji.error ? resetUji.error : '');
        var flagReset = false;
        try { var pReset = cariPengguna('ujites'); flagReset = !!(pReset && pReset.wajibGantiSandi === true); } catch (e) {}
        t('Reset sandi mengaktifkan lagi wajibGantiSandi', flagReset);
        try { keluarPengguna(); } catch (e) {}
        var masukReset = masukSebagai('ujites', 'UjiReset123');
        t('Login ujites dengan sandi hasil reset berhasil', masukReset);
        /* Bonus keamanan (review S5): hapus diri + hapus Pimpinan terakhir. */
        masukSebagaiAdmin();
        var hapusDiri = null;
        try { hapusDiri = hapusPengguna('admin', 'admin'); } catch (e) { hapusDiri = null; }
        t('Hapus diri sendiri (admin menghapus admin) ditolak',
          !!(hapusDiri && hapusDiri.ok === false), hapusDiri && hapusDiri.error ? hapusDiri.error : '');
        var hapusPimpinanTerakhir = null;
        try { hapusPimpinanTerakhir = hapusPengguna('admin', 'ujites'); } catch (e) { hapusPimpinanTerakhir = null; }
        t('Hapus Pimpinan oleh bukan-Pimpinan (ujites Guru) ditolak (S9; penjaga Pimpinan terakhir kini tak terjangkau lewat API publik)',
          !!(hapusPimpinanTerakhir && hapusPimpinanTerakhir.ok === false),
          hapusPimpinanTerakhir && hapusPimpinanTerakhir.error ? hapusPimpinanTerakhir.error : '');
        /* Bonus XSS (review R1): nama berisi tag HTML tampil sebagai teks.
           Dua jalur: (1) chip pengguna di sidebar saat ujixss masuk
           (nama sesi tampil di sana); (2) baris daftar pengguna di
           Pengaturan saat Pimpinan melihatnya (daftarPengguna() kini ada).
           Jalur (2) tidak bisa dites sebagai ujixss sendiri karena Guru
           ditolak masuk Pengaturan oleh penjaga rute — itu sebabnya
           dicek sebagai admin. */
        var tambahXss = null;
        try { tambahXss = tambahPengguna({ id: 'ujixss', nama: '<img src=x onerror=alert(1)>', peran: 'Guru', sandi: 'Xss12345', olehId: 'admin' }); } catch (e) { tambahXss = null; }
        if (tambahXss && tambahXss.ok !== false) {
          try { keluarPengguna(); } catch (e) {}
          masukSebagai('ujixss', 'Xss12345');
          try { gantiSandiSendiri('ujixss', 'Xss12345', 'XssBaru123'); } catch (e) {}
          try { keluarPengguna(); } catch (e) {}
          masukSebagai('ujixss', 'XssBaru123');
          go('dashboard'); render();
          var adaImgSidebar = !!document.querySelector('#sidebar img[src="x"]');
          var adaTeksSidebar = (document.getElementById('sidebar').textContent || '').indexOf('<img') !== -1;
          t('Nama pengguna berisi tag HTML tampil sebagai teks di chip sidebar (tidak dieksekusi)',
            !adaImgSidebar && adaTeksSidebar, 'img[src=x] di sidebar: ' + adaImgSidebar + ', teks <img tampil: ' + adaTeksSidebar);
          masukSebagaiAdmin();
          go('pengaturan'); render();
          var adaImgDaftar = !!document.querySelector('#view img[src="x"]');
          var adaTeksDaftar = document.getElementById('view').textContent.indexOf('<img') !== -1;
          t('Nama pengguna berisi tag HTML tampil sebagai teks di daftar pengguna (tidak dieksekusi)',
            !adaImgDaftar && adaTeksDaftar, 'img[src=x] di #view: ' + adaImgDaftar + ', teks <img tampil: ' + adaTeksDaftar);
          try { hapusPengguna('ujixss', 'admin'); } catch (e) {}
        } else {
          t('Nama pengguna berisi tag HTML ditolak/ditangani saat tambah (boleh)', true, 'tambah ditolak oleh engine');
        }
        /* Bersihkan akun sementara. */
        masukSebagaiAdmin();
        var hapusUji = null;
        try { hapusUji = hapusPengguna('ujites', 'admin'); } catch (e) { hapusUji = null; }
        t('Bersihkan: hapus pengguna ujites', !!(hapusUji && hapusUji.ok !== false),
          hapusUji && hapusUji.error ? hapusUji.error : '');
        var cariUjiHilang = null;
        try { cariUjiHilang = cariPengguna('ujites'); } catch (e) { cariUjiHilang = null; }
        t('Pengguna ujites sudah tidak ada setelah dihapus', !cariUjiHilang);
      } else {
        t('Tes mutasi akun (tambah/reset/ganti sandi) dilewati: data asli', true, 'data-asli');
      }

      /* (d) Keluar menghapus sesi. */
      masukSebagaiAdmin();
      try { keluarPengguna(); } catch (e) {}
      var sesiSetelahKeluar = 'belum-dicek';
      try { sesiSetelahKeluar = sesiAktif(); } catch (e) { sesiSetelahKeluar = null; }
      t('Keluar menghapus sesi (sesiAktif() null)', sesiSetelahKeluar == null);
      var kunciSesiHilang = false;
      try { kunciSesiHilang = localStorage.getItem('tpq-madin-pwa-sesi') == null; } catch (e) { kunciSesiHilang = false; }
      t('Keluar menghapus kunci sesi di localStorage', kunciSesiHilang);
      go('dashboard'); render();
      t('Setelah keluar, render() kembali menampilkan layar login', !!adaLayarLogin());

      /* (i) Visibilitas NYATA form login saat belum masuk (tinggi > 0).
         Pola yang sama dengan tes visibilitas lama: di jsdom rect 0,
         jadi dilewati. */
      if (adaLayoutTab) {
        var elLogin = adaLayarLogin();
        var rLogin = elLogin ? elLogin.getBoundingClientRect() : null;
        t('Form login terlihat di layar (tinggi > 0) saat belum masuk',
          !!(rLogin && rLogin.height > 0), rLogin ? 'tinggi ' + Math.round(rLogin.height) + 'px' : 'tidak ada');
      } else {
        t('Form login terlihat (dilewati di jsdom, tanpa layout)', true, 'jsdom');
      }

      /* PERBAIKAN S10 — kembalikan sandi admin ke seed. Blok Kirana
         mengubah sandi admin 'admin123' -> 'sandiuji9' dan tidak
         mengembalikannya; tanpa langkah ini, ?selftest=1 di browser live
         meninggalkan admin terkunci dari sandi lamanya. resetSandiPengguna
         sekaligus mengaktifkan lagi wajibGantiSandi=true (keadaan seed).
         Bila BLOK A sempat memakai jalur cadangan (adminDiubah), pulihkan
         juga lewat jalur yang sama. */
      masukSebagaiAdmin();
      var pulihAdmin = null;
      try { pulihAdmin = resetSandiPengguna('admin', 'admin123', 'admin'); } catch (e) { pulihAdmin = null; }
      t('Sandi admin dikembalikan ke admin123 setelah selftest (perbaikan S10)',
        !!(pulihAdmin && pulihAdmin.ok !== false), pulihAdmin && pulihAdmin.error ? pulihAdmin.error : '');
      var adminKembali = null;
      try { adminKembali = cariPengguna('admin'); } catch (e) {}
      t('Flag wajibGantiSandi admin kembali true (keadaan seed)',
        !!(adminKembali && adminKembali.wajibGantiSandi === true));
      if (authUji.guruDiubah) {
        try { resetSandiPengguna('guru1', 'guru123', 'admin'); } catch (e) {}
        t('Sandi guru1 dikembalikan ke guru123 setelah selftest', (function () {
          try { keluarPengguna(); } catch (e) {}
          var r = null;
          try { r = masukPengguna('guru1', 'guru123'); } catch (e) { r = null; }
          var ok = !!(r && r.ok);
          try { keluarPengguna(); } catch (e) {}
          return ok;
        })(), 'data contoh saja');
      }
      /* Akhiri BLOK B dalam keadaan keluar (login screen). Blok
         "Kembalikan ke keadaan awal." setelah ini tetap jalan; go('dashboard')
         tanpa sesi akan menampilkan layar login — itu perilaku yang benar. */
      try { keluarPengguna(); } catch (e) {}
      go('dashboard'); render();

/* ================= CATATAN AKHIR =================
   - Semua fungsi auth SYNCHRON (SHA-256 murni JS di engine). Tidak ada
     varian async yang diperlukan.
   - `daftarPengguna()` sudah ada di engine; uji XSS di atas memakai
     daftar itu (jalur kedua) dan chip sidebar (jalur pertama).
   - Uji K1b (muat ulang): flag wajibGantiSandi kini dibaca sesiAktif()
     langsung dari db.pengguna, jadi muat ulang tidak lagi bisa melewati
     layar ganti sandi. Tes muat-ulang-halaman yang sebenarnya tidak bisa
     jalan di jsdom tanpa memuat ulang DOM; tes itu untuk browser live
     oleh koordinator: login sebagai pengguna wajib-ganti-sandi, muat
     ulang sebelum ganti sandi, pastikan tetap di layar ganti sandi.
   ========================================================================== */
