import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/kick
 * Leader kicks a member from the clan.
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
        const { targetPlayerId } = (await request.json()) as { targetPlayerId?: string };

        if (!targetPlayerId) {
            return ErrorResponse({ message: "Target player ID is required", status: 400 });
        }

        // Verify caller is a clan leader
        const clan = await prisma.clan.findUnique({
            where: { leaderId: playerId },
        });
        if (!clan) {
            return ErrorResponse({
                message: `You are not a ${GAME.clanLabel.toLowerCase()} leader`,
                status: 403,
            });
        }

        // Can't kick yourself
        if (targetPlayerId === playerId) {
            return ErrorResponse({ message: "Cannot kick yourself", status: 400 });
        }

        // Find the target's membership in this clan
        const targetMembership = await prisma.clanMember.findFirst({
            where: { clanId: clan.id, playerId: targetPlayerId },
        });
        if (!targetMembership) {
            return ErrorResponse({
                message: `This player is not in your ${GAME.clanLabel.toLowerCase()}`,
                status: 400,
            });
        }

        await prisma.clanMember.delete({ where: { id: targetMembership.id } });

        return SuccessResponse({ data: { kicked: targetPlayerId } });
    } catch (error) {
        return ErrorResponse({ message: "Failed to kick member", error });
    }
}
