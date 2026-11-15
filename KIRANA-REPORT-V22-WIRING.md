# Laporan Kirana — Wiring Terakhir v22 (Gate Selftest + `resetToSeedConfirm`)

**Oleh:** Kirana (frontend ronde v22, koordinator Sari) · **Tanggal:** 15 November 2026, ~22:47–23:05 WIB
**Direktori kerja:** `~/workspace/tpq-madin-app/pwa-v2-v22/` — HANYA `app.js` yang diubah (+ laporan ini + probe di `~/workspace/tools/jsdom-test/`).
**Tidak disentuh:** `engine.js` (milik Baskara), `sw.js` (versi tetap v22), `pwa-v2-registrar/`, `pwa-v2-fix/`, `pwa/`. **Tidak deploy. `?selftest=1` tidak pernah dijalankan di profil browser cloud** — semua verifikasi lewat harness jsdom lokal (`~/workspace/tools/jsdom-test/run_selftest.js`) dan probe Node lokal.

## Ringkasan hasil

| Butir | Status |
|---|---|
| 1a. Gate pemicu `?selftest=1` di init `app.js` (`bolehSelftest()`) + toast penolakan | ✅ selesai |
| 1b. Wiring `setModeSelftest(true/false)` di `runUiSelfTest` | ✅ selesai |
| 2. `resetToSeedConfirm()` cek hasil `resetToSeed()` | ✅ selesai |
| Selftest resmi | ✅ **649/649 PASS, 0 FAIL** (harness resmi, baseline tetap hijau penuh) |
| Probe bertarget baru | ✅ **18/18 PASS** (`probe-v22-wiring-kirana.js`) |

**Rekonsiliasi angka:** baseline v22 **649** + **0** tes baru di dalam suite = **649**. Ke-18 cek baru saya hidup di probe luar (`~/workspace/tools/jsdom-test/probe-v22-wiring-kirana.js`), bukan di dalam `runUiSelfTest`, jadi angka suite tidak berubah — sesuai instruksi (tidak ada butir ditahan H-1–H-5 yang diubah).

---

## 1a. Gate pemicu `?selftest=1` di init — `app.js:3883-3897` (sesudah edit)

Dulu (tanpa gate, hilang saat merge v20):

```js
if (new URLSearchParams(location.search).get('selftest') === '1') {
  setTimeout(runUiSelfTest, 300);
}
```

Sekarang:

```js
/* Wiring selftest v22 (Kirana): pemicu ?selftest=1 HANYA jalan bila
   bolehSelftest() true (data contoh). ... Fail-closed: bila bolehSelftest
   tidak ada (engine lama), perlakukan sebagai ditolak. */
if (new URLSearchParams(location.search).get('selftest') === '1') {
  setTimeout(function () {
    var boleh = false;
    try { boleh = (typeof bolehSelftest === 'function') ? bolehSelftest() : false; } catch (e) { boleh = false; }
    if (boleh) runUiSelfTest();
    else toast('Selftest hanya bisa dijalankan pada data contoh. Data asli tidak diubah.');
  }, 300);
}
```

Catatan keputusan:

- Gate dicek **di dalam** `setTimeout` (bukan saat init), supaya keadaan data yang dinilai adalah keadaan saat selftest akan jalan, bukan saat halaman mulai dimuat.
- Fail-closed: `bolehSelftest` tidak ada / melempar → ditolak, bukan dijalankan.
- **Teks toast penolakan yang dipilih:** `Selftest hanya bisa dijalankan pada data contoh. Data asli tidak diubah.`
- `toast()` memakai `#toast-root` yang memang ada di `index.html:70`; render() sudah jalan sebelum timer ini, jadi toast terlihat di atas layar login bila pengguna belum masuk.

## 1b. Wiring `setModeSelftest()` — `app.js:3908` (`runUiSelfTest`; nyala di 3934, mati di 3923 dalam `selesai()`)

- **Nyalakan:** di awal `runUiSelfTest`, sesudah `#selftest-root` disiapkan (supaya bila root tidak ada dan fungsi melempar sebelum flag sempat dinyalakan, tidak ada flag yang bocor menyala):
  `try { if (typeof setModeSelftest === 'function') setModeSelftest(true); } catch (e) {}`
- **Matikan:** di dalam `selesai()` sebagai pernyataan pertama:
  `try { if (typeof setModeSelftest === 'function') setModeSelftest(false); } catch (e) {}`

**Mengapa bukan `try...finally` sinkron di badan fungsi (menyimpang dari saran tugas, dengan alasan):** `runUiSelfTest` itu async — badannya kembali segera setelah janji `runEngineSelfTests()` dibuat, sementara `ujiUi()` baru jalan di `.then` sesudahnya. Sebuah `finally` sinkron akan mematikan flag **sebelum** `ujiUi` berjalan, persis yang harus dicegah (flag harus menyala selama `ujiUi` supaya `tandaiDataAsli()` no-op dan tulis BLOK C/WIRA2 tidak membalik `isContoh`). `selesai()` adalah satu-satunya titik keluar fungsi ini — ketiga jalur (`.then` sukses, `.catch` janji, `catch` sinkron) semuanya bermuara ke `selesai()` — jadi mematikan flag di sana adalah padanan `finally` yang benar untuk fungsi async ini. Alasan ini juga ditulis sebagai komentar di kode.

**Konsistensi dengan engine (dicek sebelum edit):**

