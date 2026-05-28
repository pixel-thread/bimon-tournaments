"use client";

import { useState, useMemo, useCallback } from "react";
import { Input, Chip, Avatar, Spinner } from "@heroui/react";
import {
    Clapperboard,
    Copy,
    Check,
    Search,
    ChevronDown,
    ChevronUp,
    X,
    Download,
    Users,
    ImageIcon,
    Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

/* ─────────────── types ─────────────── */

interface PlayerResult {
    id: string;
    displayName: string;
    username: string;
    imageUrl: string;
    category: string;
    clan: { name: string; tag: string } | null;
}

interface SelectedPlayer {
    id: string;
    name: string;
    imageUrl: string;
}

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
    category: string;
}

const CATEGORIES = [
    { key: "hype", label: "🔥 Hype & Battle", color: "danger" as const },
    { key: "champion", label: "🏆 Champion & Leaderboard", color: "warning" as const },
    { key: "action", label: "🎯 Action & Gameplay", color: "success" as const },
    { key: "cinematic", label: "🌟 Dramatic & Cinematic", color: "secondary" as const },
    { key: "stats", label: "📊 Stats & Elimination", color: "primary" as const },
    { key: "seasonal", label: "🎪 Seasonal & Special", color: "default" as const },
];

const PROMPTS: Prompt[] = [
    // ── Hype & Battle (1–6) ──
    {
        id: 1,
        category: "hype",
        title: "Fiery Battlefield Heroes",
        text: `Create a YouTube thumbnail (1280×720) for a BGMI tournament. Show three players as large heroic figures standing side by side in a triangular composition, facing forward with intense expressions. The background features PUBG Mobile characters in full combat gear firing assault rifles amid a fiery orange-red battlefield explosion with smoke, sparks, and military crates. Place the BIMON logo prominently in the top-left corner. Bold white and yellow text reads "[TOURNAMENT NAME]" at the top and "SEASON [X] — WHO WILL DOMINATE?" at the bottom. Gaming esports style, 4K quality, dramatic lighting.`,
    },
    {
        id: 2,
        category: "hype",
        title: "VS Triangle Showdown",
        text: `Design a YouTube thumbnail (1280×720) for a BGMI esports tournament. Three player profile images arranged in a "VS triangle" — two on the left and right glaring at each other, one in the center slightly larger and elevated. Electric blue and neon orange lightning bolts crackle between them. Background filled with BGMI characters in Level 3 helmets and vests crouching behind cover, AKM and M416 rifles drawn, with Erangel buildings crumbling behind them. The BIMON logo as a glowing hologram in the top center. Text: "[TOURNAMENT NAME] | [SEASON X]" in bold metallic chrome font. "THE ULTIMATE SHOWDOWN" in red at the bottom. Cinematic, dramatic, 4K.`,
    },
    {
        id: 3,
        category: "hype",
        title: "Airdrop Emergence",
        text: `YouTube thumbnail (1280×720) for a mobile gaming tournament. Three players shown as battle-ready warriors emerging from a BGMI airdrop crate, dramatic low-angle shot. Background shows PUBG Mobile characters parachuting down from a plane over Erangel with neon green and electric purple gradient sky and particle effects. The BIMON logo stamped as a golden badge in the top-right. Large bold text: "[TOURNAMENT NAME]" in white with yellow glow, "[SEASON X] BEGINS!" in red fire font at the bottom. Each player's name displayed below their image. Ultra-sharp, competitive gaming aesthetic.`,
    },
    {
        id: 4,
        category: "hype",
        title: "Playing Card Legends",
        text: `Create a high-energy YouTube thumbnail (1280×720). Three player photos arranged like playing cards fanned out, each with a glowing colored border (gold, red, blue). Behind them, BGMI characters engaged in an intense firefight on a battleground — a military helicopter flying overhead, explosions erupting, AWM sniper shots tracing through a blood-red sky, scattered ammo and weapon crates everywhere. The BIMON logo sits large in the center-top as a metallic emblem. Bold impact text: "3 LEGENDS. 1 CROWN." and "[TOURNAMENT NAME] — [SEASON X]" at the bottom in white with black outline. Hyper-detailed, tournament poster style.`,
    },
    {
        id: 5,
        category: "hype",
        title: "Shattered Triple Panel",
        text: `YouTube thumbnail (1280×720) — Split the frame into 3 vertical panels with each player occupying one panel, each with a different dramatic color wash (red, blue, gold). Behind each panel, a different PUBG Mobile character in an iconic pose — one sniping with an AWM, one charging with a pan, one throwing a grenade — creating action silhouettes. The panels crack and shatter where they meet, with light bursting through. The BIMON logo is centered over the cracks like a seal holding them together. Text overlay: "[TOURNAMENT NAME]" in large 3D extruded letters at the top. "[SEASON X] — THE BATTLE IS ON" in bold white at the bottom. Professional esports broadcast quality.`,
    },
    {
        id: 6,
        category: "hype",
        title: "Red Zone Fight Night",
        text: `Design a YouTube thumbnail (1280×720) showing three players in a dramatic "back-to-back" pose arrangement. Background is a war-torn BGMI Erangel map with PUBG Mobile characters in ghillie suits and combat gear running through smoke, fire, and a red zone circle closing in — bullets flying, UAZ vehicles exploding. The BIMON logo as a large watermark behind the players. Text: "[TOURNAMENT NAME]" in aggressive angular font, "[SEASON X] — FIGHT NIGHT" in neon red at bottom. Dark, gritty, cinematic tone.`,
    },

    // ── Champion & Leaderboard (7–12) ──
    {
        id: 7,
        category: "champion",
        title: "Golden Podium",
        text: `YouTube thumbnail (1280×720) — Create a podium-style layout. The center player is elevated on a golden podium with a glowing crown effect above their head. The two other players stand on silver and bronze podiums on either side. Background shows BGMI characters in winner poses holding flare guns and chicken dinners, confetti and golden particles raining down with Erangel's military base skyline behind them. The BIMON logo shines like a trophy emblem at the top-center. Text: "[TOURNAMENT NAME] — [SEASON X]" in gold serif font. "WHO TAKES THE CROWN?" in white bold at the bottom. Celebratory, premium feel.`,
    },
    {
        id: 8,
        category: "champion",
        title: "Leaderboard Reveal",
        text: `YouTube thumbnail (1280×720) for a BGMI leaderboard reveal. Three player images displayed inside circular frames arranged horizontally, each frame decorated with rank badges (#1, #2, #3). Background features PUBG Mobile characters standing at attention in a row like an army lineup, wearing themed outfits and holding weapons, against a dark navy blue backdrop with subtle grid lines and holographic data visualizations. The BIMON logo in the top-left corner. Large white text: "[TOURNAMENT NAME] TOP 3" at the top. "[SEASON X] STANDINGS REVEALED!" in yellow at the bottom. Clean, stats-focused, broadcast-quality design.`,
    },
    {
        id: 9,
        category: "champion",
        title: "Grand Finals Trophy",
        text: `YouTube thumbnail (1280×720) — Grand finals energy. Three player photos placed inside diamond-shaped frames with golden ornate borders. Background shows a massive golden trophy surrounded by BGMI characters in legendary outfits kneeling in reverence, weapons laid down, with divine light rays streaming through a dramatic clouded sky over Miramar's desert. The BIMON logo embossed on the trophy. Bold text: "[TOURNAMENT NAME] GRAND FINALS" in white and gold. "[SEASON X]" in a red banner ribbon across the bottom. Royal, prestigious atmosphere.`,
    },
    {
        id: 10,
        category: "champion",
        title: "Champion Celebration",
        text: `YouTube thumbnail (1280×720) — Winner announcement style. One player image in the center, much larger, with a golden aura and "CHAMPION" text arcing above their head. The other two players flanking smaller, with silver effects. Background shows BGMI characters celebrating a chicken dinner — jumping, fist-pumping, firing into the air — with confetti, stage lights, flare gun trails, and lens flares lighting up a victory lobby. The BIMON logo as a golden stamp in the corner. Text: "[Player 1 Name] WINS [TOURNAMENT NAME]!" in massive bold letters. "[SEASON X] CHAMPION" at the bottom. Maximum celebration energy.`,
    },
    {
        id: 11,
        category: "champion",
        title: "Holographic Player Cards",
        text: `YouTube thumbnail (1280×720) — Three player images arranged as holographic trading cards floating in space, each card has stats, kill counts, and tier rankings visible. Background features PUBG Mobile character silhouettes in futuristic skins standing in a digital void with blue circuit board patterns, data streams, and weapon holograms (M416, AWM, Groza) floating around them. The BIMON logo projected as a hologram between the cards. Text: "[TOURNAMENT NAME] — [SEASON X]" in futuristic font. "PLAYER CARDS REVEALED" in cyan neon at the bottom. Sci-fi esports aesthetic.`,
    },
    {
        id: 12,
        category: "champion",
        title: "Kill Feed Stats",
        text: `YouTube thumbnail (1280×720) — Three players displayed inside a BGMI-style kill feed / scoreboard UI mock-up, showing their photos next to fake impressive stats. Background is a clean dark tactical HUD with PUBG Mobile characters visible through a scope overlay — one enemy being knocked, damage numbers floating, kill feed scrolling. The BIMON logo in a corner badge. Bold text: "[TOURNAMENT NAME] — [SEASON X] RESULTS" in white. "THE NUMBERS DON'T LIE 🔥" in orange at the bottom. Clean, data-driven, professional.`,
    },

    // ── Action & Gameplay (13–18) ──
    {
        id: 13,
        category: "action",
        title: "Explosive Charge",
        text: `YouTube thumbnail (1280×720) — Three player images composited large in the foreground. Background shows BGMI characters in full sprint with M416s and Groza rifles, running toward the viewer with a massive C4 explosion behind them, Dacia vehicles flipping, and supply crates falling from the sky. Dramatic orange and black color scheme. The BIMON logo as a military-style dog tag hanging in the corner. Text: "[TOURNAMENT NAME]" in military stencil font. "[SEASON X] — DROP HOT OR GO HOME" in bold yellow. Michael Bay movie poster energy.`,
    },
    {
        id: 14,
        category: "action",
        title: "Sniper Crosshair",
        text: `YouTube thumbnail (1280×720) — Three players arranged inside a crosshair/scope view, each in their own targeting reticle. Background shows PUBG Mobile characters prone in grass with ghillie suits, one peeking from behind a tree with a Kar98k, red laser sights cutting through a dark tactical atmosphere. The BIMON logo displayed as a corner hologram. Text: "[TOURNAMENT NAME] — [SEASON X]" in red and white. "TARGET ACQUIRED 🎯" in bold at the bottom. Tactical, sniper-themed.`,
    },
    {
        id: 15,
        category: "action",
        title: "Strategic Map Drop",
        text: `YouTube thumbnail (1280×720) — Aerial view of a BGMI Erangel map with three player photos pinned to different locations like strategic markers (Pochinki, Military Base, Georgopol). Background shows PUBG Mobile characters parachuting toward the marked locations, red zone expanding around them, plane trail visible in the sky. The BIMON logo as a compass rose in the corner. Text: "[TOURNAMENT NAME]" in bold white. "WHERE WILL THEY LAND? | [SEASON X]" in yellow. Strategic map briefing aesthetic.`,
    },
    {
        id: 16,
        category: "action",
        title: "Smoke & Mirrors Combat",
        text: `YouTube thumbnail (1280×720) — Three players shown emerging from smoke grenades, each with a different color smoke (red, blue, green). Background shows BGMI characters in mid-combat through the colored smoke — one sliding, one hip-firing an UZI, one vaulting over a wall — with motion blur and muzzle flashes. Dark background with the BIMON logo burning through the smoke. Text: "[TOURNAMENT NAME] — [SEASON X]" across the top in white. "SMOKE AND MIRRORS 💨" in bold red at the bottom. Action movie energy, high contrast.`,
    },
    {
        id: 17,
        category: "action",
        title: "Airdrop Unboxing",
        text: `YouTube thumbnail (1280×720) — Loot crate/airdrop opening style. A massive golden BGMI airdrop crate splits open in the center, and the three player images emerge from inside like rare items being unboxed. Background shows PUBG Mobile characters scrambling toward the crate from all directions with weapons drawn, golden glow and sparkle effects everywhere, AWM, Groza, and Level 3 gear floating out. The BIMON logo stamped on the crate. Text: "[TOURNAMENT NAME]" in gold. "RARE PLAYERS UNLOCKED — [SEASON X]" in white at the bottom. Unboxing/gacha energy.`,
    },
    {
        id: 18,
        category: "action",
        title: "Squad Goals Vehicle Rush",
        text: `YouTube thumbnail (1280×720) — Three players positioned in the foreground. Background shows PUBG Mobile characters riding in a UAZ and a Dacia at high speed across Miramar, one character standing on the roof firing a DP-28, another throwing a Molotov, desert dust clouds and explosions behind them. Comic book / pop-art style with halftone dots and bold outlines. Vibrant colors — orange, teal, magenta. The BIMON logo as a license plate on the vehicle. Text: "[TOURNAMENT NAME] — [SEASON X]" in comic book font. "SQUAD GOALS 🚗💨" in bold. Fun, energetic, standout style.`,
    },

    // ── Dramatic & Cinematic (19–24) ──
    {
        id: 19,
        category: "cinematic",
        title: "Rain-Soaked Bridge",
        text: `YouTube thumbnail (1280×720) — Dark, rain-soaked cinematic scene. Three player images as large portraits in the foreground. Background shows BGMI characters as silhouettes standing in a row on Erangel's bridge, backlit by a single white spotlight, rain pouring down, holding weapons at their sides — reflections on wet ground, distant lightning illuminating a military compound. The BIMON logo glows faintly in the sky like a signal. Text: "[TOURNAMENT NAME]" in thin elegant white font. "THE STORM IS COMING — [SEASON X]" in red at the bottom. Moody, thriller movie poster.`,
    },
    {
        id: 20,
        category: "cinematic",
        title: "Wild West Wanted Poster",
        text: `YouTube thumbnail (1280×720) — Three players arranged in a "Wanted" poster style — their photos in separate aged/weathered frames with "MOST WANTED" stamps, bounty amounts below each. Background shows PUBG Mobile characters in cowboy-themed outfits standing in a dusty Miramar desert town, tumbleweeds rolling, revolvers holstered — Wild West meets BGMI aesthetic with sepia-toned coloring. The BIMON logo as a sheriff's badge. Text: "[TOURNAMENT NAME] — [SEASON X]" in Western slab-serif font. "DEAD OR ALIVE" at the bottom in red.`,
    },
    {
        id: 21,
        category: "cinematic",
        title: "Anime Battle Arc",
        text: `YouTube thumbnail (1280×720) — Anime/manga inspired. Three player images stylized with anime effects. Background features BGMI characters drawn in anime style with dramatic poses, speed lines radiating from the center — one character doing a jump-shot with an AWM, energy auras around them, bold black outlines, vibrant orange and cyan color scheme. The BIMON logo as a Japanese-style stamp/hanko seal in the corner. Text: "[TOURNAMENT NAME]" in dynamic anime title font with motion blur. "[SEASON X] ARC" in white. Epic shonen battle energy.`,
    },
    {
        id: 22,
        category: "cinematic",
        title: "Shattered Mirror",
        text: `YouTube thumbnail (1280×720) — Three players arranged inside a shattered mirror effect — each face visible in a different shard of broken glass, reflecting against a dark void. Background shows PUBG Mobile characters frozen mid-combat visible through the glass shards — one character mid-reload, one throwing a frag, one in a prone crawl — dramatic blue and purple lighting with glass particle effects. The BIMON logo reflected in one of the larger shards. Text: "[TOURNAMENT NAME] — [SEASON X]" in elegant serif font. "REFLECTIONS OF CHAMPIONS" in white italic at bottom. Artistic, premium.`,
    },
    {
        id: 23,
        category: "cinematic",
        title: "Movie Premiere",
        text: `YouTube thumbnail (1280×720) — Movie credits style. Three player images in cinematic wide-screen aspect ratio bars, each shown in a different dramatic color grade (teal, orange, magenta). Background shows BGMI characters walking in slow motion through Erangel ruins, weapons slung over shoulders, film grain overlay, cinematic depth of field — like a war movie poster. The BIMON logo as a production studio logo at the top. Text: "[TOURNAMENT NAME]" in minimal clean font. "A [SEASON X] PRODUCTION" in small tracking below. "COMING SOON" in large bold white. Cinematic premiere feel.`,
    },
    {
        id: 24,
        category: "cinematic",
        title: "Throne Room",
        text: `YouTube thumbnail (1280×720) — Three players composited into a flaming throne room scene. One player sits on a massive iron/gaming throne in the center, the other two kneel or stand as challengers. Background shows PUBG Mobile characters in royal/legendary outfits standing guard with flaming swords and pan weapons, dramatic fire and ember effects, a dark medieval castle atmosphere with BGMI crates and weapons mounted on walls. The BIMON logo carved into the throne. Text: "[TOURNAMENT NAME] — [SEASON X]" in Gothic font. "CLAIM THE THRONE 👑" in gold at the bottom. Game of Thrones meets BGMI.`,
    },

    // ── Stats & Elimination (25–28) ──
    {
        id: 25,
        category: "stats",
        title: "Tournament Bracket Path",
        text: `YouTube thumbnail (1280×720) — Elimination bracket style. Three player photos placed at the top of a tournament bracket graphic, with lines connecting them showing their path to the finals. Background shows BGMI characters positioned along the bracket lines in combat stances, neon green bracket lines on dark background, weapon silhouettes (M416, AWM, Pan) decorating the bracket nodes. The BIMON logo as a seal at the bracket's apex. Text: "[TOURNAMENT NAME] — [SEASON X] BRACKET" in white. "WHO SURVIVES? ⚔️" in neon green at the bottom. Clean esports broadcast overlay feel.`,
    },
    {
        id: 26,
        category: "stats",
        title: "Hex Stats Dashboard",
        text: `YouTube thumbnail (1280×720) — Three player images inside hexagonal frames arranged in a honeycomb pattern, each hex showing different stats (kills, damage, survival time). Background features PUBG Mobile characters displayed as holographic battle avatars in a futuristic dark blue UI environment — data streams flowing around them, weapon loadout cards floating, damage numbers and kill icons orbiting. The BIMON logo as a holographic badge. Text: "[TOURNAMENT NAME]" in tech font. "[SEASON X] — PERFORMANCE BREAKDOWN" in cyan. Dashboard/analytics style, data-rich.`,
    },
    {
        id: 27,
        category: "stats",
        title: "Venn Diagram Edge",
        text: `YouTube thumbnail (1280×720) — Three player images placed inside the circles of a Venn diagram, with the overlap area containing a "?" and the BIMON logo. Background subtly shows BGMI characters in faded silhouette form representing different playstyles — a rusher, a sniper, and a support player — with bright, bold colors (yellow, red, blue circles). Clean white background. Text: "[TOURNAMENT NAME]" in bold black. "WHO HAS THE EDGE? — [SEASON X]" in dark grey. Analytical, infographic style — clean and clickable.`,
    },
    {
        id: 28,
        category: "stats",
        title: "Elimination Shock",
        text: `YouTube thumbnail (1280×720) — Three player images with X marks over two of them (red X, slightly transparent) and a golden checkmark over the third. Background shows a BGMI endgame circle scenario — PUBG Mobile characters eliminated and crawling on the ground around the crossed-out players, while the surviving player stands victorious with a flare gun aimed at the sky, spotlight illuminating them. The BIMON logo as a judge's stamp in the corner. Text: "[TOURNAMENT NAME] — [SEASON X]" at top. "ELIMINATED! 😱" in massive red impact font across the middle. Shock value, controversy bait.`,
    },

    // ── Seasonal & Special (29–30) ──
    {
        id: 29,
        category: "seasonal",
        title: "New Season Launch",
        text: `YouTube thumbnail (1280×720) — New season launch hype. Three player images bursting through a giant "[SEASON X]" text that's cracking and exploding. Background shows BGMI characters in brand-new seasonal outfits charging forward with upgraded weapons — a collage of Erangel, Miramar, and Sanhok map landmarks, airdrops falling, planes flying overhead, with weapons and helmets scattered dramatically. The BIMON logo as a massive emblem in the sky. Text: "[TOURNAMENT NAME]" in chrome metallic font. "NEW SEASON. NEW LEGENDS. NEW RULES." in white at the bottom. Maximum hype, season premiere energy.`,
    },
    {
        id: 30,
        category: "seasonal",
        title: "Anniversary Celebration",
        text: `YouTube thumbnail (1280×720) — Anniversary/milestone celebration. Three players inside party-themed frames with balloons, streamers, and confetti. Background shows PUBG Mobile characters in festive/celebration outfits dancing and cheering around a giant trophy shaped like a BGMI chicken dinner, fireworks exploding in the sky, the BIMON logo displayed on a celebration banner and on the trophy with a "[SEASON X]" ribbon. Vibrant rainbow gradient background. Text: "[TOURNAMENT NAME]" in bold playful font. "🎉 [SEASON X] SPECIAL — THE BIGGEST SEASON YET!" in white. Festive, celebratory, warm energy.`,
    },
];

