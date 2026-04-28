"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardBody } from "@heroui/react";
import { Copy, Check, ChevronDown, ChevronUp, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GAME } from "@/lib/game-config";
import type { PollDTO } from "@/hooks/use-polls";

/* ─── Unicode bold text helper (renders bold in WhatsApp) ───── */

const BOLD_MAP: Record<string, string> = {
    A: "𝗔", B: "𝗕", C: "𝗖", D: "𝗗", E: "𝗘", F: "𝗙", G: "𝗚", H: "𝗛", I: "𝗜",
    J: "𝗝", K: "𝗞", L: "𝗟", M: "𝗠", N: "𝗡", O: "𝗢", P: "𝗣", Q: "𝗤", R: "𝗥",
    S: "𝗦", T: "𝗧", U: "𝗨", V: "𝗩", W: "𝗪", X: "𝗫", Y: "𝗬", Z: "𝗭",
    a: "𝗮", b: "𝗯", c: "𝗰", d: "𝗱", e: "𝗲", f: "𝗳", g: "𝗴", h: "𝗵", i: "𝗶",
    j: "𝗷", k: "𝗸", l: "𝗹", m: "𝗺", n: "𝗻", o: "𝗼", p: "𝗽", q: "𝗾", r: "𝗿",
    s: "𝘀", t: "𝘁", u: "𝘂", v: "𝘃", w: "𝘄", x: "𝘅", y: "𝘆", z: "𝘇",
    "0": "𝟬", "1": "𝟭", "2": "𝟮", "3": "𝟯", "4": "𝟰",
    "5": "𝟱", "6": "𝟲", "7": "𝟳", "8": "𝟴", "9": "𝟵",
    " ": " ",
};

function toBold(text: string): string {
    return text.split("").map((c) => BOLD_MAP[c] ?? c).join("");
}

/* ─── BGMI Maps ─────────────────────────────────────────────── */

const BGMI_MAPS = [
    "Erangel",
    "Miramar",
    "Sanhok",
    "Vikendi",
    "Livik",
    "Karakin",
    "Nusa",
];

/* ─── Types ─────────────────────────────────────────────────── */

interface TournamentState {
    time: string;
    password: string;
    roomId: string;
    map: string;
    copyCount: number; // Tracks match number: 1st copy = Match 1, 2nd = Match 2, etc.
    justCopied: boolean;
}

interface RoomInfoGeneratorProps {
    polls: PollDTO[];
}

/* ─── Per-Tournament Row ────────────────────────────────────── */

