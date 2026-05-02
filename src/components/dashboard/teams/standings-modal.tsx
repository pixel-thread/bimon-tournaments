"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
    X,
    Copy,
    Check,
    Settings,
    ChevronUp,
    ChevronDown,
    Minus,
    Trophy,
} from "lucide-react";
import { GAME } from "@/lib/game-config";

// ── Types ──────────────────────────────────────────────────────

interface MatchTeam {
    teamId: string;
    teamName: string;
    teamNumber: number;
    clanLogo: string | null;
    clanTag: string | null;
    position: number;
    players: {
        id: string;
        displayName: string | null;
        username: string;
        kills: number;
        present: boolean;
    }[];
}

interface MatchData {
    id: string;
    matchNumber: number;
    teams: MatchTeam[];
}

interface StandingRow {
    teamId: string;
    teamName: string;
    clanLogo: string | null;
    totalPoints: number;
    totalKills: number;
    placementPts: number;
    wins: number;
    matchCount: number;
    lastMatchPosition: number;
    positions: number[];
    playerNames: string[];
    positionChange: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    teams: { id: string; name: string }[];
    tournamentTitle?: string;
    seasonName?: string;
    backgroundImage?: string;
    allowSquads?: boolean;
}

// ── Placement Points (BGMI scoring) ───────────────────────────

const PLACEMENT_PTS: Record<number, number> = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1,
};

// ── Component ─────────────────────────────────────────────────

