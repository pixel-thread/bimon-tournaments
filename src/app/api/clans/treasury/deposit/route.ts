import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { getAvailableBalance } from "@/lib/wallet-service";

/**
 * POST /api/clans/treasury/deposit
 * Any clan member can deposit BP from their personal wallet into the clan treasury.
 */
export async function POST(request: Request) {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true, displayName: true, user: { select: { username: true } } } } },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const playerId = user.player.id;
        const playerName = user.player.displayName || user.player.user.username;

        const body = await request.json();
        const amount = Number(body.amount);

        if (!amount || amount <= 0 || !Number.isInteger(amount)) {
            return ErrorResponse({ message: "Amount must be a positive whole number", status: 400 });
        }

        // Check clan membership
        const membership = await prisma.clanMember.findUnique({
            where: { playerId },
        });
        if (!membership) {
            return ErrorResponse({ message: `You are not in a ${GAME.clanLabel.toLowerCase()}`, status: 400 });
        }

        // Check available balance
        const { available } = await getAvailableBalance(email);
        if (available < amount) {
            return ErrorResponse({ message: `Insufficient balance. You have ${available} ${GAME.currency} available.`, status: 400 });
        }

        // Atomic transaction: debit player wallet + credit clan balance + log
        await prisma.$transaction([
            // Debit player wallet
            prisma.wallet.update({
                where: { playerId },
                data: { balance: { decrement: amount } },
            }),
            // Record player transaction
            prisma.transaction.create({
                data: {
                    playerId,
                    amount,
                    type: "DEBIT",
                    description: `Deposited to ${GAME.clanLabel.toLowerCase()} treasury`,
                },
            }),
            // Credit clan balance
            prisma.clan.update({
                where: { id: membership.clanId },
                data: { balance: { increment: amount } },
            }),
            // Record clan transaction
            prisma.clanTransaction.create({
                data: {
                    clanId: membership.clanId,
                    playerId,
                    amount,
                    type: "CREDIT",
                    description: `${playerName} deposited ${amount} ${GAME.currency}`,
                },
            }),
        ]);

        return SuccessResponse({ message: `Deposited ${amount} ${GAME.currency} to treasury` });
    } catch (error) {
        return ErrorResponse({ message: "Failed to deposit", error });
    }
}
