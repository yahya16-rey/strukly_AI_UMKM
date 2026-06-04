# Dokumentasi FastAPI

Repository ini berisi dokumentasi teknis mengenai struktur respons API dari **FastAPI** sebagai *Microservice AI*.

## Arsitektur Aliran Data
Aplikasi ini memisahkan beban kerja komputasi (AI) dari server backend utama

[Frontend UI] ➔ [Backend Utama (Traffic/DB)] ➔ [Microservice AI (PaddleOCR + Parser)]

---

##  Dokumentasi Endpoint Utama

### Pindai Struk Belanja (`Scan & Extract`)
Endpoint ini digunakan untuk menerima unggahan gambar struk dari frontend, mengirimkannya ke microservice AI, dan mengembalikan data transaksi yang sudah terstruktur bersih.

* **URL:** `/scan-ocr/`

###  Request Payload
* **`file`** *(Binary/File)* - **[Wajib]** File gambar struk belanja dari frontend (`.jpg`, `.jpeg`, `.png`).

---

## Response Structure (JSON)
`sukses` (Boolean)

Penanda apakah pipeline OCR dan parsing berjalan tanpa error internal. Bernilai false jika server crash atau memori penuh.

`ocr_mentah` (String)

Kumpulan seluruh teks terdeteksi yang digabungkan menggunakan per-line. Berisi teks acak yang tidak bermakna jika gambar sangat buram.

`date` (String)

Tanggal transaksi hasil ekstraksi Regex berformat kaku DD-MM-YYYY. Bernilai null jika tanggal tidak terdeteksi sama sekali.

`classes` (Integer)

Kode atau ID numerik yang mewakili kategori pengeluaran. Bernilai 0 atau null jika sistem gagal memetakan kelas.

0 : 'ATK/Administrasi'

1 : 'Fashion'

2 : 'Kesehatan' 

3 : 'Makanan & Bahan Makanan'

4 : 'Minuman & Bahan Minuman'

5 : 'Perlengkapan Operasional']

`category_name` (String)

Nama label string dari kategori pengeluaran berdasarkan hasil klasifikasi. Bernilai null jika tidak ada kata kunci yang cocok.

`merchant` (String)

Nama entitas toko atau tempat transaksi. Bernilai null jika logo atau nama toko terpotong dari foto.

`total` (Integer)

Angka nominal bersih total belanja yang sudah dibersihkan dari simbol mata uang (seperti 'Rp' atau titik). Bernilai 0 atau null jika teks harga hancur.

`items` (Array of Objects)

Array yang berisi rincian daftar belanjaan. Bernilai [] atau null jika tabel belanja tidak ditemukan di dalam struk.

`confidence` (float)

Tingkat probabilitas model AI terhadap hasil prediksi kategori (skala 0.0 hingga 1.0). Bernilai 0.0 atau null jika prediksi gagal.