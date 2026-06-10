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
                    // 403 (VAPID mismatch), 404, 410 means subscription is dead
                    if (statusCode === 403 || statusCode === 404 || statusCode === 410) {
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

/**
 * Broadcast a push notification to players in a tournament (or all if no tournamentId).
 * When tournamentId is given, only players who are on a team in that tournament receive it.
 * Returns the number of successful sends.
 */
export async function sendPushToAll(
    payload: PushPayload,
    options?: { tournamentId?: string }
): Promise<number> {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        console.warn("[Push] VAPID keys not configured — skipping broadcast");
        return 0;
    }

    try {
        let subscriptions;

        if (options?.tournamentId) {
            // Only get subscriptions for players on teams in this tournament
            const playerIds = await prisma.team.findMany({
                where: { tournamentId: options.tournamentId },
                select: { players: { select: { id: true } } },
            }).then((teams) =>
                teams.flatMap((t) => t.players.map((p) => p.id))
            );

            if (playerIds.length === 0) return 0;

            // Deduplicate player IDs
            const uniquePlayerIds = [...new Set(playerIds)];

            subscriptions = await prisma.pushSubscription.findMany({
                where: { playerId: { in: uniquePlayerIds } },
            });

            console.log(`[Push] Tournament ${options.tournamentId}: ${uniquePlayerIds.length} players, ${subscriptions.length} subscriptions`);
        } else {
            subscriptions = await prisma.pushSubscription.findMany();
        }

        if (subscriptions.length === 0) return 0;

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
        let sent = 0;

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
                    sent++;
                } catch (error: unknown) {
                    const statusCode = (error as { statusCode?: number })?.statusCode;
                    if (statusCode === 403 || statusCode === 404 || statusCode === 410) {
                        staleIds.push(sub.id);
                    } else {
                        console.warn(`[Push] Broadcast failed for ${sub.endpoint.slice(-20)}:`, statusCode);
                    }
                }
            })
        );

        if (staleIds.length > 0) {
            await prisma.pushSubscription.deleteMany({
                where: { id: { in: staleIds } },
            });
            console.log(`[Push] Broadcast: cleaned up ${staleIds.length} expired sub(s)`);
        }

        console.log(`[Push] Broadcast: ${sent}/${subscriptions.length} delivered`);
        return sent;
    } catch (error) {
        console.error("[Push] Broadcast error:", error);
        return 0;
    }
}
