import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { sendPush } from "@/lib/push";

/**
 * POST /api/squads/[squadId]/cancel
 * Captain cancels their squad. No refunds needed — fees were only reserved.
 * Cancelled squad invites are automatically excluded from reserved balance.
 */
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ squadId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const { squadId } = await params;

        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            include: {
                invites: {
                    where: { status: "ACCEPTED" },
                    include: {
                        player: {
                            select: {
                                id: true,
                                displayName: true,
                                user: { select: { id: true, username: true } },
                            },
                        },
                    },
                },
                poll: {
                    select: { tournament: { select: { name: true } } },
                },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        if (squad.captainId !== user.player.id) {
            return ErrorResponse({ message: "Only the squad leader can cancel", status: 403 });
        }

        if (squad.status === "CANCELLED" || squad.status === "REGISTERED") {
            return ErrorResponse({
                message: `Cannot cancel — squad is already ${squad.status.toLowerCase()}`,
                status: 400,
            });
        }

        const tournamentName = squad.poll.tournament?.name ?? "tournament";
        const captainName = user.player.displayName;

        // Cancel squad + notify members
        await prisma.$transaction(async (tx) => {
            await tx.squad.update({
                where: { id: squadId },
                data: { status: "CANCELLED" },
            });

            // Notify all accepted members (except captain)
            const otherMembers = squad.invites.filter((i) => i.playerId !== user.player!.id);
            for (const inv of otherMembers) {
                await tx.notification.create({
                    data: {
                        title: "🛡 Squad Cancelled",
                        message: `${captainName} cancelled "${squad.name}" for ${tournamentName}. Your ${squad.entryFee} ${GAME.currency} reservation has been released.`,
                        type: "squad_cancelled",
                        userId: inv.player.user.id,
                        playerId: inv.playerId,
                        link: "/vote",
                    },
                });
            }
        });

        // Push notifications to all members
        const otherMembers = squad.invites.filter((i) => i.playerId !== user.player!.id);
        for (const inv of otherMembers) {
            sendPush(inv.playerId, {
                title: "🛡 Squad Cancelled",
                body: `${captainName} cancelled "${squad.name}" for ${tournamentName}. Your ${squad.entryFee} ${GAME.currency} reservation has been released.`,
                url: "/vote",
            });
        }

        return SuccessResponse({
            message: `Squad "${squad.name}" cancelled. All reserved ${GAME.currency} has been released.`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to cancel squad", error });
    }
}
