import {
    createTransaction,
    getTransactions,
    updateTransaction,
    deleteTransaction,
} from "../models/TransactionModel.js";

import { getCategoryByName, getCategoryById } from "../models/CategoryModel.js";
import { sendToOCR } from "../service/OcrService.js";
import { createNotification } from "../models/NotificationModel.js";
import { getMappedCategoryId, getUncategorizedId } from "../service/CategoryMappingService.js";


// CREATE MANUAL

export const create = async (req, res) => {
    try {
        const data = req.body;

        if (!data.amount) {
            return res.status(400).json({ error: "Amount is required" });
        }

        let categoryId = data.category_id || null;
        if (!categoryId && data.category) {
            const cat = await getCategoryByName(data.category);
            categoryId = cat?.id;
        }
        
        if (!categoryId) {
            const uncategorizedId = await getUncategorizedId();
            categoryId = data.type === 'expense' ? (uncategorizedId || 5) : 1; // Default fallback
        }

        // Force tax transaction
        if (data.merchant === 'Pajak PPh Final 0.5%') {
            const taxCat = await getCategoryByName('Pajak');
            categoryId = taxCat?.id || 12;
            data.type = 'expense';
            console.log("Tax Transaction Intercepted/Created");
            console.log("Category ID:", categoryId);
            console.log("Transaction Type:", data.type);
        }

        const mappedData = {
            user_id: req.user.id,
            category_id: categoryId,
            amount: data.amount,
            merchant: data.merchant || "",
            transaction_date:
                data.transaction_date || new Date().toISOString().split("T")[0],
            source: "manual",
            type: data.type || "expense",
        };

        // Category Type Validation
        if (mappedData.category_id) {
            const categoryMeta = await getCategoryById(mappedData.category_id);
            if (categoryMeta && categoryMeta.type !== mappedData.type) {
                return res.status(400).json({ error: "Kategori tidak sesuai dengan jenis transaksi" });
            }
        }

        const result = await createTransaction(mappedData);

        // Add Notification
        const notifType = result.type === "income" ? "income" : "expense";
        const notifMsg = result.type === "income" ? `Pemasukan baru tercatat: Rp ${Number(result.amount).toLocaleString()}` : `Pengeluaran baru tercatat: Rp ${Number(result.amount).toLocaleString()}`;
        await createNotification(req.user.id, notifType, notifMsg);

        res.json({
            ...result,
            transactionId: result?.id,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// CREATE FROM OCR

export const createFromOCR = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "File is required" });
        }

        // 1. Kirim file ke FastAPI OCR (endpoint di env)
        let ocrResult;
        try {
            ocrResult = await sendToOCR(
                req.file.buffer,
                req.file.originalname,
            );
        } catch (ocrError) {
            console.error("AI Service Error:", ocrError);
            return res.status(502).json({
                error: "OCR service unavailable"
            });
        }

        // 5. Logging OCR RESPONSE sebelum proses mapping
        console.log("OCR RESPONSE:", ocrResult);

        // Defensive check in case ocrResult is empty/null/undefined
        if (!ocrResult) {
            return res.status(502).json({
                error: "OCR service unavailable"
            });
        }

        // Parse ocrResult if it arrives as stringified JSON
        if (typeof ocrResult === "string") {
            try {
                ocrResult = JSON.parse(ocrResult);
            } catch (e) {
                console.error("Failed to parse ocrResult string:", e);
                return res.status(502).json({
                    error: "OCR service unavailable"
                });
            }
        }

        // 2. Mapping & Fallbacks
        const rawMerchant = ocrResult.merchant;
        const merchant = rawMerchant || "Unknown Merchant";
        
        const amountVal = ocrResult.total !== undefined ? ocrResult.total : ocrResult.total_belanja;
        let amount = 0;
        if (typeof amountVal === "number") {
            amount = amountVal;
        } else if (typeof amountVal === "string" && amountVal.trim() !== "") {
            const match = amountVal.match(/\d[\d.,]*/);
            amount = match ? parseInt(match[0].replace(/[.,]/g, "")) : 0;
        }

        const missing_fields = [];

        // 6. Error Handling: Jika OCR berhasil tetapi amount kosong/0
        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: "OCR result missing amount. Silakan update ulang atau gunakan struk yang baru."
            });
        }

        if (!rawMerchant || rawMerchant === "Tidak ditemukan" || rawMerchant.trim() === "") {
            missing_fields.push("merchant");
        }

        // Confidence & need_review
        let confidence = 0;
        if (ocrResult.confidence !== undefined && ocrResult.confidence !== null) {
            confidence = parseFloat(ocrResult.confidence);
            if (isNaN(confidence)) {
                confidence = 0;
            }
        }

        // Transaction Date parsing (support DD-MM-YYYY to YYYY-MM-DD)
        const rawDate = ocrResult.date || ocrResult.tanggal_transaksi;
        let transaction_date = rawDate;
        if (transaction_date && typeof transaction_date === "string") {
            const parts = transaction_date.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[2].length === 4) { // Year is at the end (DD-MM-YYYY)
                    transaction_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else if (parts[0].length === 4) { // Year is at the front (YYYY-MM-DD)
                    transaction_date = `${parts[0]}-${parts[1]}-${parts[2]}`;
                }
            }
        }
        
        if (!transaction_date || transaction_date === "Tidak ditemukan" || String(transaction_date).trim() === "") {
            missing_fields.push("transaction_date");
            transaction_date = new Date().toISOString().split("T")[0];
        }

        // 3. Confidence Logic: need_review = confidence < 75 || missing_fields.length > 0
        const need_review = confidence < 75 || missing_fields.length > 0;

        // Items
        const items = Array.isArray(ocrResult.items) ? ocrResult.items : [];

        // Raw text
        const rawText = ocrResult.ocr_mentah || ocrResult.raw_text || "";

        // Category mapping
        const categoryId = await getMappedCategoryId(
            ocrResult.classes,
            ocrResult.category_id || ocrResult.category_name
        );
        
        console.log("OCR Category classes:", ocrResult.classes);
        console.log("OCR Category name:", ocrResult.category_id || ocrResult.category_name);
        console.log("Mapped Category ID:", categoryId);
        
        let finalCategoryName = "Belum Dikategorikan";
        if (categoryId !== null && categoryId !== undefined) {
            const cat = await getCategoryById(categoryId);
            if (cat) {
                finalCategoryName = cat.name;
            }
        }

        // 4. Save transaction to Database
        const mappedData = {
            user_id: req.user.id,
            category_id: categoryId,
            amount: amount,
            merchant: merchant,
            transaction_date: transaction_date,
            source: "ocr",
            type: "expense",
            confidence: confidence,
            need_review: need_review,
            raw_text: rawText,
            cleaned_text: ocrResult.cleaned_text || null,
            items: items,
        };

        const result = await createTransaction(mappedData);

        // Add Notification
        try {
            await createNotification(
                req.user.id,
                "expense",
                `Pengeluaran baru (Auto) tercatat: Rp ${Number(result.amount).toLocaleString()}`,
            );
        } catch (notifErr) {
            console.error("Failed to create notification:", notifErr);
            // Don't fail the response if notification fails
        }

        // Return final json with status 200
        res.status(200).json({
            id: result?.id,
            merchant: result?.merchant || merchant,
            amount: Number(result?.amount || amount),
            category_id: categoryId,
            category_name: finalCategoryName,
            confidence: confidence,
            need_review: need_review,
            missing_fields: missing_fields,
            items: items,
            raw_text: rawText,
            source: result?.source || "ocr",
            type: result?.type || "expense",
        });
    } catch (err) {
        console.error("createFromOCR overall failure:", err);
        res.status(500).json({ error: err.message });
    }
};

