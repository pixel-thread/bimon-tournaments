"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "bimon-color-theme";
const VALID_THEMES = ["default", "gold", "fire", "blue", "cyan"] as const;
export type ColorTheme = (typeof VALID_THEMES)[number];

// Migration map — old game-based values → new generic names
const MIGRATION_MAP: Record<string, ColorTheme> = {
    bgmi: "gold",
    freefire: "fire",
    pes: "blue",
    mlbb: "cyan",
};

interface ColorThemeContextValue {
    colorTheme: ColorTheme;
    setColorTheme: (theme: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextValue>({
    colorTheme: "default",
    setColorTheme: () => {},
});

export function useColorTheme() {
    return useContext(ColorThemeContext);
}

/**
 * Provider that manages the user's color theme preference.
 * Default = no color theme (standard white/dark mode).
 * Users can opt into a color theme from settings.
 * Applies `data-color-theme` attribute to <html> only when a color is chosen.
 */
export function ColorThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [colorTheme, setColorThemeState] = useState<ColorTheme>("default");
    const [mounted, setMounted] = useState(false);

    // Read from localStorage on mount
    useEffect(() => {
        let stored = localStorage.getItem(STORAGE_KEY);
        // Migrate old game-based values to new generic names
        if (stored && stored in MIGRATION_MAP) {
            stored = MIGRATION_MAP[stored];
            localStorage.setItem(STORAGE_KEY, stored);
        }
        if (stored && VALID_THEMES.includes(stored as ColorTheme)) {
            setColorThemeState(stored as ColorTheme);
            if (stored !== "default") {
                document.documentElement.setAttribute("data-color-theme", stored);
            } else {
                document.documentElement.removeAttribute("data-color-theme");
            }
        }
        setMounted(true);
    }, []);

    const setColorTheme = (theme: ColorTheme) => {
        setColorThemeState(theme);
        localStorage.setItem(STORAGE_KEY, theme);
        if (theme !== "default") {
            document.documentElement.setAttribute("data-color-theme", theme);
        } else {
            document.documentElement.removeAttribute("data-color-theme");
        }
    };

    if (!mounted) {
        return (
            <ColorThemeContext.Provider value={{ colorTheme: "default", setColorTheme }}>
                {children}
            </ColorThemeContext.Provider>
        );
    }

    return (
        <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
            {children}
        </ColorThemeContext.Provider>
    );
}
