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
      label: isBangla ? "উৎস তথ্য" : "Data",
      sublabel: source ? (asOf ? `${source} (${asOf})` : source) : "DSE Official / Audited Filings",
      icon: Database,
      badgeStyle: "text-sky-200 border-sky-400/40"
    },
    calculation: {
      label: isBangla ? "গণনা" : "Calculation",
      sublabel: formula || (isBangla ? "গাণিতিক সূত্র" : "Standard formula"),
      icon: Calculator,
      badgeStyle: "text-emerald-200 border-emerald-400/40"
    },
    interpretation: {
      label: isBangla ? "ব্যাখ্যা" : "Interpretation",
      sublabel: method || (isBangla ? "নিয়মভিত্তিক / এআই বিশ্লেষণ" : "Rule-based / AI model"),
      icon: Sparkles,
      badgeStyle: "text-violet-200 border-violet-400/40"
    },
    illustrative: {
      label: isBangla ? "দৃষ্টান্তমূলক" : "Illustrative",
      sublabel: isBangla ? "শিক্ষামূলক ধারণা কেবল" : "Educational concept only",
      icon: BookOpen,
      badgeStyle: "text-amber-200 border-amber-400/40"
    }
  };

  const current = configs[type];
  const Icon = current.icon;
  const sizeClasses = size === "md" ? "text-sm px-2.5 py-1" : "text-xs px-2 py-0.5";
  const iconSize = size === "md" ? "w-3.5 h-3.5" : size === "sm" ? "w-3 h-3" : "w-2.5 h-2.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border bg-transparent cursor-help ${current.badgeStyle} ${sizeClasses} ${className}`}
      title={`${current.label}: ${current.sublabel}`}
    >
      <Icon className={`${iconSize} shrink-0`} />
      <span>{current.label}</span>
      {source && <span className="opacity-75 font-normal normal-case hidden sm:inline">• {source}</span>}
      {formula && <span className="opacity-75 font-normal normal-case hidden sm:inline">• {formula}</span>}
    </span>
  );
};

/** One shared explanation of the badges used across the app. */
export const BadgeLegend: React.FC<{ className?: string }> = ({ className = "" }) => (
  <dl className={`grid gap-3 sm:grid-cols-2 ${className}`}>
    <div className="flex gap-3 items-start"><dt><SourceDataBadge type="source" size="sm" /></dt><dd className="text-sm text-[var(--text-muted)]">A number reported by DSE or a company filing, shown as received.</dd></div>
    <div className="flex gap-3 items-start"><dt><SourceDataBadge type="calculation" size="sm" /></dt><dd className="text-sm text-[var(--text-muted)]">Worked out by this app from reported data with a standard formula (e.g. P/E = price ÷ EPS).</dd></div>
    <div className="flex gap-3 items-start"><dt><SourceDataBadge type="interpretation" size="sm" /></dt><dd className="text-sm text-[var(--text-muted)]">An opinion from rules or an AI model. Useful for learning — not investment advice.</dd></div>
    <div className="flex gap-3 items-start"><dt><SourceDataBadge type="illustrative" size="sm" /></dt><dd className="text-sm text-[var(--text-muted)]">A teaching example or simulation, not real market data.</dd></div>
  </dl>
);
