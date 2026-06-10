"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Copy, Check, ChevronDown, ChevronUp, KeyRound, RotateCcw, Send, ShieldAlert, Pencil, Trash2, ImagePlus, Plus, Save, Camera, X, Smartphone, Bell, BellOff, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

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
    "Rondo",
    "Sanhok",
    "Vikendi",
    "Livik",
    "Karakin",
    "Nusa",
];

/* ─── Default map rotation (saved to localStorage) ─── */

const DEFAULT_MAP_ROTATION = ["Erangel", "Miramar", "Rondo"];
const MAP_ROTATION_LS_KEY = "room-info-map-rotation";

function getSavedMapRotation(): string[] {
    if (typeof window === "undefined") return DEFAULT_MAP_ROTATION;
    try {
        const saved = JSON.parse(localStorage.getItem(MAP_ROTATION_LS_KEY) || "null");
        if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch {}
    return DEFAULT_MAP_ROTATION;
}

function saveMapRotation(rotation: string[]) {
    try { localStorage.setItem(MAP_ROTATION_LS_KEY, JSON.stringify(rotation)); } catch {}
}

function getDefaultMapForMatch(matchNumber: number, rotation?: string[]): string {
    const maps = rotation ?? getSavedMapRotation();
    return maps[(matchNumber - 1) % maps.length];
}

/* ─── Time helpers (12h format) ─── */

function formatTimeDisplay(time: string): string {
    if (!time) return "TBD";
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** Parse "8:30 PM" or "20:30" back to "HH:MM" 24h */
function parse12hTo24h(input: string): string {
    const match12 = input.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
        let h = parseInt(match12[1]);
        const m = parseInt(match12[2]);
        const ampm = match12[3].toUpperCase();
        if (ampm === "PM" && h !== 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }
    if (/^\d{1,2}:\d{2}$/.test(input)) return input;
    return "";
}

/* ─── Types ─────────────────────────────────────────────────── */

interface InPlayTournament {
    id: string;
    name: string;
    type: string;
    pollId: string | null;
    allowSquads: boolean;
    question: string;
    isChampionship: boolean;
    groups: string[]; // ["A", "B", "C", ...] or []
}

interface TournamentState {
    time: string; // Human-readable "H:MM AM/PM" format
    password: string;
    roomId: string;
    map: string;
    copyCount: number;
}

interface PersistedTournamentState {
    time: string;
    password: string;
    copyCount: number;
}

const LS_KEY = "room-info-states";

/* ─── Custom Time Input ─────────────────────────────────────── */

/** Parse "9:30 PM" → { digits: "0930", ampm: "PM" } */
function parseTimeString(time: string): { digits: string; ampm: "AM" | "PM" } {
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
        const h = match[1].padStart(2, "0");
        return { digits: h + match[2], ampm: match[3].toUpperCase() as "AM" | "PM" };
    }
    return { digits: "", ampm: "PM" };
}

/** Format raw digits "0930" → display "09:30" */
function formatDigits(digits: string): string {
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + ":" + digits.slice(2);
}

/** Build final time string from digits + ampm → "9:30 PM" */
function buildTimeFromDigits(digits: string, ampm: "AM" | "PM"): string {
    if (digits.length < 3) return "";
    const h = parseInt(digits.slice(0, 2)) || 0;
    const m = digits.slice(2).padEnd(2, "0");
    return `${h}:${m} ${ampm}`;
}

function TimeInput({ value, onChange }: { value: string; onChange: (time: string) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isEditing, setIsEditing] = useState(!value);
    const [rawDigits, setRawDigits] = useState("");
    const [countdownKey, setCountdownKey] = useState(0); // bump to restart animation

    const formatAndCommit = useCallback((digits: string) => {
        if (digits.length < 3) return;

        let h: number, m: number;
        if (digits.length === 3) {
            h = parseInt(digits[0]);
            m = parseInt(digits.slice(1));
        } else {
            h = parseInt(digits.slice(0, 2));
            m = parseInt(digits.slice(2, 4));
        }

        if (h === 0) h = 12;
        if (h > 12) h = 12;
        if (m > 59) m = 59;

        const ampm = "PM"; // Default PM for gaming hours
        const formatted = `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
        onChange(formatted);
        setIsEditing(false);
        setRawDigits("");
        setCountdownKey(0);
    }, [onChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/[^\d]/g, "");
        if (raw.length > 4) raw = raw.slice(0, 4);
        setRawDigits(raw);

        if (timerRef.current) clearTimeout(timerRef.current);

        if (raw.length >= 3) {
            setCountdownKey(prev => prev + 1); // restart animation
            timerRef.current = setTimeout(() => formatAndCommit(raw), 2000);
        } else {
            setCountdownKey(0);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && rawDigits.length >= 3) {
            if (timerRef.current) clearTimeout(timerRef.current);
            formatAndCommit(rawDigits);
        }
    };

    const handleClear = () => {
        onChange("");
        setIsEditing(true);
        setRawDigits("");
        setCountdownKey(0);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const toggleAmPm = () => {
        if (!value) return;
        const match = value.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
        if (match) {
            const next = match[2].toUpperCase() === "AM" ? "PM" : "AM";
            onChange(`${match[1]} ${next}`);
        }
    };

    // Editing mode
    if (isEditing || !value) {
        return (
            <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        value={rawDigits}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onBlur={() => { if (rawDigits.length >= 3) formatAndCommit(rawDigits); }}
                        placeholder="eg. 830"
                        maxLength={4}
                        autoFocus
                        className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary font-mono tracking-wider placeholder:text-foreground/25"
                        autoComplete="off"
                    />
                    {/* Progress bar border */}
                    {countdownKey > 0 && (
                        <div
                            key={countdownKey}
                            className="absolute bottom-0 left-0 h-[2px] rounded-b-lg"
                            style={{
                                background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                                animation: "time-progress 2s linear forwards",
                            }}
                        />
                    )}
                    <style>{`
                        @keyframes time-progress {
                            from { width: 0%; }
                            to { width: 100%; }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    // Display mode — formatted time chip
    const match = value.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
    const timeStr = match ? match[1] : value;
    const ampm = match ? match[2].toUpperCase() : "PM";

    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-default-100 border border-divider">
                <span className="flex-1 text-sm font-mono tracking-wider text-center font-semibold">{timeStr}</span>
                <button
                    type="button"
                    onClick={handleClear}
                    className="shrink-0 w-4 h-4 rounded-full bg-default-300 hover:bg-danger/60 flex items-center justify-center transition-colors cursor-pointer"
                >
                    <X className="w-2.5 h-2.5 text-foreground/60" />
                </button>
            </div>
            <button
                type="button"
                onClick={toggleAmPm}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer select-none transition-colors bg-default-100 border border-divider hover:bg-default-200 text-primary shrink-0"
            >
                {ampm}
            </button>
        </div>
    );
}

/* ─── Per-Tournament Row ────────────────────────────────────── */

function TournamentRow({ tournament, state, onChange, group }: {
    tournament: InPlayTournament;
    state: TournamentState;
    onChange: (update: Partial<TournamentState>) => void;
    group?: string; // "A", "B", etc. — for championship group routing
}) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isRanked = tournament.allowSquads;
    const isChamp = tournament.isChampionship && !!group;
    const typeEmoji = isChamp ? "🏅" : isRanked ? "🏆" : "🎮";
    const typeLabel = isChamp ? `GROUP ${group}` : isRanked ? "RANKED" : "CASUAL";
    const tournamentName = tournament.name;
    const matchNumber = state.copyCount + 1;

    const [discordSending, setDiscordSending] = useState(false);
    const [discordSent, setDiscordSent] = useState(false);
    const [discordEditing, setDiscordEditing] = useState(false);
    const [discordEdited, setDiscordEdited] = useState(false);
    const [appSending, setAppSending] = useState(false);
    const [appSent, setAppSent] = useState(false);
    const [waSending, setWaSending] = useState(false);
    const [waSent, setWaSent] = useState(false);
    const [rulesSending, setRulesSending] = useState(false);
    const [rulesSent, setRulesSent] = useState(false);
    const [sentMatchNumbers, setSentMatchNumbers] = useState<Set<number>>(new Set());
    const [lastSentMatch, setLastSentMatch] = useState<number | null>(null);
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [matchPickerOpen, setMatchPickerOpen] = useState(false);
    const [maxMatches, setMaxMatches] = useState(6);

    const generateMessage = useCallback((matchNum: number) => {
        const divider = "━━━━━━━━━━━━━━━";
        const lines = [
            `${typeEmoji} ${toBold(typeLabel + " TOURNAMENT")}`,
            divider,
            `🎯 ${tournamentName}`,
            `🗺️ Map: ${state.map}`,
            `🕐 Match ${matchNum} — ${state.time.trim() || "TBD"}`,
            `🔐 Room ID: ${state.roomId.trim() || ""}`,
            `🔑 Password: ${state.password}`,
            divider,
            `${GAME.gameName} × Bimon Tournament`,
            `✨ All the best! 💪`,
        ];
        return lines.join("\n");
    }, [state.roomId, state.time, state.password, state.map, typeEmoji, typeLabel, tournamentName]);

    const resetMatch = useCallback(() => {
        onChange({ copyCount: 0 });
    }, [onChange]);

    const sendDiscord = useCallback(async (matchNum: number, editExisting = false) => {
        const res = await fetch("/api/discord/send-room-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tournamentId: tournament.id,
                tournamentName,
                matchNumber: matchNum,
                map: state.map,
                time: state.time.trim() || "TBD",
                roomId: state.roomId.trim(),
                password: state.password,
                gameName: GAME.gameName,
                image: attachedImage || undefined,
                group: group || undefined,
                editExisting,
            }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(json.error || `Discord send failed (${res.status})`);
        }
    }, [tournament.id, tournamentName, state.map, state.time, state.roomId, state.password, attachedImage, group]);

    /** Send room info to Discord only */
    const handleSend = useCallback(async () => {
        if (state.roomId.length !== 7) return;
        setDiscordSending(true);

        // Copy message to clipboard for WhatsApp paste
        const msg = generateMessage(matchNumber);
        try { await navigator.clipboard.writeText(msg + "\n\n" + state.roomId); } catch {}

        sendDiscord(matchNumber).then(async () => {
            setDiscordSent(true);
            setAttachedImage(null);
            setSentMatchNumbers(prev => new Set(prev).add(matchNumber));
            setLastSentMatch(matchNumber);
            toast.success("Sent to Discord 📋");
            setTimeout(() => setDiscordSent(false), 3000);
            // Auto-increment match & update map for next match
            const nextMatch = matchNumber + 1;
            onChange({ copyCount: matchNumber, map: getDefaultMapForMatch(nextMatch) });
            if (nextMatch > maxMatches) setMaxMatches(nextMatch);
        }).catch((err) => {
            toast.error(`Discord: ${err.message || "Failed to send"}`);
        }).finally(() => setDiscordSending(false));
    }, [matchNumber, state.roomId, sendDiscord, generateMessage, onChange, maxMatches]);

    /** Send room info to App (push + channel post) */
    const handleSendApp = useCallback(async () => {
        if (state.roomId.length !== 7) return;
        setAppSending(true);

        fetch("/api/room-info/active", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                roomId: state.roomId.trim(),
                password: state.password,
                map: state.map,
                matchNumber,
                tournamentId: tournament.id,
                tournamentName,
                time: state.time.trim() || "Now",
            }),
        }).then(async (res) => {
            if (!res.ok) throw new Error("Failed");
            setAppSent(true);
            toast.success("Sent to App 🔔");
            setTimeout(() => setAppSent(false), 3000);
        }).catch((err) => {
            toast.error(`App: ${err.message || "Failed to send"}`);
        }).finally(() => setAppSending(false));
    }, [matchNumber, state.roomId, state.password, state.map, state.time, tournament.id, tournamentName]);

    /** Edit the last sent message for a match */
    const handleUpdate = useCallback(async (matchToUpdate: number) => {
        if (state.roomId.length !== 7) return;
        setDiscordEditing(true);
        sendDiscord(matchToUpdate, true).then(() => {
            setDiscordEdited(true);
            setAttachedImage(null);
            setTimeout(() => setDiscordEdited(false), 3000);
        }).catch(async (err) => {
            const { toast } = await import("sonner");
            toast.error(`Update: ${err.message || "Failed to update"}`);
        }).finally(() => setDiscordEditing(false));
    }, [state.roomId, sendDiscord]);

    const handleSendRules = useCallback(async () => {
        if (rulesSending) return;
        setRulesSending(true);
        try {
            const res = await fetch("/api/discord/send-rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tournamentId: tournament.id,
                    tournamentName,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(json.error || "Failed to send rules");
            }
            setRulesSent(true);
            toast.success("Rules sent to Discord!");
            setTimeout(() => setRulesSent(false), 3000);
        } catch (err: any) {
            toast.error(`Failed: ${err.message || "Unknown error"}`);
        } finally {
            setRulesSending(false);
        }
    }, [tournament.id, tournamentName, rulesSending]);

    /** Send room info to WhatsApp group */
    const handleSendWA = useCallback(async () => {
        if (state.roomId.length !== 7) return;
        setWaSending(true);

        const matchNum = matchNumber;
        const waMessage = [
            `🔐 *Match ${matchNum} — ${state.map}*`,
            ``,
            `🆔 Room ID: \`${state.roomId.trim()}\``,
            `🔑 Password: \`${state.password}\``,
            `⏰ Time: ${state.time.trim() || "Now"}`,
            ``,
            `Join now! Lobby closing soon. 🏃‍♂️`,
        ].join("\n");

        fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tournamentId: tournament.id,
                message: waMessage,
                group: group || undefined,
            }),
        }).then(async (res) => {
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            if (json.skipped) {
                toast("No WhatsApp group", { icon: "💬" });
            } else {
                setWaSent(true);
                toast.success("Sent to WhatsApp 💬");
                setTimeout(() => setWaSent(false), 3000);
            }
        }).catch((err) => {
            toast.error(`WhatsApp: ${err.message || "Failed"}`);
        }).finally(() => setWaSending(false));
    }, [matchNumber, state.roomId, state.password, state.map, state.time, tournament.id, group]);

    return (
        <div className="space-y-3">
            {/* Tournament Header */}
            <div className="flex items-center gap-2">
                <span className="text-lg">{typeEmoji}</span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{tournamentName}</p>
                    <p className={`text-[11px] font-medium ${isChamp ? "text-blue-400" : isRanked ? "text-amber-500" : "text-emerald-500"}`}>
                        {typeLabel}
                    </p>
                </div>
                {state.copyCount > 0 && (
                    <button
                        type="button"
                        onClick={resetMatch}
                        className="text-[10px] text-foreground/40 hover:text-foreground/60 transition-colors cursor-pointer px-1.5 py-0.5 rounded bg-default-100 flex items-center gap-1"
                        title="Reset match counter"
                    >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                    </button>
                )}
            </div>

            {/* Row 1: Map + Time */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">Map</label>
                    <Popover placement="bottom-start">
                        <PopoverTrigger>
                            <button
                                type="button"
                                className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm text-left cursor-pointer hover:bg-default-200 transition-colors flex items-center justify-between gap-1"
                            >
                                <span>{state.map}</span>
                                <ChevronDown className="w-3 h-3 text-foreground/40 shrink-0" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="p-1 min-w-[140px]">
                            <div className="flex flex-col">
                                {BGMI_MAPS.map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => onChange({ map: m })}
                                        className={`px-3 py-1.5 text-sm text-left rounded-lg cursor-pointer transition-colors ${
                                            state.map === m
                                                ? "bg-primary/15 text-primary font-medium"
                                                : "hover:bg-default-100 text-foreground"
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="min-w-0">
                    <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">Time</label>
                    <TimeInput
                        value={state.time}
                        onChange={(time) => onChange({ time })}
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
                    <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">
                        Room ID
                        {state.roomId.length > 0 && state.roomId.length !== 7 && (
                            <span className="text-danger ml-1">({state.roomId.length}/7)</span>
                        )}
                        {state.roomId.length === 7 && (
                            <span className="text-emerald-500 ml-1">✓</span>
                        )}
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={state.roomId}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, "");
                            if (val.length <= 7) onChange({ roomId: val });
                        }}
                        placeholder="7 digits"
                        maxLength={7}
                        className={`w-full px-2 py-1.5 rounded-lg bg-default-100 border text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono tracking-wider ${
                            state.roomId.length > 0 && state.roomId.length !== 7
                                ? "border-danger/50"
                                : "border-divider"
                        }`}
                    />
                </div>
            </div>

            {/* Match Selector */}
            <div>
                <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">Match</label>
                <Popover placement="bottom-start" isOpen={matchPickerOpen} onOpenChange={setMatchPickerOpen}>
                    <PopoverTrigger>
                        <button
                            type="button"
                            className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm text-left cursor-pointer hover:bg-default-200 transition-colors flex items-center justify-between gap-1"
                        >
                            <span>Match {matchNumber}</span>
                            <ChevronDown className="w-3 h-3 text-foreground/40 shrink-0" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-1 min-w-[160px]">
                        <div className="flex flex-col max-h-[280px] overflow-y-auto">
                            {Array.from({ length: maxMatches }, (_, i) => i + 1).map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => {
                                        onChange({ copyCount: num - 1, map: getDefaultMapForMatch(num) });
                                        setMatchPickerOpen(false);
                                    }}
                                    className={`px-3 py-1.5 text-sm text-left rounded-lg cursor-pointer transition-colors ${
                                        matchNumber === num
                                            ? "bg-primary/15 text-primary font-medium"
                                            : "hover:bg-default-100 text-foreground"
                                    }`}
                                >
                                    Match {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setMaxMatches(prev => prev + 1)}
                                className="px-3 py-1.5 text-sm text-left rounded-lg cursor-pointer transition-colors text-primary/60 hover:bg-primary/10 flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add match
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Send buttons row */}
            <div className="flex gap-2">
                {/* Send to Discord */}
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={state.roomId.length !== 7 || discordSending}
                    className={`
                        flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                        transition-all duration-200 active:scale-[0.98]
                        ${state.roomId.length !== 7 || discordSending
                            ? "bg-default-200 text-foreground/30 cursor-not-allowed"
                            : discordSent
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 cursor-pointer"
                                : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 cursor-pointer"
                        }
                    `}
                >
                    {discordSending ? (
                        <>
                            <Send className="w-4 h-4 animate-pulse" />
                            Sending...
                        </>
                    ) : discordSent ? (
                        <>
                            <Check className="w-4 h-4" />
                            Discord ✓
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            Discord
                        </>
                    )}
                </button>

                {/* Send to App */}
                <button
                    type="button"
                    onClick={handleSendApp}
                    disabled={state.roomId.length !== 7 || appSending}
                    className={`
                        flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                        transition-all duration-200 active:scale-[0.98]
                        ${state.roomId.length !== 7 || appSending
                            ? "bg-default-200 text-foreground/30 cursor-not-allowed"
                            : appSent
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 cursor-pointer"
                                : isRanked
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 cursor-pointer"
                                    : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 cursor-pointer"
                        }
                    `}
                >
                    {appSending ? (
                        <>
                            <Smartphone className="w-4 h-4 animate-pulse" />
                            Sending...
                        </>
                    ) : appSent ? (
                        <>
                            <Check className="w-4 h-4" />
                            App ✓
                        </>
                    ) : (
                        <>
                            <Smartphone className="w-4 h-4" />
                            App
                        </>
                    )}
                </button>

                {/* Send to WhatsApp */}
                <button
                    type="button"
                    onClick={handleSendWA}
                    disabled={state.roomId.length !== 7 || waSending}
                    className={`
                        flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                        transition-all duration-200 active:scale-[0.98]
                        ${state.roomId.length !== 7 || waSending
                            ? "bg-default-200 text-foreground/30 cursor-not-allowed"
                            : waSent
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 cursor-pointer"
                                : "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 cursor-pointer"
                        }
                    `}
                >
                    {waSending ? (
                        <>
                            <MessageCircle className="w-4 h-4 animate-pulse" />
                            Sending...
                        </>
                    ) : waSent ? (
                        <>
                            <Check className="w-4 h-4" />
                            WA ✓
                        </>
                    ) : (
                        <>
                            <MessageCircle className="w-4 h-4" />
                            WA
                        </>
                    )}
                </button>
            </div>

            {/* Update last sent message */}
            {lastSentMatch !== null && (
                <button
                    type="button"
                    onClick={() => handleUpdate(lastSentMatch)}
                    disabled={state.roomId.length !== 7 || discordEditing}
                    className={`
                        w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium
                        transition-all duration-200 cursor-pointer active:scale-[0.98]
                        ${state.roomId.length !== 7 || discordEditing
                            ? "bg-default-200 text-foreground/30 cursor-not-allowed"
                            : discordEdited
                                ? "bg-blue-500/15 text-blue-500 border border-blue-500/20"
                                : "bg-default-100 text-foreground/60 border border-divider hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20"
                        }
                    `}
                >
                    {discordEditing ? (
                        <>
                            <Pencil className="w-3.5 h-3.5 animate-pulse" />
                            Updating...
                        </>
                    ) : discordEdited ? (
                        <>
                            <Check className="w-3.5 h-3.5" />
                            Updated!
                        </>
                    ) : (
                        <>
                            <Pencil className="w-3.5 h-3.5" />
                            Update Match {lastSentMatch}
                        </>
                    )}
                </button>
            )}

            {/* Send Rules button */}
            <button
                type="button"
                onClick={handleSendRules}
                disabled={rulesSending}
                className={`
                    w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium
                    transition-all duration-200 cursor-pointer active:scale-[0.98]
                    ${rulesSent
                        ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20"
                        : rulesSending
                            ? "bg-default-100 text-foreground/40 border border-divider"
                            : "bg-default-100 text-foreground/60 border border-divider hover:bg-default-200 hover:text-foreground/80"
                    }
                `}
            >
                {rulesSent ? (
                    <>
                        <Check className="w-3.5 h-3.5" />
                        Rules Sent!
                    </>
                ) : rulesSending ? (
                    <>
                        <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
                        Sending Rules...
                    </>
                ) : (
                    <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Send Rules to Discord
                    </>
                )}
            </button>

            {/* Notification Status per Team */}
            <TeamPushStatus tournamentId={tournament.id} />
        </div>
    );
}

/* ─── Team Push Notification Status ─────────────────────────── */

interface TeamPlayer {
    id: string;
    displayName: string;
    avatar: string | null;
    pushEnabled?: boolean;
    hasPush?: boolean;
    deviceCount: number;
}

interface TeamPushData {
    id: string;
    name: string;
    teamNumber: number;
    players: TeamPlayer[];
    pushCount: number;
    totalPlayers: number;
}

interface DeliveryNotification {
    tag: string;
    label: string;
    type: string;
    author?: string;
    createdAt: string | null;
    delivered: number;
    totalWithPush: number;
}

interface DeliveryTeam {
    id: string;
    name: string;
    teamNumber: number;
    players: { id: string; displayName: string; avatar: string | null; hasPush: boolean; deviceCount: number }[];
}

interface DeliveryData {
    notifications: DeliveryNotification[];
    teams: DeliveryTeam[];
    deliveryMatrix: Record<string, Record<string, string>>;
    summary: { totalPlayers: number; totalWithPush: number };
}

function TeamPushStatus({ tournamentId }: { tournamentId: string }) {
    const [expanded, setExpanded] = useState(false);
    const [subTab, setSubTab] = useState<"subs" | "delivery">("delivery");

    // Subscription data
    const { data: subsData, isLoading: subsLoading } = useQuery<{
        teams: TeamPushData[];
        summary: { totalPlayers: number; totalWithPush: number; percentage: number };
    }>({
        queryKey: ["team-push-status", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/push/team-status?tournamentId=${tournamentId}`);
            if (!res.ok) return { teams: [], summary: { totalPlayers: 0, totalWithPush: 0, percentage: 0 } };
            const json = await res.json();
            return json.data;
        },
        staleTime: 60 * 1000,
        enabled: expanded && subTab === "subs",
    });

    // Delivery data
    const { data: deliveryData, isLoading: deliveryLoading } = useQuery<DeliveryData>({
        queryKey: ["push-delivery", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/push/track?tournamentId=${tournamentId}`);
            if (!res.ok) return { notifications: [], teams: [], deliveryMatrix: {}, summary: { totalPlayers: 0, totalWithPush: 0 } };
            const json = await res.json();
            return json.data;
        },
        staleTime: 30 * 1000,
        enabled: expanded && subTab === "delivery",
    });

    const [selectedTag, setSelectedTag] = useState<string>("");
    const notifications = deliveryData?.notifications || [];
    const deliveryTeams = deliveryData?.teams || [];
    const matrix = deliveryData?.deliveryMatrix || {};

    // Auto-select latest notification
    const activeTag = selectedTag || notifications[0]?.tag || "";
    const activeNotif = notifications.find((n) => n.tag === activeTag);
    const tagDeliveries = matrix[activeTag] || {};

    const summary = subsData?.summary;

    return (
        <div className="rounded-xl border border-divider overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground/50 hover:text-foreground/70 hover:bg-default-50 transition-colors cursor-pointer"
            >
                <Bell className="w-3.5 h-3.5" />
                <span>Notifications</span>
                {summary && (
                    <span className={`ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        summary.percentage >= 80
                            ? "bg-emerald-500/15 text-emerald-500"
                            : summary.percentage >= 50
                                ? "bg-amber-500/15 text-amber-500"
                                : "bg-red-500/15 text-red-500"
                    }`}>
                        {summary.totalWithPush}/{summary.totalPlayers} ({summary.percentage}%)
                    </span>
                )}
                {expanded ? (
                    <ChevronUp className={`w-3.5 h-3.5 ${summary ? "" : "ml-auto"}`} />
                ) : (
                    <ChevronDown className={`w-3.5 h-3.5 ${summary ? "" : "ml-auto"}`} />
                )}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-divider">
                            {/* Sub-tabs */}
                            <div className="flex border-b border-divider">
                                {(["delivery", "subs"] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setSubTab(tab)}
                                        className={`flex-1 text-[10px] font-semibold py-1.5 transition-colors cursor-pointer ${
                                            subTab === tab
                                                ? "text-primary border-b-2 border-primary"
                                                : "text-foreground/30 hover:text-foreground/50"
                                        }`}
                                    >
                                        {tab === "delivery" ? "📊 Delivery" : "🔔 Subscribed"}
                                    </button>
                                ))}
                            </div>

                            {/* ── Delivery Tab ── */}
                            {subTab === "delivery" && (
                                <div className="px-3 py-2 space-y-2">
                                    {deliveryLoading ? (
                                        <div className="flex items-center justify-center py-4 gap-2 text-xs text-foreground/30">
                                            <Bell className="w-3.5 h-3.5 animate-pulse" />
                                            Loading...
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <p className="text-xs text-foreground/30 text-center py-3">No delivery data yet</p>
                                    ) : (
                                        <>
                                            {/* Message selector */}
                                            <select
                                                value={activeTag}
                                                onChange={(e) => setSelectedTag(e.target.value)}
                                                className="w-full text-[11px] bg-default-100 border border-divider rounded-lg px-2 py-1.5 text-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                            >
                                                {notifications.map((n) => (
                                                    <option key={n.tag} value={n.tag}>
                                                        {n.label} — {n.delivered}/{n.totalWithPush} delivered
                                                        {n.createdAt ? ` • ${new Date(n.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
                                                    </option>
                                                ))}
                                            </select>

                                            {/* Delivery summary bar */}
                                            {activeNotif && (
                                                <div className="flex items-center gap-2 text-[10px]">
                                                    <span className="text-foreground/40">Delivered:</span>
                                                    <div className="flex-1 h-1.5 bg-default-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full transition-all"
                                                            style={{ width: `${activeNotif.totalWithPush > 0 ? (activeNotif.delivered / activeNotif.totalWithPush) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <span className={`font-bold ${
                                                        activeNotif.delivered >= activeNotif.totalWithPush
                                                            ? "text-emerald-500"
                                                            : activeNotif.delivered > 0
                                                                ? "text-amber-500"
                                                                : "text-red-500"
                                                    }`}>
                                                        {activeNotif.delivered}/{activeNotif.totalWithPush}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Per-team delivery */}
                                            <div className="max-h-64 overflow-y-auto space-y-2">
                                                {deliveryTeams.map((team) => {
                                                    const deliveredInTeam = team.players.filter((p) => tagDeliveries[p.id]).length;
                                                    const withPushInTeam = team.players.filter((p) => p.hasPush).length;
                                                    return (
                                                        <div key={team.id} className="flex items-start gap-2">
                                                            <div className="flex items-center gap-1 min-w-[60px] shrink-0 pt-0.5">
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                                    deliveredInTeam === withPushInTeam && withPushInTeam > 0
                                                                        ? "bg-emerald-500/15 text-emerald-500"
                                                                        : deliveredInTeam > 0
                                                                            ? "bg-amber-500/15 text-amber-500"
                                                                            : "bg-red-500/15 text-red-500"
                                                                }`}>
                                                                    T{team.teamNumber}
                                                                </span>
                                                                <span className="text-[10px] text-foreground/30">
                                                                    {deliveredInTeam}/{withPushInTeam}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {team.players.map((player) => {
                                                                    const status = tagDeliveries[player.id]; // "sent" | "delivered" | "clicked" | undefined
                                                                    const dotColor = status === "clicked"
                                                                        ? "bg-blue-500"
                                                                        : status === "delivered"
                                                                            ? "bg-emerald-500"
                                                                            : status === "sent"
                                                                                ? "bg-amber-500"
                                                                                : player.hasPush
                                                                                    ? "bg-zinc-500"
                                                                                    : "bg-red-500";
                                                                    const dotTitle = status === "clicked"
                                                                        ? "Clicked"
                                                                        : status === "delivered"
                                                                            ? "Delivered"
                                                                            : status === "sent"
                                                                                ? "Sent (push accepted)"
                                                                                : player.hasPush
                                                                                    ? "Not sent"
                                                                                    : "No push subscription";
                                                                    return (
                                                                        <div
                                                                            key={player.id}
                                                                            className="flex items-center gap-1 group"
                                                                            title={`${player.displayName} — ${dotTitle}`}
                                                                        >
                                                                            <div className="relative">
                                                                                {player.avatar ? (
                                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                                    <img
                                                                                        src={player.avatar}
                                                                                        alt=""
                                                                                        className="w-5 h-5 rounded-full object-cover"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="w-5 h-5 rounded-full bg-default-200 flex items-center justify-center text-[8px] font-bold text-foreground/40">
                                                                                        {player.displayName.charAt(0).toUpperCase()}
                                                                                    </div>
                                                                                )}
                                                                                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${dotColor}`} />
                                                                            </div>
                                                                            <span className={`text-[10px] truncate max-w-[60px] ${
                                                                                status ? "text-foreground/60" : "text-foreground/25"
                                                                            }`}>
                                                                                {player.displayName}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Legend */}
                                            <div className="flex flex-wrap gap-3 pt-1 border-t border-divider">
                                                {[
                                                    { color: "bg-blue-500", label: "Clicked" },
                                                    { color: "bg-emerald-500", label: "Delivered" },
                                                    { color: "bg-amber-500", label: "Sent" },
                                                    { color: "bg-red-500", label: "No push" },
                                                ].map((item) => (
                                                    <div key={item.label} className="flex items-center gap-1">
                                                        <span className={`w-2 h-2 rounded-full ${item.color}`} />
                                                        <span className="text-[9px] text-foreground/30">{item.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── Subscriptions Tab ── */}
                            {subTab === "subs" && (
                                <div className="px-3 py-2 space-y-2 max-h-64 overflow-y-auto">
                                    {subsLoading ? (
                                        <div className="flex items-center justify-center py-4 gap-2 text-xs text-foreground/30">
                                            <Bell className="w-3.5 h-3.5 animate-pulse" />
                                            Loading...
                                        </div>
                                    ) : (subsData?.teams || []).length === 0 ? (
                                        <p className="text-xs text-foreground/30 text-center py-3">No teams found</p>
                                    ) : (
                                        (subsData?.teams || []).map((team) => (
                                            <div key={team.id} className="flex items-start gap-2">
                                                <div className="flex items-center gap-1 min-w-[60px] shrink-0 pt-0.5">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                        team.pushCount === team.totalPlayers
                                                            ? "bg-emerald-500/15 text-emerald-500"
                                                            : team.pushCount > 0
                                                                ? "bg-amber-500/15 text-amber-500"
                                                                : "bg-red-500/15 text-red-500"
                                                    }`}>
                                                        T{team.teamNumber}
                                                    </span>
                                                    <span className="text-[10px] text-foreground/30">
                                                        {team.pushCount}/{team.totalPlayers}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {team.players.map((player) => (
                                                        <div
                                                            key={player.id}
                                                            className="flex items-center gap-1 group"
                                                            title={`${player.displayName} — ${player.pushEnabled ? `${player.deviceCount} device(s)` : "No push"}`}
                                                        >
                                                            <div className="relative">
                                                                {player.avatar ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img
                                                                        src={player.avatar}
                                                                        alt=""
                                                                        className="w-5 h-5 rounded-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-5 h-5 rounded-full bg-default-200 flex items-center justify-center text-[8px] font-bold text-foreground/40">
                                                                        {player.displayName.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${
                                                                    player.pushEnabled ? "bg-emerald-500" : "bg-red-500"
                                                                }`} />
                                                            </div>
                                                            <span className={`text-[10px] truncate max-w-[60px] ${
                                                                player.pushEnabled ? "text-foreground/60" : "text-foreground/25"
                                                            }`}>
                                                                {player.displayName}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ─── Rules Editor (shared across tournaments) ──────────────── */

interface SavedRule {
    id: string;
    text: string;
    imageUrl?: string;
}

export function RulesEditor() {
    const [rules, setRules] = useState<SavedRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Load saved rules on mount
    useEffect(() => {
        fetch("/api/settings/tournament-rules")
            .then(r => r.json())
            .then(json => setRules(json.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const addRule = () => {
        setRules(prev => [...prev, { id: crypto.randomUUID(), text: "" }]);
        setDirty(true);
    };

    const removeRule = (idx: number) => {
        setRules(prev => prev.filter((_, i) => i !== idx));
        setDirty(true);
    };

    const updateRuleText = (idx: number, text: string) => {
        setRules(prev => prev.map((r, i) => i === idx ? { ...r, text } : r));
        setDirty(true);
    };

    const handleImageUpload = async (idx: number, file: File) => {
        setUploadingIdx(idx);
        try {
            const formData = new FormData();
            formData.append("image", file);
            const res = await fetch("/api/settings/tournament-rules", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) throw new Error("Upload failed");
            const json = await res.json();
            setRules(prev => prev.map((r, i) => i === idx ? { ...r, imageUrl: json.data.imageUrl } : r));
            setDirty(true);
            toast.success("Image uploaded!");
        } catch {
            toast.error("Failed to upload image");
        } finally {
            setUploadingIdx(null);
        }
    };

    const removeImage = (idx: number) => {
        setRules(prev => prev.map((r, i) => i === idx ? { ...r, imageUrl: undefined } : r));
        setDirty(true);
    };

    const saveRules = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings/tournament-rules", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rules: rules.filter(r => r.text.trim()) }),
            });
            if (!res.ok) throw new Error("Failed to save");
            const json = await res.json();
            setRules(json.data);
            setDirty(false);
            toast.success("Rules saved!");
        } catch {
            toast.error("Failed to save rules");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="text-[11px] text-foreground/40 text-center py-2">Loading rules...</p>;
    }

    return (
        <div className="space-y-2">
            {rules.map((rule, idx) => (
                <div key={rule.id} className="rounded-lg border border-divider bg-default-50 p-2 space-y-1.5">
                    <div className="flex items-start gap-1.5">
                        <span className="text-[10px] font-bold text-foreground/30 mt-1.5 shrink-0 w-4 text-center">{idx + 1}</span>
                        <textarea
                            value={rule.text}
                            onChange={(e) => updateRuleText(idx, e.target.value)}
                            placeholder="Type your rule here..."
                            rows={3}
                            className="flex-1 text-xs bg-transparent border-none outline-none resize-none text-foreground placeholder:text-foreground/30"
                        />
                        <button
                            type="button"
                            onClick={() => removeRule(idx)}
                            className="text-danger/50 hover:text-danger transition-colors cursor-pointer p-0.5"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Image preview + upload */}
                    {rule.imageUrl ? (
                        <div className="relative rounded-md overflow-hidden border border-divider">
                            <img src={rule.imageUrl} alt="Rule" className="w-full max-h-24 object-cover" />
                            <button
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 cursor-pointer hover:bg-black/80"
                            >
                                <Trash2 className="w-2.5 h-2.5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRefs.current[idx]?.click()}
                            disabled={uploadingIdx === idx}
                            className="flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground/60 transition-colors cursor-pointer"
                        >
                            <ImagePlus className="w-3 h-3" />
                            {uploadingIdx === idx ? "Uploading..." : "Add image"}
                        </button>
                    )}
                    <input
                        ref={(el) => { fileInputRefs.current[idx] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(idx, file);
                            e.target.value = "";
                        }}
                    />
                </div>
            ))}

            {/* Add + Save buttons */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={addRule}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-divider text-[11px] text-foreground/40 hover:text-foreground/60 hover:border-foreground/20 transition-colors cursor-pointer"
                >
                    <Plus className="w-3 h-3" />
                    Add Rule
                </button>
                {dirty && (
                    <button
                        type="button"
                        onClick={saveRules}
                        disabled={saving}
                        className="flex items-center justify-center gap-1 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium cursor-pointer hover:opacity-90 transition-opacity"
                    >
                        <Save className="w-3 h-3" />
                        {saving ? "Saving..." : "Save"}
                    </button>
                )}
            </div>
        </div>
    );
}

interface RoomInfoGeneratorProps {
    /** Skip the collapsible card wrapper — render content directly */
    alwaysExpanded?: boolean;
    /** Hide the rules editor section (when rules are shown separately) */
    hideRulesEditor?: boolean;
}

export function RoomInfoGenerator({ alwaysExpanded = false, hideRulesEditor = false }: RoomInfoGeneratorProps = {}) {
    const [isOpen, setIsOpen] = useState(alwaysExpanded);
    const [rulesEditorOpen, setRulesEditorOpen] = useState(false);
    const getDefaultTime = () => "8:00 PM";

    // Fetch in-play tournaments independently
    const { data: tournaments = [] } = useQuery<InPlayTournament[]>({
        queryKey: ["tournaments-in-play"],
        queryFn: async () => {
            const res = await fetch("/api/tournaments/in-play");
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 60 * 1000,
    });

    // Load persisted states from localStorage
    const [states, setStates] = useState<Record<string, TournamentState>>(() => {
        if (typeof window === "undefined") return {};
        try {
            const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}") as Record<string, PersistedTournamentState>;
            const initial: Record<string, TournamentState> = {};
            for (const [id, data] of Object.entries(saved)) {
                if (data && typeof data === "object") {
                    initial[id] = {
                        time: data.time || getDefaultTime(),
                        password: data.password || "m",
                        roomId: "",
                        map: getDefaultMapForMatch((data.copyCount ?? 0) + 1),
                        copyCount: data.copyCount ?? 0,
                    };
                }
            }
            return initial;
        } catch {
            return {};
        }
    });

    // Persist to localStorage
    useEffect(() => {
        const persisted: Record<string, PersistedTournamentState> = {};
        for (const [id, state] of Object.entries(states)) {
            if (state.copyCount > 0 || state.time) {
                persisted[id] = {
                    time: state.time,
                    password: state.password,
                    copyCount: state.copyCount,
                };
            }
        }
        try { localStorage.setItem(LS_KEY, JSON.stringify(persisted)); } catch { }
    }, [states]);

    const getDefaultState = (): TournamentState => ({
        time: getDefaultTime(), password: "m", roomId: "", map: "Erangel", copyCount: 0,
    });

    const getState = (id: string): TournamentState => {
        return states[id] ?? getDefaultState();
    };

    const updateState = (id: string, update: Partial<TournamentState>) => {
        setStates((prev) => {
            const current = prev[id] ?? getDefaultState();
            return { ...prev, [id]: { ...current, ...update } };
        });
    };

    if (tournaments.length === 0) {
        if (alwaysExpanded) {
            return (
                <div className="rounded-xl border border-divider bg-default-50 p-6 text-center">
                    <KeyRound className="w-8 h-8 text-foreground/20 mx-auto mb-2" />
                    <p className="text-sm text-foreground/40">No active tournaments</p>
                    <p className="text-xs text-foreground/25 mt-1">Room info will appear here when a tournament is in play</p>
                </div>
            );
        }
        return null;
    }

    // Content shared between card and standalone modes
    const content = (
        <div className="space-y-4">
            {tournaments.map((t, i) => {
                // Championship with groups: render one row per group
                if (t.isChampionship && t.groups.length > 0) {
                    return t.groups.map((group, gi) => {
                        const stateKey = `${t.id}__group_${group}`;
                        return (
                            <div key={stateKey}>
                                {(i > 0 || gi > 0) && <div className="border-t border-divider my-3" />}
                                <TournamentRow
                                    tournament={t}
                                    state={getState(stateKey)}
                                    onChange={(update) => updateState(stateKey, update)}
                                    group={group}
                                />
                            </div>
                        );
                    });
                }

                // Regular tournament: single row
                return (
                    <div key={t.id}>
                        {i > 0 && <div className="border-t border-divider my-3" />}
                        <TournamentRow
                            tournament={t}
                            state={getState(t.id)}
                            onChange={(update) => updateState(t.id, update)}
                        />
                    </div>
                );
            })}

            {/* Rules Section — only in card mode */}
            {!hideRulesEditor && (
                <div className="border-t border-divider pt-3">
                    <button
                        type="button"
                        onClick={() => setRulesEditorOpen(!rulesEditorOpen)}
                        className="w-full flex items-center justify-between text-xs text-foreground/50 hover:text-foreground/70 transition-colors cursor-pointer mb-2"
                    >
                        <span className="flex items-center gap-1.5 font-medium">
                            <Pencil className="w-3 h-3" />
                            Tournament Rules
                        </span>
                        {rulesEditorOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <AnimatePresence>
                        {rulesEditorOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                            >
                                <RulesEditor />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );

    // Standalone mode — no card wrapper
    if (alwaysExpanded) {
        return content;
    }

    // Card mode — collapsible (used on vote page)
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
                        {tournaments.length} in play
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
                        <CardBody className="px-4 pt-0 pb-4">
                            {content}
                        </CardBody>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
