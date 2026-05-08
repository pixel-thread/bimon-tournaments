import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { userSearchFilter } from "@/lib/player-search";
import { NextRequest } from "next/server";

/**
 * GET /api/admins?role=ALL&search=xxx&cursor=xxx&limit=10
 * Fetches users with cursor-based pagination. Super admin only.
 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const currentUser = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { role: true },
        });

        if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Forbidden", status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const roleFilter = searchParams.get("role") || "ALL";
        const search = searchParams.get("search") || "";
        const cursor = searchParams.get("cursor") || undefined;
        const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

        const where: any = {};
        if (roleFilter && roleFilter !== "ALL") {
            where.role = roleFilter;
        }
        if (search) {
            where.OR = userSearchFilter(search);
        }

        const users = await prisma.user.findMany({
            where,
            take: limit + 1, // fetch one extra to determine if there's a next page
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                username: true,
                email: true,
                imageUrl: true,
                role: true,
                isOnboarded: true,
                createdAt: true,
                player: {
                    select: {
                        id: true,
                        displayName: true,
                    },
                },
            },
            orderBy: [
                { createdAt: "desc" },
                { id: "asc" },
            ],
        });

        const hasMore = users.length > limit;
        const items = hasMore ? users.slice(0, limit) : users;
        const nextCursor = hasMore ? items[items.length - 1].id : null;

        return SuccessResponse({
            data: { items, nextCursor, hasMore },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch users", error });
    }
}

/**
 * PATCH /api/admins — Update a user's role. Super admin only.
 */
export async function PATCH(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const currentUser = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { id: true, role: true },
        });

        if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Forbidden", status: 403 });
        }

        const { userId: targetUserId, role } = await request.json();
        if (!targetUserId || !role) {
            return ErrorResponse({ message: "userId and role are required", status: 400 });
        }

        const validRoles = ["SUPER_ADMIN", "ADMIN", "PLAYER", "USER"];
        if (!validRoles.includes(role)) {
            return ErrorResponse({ message: "Invalid role", status: 400 });
        }

        // Prevent changing own role
        if (targetUserId === currentUser.id) {
            return ErrorResponse({ message: "Cannot change your own role", status: 400 });
        }

        const updated = await prisma.user.update({
            where: { id: targetUserId },
            data: { role },
            select: { id: true, username: true, role: true },
        });

        return SuccessResponse({ data: updated });
    } catch (error) {
        return ErrorResponse({ message: "Failed to update role", error });
    }
}

/**
 * DELETE /api/admins — Delete a user and all data. Super admin only.
 */
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const currentUser = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { id: true, role: true },
        });

        if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Forbidden", status: 403 });
        }

        const { userId: targetUserId } = await request.json();
        if (!targetUserId) {
            return ErrorResponse({ message: "userId is required", status: 400 });
        }

        if (targetUserId === currentUser.id) {
            return ErrorResponse({ message: "Cannot delete yourself", status: 400 });
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                username: true,
                role: true,
                player: { select: { id: true } },
            },
        });

        if (!targetUser) {
            return ErrorResponse({ message: "User not found", status: 404 });
        }

        if (targetUser.player) {
            const playerId = targetUser.player.id;

            await prisma.$transaction([
                prisma.teamPlayerStats.deleteMany({ where: { playerId } }),
                prisma.playerStats.deleteMany({ where: { playerId } }),
                prisma.matchPlayerPlayed.deleteMany({ where: { playerId } }),
                prisma.playerPollVote.deleteMany({ where: { playerId } }),
                prisma.pendingReward.deleteMany({ where: { playerId } }),
                prisma.uCTransfer.deleteMany({ where: { OR: [{ fromPlayerId: playerId }, { toPlayerId: playerId }] } }),
                prisma.transaction.deleteMany({ where: { playerId } }),
                prisma.pushSubscription.deleteMany({ where: { playerId } }),
                prisma.playerMeritRating.deleteMany({ where: { OR: [{ fromPlayerId: playerId }, { toPlayerId: playerId }] } }),
            ]);

            await prisma.wallet.deleteMany({ where: { playerId } });
            await prisma.playerStreak.deleteMany({ where: { playerId } });
            await prisma.playerBan.deleteMany({ where: { playerId } });
            await prisma.playerJobListing.deleteMany({ where: { playerId } });
            await prisma.referral.deleteMany({ where: { referredPlayerId: playerId } });
            await prisma.player.delete({ where: { id: playerId } });
        }

        await prisma.notification.deleteMany({ where: { userId: targetUserId } });
        await prisma.referral.deleteMany({ where: { promoterId: targetUserId } });
        await prisma.user.delete({ where: { id: targetUserId } });

        return SuccessResponse({ data: { deleted: targetUser.username } });
    } catch (error) {
        return ErrorResponse({ message: "Failed to delete user", error });
    }
}
