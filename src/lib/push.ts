// @ts-expect-error — web-push has no type declarations
import webpush from "web-push";
import { prisma } from "@/lib/database";

/**
 * Web Push notification helper.
 *
 * Sends a push notification to all devices subscribed by a player.
 * Silently handles failures (expired subscriptions get cleaned up).
 *
 * Usage:
 *   await sendPush(playerId, { title: "🛡 Squad...", body: "You were invited" });
 */

// Configure VAPID keys once
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_TOKEN!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(
        "mailto:bimonlangnongsiej@gmail.com",
        VAPID_PUBLIC,
        VAPID_PRIVATE
    );
}

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
    /** Keep notification visible until user dismisses (Android) */
    requireInteraction?: boolean;
    /** Vibrate/sound when updating an existing tagged notification */
    renotify?: boolean;
}

/**
 * Send a push notification to all subscribed devices of a player.
 * Automatically removes stale/expired subscriptions.
 */
export async function sendPush(playerId: string, payload: PushPayload) {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        console.warn("[Push] VAPID keys not configured — skipping push");
        return;
    }

    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { playerId },
        });

        if (subscriptions.length === 0) return;

        const message = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || "/icons/icon-192x192.png",
            badge: payload.badge || "/icons/icon-72x72.png",
            tag: payload.tag || "bimon-notification",
            data: { url: payload.url || "/notifications" },
            requireInteraction: payload.requireInteraction ?? false,
            renotify: payload.renotify ?? false,
        });

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
                        { TTL: 60 * 60 } // 1 hour
                    );
                } catch (error: unknown) {
                    const statusCode = (error as { statusCode?: number })?.statusCode;
                    // 404 or 410 means subscription expired — clean it up
                    if (statusCode === 404 || statusCode === 410) {
                        staleIds.push(sub.id);
                    } else {
                        console.warn(`[Push] Failed to send to ${sub.endpoint.slice(-20)}:`, statusCode);
                    }
                }
            })
        );

        // Clean up stale subscriptions
        if (staleIds.length > 0) {
            await prisma.pushSubscription.deleteMany({
                where: { id: { in: staleIds } },
            });
            console.log(`[Push] Cleaned up ${staleIds.length} expired subscription(s)`);
        }
    } catch (error) {
        // Never let push failure break the main flow
        console.error("[Push] Unexpected error:", error);
    }
}
