import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { type NextRequest } from "next/server";

/**
 * GET /api/matches
 * Fetches matches for a specific tournament with team stats and player kills/deaths.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const tournamentId = searchParams.get("tournamentId");

        if (!tournamentId) {
            return ErrorResponse({
                message: "tournamentId is required",
                status: 400,
            });
        }

        const matches = await prisma.match.findMany({
            where: { tournamentId },
            include: {
                teamStats: {
                    include: {
                        team: {
                            select: { id: true, name: true, teamNumber: true, clan: { select: { logoUrl: true, tag: true } } },
                        },
                        teamPlayerStats: {
                            include: {
                                player: {
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
                                    },
                                },
                            },
                            orderBy: { kills: "desc" },
                        },
                    },
                    orderBy: { position: "asc" },
                },
            },
            orderBy: { matchNumber: "asc" },
        });

        // Get all team rosters for this tournament (to show absent players too)
        const tournamentTeams = await prisma.team.findMany({
            where: { tournamentId },
            select: {
                id: true,
                players: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
            },
        });
        const teamRosterMap = new Map(tournamentTeams.map(t => [t.id, t.players]));

        const data = matches.map((match) => ({
            id: match.id,
            matchNumber: match.matchNumber,
            createdAt: match.createdAt,
            phase: match.phase,
            teams: match.teamStats.map((ts) => {
                // Players who have TPS records (present)
                const tpsPlayers = ts.teamPlayerStats.map((tps) => ({
                    id: tps.player.id,
                    displayName: tps.player.displayName,
                    username: tps.player.user.username,
                    imageUrl: tps.player.customProfileImageUrl || tps.player.user.imageUrl,
                    kills: tps.kills,
                    present: tps.present,
                }));
                const presentIds = new Set(tpsPlayers.map(p => p.id));

                // Add players from roster who don't have TPS records yet
                // These players haven't had stats entered — default to absent
                const roster = teamRosterMap.get(ts.team.id) || [];
                const rosterOnlyPlayers = roster
                    .filter(p => !presentIds.has(p.id))
                    .map(p => ({
                        id: p.id,
                        displayName: p.displayName,
                        username: p.user.username,
                        imageUrl: p.customProfileImageUrl || p.user.imageUrl,
                        kills: 0,
                        present: false,
                    }));

                return {
                    teamId: ts.team.id,
                    teamName: ts.team.name,
                    teamNumber: ts.team.teamNumber,
                    clanLogo: ts.team.clan?.logoUrl ?? null,
                    clanTag: ts.team.clan?.tag ?? null,
                    position: ts.position,
                    players: [...tpsPlayers, ...rosterOnlyPlayers],
                };
            }),
        }));

        return SuccessResponse({ data });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch matches", error });
    }
}

/**
 * POST /api/matches
 * Creates a new match for a tournament.
 * Clones all teams & players from the previous match automatically.
 * Body: { tournamentId: string }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Unauthorized", status: 403 });
        }

        const body = await request.json();
        const { tournamentId, phase, count: rawCount } = body as { tournamentId: string; phase?: string; count?: number };
        const count = Math.min(Math.max(rawCount || 1, 1), 10); // Clamp 1–10

        if (!tournamentId) {
            return ErrorResponse({ message: "tournamentId is required", status: 400 });
        }

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { id: true, name: true, seasonId: true },
        });

        if (!tournament) {
            return ErrorResponse({ message: "Tournament not found", status: 404 });
        }

        const seasonId = tournament.seasonId;

        const createdMatches: { id: string; matchNumber: number }[] = [];

        for (let i = 0; i < count; i++) {
            // Find the latest match to clone from (re-query each iteration for sequential cloning)
            const prevMatch = await prisma.match.findFirst({
                where: {
                    tournamentId,
                    ...(phase ? { phase } : {}),
                },
                orderBy: { matchNumber: "desc" },
                select: {
                    id: true,
                    matchNumber: true,
                    phase: true,
                    teamStats: {
                        select: {
                            teamId: true,
                            teamPlayerStats: {
                                select: { playerId: true },
                            },
                        },
                    },
                },
            });

            // Global match number (across all phases)
            const globalMaxMatch = await prisma.match.findFirst({
                where: { tournamentId },
                orderBy: { matchNumber: "desc" },
                select: { matchNumber: true },
            });
            const nextMatchNumber = (globalMaxMatch?.matchNumber ?? 0) + 1;

            let match;
            try {
                match = await prisma.match.create({
                    data: {
                        matchNumber: nextMatchNumber,
                        tournamentId,
                        ...(seasonId ? { seasonId } : {}),
                        ...(phase ? { phase } : {}),
                    },
                });
            } catch (err: unknown) {
                const isPrismaUnique = err instanceof Error && "code" in err && (err as { code: string }).code === "P2002";
                if (isPrismaUnique) {
                    if (createdMatches.length > 0) break; // Some already created, stop gracefully
                    return ErrorResponse({
                        message: "Another admin is already creating a match for this tournament. Please wait and refresh.",
                        status: 409,
                    });
                }
                throw err;
            }

            // Clone teams from previous match if it exists
            let teamCount = 0;
            if (prevMatch && prevMatch.teamStats.length > 0) {
                const teamIds = prevMatch.teamStats.map((ts) => ts.teamId);
                await prisma.match.update({
                    where: { id: match.id },
                    data: { teams: { connect: teamIds.map((id) => ({ id })) } },
                });

                for (const ts of prevMatch.teamStats) {
                    const newTeamStats = await prisma.teamStats.create({
                        data: {
                            teamId: ts.teamId,
                            matchId: match.id,
                            position: 0,
                            tournamentId,
                            ...(seasonId ? { seasonId } : {}),
                        },
                    });

                    const playerIds = ts.teamPlayerStats.map((tps) => tps.playerId);
                    if (playerIds.length > 0) {
                        await prisma.teamPlayerStats.createMany({
                            data: playerIds.map((playerId) => ({
                                playerId,
                                teamId: ts.teamId,
                                matchId: match.id,
                                teamStatsId: newTeamStats.id,
                                kills: 0,
                                present: false,
                                ...(seasonId ? { seasonId } : {}),
                            })),
                        });
                    }
                    teamCount++;
                }
            }

            createdMatches.push({ id: match.id, matchNumber: match.matchNumber });
        }

        const last = createdMatches[createdMatches.length - 1];
        const msg = createdMatches.length === 1
            ? `Match #${last.matchNumber} created`
            : `${createdMatches.length} matches created (#${createdMatches[0].matchNumber}–#${last.matchNumber})`;

        return SuccessResponse({
            data: last, // Return last created match for auto-selection
            message: msg,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create match", error });
    }
}
