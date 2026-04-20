import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { sendPush } from "@/lib/push";

/**
 * POST /api/squads/respond
 * Accept or decline a squad invite.
 * Body: { inviteId, action: "ACCEPT" | "DECLINE" }
 *
 * On ACCEPT: Fee is RESERVED (via wallet-service reserved balance), not deducted.
 * On DECLINE: Notify captain.
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

        const playerId = user.player.id;

        // Fetch the invite with squad info
        const invite = await prisma.squadInvite.findUnique({
            where: { id: inviteId },
            include: {
                squad: {
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
                                tournament: { select: { name: true } },
                            },
                        },
                        invites: { select: { status: true } },
                    },
                },
            },
        });

        if (!invite) {
            return ErrorResponse({ message: "Invite not found", status: 404 });
        }

        // Must be the invitee
        if (invite.playerId !== playerId) {
            return ErrorResponse({ message: "This invite is not for you", status: 403 });
        }

        // Must be PENDING
        if (invite.status !== "PENDING") {
            return ErrorResponse({ message: `This invite has already been ${invite.status.toLowerCase()}`, status: 400 });
        }

        // Poll must still be active
        if (!invite.squad.poll.isActive) {
            return ErrorResponse({ message: "This poll is no longer active", status: 400 });
        }

        // Squad must be in FORMING state
        if (invite.squad.status !== "FORMING") {
            return ErrorResponse({
                message: invite.squad.status === "FULL" ? "This squad is already full" : "This squad is no longer active",
                status: 400,
            });
        }

        const playerName = user.player.displayName;
        const squadName = invite.squad.name;
        const captainUserId = invite.squad.captain.user.id;
        const captainPlayerId = invite.squad.captain.id;
        const tournamentName = invite.squad.poll.tournament?.name ?? "tournament";

        if (action === "ACCEPT") {
            // Count accepted invites (including this one now)
            const acceptedCount = invite.squad.invites.filter((i) => i.status === "ACCEPTED").length + 1;
            const isFull = acceptedCount >= GAME.maxSquadSize;

            // Mark accepted + check if squad is now full
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

                // Notify captain
                await tx.notification.create({
                    data: {
                        title: isFull ? "🛡 Squad Complete!" : "🛡 Invite Accepted",
                        message: isFull
                            ? `${playerName} joined "${squadName}" — your squad is now full for ${tournamentName}! 🎉`
                            : `${playerName} accepted your invite to "${squadName}"`,
                        type: "squad_accept",
                        userId: captainUserId,
                        playerId: captainPlayerId,
                        link: "/vote",
                    },
                });
            });

            // Push notification (outside transaction)
            const pushTitle = isFull ? "🛡 Squad Complete!" : "🛡 Invite Accepted";
            const pushBody = isFull
                ? `${playerName} joined "${squadName}" — your squad is now full for ${tournamentName}! 🎉`
                : `${playerName} accepted your invite to "${squadName}"`;
            sendPush(captainPlayerId, { title: pushTitle, body: pushBody, url: "/vote" });

            return SuccessResponse({
                message: `You joined "${squadName}"!`,
            });
        }

        // DECLINE
        await prisma.$transaction(async (tx) => {
            await tx.squadInvite.update({
                where: { id: inviteId },
                data: { status: "DECLINED", respondedAt: new Date() },
            });

            // Notify captain
            await tx.notification.create({
                data: {
                    title: "🛡 Invite Declined",
                    message: `${playerName} declined your invite to "${squadName}"`,
                    type: "squad_decline",
                    userId: captainUserId,
                    playerId: captainPlayerId,
                    link: "/vote",
                },
            });
        });

        // Push notification
        sendPush(captainPlayerId, {
            title: "🛡 Invite Declined",
            body: `${playerName} declined your invite to "${squadName}"`,
            url: "/vote",
        });

        return SuccessResponse({ message: `Declined invite to "${squadName}"` });
    } catch (error) {
        return ErrorResponse({ message: "Failed to respond to invite", error });
    }
}
