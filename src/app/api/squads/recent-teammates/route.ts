import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/recent-teammates?pollId=xxx
 * Returns players who have auto-accept enabled for this captain.
 * "Quick Add" — every player in this list will auto-join when invited.
 *
 * For each player, includes:
 * - alreadyInSquad: true if already in captain's squad for this poll
 * - existingTeamName: name of the OTHER squad they're in for this poll (null if none)
 * - isClanMember: true if they share a clan with the captain
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

        const currentPlayerId = user.player.id;

        // Find all players who have auto-accept ON for this captain
        const autoAccepts = await prisma.playerAutoAccept.findMany({
            where: { captainId: currentPlayerId },
            include: {
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        isBanned: true,
                        user: { select: { username: true, imageUrl: true } },
                        clanMembership: { select: { clanId: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        if (autoAccepts.length === 0) {
            return SuccessResponse({ data: [], cache: CACHE.NONE });
        }

        // Filter out banned players
        const eligible = autoAccepts.filter((a) => !a.player.isBanned);

        if (eligible.length === 0) {
            return SuccessResponse({ data: [], cache: CACHE.NONE });
        }

        // Get captain's clan
        const captainClan = await prisma.clanMember.findFirst({
            where: { playerId: currentPlayerId },
            select: { clanId: true },
        });
        const captainClanId = captainClan?.clanId || null;

        // Get captain's squad for this poll
        const captainSquad = await prisma.squad.findFirst({
            where: {
                pollId,
                captainId: currentPlayerId,
                status: { in: ["FORMING", "FULL"] },
            },
            select: { id: true },
        });
        const captainSquadId = captainSquad?.id || null;

        // Check which players are already in a squad for this poll
        const playerIds = eligible.map((a) => a.playerId);
        const playersInSquads = await prisma.squadInvite.findMany({
            where: {
                playerId: { in: playerIds },
                status: { in: ["PENDING", "ACCEPTED"] },
                squad: {
                    pollId,
                    status: { in: ["FORMING", "FULL"] },
                },
            },
            select: {
                playerId: true,
                squadId: true,
                squad: { select: { name: true } },
            },
        });

        // Map: playerId → { squadId, squadName }
        const squadMap = new Map<string, { squadId: string; squadName: string }>();
        for (const inv of playersInSquads) {
            squadMap.set(inv.playerId, { squadId: inv.squadId, squadName: inv.squad.name });
        }

        const data = eligible.map((a) => {
            const squadInfo = squadMap.get(a.playerId);
            const isInCaptainSquad = squadInfo?.squadId === captainSquadId;
            const isInOtherSquad = squadInfo && !isInCaptainSquad;
            const playerClanId = a.player.clanMembership?.clanId || null;

            return {
                id: a.player.id,
                displayName: a.player.displayName ?? a.player.user.username,
                imageUrl: a.player.customProfileImageUrl ?? a.player.user.imageUrl ?? "",
                isClanMember: captainClanId ? playerClanId === captainClanId : false,
                alreadyInSquad: isInCaptainSquad ?? false,
                existingTeamName: isInOtherSquad ? squadInfo.squadName : null,
            };
        });

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch quick-add players", error });
    }
}