// GET ALL

export const getAll = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await getTransactions(userId);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// UPDATE

export const update = async (req, res) => {
    try {
        const transactionId = req.params.id;

        if (!transactionId) {
            return res
                .status(400)
                .json({ error: "Transaction id is required" });
        }

        const data = req.body;

        let categoryId = data.category_id || null;
        if (!categoryId && data.category) {
            const cat = await getCategoryByName(data.category);
            categoryId = cat?.id;
        }

        if (!categoryId) {
            const uncategorizedId = await getUncategorizedId();
            categoryId = data.type === 'expense' ? (uncategorizedId || 5) : 1;
        }

        // Force tax transaction
        if (data.merchant === 'Pajak PPh Final 0.5%') {
            const taxCat = await getCategoryByName('Pajak');
            categoryId = taxCat?.id || 12;
            data.type = 'expense';
            console.log("Tax Transaction Intercepted/Updated");
            console.log("Category ID:", categoryId);
            console.log("Transaction Type:", data.type);
        }

        const payload = {
            ...data,
            category_id: categoryId || data.category_id,
        };

        // Category Type Validation
        if (payload.category_id && payload.type) {
            const categoryMeta = await getCategoryById(payload.category_id);
            if (categoryMeta && categoryMeta.type !== payload.type) {
                return res.status(400).json({ error: "Kategori tidak sesuai dengan jenis transaksi" });
            }
        }

        const result = await updateTransaction(
            transactionId,
            payload,
            req.user.id,
        );

        if (!result) {
            return res.status(404).json({
                error: "Transaction not found",
            });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE

export const remove = async (req, res) => {
    try {
        const transactionId = req.params.id;

        if (!transactionId) {
            return res
                .status(400)
                .json({ error: "Transaction id is required" });
        }

        const result = await deleteTransaction(transactionId, req.user.id);

        if (!result) {
            return res.status(404).json({
                error: "Transaction not found",
            });
        }

        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
