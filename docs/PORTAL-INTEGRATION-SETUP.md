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

Untuk pembaruan memo/nomor request, simpan kode lalu perbarui **deployment yang
URL `/exec`-nya digunakan aplikasi**: kelola deployment, edit deployment tersebut,
pilih versi baru, lalu terapkan. Menyimpan kode editor saja tidak memperbarui versi
yang dipanggil aplikasi. Jika membuat deployment baru, URL konfigurasi aplikasi
juga harus diperbarui. Proxy mendahulukan `APPS_SCRIPT_URL`, lalu memakai
`NEXT_PUBLIC_APPS_SCRIPT_URL` jika variabel pertama kosong.

Frontend terbaru memeriksa `masterWriteContract` dari `getProcurementSession`
sebelum setiap penyimpanan pengadaan. Backend harus mengembalikan
`nomor-request-memo-pembelian-v1`. Backend lama ditolak sebelum record dikirim.
Frontend hosting juga perlu di-deploy ulang agar pemeriksaan ini aktif.

Jika kolom `Tanggal Memo` sudah terlanjur terisi, jalankan
`migrateMemoToPembelian()` dari editor setelah memperbarui backend. Fungsi membuat
backup sebelum memindahkan nilai ke `Tanggal Memo Pembelian`, termasuk menimpa
nilai tujuan yang berbeda, lalu mengosongkan sumber dan memperbarui SLA. Periksa
hasil sebelum menghapus kolom sumber yang kosong. Kolom `Request ID Asli` lama
masih bisa diperlukan untuk relasi historis; kode baru tidak membuat atau mengisinya.

### Format tanggal Indonesia

Frontend memakai `dd-MMM-yyyy`, misalnya `17-Sep-2026`, termasuk form kalender,
tabel, dan ekspor laporan. Nama bulan menggunakan bahasa Indonesia (`Mei`, `Agu`,
`Okt`, `Des`). Nilai internal/API tetap ISO agar filter dan SLA konsisten.

Setelah menyalin seluruh `ProcurementReview.gs` terbaru, jalankan
`normalizeProcurementDates` sekali di editor Apps Script. Fungsi ini memvalidasi
tanggal lama sebelum menulis, mengonversi teks tanggal ke nilai tanggal asli,
mempertahankan formula dan sel kosong, serta memformat seluruh kolom tanggal dan
periode pada semua master dataset, termasuk arsip. Tanggal tidak valid membatalkan
proses validasi dan harus diperbaiki sebelum dijalankan ulang.

Spreadsheet menggunakan locale `id_ID` agar nama bulan Indonesia konsisten;
locale ini juga memengaruhi tampilan angka pada spreadsheet. Tanggal diproses
mengikuti zona waktu spreadsheet. Penyimpanan baru otomatis memakai format
`dd-mmm-yyyy`. Perbarui deployment `/exec` yang digunakan aplikasi dan deploy ulang
frontend untuk mengaktifkan perubahan di aplikasi online.

Referensi: [format tanggal Google Sheets](https://developers.google.com/workspace/sheets/api/guides/formats).

### Rumus SLA di master database

Setelah memperbarui `ProcurementReview.gs`, jalankan `backfillProcurementSlaFormulas`
sekali dari editor Apps Script untuk mengisi kolom SLA pada record lama di seluruh
dataset terdaftar (termasuk arsip). Fungsi ini mengganti isi kolom SLA yang dikenali
dengan rumus, tanpa menambah atau memindahkan header. Simpan/edit pengadaan dan
promosi request berikutnya otomatis memasang rumus pada baris terkait.

Pemetaan mengikuti header SLA yang sudah ada (spasi/baris baru diabaikan):

- SLA pengadaan: Tanggal Request → Tanggal Memo.
- SLA approval memo: Tanggal Memo → Tanggal Send FPC.
- SLA FPC: Tanggal Send FPC → Tanggal Approval FPC.
- SLA total / sampai PO: Tanggal Request → Tanggal PO.

Rumus memakai `NETWORKDAYS(awal,akhir)-NETWORKDAYS(awal,awal)` agar tanggal awal
tidak dihitung, sama seperti dashboard. Sabtu/Minggu dikecualikan; kalender libur
belum ditambahkan. Tanggal kosong, tidak valid, atau terbalik menghasilkan sel
kosong; tanggal sama menghasilkan 0. Nilai berupa durasi aktual hari kerja,
bukan selisih terhadap target 5 hari. Dashboard tetap merata-ratakan record Complete.

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
