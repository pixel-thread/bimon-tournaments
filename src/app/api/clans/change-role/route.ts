import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { GAME } from "@/lib/game-config";

/**
 * POST /api/clans/change-role
 * Change a clan member's role. Only the LEADER can do this.
 * Actions: PROMOTE_CO_LEADER, DEMOTE, TRANSFER_LEADER
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
        const body = await request.json();
        const { targetPlayerId, action } = body as {
            targetPlayerId: string;
            action: "PROMOTE_CO_LEADER" | "DEMOTE" | "TRANSFER_LEADER";
        };

        if (!targetPlayerId || !action) {
            return ErrorResponse({ message: "Missing targetPlayerId or action", status: 400 });
        }

        // Verify caller is the LEADER of a clan
        const membership = await prisma.clanMember.findUnique({
            where: { playerId },
            include: { clan: true },
        });
        if (!membership || membership.role !== "LEADER") {
            return ErrorResponse({ message: `Only the ${GAME.clanLabel.toLowerCase()} leader can manage roles`, status: 403 });
        }

        const clanId = membership.clanId;

        // Find target member
        const target = await prisma.clanMember.findFirst({
            where: { clanId, playerId: targetPlayerId },
        });
        if (!target) {
            return ErrorResponse({ message: "Member not found in your clan", status: 404 });
        }
        if (target.playerId === playerId) {
            return ErrorResponse({ message: "Cannot change your own role", status: 400 });
        }

        switch (action) {
            case "PROMOTE_CO_LEADER":
                if (target.role === "CO_LEADER") {
                    return ErrorResponse({ message: "Already a Co-Leader", status: 400 });
                }
                await prisma.clanMember.update({
                    where: { id: target.id },
                    data: { role: "CO_LEADER" },
                });
                return SuccessResponse({ message: "Promoted to Co-Leader" });

            case "DEMOTE":
                if (target.role === "MEMBER") {
                    return ErrorResponse({ message: "Already a Member", status: 400 });
                }
                await prisma.clanMember.update({
                    where: { id: target.id },
                    data: { role: "MEMBER" },
                });
                return SuccessResponse({ message: "Demoted to Member" });

            case "TRANSFER_LEADER": {
                // Transfer leadership: target becomes LEADER, caller becomes MEMBER
                await prisma.$transaction([
                    // Update clan's leaderId
                    prisma.clan.update({
                        where: { id: clanId },
                        data: { leaderId: targetPlayerId },
                    }),
                    // Target → LEADER
                    prisma.clanMember.update({
                        where: { id: target.id },
                        data: { role: "LEADER" },
                    }),
                    // Caller → MEMBER
                    prisma.clanMember.update({
                        where: { id: membership.id },
                        data: { role: "MEMBER" },
                    }),
                ]);
                return SuccessResponse({ message: "Leadership transferred" });
            }

            default:
                return ErrorResponse({ message: "Invalid action", status: 400 });
        }
    } catch (error) {
        return ErrorResponse({ message: "Failed to change role", error });
    }
}
