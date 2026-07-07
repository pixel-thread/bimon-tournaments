"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng, toJpeg } from "html-to-image";
import { toast } from "sonner";
import { X, Copy, Check, Send, Loader2, MessageCircle, Download } from "lucide-react";
import { GAME } from "@/lib/game-config";

// ── Types ──────────────────────────────────────────────────────

interface TeamDTO {
    id: string;
    name: string;
    fullName?: string | null;
    clanLogo?: string | null;
    clanTag?: string | null;
    players: { id: string; displayName: string | null; username: string }[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tournamentTitle: string;
    tournamentId?: string;
    teams: TeamDTO[];
    seasonName?: string;
    backgroundImage?: string;
    allowSquads?: boolean;
    championshipGroups?: Map<string, string>;
    phaseLabel?: string;
    selectedGroup?: string; // "A", "B", etc. — routes Discord send to group channel
}

// ── Component ─────────────────────────────────────────────────

export function SlotsModal({
    isOpen,
    onClose,
    tournamentTitle,
    tournamentId,
    teams,
    seasonName = "",
    backgroundImage = "/images/image.webp",
    allowSquads = false,
    championshipGroups,
    phaseLabel,
    selectedGroup,
}: Props) {
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [discordSending, setDiscordSending] = useState(false);
    const [discordSent, setDiscordSent] = useState(false);
    const [waSending, setWaSending] = useState(false);
    const [waSent, setWaSent] = useState(false);

    // Fetch saved overlay settings from gallery
    const { data: overlaySettings } = useQuery<{ overlayOpacity: number; cardTint: number; cardBlur: number; rowTint: number }>({
        queryKey: ["overlay-settings"],
        queryFn: async () => {
            const res = await fetch("/api/gallery/overlay-settings");
            if (!res.ok) return { overlayOpacity: 50, cardTint: 40, cardBlur: 12, rowTint: 5 };
            const json = await res.json();
            return json.data;
        },
        enabled: isOpen,
        staleTime: 5_000,
    });

    const overlayOpacity = overlaySettings?.overlayOpacity ?? 50;
    const cardTint = overlaySettings?.cardTint ?? 40;
    const cardBlur = overlaySettings?.cardBlur ?? 12;
    const rowTint = overlaySettings?.rowTint ?? 5;

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

    // Championship grouping
    const groupedTeams = useMemo(() => {
        if (!championshipGroups || championshipGroups.size === 0) return null;
        const groupA: TeamDTO[] = [];
        const groupB: TeamDTO[] = [];
        const other: TeamDTO[] = [];
        for (const t of uniqueTeams) {
            const g = championshipGroups.get(t.id);
            if (g === "A") groupA.push(t);
            else if (g === "B") groupB.push(t);
            else other.push(t);
        }
        return { groupA, groupB, other };
    }, [uniqueTeams, championshipGroups]);

    // ── Screenshot capture helper ─────────────────────────────

    const captureImage = useCallback(async (): Promise<string | null> => {
        const element = document.getElementById("teams-list-content");
        if (!element) return null;

        // Calculate the full width needed for all columns — ensure ALL player cols (incl. P6) fit
        const slotCol = 50;
        const teamCol = hasSquadTeams ? 110 : 0;
        const playerCols = maxPlayers * 130;
        const safetyPadding = 40; // extra buffer so nothing gets clipped
        const captureWidth = slotCol + teamCol + playerCols + safetyPadding;
        const fullWidth = Math.max(700, captureWidth);

        // Max quality — 4x DPI + near-lossless JPEG (canvas stays under 16MP mobile limit)
        const pixelRatio = 4;

        // Create an off-screen container outside the modal layout
        const offscreen = document.createElement("div");
        offscreen.style.position = "fixed";
        offscreen.style.left = "0";
        offscreen.style.top = "0";
        offscreen.style.width = `${fullWidth}px`;
        offscreen.style.height = "auto";
        offscreen.style.overflow = "visible";
        offscreen.style.zIndex = "-9999";
        offscreen.style.opacity = "0";
        offscreen.style.pointerEvents = "none";
        document.body.appendChild(offscreen);

        // Deep clone the element into the off-screen container
        const clone = element.cloneNode(true) as HTMLElement;
        clone.id = "teams-list-content-clone";
        clone.style.width = `${fullWidth}px`;
        clone.style.minWidth = `${fullWidth}px`;
        clone.style.minHeight = "auto";
        clone.style.height = "auto";
        clone.style.overflow = "visible";

        // Force overflow visible and remove max-width constraints on ALL descendants
        clone.querySelectorAll("*").forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
                htmlEl.style.overflow = "visible";
                htmlEl.style.overflowX = "visible";
                htmlEl.style.maxWidth = "none";
            }
        });

