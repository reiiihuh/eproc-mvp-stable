# Panduan Google Sheets + Apps Script

Dokumen ini adalah rencana implementasi agar Procurement Control memakai spreadsheet kantor sebagai database operasional, tetap memanfaatkan Google Drive, dan dapat ditingkatkan ke database lain tanpa mengubah UI.

## Target arsitektur

```text
React UI
  -> Data repository interface
    -> Apps Script adapter
      -> Google Sheets
      -> Google Drive

XLSX adapter tetap tersedia untuk migrasi, backup, dan export.
```

Apps Script web app menerima request melalui `doGet(e)` dan `doPost(e)`. Google menyediakan pilihan menjalankan web app sebagai pemilik atau sebagai user yang sedang mengakses. Untuk lingkungan kantor, deployment harus dibatasi ke domain Workspace dan write operation harus tetap divalidasi di server. Dokumentasi resmi: https://developers.google.com/apps-script/guides/web

## 1. Siapkan spreadsheet

Salin workbook produksi ke Google Sheets, lalu buat tab data berikut. Jangan memakai posisi kolom sebagai primary key; setiap relasi menggunakan UUID.

### `Procurements`

```text
record_uid | request_id | original_request_id | request_date | status |
pic_id | description | category | procurement_method | budget |
selected_vendor_id | po_number | po_date | po_amount_excl |
po_amount_incl | efficiency | created_at | created_by |
updated_at | updated_by | row_version
```

### `TenderOffers`

```text
offer_uid | record_uid | vendor_id | initial_offer | bafo |
final_offer | tax_rate | technical_score | commercial_score |
winner | quotation_link | updated_at
```

### Tab pendukung

- `PICs`: `pic_id`, nama, divisi, jabatan, lokasi, email, aktif.
- `Vendors`: `vendor_id`, nama legal, alamat, email, NPWP, status.
- `Documents`: `document_uid`, `record_uid`, tipe, Drive file ID, link, uploader, timestamp.
- `Sequences`: tahun, nomor terakhir, pola Request ID.
- `AuditLog`: timestamp, email, action, entity, record UID, before JSON, after JSON.
- `Settings`: key dan value konfigurasi non-secret.

Protect header, kolom UID, sequence, formula, dan audit log dari edit manual biasa. Beri akses Sheet hanya kepada grup yang membutuhkan.

## 2. Buat Apps Script

Dari spreadsheet pilih `Extensions -> Apps Script`. Pisahkan script menjadi modul berikut:

```text
Router.gs       doGet/doPost dan response JSON
Auth.gs         validasi user/domain/role
Repository.gs   read, insert, update, query
Sequence.gs     Request ID transaction
Audit.gs        pencatatan perubahan
Validation.gs   whitelist field dan validasi payload
Config.gs       nama tab dan property
```

Contoh router minimum:

