import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/recent-teammates?pollId=xxx
 * Returns Quick Add candidates for this captain:
 *   1. Players who have auto-accept ON for this captain (subscribers)
 *   2. Clan members (always quick-addable)
 *
 * For each player, includes:
 * - alreadyInSquad: true if already in captain's squad for this poll
 * - existingTeamName: name of the OTHER squad they're in for this poll (null if none)
 * - isClanMember: true if they share a clan with the captain
 * - isSubscriber: true if they have auto-accept ON for this captain
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

        // 1. Get captain's clan
        const captainClan = await prisma.clanMember.findFirst({
            where: { playerId: currentPlayerId },
            select: { clanId: true },
        });
        const captainClanId = captainClan?.clanId || null;

        // 2. Fetch subscribers (auto-accept ON for this captain)
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

        // 3. Fetch clan members (if captain has a clan)
        let clanMembers: {
            player: {
                id: string;
                displayName: string | null;
                customProfileImageUrl: string | null;
                isBanned: boolean;
                user: { username: string | null; imageUrl: string | null };
                clanMembership: { clanId: string } | null;
            };
        }[] = [];

        if (captainClanId) {
            clanMembers = await prisma.clanMember.findMany({
                where: {
                    clanId: captainClanId,
                    playerId: { not: currentPlayerId }, // exclude self
                },
                select: {
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
            });
        }

        // 4. Merge into a unified map (dedup by playerId)
        const subscriberIds = new Set(autoAccepts.map((a) => a.playerId));
        const playerMap = new Map<string, {
            id: string;
            displayName: string;
            imageUrl: string;
            isClanMember: boolean;
            isSubscriber: boolean;
        }>();

        // Add subscribers first
        for (const a of autoAccepts) {
            if (a.player.isBanned || a.playerId === currentPlayerId) continue;
            const playerClanId = a.player.clanMembership?.clanId || null;
            playerMap.set(a.playerId, {
                id: a.player.id,
                displayName: a.player.displayName ?? a.player.user.username ?? "Player",
                imageUrl: a.player.customProfileImageUrl ?? a.player.user.imageUrl ?? "",
                isClanMember: captainClanId ? playerClanId === captainClanId : false,
                isSubscriber: true,
            });
        }

        // Add clan members (not already in as subscribers)
        for (const cm of clanMembers) {
            if (cm.player.isBanned || playerMap.has(cm.player.id)) continue;
            playerMap.set(cm.player.id, {
                id: cm.player.id,
                displayName: cm.player.displayName ?? cm.player.user.username ?? "Player",
                imageUrl: cm.player.customProfileImageUrl ?? cm.player.user.imageUrl ?? "",
                isClanMember: true,
                isSubscriber: false,
            });
        }

        if (playerMap.size === 0) {
            return SuccessResponse({ data: [], cache: CACHE.NONE });
        }

        // 5. Get captain's squad for this poll
        const captainSquad = await prisma.squad.findFirst({
            where: {
                pollId,
                captainId: currentPlayerId,
                status: { in: ["FORMING", "FULL"] },
            },
            select: { id: true },
        });
        const captainSquadId = captainSquad?.id || null;

        // 6. Check which players are already in a squad for this poll
        const playerIds = Array.from(playerMap.keys());
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

        const squadMap = new Map<string, { squadId: string; squadName: string }>();
        for (const inv of playersInSquads) {
            squadMap.set(inv.playerId, { squadId: inv.squadId, squadName: inv.squad.name });
        }

        // 7. Build response — clan members first, then subscribers
        const data = Array.from(playerMap.values()).map((p) => {
            const squadInfo = squadMap.get(p.id);
            const isInCaptainSquad = squadInfo?.squadId === captainSquadId;
            const isInOtherSquad = squadInfo && !isInCaptainSquad;

            return {
                id: p.id,
                displayName: p.displayName,
                imageUrl: p.imageUrl,
                isClanMember: p.isClanMember,
                isSubscriber: p.isSubscriber,
                alreadyInSquad: isInCaptainSquad ?? false,
                existingTeamName: isInOtherSquad ? squadInfo.squadName : null,
            };
        }).sort((a, b) => {
            // Clan members first, then subscribers, then rest
            if (a.isClanMember !== b.isClanMember) return a.isClanMember ? -1 : 1;
            if (a.isSubscriber !== b.isSubscriber) return a.isSubscriber ? -1 : 1;
            return 0;
        });

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch quick-add players", error });
    }
}
