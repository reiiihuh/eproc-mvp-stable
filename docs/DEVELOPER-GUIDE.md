# Developer Guide — e-Proc MVP

Panduan ini menjelaskan alur aplikasi untuk maintainer yang belum terlalu
familiar dengan React.

## Mental model

- **Type** (`lib/procurement-types.ts`) menetapkan bentuk data.
- **Adapter** (`lib/procurement-data.ts`, `lib/google-sheets.ts`) membaca dan
  menyimpan data dari sumber eksternal.
- **State** (`workspace` di `app/procurement-app.tsx`) adalah snapshot yang
  sedang ditampilkan React.
- **Component** menerima data dan callback melalui props. Component tidak perlu
  tahu apakah datanya berasal dari XLSX, Sheets, Apps Script, atau MySQL.

## Alur tambah/edit pengadaan

1. Dialog mengubah `draft` melalui `updateDraft`.
2. `saveDraft` memvalidasi field wajib dan menghitung vendor pemenang/nilai.
3. Jika Sheets tersambung, `GoogleSheetsWorkspaceAdapter.upsertProcurement`
   menulis ke tab utama terlebih dahulu.
4. Setelah penyimpanan sukses, React memperbarui `workspace.records`.
5. Record baru selalu memakai baris setelah data terakhir, bukan lubang kosong
   di tengah sheet.

## Alur import

`XlsxWorkspaceAdapter.import` membaca header lama, mengubah nilai tanggal dan
currency, membuat `recordUid`, lalu menormalisasi Request ID untuk tampilan.
Import XLSX hanya mengubah workspace browser; ia tidak otomatis menimpa Google
Sheets.

## Alur sinkronisasi Sheets

Google OAuth menghasilkan access token sementara di memory. Adapter kemudian:

1. Membaca tab master asli.
2. Membentuk workbook sementara di browser.
3. Memakai normalizer XLSX yang sama agar hasil import dan Sheets konsisten.
4. Menulis CRUD langsung ke `MASTER DATABASE PENGADAAN`, `MASTER PIC`,
   `VENDOR REKANAN`, dan `PENAWARAN VENDOR`.

## Menambah field baru

1. Tambahkan property di `ProcurementRecord`.
2. Tambahkan default di `blankDraft`.
3. Tambahkan input di `AddProcurementDialog`.
4. Tambahkan mapping baca/export di `procurement-data.ts`.
5. Tambahkan mapping tulis di `google-sheets.ts`.
6. Tambahkan test untuk header atau kalkulasi yang terpengaruh.

## Mengganti backend nanti

Buat adapter baru, misalnya `AppsScriptWorkspaceAdapter`, dengan operasi load,
create, update, dan delete yang menghasilkan type domain yang sama. Jangan
ubah component dashboard/form hanya untuk menyesuaikan bentuk response API;
normalisasi response di adapter.

## Aturan keamanan

- OAuth Client ID boleh berada di browser; Client Secret tidak boleh.
- Jangan menyimpan access token Google di localStorage.
- Validasi domain dan role harus dilakukan server-side sebelum multi-user.
- Operasi delete perlu confirmation dan audit log ketika backend server sudah
  dipakai.