export function StandingsModal({
    isOpen,
    onClose,
    tournamentId,
    tournamentTitle = "",
    seasonName = "",
    backgroundImage = "/images/image.webp",
    allowSquads = false,
}: Props) {
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [compareMatches, setCompareMatches] = useState(1);

    // Fetch match data
    const { data: matchData, isLoading, refetch } = useQuery<MatchData[]>({
        queryKey: ["match-stats", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/matches?tournamentId=${tournamentId}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: isOpen && !!tournamentId,
    });

    // Refetch on open
    useEffect(() => {
        if (isOpen) refetch();
    }, [isOpen, refetch]);

    // Auto-cap compareMatches to available range
    useEffect(() => {
        if (matchData && matchData.length > 1 && compareMatches >= matchData.length) {
            setCompareMatches(Math.max(1, matchData.length - 1));
        }
    }, [matchData, compareMatches]);

    // ── Compute standings with position change tracking ────────

    const standings = useMemo<StandingRow[]>(() => {
        if (!matchData || matchData.length === 0) return [];

        // Helper: compute standings for a subset of matches
        function computeRanking(matches: MatchData[]): Map<string, StandingRow> {
            const map = new Map<string, StandingRow>();
            const totalMatchCount = matches.length;
            for (const match of matches) {
                for (const t of match.teams) {
                    let row = map.get(t.teamId);
                    if (!row) {
                        row = {
                            teamId: t.teamId,
                            teamName: t.teamName,
                            clanLogo: t.clanLogo ?? null,
                            totalPoints: 0,
                            totalKills: 0,
                            placementPts: 0,
                            wins: 0,
                            matchCount: totalMatchCount,
                            lastMatchPosition: 99,
                            positions: [],
                            playerNames: t.players.map((p) => p.displayName || p.username),
                            positionChange: 0,
                        };
                        map.set(t.teamId, row);
                    }
                    const kills = t.players.reduce((s, p) => s + (p.present ? p.kills : 0), 0);
                    const pts = PLACEMENT_PTS[t.position] || 0;
                    row.totalKills += kills;
                    row.placementPts += pts;
                    row.totalPoints += pts + kills;
                    if (t.position === 1) row.wins++;
                    row.positions.push(t.position);
                    row.lastMatchPosition = t.position;
                }
            }
            return map;
        }

        // Sort function (BGMI tiebreaker)
        function sortRows(rows: StandingRow[]): StandingRow[] {
            return rows.sort((a, b) => {
                if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (b.placementPts !== a.placementPts) return b.placementPts - a.placementPts;
                if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
                return a.lastMatchPosition - b.lastMatchPosition;
            });
        }

        // Current standings (all matches)
        const currentMap = computeRanking(matchData);
        const currentSorted = sortRows(Array.from(currentMap.values()));

        // Previous standings (excluding last N matches) for position change
        if (matchData.length > compareMatches) {
            const prevMatches = matchData.slice(0, matchData.length - compareMatches);
            const prevMap = computeRanking(prevMatches);
            const prevSorted = sortRows(Array.from(prevMap.values()));

            // Build rank map for previous
            const prevRankMap = new Map<string, number>();
            prevSorted.forEach((row, i) => prevRankMap.set(row.teamId, i + 1));

            // Compute position change
            currentSorted.forEach((row, i) => {
                const currentRank = i + 1;
                const prevRank = prevRankMap.get(row.teamId);
                if (prevRank !== undefined) {
                    row.positionChange = prevRank - currentRank;
                }
            });
        }

        return currentSorted;
    }, [matchData, compareMatches]);

    // ── Screenshot / Copy ─────────────────────────────────────

    const copyToClipboard = useCallback(async () => {
        setIsSharing(true);
        setShareSuccess(false);

        const element = document.getElementById("standings-content");
        if (!element) {
            setIsSharing(false);
            return;
        }

        // Clone the element so we can strip out mobile view without touching the original
        const clone = element.cloneNode(true) as HTMLElement;
        clone.removeAttribute("id");

        // Remove mobile view from clone entirely
        const mobileEl = clone.querySelector(".mobile-standings");
        if (mobileEl) mobileEl.remove();

        // Force desktop view visible in clone
        const desktopEl = clone.querySelector(".desktop-standings") as HTMLElement | null;
        const twoColEl = clone.querySelector(".desktop-two-col") as HTMLElement | null;
        const singleColEl = clone.querySelector(".desktop-single-col") as HTMLElement | null;
        if (desktopEl) desktopEl.style.display = "block";
        if (twoColEl) { twoColEl.style.display = "flex"; twoColEl.style.gap = "1rem"; twoColEl.style.justifyContent = "center"; }
        if (singleColEl) singleColEl.style.display = "none";

        // Remove floating controls from clone
        clone.querySelectorAll(".floating-controls").forEach((el) => el.remove());

        // Dynamic height: podium(~200px) + title/footer(~160px) + remaining teams in two-col
        const restTeams = Math.max(0, standings.length - 3);
        const rowsPerCol = Math.ceil(restTeams / 2);
        const captureHeight = Math.max(520, 200 + 160 + rowsPerCol * 38 + 80);
        const captureWidth = 1280;

        // Style the clone for desktop capture
        clone.style.cssText = `
            width: ${captureWidth}px; height: ${captureHeight}px; min-height: ${captureHeight}px;
            display: flex; align-items: center; justify-content: center;
            background-image: url(${backgroundImage});
            background-size: cover; background-position: center;
            position: relative; overflow: hidden;
        `;

        // Create offscreen container
        const tempContainer = document.createElement("div");
        tempContainer.style.cssText = "position: absolute; left: -9999px; top: 0;";
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);

        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
            const dataUrl = await toPng(clone, {
                width: captureWidth,
                height: captureHeight,
                pixelRatio: 2,
            });

            // Convert data URL to blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();

            const file = new File(
                [blob],
                `${(tournamentTitle || "standings").replace(/\s+/g, "-")}.png`,
                { type: "image/png" }
            );

            // Try share API first (mobile)
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: tournamentTitle });
                    setShareSuccess(true);
                    setTimeout(() => setShareSuccess(false), 2000);
                    return;
                } catch (e: unknown) {
                    if ((e as Error).name !== "AbortError") console.warn("Share failed:", e);
                }
            }

            // Try clipboard
            if (navigator.clipboard && window.ClipboardItem) {
                try {
                    await navigator.clipboard.write([
                        new window.ClipboardItem({ "image/png": blob }),
                    ]);
                    setShareSuccess(true);
                    setTimeout(() => setShareSuccess(false), 2000);
                    return;
                } catch {
                    console.warn("Clipboard failed");
                }
            }

            // Fallback: download
            const link = document.createElement("a");
            link.download = file.name;
            link.href = dataUrl;
            link.click();
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 2000);
        } catch (error) {
            console.error("Screenshot error:", error);
            toast.error("Failed to capture screenshot");
        } finally {
            document.body.removeChild(tempContainer);
            setIsSharing(false);
        }
    }, [tournamentTitle, backgroundImage, standings]);

    if (!isOpen) return null;

    const maxMatches = matchData?.length ?? 0;

    return (
        <>
            <style jsx global>{`
                /* Marquee auto-scroll for overflowing names */
                @keyframes marquee-scroll {
                    0%, 15% { transform: translateX(0); }
                    85%, 100% { transform: translateX(-50%); }
                }
                .team-name-marquee {
                    overflow: hidden;
                    white-space: nowrap;
                    mask-image: linear-gradient(90deg, black 90%, transparent 100%);
                    -webkit-mask-image: linear-gradient(90deg, black 90%, transparent 100%);
                }
                .team-name-marquee .marquee-inner {
                    display: inline-block;
                    padding-right: 2em;
                    animation: marquee-scroll 5s ease-in-out infinite alternate;
                }
            `}</style>

            <div className="fixed inset-0 z-50 overflow-y-auto">
                {/* Floating Controls */}
                <div className="floating-controls absolute top-4 right-4 z-30 flex gap-2">
                    {/* Copy Button */}
                    <button
                        onClick={copyToClipboard}
                        disabled={isSharing}
                        className={`relative overflow-hidden text-white hover:text-orange-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-orange-500/50 p-2.5 rounded-xl transition-all duration-300 ${shareSuccess ? "bg-green-500/20 border-green-500/50" : ""}`}
                    >
                        {isSharing ? (
                            <div className="h-5 w-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        ) : shareSuccess ? (
                            <Check className="h-5 w-5 text-green-400" />
                        ) : (
                            <Copy className="h-5 w-5" />
                        )}
                    </button>

                    {/* Settings Button */}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`text-white hover:text-orange-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-orange-500/50 p-2.5 rounded-xl transition-all duration-300 ${showSettings ? "border-orange-500/50 text-orange-400" : ""}`}
                        title={`Comparing to ${compareMatches} match${compareMatches > 1 ? "es" : ""} ago`}
                    >
                        <Settings className="h-5 w-5" />
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="text-white hover:text-red-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-red-500/50 p-2.5 rounded-xl transition-all duration-300"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Settings Dropdown */}
                {showSettings && (
                    <div className="floating-controls absolute top-16 right-4 z-30 bg-black/80 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[180px]">
                        <div className="text-xs text-zinc-400 mb-2 font-medium">Compare to</div>
                        <div className="flex flex-col gap-1">
                            {Array.from({ length: Math.min(maxMatches, 4) }, (_, i) => i + 1).map((num) => (
                                <button
                                    key={num}
                                    onClick={() => {
                                        setCompareMatches(num);
                                        setShowSettings(false);
                                    }}
                                    className={`text-sm text-left px-3 py-1.5 rounded-lg transition-colors ${compareMatches === num ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-zinc-300 hover:bg-white/10"}`}
                                >
                                    {num === 1 ? "1 match ago" : `${num} matches ago`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div
                    id="standings-content"
                    className="relative w-full min-h-screen flex items-center justify-center bg-cover bg-center overflow-auto"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                >
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />


                    <div className="relative z-10 w-full max-w-7xl mx-auto p-4 sm:p-6">
                        {/* Header */}
                        <div className="text-center mb-6">
                            <h1
                                className="text-2xl sm:text-4xl font-bold tracking-wide text-orange-500"
                                style={{
                                    textShadow:
                                        "0 0 30px rgba(249, 115, 22, 0.6), 0 0 60px rgba(249, 115, 22, 0.3), 0 2px 4px rgba(0,0,0,0.5)",
                                }}
                            >
                                {tournamentTitle || "Tournament"}
                            </h1>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                                {seasonName && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
                                        <span className="text-xs font-semibold text-blue-400">{seasonName}</span>
                                    </div>
                                )}
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                    <Trophy className="h-3.5 w-3.5 text-orange-400" />
                                    <span className="text-xs font-medium text-zinc-300">Overall Rankings</span>
                                </div>
                            </div>
                        </div>

                        {/* Standings Table */}
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md shadow-2xl shadow-black/50 p-4 sm:p-6">
                                <StandingsTable standings={standings} allowSquads={allowSquads} />
                            </div>
                        )}

                        {/* Footer branding */}
                        <div className="mt-6 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                            <div className="h-px w-8 bg-gradient-to-r from-transparent to-orange-500/50" />
                            <span className="font-medium text-zinc-400">{GAME.name} × Bimon Tournament</span>
                            <div className="h-px w-8 bg-gradient-to-l from-transparent to-orange-500/50" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ── Rank badge styling ────────────────────────────────────────

function getRankStyles(rank: number) {
    switch (rank) {
        case 1:
            return {
                badge: "bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-500 text-black shadow-[0_0_12px_rgba(234,179,8,0.6)] border border-yellow-300/50 font-black",
                row: "bg-gradient-to-r from-yellow-500/15 via-yellow-400/10 to-transparent border-l-2 border-l-yellow-400",
            };
        case 2:
            return {
                badge: "bg-gradient-to-r from-gray-400 via-gray-200 to-gray-300 text-black shadow-[0_0_10px_rgba(156,163,175,0.5)] border border-gray-200/50 font-black",
                row: "bg-gradient-to-r from-gray-400/15 via-gray-300/10 to-transparent border-l-2 border-l-gray-300",
            };
        case 3:
            return {
                badge: "bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)] border border-orange-400/50 font-black",
                row: "bg-gradient-to-r from-orange-500/15 via-orange-400/10 to-transparent border-l-2 border-l-orange-500",
            };
        default:
            return {
                badge: "bg-zinc-800/80 text-zinc-300 border border-zinc-700/50",
                row: "hover:bg-white/5",
            };
    }
}

// ── Position change indicator ─────────────────────────────────

function PositionChangeIndicator({ change }: { change: number }) {
    if (!change || change === 0)
        return <span className="inline-flex items-center justify-center w-5 h-5 text-zinc-500"><Minus className="w-3 h-3" /></span>;
    if (change > 0)
        return <span className="inline-flex items-center gap-0.5 text-emerald-400 text-[10px] font-bold"><ChevronUp className="w-3.5 h-3.5" /><span>{change}</span></span>;
    return <span className="inline-flex items-center gap-0.5 text-red-400 text-[10px] font-bold"><ChevronDown className="w-3.5 h-3.5" /><span>{Math.abs(change)}</span></span>;
}

// ── Standings Table — Podium Top 3 + Two-column rest ──────────

function StandingsTable({ standings, allowSquads = false }: { standings: StandingRow[]; allowSquads?: boolean }) {
    const hasSquadTeams = allowSquads;
    const top3 = standings.slice(0, 3);
    const rest = standings.slice(3);

    // Podium order: #2, #1, #3 (center elevated)
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    const podiumRanks = top3.length >= 3 ? [2, 1, 3] : top3.map((_, i) => i + 1);

    const podiumStyles: Record<number, { ring: string; glow: string; size: string; badge: string; bg: string; elevated: boolean }> = {
        1: {
            ring: "ring-2 ring-yellow-400/70",
            glow: "shadow-[0_0_20px_rgba(234,179,8,0.4)]",
            size: "w-14 h-14",
            badge: "bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-500 text-black font-black",
            bg: "from-yellow-500/15 via-yellow-400/5 to-transparent border-yellow-500/30",
            elevated: true,
        },
        2: {
            ring: "ring-2 ring-gray-300/60",
            glow: "shadow-[0_0_14px_rgba(156,163,175,0.3)]",
            size: "w-11 h-11",
            badge: "bg-gradient-to-r from-gray-400 via-gray-200 to-gray-300 text-black font-black",
            bg: "from-gray-400/10 via-gray-300/5 to-transparent border-gray-400/30",
            elevated: false,
        },
        3: {
            ring: "ring-2 ring-orange-500/60",
            glow: "shadow-[0_0_14px_rgba(234,88,12,0.3)]",
            size: "w-11 h-11",
            badge: "bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 text-white font-black",
            bg: "from-orange-500/10 via-orange-400/5 to-transparent border-orange-500/30",
            elevated: false,
        },
    };

    const renderTable = (slice: StandingRow[], startIndex: number) => (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-white/10 bg-gradient-to-r from-orange-500/10 via-transparent to-orange-500/10">
                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-orange-400">#</th>
                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500" title="Position Change">+/-</th>
                        <th className="px-1 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-orange-400">Team</th>
                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">M</th>
                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">PTS</th>
                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">Kills</th>
                        <th className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-orange-400">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {slice.map((row, idx) => {
                        const rank = startIndex + idx + 1;
                        const styles = getRankStyles(rank);
                        return (
                            <tr
                                key={row.teamId}
                                className={`border-b border-white/5 last:border-b-0 transition-all duration-200 ${styles.row}`}
                            >
                                <td className="px-1 py-1.5 text-center align-middle">
                                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${styles.badge}`}>
                                        {rank}
                                    </span>
                                </td>
                                <td className="px-0 py-1.5 text-center align-middle">
                                    <PositionChangeIndicator change={row.positionChange} />
                                </td>
                                <td className="px-1 py-1 text-left align-middle">
                                    <div className="flex flex-col min-h-[28px] justify-center">
                                        <div className="flex items-center gap-1.5">
                                            {hasSquadTeams && (
                                                <img src={row.clanLogo || GAME.iconUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                                            )}
                                            <span className={`text-[11px] leading-tight font-semibold text-zinc-300 ${hasSquadTeams ? "whitespace-nowrap" : ""}`} style={hasSquadTeams ? undefined : { wordBreak: "break-word" }}>
                                                {hasSquadTeams ? row.teamName : row.playerNames.join(", ")}
                                            </span>
                                        </div>
                                        {row.wins > 0 && (
                                            <span className="text-[9px] mt-0.5 text-yellow-400">
                                                🍗 {row.wins} win{row.wins > 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-1 py-1.5 text-center align-middle text-zinc-500 tabular-nums font-mono text-xs">{row.matchCount}</td>
                                <td className="px-1 py-1.5 text-center align-middle text-zinc-300 font-medium tabular-nums font-mono text-xs">{row.placementPts}</td>
                                <td className="px-1 py-1.5 text-center align-middle text-zinc-400 tabular-nums font-mono text-xs">{row.totalKills}</td>
                                <td className="px-1 py-1.5 text-center align-middle text-orange-400 font-bold tabular-nums font-mono text-xs">{row.totalPoints}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const restHalf = Math.ceil(rest.length / 2);

    return (
        <div className="w-full">
            {/* ── Podium: Top 3 ─────────────────────────── */}
            {top3.length > 0 && (
                <div className="podium-section mb-5">
                    <div className="flex items-end justify-center gap-3 sm:gap-5">
                        {podiumOrder.map((row, i) => {
                            if (!row) return null;
                            const rank = podiumRanks[i];
                            const ps = podiumStyles[rank];
                            return (
                                <div
                                    key={row.teamId}
                                    className={`flex flex-col items-center text-center ${ps.elevated ? "mb-2" : "mb-0"}`}
                                    style={{ width: ps.elevated ? (hasSquadTeams ? "140px" : "200px") : (hasSquadTeams ? "120px" : "180px") }}
                                >
                                    {/* Logo */}
                                    <div className={`rounded-full ${ps.ring} ${ps.glow} ${ps.size} overflow-hidden bg-zinc-900/80`}>
                                        <img
                                            src={row.clanLogo || GAME.iconUrl}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {/* Rank badge below logo */}
                                    <div className={`-mt-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${ps.badge} shadow-lg z-10`}>
                                        {rank}
                                    </div>

                                    {/* Team Name */}
                                    <p className={`text-xs font-bold mt-1 w-full ${hasSquadTeams ? "truncate" : "leading-tight"} ${rank === 1 ? "text-yellow-300" : rank === 2 ? "text-gray-200" : "text-orange-300"}`}>
                                        {hasSquadTeams ? row.teamName : row.playerNames.join(", ")}
                                    </p>

                                    {/* Stats */}
                                    <div className={`mt-1.5 w-full rounded-lg border bg-gradient-to-b ${ps.bg} px-2 py-1.5 backdrop-blur-sm`}>
                                        <p className="text-orange-400 font-bold text-sm tabular-nums">{row.totalPoints}</p>
                                        <div className="flex items-center justify-center gap-2 mt-0.5 text-[9px] text-zinc-400">
                                            <span>{row.totalKills} kills</span>
                                            <span className="text-zinc-600">|</span>
                                            <span>{row.placementPts} pts</span>
                                        </div>
                                        {row.wins > 0 && (
                                            <p className="text-[9px] mt-0.5 text-yellow-400 font-semibold">🍗 {row.wins} win{row.wins > 1 ? "s" : ""}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Mobile: single column (rank 4+) ──────── */}
            {rest.length > 0 && (
                <div className="mobile-standings sm:hidden space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {rest.map((row, index) => {
                        const rank = index + 4;
                        const styles = getRankStyles(rank);
                        return (
                            <div key={row.teamId} className={`rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm px-3 py-2.5 flex items-start gap-3 transition-all ${styles.row}`}>
                                <div className="flex flex-col items-center gap-0.5">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${styles.badge}`}>
                                        {rank}
                                    </div>
                                    <PositionChangeIndicator change={row.positionChange} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="team-name-marquee flex-1 min-w-0">
                                            <span className={`marquee-inner text-sm font-semibold whitespace-nowrap text-zinc-200`}>
                                                <span className="inline-flex items-center gap-1.5">
                                                    {hasSquadTeams && (
                                                        <img src={row.clanLogo || GAME.iconUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0 inline" />
                                                    )}
                                                    {hasSquadTeams ? row.teamName : row.playerNames.join(", ")}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-400">
                                            <span className="text-zinc-500">M</span>
                                            <span className="font-medium text-zinc-300">{row.matchCount}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-400">
                                            <span className="text-zinc-500">K</span>
                                            <span className="font-medium text-zinc-300">{row.totalKills}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5">
                                            <span className="text-orange-400/70">TOTAL</span>
                                            <span className="font-bold text-orange-400">{row.totalPoints}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Desktop: two-column table (rank 4+) ─── */}
            {rest.length > 0 && (
                <div className="desktop-standings hidden sm:block">
                    <div className="desktop-two-col hidden lg:flex lg:gap-4 lg:justify-center">
                        <div className="flex-1 max-w-[520px]">{renderTable(rest.slice(0, restHalf), 3)}</div>
                        <div className="flex-1 max-w-[520px]">{renderTable(rest.slice(restHalf), 3 + restHalf)}</div>
                    </div>
                    <div className="desktop-single-col block lg:hidden">{renderTable(rest, 3)}</div>
                </div>
            )}
        </div>
    );
}
