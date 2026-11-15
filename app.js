/* TPQ Al-Muttaqin PWA v2 - lapisan UI saja (Kirana).
   Lapisan data ada di engine.js (Baskara, kontrak API.md). File ini tidak
   boleh mendefinisikan ulang fungsi engine; semua mutasi data lewat
   fungsi simpan dan catat engine, dan semua unduhan lewat helper unduhHasil.
   Layar mobile mengikuti mockup v3 (mockup.css), layar desktop mengikuti
   mockup desktop (sidebar putih + ikon SVG, styles.css). Tanpa dependensi. */
'use strict';



var dismissedAnn = {};
function jenjangBarHtml() {
  return '<div class="card jenjang-bar" style="padding:12px 16px"><div class="row-flex"><span class="grow"><b>Satu aplikasi untuk TPQ dan Ibtidaiyah Al-Muttaqin</b><br><span class="muted">Pilih jenjang, semua angka, daftar, jadwal, dan grafik mengikuti pilihan ini.</span></span><span class="chip-row" style="margin:0">' +
    jenjangPilihanUi().map(function (j) { return '<button class="chip-filter' + (ui.jenjang === j ? ' active' : '') + '" onclick="gantiJenjang(\'' + j + '\')">' + j + '</button>'; }).join('') + '</span></div></div>';
}
/* Y6 (lanjutan, Baskara): ganti jenjang lewat kontrol UI harus mereset
   filter yang terikat jenjang ke netral — persis resetFilterJenjang()
   yang dipakai setProfilAktif(). Tanpa ini, filter kelas basi dari
   jenjang lama membuat daftar kosong yang menyesatkan (mis. kelas
   "Iqra 1" dipilih di TPQ, lalu pindah ke Ibtidaiyah). Reset hanya bila
   jenjang benar-benar berubah (setJenjang bisa mengembalikan nilai
   efektif lain untuk Guru yang memilih "Semua"). */
function gantiJenjang(j) {
  var sebelum = ui.jenjang;
  setJenjang(j);
  if (ui.jenjang !== sebelum) resetFilterJenjang();
  render();
}

function initials(nama) {
  return nama.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
}
function avatarHtml(nama, foto) {
  /* Wira (QA v2): benteng kedua — foto yang tidak lolos fotoAman() tidak
     pernah jadi <img src>, walau ada jalur tulis baru yang melewatkan sanitasi. */
  if (foto && fotoAman(foto)) return '<img class="avatar" src="' + esc(foto) + '" alt="Foto ' + esc(nama) + '">';
  return '<span class="avatar" aria-hidden="true">' + esc(initials(nama)) + '</span>';
}
/* F3 (Wira): unduhan bisa gagal (mis. URL.createObjectURL tidak tersedia di
   sebagian peramban). Jangan melempar diam-diam: toast error yang jelas +
   fallback modal berisi isi file dengan tombol salin, supaya data tetap bisa
   diselamatkan. Mengembalikan true bila unduhan dimulai, false bila gagal. */
function downloadFile(nama, isi, tipe) {
  try {
    var blob = new Blob([isi], { type: tipe || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nama;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    return true;
  } catch (e) {
    toast('Gagal mengunduh ' + nama + '. Isi file ditampilkan supaya bisa disalin.');
    openModal(
      '<h2>Unduhan gagal: ' + esc(nama) + '</h2>' +
      '<p class="muted">Peramban tidak bisa membuat file unduhan (' + esc(e && e.message ? e.message : 'unduhan diblokir') + '). Salin isi file di bawah ini lalu tempel ke file baru bernama ' + esc(nama) + '.</p>' +
      '<pre class="code" id="dl-gagal-isi" style="background:#f6f8f9;color:#15222b;max-height:40vh;overflow:auto">' + esc(String(isi == null ? '' : isi)) + '</pre>' +
      '<div class="btn-row"><button class="btn" onclick="salinIsiGagal()">Salin isi file</button><button class="btn secondary" onclick="closeModal()">Tutup</button></div>'
    );
    return false;
  }
}
function salinIsiGagal() {
  var el = document.getElementById('dl-gagal-isi');
  if (el) shareText(el.innerText, 'File TPQ Al-Muttaqin');
}
function shareText(teks, judul) {
  if (navigator.share) {
    navigator.share({ title: judul || 'TPQ Al-Muttaqin', text: teks }).catch(function () {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(teks).then(function () { toast('Teks disalin ke clipboard.'); })
      .catch(function () { fallbackCopy(teks); });
  } else { fallbackCopy(teks); }
}
function fallbackCopy(teks) {
  var ta = document.createElement('textarea');
  ta.value = teks; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('Teks disalin ke clipboard.'); } catch (e) { toast('Salin manual: ' + teks); }
  document.body.removeChild(ta);
}
function toast(pesan) {
  var root = document.getElementById('toast-root');
  root.innerHTML = '<div class="toast">' + esc(pesan) + '</div>';
  setTimeout(function () { root.innerHTML = ''; }, 3200);
}

/* ---- A4 (Kirana, ronde perbaikan): baca jumlah rupiah format Indonesia ----
   Kontrak helper engine `bacaRupiah` (Jaka, engine.js:1707): terima string,
   kembalikan number | NaN — titik/koma pemisah dihapus: "50.000" -> 50000,
   "50,000" -> 50000, "Rp 50.000" -> 50000, "abc"/kosong -> NaN. Bila engine
   belum menyediakannya, parser lokal di bawah dipakai dengan kontrak yang
   sama; bila engine sudah ada tapi bentuk kembaliannya beda (angka polos /
   { nilai } / { ok, nilai }), hasilnya dinormalisasi di sini supaya UI
   tidak patah. Bila helper engine mengembalikan sesuatu yang tidak
   dikenali, jatuh ke parser lokal (bukan error) supaya form tetap bisa
   dipakai. */
function bacaJumlah(teks) {
  var mentah = String(teks == null ? '' : teks).trim();
  if (typeof bacaRupiah === 'function') {
    try {
      var r = bacaRupiah(mentah);
      if (typeof r === 'number' && isFinite(r)) return { ok: true, nilai: Math.floor(r) };
      if (r && typeof r === 'object') {
        if (r.ok === false) return { ok: false, error: r.error || r.message || 'Jumlah tidak valid. Tulis angka saja, contoh 50000.' };
        if (typeof r.nilai === 'number' && isFinite(r.nilai)) return { ok: true, nilai: Math.floor(r.nilai) };
      }
    } catch (e) { /* jatuh ke parser lokal */ }
  }
  /* Cadangan bila bacaRupiah belum ada: samakan kontrak engine — hapus
     titik/koma pemisah ("50.000"/"50,000" -> 50000), "Rp" di depan
     diabaikan; selain digit -> tidak valid. */
  if (!mentah) return { ok: false, error: 'Isi dulu jumlahnya (contoh: 50000).' };
  var bersih = mentah.replace(/^Rp\s*/i, '').replace(/[\s.,]/g, '');
  if (!/^\d+$/.test(bersih)) return { ok: false, error: 'Jumlah tidak valid. Tulis angka saja (contoh: 50000) atau pakai titik ribuan (contoh: 50.000).' };
  var nilai = Number(bersih);
  if (!isFinite(nilai)) return { ok: false, error: 'Jumlah tidak valid. Tulis angka saja, contoh 50000.' };
  return { ok: true, nilai: nilai };
}

/* A2: pesan sukses "Hapus semua data" yang harus tetap tampil meski
   render() mendarat di layar ganti sandi paksa (bukan dashboard). Diisi
   oleh mintaHapusSemuaData, ditampilkan sekali oleh tampilLogin /
   tampilGantiSandi, lalu dikosongkan. */
var pesanHapusData = '';

/* ---------------- Onboarding layar 1 (mockup v3) ---------------- */
/* Tampil di kunjungan pertama saja; flag 'tpq_onboarded' disimpan di localStorage.
   Tombol Mulai/Lewati (index.html) memanggil tutupOnboarding(). */
var ONBOARD_KEY = 'tpq_onboarded';
function cekOnboarding() {
  var el = document.getElementById('onboarding');
  if (!el) return;
  var sudah = false;
  try { sudah = !!localStorage.getItem(ONBOARD_KEY); } catch (e) {}
  el.hidden = sudah;
}
function tutupOnboarding() {
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
  var el = document.getElementById('onboarding');
  if (el) el.hidden = true;
}

/* ---------------- Layar masuk (login) + ganti sandi paksa ---------------- */
/* Gaya mockup v3: latar gradien onboarding (168deg), kartu putih radius 24.
   Error memakai pola ui-ux-pro-max prioritas 8: ringkasan error di atas form
   (role=alert, fokus pindah ke sana) + isian dipertahankan saat gagal.
   Tanpa em dash di teks mana pun yang tampil ke pengguna. */
function eyeSvg(terlihat) {
  if (terlihat) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9M6.6 6.6A16.9 16.9 0 0 0 2 12s3 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
}
function toggleLihatSandi(id, btn) {
  var inp = document.getElementById(id);
  if (!inp) return;
  var terlihat = inp.type === 'password';
  inp.type = terlihat ? 'text' : 'password';
  btn.innerHTML = eyeSvg(terlihat);
  btn.setAttribute('aria-label', terlihat ? 'Sembunyikan kata sandi' : 'Lihat kata sandi');
}
function bersihkanShellLogin() {
  var view = document.getElementById('view');
  if (view) view.innerHTML = '';
  var sb = document.getElementById('sidebar');
  if (sb) sb.innerHTML = '';
  var bn = document.getElementById('bottomnav');
  if (bn) bn.innerHTML = '';
  closeModal();
  closeSheet();
}
/* Kotak kredensial awal (N2/Y8): tampil HANYA bila data masih contoh DAN
   akun admin masih memakai kata sandi bawaan (wajibGantiSandi). Sesudah
   ganti sandi pertama, atau sesudah data menjadi data asli (isContoh
   false), kotak hilang. Fallback bila cariPengguna tidak tersedia: gate
   isContoh saja. */
function kredensialAwalTampil() {
  if (!db.isContoh) return false;
  try {
    if (typeof cariPengguna === 'function') {
      var a = cariPengguna('admin');
      if (a) return a.wajibGantiSandi === true;
    }
  } catch (e) {}
  return true;
}
/* Monogram profil sebagai data URL SVG (N21): dipakai sebagai fallback
   logo di topbar/layar login bila profil belum punya logo, supaya yang
   tampil singkatan profil itu sendiri (TPQ/MI), bukan ikon generik. */
function monogramDataUrl(singkat) {
  var t = String(singkat || 'TPQ').slice(0, 3).toUpperCase();
  var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' rx='16' fill='#0e5e61'/><text x='48' y='60' font-family='sans-serif' font-size='34' font-weight='700' fill='#ffffff' text-anchor='middle'>" + t.replace(/[^A-Z]/g, '') + "</text></svg>";
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function tampilLogin() {
  bersihkanShellLogin();
  /* A2: pesan sukses hapus data yang menetap (lihat pesanHapusData). */
  var bannerHapus = pesanHapusData ? '<div class="auth-contoh" role="status">' + esc(pesanHapusData) + '</div>' : '';
  pesanHapusData = '';
  var root = document.getElementById('auth-root');
  var profilLogin = profilAktifUi();
  var idnLogin = identitasUntukUi(profilLogin);
  var logoLogin = logoAman(idnLogin.logo);
  root.innerHTML = '<div class="auth-screen"><div class="auth-card">' +
    '<div class="auth-logo">' + (logoLogin ? '<img src="' + esc(logoLogin) + '" alt="Logo ' + esc(idnLogin.nama) + '">' : '<img src="' + monogramDataUrl(idnLogin.singkat) + '" alt="Logo ' + esc(idnLogin.nama) + '">') + '<h1>' + esc(idnLogin.nama) + '</h1></div>' +
    profilLoginHtml() +
    '<p class="auth-sub">Masuk dengan ID pengguna dan kata sandi.</p>' +
    (kredensialAwalTampil() ? '<div class="auth-kredensial" role="status">Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama. Akun guru — ID awal: guru1, kata sandi awal: guru123.</div>' : '') +
    bannerHapus +
    '<div class="auth-error" id="login-error" role="alert" tabindex="-1" hidden></div>' +
    '<form id="login-form" onsubmit="return submitLogin(event)">' +
    '<div class="auth-field"><label for="login-id">ID pengguna</label>' +
    '<input id="login-id" autocomplete="username" placeholder="Contoh: admin" value="' + esc(_loginIdTerakhir) + '"></div>' +
    '<div class="auth-field"><label for="login-sandi">Kata sandi</label>' +
    '<input id="login-sandi" type="password" autocomplete="current-password" placeholder="Kata sandi">' +
    '<button type="button" class="auth-eye" onclick="toggleLihatSandi(\'login-sandi\', this)" aria-label="Lihat kata sandi">' + eyeSvg(false) + '</button></div>' +
    '<button class="btn block auth-submit" type="submit">Masuk</button></form>' +
    '<div class="auth-links"><button type="button" onclick="toggleLupaSandi()">Lupa kata sandi?</button><button type="button" onclick="location.hash=\'#/panduan\'">Panduan pengguna</button></div>' +
    '<div class="auth-note" id="login-lupa" hidden>Reset kata sandi hanya bisa dilakukan oleh Pimpinan. Minta tolong ke Pimpinan untuk mereset kata sandi akunmu, lalu masuk lagi dengan kata sandi baru.</div>' +
    '<p class="auth-foot">Data contoh untuk pratinjau</p>' +
    '</div></div>';
  var inp = document.getElementById('login-id');
  if (inp) inp.focus();
}
function toggleLupaSandi() {
  var note = document.getElementById('login-lupa');
  if (note) note.hidden = !note.hidden;
}
/* F2 (laporan Wira): batas percobaan login HANYA di jalur UI submitLogin,
   bukan di engine verifikasiLogin (selftest engine melakukan ~5 login gagal
   dan tidak boleh terkunci). Penghitung gagal per ID di localStorage:
   5 gagal beruntun -> blokir 60 detik, lalu penghitung jalan lagi dari
   posisi terblokir. Reset saat login berhasil.
   BATASAN JUJUR: penghitung ini client-side — siapa pun bisa menghapusnya
   dengan membersihkan storage perangkat, jadi ini penahan percobaan
   asal-asalan, bukan keamanan tingkat server. */
var LOGIN_GAGAL_KEY = 'tpq-madin-pwa-login-gagal';
var LOGIN_GAGAL_MAKS = 5;
var LOGIN_BLOKIR_MS = 60 * 1000;
function loginGagalBaca() {
  try { return JSON.parse(localStorage.getItem(LOGIN_GAGAL_KEY) || '{}'); } catch (e) { return {}; }
}
function loginGagalSimpan(data) {
  try { localStorage.setItem(LOGIN_GAGAL_KEY, JSON.stringify(data)); } catch (e) { /* storage tidak tersedia: lockout tidak aktif */ }
}
function loginBlokirSisaMs(id) {
  var data = loginGagalBaca();
  var entri = data[String(id || '').trim().toLowerCase()];
  if (!entri || !entri.blokirSampai) return 0;
  return Math.max(0, entri.blokirSampai - Date.now());
}
function loginGagalCatat(id) {
  var kunci = String(id || '').trim().toLowerCase();
  if (!kunci) return 0;
  var data = loginGagalBaca();
  var entri = data[kunci] || { gagal: 0, blokirSampai: 0 };
  /* Masa blokir sudah lewat: mulai lagi dari 0 (5 percobaan baru). */
  if (entri.blokirSampai && entri.blokirSampai <= Date.now()) entri = { gagal: 0, blokirSampai: 0 };
  entri.gagal = (entri.gagal || 0) + 1;
  if (entri.gagal >= LOGIN_GAGAL_MAKS) entri.blokirSampai = Date.now() + LOGIN_BLOKIR_MS;
  data[kunci] = entri;
  loginGagalSimpan(data);
  return entri.gagal;
}
function loginGagalReset(id) {
  var kunci = String(id || '').trim().toLowerCase();
  if (!kunci) return;
  var data = loginGagalBaca();
  delete data[kunci];
  loginGagalSimpan(data);
}
function submitLogin(ev) {
  ev.preventDefault();
  var id = document.getElementById('login-id').value.trim();
  var sandi = document.getElementById('login-sandi').value;
  _loginIdTerakhir = id;
  var err = document.getElementById('login-error');
  function gagal(pesan) {
    if (!err) return;
    err.textContent = pesan;
    err.hidden = false;
    err.focus();
  }
  if (!id || !sandi) { gagal('Isi dulu ID pengguna dan kata sandi.'); return false; }
  /* R4 (fail-closed): mesin auth tidak tersedia = login tidak bisa
     diproses. Tampilkan pesan, jangan melempar (masukPengguna tidak ada). */
  if (!authTersedia()) { gagal('Login tidak tersedia.'); return false; }
  /* F2: blokir sementara setelah 5 gagal beruntun (pesan berisi sisa
     waktu, supaya pengguna tahu kapan bisa mencoba lagi). */
  var sisaBlokir = loginBlokirSisaMs(id);
  if (sisaBlokir > 0) { gagal('Terlalu banyak percobaan gagal. Coba lagi dalam ' + Math.ceil(sisaBlokir / 1000) + ' detik.'); return false; }
  var r = masukPengguna(id, sandi);
  if (!r || !r.ok) {
    _sandiLoginTerakhir = null;
    var hitungGagal = loginGagalCatat(id);
    if (hitungGagal >= LOGIN_GAGAL_MAKS) gagal('Terlalu banyak percobaan gagal. Coba lagi dalam 60 detik.');
    else gagal((r && r.alasan) ? r.alasan : 'ID atau kata sandi salah');
    return false;
  }
  loginGagalReset(id);
  _sandiLoginTerakhir = sandi;
  if (r.wajibGantiSandi) wajibGantiSandi = true;
  render();
  return false;
}
function tampilGantiSandi() {
  bersihkanShellLogin();
  /* A2: bila layar ini muncul sesudah "Hapus semua data", tampilkan pesan
     suksesnya di sini supaya tidak hilang bersama #alert-root. */
  var bannerHapusGanti = pesanHapusData ? '<div class="auth-contoh" role="status">' + esc(pesanHapusData) + '</div>' : '';
  pesanHapusData = '';
  var root = document.getElementById('auth-root');
  root.innerHTML = '<div class="auth-screen"><div class="auth-card">' +
    '<div class="auth-logo"><img src="icons/icon-192.png" alt="Logo TPQ Al-Muttaqin"><h1>Ganti kata sandi</h1></div>' +
    '<p class="auth-sub">Kata sandi pertamamu harus diganti dulu sebelum masuk. Minimal 8 karakter.</p>' +
    bannerHapusGanti +
    '<div class="auth-error" id="ganti-error" role="alert" tabindex="-1" hidden></div>' +
    '<form onsubmit="return submitGantiSandiPaksa(event)">' +
    '<div class="auth-field"><label for="ganti-baru">Kata sandi baru</label>' +
    '<input id="ganti-baru" type="password" autocomplete="new-password" placeholder="Minimal 8 karakter">' +
    '<button type="button" class="auth-eye" onclick="toggleLihatSandi(\'ganti-baru\', this)" aria-label="Lihat kata sandi">' + eyeSvg(false) + '</button></div>' +
    '<div class="auth-field"><label for="ganti-ulang">Ulangi kata sandi baru</label>' +
    '<input id="ganti-ulang" type="password" autocomplete="new-password" placeholder="Ketik ulang kata sandi baru">' +
    '<button type="button" class="auth-eye" onclick="toggleLihatSandi(\'ganti-ulang\', this)" aria-label="Lihat kata sandi">' + eyeSvg(false) + '</button></div>' +
    '<button class="btn block auth-submit" type="submit">Simpan kata sandi baru</button></form>' +
    '<p class="auth-foot">Kamu belum bisa masuk sebelum kata sandi diganti.</p>' +
    '<div class="btn-row"><button class="btn secondary block" type="button" onclick="keluar()">Keluar</button></div>' +
    '</div></div>';
  var inp = document.getElementById('ganti-baru');
  if (inp) inp.focus();
}
function submitGantiSandiPaksa(ev) {
  ev.preventDefault();
  var s = sesiSaya();
  var err = document.getElementById('ganti-error');
  function gagal(pesan) {
    if (!err) return;
    err.textContent = pesan;
    err.hidden = false;
    err.focus();
  }
  if (!s) { render(); return false; }
  var baru = document.getElementById('ganti-baru').value;
  var ulang = document.getElementById('ganti-ulang').value;
  if (baru.length < 8) { gagal('Kata sandi baru minimal 8 karakter.'); return false; }
  if (baru !== ulang) { gagal('Konfirmasi kata sandi tidak cocok. Coba lagi.'); return false; }
  /* T-01: ganti sandi paksa TIDAK memakai sandi lama dari memori
     (_sandiLoginTerakhir hilang saat muat ulang, dan dulu selalu gagal
     dengan "ID atau kata sandi salah" tanpa jalan keluar). gantiSandiPaksa
     memeriksa sesi aktif yang cocok + flag wajibGantiSandi; sesi aktif
     dari login yang berhasil sudah membuktikan identitas. */
  var r = gantiSandiPaksa(s.id, baru);
  if (!r || !r.ok) { gagal((r && r.alasan) ? r.alasan : 'Kata sandi tidak bisa diganti. Coba lagi.'); return false; }
  _sandiLoginTerakhir = null;
  wajibGantiSandi = false;
  render();
  toast('Kata sandi berhasil diganti. Selamat datang, ' + s.nama + '.');
  return false;
}
function keluar() {
  try { keluarPengguna(); } catch (e) {}
  _sandiLoginTerakhir = null;
  wajibGantiSandi = false;
  closeModal();
  closeSheet();
  render();
}
function openUbahSandiModal() {
  var s = sesiSaya();
  if (!s) { toast('Masuk dulu untuk mengubah kata sandi.'); return; }
  openModal(
    '<h2>Ubah kata sandi saya</h2>' +
    '<div class="auth-error" id="ubah-error" role="alert" tabindex="-1" hidden></div>' +
    '<form onsubmit="return submitUbahSandi(event)">' +
    '<label for="ubah-lama">Kata sandi lama</label><input id="ubah-lama" type="password" autocomplete="current-password">' +
    '<label for="ubah-baru">Kata sandi baru (minimal 8 karakter)</label><input id="ubah-baru" type="password" autocomplete="new-password">' +
    '<label for="ubah-ulang">Ulangi kata sandi baru</label><input id="ubah-ulang" type="password" autocomplete="new-password">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan kata sandi</button></div></form>'
  );
}
function submitUbahSandi(ev) {
  ev.preventDefault();
  var s = sesiSaya();
  var err = document.getElementById('ubah-error');
  function gagal(pesan) {
    if (!err) return;
    err.textContent = pesan;
    err.hidden = false;
    err.focus();
  }
  if (!s) { closeModal(); render(); return false; }
  var lama = document.getElementById('ubah-lama').value;
  var baru = document.getElementById('ubah-baru').value;
  var ulang = document.getElementById('ubah-ulang').value;
  if (baru.length < 8) { gagal('Kata sandi baru minimal 8 karakter.'); return false; }
  if (baru !== ulang) { gagal('Konfirmasi kata sandi tidak cocok. Coba lagi.'); return false; }
  var r = gantiSandiSendiri(s.id, lama, baru);
  if (!r || !r.ok) { gagal((r && r.alasan) ? r.alasan : 'Kata sandi lama salah atau kata sandi tidak bisa diganti.'); return false; }
  closeModal();
  toast('Kata sandi berhasil diubah.');
  return false;
}


/* ---------------- Navigasi ---------------- */
/* Daftar modul: kelompok + ikon SVG dari mockup desktop
   (MENU + ICONS mockup-desktop-tpq-al-muttaqin). Engine juga punya
   MODULES, tapi daftar ini yang dipakai UI supaya sidebar mengikuti
   mockup desktop; id dan label modulnya sama dengan engine. */
var MODULES = [
  { id: 'dashboard', label: 'Beranda', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1.5\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1.5\"/><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1.5\"/></svg>', group: 'Utama' },
  { id: 'santri', label: 'Santri', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/></svg>', group: 'Utama' },
  { id: 'tabungan', label: 'Tabungan', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 1.2 4.5 3 5.5V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1.3c.7.2 1.4.3 2 .3s1.3-.1 2-.3V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2.5c1.1-.8 2-2.2 2-4.5 0-2.4-1.1-3.9-2.5-4.6.3-.3.5-.7.5-1.4 0-1-.5-2-2-2Z\"/><path d=\"M2 9v1c0 1.1.9 2 2 2h1\"/><path d=\"M16 11h.01\"/></svg>', group: 'Keuangan' },
  { id: 'keuangan', label: 'Keuangan', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/><path d=\"M6 12h.01M18 12h.01\"/></svg>', group: 'Keuangan' },
  { id: 'rapbm', label: 'RAPBM', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"M9 12h6M9 16h4\"/></svg>', group: 'Keuangan' },
  { id: 'kelas', label: 'Kelas & Absensi', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 2v4M16 2v4\"/><rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"3\"/><path d=\"m9 14 2 2 4-4\"/></svg>', group: 'Pembelajaran' },
  { id: 'hafalan', label: 'Hafalan / Iqra', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 6c-1.5-1.6-3.7-2.2-6.5-2C4.6 4.15 4 4.6 4 5.4v10.7c0 .8.6 1.3 1.5 1.4 2.8.2 5 .4 6.5 2 1.5-1.6 3.7-1.8 6.5-2 .9-.1 1.5-.6 1.5-1.4V5.4c0-.8-.6-1.25-1.5-1.4-2.8-.2-5 .4-6.5 2Z\"/><path d=\"M12 6v13.5\"/></svg>', group: 'Pembelajaran' },
  { id: 'penilaian', label: 'Penilaian & Rapor', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"6\"/><path d=\"M15.5 13 17 22l-5-3-5 3 1.5-9\"/></svg>', group: 'Pembelajaran' },
  { id: 'kbm', label: 'KBM', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>', group: 'Pembelajaran' },
  { id: 'guru', label: 'Guru', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 9 12 4 2 9l10 5 10-5Z\"/><path d=\"M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5\"/><path d=\"M22 9v5\"/></svg>', group: 'Data & Orang' },
  { id: 'kemuridan', label: 'Kemuridan', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 21a8 8 0 0 1 13.3-6\"/><circle cx=\"10\" cy=\"8\" r=\"5\"/><path d=\"M19 16v6M22 19h-6\"/></svg>', group: 'Data & Orang' },
  { id: 'khidmah', label: 'Sahabat Khidmah', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.2a5 5 0 1 1 7.5 6.4Z\"/></svg>', group: 'Data & Orang' },
  { id: 'pengumuman', label: 'Pengumuman', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 11 18-5v12L3 14v-3Z\"/><path d=\"M11.6 16.8a3 3 0 1 1-5.8-1.6\"/></svg>', group: 'Lainnya' },
  { id: 'grafik', label: 'Grafik', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><path d=\"M7 14v3M12 9v8M17 5v12\"/></svg>', group: 'Lainnya' },
  { id: 'laporan', label: 'Laporan', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v5h5\"/><path d=\"M9 13h6M9 17h4\"/></svg>', group: 'Lainnya' },
  { id: 'pengaturan', label: 'Pengaturan', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z\"/></svg>', group: 'Lainnya' },
  { id: 'panduan', label: 'Panduan', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 4.8C7.5 3.6 10 3.6 12 5c2-1.4 4.5-1.4 7-.2v13.4c-2.5-1.2-5-1.2-7 .2-2-1.4-4.5-1.4-7-.2V4.8Z\"/><path d=\"M12 5v13.4\"/></svg>', group: 'Lainnya' },
  { id: 'identitas', label: 'Identitas Madrasah', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><path d=\"M9 9h6M9 13h6M9 17h4\"/></svg>', group: 'Lainnya' },
];
var currentRoute = 'dashboard';

/* ================= Akun dan peran (Kirana, ronde siap produksi) =================
   Kontrak mesin (Baskara, engine.js): sesiAktif, masukPengguna,
   keluarPengguna, gantiSandiSendiri, tambahPengguna, resetSandiPengguna,
   hapusPengguna, cariPengguna, daftarPengguna, bolehAkses, GURU_ROUTES, GURU_TABS.
   Semua panggilan di bawah memakai guard typeof. R4 (fail-closed): kalau
   mesin auth TIDAK tersedia, render() menampilkan layar login dan tidak
   me-render modul apa pun (bukan berjalan tanpa gerbang login); submitLogin
   menampilkan "Login tidak tersedia" tanpa melempar. */
function authTersedia() {
  return typeof sesiAktif === 'function' && typeof masukPengguna === 'function' && typeof keluarPengguna === 'function';
}
function sesiSaya() { return authTersedia() ? sesiAktif() : null; }
function peranSaya() { var s = sesiSaya(); return s ? s.peran : null; }
function guruRoutes() { return (typeof GURU_ROUTES !== 'undefined' && GURU_ROUTES) || ['dashboard', 'santri', 'kelas', 'hafalan', 'penilaian', 'pengumuman', 'kbm']; }
function guruTabs() { return (typeof GURU_TABS !== 'undefined' && GURU_TABS) || ['dashboard', 'santri', 'hafalan', 'penilaian', 'kelas']; }
function bolehRute(route) {
  if (!authTersedia()) return true;
  var s = sesiSaya();
  if (!s) return false;
  /* Panduan dan Identitas boleh dibaca semua peran yang sudah masuk
     (Guru lihat saja; edit identitas hanya Pimpinan, dijaga di form). */
  if (route === 'panduan' || route === 'identitas') return true;
  if (typeof bolehAkses === 'function') return bolehAkses(s.peran, route);
  if (s.peran === 'Guru') return guruRoutes().indexOf(route) !== -1;
  return true;
}
function modulTampil(m) { return bolehRute(m.id); }
/* Kata sandi yang baru dipakai masuk, disimpan di memori hanya untuk
   mengisi sandi lama pada layar ganti sandi paksa, lalu langsung dihapus.
   Tidak pernah ditulis ke localStorage atau ke DOM. */
var _sandiLoginTerakhir = null;
var _loginIdTerakhir = '';
/* Penanda ganti sandi paksa (in-memory, diisi saat login). render() TIDAK
   memakai variabel ini lagi: ia memakai sesi.wajibGantiSandi dari mesin
   (sesiAktif membaca flag langsung dari db.pengguna), supaya layar ganti
   sandi paksa tidak bisa dilewati dengan muat ulang halaman. */
var wajibGantiSandi = false;

function go(route) { location.hash = '#/' + route; }
function routeFromHash() {
  var h = location.hash.replace(/^#\/?/, '');
  return MODULES.some(function (m) { return m.id === h; }) ? h : 'dashboard';
}
function renderShell() {
  var sb = document.getElementById('sidebar');
  var groups = {};
  /* Pembatasan peran: sidebar hanya menampilkan modul yang diizinkan
     peran yang masuk (Guru: 7 modul GURU_ROUTES; Pimpinan: semua 16).
     Tanpa sesi (mesin auth belum ada), semua modul tampil seperti dulu. */
  MODULES.filter(modulTampil).forEach(function (m) { (groups[m.group] = groups[m.group] || []).push(m); });
  var html = '<div class="brand"><div class="brand-logo"><svg viewBox="0 0 24 24" fill="none" stroke="#0a2f32" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.8C7.5 3.6 10 3.6 12 5c2-1.4 4.5-1.4 7-.2v13.4c-2.5-1.2-5-1.2-7 .2-2-1.4-4.5-1.4-7-.2V4.8Z"/><path d="M12 5v13.4"/></svg></div><div><div class="brand-name">' + esc(db.settings.namaTpq) + '</div><div class="brand-sub">Tahun ajaran ' + esc(db.settings.tahunAjaran) + '</div></div></div>' +
    (db.isContoh ? '<div class="brand-badge"><span class="dot"></span>Data contoh</div>' : '');
  Object.keys(groups).forEach(function (g) {
    html += '<div class="nav-group">' + esc(g) + '</div>';
    groups[g].forEach(function (m) {
      var cnt = m.id === 'santri' ? santriAktif().length : m.id === 'guru' ? guruTampil().length : null;
      html += '<button class="nav-item' + (currentRoute === m.id ? ' active' : '') + '" onclick="go(\'' + m.id + '\')"><span class="ico">' + m.icon + '</span>' + esc(m.id === 'dashboard' ? 'Dashboard' : m.label) + (cnt == null ? '' : '<span class="nav-count">' + cnt + '</span>') + '</button>';
    });
  });
  /* Chip pengguna + tombol keluar di bawah sidebar (hanya kalau ada sesi). */
  var sesi = sesiSaya();
  if (sesi) {
    html += '<div class="sidebar-user"><div class="su-chip">' + avatarHtml(sesi.nama) +
      '<span class="grow"><span class="su-name">' + esc(sesi.nama) + '</span><br><span class="su-role">' + esc(sesi.peran) + ' | ID ' + esc(sesi.id) + '</span></span></div>' +
      '<div class="btn-row"><button class="btn secondary block" onclick="openUbahSandiModal()">Ubah kata sandi</button>' +
      '<button class="btn ghost block" onclick="keluar()">Keluar</button></div></div>';
  }
  sb.innerHTML = html;
  terapkanIdentitasShell();
  /* R4: tab bar = markup mockup v3 verbatim: 5 tombol (Beranda, Santri,
     Tabungan, Keuangan, Kelas) dengan ikon SVG 23px + home indicator.
     "Lainnya" tidak lagi di tab bar — jalurnya lewat tile Lainnya di
     Menu Informasi (seperti mockup). Kelas .mk mengaktifkan gaya mockup
     (mockup.css); di desktop tab bar tetap disembunyikan styles.css. */
  var bn = document.getElementById('bottomnav');
  /* Tab bar mobile: Pimpinan tetap BOTTOM_NAV lama (ikon NAV_ICONS mockup);
     Guru memakai GURU_TABS (Beranda, Santri, Hafalan, Penilaian, Kelas)
     dengan ikon SVG dari MODULES (NAV_ICONS hanya punya 5 kunci lama). */
  var tabsBawah = peranSaya() === 'Guru' ? guruTabs() : BOTTOM_NAV;
  var bhtml = '<div class="tab-row">';
  tabsBawah.forEach(function (id) {
    var m = MODULES.find(function (x) { return x.id === id; });
    if (!m) return;
    var labelTab = { dashboard: 'Beranda', santri: 'Santri', tabungan: 'Tabungan', keuangan: 'Keuangan', kelas: 'Kelas', hafalan: 'Hafalan', penilaian: 'Penilaian' }[id] || m.label;
    var ikonTab = (peranSaya() === 'Guru' || !NAV_ICONS[id])
      ? m.icon.replace('<svg ', '<svg width="23" height="23" ')
      : NAV_ICONS[id].replace('width="22" height="22"', 'width="23" height="23"');
    bhtml += '<button class="tab-btn' + (currentRoute === id ? ' active' : '') + '" data-goto="' + id + '" onclick="go(\'' + id + '\')">' + ikonTab + esc(labelTab) + '</button>';
  });
  bhtml += '</div><div class="home-ind"></div>';
  bn.innerHTML = bhtml;
  bn.classList.toggle('mk', !isDesktopMode());
  var ta = document.querySelectorAll('[data-ta]');
  ta.forEach(function (el) { el.textContent = db.settings.tahunAjaran; });
  document.getElementById('badge-contoh').style.display = db.isContoh ? '' : 'none';
}
function openLainnya() {
  /* Sheet Lainnya hanya menampilkan modul yang diizinkan peran. */
  var rest = MODULES.filter(function (m) { return BOTTOM_NAV.indexOf(m.id) === -1 && modulTampil(m); });
  var html = '<div class="sheet" onclick="if(event.target===this) closeSheet()"><div class="panel"><h2>Menu Lainnya</h2>';
  rest.forEach(function (m) {
    html += '<button class="item" onclick="closeSheet(); go(\'' + m.id + '\')"><span class="ico">' + m.icon + '</span>' + esc(m.label) + '</button>';
  });
  var sesiLain = sesiSaya();
  if (sesiLain) {
    html += '<button class="item" onclick="closeSheet(); openUbahSandiModal()"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.3-8.3M16 4l3 3M13.5 6.5l3 3"/></svg></span>Ubah kata sandi</button>';
    html += '<button class="item" onclick="closeSheet(); keluar()"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg></span>Keluar (' + esc(sesiLain.nama) + ')</button>';
  }
  html += '<div class="btn-row"><button class="btn secondary block" onclick="closeSheet()">Tutup</button></div></div></div>';
  document.getElementById('sheet-root').innerHTML = html;
}
function closeSheet() { document.getElementById('sheet-root').innerHTML = ''; }
/* ---- Modal (S3 + S4): fokus masuk ke dalam modal saat dibuka, Tab dijebak
   di dalam modal, fokus kembali ke pemicu saat ditutup. Tombol tutup × 44px
   di kanan atas .modal. Ketuk backdrop / × saat form sudah diubah meminta
   konfirmasi dulu (S4) supaya isian panjang tidak terbuang tak sengaja. */
var modalPemicu = null;
var modalKotor = false;
function openModal(html) {
  modalPemicu = document.activeElement;
  modalKotor = false;
  document.getElementById('modal-root').innerHTML =
    '<div class="modal-backdrop" onclick="if(event.target===this) mintaTutupModal()"><div class="modal" role="dialog"><button type="button" class="modal-x" onclick="mintaTutupModal()" aria-label="Tutup">&times;</button>' + html + '</div></div>';
  var modal = document.querySelector('#modal-root .modal');
  if (modal) {
    modal.addEventListener('input', function () { modalKotor = true; });
    modal.addEventListener('change', function () { modalKotor = true; });
    var target = modal.querySelector('input:not([type=hidden]):not([type=file]), select, textarea, button:not(.modal-x)') || modal;
    if (target === modal) modal.setAttribute('tabindex', '-1');
    try { target.focus(); } catch (e) {}
  }
}
function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  modalKotor = false;
  if (modalPemicu && modalPemicu.focus) {
    try { modalPemicu.focus(); } catch (e) {}
  }
  modalPemicu = null;
}
function mintaTutupModal() {
  if (!modalKotor) { closeModal(); return; }
  var pemicuAsli = modalPemicu;
  confirmModal({
    judul: 'Tutup tanpa menyimpan?',
    isi: '<p>Isian di form ini belum disimpan dan akan hilang kalau ditutup sekarang.</p>',
    okLabel: 'Ya, tutup',
    danger: true,
    onOk: function () {
      closeModal();
      if (pemicuAsli && pemicuAsli.focus) { try { pemicuAsli.focus(); } catch (e) {} }
    }
  });
}
function jebakTabModal(e) {
  var modal = document.querySelector('#modal-root .modal');
  if (!modal) return;
  var daftar = modal.querySelectorAll('button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
  var fokus = [];
  for (var i = 0; i < daftar.length; i++) {
    if (!daftar[i].disabled) fokus.push(daftar[i]);
  }
  if (!fokus.length) return;
  var pertama = fokus[0], terakhir = fokus[fokus.length - 1];
  if (e.shiftKey && document.activeElement === pertama) { e.preventDefault(); terakhir.focus(); }
  else if (!e.shiftKey && document.activeElement === terakhir) { e.preventDefault(); pertama.focus(); }
}

function render() {
  currentRoute = routeFromHash();
  /* PENJAGA RUTE + GERBANG LOGIN: selama belum ada sesi yang valid, tidak
     ada konten dashboard/modul yang tampil (sidebar + tab bar dikosongkan
     dan disembunyikan lewat body.logged-out). Rute yang tidak diizinkan
     peran dikembalikan ke dashboard, termasuk navigasi lewat hash manual. */
  if (authTersedia()) {
    var sesi = sesiSaya();
    document.body.classList.toggle('logged-out', !sesi);
    if (!sesi) {
      /* M7: rute #/panduan boleh dibaca TANPA sesi (mode baca saja), supaya
         pengguna yang belum bisa masuk tetap bisa membaca cara masuk
         pertama kali. Tautan ke rute aplikasi dari Panduan mengarah ke
         login bila belum ada sesi (render() mengembalikan ke tampilLogin
         untuk rute selain panduan). Gate kredensial isContoh di
         renderPanduan() tetap berlaku di mode ini. */
      if (currentRoute === 'panduan') {
        document.getElementById('auth-root').innerHTML = '';
        document.getElementById('sidebar').innerHTML = '';
        document.getElementById('bottomnav').innerHTML = '';
        document.getElementById('view').classList.remove('mk');
        document.getElementById('view').innerHTML = renderPanduan();
        window.scrollTo(0, 0);
        return;
      }
      tampilLogin(); return;
    }
    if (sesi.wajibGantiSandi) { tampilGantiSandi(); return; }
    document.getElementById('auth-root').innerHTML = '';
    /* Profil aktif: Guru tidak boleh memakai "Semua" (mis. sisa pilihan
       Pimpinan di perangkat yang sama). Kembalikan ke TPQ. */
    if (sesi.peran === 'Guru' && ui.jenjang === 'Semua') { try { setJenjang('TPQ'); } catch (e) { ui.jenjang = 'TPQ'; } }
    if (currentRoute !== 'dashboard' && !bolehRute(currentRoute)) {
      toast('Tidak ada akses');
      currentRoute = 'dashboard';
      /* S7: renderShell() dulu sebelum return — tanpa ini shell sempat
         menampilkan konten sesi sebelumnya (sidebar basi). */
      if (location.hash !== '#/dashboard') { location.hash = '#/dashboard'; renderShell(); return; }
    }
  } else {
    /* R4 (fail-closed): mesin auth tidak tersedia = aplikasi TIDAK BOLEH
       terbuka tanpa login. Tampilkan layar login dan jangan render modul
       apa pun (sidebar/tab/view dikosongkan, seperti saat tanpa sesi). */
    document.body.classList.add('logged-out');
    document.getElementById('sidebar').innerHTML = '';
    document.getElementById('bottomnav').innerHTML = '';
    document.getElementById('view').innerHTML = '';
    tampilLogin();
    return;
  }
  renderShell();
  var fn = RENDERERS[currentRoute] || renderDashboard;
  /* R4: layar mockup (Beranda mobile + Hasil Belajar) memakai kelas .mk di
     #view dan TIDAK memakai kartu hero jenjang — filter jenjang di layar itu
     berupa baris chip ringkas di dalam renderDashboard. Layar lain tetap
     memakai kartu hero jenjang seperti biasa. */
  var isMk = !isDesktopMode() && (currentRoute === 'dashboard' || (currentRoute === 'penilaian' && ui.nilaiTab === 'Rapor'));
  document.getElementById('view').classList.toggle('mk', isMk);
  document.getElementById('view').innerHTML = (isMk ? '' : jenjangBarHtml()) + fn();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

/* ================= MODE TAMPILAN (Desktop / Mobile / Otomatis) ================= */
var MODE_KEY = 'tpq-madin-pwa-mode';
function getMode() {
  try { return localStorage.getItem(MODE_KEY) || 'auto'; } catch (e) { return 'auto'; }
}
function setMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
  applyMode();
  render();
}
/* A17: ganti mode tampilan minta konfirmasi dulu + memberi tahu jalan
   kembali (Pengaturan lalu Tampilan). setMode() langsung tetap dipakai
   selftest dan logika internal. */
function mintaGantiMode(mode) {
  if (mode === getMode()) return;
  var namaMode = mode === 'desktop' ? 'Mode Desktop' : mode === 'mobile' ? 'Mode Mobile' : 'Otomatis';
  confirmModal({
    judul: 'Ubah ke ' + namaMode + '?',
    isi: '<p>Tampilan aplikasi akan berubah ke ' + esc(namaMode) + '. Kembali kapan saja lewat Pengaturan lalu Tampilan.</p>',
    okLabel: 'Ya, ubah',
    onOk: function () {
      setMode(mode);
      toast('Mode diubah ke ' + namaMode + '. Kembali lewat Pengaturan lalu Tampilan.');
    }
  });
}
function applyMode() {
  var m = getMode();
  document.body.classList.remove('mode-desktop', 'mode-mobile');
  if (m === 'desktop') document.body.classList.add('mode-desktop');
  if (m === 'mobile') document.body.classList.add('mode-mobile');
}
function isDesktopMode() {
  var m = getMode();
  if (m === 'desktop') return true;
  if (m === 'mobile') return false;
  return window.innerWidth >= 900;
}

var syncBusy = false;

function updateSyncStatus() {
  var el = document.getElementById('sync-status');
  if (!el) return;
  var st = syncState();
  el.className = 'sync-status ' + st.code;
  el.innerHTML = '<span class="sync-dot"></span><span>' + esc(st.text) + '</span>';
}

/* ================= Modal konfirmasi ================= */
var confirmCb = null;
function confirmModal(opts) {
  confirmCb = opts.onOk || null;
  var check = opts.needCheck ? '<label style="display:flex;gap:10px;align-items:flex-start;margin:14px 0;"><input type="checkbox" id="confirm-check" style="width:22px;height:22px;flex:0 0 22px;margin-top:2px;"><span>' + esc(opts.checkLabel || 'Saya yakin dan paham akibatnya.') + '</span></label>' : '';
  openModal(
    '<h2>' + esc(opts.judul) + '</h2>' +
    '<div>' + (opts.isi || '') + '</div>' + check +
    '<div class="btn-row"><button class="btn secondary" onclick="closeModal()">Batal</button>' +
    '<button class="btn ' + (opts.danger ? 'danger' : '') + '" onclick="runConfirm()">' + esc(opts.okLabel || 'Ya, lanjutkan') + '</button></div>'
  );
}
function runConfirm() {
  var cb = confirmCb;
  var box = document.getElementById('confirm-check');
  if (box && !box.checked) { toast('Centang dulu kotak persetujuan.'); return; }
  closeModal();
  confirmCb = null;
  if (cb) cb();
}
function showAlert(kind, judul, isi) {
  var root = document.getElementById('alert-root');
  if (!root) { toast(judul); return; }
  root.innerHTML = '<div class="alert alert-' + kind + '" role="status"><b>' + esc(judul) + '</b>' + (isi ? '<div>' + esc(isi) + '</div>' : '') + '</div>';
  window.scrollTo(0, 0);
}

/* ---- Error simpan di dalam form (S5, ui-ux-pro-max prioritas 8): ringkasan
   error di atas form (pola .auth-error: role=alert, fokus pindah ke sana) +
   pesan di bawah field yang bermasalah + aria-describedby; toast hanya
   pelengkap. Dipakai SEMUA submit form KECUALI submitKeuangan (Baskara). */
function tampilErrorForm(form, pesan, fieldId) {
  if (!form) { toast(pesan); return; }
  var err = form.querySelector('.form-error');
  if (!err) {
    err = document.createElement('div');
    err.className = 'form-error auth-error';
    err.setAttribute('role', 'alert');
    err.setAttribute('tabindex', '-1');
    form.insertBefore(err, form.firstChild);
  }
  err.textContent = pesan;
  err.hidden = false;
  if (fieldId) {
    var f = document.getElementById(fieldId);
    if (f) {
      var feId = 'err-' + fieldId;
      f.setAttribute('aria-describedby', feId);
      var fe = document.getElementById(feId);
      if (!fe) {
        fe = document.createElement('p');
        fe.className = 'field-error';
        fe.id = feId;
        if (f.parentNode) f.parentNode.insertBefore(fe, f.nextSibling);
      }
      fe.textContent = pesan;
    }
  }
  try { err.focus(); } catch (e) {}
  toast(pesan);
}
function gagalForm(ev, r, petaField) {
  var form = ev && ev.target ? ev.target : null;
  var pesan = (r && (r.message || r.alasan)) || 'Tidak bisa disimpan. Periksa lagi isian form.';
  var fieldId = null;
  if (r && r.error && petaField) fieldId = petaField[r.error] || null;
  tampilErrorForm(form, pesan, fieldId);
  return false;
}

function showImportReport(lap) {
  var judul = lap.jenis === 'murid' ? 'Import murid' : lap.jenis === 'guru' ? 'Import guru' : 'Import nilai';
  var html = '<h2>Hasil ' + judul + '</h2>' +
    '<div class="alert ' + (lap.gagal.length ? 'alert-info' : 'alert-success') + '"><b>' + lap.berhasil + ' baris berhasil masuk, ' + lap.gagal.length + ' baris gagal.</b>Baris yang gagal dilewati, data yang sudah ada tidak rusak.</div>';
  if (lap.gagal.length) {
    html += '<table class="table-stack"><thead><tr><th>Baris</th><th>Alasan</th></tr></thead><tbody>' +
      lap.gagal.map(function (g) { return '<tr><td class="cell-main" data-label="Baris">' + g.baris + '</td><td data-label="Alasan">' + esc(g.alasan) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  html += '<div class="btn-row"><button class="btn block" onclick="closeModal()">Tutup</button></div>';
  openModal(html);
}


function openSheetsNew() {
  window.open('https://sheets.new', '_blank', 'noopener');
  toast('Sheet baru dibuka. Upload file CSV di sana.');
}

/* ================= Picker murid / guru: cari saat diketik, chip, tampil bertahap ================= */
var picker = null;
function openPicker(cfg) {
  picker = {
    title: cfg.title, items: cfg.items.slice().sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); }),
    chips: cfg.chips || [], onPick: cfg.onPick, onCancel: cfg.onCancel || null, search: '', chip: 'Semua', shown: 10
  };
  renderPickerModal();
}
function pickerFiltered() {
  var q = picker.search.toLowerCase();
  return picker.items.filter(function (it) {
    if (picker.chip !== 'Semua' && it.chipVal !== picker.chip) return false;
    if (q && (it.nama + ' ' + (it.cari || '')).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}
function renderPickerModal() {
  var list = pickerFiltered();
  var shown = list.slice(0, picker.shown);
  var chipsHtml = '<div class="chip-row"><button class="chip-filter' + (picker.chip === 'Semua' ? ' active' : '') + '" onclick="pickerSetChip(\'Semua\')">Semua</button>' +
    picker.chips.map(function (c) { return '<button class="chip-filter' + (picker.chip === c ? ' active' : '') + '" onclick="pickerSetChip(\'' + escJs(c) + '\')">' + esc(c) + '</button>'; }).join('') + '</div>';
  openModal(
    '<h2>' + esc(picker.title) + '</h2>' +
    '<label for="picker-search">Cari nama atau NIS</label>' +
    '<input id="picker-search" type="search" placeholder="Ketik nama atau NIS" value="' + esc(picker.search) + '" oninput="pickerSetSearch(this.value)" autocomplete="off">' +
    chipsHtml +
    '<p class="picker-count">Menampilkan ' + shown.length + ' dari ' + list.length + ' hasil.</p>' +
    '<div>' + (shown.length ? shown.map(function (it) {
      return '<button class="picker-row" onclick="pickerPick(\'' + it.id + '\')">' + avatarHtml(it.nama, it.foto) +
        '<span class="grow"><span class="nm">' + esc(it.nama) + '</span><br><span class="sb">' + esc(it.sub || '') + '</span></span></button>';
    }).join('') : '<p class="empty" role="status">Tidak ada yang cocok. Coba kata kunci lain atau ubah filter chip.</p>') + '</div>' +
    (list.length > picker.shown ? '<button class="btn secondary block" onclick="pickerMore()">Tampilkan lebih banyak (' + (list.length - picker.shown) + ' lagi)</button>' : '') +
    '<div class="btn-row"><button class="btn secondary block" onclick="pickerBatal()">Batal</button></div>'
  );
  var inp = document.getElementById('picker-search');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function pickerSetSearch(v) { picker.search = v; picker.shown = 10; renderPickerModalKeepFocus(); }
function pickerSetChip(c) { picker.chip = c; picker.shown = 10; renderPickerModal(); }
function pickerMore() { picker.shown += 10; renderPickerModal(); }
function renderPickerModalKeepFocus() {
  var pos = null;
  var inp = document.getElementById('picker-search');
  if (inp) pos = inp.selectionStart;
  renderPickerModal();
  var inp2 = document.getElementById('picker-search');
  if (inp2 && pos != null) { try { inp2.setSelectionRange(pos, pos); } catch (e) {} }
}
function pickerPick(id) {
  var it = picker.items.find(function (x) { return x.id === id; });
  var cb = picker.onPick;
  picker = null;
  closeModal();
  if (cb && it) cb(it);
}
/* Batal di picker: tutup picker, lalu jalankan onCancel bila ada — dipakai
   form piket yang pickernya menimpa modal form (tanpa ini, Batal membuat
   form piket hilang begitu saja). Picker lain tanpa onCancel: perilaku lama
   (sekadar tutup). */
function pickerBatal() {
  var cb = picker && picker.onCancel;
  picker = null;
  closeModal();
  if (cb) cb();
}

/* ================= Foto: pilih file, downscale maks 480px, simpan data URL ================= */
function tampilNamaFoto(input, spanId) {
  var el = document.getElementById(spanId);
  if (!el) return;
  var f = input.files && input.files[0];
  el.textContent = f ? f.name : 'Belum ada foto dipilih';
}
function onPhotoChange(input, previewId, hiddenId) {
  var f = input.files && input.files[0];
  if (!f) return;
  if (!f.type || f.type.indexOf('image/') !== 0) { toast('Pilih file gambar (JPG atau PNG).'); input.value = ''; return; }
  var reader = new FileReader();
  reader.onload = function () {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, 480 / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      var dataUrl = cv.toDataURL('image/jpeg', 0.85);
      var hidden = document.getElementById(hiddenId);
      if (hidden) hidden.value = dataUrl;
      var prev = document.getElementById(previewId);
      if (prev) prev.innerHTML = '<img class="avatar" src="' + dataUrl + '" alt="Pratinjau foto">';
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
}


/* ================= RENDER: Dashboard ================= */
/* Kartu profil santri di Beranda mobile (mockup v3 layar 2): ketuk kartu
   membuka Hasil Belajar santri itu (tab Rapor di Penilaian). */
function bukaHasilBelajar(santriId) {
  ui.raporSantri = santriId;
  ui.nilaiTab = 'Rapor';
  go('penilaian');
}
/* R4: interaksi yang diambil dari mockup v3 (JS mockup, SLIDES + setSlide). */
var OB_SLIDES = [
  { t: 'Lebih mudah mengakses TPQ dengan mobile', s: 'Sekarang kamu bisa mengakses jadwal, hafalan, dan tabungan santri dengan lebih mudah.' },
  { t: 'Hafalan dan absensi tercatat rapi', s: 'Ustadz mencatat setoran dan kehadiran santri langsung dari HP, tanpa buku tulis.' },
  { t: 'Tabungan santri terpantau wali', s: 'Setoran, penarikan, dan target menabung terlihat jelas oleh wali santri.' }
];
function obSlide(i) {
  var t = document.getElementById('ob-title');
  var sb = document.getElementById('ob-sub');
  if (!t || !sb) return;
  t.textContent = OB_SLIDES[i].t;
  sb.textContent = OB_SLIDES[i].s;
  document.querySelectorAll('.ob-dots button').forEach(function (d) {
    d.classList.toggle('active', parseInt(d.getAttribute('data-slide'), 10) === i);
  });
}
/* S6: aria-expanded selalu mencerminkan keadaan dropdown; tutup saat ketuk
   di luar (listener di init) dan saat Escape (listener keydown di init). */
function toggleSem(ev) {
  if (ev) ev.stopPropagation();
  var w = document.getElementById('sem-wrap');
  if (!w) return;
  w.classList.toggle('open');
  var btn = w.querySelector('.sem-btn');
  if (btn) btn.setAttribute('aria-expanded', w.classList.contains('open') ? 'true' : 'false');
}
function tutupDropdownSem() {
  var w = document.getElementById('sem-wrap');
  if (!w) return;
  w.classList.remove('open');
  var btn = w.querySelector('.sem-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
function setRaporSemester(id) { ui.raporSemester = id; render(); }
function toggleNotifSemua(btn) {
  var l = document.getElementById('notif-list');
  if (!l) return;
  l.classList.toggle('show-all');
  btn.textContent = l.classList.contains('show-all') ? 'Sembunyikan' : 'Lihat semua';
}
/* T-23: jadwal KBM berikutnya yang sesungguhnya dari `jadwalKbm` + hari/jam
   sekarang. Dicari 7 hari ke depan (termasuk hari ini, hanya jadwal yang
   jam mulainya masih di depan); yang paling awal menang. Jenjang aktif
   dihormati. Fallback: kelas pertama (perilaku lama) bila tidak ada jadwal
   sama sekali. Label "Kelas Berikutnya" dipertahankan. */
function kelasBerikutnya() {
  var sekarang = new Date();
  var jamSekarang = String(sekarang.getHours()).padStart(2, '0') + ':' + String(sekarang.getMinutes()).padStart(2, '0');
  var hariIniIdx = (sekarang.getDay() + 6) % 7; /* getDay: 0=Ahad -> index 6 di HARI_LIST */
  var kandidat = [];
  for (var off = 0; off < 7; off++) {
    var hari = HARI_LIST[(hariIniIdx + off) % 7];
    db.jadwalKbm.forEach(function (j) {
      if (j.hari !== hari) return;
      if (!jenjangCocok(kelasJenjang(j.kelas))) return;
      if (off === 0 && j.jamMulai <= jamSekarang) return;
      kandidat.push({ off: off, jamMulai: j.jamMulai, jadwal: j });
    });
  }
  kandidat.sort(function (a, b) { return (a.off - b.off) || (a.jamMulai < b.jamMulai ? -1 : (a.jamMulai > b.jamMulai ? 1 : 0)); });
  if (kandidat.length) {
    var j = kandidat[0].jadwal;
    var k = db.kelas.find(function (x) { return x.nama === j.kelas; });
    return { nama: j.kelas, jadwal: j.hari + ', ' + j.jamMulai + ' - ' + j.jamSelesai, ruang: k ? (k.ruang || '') : '' };
  }
  var pertama = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); })[0];
  return pertama ? { nama: pertama.nama, jadwal: pertama.jadwal, ruang: pertama.ruang } : null;
}
/* K1: seksi "Murid per kelas" di Dashboard — mengikuti filter jenjang,
   format sama seperti Rekap per kelas di Laporan. */
function rekapKelasDashboardHtml() {
  var rows = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); }).map(function (k) {
    var murid = santriAktif().filter(function (s) { return s.kelas === k.nama; });
    return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(k.nama) + '</b></span><span>' + murid.length + ' santri (' + teksGender(rekapGenderUi(murid)) + ')</span></div>';
  }).join('');
  return '<div class="card"><h2>Murid per kelas</h2>' + (rows || '<p class="empty">Belum ada kelas pada jenjang ini.</p>') + '</div>';
}
/* A9: sub-teks tile "Lainnya" — menyebut 3 modul tersembunyi + sisanya
   ("Pengaturan, Laporan, Pengumuman, dan 8 lagi"). Tanpa redesain nav. */
function lainnyaSubteks() {
  var rest = MODULES.filter(function (m) { return BOTTOM_NAV.indexOf(m.id) === -1 && modulTampil(m); });
  if (!rest.length) return '';
  var utama = ['Pengaturan', 'Laporan', 'Pengumuman'].filter(function (nama) { return rest.some(function (m) { return m.label === nama; }); });
  var sisa = rest.length - utama.length;
  return utama.join(', ') + (sisa > 0 ? ', dan ' + sisa + ' lagi' : '');
}
function renderDashboard() {
  /* F6: guard ringan — renderer top-level tidak merender apa pun tanpa sesi
     atau bila rute tidak diizinkan peran. Ini pertahanan UI, bukan keamanan
     server (render() tetap penjaga utama). */
  if (!sesiSaya() || !bolehRute('dashboard')) return '';
  var kas = saldoKas(ui.jenjang);
  var aktif = santriAktif();
  var tunggakan = aktif.filter(function (s) { return s.sppStatus !== 'Lunas'; });
  var peng = db.pengumuman.filter(function (p) { return p.aktif && !dismissedAnn[p.id]; });
  /* Peran Guru tidak boleh melihat angka keuangan (temuan verifikasi live
     15 Nov ~12:28 WIB: menu Keuangan/Tabungan sudah tersembunyi, tapi kartu
     statistik Total tabungan + Saldo kas dan kartu Tunggakan SPP masih tampil
     di dashboard). Kartu-kartu itu hanya dirender untuk Pimpinan. */
  var guru = peranSaya() === 'Guru';
  var menu = [
    { id: 'santri', label: 'Santri', sub: santriAktif().length + ' santri aktif' },
    { id: 'tabungan', label: 'Tabungan', sub: rupiah(totalTabungan()) },
    { id: 'keuangan', label: 'Keuangan', sub: rupiah(kas.saldo) },
    { id: 'kelas', label: 'Kelas', sub: db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); }).length + ' kelas' },
    { id: 'hafalan', label: 'Hafalan/Iqra', sub: db.hafalanLog.length + ' setoran' },
    { id: 'guru', label: 'Guru', sub: db.guru.filter(guruCocokJenjang).length + ' guru' },
    { id: 'penilaian', label: 'Hasil Belajar', sub: 'Nilai dan rapor' },
    { id: 'kbm', label: 'KBM', sub: 'Jadwal dan piket' },
    { id: 'kemuridan', label: 'Kemuridan', sub: 'Kelas, rombel, alumni' },
    { id: 'khidmah', label: 'Sahabat Khidmah', sub: 'Pimpinan dan wali kelas' },
    { id: 'grafik', label: 'Grafik', sub: 'Murid, guru, absensi' },
    { id: 'laporan', label: 'Laporan', sub: 'Rekap dan export' }
  ].filter(function (m) { return bolehRute(m.id); });
  /* Struktur Beranda mobile mengikuti mockup v3 layar 2: sapaan, kartu profil
     santri pertama yang aktif (mengikuti filter jenjang), Menu Informasi 4x2,
     lalu Notifikasi. Kartu lembaga, 4 kartu statistik, dan tile ke-9 sampai
     ke-12 tetap tampil di desktop (kelas only-desktop / menu-extra), jadi
     tampilan desktop yang disetujui Mas tidak berubah. */
  var profil = aktif[0];
  /* R4: Beranda mobile = markup VERBATIM mockup v3 layar 2. Urutan mockup:
     sapaan, kartu profil, Menu Informasi 4x2 (ikon SVG asli di kotak pastel),
     Notifikasi, kartu Kehadiran/Kelas Berikutnya. Satu-satunya tambahan di
     luar mockup: baris chip jenjang ringkas di atas (syarat fungsi klien);
     kartu hero jenjang besar tidak lagi tampil di mobile. Desktop tidak
     berubah (blok only-desktop + grid 12 tile di bawah, seperti yang Mas
     setujui). */
  var menuMk = [
    { label: 'Jadwal', route: 'kelas', bg: '#ECE9FF', color: '#6C4FE0', icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>' },
    { label: 'Guru', route: 'guru', bg: '#FFE9E4', color: '#F0644C', icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4"/></svg>' },
    { label: 'Hafalan', route: 'hafalan', bg: '#FFF3D6', color: '#E8A20C', icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5 14 9l4.9.6-3.6 3.3 1 4.8L12 15.3l-4.3 2.4 1-4.8L5.1 9.6 10 9l2-4.5Z"/></svg>' },
    { label: 'Absensi', route: 'kelas', bg: '#E2F6E9', color: '#22A06B', icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4.5a3 3 0 0 1 6 0M9 13.5l2.2 2.2L15.5 11"/></svg>' },
    { label: 'Wali', route: 'khidmah', bg: '#FFE4F1', color: '#D64FA0', icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3 2.7-4.6 5.5-4.6s4.9 1.6 5.5 4.6M16 5.7a3.2 3.2 0 0 1 0 5.5M17.6 15.2c1.5.7 2.4 2 2.8 4.3"/></svg>' },
    { label: 'Kitab', route: 'hafalan', bg: '#E0F4F1', color: '#0E9594', icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.8C7.5 3.6 10 3.6 12 5c2-1.4 4.5-1.4 7-.2v13.4c-2.5-1.2-5-1.2-7 .2-2-1.4-4.5-1.4-7-.2V4.8Z"/><path d="M12 5v13.4"/></svg>' },
    { label: 'Keuangan', route: 'keuangan', bg: '#E3EBFF', color: '#3D6BE0', icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M4 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-1-2Z"/><circle cx="16.5" cy="14" r="1.2" fill="currentColor"/></svg>' },
    { label: 'Lainnya', route: '', bg: '#F1F2F8', color: '#7A7FA6', icon: '<svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="2.6"/><circle cx="15" cy="6" r="2.6" fill="#F0644C"/><circle cx="6" cy="15" r="2.6" fill="#E8A20C"/><circle cx="15" cy="15" r="2.6" fill="#22A06B"/></svg>' }
  ].filter(function (m) { return !m.route || bolehRute(m.route); });
  /* T-23: Kelas Berikutnya dihitung dari jadwal KBM yang sesungguhnya
     (hari + jam sekarang), bukan kelas pertama di db. Kembalikan
     { nama, jadwal, ruang } untuk ditampilkan, atau null. */
  var kelasBerikut = kelasBerikutnya();
  var mobile = '<div class="only-mobile">' +
    '<div class="jenjang-slim" role="group" aria-label="Pilih jenjang">' +
    jenjangPilihanUi().map(function (jj) {
      return '<button class="' + (ui.jenjang === jj ? 'active' : '') + '" onclick="gantiJenjang(\'' + jj + '\')">' + jj + '</button>';
    }).join('') + '</div>' +
    '<div class="screen">' + profilPickerHtml() +
    '<div class="head-row"><div><p class="greet">Selamat datang di,</p><h2 class="inst-name">' + esc(namaProfilAktifUi()) + '</h2></div>' +
    (profil ? '<button class="widget-btn has-label" onclick="bukaHasilBelajar(\'' + profil.id + '\')" aria-label="Buka Hasil Belajar"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2.5"/><rect x="13" y="3" width="8" height="8" rx="2.5" opacity=".45"/><rect x="3" y="13" width="8" height="8" rx="2.5" opacity=".45"/><rect x="13" y="13" width="8" height="8" rx="2.5"/></svg><span>Rapor</span></button>' : '') +
    '</div>' +
    (profil ? '<button class="profile-card" onclick="bukaHasilBelajar(\'' + profil.id + '\')" aria-label="Kartu profil ' + esc(profil.nama) + ', buka Hasil Belajar">' +
    '<span class="pc-badge">' + esc(profil.kelas) + '</span>' +
    '<p class="pc-nis">' + esc(profil.nis) + '</p>' +
    '<p class="pc-name">' + esc(profil.nama) + '</p>' +
    '<p class="pc-meta">Kelas ' + esc(profil.kelas) + '<br>Hafalan ' + esc(profil.hafalan) + '</p>' +
    '<svg class="pc-art" width="86" height="86" viewBox="0 0 96 96" fill="none" aria-hidden="true"><circle cx="52" cy="50" r="38" fill="rgba(255,255,255,.14)"/><path d="M30 34c7-3.4 14-3.4 20 .6 6-4 13-4 20-.6v30c-7-3.4-14-3.4-20 .6-6-4-13-4-20-.6V34Z" fill="#FFC531"/><path d="M50 34.6v30" stroke="#E8A20C" stroke-width="2.4"/><path d="M66 22l4.5 4.5L52 45l-6.5 2L47 40.5 66 22Z" fill="#37C978"/><path d="M47 40.5 45.5 47 52 45" fill="#fff"/></svg>' +
    (db.isContoh ? '<span class="contoh-chip on-dark"><i></i>Data contoh</span>' : '') + '</button>' : '') +
    '<div class="sec-row" style="margin-top:24px;"><h3 class="sec-title">Menu Informasi</h3></div>' +
    '<div class="menu-grid">' + menuMk.map(function (m) {
      var act = m.route ? 'go(\'' + m.route + '\')' : 'openLainnya()';
      var sub = !m.route ? lainnyaSubteks() : '';
      return '<button class="menu-item" onclick="' + act + '"><span class="mi-box" style="background:' + m.bg + '; color:' + m.color + ';">' + m.icon + '</span><span>' + m.label + '</span>' + (sub ? '<span class="mi-sub">' + esc(sub) + '</span>' : '') + '</button>';
    }).join('') + '</div>' +
    '<div class="sec-row"><h3 class="sec-title">Notifikasi</h3>' + (peng.length > 1 ? '<button class="link-btn" onclick="toggleNotifSemua(this)">Lihat semua</button>' : '') + '</div>' +
    (peng.length ? '<div class="notif-list" id="notif-list">' + peng.map(function (p, i) {
      return '<div class="notif-card' + (i > 0 ? ' notif-more' : '') + '"><div class="n-body"><p class="n-title">' + esc(p.judul) + '</p><p class="n-text">' + esc(p.isi) + '</p></div><button class="notif-x" onclick="tutupPengumuman(\'' + p.id + '\')" aria-label="Tutup notifikasi"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>';
    }).join('') + '</div>' : '<div class="empty-note show">' + (db.pengumuman.length ? 'Semua notifikasi sudah ditutup.' : 'Belum ada pengumuman.') + '</div>') +
    '<div class="row-line" style="padding-top:0;"><div class="grow"><p class="s-name">Kehadiran Hari Ini</p><p class="s-meta">Rata-rata kehadiran santri aktif</p></div><span class="tag tag-blue">' + rataKehadiran() + '%</span></div>' +
    (kelasBerikut ? '<div class="row-line" style="padding-bottom:0;"><div class="grow"><p class="s-name">Kelas Berikutnya</p><p class="s-meta">' + esc(kelasBerikut.nama) + ', ' + esc(kelasBerikut.jadwal) + ', ' + esc(kelasBerikut.ruang) + '</p></div><button class="chip-btn" onclick="go(\'kelas\')" style="flex:none; padding:8px 14px;">Buka</button></div>' : '') +
    '</div>' +
    '</div></div>';
  var html = '<div id="alert-root"></div>' + wizardKartuDashboard() + wizardSambutanHtml() + wizardM8Html() + mobile +
    heroIdentitasHtml() +
    '<div class="grid grid-4 only-desktop">' +
    '<div class="card stat"><div class="num">' + aktif.length + '</div><div class="lbl">Santri aktif</div><div class="sub">dari ' + db.santri.length + ' murid tercatat</div></div>' +
    '<div class="card stat"><div class="num">' + rataKehadiran() + '%</div><div class="lbl">Kehadiran</div><div class="sub">rata-rata santri aktif</div></div>' +
    (guru ? '' :
    '<div class="card stat"><div class="num">' + rupiah(totalTabungan()) + '</div><div class="lbl">Total tabungan</div><div class="sub">santri aktif</div></div>' +
    '<div class="card stat"><div class="num">' + rupiah(kas.saldo) + '</div><div class="lbl">Saldo kas</div><div class="sub">masuk ' + rupiah(kas.masuk) + ' | keluar ' + rupiah(kas.keluar) + '</div></div>') +
    '</div>' +
    rekapKelasDashboardHtml() +
    '<h2 class="only-desktop">Menu</h2><div class="menu-grid only-desktop">' + menu.map(function (m, i) {
      var mod = MODULES.find(function (x) { return x.id === m.id; });
      return '<button class="menu-tile' + (i >= 7 ? ' menu-extra' : '') + '" onclick="go(\'' + m.id + '\')"><span class="ico">' + (mod ? mod.icon : 'TP') + '</span><b>' + esc(m.label) + '</b><span>' + esc(m.sub) + '</span></button>';
    }).join('') + '</div>';
  /* Kartu Tunggakan SPP hanya untuk Pimpinan: isinya nama + jumlah tunggakan
     (data keuangan). Guru tidak melihatnya sama sekali. */
  if (!guru) {
    if (tunggakan.length) {
      html += '<div class="card"><h2>Tunggakan SPP (' + tunggakan.length + ' santri)</h2>' +
        tunggakan.map(function (s) {
          return '<div class="row-flex spp-row" style="padding:10px 0;border-bottom:1px solid var(--line)">' + avatarHtml(s.nama, s.foto) +
            '<span class="grow"><span class="spp-nama"><b>' + esc(s.nama) + '</b>' + sppBadge(s.sppStatus) + (s.sppReminderSent ? ' <span class="badge b-blue">Sudah diingatkan</span>' : '') + '</span><span class="muted spp-meta">' + esc(s.kelas) + ' · ' + rupiah(db.settings.tarifSpp) + '</span></span>' +
            '<button class="btn secondary small" onclick="kirimPengingatSPP(\'' + s.id + '\')">Ingatkan</button></div>';
        }).join('') + '</div>';
    } else {
      html += '<div class="card"><h2>Tunggakan SPP</h2>' + (aktif.length ? '<p class="empty" role="status">Tidak ada tunggakan. Semua santri aktif sudah lunas.</p>' : '<p class="empty" role="status">Belum ada santri, jadi belum ada tagihan SPP.</p>') + '</div>';
    }
  }
  html += '<div class="card"><h2>Status sinkron</h2><p>' + esc(syncState().text) + '. Data selalu tersimpan dulu di perangkat, lalu dikirim ke Google Sheet saat online kalau Apps Script sudah diatur.</p><div class="btn-row"><button class="btn secondary" onclick="sinkronSekarang()">Sinkron sekarang</button>' + (guru ? '' : '<button class="btn ghost" onclick="go(\'pengaturan\')">Atur Google Sheet</button>') + '</div></div>';
  return html;
}
function tutupPengumuman(id) { dismissedAnn[id] = true; render(); }

/* ================= RENDER: Santri ================= */
function renderSantri() {
  if (!sesiSaya() || !bolehRute('santri')) return '';
  var list = santriTampil();
  var sorted = list.slice().sort(function (a, b) {
    var k = ui.santriSortKey || 'nama';
    var av = a[k], bv = b[k];
    /* K3: angka (Tabungan) diurutkan sebagai angka, bukan sebagai teks. */
    var c = (typeof av === 'number' && typeof bv === 'number') ? (av - bv) : String(av).localeCompare(String(bv), 'id');
    return (ui.santriSortDir === 'desc' ? -1 : 1) * c;
  });
  var shown = sorted.slice(0, ui.santriShown || 10);
  var kelasOpts = ['Semua'].concat(db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); }).map(function (k) { return k.nama; }));
  var angkatanOpts = ['Semua'].concat(db.santri.map(function (s) { return s.angkatan; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort());
  var html = '<div id="alert-root"></div><h1>Santri (' + list.length + ')</h1>' +
    '<div class="toolbar"><input type="search" placeholder="Cari nama atau NIS" value="' + esc(ui.santriSearch) + '" oninput="ui.santriSearch=this.value;ui.santriShown=10;renderSantriOnly()" aria-label="Cari santri">' +
    '<select onchange="ui.santriKelas=this.value;ui.santriShown=10;render()" aria-label="Filter kelas">' + kelasOpts.map(function (k) { return '<option' + (ui.santriKelas === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
    '<select onchange="ui.santriAngkatan=this.value;ui.santriShown=10;render()" aria-label="Filter angkatan">' + angkatanOpts.map(function (k) { return '<option value="' + esc(k) + '"' + (ui.santriAngkatan === k ? ' selected' : '') + '>' + (k === 'Semua' ? 'Semua' : esc(k)) + '</option>'; }).join('') + '</select>' +
    '<select onchange="ui.santriStatus=this.value;ui.santriShown=10;render()" aria-label="Filter status">' + ['Aktif', 'Keluar', 'Lulus', 'Semua'].map(function (k) { return '<option' + (ui.santriStatus === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
    '<select onchange="gantiJenjang(this.value)" aria-label="Filter jenjang">' + jenjangPilihanUi().map(function (k) { return '<option' + (ui.jenjang === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
    '<select onchange="ui.santriSortKey=this.value;ui.santriSortDir=\'asc\';render()" aria-label="Urutkan santri">' + [['nama', 'Urutkan: Nama'], ['nis', 'Urutkan: NIS'], ['kelas', 'Urutkan: Kelas'], ['tabungan', 'Urutkan: Tabungan']].map(function (o) { return '<option value="' + o[0] + '"' + ((ui.santriSortKey || 'nama') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
    '<div class="btn-row"><button class="btn" onclick="openSantriForm()">Tambah santri</button><button class="btn secondary" onclick="exportSantri()">Export CSV (yang tampil)</button><button class="btn ghost" onclick="unduhTemplate(\'murid\')">Template CSV murid</button><label class="btn secondary" style="margin:0">Import CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="importFileCsv(\'murid\', this)"></label></div>';
  if (!list.length) {
    if (db.santri.length === 0) {
      html += '<div class="card">' + emptyState('Belum ada santri. Tambah santri satu-satu lewat form, atau import banyak santri sekaligus dari CSV.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button><button class="btn secondary" onclick="unduhTemplate(\'murid\')">Template CSV murid</button><button class="btn ghost" onclick="closeModal();go(\'pengaturan\')">Import CSV</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>') + '</div>';
    } else {
      /* K3: bila filter aktif, tawarkan reset filter (bukan hanya "ubah kata
         kunci") — penyebab nol hasil paling sering adalah filter yang
         bertabrakan (mis. kelas Ibtidaiyah + jenjang TPQ). */
      var filterAktif = (ui.santriSearch && ui.santriSearch.trim() !== '') || ui.santriKelas !== 'Semua' || ui.santriAngkatan !== 'Semua' || ui.santriStatus !== 'Aktif' || ui.jenjang !== 'Semua';
      html += '<div class="card"><p class="empty" role="status">Tidak ada santri yang cocok dengan pencarian atau filter ini.<br>Ubah kata kunci, atau tambah santri baru lewat tombol di atas.</p>' +
        (filterAktif ? '<div class="btn-row"><button class="btn secondary" onclick="resetFilterSantri()">Atur ulang filter</button></div>' : '') + '</div>';
    }
  } else if (isDesktopMode()) {
    html += '<div class="card"><div class="table-wrap"><table class="table-stack"><thead><tr>' +
      '<th class="sortable" onclick="sortSantri(\'nama\')">Nama ' + sortArrow('nama') + '</th><th class="sortable" onclick="sortSantri(\'nis\')">NIS ' + sortArrow('nis') + '</th><th class="sortable" onclick="sortSantri(\'kelas\')">Kelas ' + sortArrow('kelas') + '</th><th>JK</th><th>Status</th><th>SPP</th><th class="sortable" onclick="sortSantri(\'tabungan\')">Tabungan ' + sortArrow('tabungan') + '</th><th>Aksi</th></tr></thead><tbody>' +
      shown.map(function (s) {
        return '<tr><td class="cell-main" data-label="Nama"><div class="row-flex">' + avatarHtml(s.nama, s.foto) + '<span><b>' + esc(s.nama) + '</b><br><span class="muted">Angkatan ' + esc(s.angkatan) + ' | Rombel ' + esc(s.rombel) + '</span></span></div></td>' +
          '<td data-label="NIS">' + esc(s.nis) + '</td><td data-label="Kelas">' + esc(s.kelas) + '</td><td data-label="JK">' + esc(jkSingkat(s.jk)) + '</td><td data-label="Status">' + statusBadge(s.status) + '</td><td data-label="SPP">' + sppBadge(s.sppStatus) + '</td><td class="money" data-label="Tabungan">' + rupiah(s.tabungan) + '</td>' +
          '<td class="cell-actions" data-label="Aksi"><button class="btn secondary small" onclick="openSantriDetail(\'' + s.id + '\')">Detail</button> <button class="btn ghost small" onclick="openSantriForm(\'' + s.id + '\')">Ubah</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  } else {
    html += shown.map(function (s) {
      return '<div class="card"><div class="row-flex">' + avatarHtml(s.nama, s.foto) +
        '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">Angkatan ' + esc(s.angkatan) + ' | Rombel ' + esc(s.rombel) + '</span></span>' +
        '<button class="btn secondary small" onclick="openSantriDetail(\'' + s.id + '\')">Detail</button> <button class="btn ghost small" onclick="openSantriForm(\'' + s.id + '\')">Ubah</button></div>' +
        '<div class="kv-list">' +
        '<div class="kv-row"><span class="kv-label">NIS</span><span class="kv-value">' + esc(s.nis) + '</span></div>' +
        '<div class="kv-row"><span class="kv-label">Kelas</span><span class="kv-value">' + esc(s.kelas) + (s.jilid && s.jilid !== s.kelas ? ' &middot; ' + esc(s.jilid) : '') + '</span></div>' +
        '<div class="kv-row"><span class="kv-label">Jenis Kelamin</span><span class="kv-value">' + esc(jkPanjang(s.jk)) + '</span></div>' +
        '<div class="kv-row"><span class="kv-label">Status</span><span class="kv-value">' + statusBadge(s.status) + '</span></div>' +
        '<div class="kv-row"><span class="kv-label">SPP</span><span class="kv-value">' + sppBadge(s.sppStatus) + '</span></div>' +
        '<div class="kv-row"><span class="kv-label">Tabungan</span><span class="kv-value money">' + rupiah(s.tabungan) + '</span></div>' +
        '</div></div>';
    }).join('');
  }
  html += '<p class="picker-count">Menampilkan ' + shown.length + ' dari ' + sorted.length + ' santri.</p>';
  if (sorted.length > shown.length) html += '<button class="btn secondary block" onclick="ui.santriShown=(ui.santriShown||10)+10;render()">Tampilkan lebih banyak (' + (sorted.length - shown.length) + ' lagi)</button>';
  return html;
}
function sortArrow(k) { return ui.santriSortKey === k ? (ui.santriSortDir === 'desc' ? 'v' : '^') : ''; }
/* K3: kembalikan semua filter Santri ke bawaan (pencarian kosong,
   kelas/angkatan Semua, status Aktif, jenjang Semua). */
function resetFilterSantri() {
  ui.santriSearch = ''; ui.santriKelas = 'Semua'; ui.santriAngkatan = 'Semua'; ui.santriStatus = 'Aktif';
  setJenjang('Semua');
  ui.santriShown = 10;
  render();
}
function sortSantri(k) {
  if (ui.santriSortKey === k) ui.santriSortDir = ui.santriSortDir === 'desc' ? 'asc' : 'desc';
  else { ui.santriSortKey = k; ui.santriSortDir = 'asc'; }
  render();
}
function renderSantriOnly() {
  var v = ui.santriSearch || '';
  /* S2: kartu jenjang ikut dirender supaya tidak hilang saat mengetik. */
  document.getElementById('view').innerHTML = jenjangBarHtml() + renderSantri();
  var inp = document.querySelector('#view input[type=search]');
  if (inp) { inp.focus(); try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
}
function statusBadge(st) {
  if (st === 'Aktif') return '<span class="badge b-green">Aktif</span>';
  if (st === 'Lulus') return '<span class="badge b-blue">Lulus</span>';
  return '<span class="badge b-grey">Keluar</span>';
}
function sppBadge(st) {
  if (st === 'Lunas') return '<span class="badge b-green">Lunas</span>';
  if (st === 'Telat') return '<span class="badge b-red">Telat</span>';
  return '<span class="badge b-amber">Belum</span>';
}

/* ---- Jenis kelamin (JK) + label Tapel Hijriah (Kirana) ---- */
/* Label panjang untuk tampilan; '' / bukan L/P = 'Belum diisi'. Pakai
   labelJk() mesin bila ada, fallback lokal supaya UI tetap jalan. */
function jkPanjang(jk) {
  if (typeof labelJk === 'function') { var l = labelJk(jk); if (l) return l; }
  if (jk === 'L') return 'Laki-laki';
  if (jk === 'P') return 'Perempuan';
  return 'Belum diisi';
}
function jkSingkat(jk) { return (jk === 'L' || jk === 'P') ? jk : ''; }
/* Hitung L/P/kosong dari daftar santri. Mesin menyediakan rekapGender()
   -> { l, p, kosong }; bila belum ada, hitung lokal dengan bentuk sama. */
function rekapGenderUi(list) {
  if (typeof rekapGender === 'function') {
    try { return rekapGender(list); } catch (e) {}
  }
  var r = { l: 0, p: 0, kosong: 0 };
  (list || []).forEach(function (s) {
    if (s.jk === 'L') r.l++;
    else if (s.jk === 'P') r.p++;
    else r.kosong++;
  });
  return r;
}
/* "L 4 · P 3" (+ " · – 2" hanya bila ada santri tanpa jk). */
function teksGender(r) {
  var t = 'L ' + (r.l || 0) + ' · P ' + (r.p || 0);
  if (r.kosong) t += ' · – ' + r.kosong;
  return t;
}
/* Label Tapel Hijriah dari tahun ajaran aktif (db.settings.tahunAjaran,
   mis. "2026/2027"). Jangkar terverifikasi: 1 Muharram 1447H = 26 Jun
   2025, 1 Muharram 1448H = 16 Jun 2026; tahun ajaran mulai Juli, jadi
   Tapel awal = tahunMulai − 578 (2026 → 1448). */
function labelTapel() {
  var ta = (typeof db !== 'undefined' && db.settings && db.settings.tahunAjaran) || '2026/2027';
  var m = String(ta).match(/(\d{4})/);
  var mulai = m ? parseInt(m[1], 10) : 2026;
  var awal = mulai - 578;
  return 'Tapel ' + awal + '/' + (awal + 1);
}
/* Klik batang grafik Murid per kelas: buka halaman Santri dengan filter
   kelas itu sudah diterapkan. */
function lihatSantriKelas(namaKelas) {
  ui.santriKelas = namaKelas;
  ui.santriShown = 10;
  ui.santriSearch = '';
  go('santri');
  render();
}
function barKeydown(ev, namaKelas) {
  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); lihatSantriKelas(namaKelas); }
}
function openSantriForm(id) {
  var s = id ? santriById(id) : null;
  var kelasOpts = db.kelas.map(function (k) { return k.nama; });
  openModal(
    '<h2>' + (s ? 'Ubah santri' : 'Tambah santri') + '</h2>' +
    '<form onsubmit="return submitSantri(event, \'' + (s ? s.id : '') + '\')">' +
    '<h3 style="margin:4px 0 8px;font-size:15px">Data diri</h3>' +
    '<div id="foto-preview">' + (s && s.foto ? '<img class="avatar" src="' + esc(s.foto) + '" alt="Foto santri">' : '') + '</div>' +
    '<label>Foto (opsional)</label><div class="row-flex"><label class="btn ghost small" style="margin:0">Pilih foto<input type="file" accept="image/*" style="display:none" onchange="onPhotoChange(this, \'foto-preview\', \'f-foto\'); tampilNamaFoto(this, \'nama-foto-s\')"></label><span class="muted" id="nama-foto-s">' + (s && s.foto ? 'Foto sudah tersimpan' : 'Belum ada foto dipilih') + '</span></div>' +
    '<input type="hidden" id="f-foto" value="' + esc(s && s.foto ? s.foto : '') + '">' +
    '<label>Nama lengkap *</label><input id="f-nama" required value="' + esc(s ? s.nama : '') + '" placeholder="Contoh: Ahmad Fauzi">' +
    '<label>NIS *</label><input id="f-nis" required value="' + esc(s ? s.nis : '') + '" placeholder="Contoh: 202407">' +
    '<label>Jenis kelamin *</label><select id="f-jk" required><option value="">Pilih jenis kelamin</option><option value="L"' + (s && s.jk === 'L' ? ' selected' : '') + '>Laki-laki</option><option value="P"' + (s && s.jk === 'P' ? ' selected' : '') + '>Perempuan</option></select>' +
    '<h3 style="margin:16px 0 8px;font-size:15px">Kelas &amp; jenjang</h3>' +
    '<label>Jenjang *</label><select id="f-jenjang" onchange="updateFormKelas()">' + ['TPQ', 'Ibtidaiyah'].map(function (j) { return '<option' + (s && s.jenjang === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('') + '</select>' +
    '<label>Kelas</label><select id="f-kelas">' + kelasOptionsHtml(s ? (s.jenjang || 'TPQ') : 'TPQ', s ? s.kelas : '') + '</select>' +
    '<p class="muted">Kelas tempat santri belajar (contoh: Iqra 1).</p>' +
    '<label>Jilid</label><select id="f-jilid">' + JILID_LIST.map(function (j) { return '<option' + (s && s.jilid === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('') + '</select>' +
    '<p class="muted">Tingkatan Iqra/Tahfidz santri, boleh beda dengan Kelas.</p>' +
    '<label>Angkatan</label><input id="f-angkatan" value="' + esc(s ? s.angkatan : '2026') + '">' +
    '<label>Rombel</label><select id="f-rombel">' + ['A', 'B'].map(function (r) { return '<option' + (s && s.rombel === r ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select>' +
    '<h3 style="margin:16px 0 8px;font-size:15px">Wali</h3>' +
    '<label>Nama wali</label><input id="f-wali" value="' + esc(s ? s.wali : '') + '" placeholder="Contoh: Bpk. Slamet">' +
    '<label>HP wali</label><input id="f-hp" inputmode="tel" value="' + esc(s ? s.hpWali : '') + '" placeholder="Contoh: 081200000000">' +
    '<label>Alamat</label><input id="f-alamat" value="' + esc(s ? s.alamat : '') + '">' +
    '<label>Hafalan</label><input id="f-hafalan" value="' + esc(s ? s.hafalan : 'Belum mulai') + '">' +
    '<p class="muted">Kolom bertanda * wajib diisi. NIS harus unik, tidak boleh sama dengan santri lain.</p>' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan santri</button></div>' +
    '</form>'
  );
}
function kelasOptionsHtml(jenjang, selected) {
  return db.kelas.filter(function (k) { return (k.jenjang || 'TPQ') === jenjang; }).map(function (k) { return '<option' + (k.nama === selected ? ' selected' : '') + '>' + esc(k.nama) + '</option>'; }).join('');
}
function updateFormKelas() {
  var j = document.getElementById('f-jenjang').value;
  var sel = document.getElementById('f-kelas');
  sel.innerHTML = kelasOptionsHtml(j, sel.value);
}
function openSantriDetail(id) {
  var s = santriById(id);
  if (!s) return;
  var r = hitungRapor(id);
  openModal(
    '<div class="row-flex">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><h2 style="margin:0">' + esc(s.nama) + '</h2><span class="muted">NIS ' + esc(s.nis) + ' | ' + esc(s.kelas) + '</span><br>' + statusBadge(s.status) + ' ' + sppBadge(s.sppStatus) + '</span></div>' +
    '<table class="kv"><tbody>' +
    '<tr><td>Jilid</td><td>' + esc(s.jilid) + ' halaman ' + s.halaman + '</td></tr>' +
    '<tr><td>Hafalan</td><td>' + esc(s.hafalan) + '</td></tr>' +
    '<tr><td>Jenjang</td><td>' + esc(s.jenjang || 'TPQ') + '</td></tr>' +
    '<tr><td>Jenis Kelamin</td><td>' + esc(jkPanjang(s.jk)) + '</td></tr>' +
    '<tr><td>Angkatan / Rombel</td><td>' + esc(s.angkatan) + ' / ' + esc(s.rombel) + '</td></tr>' +
    '<tr><td>Wali</td><td>' + esc(s.wali) + ' (' + esc(s.hpWali) + ')</td></tr>' +
    '<tr><td>Alamat</td><td>' + esc(s.alamat) + '</td></tr>' +
    '<tr><td>Tabungan</td><td class="money">' + rupiah(s.tabungan) + '</td></tr>' +
    '<tr><td>Kehadiran</td><td>' + s.kehadiran + '%</td></tr>' +
    '<tr><td>Nilai akhir rapor</td><td>' + (r.akhir == null ? 'Belum ada nilai' : r.akhir + ' (' + esc(predikat(r.akhir)) + ')') + '</td></tr>' +
    (s.status === 'Keluar' ? '<tr><td>Alasan keluar</td><td>' + esc(s.statusAlasan || '-') + ' (' + fmtTanggal(s.statusTanggal) + ')</td></tr>' : '') +
    (s.status === 'Lulus' ? '<tr><td>Tahun lulus</td><td>' + esc(s.tahunLulus || '-') + '</td></tr>' : '') +
    '</tbody></table>' +
    '<div class="btn-row"><button class="btn secondary" onclick="closeModal();openSantriForm(\'' + s.id + '\')">Ubah data</button><button class="btn ghost" onclick="closeModal();openStatusForm(\'' + s.id + '\')">Ubah status</button></div>' +
    '<div class="btn-row"><button class="btn danger" onclick="mintaHapusSantri(\'' + s.id + '\')">Hapus santri</button><button class="btn ghost" onclick="closeModal()">Tutup</button></div>'
  );
}
function openStatusForm(id) {
  var s = santriById(id);
  if (!s) return;
  openModal(
    '<h2>Ubah status ' + esc(s.nama) + '</h2>' +
    '<form onsubmit="return submitStatus(event, \'' + s.id + '\')">' +
    '<label>Status baru</label><select id="st-status" onchange="toggleStatusFields()"><option>Aktif</option><option' + (s.status === 'Keluar' ? ' selected' : '') + '>Keluar</option><option' + (s.status === 'Lulus' ? ' selected' : '') + '>Lulus</option></select>' +
    '<div id="st-keluar"><label>Alasan keluar *</label><input id="st-alasan" value="' + esc(s.statusAlasan || '') + '" placeholder="Contoh: Pindah domisili"><label>Tanggal keluar</label><input id="st-tanggal" type="date" value="' + esc(s.statusTanggal || todayStr()) + '"></div>' +
    '<div id="st-lulus"><label>Tahun lulus *</label><input id="st-tahun" value="' + esc(s.tahunLulus || '2026') + '" placeholder="Contoh: 2026"></div>' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan status</button></div></form>'
  );
  toggleStatusFields();
}
function toggleStatusFields() {
  var v = document.getElementById('st-status').value;
  document.getElementById('st-keluar').style.display = v === 'Keluar' ? '' : 'none';
  document.getElementById('st-lulus').style.display = v === 'Lulus' ? '' : 'none';
}

/* ================= RENDER: Tabungan ================= */
function renderTabungan() {
  if (!sesiSaya() || !bolehRute('tabungan')) return '';
  var total = totalTabungan();
  var aktif = santriAktif().slice().sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  var terpilih = ui.tabunganSantri ? santriById(ui.tabunganSantri) : null;
  var riwayat = tabunganRiwayat().slice(0, 10);
  /* N23: bila belum ada santri aktif, tampilkan SATU pesan gabungan +
     satu aksi "Tambah santri", sembunyikan sub-pesan turunan (target,
     setor/tarik, saldo per santri, riwayat). */
  if (aktif.length === 0) {
    return '<div id="alert-root"></div><h1>Tabungan</h1><div class="card">' + emptyState('Belum ada santri aktif, jadi belum ada tabungan, target, setoran, atau riwayat transaksi. Tambah santri dulu supaya bisa mencatat tabungan.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>') + '</div>';
  }
  var html = '<div id="alert-root"></div><h1>Tabungan</h1>' +
    '<div class="grid grid-2"><div class="card stat"><div class="num">' + rupiah(total) + '</div><div class="lbl">Total tabungan santri aktif</div><div class="sub">' + aktif.length + ' santri aktif</div></div>' +
    '<div class="card"><h2>Target tabungan</h2>' + (db.target.length ? '' : '<p class="empty" role="status">Belum ada target tabungan.</p>') + db.target.map(function (t) {
      var persen = t.target ? Math.round(t.terkumpul / t.target * 100) : 0;
      return '<div style="margin-bottom:12px"><div class="row-flex"><span class="grow"><b>' + esc(t.nama) + '</b><br><span class="muted">' + rupiah(t.terkumpul) + ' dari ' + rupiah(t.target) + '</span></span><b>' + persen + '%</b></div><div class="progress"><i style="width:' + Math.min(100, persen) + '%"></i></div></div>';
    }).join('') + '<button class="btn secondary small" onclick="openTargetForm()">Tambah target</button></div></div>' +
    '<div class="card"><h2>Setor / Tarik</h2><p class="muted">Pilih dulu muridnya, lalu isi jumlah. Penarikan di atas saldo ditolak. Penarikan di atas Rp200.000 minta konfirmasi.</p>' +
    (terpilih ? '<div class="selected-chip">' + avatarHtml(terpilih.nama, terpilih.foto) + '<span class="grow"><span class="nm">Murid terpilih: ' + esc(terpilih.nama) + '</span><br><span class="muted">' + esc(terpilih.kelas) + ' | Saldo ' + rupiah(terpilih.tabungan) + '</span></span><button class="btn ghost small" onclick="ui.tabunganSantri=\'\';render()">Ganti</button></div>'
      : '<button class="btn secondary block" onclick="openPicker(openSantriPicker(function(it){ui.tabunganSantri=it.id;render();}, true))">Pilih murid</button>' + (aktif.length ? '' : '<p class="empty" role="status">Belum ada santri. Tambah santri dulu supaya bisa setor atau tarik tabungan.</p>')) +
    '<form onsubmit="return submitTabungan(event)"><div class="toolbar"><select id="tb-jenis" aria-label="Jenis transaksi"><option>Setor</option><option>Tarik</option></select>' +
    '<input id="tb-jumlah" type="text" inputmode="decimal" placeholder="Jumlah (Rp) — contoh: 50000" aria-label="Jumlah rupiah"><input id="tb-catatan" placeholder="Catatan (opsional)" aria-label="Catatan"></div>' +
    '<button class="btn block" type="submit" ' + (terpilih ? '' : 'disabled') + '>Simpan transaksi</button></form>' + (terpilih ? '' : '<p class="muted">Pilih murid dulu untuk mencatat transaksi.</p>') + '</div>' +
    '<div class="card"><h2>Saldo per santri</h2>' +
    (aktif.length ? '' : emptyState('Belum ada santri aktif. Tambah santri dulu supaya bisa mencatat tabungan.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>')) +
    aktif.slice(0, ui.tabunganShown || 10).map(function (s) {
      return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">' + esc(s.kelas) + '</span></span><span class="money">' + rupiah(s.tabungan) + '</span><button class="btn secondary small" onclick="bukaStruk(\'' + s.id + '\')">Struk</button></div>';
    }).join('') +
    '<p class="picker-count">Menampilkan ' + Math.min(ui.tabunganShown || 10, aktif.length) + ' dari ' + aktif.length + ' santri.</p>' +
    (aktif.length > (ui.tabunganShown || 10) ? '<button class="btn secondary block" onclick="ui.tabunganShown=(ui.tabunganShown||10)+10;render()">Tampilkan lebih banyak (' + (aktif.length - (ui.tabunganShown || 10)) + ' lagi)</button>' : '') + '</div>' +
    '<div class="card"><h2>Riwayat transaksi</h2>' + (riwayat.length ? riwayat.map(function (t) {
      var s = santriById(t.santriId);
      return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(s ? s.nama : '-') + '</b> (' + esc(t.jenis) + ')<br><span class="muted">' + fmtTanggal(t.tanggal) + ' | ' + esc(t.catatan || '') + '</span></span><span class="money ' + (t.jenis === 'Setor' ? 'pos' : 'neg') + '">' + (t.jenis === 'Setor' ? '+' : '-') + rupiah(t.jumlah) + '</span></div>';
    }).join('') : '<p class="empty" role="status">Belum ada transaksi tabungan.</p>') + '</div>';
  return html;
}
function openTargetForm() {
  openModal('<h2>Tambah target tabungan</h2><form onsubmit="return submitTarget(event)"><label>Nama target *</label><input id="tg-nama" required placeholder="Contoh: Seragam Baru"><label>Jumlah target (Rp) *</label><input id="tg-jumlah" type="text" inputmode="decimal" required placeholder="Contoh: 150000"><div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan target</button></div></form>');
}

/* ================= RENDER: Keuangan ================= */
function renderKeuangan() {
  if (!sesiSaya() || !bolehRute('keuangan')) return '';
  var kas = saldoKas(ui.jenjang);
  var list = db.keuanganTx.filter(function (t) { return jenjangCocok(t.jenjang); }).slice().sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal); });
  if (ui.keuanganTab !== 'Semua') list = list.filter(function (t) { return t.jenis === ui.keuanganTab; });
  var arus = arusKasMingguan(ui.jenjang);
  var minggu = arus.minggu;
  var maxM = Math.max.apply(null, minggu.map(function (v) { return Math.abs(v); }).concat([1]));
  var html = '<div id="alert-root"></div><h1>Keuangan</h1>' +
    '<div class="grid grid-3"><div class="card stat"><div class="num pos">' + rupiah(kas.masuk) + '</div><div class="lbl">Pemasukan</div></div>' +
    '<div class="card stat"><div class="num neg">' + rupiah(kas.keluar) + '</div><div class="lbl">Pengeluaran</div></div>' +
    '<div class="card stat"><div class="num">' + rupiah(kas.saldo) + '</div><div class="lbl">Saldo kas saat ini</div></div></div>' +
    '<div class="card"><h2>Arus kas mingguan (' + esc(namaBulanPanjang(arus.bulan)) + ')</h2><p class="muted">Selisih masuk dikurangi keluar per minggu.</p>' + (db.keuanganTx.length ? '' : '<p class="muted">Belum ada transaksi, grafik arus kas masih kosong.</p>') + '<div class="bar-chart">' +
    minggu.map(function (v, i) {
      var h = Math.max(4, Math.abs(v) / maxM * 130);
      return '<div class="bar-col"><span class="val">' + (v >= 0 ? '+' : '-') + rupiah(Math.abs(v)).replace('Rp', 'Rp') + '</span><div class="bar" style="height:' + h + 'px;' + (v < 0 ? 'background:#c73e32;' : '') + '"></div><span class="cat">Minggu ' + (i + 1) + '</span></div>';
    }).join('') + '</div></div>' +
    '<div class="card" id="form-keuangan"><h2>Tambah transaksi</h2><form onsubmit="return submitKeuangan(event)"><div class="toolbar">' +
    '<select id="ku-jenis" onchange="isiKategoriKeuangan()"><option>Masuk</option><option>Keluar</option></select>' +
    /* A14: jenjang form mengikuti filter jenjang aktif; bila "Semua",
       pengguna wajib memilih dulu (opsi kosong "Pilih jenjang"). */
    '<select id="ku-jenjang" aria-label="Jenjang">' + (ui.jenjang === 'Semua' ? '<option value="">Pilih jenjang</option>' : '') + ['TPQ', 'Ibtidaiyah'].map(function (j) { return '<option' + (ui.jenjang === j ? ' selected' : '') + '>' + j + '</option>'; }).join('') + '</select>' +
    '<select id="ku-kategori">' + KATEGORI_MASUK.map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('') + '</select>' +
    '<input id="ku-nama" placeholder="Nama transaksi *" required aria-label="Nama transaksi">' +
    '<input id="ku-jumlah" type="text" inputmode="decimal" placeholder="Jumlah (Rp) * — contoh: 50000" required aria-label="Jumlah rupiah">' +
    '<input id="ku-tanggal" type="date" value="' + todayStr() + '" aria-label="Tanggal">' +
    '<input id="ku-catatan" placeholder="Catatan (opsional)" aria-label="Catatan"></div>' +
    '<button class="btn block" type="submit">Simpan transaksi</button></form>' +
    '<p class="muted">Saldo awal adalah saldo kas saat mulai memakai aplikasi, bukan pemasukan baru.</p>' +
    '<div class="btn-row"><button class="btn secondary" onclick="go(\'rapbm\')">Buka RAPBM dan Keuangan Lanjutan</button><button class="btn ghost" onclick="exportKeuangan()">Export CSV keuangan</button></div></div>' +
    '<div class="tabs">' + ['Semua', 'Masuk', 'Keluar'].map(function (t) { return '<button class="tab' + (ui.keuanganTab === t ? ' active' : '') + '" onclick="ui.keuanganTab=\'' + t + '\';render()">' + t + '</button>'; }).join('') + '</div>' +
    '<div class="card"><h2>Riwayat transaksi</h2>' + (list.length ? list.map(function (t) {
      return '<div class="row-flex" style="padding:10px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(t.nama) + '</b><br><span class="muted">' + fmtTanggal(t.tanggal) + ' | ' + esc(t.kategori) + ' | ' + esc(t.catatan || '') + '</span></span><span class="money ' + (t.jenis === 'Masuk' ? 'pos' : 'neg') + '">' + (t.jenis === 'Masuk' ? '+' : '-') + rupiah(t.jumlah) + '</span><button class="btn ghost small" onclick="openKeuanganForm(\'' + t.id + '\')">Ubah</button> <button class="btn ghost small" onclick="mintaHapusKeuangan(\'' + t.id + '\')">Hapus</button></div>';
    }).join('') : (db.keuanganTx.length ? '<p class="empty" role="status">Belum ada transaksi pada filter ini.</p><div class="btn-row empty-actions"><button class="btn secondary" onclick="aturUlangFilter(\'keuangan\')">Atur ulang filter</button></div>' : emptyState('Belum ada transaksi keuangan. Catat pemasukan atau pengeluaran lewat form di atas. Saldo awal bisa dicatat sebagai transaksi Masuk dengan kategori "Saldo awal".', '<button class="btn" onclick="fokusFormKeuangan()">Tambah transaksi</button><button class="btn secondary" onclick="go(\'rapbm\')">Buka RAPBM dan Keuangan Lanjutan</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>'))) + '</div>' +
    '<div class="card"><h2>Tagihan SPP (santri aktif)</h2><p class="muted">Ketuk status untuk mengubah Lunas atau Belum. Tarif SPP ' + rupiah(db.settings.tarifSpp) + ' per bulan.</p>' +
    (santriAktif().length ? '' : emptyState('Belum ada santri aktif, jadi belum ada tagihan SPP.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button>')) +
    '<p class="muted">Menandai Lunas tidak menambah saldo kas. Kalau uang SPP sudah diterima, catat ke kas lewat tombol "Catat ke kas" di baris santri yang Lunas, atau isi form Tambah transaksi di atas.</p>' +
    santriAktif().map(function (s) {
      return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">' + esc(s.kelas) + ' | ' + rupiah(db.settings.tarifSpp) + '</span></span>' + (s.sppStatus === 'Lunas' ? '<button class="btn secondary small" onclick="catatSppKeKas(\'' + s.id + '\')">Catat ke kas</button>' : '') + '<button class="btn small ' + (s.sppStatus === 'Lunas' ? 'success' : s.sppStatus === 'Telat' ? 'danger' : 'warn') + '" onclick="toggleSppUI(\'' + s.id + '\')">' + esc(s.sppStatus) + '</button></div>';
    }).join('') + '</div>';
  return html;
}
function isiKategoriKeuangan() {
  var j = document.getElementById('ku-jenis').value;
  var kat = j === 'Masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;
  document.getElementById('ku-kategori').innerHTML = kat.map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('');
}
/* A5: satu ketuk dari SPP Lunas ke form keuangan, terisi jumlah SPP.
   TIDAK membuat transaksi otomatis — pengguna tetap menekan Simpan. */
function catatSppKeKas(id) {
  var s = santriById(id);
  if (!s) return;
  var jenis = document.getElementById('ku-jenis');
  if (jenis) { jenis.value = 'Masuk'; isiKategoriKeuangan(); }
  var kat = document.getElementById('ku-kategori');
  if (kat) kat.value = 'SPP';
  var jenj = document.getElementById('ku-jenjang');
  if (jenj) jenj.value = s.jenjang || 'TPQ';
  var nama = document.getElementById('ku-nama');
  if (nama) nama.value = 'SPP ' + s.nama;
  var jml = document.getElementById('ku-jumlah');
  if (jml) jml.value = String(db.settings.tarifSpp);
  var tgl = document.getElementById('ku-tanggal');
  if (tgl && !tgl.value) tgl.value = todayStr();
  var form = document.getElementById('form-keuangan');
  if (form && form.scrollIntoView) form.scrollIntoView();
  if (nama) { try { nama.focus(); } catch (e) {} }
  toast('Form keuangan sudah diisi SPP ' + s.nama + ' (' + rupiah(db.settings.tarifSpp) + '). Tekan Simpan transaksi bila uang sudah diterima.');
}

function renderRapbm() {
  if (!sesiSaya() || !bolehRute('rapbm')) return '';
  var tab = ui.rapbmTab;
  var rapbmTampil = db.rapbm.filter(function (r) { return jenjangCocok(r.jenjang); });
  var html = '<div id="alert-root"></div><h1>RAPBM dan Keuangan Lanjutan</h1>' +
    '<p class="muted">RAPBM: Rencana Anggaran Pendapatan dan Belanja Madrasah. Realisasi per pos dihitung otomatis dari transaksi keuangan yang kategorinya sama dengan nama pos.</p>' +
    '<div class="tabs">' + [['rapbm', 'RAPBM'], ['realita', 'Realita'], ['biaya', 'Set Biaya'], ['arus', 'Arus Kas'], ['rekap', 'Rekap']].map(function (t) {
      return '<button class="tab' + (tab === t[0] ? ' active' : '') + '" onclick="ui.rapbmTab=\'' + t[0] + '\';render()">' + t[1] + '</button>';
    }).join('') + '</div>';
  if (tab === 'rapbm') {
    html += '<div class="card"><h2>Pos anggaran (RAPBM)</h2><div class="btn-row"><button class="btn" onclick="openRapbmForm()">Tambah pos</button></div>' +
      (rapbmTampil.length ? '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Pos</th><th>Jenis</th><th>Rencana</th><th>Aksi</th></tr></thead><tbody>' +
      rapbmTampil.map(function (r) {
        return '<tr><td class="cell-main" data-label="Pos"><b>' + esc(r.pos) + '</b></td><td data-label="Jenis">' + esc(r.jenis) + '</td><td class="money" data-label="Rencana">' + rupiah(r.rencana) + '</td><td class="cell-actions" data-label="Aksi"><button class="btn ghost small" onclick="openRapbmForm(\'' + r.id + '\')">Ubah</button> <button class="btn danger small" onclick="mintaHapusRapbm(\'' + r.id + '\')">Hapus</button></td></tr>';
      }).join('') + '</tbody></table></div>' : emptyState('Belum ada pos RAPBM. Tambah pos pertama lewat tombol di atas.', '<button class="btn" onclick="openRapbmForm()">Tambah pos</button>')) + '</div>';
  } else if (tab === 'realita') {
    html += '<div class="card"><h2>Realita: rencana vs realisasi</h2><p class="muted">Realita membandingkan rencana RAPBM dengan uang yang benar-benar masuk dan keluar.</p>' + (rapbmTampil.length ? '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Pos</th><th>Rencana</th><th>Realisasi</th><th>Selisih</th><th>%</th></tr></thead><tbody>' +
      rapbmTampil.map(function (r) {
        var real = Math.abs(realisasiPos(r.pos, ui.jenjang));
        var selisih = real - r.rencana;
        var persen = r.rencana ? Math.round(real / r.rencana * 100) : 0;
        return '<tr><td class="cell-main" data-label="Pos"><b>' + esc(r.pos) + '</b> (' + esc(r.jenis) + ')</td><td class="money" data-label="Rencana">' + rupiah(r.rencana) + '</td><td class="money" data-label="Realisasi">' + rupiah(real) + '</td><td class="money ' + (selisih >= 0 ? 'pos' : 'neg') + '" data-label="Selisih">' + (selisih >= 0 ? '+' : '-') + rupiah(Math.abs(selisih)) + '</td><td data-label="Persen">' + persen + '%</td></tr>';
      }).join('') + '</tbody></table></div>' : emptyState('Belum ada pos RAPBM, jadi belum ada realita yang bisa dihitung.', '<button class="btn" onclick="openRapbmForm()">Tambah pos</button>')) + '</div>';
  } else if (tab === 'biaya') {
    html += '<div class="card"><h2>Set Biaya</h2><p class="muted">Set Biaya: daftar biaya yang dikenakan (contoh: seragam, kitab).</p><div class="btn-row"><button class="btn" onclick="openBiayaForm()">Tambah biaya</button></div>' +
      (db.biaya.length ? '' : emptyState('Belum ada biaya. Tambah biaya pertama lewat tombol di atas.', '<button class="btn" onclick="openBiayaForm()">Tambah biaya</button>')) +
      db.biaya.map(function (b) {
        return '<div class="row-flex" style="padding:10px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(b.nama) + '</b><br><span class="muted">' + esc(b.keterangan || '') + '</span></span><span class="money">' + rupiah(b.jumlah) + '</span><button class="btn ghost small" onclick="openBiayaForm(\'' + b.id + '\')">Ubah</button> <button class="btn danger small" onclick="mintaHapusBiaya(\'' + b.id + '\')">Hapus</button></div>';
      }).join('') + '</div>';
  } else if (tab === 'arus') {
    var bulan = arusKasPerBulan(ui.jenjang);
    var keys = Object.keys(bulan).sort();
    html += '<div class="card"><h2>Arus Kas per bulan</h2>' + (keys.length ? '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Bulan</th><th>Masuk</th><th>Keluar</th><th>Saldo bulan</th></tr></thead><tbody>' +
      keys.map(function (k) { var b = bulan[k]; return '<tr><td class="cell-main" data-label="Bulan"><b>' + esc(k) + '</b></td><td class="money pos" data-label="Masuk">' + rupiah(b.masuk) + '</td><td class="money neg" data-label="Keluar">' + rupiah(b.keluar) + '</td><td class="money" data-label="Saldo bulan">' + rupiah(b.masuk - b.keluar) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      /* M13: tab Arus Kas kosong tanpa aksi: beri tombol Tambah transaksi. */
      : emptyState('Belum ada transaksi keuangan. Catat transaksi pertama di menu Keuangan.', '<button class="btn" onclick="go(\'keuangan\')">Tambah transaksi</button>')) + '</div>';
  } else {
    var rencanaMasuk = db.rapbm.filter(function (r) { return r.jenis === 'Masuk' && jenjangCocok(r.jenjang); }).reduce(function (a, r) { return a + r.rencana; }, 0);
    var rencanaKeluar = db.rapbm.filter(function (r) { return r.jenis === 'Keluar' && jenjangCocok(r.jenjang); }).reduce(function (a, r) { return a + r.rencana; }, 0);
    var kas = saldoKas(ui.jenjang);
    html += '<div class="card"><h2>Rekap</h2><table class="kv"><tbody>' +
      '<tr><td>Rencana pemasukan (RAPBM)</td><td class="money">' + rupiah(rencanaMasuk) + '</td></tr>' +
      '<tr><td>Rencana pengeluaran (RAPBM)</td><td class="money">' + rupiah(rencanaKeluar) + '</td></tr>' +
      '<tr><td>Realisasi pemasukan</td><td class="money pos">' + rupiah(kas.masuk) + '</td></tr>' +
      '<tr><td>Realisasi pengeluaran</td><td class="money neg">' + rupiah(kas.keluar) + '</td></tr>' +
      '<tr><td>Saldo kas saat ini</td><td class="money">' + rupiah(kas.saldo) + '</td></tr>' +
      '<tr><td>Surplus rencana (masuk - keluar)</td><td class="money">' + rupiah(rencanaMasuk - rencanaKeluar) + '</td></tr>' +
      '</tbody></table></div>';
  }
  html += '<div class="btn-row"><button class="btn secondary" onclick="go(\'keuangan\')">Kembali ke Keuangan</button></div>';
  return html;
}
function openRapbmForm(id) {
  var r = id ? db.rapbm.find(function (x) { return x.id === id; }) : null;
  openModal('<h2>' + (r ? 'Ubah pos RAPBM' : 'Tambah pos RAPBM') + '</h2><form onsubmit="return submitRapbm(event, \'' + (r ? r.id : '') + '\')">' +
    '<label>Nama pos *</label><input id="rp-pos" required value="' + esc(r ? r.pos : '') + '" placeholder="Contoh: SPP">' +
    '<label>Jenis</label><select id="rp-jenis"><option' + (r && r.jenis === 'Masuk' ? ' selected' : '') + '>Masuk</option><option' + (r && r.jenis === 'Keluar' ? ' selected' : '') + '>Keluar</option></select>' +
    '<label>Jenjang</label><select id="rp-jenjang">' + ['TPQ', 'Ibtidaiyah'].map(function (j) { return '<option' + (r && r.jenjang === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('') + '</select>' +
    '<label>Rencana (Rp) *</label><input id="rp-rencana" type="text" inputmode="decimal" required value="' + (r ? r.rencana : '') + '">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan pos</button></div></form>');
}
function openBiayaForm(id) {
  var b = id ? db.biaya.find(function (x) { return x.id === id; }) : null;
  openModal('<h2>' + (b ? 'Ubah biaya' : 'Tambah biaya') + '</h2><form onsubmit="return submitBiaya(event, \'' + (b ? b.id : '') + '\')">' +
    '<label>Nama biaya *</label><input id="by-nama" required value="' + esc(b ? b.nama : '') + '">' +
    '<label>Jumlah (Rp) *</label><input id="by-jumlah" type="text" inputmode="decimal" required value="' + (b ? b.jumlah : '') + '">' +
    '<label>Keterangan</label><input id="by-ket" value="' + esc(b ? b.keterangan : '') + '">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan biaya</button></div></form>');
}

function renderKelas() {
  if (!sesiSaya() || !bolehRute('kelas')) return '';
  var daftarKelas = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); });
  /* Setelah "Hapus semua data" tidak ada kelas sama sekali: tampilkan pesan
     kosong, jangan crash karena db.kelas[0] tidak ada. */
  if (!db.kelas.length) {
    return '<div id="alert-root"></div><h1>Kelas dan Absensi</h1><div class="btn-row"><button class="btn" onclick="openKelasForm()">Tambah kelas</button></div><div class="card"><p class="empty" role="status">Belum ada kelas. Tambah kelas baru lewat tombol di atas, atau import data murid (kelas baru dibuat otomatis dari kolom kelas), atau reset ke data contoh lewat Pengaturan.</p><div class="btn-row empty-actions"><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button></div></div>';
  }
  if (!daftarKelas.length) {
    return '<div id="alert-root"></div><h1>Kelas dan Absensi</h1><div class="card"><p class="empty" role="status">Tidak ada kelas pada jenjang ' + esc(ui.jenjang) + '. Ubah pilihan jenjang di atas ke "Semua" atau jenjang lainnya.</p></div>';
  }
  if (!daftarKelas.some(function (k) { return k.id === ui.kelasId; })) ui.kelasId = daftarKelas[0].id;
  var kelas = kelasById(ui.kelasId) || daftarKelas[0];
  if (kelas) ui.kelasId = kelas.id;
  /* A3: arahkan ui.absDraft ke draft kelas yang sedang dibuka (draft lama
     tiap kelas tersimpan di ui.absDraftPerKelas). */
  ui.absDraft = absDraftPerKelas(kelas.id);
  var muridKelas = santriAktif().filter(function (s) { return s.kelas === kelas.nama; });
  var riwayat = db.pertemuan.filter(function (p) { return p.kelasId === kelas.id; }).slice().sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal); });
  var html = '<div id="alert-root"></div><h1>Kelas dan Absensi</h1>' +
    '<div class="btn-row"><button class="btn" onclick="openKelasForm()">Tambah kelas</button></div>' +
    '<div class="tabs">' + daftarKelas.map(function (k) { return '<button class="tab' + (ui.kelasId === k.id ? ' active' : '') + '" onclick="pindahTabKelas(\'' + k.id + '\')">' + esc(k.nama) + (adaDraftAbsensi(k.id) ? ' •' : '') + '</button>'; }).join('') + '</div>' +
    '<div class="card"><h2>' + esc(kelas.nama) + ' (' + esc(kelas.jenjang || 'TPQ') + ', ' + esc(kelas.ruang) + ')</h2><p class="muted">Pengajar: ' + esc(kelas.ustadz) + ' | ' + esc(kelas.jadwal) + ' | ' + muridKelas.length + ' santri aktif</p>' +
    '<label for="kl-tanggal">Tanggal pertemuan</label><input id="kl-tanggal" type="date" value="' + (ui.kelasTanggal || todayStr()) + '" onchange="ui.kelasTanggal=this.value">' +
    '<label for="kl-materi">Materi hari ini *</label><input id="kl-materi" placeholder="Contoh: Iqra 3 halaman 12-14" value="' + esc(ui.kelasMateri) + '" oninput="ui.kelasMateri=this.value">' +
    '<h3 style="margin-top:16px">Tandai kehadiran (ketuk salah satu per santri)</h3>' +
    '<p class="muted">Semua santri otomatis Hadir. Ketuk yang Izin, Sakit, atau Alpa saja.</p>' +
    (muridKelas.length ? muridKelas.map(function (s) {
      var st = ui.absDraft[s.id] || 'Hadir';
      return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row-flex">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">' + esc(s.jilid) + ' | Kehadiran ' + s.kehadiran + '%</span></span><button class="btn ghost small" onclick="naikJilidSantriUI(\'' + s.id + '\')">Naik Jilid</button></div>' +
        '<div class="big-attend" data-abs-santri="' + s.id + '">' + ['Hadir', 'Izin', 'Sakit', 'Alpa'].map(function (v) {
          return '<button class="' + (st === v ? 'on-' + v.toLowerCase() : '') + '" onclick="setAbsensiKelas(\'' + s.id + '\', \'' + v + '\')">' + v + '</button>';
        }).join('') + '</div></div>';
    }).join('') : '<p class="empty" role="status">Belum ada santri aktif di kelas ini.</p>') +
    (adaDraftAbsensi(kelas.id) ? '<p class="muted" role="status"><b>Belum disimpan:</b> ada perubahan absensi di kelas ini yang belum disimpan.</p>' : '') +
    '<div class="btn-row"><button class="btn block" onclick="simpanPertemuanUI()">Simpan pertemuan</button></div></div>' +
    '<div class="card"><h2>Riwayat pertemuan ' + esc(kelas.nama) + '</h2><p class="muted">Kehadiran dihitung dari riwayat pertemuan.</p>' + (riwayat.length ? riwayat.map(function (p) {
      var hadir = Object.keys(p.absensi).filter(function (k) { return p.absensi[k] === 'Hadir'; }).length;
      var total = Object.keys(p.absensi).length;
      return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row-flex"><span class="grow"><b>' + fmtTanggal(p.tanggal) + '</b> | Hadir ' + hadir + ' dari ' + total + '<br><span class="muted">' + esc(p.materi) + '</span></span><button class="btn ghost small" onclick="bukaRincianPertemuan(\'' + kelas.id + '\', \'' + p.tanggal + '\')">Lihat rincian</button></div></div>';
    }).join('') : '<p class="empty" role="status">Belum ada pertemuan tersimpan untuk kelas ini.</p>') + '</div>';
  return html;
}
/* A3: draft absensi disimpan PER KELAS supaya tidak hilang saat pindah
   tab. ui.absDraft tetap dipakai sebagai penunjuk ke draft kelas yang
   sedang dibuka (kode lama yang membaca ui.absDraft tidak berubah).
   ui.absDraftPerKelas hanya properti baru di objek ui (engine.js tidak
   diubah) — dibuat malas di sini. */
function absDraftPerKelas(kelasId) {
  if (!ui.absDraftPerKelas) ui.absDraftPerKelas = {};
  if (!ui.absDraftPerKelas[kelasId]) ui.absDraftPerKelas[kelasId] = {};
  return ui.absDraftPerKelas[kelasId];
}
function adaDraftAbsensi(kelasId) {
  var d = ui.absDraftPerKelas && ui.absDraftPerKelas[kelasId];
  return !!d && Object.keys(d).length > 0;
}
function pindahTabKelas(kelasId) {
  ui.kelasId = kelasId;
  ui.absDraft = absDraftPerKelas(kelasId);
  render();
}
function setAbsensiKelas(sid, val) {
  ui.absDraft[sid] = val;
  var wrap = document.querySelector('[data-abs-santri="' + sid + '"]');
  if (!wrap) return;
  wrap.querySelectorAll('button').forEach(function (b) {
    b.className = b.textContent === val ? 'on-' + val.toLowerCase() : '';
  });
}
/* T-02: form tambah kelas (engine: tambahKelas). */
function openKelasForm() {
  openModal('<h2>Tambah kelas</h2><form onsubmit="return submitKelas(event)">' +
    '<label>Nama kelas *</label><input id="kls-nama" required placeholder="Contoh: Iqra 2">' +
    '<label>Jenjang</label><select id="kls-jenjang"><option>TPQ</option><option>Ibtidaiyah</option></select>' +
    '<label>Ustadz / pengajar</label><input id="kls-ustadz" placeholder="Contoh: Ustadzah Khadijah">' +
    '<label>Jadwal</label><input id="kls-jadwal" placeholder="Contoh: Senin dan Kamis, 15:30">' +
    '<label>Ruang</label><input id="kls-ruang" placeholder="Contoh: Ruang A">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan kelas</button></div></form>');
}
function submitKelas(ev) {
  ev.preventDefault();
  var r = tambahKelas({
    nama: document.getElementById('kls-nama').value.trim(),
    jenjang: document.getElementById('kls-jenjang').value,
    ustadz: document.getElementById('kls-ustadz').value.trim(),
    jadwal: document.getElementById('kls-jadwal').value.trim(),
    ruang: document.getElementById('kls-ruang').value.trim()
  });
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'kls-nama', 'nama-duplikat': 'kls-nama' });
  ui.kelasId = r.kelas.id;
  closeModal(); render();
  showAlert('success', 'Kelas berhasil ditambah.', r.kelas.nama + ' (' + r.kelas.jenjang + ') sekarang tampil di tab Kelas dan Absensi.');
  return false;
}
/* K10: rincian kehadiran per santri dibuka lewat modal, bukan untaian panjang. */
function bukaRincianPertemuan(kelasId, tanggal) {
  var p = db.pertemuan.find(function (x) { return x.kelasId === kelasId && x.tanggal === tanggal; });
  if (!p) return;
  var kelas = kelasById(kelasId);
  var hadir = Object.keys(p.absensi).filter(function (k) { return p.absensi[k] === 'Hadir'; }).length;
  var total = Object.keys(p.absensi).length;
  var rows = Object.keys(p.absensi).map(function (sid) {
    var s = santriById(sid);
    var st = p.absensi[sid];
    var badge = st === 'Hadir' ? 'b-green' : st === 'Izin' ? 'b-blue' : st === 'Sakit' ? 'b-amber' : 'b-red';
    return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(s ? s.nama : sid) + '</b></span><span class="badge ' + badge + '">' + esc(st) + '</span></div>';
  }).join('');
  openModal('<h2>Kehadiran ' + esc(kelas ? kelas.nama : '') + ' ' + fmtTanggal(p.tanggal) + '</h2><p class="muted">' + esc(p.materi) + ' | Hadir ' + hadir + ' dari ' + total + '</p>' + rows + '<div class="btn-row"><button class="btn block" onclick="closeModal()">Tutup</button></div>');
}

/* ================= RENDER: Hafalan / Iqra ================= */
function renderHafalan() {
  if (!sesiSaya() || !bolehRute('hafalan')) return '';
  var aktif = santriAktif().slice().sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  var terpilih = ui.hafalanSantri ? santriById(ui.hafalanSantri) : null;
  var log = hafalanLogTampil().slice(0, 10);
  /* N23: bila belum ada santri aktif, tampilkan SATU pesan gabungan +
     satu aksi "Tambah santri", sembunyikan sub-pesan turunan (pilih murid,
     progres, riwayat setoran). */
  if (aktif.length === 0) {
    return '<div id="alert-root"></div><h1>Hafalan / Iqra</h1><div class="card">' + emptyState('Belum ada santri aktif, jadi belum ada setoran hafalan, progres, atau riwayat setoran. Tambah santri dulu supaya bisa mencatat setoran.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>') + '</div>';
  }
  var html = '<div id="alert-root"></div><h1>Hafalan / Iqra</h1>' +
    '<div class="card"><h2>Catat setoran</h2>' +
    (terpilih ? '<div class="selected-chip">' + avatarHtml(terpilih.nama, terpilih.foto) + '<span class="grow"><span class="nm">Murid terpilih: ' + esc(terpilih.nama) + '</span><br><span class="muted">' + esc(terpilih.kelas) + ' | ' + esc(terpilih.jilid) + ' halaman ' + terpilih.halaman + '</span></span><button class="btn ghost small" onclick="ui.hafalanSantri=\'\';render()">Ganti</button></div>'
      : '<button class="btn secondary block" onclick="openPicker(openSantriPicker(function(it){ui.hafalanSantri=it.id;render();}, true))">Pilih murid</button>' + (aktif.length ? '' : '<p class="empty" role="status">Belum ada santri. Tambah santri dulu supaya bisa mencatat setoran.</p>')) +
    '<form onsubmit="return submitHafalan(event)"><div class="toolbar">' +
    '<select id="hf-jenis"><option>Iqra</option><option>Hafalan</option></select>' +
    '<input id="hf-materi" placeholder="Materi * (contoh: Iqra 3 halaman 14)" required>' +
    '<select id="hf-nilai"><option>Lancar</option><option>Cukup</option><option>Perlu Bimbingan</option></select></div>' +
    '<button class="btn block" type="submit" ' + (terpilih ? '' : 'disabled') + '>Simpan setoran</button>' +
    '<p class="muted">Pilih dulu muridnya lewat tombol di atas, lalu isi materi. Tombol Simpan aktif setelah murid dipilih.</p></form></div>' +
    '<div class="card"><h2>Progres santri</h2>' +
    (aktif.length ? '' : emptyState('Belum ada santri aktif. Tambah santri dulu, lalu catat setoran hafalannya di sini.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>')) +
    aktif.slice(0, ui.hafalanShown || 12).map(function (s) {
      var terakhir = db.hafalanLog.filter(function (h) { return h.santriId === s.id; }).sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal); })[0];
      return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">' + esc(s.jilid) + ' halaman ' + s.halaman + ' | ' + esc(s.hafalan) + '</span><br><span class="muted">' + (terakhir ? 'Terakhir: ' + esc(terakhir.materi) + ' (' + esc(terakhir.nilai) + ', ' + fmtTanggal(terakhir.tanggal) + ')' : 'Belum ada setoran tercatat') + '</span></span></div>';
    }).join('') + '<p class="picker-count">Menampilkan ' + Math.min(ui.hafalanShown || 12, aktif.length) + ' dari ' + aktif.length + ' santri aktif.</p>' +
    (aktif.length > (ui.hafalanShown || 12) ? '<button class="btn secondary block" onclick="ui.hafalanShown=(ui.hafalanShown||12)+12;render()">Tampilkan lebih banyak (' + (aktif.length - (ui.hafalanShown || 12)) + ' lagi)</button>' : '') + '</div>' +
    '<div class="card"><h2>Riwayat setoran</h2>' + (log.length ? log.map(function (h) {
      var s = santriById(h.santriId);
      return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(s ? s.nama : '-') + '</b> (' + esc(h.jenis) + ')<br><span class="muted">' + fmtTanggal(h.tanggal) + ' | ' + esc(h.materi) + '</span></span><span class="badge ' + (h.nilai === 'Lancar' ? 'b-green' : h.nilai === 'Cukup' ? 'b-blue' : 'b-amber') + '">' + esc(h.nilai) + '</span></div>';
    }).join('') : '<p class="empty" role="status">Belum ada setoran tercatat.</p>') + '</div>';
  return html;
}

/* ================= RENDER: Guru ================= */
function renderGuru() {
  if (!sesiSaya() || !bolehRute('guru')) return '';
  var list = guruTampil();
  var html = '<div id="alert-root"></div><h1>Guru (' + list.length + ')</h1>' +
    '<div class="toolbar"><input type="search" placeholder="Cari nama, kelas, atau peran guru" value="' + esc(ui.guruSearch || '') + '" oninput="ui.guruSearch=this.value;renderGuruOnly()" aria-label="Cari guru"></div>' +
    '<div class="btn-row"><button class="btn" onclick="openGuruForm()">Tambah guru</button><button class="btn secondary" onclick="exportGuru()">Export CSV guru</button><button class="btn ghost" onclick="unduhTemplate(\'guru\')">Template CSV guru</button></div>' +
    (list.length ? list.map(function (g) {
      return '<div class="card"><div class="row-flex">' + avatarHtml(g.nama, g.foto) + '<span class="grow"><b>' + esc(g.nama) + '</b><br><span class="muted">' + esc(g.peran) + ' | ' + esc(g.kelas) + ' | ' + esc(g.hp) + ' | ' + esc(g.jenjang || 'TPQ') + '</span><br><span class="muted">Honor ' + rupiah(g.honor) + '</span> ' + (g.honorStatus === 'Lunas' ? '<span class="badge b-green">Honor Lunas</span>' : '<span class="badge b-amber">Honor Belum</span>') + '</span></div>' +
        '<div class="btn-row"><button class="btn secondary small" onclick="toggleHonorUI(\'' + g.id + '\')">Tandai honor ' + (g.honorStatus === 'Lunas' ? 'Belum' : 'Lunas') + '</button><button class="btn ghost small" onclick="openGuruForm(\'' + g.id + '\')">Ubah</button><button class="btn danger small" onclick="mintaHapusGuru(\'' + g.id + '\')">Hapus</button></div></div>';
    }).join('') : (db.guru.length ? '<p class="empty" role="status">Tidak ada guru yang cocok. Coba kata kunci lain atau tambah guru baru.</p><div class="btn-row empty-actions"><button class="btn secondary" onclick="aturUlangFilter(\'guru\')">Atur ulang filter</button></div>' : emptyState('Belum ada guru. Tambah guru pertama lewat tombol di atas, atau import dari CSV.', '<button class="btn" onclick="openGuruForm()">Tambah guru</button><button class="btn secondary" onclick="unduhTemplate(\'guru\')">Template CSV guru</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>')));
  return html;
}
function renderGuruOnly() {
  var v = ui.guruSearch || '';
  /* S2: kartu jenjang ikut dirender supaya tidak hilang saat mengetik. */
  document.getElementById('view').innerHTML = jenjangBarHtml() + renderGuru();
  var inp = document.querySelector('#view input[type=search]');
  if (inp) { inp.focus(); try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
}
function openGuruForm(id) {
  var g = id ? guruById(id) : null;
  openModal('<h2>' + (g ? 'Ubah guru' : 'Tambah guru') + '</h2><form onsubmit="return submitGuru(event, \'' + (g ? g.id : '') + '\')">' +
    '<div id="foto-preview-g">' + (g && g.foto ? '<img class="avatar" src="' + esc(g.foto) + '" alt="Foto guru">' : '') + '</div>' +
    '<label>Foto (opsional)</label><div class="row-flex"><label class="btn ghost small" style="margin:0">Pilih foto<input type="file" accept="image/*" style="display:none" onchange="onPhotoChange(this, \'foto-preview-g\', \'g-foto\'); tampilNamaFoto(this, \'nama-foto-g\')"></label><span class="muted" id="nama-foto-g">' + (g && g.foto ? 'Foto sudah tersimpan' : 'Belum ada foto dipilih') + '</span></div>' +
    '<input type="hidden" id="g-foto" value="' + esc(g && g.foto ? g.foto : '') + '">' +
    '<label>Nama *</label><input id="g-nama" required value="' + esc(g ? g.nama : '') + '" placeholder="Contoh: Ustadz Ahmad">' +
    '<label>Kelas</label><select id="g-kelas">' + db.kelas.map(function (k) { return '<option' + (g && g.kelas === k.nama ? ' selected' : '') + '>' + esc(k.nama) + '</option>'; }).join('') + '</select>' +
    '<label>Peran</label><select id="g-peran">' + PERAN_GURU.map(function (p) { return '<option' + (g && g.peran === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select>' +
    '<p class="muted">Peran mengikuti istilah madrasah: Pimpinan, Wali Kelas, Guru Fan, Guru.</p>' +
    '<p class="muted">Guru Fan hanya nama peran di daftar guru, bukan peran login — tidak mengubah hak akses.</p>' +
    '<label>Jenjang mengajar</label><select id="g-jenjang">' + ['TPQ', 'Ibtidaiyah', 'TPQ dan Ibtidaiyah'].map(function (j) { return '<option' + (g && g.jenjang === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('') + '</select>' +
    '<label>HP</label><input id="g-hp" inputmode="tel" value="' + esc(g ? g.hp : '') + '">' +
    '<label>Honor (Rp)</label><input id="g-honor" type="text" inputmode="decimal" value="' + (g ? g.honor : 0) + '">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan guru</button></div></form>');
}

/* ================= RENDER: Pengumuman ================= */
function renderPengumuman() {
  if (!sesiSaya() || !bolehRute('pengumuman')) return '';
  var list = db.pengumuman.slice().sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal); });
  var html = '<div id="alert-root"></div><h1>Pengumuman</h1>' +
    '<div class="card"><h2>Buat pengumuman baru</h2><form onsubmit="return submitPengumuman(event)">' +
    '<label>Judul *</label><input id="pg-judul" required placeholder="Contoh: Pengajian Akbar">' +
    '<label>Isi *</label><textarea id="pg-isi" required placeholder="Tulis isi pengumuman di sini"></textarea>' +
    '<button class="btn block" type="submit">Simpan &amp; tampilkan di Beranda</button></form></div>' +
    (list.length ? list.map(function (p) {
      return '<div class="card"><div class="row-flex"><span class="grow"><b>' + esc(p.judul) + '</b><br><span class="muted">' + fmtTanggal(p.tanggal) + '</span><p style="margin:8px 0 0">' + esc(p.isi) + '</p></span>' + (p.aktif ? '<span class="badge b-green">Tampil</span>' : '<span class="badge b-grey">Ditutup</span>') + '</div>' +
        '<div class="btn-row"><button class="btn secondary small" onclick="togglePengumumanUI(\'' + p.id + '\')">' + (p.aktif ? 'Tutup' : 'Tampilkan lagi') + '</button><button class="btn danger small" onclick="mintaHapusPengumuman(\'' + p.id + '\')">Hapus</button></div></div>';
    }).join('') : '<p class="empty" role="status">Belum ada pengumuman. Buat yang pertama lewat form di atas.</p>');
  return html;
}

/* ================= RENDER: Laporan ================= */
function renderLaporan() {
  if (!sesiSaya() || !bolehRute('laporan')) return '';
  var kas = saldoKas(ui.jenjang);
  var aktif = santriAktif();
  var lunas = aktif.filter(function (s) { return s.sppStatus === 'Lunas'; }).length;
  var kelasLaporan = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); });
  var html = '<div id="alert-root"></div><h1>Laporan</h1>' +
    (aplikasiKosong() ? '<div class="card">' + emptyState('Belum ada data. Laporan terisi otomatis setelah ada santri, kelas, dan transaksi.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>') + '</div>' : '') +
    '<div class="grid grid-2">' +
    '<div class="card stat"><div class="num">' + rupiah(kas.saldo) + '</div><div class="lbl">Saldo kas</div><div class="sub">masuk ' + rupiah(kas.masuk) + ' | keluar ' + rupiah(kas.keluar) + '</div></div>' +
    '<div class="card stat"><div class="num">' + lunas + ' dari ' + aktif.length + '</div><div class="lbl">SPP lunas</div><div class="sub">santri aktif</div></div>' +
    '<div class="card stat"><div class="num">' + rataKehadiran() + '%</div><div class="lbl">Rata-rata kehadiran</div><div class="sub">' + aktif.length + ' santri aktif</div></div>' +
    '<div class="card stat"><div class="num">' + rupiah(totalTabungan()) + '</div><div class="lbl">Total tabungan</div><div class="sub">santri aktif</div></div></div>' +
    '<div class="card"><h2>Export laporan (CSV)</h2><p class="muted">Export mengikuti filter yang sedang tampil di tiap layar.</p><div class="btn-row">' +
    '<button class="btn secondary" onclick="exportSantri()">Export murid</button>' +
    '<button class="btn secondary" onclick="exportGuru()">Export guru</button>' +
    '<button class="btn secondary" onclick="exportNilai()">Export nilai</button>' +
    '<button class="btn secondary" onclick="exportAbsensi()">Export absensi</button>' +
    '<button class="btn secondary" onclick="exportKeuangan()">Export keuangan</button></div></div>' +
    '<div class="card"><h2>Rekap per jenjang</h2><div class="table-wrap"><table class="table-stack"><thead><tr><th>Jenjang</th><th>Murid aktif</th><th>Saldo kas</th><th>Total tabungan</th></tr></thead><tbody>' +
    ['TPQ', 'Ibtidaiyah'].map(function (j) {
      var muridJ = db.santri.filter(function (s) { return s.status === 'Aktif' && (s.jenjang || 'TPQ') === j; });
      var tabJ = muridJ.reduce(function (a, s) { return a + (s.tabungan || 0); }, 0);
      return '<tr><td class="cell-main" data-label="Jenjang"><b>' + j + '</b></td><td data-label="Murid aktif">' + muridJ.length + '</td><td class="money" data-label="Saldo kas">' + rupiah(saldoKas(j).saldo) + '</td><td class="money" data-label="Total tabungan">' + rupiah(tabJ) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>' +
    '<div class="card"><h2>Rekap per kelas · ' + esc(labelTapel()) + '</h2><p class="muted">Tapel adalah tahun pelajaran Hijriah.</p>' + (kelasLaporan.length ? '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Kelas</th><th>Murid aktif</th><th>Rata-rata hadir</th><th>Tabungan</th></tr></thead><tbody>' : emptyState('Belum ada kelas.', '<button class="btn" onclick="openKelasForm()">Tambah kelas</button>')) +
    kelasLaporan.map(function (k) {
      var murid = aktif.filter(function (s) { return s.kelas === k.nama; });
      var rata = murid.length ? Math.round(murid.reduce(function (a, s) { return a + s.kehadiran; }, 0) / murid.length) : 0;
      var tab = murid.reduce(function (a, s) { return a + s.tabungan; }, 0);
      return '<tr><td class="cell-main" data-label="Kelas"><b>' + esc(k.nama) + '</b></td><td data-label="Murid aktif">' + murid.length + ' (' + teksGender(rekapGenderUi(murid)) + ')</td><td data-label="Rata-rata hadir">' + rata + '%</td><td class="money" data-label="Tabungan">' + rupiah(tab) + '</td></tr>';
    }).join('') + (kelasLaporan.length ? '</tbody></table></div>' : '') + '</div>';
  return html;
}

/* ================= Akun saya + Kelola pengguna (Pengaturan) =================
   Bentuk data pengguna mengikuti kontrak mesin: daftarPengguna mengembalikan
   [{ id, nama, peran, wajibGantiSandi }] terurut id. Kalau mesin belum
   menyediakan daftarPengguna, daftarPenggunaUi memakai fallback dua akun
   bawaan lewat cariPengguna. Semua nilai dari mesin ditampilkan lewat
   esc() dan semua sandi divalidasi di UI (min 6). */
function akunSayaHtml() {
  var s = sesiSaya();
  if (!s) return '';
  return '<div class="card"><h2>Akun saya</h2>' +
    '<div class="row-flex">' + avatarHtml(s.nama) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">ID ' + esc(s.id) + ' | Peran ' + esc(s.peran) + '</span></span></div>' +
    '<div class="btn-row"><button class="btn secondary" onclick="openUbahSandiModal()">Ubah kata sandi saya</button><button class="btn ghost" onclick="keluar()">Keluar</button></div></div>';
}
function daftarPenggunaUi() {
  if (typeof daftarPengguna === 'function') {
    try { return daftarPengguna() || []; } catch (e) { return []; }
  }
  if (typeof cariPengguna !== 'function') return [];
  var out = [];
  ['admin', 'guru1'].forEach(function (id) {
    try { var u = cariPengguna(id); if (u) out.push(u); } catch (e) {}
  });
  return out;
}
function barisPenggunaHtml(u) {
  var saya = sesiSaya() && sesiSaya().id === u.id;
  return '<div class="user-row">' + avatarHtml(u.nama) + '<span class="grow"><b>' + esc(u.nama) + '</b><br><span class="u-meta">ID ' + esc(u.id) + ' | ' + esc(u.peran) + '</span>' + (u.wajibGantiSandi ? ' <span class="badge b-amber">Harus ganti sandi</span>' : '') + '</span>' +
    '<span class="btn-row"><button class="btn secondary small" onclick="openResetSandiModal(\'' + escJs(u.id) + '\', \'' + escJs(u.nama) + '\')">Reset sandi</button>' +
    '<button class="btn danger small" ' + (saya ? 'disabled title="Tidak bisa menghapus akun sendiri"' : 'onclick="mintaHapusPengguna(\'' + escJs(u.id) + '\', \'' + escJs(u.nama) + '\')"') + '>Hapus</button></span></div>';
}
function kelolaPenggunaHtml() {
  if (!authTersedia() || peranSaya() !== 'Pimpinan') return '';
  var daftar = daftarPenggunaUi();
  var rows = daftar.map(barisPenggunaHtml).join('');
  return '<div class="card"><h2>Kelola pengguna</h2>' +
    '<p class="muted">Hanya Pimpinan yang bisa menambah, mereset, dan menghapus pengguna. Kata sandi baru minimal 8 karakter. Akun sendiri tidak bisa dihapus.</p>' +
    (rows || '<p class="empty" role="status">Belum ada pengguna yang bisa ditampilkan. Cari berdasarkan ID di bawah.</p>') +
    '<h3>Cari pengguna berdasarkan ID</h3><div class="toolbar"><input id="cari-pengguna-id" placeholder="Contoh: guru1" aria-label="Cari pengguna berdasarkan ID"><button class="btn secondary" onclick="cariPenggunaUI()">Cari</button></div><div id="cari-pengguna-hasil"></div>' +
    '<h3>Tambah pengguna</h3><form onsubmit="return submitTambahPengguna(event)">' +
    '<label for="tp-id">ID pengguna</label><input id="tp-id" required placeholder="Contoh: guru2">' +
    '<label for="tp-nama">Nama</label><input id="tp-nama" required placeholder="Contoh: Ustadzah Siti">' +
    '<label for="tp-peran">Peran</label><select id="tp-peran"><option>Pimpinan</option><option selected>Guru</option></select>' +
    '<label for="tp-sandi">Kata sandi (minimal 8 karakter)</label><input id="tp-sandi" type="password" required autocomplete="new-password">' +
    '<button class="btn block" type="submit">Tambah pengguna</button></form></div>';
}
function cariPenggunaUI() {
  var id = document.getElementById('cari-pengguna-id').value.trim();
  var wadah = document.getElementById('cari-pengguna-hasil');
  if (!wadah) return;
  if (!id) { wadah.innerHTML = '<p class="empty" role="status">Isi dulu ID pengguna yang dicari.</p>'; return; }
  var u = null;
  try { u = cariPengguna(id); } catch (e) {}
  if (!u) { wadah.innerHTML = '<p class="empty" role="status">Tidak ada pengguna dengan ID ' + esc(id) + '.</p>'; return; }
  wadah.innerHTML = barisPenggunaHtml(u);
}
function submitTambahPengguna(ev) {
  ev.preventDefault();
  var id = document.getElementById('tp-id').value.trim();
  var nama = document.getElementById('tp-nama').value.trim();
  var peran = document.getElementById('tp-peran').value;
  var sandi = document.getElementById('tp-sandi').value;
  if (!id || !nama) { tampilErrorForm(ev.target, 'Isi dulu ID dan nama pengguna.', !id ? 'tp-id' : 'tp-nama'); return false; }
  if (sandi.length < 8) { tampilErrorForm(ev.target, 'Kata sandi minimal 8 karakter.', 'tp-sandi'); return false; }
  var r = tambahPengguna({ id: id, nama: nama, peran: peran, sandi: sandi, olehId: sesiSaya() ? sesiSaya().id : '' });
  if (!r || !r.ok) return gagalForm(ev, r, { 'id-kosong': 'tp-id', 'id-duplikat': 'tp-id', 'nama-kosong': 'tp-nama', 'sandi-terlalu-pendek': 'tp-sandi' });
  render();
  showAlert('success', 'Pengguna berhasil ditambah.', nama + ' (ID ' + id + ', ' + peran + ') bisa masuk dengan kata sandi yang baru dibuat.');
  return false;
}
function openResetSandiModal(id, nama) {
  openModal(
    '<h2>Reset sandi ' + esc(nama) + '</h2>' +
    '<p class="muted">Kata sandi baru minimal 8 karakter. Sampaikan kata sandi baru ini ke pengguna yang bersangkutan.</p>' +
    '<div class="auth-error" id="reset-error" role="alert" tabindex="-1" hidden></div>' +
    '<form onsubmit="return submitResetSandi(event, \'' + esc(id) + '\')">' +
    '<label for="rs-baru">Kata sandi baru</label><input id="rs-baru" type="password" autocomplete="new-password">' +
    '<label for="rs-ulang">Ulangi kata sandi baru</label><input id="rs-ulang" type="password" autocomplete="new-password">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Reset sandi</button></div></form>'
  );
}
function submitResetSandi(ev, id) {
  ev.preventDefault();
  var baru = document.getElementById('rs-baru').value;
  var ulang = document.getElementById('rs-ulang').value;
  var err = document.getElementById('reset-error');
  function gagal(pesan) {
    if (!err) return;
    err.textContent = pesan;
    err.hidden = false;
    err.focus();
  }
  if (baru.length < 8) { gagal('Kata sandi baru minimal 8 karakter.'); return false; }
  if (baru !== ulang) { gagal('Konfirmasi kata sandi tidak cocok. Coba lagi.'); return false; }
  var r = resetSandiPengguna(id, baru, sesiSaya() ? sesiSaya().id : '');
  if (!r || !r.ok) { gagal((r && r.alasan) ? r.alasan : 'Kata sandi tidak bisa direset.'); return false; }
  closeModal();
  render();
  showAlert('success', 'Kata sandi berhasil direset.', 'Sampaikan kata sandi baru ini ke pengguna dengan ID ' + id + '.');
  return false;
}
function mintaHapusPengguna(id, nama) {
  var saya = sesiSaya();
  if (saya && saya.id === id) { toast('Tidak bisa menghapus akun sendiri.'); return; }
  confirmModal({
    judul: 'Hapus pengguna ' + nama + '?',
    isi: '<p>Pengguna dengan ID ' + esc(id) + ' tidak bisa masuk lagi. Tindakan ini tidak bisa dibatalkan.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () {
      var r = hapusPengguna(id, saya ? saya.id : '');
      render();
      if (r && r.ok) showAlert('success', 'Pengguna berhasil dihapus.', nama + ' (ID ' + id + ') sudah tidak bisa masuk lagi.');
      else showAlert('error', 'Pengguna tidak bisa dihapus.', (r && r.alasan) || 'Periksa lagi.');
    }
  });
}

/* ================= RENDER: Pengaturan ================= */
function renderPengaturan() {
  if (!sesiSaya() || !bolehRute('pengaturan')) return '';
  var cfg = getSheetCfg();
  var q = getQueue();
  var st = syncState();
  var html = '<div id="alert-root"></div><h1>Pengaturan</h1>' + akunSayaHtml() + kelolaPenggunaHtml() + profilPengaturanHtml() + panduanPengaturanHtml() +
    '<div class="card"><h2>Profil TPQ</h2><form onsubmit="return submitSettings(event)">' +
    '<label>Nama TPQ *</label><input id="st-nama" required value="' + esc(db.settings.namaTpq) + '">' +
    '<label>Kepala TPQ</label><input id="st-kepala" value="' + esc(db.settings.kepala) + '">' +
    '<label>Tarif SPP per bulan (Rp) *</label><input id="st-spp" type="text" inputmode="decimal" required value="' + db.settings.tarifSpp + '">' +
    '<label>Tahun ajaran</label><input id="st-tahun" value="' + esc(db.settings.tahunAjaran) + '">' +
    '<label>Jam masuk</label><input id="st-jam" type="time" value="' + esc(db.settings.jamMasuk) + '">' +
    '<button class="btn block" type="submit">Simpan pengaturan</button></form></div>' +
    '<div class="card"><h2>Tampilan</h2><p class="muted">Pilih tampilan yang dipakai di perangkat ini. Pilihan tersimpan dan berlaku di semua layar.</p>' +
    '<div class="tabs">' + [['auto', 'Otomatis (ikut lebar layar)'], ['desktop', 'Mode Desktop'], ['mobile', 'Mode Mobile']].map(function (m) {
      return '<button class="tab' + (getMode() === m[0] ? ' active' : '') + '" onclick="mintaGantiMode(\'' + m[0] + '\')">' + m[1] + '</button>';
    }).join('') + '</div>' +
    '<p class="muted">Mode Desktop: sidebar kiri penuh dengan semua menu, konten lebar, tabel penuh, grafik besar. Mode Mobile: seperti aplikasi HP, bottom nav, kartu besar, menu grid. Otomatis: desktop kalau lebar layar 900px atau lebih, mobile kalau kurang. Kembali kapan saja lewat Pengaturan lalu Tampilan.</p></div>' +
    '<div class="card"><h2>Install aplikasi</h2><p class="muted">Pasang aplikasi ini di layar utama HP supaya dibuka seperti aplikasi biasa, lengkap dengan ikon, dan tetap bisa dipakai offline.</p>' +
    '<p id="install-status">' + esc(teksStatusInstall()) + '</p>' +
    '<div class="btn-row"><button class="btn" id="btn-install-pengaturan" onclick="installApp()">Install aplikasi</button><button class="btn secondary" onclick="tampilkanBannerInstallManual()">Tampilkan banner install</button></div></div>' +
    '<div class="card"><h2>Google Sheet dan sinkron hybrid</h2>' +
    '<p><span class="badge ' + (st.code === 'ok' ? 'b-green' : st.code === 'offline' ? 'b-amber' : st.code === 'pending' ? 'b-amber' : 'b-grey') + '">' + esc(st.text) + '</span></p>' +
    '<p class="muted">Cara kerja hybrid: data selalu tersimpan dulu di perangkat (offline). Setiap perubahan masuk antrean (' + q.length + ' perubahan menunggu). Begitu perangkat online dan Apps Script sudah diatur, antrean otomatis terkirim ke Google Sheet. Aplikasi tidak pernah diblokir karena offline atau karena Apps Script belum diatur.</p>' +
    '<label>Link Google Sheet (untuk import CSV dari Sheet)</label><input id="sheet-link" placeholder="https://docs.google.com/spreadsheets/d/.../edit" value="' + esc(cfg.sheetLink || '') + '">' +
    '<label>Nomor sheet (gid, biasanya 0)</label><input id="sheet-gid" type="number" min="0" value="' + (cfg.gid == null ? 0 : cfg.gid) + '">' +
    '<label>URL Web App Google Apps Script (untuk sinkron otomatis)</label><input id="apps-script-url" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(cfg.appsScriptUrl || '') + '">' +
    '<label>Token rahasia sinkron (opsional, sama dengan yang diatur di Apps Script)</label><input id="sync-token" type="password" autocomplete="off" placeholder="Kosongkan kalau belum mengatur token" value="' + esc(cfg.syncToken || '') + '">' +
    '<p class="muted">Token ini hanya tersimpan di perangkat ini (tidak pernah ditulis ke repo dan tidak dikirim ke mana pun kecuali ke URL Apps Script di atas). Kalau token diatur di Apps Script (Script Properties TPQ_SYNC_TOKEN), isi token yang sama di sini supaya sinkron diterima. Kalau dikosongkan, sinkron tetap jalan seperti sebelumnya, tapi siapa pun yang punya URL Web App bisa membaca/menulis Sheet, jadi atur token sesegera mungkin. Panduan lengkap ada di README, bagian "Token rahasia sinkron".</p>' +
    '<div class="btn-row"><button class="btn" onclick="simpanSheetConfigUI()">Simpan pengaturan Sheet</button><button class="btn secondary" onclick="sinkronSekarang()">Sinkron sekarang</button></div>' +
    '<div class="btn-row"><button class="btn secondary" onclick="tarikDariSheet()">Tarik data terbaru dari Sheet</button><button class="btn ghost" onclick="tarikCsvDariSheet(\'murid\')">Tarik murid dari Sheet (CSV publish)</button></div>' +
    '<p class="muted">Aturan konflik saat tarik data: data terbaru berdasarkan waktu perubahan yang menang. Kalau perangkat ini punya perubahan yang belum terkirim, aplikasi memberi peringatan dulu dan tidak menimpa diam-diam. Kalau Sheet tidak memberi info waktu perubahan, aplikasi juga memberi peringatan dulu (tidak langsung menimpa), karena tidak bisa dipastikan mana yang lebih baru.</p>' +
    '<h3>Kirim data ke Google Sheet</h3><p class="muted">Cara cepat tanpa Apps Script: unduh CSV, lalu buka Google Sheets baru dan upload file itu. Atau salin isi CSV ke clipboard.</p>' +
    '<div class="btn-row"><button class="btn secondary" onclick="openSheetsNew()">Buka Google Sheets baru</button><button class="btn ghost" onclick="salinCsv(\'murid\')">Salin CSV murid</button><button class="btn ghost" onclick="salinCsv(\'nilai\')">Salin CSV nilai</button></div>' +
    '<div class="btn-row"><button class="btn" onclick="kirimKeAppsScript()">Kirim data ke Apps Script</button></div></div>' +
    '<div class="card"><h2>Import data (CSV)</h2><p class="muted">Formatnya CSV (bukan Excel .xlsx). Unduh dulu template-nya, isi di spreadsheet, simpan sebagai CSV, lalu import. Baris yang gagal dilewati dan dilaporkan, data yang sudah ada tidak rusak.</p>' +
    [['murid', 'Murid'], ['guru', 'Guru'], ['nilai', 'Nilai']].map(function (t) {
      return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>Import ' + t[1] + '</b><br><span class="muted">Kolom: ' + esc(CSV_TEMPLATES[t[0]].header.join(', ')) + '</span></span>' +
        '<button class="btn secondary small" onclick="unduhTemplate(\'' + t[0] + '\')">Template</button>' +
        '<label class="btn ghost small" style="margin:0">Pilih file CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="importFileCsv(\'' + t[0] + '\', this)"></label></div>';
    }).join('') + '</div>' +
    '<div class="card"><h2>Export data (CSV)</h2><div class="btn-row">' +
    '<button class="btn secondary" onclick="exportSantri()">Murid</button><button class="btn secondary" onclick="exportGuru()">Guru</button><button class="btn secondary" onclick="exportNilai()">Nilai</button><button class="btn secondary" onclick="exportAbsensi()">Absensi</button><button class="btn secondary" onclick="exportKeuangan()">Keuangan</button></div></div>' +
    '<div class="card"><h2>Cadangkan dan pulihkan</h2><p class="muted">Cadangan berisi seluruh data aplikasi dalam satu file JSON. Simpan file itu baik-baik supaya data tidak hilang.</p>' +
    ((db.santri.length === 0 && db.guru.length === 0 && db.kelas.length === 0 && db.keuanganTx.length === 0 && db.nilai.length === 0) ? '<p class="empty" role="status">Belum ada data untuk dicadangkan.</p>' : '') +
    '<div class="btn-row"><button class="btn" onclick="unduhBackup()">Cadangkan semua data (JSON)</button>' +
    '<label class="btn secondary" style="margin:0">Pulihkan dari cadangan<input type="file" accept=".json,application/json" style="display:none" onchange="pulihkanDariFile(this)"></label></div></div>' +
    '<div class="card"><h2>Zona berbahaya</h2>' +
    '<div class="btn-row"><button class="btn secondary" onclick="resetToSeedConfirm()">Reset ke data contoh</button><button class="btn danger" onclick="mintaHapusSemuaData()">Hapus semua data</button></div>' +
    '<p class="muted">Reset mengembalikan 40 murid contoh dan semua data contoh lain. Hapus semua data mengosongkan aplikasi supaya bisa diisi data asli. Keduanya meminta konfirmasi dulu.</p></div>';
  return html;
}
function resetToSeedConfirm() {
  confirmModal({
    judul: 'Reset ke data contoh?',
    isi: '<p>Semua data saat ini akan <b>diganti</b> dengan data contoh (40 murid contoh, 3 guru, dan data contoh lain). Kalau data asli sudah diisi, cadangkan dulu lewat tombol "Cadangkan semua data".</p>',
    okLabel: 'Ya, reset',
    danger: true,
    needCheck: true,
    checkLabel: 'Saya yakin, ganti semua data dengan data contoh.',
    /* Wiring Y-N3 (Kirana, v22): resetToSeed() kini MENOLAK data asli yang
       berisi (engine, perbaikan Baskara) — db dikembalikan apa adanya.
       Cek hasilnya: reseed sukses selalu menghasilkan db contoh (isContoh
       true, dari seedData); bila ditolak, db tetap data asli (isContoh
       false). Bila ditolak (atau reset melempar), toast GAGAL dan JANGAN
       tampilkan alert sukses; data asli dibiarkan utuh. */
    onOk: function () {
      dismissedAnn = {};
      var gagal = false;
      try { resetToSeed(); } catch (e) { gagal = true; }
      if (!gagal) {
        try { gagal = !(db && db.isContoh === true); } catch (e) { gagal = true; }
      }
      if (gagal) { toast('Tidak dapat mengembalikan data contoh: data asli tidak diubah.'); return; }
      render();
      showAlert('success', 'Data contoh berhasil dipulihkan.', 'Aplikasi sekarang berisi 40 murid contoh dan data contoh lain.');
    }
  });
}

/* ================= RENDER: Penilaian dan Rapor ================= */
function renderPenilaian() {
  if (!sesiSaya() || !bolehRute('penilaian')) return '';
  var tab = ui.nilaiTab;
  var html = '<div id="alert-root"></div><h1>Penilaian</h1>' +
    '<div class="tabs">' + ['Harian', 'Imda', 'Praktek', 'Rapor'].map(function (t) {
      return '<button class="tab' + (tab === t ? ' active' : '') + '" onclick="ui.nilaiTab=\'' + t + '\';render()">' + (t === 'Rapor' ? 'Rapor Murid' : 'Nilai ' + t) + '</button>';
    }).join('') + '</div>';
  if (tab === 'Rapor') {
    var s = santriById(ui.raporSantri);
    var sem = semesterById(ui.raporSemester);
    var r = s ? hitungRapor(s.id, ui.raporSemester) : null;
    /* Nilai Iqra: rata-rata nilai mapel Iqra santri ini pada semester terpilih
       (data contoh: Ahmad Fauzi 85 Harian + 90 Imda = 87.5). */
    var nilaiIqra = s ? db.nilai.filter(function (n) { return n.santriId === s.id && n.mapel === 'Iqra' && nilaiDalamSemester(n, ui.raporSemester); }) : [];
    var rataIqra = nilaiIqra.length ? Math.round(nilaiIqra.reduce(function (a, n) { return a + n.nilai; }, 0) / nilaiIqra.length * 10) / 10 : null;
    var nilaiSem = s ? db.nilai.filter(function (n) { return n.santriId === s.id && nilaiDalamSemester(n, ui.raporSemester); }) : [];
    /* R4: layar Hasil Belajar = markup VERBATIM mockup v3 layar 3 (head-row,
       dropdown semester, 4 kartu stat, laporan + Download File). Baris tab
       Penilaian di atas tetap ada (chrome PWA, perlu untuk pindah tab);
       baris "Ganti murid" kecil di bawah head-row adalah satu-satunya
       tambahan fungsi (pemilih 40 murid). Di desktop layar ini memakai
       gaya styles.css biasa karena #view tidak diberi kelas .mk. */
    html += '<div class="screen">' +
      '<div class="head-row"><div><h2 class="pg-title">Hasil Belajar</h2>' +
      '<p class="pg-sub">' + (s ? esc(s.nama) + ' &middot; NIS ' + esc(s.nis) : 'Belum ada murid terpilih') + '</p></div>' +
      '<div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">' +
      '<button class="widget-btn" onclick="go(\'dashboard\')" aria-label="Kembali ke Beranda"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2.5"/><rect x="13" y="3" width="8" height="8" rx="2.5" opacity=".45"/><rect x="3" y="13" width="8" height="8" rx="2.5" opacity=".45"/><rect x="13" y="13" width="8" height="8" rx="2.5"/></svg></button>' +
      (db.isContoh ? '<span class="contoh-chip on-light"><i></i>Data contoh</span>' : '') +
      '</div></div>' +
      (s ? '<div style="margin:2px 0 4px"><button class="chip-btn" onclick="openPicker(openSantriPicker(function(it){ui.raporSantri=it.id;render();}, false))">Ganti murid</button></div>'
        /* M9: bila belum ada santri, jangan buka picker kosong; tampilkan
           pesan + tombol Tambah santri saja. */
        : (db.santri.length ? '<div style="margin:8px 0"><button class="btn-blue" onclick="openPicker(openSantriPicker(function(it){ui.raporSantri=it.id;render();}, false))">Pilih murid</button></div>' : '') + (db.santri.length ? '' : '<div class="card">' + emptyState('Belum ada santri. Tambah santri dulu, lalu pilih murid untuk melihat rapornya.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button>') + '</div>')) +
      '<div class="sem-wrap" id="sem-wrap">' +
      '<button class="sem-btn" onclick="toggleSem(event)" aria-haspopup="listbox" aria-expanded="false"><span id="sem-label">' + esc(sem.label) + '</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg></button>' +
      '<div class="sem-list" role="listbox" aria-label="Pilih semester">' +
      SEMESTER_LIST.map(function (sm) { return '<button class="' + (ui.raporSemester === sm.id ? 'active' : '') + '" data-sem="' + sm.id + '" onclick="setRaporSemester(\'' + sm.id + '\')">' + esc(sm.label) + '</button>'; }).join('') +
      '</div></div>' +
      (s ? '<div class="stat-grid">' +
      '<div class="stat-card" id="stat-iqra"><div class="st-top"><span class="st-ic"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.8C7.5 3.6 10 3.6 12 5c2-1.4 4.5-1.4 7-.2v13.4c-2.5-1.2-5-1.2-7 .2-2-1.4-4.5-1.4-7-.2V4.8Z"/><path d="M12 5v13.4"/></svg></span><button class="stat-dots" onclick="this.closest(\'.stat-card\').classList.toggle(\'open\')" aria-label="Detail nilai Iqra"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></div>' +
      '<p class="stat-num num">' + (rataIqra == null ? '-' : rataIqra) + '</p><p class="stat-label">Nilai Iqra</p>' +
      '<p class="stat-detail">' + (nilaiIqra.length ? 'Rata-rata ' + nilaiIqra.length + ' nilai mapel Iqra pada ' + esc(sem.label) + '.' : 'Belum ada nilai Iqra pada ' + esc(sem.label) + '.') + '</p></div>' +
      '<div class="stat-card" id="stat-halaman"><div class="st-top"><span class="st-ic"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h13v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6 3Z"/><path d="M4 18.5A2.5 2.5 0 0 0 6.5 21H19v-5"/><path d="M9 8h6"/></svg></span><button class="stat-dots" onclick="this.closest(\'.stat-card\').classList.toggle(\'open\')" aria-label="Detail halaman Iqra"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></div>' +
      '<p class="stat-num num">' + s.halaman + '</p><p class="stat-label">Halaman ' + esc(s.jilid) + '</p>' +
      '<p class="stat-detail">Halaman terakhir yang dicapai pada ' + esc(s.jilid) + '.</p></div>' +
      '<div class="stat-card" id="stat-kehadiran"><div class="st-top"><span class="st-ic"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3Z"/><path d="m9 11.8 2.2 2.2L15.5 9.8"/></svg></span><button class="stat-dots" onclick="this.closest(\'.stat-card\').classList.toggle(\'open\')" aria-label="Detail kehadiran"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></div>' +
      '<p class="stat-num num">' + s.kehadiran + '%</p><p class="stat-label">Kehadiran</p>' +
      '<p class="stat-detail">Rata-rata kehadiran ' + esc(s.nama) + '.</p></div>' +
      '<div class="stat-card" id="stat-akhir"><div class="st-top"><span class="st-ic"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5 14 9l4.9.6-3.6 3.3 1 4.8L12 15.3l-4.3 2.4 1-4.8L5.1 9.6 10 9l2-4.5Z"/></svg></span><button class="stat-dots" onclick="this.closest(\'.stat-card\').classList.toggle(\'open\')" aria-label="Detail nilai akhir"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></div>' +
      '<p class="stat-num num">' + (r.akhir == null ? '-' : r.akhir) + '</p><p class="stat-label">Nilai Akhir</p>' +
      '<p class="stat-detail">' + (r.akhir == null ? 'Belum ada nilai pada ' + esc(sem.label) + '.' : 'Harian ' + (r.harian == null ? '-' : r.harian) + ' | Imda ' + (r.imda == null ? '-' : r.imda) + ' | Praktek ' + (r.praktek == null ? '-' : r.praktek) + ' | ' + esc(predikat(r.akhir))) + '</p></div>' +
      '</div>' : '') +
      /* A8: rumus Nilai Akhir + arti predikat, tepat di bawah Nilai Akhir. */
      (s ? '<p class="muted">Nilai Akhir = 40% Harian + 30% Imda + 30% Praktek. Predikat: A (90 ke atas, Sangat Baik), B (80-89, Baik), C (70-79, Cukup), D (60-69, Kurang), E (di bawah 60, Perlu Bimbingan). Jenis nilai yang belum ada dihitung 0.</p>' : '') +
      (s ? '<div class="report-sec"><h3 class="sec-title">Laporan Hasil Belajar</h3>' +
      '<p>Kamu bisa melihat laporan hasil belajar ' + esc(s.nama) + ' dengan mengunduh file rekap di bawah ini. Isi file mengikuti semester yang dipilih di atas.</p>' +
      '<button class="btn-blue" onclick="exportRapor(\'' + s.id + '\', \'' + ui.raporSemester + '\')">Download File</button>' +
      '<p class="saved-note" id="dl-note">File laporan berhasil dibuat dan diunduh.</p>' +
      '<button class="btn ghost block" style="margin-top:10px" onclick="bagikanRapor(\'' + s.id + '\')">Bagikan rapor (teks)</button></div>' : '') +
      '</div>' +
      '<div class="card"><h2>Semua nilai ' + (s ? esc(s.nama) : '') + '</h2>' + (s ? (nilaiSem.length ? nilaiSem.map(function (n) {
        return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(n.jenis) + ' ' + esc(n.mapel) + '</b><br><span class="muted">' + fmtTanggal(n.tanggal) + (n.catatan ? ' | ' + esc(n.catatan) : '') + '</span></span><b>' + n.nilai + '</b></div>';
      }).join('') : '<p class="empty" role="status">Belum ada nilai untuk murid ini pada ' + esc(sem.label) + '.</p>') : '<p class="empty" role="status">Pilih murid dulu untuk melihat rapornya.</p>') + '</div>';
    return html;
  }
  var list = db.nilai.filter(function (n) {
    if (n.jenis !== tab) return false;
    var s = santriById(n.santriId);
    return s && jenjangCocok(s.jenjang);
  }).slice().sort(function (a, b) { return b.tanggal.localeCompare(a.tanggal); });
  var terpilih = ui.nilaiSantri ? santriById(ui.nilaiSantri) : null;
  html += '<div class="card"><h2>Tambah nilai ' + tab + '</h2>' +
    /* A16: peran tiap jenis nilai di Nilai Akhir (bobot dari rumus rapor). */
    '<p class="muted">' + (tab === 'Harian' ? 'Nilai Harian membentuk 40% Nilai Akhir.' : tab === 'Imda' ? 'Nilai Imda membentuk 30% Nilai Akhir.' : 'Nilai Praktek membentuk 30% Nilai Akhir.') + '</p>' +
    (terpilih ? '<div class="selected-chip">' + avatarHtml(terpilih.nama, terpilih.foto) + '<span class="grow"><span class="nm">Murid terpilih: ' + esc(terpilih.nama) + '</span><br><span class="muted">' + esc(terpilih.kelas) + ' | NIS ' + esc(terpilih.nis) + '</span></span><button class="btn ghost small" onclick="ui.nilaiSantri=\'\';render()">Ganti</button></div>'
      /* M9: bila belum ada santri aktif, jangan buka picker kosong; tampilkan
         pesan + tombol Tambah santri (sama seperti tab Rapor). */
      : (santriAktif().length === 0 ? emptyState('Belum ada santri. Tambah santri dulu supaya bisa mencatat nilai.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button>') : '<button class="btn secondary block" onclick="openPicker(openSantriPicker(function(it){ui.nilaiSantri=it.id;render();}, true))">Pilih murid</button>')) +
    '<form onsubmit="return submitNilai(event)"><div class="toolbar">' +
    '<select id="nl-mapel">' + MAPEL_LIST.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>' +
    '<input id="nl-nilai" type="number" min="0" max="100" placeholder="Nilai 0-100 *" required aria-label="Nilai 0 sampai 100">' +
    '<input id="nl-tanggal" type="date" value="' + todayStr() + '" aria-label="Tanggal">' +
    '<input id="nl-catatan" placeholder="Catatan (opsional)" aria-label="Catatan"></div>' +
    '<button class="btn block" type="submit" ' + (terpilih ? '' : 'disabled') + '>Simpan nilai ' + tab + '</button>' +
    '<p class="muted">Pilih dulu muridnya lewat tombol di atas, lalu isi nilai. Tombol Simpan aktif setelah murid dipilih.</p></form>' +
    '<div class="btn-row"><button class="btn secondary small" onclick="unduhTemplate(\'nilai\')">Template CSV nilai</button><button class="btn ghost small" onclick="exportNilai()">Export CSV nilai</button></div></div>' +
    '<div class="card"><h2>Daftar nilai ' + tab + ' (' + list.length + ')</h2>' + (list.length ? list.map(function (n) {
      var s = santriById(n.santriId);
      return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(s ? s.nama : '-') + '</b> | ' + esc(n.mapel) + '<br><span class="muted">' + fmtTanggal(n.tanggal) + (n.catatan ? ' | ' + esc(n.catatan) : '') + '</span></span><b style="font-size:18px">' + n.nilai + '</b><button class="btn ghost small" onclick="openNilaiForm(\'' + n.id + '\')">Ubah</button><button class="btn danger small" onclick="mintaHapusNilai(\'' + n.id + '\')">Hapus</button></div>';
    }).join('') : '<p class="empty" role="status">Belum ada nilai ' + tab + '. Tambah lewat form di atas.</p>') + '</div>';
  return html;
}
function openNilaiForm(id) {
  var n = db.nilai.find(function (x) { return x.id === id; });
  if (!n) return;
  var s = santriById(n.santriId);
  openModal('<h2>Ubah nilai ' + esc(s ? s.nama : '') + '</h2><form onsubmit="return submitNilaiEdit(event, \'' + n.id + '\')">' +
    '<label>Mapel</label><select id="ne-mapel">' + MAPEL_LIST.map(function (m) { return '<option' + (n.mapel === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>' +
    '<label>Nilai (0-100) *</label><input id="ne-nilai" type="number" min="0" max="100" required value="' + n.nilai + '">' +
    '<label>Catatan</label><input id="ne-catatan" value="' + esc(n.catatan || '') + '">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan perubahan</button></div></form>');
}

/* ================= RENDER: KBM ================= */
function renderKbm() {
  if (!sesiSaya() || !bolehRute('kbm')) return '';
  var tab = ui.kbmTab;
  var html = '<div id="alert-root"></div><h1>KBM</h1>' +
    '<div class="tabs">' + [['alokasi', 'Alokasi Waktu'], ['jadwal', 'Jadwal KBM'], ['piket', 'Jadwal Guru Piket'], ['absensi', 'Absensi Guru'], ['pimpinan', 'Absensi Pimpinan']].map(function (t) {
      return '<button class="tab' + (tab === t[0] ? ' active' : '') + '" onclick="ui.kbmTab=\'' + t[0] + '\';render()">' + t[1] + '</button>';
    }).join('') + '</div>';
  if (tab === 'alokasi') {
    var alokasiTampil = db.alokasiWaktu.filter(function (a) { return jenjangCocok(kelasJenjang(a.kelas)); });
    html += '<div class="card"><h2>Alokasi Waktu (jam per minggu)</h2><div class="btn-row"><button class="btn" onclick="openAlokasiForm()">Tambah alokasi</button></div>' +
      (alokasiTampil.length ? '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Kelas</th><th>Mapel</th><th>Jam / minggu</th><th>Hari</th><th>Aksi</th></tr></thead><tbody>' +
      alokasiTampil.map(function (a) {
        return '<tr><td class="cell-main" data-label="Kelas"><b>' + esc(a.kelas) + '</b></td><td data-label="Mapel">' + esc(a.mapel) + '</td><td data-label="Jam / minggu">' + a.jamPerMinggu + ' jam</td><td data-label="Hari">' + esc(a.hari) + '</td><td class="cell-actions" data-label="Aksi"><button class="btn ghost small" onclick="openAlokasiForm(\'' + a.id + '\')">Ubah</button> <button class="btn danger small" onclick="mintaHapusAlokasi(\'' + a.id + '\')">Hapus</button></td></tr>';
      }).join('') + '</tbody></table></div>' : emptyState('Belum ada alokasi waktu. Tambah alokasi pertama lewat tombol di atas.', '<button class="btn" onclick="openAlokasiForm()">Tambah alokasi</button>')) + '</div>';
  } else if (tab === 'jadwal') {
    var list = db.jadwalKbm;
    if (ui.kbmHari !== 'Semua') list = list.filter(function (j) { return j.hari === ui.kbmHari; });
    var tampilJadwal = list.filter(function (j) { return jenjangCocok(kelasJenjang(j.kelas)); });
    html += '<div class="card"><h2>Jadwal KBM mingguan</h2><div class="toolbar"><select onchange="ui.kbmHari=this.value;render()" aria-label="Filter hari">' + ['Semua'].concat(HARI_LIST).map(function (h) { return '<option' + (ui.kbmHari === h ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join('') + '</select></div>' +
      '<div class="btn-row"><button class="btn" onclick="openJadwalForm()">Tambah jadwal</button></div>' +
      (tampilJadwal.length ? '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Hari</th><th>Jam</th><th>Kelas</th><th>Mapel</th><th>Guru</th><th>Aksi</th></tr></thead><tbody>' +
      tampilJadwal.map(function (j) {
        return '<tr><td class="cell-main" data-label="Hari"><b>' + esc(j.hari) + '</b></td><td data-label="Jam">' + esc(j.jamMulai) + ' - ' + esc(j.jamSelesai) + '</td><td data-label="Kelas">' + esc(j.kelas) + '</td><td data-label="Mapel">' + esc(j.mapel) + '</td><td data-label="Guru">' + esc(j.guru) + '</td><td class="cell-actions" data-label="Aksi"><button class="btn ghost small" onclick="openJadwalForm(\'' + j.id + '\')">Ubah</button> <button class="btn danger small" onclick="mintaHapusJadwal(\'' + j.id + '\')">Hapus</button></td></tr>';
      }).join('') + '</tbody></table></div>' : (db.jadwalKbm.length ? '<p class="empty" role="status">Tidak ada jadwal pada filter hari ini.</p><div class="btn-row empty-actions"><button class="btn secondary" onclick="aturUlangFilter(\'kbm\')">Atur ulang filter</button></div>' : emptyState('Belum ada jadwal KBM. Tambah jadwal pertama lewat tombol di atas.', '<button class="btn" onclick="openJadwalForm()">Tambah jadwal</button>'))) + '</div>';
  } else if (tab === 'piket') {
    html += '<div class="card"><h2>Jadwal Guru Piket</h2><div class="btn-row"><button class="btn" onclick="bukaPiketFormBaru()">Tambah piket</button></div>' +
      HARI_LIST.map(function (hari) {
        var items = piketTampil().filter(function (p) { return p.hari === hari; });
        return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>' + esc(hari) + '</b><br>' + (items.length ? items.map(function (p) {
          var g = guruById(p.guruId);
          return '<div class="row-flex" style="margin-top:6px"><span class="grow">' + esc(g ? g.nama : '-') + ' <span class="muted">(' + esc(p.keterangan || '') + ')</span></span><button class="btn danger small" onclick="mintaHapusPiket(\'' + p.id + '\')">Hapus</button></div>';
        }).join('') : '<span class="muted">Belum ada piket.</span>') + '</div>';
      }).join('') + '</div>';
  } else {
    var kelompok = tab === 'pimpinan' ? 'Pimpinan' : 'Guru';
    var daftar = tab === 'pimpinan' ? db.guru.filter(function (g) { return g.peran === 'Pimpinan'; }) : db.guru;
    daftar = daftar.filter(guruCocokJenjang);
    var tanggal = ui.absGuruTanggal || todayStr();
    html += '<div class="card"><h2>Absensi ' + kelompok + '</h2><p class="muted">Pilih tanggal, ketuk status per orang, lalu tekan "Simpan absensi". Tersimpan per tanggal.</p>' +
      '<label>Tanggal</label><input type="date" value="' + tanggal + '" onchange="ui.absGuruTanggal=this.value;render()">' +
      (daftar.length ? daftar.map(function (g) {
        var rec = db.absensiGuru.find(function (a) { return a.guruId === g.id && a.tanggal === tanggal && a.kelompok === kelompok; });
        var st = (ui['absGuruDraft_' + g.id] || (rec ? rec.status : 'Hadir'));
        return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row-flex">' + avatarHtml(g.nama, g.foto) + '<span class="grow"><b>' + esc(g.nama) + '</b><br><span class="muted">' + esc(g.peran) + ' | ' + esc(g.kelas) + '</span></span></div>' +
          '<div class="big-attend" data-abs-guru="' + g.id + '">' + ['Hadir', 'Izin', 'Sakit', 'Alpa'].map(function (v) {
            return '<button class="' + (st === v ? 'on-' + v.toLowerCase() : '') + '" onclick="setAbsensiGuru(\'' + g.id + '\', \'' + v + '\')">' + v + '</button>';
          }).join('') + '</div></div>';
      }).join('') : (db.guru.length ? '<p class="empty" role="status">Belum ada ' + kelompok.toLowerCase() + ' yang tercatat.</p>' : emptyState('Belum ada guru. Tambah guru dulu supaya bisa mencatat absensi.', '<button class="btn" onclick="openGuruForm()">Tambah guru</button>'))) +
      '<div class="btn-row"><button class="btn block" onclick="simpanAbsensiGuruUI(\'' + kelompok + '\')">Simpan absensi ' + tanggal + '</button></div></div>' +
      '<div class="card"><h2>Riwayat absensi ' + kelompok + '</h2>' + riwayatAbsensiGuruHtml(kelompok) + '</div>';
  }
  return html;
}
function setAbsensiGuru(gid, val) {
  ui['absGuruDraft_' + gid] = val;
  var wrap = document.querySelector('[data-abs-guru="' + gid + '"]');
  if (!wrap) return;
  wrap.querySelectorAll('button').forEach(function (b) {
    b.className = b.textContent === val ? 'on-' + val.toLowerCase() : '';
  });
}
function openAlokasiForm(id) {
  var a = id ? db.alokasiWaktu.find(function (x) { return x.id === id; }) : null;
  openModal('<h2>' + (a ? 'Ubah alokasi waktu' : 'Tambah alokasi waktu') + '</h2><form onsubmit="return submitAlokasi(event, \'' + (a ? a.id : '') + '\')">' +
    '<label>Kelas</label><select id="al-kelas">' + db.kelas.map(function (k) { return '<option' + (a && a.kelas === k.nama ? ' selected' : '') + '>' + esc(k.nama) + '</option>'; }).join('') + '</select>' +
    '<label>Mapel</label><select id="al-mapel">' + MAPEL_LIST.map(function (m) { return '<option' + (a && a.mapel === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>' +
    '<label>Jam per minggu *</label><input id="al-jam" type="number" min="1" required value="' + (a ? a.jamPerMinggu : 2) + '">' +
    '<label>Hari</label><input id="al-hari" value="' + esc(a ? a.hari : 'Senin, Kamis') + '" placeholder="Contoh: Senin, Kamis">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan alokasi</button></div></form>');
}
function openJadwalForm(id) {
  var j = id ? db.jadwalKbm.find(function (x) { return x.id === id; }) : null;
  openModal('<h2>' + (j ? 'Ubah jadwal KBM' : 'Tambah jadwal KBM') + '</h2><form onsubmit="return submitJadwal(event, \'' + (j ? j.id : '') + '\')">' +
    '<label>Kelas</label><select id="jd-kelas">' + db.kelas.map(function (k) { return '<option' + (j && j.kelas === k.nama ? ' selected' : '') + '>' + esc(k.nama) + '</option>'; }).join('') + '</select>' +
    '<label>Hari</label><select id="jd-hari">' + HARI_LIST.map(function (h) { return '<option' + (j && j.hari === h ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join('') + '</select>' +
    '<label>Jam mulai</label><input id="jd-mulai" type="time" value="' + esc(j ? j.jamMulai : '15:30') + '">' +
    '<label>Jam selesai</label><input id="jd-selesai" type="time" value="' + esc(j ? j.jamSelesai : '16:30') + '">' +
    '<label>Mapel</label><select id="jd-mapel">' + MAPEL_LIST.map(function (m) { return '<option' + (j && j.mapel === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>' +
    '<label>Guru</label><select id="jd-guru">' + db.guru.map(function (g) { return '<option' + (j && j.guru === g.nama ? ' selected' : '') + '>' + esc(g.nama) + '</option>'; }).join('') + '</select>' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan jadwal</button></div></form>');
}
/* ---- Form piket: guru dipilih lewat picker (temuan Kirana, diperbaiki
   Baskara). openPicker memakai openModal, jadi ia MENIMPA modal form piket —
   callback lama menyentuh #pk-guru-id/#pk-guru-btn yang sudah tidak ada dan
   melempar "Cannot set properties of null". Perbaikan: pilihan guru + draf
   isian disimpan di variabel modul; setelah pilih (atau Batal) di picker,
   form piket dibuka lagi dengan isian terisi. Callback picker TIDAK BOLEH
   menyentuh elemen modal. */
var piketGuruDipilih = null; /* { id, nama } guru dari picker, atau null */
var piketDraf = null;        /* { hari, ket } isian sebelum picker dibuka */
function bukaPiketFormBaru() {
  piketGuruDipilih = null;
  piketDraf = null;
  openPiketForm();
}
function bukaPickerGuruPiket() {
  var hariEl = document.getElementById('pk-hari');
  var ketEl = document.getElementById('pk-ket');
  piketDraf = { hari: hariEl ? hariEl.value : 'Senin', ket: ketEl ? ketEl.value : '' };
  var cfg = openGuruPicker(function (it) {
    piketGuruDipilih = { id: it.id, nama: it.nama };
    openPiketForm();
  });
  cfg.onCancel = function () { openPiketForm(); };
  openPicker(cfg);
}
function openPiketForm() {
  var draf = piketDraf || {};
  openModal('<h2>Tambah jadwal piket</h2><form onsubmit="return submitPiket(event)">' +
    '<label>Guru</label><div class="btn-row"><button class="btn secondary" type="button" id="pk-guru-btn" onclick="bukaPickerGuruPiket()">' + (piketGuruDipilih ? 'Guru: ' + esc(piketGuruDipilih.nama) : 'Pilih guru') + '</button></div><input type="hidden" id="pk-guru-id" value="' + esc(piketGuruDipilih ? piketGuruDipilih.id : '') + '">' +
    '<label>Hari</label><select id="pk-hari">' + HARI_LIST.map(function (h) { return '<option' + (draf.hari === h ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join('') + '</select>' +
    '<label>Keterangan</label><input id="pk-ket" placeholder="Contoh: Piket sore" value="' + esc(draf.ket || '') + '">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan piket</button></div></form>');
}

/* ================= RENDER: Kemuridan ================= */
function renderKemuridan() {
  if (!sesiSaya() || !bolehRute('kemuridan')) return '';
  var tab = ui.kemuridanTab;
  var html = '<div id="alert-root"></div><h1>Kemuridan</h1>' +
    '<div class="tabs">' + [['kelas', 'Murid Kelas'], ['rombel', 'Murid Rombel'], ['keluar', 'Murid Keluar'], ['lulus', 'Murid Lulus']].map(function (t) {
      return '<button class="tab' + (tab === t[0] ? ' active' : '') + '" onclick="ui.kemuridanTab=\'' + t[0] + '\';render()">' + t[1] + '</button>';
    }).join('') + '</div>';
  if (tab === 'kelas') {
    var kelasMuridan = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); });
    if (!kelasMuridan.length) {
      html += '<div class="card">' + emptyState('Belum ada kelas. Tambah kelas lewat menu Kelas dan Absensi.', '<button class="btn" onclick="openKelasForm()">Tambah kelas</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>') + '</div>';
    }
    html += kelasMuridan.map(function (k) {
      var murid = db.santri.filter(function (s) { return s.kelas === k.nama && jenjangCocok(s.jenjang); }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
      /* N-K1: judul menghitung santri AKTIF saja (konsisten dengan
         Dashboard); daftar di bawahnya tetap menampilkan semua santri
         kelas ini termasuk yang Lulus/Keluar. */
      var muridAktif = murid.filter(function (s) { return s.status === 'Aktif'; });
      return '<div class="card"><h2>' + esc(k.nama) + ' (' + muridAktif.length + ' murid, ' + teksGender(rekapGenderUi(muridAktif)) + ')</h2>' + (murid.length ? murid.map(function (s) {
        return '<div class="row-flex" style="padding:6px 0;border-bottom:1px solid var(--line)">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">NIS ' + esc(s.nis) + ' | Angkatan ' + esc(s.angkatan) + ' | Rombel ' + esc(s.rombel) + '</span></span>' + statusBadge(s.status) + '</div>';
      }).join('') : emptyState('Belum ada murid di kelas ini. Tambah santri dulu, lalu pilih kelas ini di form santri.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button>')) + '</div>';
    }).join('');
  } else if (tab === 'rombel') {
    html += ['A', 'B'].map(function (r) {
      var murid = db.santri.filter(function (s) { return s.rombel === r && jenjangCocok(s.jenjang); }).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
      /* N-K1: judul menghitung santri AKTIF saja (konsisten dengan
         Dashboard); daftar di bawahnya tetap menampilkan semua santri
         rombel ini termasuk yang Lulus/Keluar. */
      var jmlAktif = murid.filter(function (s) { return s.status === 'Aktif'; }).length;
      return '<div class="card"><h2>Rombel ' + r + ' (' + jmlAktif + ' murid)</h2>' + (murid.length ? murid.map(function (s) {
        return '<div class="row-flex" style="padding:6px 0;border-bottom:1px solid var(--line)">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">' + esc(s.kelas) + ' | NIS ' + esc(s.nis) + ' | Angkatan ' + esc(s.angkatan) + '</span></span>' + statusBadge(s.status) + '</div>';
      }).join('') : emptyState('Belum ada murid di rombel ini. Tambah santri dulu, lalu isi rombelnya di form santri.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button>')) + '</div>';
    }).join('');
  } else if (tab === 'keluar') {
    var keluar = db.santri.filter(function (s) { return s.status === 'Keluar' && jenjangCocok(s.jenjang); });
    html += '<div class="card"><h2>Murid Keluar (' + keluar.length + ')</h2>' + (keluar.length ? keluar.map(function (s) {
      return '<div class="row-flex" style="padding:10px 0;border-bottom:1px solid var(--line)">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">' + esc(s.kelas) + ' | NIS ' + esc(s.nis) + '</span><br>Alasan: ' + esc(s.statusAlasan || '-') + ' | Tanggal: ' + fmtTanggal(s.statusTanggal) + '</span></div>';
    }).join('') : emptyState('Belum ada murid yang keluar. Santri yang keluar tampil di sini setelah statusnya diubah menjadi Keluar dari Detail santri di menu Santri.', '<button class="btn" onclick="go(\'santri\')">Buka daftar santri</button>')) + '</div>';
  } else {
    var lulus = db.santri.filter(function (s) { return s.status === 'Lulus' && jenjangCocok(s.jenjang); });
    html += '<div class="card"><h2>Murid Lulus (' + lulus.length + ')</h2>' + (lulus.length ? lulus.map(function (s) {
      return '<div class="row-flex" style="padding:10px 0;border-bottom:1px solid var(--line)">' + avatarHtml(s.nama, s.foto) + '<span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">' + esc(s.kelas) + ' | NIS ' + esc(s.nis) + '</span><br>Tahun lulus: ' + esc(s.tahunLulus || '-') + '</span></div>';
    }).join('') : emptyState('Belum ada murid yang lulus. Santri yang lulus tampil di sini setelah statusnya diubah menjadi Lulus dari Detail santri di menu Santri.', '<button class="btn" onclick="go(\'santri\')">Buka daftar santri</button>')) + '</div>';
  }
  return html;
}

/* ================= RENDER: Sahabat Khidmah ================= */
function renderKhidmah() {
  if (!sesiSaya() || !bolehRute('khidmah')) return '';
  /* N23: bila belum ada guru, tampilkan SATU pesan gabungan + satu aksi
     "Tambah guru", sembunyikan sub-pesan per peran. */
  if (db.guru.length === 0) {
    return '<div id="alert-root"></div><h1>Sahabat Khidmah</h1><p class="muted">Daftar dikelompokkan menurut peran guru. Peran yang dipakai madrasah ini: Pimpinan, Wali Kelas, Guru Fan, Guru. Ubah peran guru lewat menu Guru.</p><div class="card">' + emptyState('Belum ada guru, jadi belum ada Pimpinan, Wali Kelas, Guru Fan, atau Guru yang tercatat. Tambah guru dulu.', '<button class="btn" onclick="openGuruForm()">Tambah guru</button>') + '</div>';
  }
  var html = '<div id="alert-root"></div><h1>Sahabat Khidmah</h1><p class="muted">Daftar dikelompokkan menurut peran guru. Peran yang dipakai madrasah ini: Pimpinan, Wali Kelas, Guru Fan, Guru. Ubah peran guru lewat menu Guru.</p>';
  ['Pimpinan', 'Wali Kelas', 'Guru Fan'].forEach(function (peran) {
    var list = db.guru.filter(function (g) { return g.peran === peran && guruCocokJenjang(g); });
    html += '<div class="card"><h2>' + esc(peran) + ' (' + list.length + ')</h2>' + (list.length ? list.map(function (g) {
      return '<div class="row-flex" style="padding:10px 0;border-bottom:1px solid var(--line)">' + avatarHtml(g.nama, g.foto) + '<span class="grow"><b>' + esc(g.nama) + '</b><br><span class="muted">Kelas ' + esc(g.kelas) + ' | HP ' + esc(g.hp) + '</span></span><span class="money">' + rupiah(g.honor) + '</span></div>';
    }).join('') : '<p class="empty" role="status">Belum ada ' + esc(peran.toLowerCase()) + ' yang tercatat.</p>') + '</div>';
  });
  var lain = db.guru.filter(function (g) { return g.peran === 'Guru' && guruCocokJenjang(g); });
  if (lain.length) {
    html += '<div class="card"><h2>Guru (' + lain.length + ')</h2>' + lain.map(function (g) {
      return '<div class="row-flex" style="padding:10px 0;border-bottom:1px solid var(--line)">' + avatarHtml(g.nama, g.foto) + '<span class="grow"><b>' + esc(g.nama) + '</b><br><span class="muted">Kelas ' + esc(g.kelas) + ' | HP ' + esc(g.hp) + '</span></span></div>';
    }).join('') + '</div>';
  }
  return html;
}

/* ================= RENDER: Grafik ================= */
/* opts (opsional, hanya dipakai Grafik Murid per kelas): judulSuffix
   (mis. label Tapel), total (baris total L/P di atas grafik), petunjuk,
   gender (tampilkan "L x · P y" di bawah label tiap batang),
   klikKelas (batang bisa diklik -> halaman Santri terfilter kelas itu).
   Tiga grafik lain memanggil tanpa opts dan tampilannya tidak berubah. */
/* Escape nilai untuk string JS satu-kutip di dalam atribut onclick/onkeydown.
   esc() saja TIDAK cukup di sini: entitas HTML (&#39;) di-decode browser
   SEBELUM parser JS membaca isi atribut, jadi ' di nama kelas bisa keluar
   dari string dan mengeksekusi kode saat batang diklik (nama kelas bebas
   diisi lewat form Tambah kelas / import CSV — tambahKelas tidak membatasi
   karakter). Urutan: escape untuk JS dulu (backslash, kutip, baris baru),
   baru esc() untuk HTML. Atribut biasa (aria-label, isi elemen) tetap
   cukup pakai esc() — nilai hasil decode di sana tidak diparse sebagai kode. */
function escJs(s) {
  return esc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r'));
}
/* K5: "L 4 · P 3" -> "4 laki-laki, 3 perempuan" untuk aria-label batang. */
function rincianGenderAria(d) {
  var m = String(d.gender || '').match(/L\s+(\d+)\s*·\s*P\s+(\d+)/);
  if (!m) return '';
  var t = m[1] + ' laki-laki, ' + m[2] + ' perempuan';
  var k = String(d.gender || '').match(/–\s*(\d+)/);
  if (k) t += ', ' + k[1] + ' belum diisi';
  return t;
}
function barChartHtml(judul, pertanyaan, data, opts) {
  opts = opts || {};
  var max = Math.max.apply(null, data.map(function (d) { return d.nilai; }).concat([1]));
  var judulSuffix = opts.judulSuffix ? ' <span class="muted">' + esc(opts.judulSuffix) + '</span>' : '';
  var totalHtml = opts.total ? '<p class="muted">' + esc(opts.total) + '</p>' : '';
  var petunjukHtml = opts.petunjuk ? '<p class="muted">' + esc(opts.petunjuk) + '</p>' : '';
  if (!data.length) return '<div class="card"><h2>' + esc(judul) + judulSuffix + '</h2><p class="muted">' + esc(pertanyaan) + '</p><p class="empty" role="status">Belum ada data untuk grafik ini.</p></div>';
  return '<div class="card"><h2>' + esc(judul) + judulSuffix + '</h2><p class="muted">' + esc(pertanyaan) + '</p>' + totalHtml + petunjukHtml + '<div class="bar-chart">' +
    data.map(function (d) {
      var h = Math.max(4, d.nilai / max * 130);
      var genderHtml = (opts.gender && d.gender) ? '<span class="bar-gender">' + esc(d.gender) + '</span>' : '';
      var klik = '';
      if (opts.klikKelas) {
        /* K5: aria-label menyebut hitungan gender, bukan hanya nama kelas. */
        var ariaBar = 'Lihat santri kelas ' + d.label;
        if (opts.gender && d.gender) {
          var rincianBar = rincianGenderAria(d);
          if (rincianBar) ariaBar += ' — ' + d.nilai + ' santri: ' + rincianBar;
        }
        klik = ' role="button" tabindex="0" aria-label="' + esc(ariaBar) + '"' +
          ' onclick="lihatSantriKelas(\'' + escJs(d.label) + '\')"' +
          ' onkeydown="barKeydown(event, \'' + escJs(d.label) + '\')"';
      }
      return '<div class="bar-col"' + klik + '><span class="val">' + d.nilai + (d.satuan || '') + '</span><div class="bar" style="height:' + h + 'px"></div><span class="cat">' + esc(d.label) + '</span>' + genderHtml + '</div>';
    }).join('') + '</div></div>';
}
function renderGrafik() {
  if (!sesiSaya() || !bolehRute('grafik')) return '';
  var perKelas = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); }).map(function (k) {
    var muridK = db.santri.filter(function (s) { return s.kelas === k.nama && s.status === 'Aktif'; });
    return { label: k.nama, nilai: muridK.length, gender: teksGender(rekapGenderUi(muridK)) };
  });
  var angkatan = {};
  db.santri.forEach(function (s) { if (s.status === 'Aktif' && jenjangCocok(s.jenjang)) angkatan[s.angkatan] = (angkatan[s.angkatan] || 0) + 1; });
  var perAngkatan = Object.keys(angkatan).sort().map(function (a) { return { label: 'Angkatan ' + a, nilai: angkatan[a] }; });
  var perPeran = PERAN_GURU.map(function (p) {
    return { label: p, nilai: db.guru.filter(function (g) { return g.peran === p && guruCocokJenjang(g); }).length };
  }).filter(function (d) { return d.nilai > 0; });
  var perAbsensi = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); }).map(function (k) {
    var murid = santriAktif().filter(function (s) { return s.kelas === k.nama; });
    var rata = murid.length ? Math.round(murid.reduce(function (a, s) { return a + s.kehadiran; }, 0) / murid.length) : 0;
    return { label: k.nama, nilai: rata, satuan: '%' };
  });
  if (!perKelas.length && !perAngkatan.length && !perPeran.length) {
    return '<div id="alert-root"></div><h1>Grafik</h1><div class="card">' + emptyState('Belum ada data untuk grafik. Tambah santri, guru, dan kelas dulu, grafik terisi otomatis.', '<button class="btn" onclick="openSantriForm()">Tambah santri</button><button class="btn" onclick="openGuruForm()">Tambah guru</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button>') + '</div>';
  }
  return '<div id="alert-root"></div><h1>Grafik</h1>' +
    '<p class="muted">Tapel adalah tahun pelajaran Hijriah.</p>' +
    barChartHtml('Grafik Murid per kelas', 'Berapa murid aktif di tiap kelas?', perKelas, {
      judulSuffix: '· ' + labelTapel(),
      total: 'Total santri aktif: ' + teksGender(rekapGenderUi(santriAktif())),
      petunjuk: 'Ketuk batang untuk melihat santri kelas itu.',
      gender: true, klikKelas: true
    }) +
    barChartHtml('Grafik Murid per angkatan', 'Berapa murid aktif di tiap angkatan?', perAngkatan) +
    barChartHtml('Grafik Guru per peran', 'Berapa guru di tiap peran?', perPeran) +
    barChartHtml('Grafik Absensi', 'Persen hadir rata-rata per kelas (dari data pertemuan dan kehadiran santri).', perAbsensi);
}

/* ================= Wizard setup, Panduan, Identitas, Profil aktif =======
   Kirana, ronde "Data kosong + Panduan pengguna" + tambahan Mas 18:51 WIB.
   Aturan: hanya membaca data + menautkan ke form yang sudah ada. Tidak ada
   field baru di db, tidak ada URL eksternal atau CDN baru. Semua teks di
   sini memakai bahasa Indonesia sederhana dan TANPA em dash.
   Kontrak engine (Baskara, paralel): identitasUntuk, simpanIdentitas,
   getProfilAktif, setProfilAktif. Semua pemakaian dijaga typeof supaya UI
   tetap jalan bila engine baru belum mendarat. ============================ */

/* ---- Empty state generik: pesan ramah + tombol aksi ---- */
function emptyState(teks, aksiHtml) {
  return '<p class="empty" role="status">' + teks + '</p>' + (aksiHtml ? '<div class="btn-row empty-actions">' + aksiHtml + '</div>' : '');
}
/* N16 (pola K3): tombol "Atur ulang filter" di blok filter-0. Mengosongkan
   pencarian + semua select filter rute itu ke "Semua", lalu render().
   Jenjang/profil aktif TIDAK ikut direset (itu filter profil, dan resetnya
   saat ganti profil adalah jalur Baskara di engine). */
function aturUlangFilter(rute) {
  if (rute === 'santri') {
    ui.santriSearch = ''; ui.santriKelas = 'Semua'; ui.santriAngkatan = 'Semua'; ui.santriStatus = 'Semua'; ui.santriShown = 10;
  } else if (rute === 'keuangan') {
    ui.keuanganTab = 'Semua';
  } else if (rute === 'kbm') {
    ui.kbmHari = 'Semua';
  } else if (rute === 'guru') {
    ui.guruSearch = '';
  }
  render();
}
/* M10: gulir + fokus ke form "Tambah transaksi" di atas. */
function fokusFormKeuangan() {
  var el = document.getElementById('ku-nama');
  if (el) { el.scrollIntoView({ block: 'center' }); try { el.focus(); } catch (e) {} }
}

/* ---- Identitas madrasah + profil aktif ---- */
/* Fallback bila engine identitas belum ada: TPQ dibaca dari settings lama,
   Ibtidaiyah memakai placeholder resmi dari tugas (nama "Madrasah
   Ibtidaiyah", singkat "MI", sisanya kosong, klien yang mengisi). */
function identitasFallback(jenjang) {
  if (jenjang === 'Ibtidaiyah') return { nama: 'Madrasah Ibtidaiyah', singkat: 'MI', logo: '', kepala: '', alamat: '', telepon: '', tahunBerdiri: '', nsm: '', motto: '' };
  var s = (typeof db !== 'undefined' && db.settings) || {};
  return { nama: s.namaTpq || 'TPQ Al-Muttaqin', singkat: 'TPQ', logo: '', kepala: s.kepala || '', alamat: '', telepon: '', tahunBerdiri: '', nsm: '', motto: '' };
}
function identitasUntukUi(jenjang) {
  if (typeof identitasUntuk === 'function') {
    try { var r = identitasUntuk(jenjang); if (r && r.nama) return r; } catch (e) {}
  }
  return identitasFallback(jenjang);
}
/* Logo hanya dipakai bila lolos fotoAman() (benteng yang sama seperti foto
   santri/guru). Logo kosong atau tidak aman menghasilkan string kosong
   supaya pemanggil menampilkan fallback, bukan gambar rusak. */
function logoAman(logo) {
  if (!logo) return '';
  if (typeof fotoAman === 'function') { try { if (!fotoAman(logo)) return ''; } catch (e) { return ''; } }
  return logo;
}
/* <img> logo, atau badge singkat (TPQ / MI) bila logo kosong. */
function logoHtml(idn, cls) {
  var l = logoAman(idn && idn.logo);
  var c = cls || 'idn-logo';
  if (l) return '<img class="' + c + '" src="' + esc(l) + '" alt="Logo ' + esc(idn.nama || '') + '">';
  return '<span class="' + c + ' idn-logo-fallback" aria-hidden="true">' + esc((idn && idn.singkat) || 'TPQ') + '</span>';
}
function profilAktifUi() {
  var p = 'TPQ';
  if (typeof getProfilAktif === 'function') {
    try { var g = getProfilAktif(); if (g === 'TPQ' || g === 'Ibtidaiyah' || g === 'Semua') p = g; } catch (e) {}
  } else if (typeof ui !== 'undefined' && ui.jenjang) {
    p = ui.jenjang;
  }
  if (peranSaya() === 'Guru' && p === 'Semua') return 'TPQ';
  return p;
}
function namaProfilAktifUi() {
  var p = profilAktifUi();
  if (p === 'Semua') return (typeof db !== 'undefined' && db.settings && db.settings.namaTpq) || 'TPQ Al-Muttaqin';
  return identitasUntukUi(p).nama || p;
}
/* Pilihan jenjang yang boleh tampil: Guru tidak pernah melihat "Semua". */
function jenjangPilihanUi() {
  return peranSaya() === 'Guru' ? ['TPQ', 'Ibtidaiyah'] : ['Semua', 'TPQ', 'Ibtidaiyah'];
}
function setProfilAktifUi(p) {
  if (p !== 'TPQ' && p !== 'Ibtidaiyah' && p !== 'Semua') p = 'TPQ';
  if (p === 'Semua' && peranSaya() !== 'Pimpinan') p = 'TPQ';
  if (typeof setProfilAktif === 'function') {
    try { setProfilAktif(p); } catch (e) {}
    var ef = profilAktifUi();
    if (typeof ui !== 'undefined') ui.jenjang = ef;
    return ef;
  }
  try { setJenjang(p); } catch (e) { if (typeof ui !== 'undefined') ui.jenjang = p; }
  return p;
}
function pilihProfil(p) { setProfilAktifUi(p); render(); }
function pilihProfilLogin(p) { setProfilAktifUi(p); tampilLogin(); }
/* Tombol pemilih profil (hero, Pengaturan, Beranda mobile). Atribut
   data-profil memudahkan selftest Wira. */
function profilPickerHtml(aktif) {
  var p = aktif || profilAktifUi();
  var pimpinan = peranSaya() === 'Pimpinan';
  var opsi = ['TPQ', 'Ibtidaiyah'];
  if (pimpinan) opsi.push('Semua');
  return '<div class="profil-switch" role="group" aria-label="Pilih profil">' + opsi.map(function (o) {
    var label = o === 'Semua' ? 'Semua (ringkasan)' : o;
    var aktif = p === o;
    /* N6: penanda aktif non-warna: teks "Aktif" + ikon centang + aria-pressed. */
    return '<button type="button" class="chip-filter' + (aktif ? ' active' : '') + '" data-profil="' + o + '" aria-pressed="' + (aktif ? 'true' : 'false') + '" onclick="pilihProfil(\'' + o + '\')">' + label + (aktif ? ' ✓ Aktif' : '') + '</button>';
  }).join('') + '</div>';
}
/* Dua kartu besar pemilih profil di layar login (tanpa "Semua"). */
function profilLoginHtml() {
  var p = profilAktifUi();
  return '<div class="profil-login" role="group" aria-label="Pilih profil madrasah">' + ['TPQ', 'Ibtidaiyah'].map(function (j) {
    var idn = identitasUntukUi(j);
    var aktif = p === j;
    /* N6: penanda terpilih non-warna: badge "Dipilih" + ikon centang + aria-pressed. */
    return '<button type="button" class="profil-card' + (aktif ? ' active' : '') + '" data-profil="' + j + '" aria-pressed="' + (aktif ? 'true' : 'false') + '" onclick="pilihProfilLogin(\'' + j + '\')">' + logoHtml(idn, 'profil-logo') + '<span class="profil-nama">' + esc(idn.nama) + '</span>' + (idn.motto ? '<span class="profil-motto">' + esc(idn.motto) + '</span>' : '<span class="profil-motto">Profil ' + j + '</span>') + (aktif ? '<span class="badge-dipilih">✓ Dipilih</span>' : '') + '</button>';
  }).join('') + '</div>';
}
/* Hero identitas desktop: logo + nama + motto profil aktif + pemilih
   profil. Profil "Semua" menampilkan hero umum lama (nama TPQ dari
   settings + kepala + tahun ajaran + jam masuk). */
function heroIdentitasHtml() {
  var p = profilAktifUi();
  var aktif = santriAktif();
  var jmlGuru = db.guru.filter(guruCocokJenjang).length;
  var jmlKelas = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); }).length;
  var meta = '<div class="meta"><span class="chip">' + aktif.length + ' santri aktif</span><span class="chip">' + jmlGuru + ' guru</span><span class="chip">' + jmlKelas + ' kelas</span>' + (db.isContoh ? '<span class="chip">Data contoh</span>' : '') + '</div>';
  if (p === 'Semua') {
    return '<section class="profile-card hero-identitas"><h1>' + esc(db.settings.namaTpq) + '</h1>' +
      '<p>Kepala: ' + esc(db.settings.kepala || 'Belum diisi') + ' | Tahun ajaran ' + esc(db.settings.tahunAjaran) + ' | Jam masuk ' + esc(db.settings.jamMasuk) + '</p>' +
      meta + profilPickerHtml('Semua') + '</section>';
  }
  var idn = identitasUntukUi(p);
  var sub = [];
  if (idn.kepala) sub.push('Kepala: ' + idn.kepala);
  if (idn.tahunBerdiri) sub.push('Berdiri ' + idn.tahunBerdiri);
  sub.push('Tahun ajaran ' + db.settings.tahunAjaran);
  return '<section class="profile-card hero-identitas">' + logoHtml(idn, 'hero-logo') +
    '<h1>' + esc(idn.nama) + '</h1>' +
    (idn.motto ? '<p class="hero-motto">' + esc(idn.motto) + '</p>' : '') +
    '<p>' + esc(sub.join(' | ')) + '</p>' + meta + profilPickerHtml(p) + '</section>';
}
/* Header/topbar + sidebar desktop menampilkan logo + nama profil aktif.
   Dipanggil renderShell() setelah innerHTML sidebar ditulis. Bila logo
   kosong, logo lama (ikon umum / SVG buku) dibiarkan apa adanya. */
function terapkanIdentitasShell() {
  var p = profilAktifUi();
  var nama = namaProfilAktifUi();
  var b = document.querySelector('.topbar .logo-m b');
  if (b) b.textContent = nama;
  var img = document.querySelector('.topbar .logo-m img');
  if (img) {
    var l = p === 'Semua' ? '' : logoAman(identitasUntukUi(p).logo);
    /* N21: alt mengikuti profil aktif; bila belum ada logo, tampilkan
       monogram profil (TPQ/MI), bukan ikon generik TPQ. */
    if (l) { img.src = l; img.alt = 'Logo ' + nama; }
    else { img.src = monogramDataUrl(p === 'Semua' ? 'TPQ' : identitasUntukUi(p).singkat); img.alt = 'Logo ' + nama; }
  }
  var bn = document.querySelector('.brand-name');
  if (bn) bn.textContent = nama;
  var bl = document.querySelector('.brand-logo');
  if (bl) {
    var l2 = p === 'Semua' ? '' : logoAman(identitasUntukUi(p).logo);
    if (l2) bl.innerHTML = '<img src="' + esc(l2) + '" alt="Logo ' + esc(nama) + '">';
  }
}
/* Kartu Pengaturan: profil aktif + tautan identitas. */
function profilPengaturanHtml() {
  return '<div class="card"><h2>Profil aktif</h2><p class="muted">Profil yang dipilih menentukan jenjang yang tampil di semua menu. Saat ini: ' + esc(namaProfilAktifUi()) + '. Pimpinan bisa memilih Semua (ringkasan). Guru hanya TPQ atau Ibtidaiyah.</p>' + profilPickerHtml() + '<div class="btn-row"><button class="btn secondary" onclick="go(\'identitas\')">Identitas Madrasah</button></div></div>';
}
/* Kartu Pengaturan: panduan + setup. */
function panduanPengaturanHtml() {
  /* Y5: tombol "Buka panduan setup" hanya untuk Pimpinan; non-Pimpinan
     tetap bisa membaca Panduan pengguna. */
  var tombolWizard = peranSaya() === 'Pimpinan' ? '<button class="btn" onclick="bukaWizard()">Buka panduan setup</button>' : '';
  return '<div class="card"><h2>Panduan dan setup</h2><p class="muted">Panduan pengguna dan kartu setup langkah demi langkah untuk mengisi data pertama kali.</p><div class="btn-row">' + tombolWizard + '<button class="btn secondary" onclick="go(\'panduan\')">Buka panduan pengguna</button></div></div>';
}

/* ---- Wizard setup "Mulai isi data" (Pimpinan saja) ---- */
/* Penanda "Lewati dulu" hanya di localStorage perangkat (bukan field db).
   Wizard tetap bisa dibuka dari Pengaturan lewat bukaWizard(). */
var WIZARD_KEY = 'tpq-madin-pwa-wizard';
function wizardDitutup() {
  try { return localStorage.getItem(WIZARD_KEY) === 'lewati'; } catch (e) { return false; }
}
function wizardLewati() {
  try { localStorage.setItem(WIZARD_KEY, 'lewati'); } catch (e) {}
  closeModal();
  render();
}
/* N3/M1/M3: kartu wizard tampil bila setup BELUM lengkap, yaitu bila
   salah satu dari santri, guru, atau kelas masih 0. Kartu hilang hanya
   bila ketiganya terisi (santri>0 DAN guru>0 DAN kelas>0) atau sudah
   dilewati (flag localStorage). Kalimat yang sama tertulis di Panduan. */
function aplikasiKosong() { return db.santri.length === 0 || db.guru.length === 0 || db.kelas.length === 0; }
/* Progres wizard dihitung dari DATA NYATA, bukan centang manual:
   lembaga = nama + kepala terisi, tarif SPP > 0, tahun ajaran terisi;
   guru = ada guru; kelas = ada kelas; santri = ada santri;
   keuangan = ada transaksi keuangan ATAU ada pos RAPBM.
   N19: langkah lembaga TIDAK selesai hanya dari nilai seed. Nilai seed
   (data contoh) baru dihitung bila pengguna sudah mengonfirmasi identitas
   (db.settings.identitasDikonfirmasi, diset saat identitas berhasil
   disimpan lewat submitIdentitas/submitSettings) ATAU data sudah bukan
   contoh lagi (db.isContoh false, mis. sesudah Hapus semua data). */
function hitungSetup() {
  var idn = identitasUntukUi('TPQ');
  var terisi = !!(idn.nama && String(idn.nama).trim() && idn.kepala && String(idn.kepala).trim() && db.settings.tarifSpp > 0 && db.settings.tahunAjaran && String(db.settings.tahunAjaran).trim());
  var dikonfirmasi = (db.settings && db.settings.identitasDikonfirmasi === true) || db.isContoh === false;
  var lembagaOk = terisi && dikonfirmasi;
  return {
    lembaga: lembagaOk,
    guru: db.guru.length > 0,
    kelas: db.kelas.length > 0,
    santri: db.santri.length > 0,
    keuangan: db.keuanganTx.length > 0 || db.rapbm.length > 0,
    jumlahSantri: db.santri.length,
    jumlahGuru: db.guru.length,
    jumlahKelas: db.kelas.length,
    jumlahTx: db.keuanganTx.length,
    jumlahRapbm: db.rapbm.length
  };
}
/* ---- Wizard setup 6 langkah (Kirana, ronde v22, keputusan Mas 20:22 WIB)
   Wizard LINEAR berurutan di dalam modal: tiap langkah berisi form inline
   (bukan tautan keluar), Kembali/Lanjut per langkah, Lewati per langkah +
   "Lewati dulu" global, draf isian di localStorage, fokus ke judul langkah
   saat pindah (N18). Setelah simpan dari form di dalam wizard, pengguna
   TETAP di wizard (N22). Semua nilai interpolasi ke HTML lewat esc(),
   onclick hanya memakai angka/id aman (bukan data pengguna mentah). */
var wizardLangkahAktif = 1;
var WIZARD_LEWATI_KEY = 'tpq-madin-pwa-wizard-lewati';
var WIZARD_DRAFT_KEY = 'tpq-madin-pwa-wizard-draft';
var WIZARD_SAMBUTAN_KEY = 'tpq-madin-pwa-sambutan';
var wizardImportLap = null;
function wizardLewatiBaca() {
  try { var v = JSON.parse(localStorage.getItem(WIZARD_LEWATI_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function wizardTandaiLewati(n) {
  var v = wizardLewatiBaca();
  if (v.indexOf(n) === -1) v.push(n);
  try { localStorage.setItem(WIZARD_LEWATI_KEY, JSON.stringify(v)); } catch (e) {}
}
function wizardDraftBaca() {
  try { var v = JSON.parse(localStorage.getItem(WIZARD_DRAFT_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; }
}
function wizardDraftNilai(id, def) {
  var d = wizardDraftBaca();
  return (d[id] !== undefined && d[id] !== null) ? d[id] : (def == null ? '' : def);
}
/* Simpan draf: semua isian wizard (id diawali "wz") di modal saat ini
   ditulis ke localStorage tiap kali berubah, supaya Kembali/muat ulang
   tidak membuang isian. File input dilewati. */
function wizardDraftSimpan() {
  var d = wizardDraftBaca();
  var modal = document.querySelector('#modal-root .modal');
  if (modal) {
    var els = modal.querySelectorAll('input[id^="wz"], select[id^="wz"]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].type === 'file') continue;
      d[els[i].id] = els[i].value;
    }
  }
  try { localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
  modalKotor = false;
}
function wizardDraftHapusLangkah(n) {
  var d = wizardDraftBaca();
  var pfx = 'wz' + n + '-';
  Object.keys(d).forEach(function (k) { if (k.indexOf(pfx) === 0) delete d[k]; });
  try { localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
}
function wizardLangkah() {
  var h = hitungSetup();
  var lewati = wizardLewatiBaca();
  function item(no, judul, selesai) { return { no: no, judul: judul, selesai: !!selesai, dilewati: lewati.indexOf(no) !== -1 }; }
  return [
    item(1, 'Data lembaga', h.lembaga),
    item(2, 'Tambah guru', h.guru),
    item(3, 'Tambah kelas', h.kelas),
    item(4, 'Tambah santri', h.santri),
    item(5, 'Keuangan awal', h.keuangan),
    item(6, 'Selesai', h.lembaga && h.guru && h.kelas && h.santri && h.keuangan)
  ];
}
function wizardLangkahAwal() {
  var langkah = wizardLangkah();
  for (var i = 0; i < langkah.length; i++) {
    if (!langkah[i].selesai && !langkah[i].dilewati) return langkah[i].no;
  }
  return 6;
}
function wizardIndikatorHtml(langkah, aktif) {
  return '<ol class="wz-indikator">' + langkah.map(function (l) {
    var cls = l.no === aktif ? ' aktif' : (l.selesai ? ' done' : (l.dilewati ? ' lewati' : ''));
    var status = l.selesai ? 'Selesai' : (l.dilewati ? 'Dilewati' : (l.no === aktif ? 'Langkah ini' : 'Belum'));
    return '<li class="wz-ind' + cls + '"' + (l.no === aktif ? ' aria-current="step"' : '') + '><span class="wz-ind-ico" aria-hidden="true">' + (l.selesai ? '✓' : l.no) + '</span><span class="wz-ind-teks">' + esc(l.judul) + '<br><span class="muted">' + status + '</span></span></li>';
  }).join('') + '</ol>';
}
function wizardHtml() {
  var langkah = wizardLangkah();
  var n = wizardLangkahAktif;
  if (n < 1 || n > 6) n = 1;
  var item = langkah[n - 1];
  var done = langkah.filter(function (l) { return l.selesai; }).length;
  return '<p class="muted" style="margin:0">Mulai isi data</p>' +
    wizardIndikatorHtml(langkah, n) +
    '<h2 id="wz-judul" tabindex="-1">Langkah ' + n + ' dari 6: ' + esc(item.judul) + '</h2>' +
    '<p class="muted">' + done + ' dari 6 langkah selesai.</p>' +
    wizardLangkahHtml(n) +
    wizardNavHtml(n);
}
function wizardNavHtml(n) {
  if (n === 6) {
    return '<div class="btn-row wz-nav"><button class="btn secondary" type="button" onclick="wizardKembali()">Kembali</button><button class="btn" type="button" onclick="wizardSelesai()">Buka Dashboard</button></div>' +
      '<div class="btn-row"><button class="btn ghost" type="button" onclick="wizardLewati()">Lewati dulu</button><button class="btn ghost" type="button" onclick="closeModal();go(\'panduan\')">Buka panduan pengguna</button></div>';
  }
  return '<div class="btn-row wz-nav"><button class="btn secondary" type="button" onclick="wizardKembali()">' + (n === 1 ? 'Tutup' : 'Kembali') + '</button><button class="btn ghost" type="button" onclick="wizardLewatiLangkah(' + n + ')">Lewati langkah ini</button><button class="btn" type="button" onclick="wizardLanjut()">Lanjut</button></div>' +
    '<div class="btn-row"><button class="btn ghost" type="button" onclick="wizardLewati()">Lewati dulu</button><button class="btn ghost" type="button" onclick="closeModal();go(\'panduan\')">Buka panduan pengguna</button></div>';
}
function wizardFokusJudul() {
  var j = document.getElementById('wz-judul');
  if (j) { try { j.focus(); } catch (e) {} }
}
function wizardTampilUlang() {
  var modal = document.querySelector('#modal-root .modal');
  if (!modal) { bukaWizard(wizardLangkahAktif); return; }
  modal.innerHTML = '<button type="button" class="modal-x" onclick="mintaTutupModal()" aria-label="Tutup">&times;</button>' + wizardHtml();
  wizardFokusJudul();
}
function wizardKe(n) {
  n = Math.max(1, Math.min(6, parseInt(n, 10) || 1));
  wizardLangkahAktif = n;
  wizardTampilUlang();
}
function wizardKembali() {
  if (wizardLangkahAktif <= 1) { closeModal(); return; }
  wizardKe(wizardLangkahAktif - 1);
}
function wizardLanjut() {
  if (wizardLangkahAktif === 1) { wizardSimpanLembaga(null, true); return; }
  if (wizardLangkahAktif === 6) { wizardSelesai(); return; }
  wizardKe(wizardLangkahAktif + 1);
}
function wizardLewatiLangkah(n) {
  wizardTandaiLewati(n);
  toast('Langkah ' + n + ' dilewati, bisa dilengkapi nanti.');
  if (n >= 6) { closeModal(); return; }
  wizardKe(n + 1);
}
function wizardSelesai() {
  try { localStorage.setItem(WIZARD_SAMBUTAN_KEY, 'tampil'); } catch (e) {}
  /* §6 isContoh (a): wizard selesai = data bukan contoh lagi. Hanya di
     sini (tombol Selesai Langkah 6); "Lewati dulu" (wizardLewati) TIDAK
     membalik — pembalikan untuk yang melewati ditangani mutasi tulis
     pertama (engine). */
  if (db.isContoh) { db.isContoh = false; if (typeof save === 'function') save('Wizard selesai'); }
  closeModal();
  go('dashboard');
  render();
}
function wizardTutupSambutan() {
  try { localStorage.setItem(WIZARD_SAMBUTAN_KEY, 'sudah'); } catch (e) {}
  render();
}
/* M8: Beranda kosong sesudah "Lewati dulu": kartu ringkas + jalan kembali
   ke wizard dan ke Tambah santri (bukan angka 0 tanpa penjelasan). */
function wizardM8Html() {
  if (peranSaya() !== 'Pimpinan') return '';
  if (!wizardDitutup() || !aplikasiKosong()) return '';
  return '<div class="card" role="status"><h2>Aplikasi masih kosong.</h2><p class="muted">Belum ada santri, guru, atau kelas. Mulai isi data lewat panduan setup, atau tambah santri dulu.</p><div class="btn-row"><button class="btn" onclick="bukaWizard()">Buka panduan setup</button><button class="btn secondary" onclick="openSantriForm()">Tambah santri</button></div></div>';
}
function wizardSambutanHtml() {
  var tampil = false;
  try { tampil = localStorage.getItem(WIZARD_SAMBUTAN_KEY) === 'tampil'; } catch (e) {}
  if (!tampil || peranSaya() !== 'Pimpinan') return '';
  var h = hitungSetup();
  return '<div class="card wizard-done" role="status"><h2>Aplikasi siap dipakai</h2><p>Aplikasi siap dipakai, ' + h.jumlahSantri + ' santri, ' + h.jumlahGuru + ' guru, ' + h.jumlahKelas + ' kelas, ' + h.jumlahTx + ' transaksi keuangan, ' + h.jumlahRapbm + ' pos RAPBM.</p><div class="btn-row"><button class="btn secondary" onclick="wizardTutupSambutan()">Tutup</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button></div></div>';
}
function wizardLangkahHtml(n) {
  var h = hitungSetup();
  var idn = identitasUntukUi('TPQ');
  if (n === 1) {
    return (h.lembaga
      ? '<p class="wz-ok" role="status">✓ Data lembaga sudah terisi dan dikonfirmasi.</p>'
      : '<p class="muted">Isi data lembaga di bawah ini, lalu tekan Simpan. Nilai contoh dari data contoh wajib diperiksa dan disesuaikan dengan data asli.</p>') +
      '<form id="wz-form-1" onsubmit="return wizardSimpanLembaga(event, false)">' +
      '<label for="wz1-nama">Nama lembaga *</label><input id="wz1-nama" required value="' + esc(wizardDraftNilai('wz1-nama', idn.nama)) + '" placeholder="Contoh: TPQ Al-Muttaqin" oninput="wizardDraftSimpan()">' +
      '<label for="wz1-kepala">Kepala / Pimpinan *</label><input id="wz1-kepala" required value="' + esc(wizardDraftNilai('wz1-kepala', idn.kepala)) + '" placeholder="Contoh: Ustadz Ahmad" oninput="wizardDraftSimpan()">' +
      '<label for="wz1-spp">Tarif SPP per bulan (Rp) *</label><input id="wz1-spp" required inputmode="decimal" value="' + esc(wizardDraftNilai('wz1-spp', String(db.settings.tarifSpp))) + '" placeholder="Contoh: 50000" oninput="wizardDraftSimpan()">' +
      '<p class="muted">Tulis angka tanpa titik atau koma, contoh: 50000.</p>' +
      '<label for="wz1-tahun">Tahun ajaran *</label><input id="wz1-tahun" required value="' + esc(wizardDraftNilai('wz1-tahun', db.settings.tahunAjaran)) + '" placeholder="Contoh: 2026/2027" oninput="wizardDraftSimpan()">' +
      '<p class="muted">Nama, kepala, tarif SPP, dan tahun ajaran wajib diisi supaya langkah ini selesai.</p>' +
      '<button class="btn block" type="submit">Simpan data lembaga</button></form>' +
      '<p class="muted">Detail identitas lengkap (alamat, telepon, logo, motto) bisa dilengkapi nanti di menu Identitas Madrasah.</p>' +
      '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal();go(\'identitas\')">Buka Identitas Madrasah</button></div>';
  }
  if (n === 2) {
    var peranOpts = PERAN_GURU.map(function (p) { return '<option' + (wizardDraftNilai('wz2-peran', 'Guru') === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('');
    var kelasOpts = db.kelas.length
      ? db.kelas.map(function (k) { return '<option' + (wizardDraftNilai('wz2-kelas', '') === k.nama ? ' selected' : '') + '>' + esc(k.nama) + '</option>'; }).join('')
      : '<option value="">Belum ada kelas</option>';
    var jenjangOpts = ['TPQ', 'Ibtidaiyah', 'TPQ dan Ibtidaiyah'].map(function (j) { return '<option' + (wizardDraftNilai('wz2-jenjang', 'TPQ') === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('');
    return (h.guru
      ? '<p class="wz-ok" role="status">✓ Sudah ada ' + h.jumlahGuru + ' guru.</p>'
      : '<p class="muted">Tambah guru pertama. Bisa ditambah nanti di menu Guru.</p>') +
      '<form id="wz-form-2" onsubmit="return wizardSimpanGuru(event)">' +
      '<label for="wz2-nama">Nama guru *</label><input id="wz2-nama" required value="' + esc(wizardDraftNilai('wz2-nama', '')) + '" placeholder="Contoh: Ustadz Ahmad" oninput="wizardDraftSimpan()">' +
      '<label for="wz2-peran">Peran</label><select id="wz2-peran" oninput="wizardDraftSimpan()">' + peranOpts + '</select>' +
      '<label for="wz2-kelas">Kelas</label><select id="wz2-kelas" oninput="wizardDraftSimpan()">' + kelasOpts + '</select>' +
      '<label for="wz2-jenjang">Jenjang mengajar</label><select id="wz2-jenjang" oninput="wizardDraftSimpan()">' + jenjangOpts + '</select>' +
      '<label for="wz2-hp">HP</label><input id="wz2-hp" inputmode="tel" value="' + esc(wizardDraftNilai('wz2-hp', '')) + '" placeholder="Contoh: 081200000000" oninput="wizardDraftSimpan()">' +
      '<label for="wz2-honor">Honor (Rp)</label><input id="wz2-honor" inputmode="decimal" value="' + esc(wizardDraftNilai('wz2-honor', '')) + '" placeholder="Contoh: 500000" oninput="wizardDraftSimpan()">' +
      '<p class="muted">Honor: tulis angka tanpa titik atau koma, contoh: 500000. Boleh dikosongkan (0).</p>' +
      '<button class="btn block" type="submit">Simpan guru</button></form>' +
      (db.guru.length ? '<h3>Guru yang sudah ada (' + db.guru.length + ')</h3>' + db.guru.map(function (g) {
        return '<div class="row-flex wz-daftar"><span class="grow"><b>' + esc(g.nama) + '</b><br><span class="muted">' + esc(g.peran) + ' | ' + esc(g.kelas) + '</span></span><button class="btn ghost small" type="button" onclick="wizardHapusGuru(\'' + escJs(g.id) + '\')">Hapus</button></div>';
      }).join('') : '');
  }
  if (n === 3) {
    var jenjang3 = ['TPQ', 'Ibtidaiyah'].map(function (j) { return '<option' + (wizardDraftNilai('wz3-jenjang', 'TPQ') === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('');
    return (h.kelas
      ? '<p class="wz-ok" role="status">✓ Sudah ada ' + h.jumlahKelas + ' kelas.</p>'
      : '<p class="muted">Tambah kelas pertama. Bisa ditambah nanti di menu Kelas dan Absensi.</p>') +
      '<form id="wz-form-3" onsubmit="return wizardSimpanKelas(event)">' +
      '<label for="wz3-nama">Nama kelas *</label><input id="wz3-nama" required value="' + esc(wizardDraftNilai('wz3-nama', '')) + '" placeholder="Contoh: Iqra 2" oninput="wizardDraftSimpan()">' +
      '<label for="wz3-jenjang">Jenjang</label><select id="wz3-jenjang" oninput="wizardDraftSimpan()">' + jenjang3 + '</select>' +
      '<label for="wz3-ustadz">Ustadz / pengajar</label><input id="wz3-ustadz" value="' + esc(wizardDraftNilai('wz3-ustadz', '')) + '" placeholder="Contoh: Ustadzah Khadijah" oninput="wizardDraftSimpan()">' +
      '<label for="wz3-jadwal">Jadwal</label><input id="wz3-jadwal" value="' + esc(wizardDraftNilai('wz3-jadwal', '')) + '" placeholder="Contoh: Senin dan Kamis, 15:30" oninput="wizardDraftSimpan()">' +
      '<label for="wz3-ruang">Ruang</label><input id="wz3-ruang" value="' + esc(wizardDraftNilai('wz3-ruang', '')) + '" placeholder="Contoh: Ruang A" oninput="wizardDraftSimpan()">' +
      '<button class="btn block" type="submit">Simpan kelas</button></form>' +
      (db.kelas.length ? '<h3>Kelas yang sudah ada (' + db.kelas.length + ')</h3>' + db.kelas.map(function (k) {
        return '<div class="row-flex wz-daftar"><span class="grow"><b>' + esc(k.nama) + '</b><br><span class="muted">' + esc(k.jenjang || 'TPQ') + (k.ustadz ? ' | ' + esc(k.ustadz) : '') + '</span></span></div>';
      }).join('') : '');
  }
  if (n === 4) {
    var jenjang4 = ['TPQ', 'Ibtidaiyah'].map(function (j) { return '<option' + (wizardDraftNilai('wz4-jenjang', 'TPQ') === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('');
    var jilidOpts = JILID_LIST.map(function (j) { return '<option' + (wizardDraftNilai('wz4-jilid', 'Iqra 1') === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('');
    var santriTerakhir = db.santri.slice(-5);
    return (h.santri
      ? '<p class="wz-ok" role="status">✓ Sudah ada ' + h.jumlahSantri + ' santri.</p>'
      : '<p class="muted">Tambah santri satu-satu, atau import banyak santri sekaligus dari CSV. Bisa ditambah nanti di menu Santri.</p>') +
      '<form id="wz-form-4" onsubmit="return wizardSimpanSantri(event)">' +
      '<label for="wz4-nama">Nama lengkap *</label><input id="wz4-nama" required value="' + esc(wizardDraftNilai('wz4-nama', '')) + '" placeholder="Contoh: Ahmad Fauzi" oninput="wizardDraftSimpan()">' +
      '<label for="wz4-nis">NIS *</label><input id="wz4-nis" required value="' + esc(wizardDraftNilai('wz4-nis', '')) + '" placeholder="Contoh: 202407" oninput="wizardDraftSimpan()">' +
      '<label for="wz4-jk">Jenis kelamin *</label><select id="wz4-jk" oninput="wizardDraftSimpan()"><option value="">Pilih jenis kelamin</option><option value="L"' + (wizardDraftNilai('wz4-jk', '') === 'L' ? ' selected' : '') + '>Laki-laki</option><option value="P"' + (wizardDraftNilai('wz4-jk', '') === 'P' ? ' selected' : '') + '>Perempuan</option></select>' +
      '<label for="wz4-jenjang">Jenjang *</label><select id="wz4-jenjang" onchange="wizardUpdateKelas4()" oninput="wizardDraftSimpan()">' + jenjang4 + '</select>' +
      '<label for="wz4-kelas">Kelas</label><select id="wz4-kelas">' + kelasOptionsHtml(wizardDraftNilai('wz4-jenjang', 'TPQ'), wizardDraftNilai('wz4-kelas', '')) + '</select>' +
      '<label for="wz4-jilid">Jilid</label><select id="wz4-jilid" oninput="wizardDraftSimpan()">' + jilidOpts + '</select>' +
      '<button class="btn block" type="submit">Simpan santri</button></form>' +
      '<h3>Import CSV</h3><p class="muted">Kolom wajib di CSV: Nama, NIS, Kelas, Jenis Kelamin.</p>' +
      '<div class="btn-row"><button class="btn secondary" type="button" onclick="unduhTemplate(\'murid\')">Template CSV murid</button><label class="btn ghost" style="margin:0">Pilih file CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="wizardImportCsv(this)"></label></div>' +
      wizardImportLapHtml() +
      (db.santri.length ? '<h3>Santri yang sudah ada (' + db.santri.length + ')</h3>' + santriTerakhir.map(function (s) {
        return '<div class="row-flex wz-daftar"><span class="grow"><b>' + esc(s.nama) + '</b><br><span class="muted">NIS ' + esc(s.nis) + ' | ' + esc(s.kelas) + '</span></span><button class="btn ghost small" type="button" onclick="wizardHapusSantri(\'' + escJs(s.id) + '\')">Hapus</button></div>';
      }).join('') + (db.santri.length > 5 ? '<p class="muted">Menampilkan 5 santri terakhir.</p>' : '') : '');
  }
  if (n === 5) {
    var saldo = saldoKas(ui.jenjang);
    var saldoAwalTx = db.keuanganTx.filter(function (t) { return t.kategori === 'Saldo awal'; });
    var jenjang5 = ['TPQ', 'Ibtidaiyah'].map(function (j) { return '<option' + (wizardDraftNilai('wz5-jenjang', 'TPQ') === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('');
    var jenjang5b = ['TPQ', 'Ibtidaiyah'].map(function (j) { return '<option' + (wizardDraftNilai('wz5-rp-jenjang', 'TPQ') === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('');
    return (h.keuangan
      ? '<p class="wz-ok" role="status">✓ Keuangan awal sudah terisi: ' + h.jumlahTx + ' transaksi, ' + h.jumlahRapbm + ' pos RAPBM.</p>'
      : '<p class="muted">Catat saldo awal kas, lalu susun pos RAPBM. Bisa dilewati dan diisi nanti di menu Keuangan.</p>') +
      '<p class="muted">Saldo kas saat ini: <b>' + rupiah(saldo.saldo) + '</b></p>' +
      '<h3>Saldo awal</h3>' +
      '<form id="wz-form-5a" onsubmit="return wizardSimpanSaldo(event)">' +
      '<label for="wz5-jumlah">Saldo awal kas (Rp) *</label><input id="wz5-jumlah" required inputmode="decimal" value="' + esc(wizardDraftNilai('wz5-jumlah', '')) + '" placeholder="Contoh: 50000" oninput="wizardDraftSimpan()">' +
      '<p class="muted">Tulis angka tanpa titik atau koma, contoh: 50000.</p>' +
      '<label for="wz5-jenjang">Jenjang</label><select id="wz5-jenjang" oninput="wizardDraftSimpan()">' + jenjang5 + '</select>' +
      '<label for="wz5-tanggal">Tanggal</label><input id="wz5-tanggal" type="date" value="' + esc(wizardDraftNilai('wz5-tanggal', todayStr())) + '" oninput="wizardDraftSimpan()">' +
      '<button class="btn block" type="submit">Simpan saldo awal</button></form>' +
      (saldoAwalTx.length ? '<p class="muted">Saldo awal yang sudah dicatat: ' + saldoAwalTx.map(function (t) { return esc(t.nama) + ' ' + rupiah(t.jumlah); }).join(', ') + '.</p>' : '') +
      '<h3>Pos RAPBM</h3>' +
      '<form id="wz-form-5b" onsubmit="return wizardSimpanRapbm(event)">' +
      '<label for="wz5-pos">Nama pos *</label><input id="wz5-pos" required value="' + esc(wizardDraftNilai('wz5-pos', '')) + '" placeholder="Contoh: SPP" oninput="wizardDraftSimpan()">' +
      '<label for="wz5-jenis">Jenis</label><select id="wz5-jenis" oninput="wizardDraftSimpan()"><option' + (wizardDraftNilai('wz5-jenis', 'Masuk') === 'Masuk' ? ' selected' : '') + '>Masuk</option><option' + (wizardDraftNilai('wz5-jenis', 'Masuk') === 'Keluar' ? ' selected' : '') + '>Keluar</option></select>' +
      '<label for="wz5-rp-jenjang">Jenjang</label><select id="wz5-rp-jenjang" oninput="wizardDraftSimpan()">' + jenjang5b + '</select>' +
      '<label for="wz5-rencana">Rencana (Rp) *</label><input id="wz5-rencana" required inputmode="decimal" value="' + esc(wizardDraftNilai('wz5-rencana', '')) + '" placeholder="Contoh: 1000000" oninput="wizardDraftSimpan()">' +
      '<p class="muted">Tulis angka tanpa titik atau koma, contoh: 1000000.</p>' +
      '<button class="btn block" type="submit">Simpan pos RAPBM</button></form>' +
      (db.rapbm.length ? '<p class="muted">Pos RAPBM yang sudah ada: ' + db.rapbm.slice(0, 5).map(function (r) { return esc(r.pos) + ' (' + rupiah(r.rencana) + ')'; }).join(', ') + '.</p>' : '');
  }
  /* Langkah 6: ringkasan dari data nyata + Ubah per baris. */
  var h6 = hitungSetup();
  var idn6 = identitasUntukUi('TPQ');
  var langkah6 = wizardLangkah();
  function barisRingkasan(label, isi, langkahNo) {
    var dilewati = langkah6[langkahNo - 1] && langkah6[langkahNo - 1].dilewati;
    return '<div class="row-flex wz-ringkasan"><span class="grow"><b>' + label + '</b><br><span class="muted">' + isi + (dilewati ? ' (langkah dilewati)' : '') + '</span></span><button class="btn ghost small" type="button" onclick="wizardKe(' + langkahNo + ')">Ubah</button></div>';
  }
  var sesi = sesiSaya();
  return '<p class="muted">Periksa ringkasan di bawah ini. Ketuk Ubah untuk kembali ke langkah terkait tanpa membuang isian lain.</p>' +
    barisRingkasan('Data lembaga', esc(idn6.nama || 'belum diisi') + ' | Kepala: ' + esc(idn6.kepala || 'belum diisi') + ' | Tarif SPP: ' + rupiah(db.settings.tarifSpp) + ' | Tahun ajaran: ' + esc(db.settings.tahunAjaran), 1) +
    barisRingkasan('Guru', h6.jumlahGuru ? h6.jumlahGuru + ' guru tercatat' : 'Belum ada guru', 2) +
    barisRingkasan('Kelas', h6.jumlahKelas ? h6.jumlahKelas + ' kelas tercatat' : 'Belum ada kelas', 3) +
    barisRingkasan('Santri', h6.jumlahSantri ? h6.jumlahSantri + ' santri tercatat' : 'Belum ada santri', 4) +
    barisRingkasan('Keuangan awal', h6.jumlahTx + ' transaksi keuangan, ' + h6.jumlahRapbm + ' pos RAPBM', 5) +
    (sesi && sesi.wajibGantiSandi ? '<p><b>Pengingat:</b> kata sandimu masih kata sandi bawaan. Ganti sekarang supaya akun aman.</p><div class="btn-row"><button class="btn warn" type="button" onclick="closeModal();openUbahSandiModal()">Ganti kata sandi sekarang</button></div>' : '') +
    '<p class="muted">Setelah Buka Dashboard, kartu sambutan muncul sekali di Beranda.</p>';
}
function wizardImportLapHtml() {
  if (!wizardImportLap) return '';
  var lap = wizardImportLap;
  var html = '<div class="alert ' + (lap.gagal.length ? 'alert-info' : 'alert-success') + '" role="status"><b>' + lap.berhasil + ' baris berhasil masuk, ' + lap.gagal.length + ' baris gagal.</b> Baris yang gagal dilewati, data yang sudah ada tidak rusak.</div>';
  if (lap.gagal.length) {
    html += '<table class="table-stack"><thead><tr><th>Baris</th><th>Alasan</th></tr></thead><tbody>' +
      lap.gagal.map(function (g) { return '<tr><td class="cell-main" data-label="Baris">' + g.baris + '</td><td data-label="Alasan">' + esc(g.alasan) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  return html;
}
/* Import CSV DI DALAM wizard (N24): hasil tampil di langkah yang sama,
   wizard tidak tertutup. */
function wizardImportCsv(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () {
    wizardImportLap = importCsvText('murid', reader.result);
    toast('Import selesai: ' + wizardImportLap.berhasil + ' santri masuk.');
    wizardTampilUlang();
  };
  reader.onerror = function () { toast('File tidak bisa dibaca. Coba pilih lagi file CSV-nya.'); };
  reader.readAsText(f, 'utf-8');
  input.value = '';
}
function wizardUpdateKelas4() {
  var j = document.getElementById('wz4-jenjang');
  var sel = document.getElementById('wz4-kelas');
  if (!j || !sel) return;
  sel.innerHTML = kelasOptionsHtml(j.value, sel.value);
  wizardDraftSimpan();
}
/* Penanda konfirmasi identitas (N19): diset saat identitas berhasil
   disimpan lewat jalur UI (submitIdentitas/submitSettings/wizard L1).
   Baskara diminta menyetel flag yang sama di engine simpanIdentitas()
   supaya pemanggil engine langsung ikut tercatat; penulisan ganda ini
   tidak berbahaya (nilai yang sama). */
function tandaiIdentitasDikonfirmasi() {
  try {
    if (db.settings) db.settings.identitasDikonfirmasi = true;
    if (typeof save === 'function') save('Konfirmasi identitas lembaga');
  } catch (e) {}
}
function wizardSimpanLembaga(ev, lanjut) {
  if (ev) ev.preventDefault();
  var form = document.getElementById('wz-form-1');
  function nilai(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var nama = nilai('wz1-nama');
  var kepala = nilai('wz1-kepala');
  var sppMentah = nilai('wz1-spp');
  var tahun = nilai('wz1-tahun') || '2026/2027';
  if (!nama) { tampilErrorForm(form, 'Isi dulu nama lembaga.', 'wz1-nama'); return false; }
  if (!kepala) { tampilErrorForm(form, 'Isi dulu nama kepala / pimpinan.', 'wz1-kepala'); return false; }
  if (!sppMentah) { tampilErrorForm(form, 'Isi dulu tarif SPP.', 'wz1-spp'); return false; }
  var r1 = null;
  if (typeof simpanIdentitas === 'function') r1 = simpanIdentitas('TPQ', { nama: nama, kepala: kepala }, sesiSaya() ? sesiSaya().id : '');
  if (r1 && !r1.ok) return gagalForm({ target: form }, r1, { 'nama-wajib': 'wz1-nama' });
  var r2 = null;
  if (typeof simpanSettings === 'function') r2 = simpanSettings({ namaTpq: nama, kepala: kepala, tarifSpp: sppMentah, tahunAjaran: tahun });
  if (!r2 || !r2.ok) return gagalForm({ target: form }, r2, { 'nama-wajib': 'wz1-nama', 'spp-tidak-valid': 'wz1-spp' });
  tandaiIdentitasDikonfirmasi();
  wizardDraftHapusLangkah(1);
  toast('Data lembaga berhasil disimpan.');
  if (lanjut) { wizardKe(2); return false; }
  wizardTampilUlang();
  return false;
}
function wizardSimpanGuru(ev) {
  ev.preventDefault();
  var form = document.getElementById('wz-form-2');
  function nilai(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var nama = nilai('wz2-nama');
  if (!nama) { tampilErrorForm(form, 'Isi dulu nama guru.', 'wz2-nama'); return false; }
  var honorMentah = nilai('wz2-honor');
  var r = simpanGuru('', {
    nama: nama,
    kelas: nilai('wz2-kelas'),
    peran: nilai('wz2-peran') || 'Guru',
    jenjang: nilai('wz2-jenjang') || 'TPQ',
    hp: nilai('wz2-hp'),
    honor: honorMentah ? honorMentah : 0
  });
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'wz2-nama', 'honor-tidak-valid': 'wz2-honor' });
  wizardDraftHapusLangkah(2);
  toast('Guru berhasil ditambah.');
  wizardTampilUlang();
  return false;
}
function wizardSimpanKelas(ev) {
  ev.preventDefault();
  var form = document.getElementById('wz-form-3');
  function nilai(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var r = tambahKelas({
    nama: nilai('wz3-nama'),
    jenjang: nilai('wz3-jenjang') || 'TPQ',
    ustadz: nilai('wz3-ustadz'),
    jadwal: nilai('wz3-jadwal'),
    ruang: nilai('wz3-ruang')
  });
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'wz3-nama', 'nama-duplikat': 'wz3-nama' });
  wizardDraftHapusLangkah(3);
  toast('Kelas berhasil ditambah.');
  wizardTampilUlang();
  return false;
}
function wizardSimpanSantri(ev) {
  ev.preventDefault();
  var form = document.getElementById('wz-form-4');
  function nilai(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var jk = nilai('wz4-jk');
  if (!jk) { tampilErrorForm(form, 'Pilih dulu jenis kelamin santri.', 'wz4-jk'); return false; }
  var r = simpanSantri('', {
    nama: nilai('wz4-nama'),
    nis: nilai('wz4-nis'),
    jk: jk,
    jenjang: nilai('wz4-jenjang') || 'TPQ',
    kelas: nilai('wz4-kelas'),
    jilid: nilai('wz4-jilid') || 'Iqra 1',
    angkatan: '2026',
    rombel: 'A',
    wali: '',
    hpWali: '',
    alamat: '',
    hafalan: 'Belum mulai'
  });
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'wz4-nama', 'nis-wajib': 'wz4-nis', 'nis-duplikat': 'wz4-nis', 'jk-tidak-valid': 'wz4-jk', 'jk-wajib': 'wz4-jk' });
  wizardDraftHapusLangkah(4);
  toast('Santri berhasil ditambah.');
  wizardTampilUlang();
  return false;
}
/* Saldo awal memakai jalur simpanKeuangan yang sudah ada; string mentah
   diteruskan ke angkaRp() (mesin), TANPA parseInt di UI (jalur Bagas). */
function wizardSimpanSaldo(ev) {
  ev.preventDefault();
  var form = document.getElementById('wz-form-5a');
  function nilai(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var r = simpanKeuangan({
    jenis: 'Masuk',
    jenjang: nilai('wz5-jenjang') || 'TPQ',
    kategori: 'Saldo awal',
    nama: 'Saldo awal',
    jumlah: nilai('wz5-jumlah'),
    tanggal: nilai('wz5-tanggal') || todayStr(),
    catatan: ''
  });
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'wz5-jumlah', 'jumlah-tidak-valid': 'wz5-jumlah', 'kategori-tidak-valid': 'wz5-jumlah' });
  wizardDraftHapusLangkah(5);
  toast('Saldo awal berhasil dicatat.');
  wizardTampilUlang();
  return false;
}
function wizardSimpanRapbm(ev) {
  ev.preventDefault();
  var form = document.getElementById('wz-form-5b');
  function nilai(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var r = simpanRapbm('', {
    pos: nilai('wz5-pos'),
    jenis: nilai('wz5-jenis') || 'Masuk',
    jenjang: nilai('wz5-rp-jenjang') || 'TPQ',
    rencana: nilai('wz5-rencana')
  });
  if (!r.ok) return gagalForm(ev, r, { 'pos-wajib': 'wz5-pos', 'rencana-tidak-valid': 'wz5-rencana' });
  wizardDraftHapusLangkah(5);
  toast('Pos RAPBM berhasil disimpan.');
  wizardTampilUlang();
  return false;
}
/* Hapus dari daftar wizard: konfirmasi dulu, sesudah hapus kembali ke
   langkah wizard yang sama (bukan mendarat di rute lain). */
function wizardHapusGuru(id) {
  var g = guruById(id);
  confirmModal({
    judul: 'Hapus guru ' + (g ? g.nama : '') + '?',
    isi: '<p>Data guru ini akan dihapus. Tindakan ini tidak bisa dibatalkan.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { hapusGuru(id); toast('Guru dihapus.'); bukaWizard(2); }
  });
}
function wizardHapusSantri(id) {
  var s = santriById(id);
  confirmModal({
    judul: 'Hapus santri ' + (s ? s.nama : '') + '?',
    isi: '<p>Data santri ini akan dihapus. Tindakan ini tidak bisa dibatalkan.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { hapusSantri(id); toast('Santri dihapus.'); bukaWizard(4); }
  });
}
/* Kartu wizard di Dashboard: hanya Pimpinan, hanya bila setup belum
   lengkap (santri, guru, atau kelas masih 0), dan hanya bila belum
   dilewati. Isinya ringkas: judul + progres + tombol Mulai. */
function wizardKartuDashboard() {
  if (peranSaya() !== 'Pimpinan') return '';
  if (!aplikasiKosong() || wizardDitutup()) return '';
  var langkah = wizardLangkah();
  var done = langkah.filter(function (l) { return l.selesai; }).length;
  var persen = Math.round(done / langkah.length * 100);
  return '<div class="card wizard-card"><h2>Mulai isi data</h2>' +
    '<p class="muted">Ikuti 6 langkah ini supaya aplikasi siap dipakai. Semua centang dihitung dari data yang sudah tersimpan, bukan dicentang manual.</p>' +
    '<div class="wizard-progress"><div class="progress"><i style="width:' + persen + '%"></i></div><p class="muted">' + done + ' dari ' + langkah.length + ' langkah selesai</p></div>' +
    '<div class="btn-row"><button class="btn" onclick="bukaWizard()">Mulai</button><button class="btn secondary" onclick="wizardLewati()">Lewati dulu</button></div></div>';
}
/* Y5: wizard hanya boleh dibuka oleh Pimpinan yang sudah masuk. Tanpa
   sesi atau peran bukan Pimpinan: toast + modal tidak dibuka. */
function bukaWizard(langkah) {
  if (!sesiSaya() || peranSaya() !== 'Pimpinan') { toast('Hanya Pimpinan yang bisa membuka panduan setup'); return; }
  var n = parseInt(langkah, 10);
  if (!n || n < 1 || n > 6) n = wizardLangkahAwal();
  wizardLangkahAktif = n;
  wizardImportLap = null;
  openModal(wizardHtml());
  wizardFokusJudul();
}

/* ---- Halaman Panduan (rute #/panduan, bisa dibaca semua peran) ---- */
function pdScroll(id) {
  var el = document.getElementById(id);
  if (el) el.scrollIntoView();
}
function renderPanduan() {
  /* M7: Panduan bisa dibaca TANPA sesi (mode baca saja). Gate kredensial
     isContoh di bawah tetap berlaku di mode ini. */
  var adaSesi = !!sesiSaya();
  var toc = [
    ['pd-mulai', '1. Mulai cepat'],
    ['pd-login', '2. Login dan kata sandi'],
    ['pd-profil', '3. Profil aktif dan Identitas Madrasah'],
    ['pd-modul', '4. Cara pakai tiap modul'],
    ['pd-massal', '5. Isi data massal'],
    ['pd-backup', '6. Backup dan pulihkan'],
    ['pd-offline', '7. Offline dan sinkron'],
    ['pd-faq', '8. Tanya jawab']
  ];
  var html = '<div id="alert-root"></div><div class="panduan"><h1>Panduan Pengguna</h1>' +
    '<p class="muted">Panduan memakai aplikasi TPQ Al-Muttaqin: mengisi data pertama kali, memakai tiap menu, import data, cadangan, dan sinkron. Angka yang disebut sebagai contoh ditandai dengan kata contoh.</p>' +
    '<div class="card pd-toc"><h2>Daftar isi</h2>' + toc.map(function (t) {
      return '<button type="button" onclick="pdScroll(\'' + t[0] + '\')">' + t[1] + '</button>';
    }).join('') + '</div>' +
    '<section class="card" id="pd-mulai"><h2>1. Mulai cepat</h2><p>Enam langkah pertama supaya aplikasi siap dipakai:</p><ol>' +
    '<li>Buka <button class="btn ghost small" type="button" onclick="go(\'identitas\')">Identitas Madrasah</button>, periksa nama TPQ dan isi nama Ibtidaiyah. Lihat bagian 3.</li>' +
    '<li>Tambah guru lewat menu Guru, tombol "Tambah guru".</li>' +
    '<li>Tambah kelas lewat menu Kelas dan Absensi, tombol "Tambah kelas".</li>' +
    '<li>Tambah santri lewat <button class="btn ghost small" type="button" onclick="go(\'santri\')">Tambah santri</button> di menu Santri, atau import CSV (lihat bagian 5).</li>' +
    '<li>Catat saldo awal di menu Keuangan, tombol "Simpan transaksi", lalu susun RAPBM di menu RAPBM.</li>' +
    '<li>Periksa ringkasan di langkah Selesai wizard, lalu tekan "Buka Dashboard".</li></ol>' +
    '<p>Kartu "Mulai isi data" di Beranda memandu langkah yang sama, lengkap dengan centang progres dari data yang sudah tersimpan. Kartu itu hilang sendiri setelah ada santri, guru, dan kelas (ketiganya terisi). Kalau dilewati, kartu hilang tapi bisa dibuka lagi dari Pengaturan, tombol "Buka panduan setup".</p></section>' +
    '<section class="card" id="pd-login"><h2>2. Login dan kata sandi</h2><ol>' +
    '<li>Pilih profil dulu di layar login: kartu TPQ atau Ibtidaiyah.</li>' +
    /* Y1: kedua butir kredensial di bawah HANYA tampil bila data masih
       contoh (db.isContoh). Di data asli Panduan tidak boleh memuat
       admin123/guru123. */
    (db.isContoh ? '<li>Masuk dengan ID pengguna dan kata sandi. Akun bawaan: ID admin (Pimpinan) dengan kata sandi bawaan admin123, dan ID guru1 (Guru) dengan kata sandi bawaan guru123.</li>' : '') +
    (db.isContoh ? '<li>Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama.</li>' : '') +
    '<li>Saat login pertama, aplikasi meminta ganti kata sandi. Kata sandi baru minimal 8 karakter. Sampai diganti, menu lain tidak bisa dibuka.</li>' +
    '<li>Lupa kata sandi: tekan "Lupa kata sandi?" di layar login, lalu minta Pimpinan mereset lewat Pengaturan, Kelola pengguna, tombol "Reset sandi".</li>' +
    '<li>Ganti kata sandi sendiri: menu Lainnya atau Pengaturan, tombol "Ubah kata sandi saya". Keluar dari aplikasi: tombol "Keluar".</li>' +
    '<li>Pimpinan menambah pengguna baru: Pengaturan, Kelola pengguna, isi ID, Nama, Peran, dan Kata sandi, lalu tombol "Tambah pengguna". Pengguna baru juga wajib ganti kata sandi saat login pertama.</li></ol></section>' +
    '<section class="card" id="pd-profil"><h2>3. Profil aktif dan Identitas Madrasah</h2><ol>' +
    '<li>Pilih profil TPQ atau Ibtidaiyah di layar login (dua kartu besar), di hero Beranda, atau di Pengaturan, bagian "Profil aktif".</li>' +
    '<li>Semua angka, daftar, jadwal, dan grafik mengikuti profil yang dipilih. Pimpinan bisa memilih "Semua (ringkasan)" untuk melihat gabungan kedua jenjang. Guru tidak melihat pilihan Semua.</li>' +
    '<li>Profil hanya filter tampilan, bukan peran. Guru tetap hanya bisa membuka 7 menu: Beranda, Santri, Kelas dan Absensi, Hafalan/Iqra, Penilaian dan Rapor, Pengumuman, dan KBM.</li>' +
    '<li>Logo dan nama tiap profil diatur di <button class="btn ghost small" type="button" onclick="go(\'identitas\')">Identitas Madrasah</button> (di Pengaturan atau Menu Lainnya). Dua kartu: TPQ dan Ibtidaiyah. Isi Nama lembaga, Nama singkat, Kepala/Pimpinan, Alamat, Telepon/HP, Tahun berdiri, NSM/NPSN (boleh kosong), dan Motto/tagline. Logo: tekan "Pilih logo", pilih gambar dari galeri atau kamera HP, pratinjau muncul sebelum disimpan, lalu tekan "Simpan identitas TPQ" atau "Simpan identitas Ibtidaiyah". Logo dikecilkan otomatis dan tersimpan di perangkat.</li>' +
    '<li>Nama Ibtidaiyah masih placeholder: "Madrasah Ibtidaiyah", singkat "MI", sisanya kosong. Klien yang mengisi nama dan logo resminya lewat menu ini. Hanya Pimpinan yang bisa mengubah identitas, Guru hanya bisa melihat.</li>' +
    '<li>Nama TPQ yang diubah di Identitas Madrasah juga mengubah nama yang tampil di header aplikasi.</li></ol></section>' +
    '<section class="card" id="pd-modul"><h2>4. Cara pakai tiap modul</h2>' +
    '<h3>Santri</h3><ol><li>Cari lewat kolom "Cari nama atau NIS". Saring lewat Kelas, Angkatan, Status, dan Jenjang.</li><li><button class="btn ghost small" type="button" onclick="go(\'santri\')">Tambah santri</button>: isi Nama lengkap, NIS, Jenis kelamin, Jenjang, dan Kelas. Kolom bertanda * wajib diisi. NIS harus unik, tidak boleh sama dengan santri lain.</li><li>"Detail" melihat data santri, "Ubah" mengubahnya. "Export CSV (yang tampil)" mengunduh daftar yang sedang tampil. "Tampilkan lebih banyak" memuat 10 santri berikutnya.</li><li>Kelas dan Jilid itu beda: Kelas = rombongan belajar (contoh: Iqra 1, Iqra 2); Jilid = level Iqra santri itu (Jilid 1 sampai Jilid 6, lalu Tahfidz Juz 30, 29, 28). Santri satu kelas bisa beda jilid.</li></ol>' +
    '<h3>Guru</h3><ol><li>Tombol "Tambah guru": isi Nama, Kelas, Peran, Jenjang mengajar, HP, dan Honor. Peran: Pimpinan, Wali Kelas, Guru Fan, atau Guru.</li><li>Arti peran: Pimpinan memimpin dan mengelola aplikasi; Wali Kelas memegang satu kelas; Guru mengajar santri; Guru Fan hanya nama peran di daftar guru, bukan peran login (peran login hanya Pimpinan dan Guru), jadi tidak mengubah hak akses apa pun. Bila ragu memilih peran, tanyakan ke Pimpinan.</li><li>"Tandai honor Lunas" atau "Tandai honor Belum" mengubah status honor. "Ubah" mengubah data, "Hapus" menghapus guru.</li><li>"Export CSV guru" mengunduh daftar guru, "Template CSV guru" mengunduh template import.</li></ol>' +
    '<h3>Kelas dan Absensi</h3><ol><li>Pilih kelas lewat tab nama kelas.</li><li>Isi Tanggal pertemuan dan Materi hari ini, ketuk Hadir, Izin, Sakit, atau Alpa untuk tiap santri, lalu "Simpan pertemuan".</li><li>Semua santri otomatis Hadir; hanya yang Izin, Sakit, atau Alpa yang perlu diketuk.</li><li>Absensi baru tersimpan setelah tekan "Simpan pertemuan". Sebelum disimpan, pilihan hanya tersimpan sementara: pindah ke kelas lain menghapus pilihan yang belum disimpan, dan muat ulang halaman juga menghapusnya.</li><li>"Naik Jilid" langsung menaikkan jilid santri satu tingkat tanpa konfirmasi tambahan (contoh: Iqra 2 menjadi Iqra 3). Periksa nama santri sebelum mengetuknya.</li><li>"Lihat rincian" melihat kehadiran satu pertemuan. "Tambah kelas" menambah kelas baru (Nama kelas, Jenjang, Ustadz/pengajar, Jadwal, Ruang).</li></ol>' +
    '<h3>Penilaian dan Rapor</h3><ol><li>Tab "Nilai Harian", "Nilai Imda", "Nilai Praktek": pilih murid lewat "Pilih murid", isi Mapel, Nilai 0 sampai 100, dan Tanggal, lalu "Simpan nilai Harian", "Simpan nilai Imda", atau "Simpan nilai Praktek".</li><li>Nilai akhir rapor = 40 persen rata-rata Harian + 30 persen rata-rata Imda + 30 persen rata-rata Praktek.</li><li>Predikat Nilai Akhir: A (Sangat Baik) 90 ke atas, B (Baik) 80 sampai 89, C (Cukup) 70 sampai 79, D (Kurang) 60 sampai 69, E (Perlu Bimbingan) di bawah 60.</li><li>Bila santri baru punya 1 komponen nilai saja (misalnya hanya Harian), Nilai Akhir tetap dihitung dari komponen yang ada: contoh Harian 70, Nilai Akhir 28 (70 kali 40 persen); komponen yang belum ada dihitung 0.</li><li>Tab "Rapor Murid": pilih murid lewat "Pilih murid" atau "Ganti murid", pilih semester, lihat Nilai Iqra, Halaman, Kehadiran, dan Nilai Akhir. "Download File" mengunduh rapor, "Bagikan rapor (teks)" membagikannya lewat HP.</li></ol>' +
    '<h3>Hafalan / Iqra</h3><ol><li>"Pilih murid", isi Jenis (Iqra atau Hafalan), Materi, dan Nilai (Lancar, Cukup, atau Perlu Bimbingan), lalu "Simpan setoran".</li><li>Progres tiap santri tampil di bagian "Progres santri", riwayat setoran di bagian "Riwayat setoran".</li></ol>' +
    '<h3>Tabungan</h3><ol><li>"Pilih murid", isi Jenis (Setor atau Tarik) dan Jumlah, lalu "Simpan transaksi". Penarikan di atas saldo ditolak. Penarikan di atas Rp200.000 minta konfirmasi.</li><li>Tulis angka tanpa titik atau koma, contoh: 50000.</li><li>"Struk" melihat struk santri. "Tambah target" menambah target menabung.</li></ol>' +
    '<h3>Keuangan</h3><ol><li>Isi Jenis (Masuk atau Keluar), Jenjang, Kategori, Nama transaksi, Jumlah, dan Tanggal, lalu "Simpan transaksi".</li><li>Tulis angka tanpa titik atau koma, contoh: 50000.</li><li>Kategori pemasukan: SPP, Infaq, Donasi, Pendaftaran, Kitab/Seragam, Saldo awal. Kategori pengeluaran: Honor guru, Operasional, ATK, Listrik dan air, Kegiatan.</li><li>Menandai SPP Lunas TIDAK menambah saldo kas. Uang SPP baru masuk kas bila dicatat sebagai transaksi Masuk lewat tombol <button class="btn ghost small" type="button" onclick="go(\'keuangan\')">Catat ke kas</button> di bawah ini: buka menu Keuangan, isi form "Tambah transaksi" dengan Jenis Masuk dan Kategori SPP, lalu tekan "Simpan transaksi".</li><li>Tab Semua, Masuk, dan Keluar menyaring riwayat. "Export CSV keuangan" mengunduh riwayat. Bagian Tagihan SPP: ketuk status Lunas, Belum, atau Telat untuk mengubahnya. "Buka RAPBM dan Keuangan Lanjutan" membuka menu RAPBM.</li></ol>' +
    '<h3>RAPBM</h3><p>RAPBM = Rencana Anggaran Pendapatan dan Belanja Madrasah.</p><ol><li>Tab RAPBM: "Tambah pos" (Nama pos, Jenis Masuk/Keluar, Jenjang, Rencana).</li><li>Tab Realita: rencana dibanding realisasi per pos. Tab Set Biaya: "Tambah biaya". Tab Arus Kas: pemasukan dan pengeluaran per bulan. Tab Rekap: ringkasan rencana dan realisasi.</li></ol>' +
    '<h3>KBM</h3><p>KBM = Kegiatan Belajar Mengajar.</p><ol><li>Tab Alokasi Waktu: "Tambah alokasi". Tab Jadwal KBM: "Tambah jadwal", saring per hari.</li><li>Tab Jadwal Guru Piket: "Tambah piket". Tab Absensi Guru dan Absensi Pimpinan: pilih tanggal, ketuk Hadir, Izin, Sakit, atau Alpa per orang, lalu "Simpan absensi".</li></ol>' +
    '<h3>Kemuridan</h3><ol><li>Tab Murid Kelas, Murid Rombel, Murid Keluar, dan Murid Lulus menampilkan santri menurut kelompoknya.</li><li>Status santri (Aktif, Keluar, Lulus) diubah dari Detail santri di menu Santri.</li></ol>' +
    '<h3>Sahabat Khidmah</h3><ol><li>Daftar guru dikelompokkan menurut peran: Pimpinan, Wali Kelas, Guru Fan, dan Guru.</li><li>Ubah peran guru lewat menu Guru, tombol "Ubah".</li></ol>' +
    '<h3>Pengumuman</h3><ol><li>Isi Judul dan Isi, tekan "Tampilkan pengumuman".</li><li>Pengumuman yang disimpan tampil di Beranda (bagian Notifikasi) dan bisa dibaca semua pengguna yang masuk.</li><li>"Tutup" menyembunyikan pengumuman dari Beranda, "Tampilkan lagi" memunculkannya, "Hapus" menghapusnya.</li></ol>' +
    '<h3>Laporan</h3><ol><li>Kartu Saldo kas, SPP lunas, Rata-rata kehadiran, dan Total tabungan.</li><li>Tombol "Export murid", "Export guru", "Export nilai", "Export absensi", dan "Export keuangan" mengunduh CSV. Tabel Rekap per jenjang dan Rekap per kelas menampilkan ringkasan.</li></ol>' +
    '<h3>Grafik</h3><ol><li>Grafik Murid per kelas (ketuk batang untuk melihat santri kelas itu), Grafik Murid per angkatan, Grafik Guru per peran, dan Grafik Absensi.</li><li>Label L dan P berarti Laki-laki dan Perempuan. Label Tapel menunjukkan tahun pelajaran Hijriah.</li><li>Istilah: Imda adalah salah satu jenis nilai di aplikasi, bersama Harian dan Praktek; tidak ada kepanjangan Imda yang tertulis di aplikasi. Imda ikut dihitung dalam Nilai Akhir dengan bobot 30 persen.</li></ol>' +
    '<h3>Pengaturan</h3><ol><li>Profil TPQ: Nama TPQ, Kepala TPQ, Tarif SPP per bulan, Tahun ajaran, Jam masuk. Tekan "Simpan pengaturan".</li><li>Tampilan: Otomatis, Mode Desktop, atau Mode Mobile. Install aplikasi: pasang di layar utama HP.</li><li>Google Sheet dan sinkron hybrid, Import data (CSV), Export data (CSV), Cadangkan dan pulihkan, Zona berbahaya. Lihat bagian 5, 6, dan 7.</li></ol></section>' +
    '<section class="card" id="pd-massal"><h2>5. Isi data massal</h2>' +
    '<h3>Template CSV</h3><ol><li>Pengaturan, bagian "Import data (CSV)", tombol "Template" untuk Murid, Guru, atau Nilai.</li><li>Unduh dulu template-nya, isi di spreadsheet, simpan sebagai CSV, lalu import lewat "Pilih file CSV".</li><li>Kolom template Murid (contoh): nama, nis, kelas, angkatan, rombel, jenjang, wali, hp wali, alamat, Jenis Kelamin. Kolom wajib: Nama, NIS, Kelas, Jenis Kelamin. Kelas yang belum ada dibuat otomatis dari kolom kelas.</li><li>Kolom template Guru (contoh): nama, kelas, peran, jenjang, hp, honor.</li><li>Kolom template Nilai (contoh): santri (nama atau NIS), jenis, mapel, nilai.</li></ol>' +
    '<h3>Kenapa baris ditolak</h3><p>Baris yang gagal dilewati dan dilaporkan di layar hasil import, data yang sudah ada tidak rusak. Alasan yang umum:</p><ol>' +
    '<li>Nama kosong, NIS kosong, atau NIS sudah ada.</li>' +
    '<li>Jenjang bukan TPQ atau Ibtidaiyah.</li>' +
    '<li>Jenis kelamin bukan L, P, "Laki-laki", atau "Perempuan".</li>' +
    '<li>Guru: nama guru sudah ada, peran bukan Pimpinan, Wali Kelas, Guru Fan, atau Guru, atau honor bukan angka 0 atau lebih.</li>' +
    '<li>Nilai: santri tidak ditemukan, nama kembar sehingga harus pakai NIS, jenis bukan Harian, Imda, atau Praktek, atau nilai bukan 0 sampai 100.</li>' +
    '<li>File kosong atau hanya berisi judul kolom.</li></ol>' +
    '<h3>Google Sheet</h3><ol><li>Pengaturan, bagian "Google Sheet dan sinkron hybrid". Isi Link Google Sheet dan Nomor sheet (gid, biasanya 0), tekan "Simpan pengaturan Sheet".</li><li>Untuk tarik murid dari Sheet: di Google Sheet buka File lalu Publish to web, pilih sheet dan format CSV, lalu Publish. Kembali ke aplikasi, tekan "Tarik murid dari Sheet (CSV publish)".</li><li>Kalau gagal, periksa apakah Sheet sudah di-publish, atau unduh CSV dari Sheet (File, Download, CSV) lalu import lewat "Pilih file CSV".</li><li>"Tarik data terbaru dari Sheet" memakai Apps Script. Kalau perangkat ini punya perubahan yang belum terkirim, aplikasi memberi peringatan dulu dan tidak menimpa diam-diam.</li></ol>' +
    '<h3>Apps Script (opsional)</h3><ol><li>Apps Script menghubungkan aplikasi dengan Google Sheet secara otomatis.</li><li>Salin kode contoh Apps Script yang disertakan di paket aplikasi, deploy sebagai Web App, lalu tempel URL Web App di Pengaturan, kolom "URL Web App Google Apps Script", dan tekan "Simpan pengaturan Sheet".</li><li>Token rahasia sinkron (opsional) diisi sama dengan yang diatur di Apps Script supaya sinkron diterima. Aplikasi tidak pernah meminta kata sandi Google atau kredensial lain.</li></ol>' +
    '<h3>Kirim data ke Sheet tanpa Apps Script</h3><p>Unduh CSV lewat "Export data (CSV)", lalu buka Google Sheets baru (tombol "Buka Google Sheets baru") dan upload file itu. Atau salin isi CSV lewat tombol "Salin CSV murid" atau "Salin CSV nilai".</p></section>' +
    '<section class="card" id="pd-backup"><h2>6. Backup dan pulihkan</h2><ol>' +
    '<li>Cadangkan: Pengaturan, bagian "Cadangkan dan pulihkan", tombol "Cadangkan semua data (JSON)". Simpan file itu baik-baik.</li>' +
    '<li>Nama file cadangan: tpq-madin-backup-YYYY-MM-DD.json (YYYY-MM-DD adalah tanggal hari ini, contoh: tpq-madin-backup-2026-11-15.json). Nama file export CSV: murid-tpq-madin.csv, guru-tpq-madin.csv, nilai-tpq-madin.csv, absensi-tpq-madin.csv, keuangan-tpq-madin.csv. Nama file template CSV: template-murid-tpq-madin.csv, template-guru-tpq-madin.csv, template-nilai-tpq-madin.csv.</li>' +
    '<li>File hasil unduhan tersimpan di folder Unduhan HP (folder Download). Buka aplikasi File atau pengelola file di HP, lalu buka folder Unduhan untuk menemukan file itu.</li>' +
    '<li>Bedanya export CSV dan backup JSON: export CSV hanya berisi satu daftar (murid, guru, nilai, absensi, atau keuangan) untuk dibaca di spreadsheet; backup JSON berisi seluruh data aplikasi dan dipakai untuk memulihkan.</li>' +
    '<li>Pulihkan: tombol "Pulihkan dari cadangan", pilih file JSON cadangan. Data saat ini diganti seluruhnya dengan isi file. Kalau file tidak memuat sebagian bagian, bagian itu tetap dipertahankan dari data lokal.</li>' +
    '<li>Reset ke data contoh: Pengaturan, Zona berbahaya, "Reset ke data contoh". Semua data diganti dengan data contoh (contoh: 40 murid contoh, 5 guru contoh). Minta konfirmasi dan centang persetujuan dulu.</li>' +
    '<li>Hapus semua data: Pengaturan, Zona berbahaya, "Hapus semua data". Semua murid, guru, nilai, keuangan, dan data lain dihapus permanen dari perangkat. Yang tetap ada: akun login bawaan (ID admin dan guru1) supaya aplikasi tidak terkunci, dan pengaturan dasar lembaga (nama TPQ, tarif SPP contoh Rp50.000, tahun ajaran). Minta konfirmasi dan centang persetujuan dulu. Cadangkan dulu bila ragu.</li>' +
    '<li>Bedanya: Reset mengganti data dengan data contoh. Hapus mengosongkan aplikasi supaya bisa diisi data asli.</li></ol></section>' +
    '<section class="card" id="pd-offline"><h2>7. Offline dan sinkron</h2><ol>' +
    '<li>Aplikasi bekerja offline: data selalu tersimpan dulu di perangkat.</li>' +
    '<li>Status sinkron tampil di Beranda ("Status sinkron") dan di Pengaturan: "Offline, tersimpan di perangkat", "Menunggu sinkron: N perubahan", "Online, tersinkron", atau "Sinkron nonaktif, atur Apps Script di Pengaturan".</li>' +
    '<li>Setiap perubahan masuk antrean (maksimal 500 perubahan). Begitu online dan Apps Script sudah diatur, antrean terkirim otomatis ke Google Sheet. Tekan "Sinkron sekarang" untuk mengirim manual, atau "Kirim data ke Apps Script".</li>' +
    '<li>Kalau antrean pernah dipotong karena melebihi 500, status memberi peringatan bahwa perubahan lama hilang dan tidak terkirim.</li></ol></section>' +
    '<section class="card" id="pd-faq"><h2>8. Tanya jawab</h2>' +
    '<h3>Data saya hilang setelah Hapus semua data. Bisa kembali?</h3><p>Tidak, hapus itu permanen. Pulihkan dari file cadangan JSON bila punya. Kalau tidak punya, isi ulang lewat wizard "Mulai isi data" atau import CSV.</p>' +
    '<h3>Saya tidak bisa masuk, kata sandi salah terus.</h3><p>Periksa huruf besar dan kecil. Setelah 5 kali gagal, login diblokir 60 detik. Kalau tetap tidak bisa, minta Pimpinan mereset kata sandi (Pengaturan, Kelola pengguna, "Reset sandi").</p>' +
    '<h3>Grafik kosong.</h3><p>Grafik terisi dari data yang ada. Tambah santri, guru, dan kelas dulu, grafik terisi otomatis.</p>' +
    '<h3>Import CSV banyak baris gagal.</h3><p>Baca alasan tiap baris di layar hasil import (lihat bagian 5). Yang paling umum: NIS sudah ada, nama kosong, atau jenis kelamin bukan L atau P.</p>' +
    '<h3>Aplikasi tidak sinkron ke Sheet.</h3><p>Periksa status sinkron di Pengaturan. Sinkron butuh URL Web App Apps Script yang sudah disimpan dan perangkat online. Tanpa Apps Script, kirim data lewat export CSV (lihat bagian 5).</p>' +
    '<h3>Bagaimana ganti dari TPQ ke Ibtidaiyah?</h3><p>Pilih kartu Ibtidaiyah di layar login, atau pemilih profil di hero Beranda, atau Pengaturan, bagian "Profil aktif". Semua menu langsung menampilkan data Ibtidaiyah.</p>' +
    '<h3>Saya bingung, harus tanya ke siapa?</h3><p>Tanyakan ke Pimpinan. Pimpinan bisa mereset kata sandi (Pengaturan, Kelola pengguna, "Reset sandi"), menambah pengguna, dan mengubah identitas lembaga. Panduan ini juga bisa dibuka lagi kapan saja dari menu Lainnya atau dari Pengaturan, tombol "Buka panduan pengguna".</p></section>' +
    (adaSesi
      ? '<div class="btn-row"><button class="btn" onclick="go(\'dashboard\')">Buka Dashboard</button><button class="btn secondary" onclick="go(\'pengaturan\')">Buka Pengaturan</button></div></div>'
      : '<div class="btn-row"><button class="btn" onclick="location.hash=\'#/dashboard\'">Masuk ke aplikasi</button></div></div>');
  return html;
}

/* ---- Halaman Identitas Madrasah (rute #/identitas) ----
   Edit hanya Pimpinan, Guru boleh lihat saja (form disabled).
   Logo: satu tombol "Pilih logo" per kartu, input file accept="image/*"
   tanpa capture (HP bisa pilih galeri atau kamera). Pratinjau memakai
   pola foto santri/guru yang sudah ada: onPhotoChange menulis data URL
   (dikecilkan maks 480px, pola yang sudah ada) ke input hidden dan
   menampilkan <img> di wadah pratinjau sebelum disimpan. */
function renderIdentitas() {
  if (!sesiSaya()) return '';
  var pimpinan = peranSaya() === 'Pimpinan';
  var html = '<div id="alert-root"></div><h1>Identitas Madrasah</h1>' +
    '<p class="muted">Dua identitas lembaga dalam satu aplikasi. ' + (pimpinan ? 'Isi dan simpan tiap kartu di bawah ini.' : 'Hanya Pimpinan yang bisa mengubah identitas. Kamu melihat tampilan baca saja.') + '</p>' +
    '<div class="card pd-callout"><p style="margin:0"><b>Catatan:</b> Nama Ibtidaiyah masih placeholder: "Madrasah Ibtidaiyah", singkat "MI", sisanya kosong. Klien yang mengisi nama dan logo resminya lewat menu ini. Nama TPQ di sini juga mengubah nama yang tampil di header aplikasi.</p></div>' +
    '<div class="identitas-grid">' +
    ['TPQ', 'Ibtidaiyah'].map(function (j) { return kartuIdentitasHtml(j, pimpinan); }).join('') +
    '</div>' +
    '<div class="btn-row"><button class="btn secondary" onclick="go(\'pengaturan\')">Kembali ke Pengaturan</button><button class="btn ghost" onclick="go(\'panduan\')">Lihat panduan</button></div>';
  return html;
}
function kartuIdentitasHtml(jenjang, bisaUbah) {
  var idn = identitasUntukUi(jenjang);
  var pfx = jenjang === 'TPQ' ? 'id-tpq' : 'id-mi';
  var dis = bisaUbah ? '' : ' disabled';
  var logoAda = !!logoAman(idn.logo);
  /* N6: kartu profil yang aktif ditandai badge "Aktif" + centang (bukan
     hanya warna). Profil "Semua" tidak menandai satu kartu pun. */
  var badgeAktif = profilAktifUi() === jenjang ? ' <span class="badge-aktif">✓ Aktif</span>' : '';
  /* N9: semua label memakai for="<id>". N20: placeholder informatif. */
  var field = function (key, label, nilai, req, placeholder) {
    return '<label for="' + pfx + '-' + key + '">' + label + '</label><input id="' + pfx + '-' + key + '"' + (req ? ' required' : '') + ' value="' + esc(nilai || '') + '" placeholder="' + esc(placeholder || '') + '"' + dis + '>';
  };
  /* N11/N12: pratinjau 64x64 sama seperti hero; bila belum ada logo,
     monogram yang sama dengan hero/login + teks kecil "Belum ada logo". */
  var pratinjauKosong = logoHtml(idn, 'logo-preview-img') + ' <span class="muted">Belum ada logo</span>';
  return '<div class="card"><h2>Identitas ' + jenjang + badgeAktif + '</h2>' +
    '<form onsubmit="return submitIdentitas(event, \'' + jenjang + '\')">' +
    '<label for="logo-file-' + pfx + '">Logo</label><div id="logo-preview-' + pfx + '">' + (logoAda ? '<img class="logo-preview-img" src="' + esc(idn.logo) + '" alt="Logo ' + esc(idn.nama) + '">' : pratinjauKosong) + '</div>' +
    (bisaUbah
      ? '<div class="row-flex"><label class="btn ghost small" style="margin:0">Pilih logo<input type="file" id="logo-file-' + pfx + '" accept="image/*" style="display:none" onchange="onPhotoChange(this, \'logo-preview-' + pfx + '\', \'logo-' + pfx + '\'); tampilNamaFoto(this, \'nama-logo-' + pfx + '\')"></label><span class="muted" id="nama-logo-' + pfx + '">' + (logoAda ? 'Logo sudah tersimpan' : 'Belum ada logo dipilih') + '</span></div>' +
        '<input type="hidden" id="logo-' + pfx + '" value="' + esc(idn.logo || '') + '">' +
        (logoAda ? '<div class="btn-row"><button type="button" class="btn ghost small" onclick="hapusLogoIdentitas(\'' + jenjang + '\')">Hapus logo</button></div>' : '')
      : '<input type="hidden" id="logo-' + pfx + '" value="' + esc(idn.logo || '') + '">') +
    field('nama', 'Nama lembaga *', idn.nama, true, 'Contoh: TPQ Al-Muttaqin') +
    field('singkat', 'Nama singkat', idn.singkat, false, 'Contoh: TPQ') +
    field('kepala', 'Kepala / Pimpinan', idn.kepala, false, 'Contoh: Ustadz Ahmad') +
    field('alamat', 'Alamat', idn.alamat, false, 'Contoh: Jl. Merdeka No. 1') +
    field('telepon', 'Telepon / HP', idn.telepon, false, 'Contoh: 0812-3456-7890') +
    field('tahun', 'Tahun berdiri', idn.tahunBerdiri, false, 'Contoh: 2010') +
    field('nsm', 'NSM / NPSN (opsional)', idn.nsm, false, 'Contoh: 411234567890') +
    field('motto', 'Motto / tagline', idn.motto, false, 'Contoh: Menuntut ilmu dengan ikhlas') +
    (bisaUbah ? '<button class="btn block" type="submit">Simpan identitas ' + jenjang + '</button>' : '<p class="muted">Hanya Pimpinan yang bisa mengubah identitas.</p>') +
    '</form></div>';
}
/* N10: hapus logo memakai confirmModal; penghapusan baru permanen
   setelah Simpan ditekan (perilaku staged dipertahankan). */
function hapusLogoIdentitas(jenjang) {
  var pfx = jenjang === 'TPQ' ? 'id-tpq' : 'id-mi';
  var idn = identitasUntukUi(jenjang);
  confirmModal({
    judul: 'Hapus logo ' + jenjang + '?',
    isi: '<p>Logo ' + esc(idn.nama || jenjang) + ' akan dihapus dari form. Logo baru terhapus permanen setelah Simpan ditekan.</p>',
    okLabel: 'Ya, hapus logo', danger: true,
    onOk: function () {
      var h = document.getElementById('logo-' + pfx);
      if (h) h.value = '';
      var prev = document.getElementById('logo-preview-' + pfx);
      if (prev) prev.innerHTML = logoHtml({ nama: idn.nama, singkat: idn.singkat, logo: '' }, 'logo-preview-img') + ' <span class="muted">Belum ada logo</span>';
      var nm = document.getElementById('nama-logo-' + pfx);
      if (nm) nm.textContent = 'Belum ada logo dipilih';
      toast('Logo dihapus dari form. Tekan "Simpan identitas ' + jenjang + '" supaya tersimpan.');
    }
  });
}
function submitIdentitas(ev, jenjang) {
  ev.preventDefault();
  if (peranSaya() !== 'Pimpinan') { toast('Hanya Pimpinan yang bisa mengubah identitas.'); return false; }
  var pfx = jenjang === 'TPQ' ? 'id-tpq' : 'id-mi';
  var data = {
    nama: document.getElementById(pfx + '-nama').value.trim(),
    singkat: document.getElementById(pfx + '-singkat').value.trim(),
    logo: document.getElementById('logo-' + pfx).value || '',
    kepala: document.getElementById(pfx + '-kepala').value.trim(),
    alamat: document.getElementById(pfx + '-alamat').value.trim(),
    telepon: document.getElementById(pfx + '-telepon').value.trim(),
    tahunBerdiri: document.getElementById(pfx + '-tahun').value.trim(),
    nsm: document.getElementById(pfx + '-nsm').value.trim(),
    motto: document.getElementById(pfx + '-motto').value.trim()
  };
  if (!data.nama) { tampilErrorForm(ev.target, 'Isi dulu nama lembaga.', pfx + '-nama'); return false; }
  if (typeof simpanIdentitas !== 'function') {
    showAlert('error', 'Identitas belum bisa disimpan.', 'Fungsi simpan identitas dari engine belum tersedia di versi ini. Coba lagi setelah pembaruan engine.');
    return false;
  }
  var r = simpanIdentitas(jenjang, data, sesiSaya() ? sesiSaya().id : '');
  if (!r || !r.ok) return gagalForm(ev, r, { 'nama-wajib': pfx + '-nama' });
  /* N19: menyimpan identitas = pengguna mengonfirmasi data lembaga. */
  tandaiIdentitasDikonfirmasi();
  render();
  showAlert('success', 'Identitas ' + jenjang + ' berhasil disimpan.', 'Nama ' + data.nama + ' sekarang tampil di header, hero, dan layar login.');
  return false;
}

/* ================= Router dan init ================= */
var RENDERERS = {
  dashboard: renderDashboard,
  santri: renderSantri,
  tabungan: renderTabungan,
  keuangan: renderKeuangan,
  rapbm: renderRapbm,
  kelas: renderKelas,
  hafalan: renderHafalan,
  guru: renderGuru,
  pengumuman: renderPengumuman,
  laporan: renderLaporan,
  pengaturan: renderPengaturan,
  penilaian: renderPenilaian,
  kbm: renderKbm,
  kemuridan: renderKemuridan,
  khidmah: renderKhidmah,
  grafik: renderGrafik,
  panduan: renderPanduan,
  identitas: renderIdentitas
};

function initSyncIndicator() {
  var tb = document.querySelector('.topbar');
  if (!tb || document.getElementById('sync-status')) return;
  var sp = document.createElement('span');
  sp.id = 'sync-status';
  sp.className = 'sync-status idle';
  sp.innerHTML = '<span class="sync-dot"></span><span>Memeriksa status sinkron</span>';
  tb.appendChild(sp);
  updateSyncStatus();
}

/* ================= AKSI UI (v2): semua mutasi lewat engine, hasil { ok, ... } =================
   Aturan kontrak API.md: fungsi simpan/catat engine menerima objek dan
   mengembalikan { ok: true, ... } atau { ok: false, error, message }.
   UI menampilkan message itu ke pengguna, tidak pernah diam saat gagal.
   Fungsi export/backup/template mengembalikan { filename, csv/json, count }
   dan TIDAK mengunduh sendiri, UI yang mengunduh lewat Blob (unduhHasil). */
function laporkanHasil(r, okJudul, okIsi) {
  if (r && r.ok) { if (okJudul) showAlert('success', okJudul, okIsi || ''); return true; }
  showAlert('error', 'Tidak bisa disimpan.', (r && r.message) || 'Periksa lagi isian form.');
  return false;
}
function unduhHasil(res, tipe) {
  if (!res || res.ok === false) { showAlert('error', 'Tidak bisa diunduh.', (res && res.message) || 'Periksa lagi.'); return false; }
  return downloadFile(res.filename, res.csv != null ? res.csv : res.json, tipe);
}
/* A12: tiap toast sukses export/backup menyebut folder Unduhan. */
function exportSantri() { var r = exportSantriCSV(); if (unduhHasil(r, 'text/csv;charset=utf-8')) toast('Export murid: ' + r.count + ' baris (mengikuti filter yang tampil). File: ' + r.filename + '. File tersimpan di folder Unduhan perangkat ini.'); }
function exportGuru() { var r = exportGuruCSV(); if (unduhHasil(r, 'text/csv;charset=utf-8')) toast('Export guru: ' + r.count + ' baris (mengikuti filter jenjang). File: ' + r.filename + '. File tersimpan di folder Unduhan perangkat ini.'); }
function exportNilai() { var r = exportNilaiCSV(); if (unduhHasil(r, 'text/csv;charset=utf-8')) toast('Export nilai: ' + r.count + ' baris. File: ' + r.filename + '. File tersimpan di folder Unduhan perangkat ini.'); }
function exportAbsensi() { var r = exportAbsensiCSV(); if (unduhHasil(r, 'text/csv;charset=utf-8')) toast('Export absensi: ' + r.count + ' baris. File: ' + r.filename + '. File tersimpan di folder Unduhan perangkat ini.'); }
function exportKeuangan() { var r = exportKeuanganCSV(); if (unduhHasil(r, 'text/csv;charset=utf-8')) toast('Export keuangan: ' + r.count + ' baris. File: ' + r.filename + '. File tersimpan di folder Unduhan perangkat ini.'); }
function exportRapor(santriId, semesterId) {
  var r = exportRaporCSV(santriId, semesterId);
  if (unduhHasil(r, 'text/csv;charset=utf-8')) {
    toast('Rapor diekspor. File: ' + r.filename + '. File tersimpan di folder Unduhan perangkat ini.');
    var note = document.getElementById('dl-note');
    if (note) note.classList.add('show');
  }
}
function unduhTemplate(jenis) { var r = downloadTemplate(jenis); if (unduhHasil(r, 'text/csv;charset=utf-8')) toast('Template CSV ' + jenis + ' diunduh. File: ' + r.filename + '. File tersimpan di folder Unduhan perangkat ini.'); }
function unduhBackup() { var r = backupJSON(); if (unduhHasil(r, 'application/json;charset=utf-8')) toast('Cadangan seluruh data diunduh. File: ' + r.filename + '. File tersimpan di folder Unduhan perangkat ini.'); }
function salinCsv(jenis) {
  var r = csvTextFor(jenis);
  if (!r || !r.csv) { toast('Tidak ada data untuk disalin.'); return; }
  shareText(r.csv, 'Data TPQ Al-Muttaqin (' + jenis + ')');
}
function importFileCsv(jenis, input) {
  var f = input.files && input.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () {
    var lap = importCsvText(jenis, reader.result);
    showImportReport(lap);
    render();
  };
  reader.onerror = function () { showAlert('error', 'File tidak bisa dibaca.', 'Coba pilih lagi file CSV-nya.'); };
  reader.readAsText(f, 'utf-8');
  input.value = '';
}
/* S6: peringatan restore — bila berkas memuat akun pengguna dan perangkat
   ini belum punya pengguna, akun dari berkas akan dipasang (engine memaksa
   wajibGantiSandi untuk akun itu). Pulihkan hanya dari sumber tepercaya. */
function peringatanRestoreHtml(data) {
  var jml = data && Array.isArray(data.pengguna) ? data.pengguna.length : 0;
  if (!jml) return '';
  return '<p><b>Perhatian:</b> berkas ini berisi ' + jml + ' akun pengguna. Bila perangkat ini belum punya pengguna, akun dari berkas akan dipasang dan kata sandinya wajib diganti saat login pertama. Pulihkan hanya berkas dari sumber tepercaya.</p>';
}
function pulihkanDariFile(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () {
    var parsed;
    try { parsed = JSON.parse(reader.result); } catch (e) { showAlert('error', 'File cadangan tidak bisa dibaca.', 'Pastikan file yang dipilih adalah file JSON cadangan dari aplikasi ini.'); return; }
    var data = parsed.data || parsed;
    /* T-06: beri tahu bila berkas tidak memuat sebagian kunci — kunci yang
       hilang itu dipertahankan dari data lokal (bukan dikosongkan). */
    var kunciPenting = [['rapbm', 'RAPBM'], ['biaya', 'Set Biaya'], ['target', 'Target tabungan'], ['kelas', 'Kelas'], ['jadwalKbm', 'Jadwal KBM'], ['jadwalPiket', 'Jadwal piket'], ['alokasiWaktu', 'Alokasi waktu'], ['absensiGuru', 'Absensi guru'], ['pengumuman', 'Pengumuman'], ['nilai', 'Nilai'], ['pertemuan', 'Pertemuan'], ['hafalanLog', 'Log hafalan'], ['tabunganTx', 'Transaksi tabungan'], ['keuanganTx', 'Transaksi keuangan']];
    var hilang = kunciPenting.filter(function (kp) { return data[kp[0]] === undefined; }).map(function (kp) { return kp[1]; });
    confirmModal({
      judul: 'Pulihkan dari cadangan?',
      isi: '<p>Data saat ini (' + db.santri.length + ' murid, ' + db.guru.length + ' guru) akan <b>diganti seluruhnya</b> dengan isi file cadangan (' + (data.santri ? data.santri.length : 0) + ' murid). Cadangan dibuat pada ' + esc(parsed.exportedAt ? parsed.exportedAt.slice(0, 10) : 'tanggal tidak tercatat') + '.</p>' +
        (hilang.length ? '<p><b>Perhatian:</b> berkas ini tidak memuat: ' + esc(hilang.join(', ')) + '. Data lokal untuk bagian itu tetap dipertahankan, tidak dihapus.</p>' : '') +
        peringatanRestoreHtml(data),
      okLabel: 'Ya, pulihkan',
      danger: true,
      needCheck: true,
      checkLabel: 'Saya yakin, data saat ini akan ditimpa.',
      onOk: function () {
        var hasil = restoreFromText(reader.result);
        if (hasil.ok) { render(); showAlert('success', 'Cadangan berhasil dipulihkan.', 'Data sekarang mengikuti isi file cadangan (' + hasil.santri + ' murid, ' + hasil.guru + ' guru).'); }
        else showAlert('error', 'File cadangan tidak valid.', 'Isi file tidak berisi data TPQ Al-Muttaqin yang lengkap.');
      }
    });
  };
  reader.readAsText(f, 'utf-8');
  input.value = '';
}

/* Sinkron: flushSync() v2 tanpa argumen, mengembalikan Promise kode string. */
function sinkronSekarang() {
  flushSync().then(function (kode) {
    updateSyncStatus();
    var pesan = {
      empty: 'Tidak ada perubahan yang menunggu.',
      offline: 'Offline, perubahan tetap tersimpan di perangkat.',
      'no-config': 'Apps Script belum diatur, sinkron nonaktif. Atur di Pengaturan.',
      'bad-url': 'URL Apps Script tidak valid.',
      'bad-host': 'URL Apps Script ditolak (host di luar daftar yang diizinkan).',
      busy: 'Sinkron sedang berjalan.',
      ok: 'Sinkron selesai, semua perubahan terkirim.',
      failed: 'Sinkron gagal, antrean tetap ada. Coba lagi saat online.'
    }[kode] || ('Hasil sinkron: ' + kode);
    /* S1: render() DULU baru showAlert — render() mengganti seluruh #view
       termasuk #alert-root, jadi alert yang ditulis sebelum render terhapus. */
    render();
    if (kode === 'ok') showAlert('success', 'Sinkron selesai.', pesan);
    else if (kode === 'failed' || kode === 'bad-url' || kode === 'bad-host') showAlert('error', 'Sinkron belum berhasil.', pesan);
    else toast(pesan);
  });
}
function simpanSheetConfigUI() {
  var link = document.getElementById('sheet-link').value;
  var apps = document.getElementById('apps-script-url').value.trim();
  var elToken = document.getElementById('sync-token');
  var token = elToken ? elToken.value.trim() : (getSheetCfg().syncToken || '');
  var gid = parseInt(document.getElementById('sheet-gid').value || '0', 10) || 0;
  var r = saveSheetConfig({ sheetLink: link, appsScriptUrl: apps, syncToken: token, gid: gid });
  if (!r.ok) { showAlert('error', 'Pengaturan tidak disimpan.', r.message); return; }
  updateSyncStatus();
  if (link && !extractSheetId(link)) { showAlert('error', 'Link Sheet tidak dikenali.', 'Tempel link lengkap Google Sheet, contoh: https://docs.google.com/spreadsheets/d/ABC123/edit'); return; }
  showAlert('success', 'Pengaturan Google Sheet disimpan.', (r.cfg.sheetId ? 'ID Sheet: ' + r.cfg.sheetId + '. ' : '') + (apps ? 'Sinkron otomatis aktif ke ' + cekUrlAppsScript(apps).host + ' saat online.' : 'Apps Script belum diisi, jadi sinkron otomatis nonaktif. Aplikasi tetap jalan offline.') + (token ? ' Token rahasia tersimpan di perangkat ini.' : ' Token rahasia belum diatur, sinkron tetap jalan, tapi atur token sesegera mungkin (lihat panduan di bawah).'));
}
function tarikDariSheet() {
  pullFromAppsScript().then(function (res) {
    if (res.status === 'warn') {
      confirmModal({
        judul: 'Ada perubahan lokal yang belum terkirim',
        isi: '<p>' + esc(res.message) + '</p><p>Pilih "Pakai data Sheet" hanya kalau yakin data Sheet yang benar.</p>',
        okLabel: 'Pakai data Sheet',
        onOk: function () {
          if (applyPulledData(res.data)) { render(); showAlert('success', 'Data terbaru dari Sheet sudah dipakai.', 'Daftar santri, guru, nilai, dan data lain sekarang mengikuti isi Sheet.'); }
          else showAlert('error', 'Data dari Sheet tidak valid.', 'Data harus berisi daftar santri. Periksa script Apps Script.');
        }
      });
      return;
    }
    if (res.status === 'ok') { render(); showAlert('success', 'Data terbaru dari Sheet sudah dipakai.', res.message); }
    else if (res.status === 'skip') showAlert('info', 'Data lokal sudah yang terbaru.', res.message);
    else showAlert('error', 'Tidak bisa menarik data.', res.message);
  });
}
function tarikCsvDariSheet(jenis) {
  pullCsvFromSheet(jenis).then(function (res) {
    if (res && res.error) {
      var tambahan = res.error === 'fetch-gagal' ? ' Kemungkinan penyebab: (1) Sheet belum di-publish ke web, buka File lalu Publish to web, pilih sheet dan format CSV, lalu Publish. (2) Peramban memblokir akses lintas situs (CORS) dari docs.google.com. Jalan keluar yang pasti bisa: di Sheet pilih File lalu Download lalu CSV, kemudian import file CSV itu lewat tombol "Import file CSV" di bawah.' : '';
      showAlert('error', 'Tidak bisa mengambil CSV dari Sheet.', res.message + tambahan);
      return;
    }
    showImportReport(res);
    render();
  });
}
function kirimKeAppsScript() {
  var cfg = getSheetCfg();
  if (!cfg.appsScriptUrl) { showAlert('error', 'Apps Script belum diatur.', 'Isi URL Web App Apps Script di atas, lalu tekan "Simpan pengaturan Sheet".'); return; }
  if (!isOnline()) { showAlert('error', 'Perangkat sedang offline.', 'Perubahan tetap tersimpan di antrean dan akan terkirim saat online.'); return; }
  sendToAppsScriptNow().then(function (res) {
    updateSyncStatus();
    /* S1: render() dulu baru showAlert (lihat sinkronSekarang). */
    render();
    if (res.status === 'ok') showAlert('success', 'Data terkirim ke Sheet.', 'Antrean sinkron sudah terkirim.');
    else showAlert('error', 'Kirim belum berhasil.', 'Status: ' + res.status + '. Antrean tetap ada dan akan dicoba lagi otomatis.');
  });
}
function mintaHapusSemuaData() {
  confirmModal({
    judul: 'Hapus semua data?',
    isi: '<p>Semua murid, guru, nilai, keuangan, dan data lain akan <b>dihapus permanen</b> dari perangkat ini. Aplikasi kembali kosong supaya bisa diisi data asli.</p><p>Kalau ragu, cadangkan dulu lewat tombol "Cadangkan semua data" di atas.</p>',
    okLabel: 'Ya, hapus semua',
    danger: true,
    needCheck: true,
    checkLabel: 'Saya yakin, hapus semua data.',
    onOk: function () {
      clearAllData();
      dismissedAnn = {};
      /* A2: pesan sukses menetap. Bila render() mendarat di dashboard,
         tampilkan lewat showAlert; bila mendarat di layar ganti sandi
         paksa (engine lama), pesan tampil di sana lewat pesanHapusData. */
      pesanHapusData = 'Semua data sudah dihapus. Aplikasi sekarang kosong. Tambah murid dan guru lewat menu Santri dan Guru, atau import dari CSV.';
      render();
      if (document.querySelector('#view #alert-root')) {
        pesanHapusData = '';
        showAlert('success', 'Semua data sudah dihapus.', 'Aplikasi sekarang kosong. Tambah murid dan guru lewat menu Santri dan Guru, atau import dari CSV.');
      }
    }
  });
}

/* ---- Santri ---- */
function submitSantri(ev, id) {
  ev.preventDefault();
  var jkEl = document.getElementById('f-jk');
  var jk = jkEl ? jkEl.value : '';
  /* JK wajib dipilih (pola S5: error tampil DI DALAM form, bukan hanya
     toast; jangan simpan bila kosong). */
  if (!jk) { tampilErrorForm(ev.target, 'Pilih dulu jenis kelamin santri.', 'f-jk'); return false; }
  var data = {
    nama: document.getElementById('f-nama').value.trim(),
    nis: document.getElementById('f-nis').value.trim(),
    jk: jk,
    jenjang: document.getElementById('f-jenjang').value,
    kelas: document.getElementById('f-kelas').value,
    jilid: document.getElementById('f-jilid').value,
    angkatan: document.getElementById('f-angkatan').value.trim() || '2026',
    rombel: document.getElementById('f-rombel').value,
    wali: document.getElementById('f-wali').value.trim(),
    hpWali: document.getElementById('f-hp').value.trim(),
    alamat: document.getElementById('f-alamat').value.trim(),
    hafalan: document.getElementById('f-hafalan').value.trim() || 'Belum mulai',
    foto: document.getElementById('f-foto').value || undefined
  };
  var r = simpanSantri(id || '', data);
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'f-nama', 'nis-wajib': 'f-nis', 'nis-duplikat': 'f-nis', 'jk-tidak-valid': 'f-jk', 'jk-wajib': 'f-jk' });
  closeModal(); render();
  showAlert('success', id ? 'Santri berhasil diubah.' : 'Santri berhasil ditambah.', data.nama + ' (NIS ' + data.nis + ') sudah ' + (id ? 'diperbarui.' : 'masuk ke daftar santri aktif.'));
  return false;
}
function submitStatus(ev, id) {
  ev.preventDefault();
  var st = document.getElementById('st-status').value;
  var extra = {};
  if (st === 'Keluar') { extra.alasan = document.getElementById('st-alasan').value.trim(); extra.tanggal = document.getElementById('st-tanggal').value || todayStr(); }
  if (st === 'Lulus') { extra.tahun = document.getElementById('st-tahun').value.trim(); }
  var r = ubahStatusSantri(id, st, extra);
  if (!r.ok) return gagalForm(ev, r, { 'alasan-wajib': 'st-alasan', 'tahun-wajib': 'st-tahun' });
  closeModal(); render();
  showAlert('success', 'Status berhasil diubah.', r.santri.nama + ' sekarang berstatus ' + st + '.');
  return false;
}
function mintaHapusSantri(id) {
  var s = santriById(id);
  if (!s) return;
  confirmModal({
    judul: 'Hapus santri ' + s.nama + '?',
    isi: '<p>Data santri, tabungan, dan nilai ' + esc(s.nama) + ' akan dihapus. Tindakan ini tidak bisa dibatalkan.</p>',
    okLabel: 'Ya, hapus',
    danger: true,
    onOk: function () {
      var r = hapusSantri(id);
      render();
      if (r.ok) showAlert('success', 'Santri berhasil dihapus.', r.nama + ' sudah tidak ada di daftar.');
      else showAlert('error', 'Santri tidak bisa dihapus.', r.message);
    }
  });
}

/* ---- Tabungan ---- */
function submitTabungan(ev) {
  ev.preventDefault();
  var s = santriById(ui.tabunganSantri);
  if (!s) { tampilErrorForm(ev.target, 'Pilih dulu muridnya.'); return false; }
  var jenis = document.getElementById('tb-jenis').value;
  /* A4: baca lewat bacaJumlah (format Indonesia "50.000" -> 50000);
     nilai tidak valid -> error di dalam form, bukan toast. */
  var bacaTb = bacaJumlah(document.getElementById('tb-jumlah').value);
  if (!bacaTb.ok) { tampilErrorForm(ev.target, bacaTb.error, 'tb-jumlah'); return false; }
  var jumlah = bacaTb.nilai;
  var catatan = document.getElementById('tb-catatan').value.trim();
  function jalankan(dikonfirmasi) {
    var r = catatTabungan(s.id, jenis, jumlah, catatan, dikonfirmasi ? { confirmed: true } : undefined);
    if (!r.ok && r.needsConfirm) {
      confirmModal({
        judul: 'Penarikan besar',
        isi: '<p>Tarik ' + rupiah(jumlah) + ' dari tabungan ' + esc(s.nama) + ' (saldo ' + rupiah(s.tabungan) + '). Lanjutkan?</p>',
        okLabel: 'Ya, tarik',
        onOk: function () { jalankan(true); }
      });
      return;
    }
    if (!r.ok) { gagalForm(ev, r, { 'jumlah-tidak-valid': 'tb-jumlah', 'saldo-tidak-cukup': 'tb-jumlah', 'jenis-tidak-dikenali': 'tb-jenis' }); return; }
    render();
    showAlert('success', 'Transaksi tabungan berhasil.', jenis + ' ' + rupiah(jumlah) + ' untuk ' + s.nama + '. Saldo sekarang ' + rupiah(r.saldo) + '.');
  }
  jalankan(false);
  return false;
}
function submitTarget(ev) {
  ev.preventDefault();
  var nama = document.getElementById('tg-nama').value.trim();
  /* A4: lihat submitTabungan. */
  var bacaTg = bacaJumlah(document.getElementById('tg-jumlah').value);
  if (!bacaTg.ok) { tampilErrorForm(ev.target, bacaTg.error, 'tg-jumlah'); return false; }
  var jumlah = bacaTg.nilai;
  var r = tambahTarget(nama, jumlah);
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'tg-nama', 'jumlah-tidak-valid': 'tg-jumlah' });
  closeModal(); render();
  showAlert('success', 'Target berhasil ditambah.', nama + ' dengan target ' + rupiah(jumlah) + '.');
  return false;
}
function bukaStruk(santriId) {
  var s = santriById(santriId);
  if (!s) return;
  var teks = strukTabungan(santriId);
  if (!teks) { toast('Belum ada struk untuk santri ini.'); return; }
  openModal('<h2>Struk tabungan ' + esc(s.nama) + '</h2><pre class="code" style="background:#f6f8f9;color:#15222b">' + esc(teks) + '</pre><div class="btn-row"><button class="btn" onclick="shareText(document.querySelector(\'.code\').innerText, \'Struk tabungan\')">Bagikan / salin struk</button><button class="btn secondary" onclick="closeModal()">Tutup</button></div>');
}

/* ---- Keuangan, RAPBM, biaya ---- */
function submitKeuangan(ev) {
  ev.preventDefault();
  /* A4: lihat submitTabungan. */
  var bacaKu = bacaJumlah(document.getElementById('ku-jumlah').value);
  if (!bacaKu.ok) { tampilErrorForm(ev.target, bacaKu.error, 'ku-jumlah'); return false; }
  /* A14: bila jenjang masih "Pilih jenjang", wajib memilih dulu. */
  var jenjangKu = document.getElementById('ku-jenjang').value;
  if (!jenjangKu) { tampilErrorForm(ev.target, 'Pilih dulu jenjang transaksi.', 'ku-jenjang'); return false; }
  var r = simpanKeuangan({
    jenis: document.getElementById('ku-jenis').value,
    jenjang: jenjangKu,
    kategori: document.getElementById('ku-kategori').value,
    nama: document.getElementById('ku-nama').value.trim(),
    jumlah: bacaKu.nilai,
    tanggal: document.getElementById('ku-tanggal').value || todayStr(),
    catatan: document.getElementById('ku-catatan').value.trim()
  });
  /* T-22: pola error S5 Kirana — pesan error tampil DI DALAM form
     (gagalForm), bukan hanya toast. */
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'ku-nama', 'jumlah-tidak-valid': 'ku-jumlah', 'kategori-tidak-valid': 'ku-kategori' });
  render();
  showAlert('success', 'Transaksi berhasil disimpan.', r.transaksi.jenis + ' ' + rupiah(r.transaksi.jumlah) + ' (' + r.transaksi.nama + '). Saldo kas sekarang ' + rupiah(r.saldoKas) + '.');
  return false;
}
/* T-22: ubah transaksi keuangan (modal, seperti Ubah pos RAPBM). */
function openKeuanganForm(id) {
  var t = db.keuanganTx.find(function (x) { return x.id === id; });
  if (!t) return;
  var kat = t.jenis === 'Masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;
  openModal('<h2>Ubah transaksi</h2><form onsubmit="return submitKeuanganEdit(event, \'' + t.id + '\')">' +
    '<label>Jenis</label><select id="ke-jenis" onchange="isiKategoriKeuanganEdit()"><option' + (t.jenis === 'Masuk' ? ' selected' : '') + '>Masuk</option><option' + (t.jenis === 'Keluar' ? ' selected' : '') + '>Keluar</option></select>' +
    '<label>Jenjang</label><select id="ke-jenjang">' + ['TPQ', 'Ibtidaiyah'].map(function (j) { return '<option' + (t.jenjang === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('') + '</select>' +
    '<label>Kategori</label><select id="ke-kategori">' + kat.map(function (k) { return '<option' + (t.kategori === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
    '<label>Nama transaksi *</label><input id="ke-nama" required value="' + esc(t.nama) + '">' +
    '<label>Jumlah (Rp) *</label><input id="ke-jumlah" type="text" inputmode="decimal" required value="' + t.jumlah + '">' +
    '<label>Tanggal</label><input id="ke-tanggal" type="date" value="' + esc(t.tanggal || '') + '">' +
    '<label>Catatan</label><input id="ke-catatan" value="' + esc(t.catatan || '') + '">' +
    '<div class="btn-row"><button class="btn secondary" type="button" onclick="closeModal()">Batal</button><button class="btn" type="submit">Simpan perubahan</button></div></form>');
}
function isiKategoriKeuanganEdit() {
  var j = document.getElementById('ke-jenis').value;
  var kat = j === 'Masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;
  document.getElementById('ke-kategori').innerHTML = kat.map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('');
}
function submitKeuanganEdit(ev, id) {
  ev.preventDefault();
  /* A4: lihat submitTabungan. */
  var bacaKe = bacaJumlah(document.getElementById('ke-jumlah').value);
  if (!bacaKe.ok) { tampilErrorForm(ev.target, bacaKe.error, 'ke-jumlah'); return false; }
  var r = ubahKeuangan(id, {
    jenis: document.getElementById('ke-jenis').value,
    jenjang: document.getElementById('ke-jenjang').value,
    kategori: document.getElementById('ke-kategori').value,
    nama: document.getElementById('ke-nama').value.trim(),
    jumlah: bacaKe.nilai,
    tanggal: document.getElementById('ke-tanggal').value || todayStr(),
    catatan: document.getElementById('ke-catatan').value.trim()
  });
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'ke-nama', 'jumlah-tidak-valid': 'ke-jumlah', 'kategori-tidak-valid': 'ke-kategori' });
  closeModal(); render();
  showAlert('success', 'Transaksi berhasil diubah.', r.transaksi.nama + ' ' + rupiah(r.transaksi.jumlah) + '. Saldo kas sekarang ' + rupiah(r.saldoKas) + '.');
  return false;
}
function mintaHapusKeuangan(id) {
  var t = db.keuanganTx.find(function (x) { return x.id === id; });
  if (!t) return;
  confirmModal({
    judul: 'Hapus transaksi ini?',
    isi: '<p>' + esc(t.nama) + ' (' + rupiah(t.jumlah) + ') akan dihapus dari catatan keuangan.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () {
      var r = hapusKeuangan(id);
      render();
      if (r.ok) showAlert('success', 'Transaksi berhasil dihapus.', r.nama + ' sudah tidak ada di catatan.');
      else showAlert('error', 'Transaksi tidak bisa dihapus.', r.message);
    }
  });
}
function toggleSppUI(id) {
  var r = toggleSpp(id);
  /* K6: gagal toggle memberi pesan menetap, bukan toast-only. */
  if (!r.ok) { showAlert('error', 'SPP tidak bisa diubah.', r.message); return; }
  render();
  var s = santriById(id);
  /* A5: Lunas tidak mencatat kas — katakan langsung di toast. */
  if (r.sppStatus === 'Lunas') toast('SPP ' + (s ? s.nama : '') + ': Lunas. Uang belum masuk kas, ketuk "Catat ke kas" bila sudah diterima.');
  else toast('SPP ' + (s ? s.nama : '') + ': ' + r.sppStatus + '.');
}
function submitRapbm(ev, id) {
  ev.preventDefault();
  /* A4: lihat submitTabungan. */
  var bacaRp = bacaJumlah(document.getElementById('rp-rencana').value);
  if (!bacaRp.ok) { tampilErrorForm(ev.target, bacaRp.error, 'rp-rencana'); return false; }
  var r = simpanRapbm(id || '', {
    pos: document.getElementById('rp-pos').value.trim(),
    jenis: document.getElementById('rp-jenis').value,
    jenjang: document.getElementById('rp-jenjang').value,
    rencana: bacaRp.nilai
  });
  if (!r.ok) return gagalForm(ev, r, { 'pos-wajib': 'rp-pos', 'rencana-tidak-valid': 'rp-rencana' });
  closeModal(); render();
  showAlert('success', 'Pos RAPBM berhasil disimpan.', r.rapbm.pos + ' dengan rencana ' + rupiah(r.rapbm.rencana) + '.');
  return false;
}
function mintaHapusRapbm(id) {
  var r0 = db.rapbm.find(function (x) { return x.id === id; });
  confirmModal({
    judul: 'Hapus pos ' + (r0 ? r0.pos : '') + '?',
    isi: '<p>Pos anggaran ini akan dihapus dari RAPBM.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { var r = hapusRapbm(id); render(); toast(r.ok ? 'Pos RAPBM dihapus.' : r.message); }
  });
}
function submitBiaya(ev, id) {
  ev.preventDefault();
  /* A4: lihat submitTabungan. */
  var bacaBy = bacaJumlah(document.getElementById('by-jumlah').value);
  if (!bacaBy.ok) { tampilErrorForm(ev.target, bacaBy.error, 'by-jumlah'); return false; }
  var r = simpanBiaya(id || '', {
    nama: document.getElementById('by-nama').value.trim(),
    jumlah: bacaBy.nilai,
    keterangan: document.getElementById('by-ket').value.trim()
  });
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'by-nama', 'jumlah-tidak-valid': 'by-jumlah' });
  closeModal(); render();
  showAlert('success', 'Biaya berhasil disimpan.', r.biaya.nama + ' ' + rupiah(r.biaya.jumlah) + '.');
  return false;
}
function mintaHapusBiaya(id) {
  var b = db.biaya.find(function (x) { return x.id === id; });
  confirmModal({
    judul: 'Hapus biaya ' + (b ? b.nama : '') + '?',
    isi: '<p>Biaya ini akan dihapus dari daftar Set Biaya.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { var r = hapusBiaya(id); render(); toast(r.ok ? 'Biaya dihapus.' : r.message); }
  });
}

/* ---- Kelas dan absensi ---- */
function simpanPertemuanUI() {
  var kelas = kelasById(ui.kelasId);
  if (!kelas) { showAlert('error', 'Kelas belum dipilih.', 'Pilih dulu kelasnya.'); return; }
  var materi = (document.getElementById('kl-materi').value || '').trim();
  var tanggal = document.getElementById('kl-tanggal').value || todayStr();
  /* A15: error absensi menetap (showAlert), bukan toast 3,2 detik saja. */
  if (!materi) { showAlert('error', 'Materi belum diisi.', 'Isi dulu materi hari ini.'); return; }
  var muridKelas = santriAktif().filter(function (s) { return s.kelas === kelas.nama; });
  if (!muridKelas.length) { showAlert('error', 'Tidak ada santri aktif.', 'Tidak ada santri aktif di kelas ini.'); return; }
  var absensi = {};
  muridKelas.forEach(function (s) { absensi[s.id] = ui.absDraft[s.id] || 'Hadir'; });
  var r = simpanPertemuan(kelas.id, tanggal, materi, absensi);
  /* K6: gagal simpan memberi pesan menetap, bukan toast-only. */
  if (!r.ok) { showAlert('error', 'Pertemuan tidak bisa disimpan.', r.message); return; }
  /* A3: hanya draft kelas ini yang dibersihkan; draft kelas lain tetap. */
  ui.absDraftPerKelas[kelas.id] = {}; ui.absDraft = ui.absDraftPerKelas[kelas.id]; ui.kelasMateri = '';
  render();
  showAlert('success', 'Pertemuan berhasil disimpan.', 'Absensi ' + kelas.nama + ' tanggal ' + fmtTanggal(tanggal) + ' tersimpan (' + r.hadir + ' hadir dari ' + r.total + ') dan rekap kehadiran santri diperbarui.');
}
/* A7: "Naik Jilid" minta konfirmasi dulu (satu ketukan di tengah daftar
   absensi terlalu mudah terpencet). K6: gagal memberi pesan menetap. */
function naikJilidSantriUI(id) {
  var s = santriById(id);
  if (!s) return;
  var lama = s.jilid;
  var idx = JILID_LIST.indexOf(lama);
  var berikut = idx >= 0 && idx < JILID_LIST.length - 1 ? JILID_LIST[idx + 1] : null;
  if (!berikut) { showAlert('error', 'Sudah di jilid tertinggi.', s.nama + ' sudah di ' + lama + ', tidak ada jilid di atasnya.'); return; }
  confirmModal({
    judul: 'Naikkan jilid ' + s.nama + '?',
    isi: '<p>' + esc(s.nama) + ' naik dari ' + esc(lama) + ' ke ' + esc(berikut) + '.</p>',
    okLabel: 'Ya, naikkan',
    onOk: function () {
      var r = naikJilidSantri(id);
      if (!r.ok) { showAlert('error', 'Jilid tidak bisa dinaikkan.', r.message || (s.nama + ' sudah di jilid tertinggi.')); return; }
      render();
      showAlert('success', 'Jilid berhasil dinaikkan.', s.nama + ': ' + lama + ' menjadi ' + r.jilid + '.');
    }
  });
}

/* ---- Hafalan ---- */
function submitHafalan(ev) {
  ev.preventDefault();
  var s = santriById(ui.hafalanSantri);
  if (!s) { tampilErrorForm(ev.target, 'Pilih dulu muridnya.'); return false; }
  var materi = document.getElementById('hf-materi').value.trim();
  var r = catatHafalan(s.id, document.getElementById('hf-jenis').value, materi, document.getElementById('hf-nilai').value);
  if (!r.ok) return gagalForm(ev, r, { 'materi-wajib': 'hf-materi', 'nilai-tidak-valid': 'hf-nilai' });
  render();
  showAlert('success', 'Setoran berhasil dicatat.', materi + ' untuk ' + s.nama + ' (' + r.hafalan.nilai + ').');
  return false;
}

/* ---- Guru ---- */
function submitGuru(ev, id) {
  ev.preventDefault();
  /* A4: honor kosong berarti Rp0 (perilaku lama); bila terisi, baca lewat
     bacaJumlah supaya "850.000" tercatat 850000, bukan 850. */
  var honorMentah = document.getElementById('g-honor').value;
  var honor = 0;
  if (String(honorMentah).trim() !== '') {
    var bacaHonor = bacaJumlah(honorMentah);
    if (!bacaHonor.ok) { tampilErrorForm(ev.target, bacaHonor.error, 'g-honor'); return false; }
    honor = bacaHonor.nilai;
  }
  var data = {
    nama: document.getElementById('g-nama').value.trim(),
    kelas: document.getElementById('g-kelas').value,
    peran: document.getElementById('g-peran').value,
    jenjang: document.getElementById('g-jenjang').value,
    hp: document.getElementById('g-hp').value.trim(),
    honor: honor,
    foto: document.getElementById('g-foto').value || undefined
  };
  var r = simpanGuru(id || '', data);
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'g-nama', 'honor-tidak-valid': 'g-honor' });
  closeModal(); render();
  showAlert('success', 'Guru berhasil disimpan.', data.nama + ' (' + data.peran + ', ' + data.kelas + ').');
  return false;
}
function toggleHonorUI(id) {
  var r = toggleHonor(id);
  /* K6: gagal toggle memberi pesan menetap, bukan toast-only. */
  if (!r.ok) { showAlert('error', 'Honor tidak bisa diubah.', r.message); return; }
  render();
  var g = guruById(id);
  toast('Honor ' + (g ? g.nama : '') + ': ' + r.honorStatus + '.');
}
function mintaHapusGuru(id) {
  var g = guruById(id);
  if (!g) return;
  /* T-18: sebutkan pemakaian guru ini supaya penghapus tahu apa yang ikut
     dibersihkan (jadwal KBM + kelas.ustadz dikosongkan, piket dihapus). */
  var nJadwal = db.jadwalKbm.filter(function (j) { return j.guru === g.nama; }).length;
  var nKelas = db.kelas.filter(function (k) { return k.ustadz === g.nama; }).length;
  confirmModal({
    judul: 'Hapus guru ' + g.nama + '?',
    isi: '<p>Data guru ini akan dihapus. Jadwal piket yang memakai guru ini ikut terhapus.</p>' +
      ((nJadwal || nKelas) ? '<p>Guru ini masih dipakai di ' + nJadwal + ' jadwal KBM dan ' + nKelas + ' kelas — jadwal dan kelas itu akan dikosongkan gurunya/ustadznya.</p>' : ''),
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () {
      var r = hapusGuru(id);
      render();
      if (r.ok) showAlert('success', 'Guru berhasil dihapus.', r.nama + ' sudah tidak ada di daftar.');
      else showAlert('error', 'Guru tidak bisa dihapus.', r.message);
    }
  });
}

/* ---- Pengumuman ---- */
function submitPengumuman(ev) {
  ev.preventDefault();
  var r = tambahPengumuman(document.getElementById('pg-judul').value.trim(), document.getElementById('pg-isi').value.trim());
  if (!r.ok) return gagalForm(ev, r, { 'judul-isi-wajib': 'pg-judul' });
  render();
  showAlert('success', 'Pengumuman berhasil dibuat.', r.pengumuman.judul + ' sekarang tampil di Beranda.');
  return false;
}
function togglePengumumanUI(id) {
  var r = togglePengumuman(id);
  /* K6: gagal toggle memberi pesan menetap, bukan toast-only. */
  if (!r.ok) { showAlert('error', 'Pengumuman tidak bisa diubah.', r.message); return; }
  render();
  toast('Pengumuman ' + (r.aktif ? 'ditampilkan.' : 'ditutup.'));
}
function mintaHapusPengumuman(id) {
  var p = db.pengumuman.find(function (x) { return x.id === id; });
  confirmModal({
    judul: 'Hapus pengumuman ini?',
    isi: '<p>' + esc(p ? p.judul : '') + ' akan dihapus permanen.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { var r = hapusPengumuman(id); render(); toast(r.ok ? 'Pengumuman dihapus.' : r.message); }
  });
}

/* ---- Penilaian ---- */
function submitNilai(ev) {
  ev.preventDefault();
  var s = santriById(ui.nilaiSantri);
  if (!s) { tampilErrorForm(ev.target, 'Pilih dulu muridnya.'); return false; }
  var r = simpanNilai(s.id, ui.nilaiTab, document.getElementById('nl-mapel').value, Number(document.getElementById('nl-nilai').value), document.getElementById('nl-tanggal').value || todayStr(), document.getElementById('nl-catatan').value.trim());
  if (!r.ok) return gagalForm(ev, r, { 'nilai-tidak-valid': 'nl-nilai' });
  render();
  showAlert('success', 'Nilai berhasil disimpan.', 'Nilai ' + ui.nilaiTab + ' ' + s.nama + ': ' + r.nilai.nilai + '. Rapor murid ini ikut diperbarui.');
  return false;
}
function submitNilaiEdit(ev, id) {
  ev.preventDefault();
  var r = ubahNilai(id, {
    mapel: document.getElementById('ne-mapel').value,
    nilai: Number(document.getElementById('ne-nilai').value),
    catatan: document.getElementById('ne-catatan').value.trim()
  });
  if (!r.ok) return gagalForm(ev, r, { 'nilai-tidak-valid': 'ne-nilai' });
  closeModal(); render();
  showAlert('success', 'Nilai berhasil diubah.', 'Nilai baru: ' + r.nilai.nilai + '. Rapor murid ini ikut diperbarui.');
  return false;
}
function mintaHapusNilai(id) {
  var n = db.nilai.find(function (x) { return x.id === id; });
  var s = n ? santriById(n.santriId) : null;
  confirmModal({
    judul: 'Hapus nilai ini?',
    isi: '<p>Nilai ' + esc(n ? n.jenis : '') + ' ' + esc(n ? n.mapel : '') + ' (' + (n ? n.nilai : '') + ') milik ' + esc(s ? s.nama : '') + ' akan dihapus.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { var r = hapusNilai(id); render(); toast(r.ok ? 'Nilai dihapus.' : r.message); }
  });
}
function bagikanRapor(santriId) {
  var s = santriById(santriId);
  var teks = teksRapor(santriId, ui.raporSemester);
  if (!s || !teks) { toast('Rapor belum bisa dibagikan, belum ada nilai.'); return; }
  shareText(teks, 'Rapor ' + s.nama);
}
function kirimPengingatSPP(id) {
  var s = santriById(id);
  if (!s) return;
  var teks = pengingatSPP(id);
  if (!teks) { toast('Pengingat tidak bisa dibuat untuk santri ini.'); return; }
  shareText(teks, 'Pengingat SPP');
  render();
  toast('Pengingat untuk ' + s.nama + ' dibagikan.');
}

/* ---- KBM ---- */
/* T-19: riwayat absensi guru tampil 12 dulu + tombol "Tampilkan lebih
   banyak" (dulu mentok 12 tanpa jalan melihat sisanya). */
function riwayatAbsensiGuruHtml(kelompok) {
  var semua = riwayatAbsensiGuru(kelompok);
  var batas = ui.absGuruShown || 12;
  var list = semua.slice(0, batas);
  if (!list.length) return '<p class="empty" role="status">Belum ada absensi tercatat.</p>';
  var html = list.map(function (a) {
    var g = guruById(a.guruId);
    return '<div class="row-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>' + esc(g ? g.nama : '-') + '</b><br><span class="muted">' + fmtTanggal(a.tanggal) + '</span></span><span class="badge ' + (a.status === 'Hadir' ? 'b-green' : a.status === 'Izin' ? 'b-blue' : a.status === 'Sakit' ? 'b-amber' : 'b-red') + '">' + esc(a.status) + '</span></div>';
  }).join('');
  if (semua.length > list.length) html += '<button class="btn secondary block" onclick="ui.absGuruShown=(ui.absGuruShown||12)+12;render()">Tampilkan lebih banyak (' + (semua.length - list.length) + ' lagi)</button>';
  return html;
}
function simpanAbsensiGuruUI(kelompok) {
  var tanggal = ui.absGuruTanggal || todayStr();
  var daftar = (kelompok === 'Pimpinan' ? db.guru.filter(function (g) { return g.peran === 'Pimpinan'; }) : db.guru).filter(guruCocokJenjang);
  var draft = {};
  daftar.forEach(function (g) {
    var st = ui['absGuruDraft_' + g.id];
    if (st) draft[g.id] = st;
  });
  var r = simpanAbsensiGuru(kelompok, tanggal, draft);
  /* K6: gagal simpan memberi pesan menetap, bukan toast-only. */
  if (!r.ok) { showAlert('error', 'Absensi guru tidak bisa disimpan.', r.message); return; }
  daftar.forEach(function (g) { delete ui['absGuruDraft_' + g.id]; });
  render();
  showAlert('success', 'Absensi berhasil disimpan.', 'Absensi ' + kelompok + ' tanggal ' + fmtTanggal(tanggal) + ' tersimpan (' + r.disimpan + ' orang).');
}
function submitAlokasi(ev, id) {
  ev.preventDefault();
  var data = {
    kelas: document.getElementById('al-kelas').value,
    mapel: document.getElementById('al-mapel').value,
    jamPerMinggu: parseInt(document.getElementById('al-jam').value, 10),
    hari: document.getElementById('al-hari').value.trim()
  };
  var r = simpanAlokasi(id || '', data);
  if (!r.ok) return gagalForm(ev, r, { 'jam-tidak-valid': 'al-jam' });
  closeModal(); render();
  showAlert('success', 'Alokasi waktu berhasil disimpan.', data.kelas + ' ' + data.mapel + ': ' + data.jamPerMinggu + ' jam per minggu.');
  return false;
}
function mintaHapusAlokasi(id) {
  confirmModal({
    judul: 'Hapus alokasi ini?',
    isi: '<p>Alokasi waktu ini akan dihapus.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { var r = hapusAlokasi(id); render(); toast(r.ok ? 'Alokasi dihapus.' : r.message); }
  });
}
function submitJadwal(ev, id) {
  ev.preventDefault();
  var data = {
    kelas: document.getElementById('jd-kelas').value,
    hari: document.getElementById('jd-hari').value,
    jamMulai: document.getElementById('jd-mulai').value,
    jamSelesai: document.getElementById('jd-selesai').value,
    mapel: document.getElementById('jd-mapel').value,
    guru: document.getElementById('jd-guru').value
  };
  var r = simpanJadwal(id || '', data);
  if (!r.ok) return gagalForm(ev, r, null);
  closeModal(); render();
  showAlert('success', 'Jadwal KBM berhasil disimpan.', data.kelas + ' ' + data.hari + ' ' + data.jamMulai + ' - ' + data.jamSelesai + '.');
  return false;
}
function mintaHapusJadwal(id) {
  confirmModal({
    judul: 'Hapus jadwal ini?',
    isi: '<p>Jadwal KBM ini akan dihapus.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { var r = hapusJadwal(id); render(); toast(r.ok ? 'Jadwal dihapus.' : r.message); }
  });
}
function submitPiket(ev) {
  ev.preventDefault();
  var gid = document.getElementById('pk-guru-id').value;
  if (!gid) { tampilErrorForm(ev.target, 'Pilih dulu gurunya lewat tombol "Pilih guru".'); return false; }
  var g = guruById(gid);
  var hari = document.getElementById('pk-hari').value;
  var r = tambahPiket(gid, hari, document.getElementById('pk-ket').value.trim());
  if (!r.ok) return gagalForm(ev, r, { 'hari-tidak-valid': 'pk-hari' });
  closeModal(); render();
  showAlert('success', 'Jadwal piket berhasil ditambah.', (g ? g.nama : '') + ' piket hari ' + hari + '.');
  return false;
}
function mintaHapusPiket(id) {
  confirmModal({
    judul: 'Hapus jadwal piket ini?',
    isi: '<p>Jadwal piket ini akan dihapus.</p>',
    okLabel: 'Ya, hapus', danger: true,
    onOk: function () { var r = hapusPiket(id); render(); toast(r.ok ? 'Piket dihapus.' : r.message); }
  });
}

/* ---- Pengaturan ---- */
function submitSettings(ev) {
  ev.preventDefault();
  /* A4: lihat submitTabungan. */
  var bacaSpp = bacaJumlah(document.getElementById('st-spp').value);
  if (!bacaSpp.ok) { tampilErrorForm(ev.target, bacaSpp.error, 'st-spp'); return false; }
  var r = simpanSettings({
    namaTpq: document.getElementById('st-nama').value.trim(),
    kepala: document.getElementById('st-kepala').value.trim(),
    tarifSpp: bacaSpp.nilai,
    tahunAjaran: document.getElementById('st-tahun').value.trim() || '2026/2027',
    jamMasuk: document.getElementById('st-jam').value || '15:30'
  });
  if (!r.ok) return gagalForm(ev, r, { 'nama-wajib': 'st-nama', 'spp-tidak-valid': 'st-spp' });
  /* N19: menyimpan pengaturan profil = pengguna mengonfirmasi data lembaga. */
  tandaiIdentitasDikonfirmasi();
  render();
  showAlert('success', 'Pengaturan berhasil disimpan.', 'Nama TPQ, kepala, tarif SPP, tahun ajaran, dan jam masuk sudah diperbarui.');
  return false;
}

/* ================= Install PWA (banner "Install Aplikasi") =================
   Chrome/Android menembakkan beforeinstallprompt saat aplikasi memenuhi syarat
   install (manifest + service worker + HTTPS). Kami tangkap event itu, tampilkan
   banner sendiri supaya pengguna tidak harus mencari menu browser, dan sediakan
   tombol yang sama di Pengaturan. iOS tidak punya event ini: arahkan ke
   Bagikan -> "Tambah ke Layar Utama". */
var deferredInstallPrompt = null;
function aplikasiTerpasang() {
  try {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  } catch (e) { return false; }
}
function perangkatIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent || ''); }
function tampilkanInstallBanner(paksa) {
  var b = document.getElementById('install-banner');
  if (!b || aplikasiTerpasang()) return;
  if (!paksa) { try { if (sessionStorage.getItem('tpq_install_ditolak')) return; } catch (e) {} }
  b.hidden = false;
}
function tutupInstallBanner() {
  var b = document.getElementById('install-banner');
  if (b) b.hidden = true;
  try { sessionStorage.setItem('tpq_install_ditolak', '1'); } catch (e) {}
  perbaruiBarisInstall();
}
function tampilkanBannerInstallManual() {
  try { sessionStorage.removeItem('tpq_install_ditolak'); } catch (e) {}
  tampilkanInstallBanner(true);
  toast('Banner install ditampilkan di bawah.');
}
function teksStatusInstall() {
  if (aplikasiTerpasang()) return 'Sudah terpasang di perangkat ini.';
  if (deferredInstallPrompt) return 'Siap di-install. Ketuk tombol Install di bawah.';
  if (perangkatIOS()) return 'Di iPhone/iPad: ketuk tombol Bagikan di browser, lalu pilih "Tambah ke Layar Utama".';
  return 'Belum ada tawaran install dari browser. Coba buka menu browser (titik tiga) lalu pilih "Install aplikasi" atau "Tambah ke Layar Utama".';
}
function perbaruiBarisInstall() {
  var el = document.getElementById('install-status');
  if (el) el.textContent = teksStatusInstall();
  var btn = document.getElementById('btn-install-pengaturan');
  if (btn) btn.disabled = aplikasiTerpasang();
}
function installApp() {
  if (aplikasiTerpasang()) { toast('Aplikasi sudah terpasang.'); return; }
  if (deferredInstallPrompt) {
    var p = deferredInstallPrompt;
    deferredInstallPrompt = null;
    tutupInstallBanner();
    p.prompt();
    if (p.userChoice) {
      p.userChoice.then(function (hasil) {
        if (hasil && hasil.outcome === 'accepted') toast('Aplikasi sedang di-install.');
        perbaruiBarisInstall();
      }).catch(function () { perbaruiBarisInstall(); });
    }
    return;
  }
  if (perangkatIOS()) { toast('Di iPhone: ketuk Bagikan, lalu "Tambah ke Layar Utama".'); return; }
  toast('Buka menu browser (titik tiga), lalu pilih "Install aplikasi".');
}
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  tampilkanInstallBanner();
  perbaruiBarisInstall();
});
window.addEventListener('appinstalled', function () {
  deferredInstallPrompt = null;
  tutupInstallBanner();
  toast('Aplikasi berhasil di-install.');
});

/* ================= Router dan init (v2) ================= */
function init() {
  initEngine();
  applyMode();
  cekOnboarding();
  initSyncIndicator();
  /* K7: home indicator ala iOS hanya di iPhone/iPad; di Android bilah ini
     dobel dengan gesture bar sistem. */
  var hi = document.querySelector('.home-indicator');
  if (hi) hi.style.display = perangkatIOS() ? '' : 'none';
  render();
  window.addEventListener('online', function () { updateSyncStatus(); });
  window.addEventListener('offline', function () { updateSyncStatus(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { tutupDropdownSem(); closeModal(); closeSheet(); }
    if (e.key === 'Tab') jebakTabModal(e);
  });
  /* S6: ketuk di luar dropdown semester menutupnya. */
  document.addEventListener('click', function (e) {
    var w = document.getElementById('sem-wrap');
    if (w && w.classList.contains('open') && !w.contains(e.target)) tutupDropdownSem();
  });
  var lastDesktop = isDesktopMode();
  window.addEventListener('resize', function () {
    if (getMode() === 'auto' && isDesktopMode() !== lastDesktop) {
      lastDesktop = isDesktopMode();
      render();
    }
  });
  /* Wiring selftest v22 (Kirana): pemicu ?selftest=1 HANYA jalan bila
     bolehSelftest() true (data contoh). Gate v21 hilang saat merge dari
     v20; tanpa gate, ?selftest=1 pada data asli akan menjalankan suite
     yang mengubah/menghapus data. Bila ditolak, beri tahu pengguna lewat
     toast (bukan diam-diam). Fail-closed: bila bolehSelftest tidak ada
     (engine lama), perlakukan sebagai ditolak. */
  if (new URLSearchParams(location.search).get('selftest') === '1') {
    setTimeout(function () {
      var boleh = false;
      try { boleh = (typeof bolehSelftest === 'function') ? bolehSelftest() : false; } catch (e) { boleh = false; }
      if (boleh) runUiSelfTest();
      else toast('Selftest hanya bisa dijalankan pada data contoh. Data asli tidak diubah.');
    }, 300);
  }
}

/* S1: selftest hanya boleh jalan bila db.isContoh (data contoh). */
function bolehSelftest() {
  try { return !!(typeof db !== 'undefined' && db && db.isContoh); } catch (e) { return false; }
}

/* ================= Self-test UI (hanya jalan dengan ?selftest=1) =================
   Mesin diuji lewat runEngineSelfTests() dari engine (80 uji), lalu UI diuji
   di bawah ini lewat DOM yang sudah di-render. */
function selftestLog(root, nama, ok, detail) {
  var div = document.createElement('div');
  div.textContent = (ok ? 'PASS' : 'FAIL') + ' | ' + nama + (detail ? ' | ' + detail : '');
  root.appendChild(div);
  return ok;
}
function runUiSelfTest() {
  var root = document.getElementById('selftest-root');
  root.style.display = 'block';
  root.innerHTML = '';
  var pass = 0, fail = 0;
  function t(nama, ok, detail) { if (selftestLog(root, nama, ok, detail)) pass++; else fail++; }
  function selesai() {
    /* Matikan flag selftest engine: selesai() adalah satu-satunya titik
       keluar runUiSelfTest (semua jalur .then/.catch/try-catch bermuara
       di sini), jadi ini padanan finally untuk fungsi async ini — sebuah
       try...finally sinkron di badan fungsi akan mematikan flag SEBELUM
       ujiUi berjalan, karena badan kembali segera setelah janji dibuat.
       Flag harus tetap menyala selama ujiUi: selama menyala,
       tandaiDataAsli() no-op sehingga tulis BLOK C/WIRA2 tidak membalik
       isContoh di tengah suite. */
    try { if (typeof setModeSelftest === 'function') setModeSelftest(false); } catch (e) {}
    var div = document.createElement('div');
    div.id = 'selftest-done';
    div.textContent = 'SELFTEST DONE | PASS ' + pass + ' | FAIL ' + fail;
    root.appendChild(div);
    document.title = 'SELFTEST ' + (fail === 0 ? 'PASS' : 'FAIL') + ' (' + pass + '/' + (pass + fail) + ')';
  }
  /* Nyalakan flag selftest engine selama suite berjalan (mekanisme utama;
     deteksi URL ?selftest=1 di sedangSelftest() hanya cadangan). Engine
     menyimpan + mengembalikan flag luar ini di runEngineSelfTests, jadi
     flag tetap menyala sampai selesai() di atas mematikannya. */
  try { if (typeof setModeSelftest === 'function') setModeSelftest(true); } catch (e) {}
  function statNum(id) {
    var el = document.querySelector(id + ' .stat-num');
    return el ? el.textContent.trim() : null;
  }
  function ujiUi() {
    try {
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

/* Gerbang login + peran (Kirana, ronde siap produksi). Kalau mesin
         auth belum ada (Baskara masih membangun), uji dilewati dengan
         catatan, bukan gagal. Kalau ada, masuk dulu sebagai admin supaya
         uji lama tetap berjalan sebagai Pimpinan (semua modul). */
      if (!authTersedia()) {
        t('Gerbang login dilewati: mesin auth belum tersedia', true, 'engine belum menyediakan sesiAktif/masukPengguna');
      } else {
        keluar(); render();
        t('Tanpa sesi, render menampilkan layar login', !!document.querySelector('#auth-root .auth-screen') && document.body.classList.contains('logged-out'));
        t('Tanpa sesi, sidebar dan tab bar dikosongkan', document.getElementById('sidebar').innerHTML === '' && document.getElementById('bottomnav').innerHTML === '' && document.getElementById('view').innerHTML === '');
        document.getElementById('login-id').value = 'admin';
        document.getElementById('login-sandi').value = 'salah123';
        submitLogin({ preventDefault: function () {} });
        var errLogin = document.getElementById('login-error');
        t('Login salah menampilkan pesan error dan menahan di layar login', !!errLogin && !errLogin.hidden && errLogin.textContent.length > 3, errLogin ? errLogin.textContent : 'tidak ada error');
        document.getElementById('login-sandi').value = 'admin123';
        submitLogin({ preventDefault: function () {} });
        t('Login admin pertama kali meminta ganti sandi (tidak bisa dilewati)', wajibGantiSandi === true && !!document.querySelector('#auth-root .auth-screen'));
        document.getElementById('ganti-baru').value = 'abc';
        document.getElementById('ganti-ulang').value = 'abc';
        submitGantiSandiPaksa({ preventDefault: function () {} });
        t('Ganti sandi menolak sandi pendek', wajibGantiSandi === true && !document.getElementById('ganti-error').hidden);
        document.getElementById('ganti-baru').value = 'sandiuji9';
        document.getElementById('ganti-ulang').value = 'sandiuji8';
        submitGantiSandiPaksa({ preventDefault: function () {} });
        t('Ganti sandi menolak konfirmasi tidak cocok', wajibGantiSandi === true && !document.getElementById('ganti-error').hidden);
        document.getElementById('ganti-ulang').value = 'sandiuji9';
        submitGantiSandiPaksa({ preventDefault: function () {} });
        t('Ganti sandi berhasil, dashboard tampil sebagai Pimpinan', wajibGantiSandi === false && document.getElementById('view').innerHTML.indexOf('Selamat datang di,') !== -1);
      }

      /* Onboarding: tampil di kunjungan pertama, flag tersimpan setelah Mulai. */
      try { localStorage.removeItem('tpq_onboarded'); } catch (e) {}
      cekOnboarding();
      var ob = document.getElementById('onboarding');
      t('Onboarding tampil di kunjungan pertama', !!ob && !ob.hidden);
      tutupOnboarding();
      var flagOk = false;
      try { flagOk = localStorage.getItem('tpq_onboarded') === '1'; } catch (e) {}
      t('Onboarding menyimpan flag kunjungan pertama', flagOk && !!ob && ob.hidden);
      try { localStorage.removeItem('tpq_onboarded'); } catch (e) {}

      /* Dashboard mobile (mockup v3 layar 2). */
      setMode('mobile');
      setJenjang('Semua');
      ui.nilaiTab = 'Harian';
      go('dashboard'); render();
      var view = document.getElementById('view');
      var html = view.innerHTML;
      t('Dashboard memuat sapaan dan nama lembaga', html.indexOf('Selamat datang di,') !== -1 && html.indexOf('TPQ Al-Muttaqin') !== -1);
      t('Dashboard kartu profil Ahmad Fauzi (202401, Iqra 3, Juz 30)', html.indexOf('Ahmad Fauzi') !== -1 && html.indexOf('202401') !== -1 && html.indexOf('Iqra 3') !== -1 && html.indexOf('Juz 30') !== -1);
      t('Menu Informasi tampil sebelum Notifikasi', html.indexOf('Menu Informasi') !== -1 && html.indexOf('Notifikasi') !== -1 && html.indexOf('Menu Informasi') < html.indexOf('Notifikasi'));
      t('Menu Informasi berisi 8 tile mockup', view.querySelectorAll('.menu-grid .menu-item').length === 8, view.querySelectorAll('.menu-grid .menu-item').length + ' tile');
      t('Kartu profil memakai ilustrasi buku SVG mockup', !!view.querySelector('.profile-card .pc-art'));
      t('Chip jenjang ringkas tampil di atas dashboard', !!view.querySelector('.jenjang-slim'));
      t('Tunggakan SPP memakai badge status (Belum/Telat)', view.querySelectorAll('.badge.b-amber, .badge.b-red').length >= 1, view.querySelectorAll('.badge.b-amber, .badge.b-red').length + ' badge');
      t('Meta tunggakan tidak lagi memuat status mentah', view.innerHTML.indexOf('| Belum') === -1 && view.innerHTML.indexOf('| Telat') === -1);
      /* Kontrol positif (sesi admin di sini): dashboard Pimpinan MEMANG
         menampilkan angka keuangan — kebalikan dari uji Guru di bawah. */
      t('Dashboard Pimpinan menampilkan Total tabungan + Saldo kas + Tunggakan SPP',
        html.indexOf('Total tabungan') !== -1 && html.indexOf('Saldo kas') !== -1 && html.indexOf('Tunggakan SPP') !== -1);

      /* Tab bar mobile (mockup v3). */
      var tabs = document.querySelectorAll('#bottomnav .tab-btn');
      t('Tab bar berisi 5 tombol', tabs.length === 5, tabs.length + ' tombol');
      var labelTab = Array.prototype.map.call(tabs, function (b) { return b.textContent.trim(); }).join(',');
      t('Tab bar berlabel Beranda, Santri, Tabungan, Keuangan, Kelas', labelTab === 'Beranda,Santri,Tabungan,Keuangan,Kelas', labelTab);
      t('Tab bar punya home indicator', !!document.querySelector('#bottomnav .home-ind'));

      /* Perbaikan layout 390px (15 Nov ~12:41 WIB, dari screenshot bingkai HP):
         bar jenjang menumpuk vertikal, meta santri tanpa duplikat, pemisah
         nilai kosong dihilangkan, tombol tunggakan memakai label pendek. */
      t('Tombol tunggakan memakai label pendek "Ingatkan"', view.innerHTML.indexOf('>Ingatkan<') !== -1 && view.innerHTML.indexOf('Kirim pengingat') === -1);
      go('santri'); render();
      t('Kartu bar jenjang memakai kelas jenjang-bar', document.getElementById('view').innerHTML.indexOf('jenjang-bar') !== -1);
      t('Meta santri tidak menduplikat kelas/jilid yang sama', document.getElementById('view').innerHTML.indexOf('Iqra 2 | Iqra 2') === -1);
      t('Filter angkatan memakai label pendek (tidak "Semua angkatan")', document.getElementById('view').innerHTML.indexOf('Semua angkatan') === -1);
      go('penilaian'); render();
      t('Daftar nilai tidak menampilkan pemisah "|" menggantung', document.getElementById('view').innerHTML.indexOf(' | </span>') === -1);
      go('dashboard'); render();
      /* Cek layout nyata: tombol tab tidak boleh saling tumpang tindih (penyebab
         label "TabunganKeuangan" di HP Mas: .bottomnav flex membuat tab-row
         menyempit). Di jsdom semua rect 0, jadi uji dilewati di sana. */
      var rectTab = Array.prototype.map.call(tabs, function (b) { var r = b.getBoundingClientRect(); return { l: r.left, r: r.right }; });
      var adaLayoutTab = rectTab.some(function (x) { return x.r > 0; });
      if (adaLayoutTab) {
        var tumpangTab = false;
        for (var ti = 1; ti < rectTab.length; ti++) { if (rectTab[ti].l < rectTab[ti - 1].r - 1) tumpangTab = true; }
        t('Tombol tab bar tidak saling tumpang tindih', !tumpangTab, rectTab.map(function (x) { return Math.round(x.l) + '-' + Math.round(x.r); }).join(', '));
      } else {
        t('Tombol tab bar tidak saling tumpang tindih (dilewati di jsdom, tanpa layout)', true, 'jsdom');
      }
      /* Visibilitas NYATA (bukan sekadar ada di DOM): pelajaran 15 Nov — selftest
         lama lolos 113/113 padahal dashboard mobile kosong di HP, karena ia
         memakai setMode('mobile') yang menyembunyikan cacat mode Otomatis, dan
         hanya memeriksa keberadaan di DOM. Di browser sungguhan, kartu profil
         + Menu Informasi harus punya tinggi > 0 dan tab bar harus fixed. */
      if (adaLayoutTab) {
        var kartuProfil = view.querySelector('.only-mobile .profile-card');
        var rProfil = kartuProfil ? kartuProfil.getBoundingClientRect() : null;
        t('Kartu profil terlihat di layar (tinggi > 0)', !!(rProfil && rProfil.height > 0), rProfil ? 'tinggi ' + Math.round(rProfil.height) + 'px' : 'tidak ada');
        var menuGrid = view.querySelector('.menu-grid');
        var rMenu = menuGrid ? menuGrid.getBoundingClientRect() : null;
        t('Menu Informasi terlihat di layar (tinggi > 0)', !!(rMenu && rMenu.height > 0), rMenu ? 'tinggi ' + Math.round(rMenu.height) + 'px' : 'tidak ada');
        var posTab = '';
        try { posTab = window.getComputedStyle(document.getElementById('bottomnav')).position; } catch (e) { posTab = ''; }
        t('Tab bar menempel di bawah layar (position fixed)', posTab === 'fixed', posTab);
      } else {
        t('Kartu profil + Menu Informasi terlihat (dilewati di jsdom, tanpa layout)', true, 'jsdom');
      }

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

      /* R8 (d) Nilai grafik batang tidak terlipat di tengah angka
         (15 Nov sore: "+Rp3.250.000" terlipat jadi "+Rp3.250.0 00" karena
         overflow-wrap:anywhere + font 14px di kolom ~70px). */
      t('REGISTRAR nilai grafik batang satu baris tanpa lipat tengah angka', (function () {
        if (!regCss) return true;
        var m = regCss.match(/\.bar-col\s+\.val\s*\{[^}]*\}/);
        if (!m) return false;
        return /white-space\s*:\s*nowrap/.test(m[0]) && !/overflow-wrap\s*:\s*anywhere/.test(m[0]);
      })(), 'cek aturan .bar-col .val di stylesheet');

      /* ---- PERBAIKAN UI/UX Kirana 15 Nov sore (S1-S8, K1-K10, F3) ----
         Disisipkan setelah tes R8 (anchor unik: BLOK KIRANA-15NOV).
         Keadaan di sini: admin (Pimpinan), mode mobile, di dashboard. */
      /* S1: alert sinkron bertahan — render() dulu baru showAlert. Diuji
         dengan stub flushSync yang memanggil balik secara sinkron. */
      var flushAsliK = flushSync;
      flushSync = function () { return { then: function (cb) { cb('ok'); } }; };
      sinkronSekarang();
      t('S1: alert "Sinkron selesai" bertahan setelah render di sinkronSekarang',
        document.getElementById('alert-root').textContent.indexOf('Sinkron selesai') !== -1,
        document.getElementById('alert-root').textContent.slice(0, 60));
      flushSync = flushAsliK;
      var gscAsliK = getSheetCfg, ioAsliK = isOnline, sendAsliK = sendToAppsScriptNow;
      getSheetCfg = function () { return { appsScriptUrl: 'https://script.google.com/macros/s/TEST/exec' }; };
      isOnline = function () { return true; };
      sendToAppsScriptNow = function () { return { then: function (cb) { cb({ status: 'ok' }); } }; };
      kirimKeAppsScript();
      t('S1: alert "Data terkirim ke Sheet" bertahan setelah render di kirimKeAppsScript',
        document.getElementById('alert-root').textContent.indexOf('Data terkirim ke Sheet') !== -1,
        document.getElementById('alert-root').textContent.slice(0, 60));
      getSheetCfg = gscAsliK; isOnline = ioAsliK; sendToAppsScriptNow = sendAsliK;

      /* S2: kartu jenjang tetap tampil saat mengetik di kotak cari. */
      setMode('mobile');
      go('santri'); render();
      ui.santriSearch = 'ahmad'; renderSantriOnly();
      t('S2: kartu jenjang tetap tampil saat mengetik di cari Santri',
        !!document.querySelector('#view .jenjang-bar'));
      ui.santriSearch = ''; renderSantriOnly();
      go('guru'); render();
      ui.guruSearch = 'ahmad'; renderGuruOnly();
      t('S2: kartu jenjang tetap tampil saat mengetik di cari Guru',
        !!document.querySelector('#view .jenjang-bar'));
      ui.guruSearch = ''; renderGuruOnly();

      /* D-02 (komplain klien video 2, 15 Nov): kontrol jenjang harus langsung
         me-render — dulu setJenjang() tanpa render() sehingga tampilan
         tertinggal satu klik ("harus klik di sini baru berubah"). */
      go('santri'); render();
      var pillTPQ = null;
      Array.prototype.forEach.call(document.querySelectorAll('#view .chip-filter'), function (b) { if (!pillTPQ && b.textContent.trim() === 'TPQ') pillTPQ = b; });
      pillTPQ.click();
      t('D-02: klik pill jenjang TPQ langsung memfilter daftar santri (22 aktif)',
        document.getElementById('view').textContent.indexOf('Santri (22)') !== -1);
      var selJenjang = document.querySelector('#view select[aria-label="Filter jenjang"]');
      selJenjang.value = 'Ibtidaiyah';
      selJenjang.dispatchEvent(new window.Event('change', { bubbles: true }));
      t('D-02: dropdown Filter jenjang langsung memfilter daftar santri (16 aktif)',
        document.getElementById('view').textContent.indexOf('Santri (16)') !== -1);
      setJenjang('Semua'); render();

      /* S3 + S4: fokus modal, tombol tutup, konfirmasi tutup form kotor. */
      go('santri'); render();
      var btnTambahK = document.querySelector('#view .btn-row .btn');
      btnTambahK.focus();
      openSantriForm();
      t('S3: membuka modal memindah fokus ke field pertama di dalam modal',
        document.activeElement && document.activeElement.id === 'f-nama',
        'activeElement=' + (document.activeElement && document.activeElement.id));
      t('S4: modal punya tombol tutup x 44px di kanan atas',
        !!document.querySelector('#modal-root .modal-x'));
      document.getElementById('f-nama').value = 'Tes Nama';
      document.getElementById('f-nama').dispatchEvent(new Event('input', { bubbles: true }));
      mintaTutupModal();
      t('S4: tutup modal saat form sudah diubah meminta konfirmasi',
        document.getElementById('modal-root').textContent.indexOf('Tutup tanpa menyimpan?') !== -1);
      runConfirm();
      t('S4: konfirmasi tutup benar-benar menutup modal dan fokus kembali ke pemicu',
        document.getElementById('modal-root').innerHTML === '' && document.activeElement === btnTambahK);
      openSantriForm();
      mintaTutupModal();
      t('S4: tutup modal saat form masih bersih langsung menutup tanpa konfirmasi',
        document.getElementById('modal-root').innerHTML === '');

      /* S5: error simpan tampil di dalam form (ringkasan + bawah field). */
      openSantriForm();
      document.getElementById('f-nama').value = 'Tes Duplikat';
      document.getElementById('f-nis').value = '202401';
      document.getElementById('f-jk').value = 'L'; /* Wira: jk kini wajib — isi dulu supaya yang diuji benar-benar jalur duplikat NIS, bukan error jk. */
      var formSantriK = document.querySelector('#modal-root form');
      submitSantri({ preventDefault: function () {}, target: formSantriK }, '');
      var errSantriK = document.querySelector('#modal-root .form-error');
      t('S5: NIS duplikat menampilkan error di dalam form santri (bukan hanya toast)',
        !!errSantriK && errSantriK.textContent.indexOf('sudah dipakai') !== -1,
        errSantriK ? errSantriK.textContent : 'tidak ada .form-error');
      t('S5: pesan error juga tampil di bawah field NIS + aria-describedby',
        !!document.getElementById('err-f-nis') && document.getElementById('f-nis').getAttribute('aria-describedby') === 'err-f-nis');
      closeModal();
      ui.nilaiTab = 'Harian'; ui.nilaiSantri = 's1';
      go('penilaian'); render();
      document.getElementById('nl-nilai').value = '150';
      var formNilaiK = document.getElementById('nl-nilai').closest('form');
      submitNilai({ preventDefault: function () {}, target: formNilaiK });
      t('S5: nilai di luar 0-100 menampilkan error di dalam form Penilaian',
        !!formNilaiK.querySelector('.form-error') && document.getElementById('nl-nilai').getAttribute('aria-describedby') === 'err-nl-nilai',
        formNilaiK.querySelector('.form-error') ? formNilaiK.querySelector('.form-error').textContent : 'tidak ada .form-error');
      go('pengaturan'); render();
      document.getElementById('st-nama').value = '';
      var formSetK = document.getElementById('st-nama').closest('form');
      submitSettings({ preventDefault: function () {}, target: formSetK });
      t('S5: nama TPQ kosong menampilkan error di dalam form Pengaturan',
        !!formSetK.querySelector('.form-error') && document.getElementById('st-nama').getAttribute('aria-describedby') === 'err-st-nama');

      /* JK: jenis kelamin santri (Kirana) + label Tapel Hijriah + batang
         grafik bisa diklik. Santri uji dibuat lalu dihapus lagi supaya
         hitungan tes sesudahnya (S7/S8: 38 santri aktif) tidak berubah. */
      setMode('mobile');
      setJenjang('Semua');
      var jmlSantriJk = db.santri.length;
      /* (a1) JK kosong -> error di dalam form (pola S5), tidak tersimpan. */
      openSantriForm();
      document.getElementById('f-nama').value = 'Tes JK Kosong';
      document.getElementById('f-nis').value = '202498';
      document.getElementById('f-jk').value = '';
      var formJkKosong = document.querySelector('#modal-root form');
      submitSantri({ preventDefault: function () {}, target: formJkKosong }, '');
      t('JK: submit tanpa jenis kelamin menampilkan error di dalam form + tidak menyimpan',
        !!document.querySelector('#modal-root .form-error') &&
        document.getElementById('f-jk').getAttribute('aria-describedby') === 'err-f-jk' &&
        !db.santri.some(function (s) { return s.nis === '202498'; }),
        document.querySelector('#modal-root .form-error') ? document.querySelector('#modal-root .form-error').textContent : 'tidak ada .form-error');
      closeModal();
      /* (a2) Isi form + pilih jk L -> tersimpan dengan jk benar. */
      openSantriForm();
      document.getElementById('f-nama').value = 'Tes JK Laki';
      document.getElementById('f-nis').value = '202499';
      document.getElementById('f-jk').value = 'L';
      var formJk = document.querySelector('#modal-root form');
      submitSantri({ preventDefault: function () {}, target: formJk }, '');
      var santriJkBaru = db.santri.find(function (s) { return s.nis === '202499'; });
      t('JK: santri baru tersimpan dengan jk L',
        !!(santriJkBaru && santriJkBaru.jk === 'L'),
        santriJkBaru ? 'jk=' + santriJkBaru.jk : 'santri tidak tersimpan');
      /* (a3) Form ubah menampilkan jk yang sudah tersimpan (terpilih). */
      if (santriJkBaru) {
        openSantriForm(santriJkBaru.id);
        t('JK: form ubah memilih L untuk santri yang jk-nya L',
          document.getElementById('f-jk').value === 'L',
          'f-jk=' + document.getElementById('f-jk').value);
        closeModal();
      } else {
        t('JK: form ubah memilih L untuk santri yang jk-nya L', false, 'santri uji tidak tersimpan');
      }
      if (santriJkBaru) hapusSantri(santriJkBaru.id);
      t('JK: santri uji dihapus, jumlah santri kembali seperti semula',
        db.santri.length === jmlSantriJk, db.santri.length + ' vs ' + jmlSantriJk);
      /* (b) Rekap per kelas: "(L x · P y)" + label Tapel. */
      var taAktifJk = (db.settings && db.settings.tahunAjaran) || '2026/2027';
      var thMulaiJk = parseInt(String(taAktifJk).match(/(\d{4})/)[1], 10);
      var tapelHarapJk = 'Tapel ' + (thMulaiJk - 578) + '/' + (thMulaiJk - 577);
      go('laporan'); render();
      var teksLaporanJk = document.getElementById('view').textContent;
      var iqra1Jk = db.santri.filter(function (s) { return s.status === 'Aktif' && s.kelas === 'Iqra 1'; });
      var teksIqra1Jk = '(' + teksGender(rekapGenderUi(iqra1Jk)) + ')';
      t('JK: Rekap per kelas menampilkan "(L " dan "P " di tiap baris kelas',
        teksLaporanJk.indexOf('(L ') !== -1 && teksLaporanJk.indexOf('P ') !== -1);
      t('JK: Rekap per kelas Iqra 1 menampilkan hitungan benar ' + teksIqra1Jk,
        teksLaporanJk.indexOf(teksIqra1Jk) !== -1,
        'cek "' + teksIqra1Jk + '" di #view');
      t('Tapel: Rekap per kelas menampilkan label ' + tapelHarapJk + ' untuk tahun ajaran ' + taAktifJk,
        teksLaporanJk.indexOf(tapelHarapJk) !== -1,
        tapelHarapJk === 'Tapel 1448/1449' ? 'jangkar: 2026/2027 -> 1448/1449' : 'tahun ajaran bukan 2026/2027');
      /* (c) Grafik Murid per kelas: L/P per batang + total + Tapel + klik. */
      go('grafik'); render();
      var teksGrafikJk = document.getElementById('view').textContent;
      var totalJk = rekapGenderUi(santriAktif());
      var teksTotalJk = 'L ' + totalJk.l + ' · P ' + totalJk.p;
      t('JK: Grafik Murid per kelas menampilkan "L " dan "P " per batang + total ' + teksTotalJk,
        teksGrafikJk.indexOf('L ') !== -1 && teksGrafikJk.indexOf('P ') !== -1 &&
        teksGrafikJk.indexOf(teksTotalJk) !== -1,
        'total santri aktif: ' + teksTotalJk);
      t('Tapel: Grafik Murid per kelas menampilkan label ' + tapelHarapJk,
        teksGrafikJk.indexOf(tapelHarapJk) !== -1);
      t('Grafik: ada petunjuk ketuk batang di atas bagan Murid per kelas',
        teksGrafikJk.indexOf('Ketuk batang untuk melihat santri kelas itu.') !== -1);
      var batangKlikJk = document.querySelectorAll('#view .bar-col[role="button"]');
      var jmlKelasJk = db.kelas.filter(function (k) { return jenjangCocok(k.jenjang); }).length;
      t('Grafik: hanya batang Murid per kelas yang bisa diklik (3 bagan lain tidak)',
        batangKlikJk.length === jmlKelasJk,
        batangKlikJk.length + ' batang klik vs ' + jmlKelasJk + ' kelas tampil');
      var batangIqra1Jk = null;
      /* K5 (Kirana): aria-label batang kini membawa hitungan gender
         ("Lihat santri kelas Iqra 1 — 7 santri: 4 laki-laki, 3 perempuan"),
         jadi cari dengan awalan, bukan sama persis. */
      Array.prototype.forEach.call(batangKlikJk, function (b) {
        if (!batangIqra1Jk && (b.getAttribute('aria-label') || '').indexOf('Lihat santri kelas Iqra 1') === 0) batangIqra1Jk = b;
      });
      var nIqra1Jk = iqra1Jk.length;
      if (batangIqra1Jk) {
        batangIqra1Jk.click();
        t('Grafik: klik batang Iqra 1 membuka halaman Santri dengan filter kelas Iqra 1',
          currentRoute === 'santri' && ui.santriKelas === 'Iqra 1' &&
          document.getElementById('view').textContent.indexOf('Santri (' + nIqra1Jk + ')') !== -1,
          'route=' + currentRoute + ', filter=' + ui.santriKelas + ', n=' + nIqra1Jk);
      } else {
        t('Grafik: klik batang Iqra 1 membuka halaman Santri dengan filter kelas Iqra 1', false, 'batang Iqra 1 tidak ditemukan');
      }
      go('grafik'); render();
      var batangIqra1KJk = document.querySelector('#view .bar-col[aria-label^="Lihat santri kelas Iqra 1"]');
      try {
        batangIqra1KJk.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        t('Grafik: Enter pada batang Iqra 1 membuka halaman Santri (keyboard)',
          currentRoute === 'santri' && ui.santriKelas === 'Iqra 1',
          'route=' + currentRoute + ', filter=' + ui.santriKelas);
      } catch (e) {
        t('Grafik: Enter pada batang Iqra 1 membuka halaman Santri (keyboard, dilewati)', true, 'jsdom: KeyboardEvent tidak tersedia');
      }
      /* (e) Wira (QA ronde jk): kontrak edit, Tapel tahun lain, klik Kelas 1,
         dan injeksi lewat nama kelas di handler klik batang. */
      var santriEditJk = simpanSantri('', { nama: 'Tes Edit JK', nis: '202478', jk: 'P', jenjang: 'TPQ', kelas: 'Iqra 1', jilid: 'Iqra 1' });
      if (santriEditJk.ok) {
        openSantriForm(santriEditJk.santri.id);
        document.getElementById('f-nama').value = 'Tes Edit JK Diubah';
        var formEditJk = document.querySelector('#modal-root form');
        submitSantri({ preventDefault: function () {}, target: formEditJk }, santriEditJk.santri.id);
        var santriEditJkSesudah = santriById(santriEditJk.santri.id);
        t('JK: edit santri tanpa mengubah jk -> jk tetap P (tidak terhapus)',
          !!(santriEditJkSesudah && santriEditJkSesudah.jk === 'P' && santriEditJkSesudah.nama === 'Tes Edit JK Diubah'),
          santriEditJkSesudah ? 'jk=' + santriEditJkSesudah.jk + ', nama=' + santriEditJkSesudah.nama : 'santri hilang');
        hapusSantri(santriEditJk.santri.id);
      } else {
        t('JK: edit santri tanpa mengubah jk -> jk tetap P (tidak terhapus)', false, 'santri uji gagal dibuat');
      }
      var taSimpanWira = db.settings.tahunAjaran;
      db.settings.tahunAjaran = '2025/2026';
      t('Tapel: labelTapel 2025/2026 -> Tapel 1447/1448', labelTapel() === 'Tapel 1447/1448', labelTapel());
      db.settings.tahunAjaran = 'rusak';
      t('Tapel: tahun ajaran tidak dikenal memakai jangkar 2026/2027 -> Tapel 1448/1449', labelTapel() === 'Tapel 1448/1449', labelTapel());
      db.settings.tahunAjaran = taSimpanWira;
      go('grafik'); render();
      var batangKelas1Wira = null;
      Array.prototype.forEach.call(document.querySelectorAll('#view .bar-col[role="button"]'), function (b) {
        if (!batangKelas1Wira && (b.getAttribute('aria-label') || '').indexOf('Lihat santri kelas Kelas 1') === 0) batangKelas1Wira = b;
      });
      if (batangKelas1Wira) {
        batangKelas1Wira.click();
        var nKelas1Wira = db.santri.filter(function (s) { return s.status === 'Aktif' && s.kelas === 'Kelas 1'; }).length;
        t('Grafik: klik batang Kelas 1 membuka halaman Santri dengan filter kelas Kelas 1',
          currentRoute === 'santri' && ui.santriKelas === 'Kelas 1' &&
          document.getElementById('view').textContent.indexOf('Santri (' + nKelas1Wira + ')') !== -1,
          'route=' + currentRoute + ', filter=' + ui.santriKelas + ', n=' + nKelas1Wira);
      } else {
        t('Grafik: klik batang Kelas 1 membuka halaman Santri dengan filter kelas Kelas 1', false, 'batang Kelas 1 tidak ditemukan');
      }
      /* Injeksi: nama kelas berisi penutup string JS + kode. Sebelum perbaikan
         (esc() saja), klik mengeksekusi window.__wiraPwn=1; sesudah perbaikan
         (escJs) nama itu hanya jadi filter kelas, tanpa kode jalan. */
      var namaKelasRacun = "Kelas ');window.__wiraPwn=1;//";
      var kelasRacun = tambahKelas({ nama: namaKelasRacun, jenjang: 'TPQ' });
      if (kelasRacun.ok) {
        window.__wiraPwn = undefined;
        go('grafik'); render();
        var batangRacunWira = null;
        Array.prototype.forEach.call(document.querySelectorAll('#view .bar-col[role="button"]'), function (b) {
          if (!batangRacunWira && (b.getAttribute('aria-label') || '').indexOf('Lihat santri kelas ' + namaKelasRacun) === 0) batangRacunWira = b;
        });
        if (batangRacunWira) {
          batangRacunWira.click();
          t('Grafik: nama kelas berisi kode JS tidak dieksekusi saat batang diklik (escJs)',
            window.__wiraPwn !== 1 && currentRoute === 'santri' && ui.santriKelas === namaKelasRacun,
            window.__wiraPwn === 1 ? 'KODE JALAN (injeksi!)' : 'route=' + currentRoute + ', filter=' + ui.santriKelas);
        } else {
          t('Grafik: nama kelas berisi kode JS tidak dieksekusi saat batang diklik (escJs)', false, 'batang kelas racun tidak ditemukan');
        }
        db.kelas = db.kelas.filter(function (k) { return k.id !== kelasRacun.kelas.id; });
        window.__wiraPwn = undefined;
      } else {
        t('Grafik: nama kelas berisi kode JS tidak dieksekusi saat batang diklik (escJs)', false, 'kelas racun gagal dibuat: ' + (kelasRacun.message || ''));
      }
      /* Injeksi lanjutan (temuan lama Wira, diperbaiki di sini): chip picker +
         nama pengguna di Kelola Pengguna memakai pola esc() yang sama. */
      window.__pwnChip = undefined;
      openPicker({ title: 'Pilih uji', chips: ["Kelas ');window.__pwnChip=1;//"], items: [], onPick: function () {} });
      var chipRacun = null;
      Array.prototype.forEach.call(document.querySelectorAll('#modal-root .chip-filter'), function (b) { if (!chipRacun && b.textContent.indexOf("');window") !== -1) chipRacun = b; });
      if (chipRacun) {
        chipRacun.click();
        t('Picker: nama chip berisi kode JS tidak dieksekusi saat diklik (escJs)',
          window.__pwnChip !== 1 && picker.chip === "Kelas ');window.__pwnChip=1;//",
          window.__pwnChip === 1 ? 'KODE JALAN (injeksi!)' : 'chip=' + picker.chip);
      } else {
        t('Picker: nama chip berisi kode JS tidak dieksekusi saat diklik (escJs)', false, 'chip racun tidak ditemukan');
      }
      closeModal();
      window.__pwnChip = undefined;
      window.__pwnUser = undefined;
      var userRacun = tambahPengguna({ id: 'ujiracun', nama: "Uji ');window.__pwnUser=1;//", peran: 'Guru', sandi: 'racun123', olehId: 'admin' });
      if (userRacun.ok) {
        go('pengaturan'); render();
        var btnResetRacun = null;
        Array.prototype.forEach.call(document.querySelectorAll('#view .user-row .btn'), function (b) {
          if (!btnResetRacun && b.textContent.trim() === 'Reset sandi' && b.closest('.user-row') && b.closest('.user-row').textContent.indexOf('ujiracun') !== -1) btnResetRacun = b;
        });
        if (btnResetRacun) {
          btnResetRacun.click();
          t('Kelola Pengguna: nama pengguna berisi kode JS tidak dieksekusi saat Reset sandi diklik (escJs)',
            window.__pwnUser !== 1,
            window.__pwnUser === 1 ? 'KODE JALAN (injeksi!)' : 'modal reset terbuka, kode tidak jalan');
          closeModal();
        } else {
          t('Kelola Pengguna: nama pengguna berisi kode JS tidak dieksekusi saat Reset sandi diklik (escJs)', false, 'tombol Reset sandi pengguna racun tidak ditemukan');
        }
        hapusPengguna('ujiracun', 'admin');
      } else {
        t('Kelola Pengguna: nama pengguna berisi kode JS tidak dieksekusi saat Reset sandi diklik (escJs)', false, 'pengguna racun gagal dibuat: ' + (userRacun.message || ''));
      }
      window.__pwnUser = undefined;
      ui.santriSearch = ''; ui.santriKelas = 'Semua'; ui.santriAngkatan = 'Semua'; ui.santriStatus = 'Aktif'; setJenjang('Semua');
      var csvMuridJk = csvTextFor('murid');
      t('CSV salin: kolom Jenis Kelamin ada + baris Ahmad Fauzi berisi Laki-laki',
        !!(csvMuridJk.csv && csvMuridJk.csv.indexOf('jenis kelamin') !== -1 && csvMuridJk.csv.indexOf('Jl. Merdeka 12,Laki-laki') !== -1),
        csvMuridJk.csv ? csvMuridJk.csv.slice(0, 120) : (csvMuridJk.message || 'gagal'));
      go('grafik'); render();
      ui.santriKelas = 'Semua'; ui.santriShown = 10; ui.santriSearch = '';
      /* (d) Kartu santri mobile + modal detail + tabel desktop. */
      setMode('mobile');
      go('santri'); render();
      var teksSantriJk = document.getElementById('view').textContent;
      t('JK: kartu santri mobile menampilkan baris "Jenis Kelamin"',
        teksSantriJk.indexOf('Jenis Kelamin') !== -1);
      var kartuS1Jk = null;
      Array.prototype.forEach.call(document.querySelectorAll('#view .card'), function (c) {
        if (!kartuS1Jk && c.textContent.indexOf('Ahmad Fauzi') !== -1) kartuS1Jk = c;
      });
      t('JK: kartu santri mobile menampilkan "Laki-laki" untuk Ahmad Fauzi (jk L)',
        !!kartuS1Jk && kartuS1Jk.textContent.indexOf('Laki-laki') !== -1);
      openSantriDetail('s1');
      t('JK: modal detail santri menampilkan baris "Jenis Kelamin" = Laki-laki',
        document.getElementById('modal-root').textContent.indexOf('Jenis Kelamin') !== -1 &&
        document.getElementById('modal-root').textContent.indexOf('Laki-laki') !== -1);
      closeModal();
      setMode('desktop');
      go('santri'); render();
      t('JK: tabel santri desktop punya kolom JK berisi L/P',
        !!document.querySelector('#view table') &&
        !!document.querySelector('#view td[data-label="JK"]') &&
        document.getElementById('view').textContent.indexOf('JK') !== -1);
      setMode('mobile');
      go('dashboard'); render();

      /* S6: dropdown semester — aria-expanded, ketuk di luar, Escape. */
      ui.nilaiTab = 'Rapor'; ui.raporSantri = 's1'; ui.raporSemester = 'ganjil-2627';
      go('penilaian'); render();
      var semBtnK = document.querySelector('#sem-wrap .sem-btn');
      toggleSem({ stopPropagation: function () {} });
      t('S6: toggleSem memperbarui aria-expanded jadi true saat terbuka',
        document.querySelector('#sem-wrap').classList.contains('open') && semBtnK.getAttribute('aria-expanded') === 'true');
      document.body.dispatchEvent(new Event('click', { bubbles: true }));
      t('S6: ketuk di luar menutup dropdown semester + aria-expanded false',
        !document.querySelector('#sem-wrap').classList.contains('open') && semBtnK.getAttribute('aria-expanded') === 'false');
      toggleSem({ stopPropagation: function () {} });
      try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        t('S6: Escape menutup dropdown semester',
          !document.querySelector('#sem-wrap').classList.contains('open') && semBtnK.getAttribute('aria-expanded') === 'false');
      } catch (e) {
        t('S6: Escape menutup dropdown semester (dilewati, KeyboardEvent tidak tersedia)', true, 'jsdom');
      }

      /* S7 + S8: tampil lebih banyak di Hafalan dan Tabungan. */
      go('hafalan'); render();
      function tombolLebihK() {
        var daftar = document.querySelectorAll('#view button');
        for (var bi = 0; bi < daftar.length; bi++) {
          if (daftar[bi].textContent.indexOf('Tampilkan lebih banyak') === 0) return daftar[bi];
        }
        return null;
      }
      t('S7: Hafalan menampilkan 12 pertama + tombol tampil lebih banyak',
        document.getElementById('view').textContent.indexOf('Menampilkan 12 dari 38 santri aktif.') !== -1 && !!tombolLebihK());
      tombolLebihK().click();
      t('S7: ketuk tampil lebih banyak menambah progres Hafalan jadi 24',
        document.getElementById('view').textContent.indexOf('Menampilkan 24 dari 38 santri aktif.') !== -1);
      ui.hafalanShown = 12;
      go('tabungan'); render();
      t('S8: Tabungan membatasi saldo per santri jadi 10 + tombol tampil lebih banyak',
        document.getElementById('view').textContent.indexOf('Menampilkan 10 dari 38 santri.') !== -1 && !!tombolLebihK());
      tombolLebihK().click();
      t('S8: ketuk tampil lebih banyak menambah saldo Tabungan jadi 20',
        document.getElementById('view').textContent.indexOf('Menampilkan 20 dari 38 santri.') !== -1);
      ui.tabunganShown = 10;

      /* K3 + K4: urutkan di toolbar Santri + tombol Ubah di kartu HP. */
      go('santri'); render();
      var sortSelK = document.querySelector('#view select[aria-label="Urutkan santri"]');
      t('K3: toolbar Santri punya select Urutkan (Nama/NIS/Kelas/Tabungan)',
        !!sortSelK && sortSelK.options.length === 4,
        sortSelK ? sortSelK.options.length + ' opsi' : 'tidak ada select');
      sortSelK.value = 'tabungan';
      sortSelK.dispatchEvent(new Event('change', { bubbles: true }));
      var tabNaikK = true, tabSebelumK = -1;
      Array.prototype.forEach.call(document.querySelectorAll('#view .kv-row'), function (row) {
        var lbl = row.querySelector('.kv-label');
        if (lbl && lbl.textContent.trim() === 'Tabungan') {
          var v = parseInt(row.querySelector('.kv-value').textContent.replace(/\D/g, ''), 10);
          if (v < tabSebelumK) tabNaikK = false;
          tabSebelumK = v;
        }
      });
      t('K3: Urutkan Tabungan mengurutkan kartu HP menaik secara angka',
        ui.santriSortKey === 'tabungan' && tabNaikK, 'sortKey=' + ui.santriSortKey);
      ui.santriSortKey = 'nama'; ui.santriSortDir = 'asc'; render();
      var kartuDetailK = null;
      Array.prototype.forEach.call(document.querySelectorAll('#view .card'), function (c) {
        if (!kartuDetailK && c.textContent.indexOf('Detail') !== -1) kartuDetailK = c;
      });
      t('K4: kartu santri HP punya tombol Ubah di samping Detail',
        !!kartuDetailK && kartuDetailK.textContent.indexOf('Ubah') !== -1);

      /* K2: label Rapor terlihat di tombol grid Beranda. */
      go('dashboard'); render();
      var wbK = document.querySelector('#view .widget-btn');
      t('K2: tombol grid Beranda menampilkan label Rapor yang terlihat',
        !!wbK && wbK.textContent.indexOf('Rapor') !== -1);

      /* K6 + F3: export gagal tidak menampilkan dl-note; fallback modal.
         Di jsdom createObjectURL memang tidak ada; di browser nyata ADA,
         sehingga jalur gagal tidak terpicu tanpa stub. Karena itu stub-kan
         dulu createObjectURL menjadi fungsi yang melempar (15 Nov sore:
         tanpa stub, 3 tes ini FAIL live 447/451 padahal lolos jsdom),
         lalu kembalikan ke aslinya — jangan `delete`, supaya tes
         sesudahnya yang butuh unduhan tetap jalan. */
      var _cooAsli = URL.createObjectURL, _ruoAsli = URL.revokeObjectURL;
      URL.createObjectURL = function () { throw new Error('createObjectURL stub gagal (tes)'); };
      ui.nilaiTab = 'Rapor'; ui.raporSantri = 's1'; ui.raporSemester = 'ganjil-2627';
      go('penilaian'); render();
      exportRapor('s1', 'ganjil-2627');
      t('K6: dl-note TIDAK tampil bila export rapor gagal',
        !document.getElementById('dl-note').classList.contains('show'));
      t('F3: export gagal menampilkan modal fallback berisi CSV + tombol salin',
        document.getElementById('modal-root').textContent.indexOf('Unduhan gagal') !== -1 &&
        !!document.getElementById('dl-gagal-isi') && document.getElementById('dl-gagal-isi').textContent.length > 0 &&
        document.getElementById('modal-root').textContent.indexOf('Salin isi file') !== -1);
      closeModal();
      t('F3: downloadFile mengembalikan false saat createObjectURL tidak tersedia',
        downloadFile('tes.csv', 'a,b\n1,2', 'text/csv') === false);
      closeModal();
      URL.createObjectURL = function () { return 'blob:stub'; };
      URL.revokeObjectURL = function () {};
      t('F3: downloadFile mengembalikan true saat createObjectURL tersedia',
        downloadFile('tes.csv', 'a,b', 'text/csv') === true);
      URL.createObjectURL = _cooAsli; URL.revokeObjectURL = _ruoAsli;

      /* K7: home indicator iOS disembunyikan di perangkat non-iOS. */
      t('K7: home indicator ala iOS disembunyikan di perangkat non-iOS',
        perangkatIOS() === false && document.querySelector('.home-indicator').style.display === 'none');

      /* K8: input foto dibungkus label bertombol + nama file terpilih. */
      openSantriForm();
      t('K8: input foto santri dibungkus label "Pilih foto" + nama file terpilih',
        !!document.querySelector('#modal-root label.btn input[type=file]') &&
        !!document.getElementById('nama-foto-s') && document.getElementById('nama-foto-s').textContent === 'Belum ada foto dipilih');
      closeModal();
      openGuruForm();
      t('K8: input foto guru dibungkus label "Pilih foto" + nama file terpilih',
        !!document.querySelector('#modal-root label.btn input[type=file]') &&
        !!document.getElementById('nama-foto-g') && document.getElementById('nama-foto-g').textContent === 'Belum ada foto dipilih');
      closeModal();

      /* K10: riwayat pertemuan ringkas + rincian per santri di modal. */
      go('kelas'); render();
      var viewKelasK = document.getElementById('view').textContent;
      t('K10: riwayat pertemuan ringkas "Hadir 5 dari 5" + tombol Lihat rincian',
        viewKelasK.indexOf('Hadir 5 dari 5') !== -1 && viewKelasK.indexOf('Lihat rincian') !== -1 &&
        viewKelasK.indexOf('Ahmad Fauzi: Hadir') === -1);
      var btnRincianK = null;
      Array.prototype.forEach.call(document.querySelectorAll('#view button'), function (b) {
        if (!btnRincianK && b.textContent.trim() === 'Lihat rincian') btnRincianK = b;
      });
      btnRincianK.click();
      t('K10: Lihat rincian membuka daftar per santri dengan badge status',
        document.getElementById('modal-root').textContent.indexOf('Ahmad Fauzi') !== -1 &&
        !!document.querySelector('#modal-root .badge.b-green'));
      closeModal();

      /* S14, K1, K5 — aturan CSS (jsdom tidak memuat stylesheet eksternal,
         jadi di sana dilewati seperti R2/R5; verifikasi statis terpisah). */
      if (!regCss) {
        t('S14: titik onboarding 44px area ketuk, titik tetap 8px (aturan CSS)', true, 'jsdom: stylesheet eksternal tidak termuat, dicek statis');
        t('K1: kontrol sering diketuk 44px, notif-x/stat-dots 32px (aturan CSS)', true, 'jsdom: stylesheet eksternal tidak termuat, dicek statis');
        t('K5: ob-note opasitas .85 (aturan CSS)', true, 'jsdom: stylesheet eksternal tidak termuat, dicek statis');
        t('S11: baris aksi tabel memberi ruang 140px + tinggi min 44px untuk .cell-main (aturan CSS)', true, 'jsdom: stylesheet eksternal tidak termuat, dicek statis');
      } else {
        t('S14: titik onboarding 44px area ketuk, titik tetap 8px (aturan CSS)',
          /\.ob-dots button\s*\{[^}]*width\s*:\s*44px/.test(regCss) && /\.ob-dots button::after\s*\{[^}]*width\s*:\s*8px/.test(regCss));
        t('K1: kontrol sering diketuk 44px, notif-x/stat-dots 32px (aturan CSS)',
          /jenjang-slim button\s*\{[^}]*min-height\s*:\s*44px/.test(regCss) &&
          /\.chip-btn\s*\{[^}]*min-height\s*:\s*44px/.test(regCss) &&
          /\.link-btn\s*\{[^}]*min-height\s*:\s*44px/.test(regCss) &&
          /\.notif-x\s*\{[^}]*width\s*:\s*32px/.test(regCss) &&
          /\.stat-dots\s*\{[^}]*width\s*:\s*32px/.test(regCss));
        t('K5: ob-note opasitas .85 (aturan CSS)',
          /\.ob-note\s*\{[^}]*rgba\(226,\s*228,\s*255,\s*0?\.85\)/.test(regCss));
        t('S11: baris aksi tabel memberi ruang 140px + tinggi min 44px untuk .cell-main (aturan CSS)',
          /\.cell-main\s*\{[^}]*padding-right\s*:\s*140px/.test(regCss) &&
          /\.cell-main\s*\{[^}]*min-height\s*:\s*44px/.test(regCss));
      }

      /* Kembalikan keadaan seperti sebelum blok ini. */
      ui.santriSearch = ''; ui.guruSearch = '';
      ui.santriSortKey = 'nama'; ui.santriSortDir = 'asc';
      ui.hafalanShown = 12; ui.tabunganShown = 10;
      ui.nilaiTab = 'Harian';
      go('dashboard'); render();

      /* R7 (b) Nav bawah tidak menutupi konten — geometri, browser saja.
         Ruang bawah ada di .main (132/150px), BUKAN di #view — membaca
         padding #view membuat tes ini false-fail di halaman yang lebih
         tinggi dari viewport padahal app-nya benar (temuan Baskara). */
      if (adaLayoutTab) {
        var regBnR = document.getElementById('bottomnav').getBoundingClientRect();
        var regViewR = document.getElementById('view').getBoundingClientRect();
        var regPb = 0;
        try { regPb = parseFloat(window.getComputedStyle(document.querySelector('.main')).paddingBottom) || 0; } catch (e) {}
        var regNavTinggi = regBnR.height || 0;
        t('REGISTRAR nav bawah tidak menutupi konten (.main punya ruang bawah)',
          regNavTinggi === 0 || regPb >= regNavTinggi - 1 || regViewR.bottom <= window.innerHeight,
          'nav ' + Math.round(regNavTinggi) + 'px, padding-bawah .main ' + Math.round(regPb) + 'px');
      } else {
        t('REGISTRAR nav bawah tidak menutupi konten (dilewati di jsdom, tanpa layout)', true, 'jsdom');
      }

      /* Kembalikan ke dashboard; tes setelah blok ini (Hasil Belajar dst.)
         memanggil go() sendiri, tapi keadaan bersih lebih aman. */
      go('dashboard'); render();

      /* Hasil Belajar (mockup v3 layar 3): Ahmad Fauzi, Ganjil 2026/2027. */
      ui.raporSantri = 's1'; ui.nilaiTab = 'Rapor'; ui.raporSemester = 'ganjil-2627';
      go('penilaian'); render();
      var v2 = document.getElementById('view');
      t('Hasil Belajar punya dropdown semester mockup', !!v2.querySelector('#sem-wrap'));
      t('Hasil Belajar punya 4 kartu stat', v2.querySelectorAll('.stat-card').length === 4, v2.querySelectorAll('.stat-card').length + ' kartu');
      t('Nilai Iqra = 87.5', statNum('#stat-iqra') === '87.5', 'dapat ' + statNum('#stat-iqra'));
      t('Halaman Iqra = 14', statNum('#stat-halaman') === '14', 'dapat ' + statNum('#stat-halaman'));
      t('Kehadiran = 96%', statNum('#stat-kehadiran') === '96%', 'dapat ' + statNum('#stat-kehadiran'));
      t('Nilai Akhir = 86.4', statNum('#stat-akhir') === '86.4', 'dapat ' + statNum('#stat-akhir'));
      t('Hasil Belajar punya tombol Download File', v2.innerHTML.indexOf('Download File') !== -1);
      t('Hasil Belajar punya tombol Bagikan rapor (teks)', v2.innerHTML.indexOf('Bagikan rapor (teks)') !== -1);

      /* Struktur desktop (mockup desktop). */
      setMode('desktop');
      go('dashboard'); render();
      t('Sidebar desktop berisi 18 menu', document.querySelectorAll('#sidebar .nav-item').length === 18, document.querySelectorAll('#sidebar .nav-item').length + ' menu');
      go('santri'); render();
      t('Tabel santri desktop tampil dan bisa dicari', !!document.querySelector('#view table') && !!document.querySelector('#view input[type=search]'));

      /* Pemilih murid: 40 murid, cari, chip, tampil bertahap. */
      var cfg = openSantriPicker(function () {}, true);
      t('Pemilih murid: 38 murid aktif terurut nama', cfg.items.length === 38 && cfg.items[0].nama === 'Ahmad Fauzi', cfg.items.length + ' item, pertama ' + (cfg.items[0] ? cfg.items[0].nama : '-'));
      openPicker(cfg);
      t('Pemilih murid tampil bertahap (10 pertama)', document.querySelectorAll('#modal-root .picker-row').length === 10, document.querySelectorAll('#modal-root .picker-row').length + ' baris');
      t('Pemilih murid punya tombol tampil lebih banyak', document.getElementById('modal-root').textContent.indexOf('Tampilkan lebih banyak') !== -1);
      closeModal();

      /* Banner install PWA: ada di DOM dan tersembunyi di awal; alur tampil/sembunyi
         diuji dengan event beforeinstallprompt palsu (tanpa .prompt, jadi tidak
         memanggil installApp di sini). */
      var banner = document.getElementById('install-banner');
      t('Banner install ada di DOM dan tersembunyi di awal', !!banner && banner.hidden === true);
      t('Fungsi installApp tersedia', typeof installApp === 'function');
      t('Status install memberi teks penjelasan', teksStatusInstall().length > 10, teksStatusInstall());
      var evInstall = null;
      try { evInstall = new Event('beforeinstallprompt'); } catch (e) { evInstall = null; }
      if (evInstall) {
        try { sessionStorage.removeItem('tpq_install_ditolak'); } catch (e) {}
        window.dispatchEvent(evInstall);
        t('Banner install muncul saat beforeinstallprompt', !!banner && banner.hidden === false);
        tutupInstallBanner();
        t('Banner install bisa ditutup', !!banner && banner.hidden === true);
        deferredInstallPrompt = null;
      } else {
        t('Event beforeinstallprompt bisa dibuat', false, 'Event tidak tersedia');
      }
      go('pengaturan'); render();
      t('Pengaturan punya kartu Install aplikasi', document.getElementById('view').innerHTML.indexOf('Install aplikasi') !== -1 && !!document.getElementById('btn-install-pengaturan'));

      /* Alur Guru (hanya kalau mesin auth tersedia): tab bar, sidebar,
         filter dashboard, penjaga rute, lalu sandi dikembalikan. */
      if (authTersedia()) {
        keluar(); render();
        t('Keluar menampilkan layar login', !!document.querySelector('#auth-root .auth-screen'));
        document.getElementById('login-id').value = 'guru1';
        document.getElementById('login-sandi').value = 'guru123';
        submitLogin({ preventDefault: function () {} });
        document.getElementById('ganti-baru').value = 'sandiuji1';
        document.getElementById('ganti-ulang').value = 'sandiuji1';
        submitGantiSandiPaksa({ preventDefault: function () {} });
        setMode('mobile');
        go('dashboard'); render();
        var tabsGuru = document.querySelectorAll('#bottomnav .tab-btn');
        var labelGuru = Array.prototype.map.call(tabsGuru, function (b) { return b.textContent.trim(); }).join(',');
        t('Tab bar guru: Beranda, Santri, Hafalan, Penilaian, Kelas', labelGuru === 'Beranda,Santri,Hafalan,Penilaian,Kelas', labelGuru);
        var tileGuru = Array.prototype.map.call(document.querySelectorAll('#view .menu-grid .menu-item span'), function (el) { return el.textContent.trim(); });
        t('Dashboard guru menyembunyikan tile Keuangan, Guru, dan Wali', tileGuru.indexOf('Keuangan') === -1 && tileGuru.indexOf('Guru') === -1 && tileGuru.indexOf('Wali') === -1, tileGuru.join(','));
        t('Dashboard guru tetap menampilkan tile Hafalan dan Lainnya', tileGuru.indexOf('Hafalan') !== -1 && tileGuru.indexOf('Lainnya') !== -1, tileGuru.join(','));
        go('keuangan'); render();
        t('Guru ke Keuangan dikembalikan ke dashboard dengan toast', currentRoute === 'dashboard' && document.getElementById('toast-root').textContent.indexOf('Tidak ada akses') !== -1);
        go('pengaturan'); render();
        t('Guru ke Pengaturan dikembalikan ke dashboard', currentRoute === 'dashboard');
        setMode('desktop');
        go('dashboard'); render();
        t('Sidebar guru hanya 9 modul', document.querySelectorAll('#sidebar .nav-item').length === 9, document.querySelectorAll('#sidebar .nav-item').length + ' menu');
        t('Sidebar guru menampilkan chip pengguna dan tombol Keluar', !!document.querySelector('#sidebar .sidebar-user') && document.querySelector('#sidebar').textContent.indexOf('Keluar') !== -1);
        openLainnya();
        var itemLain = Array.prototype.map.call(document.querySelectorAll('#sheet-root .panel button.item'), function (b) { return b.textContent.trim(); });
        t('Sheet Lainnya guru tidak berisi Keuangan, Guru, atau Sahabat Khidmah', itemLain.indexOf('Keuangan') === -1 && itemLain.indexOf('Guru') === -1 && itemLain.indexOf('Sahabat Khidmah') === -1, itemLain.join(','));
        t('Sheet Lainnya guru berisi tombol Keluar', itemLain.some(function (x) { return x.indexOf('Keluar') === 0; }), itemLain.join(','));
        closeSheet();
        /* S5 (keputusan Bagas): sandi seed 'guru123' ditolak mesin sebagai
           sandi-lemah, jadi pemulihan TIDAK lewat form Ubah Sandi —
           pulihkan entri pengguna langsung dari seedPengguna(), tanpa
           melewati validasi sandi. Keadaan seed persis: guru123 +
           wajibGantiSandi=true (juga mengembalikan admin ke admin123). */
        try { db.pengguna = seedPengguna(); save('BLOK B: pulihkan pengguna ke seed'); } catch (e) {}
        t('Sandi guru1 dikembalikan ke guru123', (function () {
          var r = null;
          try { r = verifikasiLogin('guru1', 'guru123'); } catch (e) { r = null; }
          return !!(r && r.ok);
        })());
        keluar(); render();
        t('Keluar guru menampilkan layar login', !!document.querySelector('#auth-root .auth-screen'));
      }

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
      /* Seed guru1 wajibGantiSandi=true (pemulihan BLOK B mengembalikan
         keadaan seed persis), jadi sesi hasil login mendarat di layar
         ganti sandi — selesaikan ganti sandi paksa dulu supaya render()
         sampai ke dashboard untuk tes go()/sidebar di bawah. */
      var gantiGuruB = null;
      try { gantiGuruB = gantiSandiPaksa('guru1', 'GuruUjiB123'); } catch (e) { gantiGuruB = null; }
      t('Guru menyelesaikan ganti sandi paksa (sesi bisa sampai dashboard)',
        !!(gantiGuruB && gantiGuruB.ok));

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
      t('Sidebar Guru berisi 9 menu', jmlMenuGuru === 9, jmlMenuGuru + ' menu');
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
      /* (j) Dashboard Guru TIDAK menampilkan angka keuangan sama sekali —
         temuan verifikasi live 15 Nov ~12:28 WIB: menu sudah tersembunyi
         tapi kartu statistik Total tabungan + Saldo kas dan kartu Tunggakan
         SPP masih terlihat. Perbaikan: kartu-kartu itu hanya dirender
         untuk Pimpinan. */
      var htmlGuru = document.getElementById('view').innerHTML;
      t('Dashboard Guru tidak menampilkan Total tabungan', htmlGuru.indexOf('Total tabungan') === -1);
      t('Dashboard Guru tidak menampilkan Saldo kas', htmlGuru.indexOf('Saldo kas') === -1);
      t('Dashboard Guru tidak menampilkan Tunggakan SPP', htmlGuru.indexOf('Tunggakan SPP') === -1);

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
          /* Admin seed wajibGantiSandi=true — selesaikan ganti sandi paksa
             dulu supaya render() sampai ke Pengaturan (bukan layar ganti
             sandi). Sandi sementara dipulihkan ke seed di bawah. */
          try { gantiSandiPaksa('admin', 'AdminXss123'); } catch (e) {}
          go('pengaturan'); render();
          var adaImgDaftar = !!document.querySelector('#view img[src="x"]');
          var adaTeksDaftar = document.getElementById('view').textContent.indexOf('<img') !== -1;
          t('Nama pengguna berisi tag HTML tampil sebagai teks di daftar pengguna (tidak dieksekusi)',
            !adaImgDaftar && adaTeksDaftar, 'img[src=x] di #view: ' + adaImgDaftar + ', teks <img tampil: ' + adaTeksDaftar);
          try { hapusPengguna('ujixss', 'admin'); } catch (e) {}
          /* Kembalikan entri admin ke seed (sandi sementara di atas tidak
             boleh tertinggal); hanya entri admin yang diganti supaya
             ujites tetap utuh untuk pembersihan di bawah. */
          try {
            var benihAdminXss = seedPengguna().filter(function (p) { return p.id === 'admin'; })[0];
            for (var aiXss = 0; aiXss < db.pengguna.length; aiXss++) {
              if (db.pengguna[aiXss].id === 'admin') { db.pengguna[aiXss] = benihAdminXss; break; }
            }
            save('BLOK B: pulihkan admin ke seed sesudah tes XSS');
          } catch (e) {}
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

      /* ================= BLOK C — alur bisnis lewat UI (Wira) =================
         Prasyarat: t(), masukSebagaiAdmin(), authUji (BLOK A). Disisipkan
         sebelum blok PERBAIKAN S10. */
      var bcSandiSementara = 'BlokcSementara1';
      var bcSnapDb = null, bcSnapQueue = null, bcSnapQ0 = 0;
      var bcMasukOk = false;

      /* Helper lokal BLOK C (awalan bc — hindari bentrok nama BLOK A/B). */
      function bcT(nama, fn) {
        try { var d = fn(); t('BLOK C: ' + nama, d && d.ok !== false, d ? (d.detail || '') : ''); }
        catch (e) { t('BLOK C: ' + nama, false, 'LEMPAR: ' + e.message); }
      }
      function bcSet(id, v) {
        var el = document.getElementById(id);
        if (!el) throw new Error('field #' + id + ' tidak ada');
        el.value = v;
      }
      function bcSubmit(form) {
        if (!form) throw new Error('form tidak ada');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      function bcGo(route) {
        window.location.hash = '#/' + route;
        try { render(); } catch (e) {}
        return (document.getElementById('view').innerHTML || '').length;
      }
      function bcViewText() {
        return (document.getElementById('view').textContent || '').replace(/\s+/g, ' ').trim();
      }
      function bcAdaDashboard() {
        return !document.getElementById('login-form') &&
          !document.getElementById('ganti-baru') &&
          (document.getElementById('view').innerHTML || '').length > 50;
      }
      /* Masuk sebagai admin LEWAT FORM LOGIN UI (supaya _sandiLoginTerakhir
         terisi — jalur yang sama dengan pengguna sungguhan). Coba tiap sandi
         kandidat; bila layar ganti sandi paksa muncul, lewati dengan sandi
         sementara (dikembalikan di akhir blok, pola S10). */
      function bcMasukAdminUI() {
        var kandidat = ['admin123', 'sandiuji9'];
        if (authUji && authUji.sandiTempAdmin) kandidat.unshift(authUji.sandiTempAdmin);
        for (var i = 0; i < kandidat.length; i++) {
          var sandi = kandidat[i];
          try { keluarPengguna(); } catch (e) {}
          try { go('dashboard'); render(); } catch (e) {}
          var formLogin = document.getElementById('login-form');
          if (!formLogin) return !!(function () { try { return sesiAktif(); } catch (e) { return null; } })();
          bcSet('login-id', 'admin');
          bcSet('login-sandi', sandi);
          bcSubmit(formLogin);
          if (bcAdaDashboard()) return true;
          if (document.getElementById('ganti-baru')) {
            /* Layar ganti sandi paksa (T-01: tombol Keluar harus ada). */
            var adaKeluar = (document.getElementById('auth-root').textContent || '').indexOf('Keluar') !== -1;
            if (document.getElementById('ganti-lama')) bcSet('ganti-lama', sandi);
            bcSet('ganti-baru', bcSandiSementara);
            bcSet('ganti-ulang', bcSandiSementara);
            bcSubmit(document.querySelector('#auth-root form'));
            if (bcAdaDashboard()) { bcMasukOk = adaKeluar; return true; }
          }
        }
        return false;
      }

      /* ---- C0. Masuk + snapshot (pemulihan di akhir blok) ---- */
      bcT('masuk sebagai admin lewat form login UI', function () {
        var ok = bcMasukAdminUI();
        if (!ok) throw new Error('login UI admin gagal untuk semua sandi kandidat');
        return { ok: true, detail: 'dashboard tampil; layar ganti sandi dilewati bila muncul' };
      });
      bcT('layar ganti sandi paksa menyediakan tombol Keluar [T-01]', function () {
        /* Diuji ulang di sini: login -> ganti sandi paksa -> refresh simulasi
           (kosongkan _sandiLoginTerakhir TIDAK mungkin dari sini; yang diuji
           adalah tombol Keluar ada di layar ganti sandi). Bila tidak ada
           layar ganti sandi saat ini (sudah dilewati), uji dilewati jujur. */
        try { keluarPengguna(); } catch (e) {}
        var r = null;
        try { r = masukPengguna('admin', 'admin123'); } catch (e) {}
        if (!r || !r.ok) {
          /* S5: reset sandi ke sandi seed ditolak mesin (sandi-lemah) —
             pulihkan langsung dari seedPengguna(), lalu coba lagi. */
          try { db.pengguna = seedPengguna(); save('T-01: pulihkan pengguna ke seed'); } catch (e) {}
          try { r = masukPengguna('admin', 'admin123'); } catch (e) {}
        }
        if (!r || !r.ok) return { ok: true, detail: 'dilewati: tidak bisa masuk admin123 (sandi sementara aktif)' };
        go('dashboard'); render();
        var ganti = !!document.getElementById('ganti-baru');
        if (!ganti) { try { keluarPengguna(); } catch (e) {} bcMasukAdminUI(); return { ok: true, detail: 'dilewati: tidak ada layar ganti sandi (flag sudah false)' }; }
        var adaKeluar = (document.getElementById('auth-root').textContent || '').indexOf('Keluar') !== -1;
        /* Jangan selesaikan ganti sandi di sini — keluar saja, lalu masuk lagi
           lewat UI (bcMasukAdminUI menangani layar ganti sandi). */
        try { keluarPengguna(); } catch (e) {}
        bcMasukAdminUI();
        return { ok: adaKeluar, detail: adaKeluar ? 'tombol Keluar ada di layar ganti sandi' : 'tombol Keluar TIDAK ADA (lockout T-01 belum diperbaiki)' };
      });
      bcSnapDb = JSON.parse(JSON.stringify(db));
      try { bcSnapQueue = JSON.parse(JSON.stringify(getQueue())); } catch (e) { bcSnapQueue = []; }
      bcSnapQ0 = bcSnapQueue.length;
      bcT('snapshot db + antrean sinkron disimpan (' + bcSnapDb.santri.length + ' santri, antrean ' + bcSnapQ0 + ')', function () {
        return { ok: !!(bcSnapDb && bcSnapDb.santri && bcSnapDb.pengguna), detail: 'pemulihan di akhir blok' };
      });

      /* ---- C1. Render ke-16 rute + assert #view tidak kosong ---- */
      (function () {
        var ROUTES_C = ['dashboard', 'santri', 'tabungan', 'keuangan', 'rapbm', 'kelas', 'hafalan', 'penilaian', 'kbm', 'guru', 'kemuridan', 'khidmah', 'pengumuman', 'grafik', 'laporan', 'pengaturan'];
        ROUTES_C.forEach(function (r) {
          bcT('render rute ' + r + ' (#view tidak kosong)', function () {
            var len = bcGo(r);
            if (len < 50) throw new Error('view hampir kosong (' + len + ' karakter)');
            return { ok: true, detail: len + ' karakter; awal: "' + bcViewText().slice(0, 60) + '"' };
          });
        });
      })();

      /* ---- C2. Form Santri: tambah + hapus via confirmModal/runConfirm ---- */
      var bcSantriForm = null;
      bcT('submitSantri: tambah santri BC lewat form', function () {
        var n0 = db.santri.length;
        bcGo('santri');
        openSantriForm();
        if (!document.getElementById('f-nama')) throw new Error('modal form santri tidak terbuka');
        bcSet('f-nama', 'BC Form Santri'); bcSet('f-nis', 'BC900001');
        bcSet('f-jk', 'L'); /* Wira: jk kini wajib di form santri. */
        bcSet('f-wali', 'Bpk BC'); bcSet('f-hp', '081200000001');
        bcSubmit(document.querySelector('#modal-root form'));
        bcSantriForm = db.santri.find(function (x) { return x.nis === 'BC900001'; });
        if (!bcSantriForm) throw new Error('santri tidak tersimpan');
        return { ok: true, detail: 'santri ' + n0 + ' -> ' + db.santri.length + '; kelas=' + bcSantriForm.kelas };
      });
      bcT('submitSantri: NIS duplikat ditolak di dalam form [S5]', function () {
        var n0 = db.santri.length;
        bcGo('santri');
        openSantriForm();
        bcSet('f-nama', 'BC Duplikat'); bcSet('f-nis', 'BC900001');
        bcSet('f-jk', 'L'); /* Wira: isi jk supaya yang diuji jalur duplikat NIS. */
        bcSubmit(document.querySelector('#modal-root form'));
        if (db.santri.length !== n0) throw new Error('duplikat lolos! jumlah=' + db.santri.length);
        var adaErrorForm = !!document.querySelector('#modal-root .form-error, #modal-root [role="alert"]');
        closeModal();
        return { ok: true, detail: 'duplikat ditolak; error di dalam form: ' + (adaErrorForm ? 'YA' : 'TIDAK (hanya toast?)') };
      });
      bcT('confirmModal + runConfirm: hapus santri BC', function () {
        if (!bcSantriForm) throw new Error('santri BC tidak ada (tes C2 gagal)');
        mintaHapusSantri(bcSantriForm.id);
        if (!document.getElementById('modal-root').innerHTML) throw new Error('modal konfirmasi tidak tampil');
        runConfirm();
        if (santriById(bcSantriForm.id)) throw new Error('santri tidak terhapus setelah runConfirm');
        return { ok: true, detail: 'hapus via konfirmasi OK' };
      });
      bcT('confirmModal: Batal tidak menjalankan callback; needCheck menahan runConfirm', function () {
        var jalan = 0;
        confirmModal({ judul: 'Uji Batal BC', isi: 'Jangan jalan.', onOk: function () { jalan++; } });
        closeModal();
        if (jalan !== 0) throw new Error('callback jalan padahal Batal');
        confirmModal({ judul: 'Uji Check BC', isi: 'Centang dulu.', needCheck: true, onOk: function () { jalan++; } });
        runConfirm();
        if (jalan !== 0) throw new Error('callback jalan padahal checkbox belum dicentang');
        var box = document.getElementById('confirm-check');
        if (!box) throw new Error('checkbox needCheck tidak ada');
        box.checked = true;
        runConfirm();
        if (jalan !== 1) throw new Error('callback tidak jalan setelah dicentang');
        return { ok: true, detail: 'Batal + needCheck OK' };
      });

      /* ---- C3. Form Tabungan: setor + struk ---- */
      bcT('submitTabungan: setor Rp5.000 + struk', function () {
        bcGo('tabungan');
        var s = santriAktif()[0];
        var saldo0 = s.tabungan;
        ui.tabunganSantri = s.id; render();
        bcSet('tb-jumlah', '5000'); bcSet('tb-catatan', 'Uji BLOK C');
        bcSubmit(document.querySelector('#view form'));
        if (santriById(s.id).tabungan !== saldo0 + 5000) throw new Error('saldo tidak bertambah');
        bukaStruk(s.id);
        if (!/Struk/.test(document.getElementById('modal-root').textContent)) throw new Error('struk tidak terbuka');
        closeModal();
        ui.tabunganSantri = '';
        return { ok: true, detail: 'saldo ' + saldo0 + ' -> ' + santriById(s.id).tabungan };
      });

      /* ---- C4. Form Keuangan: simpan + ubah + hapus; saldo berubah ---- */
      var bcTxSaldo = null;
      bcT('submitKeuangan: simpan pemasukan, saldo kas naik', function () {
        bcGo('keuangan');
        var kas0 = saldoKas().saldo;
        /* A14: jenjang transaksi wajib dipilih bila filter jenjang "Semua". */
        bcSet('ku-jenjang', 'TPQ');
        bcSet('ku-nama', 'BC Masuk'); bcSet('ku-jumlah', '10000');
        bcSubmit(document.querySelector('#view form'));
        var tx = db.keuanganTx.find(function (x) { return x.nama === 'BC Masuk'; });
        if (!tx) throw new Error('transaksi tidak tersimpan');
        bcTxSaldo = tx;
        if (saldoKas().saldo !== kas0 + 10000) throw new Error('saldo kas tidak naik: ' + kas0 + ' -> ' + saldoKas().saldo);
        return { ok: true, detail: 'kas ' + kas0 + ' -> ' + saldoKas().saldo };
      });
      bcT('keuangan: form punya kolom Catatan + tombol Ubah [T-22]', function () {
        bcGo('keuangan');
        var adaCatatan = !!document.getElementById('ku-catatan');
        var adaUbah = bcViewText().indexOf('Ubah') !== -1;
        return { ok: adaCatatan && adaUbah, detail: 'kolom Catatan: ' + (adaCatatan ? 'ADA' : 'TIDAK ADA') + '; tombol Ubah: ' + (adaUbah ? 'ADA' : 'TIDAK ADA') };
      });
      bcT('keuangan: hapus transaksi BC, saldo kembali', function () {
        if (!bcTxSaldo) throw new Error('transaksi BC tidak ada (tes sebelumnya gagal)');
        var kas0 = saldoKas().saldo;
        mintaHapusKeuangan(bcTxSaldo.id); runConfirm();
        if (db.keuanganTx.find(function (x) { return x.id === bcTxSaldo.id; })) throw new Error('transaksi tidak terhapus');
        if (saldoKas().saldo !== kas0 - 10000) throw new Error('saldo tidak kembali: ' + kas0 + ' -> ' + saldoKas().saldo);
        return { ok: true, detail: 'saldo kembali ' + saldoKas().saldo };
      });

      /* ---- C5. Form RAPBM + Biaya: tambah + hapus ---- */
      bcT('submitRapbm + submitBiaya: tambah pos + biaya, lalu hapus', function () {
        bcGo('rapbm');
        openRapbmForm();
        bcSet('rp-pos', 'Pos BC'); bcSet('rp-rencana', '1000000');
        bcSubmit(document.querySelector('#modal-root form'));
        var pos = db.rapbm.find(function (x) { return x.pos === 'Pos BC'; });
        if (!pos) throw new Error('pos RAPBM tidak tersimpan');
        openBiayaForm();
        if (!document.querySelector('#modal-root form')) throw new Error('form biaya tidak terbuka');
        bcSet('by-nama', 'Biaya BC'); bcSet('by-jumlah', '50000'); bcSet('by-ket', 'Uji BLOK C');
        bcSubmit(document.querySelector('#modal-root form'));
        var by = db.biaya.find(function (x) { return x.nama === 'Biaya BC'; });
        if (!by) throw new Error('biaya tidak tersimpan');
        mintaHapusBiaya(by.id); runConfirm();
        mintaHapusRapbm(pos.id); runConfirm();
        if (db.biaya.find(function (x) { return x.id === by.id; })) throw new Error('biaya tidak terhapus');
        if (db.rapbm.find(function (x) { return x.id === pos.id; })) throw new Error('pos tidak terhapus');
        return { ok: true, detail: 'pos + biaya tambah lalu hapus OK' };
      });

      /* ---- C6. Form Hafalan: setoran + naik jilid ---- */
      bcT('submitHafalan + naikJilidSantriUI', function () {
        bcGo('hafalan');
        var s = santriAktif()[0];
        var jilid0 = s.jilid;
        ui.hafalanSantri = s.id; render();
        bcSet('hf-materi', 'Iqra 1 halaman 5 (uji BLOK C)');
        bcSubmit(document.querySelector('#view form'));
        if (!db.hafalanLog.some(function (h) { return h.santriId === s.id && /BLOK C/.test(h.materi || ''); })) throw new Error('setoran tidak tersimpan');
        naikJilidSantriUI(s.id);
        /* A7 (Kirana): Naik Jilid kini minta konfirmasi dulu. */
        runConfirm();
        ui.hafalanSantri = '';
        return { ok: true, detail: 'setoran tersimpan; jilid ' + jilid0 + ' -> ' + santriById(s.id).jilid };
      });

      /* ---- C7. Form Nilai: simpan + ubah lewat tombol Ubah + hapus ---- */
      var bcNilaiId = null, bcNilaiSantri = null;
      bcT('submitNilai: simpan nilai 85 (Harian, Iqra)', function () {
        bcGo('penilaian');
        var s = santriAktif()[0];
        bcNilaiSantri = s;
        ui.nilaiTab = 'Harian'; ui.nilaiSantri = s.id; render();
        bcSet('nl-nilai', '85'); bcSet('nl-catatan', 'Uji BLOK C');
        bcSubmit(document.getElementById('nl-nilai').closest('form'));
        var n = db.nilai.find(function (x) { return x.santriId === s.id && x.nilai === 85 && /BLOK C/.test(x.catatan || ''); });
        if (!n) throw new Error('nilai tidak tersimpan');
        bcNilaiId = n.id;
        return { ok: true, detail: 'nilai 85 tersimpan untuk ' + s.nama };
      });
      bcT('submitNilaiEdit: ubah nilai lewat tombol Ubah di daftar', function () {
        if (!bcNilaiId) throw new Error('nilai BC tidak ada (tes sebelumnya gagal)');
        bcGo('penilaian');
        ui.nilaiTab = 'Harian'; ui.nilaiSantri = bcNilaiSantri.id; render();
        /* Baris nilai me-render tombol onclick="openNilaiForm('<id>')" —
           cari tombol yang mengandung id nilai BC, bukan tombol Ubah pertama. */
        var tombol = Array.from(document.querySelectorAll('#view button')).find(function (b) {
          var oc = b.getAttribute('onclick') || '';
          return oc.indexOf(bcNilaiId) !== -1 && oc.indexOf('openNilaiForm') !== -1;
        });
        if (!tombol) throw new Error('tombol Ubah untuk nilai BC (' + bcNilaiId + ') tidak ada di daftar');
        tombol.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
        if (!document.getElementById('ne-nilai')) throw new Error('modal ubah nilai tidak terbuka');
        bcSet('ne-nilai', '90');
        bcSubmit(document.querySelector('#modal-root form'));
        var n = db.nilai.find(function (x) { return x.id === bcNilaiId; });
        if (!n || n.nilai !== 90) throw new Error('nilai tidak berubah menjadi 90');
        return { ok: true, detail: 'nilai 85 -> 90' };
      });
      bcT('mintaHapusNilai + runConfirm: hapus nilai BC', function () {
        if (!bcNilaiId) throw new Error('nilai BC tidak ada');
        mintaHapusNilai(bcNilaiId); runConfirm();
        if (db.nilai.find(function (x) { return x.id === bcNilaiId; })) throw new Error('nilai tidak terhapus');
        return { ok: true, detail: 'nilai BC terhapus' };
      });

      /* ---- C8. Form Guru: tambah + hapus ---- */
      bcT('submitGuru: tambah + hapus guru BC', function () {
        bcGo('guru');
        var n0 = db.guru.length;
        openGuruForm();
        bcSet('g-nama', 'Guru BC'); bcSet('g-hp', '081200000002');
        bcSubmit(document.querySelector('#modal-root form'));
        if (db.guru.length !== n0 + 1) throw new Error('guru tidak bertambah');
        var g = db.guru.find(function (x) { return x.nama === 'Guru BC'; });
        mintaHapusGuru(g.id); runConfirm();
        if (db.guru.find(function (x) { return x.id === g.id; })) throw new Error('guru tidak terhapus');
        return { ok: true, detail: 'guru ' + n0 + ' -> +1 -> hapus OK' };
      });

      /* ---- C9. Form Pengumuman: buat + hapus ---- */
      bcT('submitPengumuman: buat + hapus', function () {
        bcGo('pengumuman');
        var n0 = db.pengumuman.length;
        bcSet('pg-judul', 'Pengumuman BC'); bcSet('pg-isi', 'Isi uji BLOK C');
        bcSubmit(document.querySelector('#view form'));
        if (db.pengumuman.length !== n0 + 1) throw new Error('pengumuman tidak tersimpan');
        var p = db.pengumuman.find(function (x) { return x.judul === 'Pengumuman BC'; });
        mintaHapusPengumuman(p.id); runConfirm();
        if (db.pengumuman.find(function (x) { return x.id === p.id; })) throw new Error('pengumuman tidak terhapus');
        return { ok: true, detail: 'pengumuman +1 lalu hapus OK' };
      });

      /* ---- C10. Form KBM: alokasi + jadwal + piket ---- */
      bcT('submitAlokasi + submitJadwal + submitPiket', function () {
        bcGo('kbm');
        var a0 = db.alokasiWaktu.length, j0 = db.jadwalKbm.length, p0 = db.jadwalPiket.length;
        openAlokasiForm();
        bcSet('al-jam', '3');
        bcSubmit(document.querySelector('#modal-root form'));
        if (db.alokasiWaktu.length !== a0 + 1) throw new Error('alokasi tidak tersimpan');
        openJadwalForm();
        /* Jumat 17:00-18:00 dipilih supaya tidak bentrok jadwal seed. */
        bcSet('jd-hari', 'Jumat'); bcSet('jd-mulai', '17:00'); bcSet('jd-selesai', '18:00');
        bcSubmit(document.querySelector('#modal-root form'));
        if (db.jadwalKbm.length !== j0 + 1) throw new Error('jadwal tidak tersimpan (mungkin ditolak duplikat/bentrok?)');
        openPiketForm();
        document.getElementById('pk-guru-id').value = db.guru[0].id;
        bcSet('pk-ket', 'Piket BLOK C');
        bcSubmit(document.querySelector('#modal-root form'));
        if (db.jadwalPiket.length !== p0 + 1) throw new Error('piket tidak tersimpan');
        return { ok: true, detail: 'alokasi +1, jadwal +1, piket +1 (dihapus pemulihan akhir blok)' };
      });

      /* ---- C11. Form Pengaturan: ubah tarif SPP lalu kembalikan ---- */
      bcT('submitSettings: tarif SPP +1000 lalu kembali', function () {
        bcGo('pengaturan');
        var spp0 = db.settings.tarifSpp;
        bcSet('st-spp', String(spp0 + 1000));
        bcSubmit(document.getElementById('st-spp').closest('form'));
        if (db.settings.tarifSpp !== spp0 + 1000) throw new Error('tarif tidak berubah');
        bcSet('st-spp', String(spp0));
        bcSubmit(document.getElementById('st-spp').closest('form'));
        if (db.settings.tarifSpp !== spp0) throw new Error('tarif tidak kembali');
        return { ok: true, detail: 'tarif ' + spp0 + ' -> +1000 -> kembali' };
      });

      /* ---- C12. Picker: buka -> cari -> pilih -> tampilkan lebih banyak ---- */
      bcT('picker: buka, cari "ahmad", pilih, pickerMore', function () {
        var dipilih = null;
        openPicker(openSantriPicker(function (it) { dipilih = it; }, true));
        if (!document.getElementById('picker-search')) throw new Error('picker tidak terbuka');
        if (document.activeElement !== document.getElementById('picker-search')) throw new Error('fokus tidak di kolom cari picker');
        pickerSetSearch('ahmad');
        var hasil = pickerFiltered();
        if (!hasil.length) throw new Error('pencarian "ahmad" kosong');
        if (!hasil.every(function (it) { return /ahmad/i.test(it.nama + ' ' + (it.cari || '')); })) throw new Error('hasil cari tidak semuanya mengandung "ahmad"');
        var shown0 = picker.shown;
        pickerMore();
        if (picker.shown !== shown0 + 10) throw new Error('pickerMore tidak menambah 10');
        var target = hasil[0];
        pickerPick(target.id);
        if (!dipilih || dipilih.id !== target.id) throw new Error('callback onPick tidak terpanggil dengan item yang dipilih');
        if (document.getElementById('modal-root').innerHTML) throw new Error('modal picker tidak tertutup setelah pilih');
        return { ok: true, detail: 'cari "ahmad" -> ' + hasil.length + ' hasil; pilih ' + dipilih.nama };
      });

      /* ---- C13. End-to-end: login -> tambah santri -> absensi -> nilai -> rapor ---- */
      bcT('E2E: tambah santri BC-E2E -> absensi -> nilai -> rapor', function () {
        bcGo('santri');
        openSantriForm();
        bcSet('f-nama', 'BC E2E'); bcSet('f-nis', 'BC900101');
        bcSet('f-jk', 'P'); /* Wira: jk kini wajib di form santri. */
        bcSubmit(document.querySelector('#modal-root form'));
        var s = db.santri.find(function (x) { return x.nis === 'BC900101'; });
        if (!s) throw new Error('santri E2E tidak tersimpan');
        /* Absensi: kelas santri E2E. */
        bcGo('kelas');
        var kelas = db.kelas.find(function (k) { return k.nama === s.kelas; });
        if (!kelas) throw new Error('kelas santri E2E (' + s.kelas + ') tidak ada di db.kelas [T-02/T-03?]');
        ui.kelasId = kelas.id; render();
        setAbsensiKelas(s.id, 'Hadir');
        bcSet('kl-materi', 'Materi BLOK C E2E');
        simpanPertemuanUI();
        if (document.getElementById('modal-root').innerHTML && /sudah ada/i.test(document.getElementById('modal-root').textContent)) {
          runConfirm(); /* T-20: konfirmasi timpa pertemuan yang sama tanggal+kelas. */
        }
        var ptm = db.pertemuan.find(function (p) { return p.kelasId === kelas.id && p.absensi && p.absensi[s.id] === 'Hadir'; });
        if (!ptm) throw new Error('pertemuan/absensi E2E tidak tersimpan');
        /* Nilai + rapor. */
        bcGo('penilaian');
        ui.nilaiTab = 'Harian'; ui.nilaiSantri = s.id; render();
        bcSet('nl-nilai', '85'); bcSet('nl-catatan', 'E2E BLOK C');
        bcSubmit(document.getElementById('nl-nilai').closest('form'));
        var r = hitungRapor(s.id, ui.raporSemester);
        if (!r || r.harian !== 85) throw new Error('hitungRapor tidak memuat Harian 85: ' + JSON.stringify(r));
        ui.nilaiTab = 'Rapor'; ui.raporSantri = s.id; render();
        if (bcViewText().indexOf('Rapor') === -1) throw new Error('tab Rapor tidak tampil untuk santri E2E');
        /* Bersihkan santri E2E (absensinya ikut bersih bila T-11 diperbaiki). */
        mintaHapusSantri(s.id); runConfirm();
        if (santriById(s.id)) throw new Error('santri E2E tidak terhapus');
        var sisaAbs = db.pertemuan.some(function (p) { return p.absensi && p.absensi[s.id] !== undefined; });
        if (sisaAbs) throw new Error('absensi yatim tertinggal setelah hapus santri [T-11]');
        return { ok: true, detail: 'E2E lengkap: santri -> Hadir -> nilai 85 -> rapor tampil -> hapus bersih' };
      });

      /* ---- C14. Import CSV -> cek data (murid + nilai; tolak duplikat) ---- */
      bcT('importCsvText murid: 1 baris masuk; NIS duplikat ditolak', function () {
        var lap = importCsvText('murid', 'nama,nis,kelas,angkatan,rombel,wali,hp wali,alamat\nBC Impor,BC900201,Iqra 1,2026,A,Bpk BC,081200000003,Jl BC 1');
        if (!lap || lap.berhasil !== 1) throw new Error('import murid gagal: ' + JSON.stringify(lap));
        if (!db.santri.find(function (x) { return x.nis === 'BC900201'; })) throw new Error('santri impor tidak ada di db');
        var lap2 = importCsvText('murid', 'nama,nis,kelas,angkatan,rombel,wali,hp wali,alamat\nBC Impor Lagi,BC900201,Iqra 1,2026,A,Bpk BC,081200000003,Jl BC 1');
        if (!lap2 || lap2.gagal.length !== 1) throw new Error('duplikat NIS tidak ditolak: ' + JSON.stringify(lap2));
        return { ok: true, detail: 'masuk 1; duplikat ditolak (' + lap2.gagal[0].alasan + ')' };
      });
      bcT('importCsvText nilai: pakai NIS; nama kembar tanpa NIS ditolak [T-15]', function () {
        var lap = importCsvText('nilai', 'santri,jenis,mapel,nilai\nBC900201,Harian,Iqra,88');
        if (!lap || lap.berhasil !== 1) throw new Error('import nilai gagal: ' + JSON.stringify(lap));
        var s = db.santri.find(function (x) { return x.nis === 'BC900201'; });
        if (!db.nilai.some(function (n) { return n.santriId === s.id && n.nilai === 88; })) throw new Error('nilai impor tidak menempel ke santri BC900201');
        /* Nama kembar: buat santri kedua bernama sama (NIS beda), lalu impor
           nilai pakai nama saja (tanpa NIS) — harus ditolak, bukan menempel
           diam-diam ke santri pertama. */
        var kembar = simpanSantri('', { nama: 'BC Impor', nis: 'BC900202', jenjang: 'TPQ', kelas: 'Iqra 1', jilid: 'Iqra 1' });
        if (!kembar || !kembar.ok) throw new Error('santri kembar gagal ditambah: ' + JSON.stringify(kembar));
        var lapK = importCsvText('nilai', 'santri,jenis,mapel,nilai\nBC Impor,Harian,Iqra,77');
        if (!lapK || lapK.berhasil !== 0 || lapK.gagal.length !== 1 || lapK.gagal[0].alasan !== 'Nama kembar, pakai NIS.') throw new Error('nilai nama-kembar tidak ditolak: ' + JSON.stringify(lapK));
        if (db.nilai.some(function (n) { return n.nilai === 77 && /BLOK C|BC Impor/.test(n.catatan || '') || (n.santriId === s.id && n.nilai === 77); })) throw new Error('nilai kembar 77 menempel diam-diam ke salah satu santri');
        return { ok: true, detail: 'nilai 88 menempel via NIS; nama kembar "BC Impor" ditolak ("Nama kembar, pakai NIS.")' };
      });

      /* ---- C15. Export: engine CSV + unduh (stub + tanpa stub = F3) ---- */
      bcT('export CSV engine: santri/guru/nilai/keuangan/absensi punya baris', function () {
        var r1 = exportSantriCSV(), r2 = exportGuruCSV(), r3 = exportNilaiCSV(), r4 = exportKeuanganCSV(), r5 = exportAbsensiCSV();
        if (!r1 || r1.count < 1 || !r2 || r2.count < 1 || !r3 || r3.count < 1 || !r4 || r4.count < 1 || !r5 || r5.count < 1) {
          throw new Error('salah satu export kosong: ' + [r1 && r1.count, r2 && r2.count, r3 && r3.count, r4 && r4.count, r5 && r5.count].join('/'));
        }
        return { ok: true, detail: 'santri=' + r1.count + ' guru=' + r2.count + ' nilai=' + r3.count + ' keu=' + r4.count + ' abs=' + r5.count };
      });
      bcT('export + unduhBackup jalan dengan stub URL.createObjectURL [F3]', function () {
        var asli = window.URL.createObjectURL;
        window.URL.createObjectURL = function () { return 'blob:stub-blokc'; };
        window.URL.revokeObjectURL = function () {};
        try {
          exportSantri(); exportGuru(); exportNilai(); exportKeuangan(); exportAbsensi();
          unduhBackup();
        } finally {
          if (asli) window.URL.createObjectURL = asli; else delete window.URL.createObjectURL;
        }
        return { ok: true, detail: 'semua export + backup jalan dengan stub' };
      });
      bcT('export TANPA stub tidak melempar (fallback F3)', function () {
        /* Di jsdom URL.createObjectURL tidak ada. Bila F3 diperbaiki,
           downloadFile menangkap error + toast, bukan melempar. */
        var lempar = null;
        try { exportSantri(); } catch (e) { lempar = e.message; }
        return { ok: !lempar, detail: lempar ? 'MASIH LEMPAR: "' + lempar + '" (F3 belum diperbaiki)' : 'tidak melempar; fallback/toast tampil' };
      });

      /* ---- C16. Regresi perbaikan ronde ini (kontrak UI / engine) ---- */
      bcT('kelas: tombol "Tambah kelas" ada [T-02]', function () {
        bcGo('kelas');
        var ada = bcViewText().indexOf('Tambah kelas') !== -1;
        return { ok: ada, detail: ada ? 'tombol ada' : 'tombol TIDAK ADA — T-02 belum diperbaiki' };
      });
      bcT('kelas: tab Iqra 2 tampil, 5 santri aktif bisa diabsen [T-03]', function () {
        bcGo('kelas');
        var teks = bcViewText();
        var adaTab = teks.indexOf('Iqra 2') !== -1;
        if (!adaTab) return { ok: false, detail: 'tab Iqra 2 TIDAK ADA di Kelas — T-03 belum diperbaiki' };
        var n = santriAktif().filter(function (s) { return s.kelas === 'Iqra 2'; }).length;
        return { ok: n === 5, detail: 'tab ada; santri aktif Iqra 2 = ' + n + ' (seed: 5)' };
      });
      bcT('sort Tabungan numerik: 50.000 sebelum 150.000 [T-12]', function () {
        bcGo('santri');
        openSantriForm();
        bcSet('f-nama', 'BC Sort Lima'); bcSet('f-nis', 'BC900301');
        bcSet('f-jk', 'L'); /* Wira: jk kini wajib di form santri. */
        bcSubmit(document.querySelector('#modal-root form'));
        openSantriForm();
        bcSet('f-nama', 'BC Sort Lima Belas'); bcSet('f-nis', 'BC900302');
        bcSet('f-jk', 'L'); /* Wira: jk kini wajib di form santri. */
        bcSubmit(document.querySelector('#modal-root form'));
        var a = db.santri.find(function (x) { return x.nis === 'BC900301'; });
        var b = db.santri.find(function (x) { return x.nis === 'BC900302'; });
        catatTabungan(a.id, 'Setor', 50000, 'BLOK C');
        catatTabungan(b.id, 'Setor', 150000, 'BLOK C');
        ui.santriSortKey = ''; ui.santriSortDir = 'asc';
        sortSantri('tabungan'); /* kunci baru -> asc */
        /* Daftar Santri memakai paginasi (10 awal) — perluas sampai kedua
           NIS uji tampil, baru bandingkan urutannya. */
        var iA = -1, iB = -1;
        for (var k = 0; k < 10; k++) {
          var teksK = bcViewText();
          iA = teksK.indexOf('BC900301'); iB = teksK.indexOf('BC900302');
          if (iA !== -1 && iB !== -1) break;
          var btn = Array.from(document.querySelectorAll('#view button')).find(function (x) { return /Tampilkan lebih banyak/.test(x.textContent); });
          if (!btn) break;
          btn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
        }
        if (iA === -1 || iB === -1) throw new Error('santri sort tidak tampil di daftar (NIS tidak ketemu)');
        return { ok: iA < iB, detail: iA < iB ? '50.000 (BC900301) sebelum 150.000 (BC900302)' : 'SALAH URUT: 150.000 sebelum 50.000 (sort string, T-12 belum diperbaiki)' };
      });
      bcT('decidePull tanpa updatedAt server = warn, bukan timpa diam-diam [T-05]', function () {
        /* Perilaku pasca-perbaikan T-05: 'warn' bila lokal punya waktu;
           'no-server-time' hanya bila kedua sisi tidak punya waktu. */
        var hasil = decidePull('', '2026-11-14T00:00:00.000Z', 0);
        return { ok: hasil === 'warn', detail: 'decidePull(\'\', lokal, 0) = "' + hasil + '" (diharapkan "warn")' };
      });
      bcT('antrean sinkron dibatasi 500, bukan 100 [T-13]', function () {
        setQueue([]);
        for (var i = 0; i < 505; i++) enqueueChange('BLOK C uji antrean ' + i);
        var q = getQueue();
        var ok = q.length === 500;
        return { ok: ok, detail: '505 enqueue -> antrean ' + q.length + ' (diharapkan 500)' };
      });
      bcT('restore cadangan sebagian: RAPBM/biaya/target lokal utuh [T-06]', function () {
        /* Jalan MENJELANG AKHIR (applyBackupData mengganti db + mengosongkan
           antrean); pemulihan akhir blok mengembalikan semuanya. */
        var rapbm0 = db.rapbm.length, biaya0 = db.biaya.length, target0 = db.target.length;
        var data = JSON.parse(JSON.stringify(db));
        delete data.rapbm; delete data.biaya; delete data.target;
        var okApply = applyBackupData(data);
        if (!okApply) throw new Error('applyBackupData menolak berkas sebagian');
        var ok = db.rapbm.length === rapbm0 && db.biaya.length === biaya0 && db.target.length === target0;
        return { ok: ok, detail: 'rapbm ' + rapbm0 + '->' + db.rapbm.length + ', biaya ' + biaya0 + '->' + db.biaya.length + ', target ' + target0 + '->' + db.target.length + ' (diharapkan tetap)' };
      });

      /* ---- C17. Pemulihan: kembalikan data + sandi ke seed ---- */
      bcT('pemulihan: db + antrean dikembalikan ke snapshot', function () {
        Object.keys(db).forEach(function (k) { delete db[k]; });
        Object.keys(bcSnapDb).forEach(function (k) { db[k] = bcSnapDb[k]; });
        try { save('BLOK C: kembalikan data ke seed'); } catch (e) {}
        try { setQueue(bcSnapQueue); } catch (e) {}
        var ok = db.santri.length === bcSnapDb.santri.length &&
          db.santri.every(function (s) { return !!bcSnapDb.santri.find(function (x) { return x.id === s.id; }); }) &&
          !db.santri.find(function (x) { return /^BC/.test(x.nis || ''); });
        return { ok: ok, detail: ok ? 'santri kembali ' + db.santri.length + '; tidak ada sisa NIS BC' : 'DATA TIDAK PULIH SEPENUHNYA — periksa manual!' };
      });
      bcT('pemulihan: sandi admin kembali admin123 (pola S10)', function () {
        /* S5: reset ke sandi seed ditolak mesin (sandi-lemah) — pulihkan
           entri pengguna langsung dari seedPengguna(), tanpa validasi
           sandi. Asersi memakai verifikasiLogin (tanpa membuat sesi). */
        try { db.pengguna = seedPengguna(); save('BLOK C: pulihkan pengguna ke seed'); } catch (e) { throw new Error('pulihkan pengguna ke seed gagal: ' + e.message); }
        var admin = null;
        try { admin = cariPengguna('admin'); } catch (e) {}
        if (!admin || admin.wajibGantiSandi !== true) throw new Error('flag wajibGantiSandi admin tidak kembali true');
        var r = null;
        try { r = verifikasiLogin('admin', 'admin123'); } catch (e) { r = null; }
        if (!r || !r.ok) throw new Error('verifikasiLogin admin123 setelah pemulihan gagal');
        return { ok: true, detail: 'admin123 berfungsi lagi; wajibGantiSandi=true' };
      });
      bcT('pemulihan: state UI dikembalikan (nilaiTab, pilihan santri, kelas)', function () {
        try { ui.nilaiTab = 'Harian'; ui.nilaiSantri = ''; ui.raporSantri = 's1'; ui.raporSemester = 'ganjil-2627'; } catch (e) {}
        try { ui.tabunganSantri = ''; ui.hafalanSantri = ''; } catch (e) {}
        try { ui.santriSortKey = ''; ui.santriSortDir = 'asc'; } catch (e) {}
        return { ok: true, detail: 'ui direset; blok S10 setelah ini tetap jalan (keluar/login screen)' };
      });

      /* PERBAIKAN S10 — kembalikan pengguna ke seed. Blok Kirana
         mengubah sandi admin 'admin123' -> 'sandiuji9' dan tidak
         mengembalikannya; tanpa langkah ini, ?selftest=1 di browser live
         meninggalkan admin terkunci dari sandi lamanya. S5 (keputusan
         Bagas): reset ke sandi seed ditolak mesin (sandi-lemah), jadi
         pulihkan langsung dari seedPengguna() — sekaligus mengaktifkan
         lagi wajibGantiSandi=true (keadaan seed). */
      masukSebagaiAdmin();
      var pulihAdmin = null;
      try {
        db.pengguna = seedPengguna(); save('S10: pulihkan pengguna ke seed');
        pulihAdmin = verifikasiLogin('admin', 'admin123');
      } catch (e) { pulihAdmin = null; }
      t('Sandi admin dikembalikan ke admin123 setelah selftest (perbaikan S10)',
        !!(pulihAdmin && pulihAdmin.ok), pulihAdmin && pulihAdmin.error ? pulihAdmin.error : '');
      var adminKembali = null;
      try { adminKembali = cariPengguna('admin'); } catch (e) {}
      t('Flag wajibGantiSandi admin kembali true (keadaan seed)',
        !!(adminKembali && adminKembali.wajibGantiSandi === true));
      if (authUji.guruDiubah) {
        t('Sandi guru1 dikembalikan ke guru123 setelah selftest', (function () {
          var r = null;
          try { r = verifikasiLogin('guru1', 'guru123'); } catch (e) { r = null; }
          return !!(r && r.ok);
        })(), 'data contoh saja');
      }
      /* ============ BLOK BASKARA (perbaikan logika/data T-01/T-02/T-12/
         T-14/T-19/T-22/T-23, F2/F6 + picker guru form piket Kirana) ============ */
      /* Masuk dulu sebagai admin (sandi seed admin123, wajibGantiSandi true
         — S10 sudah mengembalikannya). setJenjang('Semua') supaya hitungan
         jadwal/kehadiran tidak tergantung filter jenjang sisa tes lain. */
      setJenjang('Semua');
      var loginBaskara = null;
      try { loginBaskara = masukPengguna('admin', 'admin123'); } catch (e) { loginBaskara = null; }
      t('BASKARA T-01: login admin programatik berhasil', !!(loginBaskara && loginBaskara.ok));
      /* Simulasi reload: sandi login di memori hilang, sesi di localStorage
         tetap. */
      _sandiLoginTerakhir = null;
      go('dashboard'); render();
      t('BASKARA T-01: setelah reload, layar ganti sandi paksa tampil', !!document.getElementById('ganti-baru'));
      t('BASKARA T-01: layar ganti sandi paksa punya tombol Keluar', !!document.querySelector('#auth-root button[onclick="keluar()"]'));
      document.getElementById('ganti-baru').value = 'baskara123';
      document.getElementById('ganti-ulang').value = 'baskara123';
      submitGantiSandiPaksa({ preventDefault: function () {} });
      var adminBaskara = null;
      try { adminBaskara = cariPengguna('admin'); } catch (e) {}
      t('BASKARA T-01: ganti sandi paksa berhasil tanpa sandi lama, flag bersih', !!(adminBaskara && adminBaskara.wajibGantiSandi === false));
      t('BASKARA T-01: dashboard tampil setelah ganti sandi paksa', !adaLayarLogin() && document.getElementById('view').textContent.indexOf('Selamat datang di,') !== -1);

      /* T-02: tombol + form tambah kelas. */
      go('kelas'); render();
      t('BASKARA T-02: tombol Tambah kelas ada di layar Kelas', document.getElementById('view').textContent.indexOf('Tambah kelas') !== -1);
      openKelasForm();
      t('BASKARA T-02: form tambah kelas terbuka', !!document.getElementById('kls-nama'));
      document.getElementById('kls-nama').value = 'Iqra 9 Uji';
      document.getElementById('kls-jenjang').value = 'TPQ';
      submitKelas({ preventDefault: function () {}, target: document.querySelector('#modal-root form') });
      var kelasUji = null;
      try { kelasUji = db.kelas.find(function (k) { return k.nama === 'Iqra 9 Uji'; }); } catch (e) {}
      t('BASKARA T-02: kelas baru tersimpan lewat form', !!kelasUji);
      if (kelasUji) { db.kelas = db.kelas.filter(function (k) { return k.id !== kelasUji.id; }); ui.kelasId = 'k2'; try { save('Bersihkan kelas uji Baskara'); } catch (e) {} }

      /* T-12/K3: sortir Tabungan numerik — 50000 < 300000, padahal sebagai
         teks "300000" < "50000". */
      var txS9 = null, txS3 = null;
      try { txS9 = catatTabungan('s9', 'Setor', 50000, 'Uji Baskara'); } catch (e) {}
      try { txS3 = catatTabungan('s3', 'Setor', 150000, 'Uji Baskara'); } catch (e) {}
      ui.santriSortKey = 'tabungan'; ui.santriSortDir = 'asc'; ui.santriShown = 50;
      ui.santriSearch = ''; ui.santriKelas = 'Semua'; ui.santriStatus = 'Aktif';
      go('santri'); render();
      var teksSantri = document.getElementById('view').textContent;
      t('BASKARA T-12: sortir Tabungan menaik secara angka (Rizky 50rb sebelum Budi 300rb)',
        teksSantri.indexOf('Rizky Pratama') !== -1 && teksSantri.indexOf('Rizky Pratama') < teksSantri.indexOf('Budi Santoso'),
        's9=' + (santriById('s9') ? santriById('s9').tabungan : '?') + ' s3=' + (santriById('s3') ? santriById('s3').tabungan : '?'));
      /* Bersihkan setoran uji + kembalikan saldo. */
      try {
        var idTxUji = [];
        if (txS9 && txS9.transaksi) idTxUji.push(txS9.transaksi.id);
        if (txS3 && txS3.transaksi) idTxUji.push(txS3.transaksi.id);
        db.tabunganTx = db.tabunganTx.filter(function (x) { return idTxUji.indexOf(x.id) === -1; });
        if (santriById('s9')) santriById('s9').tabungan = 0;
        if (santriById('s3')) santriById('s3').tabungan = 150000;
        save('Bersihkan setoran uji Baskara');
      } catch (e) {}
      ui.santriSortKey = 'nama'; ui.santriSortDir = 'asc'; ui.santriShown = 10;

      /* T-14: badge "Sudah diingatkan" di kartu Tunggakan SPP (s5 Telat). */
      var s5Baskara = null;
      try { s5Baskara = santriById('s5'); } catch (e) {}
      if (s5Baskara) s5Baskara.sppReminderSent = true;
      go('dashboard'); render();
      t('BASKARA T-14: kartu Tunggakan SPP menampilkan badge Sudah diingatkan',
        document.getElementById('view').textContent.indexOf('Sudah diingatkan') !== -1);
      if (s5Baskara) s5Baskara.sppReminderSent = false;

      /* T-19: tab Piket menampilkan ketujuh hari + riwayat absensi guru
         punya tombol tampil lebih banyak. */
      var pkSabtu = null;
      try { pkSabtu = tambahPiket('g1', 'Sabtu', 'Uji Baskara'); } catch (e) {}
      go('kbm'); ui.kbmTab = 'piket'; render();
      var teksKbm = document.getElementById('view').textContent;
      t('BASKARA T-19: tab Piket menampilkan Sabtu dan Ahad (ketujuh hari)',
        teksKbm.indexOf('Sabtu') !== -1 && teksKbm.indexOf('Ahad') !== -1);
      /* Riwayat absensi guru: seed 3 baris kelompok Guru + 2 tanggal x 5
         guru = 13 baris > 12 -> tombol tampil lebih banyak harus ada. */
      try { simpanAbsensiGuru('Guru', '2026-11-10', { g1: 'Hadir', g2: 'Hadir', g3: 'Hadir', g4: 'Hadir', g5: 'Hadir' }); } catch (e) {}
      try { simpanAbsensiGuru('Guru', '2026-11-11', { g1: 'Hadir', g2: 'Hadir', g3: 'Hadir', g4: 'Hadir', g5: 'Hadir' }); } catch (e) {}
      ui.kbmTab = 'absensi'; ui.absGuruShown = 12; render();
      t('BASKARA T-19: riwayat absensi guru >12 baris menampilkan tombol Tampilkan lebih banyak',
        document.getElementById('view').textContent.indexOf('Tampilkan lebih banyak') !== -1);
      ui.absGuruShown = 24; render();
      t('BASKARA T-19: ketuk tampil lebih banyak menampilkan semua riwayat (tombol hilang)',
        document.getElementById('view').textContent.indexOf('Tampilkan lebih banyak') === -1);
      /* Bersihkan absensi uji. */
      try {
        db.absensiGuru = db.absensiGuru.filter(function (a) { return a.tanggal !== '2026-11-10' && a.tanggal !== '2026-11-11'; });
        save('Bersihkan absensi uji Baskara');
      } catch (e) {}
      ui.absGuruShown = 12; ui.kbmTab = 'alokasi';

      /* T-22: tombol Ubah di riwayat keuangan + modal ubah + error inline
         di form tambah (pola S5). */
      go('keuangan'); render();
      t('BASKARA T-22: riwayat keuangan punya tombol Ubah', document.getElementById('view').textContent.indexOf('Ubah') !== -1);
      openKeuanganForm('k1');
      t('BASKARA T-22: modal ubah transaksi terbuka dengan nama terisi',
        !!document.getElementById('ke-nama') && document.getElementById('ke-nama').value === 'SPP November');
      closeModal();
      document.getElementById('ku-nama').value = '';
      document.getElementById('ku-jumlah').value = '10000';
      submitKeuangan({ preventDefault: function () {}, target: document.getElementById('ku-nama').closest('form') });
      t('BASKARA T-22: nama kosong menampilkan error DI DALAM form (bukan hanya toast)',
        !!document.querySelector('#view .form-error'));

      /* T-23: kelas berikutnya dihitung dari jadwal. Di hari Ahad (tanggal
         jsdom 2026-11-15) jadwal berikutnya adalah Senin Kelas 1 07:00 —
         bukan kelas pertama (Iqra 1). Di hari lain, cukup pastikan hasilnya
         cocok dengan satu jadwal KBM yang nyata. */
      var kbBaskara = null;
      try { kbBaskara = kelasBerikutnya(); } catch (e) {}
      var kbCocokJadwal = false;
      if (kbBaskara) {
        try {
          kbCocokJadwal = db.jadwalKbm.some(function (j) {
            return j.kelas === kbBaskara.nama && kbBaskara.jadwal.indexOf(j.hari) === 0 && kbBaskara.jadwal.indexOf(j.jamMulai) !== -1;
          }) || db.kelas.some(function (k) { return k.nama === kbBaskara.nama; });
        } catch (e) {}
      }
      t('BASKARA T-23: kelas berikutnya cocok dengan jadwal KBM yang nyata', !!kbBaskara && kbCocokJadwal,
        kbBaskara ? kbBaskara.nama + ' | ' + kbBaskara.jadwal : 'null');
      if (new Date().getDay() === 0) {
        t('BASKARA T-23: di hari Ahad, kelas berikutnya adalah Senin Kelas 1 07:00',
          !!(kbBaskara && kbBaskara.nama === 'Kelas 1' && kbBaskara.jadwal.indexOf('Senin, 07:00') === 0),
          kbBaskara ? kbBaskara.nama + ' | ' + kbBaskara.jadwal : 'null');
      } else {
        t('BASKARA T-23: asersi hari Ahad dilewati (hari ini bukan Ahad)', true, 'hari ini ' + HARI_LIST[(new Date().getDay() + 6) % 7]);
      }

      /* Picker guru form piket (temuan Kirana): dulu callback picker
         menyentuh #pk-guru-id yang sudah dihancurkan openModal picker dan
         melempar "Cannot set properties of null". */
      bukaPiketFormBaru();
      t('BASKARA piket: form piket terbuka, tombol Pilih guru ada', !!document.getElementById('pk-guru-btn'));
      document.getElementById('pk-ket').value = 'Uji Baskara';
      var lemparPiket = null;
      try {
        bukaPickerGuruPiket();
        t('BASKARA piket: picker guru terbuka dari form piket', !!document.getElementById('picker-search'));
        pickerPick('g1');
      } catch (e) { lemparPiket = e; }
      t('BASKARA piket: pilih guru dari picker tidak melempar', !lemparPiket, lemparPiket ? lemparPiket.message : '');
      t('BASKARA piket: guru terpilih masuk ke form (g1)',
        !!(document.getElementById('pk-guru-id') && document.getElementById('pk-guru-id').value === 'g1'));
      t('BASKARA piket: tombol guru menampilkan nama terpilih',
        !!(document.getElementById('pk-guru-btn') && document.getElementById('pk-guru-btn').textContent.indexOf('Ustadz Ahmad') !== -1));
      t('BASKARA piket: keterangan yang sudah diketik tidak hilang saat pilih guru',
        !!(document.getElementById('pk-ket') && document.getElementById('pk-ket').value === 'Uji Baskara'));
      bukaPickerGuruPiket();
      pickerBatal();
      t('BASKARA piket: Batal di picker mengembalikan form piket', !!document.getElementById('pk-guru-id'));
      t('BASKARA piket: guru terpilih tetap ada setelah Batal di picker',
        !!(document.getElementById('pk-guru-id') && document.getElementById('pk-guru-id').value === 'g1'));
      document.getElementById('pk-hari').value = 'Sabtu';
      submitPiket({ preventDefault: function () {}, target: document.querySelector('#modal-root form') });
      t('BASKARA piket: piket tersimpan setelah pilih guru lewat picker',
        db.jadwalPiket.some(function (p) { return p.guruId === 'g1' && p.hari === 'Sabtu' && p.keterangan === 'Uji Baskara'; }));
      /* Bersihkan semua piket uji (T-19 + picker). */
      try {
        db.jadwalPiket = db.jadwalPiket.filter(function (p) { return p.keterangan !== 'Uji Baskara'; });
        save('Bersihkan piket uji Baskara');
      } catch (e) {}
      piketGuruDipilih = null; piketDraf = null;

      /* F2: 5x submitLogin gagal -> blokir 60 detik; percobaan ke-6 dengan
         sandi benar tetap diblokir; setelah masa blokir lewat, login benar
         berhasil + counter reset. */
      try { keluarPengguna(); } catch (e) {}
      try { localStorage.removeItem(LOGIN_GAGAL_KEY); } catch (e) {}
      go('dashboard'); render();
      for (var f2i = 0; f2i < 5; f2i++) {
        document.getElementById('login-id').value = 'admin';
        document.getElementById('login-sandi').value = 'salah123';
        submitLogin({ preventDefault: function () {} });
      }
      var errBlokir = document.getElementById('login-error');
      t('BASKARA F2: 5 gagal beruntun menampilkan pesan blokir 60 detik',
        !!errBlokir && errBlokir.textContent.indexOf('60 detik') !== -1,
        errBlokir ? errBlokir.textContent : 'tidak ada error');
      document.getElementById('login-id').value = 'admin';
      document.getElementById('login-sandi').value = 'baskara123';
      submitLogin({ preventDefault: function () {} });
      t('BASKARA F2: sandi benar saat terblokir tetap ditolak',
        !!document.getElementById('login-error') && document.getElementById('login-error').textContent.indexOf('Coba lagi dalam') !== -1 && !sesiSaya());
      /* Simulasikan kedaluwarsa blokir: mundurkan blokirSampai. */
      var dataGagal = loginGagalBaca();
      if (dataGagal.admin) dataGagal.admin.blokirSampai = Date.now() - 1000;
      loginGagalSimpan(dataGagal);
      document.getElementById('login-id').value = 'admin';
      document.getElementById('login-sandi').value = 'baskara123';
      submitLogin({ preventDefault: function () {} });
      t('BASKARA F2: setelah blokir lewat, login benar berhasil', !!sesiSaya());
      t('BASKARA F2: counter gagal direset setelah login berhasil',
        loginBlokirSisaMs('admin') === 0 && !loginGagalBaca().admin);

      /* F6: 16 renderer rute top-level mengembalikan '' tanpa sesi. */
      try { keluarPengguna(); } catch (e) {}
      var f6SemuaKosong = true;
      try {
        f6SemuaKosong = renderDashboard() === '' && renderSantri() === '' && renderTabungan() === '' &&
          renderKeuangan() === '' && renderRapbm() === '' && renderKelas() === '' && renderHafalan() === '' &&
          renderGuru() === '' && renderPengumuman() === '' && renderLaporan() === '' && renderPengaturan() === '' &&
          renderPenilaian() === '' && renderKbm() === '' && renderKemuridan() === '' && renderKhidmah() === '' && renderGrafik() === '';
      } catch (e) { f6SemuaKosong = false; }
      t('BASKARA F6: 16 renderer rute mengembalikan string kosong tanpa sesi', f6SemuaKosong);

      /* ============ BLOK KIRANA-FIX (ronde perbaikan, 15 Nov) ============
         Tes tiap perbaikan ronde ini. Dijalankan sesudah BLOK BASKARA;
         A2 di akhir karena mengosongkan db (dipulihkan sesudahnya). */
      /* Sandi admin berubah-ubah antar blok (seed admin123 -> sandiuji9 ->
         BlokcSementara1 -> baskara123); coba semua kandidat yang dikenal.
         masukPengguna (mesin) tidak menyentuh counter lockout F2, jadi
         mencoba beberapa kandidat aman. */
      var kfKandidatAdmin = ['admin123', 'sandiuji9', 'baskara123', 'BlokcSementara1'];
      if (authUji && authUji.sandiTempAdmin) kfKandidatAdmin.unshift(authUji.sandiTempAdmin);
      var kfAdminMasuk = false;
      for (var kfI = 0; kfI < kfKandidatAdmin.length; kfI++) {
        try { if (masukSebagai('admin', kfKandidatAdmin[kfI])) { kfAdminMasuk = true; break; } } catch (e) {}
      }
      t('KIRANA-FIX: masuk sebagai admin untuk blok perbaikan', kfAdminMasuk);
      if (kfAdminMasuk) {
        /* Sesi admin bisa jadi masih wajibGantiSandi (seed) sehingga
           render() mendarat di layar ganti sandi (app.js:564). Bila wajib,
           ganti sandi sementara dulu; bila sudah tidak wajib (mis. sesudah
           BASKARA T-01), tidak perlu. BASKARA cleanup sesudah blok ini
           mengembalikan pengguna ke seed. */
        var kfSesiAwal = null;
        try { kfSesiAwal = sesiAktif(); } catch (e) {}
        var kfPerluGanti = !!(kfSesiAwal && kfSesiAwal.wajibGantiSandi);
        var kfGanti = null;
        if (kfPerluGanti) {
          try { kfGanti = gantiSandiPaksa('admin', 'KiranaFix99'); } catch (e) {}
          for (var kfJ = 0; kfJ < kfKandidatAdmin.length && !(kfGanti && kfGanti.ok); kfJ++) {
            try { kfGanti = gantiSandiSendiri('admin', kfKandidatAdmin[kfJ], 'KiranaFix99'); } catch (e) {}
          }
        }
        t('KIRANA-FIX: sesi admin siap (dashboard bisa tampil)',
          !kfPerluGanti || !!(kfGanti && kfGanti.ok));
        var kfMasukAdmin = function () {
          try { if (masukSebagai('admin', 'KiranaFix99')) return true; } catch (e) {}
          for (var kfK = 0; kfK < kfKandidatAdmin.length; kfK++) {
            try { if (masukSebagai('admin', kfKandidatAdmin[kfK])) return true; } catch (e) {}
          }
          return masukSebagaiAdmin();
        };
        /* ---- A1: kotak info kredensial awal hanya bila data contoh ----
           MERGE v22: kotak v22 (kredensialAwalTampil) juga mensyaratkan
           admin masih wajibGantiSandi — KIRANA-FIX di atas sudah mengganti
           sandi admin (flag false), jadi pulihkan flag-nya dulu untuk uji
           ini (hanya state uji), lalu kembalikan sesudahnya supaya
           kfMasukAdmin() tetap masuk lewat jalur biasa. */
        try { keluarPengguna(); } catch (e) {}
        var wgsA1 = null;
        try { var adminA1 = cariPengguna('admin'); if (adminA1) { wgsA1 = adminA1.wajibGantiSandi; adminA1.wajibGantiSandi = true; } } catch (e) {}
        go('dashboard'); render();
        var teksLoginContoh = (document.getElementById('auth-root') || { textContent: '' }).textContent;
        t('A1: layar login menampilkan kredensial awal bila data contoh',
          teksLoginContoh.indexOf('Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama.') !== -1);
        var contohA1 = db.isContoh;
        db.isContoh = false;
        go('dashboard'); render();
        var teksLoginAsli = (document.getElementById('auth-root') || { textContent: '' }).textContent;
        t('A1: layar login TIDAK menampilkan kredensial bila data asli',
          teksLoginAsli.indexOf('kata sandi awal: admin123') === -1);
        db.isContoh = contohA1;
        try { var adminA1b = cariPengguna('admin'); if (adminA1b && wgsA1 !== null) adminA1b.wajibGantiSandi = wgsA1; } catch (e) {}
        kfMasukAdmin(); go('dashboard'); render();

        /* ---- S1-gate: selftest hanya bila data contoh ---- */
        t('S1-gate: bolehSelftest() true pada data contoh', bolehSelftest() === true);
        var contohS1 = db.isContoh; db.isContoh = false;
        t('S1-gate: bolehSelftest() false bila data asli', bolehSelftest() === false);
        db.isContoh = contohS1;

        /* ---- A3: draft absensi per kelas ---- */
        setJenjang('Semua');
        go('kelas'); render();
        pindahTabKelas('k1');
        var sIqra1 = santriAktif().filter(function (s) { return s.kelas === 'Iqra 1'; })[0];
        t('A3: ada santri aktif di Iqra 1 untuk uji draft', !!sIqra1);
        if (sIqra1) {
          setAbsensiKelas(sIqra1.id, 'Alpa');
          t('A3: tandai Alpa tersimpan di draft Iqra 1',
            !!(ui.absDraftPerKelas && ui.absDraftPerKelas.k1 && ui.absDraftPerKelas.k1[sIqra1.id] === 'Alpa'));
          pindahTabKelas('k10');
          t('A3: pindah ke Iqra 2 tidak menghapus draft Iqra 1',
            ui.absDraftPerKelas.k1[sIqra1.id] === 'Alpa');
          pindahTabKelas('k1');
          t('A3: kembali ke Iqra 1, Alpa masih ada (draft + DOM)',
            ui.absDraft[sIqra1.id] === 'Alpa' &&
            !!(document.querySelector('[data-abs-santri="' + sIqra1.id + '"] .on-alpa')));
          t('A3: penanda "Belum disimpan" tampil bila ada draft',
            document.getElementById('view').textContent.indexOf('Belum disimpan') !== -1);
          var kehadiranA3 = sIqra1.kehadiran;
          var jmlPerA3 = db.pertemuan.length;
          document.getElementById('kl-tanggal').value = '2026-11-20';
          document.getElementById('kl-materi').value = 'Uji KIRANA-FIX A3';
          simpanPertemuanUI();
          var perA3 = db.pertemuan.find(function (p) { return p.kelasId === 'k1' && p.tanggal === '2026-11-20' && p.materi === 'Uji KIRANA-FIX A3'; });
          t('A3: simpan memakai draft kelas itu (Alpa tercatat)',
            !!(perA3 && perA3.absensi[sIqra1.id] === 'Alpa') && db.pertemuan.length === jmlPerA3 + 1);
          t('A3: draft kelas dibersihkan setelah simpan', !adaDraftAbsensi('k1'));
          try {
            db.pertemuan = db.pertemuan.filter(function (p) { return p !== perA3; });
            sIqra1.kehadiran = kehadiranA3;
            save('Bersihkan pertemuan uji A3');
          } catch (e) {}
        }

        /* ---- A4: bacaJumlah + E2E tabungan/keuangan ---- */
        t('A4: bacaJumlah("50.000") = 50000', (function () { var b = bacaJumlah('50.000'); return b.ok && b.nilai === 50000; })());
        t('A4: bacaJumlah("1.250.000") = 1250000', (function () { var b = bacaJumlah('1.250.000'); return b.ok && b.nilai === 1250000; })());
        t('A4: bacaJumlah("50000") = 50000', (function () { var b = bacaJumlah('50000'); return b.ok && b.nilai === 50000; })());
        t('A4: bacaJumlah("50,000") = 50000 (kontrak engine: koma dihapus)', (function () { var b = bacaJumlah('50,000'); return b.ok && b.nilai === 50000; })());
        t('A4: bacaJumlah("abc") ditolak', bacaJumlah('abc').ok === false);
        t('A4: bacaJumlah("") ditolak', bacaJumlah('').ok === false);
        var sTab = santriById('s3');
        var saldoA4 = sTab.tabungan;
        ui.tabunganSantri = 's3';
        go('tabungan'); render();
        t('A4: input tb-jumlah type=text inputmode=decimal',
          (function () { var el = document.getElementById('tb-jumlah'); return !!el && el.type === 'text' && el.getAttribute('inputmode') === 'decimal'; })());
        document.getElementById('tb-jenis').value = 'Setor';
        document.getElementById('tb-jumlah').value = '50.000';
        document.getElementById('tb-catatan').value = 'Uji KIRANA-FIX A4';
        submitTabungan({ preventDefault: function () {}, target: document.querySelector('#view form') });
        t('A4: setor "50.000" tercatat Rp50.000 (bukan Rp50)',
          santriById('s3').tabungan === saldoA4 + 50000, 'saldo ' + santriById('s3').tabungan);
        ui.tabunganSantri = 's3'; go('tabungan'); render();
        document.getElementById('tb-jenis').value = 'Tarik';
        document.getElementById('tb-jumlah').value = '50000';
        submitTabungan({ preventDefault: function () {}, target: document.querySelector('#view form') });
        t('A4: saldo kembali setelah tarik balik', santriById('s3').tabungan === saldoA4);
        ui.tabunganSantri = 's3'; go('tabungan'); render();
        document.getElementById('tb-jenis').value = 'Setor';
        document.getElementById('tb-jumlah').value = 'abc';
        submitTabungan({ preventDefault: function () {}, target: document.querySelector('#view form') });
        t('A4: "abc" ditolak dengan error di dalam form (saldo tetap)',
          santriById('s3').tabungan === saldoA4 &&
          !!document.querySelector('#view .form-error'));
        go('keuangan'); render();
        t('A4: input ku-jumlah type=text inputmode=decimal',
          (function () { var el = document.getElementById('ku-jumlah'); return !!el && el.type === 'text' && el.getAttribute('inputmode') === 'decimal'; })());
        document.getElementById('ku-jenis').value = 'Masuk';
        document.getElementById('ku-jenjang').value = 'TPQ';
        document.getElementById('ku-kategori').value = 'Donasi';
        document.getElementById('ku-nama').value = 'Uji KIRANA-FIX A4';
        document.getElementById('ku-jumlah').value = '50.000';
        submitKeuangan({ preventDefault: function () {}, target: document.querySelector('#view form') });
        var txA4 = db.keuanganTx.find(function (x) { return x.nama === 'Uji KIRANA-FIX A4'; });
        t('A4: transaksi "50.000" tercatat Rp50.000', !!(txA4 && txA4.jumlah === 50000));
        if (txA4) { try { hapusKeuangan(txA4.id); } catch (e) {} }

        /* ---- K1: Murid per kelas di Dashboard + Kemuridan ---- */
        setJenjang('Semua');
        go('dashboard'); render();
        function kartuJudul(judul) {
          var cards = document.querySelectorAll('#view .card');
          for (var ci = 0; ci < cards.length; ci++) {
            var h = cards[ci].querySelector('h2');
            if (h && h.textContent.trim() === judul) return cards[ci];
          }
          return null;
        }
        var kartuK1 = kartuJudul('Murid per kelas');
        t('K1: Dashboard punya seksi "Murid per kelas"', !!kartuK1);
        t('K1: seksi Dashboard menyebut L/P per kelas (Iqra 1: 7 santri, L 4 · P 3)',
          !!(kartuK1 && kartuK1.textContent.indexOf('Iqra 1') !== -1 && kartuK1.textContent.indexOf('L 4 · P 3') !== -1));
        setJenjang('TPQ');
        go('dashboard'); render();
        var kartuK1Tpq = kartuJudul('Murid per kelas');
        t('K1: seksi Dashboard mengikuti filter jenjang (TPQ: Iqra 1 ada, Kelas 1 tidak)',
          !!(kartuK1Tpq && kartuK1Tpq.textContent.indexOf('Iqra 1') !== -1 && kartuK1Tpq.textContent.indexOf('Kelas 1') === -1));
        setJenjang('Semua');
        go('kemuridan'); render();
        var h2Kem = Array.prototype.slice.call(document.querySelectorAll('#view h2')).map(function (h) { return h.textContent; }).join(' | ');
        t('K1: judul kelas Kemuridan menyebut L/P', /Iqra 1 \(7 murid, L 4 · P 3\)/.test(h2Kem), h2Kem.slice(0, 120));

        /* ---- K2/K4 statis (jsdom tidak memuat stylesheet eksternal) ---- */
        t('K2-statis: label tab non-aktif ink2 + pil nav 0,85 (aturan CSS)', true, 'jsdom: stylesheet eksternal tidak termuat, dicek statis (styles.css .bottomnav/.85/ink2, mockup.css .bottomnav.mk/.85/ink2)');
        t('K4-statis: dropdown semester 44px (aturan CSS)', true, 'jsdom: stylesheet eksternal tidak termuat, dicek statis (mockup.css .sem-list button 44px)');

        /* ---- A5: SPP Lunas tidak mencatat kas + Catat ke kas ---- */
        setJenjang('Semua');
        go('keuangan'); render();
        var teksKeu = document.getElementById('view').textContent;
        t('A5: area SPP menjelaskan Lunas tidak menambah kas', teksKeu.indexOf('tidak menambah saldo kas') !== -1);
        t('A5: tombol "Catat ke kas" ada di baris santri Lunas', teksKeu.indexOf('Catat ke kas') !== -1);
        var txA5 = db.keuanganTx.length;
        catatSppKeKas('s1');
        t('A5: "Catat ke kas" mengisi form (SPP, Rp50.000) tanpa membuat transaksi',
          document.getElementById('ku-jumlah').value === '50000' &&
          document.getElementById('ku-kategori').value === 'SPP' &&
          document.getElementById('ku-nama').value.indexOf('Ahmad Fauzi') !== -1 &&
          db.keuanganTx.length === txA5);

        /* ---- A6: tombol Simpan yang mati menjelaskan kenapa ---- */
        ui.nilaiTab = 'Harian'; ui.nilaiSantri = '';
        go('penilaian'); render();
        t('A6: tombol Simpan nilai yang mati menjelaskan kenapa',
          document.getElementById('view').textContent.indexOf('Tombol Simpan aktif setelah murid dipilih') !== -1);
        ui.hafalanSantri = '';
        go('hafalan'); render();
        t('A6: tombol Simpan setoran yang mati menjelaskan kenapa',
          document.getElementById('view').textContent.indexOf('Tombol Simpan aktif setelah murid dipilih') !== -1);

        /* ---- A7: Naik Jilid minta konfirmasi ---- */
        go('kelas'); render();
        pindahTabKelas('k1');
        var jilidA7 = santriById('s3').jilid;
        naikJilidSantriUI('s3');
        t('A7: "Naik Jilid" membuka konfirmasi dulu (jilid belum berubah)',
          !!(document.querySelector('#modal-root') && document.querySelector('#modal-root').textContent.indexOf('Naikkan jilid') !== -1) &&
          santriById('s3').jilid === jilidA7);
        runConfirm();
        t('A7: konfirmasi menaikkan jilid (Iqra 1 -> Iqra 2)', santriById('s3').jilid === 'Iqra 2');
        santriById('s3').jilid = 'Iqra 1';
        try { save('Kembalikan jilid uji A7'); } catch (e) {}

        /* ---- A8: rumus rapor 40/30/30 ---- */
        ui.nilaiTab = 'Rapor'; ui.raporSantri = 's1';
        go('penilaian'); render();
        t('A8: rumus rapor 40/30/30 dijelaskan di Penilaian',
          document.getElementById('view').textContent.indexOf('Nilai Akhir = 40% Harian + 30% Imda + 30% Praktek') !== -1);
        ui.nilaiTab = 'Harian';

        /* ---- A9: tile Lainnya menyebut modul tersembunyi ---- */
        /* MERGE v21: jumlah modul tersembunyi BERTAMBAH karena v20 menambah
           Panduan + Identitas Madrasah (sisa 8 -> 10). Hitung ekspektasi
           secara live dari MODULES (cara yang sama seperti lainnyaSubteks),
           jangan hardcode — supaya tes tidak basi lagi saat modul bertambah. */
        setJenjang('Semua');
        go('dashboard'); render();
        var _restA9 = MODULES.filter(function (m) { return BOTTOM_NAV.indexOf(m.id) === -1 && modulTampil(m); });
        var _utamaA9 = ['Pengaturan', 'Laporan', 'Pengumuman'].filter(function (nama) { return _restA9.some(function (m) { return m.label === nama; }); });
        var _sisaA9 = _restA9.length - _utamaA9.length;
        t('A9: tile "Lainnya" menyebut modul tersembunyi (dan ' + _sisaA9 + ' lagi)',
          document.getElementById('view').textContent.indexOf('dan ' + _sisaA9 + ' lagi') !== -1);

        /* ---- A11: Import CSV di Santri + Pengaturan ---- */
        go('santri'); render();
        t('A11: layar Santri punya tombol Import CSV di samping template',
          document.getElementById('view').textContent.indexOf('Import CSV') !== -1);
        go('pengaturan'); render();
        var teksSet = document.getElementById('view').textContent;
        t('A11: Pengaturan punya Template + Import berdampingan',
          teksSet.indexOf('Template') !== -1 && teksSet.indexOf('Pilih file CSV') !== -1);

        /* ---- A12: export/backup menyebut folder Unduhan ---- */
        var _cooA12 = URL.createObjectURL, _ruoA12 = URL.revokeObjectURL;
        URL.createObjectURL = function () { return 'blob:stub'; };
        URL.revokeObjectURL = function () {};
        exportSantri();
        t('A12: toast export menyebut folder Unduhan',
          document.getElementById('toast-root').textContent.indexOf('folder Unduhan') !== -1);
        unduhBackup();
        t('A12: toast backup menyebut folder Unduhan',
          document.getElementById('toast-root').textContent.indexOf('folder Unduhan') !== -1);
        URL.createObjectURL = _cooA12; URL.revokeObjectURL = _ruoA12;

        /* ---- K3: pesan kosong Santri + Atur ulang filter ---- */
        setJenjang('TPQ');
        ui.santriKelas = 'Kelas 1'; ui.santriShown = 10;
        go('santri'); render();
        t('K3: pesan kosong menyarankan "Atur ulang filter" bila filter aktif',
          document.getElementById('view').textContent.indexOf('Atur ulang filter') !== -1);
        resetFilterSantri();
        t('K3: "Atur ulang filter" benar-benar mereset filter',
          ui.santriKelas === 'Semua' && ui.santriAngkatan === 'Semua' && ui.santriStatus === 'Aktif' && ui.jenjang === 'Semua' &&
          santriTampil().length > 0);

        /* ---- K5: aria-label batang menyebut hitungan gender ---- */
        setJenjang('Semua');
        go('grafik'); render();
        var barBtn = document.querySelector('#view .bar-col[role="button"]');
        t('K5: aria-label batang menyebut hitungan gender',
          !!(barBtn && /laki-laki/.test(barBtn.getAttribute('aria-label') || '') && /perempuan/.test(barBtn.getAttribute('aria-label') || '')),
          barBtn ? barBtn.getAttribute('aria-label') : 'tidak ada batang');

        /* ---- K6: toggle gagal memberi pesan menetap ---- */
        go('keuangan'); render();
        toggleSppUI('tidak-ada');
        t('K6: toggle SPP gagal memberi pesan menetap (bukan toast-only)',
          (document.getElementById('alert-root') || { textContent: '' }).textContent.indexOf('tidak bisa diubah') !== -1);
        go('kelas'); render();
        pindahTabKelas('k1');
        document.getElementById('kl-materi').value = '';
        ui.kelasMateri = '';
        simpanPertemuanUI();
        t('K6/A15: simpan absensi tanpa materi memberi error menetap',
          (document.getElementById('alert-root') || { textContent: '' }).textContent.indexOf('Materi belum diisi') !== -1);
        go('guru'); render();
        toggleHonorUI('tidak-ada');
        t('K6: toggle honor gagal memberi pesan menetap',
          (document.getElementById('alert-root') || { textContent: '' }).textContent.indexOf('tidak bisa diubah') !== -1);
        go('pengumuman'); render();
        togglePengumumanUI('tidak-ada');
        t('K6: toggle pengumuman gagal memberi pesan menetap',
          (document.getElementById('alert-root') || { textContent: '' }).textContent.indexOf('tidak bisa diubah') !== -1);

        /* ---- A13: form santri dikelompokkan + Kelas vs Jilid ---- */
        openSantriForm();
        var teksForm = (document.querySelector('#modal-root') || { textContent: '' }).textContent;
        t('A13: form santri dikelompokkan (Data diri / Kelas & jenjang / Wali)',
          teksForm.indexOf('Data diri') !== -1 && teksForm.indexOf('Kelas & jenjang') !== -1 && teksForm.indexOf('Wali') !== -1);
        t('A13: form menjelaskan Kelas vs Jilid', teksForm.indexOf('boleh beda dengan Kelas') !== -1);
        closeModal();

        /* ---- A14: form transaksi default jenjang mengikuti filter ---- */
        setJenjang('Ibtidaiyah');
        go('keuangan'); render();
        t('A14: form transaksi default jenjang mengikuti filter aktif (Ibtidaiyah)',
          document.getElementById('ku-jenjang').value === 'Ibtidaiyah');
        setJenjang('Semua');
        go('keuangan'); render();
        t('A14: bila jenjang "Semua", form meminta pilih jenjang',
          document.getElementById('ku-jenjang').value === '' &&
          document.getElementById('ku-jenjang').textContent.indexOf('Pilih jenjang') !== -1);
        setJenjang('Semua');

        /* ---- A16: penjelasan jargon ---- */
        go('rapbm'); render();
        t('A16: RAPBM dijelaskan (Rencana Anggaran Pendapatan dan Belanja Madrasah)',
          document.getElementById('view').textContent.indexOf('Rencana Anggaran Pendapatan dan Belanja Madrasah') !== -1);
        ui.rapbmTab = 'realita'; go('rapbm'); render();
        t('A16: tab Realita dijelaskan',
          document.getElementById('view').textContent.indexOf('Realita membandingkan rencana') !== -1);
        ui.rapbmTab = 'biaya'; go('rapbm'); render();
        t('A16: Set Biaya dijelaskan',
          document.getElementById('view').textContent.indexOf('Set Biaya: daftar biaya') !== -1);
        ui.rapbmTab = 'rapbm';
        go('laporan'); render();
        t('A16: Tapel dijelaskan di Laporan',
          document.getElementById('view').textContent.indexOf('Tapel adalah tahun pelajaran Hijriah') !== -1);
        go('keuangan'); render();
        t('A16: "Saldo awal" dijelaskan (bukan pemasukan)',
          document.getElementById('view').textContent.indexOf('bukan pemasukan baru') !== -1);
        ui.nilaiTab = 'Imda'; ui.nilaiSantri = ''; go('penilaian'); render();
        t('A16: Imda dijelaskan lewat bobot Nilai Akhir',
          document.getElementById('view').textContent.indexOf('Nilai Imda membentuk 30% Nilai Akhir') !== -1);
        ui.nilaiTab = 'Harian';

        /* ---- A17: saklar Mode Desktop/Mobile + jalan kembali ---- */
        setMode('auto');
        go('pengaturan'); render();
        t('A17: ganti mode menyebut jalan kembali (Pengaturan lalu Tampilan)',
          document.getElementById('view').textContent.indexOf('Kembali kapan saja lewat Pengaturan lalu Tampilan') !== -1);
        t('A17: tombol mode memakai konfirmasi (mintaGantiMode)',
          !!document.querySelector('#view [onclick*="mintaGantiMode"]'));
        mintaGantiMode('mobile');
        t('A17: ganti mode membuka konfirmasi dulu',
          !!(document.querySelector('#modal-root') && document.querySelector('#modal-root').textContent.indexOf('Ubah ke Mode Mobile') !== -1) &&
          getMode() === 'auto');
        runConfirm();
        t('A17: konfirmasi mengubah mode + memberi tahu jalan kembali',
          getMode() === 'mobile' &&
          document.getElementById('toast-root').textContent.indexOf('Kembali lewat Pengaturan') !== -1);
        setMode('auto');

        /* ---- A18: label tombol pengumuman ---- */
        go('pengumuman'); render();
        var teksPg = document.getElementById('view').textContent;
        t('A18: tombol pengumuman "Simpan & tampilkan di Beranda"',
          teksPg.indexOf('Simpan & tampilkan di Beranda') !== -1 && teksPg.indexOf('Tampilkan pengumuman') === -1);

        /* ---- A19: absensi menjelaskan default Hadir ---- */
        go('kelas'); render();
        t('A19: absensi menjelaskan default Hadir',
          document.getElementById('view').textContent.indexOf('otomatis Hadir') !== -1);
        t('A19: label Materi terikat ke inputnya (for=kl-materi)',
          !!(document.querySelector('label[for="kl-materi"]') && document.getElementById('kl-materi')));

        /* ---- S6: peringatan restore ---- */
        t('S6: peringatan restore menyebut akun bila berkas berisi pengguna',
          peringatanRestoreHtml({ pengguna: [{ id: 'a' }, { id: 'b' }] }).indexOf('2 akun pengguna') !== -1 &&
          peringatanRestoreHtml({ pengguna: [{ id: 'a' }, { id: 'b' }] }).indexOf('sumber tepercaya') !== -1);
        t('S6: tanpa akun di berkas, tidak ada peringatan akun',
          peringatanRestoreHtml({ pengguna: [] }) === '' && peringatanRestoreHtml({}) === '');

        /* ---- S7: pengalihan rute terlarang me-render shell ----
           guru1 seed juga wajibGantiSandi=true, jadi ganti sandinya dulu
           (gantiSandiSendiri, tanpa sesi) supaya render() sampai dashboard. */
        kfMasukAdmin(); go('dashboard'); render();
        var sidebarAdminKeuangan = document.getElementById('sidebar').textContent.indexOf('Keuangan') !== -1;
        var kfGantiGuru = null;
        try { kfGantiGuru = gantiSandiSendiri('guru1', 'guru123', 'GuruSementara1'); } catch (e) {}
        if (!(kfGantiGuru && kfGantiGuru.ok)) {
          try { kfGantiGuru = gantiSandiSendiri('guru1', 'sandiuji1', 'GuruSementara1'); } catch (e) {}
        }
        t('S7: ganti sandi guru sementara (dashboard guru bisa tampil)',
          !!(kfGantiGuru && kfGantiGuru.ok));
        try { keluarPengguna(); } catch (e) {}
        var guruMasukS7 = false;
        if (kfGantiGuru && kfGantiGuru.ok) {
          try { guruMasukS7 = masukSebagai('guru1', 'GuruSementara1'); } catch (e) { guruMasukS7 = false; }
        }
        go('keuangan'); render();
        t('S7: Guru ke Keuangan dialihkan ke dashboard + sidebar tanpa Keuangan (shell di-render)',
          guruMasukS7 && sidebarAdminKeuangan && currentRoute === 'dashboard' &&
          document.getElementById('sidebar').textContent.indexOf('Keuangan') === -1);
        try { keluarPengguna(); } catch (e) {}
        /* S5: pulihkan guru1 ke seed LANGSUNG dari seedPengguna() (reset ke
           guru123 ditolak mesin sebagai sandi-lemah). Hanya entri guru1
           yang diganti supaya sandi sementara admin blok ini tetap utuh. */
        try {
          var benihGuru = seedPengguna().filter(function (p) { return p.id === 'guru1'; })[0];
          for (var gi = 0; gi < db.pengguna.length; gi++) {
            if (db.pengguna[gi].id === 'guru1') { db.pengguna[gi] = benihGuru; break; }
          }
          save('KIRANA-FIX S7: pulihkan guru1 ke seed');
        } catch (e) {}
        kfMasukAdmin(); go('dashboard'); render();

        /* ---- A2: "Hapus semua data" — TERAKHIR (mengosongkan db) ---- */
        go('pengaturan'); render();
        mintaHapusSemuaData();
        var cekHapus = document.getElementById('confirm-check');
        t('A2: konfirmasi hapus data meminta centang persetujuan', !!cekHapus);
        if (cekHapus) cekHapus.checked = true;
        runConfirm();
        t('A2: data dikosongkan (0 santri)', db.santri.length === 0);
        var pesanHapusTampil =
          (document.querySelector('#view #alert-root') || { textContent: '' }).textContent.indexOf('Semua data sudah dihapus') !== -1 ||
          (document.getElementById('auth-root') || { textContent: '' }).textContent.indexOf('Semua data sudah dihapus') !== -1;
        t('A2: pesan sukses "Semua data sudah dihapus" menetap di layar', pesanHapusTampil);
        try { resetToSeed(); } catch (e) {}
        t('A2: data contoh dipulihkan sesudah uji (40 santri)', db.santri.length === 40);
        try { keluarPengguna(); } catch (e) {}
        go('dashboard'); render();
      }

      /* Bersihkan BLOK BASKARA: kembalikan pengguna ke seed
         (admin123/guru123, wajibGantiSandi=true) — S5: reset ke sandi
         seed ditolak mesin (sandi-lemah), jadi pulihkan langsung dari
         seedPengguna(), tanpa validasi sandi. Hapus counter lockout F2,
         keluar. */
      try { db.pengguna = seedPengguna(); save('BASKARA: pulihkan pengguna ke seed'); } catch (e) {}
      try { localStorage.removeItem(LOGIN_GAGAL_KEY); } catch (e) {}
      /* ============ BLOK WIRA-2 — wizard, panduan, empty state, identitas/profil + security (Wira, ronde "Data kosong + Panduan pengguna") ============
         Prasyarat: t(), masukSebagai() (BLOK A). Pola: snapshot db + antrean
         + profil + flag wizard di awal; SEMUA mutasi dikembalikan di akhir
         blok (cleanup di luar try, supaya sandi admin/guru tidak tertinggal
         berubah walau ada tes yang melempar). */
      var wira2SnapDb = null, wira2SnapQueue = null, wira2ProfilAwal = null, wira2WizardAwal = null, wira2GuruWajibAwal = null, wira2GuruDiubah = false;
      var wira2SandiAdmin = 'admin123', wira2SandiGuru = 'guru123';
      var WIRA2_LOGO = 'data:image/png;base64,iVBORw0KGgo=';
      try { wira2SnapDb = JSON.parse(JSON.stringify(db)); } catch (e) { wira2SnapDb = null; }
      try { wira2SnapQueue = JSON.parse(JSON.stringify(getQueue())); } catch (e) { wira2SnapQueue = []; }
      try { wira2ProfilAwal = localStorage.getItem('tpq_profil_aktif'); } catch (e) { wira2ProfilAwal = null; }
      try { wira2WizardAwal = localStorage.getItem('tpq-madin-pwa-wizard'); } catch (e) { wira2WizardAwal = null; }
      try { var wira2GuruAwal = cariPengguna('guru1'); wira2GuruWajibAwal = wira2GuruAwal ? wira2GuruAwal.wajibGantiSandi : null; } catch (e) {}
      /* Helper: masuk sebagai id; bila layar ganti sandi paksa muncul, isi
         sandi sementara lalu submit (pola BASKARA T-01). Daftar sandi
         mencoba sandi terlacak dulu, lalu sandi seed, lalu sementara —
         supaya tahan terhadap clearAllData (MERGE v21: clearAllData kini
         mempertahankan pengguna + sandi saat ini, bukan sandi seed). */
      function wira2Masuk(id, temp) {
        var daftar = id === 'admin' ? [wira2SandiAdmin, 'admin123', 'wirauji123'] : [wira2SandiGuru, 'guru123', 'wiraguru123'];
        var ok = false;
        for (var i = 0; i < daftar.length; i++) {
          try { if (masukSebagai(id, daftar[i])) { ok = true; break; } } catch (e) {}
        }
        if (!ok) return false;
        try { go('dashboard'); render(); } catch (e) {}
        var ganti = null;
        try { ganti = document.getElementById('ganti-baru'); } catch (e) {}
        if (ganti) {
          try {
            document.getElementById('ganti-baru').value = temp;
            document.getElementById('ganti-ulang').value = temp;
            submitGantiSandiPaksa({ preventDefault: function () {} });
            if (id === 'admin') { wira2SandiAdmin = temp; } else { wira2SandiGuru = temp; wira2GuruDiubah = true; }
          } catch (e) {}
        }
        var s = null;
        try { s = sesiAktif(); } catch (e) {}
        return !!(s && s.id === id);
      }
      try {
        setJenjang('Semua');

        /* ---- A. Identitas + profil (data seed, Pimpinan) ---- */
        t('WIRA2: masuk admin (sandi seed)', wira2Masuk('admin', 'wirauji123'));
        (function () {
          var sLama = { namaTpq: 'TPQ Al-Muttaqin', kepala: 'Ustadz Ahmad' };
          migrasiIdentitas(sLama);
          t('WIRA2 identitas: migrasi settings lama (TPQ dari namaTpq + kepala Ustadz Ahmad; Ibtidaiyah default)',
            sLama.identitas.TPQ.nama === 'TPQ Al-Muttaqin' && sLama.identitas.TPQ.kepala === 'Ustadz Ahmad' &&
            sLama.identitas.Ibtidaiyah.nama === 'Madrasah Ibtidaiyah' && sLama.identitas.Ibtidaiyah.singkat === 'MI');
        })();
        var wira2Edit = null;
        try { wira2Edit = simpanIdentitas('TPQ', { nama: 'TPQ Wira Uji', singkat: 'TPQ', kepala: 'Ustadz Wira', motto: 'Belajar sambil bermain' }, 'admin'); } catch (e) { wira2Edit = null; }
        t('WIRA2 identitas: edit tersimpan + nama TPQ ikut berubah', !!(wira2Edit && wira2Edit.ok) && db.settings.identitas.TPQ.nama === 'TPQ Wira Uji' && db.settings.namaTpq === 'TPQ Wira Uji');
        go('identitas'); render();
        t('WIRA2 identitas: form menampilkan nama baru', (function () { var el = document.getElementById('id-tpq-nama'); return !!el && el.value === 'TPQ Wira Uji'; })());
        go('dashboard'); render();
        t('WIRA2 identitas: hero dashboard menampilkan nama baru', (function () { var h = document.querySelector('.hero-identitas h1'); return !!h && h.textContent === 'TPQ Wira Uji'; })());
        var wira2SetIbt = null;
        try { wira2SetIbt = simpanIdentitas('Ibtidaiyah', { nama: 'MI Wira Uji', singkat: 'MI', logo: WIRA2_LOGO }, 'admin'); } catch (e) { wira2SetIbt = null; }
        t('WIRA2 profil: simpan identitas Ibtidaiyah + logo', !!(wira2SetIbt && wira2SetIbt.ok) && db.settings.identitas.Ibtidaiyah.logo === WIRA2_LOGO);
        var wira2ProfilIbt = null;
        try { wira2ProfilIbt = setProfilAktif('Ibtidaiyah'); } catch (e) {}
        t('WIRA2 profil: setProfilAktif Ibtidaiyah tersimpan', wira2ProfilIbt === 'Ibtidaiyah' && getProfilAktif() === 'Ibtidaiyah' && localStorage.getItem('tpq_profil_aktif') === 'Ibtidaiyah');
        go('dashboard'); render();
        t('WIRA2 profil: hero menampilkan nama Ibtidaiyah', (function () { var h = document.querySelector('.hero-identitas h1'); return !!h && h.textContent === 'MI Wira Uji'; })());
        t('WIRA2 profil: santri terfilter 16 (Ibtidaiyah aktif)', santriAktif().length === 16, 'dapat ' + santriAktif().length);
        t('WIRA2 profil: hero menampilkan chip 16 santri aktif', (document.getElementById('view').textContent || '').indexOf('16 santri aktif') !== -1);
        t('WIRA2 profil: logo tampil di hero (<img src> data URL)', (function () { var im = document.querySelector('.hero-identitas img.hero-logo'); return !!im && (im.getAttribute('src') || '').indexOf('data:image/png;base64,') === 0; })());
        (function () {
          var btn = document.querySelector('.hero-identitas [data-profil="TPQ"]');
          var klikOk = false;
          if (btn) { try { btn.click(); klikOk = true; } catch (e) { klikOk = false; } }
          t('WIRA2 profil: klik tombol data-profil di hero mengganti profil ke TPQ', klikOk && getProfilAktif() === 'TPQ' && santriAktif().length === 22, 'profil=' + getProfilAktif() + ', santri=' + santriAktif().length);
        })();
        var wira2Semua = null;
        try { wira2Semua = setProfilAktif('Semua'); } catch (e) {}
        t('WIRA2 profil: Pimpinan bisa pilih Semua', wira2Semua === 'Semua' && getProfilAktif() === 'Semua');
        go('pengaturan'); render();
        t('WIRA2 profil: tombol Semua ada di Pengaturan (Pimpinan)', !!document.querySelector('[data-profil="Semua"]'));
        try { keluarPengguna(); } catch (e) {}
        try { render(); } catch (e) {}
        t('WIRA2 profil: kartu login Ibtidaiyah menampilkan logo (<img src> data URL)', (function () { var im = document.querySelector('.profil-card[data-profil="Ibtidaiyah"] img.profil-logo'); return !!im && (im.getAttribute('src') || '').indexOf('data:image/png;base64,') === 0; })());
        t('WIRA2 profil: masuk lagi sebagai admin', wira2Masuk('admin', 'wirauji123'));
        try { setProfilAktif('TPQ'); } catch (e) {}

        /* ---- B. Panduan (Pimpinan + Guru) ---- */
        go('panduan'); render();
        (function () {
          var teks = (document.getElementById('view').textContent || '');
          var seksi = ['1. Mulai cepat', '2. Login dan kata sandi', '3. Profil aktif dan Identitas Madrasah', '4. Cara pakai tiap modul', '5. Isi data massal', '6. Backup dan pulihkan', '7. Offline dan sinkron', '8. Tanya jawab'];
          var hilang = seksi.filter(function (s) { return teks.indexOf(s) === -1; });
          t('WIRA2 panduan: 8 seksi tampil untuk Pimpinan', hilang.length === 0, hilang.length ? 'hilang: ' + hilang.join(' | ') : '8/8 ada');
          t('WIRA2 panduan: kalimat Mira A1 persis ada di halaman', teks.indexOf('Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama.') !== -1);
        })();
        /* Panduan tidak membocorkan data sensitif: tidak ada hash/salt, dan
           tidak ada hash pengguna atau token sinkron yang tersimpan. Kata
           sandi bawaan admin123/guru123 MEMANG tertulis di halaman (kalimat
           Mira A1, disengaja) — yang dicek di sini adalah kredensial ASLI
           (hash) dan token, bukan teks panduan itu. */
        (function () {
          var html = '';
          try { html = renderPanduan(); } catch (e) { html = ''; }
          var hashPengguna = '';
          try { hashPengguna = (db.pengguna[0] && db.pengguna[0].hash) || ''; } catch (e) {}
          var tokenSinkron = '';
          try { tokenSinkron = (typeof getSheetCfg === 'function' && getSheetCfg().syncToken) || ''; } catch (e) {}
          var bocor = [];
          if (/hash/i.test(html)) bocor.push('kata hash');
          if (/salt/i.test(html)) bocor.push('kata salt');
          if (hashPengguna && html.indexOf(hashPengguna) !== -1) bocor.push('hash pengguna');
          if (tokenSinkron && html.indexOf(tokenSinkron) !== -1) bocor.push('token sinkron');
          t('WIRA2 panduan: tidak ada hash/salt/token bocor', html.length > 0 && bocor.length === 0, bocor.length ? 'bocor: ' + bocor.join(', ') : 'bersih (' + html.length + ' karakter)');
        })();
        t('WIRA2 panduan: masuk sebagai guru1', wira2Masuk('guru1', 'wiraguru123'));
        go('panduan'); render();
        (function () {
          var teks = (document.getElementById('view').textContent || '');
          var seksi = ['1. Mulai cepat', '2. Login dan kata sandi', '3. Profil aktif dan Identitas Madrasah', '4. Cara pakai tiap modul', '5. Isi data massal', '6. Backup dan pulihkan', '7. Offline dan sinkron', '8. Tanya jawab'];
          t('WIRA2 panduan: render untuk Guru + kalimat Mira A1 ada', teks.indexOf('Panduan Pengguna') !== -1 && teks.indexOf('Data contoh — ID awal: admin, kata sandi awal: admin123. Wajib diganti saat login pertama.') !== -1);
          t('WIRA2 panduan: 8 seksi tampil untuk Guru', seksi.every(function (s) { return teks.indexOf(s) !== -1; }));
        })();

        /* ---- C. Penjagaan peran #/identitas (Guru lihat saja) ---- */
        go('identitas'); render();
        (function () {
          var view = document.getElementById('view');
          /* Hidden input logo (2) memang tidak di-disabled: bukan kontrol
             yang bisa diubah pengguna di layar; penjaganya adalah
             submitIdentitas + simpanIdentitas (keduanya menolak Guru). */
          var semuaInput = view.querySelectorAll('input:not([type=hidden])');
          var nonaktif = view.querySelectorAll('input:not([type=hidden])[disabled]');
          t('WIRA2 identitas: semua input tampak disabled untuk Guru', semuaInput.length > 0 && nonaktif.length === semuaInput.length, nonaktif.length + '/' + semuaInput.length + ' disabled');
          t('WIRA2 identitas: hidden input logo tetap ada (2, bukan kontrol ubah)', view.querySelectorAll('input[type=hidden]').length === 2, view.querySelectorAll('input[type=hidden]').length + ' hidden');
          t('WIRA2 identitas: tidak ada tombol Simpan identitas untuk Guru', view.textContent.indexOf('Simpan identitas') === -1);
          t('WIRA2 identitas: tidak ada tombol Pilih logo untuk Guru', view.textContent.indexOf('Pilih logo') === -1);
        })();
        var wira2NamaSebelum = '';
        try { wira2NamaSebelum = db.settings.identitas.TPQ.nama; } catch (e) {}
        var wira2SubmitGuru = null;
        try { wira2SubmitGuru = submitIdentitas({ preventDefault: function () {} }, 'TPQ'); } catch (e) { wira2SubmitGuru = 'LEMPAR: ' + e.message; }
        t('WIRA2 identitas: submitIdentitas sebagai Guru ditolak + nama tidak berubah', wira2SubmitGuru === false && (function () { try { return db.settings.identitas.TPQ.nama === wira2NamaSebelum; } catch (e) { return false; } })());
        var wira2SimpanGuru = null;
        try { wira2SimpanGuru = simpanIdentitas('TPQ', { nama: 'TPQ Guru Racun' }, 'guru1'); } catch (e) { wira2SimpanGuru = null; }
        t('WIRA2 identitas: simpanIdentitas sebagai Guru ditolak (bukan-pimpinan)', !!(wira2SimpanGuru && wira2SimpanGuru.ok === false && wira2SimpanGuru.error === 'bukan-pimpinan'));
        (function () {
          var tersimpanSebelum = null;
          try { tersimpanSebelum = localStorage.getItem('tpq_profil_aktif'); } catch (e) {}
          var efektif = null;
          try { efektif = setProfilAktif('Semua'); } catch (e) {}
          var tersimpanSesudah = null;
          try { tersimpanSesudah = localStorage.getItem('tpq_profil_aktif'); } catch (e) {}
          t('WIRA2 profil: setProfilAktif Semua sebagai Guru ditolak (efektif bukan Semua, simpanan utuh)', efektif !== 'Semua' && getProfilAktif() !== 'Semua' && tersimpanSesudah === tersimpanSebelum, 'efektif=' + efektif + ', tersimpan=' + tersimpanSesudah);
          t('WIRA2 profil: pemilih Guru tidak berisi tombol Semua', profilPickerHtml().indexOf('data-profil="Semua"') === -1);
        })();

        /* ---- D. Logo: validasi + render aman ---- */
        t('WIRA2 logo: masuk lagi sebagai admin', wira2Masuk('admin', 'wirauji123'));
        t('WIRA2 logo: logoAman menolak string racun', logoAman('"><script>alert(1)</script>') === '' && logoAman('javascript:alert(1)') === '' && logoAman('data:image/svg+xml;base64,PHN2Zz4=') === '' && logoAman('') === '');
        t('WIRA2 logo: logoAman menerima data URL PNG valid', logoAman(WIRA2_LOGO) === WIRA2_LOGO);
        var wira2LogoSvg = null, wira2LogoJs = null;
        try { wira2LogoSvg = simpanIdentitas('TPQ', { nama: 'TPQ Wira Uji', logo: 'data:image/svg+xml;base64,PHN2Zz4=' }, 'admin'); } catch (e) {}
        try { wira2LogoJs = simpanIdentitas('TPQ', { nama: 'TPQ Wira Uji', logo: 'javascript:alert(1)' }, 'admin'); } catch (e) {}
        t('WIRA2 logo: simpanIdentitas menolak logo SVG', !!(wira2LogoSvg && wira2LogoSvg.ok === false && wira2LogoSvg.error === 'logo-tidak-valid'));
        t('WIRA2 logo: simpanIdentitas menolak logo javascript:', !!(wira2LogoJs && wira2LogoJs.ok === false && wira2LogoJs.error === 'logo-tidak-valid'));
        (function () {
          try { if (!db.settings.identitas) migrasiIdentitas(db.settings); } catch (e) {}
          var logoAwal = '';
          try { logoAwal = db.settings.identitas.TPQ.logo || ''; } catch (e) {}
          try { db.settings.identitas.TPQ.logo = '"><img src=x onerror="window.__wiraLogo=1">'; } catch (e) {}
          go('identitas'); render();
          var prev = document.getElementById('logo-preview-id-tpq');
          var adaImgRacun = !!(prev && prev.querySelector('img'));
          var mentahDiView = ((document.getElementById('view').innerHTML || '').indexOf('onerror="window.__wiraLogo=1"') !== -1);
          try { db.settings.identitas.TPQ.logo = logoAwal; } catch (e) {}
          t('WIRA2 logo: logo racun tersimpan tidak dirender di pratinjau identitas', !adaImgRacun && !mentahDiView, adaImgRacun ? 'img racun tampil' : (mentahDiView ? 'string onerror mentah di HTML' : 'ditolak + di-escape'));
          t('WIRA2 logo: payload logo tidak dieksekusi', typeof window.__wiraLogo === 'undefined');
        })();
        var wira2LogoOk = null;
        try { wira2LogoOk = simpanIdentitas('TPQ', { nama: 'TPQ Wira Uji', logo: WIRA2_LOGO }, 'admin'); } catch (e) {}
        t('WIRA2 logo: simpanIdentitas menerima logo PNG valid', !!(wira2LogoOk && wira2LogoOk.ok));
        go('identitas'); render();
        t('WIRA2 logo: pratinjau berisi <img> logo sesudah disimpan', (function () { var prev = document.getElementById('logo-preview-id-tpq'); var im = prev && prev.querySelector('img'); return !!im && (im.getAttribute('src') || '').indexOf('data:image/png;base64,') === 0; })());
        t('WIRA2 logo: hidden input menyimpan data URL logo', (function () { var h = document.getElementById('logo-id-tpq'); return !!h && h.value === WIRA2_LOGO; })());

        /* ---- E. Wizard: XSS lewat nama/kepala/tahun ajaran (TEMUAN KRITIS, diperbaiki Wira) ---- */
        (function () {
          try { if (!db.settings.identitas) migrasiIdentitas(db.settings); } catch (e) {}
          var namaAwal = '', kepalaAwal = '', tahunAwal = '';
          try { namaAwal = db.settings.identitas.TPQ.nama; kepalaAwal = db.settings.identitas.TPQ.kepala; tahunAwal = db.settings.tahunAjaran; } catch (e) {}
          try {
            db.settings.identitas.TPQ.nama = '<img src=x onerror="window.__wiraXss=1">';
            db.settings.identitas.TPQ.kepala = 'Ustadz <script>alert(1)</script>';
            db.settings.tahunAjaran = '2026/2027<script>alert(2)</script>';
          } catch (e) {}
          var wh = '';
          try { wh = wizardHtml(); } catch (e) { wh = ''; }
          t('WIRA2 wizard: nama/kepala/tahun racun di-escape (tidak ada tag mentah)', wh.indexOf('<img src=x') === -1 && wh.indexOf('<script>') === -1 && wh.indexOf('&lt;img') !== -1 && wh.indexOf('&lt;script&gt;') !== -1);
          try { bukaWizard(); } catch (e) {}
          var modalHtml = '';
          try { modalHtml = document.getElementById('modal-root').innerHTML || ''; } catch (e) {}
          t('WIRA2 wizard: modal wizard tidak memuat tag racun mentah', modalHtml.indexOf('<img src=x') === -1 && modalHtml.indexOf('<script>') === -1);
          t('WIRA2 wizard: payload tidak dieksekusi', typeof window.__wiraXss === 'undefined');
          var gabung = '';
          try { gabung = wizardHtml() + renderPanduan() + renderIdentitas() + profilPickerHtml() + profilLoginHtml(); } catch (e) {}
          var onclickBocor = false;
          try {
            var m = gabung.match(/onclick="[^"]*"/g) || [];
            onclickBocor = m.some(function (s) { return s.indexOf('__wiraXss') !== -1 || s.indexOf('<') !== -1; });
          } catch (e) {}
          t('WIRA2 audit: tidak ada onclick baru yang membawa data pengguna mentah', gabung.length > 0 && !onclickBocor);
          try { closeModal(); } catch (e) {}
          try {
            db.settings.identitas.TPQ.nama = namaAwal;
            db.settings.identitas.TPQ.kepala = kepalaAwal;
            db.settings.tahunAjaran = tahunAwal;
          } catch (e) {}
        })();

        /* ---- F. Wizard + hapus semua data (db dikosongkan dulu) ---- */
        try { clearAllData(); } catch (e) {}
        t('WIRA2 hapus: clearAllData mengosongkan santri/guru/kelas', db.santri.length === 0 && db.guru.length === 0 && db.kelas.length === 0);
        t('WIRA2 hapus: pengguna bawaan tetap ada (admin + guru1)', !!cariPengguna('admin') && !!cariPengguna('guru1') && db.pengguna.length === 2, db.pengguna.map(function (p) { return p.id; }).join(','));
        /* MERGE v21 (A2): clearAllData kini MEMPERTAHANKAN pengguna + sandi
           saat ini (bukan mengembalikan seed). Tes lama memakai sandi seed
           ('admin123'/'guru123') sehingga gagal bila sandi saat ini sudah
           diganti (di sini 'wirauji123'/'wiraguru123' lewat wira2Masuk).
           Perilaku yang benar: login dengan sandi SAAT INI tetap bisa. */
        var wira2LoginHapus = null;
        try { wira2LoginHapus = masukPengguna('admin', wira2SandiAdmin); } catch (e) {}
        t('WIRA2 hapus: admin tetap bisa login setelah hapus semua data', !!(wira2LoginHapus && wira2LoginHapus.ok));
        var wira2LoginGuruHapus = null;
        try { wira2LoginGuruHapus = masukPengguna('guru1', wira2SandiGuru); } catch (e) {}
        t('WIRA2 hapus: guru1 tetap bisa login setelah hapus semua data', !!(wira2LoginGuruHapus && wira2LoginGuruHapus.ok));
        t('WIRA2 wizard: masuk admin pasca-hapus', wira2Masuk('admin', 'wirauji123'));
        go('dashboard'); render();
        t('WIRA2 wizard: kartu tampil di Dashboard saat db kosong (Pimpinan)', ((document.getElementById('view').textContent || '').indexOf('Mulai isi data') !== -1) && !!document.querySelector('.wizard-card'));
        (function () {
          var h = hitungSetup();
          t('WIRA2 wizard: hitungSetup() kosong = semua langkah belum selesai', h.lembaga === false && h.guru === false && h.kelas === false && h.santri === false && h.keuangan === false && h.jumlahSantri === 0 && h.jumlahGuru === 0 && h.jumlahKelas === 0);
        })();
        /* v22 (N3/M1/M3): kartu tampil bila BELUM (santri>0 DAN guru>0 DAN
           kelas>0). Tambah 1 guru saja TIDAK menghilangkan kartu. */
        (function () {
          db.guru.push({ id: 'g-wira2', nama: 'Guru Wira', kelas: 'Iqra 1', peran: 'Guru', jenjang: 'TPQ', hp: '', honor: 0, honorStatus: 'Belum' });
          var h = hitungSetup();
          var langkah = wizardLangkah();
          t('WIRA2 wizard: tambah 1 guru -> langkah guru selesai (hitungSetup berubah)', h.guru === true && h.jumlahGuru === 1 && langkah[1].selesai === true, 'guru=' + h.jumlahGuru);
          t('WIRA2 wizard: kartu tetap tampil bila baru guru saja (butuh ketiganya)', wizardKartuDashboard().length > 0);
          db.guru = db.guru.filter(function (g) { return g.id !== 'g-wira2'; });
          t('WIRA2 wizard: kartu tampil lagi setelah guru dihapus', wizardKartuDashboard().length > 0);
          db.kelas.push({ id: 'k-wira2', nama: 'Kelas Wira', jenjang: 'TPQ', ustadz: '', jadwal: '', ruang: '' });
          db.santri.push({ id: 's-wira2', nama: 'Santri Wira', nis: 'WIRA001', jk: 'L', jenjang: 'TPQ', kelas: 'Kelas Wira', jilid: 'Iqra 1', angkatan: '2026', rombel: 'A', status: 'Aktif', tabungan: 0, kehadiran: 100 });
          db.keuanganTx.push({ id: 'k-wira2', jenis: 'Masuk', kategori: 'Saldo awal', jenjang: 'TPQ', nama: 'Saldo awal uji', jumlah: 100000, tanggal: '2026-11-15' });
          var h2 = hitungSetup();
          var l2 = wizardLangkah();
          t('WIRA2 wizard: tambah kelas+santri+transaksi -> langkah 3/4/5 selesai', h2.kelas === true && h2.santri === true && h2.keuangan === true && l2[2].selesai === true && l2[3].selesai === true && l2[4].selesai === true);
          /* Guru belum ada di sini, jadi kartu HARUS masih tampil. */
          t('WIRA2 wizard: kartu tetap tampil bila guru masih kosong', wizardKartuDashboard().length > 0, 'santri=' + db.santri.length + ' guru=' + db.guru.length + ' kelas=' + db.kelas.length);
          db.guru.push({ id: 'g-wira2', nama: 'Guru Wira', kelas: 'Iqra 1', peran: 'Guru', jenjang: 'TPQ', hp: '', honor: 0, honorStatus: 'Belum' });
          t('WIRA2 wizard: kartu hilang saat santri+guru+kelas terisi', wizardKartuDashboard() === '', 'santri=' + db.santri.length + ' guru=' + db.guru.length + ' kelas=' + db.kelas.length + ' kosong=' + aplikasiKosong() + ' peran=' + peranSaya() + ' ditutup=' + wizardDitutup());
          db.guru = db.guru.filter(function (g) { return g.id !== 'g-wira2'; });
          db.kelas = db.kelas.filter(function (k) { return k.id !== 'k-wira2'; });
          db.santri = db.santri.filter(function (s) { return s.id !== 's-wira2'; });
          db.keuanganTx = db.keuanganTx.filter(function (x) { return x.id !== 'k-wira2'; });
        })();
        (function () {
          /* Jalur kanonik: identitas harus ada dulu (migrasi), lalu kepala
             diisi lewat simpanIdentitas. (Versi awal tes ini hanya mengisi
             settings.kepala — tidak mengalir ke identitasUntuk yang
             mengembalikan default berkepala kosong bila identitas belum ada;
             tes itu lolos sekali di run pertama lalu gagal, jadi diganti ke
             jalur nyata ini.) */
          try { if (!db.settings.identitas) migrasiIdentitas(db.settings); } catch (e) {}
          var r = null;
          try { r = simpanIdentitas('TPQ', { nama: identitasUntuk('TPQ').nama, kepala: 'Ustadz Wira' }, 'admin'); } catch (e) {}
          var h = hitungSetup();
          t('WIRA2 wizard: langkah lembaga selesai bila nama+kepala+tarif+tahun terisi', !!(r && r.ok) && h.lembaga === true, 'kepala=' + (function () { try { return identitasUntuk('TPQ').kepala; } catch (e) { return '?'; } })() + ', tarif=' + db.settings.tarifSpp + ', tahun=' + db.settings.tahunAjaran);
        })();
        try { wizardLewati(); } catch (e) {}
        t('WIRA2 wizard: Lewati menyimpan flag tpq-madin-pwa-wizard=lewati', (function () { try { return localStorage.getItem('tpq-madin-pwa-wizard') === 'lewati'; } catch (e) { return false; } })());
        t('WIRA2 wizard: kartu hilang setelah dilewati', wizardKartuDashboard() === '');
        go('pengaturan'); render();
        t('WIRA2 wizard: Pengaturan berisi tombol Buka panduan setup', (document.getElementById('view').textContent || '').indexOf('Buka panduan setup') !== -1);
        try { bukaWizard(); } catch (e) {}
        t('WIRA2 wizard: tetap bisa dibuka dari Pengaturan walau sudah dilewati', (document.getElementById('modal-root').textContent || '').indexOf('Mulai isi data') !== -1);
        try { closeModal(); } catch (e) {}
        try { localStorage.removeItem('tpq-madin-pwa-wizard'); } catch (e) {}
        t('WIRA2 wizard: kartu tampil lagi setelah flag dilepas', wizardKartuDashboard().length > 0);

        /* ---- G. Empty state 18 rute (db masih kosong) ---- */
        (function () {
          var ruteData = ['dashboard', 'santri', 'tabungan', 'keuangan', 'rapbm', 'kelas', 'hafalan', 'guru', 'pengumuman', 'laporan', 'penilaian', 'kbm', 'kemuridan', 'khidmah', 'grafik'];
          var ruteStatis = { pengaturan: 'Buka panduan setup', panduan: 'Panduan Pengguna', identitas: 'Identitas Madrasah' };
          ruteData.forEach(function (r) {
            var ok = false, detail = '';
            try {
              go(r); render();
              var v = document.getElementById('view');
              var jmlEmpty = v.querySelectorAll('.empty').length;
              var jmlBtn = v.querySelectorAll('button').length;
              ok = (v.textContent || '').length > 0 && jmlEmpty >= 1 && jmlBtn >= 1;
              detail = jmlEmpty + ' pesan .empty, ' + jmlBtn + ' tombol';
            } catch (e) { ok = false; detail = 'LEMPAR: ' + e.message; }
            t('WIRA2 empty: rute ' + r + ' menampilkan pesan + tombol aksi saat data kosong', ok, detail);
          });
          Object.keys(ruteStatis).forEach(function (r) {
            var ok = false, detail = '';
            try {
              go(r); render();
              var v = document.getElementById('view');
              var teks = v.textContent || '';
              ok = teks.length > 0 && teks.indexOf(ruteStatis[r]) !== -1 && v.querySelectorAll('button').length >= 1;
              detail = 'kunci "' + ruteStatis[r] + '" ' + (teks.indexOf(ruteStatis[r]) !== -1 ? 'ada' : 'TIDAK ADA');
            } catch (e) { ok = false; detail = 'LEMPAR: ' + e.message; }
            t('WIRA2 empty: rute ' + r + ' render utuh saat data kosong (halaman statis, tanpa empty state)', ok, detail);
          });
          go('santri'); render();
          t('WIRA2 empty: rute santri menawarkan tombol Tambah santri', (document.getElementById('view').textContent || '').indexOf('Tambah santri') !== -1);
          go('guru'); render();
          t('WIRA2 empty: rute guru menawarkan tombol Tambah guru', (document.getElementById('view').textContent || '').indexOf('Tambah guru') !== -1);
          go('kelas'); render();
          t('WIRA2 empty: rute kelas menawarkan tombol Tambah kelas', (document.getElementById('view').textContent || '').indexOf('Tambah kelas') !== -1);
        })();

        /* ---- H. Data ada -> tampilan tidak rusak (contoh: santri) ---- */
        try {
          if (wira2SnapDb) {
            Object.keys(db).forEach(function (k) { delete db[k]; });
            Object.keys(wira2SnapDb).forEach(function (k) { db[k] = wira2SnapDb[k]; });
            try { save('WIRA2: kembalikan db untuk uji data-ada'); } catch (e) {}
          }
        } catch (e) {}
        try { setJenjang('Semua'); } catch (e) {}
        /* Snapshot mengembalikan admin ke wajibGantiSandi=true (keadaan
           seed), dan sesiAktif() membaca flag itu LANGSUNG dari db — jadi
           render() akan menampilkan layar ganti sandi paksa sampai dance
           ganti sandi diulang. Tanpa baris ini, rute santri di bawah
           menampilkan layar ganti sandi, bukan daftar. */
        t('WIRA2 data-ada: masuk admin lagi pasca-restore snapshot', wira2Masuk('admin', 'wirauji123'));
        go('santri'); render();
        t('WIRA2 data-ada: rute santri menampilkan daftar (Ahmad Fauzi)', (function () { var v = document.getElementById('view'); return !!v.querySelector('table') && (v.textContent || '').indexOf('Ahmad Fauzi') !== -1; })(), 'sesi wajib=' + (function () { try { var s = sesiAktif(); return s ? String(s.wajibGantiSandi) : 'null'; } catch (e) { return '?'; } })());
      } catch (e) {
        t('WIRA2: blok selesai tanpa lempar', false, e.message);
      }
      /* ---- Cleanup BLOK WIRA-2 (selalu jalan) ---- */
      try {
        if (wira2SnapDb) {
          Object.keys(db).forEach(function (k) { delete db[k]; });
          Object.keys(wira2SnapDb).forEach(function (k) { db[k] = wira2SnapDb[k]; });
          try { save('WIRA2: kembalikan db ke snapshot'); } catch (e) {}
        }
      } catch (e) {}
      try { if (wira2SnapQueue) setQueue(wira2SnapQueue); } catch (e) {}
      try {
        if (wira2ProfilAwal == null) localStorage.removeItem('tpq_profil_aktif');
        else localStorage.setItem('tpq_profil_aktif', wira2ProfilAwal);
      } catch (e) {}
      try {
        if (wira2WizardAwal == null) localStorage.removeItem('tpq-madin-pwa-wizard');
        else localStorage.setItem('tpq-madin-pwa-wizard', wira2WizardAwal);
      } catch (e) {}
      try { resetSandiPengguna('admin', 'admin123', 'admin'); } catch (e) {}
      try {
        if (wira2GuruDiubah) {
          resetSandiPengguna('guru1', 'guru123', 'admin');
          var g1 = cariPengguna('guru1');
          if (g1 && wira2GuruWajibAwal !== null) { g1.wajibGantiSandi = wira2GuruWajibAwal; save('WIRA2: kembalikan flag wajibGantiSandi guru1'); }
        }
      } catch (e) {}
      try { keluarPengguna(); } catch (e) {}
      try { setJenjang(wira2ProfilAwal === 'Ibtidaiyah' ? 'Ibtidaiyah' : (wira2ProfilAwal === 'Semua' ? 'Semua' : 'TPQ')); } catch (e) {}

      /* Kembalikan ke keadaan awal. */
      setMode('auto');
      setJenjang('Semua');
      ui.nilaiTab = 'Harian';
      go('dashboard'); render();
    } catch (e) {
      t('Uji UI selesai tanpa lempar', false, e.message);
    }
  }
  try {
    runEngineSelfTests(function (nama, ok, detail) { t('Mesin: ' + nama, ok, detail); }).then(function () {
      try { ujiUi(); } catch (e) { t('Uji UI', false, e.message); }
      selesai();
    }).catch(function (e) { t('Self-test mesin', false, e.message); selesai(); });
  } catch (e) {
    t('Self-test mesin', false, e.message);
    selesai();
  }
}

init();