/**
 * Pro-level suffix appended to every prompt.
 * Handles body/hand pose adjustments and unified lighting across all 3 players.
 */
const PRO_SUFFIX = ` IMPORTANT — Pro Thumbnail Polish: For each of the three player images, adjust their body and hand poses to look like professional esports athletes — confident stances, arms crossed, fist clenches, pointing gestures, or victory poses. Avoid awkward or limp hand positions. Give each player a powerful, intentional pose that conveys dominance and skill. CRITICAL — Unified Lighting & Color Grading: All three player images MUST have matching, consistent lighting direction, color temperature, and shadow intensity. Apply a single unified color grade across all players so they look like they were photographed in the same scene — match the warm/cool tones, contrast levels, and rim lighting to the background environment. No player should look pasted in with mismatched lighting. The final result should look like a single professionally composited image, not three separate photos combined.`;

/** Returns the full prompt text with the pro suffix and tournament/season replaced */
function getFullPrompt(prompt: Prompt, tournamentName?: string, seasonName?: string): string {
    let text = prompt.text;
    if (tournamentName) {
        text = text.replace(/\[TOURNAMENT NAME\]/g, tournamentName);
    }
    if (seasonName) {
        text = text.replace(/\[SEASON X\]/g, seasonName);
        text = text.replace(/\[SEASON \[X\]\]/g, seasonName);
    }
    return text + PRO_SUFFIX;
}

