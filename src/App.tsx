import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { 
  BarChart3, 
  LayoutDashboard, 
  FileSpreadsheet, 
  RefreshCcw, 
  LogOut, 
  ChevronRight, 
  AlertCircle,
  Settings,
  Moon,
  Sun,
  PieChart as PieChartIcon,
  TrendingUp,
  Table as TableIcon,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Zap,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface SheetData {
  name: string;
  values: string[][];
}

interface SpreadsheetData {
  title: string;
  sheets: SheetData[];
}

const SPECIFIC_SHEET_ID = '1g3vhEFOLPXk9_2iD5roa_JK0xHLaKnHmSsQhsv83wVc';
const COLORS = ['#F2B705', '#F27DB4', '#30D98F', '#4080F2', '#F2913D', '#8b5cf6', '#ec4899', '#06b6d4'];

// Enhanced Data analysis helpers
const analyzeSheet = (sheet: SheetData) => {
  if (!sheet.values || sheet.values.length === 0) return null;
  
  // 1. Filter out empty columns
  const maxCols = sheet.values.reduce((max, row) => Math.max(max, row.length), 0);
  const validColIndices = Array.from({ length: maxCols }, (_, i) => i).filter(colIdx => {
    return sheet.values.some(row => row[colIdx] && row[colIdx].toString().trim() !== '');
  });

  // 2. Filter out empty rows
  const cleanedRows = sheet.values
    .map(row => validColIndices.map(idx => row[idx] || ''))
    .filter(row => row.some(cell => cell.toString().trim() !== ''));

  if (cleanedRows.length === 0) return null;

  const headers = cleanedRows[0];
  const rows = cleanedRows.slice(1);
  
  // 3. Find numeric columns for potential charts
  const parseNumeric = (val: any) => {
    if (val === undefined || val === null || val === '') return NaN;
    return parseFloat(val.toString().replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.'));
  };

  const numericCols = headers.map((_, i) => {
    const sample = rows.slice(0, 10).map(r => r[i]);
    const validSamples = sample.filter(v => v !== undefined && v !== '' && v !== null);
    if (validSamples.length === 0) return -1;
    const isNumeric = validSamples.every(v => !isNaN(parseNumeric(v)));
    return isNumeric ? i : -1;
  }).filter(i => i !== -1);

  // 4. Identify special columns (Names, Descriptions, or Dates)
  const nameColIdx = headers.findIndex(h => {
    const low = h.trim().toLowerCase();
    return low.includes('nome') || low.includes('aluno') || low.includes('estudante') || 
           low.includes('descri') || low.includes('item') || low.includes('produto') || 
           low.includes('mês') || low.includes('empresa') || low.includes('data') ||
           low.includes('cliente') || low.includes('fornecedor');
  });

  const groupColIdx = headers.findIndex(h => {
    const low = h.trim().toLowerCase();
    return low.includes('turma') || low.includes('série') || low.includes('serie') || low.includes('classe');
  });

  return { headers, rows, numericCols, nameColIdx, groupColIdx };
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const metricValueClass = 'font-display leading-none tracking-normal break-words text-[clamp(1.9rem,2.35vw,3.25rem)]';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | string>('geral');
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = window.localStorage.getItem('theme');
    if (savedTheme === 'dark') return true;
    if (savedTheme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRowData, setEditingRowData] = useState<{
    sheetName: string;
    rowIndex: number;
    headers: string[];
    values: string[];
  } | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    root.style.colorScheme = darkMode ? 'dark' : 'light';
    window.localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/spreadsheets/${SPECIFIC_SHEET_ID}/all-data`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setIsConnected(true);
      } else if (response.status === 401) {
        setIsConnected(false);
      } else {
        const result = await response.json().catch(() => null);
        setIsConnected(false);
        throw new Error(result?.error || 'Falha ao conectar com a planilha');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateValue = async (sheetName: string, rowIndex: number, colIndex: number, newValue: string) => {
    setSaveLoading(true);
    try {
      const response = await fetch(`/api/spreadsheets/${SPECIFIC_SHEET_ID}/values`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetName,
          row: rowIndex,
          col: colIndex,
          value: newValue
        })
      });
      if (!response.ok) throw new Error('Falha ao salvar');
      await fetchData(); // Refresh data
    } catch (err) {
      setError('Erro ao salvar alteração. Tente novamente.');
    } finally {
      setSaveLoading(false);
    }
  };

  const openEditModal = (sheetName: string, headers: string[], values: string[], rowIndex: number) => {
    setEditingRowData({ sheetName, headers, values: [...values], rowIndex });
    setIsEditModalOpen(true);
  };

  const handleSaveAllFields = async () => {
    if (!editingRowData) return;
    setSaveLoading(true);
    try {
      // For simplicity, we update sequentially. In a production app, a batchUpdate would be better.
      for (let i = 0; i < editingRowData.values.length; i++) {
        await fetch(`/api/spreadsheets/${SPECIFIC_SHEET_ID}/values`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetName: editingRowData.sheetName,
            row: editingRowData.rowIndex,
            col: i,
            value: editingRowData.values[i]
          })
        });
      }
      setIsEditModalOpen(false);
      await fetchData();
    } catch (err) {
      setError('Erro ao salvar alterações.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleConnect = async () => {
    setError(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });

      const response = await fetch('/api/auth/google/url');
      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Não foi possível gerar a URL de autenticação.');
      }

      window.open(result.url, 'google_oauth', `width=600,height=700`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar autenticação.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsConnected(false);
    setData(null);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchData]);

  const globalStats = useMemo(() => {
    if (!data) return null;
    return {
      totalSheets: data.sheets.length,
      totalRows: data.sheets.reduce((acc, s) => {
        const analysis = analyzeSheet(s);
        return acc + (analysis ? analysis.rows.length : 0);
      }, 0),
      sheetNames: data.sheets.map(s => s.name)
    };
  }, [data]);

  const renderGeralDashboard = () => {
    if (!data) return null;
    
    // HEURISTICS TO GATHER CROSS-SHEET DATA
    const findSheet = (names: string[]) => data.sheets.find(s => names.includes(s.name.toUpperCase()));
    
    const alunosSheet = findSheet(['ALUNOS', 'STUDENTS']);
    const atrasosSheet = findSheet(['ATRASOS', 'DELAYS']);
    const turmasSheet = findSheet(['TURMAS', 'CLASSES']);
    const empresaSheet = findSheet(['EMPRESA', 'FINANCEIRO', 'FINANCE']);

    const alunosAnalysis = alunosSheet ? analyzeSheet(alunosSheet) : null;
    const atrasosAnalysis = atrasosSheet ? analyzeSheet(atrasosSheet) : null;
    const turmasAnalysis = turmasSheet ? analyzeSheet(turmasSheet) : null;
    const empresaAnalysis = empresaSheet ? analyzeSheet(empresaSheet) : null;

    const parseNum = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      return parseFloat(val.toString().replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.'));
    };

    // 1. OPERATION DATA (Alunos / Turmas)
    let totalAlunos = 0;
    let shiftData = [
      { name: 'Manhã', value: 0, fill: '#4080F2' },
      { name: 'Tarde', value: 0, fill: '#F2913D' }
    ];

    if (alunosAnalysis) {
      totalAlunos = alunosAnalysis.rows.length;
    } else if (turmasAnalysis) {
      // Fallback to summing turmas if Alunos sheet not found
      const idxQtd = 2;
      totalAlunos = turmasAnalysis.rows.reduce((acc, r) => acc + (parseInt(r[idxQtd]?.toString() || '0') || 0), 0);
    }

    if (turmasAnalysis) {
      const idxTurno = 0;
      const idxQtd = 2;
      const manha = turmasAnalysis.rows.filter(r => r[idxTurno]?.toString().toUpperCase().includes('MANH')).reduce((acc, r) => acc + (parseInt(r[idxQtd]?.toString() || '0') || 0), 0);
      const tarde = turmasAnalysis.rows.filter(r => r[idxTurno]?.toString().toUpperCase().includes('TARD')).reduce((acc, r) => acc + (parseInt(r[idxQtd]?.toString() || '0') || 0), 0);
      shiftData = [
        { name: 'Manhã', value: manha, fill: '#4080F2' },
        { name: 'Tarde', value: tarde, fill: '#F2913D' }
      ];
    }

    // 2. FINANCIAL DATA
    let faturamentoTotal = 0;
    let faturamentoPorDia: any[] = [];
    
    if (empresaAnalysis) {
      const idxPag = empresaAnalysis.headers.findIndex(h => h.toLowerCase().includes('pagamento'));
      if (idxPag !== -1) {
        // Last row usually has the total in Empresa sheet or we sum month rows
        const totalsRow = empresaAnalysis.rows[empresaAnalysis.rows.length - 1];
        faturamentoTotal = parseNum(totalsRow[idxPag]);
        if (faturamentoTotal === 0) {
           faturamentoTotal = empresaAnalysis.rows.slice(0, -1).reduce((acc, r) => acc + parseNum(r[idxPag]), 0);
        }
      }
    }

    if (alunosAnalysis) {
      const idxValor = 5;
      const idxDia = 6;
      const calcFaturamento = alunosAnalysis.rows.reduce((acc, r) => acc + parseNum(r[idxValor]), 0);
      if (faturamentoTotal === 0) faturamentoTotal = calcFaturamento;

      faturamentoPorDia = [5, 10, 15, 30].map(dia => {
        const valor = alunosAnalysis.rows.filter(r => r[idxDia]?.toString() === dia.toString()).reduce((acc, r) => acc + parseNum(r[idxValor]), 0);
        return { name: `Dia ${dia}`, value: valor };
      }).filter(d => d.value > 0);
    }

    const ticketMedio = totalAlunos > 0 ? faturamentoTotal / totalAlunos : 0;

    // 3. ATRASOS DATA
    let totalFineValue = 0;
    let studentsDelayedCount = 0;
    let monthlyDelays: any[] = [];
    let topDebtors: any[] = [];

    if (atrasosAnalysis) {
      const { headers, rows } = atrasosAnalysis;
      const studentNames = headers.slice(1);
      const monthDataRows = rows.slice(0, -1);
      
      const stats = studentNames.map((name, i) => {
        let delays = 0;
        monthDataRows.forEach(r => { delays += parseNum(r[i+1]); });
        return { name, delays, totalValue: delays * 5 };
      });

      totalFineValue = stats.reduce((acc, s) => acc + s.totalValue, 0);
      studentsDelayedCount = stats.filter(s => s.delays > 0).length;
      topDebtors = [...stats].sort((a,b) => b.totalValue - a.totalValue).slice(0, 5);

      monthlyDelays = monthDataRows.map(row => {
        let monthDelays = 0;
        studentNames.forEach((_, i) => { monthDelays += parseNum(row[i+1]); });
        return { month: row[0], count: monthDelays };
      });
    }

    return (
      <div className="space-y-10 pb-20 max-w-[1600px] mx-auto animate-in fade-in duration-700">
        {/* HEADER & SUMMARY */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div>
             <h2 className="text-5xl font-display uppercase tracking-tighter text-slate-900 dark:text-white">
                Visião <span className="text-brand-blue">Estratégica</span>
             </h2>
             <div className="flex items-center gap-2 mt-3">
                <div className="h-1.5 w-1.5 rounded-full bg-brand-pink fill-brand-pink animate-pulse" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                   {totalAlunos} alunos ativos • {formatCurrency(faturamentoTotal)} faturados • {studentsDelayedCount} alunos com atraso
                </p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={fetchData}
              className="flex items-center gap-3 px-8 py-5 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl hover:border-brand-blue hover:shadow-brand-blue/10 transition-all font-display text-xs"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
              ATUALIZAR DADOS
            </button>
          </div>
        </div>

        {/* INDICADORES TOPO */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
           <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-brand-blue uppercase mb-4 tracking-widest">Total de Alunos</p>
                 <p className={`${metricValueClass} text-[clamp(2.4rem,3vw,3.75rem)] text-slate-800 dark:text-white`}>{totalAlunos}</p>
              </div>
              <Users size={120} className="absolute -bottom-4 -right-4 text-brand-blue opacity-5 -rotate-12" />
           </div>

           <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-brand-emerald uppercase mb-4 tracking-widest">Faturamento Total</p>
                 <p className={`${metricValueClass} text-brand-emerald`}>{formatCurrency(faturamentoTotal)}</p>
              </div>
              <TrendingUp size={120} className="absolute -bottom-4 -right-4 text-brand-emerald opacity-5 -rotate-12" />
           </div>

           <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-brand-yellow uppercase mb-4 tracking-widest">Ticket Médio</p>
                 <p className={`${metricValueClass} text-brand-yellow`}>{formatCurrency(ticketMedio)}</p>
              </div>
              <Zap size={120} className="absolute -bottom-4 -right-4 text-brand-yellow opacity-5 -rotate-12" />
           </div>

           <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-brand-pink uppercase mb-4 tracking-widest">Atrasos (Multas)</p>
                 <p className={`${metricValueClass} text-brand-pink`}>{formatCurrency(totalFineValue)}</p>
              </div>
              <AlertCircle size={120} className="absolute -bottom-4 -right-4 text-brand-pink opacity-5 -rotate-12" />
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
           {/* LADO ESQUERDO: OPERAÇÃO */}
           <div className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl">
              <h3 className="text-2xl font-display uppercase mb-10 flex items-center gap-4">
                 <Users size={28} className="text-brand-blue" />
                 Operação: <span className="text-brand-blue">Alunos & Turmas</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                 <div className="h-[300px]">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-6 text-center">Distribuição de Alunos por Turno</p>
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie data={shiftData} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" nameKey="name">
                             {shiftData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                          </Pie>
                          <Tooltip />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="flex flex-col justify-center space-y-6">
                    {shiftData.map((s, i) => (
                       <div key={i} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent hover:border-brand-blue transition-all group">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.fill }} />
                                <div>
                                   <p className="text-[10px] font-black uppercase text-slate-400">TURNO {s.name}</p>
                                   <p className="text-2xl font-display text-slate-800 dark:text-white tracking-widest">{s.value} <span className="text-xs uppercase opacity-40 font-sans font-bold">alunos</span></p>
                                </div>
                             </div>
                             <ChevronRight size={20} className="text-slate-300 group-hover:text-brand-blue transition-colors" />
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* LADO DIREITO: FINANCEIRO */}
           <div className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl">
              <h3 className="text-2xl font-display uppercase mb-10 flex items-center gap-4">
                 <TrendingUp size={28} className="text-brand-emerald" />
                 Fluxo Financeiro: <span className="text-brand-emerald">Faturamento por Dia</span>
              </h3>
              <div className="h-[300px] mb-8">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={faturamentoPorDia}>
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }} />
                       <Bar dataKey="value" fill="#30D98F" radius={[15, 15, 0, 0]} />
                       <Tooltip cursor={{ fill: 'rgba(48, 217, 143, 0.05)' }} formatter={(v) => formatCurrency(v as number)} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {faturamentoPorDia.map((d, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-brand-emerald/5 border border-brand-emerald/10 text-center">
                       <p className="text-[10px] font-black text-brand-emerald uppercase mb-1">{d.name}</p>
                       <p className="text-lg font-display text-slate-800 dark:text-white leading-none">{formatCurrency(d.value)}</p>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* PARTE INFERIOR: ATRASOS */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl relative">
           <h3 className="text-2xl font-display uppercase mb-10 flex items-center gap-4">
              <AlertCircle size={28} className="text-brand-pink" />
              Gestão de <span className="text-brand-pink">Atrasos & Inadimplência</span>
           </h3>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-1 space-y-4">
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Ranking de Alunos com Maior Atraso</p>
                 {topDebtors.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 dark:bg-slate-800 border border-transparent hover:border-rose-200 transition-all">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-white ${i === 0 ? 'bg-rose-600' : 'bg-slate-400'}`}>
                             {i + 1}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-slate-800 dark:text-white">{s.name}</p>
                             <p className="text-[10px] text-slate-400 font-black uppercase">{s.delays} ATRASOS ACUMULADOS</p>
                          </div>
                       </div>
                       <p className="font-display text-rose-500">{formatCurrency(s.totalValue)}</p>
                    </div>
                 ))}
                 {topDebtors.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                       <CheckCircle2 size={48} />
                       <p className="font-display uppercase mt-4">Nenhum atraso registrado</p>
                    </div>
                 )}
              </div>
              <div className="lg:col-span-2">
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6 px-10">Tendência Mensal de Incidentes</p>
                 <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={monthlyDelays}>
                          <defs>
                             <linearGradient id="colorAtraso" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }} />
                          <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff' }} />
                          <Area type="monotone" dataKey="count" stroke="#f43f5e" strokeWidth={5} fillOpacity={1} fill="url(#colorAtraso)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderPagamentoDashboard = (sheetName: string) => {
    const sheet = data?.sheets.find(s => s.name === sheetName);
    if (!sheet) return null;
    const analysis = analyzeSheet(sheet);
    if (!analysis) return null;

    const { headers, rows } = analysis;
    const [filter, setFilter] = useState<'all' | 'PENDENTE' | 'EM DIA' | 'NOVO'>('all');

    // Identify Name column and Month columns
    const monthsStr = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const monthColIndices = headers.map((h, i) => {
      const low = h.toUpperCase();
      return monthsStr.some(m => low.includes(m)) ? i : -1;
    }).filter(i => i !== -1);

    const nameCol = headers.findIndex(h => h.toLowerCase().includes('nome') || h.toLowerCase().includes('aluno'));

    const getStatus = (val: string) => {
      if (!val) return 'EMPTY';
      const v = val.toUpperCase().trim();
      if (v.includes('PAGO') && !v.includes('NÃO')) return 'PAGO';
      if (v.includes('NÃO PAGO') || v.includes('PENDENTE')) return 'PENDENTE';
      if (v.includes('ENTROU') || v.includes('NOVO')) return 'NOVO';
      return 'EMPTY';
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'PAGO': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        case 'PENDENTE': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
        case 'NOVO': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        default: return 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent';
      }
    };

    const processedRows = rows.map((row, idx) => {
      const statuses = monthColIndices.map(i => getStatus(row[i]));
      const hasPendente = statuses.includes('PENDENTE');
      const hasPago = statuses.includes('PAGO');
      const isNovo = statuses.includes('NOVO');
      
      let generalStatus: 'PENDENTE' | 'EM DIA' | 'NOVO' = 'EM DIA';
      if (hasPendente) generalStatus = 'PENDENTE';
      else if (isNovo && !hasPago) generalStatus = 'NOVO';
      else if (!hasPago && !hasPendente) generalStatus = 'NOVO';

      return {
        original: row,
        rowIndex: idx,
        statuses,
        generalStatus
      };
    });

    const filteredRows = processedRows.filter(r => filter === 'all' || r.generalStatus === filter);

    // Monthly summary
    const monthlyStats = monthColIndices.map((colIdx, i) => {
      const paid = processedRows.filter(r => r.statuses[i] === 'PAGO').length;
      const pending = processedRows.filter(r => r.statuses[i] === 'PENDENTE').length;
      return { month: headers[colIdx], paid, pending };
    });

    return (
      <div className="space-y-8 pb-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-display text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-4">
              Controle de <span className="text-brand-emerald">Pagamentos</span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'TODOS', icon: <Users size={14} /> },
              { id: 'PENDENTE', label: 'PENDENTES', icon: <AlertCircle size={14} />, color: 'bg-rose-500' },
              { id: 'EM DIA', label: 'EM DIA', icon: <CheckCircle2 size={14} />, color: 'bg-emerald-500' },
              { id: 'NOVO', label: 'NOVOS', icon: <Calendar size={14} />, color: 'bg-blue-500' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-display text-[10px] transition-all border-2 ${
                  filter === f.id 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800'
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Monthly Summary Cards */}
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {monthlyStats.map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex-shrink-0 w-48 p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-xl"
            >
              <p className="text-[10px] font-black text-slate-400 uppercase mb-3">{stat.month}</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-emerald-500">PAGOS</span>
                  <span className="text-lg font-display">{stat.paid}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-rose-500">PENDENTES</span>
                  <span className="text-lg font-display">{stat.pending}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Improved Table */}
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs sticky left-0 z-20 bg-slate-50 dark:bg-slate-800">Aluno</th>
                  {monthColIndices.map(idx => (
                    <th key={idx} className="px-6 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs text-center">{headers[idx]}</th>
                  ))}
                  <th className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs text-center">Status Geral</th>
                  <th className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.map((row, i) => (
                  <tr 
                    key={i} 
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${
                      row.generalStatus === 'PENDENTE' ? 'bg-rose-50/30 dark:bg-rose-900/5' : 
                      row.generalStatus === 'EM DIA' ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : ''
                    }`}
                  >
                    <td className="px-8 py-5 font-bold text-slate-800 dark:text-white sticky left-0 z-10 bg-inherit shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-display ${
                          row.generalStatus === 'PENDENTE' ? 'bg-rose-500' : 
                          row.generalStatus === 'EM DIA' ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}>
                          {row.original[nameCol] ? row.original[nameCol][0].toUpperCase() : '?'}
                        </div>
                        {row.original[nameCol] || 'S/ NOME'}
                      </div>
                    </td>
                    {monthColIndices.map((colIdx, mIdx) => {
                      const status = row.statuses[mIdx];
                      return (
                        <td key={colIdx} className="px-4 py-5 text-center">
                          <div className={`inline-flex px-3 py-1.5 rounded-xl border font-black text-[9px] uppercase tracking-tighter ${getStatusColor(status)}`}>
                            {status === 'EMPTY' ? '—' : status}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-8 py-5 text-center">
                      <span className={`px-4 py-2 rounded-full font-display text-[10px] ${
                        row.generalStatus === 'PENDENTE' ? 'bg-rose-500 text-white' : 
                        row.generalStatus === 'EM DIA' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                      }`}>
                        {row.generalStatus}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <button 
                          onClick={() => openEditModal(sheet.name, headers, row.original, row.rowIndex + 1)}
                          className="p-3 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-all border border-slate-100 dark:border-slate-700 opacity-0 group-hover:opacity-100 shadow-md"
                        >
                          <Edit size={16} />
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  
// Sub-components for specific sheets
const EmpresaDashboard = ({ sheetName, data, loading, fetchData, openEditModal }: any) => {
  const sheet = data?.sheets.find((s: any) => s.name === sheetName);
  if (!sheet) return null;
  const analysis = analyzeSheet(sheet);
  if (!analysis) return null;

  const { headers, rows } = analysis;

  const findIdx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const idxPagamento = findIdx('pagamento');
  const idxAluguel = findIdx('aluguel');
  const idxInternet = findIdx('internet');
  const idxEnergia = findIdx('energia');
  const idxAgua = findIdx('água');
  const idxLiquido = findIdx('líquido');
  const idxDivisao = findIdx('sociedade');

  const parseLocalNum = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    const num = parseFloat(val.toString().replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  const lastRowIdx = rows.length - 1;
  const totalsRow = rows[lastRowIdx];
  const monthRows = rows.slice(0, lastRowIdx);

  const computedRows = monthRows.map((row, idx) => {
    const pagamento = parseLocalNum(row[idxPagamento]);
    const aluguel = parseLocalNum(row[idxAluguel]);
    const internet = parseLocalNum(row[idxInternet]);
    const energia = parseLocalNum(row[idxEnergia]);
    const agua = parseLocalNum(row[idxAgua]);

    const liquido = pagamento - (aluguel + internet + energia + agua);
    const divisao = liquido / 2;

    return {
      original: row,
      rowIndex: idx,
      values: { pagamento, aluguel, internet, energia, agua, liquido, divisao }
    };
  });

  const sheetTotals = {
    pagamento: parseLocalNum(totalsRow[idxPagamento]),
    aluguel: parseLocalNum(totalsRow[idxAluguel]),
    internet: parseLocalNum(totalsRow[idxInternet]),
    energia: parseLocalNum(totalsRow[idxEnergia]),
    agua: parseLocalNum(totalsRow[idxAgua]),
    liquido: parseLocalNum(totalsRow[idxLiquido]),
    divisao: parseLocalNum(totalsRow[idxDivisao])
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <h2 className="text-4xl font-display text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-4">
          Gestão <span className="text-brand-blue">Empresarial</span>
        </h2>
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 px-6 py-4 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-xl hover:border-brand-blue transition-all font-display text-xs"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          SINCRONIZAR
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 bg-brand-blue/5 rounded-[3rem] border-2 border-brand-blue/10">
          <p className="text-[10px] font-black text-brand-blue uppercase mb-2">Faturamento Total</p>
          <p className="font-display text-[clamp(1.6rem,2vw,1.875rem)] leading-none tracking-normal break-words text-slate-800 dark:text-white">{formatCurrency(sheetTotals.pagamento)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-8 bg-brand-pink/5 rounded-[3rem] border-2 border-brand-pink/10">
          <p className="text-[10px] font-black text-brand-pink uppercase mb-2">Custos Totais</p>
          <p className="font-display text-[clamp(1.6rem,2vw,1.875rem)] leading-none tracking-normal break-words text-slate-800 dark:text-white">{formatCurrency(sheetTotals.aluguel + sheetTotals.internet + sheetTotals.energia + sheetTotals.agua)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-8 bg-brand-emerald/5 rounded-[3rem] border-2 border-brand-emerald/10">
          <p className="text-[10px] font-black text-brand-emerald uppercase mb-2">Lucro Líquido</p>
          <p className="font-display text-[clamp(1.6rem,2vw,1.875rem)] leading-none tracking-normal break-words text-brand-emerald">{formatCurrency(sheetTotals.liquido)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-8 bg-brand-yellow/5 rounded-[3rem] border-2 border-brand-yellow/10">
          <p className="text-[10px] font-black text-brand-yellow uppercase mb-2">Divisão por Sócio</p>
          <p className="font-display text-[clamp(1.6rem,2vw,1.875rem)] leading-none tracking-normal break-words text-brand-yellow">{formatCurrency(sheetTotals.divisao)}</p>
        </motion.div>
      </div>

      {/* Visão Mensal Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <h3 className="font-display text-sm uppercase tracking-widest text-slate-400">Visão Mensal</h3>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {computedRows.map((row, idx) => {
            const custos = row.values.aluguel + row.values.internet + row.values.energia + row.values.agua;
            const mesStr = row.original[headers.findIndex(h => h.toLowerCase().includes('mês'))] || `Mês ${idx + 1}`;
            
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-lg hover:shadow-xl transition-all"
              >
                <h4 className="font-display text-lg mb-4 text-slate-800 dark:text-white uppercase">{mesStr}</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-brand-blue/5 p-3 rounded-xl">
                    <span className="text-[9px] font-black text-brand-blue uppercase">Faturamento</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatCurrency(row.values.pagamento)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-brand-pink/5 p-3 rounded-xl">
                    <span className="text-[9px] font-black text-brand-pink uppercase">Custos</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatCurrency(custos)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-brand-emerald/5 p-3 rounded-xl">
                    <span className="text-[9px] font-black text-brand-emerald uppercase">Lucro</span>
                    <span className="text-xs font-bold text-brand-emerald">{formatCurrency(row.values.liquido)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-brand-yellow/5 p-3 rounded-xl">
                    <span className="text-[9px] font-black text-brand-yellow uppercase">Divisão</span>
                    <span className="text-xs font-bold text-brand-yellow">{formatCurrency(row.values.divisao)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-xl uppercase text-slate-800 dark:text-white">Planilha Financeira</h3>
          <span className="text-[10px] font-black text-brand-blue bg-brand-blue/10 px-4 py-2 rounded-full border border-brand-blue/20">FONTE: LINHA DE TOTAL DA PLANILHA</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs">{h}</th>
                ))}
                <th className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {computedRows.map((cRow, i) => (
                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  {headers.map((h, j) => {
                    let val = cRow.original[j];
                    const isLiquido = j === idxLiquido;
                    const isDivisao = j === idxDivisao;
                    const isCurrency = j === idxPagamento || j === idxAluguel || j === idxInternet || j === idxEnergia || j === idxAgua;

                    if (isLiquido) val = formatCurrency(cRow.values.liquido);
                    if (isDivisao) val = formatCurrency(cRow.values.divisao);
                    if (isCurrency && val) val = formatCurrency(parseLocalNum(val));

                    return (
                      <td key={j} className={`px-8 py-5 font-bold ${isLiquido || isDivisao ? 'text-brand-blue' : 'text-slate-700 dark:text-slate-300'}`}>
                        {val || <span className="opacity-10">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-8 py-5 text-right transition-opacity opacity-0 group-hover:opacity-100">
                     <button 
                        onClick={() => openEditModal(sheet.name, headers, cRow.original, cRow.rowIndex + 1)}
                        className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-all"
                      >
                        <Edit size={16} />
                      </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 dark:bg-slate-800 font-display border-t-2 border-slate-200 dark:border-slate-700">
                {headers.map((h, j) => {
                  let totalVal = null;
                  if (j === idxPagamento) totalVal = sheetTotals.pagamento;
                  if (j === idxAluguel) totalVal = sheetTotals.aluguel;
                  if (j === idxInternet) totalVal = sheetTotals.internet;
                  if (j === idxEnergia) totalVal = sheetTotals.energia;
                  if (j === idxAgua) totalVal = sheetTotals.agua;
                  if (j === idxLiquido) totalVal = sheetTotals.liquido;
                  if (j === idxDivisao) totalVal = sheetTotals.divisao;

                  return (
                    <td key={j} className="px-8 py-6 text-slate-800 dark:text-white uppercase text-xs">
                      {totalVal !== null ? (
                        <div className="space-y-1">
                          <span className="text-[10px] block opacity-50">Soma da Planilha</span>
                          <span className="text-sm">{formatCurrency(totalVal)}</span>
                        </div>
                      ) : j === 0 || h.toLowerCase().includes('mês') || h.toLowerCase().includes('total') ? (
                        <span className="text-sm font-black">TOTAL FINAL</span>
                      ) : null}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PagamentoDashboard = ({ sheetName, data, openEditModal }: any) => {
  const sheet = data?.sheets.find((s: any) => s.name === sheetName);
  if (!sheet) return null;
  const analysis = analyzeSheet(sheet);
  if (!analysis) return null;

  const { headers, rows } = analysis;
  const [filter, setFilter] = useState<'all' | 'PENDENTE' | 'EM DIA' | 'NOVO'>('all');

  const monthsStr = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const monthColIndices = headers.map((h, i) => {
    const low = h.toUpperCase();
    return monthsStr.some(m => low.includes(m)) ? i : -1;
  }).filter(i => i !== -1);

  const nameCol = headers.findIndex(h => h.toLowerCase().includes('nome') || h.toLowerCase().includes('aluno'));

  const getStatus = (val: string) => {
    if (!val) return 'EMPTY';
    const v = val.toUpperCase().trim();
    if (v.includes('PAGO') && !v.includes('NÃO')) return 'PAGO';
    if (v.includes('NÃO PAGO') || v.includes('PENDENTE')) return 'PENDENTE';
    if (v.includes('ENTROU') || v.includes('NOVO')) return 'NOVO';
    return 'EMPTY';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAGO': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'PENDENTE': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'NOVO': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent';
    }
  };

  const processedRows = rows.map((row, idx) => {
    const statuses = monthColIndices.map(i => getStatus(row[i]));
    const hasPendente = statuses.includes('PENDENTE');
    const hasPago = statuses.includes('PAGO');
    const isNovo = statuses.includes('NOVO');
    
    let generalStatus: 'PENDENTE' | 'EM DIA' | 'NOVO' = 'EM DIA';
    if (hasPendente) generalStatus = 'PENDENTE';
    else if (isNovo && !hasPago) generalStatus = 'NOVO';
    else if (!hasPago && !hasPendente) generalStatus = 'NOVO';

    return {
      original: row,
      rowIndex: idx,
      statuses,
      generalStatus
    };
  });

  const filteredRows = processedRows.filter(r => filter === 'all' || r.generalStatus === filter);

  const monthlyStats = monthColIndices.map((colIdx, i) => {
    const paid = processedRows.filter(r => r.statuses[i] === 'PAGO').length;
    const pending = processedRows.filter(r => r.statuses[i] === 'PENDENTE').length;
    return { month: headers[colIdx], paid, pending };
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-display text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-4">
            Controle de <span className="text-brand-emerald">Pagamentos</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'TODOS', icon: <Users size={14} /> },
            { id: 'PENDENTE', label: 'PENDENTES', icon: <AlertCircle size={14} />, color: 'bg-rose-500' },
            { id: 'EM DIA', label: 'EM DIA', icon: <CheckCircle2 size={14} />, color: 'bg-emerald-500' },
            { id: 'NOVO', label: 'NOVOS', icon: <Calendar size={14} />, color: 'bg-blue-500' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-display text-[10px] transition-all border-2 ${
                filter === f.id 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {monthlyStats.map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="flex-shrink-0 w-48 p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-xl"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">{stat.month}</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-500">PAGOS</span>
                <span className="text-lg font-display">{stat.paid}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-rose-500">PENDENTES</span>
                <span className="text-lg font-display">{stat.pending}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <th className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs sticky left-0 z-20 bg-slate-50 dark:bg-slate-800">Aluno</th>
                {monthColIndices.map(idx => (
                  <th key={idx} className="px-6 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs text-center">{headers[idx]}</th>
                ))}
                <th className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs text-center">Status Geral</th>
                <th className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.map((row, i) => (
                <tr 
                  key={i} 
                  className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${
                    row.generalStatus === 'PENDENTE' ? 'bg-rose-50/30 dark:bg-rose-900/5' : 
                    row.generalStatus === 'EM DIA' ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : ''
                  }`}
                >
                  <td className="px-8 py-5 font-bold text-slate-800 dark:text-white sticky left-0 z-10 bg-inherit shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-display ${
                        row.generalStatus === 'PENDENTE' ? 'bg-rose-500' : 
                        row.generalStatus === 'EM DIA' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}>
                        {row.original[nameCol] ? row.original[nameCol][0].toUpperCase() : '?'}
                      </div>
                      {row.original[nameCol] || 'S/ NOME'}
                    </div>
                  </td>
                  {monthColIndices.map((colIdx, mIdx) => {
                    const status = row.statuses[mIdx];
                    return (
                      <td key={colIdx} className="px-4 py-5 text-center">
                        <div className={`inline-flex px-3 py-1.5 rounded-xl border font-black text-[9px] uppercase tracking-tighter ${getStatusColor(status)}`}>
                          {status === 'EMPTY' ? '—' : status}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-8 py-5 text-center">
                    <span className={`px-4 py-2 rounded-full font-display text-[10px] ${
                      row.generalStatus === 'PENDENTE' ? 'bg-rose-500 text-white' : 
                      row.generalStatus === 'EM DIA' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                      {row.generalStatus}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right transition-opacity opacity-0 group-hover:opacity-100">
                     <button 
                        onClick={() => openEditModal(sheet.name, headers, row.original, row.rowIndex + 1)}
                        className="p-3 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-all border border-slate-100 dark:border-slate-700 shadow-md"
                      >
                        <Edit size={16} />
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AtrasosDashboard = ({ sheetName, data, openEditModal, darkMode }: any) => {
  const sheet = data?.sheets.find((s: any) => s.name === sheetName);
  if (!sheet) return null;
  const analysis = analyzeSheet(sheet);
  if (!analysis) return null;

  const { headers, rows } = analysis;

  const [filterAluno, setFilterAluno] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  const parseVal = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    const num = parseFloat(val.toString().replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  // The structure is pivoted: Col 0 = Month, Col 1..N = Students
  // Rows are Jan..Dec, then a Total row
  const studentNames = headers.slice(1);
  const monthDataRows = rows.slice(0, rows.length - 1);
  const totalRow = rows[rows.length - 1];

  const studentStats = studentNames.map((name, i) => {
    const colIdx = i + 1;
    let totalDelays = 0;
    monthDataRows.forEach(row => {
       const d = parseVal(row[colIdx]);
       // If the value is > 5 it might already be the currency value, but instructions say 
       // "Indicator (1, 2, 3...) indicates quantity. Each delay = R$5".
       // However, often users might put the total value. We check if it's high.
       // Based on instruction: "Valor 1 -> R$5". We'll treat the cell value as QUANTITY.
       totalDelays += d;
    });

    const totalValue = totalDelays * 5;
    return { name, totalDelays, totalValue };
  });

  const monthlyStats = monthDataRows.map((row, i) => {
    const month = row[0];
    let totalDelays = 0;
    studentNames.forEach((_, sIdx) => {
      totalDelays += parseVal(row[sIdx + 1]);
    });
    return { month, totalDelays, totalValue: totalDelays * 5 };
  });

  const filteredStudents = studentStats.filter(s => filterAluno === 'all' || s.name === filterAluno);
  const totalFines = studentStats.reduce((acc, s) => acc + s.totalValue, 0);
  const alunosComAtraso = studentStats.filter(s => s.totalDelays > 0).length;
  const mediaMulta = studentNames.length > 0 ? totalFines / studentNames.length : 0;

  const sortedByDebt = [...studentStats].sort((a, b) => b.totalValue - a.totalValue);
  const infoMax = sortedByDebt[0];
  const infoMin = [...studentStats].sort((a, b) => a.totalValue - b.totalValue)[0];

  const maxMonth = [...monthlyStats].sort((a, b) => b.totalDelays - a.totalDelays)[0];

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <h2 className="text-4xl font-display text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-4">
          Gestão de <span className="text-brand-pink">Atrasos</span>
        </h2>
        
        <div className="flex flex-wrap gap-4">
          <select 
            value={filterAluno} 
            onChange={(e) => setFilterAluno(e.target.value)}
            className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-xs font-bold font-display uppercase outline-none focus:border-brand-pink"
          >
            <option value="all">Alunos (Todos)</option>
            {studentNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* BLOCO 1 — VISÃO GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-10 bg-brand-pink/5 rounded-[3.5rem] border-2 border-brand-pink/10 flex flex-col items-center text-center">
          <AlertCircle size={32} className="text-brand-pink mb-4" />
          <p className="text-[10px] font-black text-brand-pink uppercase mb-2">Alunos com Atraso</p>
          <p className="text-5xl font-display text-slate-800 dark:text-white">{alunosComAtraso}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-10 bg-rose-500 text-white rounded-[3.5rem] shadow-2xl shadow-rose-500/20 flex flex-col items-center text-center">
          <TrendingUp size={32} className="mb-4" />
          <p className="text-[10px] font-black uppercase mb-2 opacity-80">Valor Total Acumulado</p>
          <p className={metricValueClass}>{formatCurrency(totalFines)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-10 bg-brand-yellow/5 rounded-[3.5rem] border-2 border-brand-yellow/10 flex flex-col items-center text-center">
          <PieChartIcon size={32} className="text-brand-yellow mb-4" />
          <p className="text-[10px] font-black text-brand-yellow uppercase mb-2">Média por Aluno</p>
          <p className={`${metricValueClass} text-slate-800 dark:text-white`}>{formatCurrency(mediaMulta)}</p>
        </motion.div>
      </div>

      {/* BLOCO 2 — ANÁLISE POR ALUNO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
           <h3 className="text-xl font-display uppercase mb-8 flex items-center gap-3">
              <Users size={24} className="text-brand-pink" />
              Ranking de <span className="text-brand-pink">Atrasos</span>
           </h3>
           <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={sortedByDebt.slice(0, 10)}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                    <Bar dataKey="totalValue" radius={[8, 8, 0, 0]}>
                       {sortedByDebt.slice(0, 10).map((entry, index) => (
                          <Cell key={index} fill={entry.totalValue > 50 ? '#f43f5e' : entry.totalValue > 20 ? '#F2B705' : '#30D98F'} />
                       ))}
                    </Bar>
                    <Tooltip formatter={(val) => formatCurrency(val as number)} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="mt-8 flex items-center gap-4 p-6 bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-100 dark:border-rose-800">
              <Zap size={24} className="text-rose-500" />
              <div>
                 <p className="text-[10px] font-black uppercase text-rose-500">Maior Dívida</p>
                 <p className="font-display text-lg text-slate-800 dark:text-white">{infoMax?.name}: {formatCurrency(infoMax?.totalValue)}</p>
              </div>
           </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
           <div className="p-10 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <h3 className="text-xl font-display uppercase">Resumo por Aluno</h3>
           </div>
           <div className="overflow-y-auto max-h-[440px]">
              <table className="w-full text-sm text-left">
                 <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <tr>
                       <th className="px-10 py-6">Aluno</th>
                       <th className="px-10 py-6 text-center">Atrasos</th>
                       <th className="px-10 py-6 text-right">Valor Total</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedByDebt.map((row, i) => (
                       <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all group">
                          <td className="px-10 py-6 font-bold text-slate-800 dark:text-white">{row.name}</td>
                          <td className="px-10 py-6 text-center">
                             <span className={`px-4 py-1.5 rounded-xl font-black text-[10px] ${row.totalDelays > 10 ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                {row.totalDelays} AT.
                             </span>
                          </td>
                          <td className="px-10 py-6 text-right">
                             <p className="font-display text-brand-pink text-lg">{formatCurrency(row.totalValue)}</p>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* BLOCO 3 — ANÁLISE POR MÊS */}
      <div className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl">
         <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10">
            <div>
               <h3 className="text-3xl font-display uppercase text-slate-800 dark:text-white">Tendência <span className="text-brand-pink">Mensal</span></h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Padrão de atrasos ao longo do ano</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="p-6 bg-rose-500/10 rounded-3xl border border-rose-500/20 text-center">
                  <p className="text-[9px] font-black text-rose-500 uppercase mb-1">Mês Problemático</p>
                  <p className="font-display text-xl text-rose-500">{maxMonth?.month}</p>
               </div>
            </div>
         </div>
         <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={monthlyStats}>
                  <defs>
                     <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Tooltip 
                     contentStyle={{ borderRadius: '1.5rem', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff' }}
                     formatter={(val) => [val, 'Atrasos']}
                  />
                  <Area type="monotone" dataKey="totalDelays" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>
    </div>
  );
};

const TurmasDashboard = ({ sheetName, data, openEditModal, darkMode }: any) => {
  const sheet = data?.sheets.find((s: any) => s.name === sheetName);
  if (!sheet) return null;
  const analysis = analyzeSheet(sheet);
  if (!analysis) return null;

  const { headers, rows } = analysis;

  const [filterTurno, setFilterTurno] = useState('all');
  const [filterOcupacao, setFilterOcupacao] = useState('all');

  const idxTurno = 0;
  const idxHorario = 1;
  const idxQtd = 2;
  const idxTotalGeral = 3;

  const parseNum = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    const num = parseInt(val.toString().replace(/\D/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const isTotalsRow = (row: string[]) => row.some(cell => cell?.toString().toLowerCase().includes('total'));
  const dataRows = rows.filter(r => !isTotalsRow(r));
  const totalsRow = rows.find(isTotalsRow) || rows[rows.length - 1];

  const processedData = dataRows.map((r, i) => ({
    original: r,
    index: i,
    turno: r[idxTurno]?.toString().trim() || 'Desconhecido',
    horario: r[idxHorario]?.toString().trim() || '—',
    qtd: parseNum(r[idxQtd])
  }));

  const totalAlunos = parseNum(totalsRow?.[idxTotalGeral]) || processedData.reduce((acc, r) => acc + r.qtd, 0);
  const totalTurmas = processedData.length;
  const mediaAlunos = totalTurmas > 0 ? (totalAlunos / totalTurmas).toFixed(1) : 0;

  const filteredData = processedData.filter(r => {
    const matchTurno = filterTurno === 'all' || r.turno === filterTurno;
    let matchOcupacao = true;
    if (filterOcupacao === 'cheia') matchOcupacao = r.qtd >= 15;
    if (filterOcupacao === 'vazia') matchOcupacao = r.qtd < 8;
    return matchTurno && matchOcupacao;
  }).sort((a, b) => b.qtd - a.qtd);

  const manhaCount = processedData.filter(r => r.turno.toUpperCase().includes('MANH')).reduce((acc, r) => acc + r.qtd, 0);
  const tardeCount = processedData.filter(r => r.turno.toUpperCase().includes('TARD')).reduce((acc, r) => acc + r.qtd, 0);
  const turnoDistData = [
    { name: 'Manhã', value: manhaCount, fill: '#4080F2' },
    { name: 'Tarde', value: tardeCount, fill: '#F2913D' }
  ];

  const sortedTimes = [...processedData].sort((a, b) => b.qtd - a.qtd);
  const infoCheio = sortedTimes[0];
  const infoVazio = sortedTimes[sortedTimes.length - 1];

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <h2 className="text-4xl font-display text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-4">
          Controle de <span className="text-brand-yellow">Turmas</span>
        </h2>
        
        <div className="flex flex-wrap gap-4">
          <select 
            value={filterTurno} 
            onChange={(e) => setFilterTurno(e.target.value)}
            className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-xs font-bold font-display uppercase outline-none focus:border-brand-blue"
          >
            <option value="all">Turno (Todos)</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
          </select>
          <select 
            value={filterOcupacao} 
            onChange={(e) => setFilterOcupacao(e.target.value)}
            className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-xs font-bold font-display uppercase outline-none focus:border-brand-blue"
          >
            <option value="all">Ocupação (Qualquer)</option>
            <option value="cheia">Turmas Cheias (15+)</option>
            <option value="vazia">Turmas Vazias (&lt; 8)</option>
          </select>
        </div>
      </div>

      {/* BLOCO 1 — VISÃO GERAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-10 bg-brand-blue/5 rounded-[3.5rem] border-2 border-brand-blue/10 flex flex-col items-center text-center">
          <Users size={32} className="text-brand-blue mb-4" />
          <p className="text-[10px] font-black text-brand-blue uppercase mb-2">Total de Alunos</p>
          <p className="text-5xl font-display text-slate-800 dark:text-white">{totalAlunos}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-10 bg-brand-pink/5 rounded-[3.5rem] border-2 border-brand-pink/10 flex flex-col items-center text-center">
          <Calendar size={32} className="text-brand-pink mb-4" />
          <p className="text-[10px] font-black text-brand-pink uppercase mb-2">Total de Turmas</p>
          <p className="text-5xl font-display text-slate-800 dark:text-white">{totalTurmas}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-10 bg-brand-emerald/5 rounded-[3.5rem] border-2 border-brand-emerald/10 flex flex-col items-center text-center">
          <PieChartIcon size={32} className="text-brand-emerald mb-4" />
          <p className="text-[10px] font-black text-brand-emerald uppercase mb-2">Média Alunos/Turma</p>
          <p className="text-5xl font-display text-slate-800 dark:text-white">{mediaAlunos}</p>
        </motion.div>
      </div>

      {/* BLOCO 2 — DISTRIBUIÇÃO E ANÁLISE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-display uppercase flex items-center gap-3">
                 <PieChartIcon size={24} className="text-brand-blue" />
                 Distribuição por <span className="text-brand-blue">Turno</span>
              </h3>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center">
                 <p className="text-[8px] font-black uppercase text-slate-400">Destaque</p>
                 <p className="font-display text-brand-pink text-xs uppercase">{manhaCount > tardeCount ? 'Manhã' : 'Tarde'}</p>
              </div>
           </div>
           <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={turnoDistData} innerRadius={60} outerRadius={100} paddingAngle={10} dataKey="value" nameKey="name">
                       {turnoDistData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                 </PieChart>
              </ResponsiveContainer>
           </div>
           <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-brand-blue/5 border border-brand-blue/10">
                 <div className="w-2 h-2 rounded-full bg-brand-blue" />
                 <div>
                    <p className="text-[9px] font-black text-brand-blue uppercase">MANHÃ</p>
                    <p className="font-display text-lg">{manhaCount} Alunos</p>
                 </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-brand-orange/5 border border-brand-orange/10">
                 <div className="w-2 h-2 rounded-full bg-brand-orange" />
                 <div>
                    <p className="text-[9px] font-black text-brand-orange uppercase">TARDE</p>
                    <p className="font-display text-lg">{tardeCount} Alunos</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-display uppercase flex items-center gap-3">
                 <BarChart3 size={24} className="text-brand-emerald" />
                 Análise por <span className="text-brand-emerald">Horário</span>
              </h3>
           </div>
           <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={processedData}>
                    <XAxis dataKey="horario" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                    <Bar dataKey="qtd" radius={[8, 8, 0, 0]}>
                       {processedData.map((entry, index) => (
                          <Cell key={index} fill={entry.turno.toUpperCase().includes('MANH') ? '#4080F2' : '#F2913D'} />
                       ))}
                    </Bar>
                    <Tooltip />
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between p-5 rounded-[2rem] bg-emerald-500/5 border-2 border-emerald-500/10">
                 <div className="flex items-center gap-4">
                    <TrendingUp size={24} className="text-emerald-500" />
                    <div>
                       <p className="text-[10px] font-black uppercase text-emerald-500">Mais Cheio</p>
                       <p className="font-display text-lg">{infoCheio?.horario} ({infoCheio?.turno})</p>
                    </div>
                 </div>
                 <p className="text-3xl font-display text-emerald-500">{infoCheio?.qtd}</p>
              </div>
              <div className="flex items-center justify-between p-5 rounded-[2rem] bg-rose-500/5 border-2 border-rose-500/10">
                 <div className="flex items-center gap-4">
                    <Zap size={24} className="text-rose-500" />
                    <div>
                       <p className="text-[10px] font-black uppercase text-rose-500">Mais Vazio</p>
                       <p className="font-display text-lg">{infoVazio?.horario} ({infoVazio?.turno})</p>
                    </div>
                 </div>
                 <p className="text-3xl font-display text-rose-500">{infoVazio?.qtd}</p>
              </div>
           </div>
        </div>
      </div>

      {/* BLOCO 4 — TABELA ORGANIZADA */}
      <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
           <h3 className="text-2xl font-display uppercase">Lista de Turmas</h3>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-brand-blue uppercase">
                 <div className="w-2 h-2 rounded-full bg-brand-blue" /> MANHÃ
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-brand-orange uppercase">
                 <div className="w-2 h-2 rounded-full bg-brand-orange" /> TARDE
              </div>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-10 py-6">Turno / Período</th>
                <th className="px-10 py-6">Horário de Início</th>
                <th className="px-10 py-6 text-center">Ocupação</th>
                <th className="px-10 py-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredData.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all group">
                  <td className="px-10 py-8">
                    <div className={`inline-flex px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight ${
                      row.turno.toUpperCase().includes('MANH') ? 'bg-brand-blue/10 text-brand-blue' : 'bg-brand-orange/10 text-brand-orange'
                    }`}>
                      {row.turno}
                    </div>
                  </td>
                  <td className="px-10 py-8 font-display text-xl text-slate-800 dark:text-white">{row.horario}</td>
                  <td className="px-10 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <span className={`text-2xl font-display ${row.qtd >= 15 ? 'text-brand-emerald' : row.qtd < 8 ? 'text-brand-pink' : 'text-brand-blue'}`}>
                          {row.qtd} Alunos
                       </span>
                       <div className="w-32 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                             className={`h-full transition-all duration-1000 ${row.qtd >= 15 ? 'bg-brand-emerald' : row.qtd < 8 ? 'bg-brand-pink' : 'bg-brand-blue'}`} 
                             style={{ width: `${Math.min(100, (row.qtd / 20) * 100)}%` }}
                          />
                       </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <button 
                      onClick={() => openEditModal(sheetName, headers, row.original, row.index + 1)}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-brand-blue shadow-lg border border-slate-100 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AlunosDashboard = ({ sheetName, data, openEditModal, darkMode }: any) => {
  const sheet = data?.sheets.find((s: any) => s.name === sheetName);
  if (!sheet) return null;
  const analysis = analyzeSheet(sheet);
  if (!analysis) return null;

  const { headers, rows } = analysis;

  // Filters state
  const [filterEscola, setFilterEscola] = useState('all');
  const [filterSerie, setFilterSerie] = useState('all');
  const [filterResponsavel, setFilterResponsavel] = useState('all');
  const [filterHorario, setFilterHorario] = useState('all');

  const idxNome = 0;
  const idxSerie = 1;
  const idxEscola = 2;
  const idxResponsavel = 3;
  const idxHorario = 4;
  const idxValor = 5;
  const idxDia = 6;

  const parseLocalNum = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    const num = parseFloat(val.toString().replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  // Filter options
  const escolas = Array.from(new Set(rows.map(r => r[idxEscola]).filter(Boolean))).sort();
  const series = Array.from(new Set(rows.map(r => r[idxSerie]).filter(Boolean))).sort();
  const responsaveis = Array.from(new Set(rows.map(r => r[idxResponsavel]).filter(Boolean))).sort();
  const horarios = Array.from(new Set(rows.map(r => r[idxHorario]).filter(Boolean))).sort();

  const filteredRows = rows.filter(r => {
    const matchEscola = filterEscola === 'all' || r[idxEscola] === filterEscola;
    const matchSerie = filterSerie === 'all' || r[idxSerie] === filterSerie;
    const matchResp = filterResponsavel === 'all' || r[idxResponsavel] === filterResponsavel;
    const matchHorario = filterHorario === 'all' || r[idxHorario] === filterHorario;
    return matchEscola && matchSerie && matchResp && matchHorario;
  });

  // Calculate Metrics
  const totalAlunos = rows.length;
  const faturamentoTotal = rows.reduce((acc, r) => acc + parseLocalNum(r[idxValor]), 0);
  const ticketMedio = totalAlunos > 0 ? faturamentoTotal / totalAlunos : 0;

  // Financial Breakdown by Day
  const faturamentoPorDia = [5, 10, 15, 30].map(dia => {
    const alunosNoDia = rows.filter(r => r[idxDia]?.toString() === dia.toString());
    const valorNoDia = alunosNoDia.reduce((acc, r) => acc + parseLocalNum(r[idxValor]), 0);
    return { name: `Dia ${dia}`, value: valorNoDia, count: alunosNoDia.length };
  });

  // Distribution helpers
  const distribute = (idx: number) => {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const key = r[idx] || 'Não Informado';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const escolaDist = distribute(idxEscola);
  const serieDist = distribute(idxSerie);
  const horarioDist = distribute(idxHorario);

  return (
    <div className="space-y-12 pb-20">
      {/* 0. TOP FILTERS */}
      <section className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 mr-4">
            <Filter size={18} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros Rápidos</span>
          </div>
          <select 
            value={filterEscola} 
            onChange={(e) => setFilterEscola(e.target.value)}
            className="flex-1 min-w-[150px] px-6 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold font-display uppercase outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="all">Todas Escolas</option>
            {escolas.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select 
            value={filterSerie} 
            onChange={(e) => setFilterSerie(e.target.value)}
            className="flex-1 min-w-[150px] px-6 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold font-display uppercase outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="all">Todas Séries</option>
            {series.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select 
            value={filterResponsavel} 
            onChange={(e) => setFilterResponsavel(e.target.value)}
            className="flex-1 min-w-[150px] px-6 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold font-display uppercase outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="all">Todos Responsáveis</option>
            {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select 
            value={filterHorario} 
            onChange={(e) => setFilterHorario(e.target.value)}
            className="flex-1 min-w-[150px] px-6 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold font-display uppercase outline-none focus:ring-2 focus:ring-brand-blue"
          >
            <option value="all">Todos Horários</option>
            {horarios.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </section>

      {/* BLOCO 1 — ALUNOS (BLUE THEME) */}
      <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue flex items-center justify-center text-white shadow-lg shadow-brand-blue/20">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-3xl font-display text-slate-800 dark:text-white uppercase tracking-tight">Bloco de <span className="text-brand-blue">Alunos</span></h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Informações e Organização</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 bg-brand-blue/5 rounded-[3rem] border-2 border-brand-blue/10 flex flex-col items-center text-center">
            <p className="text-[10px] font-black text-brand-blue uppercase mb-2">Total de Alunos</p>
            <p className="text-5xl font-display text-brand-blue">{totalAlunos}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-8 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Séries Atendidas</p>
            <p className="text-5xl font-display text-slate-800 dark:text-white">{series.length}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-8 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Escolas Parceiras</p>
            <p className="text-5xl font-display text-slate-800 dark:text-white">{escolas.length}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-8 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Famílias</p>
            <p className="text-5xl font-display text-slate-800 dark:text-white">{responsaveis.length}</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
             <h4 className="font-display text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
               <TableIcon size={14} className="text-brand-blue" />
               Alunos por Série
             </h4>
             <div className="h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={serieDist} layout="vertical">
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} width={80} />
                   <Tooltip />
                   <Bar dataKey="value" fill="#4080F2" radius={[0, 10, 10, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
             <h4 className="font-display text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
               <PieChartIcon size={14} className="text-brand-blue" />
               Alunos por Escola
             </h4>
             <div className="h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie data={escolaDist} innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" nameKey="name">
                      {escolaDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
             <h4 className="font-display text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
               <Zap size={14} className="text-brand-blue" />
               Alunos por Horário
             </h4>
             <div className="h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={horarioDist}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                    <Bar dataKey="value" fill="#4080F2" radius={[10, 10, 0, 0]} />
                    <Tooltip />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-slate-800/50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="px-10 py-6">Nome / Série</th>
                  <th className="px-10 py-6">Escola</th>
                  <th className="px-10 py-6">Responsável</th>
                  <th className="px-10 py-6">Turma / Horário</th>
                  <th className="px-10 py-6 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredRows.map((row, i) => (
                  <tr key={i} className="hover:bg-brand-blue/5 transition-all group">
                    <td className="px-10 py-6">
                      <div className="font-bold text-slate-800 dark:text-white text-base">{row[idxNome] || '—'}</div>
                      <div className="text-[10px] text-brand-blue font-black">{row[idxSerie]}</div>
                    </td>
                    <td className="px-10 py-6">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-tight">{row[idxEscola]}</span>
                    </td>
                    <td className="px-10 py-6 text-slate-600 dark:text-slate-400 font-medium">{row[idxResponsavel]}</td>
                    <td className="px-10 py-6 font-black text-slate-400 text-xs">{row[idxHorario]}</td>
                    <td className="px-10 py-6 text-right">
                       <p className="font-display text-brand-blue text-lg">{formatCurrency(parseLocalNum(row[idxValor]))}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* BLOCO 2 — FINANCEIRO (GREEN THEME) */}
      <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-4 pt-12 border-t-2 border-slate-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-brand-emerald flex items-center justify-center text-white shadow-lg shadow-brand-emerald/20">
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 className="text-3xl font-display text-slate-800 dark:text-white uppercase tracking-tight">Bloco <span className="text-brand-emerald">Financeiro</span></h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Faturamento e Recebimentos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-10 bg-brand-emerald text-white rounded-[3.5rem] shadow-2xl shadow-brand-emerald/30">
                <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-80">Faturamento Total</p>
                <p className={`${metricValueClass} text-white`}>{formatCurrency(faturamentoTotal)}</p>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase opacity-60">
                   <CheckCircle2 size={14} /> Dados Consolidados
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="p-10 bg-white dark:bg-slate-900 border-2 border-brand-emerald/20 rounded-[3.5rem] shadow-xl">
                <p className="text-[10px] font-black text-brand-emerald uppercase tracking-widest mb-2">Ticket Médio</p>
                <p className={`${metricValueClass} text-slate-800 dark:text-white`}>{formatCurrency(ticketMedio)}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-tighter">Média por Aluno Registrado</p>
              </motion.div>
           </div>

           <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
              <h4 className="font-display text-xs uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                <BarChart3 size={16} className="text-brand-emerald" />
                Faturamento por Vencimento
              </h4>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faturamentoPorDia}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                    <Bar dataKey="value" fill="#30D98F" radius={[10, 10, 0, 0]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1.5rem', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [formatCurrency(val), 'Faturamento']}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>

        {/* Daily Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {faturamentoPorDia.map((dia, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-lg hover:border-brand-emerald transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-display text-sm group-hover:bg-brand-emerald group-hover:text-white transition-colors">
                  {dia.name.split(' ')[1]}
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Alunos</p>
                  <p className="font-display text-slate-800 dark:text-white">{dia.count}</p>
                </div>
              </div>
              <p className="text-[10px] font-black text-brand-emerald uppercase mb-1">Previsão de Recebimento</p>
              <p className="text-2xl font-display text-brand-emerald">{formatCurrency(dia.value)}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

  const renderSheetDashboard = (sheetName: string) => {
    if (sheetName.toUpperCase() === 'EMPRESA') {
      return (
        <EmpresaDashboard 
          sheetName={sheetName} 
          data={data} 
          loading={loading} 
          fetchData={fetchData} 
          openEditModal={openEditModal} 
        />
      );
    }
    if (sheetName.toUpperCase() === 'TURMAS') {
      return (
        <TurmasDashboard 
          sheetName={sheetName} 
          data={data} 
          openEditModal={openEditModal} 
          darkMode={darkMode}
        />
      );
    }
    if (sheetName.toUpperCase() === 'ATRASOS') {
      return (
        <AtrasosDashboard 
          sheetName={sheetName} 
          data={data} 
          openEditModal={openEditModal} 
          darkMode={darkMode}
        />
      );
    }
    if (sheetName.toUpperCase() === 'ALUNOS') {
      return (
        <AlunosDashboard 
          sheetName={sheetName} 
          data={data} 
          openEditModal={openEditModal} 
          darkMode={darkMode}
        />
      );
    }
    if (sheetName.toUpperCase().includes('PAGAMENTO MESES')) {
      return (
        <PagamentoDashboard 
          sheetName={sheetName} 
          data={data} 
          openEditModal={openEditModal} 
        />
      );
    }

    const sheet = data?.sheets.find(s => s.name === sheetName);
    if (!sheet) return null;

    const analysis = analyzeSheet(sheet);
    if (!analysis || analysis.rows.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-full mb-4">
            <Search size={48} className="opacity-20" />
          </div>
          <p className="font-display uppercase tracking-widest">Nada de importante por aqui ainda</p>
        </div>
      );
    }

    const { headers, rows, numericCols, nameColIdx, groupColIdx } = analysis;

    const parseNumericValue = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      const num = parseFloat(val.toString().replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.'));
      return isNaN(num) ? 0 : num;
    };

    // Determine visual style
    const scoreColIdx = numericCols.find(idx => idx !== nameColIdx);

    // Grouping logic if Turma/Class exists
    const groupStats = groupColIdx !== -1 ? rows.reduce((acc: Record<string, { count: number, total: number }>, row) => {
      const groupName = row[groupColIdx] || 'Sem Grupo';
      if (!acc[groupName]) acc[groupName] = { count: 0, total: 0 };
      acc[groupName].count++;
      if (scoreColIdx !== undefined) {
        acc[groupName].total += parseNumericValue(row[scoreColIdx]);
      }
      return acc;
    }, {}) : null;

    const groupData = groupStats ? Object.entries(groupStats).map(([name, stats]) => ({
      name,
      count: stats.count,
      average: (scoreColIdx !== undefined && stats.count > 0) ? (stats.total / stats.count).toFixed(1) : null
    })) : [];

    // Top Metrics
    const rowCount = rows.length;
    const averageScore = (scoreColIdx !== undefined && rowCount > 0)
      ? (rows.reduce((acc, row) => acc + parseNumericValue(row[scoreColIdx]), 0) / rowCount).toFixed(1)
      : null;

    return (
      <div className="space-y-8 pb-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-display text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-4">
              {sheet.name}
              <span className="text-xs font-black bg-brand-blue/10 text-brand-blue px-4 py-2 rounded-full border border-brand-blue/20">
                {rowCount} REGISTROS
              </span>
            </h2>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchData}
              className="px-6 py-4 rounded-3xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-display text-xs border-2 border-slate-100 dark:border-slate-800 flex items-center gap-2"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
              ATUALIZAR
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-brand-yellow/10 rounded-[2.5rem] border-2 border-brand-yellow/20 flex items-center gap-4">
            <div className="p-4 bg-brand-yellow rounded-2xl shadow-lg shadow-brand-yellow/20 text-white">
              <TableIcon size={24} />
            </div>
            <div>
              <p className="text-xs font-black text-brand-yellow/80 uppercase">Total de Registros</p>
              <p className="text-3xl font-display">{rowCount}</p>
            </div>
          </motion.div>

          {averageScore && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 bg-brand-emerald/10 rounded-[2.5rem] border-2 border-brand-emerald/20 flex items-center gap-4">
              <div className="p-4 bg-brand-emerald rounded-2xl shadow-lg shadow-brand-emerald/20 text-white">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-xs font-black text-brand-emerald/80 uppercase">Média em {headers[scoreColIdx]}</p>
                <p className="text-3xl font-display">{averageScore}</p>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 bg-brand-pink/10 rounded-[2.5rem] border-2 border-brand-pink/20 flex items-center gap-4">
            <div className="p-4 bg-brand-pink rounded-2xl shadow-lg shadow-brand-pink/20 text-white">
              <RefreshCcw size={24} />
            </div>
            <div>
              <p className="text-xs font-black text-brand-pink/80 uppercase">Status</p>
              <p className="text-3xl font-display uppercase text-sm">Sincronizado</p>
            </div>
          </motion.div>
        </div>

        {groupData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl"
          >
            <h3 className="text-xl font-display mb-8 flex items-center gap-3">
              <TableIcon size={24} className="text-brand-yellow" />
              ANÁLISE POR {headers[groupColIdx].toUpperCase()}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {groupData.map((group, idx) => (
                <div key={idx} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-black text-slate-400 uppercase mb-2">{group.name}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-display text-slate-800 dark:text-white">{group.count}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Registros</p>
                    </div>
                    {group.average && (
                      <div className="text-right">
                        <p className="text-xl font-display text-brand-emerald">{group.average}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Média</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Visual Content Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            {/* Student Cards or Main List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rows.map((row, idx) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  key={idx} 
                  className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-brand-blue/30 transition-all group relative overflow-hidden"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-display text-2xl shadow-inner ${idx % 3 === 0 ? 'bg-brand-blue' : idx % 3 === 1 ? 'bg-brand-pink' : 'bg-brand-emerald'}`}>
                      {row[nameColIdx] ? row[nameColIdx][0].toUpperCase() : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display text-lg text-slate-800 dark:text-white leading-tight truncate group-hover:text-brand-blue transition-colors">
                        {row[nameColIdx] || 'S/ NOME'}
                      </h4>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {headers.map((h, i) => {
                          if (i === nameColIdx || !row[i] || row[i] === '') return null;
                          return (
                            <span key={i} className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700">
                              {h}: {row[i]}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {scoreColIdx !== undefined && (
                        <div className="text-right">
                          <p className="text-2xl font-display text-brand-blue">{row[scoreColIdx]}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{headers[scoreColIdx]}</p>
                        </div>
                      )}
                      <button 
                        onClick={() => openEditModal(sheet.name, headers, row, idx + 1)}
                        className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-brand-blue/10 transition-colors" />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {/* Sidebar with Table Info and Chart */}
            {scoreColIdx !== undefined && (
               <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
                 <h3 className="text-lg font-display mb-6 flex items-center gap-2">
                   <BarChart3 size={20} className="text-brand-emerald" />
                   Performance
                 </h3>
                 <div className="h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={rows.slice(0, 10).map((r, i) => ({
                     name: r[nameColIdx] || `R${i + 1}`, 
                     val: parseNumericValue(r[scoreColIdx])
                   }))}>
                        <XAxis dataKey="name" hide />
                        <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: darkMode ? '#0f172a' : '#fff' }} />
                        <Bar dataKey="val" fill="#30D98F" radius={[8, 8, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
                 <p className="text-center text-[10px] font-black text-slate-400 uppercase mt-4">Top 10 por {headers[scoreColIdx]}</p>
               </div>
            )}

            <div className="bg-slate-900 p-8 rounded-[3rem] border shadow-2xl overflow-hidden relative group">
              <div className="relative z-10">
                <h3 className="text-white font-display text-xl mb-4 uppercase">Exploração Completa</h3>
                <p className="text-slate-400 text-sm font-bold leading-relaxed mb-6">Precisa ver todos os detalhes brutos da planilha?</p>
                <button 
                  onClick={() => {
                    const el = document.getElementById('raw-table');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full bg-slate-800 text-white hover:bg-slate-700 py-4 rounded-2xl font-bold text-xs tracking-widest transition-all border border-slate-700"
                >
                  ABRIR TABELA COMPLETA
                </button>
              </div>
              <TableIcon className="absolute bottom-[-20%] right-[-10%] w-32 h-32 text-white/5 transform -rotate-12" />
            </div>
          </div>
        </div>

        {/* Sticky Raw Table */}
        <div id="raw-table" className="pt-20">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-xl uppercase text-slate-800 dark:text-white">Relatório Detalhado</h3>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-slate-500">
                <Filter size={16} />
                <span className="text-[10px] font-black uppercase">Filtros Inteligentes Ativos</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-8 py-6 font-display text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                      {row.map((cell, j) => (
                        <td key={j} className="px-8 py-5 text-slate-700 dark:text-slate-300 font-medium">
                          {cell || <span className="opacity-10">—</span>}
                        </td>
                      ))}
                      <td className="px-8 py-5 text-right w-20">
                         <button 
                            onClick={() => openEditModal(sheet.name, headers, row, i + 1)}
                            className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Edit size={16} />
                          </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans pb-20 transition-colors duration-500`}>
      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-blue/10 dark:bg-brand-blue/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-pink/10 dark:bg-brand-pink/5 rounded-full blur-[100px]" />
      </div>

      <header className="sticky top-0 z-40 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-pink rounded-xl flex items-center justify-center shadow-lg transform rotate-6">
              <TrendingUp className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-display text-xl tracking-tight leading-none uppercase">Reforço Escola</h1>
              <p className="text-[10px] font-black tracking-[0.2em] text-brand-pink uppercase opacity-70">Tia Layla</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {isConnected && (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
              >
                <LogOut size={20} />
                <span className="hidden sm:inline font-bold text-xs uppercase tracking-widest">Sair</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 relative z-10">
        {!isConnected ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          >
            <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] shadow-2xl border-[6px] border-brand-pink max-w-lg w-full">
              <div className="w-24 h-24 bg-brand-pink/10 text-brand-pink rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 animate-pulse text-6xl">
                ✨
              </div>
              <h2 className="text-4xl font-display mb-6 tracking-tight uppercase leading-tight">
                Dashboard de <span className="text-brand-pink">Dados</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed font-bold text-lg">
                Conecte-se para visualizar métricas, gráficos e tabelas de todas as suas planilhas integradas.
              </p>
              {error && (
                <div className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}
              <button 
                onClick={handleConnect}
                className="w-full bg-brand-blue text-white px-8 py-6 rounded-3xl font-display text-2xl hover:bg-blue-700 hover:scale-[1.02] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 border-b-8 border-blue-800"
              >
                ACESSAR PLANILHAS
                <ChevronRight size={32} />
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-8">
            <nav className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <NavButton 
                active={activeTab === 'geral'} 
                onClick={() => setActiveTab('geral')} 
                icon={<LayoutDashboard size={18} />}
                label="GERAL"
              />
              {data?.sheets.map((sheet) => (
                <NavButton 
                  key={sheet.name}
                  active={activeTab === sheet.name} 
                  onClick={() => setActiveTab(sheet.name)} 
                  icon={<FileSpreadsheet size={18} />}
                  label={sheet.name.toUpperCase()}
                />
              ))}
            </nav>

            {error && (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'geral' ? renderGeralDashboard() : renderSheetDashboard(activeTab)}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingRowData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-2xl font-display uppercase tracking-tight">Editar Registro</h3>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">{editingRowData.sheetName} — Linha {editingRowData.rowIndex + 1}</p>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
                {editingRowData.headers.map((header, idx) => (
                  <div key={idx} className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-4 tracking-[0.15em]">{header || `Coluna ${idx + 1}`}</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-blue rounded-2xl px-6 py-4 font-bold text-slate-800 dark:text-white transition-all outline-none"
                      value={editingRowData.values[idx] || ''}
                      onChange={(e) => {
                        const newVals = [...editingRowData.values];
                        newVals[idx] = e.target.value;
                        setEditingRowData({ ...editingRowData, values: newVals });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="p-8 bg-slate-50 dark:bg-slate-800/50 flex gap-4">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-5 rounded-2xl font-display text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all uppercase"
                >
                  Cancelar
                </button>
                <button 
                  disabled={saveLoading}
                  onClick={handleSaveAllFields}
                  className="flex-[2] py-5 rounded-2xl font-display text-sm bg-brand-blue text-white shadow-xl hover:bg-blue-600 transition-all uppercase flex items-center justify-center gap-2"
                >
                  {saveLoading ? <RefreshCcw size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                  {saveLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: ReactNode, color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 ${color} shadow-xl flex items-center justify-between transition-all`}
    >
      <div>
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-4xl font-display tabular-nums leading-none">{value}</p>
      </div>
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-3xl">
        {icon}
      </div>
    </motion.div>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-display text-sm tracking-tight transition-all whitespace-nowrap border-2 ${
        active 
          ? 'bg-brand-blue text-white shadow-xl border-brand-blue scale-105 z-10' 
          : 'bg-white dark:bg-slate-900 text-slate-500 border-transparent hover:border-slate-200 dark:hover:border-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
