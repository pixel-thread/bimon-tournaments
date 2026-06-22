"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Share, Plus, X, MapPin, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@heroui/react";
import { LocationModal } from "./location-modal";

/* ── Constants ─────────────────────────────────────── */

const DISMISSED_KEY = "pwa-install-dismissed";
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/* ── Helpers ───────────────────────────────────────── */

function isStandalone(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true;
}

function isIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* ── Component ─────────────────────────────────────── */

/**
 * Delayed Setup Popup — shows after 2 weeks.
 * Bundles: Location entry (if not set) + PWA install (if not installed).
 * If both are done, nothing shows. If dismissed, re-shows after 2 weeks.
 */
export function PwaInstallPopup() {
    const [show, setShow] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installing, setInstalling] = useState(false);
    const [locationModalOpen, setLocationModalOpen] = useState(false);
    const [locationDone, setLocationDone] = useState(false);
    const [pwaInstalled, setPwaInstalled] = useState(false);

    // Check if location already set
    const { data: profile } = useQuery<{
        player: { state: string | null; district: string | null; town: string | null } | null;
    }>({
        queryKey: ["profile"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) return null;
            return (await res.json()).data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const hasLocation = !!profile?.player?.state && !!profile?.player?.district && !!profile?.player?.town;
    const needsLocation = !hasLocation && !locationDone;
    const needsPwa = isMobile() && !isStandalone() && !pwaInstalled && typeof window !== "undefined" && localStorage.getItem("pwa-installed") !== "true";

    // Capture beforeinstallprompt
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        const installed = () => {
            localStorage.setItem("pwa-installed", "true");
            setPwaInstalled(true);
        };
        window.addEventListener("beforeinstallprompt", handler);
        window.addEventListener("appinstalled", installed);
        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", installed);
        };
    }, []);

    // Check if we should show (after 2 weeks)
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (profile === undefined) return; // wait for profile

        // Already dismissed permanently
        if (localStorage.getItem(DISMISSED_KEY) === "permanent") return;

        // Check temp dismissal
        const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
        if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

        // Check 2-week threshold
        const onboardedAt = localStorage.getItem("onboarded-at");
        if (!onboardedAt) return; // legacy user or not onboarded

        const elapsed = Date.now() - Number(onboardedAt);
        if (elapsed < TWO_WEEKS_MS) return;

        // Check if pwa is already installed
        const pwaAlready = isStandalone() || localStorage.getItem("pwa-installed") === "true" || !isMobile();
        if (pwaAlready) setPwaInstalled(true);

        // Nothing to show?
        const locDone = hasLocation;
        if (locDone && pwaAlready) return;

        // Show after a short delay
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
    }, [profile, hasLocation]);

    const handleInstall = useCallback(async () => {
        if (deferredPrompt) {
            setInstalling(true);
            try {
                await deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === "accepted") {
                    localStorage.setItem("pwa-installed", "true");
                    setPwaInstalled(true);
                }
            } catch {}
            setInstalling(false);
            setDeferredPrompt(null);
        }
    }, [deferredPrompt]);

    const handleDismiss = useCallback(() => {
        // Dismiss for 2 weeks, show again after
        localStorage.setItem(DISMISSED_KEY, String(Date.now() + TWO_WEEKS_MS));
        setShow(false);
    }, []);

    const handleDismissPermanent = useCallback(() => {
        localStorage.setItem(DISMISSED_KEY, "permanent");
        setShow(false);
    }, []);

    // Auto-close when everything is done
    useEffect(() => {
        if (show && !needsLocation && (pwaInstalled || !isMobile())) {
            setTimeout(() => setShow(false), 800);
        }
    }, [show, needsLocation, pwaInstalled]);

    if (!show) return null;

    // Nothing left to show
    if (!needsLocation && (pwaInstalled || !needsPwa)) return null;

    const showIOSInstructions = isIOS() && !deferredPrompt;
    const showAndroidManual = !isIOS() && !deferredPrompt && isMobile();

    return (
        <>
            <AnimatePresence>
                <div className="fixed inset-0 z-50 flex items-end justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={handleDismiss}
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        transition={{ type: "spring", damping: 28, stiffness: 300 }}
                        className="relative w-full max-w-md mx-3 mb-3 rounded-2xl bg-background border border-divider shadow-2xl overflow-hidden"
                    >
                        {/* Close button */}
                        <button
                            onClick={handleDismiss}
                            className="absolute top-3 right-3 p-1 rounded-full hover:bg-foreground/10 transition-colors z-10"
                        >
                            <X className="w-4 h-4 text-foreground/40" />
                        </button>

                        <div className="p-5 space-y-4">
                            <p className="text-xs text-foreground/30 font-medium uppercase tracking-wider">Complete your setup</p>

                            {/* ── Location Section ── */}
                            {needsLocation && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                    <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                                        <MapPin className="w-4 h-4 text-violet-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold">Add Location</p>
                                        <p className="text-[11px] text-foreground/40">Regional rankings & stats</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="bg-violet-500 text-white font-semibold shrink-0"
                                        onPress={() => setLocationModalOpen(true)}
                                    >
                                        Add
                                    </Button>
                                </div>
                            )}

                            {/* ── PWA Install Section ── */}
                            {needsPwa && !pwaInstalled && (
                                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                            <Download className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold">Install the App</p>
                                            <p className="text-[11px] text-foreground/40">Faster & works offline</p>
                                        </div>
                                    </div>

                                    {/* Native install prompt (Android/Chrome) */}
                                    {deferredPrompt && (
                                        <Button
                                            color="primary"
                                            className="w-full font-bold"
                                            startContent={!installing ? <Download className="w-4 h-4" /> : undefined}
                                            isLoading={installing}
                                            onPress={handleInstall}
                                        >
                                            {installing ? "Installing..." : "Install App"}
                                        </Button>
                                    )}

                                    {/* iOS manual instructions */}
                                    {showIOSInstructions && (
                                        <div className="space-y-2">
                                            <div className="space-y-1.5 text-xs text-foreground/60">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-primary/70">1.</span>
                                                    <span>Tap <Share className="w-3.5 h-3.5 inline text-primary" /> <strong>Share</strong></span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-primary/70">2.</span>
                                                    <span>Tap <Plus className="w-3.5 h-3.5 inline text-primary" /> <strong>&quot;Add to Home Screen&quot;</strong></span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-primary/70">3.</span>
                                                    <span>Tap <strong>Add</strong></span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="flat"
                                                size="sm"
                                                className="w-full font-semibold"
                                                onPress={() => {
                                                    localStorage.setItem("pwa-installed", "true");
                                                    setPwaInstalled(true);
                                                }}
                                            >
                                                I&apos;ve added it ✓
                                            </Button>
                                        </div>
                                    )}

                                    {/* Android manual (no prompt event) */}
                                    {showAndroidManual && (
                                        <div className="space-y-2">
                                            <div className="space-y-1.5 text-xs text-foreground/60">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-primary/70">1.</span>
                                                    <span>Tap <strong>⋮</strong> menu (top right)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-primary/70">2.</span>
                                                    <span>Tap <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong></span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="flat"
                                                size="sm"
                                                className="w-full font-semibold"
                                                onPress={() => {
                                                    localStorage.setItem("pwa-installed", "true");
                                                    setPwaInstalled(true);
                                                }}
                                            >
                                                I&apos;ve installed it ✓
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Don't show again */}
                            <button
                                onClick={handleDismissPermanent}
                                className="w-full text-[11px] text-foreground/25 hover:text-foreground/40 transition-colors text-center"
                            >
                                Don&apos;t show again
                            </button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>

            {/* Location Modal — opens on top */}
            <LocationModal
                isOpen={locationModalOpen}
                blocking={false}
                onComplete={() => {
                    setLocationModalOpen(false);
                    setLocationDone(true);
                }}
            />
        </>
    );
}
