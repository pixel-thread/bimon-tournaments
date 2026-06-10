import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { sendPushToAll, sendPushToTournament, sendPushToPlayers } from "@/lib/send-push";

/**
 * GET /api/announcements
 * ?channel=general|tournament  — filter by channel (default: general)
 * ?check=role                  — lightweight role check for tournament channel
 * ?cursor=<id>                 — cursor-based pagination
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // Lightweight role check for the channel UI
        if (searchParams.get("check") === "role") {
            const user = await getCurrentUser();

            // Fetch active tournaments (for tab labels)
            const activeTournaments = await prisma.tournament.findMany({
                where: { status: "ACTIVE" },
                select: { id: true, name: true },
                orderBy: { createdAt: "desc" },
            });

            if (!user?.player) {
                return SuccessResponse({
                    message: "Role",
                    data: { role: "viewer", activeTournaments, captainOfTournaments: [] },
                    cache: CACHE.NONE,
                });
            }
            if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
                return SuccessResponse({
                    message: "Role",
                    data: {
                        role: "admin",
                        activeTournaments,
                        captainOfTournaments: activeTournaments.map((t) => t.id), // admins can post in all
                    },
                    cache: CACHE.NONE,
                });
            }

            // Find which active tournaments this user is captain in
            const captainSquads = await prisma.squad.findMany({
                where: {
                    captainId: user.player.id,
                    poll: { tournament: { status: "ACTIVE" } },
                },
                select: { poll: { select: { tournamentId: true } } },
            });
            const captainOfTournaments = captainSquads.map((s) => s.poll.tournamentId);

            return SuccessResponse({
                message: "Role",
                data: {
                    role: captainOfTournaments.length > 0 ? "captain" : "viewer",
                    activeTournaments,
                    captainOfTournaments,
                },
                cache: CACHE.NONE,
            });
        }

        const channel = searchParams.get("channel") || "general";
        const cursor = searchParams.get("cursor");
        const limit = 30;

        const announcements = await prisma.announcement.findMany({
            where: { parentId: null, channel },
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
            cache: CACHE.SHORT, // 60s fresh, stale-while-revalidate 5min
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch announcements", error });
    }
}

/**
 * POST /api/announcements
 * Create a new announcement or reply.
 * - General channel: all signed-in players can post text
 * - Tournament channel: only admins + captains of active tournaments
 * - Images / room-info: admin only
 * - 15s cooldown per user (admins exempt)
 */
const COOLDOWN_MS = 15_000; // 15 seconds between messages

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Sign in required", status: 401 });
        }

        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

        // Cooldown: check last message time (admins exempt)
        if (!isAdmin) {
            const lastMsg = await prisma.announcement.findFirst({
                where: { authorId: user.player.id },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
            });
            if (lastMsg) {
                const elapsed = Date.now() - lastMsg.createdAt.getTime();
                if (elapsed < COOLDOWN_MS) {
                    const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
                    return ErrorResponse({
                        message: `Slow down! Wait ${waitSec}s before sending again`,
                        status: 429,
                    });
                }
            }
        }

        const body = await req.json();
        const { content, imageUrl, parentId, type, channel = "general" } = body;

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return ErrorResponse({ message: "Content is required", status: 400 });
        }

        if (content.length > 2000) {
            return ErrorResponse({ message: "Message too long (max 2000 chars)", status: 400 });
        }

        // Only admins can send images and room-info
        if (!isAdmin && imageUrl) {
            return ErrorResponse({ message: "Only admins can send images", status: 403 });
        }
        if (!isAdmin && type === "room-info") {
            return ErrorResponse({ message: "Only admins can post room info", status: 403 });
        }

        // Tournament channel — captains + admins only
        // Channel value is either "general" or a tournament ID
        if (channel !== "general" && !isAdmin) {
            const isCaptain = (await prisma.squad.count({
                where: {
                    captainId: user.player.id,
                    poll: { tournamentId: channel, tournament: { status: "ACTIVE" } },
                },
            })) > 0;

            if (!isCaptain) {
                return ErrorResponse({ message: "Only admins and tournament captains can post here", status: 403 });
            }
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
                channel,
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

        // ── Push Notifications (fire-and-forget) ──────────────────
        // Don't await — let the response return immediately
        (async () => {
            try {
                if (parentId) {
                    // Thread reply → notify thread owner only
                    const parent = await prisma.announcement.findUnique({
                        where: { id: parentId },
                        select: {
                            authorId: true,
                            channel: true,
                            content: true,
                            author: { select: { displayName: true } },
                        },
                    });
                    if (parent && parent.authorId !== user.player!.id) {
                        const replierName = announcement.author.displayName || "Someone";
                        const preview = content.trim().slice(0, 60);
                        const tabParam = parent.channel !== "general" ? `?tab=${parent.channel}` : "";
                        await sendPushToPlayers([parent.authorId], {
                            title: `💬 ${replierName} replied`,
                            body: preview,
                            url: `/channel${tabParam}`,
                            tag: `reply-${parentId}`,
                        });
                    }
                } else if (isAdmin) {
                    // Admin new post → notify subscribers
                    const preview = content.trim().slice(0, 80);
                    if (channel === "general") {
                        await sendPushToAll({
                            title: "📢 Announcement",
                            body: preview,
                            url: "/channel",
                            tag: `announce-${announcement.id}`,
                        });
                    } else {
                        // Tournament channel → notify confirmed players
                        const tournament = await prisma.tournament.findUnique({
                            where: { id: channel },
                            select: { name: true },
                        });
                        const tName = tournament?.name || "Tournament";
                        await sendPushToTournament(channel, {
                            title: `📢 ${tName}`,
                            body: preview,
                            url: `/channel?tab=${channel}`,
                            tag: `announce-${announcement.id}`,
                        });
                    }
                }
                // Captain/player new posts → no push
            } catch (err) {
                console.error("[Channel Push] Error:", err);
            }
        })();

        return SuccessResponse({
            message: "Posted",
            data: announcement,
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to post", error });
    }
}
