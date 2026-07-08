import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/previous-roster?pollId=xxx
 * Returns the captain's most recent squad roster from a DIFFERENT poll.
 * Used for "Use Past Team" — one click to re-import previous roster.
 * Includes availability status for each member.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const pollId = request.nextUrl.searchParams.get("pollId");
        if (!pollId) {
            return ErrorResponse({ message: "pollId is required", status: 400 });
        }

        // Admin can look up any player's past roster
        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
        const captainIdParam = request.nextUrl.searchParams.get("captainId");
        const currentPlayerId = (isAdmin && captainIdParam) ? captainIdParam : user.player.id;

        // Find captain's most recent squad from a DIFFERENT poll
        const previousSquad = await prisma.squad.findFirst({
            where: {
                captainId: currentPlayerId,
                pollId: { not: pollId },
                status: { not: "CANCELLED" },
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                fullName: true,
                clanId: true,
                invites: {
                    where: {
                        status: "ACCEPTED",
                        playerId: { not: currentPlayerId }, // exclude captain
                    },
                    select: {
                        playerId: true,
                        isSub: true,
                        player: {
                            select: {
                                id: true,
                                displayName: true,
                                isGhost: true,
                                isBanned: true,
                                phoneNumber: true,
                                customProfileImageUrl: true,
                                user: { select: { username: true, imageUrl: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!previousSquad || previousSquad.invites.length === 0) {
            return SuccessResponse({ data: null, cache: CACHE.NONE });
        }

        // Check which members are already in a squad for the CURRENT poll
        const memberIds = previousSquad.invites.map((i) => i.playerId);
        const inCurrentPoll = await prisma.squadInvite.findMany({
            where: {
                playerId: { in: memberIds },
                status: { in: ["PENDING", "ACCEPTED"] },
                squad: {
                    pollId,
                    status: "FORMING",
                },
            },
            select: {
                playerId: true,
                squad: { select: { name: true } },
            },
        });

        const inPollMap = new Map<string, string>();
        for (const inv of inCurrentPoll) {
            inPollMap.set(inv.playerId, inv.squad.name);
        }

        const members = previousSquad.invites.map((inv) => {
            const p = inv.player;
            const existingTeam = inPollMap.get(inv.playerId) || null;
            return {
                playerId: p.id,
                displayName: p.displayName ?? p.user.username ?? "Player",
                imageUrl: p.customProfileImageUrl ?? p.user.imageUrl ?? "",
                isGhost: p.isGhost,
                isSub: inv.isSub,
                isBanned: p.isBanned,
                existingTeamName: existingTeam,
                available: !existingTeam && !p.isBanned,
            };
        });

        return SuccessResponse({
            data: {
                squadName: previousSquad.name,
                fullName: previousSquad.fullName,
                clanId: previousSquad.clanId,
                members,
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch previous roster", error });
    }
}
