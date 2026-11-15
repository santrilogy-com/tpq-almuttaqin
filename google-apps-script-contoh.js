/**
 * CONTOH Google Apps Script untuk PWA TPQ Al-Muttaqin (model hybrid).
 *
 * VERSI v2 — ditinjau Baskara (data engineer), 15 Nov 2026, dari file yang
 * sama di pwa/. Satu-satunya perubahan fungsi: doPost() kini menolak body
 * yang data-nya bukan objek (sebelumnya data berbentuk string/angka lolos
 * pemeriksaan `!body.data`, lalu writeTable menulis sheet kosong dan
 * mengembalikan ok:true yang menyesatkan). Sisanya VERBATIM v1, termasuk
 * batasan yang sudah didokumentasikan di bawah (pull tidak mengembalikan
 * tabunganTx, hafalanLog, pengumuman, pengaturan, RAPBM, dan jadwal;
 * foto dan sppReminderSent tidak disinkron). Kalau Mas/klien butuh pull
 * penuh, tambahkan sheet dan pemetaan yang sama seperti pola yang ada.
 *
 * CARA PAKAI (ringkas, panduan lengkap ada di README.md):
 * 1. Buka https://script.google.com, buat proyek baru, tempel seluruh isi file ini.
 * 2. Buat Google Sheet baru, lalu di Apps Script ubah SHEET_ID di bawah
 *    dengan ID Sheet itu (bagian di antara /d/ dan /edit pada link Sheet).
 * 3. Jalankan sekali fungsi setupSheets() dari editor (pilih fungsinya, tekan Run),
 *    dan izinkan akses saat diminta.
 * 4. Deploy > New deployment > pilih type "Web app", Execute as "Me",
 *    Who has access "Anyone", lalu Deploy. Salin URL Web App yang berakhiran /exec.
 * 5. Tempel URL itu di PWA: Pengaturan > Google Sheet dan sinkron hybrid >
 *    kolom "URL Web App Google Apps Script", lalu Simpan.
 *
 * YANG DILAKUKAN SCRIPT INI:
 * - doPost (action=sync): menerima seluruh data PWA (JSON) dan menulisnya ke
 *   sheet Murid, Guru, Nilai, Absensi, Keuangan. Tiap sinkron menimpa isi sheet
 *   dengan data terbaru dari perangkat (sumber kebenaran = perangkat yang
 *   terakhir menyimpan, sesuai aturan "data terbaru berdasarkan waktu yang menang").
 * - doGet (action=pull): mengembalikan seluruh data dari Sheet sebagai JSON
 *   supaya perangkat lain bisa menarik data terbaru. Absensi dikembalikan
 *   dalam bentuk pertemuan (dikelompokkan per tanggal + kelas) supaya PWA
 *   bisa langsung memakainya. Catatan: pull TIDAK mengembalikan tabunganTx,
 *   hafalanLog, pengumuman, pengaturan, RAPBM, jadwal, dan data lain yang
 *   hanya tersimpan di perangkat; data itu ikut terkirim saat sync, tapi
 *   tidak ditulis balik lewat pull ini.
 * - doGet (action=csv&jenis=murid|guru|nilai): mengembalikan CSV satu jenis data.
 *
 * KEAMANAN: URL Web App ini bisa diakses siapa pun yang punya linknya
 * ("Anyone"). Jangan taruh data yang sangat sensitif di Sheet ini, dan jangan
 * bagikan URL Web App ke publik. Tidak ada API key Google di sini.
 *
 * TOKEN RAHASIA SINKRON (sangat disarankan):
 * 1. Di editor Apps Script: Project Settings (ikon roda gigi) > Script
 *    Properties > Add script property, nama TPQ_SYNC_TOKEN, isi dengan
 *    kata sandi acak yang panjang (mis. 32 karakter huruf+angka).
 * 2. Di PWA: Pengaturan > Google Sheet > kolom "Token rahasia sinkron",
 *    isi token yang SAMA, lalu Simpan. Token hanya tersimpan di perangkat
 *    (localStorage), tidak pernah ditulis ke repo dan tidak dikirim ke
 *    mana pun kecuali ke URL Web App ini.
 * 3. Selama TPQ_SYNC_TOKEN diatur, doPost dan doGet MENOLAK permintaan
 *    tanpa token yang benar (error 'token tidak valid'). Kalau token belum
 *    diatur di Script Properties, permintaan tetap diterima seperti
 *    sebelumnya (kompatibel dengan deployment lama) — tapi siapa pun yang
 *    punya URL bisa membaca/menulis Sheet, jadi perlakukan URL sebagai
 *    rahasia dan atur token sesegera mungkin. Token ini BUKAN API key
 *    Google: ini kata sandi bersama antara PWA dan script milik lembaga
 *    sendiri, supaya URL yang bocor tidak langsung bisa dipakai orang lain.
 *
 * YANG TIDAK DISINKRON: foto murid/guru (data URL gambar, terlalu besar untuk
 * sel Sheet) dan sppReminderSent (penanda pengingat lokal). Keduanya tetap
 * tersimpan di perangkat dan tidak hilang saat sinkron; hanya saja perangkat
 * lain yang menarik data dari Sheet tidak menerima foto tersebut.
 */

