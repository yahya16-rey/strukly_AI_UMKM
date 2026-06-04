import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { StatCard, ActionButton } from '../components/Dashboard/Cards';
import TransactionTable from '../components/Dashboard/TransactionTable';


const Home = ({ transactions, refreshTransactions, loadingTransactions }) => {
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);

  // User Profile dari localStorage
  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const displayName = savedUser.business_name || savedUser.name || 'Warung Berkah';

  // State Dashboard & AI
  const [summary, setSummary] = useState({
      total_income: 0,
      total_expense: 0,
      balance: 0,
  });
  const [aiInsight, setAiInsight] = useState('Jangan lupa catat pesanan online segera setelah selesai agar stok bahan baku tetap akurat!');
  const [loadingSummary, setLoadingSummary] = useState(false);

  // State Form Pemasukan
  const [incAmount, setIncAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState('langsung');
  const [incCategory, setIncCategory] = useState('');
  const [savingIncome, setSavingIncome] = useState(false);

  // State Form Pengeluaran Manual
  const [expVendor, setExpVendor] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingExpense, setSavingExpense] = useState(false);

  // Categories State
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);

  // State Smart Scan AI OCR
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef(null);

  // --- LOGIKA KALKULATOR PAJAK ---
  const [omset, setOmset] = useState(0);

 const fetchDashboardData = async () => {
     setLoadingSummary(true);

     try {
         const sumData = await api.dashboard.getSummary();

         setSummary({
             total_income: Number(sumData?.total_income) || 0,
             total_expense: Number(sumData?.total_expense) || 0,
             balance: Number(sumData?.balance) || 0,
         });

         const incomeCats = await api.categories.getAll('income');
         const expenseCats = await api.categories.getAll('expense');
         setIncomeCategories(incomeCats || []);
         setExpenseCategories(expenseCats || []);
         if (incomeCats && incomeCats.length > 0 && !incCategory) setIncCategory(incomeCats[0].id);
         if (expenseCats && expenseCats.length > 0 && !expCategory) setExpCategory(expenseCats[0].id);

         const insightRes = await api.dashboard.getInsight();

         if (typeof insightRes === "string") {
             setAiInsight(insightRes);
         } else if (insightRes?.insight) {
             if (typeof insightRes.insight === "string") {
                 setAiInsight(insightRes.insight);
             } else if (insightRes.insight.message) {
                 setAiInsight(insightRes.insight.message);
             } else {
                 setAiInsight("Belum ada insight AI tersedia saat ini.");
             }
         } else if (insightRes?.message) {
             setAiInsight(insightRes.message);
         } else {
             setAiInsight("Belum ada insight AI tersedia saat ini.");
         }
     } catch (err) {
         console.error("Gagal mengambil data dashboard:", err);
     } finally {
         setLoadingSummary(false);
     }
 };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID").format(number);
  };

  const handleOmsetChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setOmset(Number(rawValue));
  };

  const estimasiPajak = omset <= 500000000 ? 0 : (omset - 500000000) * 0.005;

  // Handler Simpan Pemasukan Manual
  const handleSaveIncome = async (e) => {
    e.preventDefault();
    if (!incAmount || Number(incAmount) <= 0) {
      alert("Masukkan nominal pemasukan yang valid!");
      return;
    }

    setSavingIncome(true);
    try {
      const categoryId = incCategory || (incomeCategories.length > 0 ? incomeCategories[0].id : 1);
      const merchant = `Pemasukan - ${incomeSource === 'langsung' ? 'Langsung' : 'Online'}`;
      const transactionDate = new Date().toISOString().split('T')[0];

      await api.transactions.createManual({
        amount: Number(incAmount),
        category_id: categoryId,
        merchant,
        transaction_date: transactionDate,
        type: 'income'
      });

      alert("Pemasukan berhasil disimpan!");
      setIncAmount('');
      setIsIncomeModalOpen(false);
      
      // Refresh data
      refreshTransactions();
      fetchDashboardData();
    } catch (err) {
      alert(err.message || "Gagal menyimpan pemasukan.");
    } finally {
      setSavingIncome(false);
    }
  };

  // Handler Simpan Pengeluaran Manual
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expVendor) {
      alert("Masukkan nama vendor atau toko!");
      return;
    }
    if (!expAmount || Number(expAmount) <= 0) {
      alert("Masukkan nominal pengeluaran yang valid!");
      return;
    }

    setSavingExpense(true);
    try {
      const categoryId = expCategory || (expenseCategories.length > 0 ? expenseCategories[0].id : 5);

      await api.transactions.createManual({
        amount: Number(expAmount),
        category_id: categoryId,
        merchant: expVendor,
        transaction_date: expDate,
        type: 'expense'
      });

      alert("Pengeluaran berhasil disimpan!");
      setExpVendor('');
      setExpAmount('');
      setIsExpenseModalOpen(false);

      // Refresh data
      refreshTransactions();
      fetchDashboardData();
    } catch (err) {
      alert(err.message || "Gagal menyimpan pengeluaran.");
    } finally {
      setSavingExpense(false);
    }
  };

  // Handler Smart Scan OCR
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Format berkas tidak didukung. Silakan unggah file gambar struk (JPG/PNG)!");
      return;
    }

    setOcrLoading(true);
    try {
      const response = await api.transactions.createFromOCR(file);
      alert("Smart Scan AI Berhasil! Transaksi otomatis dideteksi dan dicatat ke sistem.");
      setIsExpenseModalOpen(false);

      // Refresh data
      refreshTransactions();
      fetchDashboardData();
    } catch (err) {
      alert(err.message || "Gagal melakukan scan OCR AI. Silakan masukkan secara manual.");
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="p-8 lg:p-12 relative">
      <header className="mb-10 max-w-5xl">
        <h1 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2">Halo, {displayName}!</h1>
        <p className="text-on-surface-variant text-lg font-medium opacity-80">Selamat datang kembali di pusat kendali usahamu.</p>
      </header>

      {/* Input File Tersembunyi untuk OCR */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-6xl">
        <StatCard title="Total Uang Masuk" amount={`Rp ${formatRupiah(summary.total_income)}`} type="inflow" />
        <StatCard title="Total Uang Keluar" amount={`Rp ${formatRupiah(summary.total_expense)}`} type="outflow" />
        <StatCard title="Sisa Saldo" amount={`Rp ${formatRupiah(summary.balance)}`} type="primary" progress={100} />
      </div>

      <section className="mb-12 max-w-6xl">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-6 bg-primary rounded-full"></span>
          Aksi Cepat
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ActionButton 
            icon="add_chart" title="Catat Pemasukan" colorClass="bg-primary" desc="Catat setiap rupiah jualanmu hari ini." 
            onClick={() => setIsIncomeModalOpen(true)} 
          />
          <ActionButton 
            icon="receipt_long" title="Catat Pengeluaran" colorClass="bg-tertiary" desc="Scan struk belanja atau catat pengeluaran manual." 
            onClick={() => setIsExpenseModalOpen(true)} 
          />
          <ActionButton 
            icon="calculate" title="Hitung Pajak" colorClass="bg-secondary" desc="Hitung estimasi pajak PPh Final 0,5% dengan cepat." 
            onClick={() => setIsTaxModalOpen(true)} 
          />
          <ActionButton 
            icon="monitoring" title="Dashboard Analitik" colorClass="bg-emerald-600" desc="Lihat performa bisnismu di dashboard." 
            onClick={() => {
              const baseUrl = import.meta.env.VITE_STREAMLIT_URL || "https://struklyaiumkm-vzhjysaykjq7q3u8skax6x.streamlit.app/";
              const url = new URL(baseUrl);
              url.searchParams.set("user_id", savedUser.id);
              window.open(url.toString(), "_blank");
            }} 
          />
        </div>
      </section>

      {/* AI Tips/Insight Banner */}
      <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100/50 max-w-6xl mb-12 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
        </div>
        <div>
          <h4 className="text-sm font-bold text-emerald-900 mb-1">Rekomendasi AI Strukly</h4>
          <p className="text-sm text-emerald-800/80 leading-relaxed font-medium">{aiInsight}</p>
        </div>
      </div>

      <TransactionTable transactions={transactions} />

      {/* --- MODAL 1: CATAT PEMASUKAN --- */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6">
          <div className="absolute inset-0" onClick={() => setIsIncomeModalOpen(false)}></div>
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Catat Pemasukan</h3>
              <button onClick={() => setIsIncomeModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveIncome} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 lg:p-8 overflow-y-auto no-scrollbar flex-1 space-y-8">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100/50">
                  <div className="relative flex items-center">
                    <span className="absolute left-0 text-3xl font-bold text-slate-400">Rp</span>
                    <input 
                      type="text" 
                      required
                      value={incAmount === '' ? '' : formatRupiah(Number(incAmount))}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, '');
                        setIncAmount(rawValue);
                      }}
                      placeholder="0" 
                      className="w-full bg-transparent border-none py-2 pl-14 pr-4 text-5xl font-black text-slate-800 focus:ring-0 outline-none" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Sumber Pesanan</label>
                    <div className="flex gap-3 h-[88px]">
                      <button 
                        type="button"
                        onClick={() => setIncomeSource('langsung')} 
                        className={`flex-1 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1.5 transition-all border-2 ${incomeSource === 'langsung' ? 'bg-[#003d9b] text-white border-transparent shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent hover:border-slate-200'}`}
                      >
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: incomeSource === 'langsung' ? "'FILL' 1" : "" }}>storefront</span>
                        Langsung
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIncomeSource('online')} 
                        className={`flex-1 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1.5 transition-all border-2 ${incomeSource === 'online' ? 'bg-[#003d9b] text-white border-transparent shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent hover:border-slate-200'}`}
                      >
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: incomeSource === 'online' ? "'FILL' 1" : "" }}>smartphone</span>
                        Online
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Kategori Menu</label>
                    <div className="relative h-[88px]">
                      <select 
                        value={incCategory}
                        onChange={(e) => setIncCategory(e.target.value)}
                        className="bg-none w-full h-full bg-slate-50 hover:bg-slate-100 border-none rounded-xl px-5 font-bold text-slate-700 text-base focus:ring-2 focus:ring-[#003d9b]/20 outline-none appearance-none cursor-pointer transition-colors"
                      >
                        {incomeCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">keyboard_arrow_down</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                <button 
                  type="submit" 
                  disabled={savingIncome}
                  className="w-full py-4 bg-[#003d9b] text-white font-bold rounded-xl hover:bg-[#003d9b]/90 active:scale-[0.98] transition-all shadow-lg shadow-[#003d9b]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
                  {savingIncome ? 'Menyimpan...' : 'Simpan Pemasukan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: CATAT PENGELUARAN --- */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6">
          <div className="absolute inset-0" onClick={() => setIsExpenseModalOpen(false)}></div>
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-slate-900">Catat Pengeluaran</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 lg:p-10 overflow-y-auto no-scrollbar flex-1 space-y-10">
              {/* Bagian Smart Scan OCR AI */}
              <div className="flex flex-col items-center text-center">
                <div 
                  onClick={triggerFileInput}
                  className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-10 flex flex-col items-center gap-6 group hover:border-[#003d9b]/50 transition-all cursor-pointer relative overflow-hidden"
                >
                  {ocrLoading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-20">
                      <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
                      <p className="text-sm font-bold text-[#003d9b]">Vision AI sedang mengekstrak struk...</p>
                    </div>
                  )}
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-[#003d9b]" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Smart Scan AI Strukly</h4>
                    <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">Pilih gambar struk belanja (JPG/PNG) dari perangkat atau ambil foto langsung menggunakan kamera HP.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); triggerFileInput(); }}
                    className="bg-[#003d9b] text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                  >
                    Unggah Struk Sekarang
                  </button>
                </div>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <span className="relative px-6 bg-white text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Atau Input Manual</span>
              </div>

              {/* Form Input Manual Pengeluaran */}
              <form onSubmit={handleSaveExpense} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Nama Vendor / Toko</label>
                  <input 
                    type="text" 
                    required
                    value={expVendor}
                    onChange={(e) => setExpVendor(e.target.value)}
                    placeholder="Contoh: Toko Beras Jaya" 
                    className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-semibold focus:ring-2 focus:ring-[#003d9b]/20 outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Nominal (IDR)</label>
                  <input 
                    type="text" 
                    required
                    value={expAmount === '' ? '' : formatRupiah(Number(expAmount))}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, '');
                      setExpAmount(rawValue);
                    }}
                    placeholder="0" 
                    className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-semibold focus:ring-2 focus:ring-[#003d9b]/20 outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Kategori</label>
                  <div className="relative">
                    <select 
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="bg-none w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-semibold focus:ring-2 focus:ring-[#003d9b]/20 outline-none appearance-none cursor-pointer"
                    >
                        {expenseCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">keyboard_arrow_down</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Tanggal Transaksi</label>
                  <input 
                    type="date" 
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-semibold focus:ring-2 focus:ring-[#003d9b]/20 outline-none" 
                  />
                </div>
                
                <div className="col-span-1 md:col-span-2 pt-4">
                  <button 
                    type="submit" 
                    disabled={savingExpense}
                    className="w-full py-4 bg-[#003d9b] text-white font-bold rounded-xl hover:bg-[#003d9b]/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingExpense ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: HITUNG PAJAK --- */}
      {isTaxModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6">
          <div className="absolute inset-0" onClick={() => setIsTaxModalOpen(false)}></div>
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-slate-900">Hitung Pajak UMKM</h3>
              <button onClick={() => setIsTaxModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 lg:p-8 overflow-y-auto no-scrollbar flex-1 space-y-6">
              
              {/* Input Omset */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Total Omset Tahunan (Rp)</label>
                <div className="relative flex items-center bg-slate-50 hover:bg-slate-100 transition-colors rounded-2xl p-6 border border-slate-100/50 group">
                  <span className="text-2xl font-bold text-slate-400 mr-4">Rp</span>
                  <input 
                    type="text" 
                    value={omset === 0 ? '' : formatRupiah(omset)}
                    onChange={handleOmsetChange}
                    placeholder="0" 
                    className="w-full bg-transparent border-none p-0 text-4xl font-black text-slate-800 focus:ring-0 outline-none" 
                  />
                  <span className="material-symbols-outlined text-[#003d9b] ml-4 opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer">edit</span>
                </div>
                <p className="text-xs text-slate-400 italic">Masukkan total pendapatan kotor usaha Anda sebelum dikurangi biaya operasional.</p>
              </div>

              {/* Kartu Hasil Pajak (Biru) */}
              <div className="bg-[#003d9b] p-6 lg:p-8 rounded-2xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-lg shadow-blue-900/20">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-[0.15em] opacity-80 uppercase">Estimasi PPh Final (0.5%)</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold opacity-80">Rp</span>
                    <span className="text-4xl font-black tracking-tight">{formatRupiah(estimasiPajak)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setExpAmount(estimasiPajak);
                    setExpVendor('Pajak PPh Final 0.5%');
                    const pajakCat = expenseCategories.find(c => c.name.toLowerCase().includes('pajak'));
                    setExpCategory(pajakCat ? pajakCat.id : 5);
                    setIsTaxModalOpen(false);
                    setIsExpenseModalOpen(true);
                  }}
                  className="bg-white text-[#003d9b] px-5 py-3.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                  Catat Pengeluaran
                </button>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="p-6 border-t border-slate-100 bg-white">
              <button 
                onClick={() => setIsTaxModalOpen(false)} 
                className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Home;