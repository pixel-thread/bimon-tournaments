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

        event.waitUntil(
            self.registration.showNotification(title || "Bimon", {
                body: body || "",
                icon: icon || "/icons/icon-192x192.png",
                badge: badge || "/icons/icon-72x72.png",
                tag: tag || "bimon-notification",
                data: notifData || { url: "/notifications" },
                requireInteraction: requireInteraction ?? false,
                // renotify is valid in browsers but missing from TS NotificationOptions
                ...(renotify ? { renotify: true } : {}),
            } as NotificationOptions).then(() => {
                // Track delivery after notification is shown
                if (notifData?.playerId && notifData?.trackTag) {
                    return trackDelivery(notifData.playerId, notifData.trackTag, "delivered");
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

    // Track click
    if (notifData?.playerId && notifData?.trackTag) {
        event.waitUntil(
            trackDelivery(notifData.playerId, notifData.trackTag, "clicked").then(() =>
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
