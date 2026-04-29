"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface ArenaDropdownProps {
    teamMode: string;
    onSelect: (mode: "tdm" | "wow") => void;
    hasTDM: boolean;
    hasWoW: boolean;
}

const ARENA_MODES = {
    tdm: { label: "TDM", icon: "⚔️" },
    wow: { label: "WoW", icon: "🌟" },
} as const;

/**
 * Dropdown button for arena game modes (TDM / WoW).
 * When no arena mode is selected, shows "More ▾".
 * When selected, shows the active mode name with ▾.
 */
export function ArenaDropdown({ teamMode, onSelect, hasTDM, hasWoW }: ArenaDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const isArenaMode = teamMode === "tdm" || teamMode === "wow";
    const activeMode = isArenaMode ? ARENA_MODES[teamMode as "tdm" | "wow"] : null;

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const options = [
        ...(hasTDM ? [{ key: "tdm" as const, ...ARENA_MODES.tdm }] : []),
        ...(hasWoW ? [{ key: "wow" as const, ...ARENA_MODES.wow }] : []),
    ];

    return (
        <div ref={ref} className="relative flex-1">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`
                    w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium
                    transition-all duration-200 cursor-pointer
                    ${isArenaMode
                        ? "bg-background shadow-sm text-foreground"
                        : "text-foreground/50 hover:text-foreground/70"
                    }
                `}
            >
                {activeMode?.icon && <span>{activeMode.icon}</span>}
                <span>{activeMode?.label ?? "More"}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute top-full right-0 mt-1.5 w-36 rounded-xl bg-content1 border border-divider shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {options.map(({ key, label, icon }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => {
                                onSelect(key);
                                setOpen(false);
                            }}
                            className={`
                                w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium
                                transition-colors cursor-pointer
                                ${teamMode === key
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground/70 hover:bg-default-100"
                                }
                            `}
                        >
                            <span className="text-base">{icon}</span>
                            <span>{label}</span>
                            {teamMode === key && (
                                <span className="ml-auto text-primary text-xs">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
