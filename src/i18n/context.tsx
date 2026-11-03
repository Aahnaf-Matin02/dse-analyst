import React, { createContext, useContext, useState, useEffect } from "react";
import { bn } from "./bn";
import { en } from "./en";

export type Language = "bn" | "en";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof bn;
  isBangla: boolean;
}

const I18nContext = createContext<I18nContextType>({
  language: "bn",
  setLanguage: () => {},
  t: bn,
  isBangla: true
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("dse_learning_lang");
      return (saved === "en" || saved === "bn") ? saved : "bn"; // default Bangla per rule 5
    } catch {
      return "bn";
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("dse_learning_lang", lang);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value: I18nContextType = {
    language,
    setLanguage,
    t: language === "bn" ? bn : en,
    isBangla: language === "bn"
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  return useContext(I18nContext);
};
