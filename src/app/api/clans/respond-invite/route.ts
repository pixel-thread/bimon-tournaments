import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/respond-invite
 * Accept or decline a clan invite.
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
        const { inviteId, action } = (await request.json()) as {
            inviteId?: string;
            action?: "ACCEPT" | "DECLINE";
        };

        if (!inviteId || !action) {
            return ErrorResponse({ message: "inviteId and action are required", status: 400 });
        }
        if (action !== "ACCEPT" && action !== "DECLINE") {
            return ErrorResponse({ message: "action must be ACCEPT or DECLINE", status: 400 });
        }

        // Find the invite and verify it belongs to this player
        const invite = await prisma.clanInvite.findUnique({
            where: { id: inviteId },
            include: { clan: { select: { id: true, name: true } } },
        });
        if (!invite || invite.playerId !== playerId) {
            return ErrorResponse({ message: "Invite not found", status: 404 });
        }
        if (invite.status !== "PENDING") {
            return ErrorResponse({ message: "This invite has already been responded to", status: 400 });
        }

        if (action === "DECLINE") {
            await prisma.clanInvite.update({
                where: { id: inviteId },
                data: { status: "DECLINED", respondedAt: new Date() },
            });
            return SuccessResponse({ data: { status: "DECLINED" } });
        }

        // ACCEPT: check player isn't already in a clan (race condition guard)
        const existingMembership = await prisma.clanMember.findUnique({
            where: { playerId },
        });
        if (existingMembership) {
            // Auto-decline since they joined another clan
            await prisma.clanInvite.update({
                where: { id: inviteId },
                data: { status: "DECLINED", respondedAt: new Date() },
            });
            return ErrorResponse({
                message: `You are already in a ${GAME.clanLabel.toLowerCase()}`,
                status: 400,
            });
        }

        // Create membership + update invite in transaction
        await prisma.$transaction([
            prisma.clanMember.create({
                data: {
                    clanId: invite.clanId,
                    playerId,
                    role: "MEMBER",
                },
            }),
            prisma.clanInvite.update({
                where: { id: inviteId },
                data: { status: "ACCEPTED", respondedAt: new Date() },
            }),
            // Decline all other pending invites for this player
            prisma.clanInvite.updateMany({
                where: {
                    playerId,
                    status: "PENDING",
                    id: { not: inviteId },
                },
                data: { status: "DECLINED", respondedAt: new Date() },
            }),
        ]);

        return SuccessResponse({ data: { status: "ACCEPTED", clanName: invite.clan.name } });
    } catch (error) {
        return ErrorResponse({ message: "Failed to respond to invite", error });
    }
}
