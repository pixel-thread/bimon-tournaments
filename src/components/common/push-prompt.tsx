"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { GAME } from "@/lib/game-config";

const SUBSCRIBED_KEY = "push-subscribed";

/**
 * Converts a base64-url VAPID key to a Uint8Array for the Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray as Uint8Array<ArrayBuffer>;
}

export type PushStatus = "loading" | "unsupported" | "denied" | "enabled" | "prompt";

/**
 * Hook to get the current push notification status.
 * Can be used from any component (notifications page, settings page, etc.)
 */
export function usePushStatus() {
    const [status, setStatus] = useState<PushStatus>("loading");
    const [subscribing, setSubscribing] = useState(false);

    const subscribe = useCallback(async () => {
        try {
            console.log("[Push] Step 1: Checking service worker registration...");

            // If no SW is registered yet, register it explicitly
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length === 0) {
                console.log("[Push] No SW registered — registering /sw.js...");
                await navigator.serviceWorker.register("/sw.js", { scope: "/" });
            }

            // Wait for SW to be ready (with timeout)
            const registration = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Service worker not ready after 10s")), 10000)
                ),
            ]);
            
            console.log("[Push] Step 2: SW ready, checking existing subscription...");

            // Always unsubscribe any existing subscription first.
            // This prevents Chrome from hanging when VAPID keys change.
            const existing = await registration.pushManager.getSubscription();
            if (existing) {
                console.log("[Push] Step 2b: Unsubscribing old subscription...");
                await existing.unsubscribe();
            }

            console.log("[Push] Step 3: Creating new subscription...");
            // Fresh subscribe with current VAPID key
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    process.env.NEXT_PUBLIC_VAPID_TOKEN!
                ),
            });

            console.log("[Push] Step 4: Saving to server...");
            const sub = subscription.toJSON();
            await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    endpoint: sub.endpoint,
                    keys: sub.keys,
                }),
            });

            console.log("[Push] Step 5: Done! ✅");
            localStorage.setItem(SUBSCRIBED_KEY, "true");
        } catch (err) {
            console.warn("[Push] Subscribe failed:", err);
        }
    }, []);

    const handleEnable = useCallback(async () => {
        setSubscribing(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                await subscribe();
                setStatus("enabled");
            } else if (permission === "denied") {
                setStatus("denied");
            }
        } catch (err) {
            console.error("[Push] Subscribe error:", err);
            alert(`Push failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setSubscribing(false);
        }
    }, [subscribe]);

    useEffect(() => {
        if (
            typeof window === "undefined" ||
            !("serviceWorker" in navigator) ||
            !("PushManager" in window) ||
            !process.env.NEXT_PUBLIC_VAPID_TOKEN
        ) {
            setStatus("unsupported");
            return;
        }

        if (Notification.permission === "denied") {
            setStatus("denied");
            return;
        }

        if (Notification.permission === "granted") {
            subscribe().then(() => setStatus("enabled"));
            return;
        }

        setStatus("prompt");
    }, [subscribe]);

    return { status, subscribing, handleEnable };
}

/**
 * PushPrompt — Compact, always-visible push notification status bar.
 * Non-skippable: shows enable button until user enables or browser blocks.
 */
export function PushPrompt() {
    const { status, subscribing, handleEnable } = usePushStatus();

    // Hide entirely when enabled, loading, or unsupported
    if (status === "loading" || status === "unsupported" || status === "enabled") return null;

    return (
        <div className={`mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
            status === "denied"
                ? "bg-foreground/[0.03]"
                : "bg-primary/[0.05]"
        }`}>
            {status === "denied" ? (
                <>
                    <BellOff className="h-3 w-3 text-foreground/25 shrink-0" />
                    <p className="text-[11px] text-foreground/35 flex-1">Notifications blocked</p>
                </>
            ) : (
                <>
                    <Bell className="h-3 w-3 text-primary/60 shrink-0" />
                    <p className="text-[11px] text-foreground/50 flex-1">Get alerts for rooms &amp; rewards</p>
                    <button
                        onClick={handleEnable}
                        disabled={subscribing}
                        className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {subscribing ? "..." : "Enable"}
                    </button>
                </>
            )}
        </div>
    );
}
