# PT. CLX Invoice & Termin Management System

Aplikasi manajemen invoice, kontrol termin 35% / 60% / 5%, verifikasi pembayaran, reminder retensi 1 tahun, dan generator PDF A4 untuk **PT. Connectivity Leads eXcellence (PT. CLX)** yang terhubung langsung ke Google Sheets.

## Fitur Utama

1. **Integrasi Langsung Sheet `Query`**:
   - Filter otomatis hanya baris dengan **Kolom B (`EPC Name`) = `"CLX"`** dan **Kolom W (`Cons WO number`)** yang terisi.
   - Mengambil **Kolom C (`Charging Type`)**, **Kolom F (`Project / Location Name`)**, **Kolom W (`Cons WO number`)**, dan **Kolom Y** (tanggal dasar retensi 1 tahun).
2. **Database Google Sheets Otomatis (`Invoices_DB`)**:
   - Membuat tab `Invoices_DB` beserta header & format secara otomatis jika belum ada di spreadsheet Anda.
   - Setiap pembuatan, edit, dan verifikasi pembayaran langsung tersimpan ke Google Sheets.
3. **Input Invoice Lama (Legacy) & Auto-Numbering**:
   - Mendukung input invoice lama untuk migrasi ke sistem.
   - Penomoran otomatis `<SEQ>/INV/CLX/<BULAN_ROMAWI>/<TAHUN>` bebas duplikasi.
4. **Proteksi Termin 35% -> 60% -> 5% (Anti Double-Billing)**:
   - Jika Termin 35% sudah diterbitkan untuk `Charging Type` dan `Project / Location Name` yang sama, sistem mengunci 35% dan hanya mengizinkan Termin 60% lalu 5%.
5. **PDF A4 Profesional + Logo PT. CLX**:
   - Preview interaktif A4 dan download langsung file `.pdf` dengan logo PT. CLX, rincian item, kalkulasi Termin + PPN 11%, Terbilang (English), Info Rekening BCA, dan tanda tangan.
6. **Reminder 1 Tahun Termin 5%**:
   - Menghitung jatuh tempo `+1 tahun` dari tanggal pada **Kolom Y** sheet `Query`.
7. **Verifikasi Pembayaran & Executive Dashboard**:
   - Pencatatan pelunasan customer beserta referensi transfer, serta ringkasan KPI, grafik bulanan, dan matriks termin proyek.

## Menjalankan Secara Lokal & Deploy ke Vercel

```bash
npm install
npm run dev
```

Build produksi untuk Vercel:

```bash
npm run build
```

Saat deploy ke Vercel & akses multi-user (Tim Finance):
1. Push repository ini ke GitHub.
2. Import project di Vercel (Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`).
3. Tambahkan domain Vercel Anda (misalnya `nama-app.vercel.app`) ke **Authorized Domains** di Firebase Console (`Authentication > Settings > Authorized domains`) agar tidak muncul error `auth/unauthorized-domain`.
4. Di Google Cloud Console (`APIs & Services > OAuth consent screen` pada project `gen-lang-client-0070600289`), tambahkan seluruh email user finance ke **Test users** (atau klik **Publish App** ke Production) agar email selain pemilik project tidak terkena `Error 403: access_denied`.
5. Pastikan email user finance tersebut juga sudah di-*Share* sebagai **Editor** pada file Google Spreadsheet target.

