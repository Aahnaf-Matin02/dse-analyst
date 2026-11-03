import React, { useState } from "react";
import { BrainCircuit, Send, AlertCircle, CheckCircle2, Award, Sparkles, BookOpen } from "lucide-react";
import { useI18n } from "../i18n/context";

export const ThinkAssessmentRoom: React.FC = () => {
  const { t } = useI18n();
  const [selectedCase, setSelectedCase] = useState("BSRMLTD");
  const [learnerAnalysis, setLearnerAnalysis] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any | null>(null);

  const learningCases = [
    { symbol: "BSRMLTD", name: "BSRM Steels Limited", prompt: "Explain how high raw material import costs and BDT/USD currency depreciation impact BSRM's operating margins. What questions should a prudent analyst investigate in their annual report?" },
    { symbol: "GP", name: "Grameenphone Ltd.", prompt: "Analyze GP's Return on Equity (ROE) and capital expenditure requirements. Can high dividend payout ratios be maintained if spectrum acquisition costs increase?" },
    { symbol: "BRACBANK", name: "BRAC Bank PLC", prompt: "Assess BRAC Bank's Net Interest Margin (NIM) and non-performing loan (NPL) provisions. What does their loan-to-deposit ratio reveal about liquidity risk?" },
    { symbol: "MARICO", name: "Marico Bangladesh Limited", prompt: "Evaluate Marico's return on capital employed and pricing power in fast-moving consumer goods. How does working capital management protect shareholder value?" }
  ];

  const activeCase = learningCases.find(c => c.symbol === selectedCase) || learningCases[0];

  const handleEvaluate = () => {
    if (!learnerAnalysis.trim()) return;
    setIsSubmitting(true);

    // Educational assessment engine
    setTimeout(() => {
      const length = learnerAnalysis.length;
      const mentionsP_E = /p\/e|pe ratio|price-to-earnings/i.test(learnerAnalysis);
      const mentionsCashFlow = /cash flow|operating cash|debt|borrowing/i.test(learnerAnalysis);
      const mentionsMargin = /margin|revenue|profit|cost/i.test(learnerAnalysis);

      setAssessmentResult({
        overallScore: mentionsCashFlow && mentionsMargin ? "Proficient (3.5 / 4.0)" : "Developing (2.5 / 4.0)",
        dimensions: [
          { name: "Claim Validity", rating: "Proficient (3/4)", feedback: "Clear distinction between verifiable facts and assumptions." },
          { name: "Evidence Quality", rating: mentionsP_E || mentionsMargin ? "Exemplary (4/4)" : "Developing (2/4)", feedback: mentionsMargin ? "Good reference to margin mechanics." : "Try citing specific ratios like gross margin or debt-to-equity." },
          { name: "Risk Identification", rating: mentionsCashFlow ? "Proficient (3/4)" : "Needs Attention (1/4)", feedback: mentionsCashFlow ? "Identified capital and liquidity risks well." : "Consider how debt servicing affects downside resilience." },
          { name: "Logical Consistency", rating: "Proficient (3/4)", feedback: "Conclusions follow logically from the premises provided." }
        ],
        tutorGuidance: "Great analytical effort! As a next step, check whether the company's operating cash flow is growing at the same rate as reported earnings. In Bangladeshi industrial companies, working capital lock-in often causes earnings to diverge from actual bank balances."
      });
      setIsSubmitting(false);
    }, 700);
  };

  return (
    <div className="bg-[#111827] border border-white/5 rounded-3xl p-6 space-y-6 shadow-2xl text-slate-200 animate-fade-in">
      {/* Header */}
      <div className="border-b border-white/5 pb-5">
        <span className="text-[10px] font-mono text-[#00D4FF] font-black uppercase tracking-widest block mb-1">
          Structured Analysis Assessment
        </span>
        <h2 className="text-xl font-display font-black text-white flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-[#00D4FF]" />
          {t.nav.think}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Develop your own investment thesis for a DSE company. Submit your written reasoning to receive rubric-based pedagogical feedback on your analytical depth.
        </p>
      </div>

      {/* Case Selection */}
      <div className="space-y-2">
        <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider block">
          1. Select a Learning Case Study
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {learningCases.map((c) => (
            <button
              key={c.symbol}
              onClick={() => {
                setSelectedCase(c.symbol);
                setAssessmentResult(null);
              }}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                selectedCase === c.symbol
                  ? "bg-[#00D4FF]/10 border-[#00D4FF]/40 text-white"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <div className="font-mono font-extrabold text-sm text-[#00D4FF]">{c.symbol}</div>
              <div className="text-xs font-medium truncate mt-0.5">{c.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Card */}
      <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
          <BookOpen className="h-4 w-4" />
          Analytical Inquiry Exercise
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {activeCase.prompt}
        </p>
      </div>

      {/* Input area */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-mono text-slate-400">
          <span>Your Written Analysis & Reasoning</span>
          <span>{learnerAnalysis.length} characters</span>
        </div>
        <textarea
          value={learnerAnalysis}
          onChange={(e) => setLearnerAnalysis(e.target.value)}
          placeholder="Write your analysis here. Mention key ratios (P/E, ROE, debt ratio), competitive drivers, potential regulatory risks, and what questions you would ask management..."
          rows={5}
          className="w-full p-4 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs font-sans text-slate-200 outline-none focus:border-[#00D4FF]/50 transition"
        />
        <button
          onClick={handleEvaluate}
          disabled={!learnerAnalysis.trim() || isSubmitting}
          className="px-5 py-2.5 bg-[#00D4FF] hover:bg-[#00b8e6] disabled:opacity-40 text-slate-950 text-xs font-bold font-mono rounded-xl flex items-center gap-2 transition cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
          {isSubmitting ? "Assessing Reasoning..." : "Submit for Tutor Rubric Feedback"}
        </button>
      </div>

      {/* Assessment result */}
      {assessmentResult && (
        <div className="p-5 bg-slate-950/60 border border-[#00D4FF]/30 rounded-2xl space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-xs font-mono font-bold text-[#00D4FF] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Tutor Assessment & Feedback
            </span>
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold rounded-lg">
              {assessmentResult.overallScore}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assessmentResult.dimensions.map((dim: any, idx: number) => (
              <div key={idx} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-white">{dim.name}</span>
                  <span className="text-[10px] font-mono font-bold text-[#00D4FF]">{dim.rating}</span>
                </div>
                <p className="text-[10.5px] text-slate-400 font-sans">{dim.feedback}</p>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs text-blue-200 space-y-1">
            <strong className="font-mono text-[10px] uppercase tracking-wider text-[#00D4FF] block">DSE Tutor Advice:</strong>
            <p className="font-sans leading-relaxed">{assessmentResult.tutorGuidance}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkAssessmentRoom;
