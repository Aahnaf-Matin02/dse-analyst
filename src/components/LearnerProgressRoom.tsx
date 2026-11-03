import React from "react";
import { Award, BookOpen, BrainCircuit, CheckCircle2, TrendingUp, Compass, ArrowUpRight } from "lucide-react";
import { useI18n } from "../i18n/context";

interface Props {
  onNavigateToLearn?: () => void;
  onNavigateToExplore?: () => void;
}

export const LearnerProgressRoom: React.FC<Props> = ({ onNavigateToLearn, onNavigateToExplore }) => {
  const { t } = useI18n();

  return (
    <div className="bg-[#111827] border border-white/5 rounded-3xl p-6 space-y-6 shadow-2xl text-slate-200 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-5">
        <div>
          <span className="text-[10px] font-mono text-[#00D4FF] font-black uppercase tracking-widest block mb-1">
            Learning Journey Analytics
          </span>
          <h2 className="text-xl font-display font-black text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            {t.nav.progress}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track your financial literacy milestone completion, quiz scores, and critical reasoning assessment trends.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Modules Completed</span>
          <div className="text-2xl font-mono font-black text-emerald-400 mt-1">3 / 8</div>
          <span className="text-[10px] text-slate-400 mt-1 block">DSE Basics & Financial Statements</span>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Cases Explored</span>
          <div className="text-2xl font-mono font-black text-[#00D4FF] mt-1">4 Companies</div>
          <span className="text-[10px] text-slate-400 mt-1 block">BSRM, GP, BRAC Bank, Marico</span>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Reasoning Score</span>
          <div className="text-2xl font-mono font-black text-violet-400 mt-1">3.4 / 4.0</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Rubric average across 7 dimensions</span>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Simulation Portfolio</span>
          <div className="text-2xl font-mono font-black text-amber-400 mt-1">৳1,000,000</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Virtual learning capital</span>
        </div>
      </div>

      {/* Core Competencies Matrix */}
      <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-[#00D4FF]" />
          7-Dimension Reasoning Competency Matrix
        </h3>
        
        <div className="space-y-3">
          {[
            { name: "1. Claim Validity", score: 85, level: "Proficient (3/4)", desc: "Distinguishes factual business drivers from speculation." },
            { name: "2. Evidence Quality", score: 75, level: "Competent (3/4)", desc: "Cites audited DSE filings and verifiable metric history." },
            { name: "3. Metric Interpretation", score: 90, level: "Exemplary (4/4)", desc: "Understands P/E, ROE, and margin nuances across sectors." },
            { name: "4. Risk Identification", score: 70, level: "Competent (3/4)", desc: "Evaluates debt servicing and operating cash flow hazards." },
            { name: "5. Logical Consistency", score: 80, level: "Proficient (3/4)", desc: "Reasoning aligns without internal contradictions." },
            { name: "6. Benchmark Comparison", score: 65, level: "Developing (2/4)", desc: "Comparing metrics against sector peers rather than arbitrary numbers." },
            { name: "7. Conclusion-to-Evidence", score: 85, level: "Proficient (3/4)", desc: "Synthesis follows directly from audited data points." }
          ].map((dim, idx) => (
            <div key={idx} className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/60 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 block">{dim.name}</span>
                <span className="text-[10px] text-slate-400 font-sans block">{dim.desc}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00D4FF] rounded-full" style={{ width: `${dim.score}%` }}></div>
                </div>
                <span className="text-[10.5px] font-mono font-bold text-slate-300 w-28 text-right">{dim.level}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LearnerProgressRoom;
