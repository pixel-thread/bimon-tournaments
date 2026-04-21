import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { sendPush } from "@/lib/push";

/**
 * POST /api/squads/remove-member
 * Captain removes a member from their squad.
 * Body: { inviteId }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { inviteId } = body as { inviteId: string };

        if (!inviteId) {
            return ErrorResponse({ message: "inviteId is required", status: 400 });
        }

        const currentPlayerId = user.player.id;

        // Fetch invite with squad info
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
                                tournament: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!invite) {
            return ErrorResponse({ message: "Member not found", status: 404 });
        }

        // Must be captain
        if (invite.squad.captainId !== currentPlayerId) {
            return ErrorResponse({ message: "Only the squad leader can remove members", status: 403 });
        }

        // Cannot remove yourself (leader)
        if (invite.playerId === currentPlayerId) {
            return ErrorResponse({ message: "Captains cannot remove themselves — cancel the squad instead", status: 400 });
        }

        // Squad must be active (FORMING or FULL)
        if (!["FORMING", "FULL"].includes(invite.squad.status)) {
            return ErrorResponse({ message: "Cannot modify this squad", status: 400 });
        }

        const playerName = invite.player.displayName ?? invite.player.user.username;
        const squadName = invite.squad.name;
        const tournamentName = invite.squad.poll.tournament?.name ?? "tournament";
        const captainName = user.player.displayName;

        await prisma.$transaction(async (tx) => {
            // Remove the invite (delete it so the player can be re-invited or re-request)
            await tx.squadInvite.delete({
                where: { id: inviteId },
            });

            // If squad was FULL, set back to FORMING
            if (invite.squad.status === "FULL") {
                await tx.squad.update({
                    where: { id: invite.squadId },
                    data: { status: "FORMING" },
                });
            }

            // Notify the removed player
            await tx.notification.create({
                data: {
                    title: "🛡 Removed from Squad",
                    message: `${captainName} removed you from "${squadName}" for ${tournamentName}. Your ${invite.squad.entryFee} ${GAME.currency} reservation has been released.`,
                    type: "squad_removed",
                    userId: invite.player.user.id,
                    playerId: invite.playerId,
                    link: "/vote",
                },
            });
        });

        // Push notification
        sendPush(invite.playerId, {
            title: "🛡 Removed from Squad",
            body: `${captainName} removed you from "${squadName}" for ${tournamentName}. Your ${invite.squad.entryFee} ${GAME.currency} reservation has been released.`,
            url: "/vote",
        });

        return SuccessResponse({
            message: `${playerName} has been removed from the squad`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to remove member", error });
    }
}
