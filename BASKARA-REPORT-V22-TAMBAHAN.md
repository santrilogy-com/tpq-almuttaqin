# Laporan Baskara — Tambahan Scope v22 (audit ulang v21, Citra Fase 3)

**Oleh:** Baskara (engine ronde v22, koordinator Sari) · **Tanggal:** 15 November 2026, ~22:23–23:50 WIB
**Direktori kerja:** `~/workspace/tpq-madin-app/pwa-v2-v22/` — HANYA `engine.js` yang
diubah (+ `BASELINE-ENGINE.sha256` diregenerasi + laporan ini).
**Tidak disentuh:** `app.js` (milik Kirana — ia mengerjakan bagian UI tambahan ini
secara paralel), `sw.js` (versi tetap v22), `pwa-v2-registrar/`, `pwa-v2-fix/`,
`pwa/`. **Tidak deploy. `?selftest=1` tidak pernah dijalankan di profil browser
cloud** — semua verifikasi lewat harness jsdom lokal
(`~/workspace/tools/jsdom-test/run_selftest.js`) dan probe Node lokal.

## Ringkasan hasil

| Butir | Status |
|---|---|
| §6 isContoh (b) — P0 MENGHALANGI: mutasi tulis asli pertama membalik `isContoh=false` | ✅ diperbaiki + 2 selftest baru |
| Y-N3 — P0: `resetToSeed()` tanpa cek `isContoh` di ekor selftest | ✅ diperbaiki + 1 selftest baru |
| Selftest | ✅ **649/649 PASS, 0 FAIL** (harness resmi) |

**Rekonsiliasi angka:** baseline v22 **646** + **3** tes baru Baskara = **649**.
Tes mesin (engine) saja: 290 → **293**, 0 FAIL (dikonfirmasi pembaca per-div,
karena `run_selftest.js` hanya mencetak satu potongan baris `done:` — lihat
§ Verifikasi). `node --check engine.js` lolos. `BASELINE-ENGINE.sha256`
diregenerasi (format sama, `sha256sum engine.js`):
`77fb9932be4dac197335228628cf36d2eecb94cc8922bb4f96a0942f7a16c8e3  engine.js`.

---

## 1. §6 isContoh (b) — mutasi tulis asli pertama membalik flag

### Masalah
Klien yang memakai seed lalu menambah santri asli tetap `isContoh=true`:
kotak kredensial `admin123` tetap tampil di login (padahal sandi sudah diganti)
dan gerbang selftest tetap terbuka, sehingga `?selftest=1` masih bisa
menghapus data asli klien.

### Perbaikan — `tandaiDataAsli()` (engine.js:437)
Helper baru, dipanggil semua fungsi mutasi tulis asli **sebelum `save()`-nya,
hanya di jalur sukses** (validasi yang gagal return sebelum mencapai
pemanggilan ini, jadi tidak membalik — teruji: simpan gagal validasi dan
import 0 baris berhasil tidak membalik):
```js
function tandaiDataAsli() {
  if (!db || db.isContoh !== true) return false;
  if (sedangSelftest()) return false;
  db.isContoh = false;
  return true;
}
```
Begitu flag false, kotak login hilang (gate `kredensialAwalTampil()` di
`app.js` membaca flag yang sama) dan `bolehSelftest()` false (lihat di bawah).
`save()` berikutnya dari fungsi pemanggil yang mempersistensi flag itu.

### Daftar fungsi yang membalik flag (43 titik panggil di 36 fungsi)