var SHEET_ID = 'GANTI_DENGAN_ID_GOOGLE_SHEET_ANDA';

var HEADER = {
  Murid: ['id', 'nis', 'nama', 'kelas', 'jenjang', 'jilid', 'halaman', 'hafalan', 'wali', 'hpWali', 'alamat', 'tabungan', 'sppStatus', 'kehadiran', 'angkatan', 'rombel', 'status', 'statusTanggal', 'statusAlasan', 'tahunLulus'],
  Guru: ['id', 'nama', 'kelas', 'jenjang', 'hp', 'honor', 'honorStatus', 'peran'],
  Nilai: ['id', 'santriId', 'jenis', 'mapel', 'nilai', 'tanggal', 'catatan'],
  Absensi: ['tanggal', 'kelasId', 'materi', 'santriId', 'status'],
  Keuangan: ['id', 'jenis', 'jenjang', 'kategori', 'nama', 'jumlah', 'tanggal', 'catatan']
};

function getSheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function setupSheets() {
  var ss = getSheet();
  Object.keys(HEADER).forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    if (!sh) sh = ss.insertSheet(nama);
    sh.clear();
    sh.getRange(1, 1, 1, HEADER[nama].length).setValues([HEADER[nama]]);
    sh.setFrozenRows(1);
  });
}

