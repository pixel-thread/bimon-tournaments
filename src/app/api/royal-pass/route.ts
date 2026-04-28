import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { GAME } from "@/lib/game-config";

/**
 * GET /api/royal-pass
 * Fetches Royal Pass status for the current user's player.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const player = await prisma.player.findUnique({
            where: { userId: user.id },
            include: {
                streak: true,
                pendingRewards: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
            },
        });

        if (!player) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }

        const settings = await getSettings();
        const hasRoyalPass = player.hasRoyalPass ?? false;
        const currentStreak = player.streak?.current ?? 0;
        const nextRewardAt = settings.streakMilestone;

        const data = {
            hasRoyalPass,
            currentStreak,
            nextRewardAt,
            totalRewards: player.pendingRewards.filter((r) => r.isClaimed).length,
            pendingRewards: player.pendingRewards.map((r) => ({
                id: r.id,
                type: r.type,
                amount: r.amount,
                isPending: !r.isClaimed,
                createdAt: r.createdAt,
            })),
        };

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({
            message: `Failed to fetch ${GAME.passName}`,
            error,
        });
    }
}