| Fungsi | Jalur |
|---|---|
| `simpanSantri` | tambah + ubah (2 titik) |
| `ubahStatusSantri`, `hapusSantri` | status + hapus |
| `catatTabungan` | Setor/Tarik (tabungan) |
| `tambahTarget` | target tabungan |
| `simpanKeuangan`, `ubahKeuangan`, `hapusKeuangan` | transaksi keuangan |
| `toggleSpp` | status SPP santri |
| `simpanRapbm`, `hapusRapbm` | tambah/ubah + hapus (3 titik) |
| `simpanBiaya`, `hapusBiaya` | tambah/ubah + hapus (3 titik) |
| `tambahKelas` | tambah kelas |
| `simpanPertemuan` | absensi/pertemuan (+ hitung kehadiran) |
| `naikJilidSantri` | naik jilid |
| `catatHafalan` | setoran hafalan/Iqra |
| `simpanGuru`, `toggleHonor`, `hapusGuru` | tambah/ubah + honor + hapus (4 titik) |
| `tambahPengumuman`, `togglePengumuman`, `hapusPengumuman` | pengumuman |
| `simpanNilai`, `ubahNilai`, `hapusNilai` | nilai |
| `simpanAlokasi`, `hapusAlokasi` | alokasi KBM (3 titik) |
| `simpanJadwal`, `hapusJadwal` | jadwal KBM (3 titik) |
| `tambahPiket`, `hapusPiket` | piket |
| `simpanAbsensiGuru` | **hanya bila `disimpan > 0`** (simpan kosong tanpa entri tidak membalik) |
| `simpanSettings` | perubahan settings (nama/tarif/tahun/jam/kepala) |
| `simpanIdentitas` | simpan identitas sukses (Guru ditolak → tidak membalik) |
| `importRows` | **hanya bila `lap.berhasil > 0`** — mencakup import CSV santri/guru/nilai (dipakai `importCsvText`) |
| `pengingatSPP` | kirim pengingat SPP (menandai `sppReminderSent`) |

### Yang TIDAK membalik flag (sengaja, sesuai tugas)
- `seedData()` / `emptyData()` — seed membawa `isContoh=true`, kosong membawa
  `false` (perilaku lama, tidak diubah).
- Restore backup: `applyBackupData()` / `restoreFromText()` — tidak ada hook;
  `isContoh` hasil restore mengikuti isi berkas (backup data asli membawa
  `false` dari berkasnya sendiri).
- Selftest — guard di bawah.
- Reset "Hapus semua data" (`clearAllData()` → `emptyData()`): flag kembali
  dari seed saat data contoh dipulihkan sesudahnya; perilaku itu benar dan
  tidak diubah.
- Fungsi auth (`tambahPengguna`, `resetSandiPengguna`, `hapusPengguna`,
  `gantiSandiSendiri`, `gantiSandiPaksa`): tidak masuk cakupan tugas — ganti
  sandi sendiri sudah menyembunyikan kotak login lewat `wajibGantiSandi=false`.
- Bukan mutasi data: `setJenjang`/`setProfilAktif` (preferensi tampil),
  `setSheetCfg`/`saveSheetConfig` (konfigurasi sinkron), `applyPulledData`/
  jalur pull (data masuk dari server, bukan tulis lewat aplikasi),
  `enqueueChange`, `load()`.

### Desain guard selftest (engine.js:400–447)
```js
var selftestAktif = false;            // flag internal
var lewatiDeteksiUrlSelftest = false; // override uji, hanya untuk tes §6
var kedalamanSelftest = 0;            // anti-rekursi (lihat §2)
function setModeSelftest(aktif) { selftestAktif = !!aktif; return selftestAktif; }
```
`sedangSelftest()` true bila **salah satu** menyala:
1. **Flag eksplisit** — `setModeSelftest(true)` dipanggil `runEngineSelfTests`
   selama berjalan (disimpan + dipulihkan ke nilai luar saat selesai, supaya
   panggilan bersarang tidak mematikan guard pemanggilnya), dan **diekspor
   supaya `app.js` (Kirana) memanggilnya di awal/akhir `runUiSelfTest`** —
   itu mekanisme kanoniknya, karena `ujiUi()` jalan SETELAH
   `runEngineSelfTests` selesai (flag sudah dimatikan lagi).
2. **Deteksi URL cadangan** — `?selftest=1` di `location.search` berarti sesi
   ini sedang selftest UI. Lapisan ini yang membuat harness tetap hijau
   HARI INI sebelum Kirana me-wire setter di atas: tanpa ini, tulis BLOK C
   lewat form akan membalik flag di tengah `ujiUi()` dan mematahkan 2 tes
   Panduan WIRA2 yang mengharapkan data contoh (kalimat Mira A1). Di
   pemakaian normal URL tidak pernah berisi `?selftest=1`, jadi perilaku
   produksi tidak berubah.