- `runEngineSelfTests` menyimpan flag luar (`flagSelftestLuar`) lalu mengembalikannya di ekor — karena `runUiSelfTest` kini menyalakan flag dulu, flag luar = `true`, jadi flag tetap menyala selama `ujiUi`, lalu `selesai()` mematikannya. Urutan ini terverifikasi probe B3/B4.
- Tes §6 engine (engine.js:3467) mematikan flag **sendiri sementara** di dalam tesnya lalu mengembalikannya — tidak tergantung pada flag mati di luar. Tidak ada tes UI di `ujiUi` yang mengasumsikan flag mati (grep `selftestAktif|lewatiDeteksiUrlSelftest|setModeSelftest|bolehSelftest` di `app.js` sebelum edit: nol hasil). **Tidak ada tes yang perlu disesuaikan.**
- Deteksi URL `?selftest=1` di `sedangSelftest()` tetap ada sebagai cadangan; wiring eksplisit ini kini mekanisme utama.

## 2. `resetToSeedConfirm()` cek hasil — `app.js:1769-1794` (sesudah edit)

Dulu: `onOk` memanggil `resetToSeed()` tanpa memeriksa hasil, lalu selalu `render()` + `showAlert('success', ...)`.

Sekarang:

```js
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
```

**Cara mendeteksi penolakan (tanpa mengubah `engine.js`):** `resetToSeed()` mengembalikan `db` di kedua jalur, jadi nilai kembali saja tidak membedakan. Yang membedakan adalah keadaan sesudahnya: reseed sukses **selalu** menghasilkan db contoh (`seedData()` menetapkan `isContoh: true`); bila ditolak (Y-N3: `isContoh !== true` DAN db berisi record), db tetap data asli (`isContoh` tetap `false`). Jadi cek `db.isContoh === true` sesudah panggilan = sukses; `false` = ditolak. Kasus db kosong (`isContoh` false tapi tanpa record) tetap reseed sukses → `isContoh` true, jadi cek ini tidak salah menolak. Bila `resetToSeed` melempar, diperlakukan gagal juga (fail-closed).

- **Teks toast gagal yang dipilih:** `Tidak dapat mengembalikan data contoh: data asli tidak diubah.`
- Bila gagal: toast gagal tampil, `render()` + `showAlert` sukses **tidak** dijalankan, data asli utuh.
- Bila sukses: perilaku persis seperti sebelumnya (`render()` + alert sukses).

**Catatan perilaku sukses yang ditemukan saat probe (bukan bug, tidak diubah):** sesudah reseed sukses, admin seed kembali `wajibGantiSandi=true`, sehingga `render()` mendarat di layar ganti sandi paksa dan `#alert-root` tidak ada — `showAlert` lalu memakai fallback `toast('Data contoh berhasil dipulihkan.')`. Pesan sukses tetap sampai ke pengguna; jalur sukses ini tidak saya ubah dari sebelumnya.

---

## Verifikasi

- `node --check app.js` → lolos. `node --check engine.js` → lolos (tidak diubah).
- Harness resmi `node run_selftest.js ~/workspace/tpq-madin-app/pwa-v2-v22` → **judul: SELFTEST PASS (649/649), done: SELFTEST DONE | PASS 649 | FAIL 0**.
- Probe bertarget `~/workspace/tools/jsdom-test/probe-v22-wiring-kirana.js` → **PROBE DONE | PASS 18 | FAIL 0**:

| Cek | Hasil |
|---|---|
| A1–A5: `?selftest=1` + data asli (`isContoh=false`) → tidak ada `#selftest-done`, judul bukan SELFTEST, toast penolakan tampil, `setModeSelftest` tidak pernah dipanggil, data utuh (40 santri) | PASS |
| B0–B2: `?selftest=1` + data contoh → suite jalan, SELFTEST DONE PASS 649 FAIL 0 | PASS |
| B3: `setModeSelftest` dipanggil tepat `[true, false]` (sekali tiap arah) | PASS |
| B4: `selftestAktif === false` sesudah suite | PASS |
| C1–C4: `resetToSeedConfirm()` data asli → modal muncul, toast gagal tampil, TIDAK ada alert sukses, db utuh (snapshot santri identik, `isContoh` false) | PASS |
| C5–C8: `resetToSeedConfirm()` data contoh → reseed sukses, pesan sukses tampil, TIDAK ada toast gagal, db contoh (40 santri, `isContoh` true) | PASS |

Dua temuan selama probe (keduanya kesalahan probe, bukan kode — sudah diperbaiki di probe, hasil akhir 18/18):

1. Langkah C5 pertama memanggil `resetToSeed()` langsung pada data asli dan "gagal" — itu justru guard Y-N3 yang bekerja benar (menolak reseed data asli berisi). Probe diperbaiki: balik `isContoh=true` dulu, baru reseed.
2. C6 pertama mengharapkan pesan sukses di `#alert-root` — ternyata tampil lewat toast fallback `showAlert` (alasan di atas). Probe diperbaiki: terima pesan sukses di alert **atau** toast.

## Yang tidak dikerjakan

- Tidak menyentuh `engine.js`, `sw.js`, `pwa-v2-registrar/`, `pwa-v2-fix/`, `pwa/`.
- Tidak deploy; tidak menjalankan `?selftest=1` di profil browser cloud.
- Tidak mengubah butir ditahan H-1–H-5; tidak menambah/mengurangi tes di dalam suite (649 tetap).
- Tidak mengubah teks atau perilaku jalur sukses `resetToSeedConfirm` selain penambahan cek hasil.
