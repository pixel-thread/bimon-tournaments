// @ts-expect-error — web-push has no type declarations
import webpush from "web-push";
import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { type NextRequest } from "next/server";
import { z } from "zod";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_TOKEN!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(
        "mailto:bimonlangnongsiej@gmail.com",
        VAPID_PUBLIC,
        VAPID_PRIVATE
    );
}

const testSchema = z.object({
    mode: z.enum(["normal", "sticky", "update"]).default("sticky"),
    roomId: z.string().default("ABCD1234"),
    password: z.string().default("9876"),
    map: z.string().default("Erangel"),
    matchNumber: z.number().default(1),
});

/**
 * POST /api/push/test
 * Super admin only — sends a mock room-info notification to yourself.
 * Returns detailed diagnostic info for debugging.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Super admin only", status: 403 });
        }

        if (!user.player) {
            return ErrorResponse({
                message: "You need a player profile to test push",
                status: 400,
            });
        }

        const body = await req.json();
        const { mode, roomId, password, map, matchNumber } = testSchema.parse(body);

        const isSticky = mode === "sticky" || mode === "update";

        // Find all subscriptions for this player
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { playerId: user.player.id },
        });

        if (subscriptions.length === 0) {
            return SuccessResponse({
                message: "⚠️ No push subscriptions found for your player account!",
                data: {
                    playerId: user.player.id,
                    subscriptionCount: 0,
                    hint: "Open the site on your phone, enable notifications, then try again.",
                },
                cache: CACHE.NONE,
            });
        }

        // Send to each subscription and collect results
        const message = JSON.stringify({
            title: `🔐 Match ${matchNumber} — ${map}`,
            body: `Room ID: ${roomId}\nPassword: ${password}\n\nJoin now! Lobby closing soon.`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-72x72.png",
            tag: isSticky ? "live-room-info" : `test-${Date.now()}`,
            data: { url: "/vote" },
            requireInteraction: isSticky,
            renotify: mode === "update",
        });

        const results: { endpoint: string; status: string; error?: string }[] = [];
        const staleIds: string[] = [];

        await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: { p256dh: sub.p256dh, auth: sub.auth },
                        },
                        message,
                        { TTL: 60 * 60 }
                    );
                    results.push({
                        endpoint: `...${sub.endpoint.slice(-30)}`,
                        status: "✅ delivered",
                    });
                } catch (error: unknown) {
                    const statusCode = (error as { statusCode?: number })?.statusCode;
                    const errorBody = (error as { body?: string })?.body;
                    if (statusCode === 404 || statusCode === 410) {
                        staleIds.push(sub.id);
                        results.push({
                            endpoint: `...${sub.endpoint.slice(-30)}`,
                            status: "❌ expired/stale",
                            error: `HTTP ${statusCode}`,
                        });
                    } else {
                        results.push({
                            endpoint: `...${sub.endpoint.slice(-30)}`,
                            status: "❌ failed",
                            error: `HTTP ${statusCode}: ${errorBody?.slice(0, 100) || "unknown"}`,
                        });
                    }
                }
            })
        );

        // Clean up stale subscriptions
        if (staleIds.length > 0) {
            await prisma.pushSubscription.deleteMany({
                where: { id: { in: staleIds } },
            });
        }

        return SuccessResponse({
            message: `Push test complete`,
            data: {
                playerId: user.player.id,
                mode,
                subscriptionCount: subscriptions.length,
                staleRemoved: staleIds.length,
                results,
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({
            message: "Failed to send test notification",
            error,
        });
    }
}
