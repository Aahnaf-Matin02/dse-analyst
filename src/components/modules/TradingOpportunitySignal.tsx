import React, { useState, useEffect } from "react";
import { TradingSignalResult } from "../../types";
import { Activity, RefreshCw, HelpCircle, AlertCircle, Search } from "lucide-react";
import { SourceDataBadge } from "../SourceDataBadge";
import { useI18n } from "../../i18n/context";

interface Props {
  symbol: string;
}

export const TradingOpportunitySignal: React.FC<Props> = ({ symbol }) => {
  const { t, isBangla } = useI18n();
  const [data, setData] = useState<TradingSignalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignal = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/signals/trading/${symbol}`);
      if (!res.ok) {
        throw new Error("Failed to load indicator alignment.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignal();
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center min-h-[220px]">
        <RefreshCw className="animate-spin text-emerald-500 h-8 w-8 mb-2" />
        <span className="text-slate-400 font-mono text-sm">
          {isBangla ? "সূচক ও গতিশীলতা বিশ্লেষণ করা হচ্ছে..." : "Analyzing indicator momentum..."}
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center">
        <span className="text-red-400 font-mono text-sm">
          {isBangla ? "সূচক বিশ্লেষণ লোড করা সম্ভব হয়নি" : "Failed to generate indicator analysis"}
        </span>
      </div>
    );
  }

  // Define signal colors without buy/sell framing
  const getSignalBadgeStyle = (sig: string) => {
    const s = sig.toUpperCase();
    if (s.includes("STRONG POSITIVE")) return { bg: "bg-emerald-950", text: "text-emerald-400", border: "border-emerald-500/30" };
    if (s.includes("POSITIVE")) return { bg: "bg-teal-950", text: "text-teal-400", border: "border-teal-500/30" };
    if (s.includes("NEGATIVE") || s.includes("DOWNSIDE")) return { bg: "bg-rose-950/40", text: "text-rose-400", border: "border-rose-500/20" };
    return { bg: "bg-amber-950/45", text: "text-amber-400", border: "border-amber-500/30" };
  };

  const currentConf = getSignalBadgeStyle(data.signal);

  const getSubScoreColor = (val: number) => {
    if (val > 0) return "text-emerald-400";
    if (val < 0) return "text-rose-400";
    return "text-slate-400";
  };

  const markerPerc = Math.max(0, Math.min(100, ((data.score + 10) / 20) * 100));

  return (
    <div id="trading-opportunity-module" className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-sans font-medium text-slate-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              {isBangla ? "সমন্বিত সূচক সারিবদ্ধতা" : "Composite Indicator Alignment"}
            </h4>
            <SourceDataBadge type="calculation" formula="RSI + SMA20/50 + Volume + P/E sum" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isBangla
              ? "শিক্ষামূলক প্রযুক্তিগত ও মৌলিক নির্দেশক সমূহের ভারসাম্য বিশ্লেষণ"
              : "Educational indicator alignment comparing technical, fundamental, and volume metrics"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-slate-800 px-2 py-1 text-slate-400 rounded">
            {isBangla ? "তথ্য বিশ্বাসযোগ্যতা:" : "Data Confidence:"} <b className="text-emerald-400">{data.confidence}%</b>
          </span>
          <button 
            onClick={fetchSignal} 
            className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Recalculate indicator metrics"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Signal Display */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="col-span-1 md:col-span-5 flex flex-col items-center justify-center text-center p-4 border border-slate-800 rounded-lg bg-slate-950/40">
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">
            {isBangla ? "নির্দেশক প্রোফাইল" : "INDICATOR PROFILE"}
          </span>
          <span className={`text-sm md:text-base font-bold tracking-tight px-3 py-1.5 rounded border mt-2 text-center ${currentConf.bg} ${currentConf.text} ${currentConf.border}`}>
            {data.signal}
          </span>
          <span className="text-xs text-slate-400 mt-3 font-mono">
            {isBangla ? "মোট সূচক মান:" : "Indicator Balance Score:"} <b className="text-slate-200">{data.score > 0 ? `+${data.score}` : data.score} / 10</b>
          </span>
        </div>

        {/* Dynamic Score bar slider */}
        <div className="col-span-1 md:col-span-7 space-y-3">
          <span className="text-xs text-slate-400 font-mono">
            {isBangla ? "সূচক ভারসাম্য স্কেল (-১০ থেকে +১০)" : "INDICATOR MOMENTUM SCALE (-10 to +10)"}
          </span>
          <div className="relative pt-6">
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1.5 absolute top-0 w-full">
              <span>{isBangla ? "নেতিবাচক (-১০)" : "Negative Bias (-10)"}</span>
              <span>{isBangla ? "নিরপেক্ষ (০)" : "Neutral (0)"}</span>
              <span>{isBangla ? "ইতিবাচক (+১০)" : "Positive Bias (+10)"}</span>
            </div>
            
            <div className="h-2.5 bg-slate-800 rounded-full relative overflow-visible border border-slate-700">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600"></div>
              <div 
                className="absolute h-5 w-5 bg-emerald-400 border-2 border-slate-900 rounded-full shadow-lg shadow-emerald-500/20 -top-1.5 -ml-2.5 transition-all duration-500"
                style={{ left: `${markerPerc}%` }}
              ></div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed pt-2">
            {isBangla
              ? "শিক্ষামূলক তথ্য: ধনাত্মক মান নির্দেশ করে প্রযুক্তিগত ও ভ্যালুয়েশন সূচকে স্থিতিশীল গতি, ঋণাত্মক মান নির্দেশ করে সংবেদনশীল চাপ।"
              : "Educational notice: Positive values indicate technical stability and value alignment; negative values indicate elevated risk divergence."}
          </p>
        </div>
      </div>

      {/* 3 Pedagogical Boxes: What it shows / What it cannot tell you / Questions to investigate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-800 pt-4">
        <div className="bg-sky-950/20 border border-sky-500/20 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-sky-400 font-medium text-xs">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>{t.educational.whatItShows}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {data.whatItShows?.[0] || (isBangla 
              ? "চলতি মুভিং এভারেজ এবং আরএসআই মোমেন্টামের গাণিতিক অবস্থান।" 
              : "Mathematical alignment of moving averages and RSI momentum.")}
          </p>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-400 font-medium text-xs">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{t.educational.whatItCannotTellYou}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {data.whatItCannotTellYou?.[0] || (isBangla 
              ? "ভবিষ্যতে দর কোন দিকে যাবে বা হঠাৎ নিয়ন্ত্রক সিদ্ধান্তে কী ঘটবে তা নিশ্চিত করে না।" 
              : "Cannot predict future price direction or upcoming regulatory policy changes.")}
          </p>
        </div>

        <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-purple-400 font-medium text-xs">
            <Search className="h-3.5 w-3.5" />
            <span>{t.educational.questionsToInvestigate}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {data.questionsToInvestigate?.[0] || (isBangla 
              ? "কোম্পানির মুনাফা কি নিয়মিত ব্যবসায়িক কার্যক্রম থেকে আসছে নাকি এককালীন বিক্রি থেকে?" 
              : "Is reported net profit derived from core operational business or one-off assets?")}
          </p>
        </div>
      </div>

      {/* Contributing Factors reasoning list */}
      <div className="space-y-3 border-t border-slate-800 pt-4">
        <span className="text-xs text-slate-400 font-mono flex items-center justify-between">
          <span>{isBangla ? "সূচকে অবদানকারী উপাদানসমূহ" : "FACTORS CONTRIBUTING TO CALCULATION"}</span>
          <SourceDataBadge type="source" source="DSE / Verified Indicators" />
        </span>
        <ul className="space-y-2 text-xs">
          {data.reasoning.map((item, idx) => {
            const keys = Object.keys(data.subScores);
            const val = data.subScores[keys[idx]] ?? 0;
            const textClass = getSubScoreColor(val);

            return (
              <li key={idx} className="flex justify-between items-center bg-slate-950/20 p-2.5 rounded border border-slate-800/40">
                <span className="text-slate-300 leading-snug">{item}</span>
                <span className={`font-mono text-[11px] font-semibold ${textClass}`}>
                  {val > 0 ? `+${val}` : val === 0 ? "0" : val}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="text-right">
        <span className="text-[9px] text-slate-600 font-mono">
          {isBangla ? "সর্বশেষ হালনাগাদ:" : "Last calculated:"} {new Date(data.generatedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};
