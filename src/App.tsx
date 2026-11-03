import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  DollarSign,
  AlertOctagon,
  ShieldAlert,
  Newspaper,
  Bell,
  Sparkles,
  SearchCode,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUpIcon,
  ShieldCheck,
  Star,
  LogIn,
  LogOut,
  UserPlus,
  User,
  Lock,
  Mail,
  Globe,
  Download,
  Scale,
  Maximize2,
  Minimize2,
  LayoutDashboard,
  BookOpen,
  Target,
  PieChart,
  Database,
  History,
  Clock,
  X,
  Menu,
  Home,
  Briefcase
} from "lucide-react";

// Types and Components
import { StockData, AIAnalysis, TechnicalIndicators, ForecastPoint, RiskAnalysis, NewsItem, Alert, PortfolioAllocation, ChatMessage, HistoricalDataPoint, PredictionPoint } from "./types";
import { DSE_COMPANIES } from "./data/dseData";
import { formatNumber, formatPrice, formatPercent, formatPlainPercent, formatMarketCap, formatVolume } from "./utils/formatters";
import DashboardHeader from "./components/DashboardHeader";
import StockOverview from "./components/StockOverview";
const TechnicalSignals = lazyWithFallback(() => import("./components/TechnicalSignals"), "Loading technical analysis");
const PricePrediction = lazyWithFallback(() => import("./components/PricePrediction"), "Loading forecast");
const LossPrevention = lazyWithFallback(() => import("./components/LossPrevention"), "Loading risk tools");
const PortfolioOptimizer = lazyWithFallback(() => import("./components/PortfolioOptimizer"), "Loading optimizer");
const PortfolioManagement = lazyWithFallback(() => import("./components/PortfolioManagement"), "Loading portfolio");
import AuthModalForm from "./components/AuthModalForm";
const DividendHistory = lazyWithFallback(() => import("./components/DividendHistory"), "Loading dividend history");
const MacroMarketContext = lazyWithFallback(() => import("./components/MacroMarketContext"), "Loading market context");
const HistoricalDataAdmin = lazyWithFallback(() => import("./components/HistoricalDataAdmin"), "Loading admin console");
const MarketIntelligenceCenter = lazyWithFallback(() => import("./components/MarketIntelligenceCenter"), "Loading market intelligence");
import MarketOverview from "./components/MarketOverview";
import SectorMarketCapDashboard from "./components/SectorMarketCapDashboard";
const MarketResearcherAI = lazyWithFallback(() => import("./components/MarketResearcherAI"), "Loading AI researcher");
const SectorIntelligenceHub = lazyWithFallback(() => import("./components/SectorIntelligenceHub"), "Loading sector comparison");
const AIStockResearchAssistant = lazyWithFallback(() => import("./components/AIStockResearchAssistant"), "Loading research assistant");
import TickerTape from "./components/TickerTape";
const OpportunityScanner = lazyWithFallback(() => import("./components/modules/OpportunityScanner").then(m => ({ default: m.OpportunityScanner as any })), "Loading opportunity scanner");
const DangerScanner = lazyWithFallback(() => import("./components/modules/DangerScanner").then(m => ({ default: m.DangerScanner as any })), "Loading risk scanner");
const EquityValuationModel = lazyWithFallback(() => import("./components/EquityValuationModel").then(m => ({ default: m.EquityValuationModel as any })), "Loading valuation model");
import RiskContributionSidebarWidget from "./components/RiskContributionSidebarWidget";
const SubscriptionBillingPortal = lazyWithFallback(() => import("./components/SubscriptionBillingPortal"), "Loading billing");
import { GlobalDisclaimer } from "./components/GlobalDisclaimer";
const EducationalAcademy = lazyWithFallback(() => import("./components/EducationalAcademy"), "Loading lessons");
const LearnerProgressRoom = lazyWithFallback(() => import("./components/LearnerProgressRoom").then(m => ({ default: m.LearnerProgressRoom as any })), "Loading progress");
const ThinkAssessmentRoom = lazyWithFallback(() => import("./components/ThinkAssessmentRoom").then(m => ({ default: m.ThinkAssessmentRoom as any })), "Loading quizzes");
import { AiRunBar, AiRunState, AI_IDLE, interpretAiResponse } from "./components/ui/AiRunBar";
import { StockSearch } from "./components/ui/StockSearch";
import { Term, formatChartTick, formatChartDate } from "./components/ui/Term";
import { FreshnessLine } from "./components/ui/StatusPrimitives";
import { Section } from "./components/ui/Section";
import { Toaster, OfflineBanner, toast } from "./components/ui/Toaster";
import HomeHero from "./components/HomeHero";
import { lazyWithFallback } from "./utils/lazyWithFallback";
const HowItWorks = lazyWithFallback(() => import("./components/HowItWorks"), "Loading page");

// Custom chart imports for historical charts
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell, ComposedChart, Line, LineChart, Legend } from "recharts";

// Custom shape to draw a professional candlestick with a clear central wick and color-coded up/down body
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) {
    return null;
  }

  const isGreen = payload.close >= payload.open;
  const color = isGreen ? "#10b981" : "#ef4444";

  // Calculate the center of the bar
  const centerX = x + width / 2;

  // Compute yHigh and yLow using yScale if provided, or falling back
  let yHigh = y;
  let yLow = y + height;
  if (props.yScale) {
    yHigh = props.yScale(payload.high);
    yLow = props.yScale(payload.low);
  } else {
    const priceDiff = Math.abs(payload.close - payload.open);
    if (priceDiff > 0) {
      const ratio = height / priceDiff;
      yHigh = y - (payload.high - Math.max(payload.open, payload.close)) * ratio;
      yLow = y + height + (Math.min(payload.open, payload.close) - payload.low) * ratio;
    }
  }

  return (
    <g>
      {/* 1. Draw the wick (thin vertical line from high to low) */}
      <line
        x1={centerX}
        y1={yHigh}
        x2={centerX}
        y2={yLow}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* 2. Draw the candle body (rectangle from open to close) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(1.5, height)} // assure at least 1.5px height if flat line
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

