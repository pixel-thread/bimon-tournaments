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
            const registration = await navigator.serviceWorker.ready;

            // Always unsubscribe any existing subscription first.
            // This prevents Chrome from hanging when VAPID keys change.
            const existing = await registration.pushManager.getSubscription();
            if (existing) {
                await existing.unsubscribe();
            }

            // Fresh subscribe with current VAPID key
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    process.env.NEXT_PUBLIC_VAPID_TOKEN!
                ),
            });

            const sub = subscription.toJSON();
            await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    endpoint: sub.endpoint,
                    keys: sub.keys,
                }),
            });

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

    if (status === "loading" || status === "unsupported") return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-3 flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                status === "enabled"
                    ? "border-success/20 bg-success/[0.04]"
                    : status === "denied"
                    ? "border-foreground/10 bg-foreground/[0.02]"
                    : "border-primary/20 bg-primary/[0.04]"
            }`}
        >
            {status === "enabled" && (
                <>
                    <BellRing className="h-3.5 w-3.5 text-success shrink-0" />
                    <p className="text-xs text-success/80 flex-1">
                        Push notifications enabled
                    </p>
                </>
            )}

            {status === "denied" && (
                <>
                    <BellOff className="h-3.5 w-3.5 text-foreground/30 shrink-0" />
                    <p className="text-xs text-foreground/40 flex-1">
                        Notifications blocked — enable in browser settings
                    </p>
                </>
            )}

            {status === "prompt" && (
                <>
                    <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-xs text-foreground/60 flex-1">
                        Get {GAME.currency} alerts, squad invites & rewards instantly
                    </p>
                    <button
                        onClick={handleEnable}
                        disabled={subscribing}
                        className="shrink-0 flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {subscribing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Bell className="h-3 w-3" />
                        )}
                        Enable
                    </button>
                </>
            )}
        </motion.div>
    );
}
