import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/treasury/withdraw-request
 * Any clan member can request a withdrawal from the clan treasury.
 * Requires Leader/Co-Leader approval before funds are released.
 */
export async function POST(request: Request) {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const playerId = user.player.id;

        const body = await request.json();
        const amount = Number(body.amount);
        const message = typeof body.message === "string" ? body.message.trim().slice(0, 200) : undefined;

        if (!amount || amount <= 0 || !Number.isInteger(amount)) {
            return ErrorResponse({ message: "Amount must be a positive whole number", status: 400 });
        }

        // Check clan membership
        const membership = await prisma.clanMember.findUnique({
            where: { playerId },
            include: { clan: { select: { id: true, balance: true } } },
        });
        if (!membership) {
            return ErrorResponse({ message: `You are not in a ${GAME.clanLabel.toLowerCase()}`, status: 400 });
        }

        // Check clan has enough balance
        if (membership.clan.balance < amount) {
            return ErrorResponse({
                message: `Insufficient treasury balance. Treasury has ${membership.clan.balance} ${GAME.currency}.`,
                status: 400,
            });
        }

        // Check for existing pending request from same player
        const existingPending = await prisma.clanWithdrawRequest.findFirst({
            where: { clanId: membership.clanId, playerId, status: "PENDING" },
        });
        if (existingPending) {
            return ErrorResponse({
                message: "You already have a pending withdrawal request. Wait for it to be reviewed.",
                status: 400,
            });
        }

        // Create withdrawal request
        await prisma.clanWithdrawRequest.create({
            data: {
                clanId: membership.clanId,
                playerId,
                amount,
                message: message || null,
            },
        });

        return SuccessResponse({ message: `Withdrawal request for ${amount} ${GAME.currency} submitted`, status: 201 });
    } catch (error) {
        return ErrorResponse({ message: "Failed to create withdrawal request", error });
    }
}
