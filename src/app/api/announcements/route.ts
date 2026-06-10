import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * GET /api/announcements
 * Fetch top-level announcements (no parentId) with reply counts and author info.
 * Supports cursor-based pagination via ?cursor=<id>.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // Lightweight role check for the channel UI
        if (searchParams.get("check") === "role") {
            const user = await getCurrentUser();
            if (!user?.player) {
                return SuccessResponse({ message: "Role", data: { role: "viewer" }, cache: CACHE.NONE });
            }
            if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
                return SuccessResponse({ message: "Role", data: { role: "admin" }, cache: CACHE.NONE });
            }
            const captainCount = await prisma.squad.count({
                where: {
                    captainId: user.player.id,
                    poll: { tournament: { status: "ACTIVE" } },
                },
            });
            return SuccessResponse({
                message: "Role",
                data: { role: captainCount > 0 ? "captain" : "viewer" },
                cache: CACHE.NONE,
            });
        }

        const cursor = searchParams.get("cursor");
        const limit = 30;

        const announcements = await prisma.announcement.findMany({
            where: { parentId: null },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: {
                author: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { imageUrl: true } },
                    },
                },
                _count: { select: { replies: true } },
            },
        });

        const hasMore = announcements.length > limit;
        const items = hasMore ? announcements.slice(0, limit) : announcements;
        const nextCursor = hasMore ? items[items.length - 1]?.id : null;

        return SuccessResponse({
            message: "Announcements",
            data: { items, nextCursor },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch announcements", error });
    }
}

/**
 * POST /api/announcements
 * Create a new announcement or reply.
 * - Admins: text + image, top-level or reply
 * - Captains: text only, top-level or reply
 * - Others: 403
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Sign in required", status: 401 });
        }

        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

        // Check if captain of a squad in an ACTIVE tournament
        const isCaptain = !isAdmin && (await prisma.squad.count({
            where: {
                captainId: user.player.id,
                poll: {
                    tournament: { status: "ACTIVE" },
                },
            },
        })) > 0;

        if (!isAdmin && !isCaptain) {
            return ErrorResponse({ message: "Only admins and team captains can post", status: 403 });
        }

        const body = await req.json();
        const { content, imageUrl, parentId, type } = body;

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return ErrorResponse({ message: "Content is required", status: 400 });
        }

        if (content.length > 2000) {
            return ErrorResponse({ message: "Message too long (max 2000 chars)", status: 400 });
        }

        // Captains cannot send images
        if (!isAdmin && imageUrl) {
            return ErrorResponse({ message: "Only admins can send images", status: 403 });
        }

        // If replying, verify parent exists
        if (parentId) {
            const parent = await prisma.announcement.findUnique({
                where: { id: parentId },
                select: { id: true, parentId: true },
            });
            if (!parent) {
                return ErrorResponse({ message: "Parent message not found", status: 404 });
            }
            // Don't allow nested threads (reply to reply)
            if (parent.parentId) {
                return ErrorResponse({ message: "Cannot reply to a reply — use the parent thread", status: 400 });
            }
        }

        const announcement = await prisma.announcement.create({
            data: {
                type: type || (imageUrl ? "image" : "message"),
                content: content.trim(),
                imageUrl: isAdmin ? imageUrl || null : null,
                parentId: parentId || null,
                authorId: user.player.id,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        displayName: true,
                        customProfileImageUrl: true,
                        user: { select: { imageUrl: true } },
                    },
                },
                _count: { select: { replies: true } },
            },
        });

        return SuccessResponse({
            message: "Posted",
            data: announcement,
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to post", error });
    }
}
