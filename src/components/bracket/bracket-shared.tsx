"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar, Chip } from "@heroui/react";
import { Trophy, Clock, AlertTriangle, CheckCircle2, Minus, Eye, ZoomIn, ZoomOut, Phone } from "lucide-react";
import { motion } from "framer-motion";

/* ─── Zoom ───────────────────────────────────────────── */

/**
 * Handles button +/-, trackpad pinch (Ctrl+wheel) and
 * two-finger touch pinch on the returned containerRef.
 */
export function usePinchZoom(initial = 1, min = 0.4, max = 1.5) {
    const [zoom, setZoom] = useState(initial);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastDistRef = useRef<number | null>(null);

    const clamp = (v: number) => +Math.min(max, Math.max(min, v)).toFixed(2);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        // Trackpad pinch: browser fires wheel + ctrlKey
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            // deltaY is positive = pinch in (zoom out), negative = spread (zoom in)
            const delta = e.deltaY * -0.005;
            setZoom(z => clamp(z + delta));
        };

        // Two-finger touch pinch
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (lastDistRef.current !== null) {
                const ratio = dist / lastDistRef.current;
                setZoom(z => clamp(z * ratio));
            }
            lastDistRef.current = dist;
        };

        const onTouchEnd = () => { lastDistRef.current = null; };

        // Must be { passive: false } to allow preventDefault()
        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd);
        return () => {
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const step = 0.15;
    const zoomIn = () => setZoom(z => clamp(z + step));
    const zoomOut = () => setZoom(z => clamp(z - step));
    const reset = () => setZoom(initial);
    return { zoom, zoomIn, zoomOut, reset, containerRef };
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
}) {
    return (
        <div className="flex items-center gap-1 bg-default-100 rounded-xl px-2 py-1 select-none">
            <button
                onClick={onZoomOut}
                className="p-1 rounded-lg hover:bg-default-200 active:scale-90 transition-all disabled:opacity-30"
                disabled={zoom <= 0.4}
                aria-label="Zoom out"
            >
                <ZoomOut className="h-3.5 w-3.5 text-foreground/60" />
            </button>
            <button
                onClick={onReset}
                className="text-[10px] font-bold text-foreground/50 min-w-[36px] text-center hover:text-foreground/80 transition-colors"
                aria-label="Reset zoom"
            >
                {Math.round(zoom * 100)}%
            </button>
            <button
                onClick={onZoomIn}
                className="p-1 rounded-lg hover:bg-default-200 active:scale-90 transition-all disabled:opacity-30"
                disabled={zoom >= 1.5}
                aria-label="Zoom in"
            >
                <ZoomIn className="h-3.5 w-3.5 text-foreground/60" />
            </button>
        </div>
    );
}

/* ─── Shared Types ───────────────────────────────────────────── */

export interface BracketPlayer {
    id: string;
    displayName: string | null;
    phoneNumber?: string | null;
    userId?: string;
}

export interface BracketMatchResult {
    id: string;
    submittedById: string;
    claimedScore1: number;
    claimedScore2: number;
    screenshotUrl: string | null;
    notes: string | null;
    isDispute: boolean;
    createdAt: string;
}

export interface BracketMatchData {
    id: string;
    round: number;
    position: number;
    player1Id: string | null;
    player2Id: string | null;
    team1Id?: string | null;
    team2Id?: string | null;
    winnerId: string | null;
    winnerTeamId?: string | null;
    score1: number | null;
    score2: number | null;
    status: "PENDING" | "SUBMITTED" | "DISPUTED" | "CONFIRMED" | "BYE";
    disputeDeadline: string | null;
    disputeRemainingMs: number | null;
    createdAt: string | null;
    player1: BracketPlayer | null;
    player2: BracketPlayer | null;
    team1?: { id: string; name: string; players?: { displayName: string | null }[] } | null;
    team2?: { id: string; name: string; players?: { displayName: string | null }[] } | null;
    player1Avatar: string | null;
    player2Avatar: string | null;
    winner: { id: string; displayName: string | null } | null;
    results: BracketMatchResult[];
}

export interface RoundData {
    round: number;
    name: string;
    matches: BracketMatchData[];
}

/* ─── Status Config ─────────────────────────────────────────── */

