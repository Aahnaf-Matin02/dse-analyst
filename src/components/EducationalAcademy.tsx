import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Compass, 
  BrainCircuit, 
  Scale, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  HelpCircle, 
  Search, 
  Award, 
  BookMarked, 
  RotateCcw, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb,
  BookOpenCheck,
  GraduationCap
} from "lucide-react";

interface ArticleSection {
  heading: string;
  body: string;
}

interface GlossaryEntry {
  term: string;
  definition: string;
}

interface Article {
  id: string;
  title: string;
  category: string;
  icon: string;
  readTime: string;
  summary: string;
  sections: ArticleSection[];
  glossary?: GlossaryEntry[];
}

interface FAQ {
  id: string;
  question: string;
  category: string;
  answer: string;
}

interface Quiz {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export default function EducationalAcademy() {
  const [activeTab, setActiveTab] = useState<"articles" | "quizzes" | "faqs">("articles");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dynamic API states
  const [articles, setArticles] = useState<Article[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected article ID
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  
  // Recent Searches track state (rehydrated from client localStorage)
  const [recentItems, setRecentItems] = useState<{ id: string; title: string; type: "article" | "faq" }[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dse_recent_academy_items");
      if (stored) {
        setRecentItems(JSON.parse(stored));
      }
      const storedSearches = localStorage.getItem("dse_recent_academy_searches");
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }
    } catch (e) {}
  }, []);

  const addRecentItem = (id: string, title: string, type: "article" | "faq") => {
    setRecentItems(prev => {
      const filtered = prev.filter(item => !(item.id === id && item.type === type));
      const updated = [{ id, title, type }, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("dse_recent_academy_items", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Debounced search query saver
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3) return;
    const timer = setTimeout(() => {
      const term = searchQuery.trim();
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s.toLowerCase() !== term.toLowerCase());
        const updated = [term, ...filtered].slice(0, 5);
        try {
          localStorage.setItem("dse_recent_academy_searches", JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedArticleId && articles.length > 0) {
      const art = articles.find(a => a.id === selectedArticleId);
      if (art) {
        addRecentItem(art.id, art.title, "article");
      }
    }
  }, [selectedArticleId, articles]);

  // Expanded FAQ IDs
  const [expandedFaqIds, setExpandedFaqIds] = useState<Record<string, boolean>>({});

  // Quiz active answers and status
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedQuizIds, setSubmittedQuizIds] = useState<Record<string, boolean>>({});
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

  // Fetch API content on load
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [articlesRes, faqsRes, quizzesRes] = await Promise.all([
        fetch("/api/education/articles"),
        fetch("/api/education/faqs"),
        fetch("/api/education/quizzes")
      ]);

      if (!articlesRes.ok || !faqsRes.ok || !quizzesRes.ok) {
        throw new Error("One or more educational content requests failed.");
      }

      const articlesData = await articlesRes.json();
      const faqsData = await faqsRes.json();
      const quizzesData = await quizzesRes.json();

      setArticles(articlesData);
      setFaqs(faqsData);
      setQuizzes(quizzesData);
      
      if (articlesData.length > 0) {
        setSelectedArticleId(articlesData[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load academic catalog data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleFaq = (id: string) => {
    setExpandedFaqIds(prev => {
      const nextVal = !prev[id];
      if (nextVal) {
        const item = faqs.find(f => f.id === id);
        if (item) {
          addRecentItem(id, item.question, "faq");
        }
      }
      return {
        ...prev,
        [id]: nextVal
      };
    });
  };

  const handleSelectAnswer = (quizId: string, optionIndex: number) => {
    if (submittedQuizIds[quizId]) return; // locked once submitted
    setSelectedAnswers(prev => ({
      ...prev,
      [quizId]: optionIndex
    }));
  };

  const handleSubmitAnswer = (quizId: string) => {
    const quizItem = quizzes.find(q => q.id === quizId);
    if (!quizItem) return;
    
    const chosen = selectedAnswers[quizId];
    if (chosen === undefined) return;

    setSubmittedQuizIds(prev => ({
      ...prev,
      [quizId]: true
    }));

    if (chosen === quizItem.answerIndex) {
      setQuizScore(prev => ({
        correct: prev.correct + 1,
        total: prev.total + 1
      }));
    } else {
      setQuizScore(prev => ({
        ...prev,
        total: prev.total + 1
      }));
    }
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setSubmittedQuizIds({});
    setQuizScore({ correct: 0, total: 0 });
  };

  // Icon mapping helper
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case "Scale":
        return <Scale className="h-5 w-5 text-indigo-400" />;
      case "Compass":
        return <Compass className="h-5 w-5 text-emerald-400" />;
      case "BrainCircuit":
        return <BrainCircuit className="h-5 w-5 text-blue-450" />;
      default:
        return <BookMarked className="h-5 w-5 text-indigo-400" />;
    }
  };

  // Filters based on search
  const filteredArticles = articles.filter(art => 
    art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuizzes = quizzes.filter(quiz => 
    quiz.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.options.some(opt => opt.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeArticle = articles.find(art => art.id === selectedArticleId);

  return (
    <div className="space-y-6" id="educational-academy-container">
      {/* Academy Header */}
      <div className="bg-[#111827] text-white rounded-3xl p-6 relative overflow-hidden transition-all shadow-lg border border-[rgba(255,255,255,0.08)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <GraduationCap className="h-3 w-3" /> DSE AI Investor Academy
            </span>
            <h2 className="text-2xl font-display font-black tracking-tight text-white leading-tight">
              Empower Assets With Algorithmic Financial Knowledge
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed max-w-xl font-sans">
              Accelerate your financial intelligence. Bridge technical indicators, fundamental valuation ratios, and artificial neural networks to decode the Dhaka Stock Exchange.
            </p>
          </div>
          
          <div className="hidden lg:block shrink-0 bg-[#1A2235]/85 border border-[rgba(255,255,255,0.08)] p-4 rounded-2xl relative overflow-hidden text-right">
            <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black">Platform Coverage</span>
            <span className="block text-xl font-mono font-black text-emerald-400">100% Verified</span>
            <span className="block text-[10px] text-slate-400 font-medium">Fundamental + Auto-ML Envelopes</span>
          </div>
        </div>
      </div>

      {/* Primary Sub-Navigation Row */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-stretch sm:items-center bg-[#111827] p-2 border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm">
        <div className="flex bg-[#1A2235] p-1 rounded-xl border border-[rgba(255,255,255,0.05)] items-center overflow-x-auto gap-1">
          <button
            onClick={() => {
              setActiveTab("articles");
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-sans tracking-tight transition-all cursor-pointer ${
              activeTab === "articles"
                ? "bg-blue-600 text-white shadow"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <span>Tutorial Guides</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("quizzes");
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-sans tracking-tight transition-all cursor-pointer ${
              activeTab === "quizzes"
                ? "bg-blue-600 text-white shadow"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <BookOpenCheck className="h-4 w-4 text-emerald-400" />
            <span>Learning Quizzes</span>
            {quizzes.length > 0 && (
              <span className="bg-emerald-500 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none">
                {quizzes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("faqs");
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-sans tracking-tight transition-all cursor-pointer ${
              activeTab === "faqs"
                ? "bg-blue-600 text-white shadow"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <HelpCircle className="h-4 w-4 text-blue-400" />
            <span>Academic FAQs</span>
          </button>
        </div>

        {/* Global Catalog Search Box */}
        <div className="relative min-w-[200px] md:min-w-[280px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'articles' ? 'tutorial articles' : activeTab === 'quizzes' ? 'active quizzes' : 'learning FAQs'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[rgba(255,255,255,0.08)] rounded-xl text-xs bg-[#1A2235] hover:bg-[#1A2235]/80 focus:bg-[#1A2235]/60 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-[#64748B] font-sans text-white font-semibold"
          />
        </div>
      </div>

      {/* Search History & Previously Read links */}
      {(recentSearches.length > 0 || recentItems.length > 0) && (
        <div className="space-y-3.5 bg-[#111827] border border-[rgba(255,255,255,0.08)] p-3.5 rounded-2xl text-[10px] text-[#94A3B8]" id="academy-search-history-container">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" id="recent-searches">
              <span className="font-mono font-bold tracking-wider uppercase flex items-center gap-1 text-[#64748B] shrink-0 select-none mr-1.5">
                <Search className="h-3.5 w-3.5" /> Recent Searches:
              </span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {recentSearches.map((term, index) => (
                  <button
                    key={`search-${term}-${index}`}
                    onClick={() => {
                      setSearchQuery(term);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold tracking-tight border border-[rgba(255,255,255,0.08)] bg-[#1A2235] hover:bg-[#1A2235]/80 text-[#CBD5E1] hover:text-white transition-all cursor-pointer whitespace-nowrap shadow-sm"
                  >
                    <span>"{term}"</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setRecentSearches([]);
                    try {
                      localStorage.removeItem("dse_recent_academy_searches");
                    } catch (e) {}
                  }}
                  className="text-[10px] font-mono leading-none tracking-tight text-[#64748B] hover:text-rose-400 hover:underline px-1.5 py-1 font-bold cursor-pointer"
                >
                  Clear Searches
                </button>
              </div>
            </div>
          )}

          {/* Recent Reads */}
          {recentItems.length > 0 && (
            <div className={`flex flex-wrap items-center gap-1.5 ${recentSearches.length > 0 ? "border-t border-[rgba(255,255,255,0.05)] pt-2.5" : ""}`} id="recent-reads">
              <span className="font-mono font-bold tracking-wider uppercase flex items-center gap-1 text-[#64748B] shrink-0 select-none mr-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Recent Reads:
              </span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {recentItems.map((item, index) => (
                  <button
                    key={`${item.type}-${item.id}-${index}`}
                    onClick={() => {
                      if (item.type === "article") {
                        setActiveTab("articles");
                        setSelectedArticleId(item.id);
                      } else {
                        setActiveTab("faqs");
                        setExpandedFaqIds(prev => ({ ...prev, [item.id]: true }));
                        setTimeout(() => {
                           const el = document.getElementById(`faq-${item.id}`);
                           if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 100);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-medium tracking-tight border border-[rgba(255,255,255,0.08)] bg-[#1A2235] hover:bg-[#1A2235]/80 text-[#CBD5E1] hover:text-white transition-all cursor-pointer whitespace-nowrap shadow-sm"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${item.type === 'article' ? 'bg-indigo-500' : 'bg-blue-500'}`}></span>
                    <span className="font-sans font-bold">{item.title.length > 40 ? item.title.slice(0, 40) + "..." : item.title}</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setRecentItems([]);
                    try {
                      localStorage.setItem("dse_recent_academy_items", JSON.stringify([]));
                    } catch (e) {}
                  }}
                  className="text-[10px] font-mono leading-none tracking-tight text-[#64748B] hover:text-rose-400 hover:underline px-1.5 py-1 font-bold cursor-pointer"
                >
                  Clear Reads
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Resource Layout Shell */}
      {loading ? (
        <div className="flex justify-center items-center h-64 font-mono text-xs text-indigo-400 animate-pulse">
          Retrieving expert educational materials from database...
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-950/20 border border-rose-800/30 rounded-2xl text-rose-400 text-xs text-center font-mono">
          {error}
        </div>
      ) : (
        <div>
          {/* TAB 1: ARTICLES AND TUTORIALS SECTION */}
          {activeTab === "articles" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Articles Shelf (Left - 4 cols desktop) */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider">Academic Guides</span>
                  <span className="text-[10px] font-mono text-[#64748B] font-semibold">{filteredArticles.length} Loaded</span>
                </div>

                {filteredArticles.length === 0 ? (
                  <div className="p-6 border border-dashed border-[rgba(255,255,255,0.08)] text-[#64748B] rounded-2xl text-center text-xs">
                    No articles matches your query.
                  </div>
                ) : (
                  filteredArticles.map((art) => {
                    const isSelected = art.id === selectedArticleId;
                    return (
                      <div
                        key={art.id}
                        onClick={() => setSelectedArticleId(art.id)}
                        className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left relative overflow-hidden group ${
                          isSelected
                            ? "bg-indigo-950/20 border-indigo-500/30 shadow-sm"
                            : "bg-[#111827] border-[rgba(255,255,255,0.08)] hover:bg-[#1A2235]/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl border shrink-0 ${
                            isSelected ? "bg-[#1A2235] border-indigo-500/30 shadow-sm" : "bg-[#1A2235]/40 border-[rgba(255,255,255,0.05)]"
                          }`}>
                            {getCategoryIcon(art.icon)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block text-[9px] font-mono font-black uppercase text-indigo-400 bg-indigo-550/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                                {art.category}
                              </span>
                              <span className="text-[9px] text-[#64748B] font-mono font-medium">{art.readTime}</span>
                            </div>
                            <h3 className="text-xs font-display font-black text-white leading-snug group-hover:text-amber-400 transition-colors">
                              {art.title}
                            </h3>
                            <p className="text-[10px] text-[#94A3B8] leading-relaxed font-sans line-clamp-2">
                              {art.summary}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reader panel (Right - 8 cols desktop) */}
              <div className="lg:col-span-8">
                {activeArticle ? (
                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.4)] space-y-6">
                    {/* Reader Header */}
                    <div className="pb-5 border-b border-[rgba(255,255,255,0.05)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 text-[9px] font-mono font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 rounded-md">
                            {activeArticle.category.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-semibold">{activeArticle.readTime}</span>
                        </div>
                        <h1 className="text-base md:text-lg font-display font-black tracking-tight text-white leading-snug">
                          {activeArticle.title}
                        </h1>
                      </div>
                      <div className="shrink-0 bg-[#1A2235] p-2 border border-[rgba(255,255,255,0.08)] rounded-xl inline-flex gap-2 items-center">
                        {getCategoryIcon(activeArticle.icon)}
                        <span className="text-[9px] font-mono text-[#CBD5E1] font-bold uppercase tracking-wider">Reference Node</span>
                      </div>
                    </div>

                    {/* Reader Body sections */}
                    <div className="space-y-5">
                      {activeArticle.sections.map((sect, i) => (
                        <div key={i} className="space-y-2">
                          <h2 className="text-xs font-display font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span> {sect.heading}
                          </h2>
                          <p className="text-[11.5px] leading-relaxed text-[#CBD5E1] font-sans tracking-wide">
                            {sect.body}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Integrated Glossary Shelf if available */}
                    {activeArticle.glossary && activeArticle.glossary.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.05)] space-y-3">
                        <div className="flex items-center gap-1.5">
                          <Lightbulb className="h-4 w-4 text-amber-400 animate-pulse" />
                          <h3 className="text-xs font-display font-black text-white uppercase tracking-widest">
                            Glossary Terminology Matrix
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#1A2235]/45 border border-[rgba(255,255,255,0.05)] rounded-2xl p-4">
                          {activeArticle.glossary.map((g, index) => (
                            <div key={index} className="space-y-0.5">
                              <span className="block text-xs font-mono font-bold text-white">{g.term}</span>
                              <p className="text-[10px] leading-relaxed text-[#94A3B8] font-sans">{g.definition}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Standard educational disclaimer */}
                    <div className="mt-6 p-4 bg-blue-950/20 border border-blue-900/30 rounded-2xl flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                      <div className="text-[10px] leading-relaxed text-blue-300 font-sans">
                        <strong>Educational Note:</strong> This content is produced exclusively for educational instruction to assist users modeling and understanding financial analysis metrics. Always conduct independent verification before executing any capital allocation.
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="h-64 bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl flex items-center justify-center font-mono text-xs text-slate-400">
                    Select an academic tutorial from the library shelf first.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: INTERACTIVE LEARNING QUIZZES SECTION */}
          {activeTab === "quizzes" && (
            <div className="space-y-6">
              
              {/* Quiz Summary Stats Card */}
              <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-950/50 border border-emerald-800/40 rounded-2xl shrink-0">
                    <Award className="h-6 w-6 text-emerald-400 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-xs font-display font-black text-white uppercase tracking-widest">Interactive Investor Assessment</h3>
                    <p className="text-[10px] text-[#94A3B8] font-sans mt-0.5 font-semibold">Test your comprehension on relative valuation and market analysis formulas</p>
                  </div>
                </div>

                {/* Score panel */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="block text-[9px] font-mono text-slate-450 uppercase tracking-wider">Overall Score</span>
                    <strong className="block font-mono text-base font-black text-white">
                      {quizScore.correct} / {quizzes.length} ({(quizzes.length > 0 ? (quizScore.correct / quizzes.length) * 100 : 0).toFixed(0)}%)
                    </strong>
                  </div>
                  <button
                    onClick={handleResetQuiz}
                    className="p-2 border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.20)] rounded-xl bg-[#1A2235] hover:bg-[#1A2235]/80 cursor-pointer flex items-center gap-1 text-[10px] font-mono text-[#CBD5E1] transition-all font-bold"
                    title="Initialize verification scores reset"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                    <span>Reset Quiz</span>
                  </button>
                </div>
              </div>

              {filteredQuizzes.length === 0 ? (
                <div className="bg-[#111827] p-12 text-center rounded-3xl border border-[rgba(255,255,255,0.08)] text-[#64748B] font-mono text-xs">
                  No matching assessment modules found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredQuizzes.map((quiz, quizIdx) => {
                    const selected = selectedAnswers[quiz.id];
                    const submitted = submittedQuizIds[quiz.id];
                    const isCorrect = selected === quiz.answerIndex;

                    return (
                      <div 
                        key={quiz.id}
                        className={`bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 shadow-sm flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                          submitted 
                            ? isCorrect 
                              ? "ring-1 ring-emerald-500/40 border-emerald-500/50" 
                              : "ring-1 ring-rose-500/20 border-rose-500/40"
                            : ""
                        }`}
                      >
                        {/* Background subtle accents */}
                        {submitted && (
                          <div className={`absolute right-0 top-0 w-16 h-16 rounded-full blur-xl pointer-events-none ${
                            isCorrect ? "bg-emerald-500/10" : "bg-rose-500/10"
                          }`}></div>
                        )}

                        <div className="space-y-4">
                          {/* Segment Header */}
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-md">
                              QUESTION {quizIdx + 1}
                            </span>
                            {submitted && (
                              <span className={`text-[10px] font-mono font-black uppercase flex items-center gap-1 ${
                                isCorrect ? "text-emerald-400" : "text-rose-450"
                              }`}>
                                {isCorrect ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Correct
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3.5 w-3.5 text-rose-400" /> Incorrect
                                  </>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Question text */}
                          <p className="text-xs font-display font-medium text-white leading-relaxed font-semibold">
                            {quiz.question}
                          </p>

                          {/* Options stack */}
                          <div className="space-y-2">
                            {quiz.options.map((opt, optIndex) => {
                              const isChosenOption = selected === optIndex;
                              const isCorrectAnswerOption = optIndex === quiz.answerIndex;
                              
                              let optionClass = "border-[rgba(255,255,255,0.08)] bg-[#1A2235] hover:bg-[#1A2235]/70 text-[#CBD5E1]";
                              
                              if (submitted) {
                                if (isCorrectAnswerOption) {
                                  optionClass = "border-emerald-800/40 bg-emerald-950/30 text-emerald-400 font-bold";
                                } else if (isChosenOption && !isCorrect) {
                                  optionClass = "border-rose-800/40 bg-rose-950/30 text-rose-400";
                                } else {
                                  optionClass = "border-[rgba(255,255,255,0.05)] bg-[#1A2235]/30 text-[#64748B] pointer-events-none";
                                }
                              } else if (isChosenOption) {
                                optionClass = "border-indigo-500 bg-indigo-950/40 text-indigo-400 font-bold ring-1 ring-indigo-500/20";
                              }

                              return (
                                <button
                                  key={optIndex}
                                  onClick={() => handleSelectAnswer(quiz.id, optIndex)}
                                  disabled={submitted}
                                  className={`w-full p-3 font-sans rounded-xl border text-xs text-left cursor-pointer transition-all duration-150 flex items-center justify-between group ${optionClass}`}
                                >
                                  <span>{opt}</span>
                                  {isChosenOption && !submitted && (
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                                  )}
                                  {submitted && isCorrectAnswerOption && (
                                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Submission and explanations block */}
                        <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                          {!submitted ? (
                            <button
                              onClick={() => handleSubmitAnswer(quiz.id)}
                              disabled={selected === undefined}
                              className={`w-full py-2 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all uppercase flex items-center justify-center gap-1 ${
                                selected === undefined
                                  ? "bg-[#1A2235] border border-[rgba(255,255,255,0.08)] text-slate-500 cursor-not-allowed"
                                  : "bg-indigo-600 hover:bg-indigo-700 border border-indigo-750 text-white cursor-pointer shadow hover:shadow-md"
                              }`}
                            >
                              <span>Verify Selection</span>
                            </button>
                          ) : (
                            <div className={`p-3 rounded-2xl text-[11px] leading-relaxed font-sans ${
                              isCorrect ? "bg-emerald-950/25 text-emerald-300" : "bg-rose-950/25 text-rose-300"
                            }`}>
                              <strong>Explanation:</strong> {quiz.explanation}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 3: FAQ ACCORDION PANEL SECTION */}
          {activeTab === "faqs" && (
            <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="mb-4">
                <h3 className="font-display text-sm font-black text-white tracking-tight uppercase">Investor Knowledge FAQ Base</h3>
                <p className="text-[10.5px] text-[#94A3B8] mt-0.5 font-semibold">Quick lookup answers covering general market constraints regulatory rules, and machine prediction calculations.</p>
              </div>

              {filteredFaqs.length === 0 ? (
                <div className="text-center p-12 border border-dashed border-[rgba(255,255,255,0.08)] text-[#64748B] text-xs font-mono rounded-2xl">
                  No match found for FAQ keywords in directory list.
                </div>
              ) : (
                <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                  {filteredFaqs.map((faq) => {
                    const isExpanded = expandedFaqIds[faq.id];
                    return (
                      <div key={faq.id} id={`faq-${faq.id}`} className="py-4">
                        <button
                          onClick={() => toggleFaq(faq.id)}
                          className="w-full flex items-center justify-between text-left gap-4 font-display font-medium text-white cursor-pointer focus:outline-none"
                        >
                          <div className="space-y-1">
                            <span className="inline-block text-[8px] font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/25 px-1.5 py-0.5 rounded uppercase">
                              {faq.category}
                            </span>
                            <h4 className="text-xs font-semibold leading-relaxed hover:text-indigo-400 transition-colors">
                              {faq.question}
                            </h4>
                          </div>
                          <span className="p-1 border border-[rgba(255,255,255,0.08)] rounded-lg bg-[#1A2235] hover:bg-[#1A2235]/80 shrink-0 select-none">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-[#CBD5E1]" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-[#CBD5E1]" />
                            )}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 text-[11px] leading-relaxed font-sans text-[#CBD5E1] pl-2 border-l-2 border-indigo-500 space-y-1">
                            <p>{faq.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
