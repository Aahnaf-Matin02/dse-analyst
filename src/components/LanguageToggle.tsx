import React from "react";
import { Languages } from "lucide-react";
import { useI18n } from "../i18n/context";

export const LanguageToggle: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { language, setLanguage } = useI18n();

  return (
    <div className={`inline-flex items-center bg-[#1A2235] border border-white/10 rounded-xl p-0.5 text-xs font-mono select-none ${className}`}>
      <button
        type="button"
        onClick={() => setLanguage("bn")}
        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
          language === "bn"
            ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30 shadow-sm"
            : "text-[#94A3B8] hover:text-[#F0F4FF]"
        }`}
        title="বাংলা ভাষা নির্বাচন করুন"
      >
        বাংলা
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
          language === "en"
            ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30 shadow-sm"
            : "text-[#94A3B8] hover:text-[#F0F4FF]"
        }`}
        title="Select English language"
      >
        English
      </button>
    </div>
  );
};

export default LanguageToggle;
