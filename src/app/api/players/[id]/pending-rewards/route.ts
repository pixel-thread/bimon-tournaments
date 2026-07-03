import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/players/[id]/pending-rewards
 * Admin-only: Fetch all unclaimed rewards for a player.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAdmin();
        const { id } = await params;

        const rewards = await prisma.pendingReward.findMany({
            where: { playerId: id, isClaimed: false },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                type: true,
                amount: true,
                diamondAmount: true,
                message: true,
                createdAt: true,
            },
        });

        return SuccessResponse({ data: rewards });
    } catch (error) {
        console.error("Error fetching pending rewards:", error);
        return ErrorResponse({ message: "Failed to fetch" });
    }
}
