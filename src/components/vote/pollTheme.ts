// Shared poll theme configuration based on participant count (IN + SOLO votes)
// Ported from v1's pollTheme.ts — adapts to HeroUI dark mode

export type PollTheme = {
    card: string;
    header: string;
    wave1: string;
    wave2: string;
    sparkle: string;
    badge: string;
    options: string;
    footer: string;
    button: string;
    optionSelected: { border: string; bg: string; text: string; radio: string };
    optionUnselected: { border: string; radio: string };
};

/**
 * 6-tier theme system based on participant count (IN + SOLO):
 * 1-19: Starter (Slate)
 * 20-29: Common (Gold/Amber)
 * 30-39: Rare (Green/Emerald)
 * 40-49: Epic (Blue/Cyan)
 * 50-59: Legendary (Red/Orange)
 * 60+: Diamond (Purple/Pink)
 */
export function getPollTheme(participantCount: number): PollTheme | null {
    if (participantCount >= 60) {
        // Diamond — Purple/Pink premium
        return {
            card: "bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-800 border-2 border-purple-400 dark:border-purple-500 shadow-lg shadow-purple-300/50 dark:shadow-purple-900/30",
            header: "from-purple-500 via-pink-500 to-purple-600",
            wave1: "rgba(168,85,247,0.3)",
            wave2: "rgba(255,255,255,0.15)",
            sparkle: "bg-pink-200",
            badge: "bg-black/25 text-white backdrop-blur-sm font-semibold",
            options: "bg-gradient-to-b from-purple-100/50 to-purple-50/30 dark:from-purple-900/20 dark:to-purple-950/10",
            footer: "bg-gradient-to-b from-purple-50/30 to-purple-100/50 dark:from-purple-950/10 dark:to-purple-900/20",
            button: "text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/30",
            optionSelected: { border: "border-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", radio: "border-purple-500 bg-purple-500" },
            optionUnselected: { border: "border-purple-200 dark:border-purple-700 hover:border-purple-400", radio: "border-purple-300 dark:border-purple-600" },
        };
    } else if (participantCount >= 50) {
        // Legendary — Red/Orange fire
        return {
            card: "bg-gradient-to-b from-red-50 to-white dark:from-red-950/30 dark:to-gray-800 border-2 border-red-400 dark:border-red-500 shadow-lg shadow-red-300/50 dark:shadow-red-900/30",
            header: "from-red-500 via-orange-500 to-red-600",
            wave1: "rgba(239,68,68,0.3)",
            wave2: "rgba(255,255,255,0.15)",
            sparkle: "bg-orange-200",
            badge: "bg-black/25 text-white backdrop-blur-sm font-semibold",
            options: "bg-gradient-to-b from-red-100/50 to-red-50/30 dark:from-red-900/20 dark:to-red-950/10",
            footer: "bg-gradient-to-b from-red-50/30 to-red-100/50 dark:from-red-950/10 dark:to-red-900/20",
            button: "text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/30",
            optionSelected: { border: "border-red-500", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", radio: "border-red-500 bg-red-500" },
            optionUnselected: { border: "border-red-200 dark:border-red-700 hover:border-red-400", radio: "border-red-300 dark:border-red-600" },
        };
    } else if (participantCount >= 40) {
        // Epic — Blue/Cyan
        return {
            card: "bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-800 border-2 border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-300/50 dark:shadow-blue-900/30",
            header: "from-blue-500 via-cyan-400 to-blue-600",
            wave1: "rgba(59,130,246,0.3)",
            wave2: "rgba(255,255,255,0.15)",
            sparkle: "bg-cyan-200",
            badge: "bg-black/25 text-white backdrop-blur-sm font-semibold",
            options: "bg-gradient-to-b from-blue-100/50 to-blue-50/30 dark:from-blue-900/20 dark:to-blue-950/10",
            footer: "bg-gradient-to-b from-blue-50/30 to-blue-100/50 dark:from-blue-950/10 dark:to-blue-900/20",
            button: "text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30",
            optionSelected: { border: "border-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", radio: "border-blue-500 bg-blue-500" },
            optionUnselected: { border: "border-blue-200 dark:border-blue-700 hover:border-blue-400", radio: "border-blue-300 dark:border-blue-600" },
        };
    } else if (participantCount >= 30) {
        // Rare — Green/Emerald
        return {
            card: "bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/60 dark:to-gray-900 border-2 border-emerald-400 dark:border-emerald-400 shadow-lg shadow-emerald-300/50 dark:shadow-emerald-500/20",
            header: "from-emerald-500 via-green-400 to-emerald-600",
            wave1: "rgba(16,185,129,0.3)",
            wave2: "rgba(255,255,255,0.15)",
            sparkle: "bg-green-200",
            badge: "bg-black/25 text-white backdrop-blur-sm font-semibold",
            options: "bg-gradient-to-b from-emerald-100/50 to-emerald-50/30 dark:from-emerald-900/40 dark:to-emerald-950/20",
            footer: "bg-gradient-to-b from-emerald-50/30 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/40",
            button: "text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
            optionSelected: { border: "border-emerald-500 dark:border-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", radio: "border-emerald-500 bg-emerald-500" },
            optionUnselected: { border: "border-emerald-200 dark:border-emerald-600 hover:border-emerald-400", radio: "border-emerald-300 dark:border-emerald-500" },
        };
    } else if (participantCount >= 20) {
        // Common — Gold/Amber
        return {
            card: "bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/60 dark:to-gray-900 border-2 border-amber-300 dark:border-amber-500 shadow-lg shadow-amber-200/50 dark:shadow-amber-500/20",
            header: "from-amber-500 via-yellow-400 to-orange-400",
            wave1: "rgba(251,191,36,0.3)",
            wave2: "rgba(255,255,255,0.15)",
            sparkle: "bg-yellow-200",
            badge: "bg-black/25 text-white backdrop-blur-sm font-semibold",
            options: "bg-gradient-to-b from-amber-100/50 to-amber-50/30 dark:from-amber-900/40 dark:to-amber-950/20",
            footer: "bg-gradient-to-b from-amber-50/30 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/40",
            button: "text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40",
            optionSelected: { border: "border-amber-500 dark:border-amber-400", bg: "bg-amber-50 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", radio: "border-amber-500 bg-amber-500" },
            optionUnselected: { border: "border-amber-200 dark:border-amber-600 hover:border-amber-400", radio: "border-amber-300 dark:border-amber-500" },
        };
    } else if (participantCount >= 1) {
        // Starter — Game-themed (uses CSS custom properties via game theme)
        return {
            card: "bg-white dark:bg-gray-800 border-2 shadow-lg game-card",
            header: "from-gray-500 via-gray-400 to-gray-500",
            wave1: "var(--game-glow, rgba(100,116,139,0.3))",
            wave2: "rgba(255,255,255,0.15)",
            sparkle: "bg-slate-300",
            badge: "bg-black/25 text-white backdrop-blur-sm font-semibold",
            options: "bg-gradient-to-b from-slate-100/50 to-slate-50/30 dark:from-slate-900/20 dark:to-slate-950/10",
            footer: "bg-gradient-to-b from-slate-50/30 to-slate-100/50 dark:from-slate-950/10 dark:to-slate-900/20",
            button: "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/30",
            optionSelected: { border: "border-slate-500", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-700 dark:text-slate-300", radio: "border-slate-500 bg-slate-500" },
            optionUnselected: { border: "border-slate-200 dark:border-slate-700 hover:border-slate-400", radio: "border-slate-300 dark:border-slate-600" },
        };
    }
    return null;
}

/** Lucky voter — celebratory golden/emerald theme */
export function getLuckyWinnerTheme(): PollTheme {
    return {
        card: "bg-gradient-to-b from-emerald-50 via-amber-50 to-white dark:from-emerald-950/40 dark:via-amber-950/30 dark:to-gray-800 border-2 border-emerald-400 dark:border-emerald-500 shadow-xl shadow-emerald-300/60 dark:shadow-emerald-900/40 ring-2 ring-amber-300/50 dark:ring-amber-500/30",
        header: "from-emerald-500 via-green-400 to-amber-500",
        wave1: "rgba(16,185,129,0.4)",
        wave2: "rgba(251,191,36,0.25)",
        sparkle: "bg-amber-300",
        badge: "bg-emerald-600/90 text-white backdrop-blur-sm font-bold",
        options: "bg-gradient-to-b from-emerald-100/60 via-amber-50/40 to-emerald-50/30 dark:from-emerald-900/30 dark:via-amber-900/20 dark:to-emerald-950/10",
        footer: "bg-gradient-to-b from-emerald-50/40 via-amber-50/30 to-emerald-100/50 dark:from-emerald-950/20 dark:via-amber-950/10 dark:to-emerald-900/20",
        button: "text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 font-semibold",
        optionSelected: { border: "border-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", radio: "border-emerald-500 bg-emerald-500" },
        optionUnselected: { border: "border-emerald-200 dark:border-emerald-700 hover:border-emerald-400", radio: "border-emerald-300 dark:border-emerald-600" },
    };
}
