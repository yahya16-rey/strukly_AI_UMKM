import { useState, useEffect } from "react";
import { api } from "../services/api";

const TaxCalculator = () => {
    // =========================
    // STATE
    // =========================
    const [omset, setOmset] = useState(0);
    const [estimatedTax, setEstimatedTax] = useState(0);
    const [taxData, setTaxData] = useState(null);
    const [taxHistory, setTaxHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // =========================
    // FORMAT RUPIAH
    // =========================
    const formatRupiah = (number) => {
        return new Intl.NumberFormat("id-ID").format(Number(number) || 0);
    };

    // =========================
    // FETCH DATA
    // =========================
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Ambil estimasi pajak otomatis dari server (berdasarkan omzet riil)
                const taxRes = await api.dashboard.getTax();
                if (taxRes) {
                    if (taxRes.estimated_yearly_revenue !== undefined) {
                        setOmset(taxRes.estimated_yearly_revenue);
                        setEstimatedTax(taxRes.estimated_tax);
                    }
                    setTaxData(taxRes);
                }

                // Ambil riwayat transaksi, filter untuk Pajak
                const transRes = await api.transactions.getAll();
                if (transRes) {
                    const pajakHistory = transRes.filter((t) => 
                        (t.merchant && t.merchant.toLowerCase().includes("pajak pph final")) || 
                        (t.category_name && t.category_name.toLowerCase() === "pajak")
                    );
                    setTaxHistory(pajakHistory);
                }
            } catch (error) {
                console.error("Error fetching tax data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // =========================
    // HANDLE INPUT
    // =========================
    const handleOmsetChange = (e) => {
        const rawValue = e.target.value.replace(/\D/g, "");
        const parsedValue = Number(rawValue) || 0;
        setOmset(parsedValue);

        // kalkulasi lokal sementara (jika user ingin input manual)
        setEstimatedTax(parsedValue <= 500000000 ? 0 : (parsedValue - 500000000) * 0.005);
    };

    // Fungsi helper untuk mendapatkan warna status
    const getStatusColor = (status) => {
        switch (status) {
            case 'loss': return 'text-red-600 bg-red-50 border-red-200';
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'info':
            default: return 'text-blue-600 bg-blue-50 border-blue-200';
        }
    };

    return (
        <div className="p-8 lg:p-12 max-w-6xl mx-auto">
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* LEFT */}
                <div className="lg:col-span-7 space-y-8">
                    {/* HEADER */}
                    <div className="space-y-2">
                        <span className="text-xs font-bold tracking-widest text-primary uppercase">
                            Pajak Final 0.5%
                        </span>

                        <h3 className="text-4xl font-extrabold tracking-tight text-on-surface">
                            Estimasi Kewajiban Pajak Anda
                        </h3>

                        <p className="text-on-surface-variant text-lg max-w-lg">
                            Kalkulator estimasi PPh Final UMKM. Data otomatis ditarik dari rata-rata performa usaha Anda.
                        </p>
                    </div>

                    {/* ALERT / MESSAGE (Jika ada data) */}
                    {taxData && taxData.status && (
                        <div className={`p-4 rounded-xl border ${getStatusColor(taxData.status)} flex gap-3 items-start`}>
                            <span className="material-symbols-outlined mt-0.5">
                                {taxData.status === 'loss' ? 'warning' : taxData.status === 'info' ? 'info' : 'campaign'}
                            </span>
                            <div>
                                <h4 className="font-bold">Status Kesehatan Finansial</h4>
                                <p className="text-sm mt-1">{taxData.message}</p>
                            </div>
                        </div>
                    )}

                    {taxData && taxData.financial_alert && (
                        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex gap-3 items-start">
                            <span className="material-symbols-outlined mt-0.5">trending_down</span>
                            <div>
                                <h4 className="font-bold">Peringatan Keuangan</h4>
                                <p className="text-sm mt-1">{taxData.financial_alert}</p>
                            </div>
                        </div>
                    )}

                    {/* INPUT */}
                    <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
                        <label
                            className="block text-sm font-semibold text-on-surface-variant mb-3 uppercase tracking-wider"
                            htmlFor="omset"
                        >
                            Total Estimasi Omset Setahun (Rp)
                        </label>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-on-surface-variant font-bold text-2xl">
                                    Rp
                                </span>
                            </div>

                            <input
                                id="omset"
                                type="text"
                                value={omset === 0 ? "" : formatRupiah(omset)}
                                onChange={handleOmsetChange}
                                placeholder={loading ? "Memuat data..." : "0"}
                                className="block w-full pl-16 pr-12 py-5 bg-surface-container-highest border-none rounded-lg text-3xl font-extrabold text-on-surface focus:ring-4 focus:ring-primary/20 transition-all outline-none"
                            />
                        </div>

                        <p className="mt-4 text-sm text-on-surface-variant/80 italic">
                            Masukkan atau edit total pendapatan kotor usaha Anda dalam setahun.
                        </p>
                    </div>

                    {/* RESULT */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-container p-1 rounded-xl shadow-xl">
                        <div className="bg-surface-container-lowest/5 backdrop-blur-sm p-8 rounded-lg flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                            <div className="space-y-1 text-center md:text-left">
                                <p className="text-on-primary-container/80 text-xs font-bold uppercase tracking-[0.15em]">
                                    Estimasi PPh Final (0.5%)
                                </p>

                                <div className="flex items-baseline gap-2 text-white">
                                    <span className="text-2xl font-bold opacity-80">
                                        Rp
                                    </span>

                                    <span className="text-5xl font-extrabold tracking-tighter">
                                        {formatRupiah(estimatedTax)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT */}
                <div className="lg:col-span-5 space-y-6">
                    {taxData && (
                        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                            <h4 className="font-bold text-lg text-slate-800">Ringkasan Finansial Anda</h4>
                            
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500 font-medium">Total Pemasukan</span>
                                <span className="font-bold text-emerald-600">Rp {formatRupiah(taxData.total_income)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500 font-medium">Total Pengeluaran</span>
                                <span className="font-bold text-red-600">Rp {formatRupiah(taxData.total_expense)}</span>
                            </div>

                            <div className="flex justify-between items-center py-2 bg-slate-50 px-3 rounded-lg">
                                <span className="text-sm font-bold text-slate-700">Keuntungan Bersih (Profit)</span>
                                <span className={`font-extrabold ${taxData.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    Rp {formatRupiah(taxData.net_profit)}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
                        <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center">
                            <span className="material-symbols-outlined text-on-secondary-container">
                                verified_user
                            </span>
                        </div>

                        <h4 className="font-bold text-lg text-on-surface">
                            Informasi Pajak UMKM
                        </h4>

                        <p className="text-sm text-on-surface-variant leading-relaxed">
                            UMKM dengan omzet di bawah Rp 4,8 miliar per tahun
                            dapat menggunakan tarif PPh Final 0,5%. Estimasi kami mengambil rata-rata pendapatan bulanan Anda lalu mengalikannya dengan 12.
                        </p>
                    </div>
                </div>
            </section>

            {/* HISTORY */}
            <section className="mt-16 space-y-6">
                <div className="flex items-end justify-between px-2">
                    <h4 className="text-2xl font-extrabold tracking-tight">
                        Riwayat Pembayaran Pajak
                    </h4>
                </div>

                {loading ? (
                     <div className="bg-surface-container-lowest p-8 rounded-xl text-center text-on-surface-variant">
                     Memuat data riwayat pajak...
                 </div>
                ) : taxHistory.length === 0 ? (
                    <div className="bg-surface-container-lowest p-8 rounded-xl text-center text-on-surface-variant">
                        Belum ada data riwayat pajak.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {taxHistory.map((item) => (
                            <div
                                key={item.id}
                                className="bg-white border p-6 rounded-xl flex items-center justify-between"
                            >
                                <div>
                                    <h5 className="font-bold text-lg">{item.merchant || "Pajak UMKM"}</h5>
                                    <p className="text-sm text-gray-500">{new Date(item.transaction_date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })} - Kategori: {item.category_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-extrabold text-red-600">- Rp {formatRupiah(item.amount)}</p>
                                    <span className="text-xs uppercase bg-gray-100 px-2 py-1 rounded text-gray-600 font-bold tracking-widest">{item.source || "Manual"}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default TaxCalculator;
