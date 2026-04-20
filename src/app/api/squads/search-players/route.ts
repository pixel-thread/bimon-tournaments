import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/squads/search-players?q=xxx&pollId=yyy
 * Player-facing search for squad invites.
 * Returns lightweight results without sensitive data (no email).
 * Filters out: banned, self, already in a squad for this poll.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const q = request.nextUrl.searchParams.get("q")?.trim();
        const pollId = request.nextUrl.searchParams.get("pollId");

        if (!q || q.length < 2) {
            return SuccessResponse({ data: [] });
        }
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
        const excludePlayerIds = new Set([
            currentPlayerId,
            ...playersInSquads.map((s) => s.playerId),
        ]);

        const players = await prisma.player.findMany({
            where: {
                isBanned: false,
                id: { notIn: [...excludePlayerIds] },
                OR: [
                    { displayName: { contains: q, mode: "insensitive" } },
                    { user: { username: { contains: q, mode: "insensitive" } } },
                ],
            },
            select: {
                id: true,
                displayName: true,
                customProfileImageUrl: true,
                wallet: { select: { balance: true } },
                user: {
                    select: {
                        username: true,
                        imageUrl: true,
                    },
                },
            },
            take: 8,
        });

        // Note: joiners don't pay — captain covers the full team fee.
        // Balance info kept for display purposes but hasEnoughBalance is always true.
        const data = players.map((p) => ({
            id: p.id,
            displayName: p.displayName ?? p.user.username,
            imageUrl: p.customProfileImageUrl ?? p.user.imageUrl ?? "",
            balance: p.wallet?.balance ?? 0,
            hasEnoughBalance: true,
        }));

        return SuccessResponse({ data });
    } catch (error) {
        return ErrorResponse({ message: "Search failed", error });
    }
}
