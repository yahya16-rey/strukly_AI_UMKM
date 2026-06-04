# Strukly AI UMKM

Repository ini merupakan salah satu tempat pengerjaan dalam pembuatan platform Strukly AI untuk UMKM. Proyek ini terdiri dari tiga komponen utama: Backend (Node.js/Express), Frontend (React/Vite), dan Dashboard Analitik (Python/Streamlit).

## Tautan Penting
- **Project Plan**: [Google Docs](https://docs.google.com/document/d/1UEJNAmu9MXZKZW7bGTWOdXTWs8MqENqgKXFwyrzDEAA/edit?usp=sharing)
- **TimeLine**: [Google Sheets](https://docs.google.com/spreadsheets/d/1FcNc3OGyA99YZZRUjjffMi1BlnkT-F0uetX0P6g5tQE/edit?gid=828825184#gid=828825184)

---

## 🚀 Panduan Penggunaan / Cara Menjalankan Kode (Reuse Code)

Pastikan sistem Anda telah terinstal perangkat lunak berikut sebelum mencoba menjalankan aplikasi di lokal:
- **Node.js** (minimal versi 22.0.0 atau yang lebih baru untuk frontend/backend)
- **Python 3** (untuk menjalankan Dashboard)
- **PostgreSQL** (untuk database backend)

### 1. Setup Backend (Node.js & Express)
Backend bertanggung jawab untuk API, autentikasi, database, dan pengolahan data utama.
1. Masuk ke direktori backend:
   ```bash
   cd backend
   ```
2. Instal semua dependensi proyek:
   ```bash
   npm install
   ```
3. Konfigurasi Environment Variables (Variabel Lingkungan):
   - Salin isi dari `.env.example` ke file baru bernama `.env`.
   - Sesuaikan konfigurasi database PostgreSQL (`PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`, `PGPORT`) agar sesuai dengan database lokal Anda.
4. Jalankan migrasi database untuk membuat struktur tabel:
   ```bash
   npm run migrate
   ```
5. Jalankan server backend dalam mode pengembangan (development):
   ```bash
   npm run dev
   ```
   *Server akan berjalan di `http://localhost:5000` (atau sesuai `PORT` di file `.env`).*

### 2. Setup Frontend (React & Vite)
Frontend berisi antarmuka pengguna (UI) utama dari aplikasi Strukly AI.
1. Buka terminal baru dan masuk ke direktori frontend:
   ```bash
   cd frontend
   ```
2. Instal semua dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi Environment Variables:
   - Buat file `.env` (bisa meniru `.env.example`).
   - Pastikan URL API backend sesuai dengan environment Anda (misal `VITE_API_BASE_URL=http://localhost:5000` jika dijalankan secara lokal).
4. Mulai server Vite untuk frontend:
   ```bash
   npm run dev
   ```
   *Frontend web dapat diakses pada browser (biasanya di `http://localhost:5173`).*

### 3. Setup Dashboard (Python & Streamlit)
Bagian Dashboard digunakan untuk melakukan visualisasi lanjutan dan analisis data secara lebih interaktif.
1. Buka terminal baru dan masuk ke dalam direktori Dashboard:
   ```bash
   cd Dashboard
   ```
2. (Opsional namun disarankan) Buat dan aktifkan virtual environment (lingkungan virtual) Python:
   ```bash
   python -m venv venv
   # Jika menggunakan Windows:
   venv\Scripts\activate
   # Jika menggunakan Mac/Linux:
   source venv/bin/activate
   ```
3. Instal semua pustaka Python yang dibutuhkan:
   ```bash
   pip install -r requirements.txt
   ```
4. Jalankan server aplikasi Streamlit:
   ```bash
   streamlit run Dashboard_UMKM.py
   ```
   *Halaman dashboard analitik akan terbuka otomatis di browser (biasanya pada `http://localhost:8501`).*
