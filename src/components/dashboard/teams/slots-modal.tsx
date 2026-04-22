"use client";

import { useState, useMemo, useCallback } from "react";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import { X, Copy, Check } from "lucide-react";
import { GAME } from "@/lib/game-config";

// ── Types ──────────────────────────────────────────────────────

interface TeamDTO {
    id: string;
    name: string;
    players: { id: string; displayName: string | null; username: string }[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tournamentTitle: string;
    teams: TeamDTO[];
    seasonName?: string;
    backgroundImage?: string;
}

// ── Component ─────────────────────────────────────────────────

export function SlotsModal({
    isOpen,
    onClose,
    tournamentTitle,
    teams,
    seasonName = "",
    backgroundImage = "/images/image.webp",
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

    // Show team name column only if any team has a custom (non-generic) name
    const hasSquadTeams = useMemo(
        () => uniqueTeams.some((t) => !/^Team \d+$/i.test(t.name)),
        [uniqueTeams]
    );

    // ── Screenshot / Copy ─────────────────────────────────────

    const copyToClipboard = useCallback(async () => {
        setIsSharing(true);
        setShareSuccess(false);

        const element = document.getElementById("teams-list-content");
        if (!element) {
            setIsSharing(false);
            return;
        }

        // Pre-fetch background image as data URL to bypass CORS in html2canvas
        let bgDataUrl = backgroundImage;
        if (backgroundImage && !backgroundImage.startsWith("data:") && !backgroundImage.startsWith("/")) {
            try {
                const imgRes = await fetch(backgroundImage);
                const blob = await imgRes.blob();
                bgDataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch {
                console.warn("Failed to pre-fetch background image, using original URL");
            }
        }

        // Create temp container for screenshot
        const tempContainer = document.createElement("div");
        tempContainer.style.cssText = `
            position: absolute;
            width: 900px;
            left: -9999px;
            top: 0;
            overflow: hidden;
            background-image: url(${bgDataUrl});
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        `;
        document.body.appendChild(tempContainer);

        const originalParent = element.parentNode;
        if (originalParent) originalParent.removeChild(element);
        tempContainer.appendChild(element);

        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
            const canvas = await html2canvas(element, {
                backgroundColor: null,
                scale: 2,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                ignoreElements: (el) => el.classList.contains("floating-controls"),
            });

            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/png")
            );
            if (!blob) return;

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
            link.href = canvas.toDataURL("image/png");
            link.click();
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 2000);
        } catch (error) {
            console.error("Screenshot error:", error);
            toast.error("Failed to capture screenshot");
        } finally {
            if (originalParent) {
                tempContainer.removeChild(element);
                originalParent.appendChild(element);
            }
            document.body.removeChild(tempContainer);
            setIsSharing(false);
        }
    }, [tournamentTitle, backgroundImage]);

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

                {/* Main Content */}
                <div
                    id="teams-list-content"
                    className="relative w-full min-h-screen flex items-start justify-center bg-cover bg-center py-10 sm:py-14"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                >
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />

                    <div className="relative z-10 w-full max-w-4xl mx-auto p-4 sm:p-6">
                        {/* Title */}
                        <div className="text-center mb-6">
                            <h1
                                className="text-2xl sm:text-4xl font-bold tracking-wide text-orange-500"
                                style={{
                                    textShadow:
                                        "0 0 30px rgba(249, 115, 22, 0.6), 0 0 60px rgba(249, 115, 22, 0.3), 0 2px 4px rgba(0,0,0,0.5)",
                                }}
                            >
                                {tournamentTitle}
                            </h1>
                            {seasonName && (
                                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
                                    <span className="text-xs font-semibold text-blue-400">{seasonName}</span>
                                </div>
                            )}
                        </div>

                        {/* Table */}
                        <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md shadow-2xl shadow-black/50 overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-zinc-800/80 border-b border-white/10">
                                        <th className="px-3 py-2.5 text-center text-sm font-semibold text-zinc-300">
                                            Slot No
                                        </th>
                                        {hasSquadTeams && (
                                            <th className="px-3 py-2.5 text-center text-sm font-semibold text-zinc-300">
                                                Team Name
                                            </th>
                                        )}
                                        {Array.from({ length: maxPlayers }, (_, i) => (
                                            <th key={i} className="px-3 py-2.5 text-center text-sm font-semibold text-zinc-300">
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

                                        return (
                                            <tr
                                                key={team.id || index}
                                                className={`border-b border-white/5 ${index % 2 === 0 ? "bg-zinc-900/40" : "bg-zinc-800/30"} hover:bg-zinc-700/40 transition-colors`}
                                            >
                                                <td className="px-3 py-2 text-center text-sm font-medium text-zinc-400">
                                                    {index + 2}
                                                </td>
                                                {hasSquadTeams && (
                                                    <td className="px-3 py-2 text-center text-sm font-medium text-orange-400/80">
                                                        {team.name}
                                                    </td>
                                                )}
                                                {paddedPlayers.map((playerName, pi) => (
                                                    <td
                                                        key={pi}
                                                        className={`px-3 py-2 text-center text-sm ${playerName ? "text-white" : "text-zinc-600"}`}
                                                    >
                                                        {playerName || "—"}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Footer */}
                            <div className="px-2 py-2 bg-zinc-800/60 border-t border-white/10 text-center">
                                <span className="text-sm font-semibold text-zinc-300">
                                    Total Players: {totalPlayers}
                                </span>
                            </div>
                        </div>

                        {/* Footer Branding */}
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
