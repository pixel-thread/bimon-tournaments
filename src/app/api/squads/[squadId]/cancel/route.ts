import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { sendPush } from "@/lib/push";
import { debitWallet, getEmailByPlayerId } from "@/lib/wallet-service";
import { logSquadEventTx } from "@/lib/squad-audit";

/**
 * POST /api/squads/[squadId]/cancel
 * Captain cancels their squad. Fees were only reserved (released on cancel).
 * Same-day cancellation: 50% penalty deducted from captain's wallet.
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
                    select: {
                        scheduledDate: true,
                        tournament: { select: { name: true } },
                    },
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

        // Check if same-day cancellation (50% penalty)
        let isSameDay = false;
        const penalty = Math.floor(squad.entryFee / 2);
        if (squad.poll.scheduledDate && squad.entryFee > 0) {
            const matchDay = new Date(squad.poll.scheduledDate);
            const today = new Date();
            isSameDay = matchDay.toDateString() === today.toDateString();
        }

        // Cancel squad + notify members
        await prisma.$transaction(async (tx) => {
            await tx.squad.update({
                where: { id: squadId },
                data: { status: "CANCELLED" },
            });

            // Notify all accepted members (except captain)
            const otherMembers = squad.invites.filter((i) => i.playerId !== user.player!.id);
            const refundNote = isSameDay
                ? `Same-day penalty: ${penalty} ${GAME.currency} deducted from captain.`
                : `Your ${squad.entryFee} ${GAME.currency} reservation has been released.`;

            for (const inv of otherMembers) {
                await tx.notification.create({
                    data: {
                        title: "🛡 Squad Cancelled",
                        message: `${captainName} cancelled "${squad.name}" for ${tournamentName}. ${refundNote}`,
                        type: "squad_cancelled",
                        userId: inv.player.user.id,
                        playerId: inv.playerId,
                        link: "/vote",
                    },
                });
            }

            // Audit log for all members
            for (const inv of squad.invites) {
                await logSquadEventTx(tx, { squadId, playerId: inv.playerId, action: "SQUAD_CANCELLED", actorId: user.player!.id, details: `Captain cancelled squad` });
            }
        });

        // Same-day penalty: debit 50% from captain (wallet is separate service)
        if (isSameDay && penalty > 0) {
            try {
                const captainEmail = await getEmailByPlayerId(user.player.id);
                if (captainEmail) {
                    await debitWallet(
                        captainEmail,
                        penalty,
                        `Same-day cancellation penalty — "${squad.name}" for ${tournamentName}`,
                    );
                }
            } catch (err) {
                console.error("[squad-cancel] Failed to debit penalty:", err);
                // Don't block cancellation if penalty fails
            }
        }

        // Push notifications to all members
        const otherMembers = squad.invites.filter((i) => i.playerId !== user.player!.id);
        for (const inv of otherMembers) {
            sendPush(inv.playerId, {
                title: "🛡 Squad Cancelled",
                body: `${captainName} cancelled "${squad.name}" for ${tournamentName}.${isSameDay ? ` ${penalty} ${GAME.currency} penalty applied.` : ""}`,
                url: "/vote",
            });
        }

        return SuccessResponse({
            message: isSameDay
                ? `Squad "${squad.name}" cancelled. Same-day penalty: ${penalty} ${GAME.currency} deducted.`
                : `Squad "${squad.name}" cancelled. All reserved ${GAME.currency} has been released.`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to cancel squad", error });
    }
}
