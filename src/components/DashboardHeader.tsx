import React, { useState, useEffect } from "react";
import { Globe, Award, LogIn, UserPlus, LogOut, User, RefreshCw, ChevronDown, ChevronUp, Database, Search, Bell, Home, Briefcase, Menu, BookOpen, Compass, MessageSquare, BrainCircuit, LineChart, Award as ProgressIcon } from "lucide-react";
import { StockData } from "../types";
import { LanguageToggle } from "./LanguageToggle";

interface DashboardHeaderProps {
  currentUser?: { email: string; name: string; tier?: string; subscriptionStatus?: string; subscriptionExpiresAt?: string } | null;
  onLogout?: () => void;
  onTriggerAuthModal?: (mode: "login" | "signup") => void;
  onSyncSuccess?: () => void;
  onTriggerBillingModal?: () => void;

  // Integrated Ticker Search & Navigation Inputs
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showSearchResults: boolean;
  setShowSearchResults: (show: boolean) => void;
  filteredSearchList: StockData[];
  onSelectSearched: (symbol: string) => void;

  selectedView: string;
  onNavigate: (view: string) => void;
  onToggleMobileMenu?: () => void;
  isAdmin?: boolean;
}

export default function DashboardHeader({
  currentUser,
  onLogout,
  onTriggerAuthModal,
  onSyncSuccess,
  onTriggerBillingModal,
  searchQuery,
  onSearchChange,
  showSearchResults,
  setShowSearchResults,
  filteredSearchList,
  onSelectSearched,
  selectedView,
  onNavigate,
  onToggleMobileMenu,
  isAdmin = false
}: DashboardHeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [dseStatus, setDseStatus] = useState({
    status: "Live",
    live: true,
    source: "LiveScraped" as any,
    parsedSymbols: 634,
    cachedSymbols: 0,
    defaultSeedSymbols: 0,
    lastAttemptTime: null as string | null,
    lastSuccessfulSync: new Date().toISOString(),
    message: "Connected to DSE official live market ticker.",
    diagnostics: null as any
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const isOnline = Boolean(
    dseStatus.live ||
    dseStatus.status === "Live" ||
    dseStatus.source === "LiveScraped" ||
    (dseStatus.source as string) === "DSE_OFFICIAL"
  );

  const fetchDseStatus = async () => {
    try {
      const res = await fetch("/api/dse/status");
      const data = await res.json();
      setDseStatus({
        status: data.status,
        live: data.live,
        source: data.source,
        parsedSymbols: data.parsedSymbols,
        cachedSymbols: data.cachedSymbols || 0,
        defaultSeedSymbols: data.defaultSeedSymbols || 0,
        lastAttemptTime: data.lastAttemptTime,
        lastSuccessfulSync: data.lastSuccessfulSync,
        message: data.message,
        diagnostics: data.diagnostics
      });
    } catch (e) {
      console.warn("Failed to check DSE sync status", e);
    }
  };

  useEffect(() => {
    fetchDseStatus();
    const timer = setInterval(fetchDseStatus, 20000);
    return () => clearInterval(timer);
  }, []);

  const triggerLiveSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      setDseStatus(prev => ({ ...prev, status: "Syncing", message: "Scraping dse.com.bd live tables..." }));
      const res = await fetch("/api/dse/sync", { method: "POST" });
      const data = await res.json();
      await fetchDseStatus();
      if (data.success && onSyncSuccess) {
        onSyncSuccess();
      }
    } catch (e) {
      setDseStatus(prev => ({
        ...prev,
        status: "Failed",
        live: false,
        source: "CachedFile",
        message: "Live DSE connection failed. Showing cached/default data."
      }));
    } finally {
      setIsSyncing(false);
    }
  };

  const getSourceBadge = () => {
    if (dseStatus.status === "Syncing") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-[#00D4FF] border border-[#00D4FF]/30 text-[10px] uppercase font-mono tracking-wider font-bold animate-pulse">
          <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Syncing...
        </span>
      );
    }

    if (isOnline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-[#10B981] border border-[#10B981]/20 text-[10px] uppercase font-mono tracking-wider font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
          LIVE DSE
        </span>
      );
    }

    if (dseStatus.source === "CachedFile" || (dseStatus.source as string) === "DSE_OFFICIAL_CACHE" || dseStatus.status === "Cached") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-[#F59E0B] border border-[#F59E0B]/20 text-[10px] uppercase font-mono tracking-wider font-bold" title="Delayed Market Data">
          ● CACHED
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#4B5563]/20 text-[#94A3B8] border border-[#4B5563]/20 text-[10px] uppercase font-mono tracking-wider font-semibold">
        ● OFFLINE DEMO
      </span>
    );
  };

  return (
    <div className="w-full flex flex-col relative z-40">
      
      {/* Top Banner for non-live sources */}
      {!isOnline && dseStatus.status !== "Syncing" && (
        <div id="dse-warning-strip" className="bg-[#EF4444]/10 border-b border-[#EF4444]/20 text-[11px] text-[#EF4444] px-4 py-1.5 font-mono flex justify-between items-center gap-4 transition-all w-full">
          <span className="flex items-center gap-2">
            <span>⚠️</span>
            <span>
              {dseStatus.source === "CachedFile" || (dseStatus.source as string) === "DSE_OFFICIAL_CACHE"
                ? "DSE Scraper feed disconnected. Using cached local snapshots."
                : "Using offline seeds. System analytics compiled in rule-based fallback mode."}
            </span>
          </span>
          <button 
            onClick={triggerLiveSync}
            className="text-[#00D4FF] hover:underline font-bold text-[10px] uppercase tracking-wider"
          >
            Reconnect Scraper &rarr;
          </button>
        </div>
      )}

      {/* Main 64px Top Navigation Bar */}
      <header className="h-14 sm:h-15 lg:h-16 px-3 sm:px-4 lg:px-6 bg-[#111827] border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-4 w-full relative">
        
        {/* Left: Branding & Logo */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          {/* Hamburger Menu for Mobile/Tablet */}
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 rounded-xl bg-[#1A2235] border border-[rgba(255,255,255,0.08)] text-[#94A3B8] hover:text-[#00D4FF] hover:bg-[#1A2235]/80 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Toggle navigation drawer"
            id="mobile-drawer-toggle-btn"
          >
            <Menu className="h-5 w-5 text-[#00D4FF]" />
          </button>

          <div onClick={() => onNavigate(null)} className="flex items-center gap-2 cursor-pointer select-none">
            <span className="font-display font-[800] text-xl text-white tracking-tighter uppercase flex items-center">
              DSE Analyst<span className="text-[#00D4FF] ml-0.5 text-2xl font-black">.</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono border border-[rgba(255,255,255,0.08)] bg-[#1A2235] px-2 py-0.5 rounded text-[#94A3B8]">
              beta
            </span>
          </div>

          {/* Views Navigation Tabs — 6-Step Learning Journey */}
          <nav className="hidden md:flex items-center gap-1 bg-[#1A2235]/60 border border-[rgba(255,255,255,0.06)] rounded-2xl p-1 overflow-x-auto scrollbar-none" id="header-view-navigation">
            {[
              { id: "learn",    label: "Learn",                  icon: BookOpen },
              { id: "explore",  label: "Explore",                icon: Compass },
              { id: "ask",      label: "Ask",                    icon: MessageSquare },
              { id: "think",    label: "Think & Get Assessed",   icon: BrainCircuit },
              { id: "practice", label: "Practice",               icon: LineChart },
              { id: "progress", label: "My Progress",            icon: ProgressIcon },
              ...(isAdmin ? [{ id: "admin", label: "Data Console", icon: Database }] : [])
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = selectedView === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-btn-${tab.id}`}
                  onClick={() => onNavigate(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-bold rounded-xl transition-all border cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/30 font-extrabold shadow-sm"
                      : "text-[#94A3B8] hover:text-[#F0F4FF] border-transparent hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 text-[#00D4FF]" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            {getSourceBadge()}
            
            <button
              id="sidebar-refresh-indicator"
              onClick={triggerLiveSync}
              disabled={isSyncing}
              title="Manually query dse.com.bd html parser"
              className="text-[#94A3B8] hover:text-[#00D4FF] p-1 hover:bg-[#1A2235] rounded transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-[#00D4FF]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Center: Frosted Glass Search Ticker Lookup */}
        <div className="hidden sm:block flex-1 w-full max-w-xs lg:max-w-sm relative mx-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#94A3B8]">
              <Search className="h-4 w-4" />
            </div>
            <input
              id="dashboard-header-search-container"
              type="text"
              placeholder="Search ticker, company profile or sector..."
              value={searchQuery}
              onChange={onSearchChange}
              onFocus={() => setShowSearchResults(searchQuery.trim().length > 0)}
              className="w-full bg-[#1A2235]/40 text-[#F0F4FF] text-xs pl-9 pr-4 py-2 rounded-xl border border-[rgba(255,255,255,0.08)] outline-none focus:border-[#00D4FF]/50 focus:ring-1 focus:ring-[#00D4FF]/30 backdrop-blur-md transition-all placeholder-[#4B5563]"
            />

            {/* Custom search popup results */}
            {showSearchResults && (
              <div 
                className="absolute left-0 right-0 mt-2 bg-[#111827] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto p-1 backdrop-blur-xl"
                onMouseLeave={() => setShowSearchResults(false)}
              >
                {filteredSearchList.length === 0 ? (
                  <div className="text-center py-4 text-xs text-[#94A3B8]/60 font-mono">
                    No DSE listed symbol match.
                  </div>
                ) : (
                  filteredSearchList.map(item => (
                    <button
                      key={item.symbol}
                      onClick={() => {
                        onSelectSearched(item.symbol);
                        setShowSearchResults(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-mono rounded-lg hover:bg-[#1A2235] flex justify-between items-center transition-colors text-[#94A3B8] hover:text-[#F0F4FF] cursor-pointer"
                    >
                      <div className="truncate">
                        <strong className="block text-[#F0F4FF] font-semibold">{item.symbol}</strong>
                        <span className="text-[10px] text-[#94A3B8] font-sans truncate block">{item.name}</span>
                      </div>
                      <div className="text-right ml-4">
                        <span className="text-[12px] font-bold text-[#F0F4FF] block">BDT {item.price || "N/A"}</span>
                        <span className={`text-[9px] font-bold ${
                          (item.changePercent || 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                        }`}>
                          {(item.changePercent || 0) >= 0 ? "+" : ""}{(item.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Market Status, User Settings, Diagnostics */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Mobile search bar toggle button */}
          <button className="sm:hidden p-2 text-[#94A3B8] hover:text-[#00D4FF] transition-colors"
                  onClick={() => setMobileSearchOpen(!mobileSearchOpen)}>
            <Search className="h-5 w-5" />
          </button>

          {/* Diagnostic Console Button */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`hidden sm:flex items-center gap-1 text-[10px] uppercase font-mono font-bold px-2 py-1 rounded bg-[#1A2235] transition-all hover:bg-[#1A2235]/80 cursor-pointer ${
              showDiagnostics ? "text-[#00D4FF] border border-[#00D4FF]/30" : "text-[#94A3B8] border border-transparent"
            }`}
            title="Toggle Web Scraper diagnostics log"
          >
            <Database className="h-3 w-3" />
            <span>Diagnostics</span>
          </button>

          {/* Language Toggle & User Sign In */}
          <LanguageToggle className="hidden sm:inline-flex" />

          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1A2235] border border-[rgba(255,255,255,0.06)] text-xs text-[#94A3B8]">
                <User className="h-3.5 w-3.5 text-[#00D4FF]" />
                <span className="hidden sm:inline font-sans text-[11px]">
                  Hi, <strong className="text-[#F0F4FF]">{currentUser.name}</strong>
                </span>
              </div>
              <button
                onClick={onLogout}
                className="p-1 px-2.5 py-1 text-[10px] text-[#EF4444] bg-[#EF4444]/10 rounded-xl border border-[#EF4444]/20 hover:bg-[#EF4444]/20 font-bold transition-all cursor-pointer font-sans whitespace-nowrap"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onTriggerAuthModal?.("login")}
                className="px-3 py-1 bg-transparent text-[#94A3B8] hover:text-[#F0F4FF] font-semibold text-xs transition-colors cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={() => onTriggerAuthModal?.("signup")}
                className="px-3 py-1.5 rounded-xl bg-[#00D4FF] text-[#0A0F1E] font-bold text-xs hover:bg-[#33DDFF] transition-all cursor-pointer shadow-[0_0_15px_rgba(0,212,255,0.25)] flex items-center gap-1"
              >
                <UserPlus className="h-3.5 w-3.5" /> Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile-only Slide Down Search container */}
      {mobileSearchOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 z-50 bg-[#111827] border-b border-[rgba(255,255,255,0.08)] p-3 animate-page-in shadow-2xl">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#94A3B8]">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search ticker, company profile or sector..."
              value={searchQuery}
              onChange={onSearchChange}
              onFocus={() => setShowSearchResults(searchQuery.trim().length > 0)}
              className="w-full bg-[#1A2235]/90 text-[#F0F4FF] text-xs pl-9 pr-4 py-2 rounded-xl border border-[rgba(255,255,255,0.08)] outline-none focus:border-[#00D4FF]/50 backdrop-blur-md transition-all placeholder-[#4B5563]"
            />
            {showSearchResults && (
              <div 
                className="absolute left-0 right-0 mt-2 bg-[#111827] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto p-1 backdrop-blur-xl"
              >
                {filteredSearchList.length === 0 ? (
                  <div className="text-center py-4 text-xs text-[#94A3B8]/60 font-mono font-bold">
                    No DSE listed symbol match.
                  </div>
                ) : (
                  filteredSearchList.map(item => (
                    <button
                      key={item.symbol}
                      onClick={() => {
                        onSelectSearched(item.symbol);
                        setShowSearchResults(false);
                        setMobileSearchOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-mono rounded-lg hover:bg-[#1A2235] flex justify-between items-center transition-colors text-[#94A3B8] hover:text-[#F0F4FF] min-h-[44px]"
                    >
                      <div className="truncate">
                        <strong className="block text-[#F0F4FF] font-semibold">{item.symbol}</strong>
                        <span className="text-[10px] text-[#94A3B8] font-sans truncate block">{item.name}</span>
                      </div>
                      <div className="text-right ml-4">
                        <span className="text-[12px] font-bold text-[#F0F4FF] block">BDT {item.price || "N/A"}</span>
                        <span className={`text-[9px] font-bold ${
                          (item.changePercent || 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                        }`}>
                          {(item.changePercent || 0) >= 0 ? "+" : ""}{(item.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection diagnostics panel drawer */}
      {showDiagnostics && (
        <div id="dse-diagnostics-panel" className="bg-[#111827] text-slate-300 px-6 py-4 text-xs font-mono border-b border-[rgba(255,255,255,0.08)] transition-all relative z-30">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[#F59E0B] font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <span>⚡ Dhaka Stock Exchange Scraper Diagnostics</span>
                <span className="text-[10px] bg-[#1A2235] text-[#94A3B8] px-2 py-0.5 rounded uppercase font-semibold">Parser Core</span>
              </h3>
              <button 
                onClick={() => setShowDiagnostics(false)} 
                className="text-xs text-[#94A3B8] hover:text-[#F0F4FF]"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[#94A3B8] mt-3">
              <div>
                <span className="text-slate-500">Root Host:</span> <span className="text-[#00D4FF] font-bold break-all">{dseStatus.diagnostics?.baseUrl || "https://dse.com.bd"}</span>
              </div>
              <div>
                <span className="text-slate-500">Selected Path:</span> <span className="text-sky-300 break-all">{dseStatus.diagnostics?.selectedUrl || "Default PHP Map"}</span>
              </div>
              <div>
                <span className="text-slate-500">Active Source:</span> <span className="bg-[#1A2235] px-1.5 py-0.5 rounded text-sky-200 font-bold">{dseStatus.source}</span>
              </div>
              <div>
                <span className="text-slate-500">Scraper Code:</span> <span className="text-[#10B981] font-bold">{dseStatus.diagnostics?.httpStatus || "200 Success"}</span>
              </div>
              <div>
                <span className="text-slate-500">Symbols in Cache:</span> <span className="text-amber-400 font-bold">{dseStatus.cachedSymbols} companies</span>
              </div>
              <div>
                <span className="text-slate-500">Last Synced On:</span> <span className="text-slate-200">{dseStatus.lastSuccessfulSync ? new Date(dseStatus.lastSuccessfulSync).toLocaleString() : "Never"}</span>
              </div>
              
              <div className="md:col-span-3 mt-1.5 pt-1.5 border-t border-[rgba(255,255,255,0.06)]">
                <span className="text-slate-500">Status Logs:</span> <span className="text-amber-200 italic">"{dseStatus.message}"</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
