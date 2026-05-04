import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { type NextRequest } from "next/server";

/**
 * GET /api/clans/search-players?q=searchTerm
 * Search players that can be invited to the caller's clan.
 * Excludes: players already in a clan, already invited (pending), banned players.
 */
export async function GET(request: NextRequest) {
    try {
        const email = await getAuthEmail();
        if (!email) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(email),
            select: { player: { select: { id: true } } },
        });
        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        const playerId = user.player.id;

        // Verify caller is a clan leader
        const clan = await prisma.clan.findUnique({
            where: { leaderId: playerId },
            select: { id: true },
        });
        if (!clan) {
            return ErrorResponse({ message: "You must be a clan leader to search players", status: 403 });
        }

        const q = request.nextUrl.searchParams.get("q")?.trim() || "";

        // Get players already in any clan
        const inClanPlayerIds = (
            await prisma.clanMember.findMany({ select: { playerId: true } })
        ).map((m) => m.playerId);

        // Get players with pending invites for this clan
        const pendingInvitePlayerIds = (
            await prisma.clanInvite.findMany({
                where: { clanId: clan.id, status: "PENDING" },
                select: { playerId: true },
            })
        ).map((i) => i.playerId);

        const excludeIds = [...new Set([...inClanPlayerIds, ...pendingInvitePlayerIds, playerId])];

        const players = await prisma.player.findMany({
            where: {
                id: { notIn: excludeIds },
                isBanned: false,
                ...(q.length > 0 && {
                    OR: [
                        { displayName: { contains: q, mode: "insensitive" } },
                        { user: { username: { contains: q, mode: "insensitive" } } },
                    ],
                }),
            },
            select: {
                id: true,
                displayName: true,
                customProfileImageUrl: true,
                category: true,
                user: { select: { username: true, imageUrl: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        const data = players.map((p) => ({
            id: p.id,
            displayName: p.displayName || p.user.username,
            username: p.user.username,
            imageUrl: p.customProfileImageUrl || p.user.imageUrl,
            category: p.category,
        }));

        return SuccessResponse({ data, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to search players", error });
    }
}
