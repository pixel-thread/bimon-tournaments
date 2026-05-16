import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getAuthEmail } from "@/lib/auth";
import { type NextRequest } from "next/server";
import { getCategoryFromKDValue } from "@/lib/logic/categoryUtils";

/**
 * GET /api/teams
 * Fetches teams for a specific tournament with players and stats.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const tournamentId = searchParams.get("tournamentId");
        const matchId = searchParams.get("matchId");

        if (!tournamentId) {
            return ErrorResponse({
                message: "tournamentId is required",
                status: 400,
            });
        }

        // If matchId is specified, find teams that played in that match
        let teamIdFilter: string[] | undefined;
        if (matchId) {
            const matchTeamStats = await prisma.teamStats.findMany({
                where: { matchId },
                select: { teamId: true },
                distinct: ["teamId"],
            });
            teamIdFilter = matchTeamStats.map(ts => ts.teamId);
        }

        const [teams, poll] = await Promise.all([
            prisma.team.findMany({
                where: {
                    tournamentId,
                    ...(teamIdFilter ? { id: { in: teamIdFilter } } : {}),
                },
                include: {
                    players: {
                        select: {
                            id: true,
                            displayName: true,
                            customProfileImageUrl: true,
                            user: {
                                select: {
                                    username: true,
                                    imageUrl: true,
                                },
                            },
                            category: true,
                        },
                    },
                    clan: {
                        select: { logoUrl: true, tag: true },
                    },
                    tournamentWinner: {
                        select: {
                            position: true,
                            amount: true,
                            isDistributed: true,
                        },
                    },
                    _count: {
                        select: { matches: true },
                    },
                },
                orderBy: { teamNumber: "asc" },
            }),
            prisma.poll.findUnique({
                where: { tournamentId },
                select: { allowSquads: true },
            }),
        ]);

        // For migrated teams where team.players is empty,
        // fetch players via TeamPlayerStats
        const teamIds = teams.map(t => t.id);
        const allPlayerStats = await prisma.teamPlayerStats.findMany({
            where: { teamId: { in: teamIds } },
            select: {
                teamId: true,
                playerId: true,
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { username: true, imageUrl: true } },
                        category: true,
                    },
                },
            },
            distinct: ["teamId", "playerId"],
        });

        // Build map: teamId -> players from stats
        const statsPlayersMap = new Map<string, typeof allPlayerStats>();
        for (const ps of allPlayerStats) {
            if (!statsPlayersMap.has(ps.teamId)) statsPlayersMap.set(ps.teamId, []);
            statsPlayersMap.get(ps.teamId)!.push(ps);
        }

        // Also count matches per team from teamStats
        const teamMatchCounts = await prisma.teamStats.groupBy({
            by: ["teamId"],
            where: { teamId: { in: teamIds } },
            _count: { matchId: true },
        });
        const matchCountMap = new Map<string, number>();
        for (const tc of teamMatchCounts) {
            matchCountMap.set(tc.teamId, tc._count.matchId);
        }

        // Compute dynamic categories based on tournament mode
        // Collect all unique player IDs across all teams
        const allPlayerIds = new Set<string>();
        for (const team of teams) {
            for (const p of team.players) allPlayerIds.add(p.id);
        }
        for (const ps of allPlayerStats) {
            allPlayerIds.add(ps.playerId);
        }

        // Batch-compute K/D from mode-filtered stats (same logic as players API)
        const dynamicCategoryMap = new Map<string, string>();
        if (allPlayerIds.size > 0) {
            const modeFilter: Record<string, unknown> = {
                playerId: { in: Array.from(allPlayerIds) },
                present: true,
            };
            // Filter by mode: ranked (allowSquads=true) vs casual
            if (poll?.allowSquads === true) {
                modeFilter.match = { tournament: { poll: { allowSquads: true } } };
            } else if (poll?.allowSquads === false) {
                modeFilter.match = { tournament: { poll: { allowSquads: false } } };
            }

            const modeStats = await prisma.teamPlayerStats.groupBy({
                by: ["playerId"],
                where: modeFilter,
                _count: { matchId: true },
                _sum: { kills: true },
            });

            for (const s of modeStats) {
                const kd = s._count.matchId > 0 ? (s._sum.kills ?? 0) / s._count.matchId : 0;
                dynamicCategoryMap.set(s.playerId, getCategoryFromKDValue(kd));
            }
        }

        const data = teams.map((team) => {
            // Merge players: use team.players if available, otherwise from stats
            const directPlayers = team.players.map((p) => ({
                id: p.id,
                displayName: p.displayName,
                username: p.user.username,
                imageUrl: p.customProfileImageUrl || p.user.imageUrl,
                category: dynamicCategoryMap.get(p.id) ?? p.category,
            }));

            let players = directPlayers;
            if (directPlayers.length === 0) {
                const statsPlayers = statsPlayersMap.get(team.id) || [];
                const seen = new Set<string>();
                players = [];
                for (const sp of statsPlayers) {
                    if (!seen.has(sp.player.id)) {
                        seen.add(sp.player.id);
                        players.push({
                            id: sp.player.id,
                            displayName: sp.player.displayName,
                            username: sp.player.user.username,
                            imageUrl: sp.player.customProfileImageUrl || sp.player.user.imageUrl,
                            category: dynamicCategoryMap.get(sp.player.id) ?? sp.player.category,
                        });
                    }
                }
            }

            return {
                id: team.id,
                name: team.name,
                teamNumber: team.teamNumber,
                clanLogo: team.clan?.logoUrl ?? null,
                clanTag: team.clan?.tag ?? null,
                disqualified: team.disqualified,
                matchCount: matchCountMap.get(team.id) || team._count.matches,
                winner: team.tournamentWinner[0] ?? null,
                players,
            };
        });

        return SuccessResponse({ data, meta: { allowSquads: poll?.allowSquads ?? false } });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch teams", error });
    }
}