// Custom Tooltip component to show exact OHLC values and volume for each date
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data && typeof data.close === 'number' && typeof data.open === 'number') {
      const isUp = data.close >= data.open;
      return (
        <div className="bg-black/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md font-mono text-xs text-gray-200 min-w-[200px]" id="chart-tooltip-panel">
          <div className="text-gray-300 font-bold mb-1.5 border-b border-white/10 pb-1.5">{formatChartDate(label)}</div>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-6">
              <span className="text-gray-500 font-semibold">CLOSE:</span>
              <span className={isUp ? "text-[#10b981] font-bold" : "text-[#ef4444] font-bold"}>
                BDT {data.close.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-500 font-semibold">OPEN:</span>
              <span className="text-gray-300">BDT {data.open.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-500 font-semibold">HIGH:</span>
              <span className="text-emerald-400">BDT {data.high.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-gray-500 font-semibold">LOW:</span>
              <span className="text-red-400">BDT {data.low.toFixed(2)}</span>
            </div>
            {data.volume && (
              <div className="flex justify-between gap-6 border-t border-white/10 pt-1.5 mt-1.5 text-[11px]">
                <span className="text-gray-500">VOLUME:</span>
                <span className="text-blue-300 font-semibold">{data.volume.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
  }
  return null;
};

// Custom Tooltip component for 18-month DSEX index vs stock price comparative performance analysis
const ComparativeTooltip = ({ active, payload, label, currentSymbol }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data && typeof data.stockClose === 'number') {
      const stockColor = "#00D4FF";
      const dsexColor = "#f59e0b";
      return (
        <div className="bg-black/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md font-mono text-xs text-gray-200 min-w-[240px]" id="comparative-tooltip-panel">
          <div className="text-gray-400 font-bold mb-1.5 border-b border-white/10 pb-1.5">{label}</div>
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between items-center gap-4">
                <span className="font-semibold flex items-center gap-1.5" style={{ color: stockColor }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stockColor }}></span>
                  {currentSymbol}:
                </span>
                <span className="text-[#F0F4FF] font-bold">BDT {data.stockClose.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 pl-4 mt-0.5">
                <span>Normalized Change:</span>
                <span className={data.stockReturn >= 0 ? "text-[#10b981] font-bold" : "text-[#ef4444] font-bold"}>
                  {data.stockReturn >= 0 ? "+" : ""}{data.stockReturn.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-2">
              <div className="flex justify-between items-center gap-4">
                <span className="font-semibold flex items-center gap-1.5" style={{ color: dsexColor }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dsexColor }}></span>
                  DSEX Index:
                </span>
                <span className="text-[#F0F4FF] font-bold">{data.dsexClose.toFixed(1)} pts</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 pl-4 mt-0.5">
                <span>Normalized Change:</span>
                <span className={data.dsexReturn >= 0 ? "text-[#10b981] font-bold" : "text-[#ef4444] font-bold"}>
                  {data.dsexReturn >= 0 ? "+" : ""}{data.dsexReturn.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-2 mt-1 text-[9px] text-[#64748B] text-center uppercase tracking-wider font-semibold">
              24-Month Baseline Comparison
            </div>
          </div>
        </div>
      );
    }
  }
  return null;
};

function parseInitialRoute(): { symbol: string | null; view: string } {
  if (typeof window === "undefined") {
    return { symbol: null, view: "explore" };
  }
  const path = window.location.pathname.replace(/\/+$/, "");
  const searchParams = new URLSearchParams(window.location.search);
  const querySymbol = searchParams.get("symbol") || searchParams.get("company") || searchParams.get("stock");

  if (querySymbol) {
    return { symbol: querySymbol.toUpperCase().trim(), view: "stock" };
  }

  // Path matching: /company/:symbol, /stocks/:symbol, /analysis/:symbol, or bare /company, /analysis
  // Symbols may contain & ( ) e.g. KAY&QUE, AMCL(PRAN) — they arrive URL-encoded
  const companyMatch = path.match(/^\/(?:company|stocks?|analysis)\/?([^/?#]*)/i);
  if (companyMatch) {
    let raw = companyMatch[1] || "";
    try { raw = decodeURIComponent(raw); } catch { /* keep raw */ }
    const sym = raw.toUpperCase().trim();
    return { symbol: sym || "GP", view: "stock" };
  }

  const cleanPath = path.replace(/^\//, "").toLowerCase();
  const validViews = ["learn", "explore", "ask", "think", "practice", "progress", "portfolio", "intelligence", "admin", "about"];
  if (validViews.includes(cleanPath)) {
    return { symbol: null, view: cleanPath };
  }

  return { symbol: null, view: "explore" };
}

function syncBrowserUrl(symbol: string | null, view: string) {
  if (typeof window === "undefined") return;
  let targetPath = "/";
  if (symbol) {
    targetPath = `/company/${encodeURIComponent(symbol)}`;
  } else if (view && view !== "explore") {
    targetPath = `/${view}`;
  }
  const adminParam = new URLSearchParams(window.location.search).get("admin");
  if (adminParam === "true") {
    targetPath += (targetPath.includes("?") ? "&" : "?") + "admin=true";
  }
  const currentPathWithSearch = window.location.pathname + window.location.search;
  if (currentPathWithSearch !== targetPath) {
    window.history.pushState({ symbol, view }, "", targetPath);
  }
}

export default function App() {
  const initialRoute = parseInitialRoute();
  // Current Stock Focus
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialRoute.symbol);
  const [selectedView, setSelectedView] = useState<string>(initialRoute.view);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Synchronize browser history on Back / Forward button navigation
  useEffect(() => {
    const onPopState = () => {
      const route = parseInitialRoute();
      setSelectedSymbol(route.symbol);
      setSelectedView(route.view);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Admin access gate via URL param or admin role
  const isAdmin = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "true";

  // Layout Tab selection
  const [activeTab, setActiveTab] = useState<"dashboard" | "analyzer" | "technical" | "prediction" | "risk" | "portfolio" | "admin">("dashboard");
  const [isChartFullscreen, setIsChartFullscreen] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // USER AUTH & WATCHLIST ACTIONS
  // --------------------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(() => {
    try {
      const cached = localStorage.getItem("dse_user");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn("Failed to parse cached user:", e);
      return null;
    }
  });
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem("dse_token") || null;
  });
  const [authModalOpen, setAuthModalOpen] = useState<"login" | "signup" | null>(null);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState<boolean>(false);

  const [watchlist, setWatchlist] = useState<StockData[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState<boolean>(false);
  const [isDisclaimerExpanded, setIsDisclaimerExpanded] = useState(false);

  // Sync / fetch profile and watchlist elements
  const fetchProfileAndWatchlist = async () => {
    if (!authToken) return;
    setWatchlistLoading(true);
    try {
      const profileRes = await fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const userObj = {
          email: profileData.email,
          name: profileData.name,
          tier: profileData.tier,
          subscriptionStatus: profileData.subscriptionStatus,
          subscriptionExpiresAt: profileData.subscriptionExpiresAt
        };
        setCurrentUser(userObj);
        localStorage.setItem("dse_user", JSON.stringify(userObj));
      } else {
        handleLogout();
        return;
      }

      const watchlistRes = await fetch("/api/stocks/watchlist/list", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (watchlistRes.ok) {
        const wlData = await watchlistRes.json();
        setWatchlist(wlData);
      }
    } catch (err) {
      console.error("Failed downloading users details and watchlist data:", err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchProfileAndWatchlist();
    } else {
      setWatchlist([]);
    }
  }, [authToken]);

  const handleLoginSubmit = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }
    
    localStorage.setItem("dse_token", data.token);
    localStorage.setItem("dse_user", JSON.stringify(data.user));
    setAuthToken(data.token);
    setCurrentUser(data.user);
    setAuthModalOpen(null);
    setToastNotification({ message: `Assalamu Alaikum, ${data.user.name}! Welcome back to your analyst terminal.`, type: "success" });
  };

  const handleSignupSubmit = async (email: string, name: string, password: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Sign up failed");
    }
    
    localStorage.setItem("dse_token", data.token);
    localStorage.setItem("dse_user", JSON.stringify(data.user));
    setAuthToken(data.token);
    setCurrentUser(data.user);
    setAuthModalOpen(null);
    setToastNotification({ message: `Successfully registered! Welcome, ${data.user.name}.`, type: "success" });
  };

  const handleLogout = async () => {
    if (authToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Authorization": `Bearer ${authToken}` }
        });
      } catch (e) {
        console.warn("Logout request failed:", e);
      }
    }
    localStorage.removeItem("dse_token");
    localStorage.removeItem("dse_user");
    setAuthToken(null);
    setCurrentUser(null);
    setWatchlist([]);
    setToastNotification({ message: "Successfully logged out of the terminal session.", type: "info" });
  };

  // Signed-out visitors use the same browser-saved watchlist as the home screen (no forced sign-in)
  const [localWatchlist, setLocalWatchlist] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem("dse_local_watchlist") || "null"); return Array.isArray(v) ? v : ["GP", "RENATA", "BATBC"]; } catch { return ["GP", "RENATA", "BATBC"]; }
  });
  const saveLocalWatchlist = (next: string[]) => {
    setLocalWatchlist(next);
    try { localStorage.setItem("dse_local_watchlist", JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const isOnAnyWatchlist = (symbol: string) =>
    currentUser && authToken ? watchlist.some(s => s.symbol === symbol) : localWatchlist.includes(symbol);

  const handleToggleWatchlist = async (symbol: string, isUndo = false) => {
    if (!currentUser || !authToken) {
      const had = localWatchlist.includes(symbol);
      const next = had ? localWatchlist.filter(s => s !== symbol) : [...localWatchlist, symbol];
      saveLocalWatchlist(next);
      if (!isUndo) {
        toast({
          message: had ? `Removed ${symbol} from your watchlist.` : `Added ${symbol} to your watchlist.`,
          actionLabel: "Undo",
          onAction: () => saveLocalWatchlist(had ? [...next, symbol] : next.filter(s => s !== symbol)),
        });
      }
      return;
    }
    
    const isOnWatchlist = watchlist.some(s => s.symbol === symbol);
    const endpoint = isOnWatchlist ? "/api/stocks/watchlist/remove" : "/api/stocks/watchlist/add";
    
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ symbol })
      });
      
      if (res.ok) {
        const listRes = await fetch("/api/stocks/watchlist/list", {
          headers: { "Authorization": `Bearer ${authToken}` }
        });
        if (listRes.ok) {
          const wlData = await listRes.json();
          setWatchlist(wlData);
        }
        if (!isUndo) {
          toast({
            message: isOnWatchlist ? `Removed ${symbol} from your watchlist.` : `Added ${symbol} to your watchlist.`,
            actionLabel: "Undo",
            onAction: () => handleToggleWatchlist(symbol, true),
          });
        }
      } else {
        setToastNotification({ message: "Failed updating watchlist. Please try again.", type: "warning" });
      }
    } catch (err) {
      console.error("Watchlist error:", err);
    }
  };


  // Dynamic States loaded via API
  const [stocksList, setStocksList] = useState<StockData[]>(Object.values(DSE_COMPANIES));
  const [currentStock, setCurrentStock] = useState<StockData>(() => {
    const sym = (selectedSymbol || "GP").toUpperCase();
    return DSE_COMPANIES[sym] || DSE_COMPANIES.GP;
  });
  const [stockStats, setStockStats] = useState<{
    week52High: number | null;
    week52Low:  number | null;
    avgVolume:  number | null;
  }>({ week52High: null, week52Low: null, avgVolume: null });
  const [historicalChart, setHistoricalChart] = useState<HistoricalDataPoint[]>([]);
  const [chartDays, setChartDays] = useState<number>(90); // default to 90 days (3M)
  const [chartSource, setChartSource] = useState<string>("Simulation");
  const [chartStyle, setChartStyle] = useState<"area" | "candlestick">("area");
  const [showSMA, setShowSMA] = useState<boolean>(true);
  const [showSRLines, setShowSRLines] = useState<boolean>(false);
  const [showEnvelope, setShowEnvelope] = useState<boolean>(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // 24-month DSEX index vs stock price comparative performance analysis states
  const [showDsexOverlay, setShowDsexOverlay] = useState<boolean>(false);
  const [dsex24mHistory, setDsex24mHistory] = useState<any[]>([]);
  const [stock24mHistory, setStock24mHistory] = useState<any[]>([]);
  const [isDsexOverlayLoading, setIsDsexOverlayLoading] = useState<boolean>(false);

  const hasData = historicalChart.length > 0 && chartSource !== "NoHistoricalData" && chartSource !== "NO_DATA";
  const hasOHLC = hasData && historicalChart.some(item => item.open !== undefined && item.high !== undefined);
  // Describe the chart by where most of its rows came from (the API reports only the newest row's source)
  const chartSourceInfo = useMemo(() => {
    if (!historicalChart.length) return { label: "No historical data available", verified: false };
    const counts: Record<string, number> = {};
    historicalChart.forEach((r: any) => { const k = r.source || chartSource || "Unknown"; counts[k] = (counts[k] || 0) + 1; });
    const main = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const verified = /DSE_OFFICIAL|LiveDseSnapshot|LankaBD/i.test(main);
    const label = verified ? "DSE official data" : /csv|imported|investing/i.test(main) ? "Imported CSV — not verified against DSE" : main;
    return { label, verified };
  }, [historicalChart, chartSource]);
  const isReal = chartSource.toLowerCase().includes("historical") || chartSource.toLowerCase().includes("csv") || chartSource.toLowerCase().includes("database") || chartSource === "DSE Historical archives";

  useEffect(() => {
    if (!hasOHLC && chartStyle === "candlestick") {
      setChartStyle("area");
    }
  }, [historicalChart, chartSource, chartStyle, hasOHLC]);

  const fetchDsexOverlayData = async (symbol: string) => {
    setIsDsexOverlayLoading(true);
    try {
      // 1. Fetch DSEX 24-Month index data if not already cached
      let dsexData = dsex24mHistory;
      if (dsex24mHistory.length === 0) {
        const dsexRes = await fetch("/api/market/benchmark-24m");
        if (dsexRes.ok) {
          const resJson = await dsexRes.json();
          if (resJson && Array.isArray(resJson.data)) {
            dsexData = resJson.data;
            setDsex24mHistory(dsexData);
          }
        }
      }

      // 2. Fetch the Stock's 24-Month data
      const stockRes = await fetch(`/api/stocks/${symbol}/chart?days=730`);
      if (stockRes.ok) {
        const resJson = await stockRes.json();
        const parsed = resJson && Array.isArray(resJson) 
          ? resJson 
          : (resJson && resJson.data && Array.isArray(resJson.data) ? resJson.data : []);
        setStock24mHistory(parsed);
      }
    } catch (err) {
      console.error("Failed to fetch DSEX 24M comparative overlay data:", err);
    } finally {
      setIsDsexOverlayLoading(false);
    }
  };

  useEffect(() => {
    if (showDsexOverlay && currentStock?.symbol) {
      fetchDsexOverlayData(currentStock.symbol);
    }
  }, [showDsexOverlay, currentStock?.symbol]);

  // Aligned date keys for comparative visualization over 24-months timeline
  const comparative24mData = React.useMemo(() => {
    if (!showDsexOverlay || dsex24mHistory.length === 0 || stock24mHistory.length === 0) return [];

    const dsexMap = new Map<string, number>();
    dsex24mHistory.forEach((item: any) => {
      const dateKey = item.date.split("T")[0];
      dsexMap.set(dateKey, item.close);
    });

    const sortedStock = [...stock24mHistory].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Aligned list
    const aligned: { date: string; stockClose: number; dsexClose: number }[] = [];
    sortedStock.forEach((item: any) => {
      const dateKey = item.date.split("T")[0];
      const dsexVal = dsexMap.get(dateKey);
      if (dsexVal !== undefined) {
        aligned.push({
          date: dateKey,
          stockClose: item.close,
          dsexClose: dsexVal
        });
      }
    });

    if (aligned.length === 0) return [];

    // Base closes at the start of the 24-month overlap
    const baseline = aligned[0];
    const startStock = baseline.stockClose || 1;
    const startDsex = baseline.dsexClose || 1;

    return aligned.map((item: any) => {
      const stockReturn = ((item.stockClose - startStock) / startStock) * 100;
      const dsexReturn = ((item.dsexClose - startDsex) / startDsex) * 100;
      return {
        date: item.date,
        stockClose: item.stockClose,
        dsexClose: item.dsexClose,
        stockReturn: parseFloat(stockReturn.toFixed(2)),
        dsexReturn: parseFloat(dsexReturn.toFixed(2))
      };
    });
  }, [showDsexOverlay, dsex24mHistory, stock24mHistory]);
  const [fundamentalAnalysis, setFundamentalAnalysis] = useState<AIAnalysis>({
    recommendation: "" as any,
    reasoning: [],
    fundamentalScore: null as any,
    breakdown: { profitability: "", liquidity: "", solvency: "", growth: "", efficiency: "" }
  });
  const [technicalSignals, setTechnicalSignals] = useState<TechnicalIndicators>({
    rsi: 50,
    rsiStatus: "Neutral",
    macd: { line: 0, signal: 0, histogram: 0 },
    sma20: 0,
    ema50: 0,
    bollingerBands: { upper: 0, middle: 0, lower: 0 },
    support: [],
    resistance: [],
    aiInterpretation: ""
  });
  const [predictions, setPredictions] = useState<PredictionPoint[]>([]);
  const [predictionExplanation, setPredictionExplanation] = useState("");
  const [predictionDisclaimer, setPredictionDisclaimer] = useState("");
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis>({
    score: null as any,
    level: "Not assessed" as any,
    flags: [],
    whatCouldGoWrong: [],
    howToReduceRisk: []
  });

  // AI analyses run only on request (one request per click) — never automatically on page load,
  // so anonymous visitors don't burn their quota just by opening a stock page.
  type AiKind = "fundamental" | "technical" | "predict" | "risk";
  const AI_ENDPOINT: Record<AiKind, string> = { fundamental: "analyze", technical: "technical", predict: "predict", risk: "risk" };
  const [aiRuns, setAiRuns] = useState<Record<AiKind, AiRunState>>({ fundamental: AI_IDLE, technical: AI_IDLE, predict: AI_IDLE, risk: AI_IDLE });
  const runAi = async (kind: AiKind) => {
    const symbol = selectedSymbol;
    if (!symbol) return;
    setAiRuns(prev => ({ ...prev, [kind]: { status: "loading" } }));
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const res = await fetch(`/api/gemini/${AI_ENDPOINT[kind]}/${encodeURIComponent(symbol)}`, { method: "POST", headers });
      const { state, data } = await interpretAiResponse(res);
      if (data) {
        if (data.aiStatus) setAiStatus(data.aiStatus);
        if (kind === "fundamental") setFundamentalAnalysis(data);
        if (kind === "technical") setTechnicalSignals(data);
        if (kind === "predict") {
          setPredictions(data.predictions || []);
          setPredictionExplanation(data.aiExplanation || "");
          setPredictionDisclaimer(data.disclaimer || "");
        }
        if (kind === "risk") setRiskAnalysis(data);
      }
      setAiRuns(prev => ({ ...prev, [kind]: state }));
    } catch {
      setAiRuns(prev => ({ ...prev, [kind]: { status: "error", message: "Network problem — check your connection." } }));
    }
  };
  
  // Custom Portfolio parameters
  const [portfolioCapital, setPortfolioCapital] = useState<number>(100000);
  const [portfolioRisk, setPortfolioRisk] = useState<'Low' | 'Moderate' | 'High'>("Moderate");
  const [portfolioHorizon, setPortfolioHorizon] = useState<string>("3 Years");
  
  const [portfolioAllocations, setPortfolioAllocations] = useState<PortfolioAllocation[]>([]);
  const [portfolioExpectedReturn, setPortfolioExpectedReturn] = useState<number>(12.5);
  const [portfolioVolatility, setPortfolioVolatility] = useState<number>(11.2);
  const [portfolioDivScore, setPortfolioDivScore] = useState<number>(80);
  const [portfolioRiskScore, setPortfolioRiskScore] = useState<number>(45);

  // Alerts configuration list
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: "1", symbol: "GP", type: "Price Above", targetValue: 300, triggered: false, createdAt: new Date().toISOString() },
    { id: "2", symbol: "SQURPHARMA", type: "Price Below", targetValue: 220, triggered: false, createdAt: new Date().toISOString() },
    { id: "3", symbol: "BEXIMCO", type: "Risk Escalation", targetValue: 80, triggered: true, createdAt: new Date().toISOString() }
  ]);

  // Chatbot states
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Assalamu Alaikum! Welcome to the premium DSE AI Analyst hub.\n\nI am your intelligent assistant specifically optimized for Bangladesh DSE companies. I can analyze fundamental valuations, predict price envelopes, and construct optimized portfolios. Ask me anything!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(true);
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    available: boolean;
    reason: string | null;
    mode: string;
  }>({
    configured: false,
    available: false,
    reason: "MissingApiKey",
    mode: "RuleBasedFallback"
  });

  // Loading States
  const [isOverviewLoading, setIsOverviewLoading] = useState(true);
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(false);
  const [portfolioDefaultTab, setPortfolioDefaultTab] = useState<string | undefined>(undefined);
  const [tickerQuery, setTickerQuery] = useState("");
  const [showTickerResults, setShowTickerResults] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Alert Popups / Flash notification toast
  const [toastNotification, setToastNotification] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  // Load stock list from backend on startup
  const checkGeminiConfigured = async () => {
    try {
      const res = await fetch("/api/dse/status");
      if (res.ok) {
        const data = await res.json();
        if (data.geminiConfigured !== undefined) {
          setGeminiConfigured(data.geminiConfigured);
        }
        if (data.aiStatus !== undefined) {
          setAiStatus(data.aiStatus);
        }
      }
    } catch (err) {
      console.warn("Failed checking Gemini status:", err);
    }
  };

  const fetchStocksList = async () => {
    try {
      const res = await fetch("/api/stocks");
      if (res.ok) {
        const data = await res.json();
        setStocksList(data);
        // Ensure current selected stock matches dynamic live attributes
        const matched = data.find((s: any) => s.symbol === selectedSymbol);
        if (matched) {
          setCurrentStock(matched);
        }
      }
    } catch (err) {
      console.warn("Failed fetching stock list from API on startup:", err);
    }
  };

  // Run on startup
  useEffect(() => {
    fetchStocksList();
    checkGeminiConfigured();
  }, []);

  // Sync core changes of focused symbol
  useEffect(() => {
    if (!selectedSymbol) return;
    setStockStats({ week52High: null, week52Low: null, avgVolume: null });
    const fetchSelectedStock = async () => {
      try {
        const res = await fetch(`/api/stocks/${selectedSymbol}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentStock(data);
        } else {
          setCurrentStock(DSE_COMPANIES[selectedSymbol] || DSE_COMPANIES.GP);
        }
      } catch (err) {
        console.warn(`Failed fetching selected stock details for ${selectedSymbol}:`, err);
        setCurrentStock(DSE_COMPANIES[selectedSymbol] || DSE_COMPANIES.GP);
      }
    };
    fetchSelectedStock();
    fetchDataForStock(selectedSymbol);
  }, [selectedSymbol, chartDays]);

  // A different stock: previous AI results no longer apply
  useEffect(() => {
    setAiRuns({ fundamental: AI_IDLE, technical: AI_IDLE, predict: AI_IDLE, risk: AI_IDLE });
    setFundamentalAnalysis({ recommendation: "" as any, reasoning: [], fundamentalScore: null as any, breakdown: { profitability: "", liquidity: "", solvency: "", growth: "", efficiency: "" } });
    setPredictions([]); setPredictionExplanation(""); setPredictionDisclaimer("");
    setRiskAnalysis({ score: null as any, level: "Not assessed" as any, flags: [], whatCouldGoWrong: [], howToReduceRisk: [] });
  }, [selectedSymbol]);

  // Initial portfolio builds
  useEffect(() => {
    optimizerPortfolio();
  }, [portfolioCapital, portfolioRisk, portfolioHorizon]);

  // Toast trigger animation controller
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Fetch all stock-specific datasets from back-end Express server APIS
  const fetchDataForStock = async (symbol: string) => {
    setIsOverviewLoading(true);

    // Fetch key stats (52W High/Low, Avg Volume)
    fetch(`/api/stocks/${symbol}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setStockStats({
            week52High: data.week52High ?? null,
            week52Low:  data.week52Low  ?? null,
            avgVolume:  data.avgVolume  ?? null,
          });
        }
      })
      .catch(() => {
        setStockStats({ week52High: null, week52Low: null, avgVolume: null });
      });

    const safeFetchJson = async (url: string, options?: RequestInit, fallback?: any) => {
      try {
        const headers: HeadersInit = { ...(options?.headers || {}) };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }
        const res = await fetch(url, { ...options, headers });
        if (!res.ok) {
          console.warn(`[SafeFetch] Received status ${res.status} for ${url}. Triggering fallback.`);
          return fallback;
        }
        const text = await res.text();
        if (text.includes("Rate exceeded") || text.includes("Too Many Requests") || text.includes("Quota exceeded")) {
          console.warn(`[SafeFetch] Rate exceeded or non-JSON returned for ${url}. Engaging fallback.`);
          return fallback;
        }
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.aiStatus) {
            setAiStatus(parsed.aiStatus);
          }
          return parsed;
        } catch (jsonErr) {
          console.warn(`[SafeFetch] Parsing failed for ${url}:`, jsonErr, `Raw response text:`, text.slice(0, 50));
          return fallback;
        }
      } catch (err) {
        console.warn(`[SafeFetch] Fetch failed for ${url}:`, err);
        return fallback;
      }
    };

    try {
      // Price history and computed analytics only; AI analyses are requested on demand (see runAi)
      const [chartData, aData] = await Promise.all([
        safeFetchJson(`/api/stocks/${symbol}/chart?days=${chartDays}`, {}, { data: [], source: "NoHistoricalData" }),
        safeFetchJson(`/api/analytics/${symbol}?days=${chartDays}&benchmark=DSEX`, {}, null)
      ]);

      let parsedChart: HistoricalDataPoint[] = [];
      let parsedSource = "NoHistoricalData";
      if (chartData) {
        if (Array.isArray(chartData) && chartData.length > 0) {
          parsedChart = chartData;
          parsedSource = "Historical";
        } else if (chartData.data && Array.isArray(chartData.data) && chartData.data.length > 0 && chartData.source !== "NO_DATA") {
          parsedChart = chartData.data;
          parsedSource = chartData.source || "Historical";
        } else {
          parsedChart = [];
          parsedSource = "NoHistoricalData";
        }
      }

      setAnalyticsData(aData);

      // Merge price envelope data into chart row data if available
      if (aData && aData.envelopeData) {
        const envMap = new Map();
        aData.envelopeData.forEach((pt: any) => {
          envMap.set(pt.date, pt);
        });
        parsedChart = parsedChart.map((row: any) => {
          const env = envMap.get(row.date);
          if (env) {
            return {
              ...row,
              upperEnvelope: env.upper,
              middleEnvelope: env.middle,
              lowerEnvelope: env.lower,
              envelopeZone: env.zone,
              envelopeSignal: env.signal,
              envelopePosition: env.position
            };
          }
          return row;
        });
      }

      setHistoricalChart(parsedChart);
      setChartSource(parsedSource);

    } catch (err) {
      console.warn("Outer fallback triggered for stock details fetch (this should be extremely rare code path):", err);
      setHistoricalChart([]);
      setChartSource("NoHistoricalData");
      setAnalyticsData(null);
    } finally {
      setIsOverviewLoading(false);
    }
  };

  // Optimize custom portfolio weights using our robust ensemble solver
  const optimizerPortfolio = async (switchToView = false) => {
    setIsPortfolioLoading(true);
    try {
      const stored = localStorage.getItem("dse_portfolio_holdings");
      let currentHoldings = [];
      if (stored) {
        currentHoldings = JSON.parse(stored);
      }
      // No invented sample portfolio: an empty portfolio stays empty

      const res = await fetch("/portfolio/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "123",
          holdings: currentHoldings,
          risk_profile: portfolioRisk || "moderate"
        })
      });

      const data = await res.json();
      localStorage.setItem("dse_optimized_portfolio", JSON.stringify(data));

      if (data && data.optimized_allocation) {
        setPortfolioAllocations(data.optimized_allocation || []);
        setPortfolioExpectedReturn(data.expected_return || 12.5);
        setPortfolioVolatility(data.risk_score || 45);
        setPortfolioDivScore(80);
        setPortfolioRiskScore(data.risk_score || 45);
      }

      if (switchToView) {
        setPortfolioDefaultTab("optimizer-view");
        handleNavigate("portfolio");
        setToastNotification({
          message: "Portfolio optimized successfully. Intercepting views alignment.",
          type: "success"
        });
      }
    } catch (err) {
      console.error("Failed optimizing portfolio weights:", err);
      if (switchToView) {
        setPortfolioDefaultTab("optimizer-view");
        handleNavigate("portfolio");
      }
    } finally {
      setIsPortfolioLoading(false);
    }
  };

  useEffect(() => {
    const handleReoptimize = () => {
      optimizerPortfolio(false);
    };
    window.addEventListener("trigger-reoptimize", handleReoptimize);
    return () => window.removeEventListener("trigger-reoptimize", handleReoptimize);
  }, [portfolioRisk]);

  // Create customized alerts
  const handleAddAlert = (type: Alert["type"], targetValue: number) => {
    const newAlert: Alert = {
      id: Math.random().toString(),
      symbol: selectedSymbol,
      type,
      targetValue,
      triggered: false,
      createdAt: new Date().toISOString()
    };
    setAlerts([newAlert, ...alerts]);
    setToastNotification({
      message: `Successfully set dynamic ${type} trigger watcher at ${targetValue} BDT for ${selectedSymbol}.`,
      type: "success"
    });
  };

  const handleRemoveAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  // Simulated ticks tool for alert demonstration
  const handleTriggerSim = () => {
    setToastNotification({
      message: `Simulating Dhaka Market tickers update... Fluctuating active valuations.`,
      type: "info"
    });

    // Induce a mock price tick that alters our focused symbol price and checks if any alert is breached!
    setTimeout(() => {
      const priceDirection = 1;
      const changePct = 0.05; // 5% spike/dip
      const deviation = currentStock.price * changePct * priceDirection;
      const finalSimPrice = parseFloat((currentStock.price + deviation).toFixed(2));

      // Trigger matching alerts
      let triggeredAny = false;
      const updatedAlerts = alerts.map(alt => {
        if (alt.symbol === currentStock.symbol && !alt.triggered) {
          if (alt.type === "Price Above" && finalSimPrice >= alt.targetValue) {
            triggeredAny = true;
            return { ...alt, triggered: true };
          }
          if (alt.type === "Price Below" && finalSimPrice <= alt.targetValue) {
            triggeredAny = true;
            return { ...alt, triggered: true };
          }
        }
        return alt;
      });

      setAlerts(updatedAlerts);

      // Mutate current focused stock with high-density visual updates
      setCurrentStock({
        ...currentStock,
        price: finalSimPrice,
        change: parseFloat((currentStock.change + deviation).toFixed(2)),
        changePercent: parseFloat((currentStock.changePercent + (priceDirection * 5)).toFixed(2))
      });

      if (triggeredAny) {
        setToastNotification({
          message: `🚨 WATCH ALERT TRIGGERED for ${currentStock.symbol}! Price breached marked threshold at BDT ${finalSimPrice}!`,
          type: "warning"
        });
      } else {
        setToastNotification({
          message: `Dhaka Tick simulated: ${currentStock.symbol} traded at BDT ${finalSimPrice}. Watchers still active.`,
          type: "success"
        });
      }
    }, 1200);
  };

  // Conversational bot query pipeline
  const handleSendMessage = async (query: string) => {
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          message: query,
          chatHistory: chatHistory.slice(-5), // Send last 5 queries for context flow
          currentSymbol: selectedSymbol
        })
      });

      const data = await res.json();
      if (data && data.aiStatus) {
        setAiStatus(data.aiStatus);
      }
      
      const botMsgText = res.ok && data.response 
        ? data.response 
        : (data.error || "A connection issue occurred while calling the assistant. Please try again.");

      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: "assistant",
        text: botMsgText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatHistory(prev => [...prev, botMsg]);
    } catch (err) {
      console.error("Failed communicating with Chat core:", err);
      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: "assistant",
        text: "Sorry, I'm having trouble connecting to the network right now. Please check your connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, botMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // Filtered stocks list for search engine
  const [searchResultsList, setSearchResultsList] = useState<StockData[]>([]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSearchResults(value.trim().length > 0);
  };

  const handleSelectSearched = (symbol: string) => {
    const cleanSym = symbol.toUpperCase().trim();
    setSelectedSymbol(cleanSym);
    setSelectedView("stock");
    syncBrowserUrl(cleanSym, "stock");
    setSearchQuery("");
    setShowSearchResults(false);
    setTickerQuery("");
    setShowTickerResults(false);
  };

  const handleNavigate = (view: string | null) => {
    const targetView = view || "explore";
    setSelectedView(targetView);
    if (targetView !== "explore" && targetView !== "stock") {
      setSelectedSymbol(null);
      syncBrowserUrl(null, targetView);
    } else if (targetView === "explore") {
      setSelectedSymbol(null);
      syncBrowserUrl(null, "explore");
    }
  };

  const handleBackToOverview = () => {
    setSelectedSymbol(null);
    setSelectedView("explore");
    syncBrowserUrl(null, "explore");
  };

  // Debounced effect to query backend stock list
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResultsList([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const matchedResult = await res.json();
          setSearchResultsList(matchedResult);
        }
      } catch (err) {
        console.warn("Backend search failed, using local stock list fallback:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const filteredSearchList = searchResultsList.length > 0 ? searchResultsList : stocksList.filter(s =>
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F0F4FF] font-sans selection:bg-[#00D4FF]/20 selection:text-[#00D4FF] flex flex-col justify-between relative overflow-x-hidden">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OfflineBanner />
      <Toaster />
      {/* Ambient glassmorphic glowing deep space orbits */}
      <div className="fixed top-[-10%] left-[10%] w-[45%] h-[45%] rounded-full bg-[#00D4FF]/4 blur-[140px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] right-[10%] w-[45%] h-[45%] rounded-full bg-[#10B981]/4 blur-[140px] pointer-events-none -z-10"></div>
      
      {/* Mobile / Tablet Side Navigation Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-hidden lg:hidden"
          id="mobile-nav-drawer-portal"
        >
          {/* Backdrop overlay with dynamic blur and fade-in */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out animate-fade-in"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          
          {/* Drawer Panel slide-in */}
          <div 
            className="absolute inset-y-0 left-0 max-w-xs w-full bg-[#0A0F1E] border-r border-[rgba(255,255,255,0.1)] shadow-2xl flex flex-col justify-between overflow-y-auto transform transition-transform duration-300 ease-out animate-slide-right py-6 px-4"
            style={{ animationDuration: "250ms" }}
          >
            <div className="space-y-6">
              {/* Header / Brand */}
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] pb-4">
                <div 
                  onClick={() => {
                    handleNavigate(null);
                    setIsMobileDrawerOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <span className="font-display font-[800] text-lg text-white tracking-tighter uppercase">
                    DSE Analyst<span className="text-[#00D4FF] ml-0.5 text-2xl font-black">.</span>
                  </span>
                  <span className="text-[9px] font-mono border border-[rgba(255,255,255,0.08)] bg-[#1A2235] px-1.5 py-0.5 rounded text-[#94A3B8]">
                    beta
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  aria-label="Close menu"
                  className="p-2.5 rounded-lg bg-[#1A2235]/60 hover:bg-[#1A2235] transition-colors text-[#94A3B8] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Main navigation: same sections as the desktop header */}
              <nav aria-label="Main" className="space-y-1">
                {[
                  { id: "explore", label: "Markets", icon: Home },
                  { id: "learn", label: "Learn", icon: BookOpen },
                  { id: "ask", label: "Ask AI", icon: Sparkles },
                  { id: "think", label: "Quizzes", icon: Target },
                  { id: "practice", label: "Practice portfolio", icon: Briefcase },
                  { id: "progress", label: "My progress", icon: Activity },
                  { id: "intelligence", label: "Market intelligence", icon: PieChart },
                  { id: "about", label: "How it works & data sources", icon: Globe },
                ].map(item => {
                  const isActive = selectedSymbol === null && (selectedView === item.id || (item.id === "explore" && (selectedView === null || selectedView === "explore")));
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => { handleNavigate(item.id); setIsMobileDrawerOpen(false); }}
                      className={`w-full min-h-[48px] px-4 rounded-xl text-base flex items-center gap-3 transition-colors border ${
                        isActive ? "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/25 font-semibold" : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5 border-transparent"
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Stock Research Sub-Tabs Section (Visible if a stock is selected) */}
              {selectedSymbol !== null && (
                <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.06)] animate-fade-in">
                  <div className="px-2 flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-[#00D4FF]/70 font-black uppercase tracking-wider">Active Analysis Room</span>
                    <span className="text-[11px] font-mono font-bold text-white uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Ticker: {selectedSymbol}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 mt-2">
                    {[
                      { id: "dashboard",  label: "Quote & Overview",      icon: LayoutDashboard, color: "text-[#00D4FF] bg-[#00D4FF]/5"    },
                      { id: "analyzer",   label: "Valuation Analysis",    icon: BookOpen,        color: "text-violet-400 bg-violet-500/5"  },
                      { id: "technical",  label: "Technical Analysis",    icon: Activity,        color: "text-emerald-400 bg-emerald-500/5"},
                      { id: "prediction", label: "Price Forecast",        icon: Target,          color: "text-fuchsia-400 bg-fuchsia-500/5"},
                      { id: "risk",       label: "Risk & Alerts",         icon: ShieldAlert,     color: "text-rose-400 bg-rose-500/5"      },
                      { id: "portfolio",  label: "Portfolio Optimizer",   icon: PieChart,        color: "text-indigo-400 bg-indigo-500/5"  },
                      ...(isAdmin ? [{ id: "admin", label: "Data Console", icon: Database, color: "text-teal-400 bg-teal-500/5" }] : [])
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            if (tab.id === "portfolio") {
                              optimizerPortfolio(true);
                            } else {
                              setActiveTab(tab.id as any);
                            }
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all duration-200 cursor-pointer border relative text-left group ${
                            isActive
                              ? `bg-[#1A2235] ${tab.color.split(" ")[0]} border-[#00D4FF]/30 font-extrabold shadow-[0_0_15px_rgba(0,212,255,0.1)]`
                              : "text-[#94A3B8] hover:text-[#F0F4FF] hover:bg-[#1A2235]/40 border-transparent"
                          }`}
                        >
                          <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 duration-200 ${isActive ? tab.color.split(" ")[0] : "text-[#4B5563]"}`} />
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostics and sync options in responsive drawer footer */}
            <div className="pt-4 border-t border-[rgba(255,255,255,0.06)] space-y-3">
              <div className="flex items-center justify-between px-2 font-mono text-[9px] text-slate-500">
                <span>DSE LATENCY</span>
                <span className="text-[#10B981] font-bold">18ms (STABLE)</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 1. Header - 64px Premium Top Navigation Bar */}
      <DashboardHeader
        currentUser={currentUser}
        onLogout={handleLogout}
        onTriggerAuthModal={(mode) => setAuthModalOpen(mode)}
        onTriggerBillingModal={() => isAdmin && setIsBillingModalOpen(true)}
        onSyncSuccess={fetchStocksList}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        showSearchResults={showSearchResults}
        setShowSearchResults={setShowSearchResults}
        filteredSearchList={filteredSearchList}
        onSelectSearched={handleSelectSearched}
        selectedView={selectedView}
        onNavigate={handleNavigate}
        onToggleMobileMenu={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
        isAdmin={isAdmin}
        stocks={stocksList}
      />

      {/* 2. Toast alerts system notification overlay */}
      {toastNotification && (
        <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-4 sm:w-auto z-50 transition-all duration-300 ease-out">
          <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111827]/95 shadow-[0_0_30px_rgba(0,212,255,0.15)] flex items-center gap-3 backdrop-blur-md text-[#F0F4FF] min-w-0 sm:min-w-[320px] w-full sm:w-auto">
            <Bell className="h-5 w-5 text-[#00D4FF] animate-pulse" />
            <div className="text-xs">
              <strong className="block font-display font-extrabold text-[#00D4FF] uppercase tracking-wider text-[10px]">System Broadcast</strong>
              <span className="font-medium text-[#94A3B8] mt-1 block leading-relaxed">{toastNotification.message}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main workspace body */}
      <main 
        id="main-content"
        tabIndex={-1}
        className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-5 lg:py-6 w-full flex-1 space-y-4 sm:space-y-5 lg:space-y-6 pb-20 lg:pb-6"
        style={{ paddingBottom: selectedSymbol && typeof window !== 'undefined' && window.innerWidth < 1024
                   ? "72px" : undefined }}
      >
        {/* Page title for screens whose own layout has no <h1> (screen readers, document outline) */}
        {selectedSymbol === null && ({ ask: "Ask AI about DSE stocks", think: "Quizzes", practice: "Practice portfolio", portfolio: "Practice portfolio", progress: "My progress", intelligence: "Market intelligence" } as Record<string, string>)[selectedView] && (
          <h1 className="sr-only">{({ ask: "Ask AI about DSE stocks", think: "Quizzes", practice: "Practice portfolio", portfolio: "Practice portfolio", progress: "My progress", intelligence: "Market intelligence" } as Record<string, string>)[selectedView]}</h1>
        )}
        {/* Prominent Global Educational Disclaimer */}
        <GlobalDisclaimer />
        
        {selectedSymbol !== null ? (
          <>
            {/* Breadcrumb: always-visible way back */}
            <nav aria-label="Breadcrumb" className="px-1">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <li><a href="/" onClick={(e) => { e.preventDefault(); handleBackToOverview(); }} className="inline-flex items-center min-h-[44px] px-1 text-[var(--accent)] hover:underline">← Markets</a></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-[var(--text)] font-semibold">{selectedSymbol}</li>
              </ol>
            </nav>

            {/* Active Stock Overview & Quick Sectors Row */}
            <div className="sticky top-0 z-30 bg-[#111827]/90 backdrop-blur-md rounded-3xl border border-[rgba(255,255,255,0.08)] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Cyan Glow Background element */}
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-[#00D4FF]/4 rounded-full blur-3xl -z-10"></div>
          
          {/* Left: Active company indicators */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-3xl font-display font-[800] tracking-tight text-white uppercase">{currentStock.symbol}</span>
                <span className="text-base font-medium text-[var(--text-muted)]">{currentStock.name}</span>
              </h1>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${(currentStock as any).hasRealFundamentals ? "border-emerald-400/40 text-emerald-200" : "border-amber-400/40 text-amber-200"}`}>
                {(currentStock as any).hasRealFundamentals ? "Fundamentals reported" : "Fundamentals not reported"}
              </span>
              <span className="h-4 w-[1px] bg-[rgba(255,255,255,0.1)] hidden sm:inline"></span>
              
              <a
                href={`https://www.dse.com.bd/company/${currentStock.symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-white border border-[rgba(255,255,255,0.06)] font-bold tracking-wider flex items-center gap-1 transition-all"
                title={`Open official ${currentStock.symbol} company profile on https://www.dse.com.bd/company/${currentStock.symbol}`}
              >
                <Globe className="h-3 w-3 text-[#10B981]" />
                DSE COMPANY PROFILE ↗
              </a>
              
              <button
                id="btn-watchlist-star"
                onClick={() => handleToggleWatchlist(currentStock.symbol)}
                className={`p-1.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                  isOnAnyWatchlist(currentStock.symbol)
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "bg-white/5 border-[rgba(255,255,255,0.06)] text-[#94A3B8] hover:text-white"
                }`}
                title={isOnAnyWatchlist(currentStock.symbol) ? "Remove from watchlist" : "Add to watchlist"}
                aria-label={isOnAnyWatchlist(currentStock.symbol) ? `Remove ${currentStock.symbol} from watchlist` : `Add ${currentStock.symbol} to watchlist`}
                aria-pressed={!!isOnAnyWatchlist(currentStock.symbol)}
              >
                <Star className={`h-3.5 w-3.5 ${isOnAnyWatchlist(currentStock.symbol) ? "fill-amber-400 text-amber-400" : ""}`} />
              </button>
            </div>
            
            <div className="flex flex-wrap items-baseline gap-4">
              <div className="text-3xl font-mono font-bold text-[#F0F4FF] tracking-tight">
                BDT {currentStock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className={`font-mono text-xs font-semibold flex items-center gap-1 ${
                currentStock.changePercent > 0 ? "text-[#10B981]" : currentStock.changePercent < 0 ? "text-[#EF4444]" : "text-slate-400"
              }`}>
                {currentStock.changePercent > 0 ? "▲ +" : currentStock.changePercent < 0 ? "▼ " : ""}
                {currentStock.changePercent.toFixed(2)}% ({currentStock.change.toFixed(2)} BDT)
              </div>
              
              <span className="h-3.5 w-[1px] bg-[rgba(255,255,255,0.1)]"></span>
              
              <div className="text-xs text-[var(--text-muted)]">
                Volume <span className="font-semibold text-white">{(currentStock.volume / 1000).toFixed(1)}K</span> · Trades <span className="font-semibold text-white">{currentStock.trades}</span> · <Term term="Market Cap">Market cap</Term> <span className="font-semibold text-white">{formatMarketCap(currentStock.marketCap) ?? "Not reported"}</span>
              </div>
            </div>
            {/* Plain-language answer first */}
            <p className="text-sm text-[var(--text-muted)] max-w-2xl">
              {currentStock.price > 0
                ? <>{currentStock.symbol} last traded at <strong className="text-white">৳{currentStock.price.toFixed(2)}</strong>{currentStock.prevClose ? <>, {currentStock.change > 0 ? "up" : currentStock.change < 0 ? "down" : "unchanged"}{currentStock.change !== 0 ? ` ${Math.abs(currentStock.changePercent).toFixed(2)}%` : ""} from the previous close of ৳{Number(currentStock.prevClose).toFixed(2)}</> : null}.{currentStock.peRatio != null && currentStock.peRatio > 0 ? <> Investors pay about {currentStock.peRatio.toFixed(1)} taka for each taka of yearly earnings (<Term term="P/E">P/E</Term>).</> : null}</>
                : "No recent price is available for this security."}
            </p>
            <FreshnessLine label="Fetched" updatedAt={(currentStock as any).lastUpdated} source={(currentStock as any).source || (currentStock as any).dataSource} />
          </div>

          {/* Right: switch to another stock */}
          <div className="w-full md:w-80" id="sticky-header-quick-switcher">
            <StockSearch stocks={stocksList} onSelect={handleSelectSearched} placeholder="Switch to another stock…" label="Switch to another stock" />
          </div>

        </div>

        {/* 2-Column layout: Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6 items-start" id="main-workspace-grid">
          
                    {!isChartFullscreen && (
            <>
              <aside className="hidden lg:block lg:sticky lg:top-6 lg:col-span-3 space-y-4 z-20 max-h-[calc(100vh-48px)] overflow-y-auto pr-1 pb-4 scrollbar-none self-start" id="workspace-sidebar">
              <div className="bg-[#111827]/75 backdrop-blur-xl border border-white/[0.07] rounded-3xl p-4 shadow-2xl" id="sidebar-navigation-container">
                <div className="px-3 mb-3 pb-2 border-b border-white/[0.07] hidden lg:block">
                  <span className="text-[10px] font-mono text-[#94A3B8]/60 font-bold uppercase tracking-wider">Equity Research Suite</span>
                </div>
                
                <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible whitespace-nowrap lg:whitespace-normal scrollbar-none pb-2 lg:pb-0" id="sidebar-navigation-elements">
                  {[
                    { id: "dashboard",  label: "Quote & Overview",      icon: LayoutDashboard, color: "text-[#00D4FF] bg-[#00D4FF]/5"    },
                    { id: "analyzer",   label: "Valuation Analysis",    icon: BookOpen,        color: "text-violet-400 bg-violet-500/5"  },
                    { id: "technical",  label: "Technical Indicators",  icon: Activity,        color: "text-emerald-400 bg-emerald-500/5"},
                    { id: "prediction", label: "Indicator Envelopes",   icon: Target,          color: "text-fuchsia-400 bg-fuchsia-500/5"},
                    { id: "risk",       label: "Risk & Alerts",         icon: ShieldAlert,     color: "text-rose-400 bg-rose-500/5"      },
                    { id: "portfolio",  label: "Portfolio Optimizer",   icon: PieChart,        color: "text-indigo-400 bg-indigo-500/5"  },
                    ...(isAdmin ? [{ id: "admin", label: "Data Console", icon: Database, color: "text-teal-400 bg-teal-500/5" }] : [])
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (tab.id === "portfolio") {
                            optimizerPortfolio(true);
                          } else {
                            setActiveTab(tab.id as any);
                          }
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all duration-200 cursor-pointer border relative w-full group ${
                          isActive
                            ? `bg-[#1A2235] ${tab.color.split(" ")[0]} border-[#00D4FF]/30 font-extrabold shadow-[0_0_15px_rgba(0,212,255,0.1)]`
                            : "text-[#94A3B8] hover:text-[#F0F4FF] hover:bg-[#1A2235]/40 border-transparent"
                        }`}
                      >
                        {/* Glow left-border effect */}
                        {isActive && (
                          <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-[#00D4FF] rounded-r glow-accent" />
                        )}
                        <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 duration-200 ${isActive ? tab.color.split(" ")[0] : "text-[#4B5563] group-hover:text-[#94A3B8]"}`} />
                        <span className="truncate">{tab.label}</span>
                        {isActive && (
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#00D4FF]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
 


              {/* Risk Contribution Analysis Donut Chart with dynamic hover tooltips */}
              <RiskContributionSidebarWidget />
            </aside>
          </>
        )}

          {/* Right Main Content area */}
          <div className={`${isChartFullscreen ? "lg:col-span-12" : "col-span-1 lg:col-span-9"} space-y-4 sm:space-y-5 lg:space-y-6 animate-tab-in w-full`} id="workspace-content-pane">

        {/* 4. Tab contents renders */}
        <div key={activeTab} className="animate-tab-in">
          
          {/* OVERVIEW DASHBOARD TERMINAL */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">

              {/* Top Row: Chart & Financial gauge */}
              <div className={isChartFullscreen ? "grid grid-cols-1 gap-6 w-full" : "grid grid-cols-1 lg:grid-cols-12 gap-6"}>
                
                {/* Key Stats Bar */}
                {!isChartFullscreen && (
                  <div className="lg:col-span-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" id="key-stats-strip">
                    {[
                      { label: "Market Cap",   value: formatMarketCap(currentStock.marketCap) ?? "N/A",           mono: false },
                      { label: "P/E Ratio",    value: currentStock.peRatio != null ? currentStock.peRatio.toFixed(2) : "N/A",         mono: true  },
                      { label: "EPS (BDT)",    value: currentStock.eps != null ? currentStock.eps.toFixed(2) : "N/A",             mono: true  },
                      { 
                        label: "52W High", 
                        value: stockStats.week52High != null ? `৳${stockStats.week52High.toFixed(2)}` : "—",  
                        mono: true,
                        isLoadingStats: true
                      },
                      { 
                        label: "52W Low",      
                        value: stockStats.week52Low != null ? `৳${stockStats.week52Low.toFixed(2)}` : "—",   
                        mono: true,
                        isLoadingStats: true
                      },
                      { 
                        label: "Avg Volume",   
                        value: stockStats.avgVolume != null 
                          ? stockStats.avgVolume >= 1_000_000 
                            ? `${(stockStats.avgVolume / 1_000_000).toFixed(1)}M`
                            : `${(stockStats.avgVolume / 1_000).toFixed(0)}K`
                          : "—", 
                        mono: true,
                        isLoadingStats: true
                      },
                    ].map(stat => {
                      const showShimmer = stat.isLoadingStats && 
                        stockStats.week52High === null && 
                        stockStats.week52Low === null && 
                        stockStats.avgVolume === null && 
                        selectedSymbol && 
                        isOverviewLoading;

                      return (
                        <div key={stat.label} className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 flex flex-col gap-1">
                          <span className="text-xs text-[var(--text-muted)]"><Term term={stat.label} /></span>
                          {showShimmer ? (
                            <div className="h-4 w-12 bg-[#243044] rounded animate-pulse mt-1" />
                          ) : (
                            <span className={`text-sm font-black text-[#F0F4FF] ${stat.mono ? "font-mono" : "font-display"}`}>{stat.value}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Historical Area Chart */}
                <div id="chart-area-container" className={`${isChartFullscreen ? "lg:col-span-12" : "lg:col-span-8"} bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.4)]`}>
                  <div>
                    <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                      <div>
                        <h2 className="font-display text-sm font-extrabold text-[#F0F4FF] uppercase tracking-widest">
                          Price Chart — {currentStock.symbol}
                        </h2>
                        <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                          Daily closing prices · {chartSourceInfo.label}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-[#1A2235] px-2.5 py-1 rounded-xl border border-[rgba(255,255,255,0.08)]">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${chartSourceInfo.verified ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden="true"></span>
                          <span className="text-xs text-[var(--text-muted)] font-semibold">
                            {chartSourceInfo.verified ? "Verified source" : hasData ? "Unverified source" : "No data"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 bg-[#1A2235] px-2.5 py-1 rounded-xl border border-[rgba(255,255,255,0.08)]">
                          <span className={`inline-block w-2 h-2 rounded-full ${chartStyle === "area" ? "bg-[#00D4FF]" : "bg-[#10B981]"}`}></span>
                          <span className="text-[10px] font-mono text-[#94A3B8] font-bold uppercase">{currentStock.symbol} BDT</span>
                        </div>
                        
                        {/* SMA Trendline Toggle Button */}
                        <button
                          id="btn-toggle-sma"
                          disabled={!hasData}
                          onClick={() => setShowSMA(!showSMA)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-mono font-black tracking-wider border transition-all ${
                            !hasData
                              ? "opacity-40 cursor-not-allowed bg-[#1A2235]/40 text-[#64748B] border-[rgba(255,255,255,0.04)]"
                              : showSMA
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20 cursor-pointer select-none"
                              : "bg-[#1A2235] text-[#94A3B8] border-[rgba(255,255,255,0.08)] hover:bg-[#243044] hover:text-[#F0F4FF] cursor-pointer select-none"
                          }`}
                          title="Toggle 20-day Simple Moving Average overlay"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${showSMA && hasData ? "bg-amber-500 animate-pulse" : "bg-[#64748B]"}`}></span>
                          <span>SMA (20D): {showSMA && hasData ? "ON" : "OFF"}</span>
                        </button>

                        {/* Envelopes Corridor Toggle Button */}
                        <button
                          id="btn-toggle-envelope"
                          disabled={!hasData}
                          onClick={() => setShowEnvelope(!showEnvelope)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-mono font-black tracking-wider border transition-all ${
                            !hasData
                              ? "opacity-40 cursor-not-allowed bg-[#1A2235]/40 text-[#64748B] border-[rgba(255,255,255,0.04)]"
                              : showEnvelope
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/25 hover:bg-indigo-500/20 cursor-pointer select-none font-bold"
                              : "bg-[#1A2235] text-[#94A3B8] border-[rgba(255,255,255,0.08)] hover:bg-[#243044] hover:text-[#F0F4FF] cursor-pointer select-none"
                          }`}
                          title="Toggle 20-day Envelope Bands (Upper/Middle/Lower Corridor) overlays"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${showEnvelope && hasData ? "bg-indigo-500 animate-pulse" : "bg-[#64748B]"}`}></span>
                          <span>ENVELOPES: {showEnvelope && hasData ? "ON" : "OFF"}</span>
                        </button>

                        {/* Support & Resistance Lines Toggle Button */}
                        <button
                          id="btn-toggle-sr"
                          disabled={!hasData || (!technicalSignals.support?.length && !technicalSignals.resistance?.length)}
                          onClick={() => setShowSRLines(!showSRLines)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-mono font-black tracking-wider border transition-all ${
                            !hasData || (!technicalSignals.support?.length && !technicalSignals.resistance?.length)
                              ? "opacity-40 cursor-not-allowed bg-[#1A2235]/40 text-[#64748B] border-[rgba(255,255,255,0.04)]"
                              : showSRLines
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-505/25 hover:bg-indigo-500/20 cursor-pointer select-none font-bold"
                              : "bg-[#1A2235] text-[#94A3B8] border-[rgba(255,255,255,0.08)] hover:bg-[#243044] hover:text-[#F0F4FF] cursor-pointer select-none"
                          }`}
                          title="Toggle dynamic Support & Resistance reference levels"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${showSRLines && hasData ? "bg-indigo-500 animate-pulse" : "bg-[#64748B]"}`}></span>
                          <span>LEVELS (S/R): {showSRLines && hasData ? "ON" : "OFF"}</span>
                        </button>

                        {/* DSEX Compare Toggle Button */}
                        <button
                          id="btn-toggle-dsex-overlay"
                          onClick={() => setShowDsexOverlay(!showDsexOverlay)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-mono font-black tracking-wider border transition-all ${
                            showDsexOverlay
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20 cursor-pointer select-none font-bold"
                              : "bg-[#1A2235] text-[#94A3B8] border-[rgba(255,255,255,0.08)] hover:bg-[#243044] hover:text-[#F0F4FF] cursor-pointer select-none"
                          }`}
                          title="Compare selected stock directly against DSEX index performance over the same 24-month timeline"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${showDsexOverlay ? "bg-amber-500 animate-pulse" : "bg-[#64748B]"}`}></span>
                          <span>DSEX COMPARE (24M): {showDsexOverlay ? "ON" : "OFF"}</span>
                        </button>

                          {/* Time Range Selector */}
                        <div className="flex bg-[#131B2E] p-0.5 rounded-xl border border-[rgba(255,255,255,0.06)] gap-0.5 shadow-inner" id="chart-range-segmented">
                          {[
                            { label: "1M", value: 30 },
                            { label: "3M", value: 90 },
                            { label: "6M", value: 180 },
                            { label: "1Y", value: 365 },
                            { label: "2Y", value: 730 },
                            { label: "All", value: 3650 }
                          ].map((range) => (
                            <button
                              key={range.label}
                              disabled={!hasData}
                              onClick={() => setChartDays(range.value)}
                              className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold tracking-wider transition-all whitespace-nowrap ${
                                !hasData
                                  ? "opacity-50 cursor-not-allowed text-[#64748B]"
                                  : chartDays === range.value
                                  ? "bg-[#00D4FF] text-[#0A0F1E] font-black shadow-sm cursor-pointer"
                                  : "text-[#94A3B8] hover:text-[#F0F4FF] hover:bg-[#1A2235] border border-transparent cursor-pointer"
                              }`}
                            >
                              {range.label}
                            </button>
                          ))}
                        </div>

                        {/* Segmented Control Toggle */}
                        <div className="flex bg-[#131B2E] p-0.5 rounded-xl border border-[rgba(255,255,255,0.06)] gap-0.5 shadow-inner" id="chart-style-segmented">
                          <button
                            id="btn-chart-style-area"
                            disabled={!hasData}
                            onClick={() => setChartStyle("area")}
                            className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold tracking-wider transition-all whitespace-nowrap ${
                              !hasData
                                ? "opacity-50 cursor-not-allowed text-[#64748B]"
                                : chartStyle === "area"
                                ? "bg-[#00D4FF] text-[#0A0F1E] font-black shadow-sm border border-[rgba(255,255,255,0.06)] cursor-pointer selection:bg-transparent"
                                : "text-[#94A3B8] hover:text-[#F0F4FF] hover:bg-[#1A2235] border border-transparent cursor-pointer"
                            }`}
                          >
                            AREA
                          </button>
                          <button
                            id="btn-chart-style-candlestick"
                            disabled={!hasOHLC}
                            onClick={() => setChartStyle("candlestick")}
                            className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold tracking-wider transition-all whitespace-nowrap ${
                              !hasOHLC
                                ? "opacity-40 cursor-not-allowed text-[#64748B]"
                                : chartStyle === "candlestick"
                                ? "bg-[#00D4FF] text-[#0A0F1E] font-black shadow-sm border border-[rgba(255,255,255,0.06)] cursor-pointer"
                                : "text-[#94A3B8] hover:text-[#F0F4FF] hover:bg-[#1A2235] border border-transparent cursor-pointer"
                            }`}
                            title={!hasOHLC ? "Candlestick requires full OHLC values" : ""}
                          >
                            CANDLESTICK
                          </button>
                        </div>

                        {/* Fullscreen Toggle Button */}
                        <button
                          id="btn-toggle-fullscreen"
                          onClick={() => setIsChartFullscreen(!isChartFullscreen)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-mono font-black tracking-wider border border-[rgba(255,255,255,0.10)] bg-[#1A2235] text-[#94A3B8] hover:bg-[#243044] hover:text-[#F0F4FF] transition-all cursor-pointer select-none"
                          title={isChartFullscreen ? "Minimize chart" : "Maximize to Fullscreen"}
                        >
                          {isChartFullscreen ? (
                            <>
                              <Minimize2 className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
                              <span className="text-blue-600">MINIMIZE</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 className="h-3.5 w-3.5" />
                              <span>FULLSCREEN</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className={isChartFullscreen ? "h-[500px] md:h-[550px] w-full relative transition-all duration-350" : "h-64 w-full relative"}>
                      {!hasData ? (
                        <div className="flex h-full flex-col items-center justify-center font-sans text-xs text-[#94A3B8] bg-[#111827]/60 rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] p-8 text-center">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                            <AlertOctagon className="h-6 w-6 text-amber-400" />
                          </div>
                          <span className="font-semibold text-[#F0F4FF] text-base mb-1">No historical data available</span>
                          <span className="text-[12px] text-[#94A3B8] max-w-md leading-relaxed">
                            Official price and trading history has not yet been collected or archived for <strong className="text-white">{currentStock.symbol}</strong>. Live quotes and fundamental profiles remain fully operational.
                          </span>
                        </div>
                      ) : (
                        <AnimatePresence mode="wait">
                          {showDsexOverlay ? (
                            isDsexOverlayLoading ? (
                              <div className="flex h-full flex-col items-center justify-center font-mono text-xs text-[#00D4FF] bg-[#111827]/60 rounded-2xl border border-[rgba(255,255,255,0.06)] p-6">
                                <span className="animate-pulse">Loading DSEX 24-Month Comparative Index Performance...</span>
                              </div>
                            ) : comparative24mData.length === 0 ? (
                              <div className="flex h-full flex-col items-center justify-center font-mono text-xs text-slate-400 bg-[#111827]/60 rounded-2xl border border-[rgba(255,255,255,0.06)] p-6 text-center">
                                <span>No overlapping 24-month historical dates found for {currentStock.symbol}.</span>
                              </div>
                            ) : (
                              <motion.div
                                key={`dsex-comparison-${currentStock.symbol}`}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="h-full w-full absolute inset-0"
                              >
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={comparative24mData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} fontFamily="monospace" tickFormatter={formatChartTick} minTickGap={40} />
                                    <YAxis 
                                      stroke="#64748b" 
                                      fontSize={10} 
                                      fontFamily="monospace" 
                                      tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v}%`}
                                    />
                                    <Tooltip content={<ComparativeTooltip currentSymbol={currentStock.symbol} />} />
                                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                                    <Line
                                      type="monotone"
                                      dataKey="stockReturn"
                                      stroke="#00D4FF"
                                      strokeWidth={2}
                                      dot={false}
                                      name={`${currentStock.symbol} Return (%)`}
                                      isAnimationActive={true}
                                      animationDuration={450}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="dsexReturn"
                                      stroke="#f59e0b"
                                      strokeWidth={2}
                                      dot={false}
                                      name="DSEX Index Return (%)"
                                      isAnimationActive={true}
                                      animationDuration={450}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </motion.div>
                            )
                          ) : chartStyle === "candlestick" ? (
                            <motion.div
                              key={`candlestick-${chartDays}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="h-full w-full absolute inset-0"
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                  data={historicalChart.map(item => ({
                                    ...item,
                                    ohlc: [item.open, item.close]
                                  }))}
                                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} fontFamily="monospace" tickFormatter={formatChartTick} minTickGap={40} />
                                  <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" domain={["auto", "auto"]} />
                                  <Tooltip content={<CustomTooltip />} />
                                  
                                  {/* OHLC bound custom Candlestick bars */}
                                  <Bar
                                    dataKey="ohlc"
                                    shape={<CandlestickShape />}
                                    isAnimationActive={true}
                                    animationDuration={400}
                                    animationEasing="ease-out"
                                  >
                                    {historicalChart.map((entry, index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={entry.close >= entry.open ? "#10b981" : "#ef4444"}
                                      />
                                    ))}
                                  </Bar>
                                  
                                  {/* Volatility Trend Momentum: 20-day Simple Moving Average overlay in gold/amber */}
                                  {showSMA && historicalChart[0]?.sma20 !== undefined && (
                                    <Line
                                      type="monotone"
                                      dataKey="sma20"
                                      stroke="#f59e0b"
                                      strokeWidth={1.5}
                                      dot={false}
                                      strokeDasharray="4 4"
                                      name="20-day SMA"
                                      isAnimationActive={true}
                                      animationDuration={400}
                                      animationEasing="ease-out"
                                    />
                                  )}

                                  {/* Dhaka Price Corridor Envelopes Overlays */}
                                  {showEnvelope && historicalChart.some(r => r.upperEnvelope !== undefined) && (
                                    <>
                                      <Line
                                        type="monotone"
                                        dataKey="upperEnvelope"
                                        stroke="#4f46e5"
                                        strokeWidth={1.5}
                                        dot={false}
                                        strokeDasharray="3 3"
                                        name="Upper Envelope Band (5%)"
                                        isAnimationActive={true}
                                        animationDuration={400}
                                        animationEasing="ease-out"
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="middleEnvelope"
                                        stroke="#818cf8"
                                        strokeWidth={1.0}
                                        dot={false}
                                        strokeDasharray="2 2"
                                        name="Middle Corridor SMA"
                                        isAnimationActive={true}
                                        animationDuration={400}
                                        animationEasing="ease-out"
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="lowerEnvelope"
                                        stroke="#4f46e5"
                                        strokeWidth={1.5}
                                        dot={false}
                                        strokeDasharray="3 3"
                                        name="Lower Envelope Band (5%)"
                                        isAnimationActive={true}
                                        animationDuration={400}
                                        animationEasing="ease-out"
                                      />
                                    </>
                                  )}
                                  
                                  {alerts
                                    .filter(a => a.symbol === currentStock.symbol && (a.type === "Price Above" || a.type === "Price Below"))
                                    .map(alert => (
                                      <ReferenceLine
                                        key={alert.id}
                                        y={alert.targetValue}
                                        stroke={alert.triggered ? "rgba(100, 116, 139, 0.4)" : (alert.type === "Price Above" ? "rgba(16, 185, 129, 0.75)" : "rgba(239, 68, 68, 0.75)")}
                                        strokeDasharray={alert.triggered ? "2 2" : "4 4"}
                                        strokeWidth={alert.triggered ? 1 : 1.5}
                                        label={{
                                          value: `${alert.type === "Price Above" ? "▲" : "▼"} BDT ${alert.targetValue} ${alert.triggered ? "(Triggered)" : "(Alert)"}`,
                                          fill: alert.triggered ? "#64748b" : (alert.type === "Price Above" ? "#10b981" : "#ef4444"),
                                          fontSize: 9,
                                          fontFamily: "monospace",
                                          position: "insideBottomRight"
                                        }}
                                      />
                                    ))
                                  }
                                   {/* Technical Indicators: Dynamic Support & Resistance levels */}
                                   {showSRLines && technicalSignals.support?.map((val, idx) => (
                                     <ReferenceLine
                                       key={`support-candlestick-${idx}`}
                                       y={val}
                                       stroke="#10b981"
                                       strokeDasharray="3 3"
                                       strokeWidth={1.5}
                                       label={{
                                         value: `Support S${idx + 1}: BDT ${val.toFixed(1)}`,
                                         fill: "#059669",
                                         fontSize: 9,
                                         fontFamily: "monospace",
                                         position: "insideBottomLeft"
                                       }}
                                     />
                                   ))}
                                   {showSRLines && technicalSignals.resistance?.map((val, idx) => (
                                     <ReferenceLine
                                       key={`resistance-candlestick-${idx}`}
                                       y={val}
                                       stroke="#ef4444"
                                       strokeDasharray="3 3"
                                       strokeWidth={1.5}
                                       label={{
                                         value: `Resistance R${idx + 1}: BDT ${val.toFixed(1)}`,
                                         fill: "#dc2626",
                                         fontSize: 9,
                                         fontFamily: "monospace",
                                         position: "insideTopLeft"
                                       }}
                                     />
                                   ))}
                                </ComposedChart>
                              </ResponsiveContainer>
                            </motion.div>
                          ) : (
                            <motion.div
                              key={`area-${chartDays}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="h-full w-full absolute inset-0"
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historicalChart} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.18}/>
                                      <stop offset="95%" stopColor="#00D4FF" stopOpacity={0.00}/>
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} fontFamily="monospace" tickFormatter={formatChartTick} minTickGap={40} />
                                  <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" domain={["auto", "auto"]} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Area
                                    type="monotone"
                                    dataKey="close"
                                    stroke="#00D4FF"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorPrice)"
                                    name="DSE Price BDT"
                                    isAnimationActive={true}
                                    animationDuration={400}
                                    animationEasing="ease-out"
                                  />
                                  {alerts
                                    .filter(a => a.symbol === currentStock.symbol && (a.type === "Price Above" || a.type === "Price Below"))
                                    .map(alert => (
                                      <ReferenceLine
                                        key={alert.id}
                                        y={alert.targetValue}
                                        stroke={alert.triggered ? "rgba(100, 116, 139, 0.4)" : (alert.type === "Price Above" ? "rgba(16, 185, 129, 0.75)" : "rgba(239, 68, 68, 0.75)")}
                                        strokeDasharray={alert.triggered ? "2 2" : "4 4"}
                                        strokeWidth={alert.triggered ? 1 : 1.5}
                                        label={{
                                          value: `${alert.type === "Price Above" ? "▲" : "▼"} BDT ${alert.targetValue} ${alert.triggered ? "(Triggered)" : "(Alert)"}`,
                                          fill: alert.triggered ? "#64748b" : (alert.type === "Price Above" ? "#10b981" : "#ef4444"),
                                          fontSize: 9,
                                          fontFamily: "monospace",
                                          position: "insideBottomRight"
                                        }}
                                      />
                                    ))
                                  }
                                  
                                  {/* Volatility Trend Momentum: 20-day Simple Moving Average overlay in gold/amber */}
                                  {showSMA && historicalChart[0]?.sma20 !== undefined && (
                                    <Area
                                      type="monotone"
                                      dataKey="sma20"
                                      stroke="#f59e0b"
                                      strokeWidth={1.5}
                                      fill="none"
                                      strokeDasharray="4 4"
                                      name="20-day SMA"
                                      isAnimationActive={true}
                                      animationDuration={400}
                                      animationEasing="ease-out"
                                    />
                                  )}

                                  {/* Dhaka Price Corridor Envelopes Overlays */}
                                  {showEnvelope && historicalChart.some(r => r.upperEnvelope !== undefined) && (
                                    <>
                                      <Area
                                        type="monotone"
                                        dataKey="upperEnvelope"
                                        stroke="#4f46e5"
                                        strokeWidth={1.5}
                                        fill="none"
                                        strokeDasharray="3 3"
                                        name="Upper Envelope Band (5%)"
                                        isAnimationActive={true}
                                        animationDuration={400}
                                        animationEasing="ease-out"
                                      />
                                      <Area
                                        type="monotone"
                                        dataKey="middleEnvelope"
                                        stroke="#818cf8"
                                        strokeWidth={1.0}
                                        fill="none"
                                        strokeDasharray="2 2"
                                        name="Middle Corridor SMA"
                                        isAnimationActive={true}
                                        animationDuration={400}
                                        animationEasing="ease-out"
                                      />
                                      <Area
                                        type="monotone"
                                        dataKey="lowerEnvelope"
                                        stroke="#4f46e5"
                                        strokeWidth={1.5}
                                        fill="none"
                                        strokeDasharray="3 3"
                                        name="Lower Envelope Band (5%)"
                                        isAnimationActive={true}
                                        animationDuration={400}
                                        animationEasing="ease-out"
                                      />
                                    </>
                                  )}
                                   {/* Technical Indicators: Dynamic Support & Resistance levels */}
                                   {showSRLines && technicalSignals.support?.map((val, idx) => (
                                     <ReferenceLine
                                       key={`support-area-${idx}`}
                                       y={val}
                                       stroke="#10b981"
                                       strokeDasharray="3 3"
                                       strokeWidth={1.5}
                                       label={{
                                         value: `Support S${idx + 1}: BDT ${val.toFixed(1)}`,
                                         fill: "#059669",
                                         fontSize: 9,
                                         fontFamily: "monospace",
                                         position: "insideBottomLeft"
                                       }}
                                     />
                                   ))}
                                   {showSRLines && technicalSignals.resistance?.map((val, idx) => (
                                     <ReferenceLine
                                       key={`resistance-area-${idx}`}
                                       y={val}
                                       stroke="#ef4444"
                                       strokeDasharray="3 3"
                                       strokeWidth={1.5}
                                       label={{
                                         value: `Resistance R${idx + 1}: BDT ${val.toFixed(1)}`,
                                         fill: "#dc2626",
                                         fontSize: 9,
                                         fontFamily: "monospace",
                                         position: "insideTopLeft"
                                       }}
                                     />
                                   ))}
                                </AreaChart>
                              </ResponsiveContainer>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between text-[11px] text-[#94A3B8]">
                    <span className="font-sans leading-relaxed flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-amber-500 animate-spin-slow" />
                      Calculated Price range: <strong className="text-[#F0F4FF]">Min BDT {hasData ? Math.min(...(historicalChart.map(h => h.close) || [0])).toFixed(1) : "N/A"}</strong> to <strong className="text-[#F0F4FF]">Max BDT {hasData ? Math.max(...(historicalChart.map(h => h.close) || [0])).toFixed(1) : "N/A"}</strong>.
                    </span>
                    
                    <span className="text-xs text-[var(--text-muted)]">
                      Source: {chartSourceInfo.label}{hasData && historicalChart.length ? ` · ${historicalChart[0].date} – ${historicalChart[historicalChart.length - 1].date}` : ""}
                    </span>
                  </div>
                </div>

                {/* Micro AI recommendations panel */}
                {!isChartFullscreen && (
                  <div id="ai-quick-recommendation" className="lg:col-span-4 bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
                  <div className="space-y-4">
                    <AiRunBar
                      compact
                      title="AI summary"
                      description={`A short, plain-language read of ${selectedSymbol}'s valuation and fundamentals.`}
                      dataUsed={["Last traded price", "EPS", "NAV per share", "P/E", "Dividend yield", "Sector", "Revenue and profit growth (when reported)"]}
                      state={aiRuns.fundamental}
                      onRun={() => runAi("fundamental")}
                    />
                    {aiRuns.fundamental.status === "done" && (
                      <div className="space-y-3">
                        {fundamentalAnalysis.recommendation && (
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
                            <p className="text-xs text-[var(--text-subtle)]">AI interpretation · not investment advice</p>
                            <p className="text-lg font-semibold text-[var(--text)] mt-1">{String(fundamentalAnalysis.recommendation)}</p>
                          </div>
                        )}
                        {fundamentalAnalysis.reasoning?.length > 0 && (
                          <ul className="space-y-1.5 list-disc pl-5 text-sm text-[var(--text-muted)] leading-relaxed">
                            {fundamentalAnalysis.reasoning.map((item, idx) => <li key={idx}>{item}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] flex justify-end">
                    <button
                      onClick={() => setActiveTab("analyzer")}
                      className="text-[11px] font-bold text-[#00D4FF] hover:text-[#33DDFF] flex items-center select-none cursor-pointer"
                    >
                      Open full valuation <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                )}

              </div>

              {!isChartFullscreen && (
                <>
              <Section title="Market context" hint="How the broad DSE indices moved alongside this stock.">
                  {/* Macro Market Index Dashboard */}
                  <MacroMarketContext
                    selectedSymbol={selectedSymbol}
                    selectedStockName={currentStock.name}
                    stockChartData={historicalChart}
                  />
              </Section>

              <Section title="Sector comparison & research assistant" hint="Compare with peers and ask questions about this company.">
                  {/* Google Finance Beta-style side-by-side research layout */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch my-6">
                    <div className="flex flex-col h-full">
                      <SectorIntelligenceHub
                        currentStock={currentStock}
                        stocksList={stocksList}
                        onSelectStock={handleSelectSearched}
                      />
                    </div>
                    <div className="flex flex-col h-full">
                      <AIStockResearchAssistant
                        currentStock={currentStock}
                        stocksList={stocksList}
                        onSelectStock={handleSelectSearched}
                      />
                    </div>
                  </div>
              </Section>

              <Section title="Step-by-step analysis framework" hint="A guided three-stage way to think about this stock.">
              {/* ── 3-Stage Analysis Framework ─────────────────────── */}
              <div id="investment-analysis-framework" className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00D4FF]/30 to-transparent"></div>

                <div className="flex items-center gap-2 mb-4">
                  <Layers className="h-4 w-4 text-[#00D4FF]" />
                  <h3 className="font-display text-xs font-extrabold text-[#F0F4FF] uppercase tracking-wider">
                    Investment Analysis Framework — {selectedSymbol}
                  </h3>
                  <span className="ml-auto text-[10px] font-mono text-[#4B5563]">
                    3-stage evaluation model
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* STAGE 1 — TECHNICAL (PAST) */}
                  <div className="bg-[#1A2235] rounded-2xl border border-[rgba(255,255,255,0.06)] p-4 relative group hover:border-[#F59E0B]/30 hover:shadow-[0_0_16px_rgba(245,158,11,0.08)] transition-all cursor-default">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-mono font-black text-[#F59E0B]">01</span>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono font-black text-[#F59E0B] uppercase tracking-wider">Technical</div>
                        <div className="text-[9px] font-mono text-[#64748B] uppercase">Past</div>
                      </div>
                      <History className="h-3.5 w-3.5 text-[#F59E0B]/50 ml-auto" />
                    </div>
                    <p className="text-[11px] font-sans text-[#94A3B8] leading-relaxed mb-3">
                      Analyses price momentum, chart patterns, RSI, MACD, and support/resistance levels from historical trading data.
                    </p>
                    <div className="space-y-1.5">
                      {[
                        "Price trend & momentum",
                        "RSI overbought / oversold",
                        "MACD crossover signals",
                        "Support & resistance zones",
                      ].map(item => (
                        <div key={item} className="flex items-center gap-1.5 text-[10px] font-sans text-[#64748B]">
                          <div className="w-1 h-1 rounded-full bg-[#F59E0B]/60 shrink-0"></div>
                          {item}
                        </div>
                      ))}
                    </div>
                    <button
                      id="btn-view-technical-tab"
                      onClick={() => setActiveTab("technical")}
                      className="mt-4 w-full text-[10px] font-mono font-bold text-[#F59E0B] bg-[#F59E0B]/8 hover:bg-[#F59E0B]/15 border border-[#F59E0B]/20 rounded-xl py-2 transition-all cursor-pointer uppercase tracking-wider"
                    >
                      View Technical Analysis →
                    </button>
                  </div>

                  {/* STAGE 2 — FUNDAMENTAL (PRESENT) */}
                  <div className="bg-[#1A2235] rounded-2xl border border-[rgba(255,255,255,0.06)] p-4 relative group hover:border-[#00D4FF]/30 hover:shadow-[0_0_16px_rgba(0,212,255,0.08)] transition-all cursor-default">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-mono font-black text-[#00D4FF]">02</span>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono font-black text-[#00D4FF] uppercase tracking-wider">Fundamental</div>
                        <div className="text-[9px] font-mono text-[#64748B] uppercase">Present</div>
                      </div>
                      <BookOpen className="h-3.5 w-3.5 text-[#00D4FF]/50 ml-auto" />
                    </div>
                    <p className="text-[11px] font-sans text-[#94A3B8] leading-relaxed mb-3">
                      Evaluates the company's current financial health — earnings, valuation ratios, growth trajectory, and balance sheet strength.
                    </p>
                    <div className="space-y-1.5">
                      {[
                        "P/E ratio vs sector average",
                        "EPS & revenue growth",
                        "CS-FHR health score",
                        "Dividend yield & NAV",
                      ].map(item => (
                        <div key={item} className="flex items-center gap-1.5 text-[10px] font-sans text-[#64748B]">
                          <div className="w-1 h-1 rounded-full bg-[#00D4FF]/60 shrink-0"></div>
                          {item}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 w-full text-[10px] font-mono font-bold text-[#00D4FF] bg-[#00D4FF]/8 border border-[#00D4FF]/20 rounded-xl py-2 text-center uppercase tracking-wider">
                      Shown Below ↓ (Current View)
                    </div>
                  </div>

                  {/* STAGE 3 — EDUCATIONAL SYNTHESIS & INQUIRY */}
                  {(() => {
                    const score = fundamentalAnalysis?.fundamentalScore ?? null;
                    const pe    = currentStock.peRatio ?? null;
                    const rev   = currentStock.revGrowth ?? null;
                    const prof  = currentStock.profitGrowth ?? null;

                    // Derive educational profile from available metrics
                    let profile = "BALANCED PROFILE";
                    let profileColor  = "text-[#F59E0B]";
                    let profileBg     = "bg-[#F59E0B]/10";
                    let profileBorder = "border-[#F59E0B]/25";
                    let reasoning = "Mixed signals across metrics. Key question: Is operating cash flow keeping pace with reported net income?";
                    let investigationPrompt = "Examine upcoming quarterly disclosures & receivables turnover.";

                    if (score !== null && pe !== null) {
                      const growthPositive = (rev ?? 0) > 0 && (prof ?? 0) > 0;
                      const cheapValuation = pe < 15;
                      const strongHealth   = score >= 70;
                      const weakHealth     = score < 40;
                      const highGrowth     = (rev ?? 0) > 10;

                      if (strongHealth && cheapValuation && growthPositive) {
                        profile = "ROBUST VALUE PROFILE"; 
                        profileColor = "text-[#10B981]"; 
                        profileBg = "bg-[#10B981]/10"; 
                        profileBorder = "border-[#10B981]/25";
                        reasoning = `High solvency (CS-FHR: ${score}) with moderate P/E of ${pe}x and expansion across revenue and profit. Favorable setup for examining return on capital (ROE).`;
                        investigationPrompt = "Verify if dividend payout ratio is supported by free cash flow.";
                      } else if (strongHealth && growthPositive) {
                        profile = "STABLE GROWTH PROFILE"; 
                        profileColor = "text-[#10B981]"; 
                        profileBg = "bg-[#10B981]/10"; 
                        profileBorder = "border-[#10B981]/25";
                        reasoning = `Resilient balance sheet metrics (CS-FHR: ${score}) and steady revenue traction. Illustrates disciplined operational reinvestment.`;
                        investigationPrompt = "Assess whether capital expenditure is expanding production capacity.";
                      } else if (!weakHealth && highGrowth) {
                        profile = "GROWTH / VALUATION WATCH"; 
                        profileColor = "text-[#00D4FF]"; 
                        profileBg = "bg-[#00D4FF]/10"; 
                        profileBorder = "border-[#00D4FF]/25";
                        reasoning = `High top-line expansion (Rev: +${rev}%), but valuation multiples require scrutiny. High growth can be susceptible to margin compression.`;
                        investigationPrompt = "Study gross margin trajectory against rising raw material costs.";
                      } else if (weakHealth && !growthPositive) {
                        profile = "ELEVATED RISK PROFILE"; 
                        profileColor = "text-[#EF4444]"; 
                        profileBg = "bg-[#EF4444]/10"; 
                        profileBorder = "border-[#EF4444]/25";
                        reasoning = `Deteriorating financial health indicators (CS-FHR: ${score}) alongside contracting revenue/profit. Instructive case study on credit & operational risk.`;
                        investigationPrompt = "Audit short-term bank borrowings and interest coverage capability.";
                      } else if (weakHealth) {
                        profile = "BALANCE SHEET PRESSURE"; 
                        profileColor = "text-[#EF4444]"; 
                        profileBg = "bg-[#EF4444]/10"; 
                        profileBorder = "border-[#EF4444]/25";
                        reasoning = `CS-FHR score of ${score} signals balance sheet strain. Case for analyzing debt-to-equity and finance cost trends.`;
                        investigationPrompt = "Compare debt servicing requirements against annual operating cash flows.";
                      }
                    }

                    return (
                      <div id="judgement-framework-card" className={`bg-[#1A2235] rounded-2xl border ${profileBorder} p-4 relative group transition-all cursor-default`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-7 h-7 rounded-xl ${profileBg} border ${profileBorder} flex items-center justify-center shrink-0`}>
                            <span className={`text-[10px] font-mono font-black ${profileColor}`}>03</span>
                          </div>
                          <div>
                            <div className={`text-[10px] font-mono font-black ${profileColor} uppercase tracking-wider`}>Educational Synthesis</div>
                            <div className="text-[9px] font-mono text-[#64748B] uppercase">Case Study Analysis</div>
                          </div>
                          <Target className={`h-3.5 w-3.5 ${profileColor} opacity-50 ml-auto`} />
                        </div>

                        {/* Profile Badge */}
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${profileBg} border ${profileBorder} mb-3`}>
                          <span className={`text-xs font-mono font-black ${profileColor} tracking-wider`}>
                            {profile}
                          </span>
                        </div>

                        <p className="text-[11px] font-sans text-[#94A3B8] leading-relaxed mb-3">
                          {reasoning}
                        </p>

                        {/* Educational Investigation Prompt */}
                        <div className={`flex items-start gap-1.5 p-2.5 rounded-xl ${profileBg} border ${profileBorder}`}>
                          <Clock className={`h-3.5 w-3.5 ${profileColor} shrink-0 mt-0.5`} />
                          <div>
                            <span className="text-[9px] font-mono text-[#64748B] uppercase tracking-wider block">Question to Investigate</span>
                            <span className={`text-[10.5px] font-sans font-medium text-slate-200`}>
                              {investigationPrompt}
                            </span>
                          </div>
                        </div>

                        <button
                          id="btn-view-prediction-tab"
                          onClick={() => setActiveTab("prediction")}
                          className={`mt-3 w-full text-[10px] font-mono font-bold ${profileColor} ${profileBg} hover:opacity-80 border ${profileBorder} rounded-xl py-2 transition-all cursor-pointer uppercase tracking-wider`}
                        >
                          Explore Indicator Envelopes →
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
              </Section>

              <Section title="Fundamentals" hint="Reported profitability, valuation and financial health." defaultOpen>
              {/* Fundamental Scores Row */}
              <StockOverview
                stock={currentStock}
                fundamentalScore={fundamentalAnalysis.fundamentalScore}
                scoreBreakdown={fundamentalAnalysis.breakdown}
              />
              </Section>

              <Section title="Dividend history" hint="Past cash and stock dividends declared by the company.">
                <DividendHistory symbol={selectedSymbol} />
              </Section>
            </>
          )}
        </div>
      )}

          {/* AI VALUE ANALYZER TAB */}
          {activeTab === "analyzer" && aiRuns.fundamental.status !== "done" && (
            <AiRunBar
              title="Valuation analysis"
              description={`Fair-value models (P/E, PEG, DCF) and a fundamentals scorecard for ${selectedSymbol}, explained in plain language.`}
              dataUsed={["Last traded price", "EPS", "NAV per share", "P/E", "Dividend yield", "Sector averages", "Revenue and profit growth (when reported)"]}
              state={aiRuns.fundamental}
              onRun={() => runAi("fundamental")}
            />
          )}
          {activeTab === "analyzer" && aiRuns.fundamental.status === "done" && (
            <div id="printable-report-area" className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 space-y-6 shadow-2xl text-[#F0F4FF]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[rgba(255,255,255,0.06)] pb-4">
                <div>
                  <span className="text-[9px] uppercase font-mono text-[#00D4FF] tracking-widest block mb-1">Multi-Factor Valuation Model</span>
                  <h2 className="text-xl font-display font-black text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-violet-400" /> Valuation Analysis — {currentStock.symbol}
                  </h2>
                  <p className="text-xs text-[#94A3B8] font-sans mt-0.5">
                    Combines relative P/E regression, earnings-adjusted fair value, and multi-scenario DCF analysis.
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-sans rounded-xl shadow-sm transition-all select-none cursor-pointer border border-blue-700 active:scale-95 no-print"
                >
                  <Download className="h-4 w-4" /> Download Report (PDF)
                </button>
              </div>

              {isOverviewLoading ? (
                <div className="space-y-6 animate-pulse">
                  <div className="bg-[#1A2235]/45 border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-4">
                    <div className="h-4 bg-white/10 rounded w-1/4"></div>
                    <div className="h-8 bg-white/10 rounded w-1/2"></div>
                    <div className="space-y-2 pt-2">
                      <div className="h-3 bg-white/5 rounded w-full"></div>
                      <div className="h-3 bg-white/5 rounded w-5/6"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-40 bg-[#1A2235]/45 border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex flex-col justify-between">
                      <div className="h-4 bg-white/10 rounded w-1/2"></div>
                      <div className="h-8 bg-white/10 rounded w-2/3"></div>
                      <div className="h-3 bg-white/5 rounded w-full animate-pulse"></div>
                    </div>
                    <div className="h-40 bg-[#1A2235]/45 border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex flex-col justify-between">
                      <div className="h-4 bg-white/10 rounded w-1/2"></div>
                      <div className="h-8 bg-white/10 rounded w-2/3"></div>
                      <div className="h-3 bg-white/5 rounded w-full animate-pulse"></div>
                    </div>
                    <div className="h-40 bg-[#1A2235]/45 border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex flex-col justify-between">
                      <div className="h-4 bg-white/10 rounded w-1/2"></div>
                      <div className="h-8 bg-white/10 rounded w-2/3"></div>
                      <div className="h-3 bg-white/5 rounded w-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  <EquityValuationModel
                    symbol={currentStock.symbol}
                    stock={currentStock}
                    beta={currentStock.beta ?? 1.0}
                    onSwitchTab={(targetTab) => setActiveTab(targetTab)}
                  />

                  {/* OLD VALUATION GRAPH SECTIONS BYPASSED */}
                  {false && (
                    <>
                      {/* ML VALUATION CORE CARD */}
                  <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 md:p-6 pb-6 print-card-light">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                      <div className="space-y-1.5 flex-1">
                        <span className="text-[10px] font-mono uppercase bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20 px-2 py-0.5 rounded font-extrabold">
                          {fundamentalAnalysis.valuationStatus === "Unavailable" ? "Model Status" : "Fair Value Estimate"}
                        </span>
                        <h3 className="text-lg font-display font-bold text-white">
                          {fundamentalAnalysis.valuationStatus === "Unavailable" ? (
                            "Fair Value Estimate: N/A"
                          ) : (
                            <>
                              Fair Value Estimate: <span className="text-[#00D4FF] text-xl font-mono underline decoration-wavy decoration-[#00D4FF]/50">BDT {fundamentalAnalysis.fairValueEstimate != null ? fundamentalAnalysis.fairValueEstimate.toFixed(2) : "N/A"}</span>
                            </>
                          )}
                        </h3>
                        <p className="text-xs text-[#94A3B8] max-w-2xl leading-relaxed">
                          {fundamentalAnalysis.valuationStatus === "Unavailable" ? (
                            "Valuation models are disabled because verified EPS, growth, cash-flow or dividend inputs are missing."
                          ) : (
                            `This estimate represents the weighted consensus of ${currentStock.symbol}'s operating model. The model computes discount coefficients based on current dividend yields and sector-normalized cost of capital.`
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 bg-[#111827] p-4 rounded-xl border border-[rgba(255,255,255,0.06)] shadow-xl min-w-[240px] print-card-light">
                        <div className="space-y-1">
                          <span className="text-[9px] text-[#94A3B8] uppercase font-mono block">Consensus Signal</span>
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                            fundamentalAnalysis.valuationStatus === "Undervalued" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                            fundamentalAnalysis.valuationStatus === "Overvalued" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                            fundamentalAnalysis.valuationStatus === "Unavailable" ? "bg-white/5 text-[#94A3B8] border border-white/10" :
                            "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {fundamentalAnalysis.valuationStatus || "Fair Valued"}
                          </span>
                          <span className="text-[10px] font-medium text-[#94A3B8] block mt-1">
                            Current Price: BDT {currentStock.price}
                          </span>
                        </div>
                        <div className="h-10 w-[1px] bg-[rgba(255,255,255,0.06)]"></div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-[#94A3B8] uppercase font-mono block">Deviation Margin</span>
                          <span className={`text-base font-mono font-black block ${
                            fundamentalAnalysis.valuationStatus === "Unavailable" ? "text-slate-500" :
                            (fundamentalAnalysis.discountPremium || 0) > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {fundamentalAnalysis.valuationStatus === "Unavailable" ? "N/A" : (
                              `${(fundamentalAnalysis.discountPremium || 0) > 0 ? "+" : ""}${fundamentalAnalysis.discountPremium || 0}%`
                            )}
                          </span>
                          <span className="text-[9px] text-[#94A3B8]/70 block">
                            {fundamentalAnalysis.valuationStatus === "Unavailable" ? "Pricing Model Inactive" : (
                              (fundamentalAnalysis.discountPremium || 0) > 0 ? "Undervalued Discount" : "Overvalued Premium"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Visual Bar */}
                    {fundamentalAnalysis.valuationStatus !== "Unavailable" && (
                      <div className="mt-5 space-y-1">
                        <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono">
                          <span>Max Discount (-40%)</span>
                          <span className="font-bold text-white">Fair Equilibrium</span>
                          <span>Max Premium (+40%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#111827] rounded-full overflow-hidden relative shadow-inner border border-[rgba(255,255,255,0.04)]">
                          {/* Center marker line */}
                          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-[rgba(255,255,255,0.15)]"></div>
                          
                          {/* Filled slider bar */}
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              (fundamentalAnalysis.discountPremium || 0) > 0 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-rose-500 to-rose-400"
                            }`}
                            style={{
                              width: `${Math.min(40, Math.abs(fundamentalAnalysis.discountPremium || 0)) * 1.25}%`,
                              marginLeft: (fundamentalAnalysis.discountPremium || 0) > 0 ? '50%' : `${50 - Math.min(40, Math.abs(fundamentalAnalysis.discountPremium || 0)) * 1.25}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* THREE FACTOR BENTO GRID BRACKETS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    
                    {/* 1. P/E Comparison */}
                    <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.06)] rounded-2xl p-4.5 space-y-3 shadow-xl hover:border-[#00D4FF]/30 transition-all print-card-light flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-2 py-0.5 rounded font-mono">
                            FACTOR #01 (35% wt.)
                          </span>
                          <Scale className="h-4 w-4 text-[#94A3B8]" />
                        </div>
                        <h4 className="text-xs font-extrabold text-white uppercase mt-3">
                          P/E-Based Target
                        </h4>
                        <p className="text-[11px] text-[#94A3B8] leading-normal mt-1">
                          Evaluates current P/E index ({currentStock.peRatio}x) against sector targets to determine ratio alignment.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] mt-2 flex justify-between items-center font-mono">
                        <div>
                          <span className="text-[9px] text-[#94A3B8] block font-mono uppercase">Model Fair Value</span>
                          <strong className="text-sm font-mono text-white">BDT {fundamentalAnalysis.peFairValue || "..."}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-[#94A3B8] block font-mono uppercase">Factor Score</span>
                          <strong className="text-xs font-mono text-[#00D4FF] block bg-[#00D4FF]/10 rounded px-1.5 py-0.5 border border-[#00D4FF]/20">{fundamentalAnalysis.peFactorScore || 50}/100</strong>
                        </div>
                      </div>
                    </div>

                    {/* 2. growth PEG model */}
                    <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.06)] rounded-2xl p-4.5 space-y-3 shadow-xl hover:border-[#00D4FF]/30 transition-all print-card-light flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2 py-0.5 rounded font-mono">
                            FACTOR #02 (25% wt.)
                          </span>
                          <TrendingUp className="h-4 w-4 text-[#94A3B8]" />
                        </div>
                        <h4 className="text-xs font-extrabold text-white uppercase mt-3">
                          Growth Adjusted PEG Model
                        </h4>
                        <p className="text-[11px] text-[#94A3B8] leading-normal mt-1">
                          Adjusts P/E value based on net earnings growth rate of {currentStock.profitGrowth || 5}%. Target PEG ratios benchmark at 1.1x.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] mt-2 flex justify-between items-center font-mono">
                        <div>
                          <span className="text-[9px] text-[#94A3B8] block font-mono uppercase">Model Fair Value</span>
                          <strong className="text-sm font-mono text-white">BDT {fundamentalAnalysis.pegFairValue || "..."}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-[#94A3B8] block font-mono uppercase">PEG Score</span>
                          <strong className="text-xs font-mono text-[#F59E0B] block bg-[#F59E0B]/10 rounded px-1.5 py-0.5 border border-[#F59E0B]/20">{fundamentalAnalysis.pegFactorScore || 50}/100</strong>
                        </div>
                      </div>
                    </div>

                    {/* 3. cash flow DCF model */}
                    <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.06)] rounded-2xl p-4.5 space-y-3 shadow-xl hover:border-[#00D4FF]/30 transition-all print-card-light flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-0.5 rounded font-mono">
                            FACTOR #03 (40% wt.)
                          </span>
                          <Activity className="h-4 w-4 text-[#94A3B8]" />
                        </div>
                        <h4 className="text-xs font-extrabold text-white uppercase mt-3">
                          DCF Intrinsic Value
                        </h4>
                        <p className="text-[11px] text-[#94A3B8] leading-normal mt-1">
                          Calculates discrete multi-period present value of free cash flow streams at an 11.5% discount and 3.5% terminal perpetual rate.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] mt-2 flex justify-between items-center font-mono">
                        <div>
                          <span className="text-[9px] text-[#94A3B8] block font-mono uppercase">Model Fair Value</span>
                          <strong className="text-sm font-mono text-white">BDT {fundamentalAnalysis.dcfFairValue || "..."}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-[#94A3B8] block font-mono uppercase font-mono">FCF Score</span>
                          <strong className="text-xs font-mono text-[#10B981] block bg-[#10B981]/10 rounded px-1.5 py-0.5 border border-[#10B981]/20">{fundamentalAnalysis.cashFlowFactorScore || 50}/100</strong>
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              )}

              {/* NARRATIVE REPORT COLUMN GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed">
                    
                    {/* Left core parameters explanation */}
                    <div className="lg:col-span-7 space-y-6">
                      <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 print-card-light">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#00D4FF] mb-3 block">
                          AI Narrative Reasoning Overview
                        </h4>
                        <div className="space-y-3">
                          {fundamentalAnalysis.reasoning.map((item, idx) => (
                            <div key={idx} className="flex gap-3 text-xs text-[#F0F4FF] font-medium items-start p-3 bg-[#111827]/60 rounded-xl border border-[rgba(255,255,255,0.06)] shadow-md print-card-light">
                              <span className="text-[#00D4FF] font-bold font-mono bg-[#00D4FF]/10 px-1.5 py-0.5 rounded border border-[#00D4FF]/20">#0{idx + 1}</span>
                              <p className="leading-relaxed">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Numerical margins lists */}
                      <div className="bg-[#1A2235]/40 rounded-2xl border border-[rgba(255,255,255,0.06)] p-5 print-card-light">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#10B981] mb-3 block">
                          Balance Sheet Risk Analysis Indicators
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs text-center">
                          <div className="p-3 bg-[#111827]/60 rounded-xl border border-[rgba(255,255,255,0.06)] shadow-md print-card-light">
                            <span className="text-[9px] text-[#94A3B8] uppercase block">Debt-to-Asset Ratio</span>
                            <strong className="text-sm text-white mt-1 block font-black">
                              {currentStock.financials?.debtRatio !== undefined && currentStock.financials?.debtRatio !== null 
                                ? `${(currentStock.financials.debtRatio * 100).toFixed(0)}%` 
                                : "N/A"}
                            </strong>
                          </div>
                          <div className="p-3 bg-[#111827]/60 rounded-xl border border-[rgba(255,255,255,0.06)] shadow-md print-card-light">
                            <span className="text-[9px] text-[#94A3B8] uppercase block">Return-on-Equity (ROE)</span>
                            <strong className="text-sm text-[#10B981] mt-1 block font-black">
                              {currentStock.financials?.roe !== undefined && currentStock.financials?.roe !== null 
                                ? `+${currentStock.financials.roe}%` 
                                : "N/A"}
                            </strong>
                          </div>
                          <div className="p-3 bg-[#111827]/60 rounded-xl border border-[rgba(255,255,255,0.06)] shadow-md print-card-light">
                            <span className="text-[9px] text-[#94A3B8] uppercase block">Return-on-Assets (ROA)</span>
                            <strong className="text-sm text-[#10B981] mt-1 block font-black">
                              {currentStock.financials?.roa !== undefined && currentStock.financials?.roa !== null 
                                ? `+${currentStock.financials.roa}%` 
                                : "N/A"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right breakdown columns qualitative explanations */}
                    <div className="lg:col-span-5 bg-[#1A2235]/40 rounded-2xl border border-[rgba(255,255,255,0.06)] p-5 space-y-4 print-card-light">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#F59E0B] mb-3 flex items-center gap-1.5">
                        <Sparkles className="h-4.5 w-4.5 animate-pulse-slow" /> Qualitative Strategic Dimensions
                      </h4>

                      {[
                        { name: "Operating Profitability Core", desc: fundamentalAnalysis.breakdown.profitability },
                        { name: "Liquidity & Working Capital", desc: fundamentalAnalysis.breakdown.liquidity },
                        { name: "Solvency & Financial Leverage", desc: fundamentalAnalysis.breakdown.solvency },
                        { name: "Sales & Earnings Growth Trajectory", desc: fundamentalAnalysis.breakdown.growth },
                        { name: "Management Operating Efficiency", desc: fundamentalAnalysis.breakdown.efficiency }
                      ].map((metric, index) => (
                        <div key={index} className="p-3 bg-[#111827]/60 rounded-xl border border-[rgba(255,255,255,0.06)] text-xs shadow-md print-card-light">
                          <span className="font-extrabold text-[#F0F4FF] font-display block mb-1">{metric.name}</span>
                          <p className="text-[#94A3B8] leading-relaxed text-[11px]">{metric.desc || "Operating stats reflect solid capacity thresholds in line with sector benchmarks."}</p>
                        </div>
                      ))}
                    </div>

                  </div>

                </div>
              )}
            </div>
          )}

          {/* TECHNICAL SIGNALS OSCILLATORS TAB */}
          {activeTab === "technical" && (
            <div className="space-y-4">
            <AiRunBar
              compact
              title="AI reading of the indicators (optional)"
              description="The indicators below are calculated from price history. Generate a plain-language interpretation of them."
              dataUsed={["Daily price and volume history", "RSI", "MACD", "Moving averages", "Bollinger bands"]}
              state={aiRuns.technical}
              onRun={() => runAi("technical")}
            />
            {aiRuns.technical.status === "done" && technicalSignals?.aiInterpretation && (
              <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)] leading-relaxed">{technicalSignals.aiInterpretation}</p>
            )}
            <TechnicalSignals
              indicators={technicalSignals}
              stockPrice={currentStock.price}
              symbol={currentStock.symbol}
              historicalData={historicalChart}
            />
            </div>
          )}

          {/* AI FUTURE PRICE PREDICTION ENVELOPES TAB */}
          {activeTab === "prediction" && (
            <div className="space-y-4">
            <AiRunBar
              compact
              title="AI forecast commentary"
              description="Generate the model's explanation of possible price paths. Forecasts are not validated and are not advice."
              dataUsed={["Daily price history", "Volatility", "Moving averages"]}
              state={aiRuns.predict}
              onRun={() => runAi("predict")}
            />
            <PricePrediction
              symbol={currentStock.symbol}
              currentPrice={currentStock.price}
              predictions={predictions}
              aiExplanation={predictionExplanation}
              disclaimer={predictionDisclaimer}
              decisionIntel={technicalSignals?.decisionIntel}
              chartDays={chartDays}
            />
            </div>
          )}

          {/* LOSS PREVENTION AI RISK DETECTION TAB */}
          {activeTab === "risk" && aiRuns.risk.status !== "done" && (
            <AiRunBar
              title="Risk assessment"
              description={`Generate a risk score for ${selectedSymbol}, what could go wrong, and ways to limit losses.`}
              dataUsed={["Price volatility", "Drawdowns", "P/E and fundamentals (when reported)", "Sector", "Liquidity (volume)"]}
              state={aiRuns.risk}
              onRun={() => runAi("risk")}
            />
          )}
          {activeTab === "risk" && aiRuns.risk.status === "done" && (
            <LossPrevention
              stock={currentStock}
              riskScore={riskAnalysis.score}
              riskLevel={riskAnalysis.level}
              flags={riskAnalysis.flags}
              whatCouldGoWrong={riskAnalysis.whatCouldGoWrong}
              howToReduceRisk={riskAnalysis.howToReduceRisk}
              alerts={alerts}
              onAddAlert={handleAddAlert}
              onRemoveAlert={handleRemoveAlert}
              onTriggerSim={handleTriggerSim}
              decisionIntel={technicalSignals?.decisionIntel}
            />
          )}

          {/* ASSET ALLOCATION OPTIMIZER PORTFOLIO BUILDER TAB */}
          {activeTab === "portfolio" && (
            <PortfolioOptimizer
              capital={portfolioCapital}
              setCapital={setPortfolioCapital}
              riskAppetite={portfolioRisk}
              setRiskAppetite={setPortfolioRisk}
              horizon={portfolioHorizon}
              setHorizon={setPortfolioHorizon}
              allocations={portfolioAllocations}
              expectedReturn={portfolioExpectedReturn}
              volatility={portfolioVolatility}
              diversificationScore={portfolioDivScore}
              portfolioRisk={portfolioRiskScore}
              isLoading={isPortfolioLoading}
              stocksList={stocksList}
            />
          )}

          {/* SYSTEM HISTORICAL DATA ADMIN TAB */}
          {activeTab === "admin" && (
            <HistoricalDataAdmin />
          )}

        </div>
      </div>
    </div>
          </>
        ) : selectedView === "learn" ? (
          <EducationalAcademy />
        ) : selectedView === "ask" ? (
          <div className="space-y-6 animate-fade-in">
            <AIStockResearchAssistant currentStock={currentStock} stocksList={stocksList} onSelectStock={handleSelectSearched} />
          </div>
        ) : selectedView === "think" ? (
          <ThinkAssessmentRoom />
        ) : selectedView === "practice" || selectedView === "portfolio" ? (
          <PortfolioManagement 
            defaultTab={portfolioDefaultTab}
            resetDefaultTab={() => setPortfolioDefaultTab(undefined)}
          />
        ) : selectedView === "progress" ? (
          <LearnerProgressRoom 
            onNavigateToLearn={() => setSelectedView("learn")}
            onNavigateToExplore={() => setSelectedView("explore")}
          />
        ) : selectedView === "admin" ? (
          isAdmin ? (
            <HistoricalDataAdmin />
          ) : (
            <div className="p-12 text-center text-slate-400 font-mono text-xs bg-slate-900/40 border border-slate-800 rounded-3xl">
              Admin Console is restricted to authenticated operators. Add <span className="text-[#00D4FF]">?admin=true</span> to URL to access maintenance functions.
            </div>
          )
        ) : selectedView === "intelligence" ? (
          <MarketIntelligenceCenter />
        ) : selectedView === "about" ? (
          <HowItWorks onStart={() => handleNavigate("explore")} />
        ) : (
          <div className="space-y-6">
            <HomeHero stocks={stocksList} onSelectStock={handleSelectSearched} onNavigate={(v) => handleNavigate(v)} />
            <MarketOverview stocks={stocksList} onSelectStock={handleSelectSearched} />
            
            <Section title="Sector market value & AI market researcher" hint="Which sectors make up the market, and questions you can ask about it.">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
              <div className="xl:col-span-8 flex flex-col h-full">
                <SectorMarketCapDashboard />
              </div>
              <div className="xl:col-span-4 flex flex-col h-full">
                <MarketResearcherAI />
              </div>
            </div>
            </Section>

            <Section title="Opportunity & risk scanners" hint="Rule-based screens for stocks with unusual momentum or warning signs. Educational, not advice.">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <OpportunityScanner />
              <DangerScanner />
            </div>
            </Section>
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--border)] mt-8 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-sm text-[var(--text-muted)]">
          <p>DSE Analyst · Educational use only — not investment advice.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <a href="/about" onClick={(e) => { e.preventDefault(); handleNavigate("about"); }} className="hover:text-white underline-offset-4 hover:underline">How it works &amp; data sources</a>
            <a href="https://www.dse.com.bd" target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-4 hover:underline">Dhaka Stock Exchange ↗</a>
          </nav>
        </div>
      </footer>

      {selectedSymbol !== null && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#111827]/95 backdrop-blur-xl border-t border-[rgba(255,255,255,0.08)] flex lg:hidden safe-area-bottom" id="mobile-bottom-nav">
          {[
            { id: "dashboard",  icon: LayoutDashboard, label: "Overview"   },
            { id: "analyzer",   icon: BookOpen,        label: "Valuation"  },
            { id: "technical",  icon: Activity,        label: "Technical"  },
            { id: "prediction", icon: Target,          label: "Forecast"   },
            { id: "risk",       icon: ShieldAlert,     label: "Risk"       },
            { id: "portfolio",  icon: PieChart,        label: "Portfolio"  }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === "portfolio") {
                    optimizerPortfolio(true);
                  } else {
                    setActiveTab(tab.id as any);
                  }
                }}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all duration-200 min-h-[56px] relative ${
                  isActive
                    ? "text-[#00D4FF]"
                    : "text-[#4B5563] active:text-[#94A3B8]"
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                <span className="text-[9px] font-mono font-bold tracking-wide leading-none mt-0.5 truncate max-w-[48px]">
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#00D4FF] rounded-t-full glow-pulse" />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* 5. Footer and copyright credentials */}
      <footer className="border-t border-[#1e293b] mt-5 py-5 bg-[#0b0f19] text-center text-xs text-gray-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-3.5">
          <div className="flex flex-col items-center gap-1">
            <span className="font-bold text-gray-400">DSE AI Analyst Core Platform • Connected Terminal Core</span>
          </div>

          {/* Collapsible Platform Methodology and Technical Disclosure Audit */}
          <div className="border-t border-slate-900 pt-3 max-w-2xl mx-auto font-sans">
            <button
              onClick={() => setIsDisclaimerExpanded(!isDisclaimerExpanded)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1.5 mx-auto font-bold uppercase tracking-wider cursor-pointer select-none no-print py-1 bg-slate-950 px-3.5 rounded-full border border-slate-800"
            >
              <span>{isDisclaimerExpanded ? "Hide Platform Methodology & Disclosures" : "Platform Methodology & Disclosures"}</span>
              <span className="font-mono text-[10px]">{isDisclaimerExpanded ? "▲" : "▼"}</span>
            </button>

            {isDisclaimerExpanded && (
              <div className="mt-4 p-5 bg-slate-950/70 text-left rounded-2xl border border-slate-850 space-y-4 text-xs text-slate-350 leading-relaxed max-w-xl mx-auto font-sans animate-fade-in">
                <div>
                  <h4 className="font-bold text-slate-200 uppercase tracking-widest text-[9.5px] border-b border-slate-850 pb-1 mb-1.5 text-blue-300">1. Purely Formula-Based Systems</h4>
                  <p className="text-[11px]">
                    Technical Indicator curves (RSI, MA, MACD, Bollinger, ATR), Heuristic Portfolio Weights (Standard standard modeling and Custom builders), and Stress Test risk ratings are computed in-browser using deterministic mathematical equations directly on fetched data. No artificial intelligence is used to draw or simulate these metrics.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200 uppercase tracking-widest text-[9.5px] border-b border-slate-850 pb-1 mb-1.5 text-emerald-300">2. Real AI-Assisted Operations</h4>
                  <p className="text-[11px]">
                    AI Valuation interpretation briefs, historical anomaly explanations, investor chats, and news sentiment summaries are generated in real-time on our backend using Gemini generative AI models. High-density data matrices are sent as system prompts to contextually summarize qualitative insights for your analysis.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200 uppercase tracking-widest text-[9.5px] border-b border-slate-850 pb-1 mb-1.5 text-amber-300">3. Data Source Integrity</h4>
                  <p className="text-[11px]">
                    Price databases depend exclusively on validated historical CSV records parsed from open DSE archives. Missing fields (such as missing dividend or growth yields) dynamically fallback to conservative sector sector-averages to avoid algorithmic halting.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200 uppercase tracking-widest text-[9.5px] border-b border-slate-850 pb-1 mb-1.5 text-rose-300">4. API Fallbacks & Bounds</h4>
                  <p className="text-[11px]">
                    If the Gemini API key is missing, rate-limited, or fails, the platform automatically switches to rule-based fallback briefings containing static trend indicators, ensuring the user interface remains uninterrupted.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200 uppercase tracking-widest text-[9.5px] border-b border-slate-850 pb-1 mb-1.5 text-[#00D4FF]">5. Direct Exchange Resources</h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] pt-1">
                    <a href="https://dse.com.bd/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 font-mono">
                      DSE Homepage ↗
                    </a>
                    <span className="text-slate-700 font-mono">•</span>
                    <a href="https://dse.com.bd/latest_share_price_scroll_l.php" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-0.5 font-mono">
                      Live Prices ↗
                    </a>
                    <span className="text-slate-700 font-mono">•</span>
                    <a href="https://dse.com.bd/dse_news.php" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-0.5 font-mono">
                      Corporate Announcements ↗
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="max-w-2xl mx-auto text-[10px] text-gray-500 leading-relaxed font-sans pt-2">
            <strong>DISCLAIMER:</strong> AI-generated research, portfolio analytics, and market intelligence are provided for informational purposes only and do not constitute investment advice. Investing in DSE-listed securities involves substantial risk, and past performance does not guarantee future results.
          </p>
          <div className="pt-0.5 text-[10px] text-slate-500">
            © 2026 DSE AI Analyst. Built for Retail Investors in Bangladesh.
          </div>
        </div>
      </footer>

      {/* Real-time Scrolling Ticker Tape at the bottom of the dashboard */}
      <TickerTape 
        stocks={stocksList} 
        onSelectStock={handleSelectSearched} 
        isLoggedIn={currentUser !== null}
      />

      {/* 7. Auth Forms Modal Overlay */}
      {authModalOpen && (
        <AuthModalForm
          mode={authModalOpen}
          onClose={() => setAuthModalOpen(null)}
          onLogin={handleLoginSubmit}
          onSignup={handleSignupSubmit}
        />
      )}

      {/* 8. Subscription Billing Portal Modal Overlay (Gated to Admin only) */}
      {isAdmin && isBillingModalOpen && (
        <SubscriptionBillingPortal
          currentUser={currentUser}
          authToken={authToken}
          onClose={() => setIsBillingModalOpen(false)}
          onUpgradeSuccess={(updatedUser) => {
            setCurrentUser(updatedUser);
            localStorage.setItem("dse_user", JSON.stringify(updatedUser));
            fetchProfileAndWatchlist();
          }}
        />
      )}
    </div>
  );
}
