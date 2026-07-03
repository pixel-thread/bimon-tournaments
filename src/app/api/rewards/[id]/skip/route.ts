import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";

/**
 * DELETE /api/rewards/[id]/skip
 * Admin-only: Skip (void) a pending reward without crediting the player.
 * Marks it as claimed so it disappears from the player's action center.
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAdmin();
        const { id } = await params;

        const reward = await prisma.pendingReward.findUnique({
            where: { id },
            include: { player: { select: { displayName: true } } },
        });

        if (!reward) {
            return ErrorResponse({ message: "Reward not found", status: 404 });
        }

        if (reward.isClaimed) {
            return ErrorResponse({ message: "Reward already claimed", status: 400 });
        }

        // Mark as claimed (skipped) without crediting — effectively voiding it
        await prisma.pendingReward.update({
            where: { id },
            data: {
                isClaimed: true,
                claimedAt: new Date(),
                message: `${reward.message || ""} [SKIPPED BY ADMIN]`.trim(),
            },
        });

        return SuccessResponse({
            message: `Reward skipped for ${reward.player?.displayName || "player"}`,
            data: { rewardId: id },
        });
    } catch (error) {
        console.error("Error skipping reward:", error);
        return ErrorResponse({ message: "Failed to skip reward" });
    }
}
