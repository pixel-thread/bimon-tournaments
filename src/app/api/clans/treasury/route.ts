import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * GET /api/clans/treasury
 * Returns clan balance, pending withdrawal requests, and recent transactions.
 * All members see balance + their own requests.
 * Leaders/Co-Leaders see ALL pending requests.
 */
export async function GET() {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const playerId = user.player.id;

        const membership = await prisma.clanMember.findUnique({
            where: { playerId },
            include: {
                clan: {
                    select: {
                        id: true,
                        balance: true,
                        showTreasuryPublic: true,
                    },
                },
            },
        });
        if (!membership) {
            return ErrorResponse({ message: `You are not in a ${GAME.clanLabel.toLowerCase()}`, status: 400 });
        }

        const clan = membership.clan;
        const isLeaderOrCoLeader = membership.role === "LEADER" || membership.role === "CO_LEADER";

        // Fetch pending requests + recent transactions in parallel
        const [pendingRequests, recentTransactions] = await Promise.all([
            // Leaders/Co-Leaders see all pending; members see only their own
            prisma.clanWithdrawRequest.findMany({
                where: {
                    clanId: clan.id,
                    status: "PENDING",
                    ...(isLeaderOrCoLeader ? {} : { playerId }),
                },
                include: {
                    player: {
                        select: {
                            id: true,
                            displayName: true,
                            customProfileImageUrl: true,
                            user: { select: { username: true, imageUrl: true } },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.clanTransaction.findMany({
                where: { clanId: clan.id },
                include: {
                    player: {
                        select: {
                            displayName: true,
                            user: { select: { username: true } },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: 30,
            }),
        ]);

        return SuccessResponse({
            data: {
                balance: clan.balance,
                showTreasuryPublic: clan.showTreasuryPublic,
                isLeaderOrCoLeader,
                pendingRequests: pendingRequests.map((r) => ({
                    id: r.id,
                    amount: r.amount,
                    message: r.message,
                    requestType: (r as any).requestType ?? "WITHDRAW",
                    createdAt: r.createdAt,
                    player: {
                        id: r.player.id,
                        displayName: r.player.displayName || r.player.user.username,
                        imageUrl: r.player.customProfileImageUrl || r.player.user.imageUrl,
                    },
                })),
                transactions: recentTransactions.map((t) => ({
                    id: t.id,
                    amount: t.amount,
                    type: t.type,
                    description: t.description,
                    createdAt: t.createdAt,
                    playerName: t.player.displayName || t.player.user.username,
                })),
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch treasury", error });
    }
}
