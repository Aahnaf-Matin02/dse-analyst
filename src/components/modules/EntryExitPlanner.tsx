import React, { useState, useEffect } from "react";
import { EntryExitPlan } from "../../types";
import { Compass, RefreshCw, HelpCircle, AlertCircle, Search } from "lucide-react";
import { SourceDataBadge } from "../SourceDataBadge";
import { useI18n } from "../../i18n/context";

interface Props {
  symbol: string;
}

export const EntryExitPlanner: React.FC<Props> = ({ symbol }) => {
  const { t, isBangla } = useI18n();
  const [data, setData] = useState<EntryExitPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/signals/entry-exit/${symbol}`);
      if (!res.ok) {
        throw new Error("Failed to load reference levels.");
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
    fetchPlan();
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center min-h-[220px]">
        <RefreshCw className="animate-spin text-teal-500 h-8 w-8 mb-2" />
        <span className="text-slate-400 font-mono text-sm">
          {isBangla ? "প্রযুক্তিগত রেফারেন্স ব্যান্ড গণনা করা হচ্ছে..." : "Calculating technical reference corridors..."}
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center">
        <span className="text-red-400 font-mono text-sm">
          {isBangla ? "রেফারেন্স ব্যান্ড লোড করা সম্ভব হয়নি" : "Failed to generate reference bands"}
        </span>
      </div>
    );
  }

  return (
    <div id="entry-exit-planner-module" className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-sans font-medium text-slate-100 flex items-center gap-2">
              <Compass className="h-4 w-4 text-teal-400" />
              {isBangla ? "প্রযুক্তিগত রেফারেন্স ব্যান্ড ও ভোলাটিলিটি করিডোর" : "Technical Reference Bands & Volatility Corridors"}
            </h4>
            <SourceDataBadge type="calculation" formula="Pivot Points (R1/R2/S1/S2) + ATR(14)" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isBangla
              ? `ঐতিহাসিক অস্থিরতার উপর ভিত্তি করে হিসাবকৃত সহায়তা ও বাধার মাত্রা (ATR 14D: ৳${data.atr})`
              : `Mathematical support and resistance channels scaled by price volatility (ATR 14D: ৳${data.atr})`}
          </p>
        </div>
        <button 
          onClick={fetchPlan}
          className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200 cursor-pointer"
          title="Recalculate planner"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Visual pricing ladder/map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left side: Price ladder list */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-mono">
              {isBangla ? "গাণিতিক মূল্য সোপান (BDT)" : "MATHEMATICAL PRICE LADDER (BDT)"}
            </span>
            <SourceDataBadge type="source" source="DSE Daily Settlement History" />
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/20 divide-y divide-slate-800/40">
            
            {/* STRETCH */}
            {data.targets.stretch && (
              <div className="flex justify-between items-center p-3 hover:bg-slate-850/20">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  {isBangla ? "সর্বোচ্চ পরিসীমা (৫২ সপ্তাহের সর্বোচ্চ)" : "Upper Range Boundary (52W High)"}
                </span>
                <span className="text-xs font-semibold text-emerald-400 font-mono">৳{data.targets.stretch}</span>
              </div>
            )}

            {/* RESISTANCE 3 */}
            <div className="flex justify-between items-center p-3 hover:bg-slate-850/20">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80"></span>
                {isBangla ? "উচ্চতর বলিঙ্গার ব্যান্ড সীমা" : "Upper Bollinger Band Corridor"}
              </span>
              <span className="text-xs font-semibold text-emerald-400/80 font-mono">৳{data.targets.t3}</span>
            </div>

            {/* RESISTANCE 2 */}
            <div className="flex justify-between items-center p-3 hover:bg-slate-850/20">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60"></span>
                {isBangla ? "দ্বিতীয় প্রতিরোধ মাত্রা (R2)" : "Second Mathematical Resistance (R2)"}
              </span>
              <span className="text-xs font-semibold text-emerald-400/60 font-mono">৳{data.targets.t2}</span>
            </div>

            {/* RESISTANCE 1 */}
            <div className="flex justify-between items-center p-3 hover:bg-slate-850/20 bg-emerald-950/5">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/40"></span>
                {isBangla ? "প্রথম প্রতিরোধ মাত্রা (R1)" : "First Mathematical Resistance (R1)"}
              </span>
              <span className="text-xs font-semibold text-emerald-500/70 font-mono">৳{data.targets.t1}</span>
            </div>

            {/* CURRENT PRICE */}
            <div className="flex justify-between items-center p-3 bg-slate-800/40">
              <span className="text-xs text-slate-200 font-bold font-mono">
                {isBangla ? "বর্তমান বাজার দর (LTP)" : "Current Market Quote (LTP)"}
              </span>
              <span className="text-xs font-bold text-slate-100 font-mono bg-slate-700 px-2 py-0.5 rounded">৳{data.currentPrice}</span>
            </div>

            {/* SUPPORT S1 */}
            <div className="flex justify-between items-center p-3 hover:bg-slate-850/20 bg-teal-950/5">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400/80"></span>
                {isBangla ? "প্রাথমিক সমর্থন সীমা (S1)" : "Primary Pivot Support (S1)"}
              </span>
              <span className="text-xs font-semibold text-teal-400 font-mono">৳{data.entryZone.aggressive}</span>
            </div>

            {/* SUPPORT S2 */}
            <div className="flex justify-between items-center p-3 hover:bg-slate-850/20 bg-teal-950/10">
              <span className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                {isBangla ? "দ্বিতীয় সমর্থন এলাকা (S2)" : "Secondary Pivot Support (S2)"}
              </span>
              <span className="text-xs font-bold text-teal-300 font-mono">৳{data.entryZone.conservative}</span>
            </div>

            {/* DOWNSIDE THRESHOLD 1 */}
            <div className="flex justify-between items-center p-3 hover:bg-slate-850/20">
              <span className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500/40"></span>
                {isBangla ? "নিচের ভোলাটিলিটি সীমা (১.৫x ATR)" : "Downside Volatility Boundary (1.5x ATR)"}
              </span>
              <span className="text-xs font-medium text-rose-500/60 font-mono">৳{data.stopLoss.tight}</span>
            </div>

            {/* DOWNSIDE THRESHOLD 2 */}
            <div className="flex justify-between items-center p-3 hover:bg-slate-850/20">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500/70"></span>
                {isBangla ? "সাধারণ বিচ্যুতি সীমা (২.০x ATR)" : "Standard Deviation Floor (2.0x ATR)"}
              </span>
              <span className="text-xs font-semibold text-rose-400/80 font-mono">৳{data.stopLoss.normal}</span>
            </div>

            {/* DOWNSIDE THRESHOLD 3 */}
            <div className="flex justify-between items-center p-3 hover:bg-slate-850/20 bg-rose-950/5">
              <span className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                {isBangla ? "প্রসারিত নিম্ন সীমা (৩.০x ATR)" : "Extended Tail Risk Floor (3.0x ATR)"}
              </span>
              <span className="text-xs font-bold text-rose-400 font-mono">৳{data.stopLoss.wide}</span>
            </div>

          </div>
        </div>

        {/* Right side: Educational interpretation */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-lg space-y-3">
            <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">
              {isBangla ? "করিডোর ব্যাখ্যার কাঠামো" : "CORRIDOR INTERPRETATION FRAMEWORK"}
            </span>

            <div className="space-y-2 text-xs">
              <div className="bg-sky-950/20 border border-sky-500/20 rounded p-2.5">
                <div className="flex items-center gap-1.5 text-sky-400 font-semibold mb-1">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>{t.educational.whatItShows}</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isBangla
                    ? "গাণিতিক পিভট সূত্র পূর্ববর্তী ট্রেডিং সেশনের উচ্চ, নিম্ন এবং সমাপনী দরের গড় দিয়ে ঐতিহাসিক বাধার স্তর চিহ্নিত করে।"
                    : "Mathematical pivot formulas compute historical turning points using previous high, low, and closing values."}
                </p>
              </div>

              <div className="bg-amber-950/20 border border-amber-500/20 rounded p-2.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{t.educational.whatItCannotTellYou}</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isBangla
                    ? "দর কখনো এই ব্যান্ডে পৌঁছাবে কিনা তা নিশ্চিত করা যায় না। ফ্লোর প্রাইস বা হঠাৎ ট্রেডিং স্থগিতের মতো ঘটনায় এই মডেল প্রযোজ্য নয়।"
                    : "Cannot guarantee price arrival at these boundaries. Circuit breakers, trading halts, or liquidity dry-ups violate model assumptions."}
                </p>
              </div>

              <div className="bg-purple-950/20 border border-purple-500/20 rounded p-2.5">
                <div className="flex items-center gap-1.5 text-purple-400 font-semibold mb-1">
                  <Search className="h-3.5 w-3.5" />
                  <span>{t.educational.questionsToInvestigate}</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {isBangla
                    ? "বাধা লেভেলে পৌঁছালে কি বিক্রির চাপ বাড়ছে নাকি প্রাতিষ্ঠানিক ক্রেতারা শেয়ার ধরে রাখছেন?"
                    : "When price approaches resistance levels, does sell-side order volume spike, or do institutional holders absorb supply?"}
                </p>
              </div>
            </div>
          </div>

          {/* Notes display */}
          <div className="bg-slate-900/20 p-4 border border-dashed border-slate-800 rounded-lg space-y-2">
            <span className="text-xs text-slate-500 font-mono">
              {isBangla ? "প্রযুক্তিগত পর্যবেক্ষণ নোট" : "TECHNICAL OBSERVATION NOTES"}
            </span>
            <ul className="space-y-1.5">
              {data.notes.map((note, idx) => (
                <li key={idx} className="text-xs text-slate-400 leading-normal pl-4 relative">
                  <span className="absolute left-0 text-teal-500">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
};