function TournamentRow({ poll, state, onChange }: {
    poll: PollDTO;
    state: TournamentState;
    onChange: (update: Partial<TournamentState>) => void;
}) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isRanked = poll.allowSquads;
    const typeEmoji = isRanked ? "🏆" : "🎮";
    const typeLabel = isRanked ? "RANKED" : "CASUAL";
    const tournamentName = poll.tournament?.name || poll.question;
    const matchNumber = state.copyCount + 1; // Next match to copy

    // Format time value (HH:MM 24h) to a readable string like "8:30 PM"
    const formatTime = (timeVal: string) => {
        if (!timeVal) return "TBD";
        const [h, m] = timeVal.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
    };

    const generateMessage = useCallback((matchNum: number) => {
        const divider = "━━━━━━━━━━━━━━━";
        const lines = [
            `${typeEmoji} ${toBold(typeLabel + " TOURNAMENT")}`,
            divider,
            `🎯 ${tournamentName}`,
            `🗺️ Map: ${state.map}`,
            `🕐 Match ${matchNum} — ${formatTime(state.time)}`,
            ...(state.roomId.trim() ? [`🔐 Room ID: ${state.roomId.trim()}`] : []),
            `🔑 Password: ${state.password}`,
            divider,
            `${GAME.gameName} × Bimon Tournament`,
            `✨ All the best! 💪`,
        ];
        return lines.join("\n");
    }, [state.roomId, state.time, state.password, state.map, typeEmoji, typeLabel, tournamentName]);

    const handleCopy = useCallback(async () => {
        const nextMatch = state.copyCount + 1;
        const message = generateMessage(nextMatch);

        try {
            await navigator.clipboard.writeText(message);
            onChange({ copyCount: nextMatch, justCopied: true });

            // Reset the checkmark after 2s
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                onChange({ justCopied: false });
            }, 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = message;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            onChange({ copyCount: nextMatch, justCopied: true });
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                onChange({ justCopied: false });
            }, 2000);
        }
    }, [generateMessage, state.copyCount, onChange]);

    const resetMatch = useCallback(() => {
        onChange({ copyCount: 0 });
    }, [onChange]);

    return (
        <div className="space-y-3">
            {/* Tournament Header */}
            <div className="flex items-center gap-2">
                <span className="text-lg">{typeEmoji}</span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{tournamentName}</p>
                    <p className={`text-[11px] font-medium ${isRanked ? "text-amber-500" : "text-emerald-500"}`}>
                        {typeLabel}
                    </p>
                </div>
                {state.copyCount > 0 && (
                    <button
                        type="button"
                        onClick={resetMatch}
                        className="text-[10px] text-foreground/40 hover:text-foreground/60 transition-colors cursor-pointer px-1.5 py-0.5 rounded bg-default-100"
                        title="Reset match counter"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Input Row: Time + Password + Room ID */}
            {/* Row 1: Map + Time */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">Map</label>
                    <select
                        value={state.map}
                        onChange={(e) => onChange({ map: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                        {BGMI_MAPS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">Time</label>
                    <input
                        type="time"
                        value={state.time}
                        onChange={(e) => onChange({ time: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Row 2: Password + Room ID */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">Password</label>
                    <input
                        type="text"
                        value={state.password}
                        onChange={(e) => onChange({ password: e.target.value })}
                        placeholder="m"
                        className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">Room ID</label>
                    <input
                        type="text"
                        value={state.roomId}
                        onChange={(e) => onChange({ roomId: e.target.value })}
                        placeholder="optional"
                        maxLength={10}
                        className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                </div>
            </div>

            {/* Copy Button */}
            <button
                type="button"
                onClick={handleCopy}
                className={`
                    w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                    transition-all duration-200 cursor-pointer active:scale-[0.98]
                    ${state.justCopied
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                        : isRanked
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
                    }
                `}
            >
                {state.justCopied ? (
                    <>
                        <Check className="w-4 h-4" />
                        Copied Match {state.copyCount}!
                    </>
                ) : (
                    <>
                        <Copy className="w-4 h-4" />
                        Copy Match {matchNumber}
                    </>
                )}
            </button>

            {/* Match counter indicator */}
            {state.copyCount > 0 && (
                <p className="text-[11px] text-center text-foreground/40">
                    {state.copyCount} match{state.copyCount !== 1 ? "es" : ""} copied • Next: Match {state.copyCount + 1}
                </p>
            )}
        </div>
    );
}

/* ─── Main Component ────────────────────────────────────────── */

export function RoomInfoGenerator({ polls }: RoomInfoGeneratorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const LS_KEY = "room-info-match-counts";

    // Load persisted match counts from localStorage on mount
    const [states, setStates] = useState<Record<string, TournamentState>>(() => {
        if (typeof window === "undefined") return {};
        try {
            const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}") as Record<string, number>;
            const initial: Record<string, TournamentState> = {};
            for (const [pollId, count] of Object.entries(saved)) {
                if (typeof count === "number" && count > 0) {
                    initial[pollId] = { time: "", password: "m", roomId: "", map: "Erangel", copyCount: count, justCopied: false };
                }
            }
            return initial;
        } catch {
            return {};
        }
    });

    // Persist match counts to localStorage whenever they change
    useEffect(() => {
        const counts: Record<string, number> = {};
        for (const [pollId, state] of Object.entries(states)) {
            if (state.copyCount > 0) counts[pollId] = state.copyCount;
        }
        try { localStorage.setItem(LS_KEY, JSON.stringify(counts)); } catch { /* quota */ }
    }, [states]);

    // Default time = now + 10 minutes (HH:MM format for <input type="time">)
    const getDefaultTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 10);
        return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    };

    const getDefaultState = (): TournamentState => ({
        time: getDefaultTime(), password: "m", roomId: "", map: "Erangel", copyCount: 0, justCopied: false,
    });

    const getState = (pollId: string): TournamentState => {
        if (states[pollId]) {
            // Fill in time if it was loaded from localStorage (which only saves copyCount)
            return { ...getDefaultState(), ...states[pollId] };
        }
        return getDefaultState();
    };

    const updateState = (pollId: string, update: Partial<TournamentState>) => {
        setStates((prev) => {
            const current = prev[pollId] ?? getDefaultState();
            return { ...prev, [pollId]: { ...current, ...update } };
        });
    };

    // Only show active polls
    const activePolls = polls.filter((p) => p.isActive);
    if (activePolls.length === 0) return null;

    return (
        <Card className="mb-4 border border-divider overflow-hidden">
            {/* Collapsible Header */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-default-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                        <KeyRound className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold">Room Info</p>
                        <p className="text-[11px] text-foreground/40">Generate & copy for WhatsApp</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">
                        {activePolls.length} active
                    </span>
                    {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-foreground/40" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-foreground/40" />
                    )}
                </div>
            </button>

            {/* Collapsible Body */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <CardBody className="px-4 pt-0 pb-4 space-y-4">
                            {activePolls.map((poll, i) => (
                                <div key={poll.id}>
                                    {i > 0 && <div className="border-t border-divider my-3" />}
                                    <TournamentRow
                                        poll={poll}
                                        state={getState(poll.id)}
                                        onChange={(update) => updateState(poll.id, update)}
                                    />
                                </div>
                            ))}

                            {/* Hint */}
                            <p className="text-[10px] text-center text-foreground/30 pt-1">
                                💡 Leave Room ID blank → paste format in WhatsApp, then add ID there
                            </p>
                        </CardBody>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
