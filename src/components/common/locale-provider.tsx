"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { translations, type TranslationKey } from "@/lib/translations";

export type AppLocale = "en" | "kha";

interface LocaleContextType {
    locale: AppLocale;
    setLocale: (locale: AppLocale) => void;
    /** Inline translation: t("English text", "Khasi text") */
    t: (en: string, kha: string) => string;
    /** Key-based translation from dictionary: tk("votedIn") */
    tk: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextType>({
    locale: "en",
    setLocale: () => {},
    t: (en) => en,
    tk: (key) => translations[key]?.en ?? key,
});

const STORAGE_KEY = "bimon-locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<AppLocale>("en");

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
        if (saved === "en" || saved === "kha") {
            setLocaleState(saved);
        }
    }, []);

    const setLocale = (l: AppLocale) => {
        setLocaleState(l);
        localStorage.setItem(STORAGE_KEY, l);
    };

    const t = (en: string, kha: string) => (locale === "kha" ? kha : en);
    const tk = (key: TranslationKey) => translations[key]?.[locale] ?? translations[key]?.en ?? key;

    return (
        <LocaleContext.Provider value={{ locale, setLocale, t, tk }}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    return useContext(LocaleContext);
}
