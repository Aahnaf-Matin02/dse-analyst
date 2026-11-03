import React from "react";
import { Database, Calculator, Sparkles, BookOpen } from "lucide-react";
import { useI18n } from "../i18n/context";

export type MetricType = "source" | "calculation" | "interpretation" | "illustrative";

interface SourceDataBadgeProps {
  type: MetricType;
  source?: string;
  asOf?: string;
  formula?: string;
  method?: string;
  className?: string;
  size?: "xs" | "sm" | "md";
}

export const SourceDataBadge: React.FC<SourceDataBadgeProps> = ({
  type,
  source,
  asOf,
  formula,
  method,
  className = "",
  size = "xs"
}) => {
  const { t, isBangla } = useI18n();

  const configs = {
    source: {
      label: isBangla ? "উৎস তথ্য (DATA)" : "DATA",
      sublabel: source ? (asOf ? `${source} (${asOf})` : source) : "DSE Official / Audited Filings",
      icon: Database,
      badgeStyle: "bg-sky-500/15 text-sky-300 border-sky-500/35 hover:bg-sky-500/25 shadow-sm"
    },
    calculation: {
      label: isBangla ? "গণনা (CALCULATION)" : "CALCULATION",
      sublabel: formula || (isBangla ? "গাণিতিক সূত্র" : "Standard formula"),
      icon: Calculator,
      badgeStyle: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25 shadow-sm"
    },
    interpretation: {
      label: isBangla ? "ব্যাখ্যা (INTERPRETATION)" : "INTERPRETATION",
      sublabel: method || (isBangla ? "নিয়মভিত্তিক / এআই বিশ্লেষণ" : "Rule-based / AI model"),
      icon: Sparkles,
      badgeStyle: "bg-purple-500/15 text-purple-300 border-purple-500/35 hover:bg-purple-500/25 shadow-sm"
    },
    illustrative: {
      label: isBangla ? "দৃষ্টান্তমূলক" : "ILLUSTRATIVE",
      sublabel: isBangla ? "শিক্ষামূলক ধারণা কেবল" : "Educational concept only",
      icon: BookOpen,
      badgeStyle: "bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25 shadow-sm"
    }
  };

  const current = configs[type];
  const Icon = current.icon;
  const sizeClasses = size === "md" 
    ? "text-[11px] px-2.5 py-1" 
    : size === "sm" 
      ? "text-[10px] px-2 py-0.5" 
      : "text-[9px] px-1.5 py-0.5";
  const iconSize = size === "md" ? "w-3.5 h-3.5" : size === "sm" ? "w-3 h-3" : "w-2.5 h-2.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider rounded-lg border transition-colors cursor-help ${current.badgeStyle} ${sizeClasses} ${className}`}
      title={`${current.label}: ${current.sublabel}`}
    >
      <Icon className={`${iconSize} shrink-0`} />
      <span>{current.label}</span>
      {source && <span className="opacity-75 font-normal normal-case hidden sm:inline">• {source}</span>}
      {formula && <span className="opacity-75 font-normal normal-case hidden sm:inline">• {formula}</span>}
    </span>
  );
};
