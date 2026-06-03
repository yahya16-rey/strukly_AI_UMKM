import dotenv from "dotenv";
dotenv.config(); 

import app from "./app.js";
import pool from "./config/db.js";

const PORT = process.env.PORT || 5000;

try {
    const res = await pool.query("SELECT NOW()");
    console.log("DB connected:", res.rows[0]);

    // Auto-migrate categories
    console.log("Running auto-migration for categories...");
    await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'expense';`);
    await pool.query(`UPDATE categories SET type = 'expense' WHERE type IS NULL;`);
    
    const expenses = [
      { id: 0, name: 'ATK/Administrasi' },
      { id: 1, name: 'Fashion' },
      { id: 2, name: 'Kesehatan' },
      { id: 3, name: 'Makanan & Bahan Makanan' },
      { id: 4, name: 'Minuman & Bahan Minuman' },
      { id: 5, name: 'Perlengkapan Operasional' },
      { id: 12, name: 'Pajak' }
    ];
    for (const exp of expenses) {
      await pool.query(`
        INSERT INTO categories (id, name, type) 
        VALUES ($1, $2, 'expense') 
        ON CONFLICT (id) DO UPDATE SET name = $2, type = 'expense';
      `, [exp.id, exp.name]);
    }

    const incomes = [
      { id: 6, name: 'Penjualan Produk' },
      { id: 7, name: 'Penjualan Makanan' },
      { id: 8, name: 'Penjualan Minuman' },
      { id: 9, name: 'Jasa' },
      { id: 10, name: 'Lainnya' }
    ];
    for (const inc of incomes) {
      await pool.query(`
        INSERT INTO categories (id, name, type) 
        VALUES ($1, $2, 'income') 
        ON CONFLICT (id) DO UPDATE SET name = $2, type = 'income';
      `, [inc.id, inc.name]);
    }
    await pool.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));`);
    console.log("Category migration finished.");
} catch (err) {
    console.error("DB error:", err);
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
