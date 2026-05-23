import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCategoryFromKDValue } from "@/lib/logic/categoryUtils";

/**
 * Validate the stream token from query params.
 */
function validateToken(request: NextRequest): boolean {
    const token = request.nextUrl.searchParams.get("token");
    const expected = process.env.STREAM_TOKEN;
    if (!expected) return false;
    return token === expected;
}

/**
 * Get or create the singleton StreamState row.
 */
async function getOrCreateState() {
    let state = await prisma.streamState.findUnique({
        where: { id: "default" },
    });
    if (!state) {
        state = await prisma.streamState.create({
            data: { id: "default" },
        });
    }
    return state;
}

/**
 * Fetch full player data with computed stats for the overlay.
 * Stats are RANKED ONLY (tournaments with allowSquads=true).
 */
async function getPlayerWithStats(playerId: string) {
    const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: {
            user: {
                select: { username: true, imageUrl: true },
            },
        },
    });

    if (!player) return null;

    // Aggregate stats from TeamPlayerStats — RANKED ONLY
    const statsAgg = await prisma.teamPlayerStats.aggregate({
        where: {
            playerId,
            present: true,
            match: {
                tournament: {
                    poll: { allowSquads: true },
                },
            },
        },
        _count: { matchId: true },
        _sum: { kills: true },
    });

    const totalMatches = statsAgg._count.matchId;
    const totalKills = statsAgg._sum.kills ?? 0;
    const kd = totalMatches > 0 ? totalKills / totalMatches : 0;

    // Count wins (position = 1) — RANKED ONLY
    const winsCount = await prisma.teamStats.count({
        where: {
            position: 1,
            team: { players: { some: { id: playerId } } },
            tournament: {
                poll: { allowSquads: true },
            },
        },
    });

    const category = getCategoryFromKDValue(kd);

    return {
        id: player.id,
        displayName: player.displayName,
        imageUrl: player.customProfileImageUrl || player.user.imageUrl,
        category,
        stats: {
            kills: totalKills,
            matches: totalMatches,
            kd: Number(kd.toFixed(2)),
        },
        wins: winsCount,
    };
}

/**
 * Fuzzy match a player name against players in the current tournament.
 * Used by OCR script — sends raw text from screen, we find the best match.
 */
async function fuzzyMatchPlayer(name: string, tournamentId: string): Promise<string | null> {
    if (!name || name.trim().length < 2) return null;

    const cleanName = name.trim().toLowerCase();

    // Get all players in this tournament via teams
    const teams = await prisma.team.findMany({
        where: { tournamentId },
        select: {
            players: {
                select: { id: true, displayName: true },
            },
        },
    });

    const players = teams.flatMap((t) => t.players);
    if (players.length === 0) return null;

    // Score each player — higher is better
    let bestMatch: { id: string; score: number } | null = null;

    for (const p of players) {
        const pName = (p.displayName || "").toLowerCase();
        if (!pName) continue;

        let score = 0;

        // Exact match
        if (pName === cleanName) {
            return p.id; // Perfect match, return immediately
        }

        // Contains match (OCR might read partial name)
        if (pName.includes(cleanName) || cleanName.includes(pName)) {
            score = 80;
        }

        // Word overlap — useful for clan tags like "TAG | TRIGGER"
        const nameWords = cleanName.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
        const pWords = pName.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

        let wordMatches = 0;
        for (const nw of nameWords) {
            for (const pw of pWords) {
                if (nw === pw) wordMatches++;
                else if (nw.length >= 3 && pw.includes(nw)) wordMatches += 0.5;
                else if (pw.length >= 3 && nw.includes(pw)) wordMatches += 0.5;
            }
        }

        if (pWords.length > 0) {
            const wordScore = (wordMatches / Math.max(nameWords.length, pWords.length)) * 70;
            score = Math.max(score, wordScore);
        }

        // Levenshtein-inspired similarity for short names
        if (pName.length <= 15 && cleanName.length <= 15) {
            const maxLen = Math.max(pName.length, cleanName.length);
            let matches = 0;
            const shorter = pName.length <= cleanName.length ? pName : cleanName;
            const longer = pName.length <= cleanName.length ? cleanName : pName;
            for (let i = 0; i < shorter.length; i++) {
                if (longer.includes(shorter[i])) matches++;
            }
            const charScore = (matches / maxLen) * 60;
            score = Math.max(score, charScore);
        }

        if (score > (bestMatch?.score ?? 0)) {
            bestMatch = { id: p.id, score };
        }
    }

    // Require at least 50% confidence
    return bestMatch && bestMatch.score >= 50 ? bestMatch.id : null;
}

/**
 * GET /api/stream/state?token=xxx
 * Returns current overlay state — just the selected player ID and visibility.
 * The overlay uses its pre-cached player data to look up stats (no heavy queries here).
 */
export async function GET(request: NextRequest) {
    if (!validateToken(request)) {
        return ErrorResponse({ message: "Invalid token", status: 401 });
    }

    try {
        const state = await getOrCreateState();

        return SuccessResponse({
            data: {
                selectedPlayerId: state.selectedPlayerId,
                isVisible: state.isVisible,
                tournamentId: state.tournamentId,
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to get stream state", error });
    }
}

/**
 * POST /api/stream/state?token=xxx
 * Update the currently selected player and visibility.
 * Accepts either selectedPlayerId (direct) or selectedPlayerName (OCR fuzzy match).
 */
export async function POST(request: NextRequest) {
    if (!validateToken(request)) {
        return ErrorResponse({ message: "Invalid token", status: 401 });
    }

    try {
        const body = await request.json();
        const { selectedPlayerId, selectedPlayerName, tournamentId, isVisible } = body;

        // Ensure state row exists
        const currentState = await getOrCreateState();

        const updateData: Record<string, unknown> = {};

        // Tournament change
        if (tournamentId !== undefined) {
            updateData.tournamentId = tournamentId;
        }

        // Visibility toggle
        if (typeof isVisible === "boolean") {
            updateData.isVisible = isVisible;
        }

        // Direct player selection (from control panel)
        if (selectedPlayerId !== undefined) {
            updateData.selectedPlayerId = selectedPlayerId;
        }

        // OCR name match (from OCR script)
        if (selectedPlayerName && !selectedPlayerId) {
            const tId = tournamentId || currentState.tournamentId;
            if (tId) {
                const matchedId = await fuzzyMatchPlayer(selectedPlayerName, tId);
                if (matchedId) {
                    updateData.selectedPlayerId = matchedId;
                }
            }
        }

        const updated = await prisma.streamState.update({
            where: { id: "default" },
            data: updateData,
        });

        return SuccessResponse({
            data: {
                selectedPlayerId: updated.selectedPlayerId,
                isVisible: updated.isVisible,
                tournamentId: updated.tournamentId,
            },
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to update stream state", error });
    }
}
