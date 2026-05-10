import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/treasury/review
 * Leader or Co-Leader approves/rejects a withdrawal request.
 * On approval: debit clan balance → credit player wallet → log transaction.
 */
export async function POST(request: Request) {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: {
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { username: true } },
                    },
                },
            },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const reviewerId = user.player.id;
        const reviewerName = user.player.displayName || user.player.user.username;

        const body = await request.json();
        const { requestId, action, note } = body as {
            requestId: string;
            action: "APPROVE" | "REJECT";
            note?: string;
        };

        if (!requestId || !["APPROVE", "REJECT"].includes(action)) {
            return ErrorResponse({ message: "Missing requestId or invalid action", status: 400 });
        }

        // Verify reviewer is Leader/Co-Leader of the same clan
        const membership = await prisma.clanMember.findUnique({
            where: { playerId: reviewerId },
        });
        if (!membership || (membership.role !== "LEADER" && membership.role !== "CO_LEADER")) {
            return ErrorResponse({ message: "Only Leader or Co-Leader can review requests", status: 403 });
        }

        // Find the pending request
        const withdrawRequest = await prisma.clanWithdrawRequest.findFirst({
            where: { id: requestId, clanId: membership.clanId, status: "PENDING" },
            include: {
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { username: true, email: true } },
                    },
                },
                clan: { select: { balance: true } },
            },
        });
        if (!withdrawRequest) {
            return ErrorResponse({ message: "Request not found or already reviewed", status: 404 });
        }

        const requesterName = withdrawRequest.player.displayName || withdrawRequest.player.user.username;

        if (action === "REJECT") {
            await prisma.clanWithdrawRequest.update({
                where: { id: requestId },
                data: {
                    status: "REJECTED",
                    reviewerId,
                    reviewNote: note?.trim()?.slice(0, 200) || null,
                    reviewedAt: new Date(),
                },
            });
            return SuccessResponse({ message: "Request rejected" });
        }

        // APPROVE — check clan still has enough balance
        if (withdrawRequest.clan.balance < withdrawRequest.amount) {
            return ErrorResponse({
                message: `Insufficient treasury balance. Treasury has ${withdrawRequest.clan.balance} ${GAME.currency}.`,
                status: 400,
            });
        }

        // Atomic: debit clan + credit player wallet + log transaction + update request
        await prisma.$transaction([
            // Debit clan balance
            prisma.clan.update({
                where: { id: membership.clanId },
                data: { balance: { decrement: withdrawRequest.amount } },
            }),
            // Credit player wallet
            prisma.wallet.upsert({
                where: { playerId: withdrawRequest.playerId },
                create: { playerId: withdrawRequest.playerId, balance: withdrawRequest.amount },
                update: { balance: { increment: withdrawRequest.amount } },
            }),
            // Record player credit transaction
            prisma.transaction.create({
                data: {
                    playerId: withdrawRequest.playerId,
                    amount: withdrawRequest.amount,
                    type: "CREDIT",
                    description: `Withdrawn from ${GAME.clanLabel.toLowerCase()} treasury (approved by ${reviewerName})`,
                },
            }),
            // Record clan debit transaction
            prisma.clanTransaction.create({
                data: {
                    clanId: membership.clanId,
                    playerId: withdrawRequest.playerId,
                    amount: withdrawRequest.amount,
                    type: "DEBIT",
                    description: `${requesterName} withdrew ${withdrawRequest.amount} ${GAME.currency} (approved by ${reviewerName})`,
                },
            }),
            // Update request status
            prisma.clanWithdrawRequest.update({
                where: { id: requestId },
                data: {
                    status: "APPROVED",
                    reviewerId,
                    reviewNote: note?.trim()?.slice(0, 200) || null,
                    reviewedAt: new Date(),
                },
            }),
        ]);

        return SuccessResponse({ message: `Approved — ${withdrawRequest.amount} ${GAME.currency} transferred to ${requesterName}` });
    } catch (error) {
        return ErrorResponse({ message: "Failed to review request", error });
    }
}
