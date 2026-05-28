"use client";

import { useState, useMemo, useEffect } from "react";
import { Input, Spinner } from "@heroui/react";
import {
    Clapperboard,
    Copy,
    Check,
    Search,
    ChevronDown,
    Trophy,
    RefreshCw,
    Type,
    FileText,
    Pin,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getPrizeDistribution, getTeamSize } from "@/lib/logic/prizeDistribution";

/* ─────────────── types ─────────────── */

interface TournamentOption {
    id: string;
    name: string;
    seasonName: string | null;
}

/* ─────────────── prompt data ─────────────── */

interface Prompt {
    id: number;
    title: string;
    text: string;
}

const PROMPTS: Prompt[] = [
    {
        id: 1,
        title: "Main Stage Showdown",
        text: `Create a YouTube thumbnail (1280×720) for a Bimon Tournament (BT) Tier-1 BGMI live stream. PMGC-style aesthetic. The background features a massive, dark esports arena with sweeping neon laser lights (cyan and gold) and a giant LED screen showing a subtle Erangel map. Foreground: High-fidelity 3D renders of PUBG Mobile characters (or provided player photos) in tactical gear, illuminated by dramatic rim lighting. The BT logo is rendered in premium 3D metallic gold in the top-left. Typography is clean, bold, and modern sans-serif: "[TOURNAMENT NAME] — [SEASON X]" at the top, and "[EVENT]" at the bottom. 8K resolution, octane render, broadcast-quality.`,
    },
    {
        id: 2,
        title: "Versus Face-Off",
        text: `Design a YouTube thumbnail (1280×720) for a Bimon Tournament BGMI live stream. PMGO style "Versus" graphic. Split the frame diagonally with a glowing neon slash. Two star players (or hyper-realistic 3D PUBG characters) face off on opposite sides, bathed in contrasting team colors (e.g., electric blue vs. intense crimson). Background features subtle glassmorphism UI elements and hex-grid patterns. The BT logo sits in the center inside a sleek holographic emblem. Text: "[TOURNAMENT NAME] — [SEASON X]" in sharp metallic chrome. "THE ULTIMATE CLASH" in clean, tracked-out font below. Tier-1 esports broadcast quality.`,
    },
    {
        id: 3,
        title: "Drop Zone Briefing",
        text: `YouTube thumbnail (1280×720) for a Bimon Tournament live stream. A tactical, high-end broadcast analytical screen. Background is a sleek 3D topographical map of a BGMI map with glowing neon drop paths. Foreground features premium 3D renders of characters (or player photos) standing confidently with crossed arms, wearing Level 3 gear with carbon-fiber textures. The BT logo is displayed as a sleek corporate sponsor badge. Text: "[TOURNAMENT NAME] — [SEASON X]" in bright white, "DROP HOT. SURVIVE." in a glowing accent color. Clean, minimalist, data-driven esports aesthetic.`,
    },
    {
        id: 4,
        title: "Star Player Spotlight",
        text: `Create a premium YouTube thumbnail (1280×720) for Bimon Tournament. Three player portraits (or high-end PUBG character renders) displayed in sleek, modern broadcast "player cards" made of frosted glass and metallic trim. Background is a dark, moody studio environment with subtle volumetric fog and spotlights hitting the cards. The BT logo is embossed in silver at the top center. Clean typography: "PLAYERS TO WATCH" and "[TOURNAMENT NAME] — [SEASON X]". High contrast, corporate esports branding, global championship vibe.`,
    },
    {
        id: 5,
        title: "Trio Focus Transition",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. A three-panel split-screen graphic identical to PMGC broadcast transitions. Each vertical panel features a different player (or 3D character render) with intense focus, lit by studio lighting. The dividers between panels are thin, glowing neon lines. Backgrounds are deep blacks with subtle moving particle effects. The BT logo is a clean watermark in the bottom right. Text: "[TOURNAMENT NAME]" in massive, thick 3D extruded letters with a matte finish. "[SEASON X] COMMENCES" in a sharp, secondary font. Ultra-professional.`,
    },
    {
        id: 6,
        title: "Survival Stakes",
        text: `Design a YouTube thumbnail (1280×720) for Bimon Tournament live stream. A cinematic, high-stakes atmosphere mimicking a major LAN event intro. Foreground features a single, highly detailed 3D PUBG character (or star player) walking away from an exploding vehicle, rendered with realistic physics, sparks, and cinematic depth of field (blurry background). Lighting is dramatic, with heavy shadows and bright orange/red rim lighting. The BT logo hovers as an AR (Augmented Reality) graphic in the scene. Text: "[TOURNAMENT NAME] — [SEASON X]" in sleek, cinematic typography. "SURVIVAL OF THE FITTEST" below.`,
    },
    {
        id: 7,
        title: "Global Championship Stage",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. Tier-1 championship presentation. The central figure (winning player or character) stands on a high-tech LED stage in a massive dark arena, holding a gleaming 3D rendered trophy. Cold blue and warm gold stage lights cut through the arena fog. Confetti falls, frozen in time with sharp clarity. The BT logo is projected massively on the arena screens behind them. Text: "[TOURNAMENT NAME] — [SEASON X]" in premium gold foil text. "[EVENT]" in crisp white. PMGC championship aesthetic.`,
    },
    {
        id: 8,
        title: "Broadcast Standings",
        text: `YouTube thumbnail (1280×720) for a Bimon Tournament BGMI live stream leaderboard. Recreate a highly polished, professional broadcast overlay. Three players (or characters) are featured next to a sleek, semi-transparent dark UI displaying team logos and rank numbers (#1, #2, #3). Background is a subtle, out-of-focus esports arena. Clean vector graphics, sharp edges, and a dark navy/carbon-fiber color palette. The BT logo in the top-left corner as a broadcast bug. Text: "[EVENT]" at the top. "[TOURNAMENT NAME] — [SEASON X]" at the bottom. Clean, stats-focused.`,
    },
    {
        id: 9,
        title: "The Ultimate Prize",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. A hyper-realistic, close-up 3D render of the BT Championship Trophy, forged in dark titanium and glowing gold. The background is pitch black with subtle volumetric light rays illuminating the trophy's intricate details. Silhouettes of three players (or characters) are visible in the background reflection or standing in the shadows behind it. Text: "[TOURNAMENT NAME] — [SEASON X] — [EVENT]" in elegant, minimalist typography. "FOR GLORY" in a subtle gold accent. Prestige, elite tier-1 vibe.`,
    },
    {
        id: 10,
        title: "MVP Crowned",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. MVP announcement graphic. One central player image (or high-end character render) dominating the right side of the screen, lit with a golden "halo" rim light. The left side features sleek, futuristic UI elements displaying impressive stats in neon text. Background is an abstract dark geometric pattern. The BT logo sits as a premium badge next to the text "MOST VALUABLE PLAYER". "[TOURNAMENT NAME] — [SEASON X]" below in a clean, tracked-out font. Broadcast-ready, highly polished.`,
    },
    {
        id: 11,
        title: "Augmented Reality Player Profiles",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. Futuristic PMGO-style broadcast graphic. Three players (or characters) are projected as glowing, high-tech holograms standing on a physical stage setup. Data points, kill counts, and tier rankings float around them in AR interfaces. Color palette is deep cyber-blue and crisp white. The BT logo is rendered as an AR projection on the stage floor. Text: "[TOURNAMENT NAME] — [SEASON X]" in a sleek tech font. "PLAYER PROFILES" at the bottom. Sci-fi, cutting-edge esports aesthetic.`,
    },
    {
        id: 12,
        title: "Warzone Command Center",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. A dramatic, futuristic war-room scene. Three BGMI characters (or player photos) stand in a dark command center surrounded by floating holographic screens showing the Erangel map, kill feeds, and team rankings. The room is lit by the glow of the holograms — deep blue and orange. The BT logo is projected as a massive hologram in the center ceiling. Text: "[TOURNAMENT NAME] — [SEASON X]" in glowing holographic text. "[EVENT]" in sharp, military-stencil font below. Cinematic sci-fi military aesthetic, tier-1 production.`,
    },
    {
        id: 13,
        title: "Action Replay Live",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. A high-octane but clean "Play of the Day" graphic. Foreground features a hyper-detailed 3D render of a BGMI character in mid-vault or aiming down sights, rendered with motion blur on the edges to simulate intense speed. Background is a stylized, desaturated Erangel environment with bright neon bullet tracers cutting through the air. The BT logo is integrated as a sleek broadcast watermark. Text: "[TOURNAMENT NAME] — [SEASON X]" in bold italics. "LIVE NOW" in bright yellow/gold.`,
    },
    {
        id: 14,
        title: "Tactical HUD",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. A sniper or tactical focus graphic mimicking a high-end broadcast telestrator. Characters (or player photos) are framed within sleek, minimalist targeting brackets. Background features a dark, heavily gridded map layout with glowing red and cyan strategic markers. The BT logo is a sharp digital badge. Text: "[TOURNAMENT NAME] — [SEASON X]" in clean tech typography. "TACTICAL MASTERY" at the bottom. Sleek, strategic, intelligence-focused.`,
    },
    {
        id: 15,
        title: "Rotations & Strategy",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. Aerial view of a 3D-rendered BGMI map (like Miramar or Erangel) treated with a dark, premium matte finish. Bright, glowing neon lines show team rotation paths intersecting. Player portraits are pinned to these intersections using sleek, metallic UI markers. The BT logo is embedded in the topography. Text: "[TOURNAMENT NAME] — [SEASON X]" in bold white sans-serif. "MASTERING THE ROTATION" in an accent color. High IQ esports live aesthetic.`,
    },
    {
        id: 16,
        title: "Volumetric Execution",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. A cinematic combat scene. Characters (or players) are visible pushing through dense, realistic volumetric smoke illuminated by harsh stadium lights from above (cyan and magenta). The render quality is photorealistic, with intricate details on the weapons (M416, Groza). The BT logo shines metallic through the smoke. Text: "[TOURNAMENT NAME] — [SEASON X]" in sharp white. "FLAWLESS EXECUTION" in bold text. Intense, tier-1 production value.`,
    },
    {
        id: 17,
        title: "Premium Loot Secure",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. High-fidelity 3D focus on a BGMI airdrop crate, but stylized like a premium esports asset—carbon fiber textures, glowing neon red lights, sitting on an illuminated stage platform. Characters (or players) stand guard around it in high-fashion/tactical esports apparel. The BT logo is elegantly embossed onto the crate's side. Text: "[TOURNAMENT NAME] — [SEASON X]" in gold foil lettering. "SECURING THE ADVANTAGE" below. Clean, high-stakes aesthetic.`,
    },
    {
        id: 18,
        title: "High-Speed Rotation",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. A polished, dynamic shot of a squad rotating in a vehicle (UAZ/Dacia). The vehicle is a highly detailed 3D render with glossy reflections, kicking up realistic dust particles. The background is a deliberate speed-blur to emphasize motion, maintaining a dark, moody esports color grade. The BT logo acts as a sleek watermark. Text: "[TOURNAMENT NAME] — [SEASON X]" in fast, italicized modern font. "FULL THROTTLE" in bold. Professional action photography style.`,
    },
    {
        id: 19,
        title: "The Calm Before",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. Moody, atmospheric esports documentary style. High-contrast black and white aesthetic with only one accent color (e.g., BT's brand color). Silhouettes of players (or characters) standing in a tunnel looking out toward a brilliantly lit arena stage. Rain or subtle fog adds texture. The BT logo glows softly in the distance. Text: "[TOURNAMENT NAME] — [SEASON X]" in thin, elegant tracking. "THE ROAD TO GLORY" in bold below. Cinematic, emotional, prestige tier.`,
    },
    {
        id: 20,
        title: "Players to Watch",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. A modern "Bounty / Players to Watch" graphic. Three player photos (or character renders) heavily stylized with a dark, grimy cyberpunk or high-tech tactical filter. They are framed in glowing neon targeting rectangles with simulated "threat level" data and stats next to their faces. The BT logo is a sleek tactical insignia. Text: "[TOURNAMENT NAME] — [SEASON X]" in a precise, monospaced tech font. "HIGH VALUE TARGETS" in alert-red.`,
    },
    {
        id: 21,
        title: "Clutch Moment",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. High-intensity esports graphic. A single player or character captured in a dynamic pose (e.g., mid-jump or peeking), rendered with sharp clarity. Surrounding them are subtle, high-tech motion trails and geometric light leaks indicating a split-second clutch play. Background is dark and sleek. The BT logo in the top right. Text: "[TOURNAMENT NAME] — [SEASON X]" in dynamic, slanted typography. "THE 1v4 CLUTCH" in glowing accent colors.`,
    },
    {
        id: 22,
        title: "Fragmented Focus",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. A sophisticated broadcast overlay design. The screen is divided by sharp, diagonal "glass" shards. Inside each frosted glass shard is a different angle or different player from the top squad, rendered with premium studio lighting. The background is a dark, abstract mesh gradient. The BT logo sits prominently on a sleek central plate. Text: "[TOURNAMENT NAME] — [SEASON X]" in elegant, uppercase sans-serif. "SHATTERING RECORDS". High-end graphic design.`,
    },
    {
        id: 23,
        title: "The Stage is Set",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. PMGC documentary poster style. Cinematic 21:9 aspect ratio bars at the top and bottom. Center frame shows a wide, epic shot of the BT tournament stage or an awe-inspiring 3D render of Erangel's ruins lit by gorgeous golden hour lighting, with a lone player looking out. The BT logo is presented like a film studio production mark. Text: "[TOURNAMENT NAME] — [SEASON X]" in minimalist, widely spaced font. "[EVENT]" in smaller, crisp text. Highly emotional and cinematic.`,
    },
    {
        id: 24,
        title: "Defending Champions",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. An imposing, authoritative graphic. The defending champion (player or character) stands at the top of a sleek, dark metallic staircase or podium, looking down at the camera. Harsh, dramatic overhead lighting creates deep shadows. The BT logo is engraved into the steel of the stairs. Text: "[TOURNAMENT NAME] — [SEASON X]" in bold, dominating typography. "DEFEND THE TITLE" at the bottom. Intimidating, boss-fight aesthetic.`,
    },
    {
        id: 25,
        title: "Road to Finals Bracket",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. A sleek, glowing tournament bracket UI. The background is a dark, matte texture with subtle hex grids. The bracket lines are illuminated by glowing neon (cyan or gold). Three key player portraits (or characters) hover above the final nodes of the bracket in clean, circular frames. The BT logo is a glowing centerpiece at the top of the bracket. Text: "[TOURNAMENT NAME] — [SEASON X]" in crisp white. "[EVENT]" in neon text. Broadcast-ready informational graphic.`,
    },
    {
        id: 26,
        title: "Advanced Analytics",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. A premium data-visualization graphic. Three players (or characters) displayed alongside complex but clean 3D radar charts, damage output graphs, and survival time metrics. The UI mimics a high-tech command center with frosted glass panels and sleek typography. Background is deep navy blue. The BT logo is a sharp vector badge. Text: "[TOURNAMENT NAME] — [SEASON X]" in a modern tech font. "ANALYTICS & METRICS" below. Ideal for live tournament streams.`,
    },
    {
        id: 27,
        title: "Head-to-Head Comparison",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. A split-screen analytical graphic. Two rival players (or characters) face forward on the left and right, separated by a central column of comparative stats (K/D, Damage, Headshot %). The design uses a clean, dark-mode aesthetic with bright, legible data points and subtle team color glows. The BT logo is perfectly centered at the top. Text: "[TOURNAMENT NAME] — [SEASON X]" in bold black/white. "TALE OF THE TAPE" in a secondary accent color. Clean, engaging, professional.`,
    },
    {
        id: 28,
        title: "Team Eliminated",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. A somber but highly professional elimination graphic. The background is a heavily desaturated, black-and-white image of a player/character looking down or a dropped helmet. Across the center is a striking, sleek red banner with the team logo and the word "ELIMINATED" in bold, spaced-out typography. The BT logo is a subtle watermark in the corner. Text: "[TOURNAMENT NAME] — [SEASON X]" at the top. High emotional impact, standard esports broadcast style.`,
    },
    {
        id: 29,
        title: "Season Opener",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament. Massive scale season launch graphic. A sweeping wide shot of a massive, hyper-realistic esports stadium packed with fans. Hovering above the center stage is a colossal 3D hologram of the BT logo and the text "[SEASON X]". Fireworks and laser lights pierce the arena. Foreground features clean silhouettes of players walking onto the stage. Text: "[TOURNAMENT NAME]" in thick, premium metallic font. "A NEW ERA BEGINS" in bright white. Epic PMGC opening ceremony vibe.`,
    },
    {
        id: 30,
        title: "Major Milestone Event",
        text: `YouTube thumbnail (1280×720) for Bimon Tournament live stream. A luxurious, premium milestone celebration graphic. The color palette is strictly deep black, polished gold, and crisp white. High-end 3D renders of the BT Championship trophy and iconic BGMI elements (Level 3 Helmet, Airdrop) rendered in pure gold or obsidian. Elegant, subtle light flares. The BT logo is framed in a special anniversary crest. Text: \"[TOURNAMENT NAME] — [SEASON X]\" in elegant serif or highly stylized modern font. \"[EVENT]\" below. Expensive, exclusive, VIP aesthetic.`,
    },
];

