import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCategoryFromKDValue } from "@/lib/logic/categoryUtils";

function validateToken(request: NextRequest): boolean {
    const token = request.nextUrl.searchParams.get("token");
    const expected = process.env.STREAM_TOKEN;
    if (!expected) return false;
    return token === expected;
}

/**
 * GET /api/stream/players?token=xxx&tournamentId=xxx
 * Returns all players in a tournament with pre-computed stats for the overlay.
 * No auth required — token-protected.
 */
export async function GET(request: NextRequest) {
    if (!validateToken(request)) {
        return ErrorResponse({ message: "Invalid token", status: 401 });
    }

    const tournamentId = request.nextUrl.searchParams.get("tournamentId");
    if (!tournamentId) {
        return ErrorResponse({ message: "tournamentId is required", status: 400 });
    }

    try {
        // Get all players via tournament teams
        const teams = await prisma.team.findMany({
            where: { tournamentId },
            select: {
                players: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: {
                            select: { imageUrl: true },
                        },
                        streak: {
                            select: { current: true, longest: true },
                        },
                    },
                },
            },
        });

        const players = teams.flatMap((t) => t.players);

        // Deduplicate (a player could be on multiple teams across matches)
        const uniquePlayers = Array.from(
            new Map(players.map((p) => [p.id, p])).values()
        );

        if (uniquePlayers.length === 0) {
            return SuccessResponse({ data: [] });
        }

        const playerIds = uniquePlayers.map((p) => p.id);

        // Batch aggregate stats from TeamPlayerStats
        const statsGroups = await prisma.teamPlayerStats.groupBy({
            by: ["playerId"],
            where: { playerId: { in: playerIds }, present: true },
            _count: { matchId: true },
            _sum: { kills: true },
        });

        const statsMap = new Map(
            statsGroups.map((s) => [
                s.playerId,
                {
                    matches: s._count.matchId,
                    kills: s._sum.kills ?? 0,
                },
            ])
        );

        // Batch count wins (position = 1)
        const winsData = await prisma.teamStats.findMany({
            where: {
                position: 1,
                team: { players: { some: { id: { in: playerIds } } } },
            },
            select: {
                team: {
                    select: {
                        players: {
                            where: { id: { in: playerIds } },
                            select: { id: true },
                        },
                    },
                },
            },
        });

        const winsMap = new Map<string, number>();
        for (const w of winsData) {
            for (const p of w.team.players) {
                winsMap.set(p.id, (winsMap.get(p.id) || 0) + 1);
            }
        }

        // Build response
        const data = uniquePlayers.map((p) => {
            const stats = statsMap.get(p.id) || { kills: 0, matches: 0 };
            const kd = stats.matches > 0 ? stats.kills / stats.matches : 0;
            const category = getCategoryFromKDValue(kd);

            return {
                id: p.id,
                displayName: p.displayName,
                imageUrl: p.customProfileImageUrl || p.user.imageUrl,
                category,
                stats: {
                    kills: stats.kills,
                    matches: stats.matches,
                    kd: Number(kd.toFixed(2)),
                },
                streak: p.streak
                    ? { current: p.streak.current, longest: p.streak.longest }
                    : { current: 0, longest: 0 },
                wins: winsMap.get(p.id) || 0,
            };
        });

        // Sort by KD descending
        data.sort((a, b) => b.stats.kd - a.stats.kd);

        return SuccessResponse({ data });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch stream players", error });
    }
}