/* ─────────────── player search hook ─────────────── */

function usePlayerSearch(search: string) {
    return useQuery<PlayerResult[]>({
        queryKey: ["thumbnail-players", search],
        queryFn: async () => {
            if (!search.trim()) return [];
            const res = await fetch(
                `/api/players?search=${encodeURIComponent(search)}&limit=10`
            );
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data ?? []).map((p: any) => ({
                id: p.id,
                displayName: p.displayName,
                username: p.username,
                imageUrl: p.imageUrl,
                category: p.category,
                clan: p.clan,
            }));
        },
        enabled: search.trim().length >= 2,
        staleTime: 30_000,
    });
}

/* ─────────────── tournament fetch hook ─────────────── */

function useTournaments() {
    return useQuery<TournamentOption[]>({
        queryKey: ["thumbnail-tournaments"],
        queryFn: async () => {
            const res = await fetch("/api/tournaments?limit=50");
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data ?? []).map((t: any) => ({
                id: t.id,
                name: t.name,
                seasonName: t.season?.name ?? null,
            }));
        },
        staleTime: 60_000,
    });
}

/* ─────────────── download helper ─────────────── */

async function downloadImage(url: string, filename: string) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast.success(`Downloaded ${filename}`);
    } catch {
        // Fallback: open in new tab
        window.open(url, "_blank");
        toast.info("Opened image in new tab — right-click to save");
    }
}

