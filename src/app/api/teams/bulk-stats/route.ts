import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { type NextRequest } from "next/server";
import { awardMatchXP } from "@/lib/clan-xp";

interface TeamStatInput {
    teamId: string;
    position: number;
    players: {
        playerId: string;
        kills: number;
        present: boolean;
    }[];
}

/**
 * PUT /api/teams/bulk-stats
 * Bulk update team positions and player kills/presence for a match.
 */
export async function PUT(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Unauthorized", status: 403 });
        }

        const { tournamentId, matchId, stats } = await request.json() as {
            tournamentId: string;
            matchId: string;
            stats: TeamStatInput[];
        };

        if (!tournamentId || !matchId || !stats?.length) {
            return ErrorResponse({ message: "tournamentId, matchId, and stats are required", status: 400 });
        }

        // Validate match + tournament exist
        const match = await prisma.match.findFirst({
            where: { id: matchId, tournamentId },
        });
        if (!match) return ErrorResponse({ message: "Match not found in tournament", status: 404 });

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { seasonId: true },
        });

        // Process each team's stats
        for (const teamStat of stats) {
            // Upsert TeamStats (position)
            const ts = await prisma.teamStats.upsert({
                where: { teamId_matchId: { teamId: teamStat.teamId, matchId } },
                create: {
                    teamId: teamStat.teamId,
                    matchId,
                    position: teamStat.position,
                    tournamentId,
                    seasonId: tournament?.seasonId ?? null,
                },
                update: { position: teamStat.position },
            });

            // Upsert each player's stats
            for (const p of teamStat.players) {
                await prisma.teamPlayerStats.upsert({
                    where: {
                        playerId_teamId_matchId: {
                            playerId: p.playerId,
                            teamId: teamStat.teamId,
                            matchId,
                        },
                    },
                    create: {
                        playerId: p.playerId,
                        teamId: teamStat.teamId,
                        matchId,
                        teamStatsId: ts.id,
                        kills: p.kills,
                        present: p.present,
                        seasonId: tournament?.seasonId ?? null,
                    },
                    update: {
                        kills: p.kills,
                        present: p.present,
                    },
                });
            }
        }

        // Update PlayerStats season aggregates
        for (const teamStat of stats) {
            for (const p of teamStat.players) {
                // Re-aggregate from all TeamPlayerStats for this player in the season
                const agg = await prisma.teamPlayerStats.aggregate({
                    where: {
                        playerId: p.playerId,
                        seasonId: tournament?.seasonId ?? undefined,
                        present: true,
                    },
                    _sum: { kills: true },
                    _count: { _all: true },
                });

                if (tournament?.seasonId) {
                    await prisma.playerStats.upsert({
                        where: {
                            seasonId_playerId: {
                                playerId: p.playerId,
                                seasonId: tournament.seasonId,
                            },
                        },
                        create: {
                            playerId: p.playerId,
                            seasonId: tournament.seasonId,
                            kills: agg._sum.kills ?? 0,
                            matches: agg._count._all,
                        },
                        update: {
                            kills: agg._sum.kills ?? 0,
                            matches: agg._count._all,
                        },
                    });
                }
            }
        }

        // Award clan XP silently
        try {
            const xpStats = stats.flatMap((ts) =>
                ts.players.map((p) => ({
                    playerId: p.playerId,
                    kills: p.present ? p.kills : null,
                    position: ts.position,
                    teamId: ts.teamId,
                }))
            );
            await awardMatchXP(xpStats, prisma);
        } catch {
            // Don't fail the request if XP awarding fails
        }

        return SuccessResponse({ message: "Stats updated successfully" });
    } catch (error) {
        return ErrorResponse({ message: "Failed to update stats", error });
    }
}
