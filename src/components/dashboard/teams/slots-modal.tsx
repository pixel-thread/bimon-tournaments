"use client";

import { useState, useMemo, useCallback } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { X, Copy, Check } from "lucide-react";
import { GAME } from "@/lib/game-config";

// ── Types ──────────────────────────────────────────────────────

interface TeamDTO {
    id: string;
    name: string;
    clanLogo?: string | null;
    clanTag?: string | null;
    players: { id: string; displayName: string | null; username: string }[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tournamentTitle: string;
    teams: TeamDTO[];
    seasonName?: string;
    backgroundImage?: string;
    allowSquads?: boolean;
}

// ── Component ─────────────────────────────────────────────────

export function SlotsModal({
    isOpen,
    onClose,
    tournamentTitle,
    teams,
    seasonName = "",
    backgroundImage = "/images/image.webp",
    allowSquads = false,
}: Props) {
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);

    // Deduplicate teams by player composition
    const uniqueTeams = useMemo(() => {
        const seen = new Set<string>();
        return (teams ?? []).filter((t) => {
            const key = t.players.map((p) => p.id).sort().join(",");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [teams]);

    const totalPlayers = useMemo(
        () => uniqueTeams.reduce((sum, t) => sum + (t.players?.length || 0), 0),
        [uniqueTeams]
    );

    const maxPlayers = useMemo(
        () => Math.max(...uniqueTeams.map((t) => t.players?.length || 0), 1),
        [uniqueTeams]
    );

    // Show team name column only for squad (ranked) tournaments
    const hasSquadTeams = allowSquads;

    // ── Screenshot / Copy ─────────────────────────────────────

    const copyToClipboard = useCallback(async () => {
        setIsSharing(true);
        setShareSuccess(false);

        const element = document.getElementById("teams-list-content");
        if (!element) {
            setIsSharing(false);
            return;
        }

        try {
            // Temporarily remove viewport constraints so full content is captured
            // On mobile, the table (min-w-500px) is wider than the screen, so
            // toPng only captures visible columns unless we expand the container.
            const prevMinH = element.style.minHeight;
            const prevH = element.style.height;
            const prevMinW = element.style.minWidth;
            const prevW = element.style.width;
            const prevOverflowEl = element.style.overflow;
            element.style.minHeight = 'auto';
            element.style.height = 'auto';
            // Dynamic width: Slot(60px) + Team(140px if squad) + per-player(140px) + padding
            const captureWidth = 60 + (hasSquadTeams ? 140 : 0) + maxPlayers * 140 + 40;
            element.style.minWidth = `${Math.max(600, captureWidth)}px`;
            element.style.width = 'max-content';
            element.style.overflow = 'visible';

            // Also expand the scrollable table wrapper
            const scrollWrapper = element.querySelector('.overflow-x-auto') as HTMLElement | null;
            const prevScrollOverflow = scrollWrapper?.style.overflow;
            if (scrollWrapper) scrollWrapper.style.overflow = 'visible';

            // And the outer rounded container (overflow-hidden from border-radius)
            const tableContainer = scrollWrapper?.parentElement as HTMLElement | null;
            const prevContainerOverflow = tableContainer?.style.overflow;
            if (tableContainer) tableContainer.style.overflow = 'visible';

            const dataUrl = await toPng(element, {
                pixelRatio: 2,
                filter: (node) => !node.classList?.contains("floating-controls"),
            });

            // Restore original styles
            element.style.minHeight = prevMinH;
            element.style.height = prevH;
            element.style.minWidth = prevMinW;
            element.style.width = prevW;
            element.style.overflow = prevOverflowEl;
            if (scrollWrapper && prevScrollOverflow !== undefined) scrollWrapper.style.overflow = prevScrollOverflow;
            if (tableContainer && prevContainerOverflow !== undefined) tableContainer.style.overflow = prevContainerOverflow;

            // Convert data URL to blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();

            const file = new File(
                [blob],
                `${(tournamentTitle || "teams").replace(/\s+/g, "-")}-teams.png`,
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
            setIsSharing(false);
        }
    }, [tournamentTitle, hasSquadTeams, maxPlayers]);

    if (!isOpen) return null;

    return (
        <>
            <style jsx>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 10px rgba(249, 115, 22, 0.4), 0 0 20px rgba(249, 115, 22, 0.2); }
                    50% { box-shadow: 0 0 15px rgba(249, 115, 22, 0.6), 0 0 30px rgba(249, 115, 22, 0.3); }
                }
                .share-button-glow {
                    animation: pulse-glow 2s ease-in-out infinite;
                }
                .share-button-glow:hover {
                    animation: none;
                    box-shadow: 0 0 20px rgba(249, 115, 22, 0.6), 0 0 40px rgba(249, 115, 22, 0.3);
                }
            `}</style>

            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Floating Controls */}
                <div className="floating-controls absolute top-4 right-4 z-30 flex gap-2">
                    <button
                        onClick={copyToClipboard}
                        disabled={isSharing}
                        className={`relative overflow-hidden text-white hover:text-orange-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-orange-500/50 p-2.5 rounded-xl transition-all duration-300 ${!isSharing && !shareSuccess ? "share-button-glow" : ""} ${shareSuccess ? "bg-green-500/20 border-green-500/50" : ""}`}
                    >
                        {isSharing ? (
                            <div className="h-5 w-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        ) : shareSuccess ? (
                            <Check className="h-5 w-5 text-green-400" />
                        ) : (
                            <Copy className="h-5 w-5" />
                        )}
                    </button>

                    <button
                        onClick={onClose}
                        className="text-white hover:text-red-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-red-500/50 p-2.5 rounded-xl transition-all duration-300"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div
                    id="teams-list-content"
                    className="relative w-full min-h-dvh flex items-center justify-center bg-cover bg-center py-10 sm:py-14"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                >
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />

                    <div className="relative z-10 w-full max-w-5xl mx-auto px-2 sm:px-6">
                        {/* Title */}
                        <div className="text-center mb-4 sm:mb-6">
                            <h1
                                className="text-xl sm:text-4xl font-bold tracking-wide text-orange-500"
                                style={{
                                    textShadow:
                                        "0 0 30px rgba(249, 115, 22, 0.6), 0 0 60px rgba(249, 115, 22, 0.3), 0 2px 4px rgba(0,0,0,0.5)",
                                }}
                            >
                                {tournamentTitle}
                            </h1>
                            {seasonName && (
                                <div className="mt-1.5 sm:mt-2 inline-flex items-center gap-2 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
                                    <span className="text-[10px] sm:text-xs font-semibold text-blue-400">{seasonName}</span>
                                </div>
                            )}
                        </div>

                        {/* Table — scrollable on mobile */}
                        <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md shadow-2xl shadow-black/50 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[500px]">
                                    <thead>
                                        <tr className="bg-zinc-800/80 border-b border-white/10">
                                            <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[11px] sm:text-sm font-semibold text-zinc-300 whitespace-nowrap">
                                                Slot
                                            </th>
                                            {hasSquadTeams && (
                                                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[11px] sm:text-sm font-semibold text-zinc-300 whitespace-nowrap">
                                                    Team
                                                </th>
                                            )}
                                            {Array.from({ length: maxPlayers }, (_, i) => (
                                                <th key={i} className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[11px] sm:text-sm font-semibold text-zinc-300 whitespace-nowrap">
                                                    Player {i + 1}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {uniqueTeams.map((team, index) => {
                                            const players = team.players?.map((p) =>
                                                p.displayName || p.username
                                            ) || [];
                                            const paddedPlayers = [
                                                ...players,
                                                ...Array(maxPlayers - players.length).fill(""),
                                            ];

                                            const textColor = index % 3 === 0
                                                ? "text-zinc-200"
                                                : index % 3 === 1
                                                    ? "text-sky-300/70"
                                                    : "text-amber-200/70";

                                            return (
                                                <tr
                                                    key={team.id || index}
                                                    className={`border-b border-white/5 ${index % 2 === 0 ? "bg-zinc-900/40" : "bg-zinc-800/30"} hover:bg-zinc-700/40 transition-colors`}
                                                >
                                                    <td className={`px-2 sm:px-3 py-1.5 sm:py-2 text-center text-[11px] sm:text-sm font-medium ${textColor}`}>
                                                        {index + 2}
                                                    </td>
                                                    {hasSquadTeams && (
                                                        <td className={`px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[11px] sm:text-sm font-medium whitespace-nowrap ${textColor}`}>
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <img
                                                                    src={team.clanLogo || GAME.iconUrl}
                                                                    alt={team.clanTag || GAME.name}
                                                                    className="w-4 h-4 rounded-full object-cover shrink-0"
                                                                />
                                                                {team.name}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {paddedPlayers.map((playerName, pi) => (
                                                        <td
                                                            key={pi}
                                                            className={`px-2 sm:px-3 py-1.5 sm:py-2 text-center text-[11px] sm:text-sm whitespace-nowrap ${playerName ? textColor : "text-zinc-600"}`}
                                                        >
                                                            {playerName || "\u2014"}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="px-2 py-1.5 sm:py-2 bg-zinc-800/60 border-t border-white/10 text-center">
                                <span className="text-[11px] sm:text-sm font-semibold text-zinc-300">
                                    Total Players: {totalPlayers}
                                </span>
                            </div>
                        </div>

                        {/* Footer Branding */}
                        <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 text-zinc-500 text-[10px] sm:text-xs">
                            <div className="h-px w-6 sm:w-8 bg-gradient-to-r from-transparent to-orange-500/50" />
                            <span className="font-medium text-zinc-400">{GAME.name} × Bimon Tournament</span>
                            <div className="h-px w-6 sm:w-8 bg-gradient-to-l from-transparent to-orange-500/50" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