### Tes baru §6 (2 catat, engine.js:3497–3500, di akhir blok IDENTITAS)
1. **Flip:** guard dimatikan sementara di dalam tes itu sendiri (flag +
   override deteksi URL), tambah 1 santri asli → assert `isContoh===false`,
   `tampilLogin()` tidak memuat kotak kredensial (cek `auth-kredensial` dan
   `admin123` di `#auth-root` — hanya bila `tampilLogin` + DOM tersedia;
   di Node dilewati), dan `bolehSelftest()===false`. Guard + snapshot
   db/antrean dikembalikan sesudahnya.
2. **Guard menyala:** tulis berikutnya (santri jaga NIS 777002) TIDAK
   membalik `isContoh` (tetap `true`); santri jaga dihapus lagi.

### `bolehSelftest()` (engine.js:448) — disediakan dari engine
Di v21 fungsi ini ada di `app.js`; **di v22 ia hilang saat merge** (pemicu
`?selftest=1` di `app.js` init kini tanpa gate — lihat §4, milik Kirana).
Saya sediakan lagi dari engine dengan semantik v21 yang sama
(`!!db.isContoh`), diekspor di `module.exports`, supaya gerbangnya ada dan
bisa diuji dari `runEngineSelfTests`. Bila Kirana mendefinisikan ulang di
`app.js` (dimuat sesudah engine), definisinya yang menang — semantiknya
sama, jadi tidak bentrok.

---

## 2. Y-N3 — `resetToSeed()` wajib cek `isContoh`

### Masalah (lebih parah dari deskripsi tugas — regresi merge v22)
Deskripsi tugas mengacu ke v21 (`engine.js:3349,3354`, perbaikan merge §10c)
dan mengasumsikan guard `bersih()` masih ada. **Di v22 keduanya hilang:**
`bersih()` tanpa guard SAMA SEKALI dan ekor `runEngineSelfTests` tanpa
`resetToSeed()`. Probe Node sebelum perbaikan membuktikan panggilan
`runEngineSelfTests` langsung di atas data asli (41 santri, marker NIS
888001, sandi `SandiAsliKlien9`): sesudahnya **40 santri, marker hilang,
`isContoh=true`, login sandi asli ditolak, `admin123` berhasil lagi** —
data asli terhapus di `bersih()` pertama, sebelum ekor sempat berperan.

### Perbaikan (4 lapis, semua di engine.js)
1. **Guard `bersih()` dipulihkan (engine.js, di dalam `runEngineSelfTests`):**
   bila masuk dengan data asli, `bersih()` melewati SELURUH penghapusan
   (tanpa `seedData`, tanpa `save`, tanpa `keluarPengguna`) dan mencatat
   `'Self-test dilewati: ...'` sebagai PASS. Guard mengunci **keadaan saat
   masuk** (`isContohAwal`, engine.js:2722), BUKAN `isContoh` berjalan:
   blok DB-KOSONG di tengah suite sengaja memanggil `clearAllData()`
   (`isContoh=false`, db kosong) dan suite sesudahnya (T-02/T-03, blok
   IDENTITAS) tetap butuh reseed — guard yang membaca keadaan berjalan
   akan mematahkan suite sendiri. Di jalur contoh, `bersih()` berperilaku
   persis seperti v22 sebelumnya.
2. **`resetToSeed()` berguard (engine.js:472):**
   ```js
   function resetToSeed(kredensialAdmin) {
     if (db && db.isContoh !== true && dbPunyaIsi()) return db; // data asli: jangan sentuh apa pun
     db = seedData();
     if (kredensialAdmin) { /* pulihkan salt/hash/wajibGantiSandi/sandiDiubahPada admin */ }
     save('Reset ke data contoh');
     return db;
   }
   ```
   Boleh reseed bila data contoh, atau bila db **kosong** (tidak ada yang
   bisa hilang — keadaan sesudah "Hapus semua data" / blok DB-KOSONG;
   di sinilah reseed dibutuhkan, sesuai §10c v21; tes lama
   `clearAllData()` → `resetToSeed()` → 40 santri tetap lolos).
   `dbPunyaIsi()` (engine.js:454): ada record di salah satu dari 16 kunci
   array data.
