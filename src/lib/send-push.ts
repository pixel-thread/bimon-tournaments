// @ts-expect-error — web-push has no type declarations
import webpush from "web-push";
import { prisma } from "@/lib/database";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_TOKEN!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;

let vapidReady = false;
function ensureVapid() {
    if (!vapidReady && VAPID_PUBLIC && VAPID_PRIVATE) {
        webpush.setVapidDetails(
            "mailto:bimonlangnongsiej@gmail.com",
            VAPID_PUBLIC,
            VAPID_PRIVATE
        );
        vapidReady = true;
    }
}

interface PushPayload {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
}

/**
 * Send push to specific player IDs.
 * Handles stale subscription cleanup and per-sub playerId injection.
 */
export async function sendPushToPlayers(
    playerIds: string[],
    payload: PushPayload
): Promise<{ sent: number; failed: number; staleRemoved: number }> {
    ensureVapid();
    if (!playerIds.length) return { sent: 0, failed: 0, staleRemoved: 0 };

    const subscriptions = await prisma.pushSubscription.findMany({
        where: { playerId: { in: playerIds } },
    });

    return sendToSubscriptions(subscriptions, payload);
}

/**
 * Send push to ALL subscribers.
 */
export async function sendPushToAll(
    payload: PushPayload
): Promise<{ sent: number; failed: number; staleRemoved: number }> {
    ensureVapid();

    const subscriptions = await prisma.pushSubscription.findMany();
    return sendToSubscriptions(subscriptions, payload);
}

/**
 * Send push to confirmed players in a tournament (on non-disqualified teams).
 */
export async function sendPushToTournament(
    tournamentId: string,
    payload: PushPayload
): Promise<{ sent: number; failed: number; staleRemoved: number }> {
    ensureVapid();

    const teams = await prisma.team.findMany({
        where: { tournamentId, disqualified: false },
        select: { players: { select: { id: true } } },
    });
    const playerIds = teams.flatMap((t) => t.players.map((p) => p.id));

    if (!playerIds.length) return { sent: 0, failed: 0, staleRemoved: 0 };

    const subscriptions = await prisma.pushSubscription.findMany({
        where: { playerId: { in: playerIds } },
    });

    return sendToSubscriptions(subscriptions, payload);
}

// ── Internal ──────────────────────────────────────────

interface Sub {
    id: string;
    playerId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

async function sendToSubscriptions(
    subscriptions: Sub[],
    payload: PushPayload
): Promise<{ sent: number; failed: number; staleRemoved: number }> {
    if (!subscriptions.length) return { sent: 0, failed: 0, staleRemoved: 0 };

    const trackTag = `push-${Date.now()}`;
    const notifTag = payload.tag || trackTag;
    const basePayload = {
        title: payload.title,
        body: payload.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        tag: notifTag,
        data: { url: payload.url || "/channel", trackTag, sentAt: Date.now() },
        requireInteraction: payload.requireInteraction ?? false,
        renotify: false,
    };

    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];
    const sentPlayerIds: string[] = [];

    await Promise.allSettled(
        subscriptions.map(async (sub) => {
            const perSubPayload = JSON.stringify({
                ...basePayload,
                data: { ...basePayload.data, playerId: sub.playerId },
            });

            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    },
                    perSubPayload,
                    { TTL: 60 * 10 } // 10 minutes — discard stale pushes
                );
                sent++;
                sentPlayerIds.push(sub.playerId);
            } catch (error: unknown) {
                const statusCode = (error as { statusCode?: number })?.statusCode;
                if (statusCode === 403 || statusCode === 404 || statusCode === 410) {
                    staleIds.push(sub.id);
                }
                failed++;
            }
        })
    );

    // Clean up stale subscriptions
    if (staleIds.length > 0) {
        await prisma.pushSubscription.deleteMany({
            where: { id: { in: staleIds } },
        });
    }

    // Track "sent" server-side so delivery tab works even with old SWs
    // Deduplicate player IDs (one player may have multiple devices)
    const uniqueSentIds = [...new Set(sentPlayerIds)];
    if (uniqueSentIds.length > 0) {
        try {
            await prisma.pushDelivery.createMany({
                data: uniqueSentIds.map((playerId) => ({
                    tag: notifTag,
                    playerId,
                    status: "sent",
                })),
                skipDuplicates: true,
            });
        } catch (err) {
            console.error("[Push] Failed to track sent status:", err);
        }
    }

    return { sent, failed, staleRemoved: staleIds.length };
}
