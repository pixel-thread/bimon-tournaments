import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser, getAuthEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { sendPush } from "@/lib/push";

/**
 * POST /api/squads/request-join
 * Player requests to join an open squad. Captain must accept/decline.
 * Body: { squadId }
 */
export async function POST(request: NextRequest) {
    try {
        const email = await getAuthEmail();
        if (!email) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { squadId } = body as { squadId: string };

        if (!squadId) {
            return ErrorResponse({ message: "squadId is required", status: 400 });
        }

        const playerId = user.player.id;

        // Fetch squad
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            include: {
                captain: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { id: true, username: true } },
                    },
                },
                poll: {
                    select: {
                        id: true,
                        isActive: true,
                        allowSquads: true,
                        tournament: { select: { name: true, fee: true } },
                    },
                },
                invites: { select: { playerId: true, status: true } },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        // Cannot join your own squad via request
        if (squad.captainId === playerId) {
            return ErrorResponse({ message: "You are the leader of this squad", status: 400 });
        }

        // Poll must be active and allow squads
        if (!squad.poll.isActive) {
            return ErrorResponse({ message: "This poll is no longer active", status: 400 });
        }

        if (!squad.poll.allowSquads) {
            return ErrorResponse({ message: "Squads are not enabled for this tournament", status: 400 });
        }

        // Squad must be active (FORMING or FULL — status can be stale after member leaves)
        if (!["FORMING", "FULL"].includes(squad.status)) {
            return ErrorResponse({
                message: "This squad is no longer active",
                status: 400,
            });
        }

        // Squad not full
        const acceptedCount = squad.invites.filter((i) => i.status === "ACCEPTED").length;
        if (acceptedCount >= GAME.maxSquadSize) {
            return ErrorResponse({ message: "Squad is already full", status: 400 });
        }

        // Not already invited or requested
        const existingInvite = squad.invites.find((i) => i.playerId === playerId);
        if (existingInvite && existingInvite.status !== "DECLINED") {
            return ErrorResponse({ message: "You already have a pending invite or are already in this squad", status: 400 });
        }

        // Block if already accepted into another squad for this poll
        // (PENDING requests to other squads are allowed — they'll be cleaned up on accept)
        const inOtherSquad = await prisma.squadInvite.findFirst({
            where: {
                playerId,
                status: "ACCEPTED",
                squad: {
                    pollId: squad.poll.id,
                    status: { in: ["FORMING", "FULL"] },
                    id: { not: squadId },
                },
            },
        });

        if (inOtherSquad) {
            return ErrorResponse({ message: "You're already in another squad for this tournament", status: 400 });
        }

        // Note: No balance check for joiners. The leader pays the full team entry fee.

        const playerName = user.player.displayName;
        const tournamentName = squad.poll.tournament?.name ?? "tournament";

        // Create join request + remove individual vote + notify captain
        await prisma.$transaction(async (tx) => {
            if (existingInvite) {
                // Re-request after a decline
                await tx.squadInvite.updateMany({
                    where: { squadId, playerId },
                    data: { status: "PENDING", initiatedBy: "PLAYER", respondedAt: null },
                });
            } else {
                await tx.squadInvite.create({
                    data: {
                        squadId,
                        playerId,
                        initiatedBy: "PLAYER",
                    },
                });
            }

            // Remove individual poll vote — player is now in a squad request
            await tx.playerPollVote.deleteMany({
                where: { playerId, pollId: squad.poll.id },
            });

            // Notify captain
            await tx.notification.create({
                data: {
                    title: "🛡 Join Request",
                    message: `${playerName} wants to join "${squad.name}" for ${tournamentName}`,
                    type: "squad_request",
                    userId: squad.captain.user.id,
                    playerId: squad.captain.id,
                    link: "/vote",
                },
            });
        });

        // Push notification
        sendPush(squad.captain.id, {
            title: "🛡 Join Request",
            body: `${playerName} wants to join "${squad.name}" for ${tournamentName}`,
            url: "/notifications",
        });

        return SuccessResponse({
            message: `Request sent to ${squad.captain.displayName ?? squad.captain.user.username}! They'll review your request.`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to send join request", error });
    }
}
