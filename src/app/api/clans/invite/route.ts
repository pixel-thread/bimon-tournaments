import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/invite
 * Leader invites a player to their clan.
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

        // Check caller is a clan leader
        const clan = await prisma.clan.findUnique({
            where: { leaderId: playerId },
        });
        if (!clan) {
            return ErrorResponse({ message: `You are not a ${GAME.clanLabel.toLowerCase()} leader`, status: 403 });
        }

        // Check target player exists
        const targetPlayer = await prisma.player.findUnique({
            where: { id: targetPlayerId },
            select: { id: true, isBanned: true },
        });
        if (!targetPlayer) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }
        if (targetPlayer.isBanned) {
            return ErrorResponse({ message: "Cannot invite a banned player", status: 400 });
        }

        // Check target is not already in a clan
        const targetMembership = await prisma.clanMember.findUnique({
            where: { playerId: targetPlayerId },
        });
        if (targetMembership) {
            return ErrorResponse({
                message: `This player is already in a ${GAME.clanLabel.toLowerCase()}`,
                status: 400,
            });
        }

        // Check for existing pending invite
        const existingInvite = await prisma.clanInvite.findUnique({
            where: { clanId_playerId: { clanId: clan.id, playerId: targetPlayerId } },
        });
        if (existingInvite?.status === "PENDING") {
            return ErrorResponse({ message: "Already invited this player", status: 400 });
        }

        // Upsert invite (handles the case where a previous invite was declined)
        const invite = await prisma.clanInvite.upsert({
            where: { clanId_playerId: { clanId: clan.id, playerId: targetPlayerId } },
            update: { status: "PENDING", respondedAt: null, createdAt: new Date() },
            create: {
                clanId: clan.id,
                playerId: targetPlayerId,
                status: "PENDING",
            },
        });

        return SuccessResponse({ data: invite, status: 201 });
    } catch (error) {
        return ErrorResponse({ message: "Failed to send invite", error });
    }
}