3. **Snapshot + pulihkan data asli di ekor (engine.js:2751,
   `pulihkanSnapshotAsli()`):** guard saja TIDAK cukup membuat data
   "utuh" — tes di antara dua `bersih()` menambah record uji (debris) dan
   tes auth mengubah sandi admin. Karena itu, bila masuk dengan data asli,
   ekor **mengembalikan snapshot penuh yang diambil saat masuk** (db +
   antrean + sesi + jenjang + profil + konfigurasi sinkron) dan
   `resetToSeed`/`bersih` TIDAK dipanggil sama sekali. Isi dikembalikan
   persis; yang berubah hanya metadata teknis `save()` (`_updatedAt` baru).
4. **Kredensial admin dipulihkan di ekor contoh:** `kredensialAdminAwal`
   (salinan record admin — salt/hash/flag saja, tidak pernah plaintext)
   disimpan saat masuk; ekor contoh memanggil `bersih()` DULU lalu
   `resetToSeed(kredensialAdminAwal)` — urutan ini penting, karena
   `bersih()` me-reseed lagi dan akan menghapus pemulihan bila dipanggil
   sesudahnya. Hasil: data kembali seed, sandi admin kembali ke keadaan
   SEBELUM selftest (bukan sandi uji). Panggilan `resetToSeed()` lain
   (UI, tengah suite) tidak memberi argumen → tidak ada pemulihan di sana.

### Tes baru Y-N3 (1 catat, engine.js:3605, di akhir `jalankanAsync`)
Setup idempotent (tanpa `bersih()` — di jalur asli ia memang dilewati):
marker lama NIS 888001 disingkirkan bila ada, sandi admin dipaksa ke
`admin123` dulu (`resetSandiPengguna` tidak memverifikasi sandi lama),
lalu tambah marker + ganti sandi ke `SandiAsliKlien9` + `db.isContoh=false`.
Lalu `runEngineSelfTests` BERSARANG dengan pencatat dummy (asersi
bersarang TIDAK masuk hitungan luar). Assert sesudahnya: santri 41→41,
guru/nilai/keuangan tidak berubah, marker ada, `isContoh===false`, login
sandi asli berhasil, `wirauji123` dan `admin123` ditolak. Snapshot luar
dipulihkan sesudahnya.
Hasil di harness: `siap=true, santri 41->41, marker=true, isContoh=false,
loginAsli=true, loginUji=false, loginSeed=false, nested pass=119/140`.

### Anti-rekursi (nyaris celaka — ditemukan probe, sudah diperbaiki)
Tes Y-N3 bersarang memanggil `runEngineSelfTests`, yang menjalankan tes
Y-N3-nya sendiri, yang memanggil lagi — **rekursi tanpa base case**
(probe pertama menggantung > 2 menit, dimatikan paksa). Perbaikan:
`kedalamanSelftest` (engine.js:406) — tes Y-N3 hanya jalan di kedalaman 1
(panggilan terluar); di kedalaman lebih dalam ia dilewati (catat PASS
dengan detail `'bersarang-kedalaman-N'`). Flag `selftestAktif` juga
disimpan/dipulihkan per kedalaman, bukan sekadar dimatikan.
Catatan jujur: suite bersarang di atas data asli hanya mencapai 119/140 —
bagian sinkronnya abort di blok auth (`masukPengguna('admin','admin123')`
gagal karena sandi sudah diganti → sesi null → satu tes melempar
`Cannot set properties of null (setting 'kedaluwarsa')`, dicatat sebagai
1 FAIL di pencatat dummy). Itu keterbatasan suite yang mengasumsikan seed,
bukan cacat perbaikan: data tetap utuh (yang diverifikasi tes ini), dan
bagian asinkron tetap jalan. Tidak saya perbaiki — di luar scope.

---

