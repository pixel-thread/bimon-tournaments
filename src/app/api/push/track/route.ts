import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";

/**
 * POST /api/push/track
 * Called by Service Worker when a notification is displayed or clicked.
 * No auth required (SW doesn't have cookies) — uses playerId from payload.
 */
export async function POST(req: NextRequest) {
    try {
        const { tag, playerId, status } = await req.json();

        if (!tag || !playerId || !status) {
            return ErrorResponse({ message: "tag, playerId, and status are required", status: 400 });
        }

        if (!["delivered", "clicked"].includes(status)) {
            return ErrorResponse({ message: "status must be 'delivered' or 'clicked'", status: 400 });
        }

        // Prevent duplicate delivered entries (SW may fire multiple times)
        const existing = await prisma.pushDelivery.findFirst({
            where: { tag, playerId, status },
        });

        if (!existing) {
            await prisma.pushDelivery.create({
                data: { tag, playerId, status },
            });
        }

        return SuccessResponse({ message: "Tracked", data: null, cache: CACHE.NONE });
    } catch (error) {
        return ErrorResponse({ message: "Failed to track", error });
    }
}

/**
 * GET /api/push/track?tag=xxx
 * GET /api/push/track?tournamentId=xxx  — recent deliveries for a tournament
 * Admin only — view delivery stats for a notification tag.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Admin only", status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const tag = searchParams.get("tag");
        const tournamentId = searchParams.get("tournamentId");

        // ── Tournament delivery view: recent notifications with per-team breakdown ──
        if (tournamentId) {
            // Get announcements for this tournament channel (last 20)
            const announcements = await prisma.announcement.findMany({
                where: { channel: tournamentId },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                    id: true,
                    content: true,
                    type: true,
                    imageUrl: true,
                    createdAt: true,
                    author: { select: { displayName: true } },
                },
            });

            // Build tag→announcement map
            const announceTags = announcements.map((a) => ({
                tag: `announce-${a.id}`,
                content: a.content.slice(0, 100),
                type: a.type,
                author: a.author.displayName || "Admin",
                createdAt: a.createdAt.toISOString(),
                hasImage: !!a.imageUrl,
            }));

            // Also include room-info tag
            const allTags = ["live-room-info", ...announceTags.map((a) => a.tag)];

            // Get delivery records for these tags
            const deliveries = await prisma.pushDelivery.findMany({
                where: { tag: { in: allTags } },
                select: { tag: true, playerId: true, status: true, createdAt: true },
            });

            // Get teams with players for this tournament
            const teams = await prisma.team.findMany({
                where: { tournamentId, disqualified: false },
                orderBy: { teamNumber: "asc" },
                select: {
                    id: true,
                    name: true,
                    teamNumber: true,
                    players: {
                        select: {
                            id: true,
                            displayName: true,
                            customProfileImageUrl: true,
                            user: { select: { imageUrl: true } },
                        },
                    },
                },
            });

            // Get push subscriptions for all players
            const allPlayerIds = teams.flatMap((t) => t.players.map((p) => p.id));
            const pushSubs = await prisma.pushSubscription.groupBy({
                by: ["playerId"],
                where: { playerId: { in: allPlayerIds } },
                _count: { id: true },
            });
            const pushMap = new Map(pushSubs.map((s) => [s.playerId, s._count.id]));

            // Build per-tag delivery summary
            const deliveryByTag = new Map<string, Map<string, string>>();
            for (const d of deliveries) {
                if (!deliveryByTag.has(d.tag)) deliveryByTag.set(d.tag, new Map());
                const playerMap = deliveryByTag.get(d.tag)!;
                // Keep the best status (clicked > delivered)
                const current = playerMap.get(d.playerId);
                if (!current || (d.status === "clicked" && current === "delivered")) {
                    playerMap.set(d.playerId, d.status);
                }
            }

            // Build notification list with delivery per team
            const notifications = [];

            // Room info entry
            const roomDeliveries = deliveryByTag.get("live-room-info");
            if (roomDeliveries && roomDeliveries.size > 0) {
                notifications.push({
                    tag: "live-room-info",
                    label: "🔐 Room Info",
                    type: "room-info",
                    createdAt: null,
                    delivered: roomDeliveries.size,
                    totalWithPush: pushMap.size,
                });
            }

            // Announcement entries
            for (const a of announceTags) {
                const tagDeliveries = deliveryByTag.get(a.tag);
                const deliveredCount = tagDeliveries?.size || 0;
                const label = a.type === "room-info"
                    ? `🔐 ${a.content.slice(0, 50)}`
                    : a.hasImage
                        ? `📋 ${a.content.slice(0, 50)}`
                        : `📢 ${a.content.slice(0, 50)}`;
                notifications.push({
                    tag: a.tag,
                    label,
                    type: a.type || "message",
                    author: a.author,
                    createdAt: a.createdAt,
                    delivered: deliveredCount,
                    totalWithPush: pushMap.size,
                });
            }

            // Build team data with per-notification delivery
            const teamData = teams.map((team) => ({
                id: team.id,
                name: team.name,
                teamNumber: team.teamNumber,
                players: team.players.map((p) => ({
                    id: p.id,
                    displayName: p.displayName,
                    avatar: p.customProfileImageUrl || p.user?.imageUrl || null,
                    hasPush: pushMap.has(p.id),
                    deviceCount: pushMap.get(p.id) || 0,
                })),
            }));

            // Build per-tag per-player delivery lookup
            const deliveryMatrix: Record<string, Record<string, string>> = {};
            for (const [tagKey, playerMap] of deliveryByTag) {
                deliveryMatrix[tagKey] = Object.fromEntries(playerMap);
            }

            return SuccessResponse({
                message: "Tournament delivery stats",
                data: {
                    notifications,
                    teams: teamData,
                    deliveryMatrix,
                    summary: {
                        totalPlayers: allPlayerIds.length,
                        totalWithPush: pushMap.size,
                    },
                },
                cache: CACHE.NONE,
            });
        }

        if (!tag) {
            // Return recent tags with counts
            const recentDeliveries = await prisma.pushDelivery.groupBy({
                by: ["tag", "status"],
                _count: { id: true },
                orderBy: { tag: "desc" },
                take: 50,
            });

            // Group by tag
            const tagMap = new Map<string, { delivered: number; clicked: number }>();
            for (const d of recentDeliveries) {
                if (!tagMap.has(d.tag)) tagMap.set(d.tag, { delivered: 0, clicked: 0 });
                const entry = tagMap.get(d.tag)!;
                if (d.status === "delivered") entry.delivered = d._count.id;
                if (d.status === "clicked") entry.clicked = d._count.id;
            }

            return SuccessResponse({
                message: "Recent delivery stats",
                data: Array.from(tagMap.entries()).map(([tag, counts]) => ({
                    tag,
                    ...counts,
                })),
                cache: CACHE.NONE,
            });
        }

        // Get per-player delivery details for a specific tag
        const deliveries = await prisma.pushDelivery.findMany({
            where: { tag },
            orderBy: { createdAt: "asc" },
        });

        // Get player names
        const playerIds = [...new Set(deliveries.map((d) => d.playerId))];
        const players = await prisma.player.findMany({
            where: { id: { in: playerIds } },
            select: { id: true, displayName: true },
        });
        const playerMap = new Map(players.map((p) => [p.id, p.displayName || "Unknown"]));

        // Group by player
        const perPlayer = new Map<string, { name: string; delivered: boolean; clicked: boolean; deliveredAt?: string; clickedAt?: string }>();
        for (const d of deliveries) {
            if (!perPlayer.has(d.playerId)) {
                perPlayer.set(d.playerId, {
                    name: playerMap.get(d.playerId) || "Unknown",
                    delivered: false,
                    clicked: false,
                });
            }
            const entry = perPlayer.get(d.playerId)!;
            if (d.status === "delivered") {
                entry.delivered = true;
                entry.deliveredAt = d.createdAt.toISOString();
            }
            if (d.status === "clicked") {
                entry.clicked = true;
                entry.clickedAt = d.createdAt.toISOString();
            }
        }

        return SuccessResponse({
            message: "Delivery details",
            data: {
                tag,
                totalDelivered: [...perPlayer.values()].filter((p) => p.delivered).length,
                totalClicked: [...perPlayer.values()].filter((p) => p.clicked).length,
                players: Array.from(perPlayer.values()),
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch delivery stats", error });
    }
}

