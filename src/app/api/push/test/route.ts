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
    mode: z.enum(["normal", "sticky", "update", "broadcast"]).default("sticky"),
    roomId: z.string().default("ABCD1234"),
    password: z.string().default("9876"),
    map: z.string().default("Erangel"),
    matchNumber: z.number().default(1),
    // Custom message fields (used when mode = "broadcast" or "self")
    title: z.string().optional(),
    body: z.string().optional(),
    target: z.enum(["self", "all"]).default("self"),
});

/**
 * POST /api/push/test
 * Super admin only.
 * - mode=broadcast + target=all: custom message to ALL subscribers
 * - mode=broadcast + target=self: custom message to yourself
 * - mode=sticky/normal/update: mock room-info to yourself
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

        const rawBody = await req.json();
        const { mode, roomId, password, map, matchNumber, title, body: msgBody, target } = testSchema.parse(rawBody);

        // Build the notification payload
        let payload: string;

        if (mode === "broadcast") {
            if (!title || !msgBody) {
                return ErrorResponse({ message: "Title and body are required for broadcast", status: 400 });
            }
            payload = JSON.stringify({
                title,
                body: msgBody,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-72x72.png",
                tag: `broadcast-${Date.now()}`,
                data: { url: "/channel" },
                requireInteraction: true,
                renotify: false,
            });
        } else {
            const isSticky = mode === "sticky" || mode === "update";
            payload = JSON.stringify({
                title: `🔐 Match ${matchNumber} — ${map}`,
                body: `Room ID: ${roomId}\nPassword: ${password}\n\nJoin now! Lobby closing soon.`,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-72x72.png",
                tag: isSticky ? "live-room-info" : `test-${Date.now()}`,
                data: { url: "/channel" },
                requireInteraction: isSticky,
                renotify: mode === "update",
            });
        }

        // Determine which subscriptions to send to
        let subscriptions;
        if (mode === "broadcast" && target === "all") {
            subscriptions = await prisma.pushSubscription.findMany();
        } else {
            subscriptions = await prisma.pushSubscription.findMany({
                where: { playerId: user.player.id },
            });
        }

        if (subscriptions.length === 0) {
            return SuccessResponse({
                message: "⚠️ No push subscriptions found!",
                data: {
                    playerId: user.player.id,
                    target,
                    subscriptionCount: 0,
                    hint: target === "all"
                        ? "No players have subscribed to push notifications yet."
                        : "Open the site on your phone, enable notifications, then try again.",
                },
                cache: CACHE.NONE,
            });
        }

        // Send to each subscription and collect results
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
                        payload,
                        { TTL: 60 * 60 }
                    );
                    results.push({
                        endpoint: `...${sub.endpoint.slice(-30)}`,
                        status: "✅ delivered",
                    });
                } catch (error: unknown) {
                    const statusCode = (error as { statusCode?: number })?.statusCode;
                    const errorBody = (error as { body?: string })?.body;
                    if (statusCode === 403 || statusCode === 404 || statusCode === 410) {
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

        // Auto-post broadcast messages to the channel
        if (mode === "broadcast" && target === "all" && title && msgBody) {
            try {
                await prisma.announcement.create({
                    data: {
                        type: "broadcast",
                        content: `**${title}**\n${msgBody}`,
                        authorId: user.player.id,
                    },
                });
            } catch {
                // Non-critical — don't fail the push if channel post fails
            }
        }

        return SuccessResponse({
            message: `Push ${mode === "broadcast" ? "broadcast" : "test"} complete`,
            data: {
                playerId: user.player.id,
                mode,
                target,
                subscriptionCount: subscriptions.length,
                delivered: results.filter((r) => r.status.includes("✅")).length,
                staleRemoved: staleIds.length,
                results,
            },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({
            message: "Failed to send notification",
            error,
        });
    }
}

/**
 * DELETE /api/push/test
 * Super admin only — clears ALL push subscriptions for your player.
 * Use this to wipe stale subscriptions before re-subscribing.
 */
export async function DELETE() {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Super admin only", status: 403 });
        }

        if (!user.player) {
            return ErrorResponse({ message: "No player profile", status: 400 });
        }

        const result = await prisma.pushSubscription.deleteMany({
            where: { playerId: user.player.id },
        });

        return SuccessResponse({
            message: `Cleared ${result.count} subscription(s)`,
            data: { cleared: result.count },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to clear subscriptions", error });
    }
}
