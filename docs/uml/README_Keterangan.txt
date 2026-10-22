GUDANGAPP - DIAGRAM UML VERSI 4.5 (FITUR SURAT JALAN)
======================================================
Tanggal pembuatan : 8 Oktober 2026
Dibuat dengan     : Enterprise Architect 7.5 (berkas .eap), digambar dari kode program
Sesuai dengan     : Code_v4.5.gs dan GudangApp_frontend_v4.5.html
                    (folder Downloads\GudangApp_v4.5)

>>> FOLDER INI = VERSI TERBARU (4.5, sudah memuat fitur Surat Jalan).
>>> Versi sebelumnya (4.4, tanpa Surat Jalan) ada di folder
    Downloads\GudangApp_Diagram\EA  -- jangan dicampur dengan folder ini.

ISI FOLDER
----------
Berkas                              Status dibanding v4.4   Keterangan
GudangApp_UML_v4.5.eap              DIPERBARUI              Project EA lengkap. Paket: Use Case, Class, Sequence, Activity.
UC-01_UseCase.png                   DIPERBARUI              4 aktor, 15 use case. Baru: Cetak surat jalan (extend dari
                                                            Catat barang keluar), Lihat riwayat surat jalan, Lihat peringatan
                                                            surat jalan. Ketiganya untuk Super Admin, Supervisor, Petugas
                                                            (Finance tidak).
CD-01_Class.png                     DIPERBARUI              Baru: kelas SuratJalan (createSuratJalan, getSuratJalan,
                                                            getTertunda) dan relasi "memuat" ke Transaksi.
AD-01_Login.png                     sama
AD-02_BarangMasuk.png               sama
AD-03_BarangKeluar.png              sama
AD-04_EditProduk.png                sama
AD-05_ReturnRusak.png               sama
AD-06_CariBarang.png                sama
AD-07_KelolaUser.png                sama
AD-08_CetakSuratJalan.png           BARU                    Alur: dialog cetak setelah simpan barang keluar, cetak sekarang
                                                            atau nanti, pembuatan nomor, PDF, tanda tangan.
SD-01_Login.png                     sama
SD-02_BarangMasuk.png               sama
SD-03_BarangKeluar.png              sama
SD-04_EditProduk.png                sama
SD-05_ReturnRusak.png               sama
SD-06_CariBarang.png                sama
SD-07_KelolaUser.png                sama
SD-08_CetakSuratJalan.png           BARU                    createSuratJalan: requireAuth, nomor urut (LockService), validasi
                                                            transaksi, simpan ke sheet SuratJalan, PDF.
SD-09_PeringatanSuratJalan.png      BARU                    getTertunda: hitungan barang keluar tanpa surat jalan, lencana
                                                            menu dan spanduk peringatan.

Catatan: berkas "sama" isinya tidak berubah dari v4.4 (digambar ulang bersama project).

CARA MEMBUKA
------------
Buka GudangApp_UML_v4.5.eap dengan Enterprise Architect. Diagram ada di panel Project Browser,
paket "Use Case", "Class", "Sequence", dan "Activity".

CATATAN TAMPILAN DI ENTERPRISE ARCHITECT
----------------------------------------
- Kelas CodeGS memakai stereotype "controller" (bukan "control"), karena stereotype "control"
  dipaksa EA tampil sebagai ikon lingkaran yang menyembunyikan daftar method. Bila dosen meminta
  "control": ubah stereotype di Properties, lalu aktifkan Use Rectangle Notation.
- Atribut dan method tampil berurutan alfabetis (perilaku EA), isinya sama dengan kode.
- Label pesan sequence berbentuk "aksi (rincian)" karena EA otomatis menambah tanda kurung.
- Kotak alt/opt tidak memakai operand asli EA: garis else digambar putus-putus. Bila jumlah pesan
  di dalamnya diubah, geser garis dan label else secara manual.
