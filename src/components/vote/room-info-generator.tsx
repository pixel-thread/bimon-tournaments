"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Copy, Check, ChevronDown, ChevronUp, KeyRound, RotateCcw, Send, ShieldAlert, Pencil, Trash2, ImagePlus, Plus, Save, Camera, X } from "lucide-react";
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

/* ─── Alternating map for each match ─── */
function getDefaultMapForMatch(matchNumber: number): string {
    // Odd matches: Erangel, Even matches: Miramar
    return matchNumber % 2 === 1 ? "Erangel" : "Miramar";
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
}

interface TournamentState {
    time: string; // 24h "HH:MM" internal format
    password: string;
    roomId: string;
    map: string;
    copyCount: number;
    justCopied: boolean;
}

interface PersistedTournamentState {
    time: string;
    password: string;
    copyCount: number;
}

const LS_KEY = "room-info-states";

/* ─── Per-Tournament Row ────────────────────────────────────── */

function TournamentRow({ tournament, state, onChange }: {
    tournament: InPlayTournament;
    state: TournamentState;
    onChange: (update: Partial<TournamentState>) => void;
}) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isRanked = tournament.allowSquads;
    const typeEmoji = isRanked ? "🏆" : "🎮";
    const typeLabel = isRanked ? "RANKED" : "CASUAL";
    const tournamentName = tournament.name;
    const matchNumber = state.copyCount + 1;

    // Time editing state
    const [timeEditing, setTimeEditing] = useState(false);
    const [timeInput, setTimeInput] = useState("");
    const timeInputRef = useRef<HTMLInputElement>(null);
    const [discordSending, setDiscordSending] = useState(false);
    const [discordSent, setDiscordSent] = useState(false);
    const [rulesSending, setRulesSending] = useState(false);
    const [rulesSent, setRulesSent] = useState(false);
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const startEditingTime = () => {
        setTimeInput(state.time ? formatTimeDisplay(state.time) : "");
        setTimeEditing(true);
        setTimeout(() => timeInputRef.current?.focus(), 50);
    };

    const commitTime = () => {
        setTimeEditing(false);
        const parsed = parse12hTo24h(timeInput.trim());
        if (parsed) {
            onChange({ time: parsed });
        }
    };

    const generateMessage = useCallback((matchNum: number) => {
        const divider = "━━━━━━━━━━━━━━━";
        const lines = [
            `${typeEmoji} ${toBold(typeLabel + " TOURNAMENT")}`,
            divider,
            `🎯 ${tournamentName}`,
            `🗺️ Map: ${state.map}`,
            `🕐 Match ${matchNum} — ${formatTimeDisplay(state.time)}`,
            `🔐 Room ID: ${state.roomId.trim() || ""}`,
            `🔑 Password: ${state.password}`,
            divider,
            `${GAME.gameName} × Bimon Tournament`,
            `✨ All the best! 💪`,
        ];
        return lines.join("\n");
    }, [state.roomId, state.time, state.password, state.map, typeEmoji, typeLabel, tournamentName]);

    const resetMatch = useCallback(() => {
        onChange({ copyCount: 0, map: "Erangel" });
    }, [onChange]);

    const sendDiscord = useCallback(async (matchNum: number) => {
        const res = await fetch("/api/discord/send-room-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tournamentId: tournament.id,
                tournamentName,
                matchNumber: matchNum,
                map: state.map,
                time: formatTimeDisplay(state.time),
                roomId: state.roomId.trim(),
                password: state.password,
                gameName: GAME.gameName,
                image: attachedImage || undefined,
            }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(json.error || `Discord send failed (${res.status})`);
        }
    }, [tournament.id, tournamentName, state.map, state.time, state.roomId, state.password, attachedImage]);

    /** One tap: copies to clipboard (WhatsApp) + auto-sends to Discord */
    const handleCopyAndSend = useCallback(async () => {
        const nextMatch = state.copyCount + 1;
        const message = generateMessage(nextMatch);
        const nextMap = getDefaultMapForMatch(nextMatch + 1);

        // 1. Copy to clipboard
        try {
            await navigator.clipboard.writeText(message);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = message;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }

        onChange({ copyCount: nextMatch, justCopied: true, map: nextMap });

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onChange({ justCopied: false });
        }, 2000);

        // 2. Auto-send to Discord (fire-and-forget)
        if (state.password) {
            setDiscordSending(true);
            sendDiscord(nextMatch).then(() => {
                setDiscordSent(true);
                setAttachedImage(null); // Clear image after successful send
                setTimeout(() => setDiscordSent(false), 3000);
            }).catch(async (err) => {
                const { toast } = await import("sonner");
                toast.error(`Discord: ${err.message || "Failed to send"}`);
            }).finally(() => setDiscordSending(false));
        }
    }, [generateMessage, state.copyCount, state.password, onChange, sendDiscord]);

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
                <div>
                    <label className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1 block">Time</label>
                    {timeEditing ? (
                        <input
                            ref={timeInputRef}
                            type="text"
                            value={timeInput}
                            onChange={(e) => setTimeInput(e.target.value)}
                            onBlur={commitTime}
                            onKeyDown={(e) => { if (e.key === "Enter") commitTime(); }}
                            placeholder="8:00 PM"
                            className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={startEditingTime}
                            className="w-full px-2 py-1.5 rounded-lg bg-default-100 border border-divider text-sm text-left cursor-pointer hover:bg-default-200 transition-colors"
                        >
                            {state.time ? formatTimeDisplay(state.time) : <span className="text-foreground/30">8:00 PM</span>}
                        </button>
                    )}
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

            {/* Single button: Copy + Send to Discord */}
            <button
                type="button"
                onClick={handleCopyAndSend}
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
                        Copied Match {state.copyCount}!{discordSent && " + Sent to Discord"}
                    </>
                ) : (
                    <>
                        <Copy className="w-4 h-4" />
                        {`Copy & Send Match ${matchNumber}`}
                    </>
                )}
            </button>

            {/* Match counter indicator */}
            {state.copyCount > 0 && (
                <p className="text-[11px] text-center text-foreground/40">
                    {state.copyCount} match{state.copyCount !== 1 ? "es" : ""} copied • Next: Match {state.copyCount + 1}
                </p>
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
    // Default time = now + 10 minutes
    const getDefaultTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 10);
        return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    };

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
                        justCopied: false,
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
        time: getDefaultTime(), password: "m", roomId: "", map: "Erangel", copyCount: 0, justCopied: false,
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
            {tournaments.map((t, i) => (
                <div key={t.id}>
                    {i > 0 && <div className="border-t border-divider my-3" />}
                    <TournamentRow
                        tournament={t}
                        state={getState(t.id)}
                        onChange={(update) => updateState(t.id, update)}
                    />
                </div>
            ))}

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