/* ─────────────── youtube title templates ─────────────── */

function generateTitle(tournament?: string, season?: string, event?: string): string {
    const parts = [`🔴 LIVE`, `Bimon Tournament`];
    if (tournament) parts.push(tournament);
    if (event) parts.push(event);
    if (season) parts.push(season);
    return parts.join(" | ");
}

function generateDescription(tournament?: string, season?: string, event?: string, customNotes?: string, prizeText?: string): string {
    const tn = tournament ? `Bimon Tournament — ${tournament}` : "Bimon Tournament";
    const s = season || "";
    const e = event || "";
    const eventLine = e ? `\n🎮 Event: ${e}` : "";
    const seasonLine = s ? `\n📅 Season: ${s}` : "";
    const notesBlock = customNotes?.trim() ? `\n\n🎵 Music Credits:\n${customNotes.trim()}` : "";
    const prizeBlock = prizeText?.trim() ? `\n\n${prizeText.trim()}` : "";

    return `🔴 LIVE — ${tn}${e ? " | " + e : ""}${s ? " | " + s : ""}

Welcome to the official Bimon Tournament live stream! Watch top BGMI squads battle it out in real time.${tournament ? `\n🏆 Tournament: ${tournament}` : ""}${eventLine}${seasonLine}

🔥 What to expect:
• Live competitive BGMI matches
• Real-time kills, clutches & squad wipes
• Live commentary & analysis
• Final standings & results

💬 Drop your predictions in chat!
🔔 Subscribe & hit the bell for future streams

📲 Join Bimon Tournament 👇

https://bgmi.pixel-thread.in/vote
${prizeBlock}${notesBlock}

#BGMI #BimonTournament #BGMILive #MobileGaming #Esports #PUBGMobile #LiveStream${s ? " #" + s.replace(/\s+/g, "") : ""}${e ? " #" + e.replace(/\s+/g, "") : ""}`;
}

