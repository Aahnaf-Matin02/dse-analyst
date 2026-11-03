import React, { useState } from "react";
import { Lock, Mail, User, X, Sparkles, LogIn, UserPlus } from "lucide-react";

interface AuthModalFormProps {
  mode: "login" | "signup";
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, name: string, password: string) => Promise<void>;
}

export default function AuthModalForm({ mode, onClose, onLogin, onSignup }: AuthModalFormProps) {
  const [currentMode, setCurrentMode] = useState<"login" | "signup">(mode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    try {
      if (currentMode === "login") {
        await onLogin(email, password);
      } else {
        if (!name.trim()) {
          throw new Error("Full Name is required.");
        }
        await onSignup(email, name, password);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glass backdrop */}
      <div 
        className="absolute inset-0 bg-[#020305]/85 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      ></div>

      {/* Modal Card */}
      <div className="bg-[#0b0e14]/95 border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative z-10 overflow-hidden transform animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none"></div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-amber-500 p-[1px] shadow-lg">
            <span className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0b0e14] text-amber-500">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </span>
          </div>
          <h3 className="text-xl font-display font-extrabold tracking-tight text-white">
            {currentMode === "login" ? "Analyst Portal Access" : "Join DSE AI Pro"}
          </h3>
          <p className="text-[11px] text-gray-400 font-sans">
            {currentMode === "login" 
              ? "Sign in to synchronize watchlist and triggers" 
              : "Register to get persistent cloud-backed monitoring"}
          </p>
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-300 leading-snug font-sans text-center mt-2">
            Account and watchlist features are running in demo mode. Data may not persist after deployment.
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-xs text-red-400 leading-relaxed font-sans text-center">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {currentMode === "signup" && (
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-wider">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ahnaf Rahman"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/45 text-slate-100 text-xs pl-10 pr-4 py-3 rounded-xl border border-white/10 outline-none focus:border-white/20 transition-all font-sans"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-wider">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                placeholder="ahnaf@example.com.bd"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/45 text-slate-100 text-xs pl-10 pr-4 py-3 rounded-xl border border-white/10 outline-none focus:border-white/20 transition-all font-sans"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-gray-400 uppercase font-bold tracking-wider">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/45 text-slate-100 text-xs pl-10 pr-4 py-3 rounded-xl border border-white/10 outline-none focus:border-white/20 transition-all font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-xs py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-450 text-white font-extrabold shadow-lg shadow-blue-500/10 cursor-pointer disabled:opacity-50 transition-all select-none mt-2"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : currentMode === "login" ? (
              <>
                <LogIn className="h-4 w-4" /> Authenticate Terminal
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Generate Account
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 text-center">
          {currentMode === "login" ? (
            <p className="text-[11px] text-gray-400">
              New to DSE AI Analyst?{" "}
              <button 
                type="button"
                onClick={() => {
                  setCurrentMode("signup");
                  setErrorMessage(null);
                }}
                className="text-amber-500 font-extrabold hover:underline cursor-pointer"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">
              Already have an analyst account?{" "}
              <button 
                type="button"
                onClick={() => {
                  setCurrentMode("login");
                  setErrorMessage(null);
                }}
                className="text-amber-500 font-extrabold hover:underline cursor-pointer"
              >
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
