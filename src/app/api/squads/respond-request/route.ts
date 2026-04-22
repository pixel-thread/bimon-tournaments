import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { sendPush } from "@/lib/push";

/**
 * POST /api/squads/respond-request
 * Captain accepts or declines a player's join request.
 * Body: { inviteId, action: "ACCEPT" | "DECLINE" }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { inviteId, action } = body as { inviteId: string; action: "ACCEPT" | "DECLINE" };

        if (!inviteId || !["ACCEPT", "DECLINE"].includes(action)) {
            return ErrorResponse({ message: "inviteId and action (ACCEPT/DECLINE) are required", status: 400 });
        }

        const currentPlayerId = user.player.id;

        // Fetch the invite with squad info
        const invite = await prisma.squadInvite.findUnique({
            where: { id: inviteId },
            include: {
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { id: true, username: true } },
                    },
                },
                squad: {
                    include: {
                        poll: {
                            select: {
                                id: true,
                                isActive: true,
                                tournament: { select: { name: true } },
                            },
                        },
                        invites: { select: { status: true } },
                    },
                },
            },
        });

        if (!invite) {
            return ErrorResponse({ message: "Request not found", status: 404 });
        }

        // Must be captain of this squad
        if (invite.squad.captainId !== currentPlayerId) {
            return ErrorResponse({ message: "Only the squad leader can respond to join requests", status: 403 });
        }

        // Must be a player-initiated request
        if (invite.initiatedBy !== "PLAYER") {
            return ErrorResponse({ message: "This is a leader invite, not a join request", status: 400 });
        }

        // Must be PENDING
        if (invite.status !== "PENDING") {
            return ErrorResponse({ message: `This request has already been ${invite.status.toLowerCase()}`, status: 400 });
        }

        // Squad must be FORMING
        if (invite.squad.status !== "FORMING") {
            return ErrorResponse({
                message: invite.squad.status === "FULL" ? "Squad is already full" : "Squad is no longer active",
                status: 400,
            });
        }

        const playerName = invite.player.displayName ?? invite.player.user.username;
        const playerUserId = invite.player.user.id;
        const squadName = invite.squad.name;
        const tournamentName = invite.squad.poll.tournament?.name ?? "tournament";

        if (action === "ACCEPT") {
            // Check if squad is now full
            const acceptedCount = invite.squad.invites.filter((i) => i.status === "ACCEPTED").length + 1;
            const isFull = acceptedCount >= GAME.maxSquadSize;

            await prisma.$transaction(async (tx) => {
                await tx.squadInvite.update({
                    where: { id: inviteId },
                    data: { status: "ACCEPTED", respondedAt: new Date() },
                });

                if (isFull) {
                    await tx.squad.update({
                        where: { id: invite.squadId },
                        data: { status: "FULL" },
                    });
                }

                // Remove any existing poll vote — squad members are "on a team", not voters
                await tx.playerPollVote.deleteMany({
                    where: { pollId: invite.squad.poll.id, playerId: invite.playerId },
                });

                // Auto-decline all other PENDING requests/invites from this player for the same poll
                await tx.squadInvite.updateMany({
                    where: {
                        playerId: invite.playerId,
                        status: "PENDING",
                        id: { not: inviteId },
                        squad: {
                            pollId: invite.squad.poll.id,
                            status: { in: ["FORMING", "FULL"] },
                        },
                    },
                    data: { status: "DECLINED", respondedAt: new Date() },
                });

                // Notify the player
                await tx.notification.create({
                    data: {
                        title: isFull ? "🛡 Squad Complete!" : "🛡 Request Accepted!",
                        message: isFull
                            ? `You joined "${squadName}" — the squad is now full for ${tournamentName}! 🎉`
                            : `Your request to join "${squadName}" was accepted!`,
                        type: "squad_request_accepted",
                        userId: playerUserId,
                        playerId: invite.playerId,
                        link: "/vote",
                    },
                });
            });

            // Push notification
            const pushTitle = isFull ? "🛡 Squad Complete!" : "🛡 Request Accepted!";
            const pushBody = isFull
                ? `You joined "${squadName}" — the squad is now full for ${tournamentName}! 🎉`
                : `Your request to join "${squadName}" was accepted!`;
            sendPush(invite.playerId, { title: pushTitle, body: pushBody, url: "/vote" });

            return SuccessResponse({
                message: `${playerName} has been added to the squad!`,
            });
        }

        // DECLINE
        await prisma.$transaction(async (tx) => {
            await tx.squadInvite.update({
                where: { id: inviteId },
                data: { status: "DECLINED", respondedAt: new Date() },
            });

            // Notify the player
            await tx.notification.create({
                data: {
                    title: "🛡 Request Declined",
                    message: `Your request to join "${squadName}" was declined`,
                    type: "squad_request_declined",
                    userId: playerUserId,
                    playerId: invite.playerId,
                    link: "/vote",
                },
            });
        });

        // Push notification
        sendPush(invite.playerId, {
            title: "🛡 Request Declined",
            body: `Your request to join "${squadName}" was declined`,
            url: "/vote",
        });

        return SuccessResponse({ message: `Declined ${playerName}'s request` });
    } catch (error) {
        return ErrorResponse({ message: "Failed to respond to request", error });
    }
}
