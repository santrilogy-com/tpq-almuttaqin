# Laporan Baskara — Penjaga Engine (PWA TPQ Al-Muttaqin, rebuild Registrar)

- Peran: Baskara, spesialis data/engine. Koordinator: Tara.
- Direktori kerja: `~/workspace/tpq-madin-app/pwa-v2-registrar/` (JANGAN sentuh `pwa-v2/` asli & `pwa/` produksi — dipatuhi, hanya baca `pwa-v2/` untuk diff).
- Waktu laporan: 15 Nov 2026 ~15:10 WIB.
- Status: **BASELINE TERKUNCI, KIRANA BELUM MENYERAHKAN PERUBAHAN** — belum ada diff untuk direview.

## 1. Baseline engine.js (snapshot awal)

File: `BASELINE-ENGINE.sha256` + `BASKARA-FINGERPRINT.txt` (di direktori ini).

| File | sha256 (awal) | Ukuran/baris |
|---|---|---|
| `engine.js` | `983058d73d37a08db6446c1f5f750819c3f9015a8afa09178ad3a39d0a886849` | 155.216 byte, 2.441 baris |
| `app.js` | `e16a1d9552befc23d47a1f99522d979e2c2cb3651052af9e60f31f90486c4be0` | 214.135 byte, 2.966 baris |
| `styles.css` | `b118cc38f96be719da5e452853c03463ca87567f2fd173067a2400f6f98d5646` | 56.630 byte, 973 baris |
| `index.html` | `b6d184b40872a41b270b8e820eaa626666341cbefc0ec1aa60a24dcbbc62bdd2` | 4.091 byte, 85 baris |
| `sw.js` | `07a03a11495b2df7e7f1c2323758b3e370928c22f3d1feeaf639de0276dd9051` | 1.435 byte, 49 baris |

Verifikasi awal: `sha256sum pwa-v2/engine.js` = hash baseline di atas → **kopi registrar identik dengan asli saat snapshot**. `diff -r pwa-v2 pwa-v2-registrar` (abaikan `BASELINE-ENGINE.sha256`) = **kosong, exit 0**.

## 2. Selftest baseline (sebelum Kirana menyentuh apa pun)

Runner: `~/workspace/tools/jsdom-test/run_selftest.js` terhadap direktori registrar.
Hasil: **`SELFTEST PASS (251/251)`, FAIL 0** — judul dokumen `SELFTEST PASS (251/251)`. Ini angka acuan; setelah Kirana selesai, selftest harus tetap 251/251.

## 3. Sidik-jari logika (untuk pembanding diff nanti)

`BASKARA-FINGERPRINT.txt` berisi: daftar lengkap fungsi `engine.js` (310 `function`) dan `app.js` (425 `function`), plus semua baris yang menyebut jangkar logika kritis: `masukPengguna`, `verifikasiLogin`, `hashSandi`, `sesiAktif`, `keluarPengguna`, `gantiSandiSendiri`, `resetSandiPengguna`, `tambahPengguna`, `hapusPengguna`, `bolehRute`, `peranSaya`, `bolehAkses`, `GURU_ROUTES`, `GURU_TABS`, `dbUntukSinkron`, `enqueueChange`, `importCsvText`, `export*CSV`, `backupJSON`, `restoreFromText`, `downloadTemplate`. Total baris jangkar: tercatat di file.

## 4. Status Kirana (per 15:10 WIB)

- `pwa-v2/DESIGN-TOKENS.md` dan `pwa-v2/KIRANA-DONE.md`: **belum ada**.
- `diff -r pwa-v2 pwa-v2-registrar`: **kosong** — belum ada perubahan apa pun dari Kirana di direktori asli.
- Tanda Kirana sedang bekerja: file referensi demo Registrar sudah ada di `/tmp/registrar-demo.html` (44.526 byte) dan `/tmp/registrar-style.css` (77.375 byte), dibuat 08:03–08:04 UTC — demo uiCookies Registrar (Bootstrap 5.3.8, teal/amber, Figtree). Itu file referensi di `/tmp`, BUKAN perubahan ke `pwa-v2/`. Saya tidak menyentuh/mengubahnya.
- Jadi: **belum ada yang bisa direview**. Saya siaga; begitu `KIRANA-DONE.md` muncul atau diff tidak kosong, saya jalankan review penuh (butir 5) + selftest ulang.