export function statusConfig(status: BracketMatchData["status"]) {
    switch (status) {
        case "PENDING": return { color: "default" as const, icon: Clock, label: "Pending" };
        case "SUBMITTED": return { color: "warning" as const, icon: Clock, label: "Awaiting Confirmation" };
        case "DISPUTED": return { color: "danger" as const, icon: AlertTriangle, label: "Disputed" };
        case "CONFIRMED": return { color: "success" as const, icon: CheckCircle2, label: "Confirmed" };
        case "BYE": return { color: "secondary" as const, icon: Minus, label: "Bye" };
    }
}

/* ─── Player Slot (vertical card row) ───────────────────────── */

export function PlayerSlot({
    player, avatar, score, isWinner, isCurrent, isBye, onCall, calling, onWhatsApp, team,
}: {
    player: BracketPlayer | null;
    avatar: string | null;
    score: number | null;
    isWinner: boolean;
    isCurrent: boolean;
    isBye: boolean;
    onCall?: () => void;
    calling?: boolean;
    onWhatsApp?: () => void;
    team?: { id: string; name: string } | null;
}) {
    if (!player && !team) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-default-100/50">
                <div className="h-6 w-6 rounded-full bg-default-200" />
                <span className="text-xs text-foreground/30 italic">TBD</span>
            </div>
        );
    }
    const displayName = team?.name ?? player?.displayName;
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isWinner ? "bg-success-50 dark:bg-success-50/10 border border-success-200 dark:border-success-800"
            : isCurrent ? "bg-primary-50 dark:bg-primary-50/10 border border-primary-200 dark:border-primary-800"
                : "bg-default-100/50"
            }`}>
            <Avatar src={avatar || undefined} name={displayName?.[0] || "?"} size="sm" className="h-6 w-6 text-tiny" />
            <span className={`text-xs font-medium flex-1 truncate ${isWinner ? "text-success-700 dark:text-success-400" : ""}`}>
                {displayName || "Unknown"}
                {team && <span className="text-[10px] text-foreground/30 ml-1">⚔</span>}
                {isCurrent && <span className="text-primary text-[10px] ml-1">(You)</span>}
            </span>
            {score !== null && (
                <span className={`text-sm font-bold tabular-nums ${isWinner ? "text-success-600 dark:text-success-400" : "text-foreground/60"}`}>
                    {score}
                </span>
            )}
            {isWinner && <Trophy className="h-3.5 w-3.5 text-success-500 shrink-0" />}
            {isBye && <Chip size="sm" variant="flat" color="secondary" className="text-[10px] h-4">BYE</Chip>}
            {/* WhatsApp button */}
            {onWhatsApp && (
                <button
                    onClick={onWhatsApp}
                    title="WhatsApp opponent"
                    className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500/15 hover:bg-green-500/30 active:scale-95 transition-all shrink-0"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5 text-green-500">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                </button>
            )}
            {/* Call button — only shown on the opponent's row */}
            {onCall && (
                <button
                    onClick={onCall}
                    disabled={calling}
                    title="Call opponent"
                    data-onboarding="call-opponent"
                    className="flex items-center justify-center h-5 w-5 rounded-full bg-success/15 hover:bg-success/30 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                >
                    {calling
                        ? <span className="h-2.5 w-2.5 border-2 border-success/40 border-t-success rounded-full animate-spin" />
                        : <Phone className="h-2.5 w-2.5 text-success" />}
                </button>
            )}
        </div>
    );
}

/* ─── Match Card (full vertical card, for "My Match") ─────────── */

export function MatchCard({
    match, currentPlayerId, onSubmitResult, onConfirmResult, onDispute, onViewResult, deadlineHours, rolloverDeadlineMs, rolloverRoundLabel, matchRoundLabel, cutoffTime, tournamentName,
}: {
    match: BracketMatchData;
    currentPlayerId?: string;
    onSubmitResult?: (id: string) => void;
    onConfirmResult?: (id: string) => void;
    onDispute?: (id: string) => void;
    onViewResult?: (id: string) => void;
    deadlineHours?: number;   // fallback per-match deadline
    rolloverDeadlineMs?: number;  // rollover-based deadline timestamp
    rolloverRoundLabel?: string;  // e.g. "Quarter-Final" — for deadline display
    matchRoundLabel?: string;     // e.g. "Group A" — match-specific, for WhatsApp msg
    cutoffTime?: string;  // e.g. "05:30" IST — snap deadlines to this time
    tournamentName?: string;
}) {
    const config = statusConfig(match.status);
    const StatusIcon = config.icon;
    const isCurrentP1 = currentPlayerId === match.player1Id;
    const isCurrentP2 = currentPlayerId === match.player2Id;
    const isParticipant = isCurrentP1 || isCurrentP2;
    const canSubmit = isParticipant && match.status === "PENDING" && match.player1Id && match.player2Id;
    const canRaiseDispute = isParticipant && match.status === "SUBMITTED" && match.winnerId !== currentPlayerId;
    const canEditSubmitted = isParticipant && match.status === "SUBMITTED" && match.winnerId === currentPlayerId;
    const hasResult = match.status === "CONFIRMED" || match.status === "SUBMITTED";
    const isDisputed = match.status === "DISPUTED";
    const [callingOpponent, setCallingOpponent] = useState(false);
    const [now, setNow] = useState(Date.now());

    // Live tick for rollover countdown
    useEffect(() => {
        if (!rolloverDeadlineMs || match.status !== "PENDING") return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [rolloverDeadlineMs, match.status]);

    async function callOpponent() {
        const opponentPhone = isCurrentP1
            ? match.player2?.phoneNumber
            : match.player1?.phoneNumber;

        if (opponentPhone) {
            window.location.href = `tel:${opponentPhone}`;
            return;
        }

        setCallingOpponent(true);
        try {
            const res = await fetch(`/api/bracket-matches/${match.id}/opponent-phone`);
            const json = await res.json();
            const phone: string | null = json.data?.phoneNumber ?? null;
            if (!phone) {
                const { toast } = await import("sonner");
                toast.error("Opponent hasn't added their phone number yet");
                return;
            }
            window.location.href = `tel:${phone}`;
        } catch {
            const { toast } = await import("sonner");
            toast.error("Could not fetch opponent's number");
        } finally {
            setCallingOpponent(false);
        }
    }

    function whatsAppOpponent() {
        const opponentPhone = isCurrentP1
            ? match.player2?.phoneNumber
            : match.player1?.phoneNumber;
        if (!opponentPhone) return;
        const cleanPhone = opponentPhone.replace(/[^\d]/g, "");
        const myName = isCurrentP1
            ? match.player1?.displayName || "player"
            : match.player2?.displayName || "player";
        const groupLabel = matchRoundLabel || rolloverRoundLabel || "tournament";
        const msg = encodeURIComponent(
            `Nga u ${myName} la ${groupLabel} ia noh pyndep noh ka match jong ka ${tournamentName || "tournament"}`
        );
        window.open(`https://wa.me/${cleanPhone}?text=${msg}`, "_blank");
    }

    const opponentHasPhone = isCurrentP1
        ? !!match.player2?.phoneNumber
        : !!match.player1?.phoneNumber;

    // Rollover countdown (preferred) or fallback to per-match deadline
    const deadlineLabel = (() => {
        if (match.status !== "PENDING" || !match.player1Id || !match.player2Id) return null;
        if (rolloverDeadlineMs) {
            const diff = rolloverDeadlineMs - now;
            if (diff <= 0) return { text: "Time's up", urgent: true, ticking: true };
            const h = Math.floor(diff / 3600_000);
            const m = Math.floor((diff % 3600_000) / 60_000);
            const s = Math.floor((diff % 60_000) / 1000);
            const pad = (n: number) => String(n).padStart(2, "0");
            const urgent = h < 2;
            const text = h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : m > 0 ? `${m}m ${pad(s)}s` : `${s}s`;
            return { text, urgent, ticking: true };
        }
        if (!match.createdAt || !deadlineHours) return null;
        // Snap to cutoff time if configured
        const rawDeadline = new Date(match.createdAt).getTime() + deadlineHours * 3600_000;
        let deadlineMs = rawDeadline;
        if (cutoffTime) {
            const [hIST, mIST] = cutoffTime.split(":").map(Number);
            const totalUTCMin = ((hIST * 60 + mIST - 330) % 1440 + 1440) % 1440;
            const snapped = new Date(rawDeadline);
            snapped.setUTCHours(Math.floor(totalUTCMin / 60), totalUTCMin % 60, 0, 0);
            if (snapped.getTime() <= rawDeadline) snapped.setUTCDate(snapped.getUTCDate() + 1);
            deadlineMs = snapped.getTime();
        }
        const msLeft = deadlineMs - now;
        if (msLeft <= 0) return { text: "Deadline passed", urgent: true, ticking: false };
        const h = Math.floor(msLeft / 3600_000);
        const m = Math.floor((msLeft % 3600_000) / 60_000);
        const s = Math.floor((msLeft % 60_000) / 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        const urgent = h < 6;
        const text = h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : m > 0 ? `${m}m ${pad(s)}s` : `${s}s`;
        return { text, urgent, ticking: true };
    })();

    const borderClass =
        isDisputed ? "border-warning/60 shadow-md shadow-warning/10" :
            isParticipant && match.status === "PENDING" && match.player1Id && match.player2Id
                ? "border-primary shadow-md shadow-primary/10"
                : "border-divider";

    return (
        <div className={`border rounded-2xl transition-all bg-content1 ${borderClass}`}>
            <div className="p-3 space-y-2">
                <PlayerSlot
                    player={match.player1} avatar={match.player1Avatar} score={match.score1}
                    isWinner={match.winnerId === match.player1Id} isCurrent={isCurrentP1}
                    isBye={match.status === "BYE" && !match.player2Id}
                    onCall={isCurrentP2 && match.player1Id ? callOpponent : undefined}
                    calling={isCurrentP2 ? callingOpponent : false}
                    onWhatsApp={isCurrentP2 && match.player1Id && opponentHasPhone ? whatsAppOpponent : undefined}
                    team={match.team1}
                />
                <div className="flex items-center gap-2 px-2">
                    <div className="flex-1 h-px bg-divider" />
                    <span className="text-[10px] text-foreground/30 font-medium">VS</span>
                    <div className="flex-1 h-px bg-divider" />
                </div>
                <PlayerSlot
                    player={match.player2} avatar={match.player2Avatar} score={match.score2}
                    isWinner={match.winnerId === match.player2Id} isCurrent={isCurrentP2}
                    isBye={match.status === "BYE" && !match.player1Id}
                    onCall={isCurrentP1 && match.player2Id ? callOpponent : undefined}
                    calling={isCurrentP1 ? callingOpponent : false}
                    onWhatsApp={isCurrentP1 && match.player2Id && opponentHasPhone ? whatsAppOpponent : undefined}
                    team={match.team2}
                />
                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                        {/* For SUBMITTED with countdown: single merged chip */}
                        {match.status === "SUBMITTED" && match.disputeRemainingMs != null ? (
                            <Chip size="sm" variant="flat" color={match.disputeRemainingMs <= 0 ? "success" : "warning"} startContent={<StatusIcon className="h-3 w-3" />} className="text-[10px]" suppressHydrationWarning>
                                {match.disputeRemainingMs <= 0 ? "Auto-confirming…" : `Awaiting · ${(() => { const mins = Math.ceil(match.disputeRemainingMs / 60_000); const d = Math.floor(mins / 1440); const h = Math.floor((mins % 1440) / 60); const m = mins % 60; return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" "); })() } left`}
                            </Chip>
                        ) : (
                            <Chip size="sm" variant="flat" color={config.color} startContent={<StatusIcon className="h-3 w-3" />} className="text-[10px]">
                                {config.label}
                            </Chip>
                        )}
                        {/* Resolution reason for confirmed matches */}
                        {match.status === "CONFIRMED" && (() => {
                            const lastNotes = match.results?.[0]?.notes?.toLowerCase() ?? "";
                            if (lastNotes.includes("auto-forfeit")) return <span className="text-[9px] font-medium text-danger/70 bg-danger/10 px-1.5 py-0.5 rounded-full">Auto-forfeit</span>;
                            if (lastNotes.includes("auto-confirmed") || lastNotes.includes("auto-confirm")) return <span className="text-[9px] font-medium text-warning/70 bg-warning/10 px-1.5 py-0.5 rounded-full">Auto-confirmed</span>;
                            if (lastNotes.includes("walkover")) return <span className="text-[9px] font-medium text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full">Walkover</span>;
                            if (lastNotes.includes("confirmed by admin")) return <span className="text-[9px] font-medium text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full">Admin confirmed</span>;
                            if (lastNotes.includes("confirmed by")) {
                                const raw = match.results?.[0]?.notes ?? "";
                                const name = raw.replace(/^confirmed by /i, "").trim();
                                return <span className="text-[9px] font-medium text-success/70 bg-success/10 px-1.5 py-0.5 rounded-full">✓ {name}</span>;
                            }
                            return null;
                        })()}
                        {/* Deadline countdown for PENDING matches */}
                        {deadlineLabel && (
                            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${deadlineLabel.urgent ? "text-danger animate-pulse" : "text-foreground/40"
                                }`} suppressHydrationWarning>
                                <Clock className="h-2.5 w-2.5" />
                                {deadlineLabel.ticking ? (
                                    <span className="tabular-nums font-mono font-bold">{deadlineLabel.text}</span>
                                ) : deadlineLabel.text}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {canSubmit && onSubmitResult && (
                            <button data-onboarding="submit-result" onClick={() => onSubmitResult(match.id)} className="text-[11px] font-semibold text-primary hover:text-primary-600 transition-colors">
                                Submit Result →
                            </button>
                        )}
                        {/* Opponent already submitted — user can submit their own score to raise a dispute */}
                        {canRaiseDispute && onSubmitResult && (
                            <button
                                data-onboarding="raise-dispute"
                                onClick={() => onSubmitResult(match.id)}
                                className="text-[11px] font-semibold text-warning-500 hover:text-warning-400 transition-colors flex items-center gap-1"
                                title="Submit your score to raise a dispute"
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-warning-400 inline-block" />
                                Raise Dispute →
                            </button>
                        )}
                        {canRaiseDispute && onConfirmResult && (
                            <button data-onboarding="confirm-result" onClick={() => onConfirmResult(match.id)} className="text-[11px] font-semibold text-success hover:text-success-600 transition-colors">
                                ✓ Confirm
                            </button>
                        )}
                        {hasResult && !canRaiseDispute && !canEditSubmitted && onViewResult && (
                            <button onClick={() => onViewResult(match.id)} className="text-[11px] font-semibold text-foreground/50 hover:text-foreground/80 transition-colors">
                                View Result →
                            </button>
                        )}
                        {canEditSubmitted && onSubmitResult && (
                            <button onClick={() => onSubmitResult(match.id)} className="text-[11px] font-semibold text-primary hover:text-primary-600 transition-colors">
                                Edit Result →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Compact Match (bracket tree node) ─────────────────────── */

export function CompactMatch({
    match, currentPlayerId, isAdmin, onViewResult,
}: {
    match: BracketMatchData;
    currentPlayerId?: string;
    isAdmin?: boolean;
    onViewResult?: (id: string) => void;
}) {
    const isParticipant = currentPlayerId === match.player1Id || currentPlayerId === match.player2Id;
    const hasResult = match.status === "CONFIRMED" || match.status === "SUBMITTED";
    const isDisputed = match.status === "DISPUTED";
    const isEmpty = !match.player1Id && !match.player2Id;

    const accentColor =
        isDisputed ? "bg-danger" :
        match.status === "CONFIRMED" ? "bg-success" :
        match.status === "SUBMITTED" ? "bg-warning" :
        match.status === "BYE" ? "bg-secondary" :
        isParticipant && match.player1Id && match.player2Id ? "bg-primary" : "bg-foreground/15";

    const showEye = (hasResult || (isAdmin && match.player1Id && match.player2Id)) && onViewResult;

    const playerRow = (
        player: BracketPlayer | null,
        playerAvatar: string | null,
        score: number | null,
        isWinner: boolean,
        isCurrent: boolean,
        isTop: boolean,
        team?: { id: string; name: string } | null,
    ) => {
        const displayName = team?.name ?? player?.displayName;
        const hue = displayName?.split("").reduce((a, c) => a + c.charCodeAt(0), 0) ?? 0;
        return (
            <div className={`flex items-center gap-1.5 px-2 h-[30px] ${isTop ? "rounded-t-[7px]" : "rounded-b-[7px]"} ${
                isWinner ? "bg-success/8 dark:bg-success/10" : ""
            }`}>
                {/* Avatar */}
                {player || team ? (
                    playerAvatar ? (
                        <img src={playerAvatar} alt="" className="h-[18px] w-[18px] rounded-full object-cover shrink-0 ring-1 ring-foreground/10" />
                    ) : (
                        <div className="h-[18px] w-[18px] rounded-full shrink-0 flex items-center justify-center text-[7px] font-bold text-white"
                            style={{ background: `hsl(${hue % 360}, 45%, 45%)` }}>
                            {displayName?.charAt(0).toUpperCase() ?? "?"}
                        </div>
                    )
                ) : (
                    <div className="h-[18px] w-[18px] rounded-full bg-foreground/8 shrink-0" />
                )}
                {/* Name */}
                <span className={`text-[10px] truncate flex-1 leading-none ${
                    isCurrent ? "text-primary font-semibold" :
                    isWinner ? "font-semibold text-foreground" :
                    (player || team) ? "text-foreground/60" : "text-foreground/20"
                }`}>
                    {displayName ?? "TBD"}
                    {team && <span className="text-[8px] text-foreground/30 ml-0.5">⚔</span>}
                </span>
                {/* Score */}
                <span className={`text-[11px] font-bold tabular-nums min-w-[16px] text-right leading-none ${
                    isWinner ? "text-success" : score !== null ? "text-foreground/35" : "text-transparent"
                }`}>
                    {score ?? "–"}
                </span>
            </div>
        );
    };

    return (
        <div className={`w-[200px] rounded-lg overflow-hidden flex transition-all border border-foreground/10 ${
            isDisputed ? "ring-1 ring-danger/50 shadow-sm shadow-danger/10" :
            isParticipant && match.status === "PENDING" && match.player1Id && match.player2Id ? "ring-1 ring-primary/40" :
            ""
        } ${isEmpty ? "opacity-70" : ""}`}
            style={{ background: "var(--compact-match-bg, hsl(var(--nextui-default-100)))" }}
        >
            {/* Left accent bar */}
            <div className={`w-[3px] shrink-0 ${accentColor}`} />
            {/* Content */}
            <div className="flex-1 min-w-0">
                {playerRow(match.player1, match.player1Avatar, match.score1, match.winnerId === match.player1Id && match.winnerId !== null, currentPlayerId === match.player1Id, true, match.team1)}
                <div className="flex items-center px-2" style={{ height: 0, zIndex: 1, position: "relative" }}>
                    <div className="flex-1 h-px bg-foreground/15" />
                    <span className="text-[8px] font-black text-foreground/25 px-1 leading-none select-none tracking-widest">VS</span>
                    <div className="flex-1 h-px bg-foreground/15" />
                </div>
                {playerRow(match.player2, match.player2Avatar, match.score2, match.winnerId === match.player2Id && match.winnerId !== null, currentPlayerId === match.player2Id, false, match.team2)}
            </div>
            {/* Eye button */}
            {showEye && (
                <button className="px-1.5 flex items-center shrink-0 hover:bg-foreground/5 transition-colors border-l border-foreground/5"
                    onClick={() => onViewResult(match.id)}
                    title={isAdmin ? "View / edit result" : "View screenshot"}>
                    <Eye className={`h-3 w-3 ${isAdmin && !hasResult ? "text-warning/60" : "text-foreground/25 hover:text-foreground/60"}`} />
                </button>
            )}
        </div>
    );
}

/* ─── Match Row (horizontal, for league & group matches) ──────── */

export function MatchRow({
    match, currentPlayerId, isAdmin, onSubmitResult, onConfirmResult, onDispute, onViewResult,
}: {
    match: BracketMatchData;
    currentPlayerId?: string;
    isAdmin?: boolean;
    onSubmitResult?: (id: string) => void;
    onConfirmResult?: (id: string) => void;
    onDispute?: (id: string) => void;
    onViewResult?: (id: string) => void;
}) {
    const isP1 = currentPlayerId === match.player1Id;
    const isP2 = currentPlayerId === match.player2Id;
    const isParticipant = isP1 || isP2;
    const canSubmit = (isParticipant || isAdmin) && match.status === "PENDING" && match.player1Id && match.player2Id;
    const canEdit = isAdmin && match.status !== "PENDING"; // admin can re-edit even after submission
    const canConfirm = isParticipant && match.status === "SUBMITTED" && match.winnerId !== currentPlayerId;
    const canDispute = isParticipant && match.status === "SUBMITTED" && match.winnerId !== currentPlayerId;
    const canEditSubmitted = isParticipant && match.status === "SUBMITTED" && match.winnerId === currentPlayerId;
    const hasResult = match.status === "CONFIRMED" || match.status === "SUBMITTED";

    // Prefer confirmed score, fall back to claimed score from submitted result
    const claimed = match.results?.[0];
    const displayScore1 = match.score1 ?? (claimed ? claimed.claimedScore1 : null);
    const displayScore2 = match.score2 ?? (claimed ? claimed.claimedScore2 : null);

    const statusDot =
        match.status === "CONFIRMED" ? "bg-success" :
            match.status === "SUBMITTED" ? "bg-warning" :
                match.status === "DISPUTED" ? "bg-danger" : "bg-foreground/20";

    const isDisputed = match.status === "DISPUTED";

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${isDisputed
            ? "border-danger/60 bg-danger/5 shadow-sm shadow-danger/10"
            : isParticipant && match.status === "PENDING" && match.player1Id && match.player2Id
                ? "border-primary/40 bg-primary/5"
                : "border-divider bg-default-50/30"
            }`}>
            {/* Player 1 */}
            <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                <span className={`truncate font-medium ${isP1 ? "text-primary" : match.winnerId === match.player1Id ? "text-success-600" : ""}`}>
                    {match.team1?.name ?? match.player1?.displayName ?? "TBD"}
                </span>
                <Avatar src={match.player1Avatar || undefined} name={(match.team1?.name ?? match.player1?.displayName)?.[0] || "?"} size="sm" className="h-5 w-5 text-[10px] shrink-0" />
            </div>

            {/* Score / VS */}
            <div className="flex items-center gap-1.5 shrink-0">
                {displayScore1 !== null ? (
                    <>
                        <span className={`font-bold tabular-nums min-w-[14px] text-center ${match.winnerId === match.player1Id ? "text-success-600" : "text-foreground/60"}`}>
                            {displayScore1}
                        </span>
                        <span className={`text-foreground/30 ${match.status === "SUBMITTED" ? "text-warning/60" : ""}`}>-</span>
                        <span className={`font-bold tabular-nums min-w-[14px] text-center ${match.winnerId === match.player2Id ? "text-success-600" : "text-foreground/60"}`}>
                            {displayScore2}
                        </span>
                        {/* Dispute badge — pulsing red pill */}
                        {isDisputed && (
                            <span className="flex items-center gap-0.5 bg-danger/15 text-danger text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                ⚠️ DISPUTE
                            </span>
                        )}
                        {/* Submitted — awaiting confirmation */}
                        {match.status === "SUBMITTED" && (
                            <div className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" title="Awaiting confirmation" />
                        )}
                    </>
                ) : (
                    <>
                        <div className={`h-2 w-2 rounded-full shrink-0 ${statusDot}`} />
                        <span className="text-foreground/30 text-[10px]">vs</span>
                        <div className={`h-2 w-2 rounded-full shrink-0 ${statusDot}`} />
                    </>
                )}
            </div>

            {/* Player 2 */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Avatar src={match.player2Avatar || undefined} name={(match.team2?.name ?? match.player2?.displayName)?.[0] || "?"} size="sm" className="h-5 w-5 text-[10px] shrink-0" />
                <span className={`truncate font-medium ${isP2 ? "text-primary" : match.winnerId === match.player2Id ? "text-success-600" : ""}`}>
                    {match.team2?.name ?? match.player2?.displayName ?? "TBD"}
                </span>
            </div>

            {/* Actions + Eye */}
            <div className="flex items-center gap-1 shrink-0 ml-1">
                {canConfirm && onConfirmResult && (
                    <button onClick={() => onConfirmResult(match.id)} className="text-[10px] font-bold text-success hover:underline">✓</button>
                )}
                {canDispute && onDispute && (
                    <button onClick={() => onDispute(match.id)} className="text-[10px] font-bold text-danger hover:underline ml-1">✕</button>
                )}
                {/* Eye icon: for result-bearing matches to everyone; for all matches to admin */}
                {(hasResult || isAdmin) && !canEditSubmitted && onViewResult && match.player1Id && match.player2Id && (
                    <button onClick={() => onViewResult(match.id)} className="ml-0.5" title={isAdmin ? "View / edit result" : "View screenshot"}>
                        <Eye className={`h-3.5 w-3.5 transition-colors ${isDisputed ? "text-danger/60 hover:text-danger" : "text-foreground/30 hover:text-foreground/70"}`} />
                    </button>
                )}
                {canEditSubmitted && onSubmitResult && (
                    <button onClick={() => onSubmitResult(match.id)} className="text-[10px] font-bold text-primary hover:underline ml-1">Edit</button>
                )}
            </div>
        </div>
    );
}


/* ─── My Match Highlight (shared across all types) ─────────── */

/** Convert a raw round number to a display-friendly name */
export function roundLabel(roundNum: number, rounds: RoundData[]): string {
    if (roundNum < 0) {
        // Group stage: -1 → Group A, -2 → Group B, etc.
        return `Group ${String.fromCharCode(65 + (-roundNum - 1))}`;
    }
    // Knockout: find the max positive round to label Final / Semi / Quarter
    const maxRound = Math.max(...rounds.filter(r => r.round > 0).map(r => r.round));
    if (roundNum === maxRound) return "Final";
    if (roundNum === maxRound - 1) return "Semi-Final";
    if (roundNum === maxRound - 2) return "Quarter-Final";
    return `Round ${roundNum}`;
}

export function MyBracketMatch({
    rounds, currentPlayerId, onSubmitResult, onConfirmResult, onDispute, deadlines, tournamentType, rolloverDeadlineMs, roundLabel: roundLabelProp, tournamentName,
}: {
    rounds: RoundData[];
    currentPlayerId: string;
    onSubmitResult?: (id: string) => void;
    onConfirmResult?: (id: string) => void;
    onDispute?: (id: string) => void;
    deadlines?: { groupHours: number; koHours: number; cutoffTime?: string };
    tournamentType?: string;
    rolloverDeadlineMs?: number;
    roundLabel?: string;
    tournamentName?: string;
}) {
    const [idx, setIdx] = useState(0);

    // All matches involving this player that need action
    const myMatches = rounds
        .flatMap(r => r.matches.map(m => ({ ...m, _roundNum: r.round })))
        .filter(m =>
            (m.player1Id === currentPlayerId || m.player2Id === currentPlayerId) &&
            (m.status === "PENDING" || m.status === "SUBMITTED" || m.status === "DISPUTED")
        );

    if (myMatches.length === 0) return null;

    const safeIdx = Math.min(idx, myMatches.length - 1);
    const myMatch = myMatches[safeIdx];
    const label = roundLabel(myMatch._roundNum, rounds);
    const total = myMatches.length;

    return (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-bold text-primary uppercase">
                        Your Match — {label}
                    </span>
                    {total > 1 && (
                        <span className="text-[10px] text-foreground/40 font-medium">
                            ({safeIdx + 1}/{total})
                        </span>
                    )}
                </div>
                {/* Prev / Next when multiple matches */}
                {total > 1 && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIdx(i => Math.max(0, i - 1))}
                            disabled={safeIdx === 0}
                            className="text-[11px] font-bold text-primary px-2 py-0.5 rounded-lg hover:bg-primary/10 disabled:opacity-30 transition-colors"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
                            disabled={safeIdx === total - 1}
                            className="text-[11px] font-bold text-primary px-2 py-0.5 rounded-lg hover:bg-primary/10 disabled:opacity-30 transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
            <MatchCard
                match={myMatch}
                currentPlayerId={currentPlayerId}
                onSubmitResult={onSubmitResult}
                onConfirmResult={onConfirmResult}
                onDispute={onDispute}
                deadlineHours={deadlines
                    ? (tournamentType === "GROUP_KNOCKOUT" && myMatch._roundNum <= 0
                        ? deadlines.groupHours
                        : tournamentType === "LEAGUE"
                            ? deadlines.groupHours
                            : deadlines.koHours)
                    : undefined
                }
                rolloverDeadlineMs={rolloverDeadlineMs}
                rolloverRoundLabel={roundLabelProp}
                matchRoundLabel={roundLabel(myMatch._roundNum, rounds)}
                cutoffTime={deadlines?.cutoffTime}
                tournamentName={tournamentName}
            />
        </motion.div>
    );
}

