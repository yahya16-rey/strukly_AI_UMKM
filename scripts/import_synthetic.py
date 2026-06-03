import os
import csv
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Try to load environment variables from multiple possible locations
load_dotenv()
if os.path.exists("backend/.env"):
    load_dotenv("backend/.env")
elif os.path.exists("../backend/.env"):
    load_dotenv("../backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set. Please set it in backend/.env")

def map_category(raw_category, type_name):
    raw = str(raw_category).lower().strip()
    
    if type_name == 'pengeluaran':
        if 'atk' in raw or 'administrasi' in raw:
            return 0  # ATK/Administrasi
        elif 'fashion' in raw:
            return 1  # Fashion
        elif 'kesehatan' in raw:
            return 2  # Kesehatan
        elif 'makanan' in raw:
            return 3  # Makanan & Bahan Makanan
        elif 'minuman' in raw:
            return 4  # Minuman & Bahan Minuman
        elif 'operasional' in raw or 'perlengkapan' in raw:
            return 5  # Perlengkapan Operasional
        elif 'pajak' in raw:
            return 12  # Pajak
        else:
            return 11  # Belum Dikategorikan
            
    elif type_name == 'pemasukan':
        if 'makanan' in raw:
            return 7  # Penjualan Makanan
        elif 'minuman' in raw:
            return 8  # Penjualan Minuman
        elif 'jasa' in raw:
            return 9  # Jasa
        elif 'lain' in raw:
            return 10  # Lainnya
        else:
            return 6  # Penjualan Produk (Default income)
            
    return 11  # Default fallback: Belum Dikategorikan

def main():
    csv_file = "data/Data_Sintesis/synthetic_umkm_10000.csv"
    if not os.path.exists(csv_file):
        # try relative to the script location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        csv_file = os.path.join(script_dir, "../data/Data_Sintesis/synthetic_umkm_10000.csv")
        
    if not os.path.exists(csv_file):
        raise FileNotFoundError(f"File not found: {csv_file}")
        
    print("Connecting to DB...")
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    print("Ensuring user 999 exists with valid bcrypt password hash...")
    # $2b$10$6XBPqLrPxcNwvtZKu/HYxeyWHdoBS3QLXhJ3qlS5W4/LcqyYDX1t6 is bcrypt hash for 'password123'
    demo_password_hash = "$2b$10$6XBPqLrPxcNwvtZKu/HYxeyWHdoBS3QLXhJ3qlS5W4/LcqyYDX1t6"
    cursor.execute("""
        INSERT INTO users (id, name, email, password) 
        VALUES (999, 'Akun Demo', 'demo@umkm.com', %s)
        ON CONFLICT (id) DO UPDATE SET password = %s;
    """, (demo_password_hash, demo_password_hash))
    
    print("Deleting existing synthetic transactions for user 999...")
    cursor.execute("DELETE FROM transactions WHERE user_id = 999 AND source = 'synthetic'")
    
    records = []
    with open(csv_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            transaction_date = row['waktu']
            merchant = row['keterangan']
            raw_type = row['type'].strip().lower()
            t_type = 'income' if raw_type == 'pemasukan' else 'expense'
            amount = float(row['nominal'])
            category_id = map_category(row['kategori'], raw_type)
            
            records.append((
                999,
                category_id,
                amount,
                merchant,
                transaction_date,
                'synthetic',
                t_type
            ))
            
    print(f"Prepared {len(records)} records for insertion. Executing bulk insert...")
    
    insert_query = """
    INSERT INTO transactions (user_id, category_id, amount, merchant, transaction_date, source, type)
    VALUES %s
    """
    
    execute_values(cursor, insert_query, records)
    conn.commit()
    
    cursor.close()
    conn.close()
    print("Successfully imported 10,000 synthetic data to PostgreSQL.")

if __name__ == "__main__":
    main()