## 5. Rencana review saat Kirana selesai

1. `sha256sum engine.js` di registrar vs baseline → harus identik; kalau beda = TEMUAN, minta dikembalikan.
2. `diff -r pwa-v2 pwa-v2-registrar` (abaikan file baru yang disengaja: `DESIGN-TOKENS.md`, `KIRANA-DONE.md`, font baru, file laporan saya `BASELINE-ENGINE.sha256` / `BASKARA-*`).
3. Periksa diff `app.js` baris demi baris dengan lensa Ponytail-review: hanya markup/kelas/CSS boleh berubah; fungsi data, auth (`masukPengguna`, hash kata sandi, sesi 7 hari), peran/route guard (`bolehRute`/`peranSaya`/`GURU_ROUTES`/`GURU_TABS`), sinkron (`dbUntukSinkron`, antrean), validasi input, CSV/JSON harus berperilaku sama. Tidak boleh ada validasi/keamanan/aksesibilitas yang dipotong.
4. Jalankan ulang jsdom selftest di registrar → harus tetap 251/251.
5. Laporkan ke Tara: hash sebelum/sesudah, ringkasan diff, risiko, konfirmasi auth/peran/sinkron/CSV/JSON.

## 6. Skill — laporan pemakaian JUJUR

- **Ponytail — DIBACA**: `~/workspace/custom-skills/ponytail/SKILL.md` (filosofi: kode terbaik = kode yang tak ditulis; TIDAK PERNAH dipotong: validasi di trust boundary, error handling pencegah kehilangan data, keamanan, aksesibilitas) + `skills/ponytail-review/SKILL.md` (urutan: correct → safe → holds under load → tested → fast → lean; tiap temuan butuh kasus konkret; output `What this change does` + Must fix/Should fix/Nice to have + Verdict). **Dipakai**: sebagai lensa review — prinsip "jangan potong validasi/keamanan demi tampilan" jadi kriteria utama butir 5; format laporan temuan akan mengikuti ponytail-review. **Belum ada temuan** karena belum ada diff.
- **Addy Osmani api-and-interface-design — DIBACA**: `~/workspace/custom-skills/addy-osmani-agent-skills/skills/api-and-interface-design/SKILL.md` + `AGENTS.md` repo itu (catatan: AGENTS.md itu mengatur repo skill itu sendiri, bukan proyek TPQ — tidak diterapkan sebagai aturan proyek). **Dipakai sebagian**: prinsip yang relevan untuk review ini — Hyrum's Law (setiap perilaku teramati = kontrak de facto; jadi perubahan markup yang mengubah perilaku teramati fungsi auth/sinkron/CSV = breaking change), Validate at Boundaries (validasi input CSV/login/sinkron di trust boundary tidak boleh dipindah/dihapus), Prefer Addition Over Modification, Consistent Error Semantics. **Ditolak / tidak dipakai**: bagian REST/GraphQL/pagination/idempotency-key — tidak relevan, PWA ini offline-first localStorage + Apps Script, bukan REST API baru; tidak ada endpoint baru yang dirancang. Tidak ada klaim pemakaian di luar yang di atas.
- **Yang tidak dicek**: tampilan visual di HP sungguhan / browser live (di luar tugas saya; itu ranah Kirana + verifikasi live-deploy). Selftest jsdom tidak punya layout — uji visibilitas dilewati otomatis oleh app.js (cabang jsdom), jadi hasil 251/251 TIDAK membuktikan tampilan benar, hanya logika.

## 7. Yang TIDAK dilakukan

- Tidak deploy apa pun. Tidak menghubungi Mas. Tidak mengubah `pwa-v2/` maupun `pwa/`. Tidak mengubah satu byte pun file presentasi/logika — hanya menambah 3 file baru di direktori registrar: `BASELINE-ENGINE.sha256`, `BASKARA-FINGERPRINT.txt`, `BASKARA-REPORT.md` (file kerja saya sendiri).