        // Remove floating controls from clone
        clone.querySelectorAll(".floating-controls").forEach((el) => el.remove());

        offscreen.appendChild(clone);

        // Force reflow so clientWidth reflects the actual width
        void clone.offsetWidth;
        const capturedHeight = clone.scrollHeight || clone.offsetHeight;

        try {
            const dataUrl = await toJpeg(clone, {
                pixelRatio,
                quality: 0.98,
                width: fullWidth,
                height: capturedHeight,
                style: {
                    width: `${fullWidth}px`,
                    minWidth: `${fullWidth}px`,
                    overflow: "visible",
                },
            });
            return dataUrl;
        } finally {
            offscreen.remove();
        }
    }, [hasSquadTeams, maxPlayers]);

    // ── Copy / Share ─────────────────────────────────────────

    const copyToClipboard = useCallback(async () => {
        setIsSharing(true);
        setShareSuccess(false);

        try {
            const dataUrl = await captureImage();
            if (!dataUrl) { setIsSharing(false); return; }

            const res = await fetch(dataUrl);
            const blob = await res.blob();

            const file = new File(
                [blob],
                `${(tournamentTitle || "teams").replace(/\s+/g, "-")}-teams.jpg`,
                { type: "image/jpeg" }
            );

            // Try share API first (mobile)
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: tournamentTitle });
                    setShareSuccess(true);
                    setTimeout(() => setShareSuccess(false), 2000);
                    return;
                } catch (e: unknown) {
                    if ((e as Error).name === "AbortError") return;
                    console.warn("Share failed:", e);
                }
            }

            // Try JPEG clipboard
            if (navigator.clipboard && window.ClipboardItem) {
                try {
                    await navigator.clipboard.write([
                        new window.ClipboardItem({ "image/jpeg": blob }),
                    ]);
                    setShareSuccess(true);
                    toast.success("Copied to clipboard!");
                    setTimeout(() => setShareSuccess(false), 2000);
                    return;
                } catch {
                    // JPEG clipboard not supported
                }
            }

            toast.error("Clipboard not supported — use download button");
        } catch (error) {
            console.error("Screenshot error:", error);
            toast.error("Failed to capture screenshot");
        } finally {
            setIsSharing(false);
        }
    }, [tournamentTitle, captureImage]);

    // ── Download image ───────────────────────────────────────

    const [isDownloading, setIsDownloading] = useState(false);

    const downloadImage = useCallback(async () => {
        setIsDownloading(true);
        try {
            const dataUrl = await captureImage();
            if (!dataUrl) { setIsDownloading(false); return; }
            const link = document.createElement("a");
            link.download = `${(tournamentTitle || "teams").replace(/\s+/g, "-")}-teams.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Download error:", error);
            toast.error("Failed to download");
        } finally {
            setIsDownloading(false);
        }
    }, [tournamentTitle, captureImage]);

    // ── Send to Discord ──────────────────────────────────────

    const sendToDiscord = useCallback(async () => {
        if (!tournamentId) {
            toast.error("No tournament selected");
            return;
        }

        setDiscordSending(true);
        setDiscordSent(false);

        try {
            const dataUrl = await captureImage();
            if (!dataUrl) {
                toast.error("Failed to capture image");
                setDiscordSending(false);
                return;
            }

            const res = await fetch("/api/discord/send-slot-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: dataUrl,
                    tournamentId,
                    tournamentName: tournamentTitle,
                    group: selectedGroup || undefined,
                }),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(json.error || `Failed (${res.status})`);
            }

            setDiscordSent(true);
            toast.success("Slot image sent to Discord!");
            setTimeout(() => setDiscordSent(false), 3000);
        } catch (error) {
            console.error("Discord send error:", error);
            toast.error(`Discord: ${(error as Error).message || "Failed to send"}`);
        } finally {
            setDiscordSending(false);
        }
    }, [tournamentId, tournamentTitle, captureImage, selectedGroup]);

    // ── Send to WhatsApp ──────────────────────────────────────

    const sendToWhatsApp = useCallback(async () => {
        if (!tournamentId) {
            toast.error("No tournament selected");
            return;
        }

        setWaSending(true);
        setWaSent(false);

        try {
            const dataUrl = await captureImage();
            if (!dataUrl) {
                toast.error("Failed to capture image");
                setWaSending(false);
                return;
            }

            const res = await fetch("/api/whatsapp/send-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: dataUrl,
                    tournamentId,
                    caption: `📋 ${tournamentTitle} — Team Slots`,
                    group: selectedGroup || undefined,
                }),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(json.error || `Failed (${res.status})`);
            }

            setWaSent(true);
            toast.success("Slot image sent to WhatsApp!");
            setTimeout(() => setWaSent(false), 3000);
        } catch (error) {
            console.error("WhatsApp send error:", error);
            toast.error(`WhatsApp: ${(error as Error).message || "Failed to send"}`);
        } finally {
            setWaSending(false);
        }
    }, [tournamentId, tournamentTitle, captureImage, selectedGroup]);

    if (!isOpen) return null;

    // Helper to render team rows (reused for grouped/ungrouped)
    function renderTeamRows(teamList: TeamDTO[], showSquad: boolean, maxCols: number) {
        return teamList.map((team, index) => {
            const players = team.players?.map((p) => p.displayName || p.username) || [];
            const paddedPlayers = [...players, ...Array(maxCols - players.length).fill("")];
            const colorCycle = index % 3;
            const textColor = colorCycle === 0 ? "text-white" : colorCycle === 1 ? "text-sky-100" : "text-amber-100";
            const rowBg = colorCycle === 0 ? "bg-white/[0.08]" : colorCycle === 1 ? "bg-sky-400/[0.10]" : "bg-amber-400/[0.10]";
            const textShadow = "0 1px 3px rgba(0,0,0,0.8)";

            return (
                <tr
                    key={team.id || index}
                    className={`border-b border-white/5 last:border-b-0 ${rowBg} hover:bg-white/15 transition-colors`}
                    style={{ textShadow }}
                >
                    <td className={`px-2 sm:px-3 py-1.5 sm:py-2 text-center text-[11px] sm:text-sm font-bold ${textColor}`}>
                        {index + 3}
                    </td>
                    {showSquad && (
                        <td className={`px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[11px] sm:text-sm font-bold whitespace-nowrap ${textColor}`}>
                            <span className="inline-flex items-center gap-1.5">
                                <img
                                    src={team.clanLogo || GAME.iconUrl}
                                    alt={team.clanTag || GAME.name}
                                    className="w-4 h-4 object-cover shrink-0"
                                    style={{ width: "16px", height: "16px", objectFit: "cover", flexShrink: 0, clipPath: "circle(50%)" }}
                                />
                                {team.fullName || team.name}
                            </span>
                        </td>
                    )}
                    {paddedPlayers.map((playerName, pi) => (
                        <td key={pi} className={`px-2 sm:px-3 py-1.5 sm:py-2 text-center text-[11px] sm:text-sm font-semibold whitespace-nowrap ${playerName ? textColor : "text-zinc-600"}`}>
                            {playerName || "\u2014"}
                        </td>
                    ))}
                </tr>
            );
        });
    }

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
                    {/* Copy / Share */}
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
                            <Send className="h-5 w-5" />
                        )}
                    </button>

                    {/* Download */}
                    <button
                        onClick={downloadImage}
                        disabled={isDownloading}
                        className="text-white hover:text-blue-400 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-blue-500/50 p-2.5 rounded-xl transition-all duration-300"
                        title="Download image"
                    >
                        {isDownloading ? (
                            <div className="h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Download className="h-5 w-5" />
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
                    {/* Gradient overlay — controlled by gallery slider */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(to bottom, rgba(0,0,0,${overlayOpacity / 100}), rgba(0,0,0,${Math.max(0, overlayOpacity - 10) / 100}), rgba(0,0,0,${overlayOpacity / 100}))`,
                        }}
                    />

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
                                <div className="mt-1.5 sm:mt-2 inline-flex items-center gap-2 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-blue-500/20 border border-blue-400/40">
                                    <span className="text-[10px] sm:text-xs font-semibold text-white">{seasonName}</span>
                                </div>
                            )}
                            {phaseLabel && (
                                <div className="mt-1.5 sm:mt-2 ml-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                                    <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">{phaseLabel}</span>
                                </div>
                            )}
                        </div>

                        {/* Table — scrollable on mobile */}
                        <div
                            className="rounded-xl sm:rounded-2xl border border-white/[0.15] shadow-2xl shadow-black/50 overflow-hidden"
                            style={{
                                backgroundColor: `rgba(0,0,0,${cardTint / 100})`,
                            }}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full" style={{ minWidth: `${40 + (hasSquadTeams ? 100 : 0) + maxPlayers * 130}px` }}>
                                    <thead>
                                        <tr className="bg-white/[0.06] border-b border-white/10">
                                            <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[11px] sm:text-sm font-semibold text-white whitespace-nowrap">
                                                Slot
                                            </th>
                                            {hasSquadTeams && (
                                                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[11px] sm:text-sm font-semibold text-white whitespace-nowrap">
                                                    Team
                                                </th>
                                            )}
                                            {Array.from({ length: maxPlayers }, (_, i) => (
                                                <th key={i} className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[11px] sm:text-sm font-semibold text-white whitespace-nowrap">
                                                    Player {i + 1}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedTeams ? (
                                            <>
                                                {groupedTeams.groupA.length > 0 && (
                                                    <>
                                                        <tr>
                                                            <td colSpan={1 + (hasSquadTeams ? 1 : 0) + maxPlayers} className="px-3 py-2 bg-blue-500/10 border-b border-blue-500/20">
                                                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Group A</span>
                                                                <span className="text-[10px] text-blue-400/60 ml-2">{groupedTeams.groupA.length} teams</span>
                                                            </td>
                                                        </tr>
                                                        {renderTeamRows(groupedTeams.groupA, hasSquadTeams, maxPlayers)}
                                                    </>
                                                )}
                                                {groupedTeams.groupB.length > 0 && (
                                                    <>
                                                        <tr>
                                                            <td colSpan={1 + (hasSquadTeams ? 1 : 0) + maxPlayers} className="px-3 py-2 bg-purple-500/10 border-b border-purple-500/20">
                                                                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Group B</span>
                                                                <span className="text-[10px] text-purple-400/60 ml-2">{groupedTeams.groupB.length} teams</span>
                                                            </td>
                                                        </tr>
                                                        {renderTeamRows(groupedTeams.groupB, hasSquadTeams, maxPlayers)}
                                                    </>
                                                )}
                                                {groupedTeams.other.length > 0 && renderTeamRows(groupedTeams.other, hasSquadTeams, maxPlayers)}
                                            </>
                                        ) : (
                                            renderTeamRows(uniqueTeams, hasSquadTeams, maxPlayers)
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="px-2 py-2 sm:py-2.5 bg-white/[0.04] border-t border-white/10 text-center">
                                <span className="text-[11px] sm:text-sm font-semibold text-white">
                                    Total Players: {totalPlayers}
                                </span>
                            </div>
                        </div>

                        {/* Footer Branding */}
                        <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 text-white/50 text-[10px] sm:text-xs">
                            <div className="h-px w-6 sm:w-8 bg-gradient-to-r from-transparent to-orange-500/50" />
                            <span className="font-medium text-white/60">{GAME.name} × Bimon Tournament</span>
                            <div className="h-px w-6 sm:w-8 bg-gradient-to-l from-transparent to-orange-500/50" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
