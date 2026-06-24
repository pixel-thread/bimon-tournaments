import { prisma } from "@/lib/database";
import { requireSuperAdmin } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { type NextRequest } from "next/server";

/**
 * POST /api/teams/[teamId]/add-ghost
 * Admin-only: Add a ghost player to an existing team.
 * Creates a ghost User + Player and connects them to the team + its matches.
 *
 * Body: { name: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        await requireSuperAdmin();
        const { teamId } = await params;
        const { name } = await request.json();

        if (!name?.trim()) {
            return ErrorResponse({ message: "Player name is required", status: 400 });
        }

        const trimmedName = name.trim().slice(0, 20);

        // Verify team exists and get its tournament/season/matches
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: {
                id: true,
                tournamentId: true,
                seasonId: true,
                matches: { select: { id: true } },
            },
        });

        if (!team) {
            return ErrorResponse({ message: "Team not found", status: 404 });
        }
        if (!team.tournamentId || !team.seasonId) {
            return ErrorResponse({ message: "Team missing tournament/season", status: 400 });
        }

        const { tournamentId, seasonId } = team;

        const result = await prisma.$transaction(async (tx) => {
            // Create ghost user + player
            const contactKey = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const ghostClerkId = `ghost_${contactKey}`;

            const ghostUser = await tx.user.create({
                data: { clerkId: ghostClerkId, username: ghostClerkId, email: null },
            });

            const ghostPlayer = await tx.player.create({
                data: {
                    userId: ghostUser.id,
                    displayName: trimmedName,
                    isGhost: true,
                },
            });

            // Connect to team
            await tx.team.update({
                where: { id: teamId },
                data: { players: { connect: { id: ghostPlayer.id } } },
            });

            // Connect to all matches the team is in
            for (const match of team.matches) {
                // Connect player to match
                await tx.player.update({
                    where: { id: ghostPlayer.id },
                    data: { matches: { connect: { id: match.id } } },
                });

                // Create MatchPlayerPlayed
                await tx.matchPlayerPlayed.create({
                    data: {
                        matchId: match.id,
                        playerId: ghostPlayer.id,
                        tournamentId,
                        seasonId,
                        teamId,
                    },
                });
            }

            // Upsert PlayerStats
            await tx.playerStats.upsert({
                where: {
                    seasonId_playerId: {
                        playerId: ghostPlayer.id,
                        seasonId,
                    },
                },
                create: {
                    playerId: ghostPlayer.id,
                    seasonId,
                    kills: 0,
                    matches: 0,
                    kd: 0,
                },
                update: {},
            });

            return {
                playerId: ghostPlayer.id,
                displayName: trimmedName,
            };
        });

        return SuccessResponse({
            data: result,
            message: `Ghost player "${trimmedName}" added to team`,
        });
    } catch (error) {
        console.error("Failed to add ghost player:", error);
        return ErrorResponse({ message: "Failed to add ghost player", error });
    }
}