/**
 * Pro-level suffix appended to every prompt.
 * Handles body/hand pose adjustments and unified lighting across all 3 players.
 */
const PRO_SUFFIX = ` IMPORTANT — Pro Thumbnail Polish: For all characters and player images, adjust their body and hand poses to look like professional esports athletes — confident stances, arms crossed, fist clenches, pointing gestures, or victory poses. Avoid awkward or limp hand positions. Give each figure a powerful, intentional pose that conveys dominance and skill. CRITICAL — Unified Lighting & Color Grading: All character/player images MUST have matching, consistent lighting direction, color temperature, and shadow intensity. Apply a single unified color grade across all figures so they look like they belong in the same scene — match the warm/cool tones, contrast levels, and rim lighting to the background environment. No figure should look pasted in with mismatched lighting. The final result should look like a single professionally composited image, not separate photos combined. MANDATORY — LIVE Badge: Always place a bold red "🔴 LIVE" badge/label in the bottom-right corner of the thumbnail. Use a solid red (#FF0000) rounded rectangle with white bold uppercase "LIVE" text inside it, similar to YouTube's live indicator. It must be clearly visible and not overlap important content.`;

/** Returns the full prompt text with the pro suffix and placeholders replaced */
function getFullPrompt(prompt: Prompt, tournamentName?: string, seasonName?: string, eventLabel?: string): string {
    let text = prompt.text;
    if (tournamentName) {
        text = text.replace(/\[TOURNAMENT NAME\]/g, tournamentName);
    }
    if (seasonName) {
        text = text.replace(/\[SEASON X\]/g, seasonName);
        text = text.replace(/\[SEASON \[X\]\]/g, seasonName);
    }
    if (eventLabel?.trim()) {
        if (text.includes("[EVENT]")) {
            text = text.replace(/\[EVENT\]/g, eventLabel.trim());
        } else {
            text += ` Also include the event label "${eventLabel.trim()}" prominently on the thumbnail.`;
        }
    }
    return text + PRO_SUFFIX;
}

