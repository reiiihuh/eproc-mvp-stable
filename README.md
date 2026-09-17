# Procurement Sheets Lab

Fork eksperimen Procurement Control berbasis React 19 dan TypeScript. Selain fitur dashboard, XLSX, Drive, scoring, dan laporan, versi ini menguji Google Sheets sebagai database CRUD langsung.

Versi aplikasi saat ini: **e-Proc MVP v1.5**.

## Menjalankan di Windows / VS Code

Prasyarat: Node.js 22 LTS dan npm.

```powershell
npm install
npm run dev
```

Buka URL yang muncul di terminal, biasanya `http://localhost:5173`.

ZIP source ini memakai konfigurasi hosting lokal yang sudah disanitasi. Ia tidak
membawa project ID, credential, token Google, data spreadsheet, atau identitas
deployment Sites. Tampilan dan fungsi aplikasinya tetap sama; hubungkan OAuth
Client ID dan Google Sheet lu kembali melalui menu Pengaturan.

Validasi production:

```powershell
npm run lint
npm test
npm run start
```

Tidak perlu menyalin `node_modules` dari komputer lain. Seluruh dependency dikunci di `package-lock.json` dan akan dipasang ulang oleh `npm install`.

Gunakan terminal **Command Prompt** di VS Code kalau PowerShell kantor memblokir
`npm.ps1`. Alternatifnya jalankan `npm.cmd install` dan `npm.cmd run dev`.

## Mulai memahami kodenya

Kalau baru belajar React, baca dengan urutan ini:

1. `lib/procurement-types.ts` — bentuk data yang dipakai seluruh aplikasi.
2. `app/procurement-app.tsx` — state utama dan alur antarmenu.
3. `components/procurement/add-procurement-dialog.tsx` — contoh form React terkontrol.
4. `lib/procurement-data.ts` — cara workbook lama dinormalisasi.
5. `lib/google-sheets.ts` — batas antara UI dan database Google Sheets.
6. `lib/report-export.ts` dan `lib/tender-scoring.ts` — kalkulasi serta export.

Komentar di source menjelaskan **alasan dan alur data** pada bagian core. Detail
JSX yang sudah jelas dari nama komponen tidak dikomentari agar file tetap mudah
dibaca.

## Struktur utama

- `app/procurement-app.tsx` — composition root: state, navigasi, dan orkestrasi CRUD.
- `app/globals.css` — token warna dan tema NanoBank Syariah.
- `components/procurement/` — form pengadaan, Drive browser, notifikasi, dan scoring tender.
- `components/ui/` — komponen UI reusable.
- `lib/procurement-data.ts` — adapter XLSX, mapping, penomoran, dan normalisasi.
- `lib/browser-download.ts` — helper download reusable untuk semua exporter.
- `lib/report-export.ts` — laporan periode harian sampai custom dalam PDF/DOCX/XLSX.
- `lib/tender-scoring.ts` — rumus scoring serta export XLSX/PDF/DOCX.
- `lib/google-drive.ts` — Google Identity Services dan Drive API.
- `lib/google-sheets.ts` — adapter Google Sheets API yang menulis langsung ke tab utama.
- `lib/procurement-types.ts` — kontrak data TypeScript.
- `public/brand/` — aset logo aplikasi.
- `docs/GOOGLE-SHEETS-DIRECT-API.md` — setup eksperimen Google Sheets API langsung.
- `docs/GOOGLE-SHEETS-APPS-SCRIPT.md` — alternatif Apps Script untuk tahap multi-user.

## Branding

Logo resmi berada di `public/brand/nanobank-syariah.png`. Warna utama:

- Nano navy: `#082F63`
- Nano green: `#73D94B`
- Supporting blue: `#2075B8`
- Background: `#F4F8FC`

Ubah token global terlebih dahulu di `app/globals.css`. Warna khusus chart dan PDF berada di `app/procurement-app.tsx` dan `lib/tender-scoring.ts`.

## Data dan keamanan saat ini

- Workspace masih file-based dan hidup di state browser.
- Token Google Drive hanya berada di memory sesi dan tidak disimpan ke local storage.
- Site production saat ini memakai access policy platform.
- OAuth Client ID boleh berada di client; OAuth Client Secret tidak boleh ditaruh di source.
- Akses UI sekarang memakai Google ID token yang diverifikasi Apps Script dan hanya menerima role `PROCUREMENT_ADMIN` dari `PORTAL_USERS`.
- Isi `.env.local` dari `.env.example`: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` dan `NEXT_PUBLIC_APPS_SCRIPT_URL`.
- Untuk multi-user production, aktifkan autentikasi server-side, role, audit log, dan adapter Apps Script/API sebelum menjadikan aplikasi sebagai system of record.

## Integrasi berikutnya

UI menggunakan kontrak data terpisah dari adapter. Mode XLSX dapat tetap dipertahankan sebagai import/export, sementara sumber utama diganti menjadi Google Sheets + Apps Script atau database API tanpa menulis ulang dashboard dan form.

Alur dependensi sengaja satu arah:

```text
React views → typed callbacks → workspace/adapters → XLSX, Sheets, atau API
```

Jangan memanggil Google API langsung dari komponen UI. Tambahkan integrasi baru
sebagai adapter di `lib/` agar form, dashboard, dan report tetap reusable.

Lihat [panduan Google Sheets dan Apps Script](docs/GOOGLE-SHEETS-APPS-SCRIPT.md).

## Catatan deploy

Folder `.openai/` di ZIP hanya berisi konfigurasi lokal tanpa `project_id`.
Credential OAuth, secret, access token, data Google Sheets, dan access policy
tidak disimpan di ZIP.

### Deploy test ke Vercel

Project ini memakai Vinext dengan output server Nitro, jadi preset Vercel-nya
bukan static Vite biasa.

1. Import repository ke Vercel dan biarkan `vercel.json` menjadi konfigurasi build.
2. Pilih Node.js `22.x`.
3. Tambahkan environment variable `APPS_SCRIPT_URL`,
   `NEXT_PUBLIC_APPS_SCRIPT_URL`, dan `NEXT_PUBLIC_GOOGLE_CLIENT_ID` untuk
   Production, Preview, dan Development.
4. Deploy. Build command yang dipakai adalah `npm run build:vercel` dan output
   Build Output API berada di `.vercel/output`.
5. Tambahkan origin deployment Vercel secara persis, misalnya
   `https://nama-project.vercel.app`, ke Google OAuth **Authorized JavaScript origins**.

Jangan menambahkan trailing slash pada OAuth origin. Untuk custom domain, tambahkan
origin custom domain tersebut juga.

### Dataset tahunan

Menu Pengaturan dapat membuat dataset tahunan kosong, memilih dataset untuk
dibaca, mengaktifkannya untuk request portal baru, mengarsipkan dataset nonaktif,
serta mengaktifkan kembali dataset arsip. Reset berlaku untuk dataset non-legacy
yang sedang tidak aktif, meminta konfirmasi `RESET DATASET_KEY`, dan membuat
ketiga sheet backup sebelum data transaksi dikosongkan. Setelah reset, status
kembali menjadi `READY / SANDBOX`. Jika sheet
`CONFIG DATASET` belum ada, backend otomatis memakai master lama tanpa migrasi.
