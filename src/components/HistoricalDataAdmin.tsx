import React, { useState, useEffect } from "react";
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Server, 
  Clock, 
  FileText, 
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  FileUp,
  FileJson,
  Key
} from "lucide-react";
import { DSE_SECTOR_MAP } from "../data/dseSectors";

interface CoverageInfo {
  startDate: string;
  endDate: string;
  rows: number;
}

interface ImportSummary {
  totalRowsImported: number;
  validRows: number;
  invalidRows: number;
  symbols: Record<string, {
    rows: number;
    startDate: string;
    endDate: string;
    source: string;
  }>;
}

interface AdminStats {
  coverage: Record<string, CoverageInfo>;
  importSummary: ImportSummary | null;
  validationErrors: string[];
  invalidRows: any[];
  scraperStatus?: {
    connected: boolean;
    activeEndpoint: string;
    lastSuccessfulSync: string | null;
    parsedSymbols: number;
    status: string;
  };
  coverageSummary?: Record<string, { rows: number; firstDate: string; lastDate: string; years: number }>;
  coverageSummaryMtime?: string;
  coverageAudit?: {
    timestamp: string;
    totalSecurities: number;
    coverageCounts: {
      scrapedActive: number;
      historical: number;
      financial: number;
      forecast: number;
      technical: number;
      valuation: number;
    };
    percentages: {
      scrapedActivePercent: number;
      historicalPercent: number;
      financialPercent: number;
      forecastPercent: number;
      technicalPercent: number;
      valuationPercent: number;
    };
    dataQualityScore: number;
    missingReports: {
      historical: string[];
      financial: string[];
      forecast: string[];
      valuation: string[];
    };
  };
  universeSummary?: {
    symbol: string;
    name: string;
    sector: string;
    subSector: string;
    industry: string;
    category: string;
    listingStatus: string;
    type: string;
  }[];
}

interface ClientValidationError {
  row: number;
  field?: string;
  reason: string;
}

const validatePayloadClient = (symbolSelected: string, rows: any[]): ClientValidationError[] => {
  const errors: ClientValidationError[] = [];
  if (!symbolSelected || !symbolSelected.trim()) {
    errors.push({ row: -1, field: "symbol", reason: "Ticker symbol is required." });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push({ row: -1, field: "rows", reason: "Rows must be a non-empty array of items." });
    return errors;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const seenDates = new Set<string>();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push({ row: index, reason: "Row must be a valid JSON object." });
      return;
    }

    const { date, open, high, low, close, volume } = row;

    if (typeof date !== "string" || !dateRegex.test(date.trim())) {
      errors.push({ row: index, field: "date", reason: `Row ${index + 1}: Date must be in YYYY-MM-DD format.` });
    } else {
      const trimmedDate = date.trim();
      const parsedDate = new Date(trimmedDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push({ row: index, field: "date", reason: `Row ${index + 1}: '${trimmedDate}' is not a valid date.` });
      } else if (parsedDate > today) {
        errors.push({ row: index, field: "date", reason: `Row ${index + 1}: '${trimmedDate}' is too new (future/today date limits).` });
      } else {
        if (seenDates.has(trimmedDate)) {
          errors.push({ row: index, field: "date", reason: `Row ${index + 1}: Duplicate date '${trimmedDate}' detected in payload.` });
        } else {
          seenDates.add(trimmedDate);
        }
      }
    }

    const opOk = typeof open === "number" && !isNaN(open) && open > 0;
    const hiOk = typeof high === "number" && !isNaN(high) && high > 0;
    const loOk = typeof low === "number" && !isNaN(low) && low > 0;
    const clOk = typeof close === "number" && !isNaN(close) && close > 0;
    const voOk = typeof volume === "number" && !isNaN(volume) && volume >= 0 && Number.isInteger(volume);

    if (!opOk) errors.push({ row: index, field: "open", reason: `Row ${index + 1}: Open must be positive number.` });
    if (!hiOk) errors.push({ row: index, field: "high", reason: `Row ${index + 1}: High must be positive number.` });
    if (!loOk) errors.push({ row: index, field: "low", reason: `Row ${index + 1}: Low must be positive number.` });
    if (!clOk) errors.push({ row: index, field: "close", reason: `Row ${index + 1}: Close must be positive number.` });
    if (!voOk) errors.push({ row: index, field: "volume", reason: `Row ${index + 1}: Volume must be a non-negative integer.` });

    if (hiOk && loOk && high < low) {
      errors.push({ row: index, field: "high", reason: `Row ${index + 1}: High (${high}) is less than Low (${low}).` });
    }
    if (hiOk && opOk && high < open) {
      errors.push({ row: index, field: "high", reason: `Row ${index + 1}: High (${high}) is less than Open (${open}).` });
    }
    if (hiOk && clOk && high < close) {
      errors.push({ row: index, field: "high", reason: `Row ${index + 1}: High (${high}) is less than Close (${close}).` });
    }
    if (loOk && opOk && low > open) {
      errors.push({ row: index, field: "low", reason: `Row ${index + 1}: Low (${low}) is greater than Open (${open}).` });
    }
    if (loOk && clOk && low > close) {
      errors.push({ row: index, field: "low", reason: `Row ${index + 1}: Low (${low}) is greater than Close (${close}).` });
    }
  });

  return errors;
};

