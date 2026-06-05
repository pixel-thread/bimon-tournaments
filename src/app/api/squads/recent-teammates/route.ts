import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/recent-teammates?pollId=xxx
 * Returns players who have auto-accept enabled for this captain.
 * "Quick Add" — every player in this list will auto-join when invited.
 *
 * Filters out:
 * - Players already in a squad for this poll
 * - Banned players
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
            select: {
                playerId: true,
                createdAt: true,
                player: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        isBanned: true,
                        user: { select: { username: true, imageUrl: true } },
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

        // Exclude players already in a squad for this poll
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
            select: { playerId: true },
        });
        const inSquadIds = new Set(playersInSquads.map((s) => s.playerId));

        const data = eligible
            .filter((a) => !inSquadIds.has(a.playerId))
            .map((a) => ({
                id: a.player.id,
                displayName: a.player.displayName ?? a.player.user.username,
                imageUrl: a.player.customProfileImageUrl ?? a.player.user.imageUrl ?? "",
            }));

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch quick-add players", error });
    }
}
