import { getCategoryByName } from "../models/CategoryModel.js";

export const getMappedCategoryId = async (classes, ocrCategoryName) => {
    // 1. Pemetaan menggunakan classes (Integer) dari respon OCR
    if (classes !== null && classes !== undefined && classes !== '') {
        const classInt = parseInt(classes, 10);
        if (classInt >= 0 && classInt <= 5) {
            return classInt; // ID database langsung cocok dengan index kelas (0 s.d 5)
        }
    }

    // 2. Fallback jika classes tidak tersedia, menggunakan nama kategori
    if (ocrCategoryName) {
        const nameMap = {
            "ATK/Administrasi": 0,
            "Fashion": 1,
            "Kesehatan": 2,
            "Makanan & Bahan Makanan": 3,
            "Minuman & Bahan Minuman": 4,
            "Perlengkapan Operasional": 5,
            
            // Dukungan nama lama dipetakan ke ID baru
            "Bahan Baku": 3,
            "Listrik & Air": 5,
            "Gaji Karyawan": 5,
            "Peralatan": 5,
            "Pajak": 12,
            
            // Format lowercase
            "atk/administrasi": 0,
            "fashion": 1,
            "kesehatan": 2,
            "makanan & bahan makanan": 3,
            "minuman & bahan minuman": 4,
            "perlengkapan operasional": 5
        };

        const trimmedName = String(ocrCategoryName).trim();
        if (nameMap[trimmedName] !== undefined) {
            return nameMap[trimmedName];
        }

        // Cek case-insensitive
        const lowerName = trimmedName.toLowerCase();
        for (const [key, val] of Object.entries(nameMap)) {
            if (key.toLowerCase() === lowerName) {
                return val;
            }
        }
    }

    // 3. Jika tidak ada yang cocok, gunakan kategori default "Belum Dikategorikan"
    return await getUncategorizedId();
};

export const getUncategorizedId = async () => {
    try {
        const cat = await getCategoryByName("Belum Dikategorikan");
        return cat?.id || null;
    } catch (e) {
        console.error("Failed to get 'Belum Dikategorikan' category:", e);
        return null;
    }
};