```javascript
function doGet(e) {
  return route_({
    method: 'GET',
    action: String(e.parameter.action || 'listProcurements'),
    params: e.parameter,
  });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  return route_({ method: 'POST', action: body.action, body: body });
}

function json_(data, status) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: status < 400, status: status, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Jangan membentuk nama sheet, nomor kolom, atau formula langsung dari input user. Gunakan whitelist action dan schema validation.

## 3. Penomoran aman

Request ID wajib dibuat oleh Apps Script, bukan browser. Gunakan `LockService.getScriptLock()` agar dua user yang submit bersamaan tidak mendapat nomor sama. LockService memang disediakan untuk mencegah concurrent access ke shared resource: https://developers.google.com/apps-script/reference/lock/lock-service

```javascript
function nextRequestId_(year) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Sequences');
    const values = sheet.getDataRange().getValues();
    const rowIndex = values.findIndex((row, index) => index > 0 && Number(row[0]) === year);

    if (rowIndex === -1) {
      sheet.appendRow([year, 1, new Date()]);
      return `PROC-${year}-0001`;
    }

    const next = Number(values[rowIndex][1] || 0) + 1;
    sheet.getRange(rowIndex + 1, 2, 1, 2).setValues([[next, new Date()]]);
    SpreadsheetApp.flush();
    return `PROC-${year}-${String(next).padStart(4, '0')}`;
  } finally {
    lock.releaseLock();
  }
}
```

Insert procurement, update sequence, dan audit log sebaiknya berada dalam satu critical section. Tambahkan `row_version` untuk mencegah update user terakhir menimpa perubahan user lain tanpa peringatan.

## 4. Autentikasi dan role

Target akhir:

1. Login Google dengan domain `nanobanksyariah.id`.
2. Backend memverifikasi signature token, audience, expiry, `email_verified`, email, dan hosted domain.
3. Apps Script deployment dibatasi untuk organisasi/domain.
4. Role disimpan dalam tab terproteksi atau Google Group: `Admin`, `Procurement`, `Viewer`.
5. Setiap write operation memeriksa role dan mencatat user ke `AuditLog`.

Jangan mengandalkan `email.endsWith()` di React. Pengecekan browser hanya untuk UX dan mudah dilewati. Jangan pernah mengirim OAuth token pemilik script atau Client Secret ke browser. Google juga mengingatkan agar token Apps Script tidak diteruskan ke client: https://developers.google.com/apps-script/guides/web

Untuk tahap internal, deploy web app sebagai `User accessing the web app` dan batasi akses pada domain Workspace. Jika pemanggilan lintas origin dari React dibatasi kebijakan browser/Workspace, tambahkan endpoint same-origin di server aplikasi sebagai proxy terautentikasi.

## 5. Hubungkan React

Buat interface repository agar UI tidak bergantung pada Google Sheets:

```typescript
export interface ProcurementRepository {
  list(filters?: Record<string, string>): Promise<ProcurementRecord[]>
  create(input: ProcurementCreateInput): Promise<ProcurementRecord>
  update(uid: string, input: ProcurementUpdateInput, version: number): Promise<ProcurementRecord>
  listPics(): Promise<ProcurementPic[]>
  listVendors(): Promise<Vendor[]>
}
```

Implementasikan:

```text
XlsxProcurementRepository       mode existing/import-export
AppsScriptProcurementRepository mode Google Workspace
ApiProcurementRepository        opsi MySQL/PostgreSQL nanti
```

URL Apps Script dan setting non-secret dapat menggunakan environment variable. Jangan hard-code credential.

## 6. Near real-time update

Apps Script tidak memberi kanal WebSocket native ke aplikasi eksternal. Implementasi yang stabil:

- Refresh data saat tab kembali aktif.
- Poll `updated_since=<timestamp>` setiap 15–30 detik.
- Hanya kirim record yang berubah.
- Gunakan `updated_at` dan `row_version`.
- Tampilkan indikator `Terakhir sinkron HH:mm:ss`.

Installable trigger dapat dipakai untuk audit perubahan manual pada Sheet, sinkronisasi metadata, atau housekeeping. Trigger berjalan dengan akun pembuat trigger dan memiliki pembatasan tertentu; lihat https://developers.google.com/apps-script/guides/triggers/installable

## 7. Dokumen Google Drive

Simpan file asli di Drive dan hanya simpan metadata berikut di tab `Documents`:

```text
drive_file_id | web_view_link | mime_type | file_name | folder_id |
uploaded_by | uploaded_at
```

Folder boleh tetap manual seperti kondisi sekarang. App cukup memilih file/folder, preview, lalu menautkannya ke `record_uid`. Hindari menyimpan binary atau base64 file ke dalam Sheet.

## 8. Migrasi data lama

1. Freeze salinan workbook terakhir.
2. Import seluruh record dan buat `record_uid` permanen.
3. Simpan nomor lama di `original_request_id`.
4. Generate Request ID baru per tahun tanpa menghapus nomor lama.
5. Pecah penawaran vendor menjadi satu baris per vendor.
6. Cocokkan jumlah record, total PO, total biaya, dan efisiensi per tahun.
7. Uji minimal dua user submit bersamaan.
8. Setelah rekonsiliasi lolos, jadikan Sheet sebagai source of truth.

## 9. Checklist sebelum production

- Web app hanya dapat diakses domain kantor.
- Server memverifikasi token Google dan role.
- Spreadsheet tidak public dan tidak `anyone with link`.
- Sheet system dilindungi dari edit langsung.
- Semua write tervalidasi, terkunci, dan masuk audit log.
- OAuth secret berada di environment secret.
- Backup harian/version history aktif.
- Quota Apps Script dan ukuran Sheet dipantau.
- Ada prosedur rollback serta rekonsiliasi dashboard.

## Urutan implementasi yang disarankan

1. Rapikan tab dan header pada copy Google Sheet.
2. Buat UID serta migrasi data lama.
3. Bangun Apps Script read-only dan cocokkan dashboard.
4. Tambahkan write, sequence lock, version check, dan audit log.
5. Sambungkan dropdown PIC/vendor.
6. Aktifkan auth domain serta role.
7. Tambahkan near real-time refresh.
8. Uji dengan user terbatas sebelum mengganti file-based mode.
