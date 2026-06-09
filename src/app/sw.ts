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
            } as NotificationOptions)
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

    const url = event.notification.data?.url || "/notifications";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            // Focus existing tab if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }
            // Otherwise open new tab
            return self.clients.openWindow(url);
        })
    );
});

