import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";

/**
 * GET /api/clans/pending-count
 * Returns the count of pending clan invites for the current player.
 * Used for the red dot notification chain.
 */
export async function GET() {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) {
            return SuccessResponse({ data: { count: 0 }, cache: CACHE.NONE });
        }

        const count = await prisma.clanInvite.count({
            where: { playerId: user.player.id, status: "PENDING" },
        });

        return SuccessResponse({ data: { count }, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch pending count", error });
    }
}
