import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/squads/my-subscriptions
 * Returns all captains this player has auto-accept enabled for.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const subs = await prisma.playerAutoAccept.findMany({
            where: { playerId: user.player.id },
            select: {
                captainId: true,
                captain: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        const data = subs.map((s) => ({
            captainId: s.captainId,
            displayName: s.captain.displayName ?? s.captain.user.username,
            imageUrl: s.captain.user.imageUrl,
        }));

        return SuccessResponse({ data });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch subscriptions", error });
    }
}
