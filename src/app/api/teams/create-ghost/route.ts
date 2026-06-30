import { prisma } from "@/lib/database";
import { requireSuperAdmin } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";

/**
 * POST /api/teams/create-ghost
 * Admin-only: Create a ghost team directly into an existing tournament/match.
 * Unlike create-ghost-team (squad-level), this creates a Team entity (post-generation).
 *
 * Body: {
 *   tournamentId: string,
 *   matchId: string,
 *   name: string,
 *   captainName: string,
 *   captainPhone: string,
 *   members: string[],   // array of member display names
 * }
 */
export async function POST(request: NextRequest) {
    try {
        await requireSuperAdmin();

        const body = await request.json();
        const { tournamentId, matchId, name, captainName, captainPhone, members = [] } = body as {
            tournamentId: string;
            matchId: string;
            name: string;
            captainName: string;
            captainPhone?: string;
            members: string[];
        };

        if (!tournamentId) return ErrorResponse({ message: "tournamentId required", status: 400 });
        if (!matchId) return ErrorResponse({ message: "matchId required", status: 400 });
        if (!name?.trim()) return ErrorResponse({ message: "Team name required", status: 400 });
        if (!captainName?.trim()) return ErrorResponse({ message: "Captain name required", status: 400 });

        const cleanName = name.trim().slice(0, 7);
        const cleanCaptainName = captainName.trim().slice(0, 20);
        const cleanPhone = captainPhone ? captainPhone.replace(/\D/g, "").slice(-10) : "";
        if (cleanPhone && cleanPhone.length !== 10) {
            return ErrorResponse({ message: "Captain phone must be 10 digits", status: 400 });
        }

        const cleanMembers = members.map(n => (n || "").trim().slice(0, 20)).filter(Boolean);

        // Verify tournament + match exist
        const [tournament, match] = await Promise.all([
            prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, seasonId: true, name: true } }),
            prisma.match.findUnique({ where: { id: matchId }, select: { id: true, tournamentId: true } }),
        ]);

        if (!tournament) return ErrorResponse({ message: "Tournament not found", status: 404 });
        if (!tournament.seasonId) return ErrorResponse({ message: "Tournament has no season", status: 400 });
        if (!match || match.tournamentId !== tournamentId) return ErrorResponse({ message: "Match not found for this tournament", status: 404 });

        const seasonId = tournament.seasonId;

        // Get next team number
        const maxTeam = await prisma.team.aggregate({
            where: { tournamentId },
            _max: { teamNumber: true },
        });
        const nextTeamNumber = (maxTeam._max.teamNumber ?? 0) + 1;

        const result = await prisma.$transaction(async (tx) => {
            // ─── Create ghost captain ───
            let captainPlayerId: string;

            if (cleanPhone) {
                // Phone provided: check for existing player by phone
                const existingPlayer = await tx.player.findFirst({
                    where: { phoneNumber: cleanPhone, isGhost: false },
                    select: { id: true, displayName: true },
                });

                if (existingPlayer) {
                    captainPlayerId = existingPlayer.id;
                } else {
                    const ghostClerkId = `ghost_phone_${cleanPhone}`;
                    let ghostUser = await tx.user.findFirst({ where: { clerkId: ghostClerkId } });
                    if (!ghostUser) {
                        ghostUser = await tx.user.create({
                            data: { clerkId: ghostClerkId, username: ghostClerkId, email: null },
                        });
                    }
                    let ghostPlayer = await tx.player.findFirst({ where: { userId: ghostUser.id } });
                    if (!ghostPlayer) {
                        ghostPlayer = await tx.player.create({
                            data: { userId: ghostUser.id, displayName: cleanCaptainName, phoneNumber: cleanPhone, isGhost: true },
                        });
                    } else {
                        await tx.player.update({
                            where: { id: ghostPlayer.id },
                            data: { displayName: cleanCaptainName, phoneNumber: cleanPhone },
                        });
                    }
                    captainPlayerId = ghostPlayer.id;
                }
            } else {
                // No phone: create anonymous ghost captain (same as members)
                const contactKey = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const ghostClerkId = `ghost_${contactKey}`;
                const ghostUser = await tx.user.create({
                    data: { clerkId: ghostClerkId, username: ghostClerkId, email: null },
                });
                const ghostPlayer = await tx.player.create({
                    data: { userId: ghostUser.id, displayName: cleanCaptainName, isGhost: true },
                });
                captainPlayerId = ghostPlayer.id;
            }

            // ─── Create ghost members ───
            const memberPlayerIds: string[] = [];
            for (const memberName of cleanMembers) {
                const contactKey = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const ghostClerkId = `ghost_${contactKey}`;
                const ghostUser = await tx.user.create({
                    data: { clerkId: ghostClerkId, username: ghostClerkId, email: null },
                });
                const ghostPlayer = await tx.player.create({
                    data: { userId: ghostUser.id, displayName: memberName, isGhost: true },
                });
                memberPlayerIds.push(ghostPlayer.id);
            }

            const allPlayerIds = [captainPlayerId, ...memberPlayerIds];

            // ─── Create Team ───
            const team = await tx.team.create({
                data: {
                    name: cleanName,
                    teamNumber: nextTeamNumber,
                    tournamentId,
                    seasonId: seasonId,
                    players: { connect: allPlayerIds.map(id => ({ id })) },
                    matches: { connect: { id: matchId } },
                },
                select: { id: true, name: true, teamNumber: true },
            });

            // ─── Create TeamStats ───
            await tx.teamStats.create({
                data: {
                    teamId: team.id,
                    matchId,
                    seasonId: seasonId,
                    tournamentId,
                },
            });

            // ─── Create MatchPlayerPlayed ───
            await tx.matchPlayerPlayed.createMany({
                data: allPlayerIds.map(playerId => ({
                    matchId,
                    playerId,
                    tournamentId,
                    seasonId: seasonId,
                    teamId: team.id,
                })),
            });

            // ─── Upsert PlayerStats ───
            for (const playerId of allPlayerIds) {
                await tx.playerStats.upsert({
                    where: { seasonId_playerId: { playerId, seasonId } },
                    create: { playerId, seasonId: seasonId, kills: 0, matches: 0, kd: 0 },
                    update: {},
                });
            }

            return { team, captainIsReal: false };
        });

        return SuccessResponse({
            data: result.team,
            message: `Ghost team "${cleanName}" (#${nextTeamNumber}) created with ${1 + cleanMembers.length} players 🎉`,
        });
    } catch (error) {
        console.error("Failed to create ghost team:", error);
        return ErrorResponse({ message: "Failed to create ghost team", error });
    }
}
