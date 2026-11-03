import React, { useEffect, useId, useRef, useState } from "react";
import { Lock, Mail, User, X, LogIn, UserPlus, Eye, EyeOff, Check, Circle, Loader2 } from "lucide-react";

interface AuthModalFormProps {
  mode: "login" | "signup";
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, name: string, password: string) => Promise<void>;
}

// Mirrors the server's complexity rules (server/services/passwordValidator.ts) so users see them up front
const PASSWORD_RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: p => p.length >= 8, label: "At least 8 characters" },
  { test: p => /[A-Z]/.test(p), label: "An uppercase letter" },
  { test: p => /[a-z]/.test(p), label: "A lowercase letter" },
  { test: p => /\d/.test(p), label: "A number" },
  { test: p => /[^A-Za-z0-9]/.test(p), label: "A symbol, e.g. ! # $" },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthModalForm({ mode, onClose, onLogin, onSignup }: AuthModalFormProps) {
  const [currentMode, setCurrentMode] = useState<"login" | "signup">(mode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; name?: boolean; password?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const isSignup = currentMode === "signup";

  useEffect(() => { firstFieldRef.current?.focus(); }, [currentMode]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const emailError = touched.email && !EMAIL_RE.test(email.trim()) ? "Enter a valid email address, e.g. name@example.com." : null;
  const nameError = isSignup && touched.name && !name.trim() ? "Please enter your name." : null;
  const failedRules = PASSWORD_RULES.filter(r => !r.test(password));
  const passwordError = touched.password
    ? (!password ? "Please enter your password." : isSignup && failedRules.length ? "Your password doesn't meet all the requirements below." : null)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, name: true, password: true });
    setErrorMessage(null);
    const invalid = !EMAIL_RE.test(email.trim()) || !password || (isSignup && (!name.trim() || failedRules.length > 0));
    if (invalid) return; // inline messages explain what to fix; nothing typed is cleared
    setLoading(true);
    try {
      if (isSignup) await onSignup(email.trim(), name.trim(), password);
      else await onLogin(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(err?.message || "Sign-in failed. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: "login" | "signup") => { setCurrentMode(m); setErrorMessage(null); setTouched({}); };
  const inputCls = (bad: boolean) =>
    `w-full bg-black/40 text-[var(--text)] text-base pl-10 pr-4 h-12 rounded-xl border outline-none transition-colors ${bad ? "border-rose-400/70" : "border-white/15 focus:border-[var(--accent)]"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#020305]/85 backdrop-blur-md" onClick={onClose} aria-hidden="true" />

      <div role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} className="bg-[#0b0e14] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative z-10 max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-2.5 rounded-xl text-[var(--text-subtle)] hover:text-white hover:bg-white/10">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="space-y-1.5 mb-5 pr-8">
          <h2 id={`${uid}-title`} className="text-xl font-display font-bold text-white">{isSignup ? "Create your account" : "Sign in"}</h2>
          <p className="text-sm text-[var(--text-muted)]">{isSignup ? "Save your watchlist and get a higher daily AI limit." : "Welcome back. Sign in to sync your watchlist."}</p>
          <p className="text-xs text-amber-200/90 bg-amber-400/10 border border-amber-400/25 rounded-lg px-2.5 py-1.5">Demo accounts: data may not persist after the app is redeployed.</p>
        </div>

        {errorMessage && (
          <div role="alert" className="mb-4 p-3 bg-rose-950/40 border border-rose-400/40 rounded-xl text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {isSignup && (
            <div className="space-y-1.5">
              <label htmlFor={`${uid}-name`} className="text-sm font-medium text-[var(--text)]">Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-subtle)]" aria-hidden="true" />
                <input ref={isSignup ? firstFieldRef : undefined} id={`${uid}-name`} type="text" autoComplete="name" value={name}
                  onChange={e => setName(e.target.value)} onBlur={() => setTouched(t => ({ ...t, name: true }))}
                  aria-invalid={!!nameError} aria-describedby={nameError ? `${uid}-name-err` : undefined} className={inputCls(!!nameError)} />
              </div>
              {nameError && <p id={`${uid}-name-err`} className="text-sm text-rose-300">{nameError}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor={`${uid}-email`} className="text-sm font-medium text-[var(--text)]">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-subtle)]" aria-hidden="true" />
              <input ref={!isSignup ? firstFieldRef : undefined} id={`${uid}-email`} type="email" inputMode="email" autoComplete="email" value={email}
                onChange={e => setEmail(e.target.value)} onBlur={() => setTouched(t => ({ ...t, email: true }))}
                aria-invalid={!!emailError} aria-describedby={emailError ? `${uid}-email-err` : undefined} className={inputCls(!!emailError)} />
            </div>
            {emailError && <p id={`${uid}-email-err`} className="text-sm text-rose-300">{emailError}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${uid}-pw`} className="text-sm font-medium text-[var(--text)]">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-subtle)]" aria-hidden="true" />
              <input id={`${uid}-pw`} type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} value={password}
                onChange={e => setPassword(e.target.value)} onBlur={() => setTouched(t => ({ ...t, password: true }))}
                aria-invalid={!!passwordError} aria-describedby={`${passwordError ? `${uid}-pw-err ` : ""}${isSignup ? `${uid}-pw-rules` : ""}`.trim() || undefined}
                className={`${inputCls(!!passwordError)} pr-12`} />
              <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-[var(--text-subtle)] hover:text-white">
                {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
            {passwordError && <p id={`${uid}-pw-err`} className="text-sm text-rose-300">{passwordError}</p>}
            {isSignup && (
              <ul id={`${uid}-pw-rules`} className="grid grid-cols-1 gap-1 pt-1">
                {PASSWORD_RULES.map(r => {
                  const ok = r.test(password);
                  return (
                    <li key={r.label} className={`flex items-center gap-2 text-sm ${ok ? "text-emerald-300" : "text-[var(--text-muted)]"}`}>
                      {ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span>{r.label}<span className="sr-only">{ok ? " — done" : " — not yet"}</span></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : isSignup ? <UserPlus className="h-4 w-4" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
            {loading ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 pt-4 border-t border-white/10 text-center text-sm text-[var(--text-muted)]">
          {isSignup ? "Already have an account? " : "New here? "}
          <button type="button" onClick={() => switchMode(isSignup ? "login" : "signup")} className="font-semibold text-[var(--accent)] hover:underline min-h-[44px] px-1">
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </div>
  );
}