async function copyImageToClipboard(url: string) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        // Convert to PNG for clipboard compatibility
        const img = new Image();
        const canvas = document.createElement("canvas");
        const blobUrl = URL.createObjectURL(blob);

        await new Promise<void>((resolve, reject) => {
            img.onload = () => {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0);
                canvas.toBlob(async (pngBlob) => {
                    if (pngBlob) {
                        try {
                            await navigator.clipboard.write([
                                new ClipboardItem({ "image/png": pngBlob }),
                            ]);
                            toast.success("Image copied to clipboard!");
                            resolve();
                        } catch {
                            toast.error("Browser doesn't support image copy");
                            resolve();
                        }
                    } else {
                        reject();
                    }
                }, "image/png");
            };
            img.onerror = reject;
            img.crossOrigin = "anonymous";
            img.src = blobUrl;
        });

        URL.revokeObjectURL(blobUrl);
    } catch {
        toast.error("Failed to copy image");
    }
}

/* ─────────────── page component ─────────────── */

export default function ThumbnailPromptsPage() {
    // Tournament selection state
    const [selectedTournament, setSelectedTournament] = useState<TournamentOption | null>(null);
    const [showTournamentDropdown, setShowTournamentDropdown] = useState(false);
    const [tournamentSearch, setTournamentSearch] = useState("");
    const { data: tournaments, isLoading: tournamentsLoading } = useTournaments();

    // Player selection state
    const [playerSearch, setPlayerSearch] = useState("");
    const [selected, setSelected] = useState<SelectedPlayer[]>([]);
    const [showResults, setShowResults] = useState(false);
    const { data: searchResults, isLoading: searchLoading } = usePlayerSearch(playerSearch);

    // Prompt filter state
    const [promptSearch, setPromptSearch] = useState("");
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    const filteredTournaments = useMemo(() => {
        if (!tournaments) return [];
        if (!tournamentSearch.trim()) return tournaments;
        const q = tournamentSearch.toLowerCase();
        return tournaments.filter(
            (t) => t.name.toLowerCase().includes(q) || t.seasonName?.toLowerCase().includes(q)
        );
    }, [tournaments, tournamentSearch]);

    const selectPlayer = useCallback(
        (player: PlayerResult) => {
            if (selected.length >= 3) {
                toast.error("You can only select 3 players");
                return;
            }
            if (selected.find((s) => s.id === player.id)) {
                toast("Player already selected");
                return;
            }
            setSelected((prev) => [
                ...prev,
                {
                    id: player.id,
                    name: player.displayName || player.username,
                    imageUrl: player.imageUrl,
                },
            ]);
            setPlayerSearch("");
            setShowResults(false);
            toast.success(`Added ${player.displayName || player.username}`);
        },
        [selected]
    );

    const removePlayer = useCallback((id: string) => {
        setSelected((prev) => prev.filter((p) => p.id !== id));
    }, []);

    // Prompt filtering
    const filtered = useMemo(() => {
        let list = PROMPTS;
        if (activeCategory) list = list.filter((p) => p.category === activeCategory);
        if (promptSearch.trim()) {
            const q = promptSearch.toLowerCase();
            list = list.filter(
                (p) =>
                    p.title.toLowerCase().includes(q) ||
                    p.text.toLowerCase().includes(q)
            );
        }
        return list;
    }, [promptSearch, activeCategory]);

    const grouped = useMemo(() => {
        const map = new Map<string, Prompt[]>();
        for (const p of filtered) {
            const arr = map.get(p.category) || [];
            arr.push(p);
            map.set(p.category, arr);
        }
        return map;
    }, [filtered]);

    const handleCopy = async (prompt: Prompt) => {
        try {
            await navigator.clipboard.writeText(
                getFullPrompt(prompt, selectedTournament?.name, selectedTournament?.seasonName ?? undefined)
            );
            setCopiedId(prompt.id);
            toast.success(`Copied #${prompt.id} — ${prompt.title}`);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            toast.error("Failed to copy");
        }
    };

    const toggleCollapse = (key: string) => {
        setCollapsedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Clapperboard className="h-6 w-6 text-primary" />
                    Thumbnail Prompts
                </h1>
                <p className="text-sm text-foreground/50 mt-1">
                    Pick a tournament, select 3 players, download their images, then copy a prompt.
                </p>
            </div>

            {/* ━━━ Tournament Selector ━━━ */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    Tournament
                </h2>

                {selectedTournament ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{selectedTournament.name}</p>
                            {selectedTournament.seasonName && (
                                <p className="text-[11px] text-foreground/50">{selectedTournament.seasonName}</p>
                            )}
                        </div>
                        <button
                            onClick={() => setSelectedTournament(null)}
                            className="shrink-0 p-1.5 rounded-lg bg-foreground/5 hover:bg-danger/10 hover:text-danger transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <Input
                            size="sm"
                            placeholder="Search tournament..."
                            startContent={<Search className="h-4 w-4 text-foreground/40" />}
                            value={tournamentSearch}
                            onValueChange={(v) => {
                                setTournamentSearch(v);
                                setShowTournamentDropdown(true);
                            }}
                            onFocus={() => setShowTournamentDropdown(true)}
                            isClearable
                            onClear={() => {
                                setTournamentSearch("");
                                setShowTournamentDropdown(false);
                            }}
                            classNames={{ inputWrapper: "bg-foreground/[0.04]" }}
                        />

                        {showTournamentDropdown && (
                            <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-divider bg-content1 shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                                {tournamentsLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Spinner size="sm" />
                                    </div>
                                ) : !filteredTournaments.length ? (
                                    <p className="text-xs text-foreground/40 text-center py-6">
                                        No tournaments found
                                    </p>
                                ) : (
                                    filteredTournaments.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                setSelectedTournament(t);
                                                setShowTournamentDropdown(false);
                                                setTournamentSearch("");
                                                toast.success(`Selected: ${t.name}`);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.04] transition-colors"
                                        >
                                            <Trophy className="h-4 w-4 text-primary/60 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{t.name}</p>
                                                {t.seasonName && (
                                                    <p className="text-[11px] text-foreground/40">{t.seasonName}</p>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!selectedTournament && (
                    <p className="text-[11px] text-warning/70">⚠ Prompts will have [TOURNAMENT NAME] and [SEASON X] as placeholders until you select one</p>
                )}
            </div>

            {/* ━━━ Player Selection Section ━━━ */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Select Players ({selected.length}/3)
                    </h2>
                    {selected.length > 0 && (
                        <button
                            onClick={() => setSelected([])}
                            className="text-[11px] text-foreground/40 hover:text-danger transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {/* Search input */}
                <div className="relative">
                    <Input
                        size="sm"
                        placeholder="Search player by name..."
                        startContent={<Search className="h-4 w-4 text-foreground/40" />}
                        value={playerSearch}
                        onValueChange={(v) => {
                            setPlayerSearch(v);
                            setShowResults(true);
                        }}
                        onFocus={() => setShowResults(true)}
                        isClearable
                        onClear={() => {
                            setPlayerSearch("");
                            setShowResults(false);
                        }}
                        classNames={{ inputWrapper: "bg-foreground/[0.04]" }}
                        isDisabled={selected.length >= 3}
                        description={
                            selected.length >= 3
                                ? "Max 3 players selected"
                                : undefined
                        }
                    />

                    {/* Search dropdown */}
                    {showResults && playerSearch.trim().length >= 2 && (
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl border border-divider bg-content1 shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                            {searchLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Spinner size="sm" />
                                </div>
                            ) : !searchResults?.length ? (
                                <p className="text-xs text-foreground/40 text-center py-6">
                                    No players found
                                </p>
                            ) : (
                                searchResults.map((player) => {
                                    const isSelected = selected.some(
                                        (s) => s.id === player.id
                                    );
                                    return (
                                        <button
                                            key={player.id}
                                            onClick={() => selectPlayer(player)}
                                            disabled={isSelected}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                                isSelected
                                                    ? "bg-primary/5 opacity-50 cursor-not-allowed"
                                                    : "hover:bg-foreground/[0.04]"
                                            }`}
                                        >
                                            <Avatar
                                                src={player.imageUrl}
                                                name={
                                                    player.displayName ||
                                                    player.username
                                                }
                                                size="sm"
                                                className="shrink-0"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">
                                                    {player.displayName ||
                                                        player.username}
                                                </p>
                                                <p className="text-[11px] text-foreground/40 truncate">
                                                    @{player.username}
                                                    {player.clan
                                                        ? ` · [${player.clan.tag}]`
                                                        : ""}
                                                </p>
                                            </div>
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color={
                                                    isSelected
                                                        ? "success"
                                                        : "default"
                                                }
                                            >
                                                {isSelected
                                                    ? "Selected"
                                                    : player.category}
                                            </Chip>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Selected players grid */}
                {selected.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                        {selected.map((player, idx) => (
                            <div
                                key={player.id}
                                className="relative rounded-xl border border-divider bg-foreground/[0.03] overflow-hidden group"
                            >
                                {/* Player image */}
                                <div className="relative aspect-square bg-black/10">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={player.imageUrl}
                                        alt={player.name}
                                        className="w-full h-full object-cover"
                                        crossOrigin="anonymous"
                                    />

                                    {/* Player number badge */}
                                    <div className="absolute top-2 left-2">
                                        <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow-lg">
                                            {idx + 1}
                                        </span>
                                    </div>

                                    {/* Remove button */}
                                    <button
                                        onClick={() => removePlayer(player.id)}
                                        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>

                                    {/* Action overlay */}
                                    <div className="absolute bottom-0 inset-x-0 p-2 flex gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/70 to-transparent pt-6">
                                        <button
                                            onClick={() =>
                                                copyImageToClipboard(
                                                    player.imageUrl
                                                )
                                            }
                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium hover:bg-white/30 transition-colors"
                                        >
                                            <Copy className="h-3 w-3" />
                                            Copy
                                        </button>
                                        <button
                                            onClick={() =>
                                                downloadImage(
                                                    player.imageUrl,
                                                    `player-${idx + 1}-${player.name.replace(/\s+/g, "-").toLowerCase()}.png`
                                                )
                                            }
                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium hover:bg-white/30 transition-colors"
                                        >
                                            <Download className="h-3 w-3" />
                                            Save
                                        </button>
                                    </div>
                                </div>

                                {/* Player name */}
                                <div className="px-2.5 py-2 text-center">
                                    <p className="text-xs font-medium truncate">
                                        {player.name}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Empty slots */}
                        {Array.from({ length: 3 - selected.length }).map(
                            (_, i) => (
                                <div
                                    key={`empty-${i}`}
                                    onClick={() => {
                                        const input = document.querySelector<HTMLInputElement>(
                                            '[placeholder="Search player by name..."]'
                                        );
                                        input?.focus();
                                    }}
                                    className="rounded-xl border-2 border-dashed border-foreground/10 flex flex-col items-center justify-center aspect-square cursor-pointer hover:border-primary/30 transition-colors"
                                >
                                    <ImageIcon className="h-6 w-6 text-foreground/15 mb-1" />
                                    <span className="text-[10px] text-foreground/25">
                                        Player {selected.length + i + 1}
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* Download all button */}
                {selected.length === 3 && (
                    <button
                        onClick={async () => {
                            for (const [idx, p] of selected.entries()) {
                                await downloadImage(
                                    p.imageUrl,
                                    `player-${idx + 1}-${p.name.replace(/\s+/g, "-").toLowerCase()}.png`
                                );
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Download All 3 Images
                    </button>
                )}
            </div>

            {/* ━━━ BIMON Logo — Always Ready ━━━ */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    BIMON Logo
                </h2>
                <div className="flex items-center gap-4">
                    <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-black/10 border border-divider">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/icons/bgmi/icon-512x512.png"
                            alt="BIMON Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">icon-512x512.png</p>
                        <p className="text-[11px] text-foreground/40">Upload this as the 4th reference image in your AI tool</p>
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => copyImageToClipboard("/icons/bgmi/icon-512x512.png")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/60 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                                <Copy className="h-3 w-3" />
                                Copy
                            </button>
                            <button
                                onClick={() => downloadImage("/icons/bgmi/icon-512x512.png", "bimon-logo.png")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/60 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                                <Download className="h-3 w-3" />
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="space-y-3">
                <Input
                    size="sm"
                    placeholder="Search prompts..."
                    startContent={
                        <Search className="h-4 w-4 text-foreground/40" />
                    }
                    value={promptSearch}
                    onValueChange={setPromptSearch}
                    isClearable
                    onClear={() => setPromptSearch("")}
                    classNames={{ inputWrapper: "bg-foreground/[0.04]" }}
                />
                <div className="flex flex-wrap gap-2">
                    <Chip
                        size="sm"
                        variant={activeCategory === null ? "solid" : "flat"}
                        color="primary"
                        className="cursor-pointer"
                        onClick={() => setActiveCategory(null)}
                    >
                        All ({PROMPTS.length})
                    </Chip>
                    {CATEGORIES.map((cat) => {
                        const count = PROMPTS.filter(
                            (p) => p.category === cat.key
                        ).length;
                        return (
                            <Chip
                                key={cat.key}
                                size="sm"
                                variant={
                                    activeCategory === cat.key ? "solid" : "flat"
                                }
                                color={cat.color}
                                className="cursor-pointer"
                                onClick={() =>
                                    setActiveCategory(
                                        activeCategory === cat.key
                                            ? null
                                            : cat.key
                                    )
                                }
                            >
                                {cat.label} ({count})
                            </Chip>
                        );
                    })}
                </div>
            </div>

            {/* Results count */}
            {(promptSearch || activeCategory) && (
                <p className="text-xs text-foreground/40">
                    Showing {filtered.length} of {PROMPTS.length} prompts
                </p>
            )}

            {/* Grouped prompt cards */}
            {CATEGORIES.filter((cat) => grouped.has(cat.key)).map((cat) => {
                const prompts = grouped.get(cat.key)!;
                const isCollapsed = collapsedCategories.has(cat.key);

                return (
                    <div key={cat.key} className="space-y-3">
                        {/* Category header */}
                        <button
                            onClick={() => toggleCollapse(cat.key)}
                            className="w-full flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                                    {cat.label}
                                </h2>
                                <Chip size="sm" variant="flat" color={cat.color}>
                                    {prompts.length}
                                </Chip>
                            </div>
                            {isCollapsed ? (
                                <ChevronDown className="h-4 w-4 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
                            ) : (
                                <ChevronUp className="h-4 w-4 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
                            )}
                        </button>

                        {/* Prompt cards */}
                        {!isCollapsed && (
                            <div className="space-y-2">
                                {prompts.map((prompt) => (
                                    <div
                                        key={prompt.id}
                                        className="group rounded-2xl border border-divider bg-foreground/[0.02] hover:bg-foreground/[0.05] transition-colors overflow-hidden"
                                    >
                                        {/* Card header */}
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
                                                onClick={() =>
                                                    handleCopy(prompt)
                                                }
                                                className={`shrink-0 p-2 rounded-xl transition-all ${
                                                    copiedId === prompt.id
                                                        ? "bg-success/20 text-success"
                                                        : "bg-foreground/5 text-foreground/40 hover:bg-primary/10 hover:text-primary"
                                                }`}
                                                title="Copy prompt"
                                            >
                                                {copiedId === prompt.id ? (
                                                    <Check className="h-4 w-4" />
                                                ) : (
                                                    <Copy className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>

                                        {/* Prompt text */}
                                        <div
                                            onClick={() => handleCopy(prompt)}
                                            className="px-4 pb-4 cursor-pointer"
                                        >
                                            <p className="text-xs text-foreground/50 leading-relaxed line-clamp-4 group-hover:line-clamp-none transition-all">
                                                {getFullPrompt(prompt, selectedTournament?.name, selectedTournament?.seasonName ?? undefined)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

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
                    <li>
                        Upload 3 player images + BIMON logo as reference images
                        in your AI tool
                    </li>
                    <li>
                        Replace{" "}
                        <code className="text-primary/70 bg-primary/5 px-1 rounded">
                            [TOURNAMENT NAME]
                        </code>{" "}
                        and{" "}
                        <code className="text-primary/70 bg-primary/5 px-1 rounded">
                            [SEASON X]
                        </code>{" "}
                        before pasting
                    </li>
                    <li>
                        Use 16:9 aspect ratio (1280×720) in your generator
                        settings
                    </li>
                    <li>
                        AI struggles with text — add text overlay in Canva or
                        Photoshop after
                    </li>
                    <li>
                        Generate 3–4 variations per prompt and pick the best one
                    </li>
                </ul>
            </div>
        </div>
    );
}
