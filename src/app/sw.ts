import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: defaultCache,
    fallbacks: {
        entries: [
            {
                url: "/~offline",
                matcher({ request }) {
                    return request.destination === "document";
                },
            },
        ],
    },
});

serwist.addEventListeners();

// ── Web Push Notifications ──────────────────────────────

// Helper: report delivery/click to the server
function trackDelivery(playerId: string, trackTag: string, status: "delivered" | "clicked") {
    return fetch("/api/push/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: trackTag, playerId, status }),
    }).catch(() => {
        // Silent fail — tracking is non-critical
    });
}

self.addEventListener("push", (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const { title, body, icon, badge, tag, data: notifData, requireInteraction, renotify } = data;
        const notifTag = tag || "bimon-notification";

        // ── Staleness guard: discard notifications older than 10 minutes ──
        const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
        if (notifData?.sentAt && Date.now() - notifData.sentAt > MAX_AGE_MS) {
            // Silently discard — showing a hours-old notification is worse than none
            return;
        }

        event.waitUntil(
            self.registration.showNotification(title || "Bimon", {
                body: body || "",
                icon: icon || "/icons/icon-192x192.png",
                badge: badge || "/icons/icon-72x72.png",
                tag: notifTag,
                data: { ...(notifData || { url: "/notifications" }), notifTag },
                requireInteraction: requireInteraction ?? false,
                // renotify is valid in browsers but missing from TS NotificationOptions
                ...(renotify ? { renotify: true } : {}),
            } as NotificationOptions).then(() => {
                // Track delivery after notification is shown
                // Use the notification tag (e.g. "announce-xxx") for consistency with delivery queries
                if (notifData?.playerId) {
                    return trackDelivery(notifData.playerId, notifTag, "delivered");
                }
            })
        );
    } catch {
        // Fallback for non-JSON push
        event.waitUntil(
            self.registration.showNotification("Bimon", {
                body: event.data.text(),
                icon: "/icons/icon-192x192.png",
            })
        );
    }
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const notifData = event.notification.data;
    const url = notifData?.url || "/notifications";

    // Track click — use the notification tag for consistency
    const clickTag = notifData?.notifTag || notifData?.trackTag;
    if (notifData?.playerId && clickTag) {
        event.waitUntil(
            trackDelivery(notifData.playerId, clickTag, "clicked").then(() =>
                self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
                    for (const client of clientList) {
                        if (client.url.includes(self.location.origin) && "focus" in client) {
                            client.focus();
                            client.navigate(url);
                            return;
                        }
                    }
                    return self.clients.openWindow(url);
                })
            )
        );
    } else {
        event.waitUntil(
            self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && "focus" in client) {
                        client.focus();
                        client.navigate(url);
                        return;
                    }
                }
                return self.clients.openWindow(url);
            })
        );
    }
});
