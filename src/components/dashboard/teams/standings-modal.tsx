"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng, toJpeg } from "html-to-image";
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
    Send,
    Bell,
    MessageCircle,
    RefreshCw,
    Sparkles,
    Download,
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
    phase: string | null;
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
    isDisqualified?: boolean;
    pointDeduction?: number;
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
    isChampionship?: boolean;
    initialGroup?: "A" | "B";
    disqualifiedTeamIds?: string[];
    pointDeductionMap?: Record<string, number>;
    championshipPhase?: string;
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
    isChampionship = false,
    initialGroup,
    disqualifiedTeamIds = [],
    pointDeductionMap = {},
    championshipPhase,
}: Props) {
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [isSendingDiscord, setIsSendingDiscord] = useState(false);
    const [discordSent, setDiscordSent] = useState(false);
    const [isSendingApp, setIsSendingApp] = useState(false);
    const [appSent, setAppSent] = useState(false);
    const [isSendingWA, setIsSendingWA] = useState(false);
    const [waSent, setWaSent] = useState(false);
    const [isFinalStandings, setIsFinalStandings] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [compareMatches, setCompareMatches] = useState(1);
    const [champGroup, setChampGroup] = useState<"ALL" | "A" | "B" | "FINALS">(initialGroup ?? (championshipPhase === "FINALS" ? "FINALS" : "ALL"));
    const [showZones, setShowZones] = useState(false);
    const [promptCopied, setPromptCopied] = useState(false);

    // Fetch saved overlay settings from gallery
    const { data: overlaySettings, refetch: refetchOverlay, isFetching: isFetchingOverlay } = useQuery<{ overlayOpacity: number; cardTint: number; cardBlur: number; rowTint: number }>({
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

    // Refetch on open and sync initial group
    useEffect(() => {
        if (isOpen) {
            refetch();
            if (championshipPhase === "FINALS") {
                setChampGroup("FINALS");
            } else if (initialGroup) {
                setChampGroup(initialGroup);
            }
        }
    }, [isOpen, refetch, initialGroup, championshipPhase]);

    // Auto-cap compareMatches to available range
    useEffect(() => {
        if (matchData && matchData.length > 1 && compareMatches >= matchData.length) {
            setCompareMatches(Math.max(1, matchData.length - 1));
        }
    }, [matchData, compareMatches]);

    // Auto-detect championship from match phases
    const detectedChampionship = useMemo(() => {
        if (isChampionship) return true;
        if (!matchData) return false;
        return matchData.some(m => m.phase?.startsWith("HEATS"));
    }, [matchData, isChampionship]);

    // ── Compute standings with position change tracking ────────

    // Championship: filter matches by group phase
    const filteredMatchData = useMemo(() => {
        if (!matchData || !detectedChampionship || champGroup === "ALL") return matchData;
        if (champGroup === "FINALS") return matchData.filter(m => m.phase === "FINALS");
        const phaseFilter = champGroup === "A" ? "HEATS_A" : "HEATS_B";
        return matchData.filter(m => m.phase === phaseFilter);
    }, [matchData, detectedChampionship, champGroup]);

    // Derive phase label from filtered match data
    const phaseLabel = useMemo(() => {
        if (!detectedChampionship || !filteredMatchData || filteredMatchData.length === 0) return null;
        const phases = new Set(filteredMatchData.map(m => m.phase).filter(Boolean));
        if (phases.has("FINALS")) return "Finals";
        if (phases.has("WILDCARD")) return "Wildcard";
        if (phases.has("HEATS_A") || phases.has("HEATS_B")) return "Heats";
        return null;
    }, [detectedChampionship, filteredMatchData]);

    const standings = useMemo<StandingRow[]>(() => {
        const data = filteredMatchData;
        if (!data || data.length === 0) return [];

        // Helper: compute standings for a subset of matches
        function computeRanking(matchArr: MatchData[]): Map<string, StandingRow> {
            const map = new Map<string, StandingRow>();
            const totalMatchCount = matchArr.length;
            for (const match of matchArr) {
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
        const currentMap = computeRanking(data);
        const currentSorted = sortRows(Array.from(currentMap.values()));

        // Previous standings (excluding last N matches) for position change
        if (data.length > compareMatches) {
            const prevMatches = data.slice(0, data.length - compareMatches);
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

        // Zero out DQ'd teams and push to bottom
        const dqSet = new Set(disqualifiedTeamIds);
        const regular: StandingRow[] = [];
        const dqRows: StandingRow[] = [];
        for (const row of currentSorted) {
            if (dqSet.has(row.teamId)) {
                dqRows.push({ ...row, totalPoints: 0, totalKills: 0, placementPts: 0, wins: 0, isDisqualified: true });
            } else {
                // Apply point deduction
                const deduction = pointDeductionMap[row.teamId] ?? 0;
                if (deduction > 0) {
                    regular.push({ ...row, totalPoints: row.totalPoints - deduction, pointDeduction: deduction });
                } else {
                    regular.push(row);
                }
            }
        }

        // Re-sort regular rows after applying deductions
        const resorted = sortRows(regular);

        return [...resorted, ...dqRows];
    }, [filteredMatchData, compareMatches, disqualifiedTeamIds, pointDeductionMap]);

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

        // Casual = wider layout for long player names, Squad = compact for 5-char names
        const rowsPerCol = Math.ceil(standings.length / 2);
        const captureWidth = allowSquads ? 620 : 1080;
        const rowHeight = allowSquads ? 34 : 42;
        const tableHeight = 28 + rowsPerCol * rowHeight;
        const captureHeight = Math.max(captureWidth, 90 + 30 + tableHeight + 40);
        const pixelRatio = allowSquads ? 3 : 2;

        // Style the clone for desktop capture
        clone.style.cssText = `
            width: ${captureWidth}px; height: ${captureHeight}px;
            display: flex; align-items: flex-start; justify-content: center;
            background-image: url(${backgroundImage});
            background-size: cover; background-position: center;
            position: relative; overflow: hidden;
            padding: 15px 8px 8px;
        `;

        // Create offscreen container
        const tempContainer = document.createElement("div");
        tempContainer.style.cssText = "position: absolute; left: -9999px; top: 0;";
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);

        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
            // Capture as JPEG for best quality
            const dataUrl = await toJpeg(clone, {
                width: captureWidth,
                height: captureHeight,
                pixelRatio,
                quality: 0.92,
            });

            // Convert data URL to blob (JPEG)
            const res = await fetch(dataUrl);
            const jpegBlob = await res.blob();

            const file = new File(
                [jpegBlob],
                `${(tournamentTitle || "standings").replace(/\s+/g, "-")}.jpg`,
                { type: "image/jpeg" }
            );

            // Try share API first (mobile) — supports JPEG
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

            // Try JPEG clipboard
            if (navigator.clipboard && window.ClipboardItem) {
                try {
                    await navigator.clipboard.write([
                        new window.ClipboardItem({ "image/jpeg": jpegBlob }),
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
            document.body.removeChild(tempContainer);
            setIsSharing(false);
        }
    }, [tournamentTitle, backgroundImage, standings, allowSquads]);


    // ── Capture screenshot as data URL (shared helper) ────────
    // Uses landscape two-col layout with boosted DPI for Discord clarity

    const captureScreenshot = useCallback(async (): Promise<string | null> => {
        const element = document.getElementById("standings-content");
        if (!element) return null;

        const clone = element.cloneNode(true) as HTMLElement;
        clone.removeAttribute("id");

        const mobileEl = clone.querySelector(".mobile-standings");
        if (mobileEl) mobileEl.remove();

        const desktopEl = clone.querySelector(".desktop-standings") as HTMLElement | null;
        const twoColEl = clone.querySelector(".desktop-two-col") as HTMLElement | null;
        const singleColEl = clone.querySelector(".desktop-single-col") as HTMLElement | null;
        if (desktopEl) desktopEl.style.display = "block";
        if (twoColEl) { twoColEl.style.display = "flex"; twoColEl.style.gap = "1rem"; twoColEl.style.justifyContent = "center"; }
        if (singleColEl) singleColEl.style.display = "none";

        clone.querySelectorAll(".floating-controls").forEach((el) => el.remove());

        // Casual = wider layout for long player names, Squad = compact for 5-char names
        const rowsPerCol = Math.ceil(standings.length / 2);
        const captureWidth = allowSquads ? 620 : 1080;
        const rowHeight = allowSquads ? 34 : 42;
        const tableHeight = 28 + rowsPerCol * rowHeight;
        const captureHeight = Math.max(captureWidth, 90 + 30 + tableHeight + 40);
        const pixelRatio = allowSquads ? 3 : 2;

        clone.style.cssText = `
            width: ${captureWidth}px; height: ${captureHeight}px;
            display: flex; align-items: flex-start; justify-content: center;
            background-image: url(${backgroundImage});
            background-size: cover; background-position: center;
            position: relative; overflow: hidden;
            padding: 15px 8px 8px;
        `;

        const tempContainer = document.createElement("div");
        tempContainer.style.cssText = "position: absolute; left: -9999px; top: 0;";
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);

        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
            const dataUrl = await toJpeg(clone, {
                width: captureWidth,
                height: captureHeight,
                pixelRatio,
                quality: 0.92,
            });
            return dataUrl;
        } catch (error) {
            console.error("Screenshot capture failed:", error);
            return null;
        } finally {
            document.body.removeChild(tempContainer);
        }
    }, [backgroundImage, standings, detectedChampionship]);

    // ── Download image ───────────────────────────────────────

    const [isDownloading, setIsDownloading] = useState(false);

    const downloadImage = useCallback(async () => {
        setIsDownloading(true);
        try {
            const dataUrl = await captureScreenshot();
            if (!dataUrl) { setIsDownloading(false); return; }
            const link = document.createElement("a");
            link.download = `${(tournamentTitle || "standings").replace(/\s+/g, "-")}-standings.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Download error:", error);
            toast.error("Failed to download");
        } finally {
            setIsDownloading(false);
        }
    }, [tournamentTitle, captureScreenshot]);

    // ── Send to Discord ───────────────────────────────────────

    const sendToDiscord = useCallback(async () => {
        if (isSendingDiscord) return;
        setIsSendingDiscord(true);
        setDiscordSent(false);

        try {
            const dataUrl = await captureScreenshot();
            if (!dataUrl) {
                toast.error("Failed to capture screenshot");
                return;
            }

            // Determine phase from current view
            const phase = champGroup === "A" ? "HEATS_A"
                : champGroup === "B" ? "HEATS_B"
                : champGroup === "FINALS" ? "FINALS"
                : null;

            // Get max match count from standings
            const maxMatches = standings.length > 0
                ? Math.max(...standings.map(s => s.matchCount))
                : 0;

            const res = await fetch("/api/discord/send-standings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: dataUrl,
                    tournamentName: tournamentTitle,
                    phase,
                    matchCount: maxMatches,
                    isFinal: isFinalStandings,
                }),
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed");
            }

            setDiscordSent(true);
            toast.success("Standings sent to Discord!");
            setTimeout(() => setDiscordSent(false), 3000);
        } catch (err) {
            toast.error((err as Error).message || "Failed to send to Discord");
        } finally {
            setIsSendingDiscord(false);
        }
    }, [isSendingDiscord, captureScreenshot, champGroup, tournamentTitle, standings, isFinalStandings]);

    // ── Send to App (channel + push) ─────────────────────

    const sendToApp = useCallback(async () => {
        if (isSendingApp) return;
        setIsSendingApp(true);
        setAppSent(false);

        try {
            const dataUrl = await captureScreenshot();
            if (!dataUrl) {
                toast.error("Failed to capture screenshot");
                return;
            }

            // Upload screenshot via /api/upload-image (expects JSON { image: dataUrl })
            const uploadRes = await fetch("/api/upload-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: dataUrl }),
            });
            if (!uploadRes.ok) throw new Error("Image upload failed");
            const uploadJson = await uploadRes.json();
            const imageUrl = uploadJson.url;
            if (!imageUrl) throw new Error("No image URL returned");

            // Build caption
            const maxMatches = standings.length > 0
                ? Math.max(...standings.map(s => s.matchCount))
                : 0;
            const phaseLabel = champGroup === "A" ? "Heats · Group A"
                : champGroup === "B" ? "Heats · Group B"
                : champGroup === "FINALS" ? "Finals"
                : "";
            const matchInfo = maxMatches ? ` (After ${maxMatches} Match${maxMatches !== 1 ? "es" : ""})` : "";
            const caption = isFinalStandings
                ? `🏆 ${tournamentTitle} — ${phaseLabel ? phaseLabel + " " : ""}FINAL STANDINGS`
                : `🏆 ${tournamentTitle} — ${phaseLabel ? phaseLabel : "Overall Standings"}${matchInfo}`;

            // Post as announcement to tournament channel
            const postRes = await fetch("/api/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: caption,
                    imageUrl,
                    channel: tournamentId,
                    type: "image",
                }),
            });
            if (!postRes.ok) {
                const json = await postRes.json().catch(() => ({}));
                throw new Error(json.message || "Failed to post");
            }

            setAppSent(true);
            toast.success("Standings sent to App channel! 🔔");
            setTimeout(() => setAppSent(false), 3000);
        } catch (err) {
            toast.error((err as Error).message || "Failed to send to App");
        } finally {
            setIsSendingApp(false);
        }
    }, [isSendingApp, captureScreenshot, champGroup, tournamentTitle, tournamentId, standings, isFinalStandings]);

    // ── Send to WhatsApp ─────────────────────────────────

    const sendToWhatsApp = useCallback(async () => {
        if (isSendingWA) return;
        setIsSendingWA(true);
        setWaSent(false);

        try {
            const dataUrl = await captureScreenshot();
            if (!dataUrl) {
                toast.error("Failed to capture screenshot");
                return;
            }

            // Build caption
            const maxMatches = standings.length > 0
                ? Math.max(...standings.map(s => s.matchCount))
                : 0;
            const phaseLabel = champGroup === "A" ? "Heats · Group A"
                : champGroup === "B" ? "Heats · Group B"
                : champGroup === "FINALS" ? "Finals"
                : "";
            const matchInfo = maxMatches ? ` (After ${maxMatches} Match${maxMatches !== 1 ? "es" : ""})` : "";
            const caption = isFinalStandings
                ? `🏆 *${tournamentTitle}* — ${phaseLabel ? phaseLabel + " " : ""}FINAL STANDINGS`
                : `🏆 *${tournamentTitle}* — ${phaseLabel ? phaseLabel : "Overall Standings"}${matchInfo}`;

            const group = champGroup === "A" ? "A"
                : champGroup === "B" ? "B"
                : champGroup === "FINALS" ? "FINALS"
                : undefined;

            const res = await fetch("/api/whatsapp/send-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tournamentId,
                    image: dataUrl,
                    caption,
                    group,
                }),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || "Failed to send");
            }

            setWaSent(true);
            toast.success("Standings sent to WhatsApp! 💬");
            setTimeout(() => setWaSent(false), 3000);
        } catch (err) {
            toast.error((err as Error).message || "Failed to send to WhatsApp");
        } finally {
            setIsSendingWA(false);
        }
    }, [isSendingWA, captureScreenshot, champGroup, tournamentTitle, tournamentId, standings, isFinalStandings]);

    // ── Copy AI Prompt ────────────────────────────────────

    const copyAIPrompt = useCallback(async () => {
        if (standings.length === 0) {
            toast.error("No standings data to generate prompt");
            return;
        }

        const matchCount = standings[0]?.matchCount ?? 0;
        const teamCount = standings.length;

        // Truncate team name to 5 chars
        const shortName = (name: string) => {
            const cleaned = name.replace(/[^\w\p{L}\p{N}]/gu, "").slice(0, 7).toUpperCase();
            return cleaned || name.slice(0, 7).toUpperCase();
        };

        const lines = standings.map((row, i) => {
            const rank = `#${i + 1}`;
            const name = shortName(row.teamName);
            return `${rank} ${name} — M: ${matchCount}, P: ${row.placementPts}, E: ${row.totalKills}, T: ${row.totalPoints}`;
        });

        const title = tournamentTitle || "Tournament";
        const season = seasonName || "";

        const prompt = `Create a visually stunning "Overall Standings" image for a BGMI (Battlegrounds Mobile India) esports tournament. This is for a website called Bimon Tournament (BT). You may include BGMI characters in the design. The image must be 1:1 ratio (square). Team names are max 7 characters. Do not add a podium.

Tournament: ${title}${season ? `\nSeason: ${season}` : ""}
Total Teams: ${teamCount}

Show columns: Rank, Team, M (Matches), P (Placement Points), E (Eliminations), T (Total = P + E)
Include a legend at the bottom: M = Matches · P = Placement Points · E = Eliminations · T = P + E

${lines.join("\n")}

Make it look premium and professional — suitable for posting on a tournament website. Clearly show all ${teamCount} teams in a table format with all columns visible. Include Bimon Tournament branding.`;

        try {
            await navigator.clipboard.writeText(prompt);
            setPromptCopied(true);
            toast.success("AI prompt copied — paste into Gemini!");
            setTimeout(() => setPromptCopied(false), 2000);
        } catch {
            toast.error("Failed to copy prompt");
        }
    }, [standings, tournamentTitle, seasonName]);

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
                }
                .team-name-marquee[data-overflows="true"] {
                    mask-image: linear-gradient(90deg, black 90%, transparent 100%);
                    -webkit-mask-image: linear-gradient(90deg, black 90%, transparent 100%);
                }
                .team-name-marquee[data-overflows="true"] .marquee-inner {
                    display: inline-block;
                    padding-right: 2em;
                    animation: marquee-scroll 5s ease-in-out infinite alternate;
                }
                .team-name-marquee:not([data-overflows="true"]) .marquee-inner {
                    display: inline-block;
                }
            `}</style>

            <div className="fixed inset-0 z-50 overflow-y-auto">
                {/* Floating Controls */}
                <div className="floating-controls absolute top-4 right-4 z-30 flex gap-2">
                    {/* Share Button */}
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
                                    }}
                                    className={`text-sm text-left px-3 py-1.5 rounded-lg transition-colors ${compareMatches === num ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-zinc-300 hover:bg-white/10"}`}
                                >
                                    {num === 1 ? "1 match ago" : `${num} matches ago`}
                                </button>
                            ))}
                        </div>

                        {/* Championship Group Switcher */}
                        {detectedChampionship && (
                            <>
                                <div className="h-px bg-white/10 my-2" />
                                <div className="text-xs text-zinc-400 mb-2 font-medium">Group</div>
                                <div className="flex flex-col gap-1">
                                    {(["ALL", "A", "B", "FINALS"] as const).map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => setChampGroup(g)}
                                            className={`text-sm text-left px-3 py-1.5 rounded-lg transition-colors ${champGroup === g
                                                ? g === "A" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                                : g === "B" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                                : g === "FINALS" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                                : "text-zinc-300 hover:bg-white/10"
                                            }`}
                                        >
                                            {g === "ALL" ? "Combined" : g === "FINALS" ? "Finals" : `Group ${g}`}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Zone Colors Toggle */}
                        {detectedChampionship && champGroup !== "ALL" && (
                            <>
                                <div className="h-px bg-white/10 my-2" />
                                <button
                                    onClick={() => setShowZones(prev => !prev)}
                                    className={`w-full text-sm text-left px-3 py-1.5 rounded-lg transition-colors ${showZones ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-zinc-300 hover:bg-white/10"}`}
                                >
                                    {showZones ? "✓ Zone Colors" : "Zone Colors"}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Main Content */}
                <div
                    id="standings-content"
                    className="relative w-full min-h-screen flex items-center justify-center bg-cover bg-center overflow-auto"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                >
                    {/* Gradient overlay — darkness only, no blur */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(to bottom, rgba(0,0,0,${overlayOpacity / 100}), rgba(0,0,0,${Math.max(0, overlayOpacity - 10) / 100}), rgba(0,0,0,${overlayOpacity / 100}))`,
                        }}
                    />


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
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 backdrop-blur-md">
                                        <span className="text-xs font-semibold text-white">{seasonName}</span>
                                    </div>
                                )}
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
                                    <Trophy className="h-3.5 w-3.5 text-orange-400" />
                                    <span className="text-xs font-medium text-white">Overall Rankings</span>
                                </div>
                            </div>

                            {/* Championship: show current group label */}
                            {detectedChampionship && (
                                <div className="mt-2 flex items-center justify-center">
                                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${
                                        champGroup === "A" ? "bg-blue-500/15 border-blue-500/40" :
                                        champGroup === "B" ? "bg-purple-500/15 border-purple-500/40" :
                                        "bg-orange-500/15 border-orange-500/40"
                                    }`}>
                                        <div className={`h-1.5 w-1.5 rounded-full ${
                                            champGroup === "A" ? "bg-blue-400" :
                                            champGroup === "B" ? "bg-purple-400" :
                                            "bg-orange-400"
                                        }`} />
                                        <span className={`text-sm font-bold uppercase tracking-widest ${
                                            champGroup === "A" ? "text-blue-300" :
                                            champGroup === "B" ? "text-purple-300" :
                                            "text-orange-300"
                                        }`}>
                                            {champGroup === "ALL"
                                                ? "Combined Standings"
                                                : champGroup === "FINALS"
                                                    ? "Finals"
                                                    : phaseLabel
                                                        ? `${phaseLabel} · Group ${champGroup}`
                                                        : `Group ${champGroup}`
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Standings Table */}
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div
                                className="rounded-2xl border border-white/[0.15] shadow-2xl shadow-black/40 p-4 sm:p-6"
                                style={{
                                    backgroundColor: `rgba(15,15,15,${Math.max(cardTint, 70) / 100})`,
                                }}
                            >
                                <StandingsTable standings={standings} allowSquads={allowSquads} isChampionship={detectedChampionship} champGroup={champGroup} showZones={showZones} rowTint={rowTint} />
                            </div>
                        )}

                        {/* Footer branding */}
                        <div className="mt-6 flex items-center justify-center gap-2 text-white/50 text-xs">
                            <div className="h-px w-8 bg-gradient-to-r from-transparent to-orange-500/50" />
                            <span className="font-medium text-white/60">{GAME.name} × Bimon Tournament</span>
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
        return <span className="inline-flex items-center justify-center w-5 h-5 text-white/40"><Minus className="w-3 h-3" /></span>;
    if (change > 0)
        return <span className="inline-flex items-center gap-0.5 text-emerald-300 text-[10px] font-bold"><ChevronUp className="w-3.5 h-3.5" /><span>{change}</span></span>;
    return <span className="inline-flex items-center gap-0.5 text-red-300 text-[10px] font-bold"><ChevronDown className="w-3.5 h-3.5" /><span>{Math.abs(change)}</span></span>;
}