## 3. Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `node --check engine.js` | lolos |
| Harness resmi `node run_selftest.js ~/workspace/tpq-madin-app/pwa-v2-v22` | **SELFTEST PASS (649/649), FAIL 0** |
| Pembaca per-div (semua div `#selftest-root`) | 650 div, FAIL `[]`; tes mesin 293 PASS / 0 FAIL (290 → 293) |
| 3 tes baru (per-div) | §6 flip PASS (`isContoh=false, bolehSelftest=false, kotak kredensial tidak ada di layar login`); §6 guard PASS (`isContoh=true`); Y-N3 PASS (detail di §2) |
| Probe Node `/tmp/probe-baru.js` (21 cek, sebelum harness) | 21/21 PASS: flip di 10 jalur tulis (santri/guru/kelas/keuangan/tabungan/nilai/hafalan/import/identitas/settings), gagal validasi tidak membalik, guard on/off, `resetToSeed` tolak data asli / izinkan db kosong, selftest langsung di data asli utuh + login asli, contoh+sandi diganti kembali ke sandi sebelum selftest |
| Probe Node `/tmp/probe-throw.js` (panggilan langsung data asli) | Y-N3 PASS (detail di §2) |
| M2/Y7 (jalur Bagas) | tidak satu pun `parseInt`/`csvEscape`/`angkaRp()` diubah (hanya `tandaiDataAsli();` disisipkan di sekitarnya; `importRows` tetap memakai `parseInt` honor yang lama) |
| H-1–H-5 (ditahan) | tidak diubah |
| `BASELINE-ENGINE.sha256` | diregenerasi (format sama) |

---

## 4. Yang TIDAK dikerjakan / diteruskan ke Sari & Kirana

1. **Gate pemicu `?selftest=1` di `app.js` init masih tanpa gate (v22).**
   Di v21 pemicu dijaga `bolehSelftest()`; di v22 merge menghilangkan
   gate itu (dan `bolehSelftest()`-nya). Saya sudah menyediakan
   `bolehSelftest()` + `setModeSelftest()` dari engine (diekspor), tapi
   **pemicu di `app.js` tetap perlu digate oleh Kirana** (miliknya):
   `if (bolehSelftest()) { setTimeout(runUiSelfTest, 300); }` + pesan
   penolakan bila data asli, dan `setModeSelftest(true/false)` di
   awal/akhir `runUiSelfTest` (mekanisme kanonik guard §6). Sampai itu
   dikerjakan, pertahanan S1 di jalur pemicu URL hanya bersandar pada
   guard engine (`bersih()` + ekor snapshot) — yang sudah terbukti
   menahan panggilan langsung, tapi pesan penolakan belum tampil.
2. **`resetToSeedConfirm()` (app.js):** `resetToSeed()` kini menolak data
   asli dengan mengembalikan db apa adanya, tetapi UI tetap menampilkan
   toast sukses "Data contoh berhasil dipulihkan." Perlu Kirana: cek
   hasil / beri pesan penolakan bila db tidak berubah. (Di luar engine.)
3. **Konsekuensi pemulihan sandi (dicatat, sesuai tugas):** bila selftest
   jalan di atas data *contoh* yang sandi adminnya sudah diganti
   (mis. `contoh-baru-1`), ekor mengembalikan sandi itu — maka BLOK A
   `ujiUi` yang login dengan `admin123` akan gagal di perangkat itu.
   Itu perilaku yang diminta tugas (sandi kembali ke sebelum selftest,
   bukan sandi uji); di harness tidak berpengaruh (sandi awal `admin123`).
4. **Tidak ada perubahan perilaku lain:** logika seed, `dbUntukSinkron()`,
   S1–S7 selain yang disebut di atas, dan semua butir ditahan tidak diubah.
   Tidak ada fungsi/helper baru selain `tandaiDataAsli()`,
   `sedangSelftest()`, `setModeSelftest()`, `bolehSelftest()`,
   `dbPunyaIsi()`, `pulihkanSnapshotAsli()` (closure) dan variabel guard —
   semuanya di `engine.js`, mengikuti pola yang sudah ada.
