import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/leave
 * Leave or disband a clan.
 * - If leader: deletes the entire clan (members, invites).
 * - If member: removes own ClanMember record.
 */
export async function POST() {
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
            include: { clan: { select: { id: true, leaderId: true, name: true } } },
        });
        if (!membership) {
            return ErrorResponse({
                message: `You are not in a ${GAME.clanLabel.toLowerCase()}`,
                status: 400,
            });
        }

        const isLeader = membership.clan.leaderId === playerId;

        if (isLeader) {
            // Disband: delete entire clan (cascades to members + invites)
            await prisma.clan.delete({ where: { id: membership.clanId } });
            return SuccessResponse({
                data: { action: "DISBANDED", clanName: membership.clan.name },
            });
        } else {
            // Leave: remove own membership
            await prisma.clanMember.delete({ where: { playerId } });
            return SuccessResponse({
                data: { action: "LEFT", clanName: membership.clan.name },
            });
        }
    } catch (error) {
        return ErrorResponse({ message: `Failed to leave ${GAME.clanLabel.toLowerCase()}`, error });
    }
}