// ── Championship zone styling ─────────────────────────────────

function getChampionshipZone(rank: number, total: number): { zone: string; color: string; border: string } | null {
    if (total < 6) return null; // Not enough teams for zones
    // Top 8 → qualified (green), bottom 3 → eliminated (red), rest → neutral
    const eliminatedCutoff = total - 2; // e.g. 11 teams → rank 9+ eliminated
    if (rank <= 8) return { zone: "QUALIFIED", color: "text-emerald-400", border: "border-l-emerald-400 bg-emerald-500/10" };
    if (rank >= eliminatedCutoff) return { zone: "ELIMINATED", color: "text-red-400/60", border: "border-l-red-400 bg-red-500/8" };
    return null; // Middle teams — no zone color
}

// ── Standings Table — Podium Top 3 + Two-column rest ──────────

function StandingsTable({ standings, allowSquads = false, isChampionship = false, champGroup = "ALL", showZones = false, rowTint = 5 }: { standings: StandingRow[]; allowSquads?: boolean; isChampionship?: boolean; champGroup?: string; showZones?: boolean; rowTint?: number }) {
    const hasSquadTeams = allowSquads;

    const renderTable = (slice: StandingRow[], startIndex: number) => {
        const totalTeams = standings.length;
        const eliminatedCutoff = totalTeams - 2;
        const zoneBoundaries = showZones ? [8, ...(eliminatedCutoff > 8 ? [eliminatedCutoff - 1] : [])] : [];

        return (
        <div
            className="overflow-hidden rounded-xl"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
            <table className="w-full border-collapse" style={{ fontSize: '14px' }}>
                <thead>
                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderBottom: '2px solid rgba(251,146,60,0.3)' }}>
                        <th style={{ padding: '7px 4px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>#</th>
                        <th style={{ padding: '7px 4px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', color: 'rgba(255,255,255,0.7)' }}>Team</th>
                        <th style={{ padding: '7px 2px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>M</th>
                        <th style={{ padding: '7px 2px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>P</th>
                        <th style={{ padding: '7px 2px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>E</th>
                        <th style={{ padding: '7px 4px', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', color: '#fb923c' }}>T</th>
                    </tr>
                </thead>
                <tbody>
                    {slice.map((row, idx) => {
                        const rank = startIndex + idx + 1;
                        const styles = getRankStyles(rank);
                        const zone = showZones ? getChampionshipZone(rank, totalTeams) : null;
                        const isZoneBoundary = zoneBoundaries.includes(rank);
                        const isEven = idx % 2 === 0;

                        return (
                            <>
                                {isZoneBoundary && (
                                    <tr key={`zone-sep-${rank}`}>
                                        <td colSpan={6} style={{ padding: '1px 0' }}>
                                            <div className={`w-full ${
                                                rank === 4 ? "bg-gradient-to-r from-emerald-500/40 via-amber-500/30 to-transparent" :
                                                "bg-gradient-to-r from-amber-500/40 via-red-500/30 to-transparent"
                                            }`} style={{ height: '1px' }} />
                                        </td>
                                    </tr>
                                )}
                                <tr
                                    key={row.teamId}
                                    style={{
                                        backgroundColor: row.isDisqualified ? 'rgba(239,68,68,0.05)' : isEven ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                                        ...(zone ? { borderLeft: `2px solid ${zone.zone === 'QUALIFIED' ? '#10b981' : zone.zone === 'WILDCARD' ? '#f59e0b' : '#ef4444'}` } : {}),
                                    }}
                                    className={row.isDisqualified ? "opacity-40" : ""}
                                >
                                    <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle', width: '32px' }}>
                                        <span className={`inline-flex items-center justify-center rounded-md font-black ${
                                            zone
                                                ? zone.zone === "QUALIFIED" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : zone.zone === "WILDCARD" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                                : "bg-red-500/15 text-red-400/60 border border-red-500/20"
                                                : styles.badge
                                        }`} style={{ width: '24px', height: '24px', fontSize: '12px', fontWeight: 900, lineHeight: 1 }}>
                                            {rank}
                                        </span>
                                    </td>

                                    <td style={{ padding: '6px 4px', textAlign: 'left', verticalAlign: 'middle' }}>
                                        <div className="flex items-center" style={{ gap: '5px' }}>
                                            {hasSquadTeams && (
                                                <img src={row.clanLogo || GAME.iconUrl} alt="" style={{ width: '16px', height: '16px', objectFit: 'cover', flexShrink: 0, clipPath: 'circle(50%)' }} />
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span className={`${ 
                                                    row.isDisqualified ? "text-red-400/70 line-through" :
                                                    zone?.zone === "ELIMINATED" ? "text-zinc-400" : "text-white"
                                                }`} style={{ fontSize: hasSquadTeams ? '13px' : '10px', fontWeight: 700, whiteSpace: hasSquadTeams ? 'nowrap' : 'normal', wordBreak: hasSquadTeams ? undefined : 'break-word' as never }}>
                                                    {hasSquadTeams ? (row.teamName.length > 7 ? row.teamName.slice(0, 7) : row.teamName) : row.playerNames.join(", ")}
                                                    {row.isDisqualified && <span style={{ marginLeft: '3px', fontSize: '8px', fontWeight: 700, color: '#f87171', backgroundColor: 'rgba(239,68,68,0.2)', padding: '1px 3px', borderRadius: '3px', display: 'inline-block' }}>DQ</span>}
                                                </span>
                                                {row.wins > 0 && <span style={{ fontSize: '8px', color: '#facc15', fontWeight: 600, lineHeight: 1 }}>🍗x{row.wins}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '6px 2px', textAlign: 'center', verticalAlign: 'middle', color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{row.matchCount}</td>
                                    <td style={{ padding: '6px 2px', textAlign: 'center', verticalAlign: 'middle', color: 'white', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{row.placementPts}</td>
                                    <td style={{ padding: '6px 2px', textAlign: 'center', verticalAlign: 'middle', color: 'white', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{row.totalKills}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                                        <span style={{ color: '#fb923c', fontSize: '15px', fontWeight: 900, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{row.totalPoints}</span>
                                        {(row.pointDeduction ?? 0) > 0 && (
                                            <span style={{ marginLeft: '2px', fontSize: '8px', fontWeight: 700, color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.2)', padding: '1px 3px', borderRadius: '3px', display: 'inline-block' }}>-{row.pointDeduction}</span>
                                        )}
                                    </td>
                                </tr>
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
        );
    };

    const half = Math.ceil(standings.length / 2);

    return (
        <div className="w-full">
            {/* ── Mobile: single column (all teams) ──────── */}
            {standings.length > 0 && (
                <div className="mobile-standings sm:hidden space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {standings.map((row, index) => {
                        const rank = index + 1;
                        const styles = getRankStyles(rank);
                        const zone = showZones ? getChampionshipZone(rank, standings.length) : null;
                        return (
                            <div key={row.teamId} className={`rounded-lg border backdrop-blur-lg px-3 py-2.5 flex items-start gap-3 transition-all ${
                                zone ? `border-l-2 ${zone.border} border-white/[0.12]` : `border-white/[0.12] ${styles.row}`
                            }`}
                            style={{ backgroundColor: `rgba(255,255,255,${rowTint / 100})` }}
                            >
                                <div className="flex flex-col items-center gap-0.5">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                        zone
                                            ? zone.zone === "QUALIFIED" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : zone.zone === "WILDCARD" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                            : "bg-red-500/15 text-red-400/60 border border-red-500/20"
                                            : styles.badge
                                    }`}>
                                        {rank}
                                    </div>
                                    <PositionChangeIndicator change={row.positionChange} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="team-name-marquee flex-1 min-w-0"
                                            ref={(el) => {
                                                if (!el) return;
                                                requestAnimationFrame(() => {
                                                    el.dataset.overflows = String(el.scrollWidth > el.clientWidth);
                                                });
                                            }}
                                        >
                                            <span className={`marquee-inner text-sm font-semibold whitespace-nowrap ${zone?.zone === "ELIMINATED" ? "text-zinc-400" : "text-white"}`}>
                                                <span className="inline-flex items-center gap-1.5">
                                                    {hasSquadTeams && (
                                                        <img src={row.clanLogo || GAME.iconUrl} alt="" className="w-4 h-4 object-cover shrink-0 inline" style={{ clipPath: 'circle(50%)' }} />
                                                    )}
                                                    {hasSquadTeams ? row.teamName : row.playerNames.join(", ")}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                    {row.wins > 0 && (
                                        <div className="text-[10px] text-yellow-400 font-semibold mt-0.5">🍗 {row.wins} win{row.wins > 1 ? "s" : ""}</div>
                                    )}
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60">
                                            <span className="text-white/40">M</span>
                                            <span className="font-medium text-white">{row.matchCount}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-white/60">
                                            <span className="text-white/40">K</span>
                                            <span className="font-medium text-white">{row.totalKills}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5">
                                            <span className="text-orange-400/70">TOTAL</span>
                                            <span className="font-bold text-orange-400">{row.totalPoints}</span>
                                            {(row.pointDeduction ?? 0) > 0 && (
                                                <span className="text-[8px] font-bold text-amber-400 bg-amber-500/20 px-1 py-0.5 rounded">-{row.pointDeduction}</span>
                                            )}
                                        </span>
                                        {zone && (
                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${zone.color}`}>
                                                {zone.zone === "QUALIFIED" ? "✓ Qualified" : "✗ Out"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Desktop: two-column table (all teams) ─── */}
            {standings.length > 0 && (
                <div className="desktop-standings hidden sm:block">
                    <div className="desktop-two-col hidden lg:flex lg:gap-3 lg:justify-center">
                        <div className="flex-1">{renderTable(standings.slice(0, half), 0)}</div>
                        <div className="flex-1">{renderTable(standings.slice(half), half)}</div>
                    </div>
                    <div className="desktop-single-col block lg:hidden">{renderTable(standings, 0)}</div>
                    <div className="column-legend" style={{ textAlign: 'center', marginTop: '6px', fontSize: '9px', color: 'rgba(255,255,255,0.45)', fontWeight: 500, letterSpacing: '0.02em' }}>
                        M = Matches · P = Placement Points · E = Eliminations · T = P + E
                    </div>
                </div>
            )}
        </div>
    );
}
