import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { playerSearchFilter } from "@/lib/player-search";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/search-players?q=xxx&pollId=yyy&cursor=zzz&limit=20
 * Player-facing search for squad invites.
 * Returns lightweight results without sensitive data (no email).
 * When no search query, returns all players (paginated).
 * Filters out: banned, self, already in a squad for this poll.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const q = request.nextUrl.searchParams.get("q")?.trim() || "";
        const pollId = request.nextUrl.searchParams.get("pollId");
        const cursor = request.nextUrl.searchParams.get("cursor") || undefined;
        const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 20, 50);

        if (!pollId) {
            return ErrorResponse({ message: "pollId is required", status: 400 });
        }

        const currentPlayerId = user.player.id;

        // Find players already in squads for this poll (PENDING/ACCEPTED on non-cancelled squads)
        const playersInSquads = await prisma.squadInvite.findMany({
            where: {
                status: { in: ["PENDING", "ACCEPTED"] },
                squad: {
                    pollId,
                    status: { in: ["FORMING", "FULL"] },
                },
            },
            select: { playerId: true },
        });
        const excludePlayerIds = [
            currentPlayerId,
            ...playersInSquads.map((s) => s.playerId),
        ];

        const players = await prisma.player.findMany({
            where: {
                isBanned: false,
                id: { notIn: excludePlayerIds },
                ...(q.length >= 2 ? { OR: playerSearchFilter(q) } : {}),
                ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
            },
            select: {
                id: true,
                displayName: true,
                customProfileImageUrl: true,
                createdAt: true,
                wallet: { select: { balance: true } },
                user: {
                    select: {
                        username: true,
                        imageUrl: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit + 1, // +1 to check hasMore
        });

        const hasMore = players.length > limit;
        const pageData = hasMore ? players.slice(0, limit) : players;
        const nextCursor = hasMore ? pageData[pageData.length - 1].createdAt.toISOString() : null;

        const data = pageData.map((p) => ({
            id: p.id,
            displayName: p.displayName ?? p.user.username,
            imageUrl: p.customProfileImageUrl ?? p.user.imageUrl ?? "",
            balance: p.wallet?.balance ?? 0,
            hasEnoughBalance: true,
        }));

        return SuccessResponse({
            data,
            meta: { hasMore, nextCursor },
        });
    } catch (error) {
        return ErrorResponse({ message: "Search failed", error });
    }
}