export default function HistoricalDataAdmin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRawSummary, setShowRawSummary] = useState(false);
  const [repairHistoryLoading, setRepairHistoryLoading] = useState<boolean>(false);
  const [repairFinancialsLoading, setRepairFinancialsLoading] = useState<boolean>(false);
  const [repairMessage, setRepairMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [isRefreshingCoverage, setIsRefreshingCoverage] = useState(false);
  const [refreshCoverageMessage, setRefreshCoverageMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleRefreshCoverage = async () => {
    setIsRefreshingCoverage(true);
    setRefreshCoverageMessage(null);
    try {
      const res = await fetch("/api/stocks/historical/refresh-coverage", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRefreshCoverageMessage({ text: data.message || "Coverage summary successfully regenerated.", type: "success" });
        await fetchStats();
      } else {
        throw new Error(data.error || "Failed to update coverage file index.");
      }
    } catch (err: any) {
      setRefreshCoverageMessage({ text: err.message || "An error occurred during coverage refresh.", type: "error" });
    } finally {
      setIsRefreshingCoverage(false);
    }
  };

  const runHistoryRepair = async () => {
    setRepairHistoryLoading(true);
    setRepairMessage(null);
    try {
      const res = await fetch("/api/stocks/historical/repair-history", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRepairMessage({ text: data.message || "Historical coverage repaired successfully!", type: "success" });
        await fetchStats();
      } else {
        throw new Error(data.message || "Failed running historical database repair.");
      }
    } catch (err: any) {
      setRepairMessage({ text: err.message || "An error occurred during repair", type: "error" });
    } finally {
      setRepairHistoryLoading(false);
    }
  };

  const runFinancialsRepair = async () => {
    setRepairFinancialsLoading(true);
    setRepairMessage(null);
    try {
      const res = await fetch("/api/stocks/historical/repair-financials", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRepairMessage({ text: data.message || "Financial database repaired successfully!", type: "success" });
        await fetchStats();
      } else {
        throw new Error(data.message || "Failed running financial database repair.");
      }
    } catch (err: any) {
      setRepairMessage({ text: err.message || "An error occurred during repair", type: "error" });
    } finally {
      setRepairFinancialsLoading(false);
    }
  };

  const [secret, setSecret] = useState<string>("your_secret_here");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedEntriesCount, setParsedEntriesCount] = useState<number>(0);
  const [parsedSymbols, setParsedSymbols] = useState<string[]>([]);
  const [parsedPayload, setParsedPayload] = useState<any[] | null>(null);

  // --- States for the new Single-Ticker Bulk Import Component ---
  const [singleSymbol, setSingleSymbol] = useState<string>("");
  const [singleSymbolSearch, setSingleSymbolSearch] = useState<string>("");
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState<boolean>(false);
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleFileRows, setSingleFileRows] = useState<any[] | null>(null);
  const [singleParseError, setSingleParseError] = useState<string | null>(null);
  const [singleClientErrors, setSingleClientErrors] = useState<ClientValidationError[]>([]);
  const [isSingleUploading, setIsSingleUploading] = useState<boolean>(false);
  const [singleImportResult, setSingleImportResult] = useState<any>(null);
  const [singleDateRange, setSingleDateRange] = useState<{ min: string; max: string } | null>(null);


  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".json")) {
      setImportError("File must be a valid .json archive.");
      setSelectedFile(null);
      setParsedEntriesCount(0);
      setParsedSymbols([]);
      setParsedPayload(null);
      return;
    }
    
    setImportError(null);
    setImportResult(null);
    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        let items: any[] = [];
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && Array.isArray(parsed.data)) {
          items = parsed.data;
        } else {
          throw new Error("JSON payload must be a root array of OHLCV items or contain a 'data' array.");
        }
        
        if (items.length === 0) {
          throw new Error("JSON array contains no items.");
        }
        
        const symbolsSet = new Set<string>();
        items.forEach((item: any) => {
          const sym = item.symbol || item.Symbol;
          if (sym) {
            symbolsSet.add(String(sym).toUpperCase().trim());
          }
        });
        
        setParsedEntriesCount(items.length);
        setParsedSymbols(Array.from(symbolsSet));
        setParsedPayload(items);
      } catch (err: any) {
        setImportError("Failed parsing JSON: " + err.message);
        setSelectedFile(null);
        setParsedEntriesCount(0);
        setParsedSymbols([]);
        setParsedPayload(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerImport = async () => {
    if (!parsedPayload) return;
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch("/api/history/bulk-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret
        },
        body: JSON.stringify({ data: parsedPayload })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server responded with HTTP ${res.status}`);
      }
      
      setImportResult(data);
      if (data.success) {
        setSelectedFile(null);
        setParsedPayload(null);
        setParsedEntriesCount(0);
        setParsedSymbols([]);
        handleRefresh();
      }
    } catch (err: any) {
      setImportError(err.message || "Failed executing bulk import.");
    } finally {
      setImportLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/stocks/historical/admin-stats");
      if (!res.ok) {
        throw new Error(`Failed to load historical admin stats (HTTP ${res.status})`);
      }
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An expected error occurred while fetching system logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats();
    setIsRefreshing(false);
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
        <p className="text-sm font-medium text-[#94A3B8] font-mono animate-pulse">
          Querying historical archive metrics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-2xl p-6 my-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-rose-450 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-base">Pipeline Diagnostics Error</h3>
            <p className="text-sm mt-1 text-rose-400 font-mono">{error}</p>
            <button 
              onClick={fetchStats}
              className="mt-4 px-4 py-2 bg-rose-650 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-rose-900/10 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Diagnosis</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const coverageList: [string, CoverageInfo][] = stats ? Object.entries(stats.coverage) : [];
  const filteredCoverage = coverageList.filter(([symbol]) => 
    symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCoverageFiles = coverageList.length;
  const totalDatabaseRows = coverageList.reduce((acc, [_, info]) => acc + info.rows, 0);

  const calculateYears = (start: string, end: string) => {
    if (!start || !end || start === "N/A" || end === "N/A" || start === "-" || end === "-") return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(diff)) return 0;
    return parseFloat((diff / (365.25 * 24 * 3600 * 1000)).toFixed(1));
  };

  const scraperStatus = stats?.scraperStatus || {
    connected: false,
    activeEndpoint: "https://dse.com.bd/latest_share_price_all.php",
    lastSuccessfulSync: null,
    parsedSymbols: 0,
    status: "Error"
  };

  const coverageSummary = stats?.coverageSummary || {};

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-white" id="historical-data-admin-panel">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] pb-5">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
            System Administrator Interface
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mt-3 flex items-center gap-2 font-display">
            <Server className="h-6 w-6 text-indigo-400" />
            DSE Connection Audit & Database Controls
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1 font-sans">
            Monitor verified connections, file indexes, audit synchronization logs, and historical archives.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-650/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Synchronizing..." : "Refresh Diagnostics"}</span>
          </button>
        </div>
      </div>

      {/* System Coverage Status Indicator */}
      {(() => {
        const lastMtime = stats?.coverageSummaryMtime;
        const lastModifiedFormatted = lastMtime ? new Date(lastMtime).toLocaleString() : "Never";
        const isStale = (() => {
          if (!lastMtime) return true;
          const lastModified = new Date(lastMtime).getTime();
          const now = Date.now();
          const diffInHours = (now - lastModified) / (1000 * 60 * 60);
          return diffInHours > 24;
        })();

        return (
          <div className={`p-5 rounded-2xl border transition-all duration-300 ${
            isStale
              ? "bg-amber-500/5 border-amber-500/20 shadow-lg shadow-amber-950/5"
              : "bg-[#111827] border-[rgba(255,255,255,0.08)]"
          }`} id="system-coverage-status-indicator">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`mt-1 p-2 rounded-xl shrink-0 ${
                  isStale ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-extrabold text-sm text-[#F0F4FF] tracking-wide uppercase">
                      Coverage Index Status
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                      isStale 
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {isStale ? "Stale (>24h)" : "Active & Fresh"}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-1 font-sans">
                    The local coverage index files track valid transaction periods and ticker depth across the universe.
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-1 font-mono">
                    Last Index Update: {lastModifiedFormatted} {isStale && "(Requires recalculation of analytical bounds)"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  onClick={handleRefreshCoverage}
                  disabled={isRefreshingCoverage}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isStale
                      ? "bg-amber-500 hover:bg-amber-600 text-[#0F172A] shadow-lg shadow-amber-500/10"
                      : "bg-[#1F2937] hover:bg-[#374151] text-white border border-[rgba(255,255,255,0.08)]"
                  }`}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingCoverage ? "animate-spin" : ""}`} />
                  <span>{isRefreshingCoverage ? "Recalculating..." : "Refresh Coverage Data"}</span>
                </button>
              </div>
            </div>

            {refreshCoverageMessage && (
              <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-mono border ${
                refreshCoverageMessage.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}>
                {refreshCoverageMessage.text}
              </div>
            )}
          </div>
        );
      })()}

      {/* Dynamic DSE System Integrity & Coverage Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#161F30]/40 border border-[rgba(255,255,255,0.08)] p-6 rounded-3xl" id="dse-system-integrity-dashboard">
        
        {/* Card 1: DSE Connection Status */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${scraperStatus.connected ? "bg-[#10B981] animate-pulse" : "bg-rose-500"}`} />
            <h3 className="font-display font-extrabold text-sm text-[#F0F4FF] tracking-wide uppercase">DSE Connection Status</h3>
          </div>
          
          <div className="bg-[#0B0F19]/60 p-4 rounded-xl border border-[rgba(255,255,255,0.04)] space-y-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Live Endpoint:</span>
              <span className="text-[#F0F4FF] truncate max-w-[180px]" title={scraperStatus.activeEndpoint}>
                {scraperStatus.activeEndpoint.replace("https://www.", "").replace("http://www.", "")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Sync State:</span>
              <span className={`font-bold ${scraperStatus.connected ? "text-emerald-400" : "text-rose-400"}`}>
                {scraperStatus.connected ? "CONNECTED (Live)" : "ScrapeFailed"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Last Sync Time:</span>
              <span className="text-[#00D4FF]">
                {scraperStatus.lastSuccessfulSync ? new Date(scraperStatus.lastSuccessfulSync).toLocaleTimeString() : "Never"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Parsed Assets:</span>
              <span className="text-white font-bold">{scraperStatus.parsedSymbols ?? 0} assets</span>
            </div>
          </div>
        </div>

        {/* Card 2: Core Indices Coverage Depth */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-400" />
            <h3 className="font-display font-extrabold text-sm text-[#F0F4FF] tracking-wide uppercase">Core Indices Coverage</h3>
          </div>

          <div className="bg-[#0B0F19]/60 p-4 rounded-xl border border-[rgba(255,255,255,0.04)] space-y-2.5 font-mono text-xs">
            {/* DSEX */}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.03)] pb-1.5">
              <span className="font-bold text-amber-300">DSEX Index</span>
              <div className="text-right">
                <span className="text-white font-bold block">{stats?.coverage?.["DSEX"]?.rows || 0} rows</span>
                <span className="text-[#94A3B8] text-[10px]">{calculateYears(stats?.coverage?.["DSEX"]?.startDate, stats?.coverage?.["DSEX"]?.endDate)} Years Coverage</span>
              </div>
            </div>
            {/* DS30 */}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.03)] pb-1.5">
              <span className="font-bold text-amber-300">DS30 Index</span>
              <div className="text-right">
                <span className="text-white font-bold block">{stats?.coverage?.["DS30"]?.rows || 0} rows</span>
                <span className="text-[#94A3B8] text-[10px]">{calculateYears(stats?.coverage?.["DS30"]?.startDate, stats?.coverage?.["DS30"]?.endDate)} Years Coverage</span>
              </div>
            </div>
            {/* DSES */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">DSES Index</span>
              <div className="text-right">
                <span className="text-white font-bold block">{stats?.coverage?.["DSES"]?.rows || 0} rows</span>
                <span className="text-[#94A3B8] text-[10px]">{calculateYears(stats?.coverage?.["DSES"]?.startDate, stats?.coverage?.["DSES"]?.endDate)} Years Coverage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Stock Dataset Coverage Dashboard */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-400" />
            <h3 className="font-display font-extrabold text-sm text-[#F0F4FF] tracking-wide uppercase">Stock Dataset Coverage</h3>
          </div>

          <div className="bg-[#0B0F19]/60 p-4 rounded-xl border border-[rgba(255,255,255,0.04)] font-mono text-xs space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg">
                <span className="text-emerald-400 text-lg font-extrabold block font-mono">
                  {Object.values(coverageSummary).filter((info: any) => info.rows >= 1200).length || totalCoverageFiles}
                </span>
                <span className="text-[#94A3B8] text-[9px] uppercase tracking-wider block">5+ Yrs</span>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg">
                <span className="text-amber-400 text-lg font-extrabold block font-mono">
                  {Object.values(coverageSummary).filter((info: any) => info.rows > 0 && info.rows < 1200).length || 0}
                </span>
                <span className="text-[#94A3B8] text-[9px] uppercase tracking-wider block font-sans font-medium">Partial</span>
              </div>
              <div className="bg-rose-500/5 border border-rose-500/10 p-2 rounded-lg">
                <span className="text-rose-400 text-lg font-extrabold block font-mono">0</span>
                <span className="text-[#94A3B8] text-[9px] uppercase tracking-wider block font-sans font-medium">Missing</span>
              </div>
            </div>

            <div className="pt-2">
              <a 
                href="/checklist.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer shadow-lg shadow-indigo-950/20"
              >
                <span>Manual Download Checklist ↗</span>
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-[#64748B] transition-all card-lift">
          <div className="absolute right-4 top-4 text-slate-800/10 group-hover:text-indigo-400/10 duration-300">
            <Database className="h-16 w-16" />
          </div>
          <span className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider font-sans block">
            Verified Stock Files
          </span>
          <span className="text-3xl font-extrabold text-white mt-2 block font-mono">
            {totalCoverageFiles} Tickers
          </span>
          <p className="text-xs text-[#94A3B8] mt-2 flex items-center gap-1.5 pt-1.5 border-t border-[rgba(255,255,255,0.05)] font-sans font-medium">
            <CheckCircle className="h-3 w-3 text-emerald-400" />
            <span>Clean standard headers (OHLCV) found</span>
          </p>
        </div>

        <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-[#64748B] transition-all card-lift">
          <div className="absolute right-4 top-4 text-slate-800/10 group-hover:text-amber-400/10 duration-300">
            <Clock className="h-16 w-16" />
          </div>
          <span className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider font-sans block">
            Total Archives Size
          </span>
          <span className="text-3xl font-extrabold text-white mt-2 block font-mono">
            {totalDatabaseRows.toLocaleString()} Rows
          </span>
          <p className="text-xs text-[#94A3B8] mt-2 flex items-center gap-1.5 pt-1.5 border-t border-[rgba(255,255,255,0.05)] font-sans font-medium">
            <Clock className="h-3 w-3 text-indigo-400" />
            <span>Time-series historical trading range available</span>
          </p>
        </div>

        <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-[#64748B] transition-all card-lift">
          <div className={`absolute right-4 top-4 duration-300 ${stats?.validationErrors && stats.validationErrors.length > 0 ? "text-rose-950/20" : "text-emerald-950/20"}`}>
            <ShieldCheck className="h-16 w-16 text-[#10B981]/15" />
          </div>
          <span className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider font-sans block">
            Pipeline Validation Status
          </span>
          <span className={`text-3xl font-extrabold mt-2 block font-mono ${stats?.validationErrors && stats.validationErrors.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {stats?.validationErrors && stats.validationErrors.length > 0 ? `${stats.validationErrors.length} Errors` : "Nominal"}
          </span>
          <p className="text-xs mt-2 flex items-center gap-1.5 pt-1.5 border-t border-[rgba(255,255,255,0.05)] font-sans font-medium">
            {stats?.validationErrors && stats.validationErrors.length > 0 ? (
              <>
                <AlertTriangle className="h-3 w-3 text-rose-500" />
                <span className="text-rose-400">Failed validation rules during import</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 text-[#10B981]" />
                <span className="text-[#10B981]">All columns successfully parsed & unique</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* 📊 DSE Stock Universe & Data Coverage Audit Dashboard */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm p-6 space-y-6 card-lift animate-fade-in" id="dse-universe-coverage-audit">
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2 font-display">
                <Database className="h-5 w-5 text-teal-400" />
                DSE Stock Universe & Data Coverage Audit Panel
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                Deep audit of market data structures. Analyze coverage thresholds for forecasting models, mathematical valuations, and active technical pipelines across the entire Dhaka Stock Exchange (approx. 381+ listed securities).
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={runHistoryRepair}
                disabled={repairHistoryLoading || repairFinancialsLoading}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-teal-500/10 cursor-pointer"
              >
                {repairHistoryLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                <span>Repair Historical Coverage</span>
              </button>

              <button 
                onClick={runFinancialsRepair}
                disabled={repairHistoryLoading || repairFinancialsLoading}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-550/10 cursor-pointer"
              >
                {repairFinancialsLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Server className="h-3 w-3" />}
                <span>Repair Financial Coverage</span>
              </button>
            </div>
          </div>

          {repairMessage && (
            <div className={`mt-4 p-3.5 rounded-xl text-xs border flex items-start gap-2 animate-fade-in ${
              repairMessage.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-[#10B981]" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-450"
            }`}>
              {repairMessage.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span className="font-sans font-medium">{repairMessage.text}</span>
            </div>
          )}

          {/* Audit Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
            {[
              {
                title: "Total Universe",
                value: stats?.coverageAudit?.totalSecurities || 381,
                desc: "Securities Detected",
                pct: 100,
                color: "border-teal-500/20 text-teal-400 bg-teal-500/5",
                barColor: "bg-teal-400"
              },
              {
                title: "scraped active",
                value: stats?.coverageAudit?.coverageCounts?.scrapedActive || 0,
                desc: "Actively Traded",
                pct: stats?.coverageAudit?.percentages?.scrapedActivePercent || 0,
                color: "border-sky-500/20 text-sky-400 bg-sky-500/5",
                barColor: "bg-sky-450"
              },
              {
                title: "Historical",
                value: stats?.coverageAudit?.coverageCounts?.historical || 0,
                desc: "CSV EOD Files",
                pct: stats?.coverageAudit?.percentages?.historicalPercent || 0,
                color: "border-amber-500/20 text-amber-400 bg-amber-500/5",
                barColor: "bg-amber-450"
              },
              {
                title: "Technical",
                value: stats?.coverageAudit?.coverageCounts?.technical || 0,
                desc: "Indicators Active",
                pct: stats?.coverageAudit?.percentages?.technicalPercent || 0,
                color: "border-emerald-500/20 text-emerald-400 bg-emerald-500/5",
                barColor: "bg-[#10B981]"
              },
              {
                title: "Financials",
                value: stats?.coverageAudit?.coverageCounts?.financial || 0,
                desc: "Company Reports",
                pct: stats?.coverageAudit?.percentages?.financialPercent || 0,
                color: "border-[#6366F1]/20 text-[#6366F1] bg-[#6366F1]/5",
                barColor: "bg-[#6366F1]"
              },
              {
                title: "Valuation",
                value: stats?.coverageAudit?.coverageCounts?.valuation || 0,
                desc: "Model Computable",
                pct: stats?.coverageAudit?.percentages?.valuationPercent || 0,
                color: "border-fuchsia-500/20 text-fuchsia-400 bg-fuchsia-500/5",
                barColor: "bg-fuchsia-450"
              }
            ].map((m, idx) => (
              <div key={idx} className={`border p-4 rounded-xl flex flex-col justify-between ${m.color}`}>
                <div>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-[#94A3B8] block">{m.title}</span>
                  <span className="text-xl font-extrabold font-mono block mt-1.5">{m.value}</span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-[#94A3B8] mb-1 font-mono font-bold">
                    <span>{m.desc}</span>
                    <span>{m.pct}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${m.barColor}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Missing Tickers Reports Tab/Section */}
          {stats?.coverageAudit && (
            <div className="mt-6 border border-[rgba(255,255,255,0.06)] rounded-xl bg-[#1A2235]/40 p-4 space-y-4 font-sans">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                Missing Database Records & Coverage Deficits
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-amber-300">Missing Historical/Forecast/Technical ({stats.coverageAudit.missingReports.historical.length})</span>
                    <span className="text-[10px] text-[#64748B] font-mono">Needs CSV Archive</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto border border-[rgba(255,255,255,0.05)] p-2 bg-[#111827] rounded-lg flex flex-wrap gap-1.5 scrollbar-thin">
                    {stats.coverageAudit.missingReports.historical.length === 0 ? (
                      <span className="text-[11px] text-emerald-400 p-1 font-mono font-medium">✨ 100% Complete! No coverage deficit on time-series files.</span>
                    ) : (
                      stats.coverageAudit.missingReports.historical.map((sym: string) => (
                        <span key={sym} className="text-[9px] font-bold font-mono px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded">
                          {sym}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-indigo-300">Missing Financials/Valuations ({stats.coverageAudit.missingReports.financial.length})</span>
                    <span className="text-[10px] text-[#64748B] font-mono">Needs Fundamentals</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto border border-[rgba(255,255,255,0.05)] p-2 bg-[#111827] rounded-lg flex flex-wrap gap-1.5 scrollbar-thin">
                    {stats.coverageAudit.missingReports.financial.length === 0 ? (
                      <span className="text-[11px] text-emerald-400 p-1 font-mono font-medium">✨ 100% Complete! Structured financial database is fully populated.</span>
                    ) : (
                      stats.coverageAudit.missingReports.financial.map((sym: string) => (
                        <span key={sym} className="text-[9px] font-bold font-mono px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded">
                          {sym}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historical Data Archive Bulk Import Center */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm p-6 space-y-6 card-lift">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2 font-display">
            <UploadCloud className="h-5 w-5 text-indigo-400" />
            Historical Archive Bulk Import Center
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Load clean JSON archive streams containing bulk OHLCV time-series rows. File uploads will be parsed, verified against deep model constraints, and integrated seamlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
          {/* File input drag and drop zone */}
          <div className="sm:col-span-2 space-y-3">
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative ${
                dragActive
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-[rgba(255,255,255,0.08)] bg-[#1A2235]/45 hover:border-slate-500 hover:bg-[#1A2235]"
              }`}
            >
              <input
                type="file"
                id="json-file-input"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="json-file-input" className="cursor-pointer space-y-3 block">
                <FileUp className="h-10 w-10 text-[#94A3B8] mx-auto opacity-75" />
                <div className="text-xs font-semibold text-[#CBD5E1]">
                  Drag and drop your <span className="text-indigo-400 font-bold">.json</span> archive, or <span className="text-indigo-400 underline font-bold">browse</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Schema format: Array of &lt;OHLCV&gt; row instances or nested in "data" property.
                </div>
              </label>
            </div>

            {/* Selected stats/draft indicator */}
            {selectedFile && (
              <div className="bg-indigo-950/15 border border-indigo-500/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs text-[#CBD5E1]">
                <div className="flex items-start gap-2.5">
                  <FileJson className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block truncate max-w-xs">{selectedFile.name}</span>
                    <span className="text-slate-400 font-semibold block text-[10px]">
                      {parsedEntriesCount.toLocaleString()} raw rows parsed • {parsedSymbols.length} ticker symbols mapped
                    </span>
                    <div className="flex flex-wrap gap-1 mt-2 max-h-20 overflow-y-auto scrollbar-thin">
                      {parsedSymbols.slice(0, 15).map(s => (
                        <span key={s} className="bg-indigo-950/40 border border-indigo-500/20 text-[9px] px-1.5 py-0.2 rounded font-bold text-indigo-300">
                          {s}
                        </span>
                      ))}
                      {parsedSymbols.length > 15 && (
                        <span className="text-[9px] text-[#94A3B8] px-1.5 py-0.2">
                          + {parsedSymbols.length - 15} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setParsedPayload(null);
                      setParsedEntriesCount(0);
                      setParsedSymbols([]);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-bold text-slate-300 cursor-pointer"
                  >
                    Clear Draft
                  </button>
                  <button
                    onClick={triggerImport}
                    disabled={importLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {importLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                    <span>Deploy Archive</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Validation keys and access controls */}
          <div className="bg-[#1A2235]/35 border border-[rgba(255,255,255,0.06)] rounded-xl p-5 space-y-4">
            <div>
              <span className="text-[9px] uppercase font-bold tracking-widest text-[#94A3B8] block">Security Verification</span>
              <h3 className="text-xs font-bold text-white mt-1 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-amber-400" />
                X-Admin-Secret Keys
              </h3>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[#94A3B8] block">Connection Passphrase</label>
              <input
                type="password"
                placeholder="Enter admin secret passcode"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="w-full bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-indigo-500 font-mono text-[#E2E8F0]"
              />
              <p className="text-[10px] text-slate-500 font-sans leading-normal">
                Bypasses verification automatically in local configurations. Production deployment requires matching env variables.
              </p>
            </div>
          </div>
        </div>

        {/* Display live results */}
        {importError && (
          <div className="bg-rose-500/10 border border-rose-500/15 text-rose-455 rounded-xl p-4 text-xs flex gap-2.5 font-mono">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-bold block">Archive Import Failure</strong>
              <span>{importError}</span>
            </div>
          </div>
        )}

        {importResult && (
          <div className={`rounded-xl p-4 text-xs font-mono border ${
            importResult.success 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
          }`}>
            <div className="flex gap-2.5">
              {importResult.success ? (
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#10B981]" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              )}
              <div className="space-y-2">
                <div>
                  <strong className="text-white font-bold block">Import Job Result Summary</strong>
                  <span>{importResult.message}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 py-2 text-[11px] border-t border-[rgba(255,255,255,0.05)] font-semibold">
                  <div>
                    <span>Stored Valid rows: </span>
                    <strong className="text-emerald-400 font-bold">{importResult.acceptedCount?.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Rejected rows: </span>
                    <strong className={importResult.rejectedCount > 0 ? "text-rose-400 font-bold" : "text-[#94A3B8] font-bold"}>
                      {importResult.rejectedCount?.toLocaleString()}
                    </strong>
                  </div>
                </div>

                {importResult.invalidRows && importResult.invalidRows.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                    <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Sample Validation Violations:</span>
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-[#111827] p-2 rounded border border-[rgba(255,255,255,0.05)]">
                      {importResult.invalidRows.slice(0, 5).map((err: any, ind: number) => (
                        <div key={ind} className="text-[10px] text-rose-300 leading-normal font-mono">
                          Row {err.index} (Symbol: {err.row?.symbol || "N/A"}, Date: {err.row?.date || "N/A"}): {err.reasons?.join("; ")}
                        </div>
                      ))}
                      {importResult.invalidRows.length > 5 && (
                        <div className="text-[9px] text-slate-500 italic pt-1">
                          + {importResult.invalidRows.length - 5} more errors logged on the backend (check diagnostics right side).
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coverage panel */}
        <div className="lg:col-span-2 space-y-6 animate-fade-in">
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm p-6 card-lift">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-extrabold text-white text-lg flex items-center gap-2 font-display">
                  <Database className="h-5 w-5 text-indigo-400" />
                  Historical Pricing Archive
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Search through files mapping verified physical storage.
                </p>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by symbol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-[#1A2235]/70 text-white placeholder-slate-400"
                />
              </div>
            </div>

            {filteredCoverage.length === 0 ? (
              <div className="text-center py-10 bg-[#1A2235]/30 rounded-xl border border-dashed border-[rgba(255,255,255,0.05)]">
                <AlertTriangle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-[#94A3B8]">
                  No matching historical ticker storage found.
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Ticker symbols that are not indexed will fallback to simulated demo history.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.05)] text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      <th className="pb-3 pl-2">Ticker</th>
                      <th className="pb-3">Source Origin</th>
                      <th className="pb-3">Start Date</th>
                      <th className="pb-3">End Date</th>
                      <th className="pb-3 text-right pr-2">Rows</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(255,255,255,0.04)] font-mono">
                    {filteredCoverage.map(([symbol, info]) => {
                      // Look if match in summary
                      const summaryMatch = stats?.importSummary?.symbols?.[symbol];
                      const displaySource = summaryMatch ? summaryMatch.source : "ManualCSV";

                      return (
                        <tr key={symbol} className="hover:bg-[#1A2235]/30 transition-colors group">
                          <td className="py-3 pl-2 font-bold text-white flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-emerald-400" />
                            <span className="font-display">{symbol}</span>
                          </td>
                          <td className="py-3 text-xs">
                            <span className="bg-[#1A2235] border border-[rgba(255,255,255,0.08)] text-[10px] font-semibold text-[#CBD5E1] px-2 py-0.5 rounded uppercase">
                              {displaySource}
                            </span>
                          </td>
                          <td className="py-3 text-xs font-semibold text-[#94A3B8]">{info.startDate}</td>
                          <td className="py-3 text-xs font-semibold text-[#94A3B8]">{info.endDate}</td>
                          <td className="py-3 text-xs font-bold text-right pr-2 text-[#00D4FF]">
                            {info.rows.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Import Pipeline Summary Card */}
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm p-6 card-lift">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[rgba(255,255,255,0.04)]">
              <div>
                <h3 className="font-extrabold text-white text-lg flex items-center gap-2 font-display">
                  <FileText className="h-5 w-5 text-indigo-400" />
                  Bulk Synchronization History
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Logs from the bulk dse-history split process.
                </p>
              </div>
              <span className="bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full font-mono">
                processed
              </span>
            </div>

            {stats?.importSummary ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-3 gap-4 bg-[#1A2235]/45 p-4 rounded-xl border border-[rgba(255,255,255,0.06)] scale-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Imported</span>
                    <span className="text-xl font-extrabold text-[#CBD5E1] font-mono">
                      {stats.importSummary.totalRowsImported.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">Valid Clean</span>
                    <span className="text-xl font-extrabold text-emerald-400 font-mono">
                      {stats.importSummary.validRows.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 font-bold uppercase block">Rejected (Invalid)</span>
                    <span className={`text-xl font-extrabold font-mono ${stats.importSummary.invalidRows > 0 ? "text-rose-400" : "text-[#94A3B8]"}`}>
                      {stats.importSummary.invalidRows}
                    </span>
                  </div>
                </div>

                <div className="border border-[rgba(255,255,255,0.08)] rounded-xl overflow-hidden shadow-md">
                  <button 
                    onClick={() => setShowRawSummary(!showRawSummary)}
                    className="w-full flex items-center justify-between p-3.5 bg-[#1A2235]/30 hover:bg-[#1A2235]/50 border-b border-[rgba(255,255,255,0.08)] transition-all font-mono text-xs font-semibold text-[#CBD5E1] text-left cursor-pointer"
                  >
                    <span>Raw Meta Logs (history-summary.json)</span>
                    {showRawSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showRawSummary && (
                    <div className="p-4 bg-slate-900 border-t border-[rgba(255,255,255,0.05)] text-emerald-400 font-mono text-xs overflow-x-auto max-h-60 scrollbar-thin rounded-b-xl select-text">
                      <pre>{JSON.stringify(stats.importSummary, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-[#1A2235]/10 rounded-xl border border-[rgba(255,255,255,0.04)]">
                <p className="text-xs text-[#94A3B8]">No raw csv import logs found inside historical processed store.</p>
              </div>
            )}
          </div>
        </div>

        {/* Validation log panel */}
        <div className="space-y-6">
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm p-6 overflow-hidden card-lift">
            <h3 className="font-extrabold text-white text-[15px] flex items-center gap-2 mb-2 font-display">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Dataset Sanitizer Shield
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4 pb-2 border-b border-[rgba(255,255,255,0.05)]">
              Protective constraints designed to intercept broken, empty, negative values or logical breaches.
            </p>

            <ul className="space-y-3 font-sans text-xs">
              {[
                { title: "Standard Date matching", desc: "Verifies YYYY-MM-DD pattern against ISO parser." },
                { title: "No Zero or Negative Price", desc: "Rejects close, open, high, low if <= 0." },
                { title: "OHLC Cross-validations", desc: "Ensures High is the highest value in the OHLC row, and Low is the lowest." },
                { title: "Symbol non-empty check", desc: "Discards keys with unmapped or empty tickers." },
                { title: "Compound De-duplication", desc: "Filters same symbols with matching timestamps." }
              ].map((rule, idx) => (
                <li key={idx} className="flex gap-2 text-xs">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <strong className="text-white block font-medium font-display">{rule.title}</strong>
                    <span className="text-[#94A3B8] leading-normal">{rule.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm p-6 text-xs card-lift">
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2 mb-2 font-display">
              <AlertTriangle className="h-5 w-5 text-indigo-400" />
              Live Validation Errors
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4 pb-2 border-b border-[rgba(255,255,255,0.05)]">
              Records of rejected rows with precise spreadsheet coordinate failures.
            </p>

            {(!stats?.validationErrors || stats.validationErrors.length === 0) ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center shadow-inner">
                <CheckCircle className="h-8 w-8 text-[#10B981] mx-auto mb-2" />
                <h4 className="text-xs font-extrabold text-[#10B981] uppercase tracking-widest font-mono">
                  Operating Nominal
                </h4>
                <p className="text-[11px] text-[#10B981] font-medium mt-1 leading-normal font-sans">
                  All rows strictly checked against core sanitizer rules. Master archive is fully synchronized.
                </p>
              </div>
            ) : (
              <div className="space-y-3 font-mono">
                <div className="bg-rose-500/10 border border-rose-500/15 rounded-xl p-3 text-xs flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-rose-450 font-display">Errors Detected: {stats.validationErrors.length}</strong>
                    <p className="text-rose-400 text-[11px] mt-0.5 leading-normal">See exact pipeline rows rejected below.</p>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 border border-[rgba(255,255,255,0.05)] p-2 rounded-xl bg-[#1A2235] scrollbar-thin">
                  {stats.validationErrors.map((err, i) => (
                    <div key={i} className="text-[10px] font-mono p-2 bg-[#111827] rounded border border-[rgba(255,255,255,0.08)] text-rose-400 leading-normal select-text">
                      {err}
                    </div>
                  ))}
                </div>

                {stats.invalidRows && stats.invalidRows.length > 0 && (
                  <div className="p-3 bg-slate-900 text-rose-400 font-mono text-[10px] rounded-xl overflow-x-auto max-h-40 scrollbar-thin select-text">
                    <pre>{JSON.stringify(stats.invalidRows, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Searchable Single-Ticker Bulk Import Section */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm p-6 space-y-6 card-lift">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2 font-display">
            <Database className="h-5 w-5 text-indigo-400" />
            Single-Ticker Historical Pricing Import
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Configure and import/update the full historical array of daily OHLCV rows for a selected stock ticker.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column - Inputs */}
          <div className="space-y-6">
            {/* Searchable Dropdown */}
            <div className="relative">
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Select Target Ticker Symbol</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search DSE ticker (e.g. GP, BATASHOE, LHBL)..."
                    value={singleSymbolSearch}
                    onFocus={() => setIsSymbolDropdownOpen(true)}
                    onChange={(e) => {
                      setSingleSymbolSearch(e.target.value);
                      setIsSymbolDropdownOpen(true);
                    }}
                    className="w-full bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-xl py-2.5 px-4 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-[#E2E8F0]"
                  />
                  {isSymbolDropdownOpen && (
                    <div className="absolute z-35 w-full mt-1 bg-[#111827] border border-[rgba(255,255,255,0.15)] rounded-xl max-h-60 overflow-y-auto shadow-2xl font-mono text-xs scrollbar-thin">
                      {Object.keys(DSE_SECTOR_MAP)
                        .filter(sym => sym.toLowerCase().includes(singleSymbolSearch.toLowerCase()))
                        .slice(0, 100)
                        .map(sym => (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => {
                              setSingleSymbol(sym);
                              setSingleSymbolSearch(sym);
                              setIsSymbolDropdownOpen(false);
                              if (singleFileRows) {
                                const errs = validatePayloadClient(sym, singleFileRows);
                                setSingleClientErrors(errs);
                              }
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-indigo-600 hover:text-white transition-colors ${
                              singleSymbol === sym ? "bg-indigo-950 text-indigo-400 font-bold" : "text-slate-300"
                            }`}
                          >
                            {sym}
                          </button>
                        ))
                      }
                      {Object.keys(DSE_SECTOR_MAP).filter(sym => sym.toLowerCase().includes(singleSymbolSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-slate-500 text-center">No symbols found matching "{singleSymbolSearch}"</div>
                      )}
                    </div>
                  )}
                </div>
                {singleSymbol && (
                  <div className="bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 text-xs font-bold px-4 py-2 rounded-xl flex items-center shrink-0">
                    {singleSymbol}
                  </div>
                )}
              </div>
            </div>

            {/* Custom file drop & select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block">Select Historical JSON Archive (Max 10MB)</label>
              <div className="border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1A2235]/25 rounded-xl p-8 text-center hover:border-slate-500 transition-colors relative">
                <input
                  type="file"
                  id="single-ticker-json"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        setSingleParseError("File size exceeds 10MB limit.");
                        setSingleFile(null);
                        setSingleFileRows(null);
                        setSingleDateRange(null);
                        setSingleClientErrors([]);
                        return;
                      }
                      setSingleFile(file);
                      setSingleParseError(null);
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const content = JSON.parse(event.target?.result as string);
                          let rows: any[] = [];
                          
                          if (Array.isArray(content)) {
                            rows = content;
                          } else if (content && Array.isArray(content.rows)) {
                            rows = content.rows;
                          } else if (content && Array.isArray(content.data)) {
                            rows = content.data;
                          } else {
                            throw new Error("Invalid structure: JSON must be an array of OHLCV rows or contain a nested 'rows'/'data' array.");
                          }

                          if (rows.length === 0) {
                            throw new Error("JSON file is empty.");
                          }

                          setSingleFileRows(rows);

                          let minD = "";
                          let maxD = "";
                          rows.forEach(r => {
                            const d = r.date || r.Date;
                            if (d) {
                              if (!minD || d < minD) minD = d;
                              if (!maxD || d > maxD) maxD = d;
                            }
                          });
                          setSingleDateRange({ min: minD, max: maxD });

                          // Validate immediately
                          const errs = validatePayloadClient(singleSymbol, rows);
                          setSingleClientErrors(errs);
                        } catch (err: any) {
                          setSingleParseError(err.message || "Invalid JSON parsing error.");
                          setSingleFileRows(null);
                          setSingleDateRange(null);
                          setSingleClientErrors([]);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
                <label htmlFor="single-ticker-json" className="cursor-pointer space-y-3 block">
                  <FileUp className="h-10 w-10 text-slate-400 mx-auto" />
                  <div className="text-xs text-slate-200">
                    {singleFile ? (
                      <span className="font-bold text-indigo-400 block truncate max-w-sm">{singleFile.name} ({(singleFile.size/1024).toFixed(1)} KB)</span>
                    ) : (
                      <span>Drag and drop your single ticker <span className="text-indigo-400 underline font-bold">.json</span> file, or click to browse</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">Format: Array of {"{ date, open, high, low, close, volume }"}</p>
                </label>
              </div>
            </div>

            {singleParseError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl p-4 text-xs font-mono flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-rose-450" />
                <div>
                  <strong className="text-white block font-sans">JSON Format Error</strong>
                  {singleParseError}
                </div>
              </div>
            )}

            {/* Deploy/Import submit button */}
            <div className="pt-2 flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setSingleSymbol("");
                  setSingleSymbolSearch("");
                  setSingleFile(null);
                  setSingleFileRows(null);
                  setSingleDateRange(null);
                  setSingleClientErrors([]);
                  setSingleParseError(null);
                  setSingleImportResult(null);
                }}
                disabled={!singleFile && !singleSymbol}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Clear Form
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!singleSymbol || !singleFileRows) return;
                  setIsSingleUploading(true);
                  setSingleImportResult(null);
                  try {
                    const res = await fetch("/api/history/bulk-import", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "x-admin-secret": secret
                      },
                      body: JSON.stringify({
                        symbol: singleSymbol,
                        rows: singleFileRows
                      })
                    });

                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data.error || `Server returned ${res.status}`);
                    }

                    setSingleImportResult({
                      success: true,
                      message: `Import completely executed for '${singleSymbol}' symbol.`,
                      inserted: data.inserted,
                      updated: data.updated,
                      skipped: data.skipped,
                      errors: data.errors || []
                    });

                    // Success trigger
                    handleRefresh();
                  } catch (err: any) {
                    setSingleImportResult({
                      success: false,
                      message: err.message || "Failed executing HTTP import transaction."
                    });
                  } finally {
                    setIsSingleUploading(false);
                  }
                }}
                disabled={isSingleUploading || !singleSymbol || !singleFileRows || singleClientErrors.length > 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
              >
                {isSingleUploading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deploying Data Archive...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Import and Update Historical Data</span>
                  </>
                )}
              </button>
            </div>

            {/* Custom linear progress during active upload */}
            {isSingleUploading && (
              <div className="w-full bg-[#1A2235] h-1.5 rounded-full overflow-hidden relative">
                <div className="bg-indigo-500 h-full w-2/3 rounded-full animate-pulse absolute left-0 top-0"></div>
              </div>
            )}
          </div>

          {/* Right Column - Preview & Validation Results */}
          <div className="space-y-6">
            {!singleFileRows ? (
              <div className="border border-[rgba(255,255,255,0.05)] bg-[#1A2235]/10 rounded-2xl p-10 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
                <FileJson className="h-10 w-10 text-slate-600 mb-2" />
                <h4 className="text-sm font-bold text-slate-400 font-display">No Preview Payload Loaded</h4>
                <p className="text-xs max-w-sm">
                  Select a ticker symbol and upload a valid daily OHLCV historical pricing dataset to initiate active stream inspection.
                </p>
              </div>
            ) : (
              <div className="bg-[#1A2235]/25 border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-4 font-mono text-xs">
                {/* Validation Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.05)] pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Inspecting Stream</span>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <FileJson className="h-4 w-4 text-indigo-400" />
                      Dataset Summary
                    </h4>
                  </div>
                  <div className="flex flex-col sm:items-end font-semibold text-[#CBD5E1] text-[10px] space-y-1">
                    <div>
                      <span>Total Rows Enlisted: </span>
                      <strong className="text-indigo-400 font-bold">{singleFileRows.length}</strong>
                    </div>
                    {singleDateRange && (
                      <div>
                        <span>Range: </span>
                        <strong className="text-indigo-400 font-bold">{singleDateRange.min} → {singleDateRange.max}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Errors checklist */}
                {singleClientErrors.length > 0 ? (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-4 space-y-2">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <strong className="text-white block font-sans">Validation Checks Failed ({singleClientErrors.length} errors)</strong>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono scrollbar-thin">
                      {singleClientErrors.slice(0, 10).map((err, i) => (
                        <div key={i} className="text-rose-300">
                          • {err.reason}
                        </div>
                      ))}
                      {singleClientErrors.length > 10 && (
                        <div className="text-[10px] text-slate-500 italic">
                          and {singleClientErrors.length - 10} more errors... Correct these issues in your JSON file to proceed.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 rounded-xl p-3 flex gap-2 items-start">
                    <CheckCircle className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-sans text-xs">Client Validation Check Overpasses cleanly</strong>
                      <span className="text-[11px] text-slate-400">No field-level logical conflicts detected. Ready for backend deployment.</span>
                    </div>
                  </div>
                )}

                {/* Rows Preview Grid */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Payload Stream Head Preview (First 5 Rows)</span>
                  <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#111827] scrollbar-none -mx-1 px-1">
                    <table className="w-full text-left border-collapse font-mono text-[10px]">
                      <thead>
                        <tr className="bg-[#1A2235]/40 text-slate-400 uppercase font-semibold text-[9px] border-b border-[rgba(255,255,255,0.05)]">
                          <th className="p-2">Date</th>
                          <th className="p-2">Open</th>
                          <th className="p-2">High</th>
                          <th className="p-2">Low</th>
                          <th className="p-2">Close</th>
                          <th className="p-2 text-right">Volume</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-slate-300">
                        {singleFileRows.slice(0, 5).map((row, i) => {
                          const rowHasError = singleClientErrors.some(e => e.row === i);
                          return (
                            <tr key={i} className={`hover:bg-slate-800/15 transition-colors ${rowHasError ? "bg-rose-950/20 text-rose-300" : ""}`}>
                              <td className="p-2 font-bold">{row.date || row.Date || "N/A"}</td>
                              <td className="p-2">{row.open ?? "N/A"}</td>
                              <td className="p-2">{row.high ?? "N/A"}</td>
                              <td className="p-2">{row.low ?? "N/A"}</td>
                              <td className="p-2 font-bold text-white">{row.close ?? "N/A"}</td>
                              <td className="p-2 text-right text-slate-400">{row.volume?.toLocaleString() ?? "N/A"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Results output block after Import */}
            {singleImportResult && (
              <div className={`rounded-2xl p-5 border text-xs font-mono space-y-3 ${
                singleImportResult.success 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}>
                <div className="flex gap-2 text-sm font-bold">
                  {singleImportResult.success ? (
                    <CheckCircle className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-450 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <strong className="text-white block font-sans">Import Result Diagnostics</strong>
                    <div className="font-normal text-xs">{singleImportResult.message}</div>
                  </div>
                </div>

                {singleImportResult.success && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[rgba(255,255,255,0.05)] text-[11px] font-bold">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Inserted Rows</span>
                      <strong className="text-[#00D4FF] block text-sm mt-0.5">{singleImportResult.inserted ?? 0}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Updated Rows</span>
                      <strong className="text-[#FF8000] block text-sm mt-0.5">{singleImportResult.updated ?? 0}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Identical Skipped</span>
                      <strong className="text-emerald-450 block text-sm mt-0.5">{singleImportResult.skipped ?? 0}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