function sheetByName(nama) {
  var ss = getSheet();
  var sh = ss.getSheetByName(nama);
  if (!sh) {
    sh = ss.insertSheet(nama);
    /* 'Meta' tidak punya header di HEADER: jangan akses HEADER[nama].length
       untuk sheet tanpa header (sebelumnya sinkron pertama ke spreadsheet
       baru selalu gagal di sini, baru berhasil di percobaan kedua). */
    if (HEADER[nama]) {
      sh.getRange(1, 1, 1, HEADER[nama].length).setValues([HEADER[nama]]);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function writeTable(nama, rows) {
  var sh = sheetByName(nama);
  var head = HEADER[nama];
  sh.clear();
  sh.getRange(1, 1, 1, head.length).setValues([head]);
  sh.setFrozenRows(1);
  if (!rows || !rows.length) return;
  var values = rows.map(function (r) {
    return head.map(function (k) {
      var v = r[k];
      return v === undefined || v === null ? '' : v;
    });
  });
  sh.getRange(2, 1, values.length, head.length).setValues(values);
}

function readTable(nama) {
  var sh = sheetByName(nama);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var head = HEADER[nama];
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  return vals.map(function (row) {
    var o = {};
    head.forEach(function (k, i) { o[k] = row[i]; });
    return o;
  });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Token rahasia bersama (Script Properties TPQ_SYNC_TOKEN). Kosong = belum
   diatur (mode lama: semua permintaan diterima). Kalau sudah diatur, hanya
   permintaan dengan token yang sama persis yang diterima. */
function getTokenRahasia() {
  try { return PropertiesService.getScriptProperties().getProperty('TPQ_SYNC_TOKEN') || ''; }
  catch (err) { return ''; }
}
function tokenCocok(tokenKlien) {
  var token = getTokenRahasia();
  if (!token) return true; // belum diatur: terima seperti sebelumnya
  return String(tokenKlien || '') === token;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!tokenCocok(body.token)) {
      return jsonOut({ ok: false, error: 'token tidak valid' });
    }
    if (body.action !== 'sync' || !body.data) {
      return jsonOut({ ok: false, error: 'action harus sync dan data harus ada' });
    }
    /* v2: data harus objek. Tanpa ini, data berbentuk string/angka lolos
       pemeriksaan di atas, lalu writeTable menulis sheet kosong dan
       mengembalikan ok:true yang menyesatkan. */
    if (typeof body.data !== 'object' || Array.isArray(body.data)) {
      return jsonOut({ ok: false, error: 'data harus objek' });
    }
    var d = body.data;
    writeTable('Murid', d.santri || []);
    writeTable('Guru', d.guru || []);
    writeTable('Nilai', d.nilai || []);
    var absensi = [];
    (d.pertemuan || []).forEach(function (p) {
      Object.keys(p.absensi || {}).forEach(function (sid) {
        absensi.push({ tanggal: p.tanggal, kelasId: p.kelasId, materi: p.materi || '', santriId: sid, status: p.absensi[sid] });
      });
    });
    writeTable('Absensi', absensi);
    writeTable('Keuangan', d.keuanganTx || []);
    var meta = sheetByName('Meta');
    meta.clear();
    meta.getRange(1, 1, 2, 2).setValues([['updatedAt', new Date().toISOString()], ['jumlahPerubahan', body.jumlahPerubahan || 0]]);
    return jsonOut({ ok: true, waktu: new Date().toISOString() });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var action = (e.parameter.action || 'pull');
  var tokenKlien = (e.parameter.token || '');
  if (!tokenCocok(tokenKlien)) {
    return jsonOut({ ok: false, error: 'token tidak valid' });
  }
  if (action === 'csv') {
    var jenis = (e.parameter.jenis || 'murid').toLowerCase();
    var map = { murid: 'Murid', guru: 'Guru', nilai: 'Nilai', absensi: 'Absensi', keuangan: 'Keuangan' };
    var nama = map[jenis] || 'Murid';
    var rows = readTable(nama);
    var head = HEADER[nama];
    var lines = [head.join(',')];
    rows.forEach(function (r) {
      lines.push(head.map(function (k) {
        var v = String(r[k] === undefined || r[k] === null ? '' : r[k]);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(','));
    });
    return ContentService
      .createTextOutput(lines.join('\n'))
      .setMimeType(ContentService.MimeType.CSV);
  }
  // action=pull (default): kembalikan data untuk perangkat yang menarik.
  // Yang dikembalikan: Murid, Guru, Nilai, Keuangan, dan Pertemuan (absensi
  // yang dikelompokkan kembali per tanggal + kelas, lengkap dengan materi).
  // Data lain (tabunganTx, hafalanLog, pengumuman, pengaturan, RAPBM,
  // jadwal, absensi guru, target) tetap di perangkat dan ikut terkirim saat
  // sync, tapi tidak ditulis balik lewat pull ini. Kalau butuh pull penuh,
  // tambahkan sheet dan pemetaan yang sama.
  var meta = sheetByName('Meta');
  var updatedAt = '';
  try { updatedAt = meta.getRange(1, 2, 1, 1).getValue(); } catch (err) {}
  // Kelompokkan baris Absensi (tanggal, kelasId, materi, santriId, status)
  // kembali menjadi pertemuan seperti format yang dikirim PWA.
  var pertemuanMap = {};
  var pertemuan = [];
  readTable('Absensi').forEach(function (r) {
    var kunci = (r.tanggal || '') + '|' + (r.kelasId || '');
    var p = pertemuanMap[kunci];
    if (!p) {
      p = { id: 'p-' + String(r.tanggal || '').replace(/[^0-9]/g, '') + '-' + String(r.kelasId || ''), kelasId: r.kelasId, tanggal: r.tanggal, materi: r.materi || '', absensi: {} };
      pertemuanMap[kunci] = p;
      pertemuan.push(p);
    }
    if (r.materi && !p.materi) p.materi = r.materi;
    if (r.santriId) p.absensi[String(r.santriId)] = r.status;
  });
  return jsonOut({
    ok: true,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : '',
    data: {
      santri: readTable('Murid'),
      guru: readTable('Guru'),
      nilai: readTable('Nilai'),
      pertemuan: pertemuan,
      keuanganTx: readTable('Keuangan')
    }
  });
}
