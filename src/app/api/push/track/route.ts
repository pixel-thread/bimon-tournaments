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
