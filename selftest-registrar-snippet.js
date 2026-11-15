/* ============================================================================
   selftest-registrar-snippet.js — UJI REGISTRAR TAMBAHAN untuk runUiSelfTest()
   di app.js (BLOK R).
   Penulis: Wira (keamanan + QA) — 15 Nov 2026, rebuild tampilan Registrar
   (design system uiCookies) + nav bawah gaya iOS mengambang blur (Kirana).
   STATUS: BELUM disisipkan — ditulis sebagai file terpisah dulu supaya tidak
   bentrok dengan Kirana yang masih bekerja di app.js. Disisipkan SETELAH
   KIRANA-DONE.md ada, mengikuti pola BLOK A/B (selftest-auth-snippet.js).

   CARA MENYISIPKAN (satu blok, di dalam fungsi ujiUi() di runUiSelfTest):
   - BLOK R: SETELAH blok visibilitas tab bar ("Kartu profil + Menu
     Informasi terlihat (dilewati di jsdom, tanpa layout)"), SEBELUM komentar
     "Hasil Belajar (mockup v3 layar 3)".
     Alasan: saat itu mode masih 'mobile' (setMode('mobile') di awal ujiUi),
     sesi admin aktif, dan `adaLayoutTab` sudah dideklarasikan (var,
     function-scoped) sehingga cabang lewati-uji-geometri di jsdom bisa
     dipakai. Blok mengembalikan rute ke dashboard di akhir.

   ISI TES (7 tes):
   - R1 (a) nav bawah punya tepat 5 tab (Pimpinan, mode mobile), tiap tab
     berikon + berlabel.
   - R2 (b) nav bawah gaya iOS mengambang — LAPISAN ATURAN CSS: cari aturan
     #bottomnav/.bottomnav di document.styleSheets; wajib position: fixed,
     border-radius 24–28px, latar tembus pandang (rgba alpha < 1), dan
     backdrop-filter blur.
   - R3 (b) nav bawah gaya iOS mengambang — LAPISAN COMPUTED STYLE (hanya
     bila ada layout, i.e. browser sungguhan): getComputedStyle yang sama.
   - R4 (c) kartu-bertumpuk label-nilai ada di layar daftar santri mobile:
     pola .table-stack (td[data-label]) ATAU kartu kv, >= 2 label-nilai
     per kartu/tabel (bukan satu baris meta "NIS | Kelas").
   - R5 (d) token Registrar terpasang — LAPISAN ATURAN CSS: token teal
     --rg-primary #0e5e61 / --rg-focus #1f8589 / #2b8d8f (atau aksen amber
     --rg-accent #e3a52b) ada di stylesheet.
   - R6 (d) PWA tetap offline: tidak ada stylesheet/script eksternal (nol
     CDN Google Fonts) di index.html; semua stylesheet href lokal. Tes ini
     NYATA di jsdom (DOM index.html memang dimuat harness).
   - R7 (b) nav bawah tidak menutupi konten — GEOMETRI, hanya browser:
     tinggi nav + padding bawah #view cukup sehingga kartu terakhir tidak
     tertutup nav.

   BATAS jsdom (harness TIDAK memuat stylesheet eksternal — hanya
   index.html + engine.js + app.js yang di-inject; index.html tidak punya
   <style> inline):
   - document.styleSheets KOSONG di jsdom, jadi R2 dan R5 TIDAK BISA
     membuktikan apa pun di jsdom: keduanya lolos sebagai "dilewati di
     jsdom" (pola yang sama dengan tes geometri lama) dan VERIFIKASI
     NYATANYA adalah (1) grep statis styles.css oleh Wira dan (2) browser
     live 390px oleh Tara/parent (tes-hp.html). Jangan pernah membaca
     R2/R5 hijau di jsdom sebagai bukti gaya sudah benar.
   - R3 dan R7 butuh layout (adaLayoutTab) — di jsdom dilewati, di browser
     jalan penuh.
   - R1, R4, R6 adalah DOM murni dan NYATA di jsdom.

   KONTRAK PENAMAAN (dari DESIGN-TOKENS.md Kirana, 15 Nov ~08:11 WIB —
   dibaca Wira sebelum penyisipan; bila Kirana mengubahnya lagi, perbarui
   daftar di bawah SEBELUM penyisipan, jangan melonggarkan tes):
   - Kartu-bertumpuk label-nilai = pola Registrar `.table-stack` (p.5):
     `<table class="table-stack">` + `data-label="Nama Kolom"` di tiap
     `<td>` (label tampil lewat `::before { content: attr(data-label) }`),
     `.cell-main` di sel judul, `.cell-actions` di sel aksi. Varian kartu
     (bila Kirana memakai kartu, bukan tabel): baris `.kv-row` /
     `.field-row` / `.label-nilai` / `.kv`, label `.kv-label` /
     `.field-label` / `dt`, nilai `.kv-value` / `.field-value` / `dd`.
     Tes R4 menerima KEDUA bentuk — yang ditolak hanya 'tidak ada
     keduanya'.
   - Token teal Registrar: `--rg-primary: #0e5e61` (teal gelap),
     `--rg-focus: #1f8589`, viz-bar `#2b8d8f`, aksen amber
     `--rg-accent: #e3a52b`. Token lama dipetakan ulang: `--blue: #0e5e61`,
     `--blue2: #0a4b4e`, `--bg: #f2f5f6`, `--ink: #15222b`.
     (Bukan teal Tailwind #0d9488/#14b8a6 — itu draf awal yang salah.)
   - Font: Figtree variable SATU file `fonts/Figtree.woff2` (20 KB, subset
     latin, wght 300-900) — diunduh dari fonts.gstatic.com SEKALI saat
     build, BUKAN CDN saat runtime. APP_SHELL di sw.js WAJIB mencantumkan
     `fonts/Figtree.woff2` (dicek statis Wira, bukan oleh selftest jsdom).
   - Radius mengambang nav bawah: 24-28px (angka atau var(--r-*) penanda
     radius; nilai var diverifikasi statis + computed style browser).
     Nav iOS mengambang BUKAN gaya Registrar (DESIGN-TOKENS p.6) — tetap
     dipertahankan sesuai arahan.

   KEAMANAN SNIPPET INI SENDIRI:
   - Hanya membaca DOM/CSS dan berpindah rute; tidak mengubah data, akun,
     atau sandi apa pun. Tidak ada mutasi db.
   ========================================================================== */

