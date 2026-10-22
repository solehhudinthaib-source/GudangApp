# GudangApp — Sistem Informasi Manajemen Gudang Berbasis Web

Aplikasi pencatatan stok untuk dua gudang (**Shell** dan **Office**) dalam satu sistem,
tanpa biaya server. Proyek Kerja Praktik / Rekayasa Perangkat Lunak, Universitas Pamulang.

**Tim Kerja Praktik:** Aida Salsabila · Riyon Amisela · Solehudin Thaib

## Arsitektur

| Lapisan | Teknologi | Isi |
|---|---|---|
| Presentation | HTML, CSS, JavaScript di Google Sites | `frontend/GudangApp_frontend.html` |
| Application | Google Apps Script Web App | `backend/Code.gs` (`doGet/doPost → handleAction → requireAuth`) |
| Data | Google Sheets | `Users`, `Produk_<gudang>`, `Transaksi_<gudang>`, `Return_<gudang>`, `SuratJalan` |

Frontend dan backend berkomunikasi dengan **JSONP** (lintas domain Google Sites ↔ Apps Script).

## Fitur

- Login dengan password ter-hash SHA-256 dan token HMAC-SHA256 (berlaku 8 jam)
- Empat peran (RBAC, ditegakkan di server): Super Admin, Supervisor, Petugas Gudang, Finance (hanya lihat)
- Dashboard, Cari Barang, Barang Masuk/Keluar, Stok Opname, Laporan + ekspor PDF,
  Upload Excel, Return Rusak, Kelola User
- **Surat Jalan** (v4.5): cetak gabungan beberapa barang keluar, nomor otomatis
  `API/SJ/<urut>/<dd>/<MM>/<yyyy>` (LockService), riwayat, cetak ulang, peringatan barang keluar tanpa surat jalan

## Riwayat versi

| Versi | Perubahan |
|---|---|
| 4.1 | Return rusak mengurangi stok; pembaruan stok dipusatkan di `updateStok()` |
| 4.2 | Aksi `editProduk` |
| 4.3 | Aksi `getAll` (semua data dua gudang dalam satu permintaan) |
| 4.4 | Peran Super Admin + Kelola User; peran dicek ulang ke sheet `Users` setiap permintaan |
| 4.5 | Fitur Surat Jalan |
| 4.5.1 | Pesan hasil/gagal surat jalan lebih jelas, tautan cadangan PDF |
| 4.5.2 | Perbaikan kotak unggah Excel (klik, seret-lepas, validasi jenis berkas) |

Catatan rilis lengkap ada di folder `docs/`.

## Cara memasang

1. Buat Google Spreadsheet baru, buka **Extensions → Apps Script**, tempel isi `backend/Code.gs`.
2. Ganti `const SECRET = 'GANTI_DENGAN_SECRET_ANDA'` dengan teks rahasia milik Anda sendiri.
3. Jalankan fungsi `setupUsers` sekali untuk membuat akun awal, lalu **segera ganti password bawaan**
   melalui menu Kelola User.
4. **Deploy → New deployment → Web app** (Execute as: Me, Who has access: Anyone). Salin URL `/exec`.
5. Di `frontend/GudangApp_frontend.html`, ganti `GANTI_DENGAN_ID_DEPLOYMENT` pada `const API` dengan URL tadi.
6. Tempel isi frontend ke Google Sites (Insert → Embed → Embed code), lalu Publish.

> Kunci rahasia (`SECRET`) dan alamat deployment asli sengaja tidak disertakan di repositori ini.

## Dokumentasi

- `docs/uml/` — diagram UML (Enterprise Architect): Use Case, Activity (AD-01..08),
  Sequence (SD-01..09), Class (CD-01), beserta berkas proyek `.eap`
- `docs/Presentasi_GudangApp.pdf` — presentasi proyek
- Metode pengembangan: RAD (Rapid Application Development), lima iterasi
- Pengujian: black-box (9 skenario) + uji simulasi backend Surat Jalan (20/20 lulus)
