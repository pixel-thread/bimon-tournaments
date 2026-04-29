import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * GET /api/notifications
 * Fetches the current user's notifications from the last 7 days + unread count + pending UC requests + unclaimed rewards.
 */
export async function GET() {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { id: true, player: { select: { id: true } } },
        });

        if (!user) {
            return ErrorResponse({ message: "User not found", status: 404 });
        }

        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [notifications, unreadCount, pendingRequests, unclaimedRewards, pendingSquadRequests, pendingSquadInviteCount] = await Promise.all([
            prisma.notification.findMany({
                where: {
                    userId: user.id,
                    createdAt: { gte: oneWeekAgo },
                },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma.notification.count({
                where: {
                    userId: user.id,
                    isRead: false,
                    createdAt: { gte: oneWeekAgo },
                },
            }),
            // Fetch pending UC requests where this player is the recipient (toPlayer)
            user.player
                ? prisma.uCTransfer.findMany({
                    where: {
                        toPlayerId: user.player.id,
                        type: "REQUEST",
                        status: "PENDING",
                    },
                    include: {
                        fromPlayer: {
                            select: {
                                id: true,
                                displayName: true,
                                wallet: { select: { balance: true } },
                                user: { select: { username: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                })
                : [],
            // Fetch unclaimed rewards for this player (exclude STREAK — claimed from RP page)
            user.player
                ? prisma.pendingReward.findMany({
                    where: {
                        playerId: user.player.id,
                        isClaimed: false,
                        type: { not: "STREAK" },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                })
                : [],
            // Fetch pending squad join requests where this player is captain
            (user.player && GAME.features.hasSquads)
                ? prisma.squadInvite.findMany({
                    where: {
                        initiatedBy: "PLAYER",
                        status: "PENDING",
                        squad: {
                            captainId: user.player.id,
                            status: { in: ["FORMING", "FULL"] },
                        },
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
                        squad: {
                            select: {
                                id: true,
                                name: true,
                                poll: {
                                    select: {
                                        tournament: { select: { name: true } },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                })
                : [],
            // Count pending captain-initiated squad invites for this player (for Vote tab dot)
            (user.player && GAME.features.hasSquads)
                ? prisma.squadInvite.count({
                    where: {
                        playerId: user.player.id,
                        initiatedBy: "CAPTAIN",
                        status: "PENDING",
                        squad: {
                            status: { in: ["FORMING", "FULL"] },
                            poll: { isActive: true },
                        },
                    },
                })
                : 0,
        ]);

        // Separate check: does the player have an unclaimed STREAK reward? (for RP page badge)
        const hasUnclaimedStreakReward = user.player
            ? (await prisma.pendingReward.count({
                where: { playerId: user.player.id, type: "STREAK", isClaimed: false },
            })) > 0
            : false;

        return SuccessResponse({
            data: { notifications, unreadCount, pendingRequests, unclaimedRewards, pendingSquadRequests, pendingSquadInviteCount, hasUnclaimedStreakReward },
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return ErrorResponse({ message: "Failed to fetch notifications" });
    }
}