/* ================= BLOK R — sisipkan SETELAH blok visibilitas tab bar,
   SEBELUM komentar "Hasil Belajar (mockup v3 layar 3)." ================= */

      /* ---- REGISTRAR (BLOK R, Wira): nav bawah iOS mengambang, kartu
         label-nilai, token Registrar, tanpa CDN ---- */
      /* Helper: kumpulkan semua teks aturan CSS yang bisa diakses. Di jsdom
         harness tidak memuat stylesheet eksternal, jadi hasilnya kosong —
         itu BUKAN kegagalan, melainkan kondisi lewati (lihat header). */
      function regCssText() {
        var teks = '';
        try {
          var sheets = document.styleSheets;
          for (var si = 0; si < sheets.length; si++) {
            var rules = null;
            try { rules = sheets[si].cssRules; } catch (e) { rules = null; }
            if (!rules) continue;
            for (var ri = 0; ri < rules.length; ri++) {
              try { teks += rules[ri].cssText + '\n'; } catch (e) {}
            }
          }
        } catch (e) {}
        return teks;
      }
      function regAturanNav(css) {
        /* Kembalikan teks gabungan aturan yang selektornya menyentuh nav
           bawah (#bottomnav atau .bottomnav), atau '' bila tidak ada. */
        var out = '';
        try {
          var sheets = document.styleSheets;
          for (var si = 0; si < sheets.length; si++) {
            var rules = null;
            try { rules = sheets[si].cssRules; } catch (e) { rules = null; }
            if (!rules) continue;
            for (var ri = 0; ri < rules.length; ri++) {
              var r = rules[ri];
              var sel = '';
              try { sel = r.selectorText || ''; } catch (e) {}
              if (/(^|[^\w-])(#bottomnav|\.bottomnav)([^\w-]|$)/.test(sel)) {
                try { out += r.cssText + '\n'; } catch (e) {}
              }
            }
          }
        } catch (e) {}
        return out;
      }
      function regRadiusOk(nilai) {
        /* Terima angka 24–28px, atau var(--r-*) penanda radius (nilainya
           diverifikasi statis + computed style di browser). */
        if (!nilai) return false;
        var m = String(nilai).match(/(\d+(?:\.\d+)?)\s*px/);
        if (m) { var n = parseFloat(m[1]); return n >= 24 && n <= 28; }
        return /var\(\s*--r-[a-z-]*\s*\)/.test(String(nilai));
      }
      function regAlphaKurangDariSatu(nilai) {
        /* rgba(..., a<1), rgb(... / a<1), color-mix, atau 'transparent'. */
        if (!nilai) return false;
        var s = String(nilai).replace(/\s+/g, '');
        if (/transparent|color-mix\(/.test(s)) return true;
        var m = s.match(/rgba?\(([^)]+)\)/);
        if (m) {
          var bag = m[1].split(/[,/]/);
          if (bag.length >= 4) { var a = parseFloat(bag[3]); return !isNaN(a) && a < 1; }
        }
        return false;
      }

      /* Pastikan keadaan: Pimpinan, mode mobile, di dashboard. */
      setMode('mobile');
      go('dashboard'); render();

      /* R1 (a) Nav bawah tepat 5 tab, tiap tab berikon + berlabel. */
      var regTabs = document.querySelectorAll('#bottomnav .tab-btn');
      var regTabsOk = regTabs.length === 5;
      var regTabDetail = regTabs.length + ' tombol';
      if (regTabsOk) {
        var tanpaIkon = 0, tanpaLabel = 0;
        Array.prototype.forEach.call(regTabs, function (b) {
          if (!b.querySelector('svg')) tanpaIkon++;
          if (!b.textContent.trim()) tanpaLabel++;
        });
        regTabsOk = tanpaIkon === 0 && tanpaLabel === 0;
        regTabDetail = Array.prototype.map.call(regTabs, function (b) { return b.textContent.trim(); }).join(',') +
          (tanpaIkon ? ' | tanpa ikon: ' + tanpaIkon : '') + (tanpaLabel ? ' | tanpa label: ' + tanpaLabel : '');
      }
      t('REGISTRAR nav bawah punya tepat 5 tab berikon + berlabel', regTabsOk, regTabDetail);

      /* R2 (b) Gaya iOS mengambang — lapisan aturan CSS. */
      var regCss = regCssText();
      var regNavCss = regAturanNav(regCss);
      if (!regNavCss) {
        t('REGISTRAR nav bawah gaya iOS mengambang (aturan CSS)', true, 'jsdom: stylesheet eksternal tidak termuat, dicek statis + browser live');
      } else {
        var regB2 = [];
        var regPosOk = /(^|[;{\s])position\s*:\s*fixed\b/.test(regNavCss);
        if (!regPosOk) regB2.push('position bukan fixed');
        var regRadM = regNavCss.match(/border-radius\s*:\s*([^;}]+)/);
        var regRadOk = regRadM && regRadiusOk(regRadM[1]);
        if (!regRadOk) regB2.push('border-radius bukan 24–28px: ' + (regRadM ? regRadM[1] : 'tidak ada'));
        var regBgM = regNavCss.match(/background(?:-color)?\s*:\s*([^;}]+)/);
        var regBgOk = regBgM && regAlphaKurangDariSatu(regBgM[1]);
        if (!regBgOk) regB2.push('latar tidak tembus pandang: ' + (regBgM ? regBgM[1] : 'tidak ada'));
        var regBlurOk = /backdrop-filter\s*:[^;}]*blur\s*\(/.test(regNavCss);
        if (!regBlurOk) regB2.push('backdrop-filter blur tidak ada');
        t('REGISTRAR nav bawah gaya iOS mengambang (aturan CSS)', regB2.length === 0, regB2.length ? regB2.join('; ') : 'fixed + radius 24–28 + tembus pandang + blur');
      }

      /* R3 (b) Gaya iOS mengambang — lapisan computed style (browser saja). */
      if (adaLayoutTab) {
        var regBn = document.getElementById('bottomnav');
        var regCs = null;
        try { regCs = window.getComputedStyle(regBn); } catch (e) { regCs = null; }
        if (regCs) {
          var regC3 = [];
          if (regCs.position !== 'fixed') regC3.push('position=' + regCs.position);
          var regRadC = regCs.borderRadius || regCs.borderTopLeftRadius || '';
          if (!regRadiusOk(regRadC)) regC3.push('border-radius=' + regRadC);
          if (!regAlphaKurangDariSatu(regCs.backgroundColor)) regC3.push('background=' + regCs.backgroundColor);
          var regBf = regCs.backdropFilter || regCs.webkitBackdropFilter || '';
          if (String(regBf).indexOf('blur(') === -1) regC3.push('backdrop-filter=' + regBf);
          t('REGISTRAR nav bawah gaya iOS mengambang (computed style)', regC3.length === 0,
            regC3.length ? regC3.join('; ') : 'fixed, radius ' + regRadC + ', ' + regCs.backgroundColor + ', ' + regBf);
        } else {
          t('REGISTRAR nav bawah gaya iOS mengambang (computed style)', false, 'getComputedStyle tidak tersedia');
        }
      } else {
        t('REGISTRAR nav bawah gaya iOS mengambang (computed style, dilewati di jsdom, tanpa layout)', true, 'jsdom');
      }

      /* R4 (c) Kartu-bertumpuk label-nilai di layar daftar santri mobile.
         Dua bentuk diterima (DESIGN-TOKENS p.5): (1) pola Registrar
         .table-stack — <table class="table-stack"> + td[data-label];
         (2) varian kartu — baris .kv-row/.field-row/.label-nilai dengan
         label + nilai. Yang ditolak hanya 'tidak ada keduanya'. */
      go('santri'); render();
      var regKartu = document.querySelectorAll('#view .card');
      var regKvTerbaik = 0, regKartuKv = 0, regContohKv = '';
      /* Bentuk 1: tabel table-stack dengan sel ber-data-label. */
      var regTabelStack = document.querySelectorAll('#view table.table-stack');
      var regSelLabel = document.querySelectorAll('#view table.table-stack td[data-label]');
      var regBarisStack = 0;
      Array.prototype.forEach.call(regTabelStack, function (tbl) {
        var n = tbl.querySelectorAll('td[data-label]').length;
        if (n > regBarisStack) regBarisStack = n;
      });
      /* Bentuk 2: kartu dengan baris label-nilai. */
      Array.prototype.forEach.call(regKartu, function (kartu) {
        var baris = kartu.querySelectorAll('.kv-row, .field-row, .label-nilai, .kv, [class*="info-row"], dl, dl > div, [class*="stack"]');
        var hitung = 0;
        Array.prototype.forEach.call(baris, function (b) {
          var adaLabel = !!b.querySelector('.kv-label, .field-label, dt, .row-label, .lbl') ||
            /kv-label|field-label|row-label/.test(b.className || '');
          var adaNilai = !!b.querySelector('.kv-value, .field-value, dd, .row-value, .val') ||
            /kv-value|field-value|row-value/.test(b.className || '');
          /* Terima juga baris dl/dt/dd generik dan baris dua-anak
             (label + nilai) selama kelasnya menandai baris info. */
          if ((adaLabel && adaNilai) || b.tagName === 'DL' || b.tagName === 'DT') hitung++;
          else if (/kv|field-row|label-nilai|info-row/.test(b.className || '') && b.children.length >= 2) hitung++;
        });
        if (hitung > regKvTerbaik) { regKvTerbaik = hitung; regContohKv = (kartu.textContent || '').slice(0, 60); }
        if (hitung >= 2) regKartuKv++;
      });
      var regR4Ok = (regTabelStack.length >= 1 && regSelLabel.length >= 2) || regKartuKv >= 1;
      t('REGISTRAR daftar santri mobile memakai label-nilai bertumpuk (table-stack data-label atau kartu kv, >=2/kartu)',
        regR4Ok, 'table-stack: ' + regTabelStack.length + ' tabel, ' + regSelLabel.length +
        ' td[data-label] (terbaik ' + regBarisStack + '/tabel); kartu kv: ' + regKartuKv +
        ' kartu, terbaik ' + regKvTerbaik + ' baris' + (regContohKv ? ' (' + regContohKv + '…)' : ''));
      /* Minimal santri: kartu tetap memuat nama + NIS/kelas (bukan kartu kosong). */
      var regViewTeks = document.getElementById('view').textContent || '';
      t('REGISTRAR daftar santri mobile tetap memuat nama + NIS santri',
        regViewTeks.indexOf('Ahmad Fauzi') !== -1 && regViewTeks.indexOf('NIS') !== -1,
        regKartu.length + ' kartu di #view');

      /* R5 (d) Token Registrar terpasang — lapisan aturan CSS. */
      if (!regCss) {
        t('REGISTRAR token aksen teal terpasang', true, 'jsdom: stylesheet eksternal tidak termuat, dicek statis + browser live');
      } else {
        var regTealOk = /--rg-primary\s*:\s*#0e5e61|--rg-focus\s*:\s*#1f8589|--rg-accent\s*:\s*#e3a52b|#0e5e61|#1f8589|#2b8d8f/i.test(regCss);
        t('REGISTRAR token aksen teal terpasang', regTealOk, regTealOk ? 'token teal ditemukan di stylesheet' : 'tidak ada token teal di stylesheet');
      }

      /* R6 (d) PWA tetap offline: nol stylesheet/script eksternal (CDN). */
      var regEksternal = [];
      Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) {
        var h = l.getAttribute('href') || '';
        if (/^https?:\/\//i.test(h)) regEksternal.push('css:' + h);
      });
      Array.prototype.forEach.call(document.querySelectorAll('script[src]'), function (s) {
        var h = s.getAttribute('src') || '';
        if (/^https?:\/\//i.test(h)) regEksternal.push('js:' + h);
      });
      var regCdnFont = !!document.querySelector('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]');
      if (regCdnFont) regEksternal.push('google-fonts-cdn');
      t('REGISTRAR tanpa CDN eksternal (font lokal, PWA offline)', regEksternal.length === 0,
        regEksternal.length ? regEksternal.join(', ') : 'semua stylesheet/script lokal');

      /* R7 (b) Nav bawah tidak menutupi konten — geometri, browser saja. */
      if (adaLayoutTab) {
        var regBnR = document.getElementById('bottomnav').getBoundingClientRect();
        var regViewR = document.getElementById('view').getBoundingClientRect();
        var regPb = 0;
        try { regPb = parseFloat(window.getComputedStyle(document.getElementById('view')).paddingBottom) || 0; } catch (e) {}
        var regNavTinggi = regBnR.height || 0;
        t('REGISTRAR nav bawah tidak menutupi konten (#view punya ruang bawah)',
          regNavTinggi === 0 || regPb >= regNavTinggi - 1 || regViewR.bottom <= window.innerHeight,
          'nav ' + Math.round(regNavTinggi) + 'px, padding-bawah #view ' + Math.round(regPb) + 'px');
      } else {
        t('REGISTRAR nav bawah tidak menutupi konten (dilewati di jsdom, tanpa layout)', true, 'jsdom');
      }

      /* Kembalikan ke dashboard; tes setelah blok ini (Hasil Belajar dst.)
         memanggil go() sendiri, tapi keadaan bersih lebih aman. */
      go('dashboard'); render();

/* ================= CATATAN AKHIR BLOK R =================
   - R2/R5 hijau di jsdom = DILEWATI, bukan lolos. Bukti gaya yang sah:
     (1) grep statis styles.css/mockup.css oleh Wira, (2) browser live
     390px (tes-hp.html) oleh Tara/parent — keduanya WAJIB dicatat di
     laporan akhir sebagai terpisah dari angka jsdom.
   - Bila Kirana mengubah nama kelas baris label-nilai atau nama token,
     perbarui daftar selektor/regex di atas SEBELUM penyisipan; jangan
     pernah melonggarkan tes (mis. menerima 0 baris) supaya angka hijau.
   ========================================================================== */
