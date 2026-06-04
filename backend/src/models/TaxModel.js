import pool from "../config/db.js";

export const calculateTax = async (userId) => {
    const result = await pool.query(
        `
    SELECT 
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
      COUNT(DISTINCT CASE WHEN type = 'income' THEN DATE_TRUNC('month', transaction_date) ELSE NULL END) AS active_months
    FROM transactions
    WHERE user_id = $1 
      AND is_deleted = FALSE
    `,
        [userId],
    );

    const total_income = Number(result.rows[0].total_income) || 0;
    const total_expense = Number(result.rows[0].total_expense) || 0;
    const net_profit = total_income - total_expense;

    let active_months = Number(result.rows[0].active_months) || 1;
    if (active_months === 0) active_months = 1;

    const monthly_average_income = total_income / active_months;
    const estimated_yearly_revenue = monthly_average_income * 12;
    const estimated_tax = estimated_yearly_revenue <= 500000000 ? 0 : (estimated_yearly_revenue - 500000000) * 0.005;

    let status = "info";
    let message = "Estimasi pajak tersedia sebagai referensi.";

    if (net_profit <= 0) {
        status = "loss";
        message = "Usaha mengalami kerugian pada periode ini.";
    } else {
        if (monthly_average_income < 50000000) {
            status = "info";
            message = "Estimasi pajak tersedia sebagai referensi.";
        } else if (monthly_average_income >= 50000000 && monthly_average_income < 100000000) {
            status = "warning";
            message = "Omzet usaha meningkat. Mulai siapkan perencanaan pajak.";
        } else if (monthly_average_income >= 100000000) {
            status = "high";
            message = "Omzet usaha tinggi. Disarankan melakukan perencanaan pajak sejak dini.";
        }
    }

    let financial_alert = null;
    if (total_income > 0 && (net_profit / total_income) < 0.1) {
        financial_alert = "Margin keuntungan usaha relatif rendah dibanding omzet.";
    }

    return {
        total_income,
        total_expense,
        net_profit,
        monthly_average_income,
        estimated_yearly_revenue,
        estimated_tax,
        status,
        message,
        financial_alert
    };
};
