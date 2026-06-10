"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, ModalContent, ModalBody, Button } from "@heroui/react";
import { Bell, BellOff, Smartphone, Share } from "lucide-react";
import { motion } from "motion/react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { GAME } from "@/lib/game-config";

const PUSH_SUBSCRIBED_KEY = "push-subscribed";

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

/* ── Browser / OS detection ──────────────────────────────── */

function isBrave(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(navigator as any).brave;
}

function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
    return window.matchMedia("(display-mode: standalone)").matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true;
}

function isMobileDevice(): boolean {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

type GuardState = "loading" | "ok" | "prompt" | "denied" | "brave" | "ios-safari" | "ios-pwa";

/**
 * PushGuard — Mandatory push notification gate.
 *
 * If a signed-in player hasn't enabled push notifications,
 * shows an un-closable modal that blocks the app until they
 * enable push. Similar to PhoneGuard.
 *
 * Special cases:
 * - Brave: Shows instructions to enable Google push messaging
 * - iOS Safari: Shows instructions to add to home screen first
 * - iOS PWA: Normal push flow (supported since iOS 16.4)
 */
export function PushGuard() {
    const { isSignedIn } = useAuthUser();
    const [ready, setReady] = useState(false);
    const [state, setState] = useState<GuardState>("loading");
    const [subscribing, setSubscribing] = useState(false);
    const [error, setError] = useState("");
    const [dismissed, setDismissed] = useState(false);

    // Delay showing modal so page content renders first + wait for PWA install
    useEffect(() => {
        const timer = setTimeout(() => {
            // Wait for PWA install prompt to be resolved first
            // (PWA prompt shows at 3s, so we wait 4s)
            setReady(true);
        }, 4000);
        return () => clearTimeout(timer);
    }, []);

    // Check push status
    useEffect(() => {
        if (!ready || !isSignedIn) return;

        // If PWA install prompt is still showing, don't show push guard yet
        const pwaInstalled = localStorage.getItem("pwa-installed") === "true" || isStandalone();
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        if (isMobile && !pwaInstalled) {
            // PWA not installed yet — PwaInstallPrompt handles it, skip push guard
            setState("ok");
            return;
        }

        // Not supported at all — skip silently
        if (
            typeof window === "undefined" ||
            !("Notification" in window) ||
            !process.env.NEXT_PUBLIC_VAPID_TOKEN
        ) {
            setState("ok");
            return;
        }

        // iOS Safari (not standalone) — PwaInstallPrompt handles this
        if (isIOS() && !isStandalone()) {
            if (!("PushManager" in window)) {
                setState("ok"); // PWA prompt will show instead
                return;
            }
        }

        // iOS PWA — push is supported, treat normally
        if (isIOS() && isStandalone()) {
            // PushManager might still not exist on older iOS
            if (!("PushManager" in window)) {
                setState("ok"); // Skip — old iOS, nothing we can do
                return;
            }
            // Fall through to normal flow
        }

        // Not supported (no SW or PushManager) — skip
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            setState("ok");
            return;
        }

        // Helper: verify actual push subscription exists in the browser
        async function hasActiveSubscription(): Promise<boolean> {
            try {
                const reg = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
                ]);
                const sub = await reg.pushManager.getSubscription();
                return !!sub;
            } catch {
                return false;
            }
        }

        // Already denied at browser level
        if (Notification.permission === "denied") {
            localStorage.removeItem(PUSH_SUBSCRIBED_KEY); // Clear stale flag
            setState("denied");
            return;
        }

        // Permission was reset to "default" but localStorage still says subscribed
        // → User manually reset notifications, clear stale flag and re-prompt
        if (
            Notification.permission === "default" &&
            localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "true"
        ) {
            localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
            setState("prompt");
            return;
        }

        // Already subscribed — verify
        if (
            Notification.permission === "granted" &&
            localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "true"
        ) {
            hasActiveSubscription().then((active) => {
                if (active) {
                    silentResubscribe(); // refresh in background
                    setState("ok");
                } else {
                    // Subscription lost — clear flag, try auto-subscribe
                    localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
                    silentResubscribe().then((ok) => setState(ok ? "ok" : "prompt"));
                }
            });
            return;
        }

        // Permission already granted but not subscribed — auto-subscribe
        if (Notification.permission === "granted") {
            silentResubscribe().then((ok) => {
                setState(ok ? "ok" : "prompt");
            });
            return;
        }

        // Permission is "default" — show simple one-click modal
        setState("prompt");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, isSignedIn]);

    // Resubscribe logic
    const silentResubscribe = useCallback(async () => {
        try {
            // Ensure SW is registered before waiting for ready
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length === 0) {
                await navigator.serviceWorker.register("/sw.js", { scope: "/" });
            }

            const reg = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise<never>((_, rej) =>
                    setTimeout(() => rej(new Error("timeout")), 8000)
                ),
            ]);
            const existing = await reg.pushManager.getSubscription();
            if (existing) await existing.unsubscribe();

            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    process.env.NEXT_PUBLIC_VAPID_TOKEN!
                ),
            });
            const json = sub.toJSON();
            const res = await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem(PUSH_SUBSCRIBED_KEY, "true");
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    const handleEnable = useCallback(async () => {
        setSubscribing(true);
        setError("");
        try {
            const permission = await Notification.requestPermission();
            if (permission === "denied") {
                setState("denied");
                return;
            }
            if (permission !== "granted") {
                // User dismissed the prompt — show skip option
                setDismissed(true);
                setError("Tap again to enable, or skip for now.");
                return;
            }

            const ok = await silentResubscribe();
            if (ok) {
                setState("ok");
            } else {
                // Subscribe failed after permission granted
                // On Brave this means Google push messaging is disabled
                if (isBrave()) {
                    setState("brave");
                } else {
                    setError("Subscription failed. Please refresh and try again.");
                    setDismissed(true);
                }
            }
        } catch (err) {
            // On Brave, subscribe throws if Google push is off
            if (isBrave()) {
                setState("brave");
            } else {
                setError(err instanceof Error ? err.message : "Failed to enable push");
                setDismissed(true);
            }
        } finally {
            setSubscribing(false);
        }
    }, [silentResubscribe]);

    // Don't show if not needed
    if (state === "loading" || state === "ok") return null;

    return (
        <Modal
            isOpen={true}
            isDismissable={false}
            hideCloseButton
            placement="center"
            size="sm"
            backdrop="blur"
        >
            <ModalContent>
                <ModalBody className="px-6 py-8">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-5 text-center"
                    >
                        {/* ── iOS Safari: Need to install PWA first ── */}
                        {state === "ios-safari" && (
                            <>
                                <div className="flex justify-center">
                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Smartphone className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Install the App</h2>
                                    <p className="text-sm text-foreground/50 mt-1">
                                        To receive room info &amp; match alerts, install this app on your home screen
                                    </p>
                                </div>
                                <div className="text-left space-y-3 bg-foreground/[0.03] rounded-lg p-4">
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg">1.</span>
                                        <span>Tap the <Share className="w-4 h-4 inline text-primary" /> <strong>Share</strong> button at the bottom</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg">2.</span>
                                        <span>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg">3.</span>
                                        <span>Open the app from your home screen</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg">4.</span>
                                        <span>Enable notifications when asked</span>
                                    </div>
                                </div>
                                <p className="text-xs text-foreground/30">
                                    Push notifications only work on iOS when the app is installed on your home screen
                                </p>
                            </>
                        )}

                        {/* ── Brave browser: Need to enable Google push ── */}
                        {state === "brave" && (
                            <>
                                <div className="flex justify-center">
                                    <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
                                        <Bell className="w-6 h-6 text-warning" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Enable Push on Brave</h2>
                                    <p className="text-sm text-foreground/50 mt-1">
                                        Brave blocks push notifications by default. Enable it to get room info &amp; match alerts.
                                    </p>
                                </div>
                                <div className="text-left space-y-3 bg-foreground/[0.03] rounded-lg p-4">
                                    <div className="flex items-start gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">1.</span>
                                        <span>Open <strong>brave://settings/privacy</strong> in a new tab</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">2.</span>
                                        <span>Enable <strong>&quot;Use Google services for push messaging&quot;</strong></span>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">3.</span>
                                        <span>Come back and click the button below</span>
                                    </div>
                                </div>
                                <p className="text-xs text-foreground/30">
                                    Or use Chrome for the best experience with push notifications
                                </p>
                                {error && (
                                    <p className="text-xs text-danger/80 bg-danger/5 rounded-lg px-3 py-2">
                                        {error} — Make sure you enabled the setting and try again.
                                    </p>
                                )}
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full font-semibold"
                                    isLoading={subscribing}
                                    startContent={!subscribing ? <Bell className="w-4 h-4" /> : undefined}
                                    onPress={async () => {
                                        setError("");
                                        setSubscribing(true);
                                        try {
                                            const ok = await silentResubscribe();
                                            if (ok) {
                                                setState("ok");
                                            } else {
                                                setError("Push still not working");
                                            }
                                        } catch {
                                            setError("Push still not working");
                                        } finally {
                                            setSubscribing(false);
                                        }
                                    }}
                                >
                                    {subscribing ? "Enabling..." : "I've enabled it — Continue"}
                                </Button>
                                <button
                                    onClick={() => setState("ok")}
                                    className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
                                >
                                    Skip for now
                                </button>
                            </>
                        )}

                        {/* ── Denied: Already blocked at browser level ── */}
                        {state === "denied" && (
                            <>
                                <div className="flex justify-center">
                                    <div className="w-14 h-14 rounded-full bg-foreground/[0.05] flex items-center justify-center">
                                        <BellOff className="w-6 h-6 text-foreground/40" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Notifications Blocked</h2>
                                    <p className="text-sm text-foreground/50 mt-1">
                                        You blocked notifications. Please enable them in your browser settings to receive room info and match alerts.
                                    </p>
                                </div>
                                <div className="text-left space-y-3 bg-foreground/[0.03] rounded-lg p-4">
                                    <div className="flex items-start gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">1.</span>
                                        <span>Tap the <strong>🔒 lock icon</strong> next to the URL</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">2.</span>
                                        <span>Tap <strong>Site settings</strong></span>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">3.</span>
                                        <span>Change <strong>Notifications</strong> to <strong>Allow</strong></span>
                                    </div>
                                </div>
                                {error && (
                                    <p className="text-xs text-danger/80 bg-danger/5 rounded-lg px-3 py-2">
                                        {error}
                                    </p>
                                )}
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full font-semibold"
                                    isLoading={subscribing}
                                    startContent={!subscribing ? <Bell className="w-4 h-4" /> : undefined}
                                    onPress={async () => {
                                        setError("");
                                        setSubscribing(true);
                                        try {
                                            const perm = await Notification.requestPermission();
                                            if (perm === "granted") {
                                                const ok = await silentResubscribe();
                                                if (ok) {
                                                    setState("ok");
                                                } else {
                                                    setError("Permission granted but subscription failed. Try refreshing.");
                                                }
                                            } else {
                                                setError("Still blocked. Open site settings → change Notifications to Allow, then try again.");
                                            }
                                        } catch {
                                            setError("Failed. Please try refreshing the page.");
                                        } finally {
                                            setSubscribing(false);
                                        }
                                    }}
                                >
                                    {subscribing ? "Checking..." : "I've enabled it — Try Again"}
                                </Button>
                                <button
                                    onClick={() => setState("ok")}
                                    className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
                                >
                                    Skip for now
                                </button>
                            </>
                        )}

                        {/* ── Normal prompt: Ask to enable ── */}
                        {state === "prompt" && (
                            <>
                                <div className="flex justify-center">
                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Bell className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Enable Notifications</h2>
                                    <p className="text-sm text-foreground/50 mt-1">
                                        Get {GAME.currency} alerts, squad invites, room details &amp; match updates instantly
                                    </p>
                                </div>
                                <div className="text-left space-y-2 bg-foreground/[0.03] rounded-lg p-3">
                                    {[
                                        "🔐 Room ID & Password sent directly",
                                        "⚡ Squad invites & responses",
                                        `💰 ${GAME.currency} transfer alerts`,
                                        "🏆 Match results & standings",
                                    ].map((item) => (
                                        <div key={item} className="text-xs text-foreground/60">
                                            {item}
                                        </div>
                                    ))}
                                </div>
                                {error && (
                                    <p className="text-xs text-danger">{error}</p>
                                )}
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full font-semibold"
                                    isLoading={subscribing}
                                    startContent={!subscribing ? <Bell className="w-4 h-4" /> : undefined}
                                    onPress={handleEnable}
                                >
                                    {subscribing ? "Enabling..." : "Enable Notifications"}
                                </Button>
                                {(!isMobileDevice() || dismissed) && (
                                    <button
                                        onClick={() => setState("ok")}
                                        className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
                                    >
                                        {dismissed ? "Skip for now" : "Maybe later"}
                                    </button>
                                )}
                            </>
                        )}
                    </motion.div>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
