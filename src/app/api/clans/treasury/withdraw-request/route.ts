import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/treasury/withdraw-request
 * - Leader / Co-Leader: instant withdraw (debit clan → credit personal wallet).
 * - Regular member: creates a pending ClanWithdrawRequest for approval.
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
        const message = typeof body.message === "string" ? body.message.trim().slice(0, 200) : undefined;

        if (!amount || amount <= 0 || !Number.isInteger(amount)) {
            return ErrorResponse({ message: "Amount must be a positive whole number", status: 400 });
        }

        // Check clan membership (also check if player is leader via Clan.leaderId)
        const membership = await prisma.clanMember.findUnique({
            where: { playerId },
            include: { clan: { select: { id: true, balance: true } } },
        });

        let clanId: string | null = membership?.clanId ?? null;
        let clanBalance = membership?.clan.balance ?? 0;
        let role: string = membership?.role ?? "MEMBER";

        if (!membership) {
            // Leader might not be in ClanMember — check Clan.leaderId
            const ownedClan = await prisma.clan.findUnique({
                where: { leaderId: playerId },
                select: { id: true, balance: true },
            });
            if (ownedClan) {
                clanId = ownedClan.id;
                clanBalance = ownedClan.balance;
                role = "LEADER";
            }
        }

        if (!clanId) {
            return ErrorResponse({ message: `You are not in a ${GAME.clanLabel.toLowerCase()}`, status: 400 });
        }

        // Check clan has enough balance
        if (clanBalance < amount) {
            return ErrorResponse({
                message: `Insufficient treasury balance. Treasury has ${clanBalance} ${GAME.currency}.`,
                status: 400,
            });
        }

        const isLeaderOrCoLeader = role === "LEADER" || role === "CO_LEADER";

        // ── Leader / Co-Leader: instant withdraw ──
        if (isLeaderOrCoLeader) {
            await prisma.$transaction([
                // Debit clan balance
                prisma.clan.update({
                    where: { id: clanId },
                    data: { balance: { decrement: amount } },
                }),
                // Credit player wallet
                prisma.wallet.upsert({
                    where: { playerId },
                    create: { playerId, balance: amount },
                    update: { balance: { increment: amount } },
                }),
                // Record player credit transaction
                prisma.transaction.create({
                    data: {
                        playerId,
                        amount,
                        type: "CREDIT",
                        description: `Withdrawn from ${GAME.clanLabel.toLowerCase()} treasury`,
                    },
                }),
                // Record clan debit transaction
                prisma.clanTransaction.create({
                    data: {
                        clanId,
                        playerId,
                        amount,
                        type: "DEBIT",
                        description: `${playerName} withdrew ${amount} ${GAME.currency}`,
                    },
                }),
            ]);

            return SuccessResponse({ message: `${amount} ${GAME.currency} withdrawn to your wallet` });
        }

        // ── Regular member: create pending request ──
        const existingPending = await prisma.clanWithdrawRequest.findFirst({
            where: { clanId, playerId, status: "PENDING" },
        });
        if (existingPending) {
            return ErrorResponse({
                message: "You already have a pending withdrawal request. Wait for it to be reviewed.",
                status: 400,
            });
        }

        await prisma.clanWithdrawRequest.create({
            data: {
                clanId,
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
