# Aktivasi Login dan Document Review

## 1. Daftarkan Procurement Admin

Pada sheet `PORTAL_USERS`, isi satu baris per admin:

```text
EMAIL                     | ROLE              | ACTIVE
nama@nanobanksyariah.id   | PROCUREMENT_ADMIN | TRUE
```

Role reviewer digabung sebagai `PROCUREMENT_ADMIN`. Jangan memakai role dari payload browser.

## 2. Siapkan schema add-on portal

Dari editor Apps Script jalankan satu kali fungsi `ensureProcurementPortalSchema`. Fungsi ini hanya menambah header berikut pada sheet `PORTAL_*` dan tidak menyentuh header master:

- `PORTAL_REQUESTS`: `MASTER_REQUEST_ID`, `PO_NUMBER`, `PO_URL`
- `PORTAL_DOCUMENTS`: `REVIEWED_AT`, `REVIEWED_BY`

## 3. Deploy Apps Script

Salin/sinkronkan `BackendPortal.gs`, `RouterPortal.gs`, dan `ProcurementReview.gs` ke project Apps Script yang sama. Pertahankan satu `doGet`, satu `doPost`, dan satu `handleRequest_`. Deploy versi baru sebagai Web App dengan akses dibatasi ke organisasi.

Pastikan Script Property `GOOGLE_CLIENT_ID` sama dengan Client ID yang dipakai frontend.

## 4. Konfigurasi MVP

Salin `.env.example` menjadi `.env.local`, lalu isi:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

Tambahkan origin lokal dan production MVP ke Authorized JavaScript origins pada OAuth Client ID.

## 5. Uji akses

1. Login memakai email tanpa role: backend harus mengembalikan `FORBIDDEN`.
2. Login admin: menu Document Review harus tampil.
3. Submit request dari portal requester.
4. Jalankan Start Review, review seluruh dokumen wajib sebagai Valid, lalu Approve.
5. Promote ke master; klik kedua harus mengembalikan record yang sama tanpa append baru.
6. Ubah status atau nomor PO dari master, kemudian pastikan portal menerima status terbaru.

## Catatan keamanan

- ID token hanya berada di memori tab MVP.
- Email dan role selalu dibaca ulang oleh Apps Script.
- Promotion memakai `Request ID Asli` sebagai kunci rekonsiliasi.
- Header production tidak dibuat, dihapus, atau diurutkan ulang secara otomatis.
