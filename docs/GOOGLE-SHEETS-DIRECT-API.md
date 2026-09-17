# Google Sheets Database — Setup Procurement Sheets Lab

Eksperimen ini memakai **Google Sheets API langsung dari browser**, bukan Apps Script. Pilihan ini paling ringkas untuk tahap awal karena login Drive dan Sheets memakai satu OAuth Client ID dan hak akses tetap mengikuti akun Google yang sedang login.

## Yang perlu disiapkan

1. Spreadsheet hasil upload workbook `Master_Data_Pengadaan_Dashboard.xlsx`.
2. Project Google Cloud `e-proc mvp` yang sudah dipakai untuk Google Drive.
3. OAuth Web Client ID yang sudah berfungsi di Procurement Control.

## 1. Aktifkan Google Sheets API

Di Google Cloud Console:

1. Buka project `e-proc mvp`.
2. Masuk ke **APIs & Services → Library**.
3. Cari **Google Sheets API**.
4. Klik **Enable**.
5. Pastikan **Google Drive API** tetap aktif.

Dokumentasi resmi: https://developers.google.com/sheets/api/guides/concepts

## 2. Tambahkan origin site eksperimen

Buka **APIs & Services → Credentials → OAuth 2.0 Client IDs → Web client**.

Tambahkan ke **Authorized JavaScript origins**:

```text
http://localhost:5173
https://procurement-sheets-lab.reimitsune.chatgpt.site
```

Google Identity Services token client tidak memerlukan callback URL untuk alur browser yang dipakai app ini.

## 3. Hubungkan dari aplikasi

1. Buka **Pengaturan**.
2. Isi **OAuth Client ID**.
3. Klik **Hubungkan Google** dan pilih akun kantor yang memiliki akses edit ke spreadsheet.
4. Paste URL lengkap spreadsheet pada bagian **Google Sheets Database**.
5. Klik **Hubungkan & Muat**.

Contoh URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

App membaca dan menulis langsung ke tab utama berikut. Tidak ada tab salinan `APP_*`:

| Tab | Fungsi |
|---|---|
| `MASTER DATABASE PENGADAAN` | Satu baris per pengadaan; sumber dashboard dan Expense |
| `PENAWARAN VENDOR` | Satu baris per peserta tender |
| `MASTER PIC` | Referensi PIC, divisi, jabatan, lokasi, dan email |
| `VENDOR REKANAN` | Profil, kontak, kategori, serta tracking vendor |
| `DOKUMEN PENGADAAN` | Dibaca sebagai referensi dokumen jika tersedia |

Nama header dicocokkan secara dinamis, sehingga posisi kolom boleh bergeser. Untuk record baru, app menyalin format dan formula dari baris sebelumnya lalu hanya mengisi atribut yang dikelola app.

## 4. Cara kerja CRUD

- **Tambah pengadaan:** selalu ditulis setelah baris data terakhir pada `MASTER DATABASE PENGADAAN`; celah kosong di tengah tidak dipakai.
- **Edit pengadaan:** hanya sel atribut terkait yang ditulis; formula lain di baris tetap dipertahankan.
- **Tender:** peserta ditulis per baris ke `PENAWARAN VENDOR` dan hanya muncul di form ketika metode Tender dipilih.
- **PIC dan Vendor:** tambah/edit/hapus, termasuk batch delete, lewat menu app dan langsung mengubah master masing-masing.
- **Delete:** dialog konfirmasi muncul sebelum baris utama dan relasi penawaran dihapus.
- **Refresh:** perubahan dari editor lain dibaca otomatis setiap 30 detik atau melalui tombol **Sync**.
- **Import XLSX:** tetap tersedia sebagai fallback dan untuk migrasi file lain.
- **Report:** laporan harian, mingguan, bulanan, triwulanan, tahunan, atau custom dapat diekspor ke PDF, DOCX, dan XLSX.

## 5. Model keamanan tahap eksperimen

- Access token OAuth hanya disimpan di memori browser dan hilang saat halaman ditutup/refresh.
- Aplikasi tidak menyimpan Google Client Secret.
- Google Sheets API memeriksa apakah akun memiliki hak view/edit ke spreadsheet.
- Jangan membuat spreadsheet public atau `Anyone with the link`.
- Sebelum uji CRUD pertama, buat salinan backup spreadsheet karena perubahan memang ditujukan langsung ke sheet utama.
- Untuk sekarang gunakan satu editor aktif pada satu waktu. Auto-refresh membaca perubahan setiap 30 detik, tetapi belum ada transaksi lintas-user.

## 6. Batasan dan upgrade path

Mode direct API cocok untuk eksperimen dan penggunaan single-editor. Kalau beberapa user akan mengedit secara bersamaan, pindahkan adapter ke salah satu opsi berikut tanpa mengubah UI:

1. **Apps Script Web App + LockService** untuk serialisasi Request ID dan operasi row-level.
2. **Cloudflare Worker/API internal** untuk verifikasi token Google dan role domain.
3. **MySQL/PostgreSQL** untuk transaksi, audit trail, dan concurrency penuh.

Panduan Apps Script alternatif tersedia di `docs/GOOGLE-SHEETS-APPS-SCRIPT.md`.

Referensi resmi:

- Google Sheets API: https://developers.google.com/sheets/api/guides/concepts
- Google Identity Services: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- Apps Script LockService: https://developers.google.com/apps-script/reference/lock/lock-service
