import React, { useState } from "react";
import { ShieldAlert, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "../i18n/context";

interface Props {
  compact?: boolean;
}

export const GlobalDisclaimer: React.FC<Props> = ({ compact = false }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  if (compact) {
    return (
      <div 
        id="global-educational-disclaimer" 
        className="w-full bg-amber-500/10 border-y border-amber-500/20 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-200"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="font-medium tracking-wide">
            {t.disclaimer.text}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-amber-400 hover:text-amber-200 underline flex items-center gap-0.5 ml-2 shrink-0 cursor-pointer"
        >
          {expanded ? "সংক্ষিপ্ত" : "বিস্তারিত"}
        </button>
      </div>
    );
  }

  return (
    <div 
      id="global-educational-disclaimer" 
      className="w-full bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-amber-950/40 border border-amber-500/25 rounded-2xl p-3.5 mb-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-amber-500/15 rounded-lg border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase rounded-md tracking-wider border border-amber-500/30">
                {t.disclaimer.badge}
              </span>
              <span className="text-xs font-semibold text-amber-100">
                {t.disclaimer.text}
              </span>
            </div>
            {expanded && (
              <p className="text-[11px] text-slate-300 leading-relaxed mt-2 pt-2 border-t border-white/5">
                {t.disclaimer.full}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded transition shrink-0"
          title={expanded ? "Collapse" : "Expand full disclosure"}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
};
