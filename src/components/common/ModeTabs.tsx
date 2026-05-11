"use client";

import { motion } from "motion/react";
import { GAME } from "@/lib/game-config";
import { ArenaDropdown } from "@/components/players/arena-dropdown";

interface ModeTabsProps {
    mode: string;
    onSelect: (mode: string) => void;
    /** Optional counts to show badges per tab */
    counts?: Partial<Record<string, number>>;
    /** Hide tabs that have no data (count === 0). Only applies when counts is provided. */
    hideEmpty?: boolean;
    /** Show loading state for counts */
    isLoading?: boolean;
    /** Custom layoutId for framer-motion tab indicator */
    layoutId?: string;
}

const MAIN_TABS: { key: string; label: string; icon: string }[] = [
    { key: "casual", label: "Casual", icon: "🎮" },
    { key: "ranked", label: "Ranked", icon: "🏆" },
];

/**
 * Reusable mode tabs: Casual / Ranked inline + TDM/WoW in "More" dropdown.
 * Used on vote, players, winners, and profile pages.
 */
export function ModeTabs({ mode, onSelect, counts, hideEmpty, isLoading, layoutId = "mode-tab-indicator" }: ModeTabsProps) {
    const hasTDM = GAME.features.hasTDM;
    const hasWoW = GAME.features.hasWoW;
    const hasArena = hasTDM || hasWoW;

    // Filter main tabs by count if hideEmpty
    const visibleTabs = hideEmpty && counts
        ? MAIN_TABS.filter(t => (counts[t.key] ?? 0) > 0 || mode === t.key)
        : MAIN_TABS;

    // For arena: check if there's data (when counts provided)
    const showArena = hasArena && (!hideEmpty || !counts ||
        (hasTDM && (counts.tdm ?? 0) > 0) ||
        (hasWoW && (counts.wow ?? 0) > 0) ||
        mode === "tdm" || mode === "wow"
    );

    if (visibleTabs.length === 0 && !showArena) return null;

    return (
        <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-default-100 relative">
            {visibleTabs.map(({ key, label, icon }) => {
                const count = counts?.[key];
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(key)}
                        className="flex-1 relative flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium cursor-pointer z-[1]"
                    >
                        {mode === key && (
                            <motion.div
                                layoutId={layoutId}
                                className="absolute inset-0 bg-background rounded-lg shadow-sm"
                                style={{ zIndex: -1 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 35,
                                    mass: 0.8,
                                }}
                            />
                        )}
                        <motion.span
                            animate={{ scale: mode === key ? 1.05 : 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        >
                            {icon}
                        </motion.span>
                        <motion.span
                            animate={{
                                color: mode === key ? "var(--foreground)" : "var(--foreground-500)",
                            }}
                            transition={{ duration: 0.2 }}
                        >
                            {label}
                        </motion.span>
                        {!isLoading && count != null && count > 0 && (
                            <motion.span
                                className={`
                                    ml-0.5 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1
                                    ${mode === key ? "bg-primary/10 text-primary" : "bg-foreground/10 text-foreground/40"}
                                `}
                                animate={{
                                    scale: mode === key ? 1 : 0.9,
                                    opacity: mode === key ? 1 : 0.7,
                                }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            >
                                {count}
                            </motion.span>
                        )}
                    </button>
                );
            })}
            {showArena && (
                <ArenaDropdown
                    teamMode={mode}
                    onSelect={(m) => onSelect(m)}
                    hasTDM={hasTDM && (!hideEmpty || !counts || (counts.tdm ?? 0) > 0 || mode === "tdm")}
                    hasWoW={hasWoW && (!hideEmpty || !counts || (counts.wow ?? 0) > 0 || mode === "wow")}
                />
            )}
        </div>
    );
}

/** Get a human-readable label for a mode key */
export function getModeLabel(mode: string): string {
    switch (mode) {
        case "casual": return "casual";
        case "ranked": return "ranked";
        case "tdm": return "TDM";
        case "wow": return "WoW";
        default: return mode;
    }
}