/* ─────────────── hooks ─────────────── */

function useCurrentSeason() {
    return useQuery<{ id: string; name: string } | null>({
        queryKey: ["current-season"],
        queryFn: async () => {
            const res = await fetch("/api/seasons");
            if (!res.ok) return null;
            const json = await res.json();
            const active = (json.data ?? []).find((s: any) => s.isCurrent);
            return active ? { id: active.id, name: active.name } : null;
        },
        staleTime: 60_000,
    });
}

function useTournaments(seasonId: string | undefined) {
    return useQuery<TournamentOption[]>({
        queryKey: ["thumbnail-tournaments", seasonId],
        queryFn: async () => {
            const params = new URLSearchParams({ limit: "50" });
            if (seasonId) params.set("seasonId", seasonId);
            const res = await fetch(`/api/tournaments?${params}`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data ?? []).map((t: any) => ({
                id: t.id,
                name: t.name,
                seasonName: t.season?.name ?? null,
            }));
        },
        enabled: !!seasonId,
        staleTime: 60_000,
    });
}


/* ─────────────── page component ─────────────── */

export default function ThumbnailPromptsPage() {
    // Season (auto-fetched)
    const { data: currentSeason } = useCurrentSeason();

    // Tournament selector — only current season
    const [selectedTournament, setSelectedTournament] = useState<TournamentOption | null>(null);
    const [showTournamentDropdown, setShowTournamentDropdown] = useState(false);
    const { data: tournaments, isLoading: tournamentsLoading } = useTournaments(currentSeason?.id);

    // Prompt state
    const [promptSearch, setPromptSearch] = useState("");
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Event label (e.g. Grand Final, Day 1 Group A)
    const [eventLabel, setEventLabel] = useState("");

    // Custom notes (e.g. music credits)
    const [customNotes, setCustomNotes] = useState("");

    // Pinned prompts per tournament (localStorage)
    const PINNED_KEY = "bt-pinned-prompts";
    const [pinnedPrompts, setPinnedPrompts] = useState<Record<string, number>>(() => {
        if (typeof window === "undefined") return {};
        try { return JSON.parse(localStorage.getItem(PINNED_KEY) || "{}"); } catch { return {}; }
    });

    const pinPrompt = (tournamentId: string, promptId: number) => {
        const next = { ...pinnedPrompts, [tournamentId]: promptId };
        setPinnedPrompts(next);
        localStorage.setItem(PINNED_KEY, JSON.stringify(next));
        const prompt = PROMPTS.find((p) => p.id === promptId);
        if (prompt) setRandomPrompt(prompt);
        toast.success(`📌 Pinned "${prompt?.title}" for this tournament`);
    };

    const unpinPrompt = (tournamentId: string) => {
        const next = { ...pinnedPrompts };
        delete next[tournamentId];
        setPinnedPrompts(next);
        localStorage.setItem(PINNED_KEY, JSON.stringify(next));
        toast.success("Unpinned prompt");
    };

    const pinnedId = selectedTournament?.id ? pinnedPrompts[selectedTournament.id] ?? null : null;

    // Prize distribution text
    const [prizeText, setPrizeText] = useState("");
    const [fetchingPrize, setFetchingPrize] = useState(false);

    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const fetchPrizeData = async () => {
        if (!selectedTournament) { toast.error("Select a tournament first"); return; }
        setFetchingPrize(true);
        try {
            // Fetch tournaments list, settings, polls, donations in parallel
            const [tournsRes, settingsRes, pollsRes, donationsRes] = await Promise.all([
                fetch(`/api/tournaments?limit=50${currentSeason?.id ? `&seasonId=${currentSeason.id}` : ""}`),
                fetch("/api/settings/public"),
                fetch("/api/polls?all=true"),
                fetch(`/api/tournaments/${selectedTournament.id}/donations`),
            ]);

            const tournsJson = await tournsRes.json();
            const tourn = (tournsJson.data ?? []).find((t: any) => t.id === selectedTournament.id);
            if (!tourn) { toast.error("Tournament not found"); setFetchingPrize(false); return; }

            const entryFee = tourn.fee ?? 0;
            const teamCount = tourn.teamCount ?? tourn._count?.teams ?? 0;
            const isSquad = tourn.poll?.allowSquads ?? false;

            let donations = 0;
            if (donationsRes.ok) {
                try { const d = await donationsRes.json(); donations = d.data?.total ?? 0; } catch {}
            }

            let orgCut = 0;
            let orgCutMode: "fixed" | "percent" = "fixed";
            let poolFee = entryFee;
            let usedPollOrgCut = false;

            if (pollsRes.ok) {
                try {
                    const pollsJson = await pollsRes.json();
                    const polls = pollsJson.data?.polls ?? [];
                    const poll = polls.find((p: any) => p.tournament?.id === selectedTournament.id);
                    if (poll?.orgCutFixed != null) { orgCut = poll.orgCutFixed; orgCutMode = "fixed"; usedPollOrgCut = true; }
                    if (poll?.prizePoolFee != null) { poolFee = poll.prizePoolFee; }
                } catch {}
            }

            if (!usedPollOrgCut && settingsRes.ok) {
                const sJson = await settingsRes.json();
                const settings = sJson.data ?? {};
                orgCutMode = isSquad ? (settings.rankedOrgCutMode ?? settings.orgCutMode ?? "fixed") : (settings.orgCutMode ?? "fixed");
                orgCut = orgCutMode === "percent"
                    ? (isSquad ? (settings.rankedOrgCutPercent ?? 0) : (settings.orgCutPercent ?? 0))
                    : (isSquad ? (settings.rankedOrgCutFixed ?? 0) : (settings.orgCutFixed ?? 0));
            }

            const prizePool = (poolFee * teamCount) + donations;
            if (prizePool <= 0) { toast.error("No prize pool"); setFetchingPrize(false); return; }

            const teamSize = isSquad ? 1 : getTeamSize("DUO");
            const dist = getPrizeDistribution(prizePool, entryFee, teamSize, orgCut, orgCutMode);

            const medals = ["🥇", "🥈", "🥉"];
            const lines: string[] = [
                `🎟️ Entry Fee: ₹${entryFee.toLocaleString()}`,
                `💰 Prize Pool: ₹${dist.totalWinnerPayout.toLocaleString()}`,
            ];
            const sortedPrizes = Array.from(dist.prizes.entries()).sort((a, b) => a[0] - b[0]);
            for (const [pos, prize] of sortedPrizes) {
                const medal = pos <= 3 ? medals[pos - 1] : "🏅";
                lines.push(`${medal} ${getOrdinal(pos)}: ₹${prize.amount.toLocaleString()}`);
            }

            setPrizeText(lines.join("\n"));
            toast.success("Prize data loaded!");
        } catch {
            toast.error("Failed to fetch prize data");
        } finally {
            setFetchingPrize(false);
        }
    };

    // Randomize order for single-prompt view — persist last shown
    const LAST_PROMPT_KEY = "bt-last-prompt";
    const [randomPrompt, setRandomPrompt] = useState<Prompt | null>(() => {
        if (typeof window === "undefined") return null;
        try {
            const saved = localStorage.getItem(LAST_PROMPT_KEY);
            if (saved) {
                const id = Number(saved);
                return PROMPTS.find((p) => p.id === id) ?? null;
            }
        } catch {}
        return null;
    });

    // Derive the effective season name
    const seasonName = selectedTournament?.seasonName ?? currentSeason?.name ?? undefined;
    const tournamentName = selectedTournament?.name ?? undefined;


    // Prompt filtering
    const filtered = useMemo(() => {
        if (!promptSearch.trim()) return PROMPTS;
        const q = promptSearch.toLowerCase();
        return PROMPTS.filter(
            (p) =>
                p.title.toLowerCase().includes(q) ||
                p.text.toLowerCase().includes(q)
        );
    }, [promptSearch]);

    const handleCopy = async (prompt: Prompt) => {
        try {
            await navigator.clipboard.writeText(
                getFullPrompt(prompt, tournamentName, seasonName, eventLabel)
            );
            setCopiedId(prompt.id);
            toast.success(`Copied — ${prompt.title}`);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            toast.error("Failed to copy");
        }
    };

    const getRandomPrompt = () => {
        const idx = Math.floor(Math.random() * PROMPTS.length);
        const prompt = PROMPTS[idx];
        setRandomPrompt(prompt);
        localStorage.setItem(LAST_PROMPT_KEY, String(prompt.id));
    };

    // Set initial random prompt only if nothing was restored
    useEffect(() => {
        if (!randomPrompt) getRandomPrompt();
    }, []);

    // When tournament changes, restore pinned prompt
    useEffect(() => {
        if (!selectedTournament?.id) return;
        const pinned = pinnedPrompts[selectedTournament.id];
        if (pinned) {
            const prompt = PROMPTS.find((p) => p.id === pinned);
            if (prompt) {
                setRandomPrompt(prompt);
                localStorage.setItem(LAST_PROMPT_KEY, String(prompt.id));
            }
        }
    }, [selectedTournament?.id]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Clapperboard className="h-6 w-6 text-primary" />
                    Thumbnail Prompts
                </h1>
                <p className="text-sm text-foreground/50 mt-1">
                    Pick a tournament, grab the logo, and copy a prompt for AI thumbnail generation.
                </p>
                {currentSeason && (
                    <p className="text-xs text-primary/70 mt-1">
                        Current Season: <span className="font-semibold">{currentSeason.name}</span>
                    </p>
                )}
            </div>

            {/* ━━━ Tournament Selector ━━━ */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        Tournament
                        {currentSeason && (
                            <span className="text-[11px] font-normal text-primary/70 normal-case tracking-normal ml-1">
                                — {currentSeason.name}
                            </span>
                        )}
                    </h2>
                </div>

                {/* Selected tournament display + dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowTournamentDropdown(!showTournamentDropdown)}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                            selectedTournament
                                ? "border-primary/30 bg-primary/5"
                                : "border-divider bg-foreground/[0.03]"
                        }`}
                    >
                        <div className="min-w-0 flex-1">
                            {selectedTournament ? (
                                <>
                                    <p className="text-sm font-semibold truncate">{selectedTournament.name}</p>
                                    {selectedTournament.seasonName && (
                                        <p className="text-[11px] text-foreground/50">{selectedTournament.seasonName}</p>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-foreground/40">
                                    {tournamentsLoading ? "Loading tournaments..." : "Select a tournament"}
                                </p>
                            )}
                        </div>
                        <ChevronDown className={`h-4 w-4 text-foreground/40 shrink-0 transition-transform ${showTournamentDropdown ? "rotate-180" : ""}`} />
                    </button>

                    {showTournamentDropdown && (
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-divider bg-content1 shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                            {tournamentsLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Spinner size="sm" />
                                </div>
                            ) : !tournaments?.length ? (
                                <p className="text-xs text-foreground/40 text-center py-6">
                                    No tournaments in this season
                                </p>
                            ) : (
                                tournaments.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            setSelectedTournament(t);
                                            setShowTournamentDropdown(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                            selectedTournament?.id === t.id
                                                ? "bg-primary/10 text-primary"
                                                : "hover:bg-foreground/[0.04]"
                                        }`}
                                    >
                                        <Trophy className="h-4 w-4 text-primary/60 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{t.name}</p>
                                            {t.seasonName && (
                                                <p className="text-[11px] text-foreground/40">{t.seasonName}</p>
                                            )}
                                        </div>
                                        {selectedTournament?.id === t.id && (
                                            <Check className="h-4 w-4 text-primary shrink-0" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ━━━ Event Label (optional) ━━━ */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-2">
                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                    🏷️ Event Label <span className="text-[11px] font-normal normal-case tracking-normal text-foreground/40">— optional</span>
                </h2>
                <Input
                    size="sm"
                    placeholder="e.g. Grand Final, Day 1 Group A, Day 3..."
                    value={eventLabel}
                    onValueChange={setEventLabel}
                    isClearable
                    onClear={() => setEventLabel("")}
                    classNames={{ inputWrapper: "bg-foreground/[0.04]" }}
                />
                {!eventLabel.trim() && (
                    <p className="text-[11px] text-foreground/30">Prompts with [EVENT] will keep the placeholder if left empty</p>
                )}
            </div>

            {/* ━━━ Prize Pool ━━━ */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                        💰 Prize Pool
                    </h2>
                    <button
                        onClick={fetchPrizeData}
                        disabled={fetchingPrize || !selectedTournament}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/50 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {fetchingPrize ? <Spinner size="sm" /> : <Trophy className="h-3 w-3" />}
                        {prizeText ? "Refresh" : "Fetch Prize Pool"}
                    </button>
                </div>
                {prizeText ? (
                    <div className="space-y-1.5">
                        <pre className="text-xs text-foreground/50 leading-relaxed whitespace-pre-wrap bg-foreground/[0.03] rounded-lg px-3 py-2 font-sans">
                            {prizeText}
                        </pre>
                        <button
                            onClick={() => setPrizeText("")}
                            className="text-[11px] text-foreground/30 hover:text-danger transition-colors"
                        >
                            Clear prize data
                        </button>
                    </div>
                ) : (
                    <p className="text-[11px] text-foreground/30">Fetches prize positions from the selected tournament and includes them in title description and prompts</p>
                )}
            </div>

            {/* ━━━ YouTube Title & Description Generator ━━━ */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    YouTube Title & Description
                </h2>

                {/* Title */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground/50">Title</p>
                        <button
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(generateTitle(tournamentName, seasonName, eventLabel?.trim() || undefined));
                                    toast.success("Title copied!");
                                } catch {
                                    toast.error("Failed to copy");
                                }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/50 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                            <Copy className="h-3 w-3" />
                            Copy Title
                        </button>
                    </div>
                    <div className="px-4 py-3 rounded-xl bg-foreground/[0.03] border border-divider">
                        <p className="text-sm font-medium">{generateTitle(tournamentName, seasonName, eventLabel?.trim() || undefined)}</p>
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground/50 flex items-center gap-1.5">
                            <FileText className="h-3 w-3" />
                            Description
                        </p>
                        <button
                            onClick={async () => {
                                try {
                                    const desc = generateDescription(tournamentName, seasonName, eventLabel?.trim() || undefined, customNotes, prizeText);
                                    await navigator.clipboard.writeText(desc);
                                    toast.success("Description copied!");
                                } catch {
                                    toast.error("Failed to copy");
                                }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/50 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                            <Copy className="h-3 w-3" />
                            Copy Description
                        </button>
                    </div>
                    <pre className="text-[11px] text-foreground/40 leading-relaxed whitespace-pre-wrap bg-foreground/[0.02] rounded-xl p-4 border border-divider font-sans">
                        {generateDescription(tournamentName, seasonName, eventLabel?.trim() || undefined, customNotes, prizeText)}
                    </pre>

                    {/* Custom notes / music credits */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] text-foreground/40">🎵 Custom notes (music credits, links, etc.)</p>
                            <button
                                onClick={async () => {
                                    try {
                                        const text = await navigator.clipboard.readText();
                                        setCustomNotes((prev) => prev ? prev + "\n" + text : text);
                                        toast.success("Pasted from clipboard!");
                                    } catch {
                                        toast.error("Failed to read clipboard");
                                    }
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-foreground/5 text-foreground/40 text-[11px] hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                                📋 Paste
                            </button>
                        </div>
                        <textarea
                            value={customNotes}
                            onChange={(e) => setCustomNotes(e.target.value)}
                            placeholder="Paste music credits, sponsor links, etc..."                            rows={3}
                            className="w-full text-xs bg-foreground/[0.03] border border-divider rounded-lg px-3 py-2 placeholder:text-foreground/20 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                        />
                    </div>
                </div>
            </div>

            {randomPrompt && (
                <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                            {pinnedId === randomPrompt.id ? "📌 Pinned Prompt" : "🎲 Random Prompt"}
                        </h2>
                        <div className="flex items-center gap-1.5">
                            {/* Pin/Unpin button */}
                            {selectedTournament && (
                                <button
                                    onClick={() => {
                                        if (pinnedId === randomPrompt.id) {
                                            unpinPrompt(selectedTournament.id);
                                        } else {
                                            pinPrompt(selectedTournament.id, randomPrompt.id);
                                        }
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        pinnedId === randomPrompt.id
                                            ? "bg-warning/20 text-warning hover:bg-warning/30"
                                            : "bg-foreground/5 text-foreground/50 hover:bg-warning/10 hover:text-warning"
                                    }`}
                                >
                                    <Pin className={`h-3 w-3 ${pinnedId === randomPrompt.id ? "fill-warning" : ""}`} />
                                    {pinnedId === randomPrompt.id ? "Unpin" : "Pin"}
                                </button>
                            )}
                            <button
                                onClick={getRandomPrompt}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/50 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                                <RefreshCw className="h-3 w-3" />
                                Shuffle
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-semibold">{randomPrompt.title}</p>
                        <p className="text-xs text-foreground/50 leading-relaxed">
                            {getFullPrompt(randomPrompt, tournamentName, seasonName, eventLabel)}
                        </p>
                    </div>
                    <button
                        onClick={() => handleCopy(randomPrompt)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            copiedId === randomPrompt.id
                                ? "bg-success/15 text-success"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                    >
                        {copiedId === randomPrompt.id ? (
                            <>
                                <Check className="h-4 w-4" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="h-4 w-4" />
                                Copy Prompt
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* ━━━ All Prompts ━━━ */}
            <div className="space-y-3">
                <Input
                    size="sm"
                    placeholder="Search prompts..."
                    startContent={<Search className="h-4 w-4 text-foreground/40" />}
                    value={promptSearch}
                    onValueChange={setPromptSearch}
                    isClearable
                    onClear={() => setPromptSearch("")}
                    classNames={{ inputWrapper: "bg-foreground/[0.04]" }}
                />
            </div>

            {/* Results count */}
            {promptSearch && (
                <p className="text-xs text-foreground/40">
                    Showing {filtered.length} of {PROMPTS.length} prompts
                </p>
            )}

            {/* Prompt cards */}
            <div className="space-y-2">
                {filtered.map((prompt) => (
                    <div
                        key={prompt.id}
                        className={`group rounded-2xl border overflow-hidden transition-colors ${
                            pinnedId === prompt.id
                                ? "border-warning/40 bg-warning/[0.04] hover:bg-warning/[0.07]"
                                : "border-divider bg-foreground/[0.02] hover:bg-foreground/[0.05]"
                        }`}
                    >
                        {/* Card header + copy button */}
                        <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                    {prompt.id}
                                </span>
                                <span className="font-medium text-sm truncate">
                                    {prompt.title}
                                </span>
                            </div>
                            <button
                                onClick={() => handleCopy(prompt)}
                                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                                    copiedId === prompt.id
                                        ? "bg-success/20 text-success"
                                        : "bg-foreground/5 text-foreground/40 hover:bg-primary/10 hover:text-primary"
                                }`}
                            >
                                {copiedId === prompt.id ? (
                                    <>
                                        <Check className="h-3.5 w-3.5" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3.5 w-3.5" />
                                        Copy
                                    </>
                                )}
                            </button>
                            {/* Pin button */}
                            {selectedTournament && (
                                <button
                                    onClick={() => {
                                        if (pinnedId === prompt.id) {
                                            unpinPrompt(selectedTournament.id);
                                        } else {
                                            pinPrompt(selectedTournament.id, prompt.id);
                                        }
                                    }}
                                    className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium transition-all ${
                                        pinnedId === prompt.id
                                            ? "bg-warning/20 text-warning"
                                            : "bg-foreground/5 text-foreground/30 hover:bg-warning/10 hover:text-warning"
                                    }`}
                                    title={pinnedId === prompt.id ? "Unpin from this tournament" : "Pin for this tournament"}
                                >
                                    <Pin className={`h-3 w-3 ${pinnedId === prompt.id ? "fill-warning" : ""}`} />
                                </button>
                            )}
                        </div>

                        {/* Prompt text — click to copy */}
                        <div
                            onClick={() => handleCopy(prompt)}
                            className="px-4 pb-4 cursor-pointer"
                        >
                            <p className="text-xs text-foreground/50 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                                {getFullPrompt(prompt, tournamentName, seasonName, eventLabel)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <Clapperboard className="h-10 w-10 text-foreground/15" />
                    <p className="text-sm text-foreground/40">
                        No prompts match your search.
                    </p>
                </div>
            )}

            {/* Tips footer */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                    💡 Tips
                </h2>
                <ul className="text-xs text-foreground/50 space-y-1.5 list-disc list-inside">
                    <li>Upload the BIMON logo as a reference image in your AI tool</li>
                    <li>Optionally upload legendary PUBG character images for the AI to use</li>
                    <li>Use 16:9 aspect ratio (1280×720) in your generator settings</li>
                    <li>AI struggles with text — add text overlay in Canva or Photoshop after</li>
                    <li>Generate 3–4 variations per prompt and pick the best one</li>
                    <li>Hit <strong>Shuffle</strong> on the random prompt to quickly try different styles</li>
                </ul>
            </div>
        </div>
    );
}
