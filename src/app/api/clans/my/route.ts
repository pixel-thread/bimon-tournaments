import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/clans/my
 * Returns the current player's clan membership info (if any).
 * Lightweight endpoint for UI to check clan availability.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return SuccessResponse({ data: null, cache: CACHE.NONE });
        }

        const membership = await prisma.clanMember.findUnique({
            where: { playerId: user.player.id },
            select: {
                role: true,
                autoAcceptSquadInvites: true,
                clan: {
                    select: {
                        id: true,
                        name: true,
                        tag: true,
                        logoUrl: true,
                        leaderId: true,
                        balance: true,
                    },
                },
            },
        });

        if (!membership) {
            // Also check if the player is a clan leader (leader isn't in ClanMember)
            const ownedClan = await prisma.clan.findUnique({
                where: { leaderId: user.player.id },
                select: { id: true, name: true, tag: true, logoUrl: true, leaderId: true, balance: true },
            });

            if (ownedClan) {
                return SuccessResponse({
                    data: {
                        id: ownedClan.id,
                        name: ownedClan.name,
                        tag: ownedClan.tag,
                        logoUrl: ownedClan.logoUrl,
                        role: "LEADER",
                        balance: ownedClan.balance,
                    },
                    cache: CACHE.NONE,
                });
            }

            return SuccessResponse({ data: null, cache: CACHE.NONE });
        }

        return SuccessResponse({
            data: {
                id: membership.clan.id,
                name: membership.clan.name,
                tag: membership.clan.tag,
                logoUrl: membership.clan.logoUrl,
                role: membership.role,
                balance: membership.clan.balance,
                autoAcceptSquadInvites: membership.autoAcceptSquadInvites,
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch clan info", error });
    }
}
