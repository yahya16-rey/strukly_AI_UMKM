export const calculateForecast = (incomeData, expenseData) => {
    const incomeTotal = incomeData.reduce(
        (sum, item) => sum + Number(item.total_income),
        0,
    );

    const expenseTotal = expenseData.reduce(
        (sum, item) => sum + Number(item.total_expense),
        0,
    );

    const avgIncome =
        incomeData.length > 0 ? incomeTotal / incomeData.length : 0;

    const avgExpense =
        expenseData.length > 0 ? expenseTotal / expenseData.length : 0;

    const yearlyForecastIncome = avgIncome * 12;
    const estimatedTax = yearlyForecastIncome <= 500000000 ? 0 : ((yearlyForecastIncome - 500000000) * 0.005) / 12;
    const estimatedProfit = avgIncome - avgExpense;

    return {
        forecast_income: avgIncome,
        forecast_expense: avgExpense,
        estimated_tax: estimatedTax,
        estimated_profit: estimatedProfit,
    };
};
