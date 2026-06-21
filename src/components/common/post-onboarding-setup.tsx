"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronRight, Download, Bell, Share, Plus, MapPin } from "lucide-react";
import { Button } from "@heroui/react";
import { GAME, GAME_MODE } from "@/lib/game-config";
import { toast } from "sonner";
import { LocationModal } from "./location-modal";

/* ── Constants ─────────────────────────────────────── */

const STORAGE_KEY = "setup-wizard-skip-until";
const COMPLETED_KEY = "setup-wizard-completed";
const SKIP_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

/* ── Detection helpers ────────────────────────────── */

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

/* ── Step definitions ─────────────────────────────── */

type StepId = "whatsapp" | "pwa" | "notifications" | "location";

interface StepDef {
    id: StepId;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
}

const STEPS: StepDef[] = [
    {
        id: "whatsapp",
        title: "Join WhatsApp",
        subtitle: "Get Room IDs & updates",
        icon: <WhatsAppIcon className="w-5 h-5 text-white" />,
        color: "bg-[#25D366]",
    },
    {
        id: "pwa",
        title: "Install App",
        subtitle: "Faster & works offline",
        icon: <Download className="w-5 h-5 text-white" />,
        color: "bg-blue-500",
    },
    {
        id: "notifications",
        title: "Enable Notifications",
        subtitle: "Never miss Room IDs",
        icon: <Bell className="w-5 h-5 text-white" />,
        color: "bg-amber-500",
    },
    {
        id: "location",
        title: "Add Location",
        subtitle: "Regional rankings & stats",
        icon: <MapPin className="w-5 h-5 text-white" />,
        color: "bg-violet-500",
    },
];

const TOTAL_STEPS = STEPS.length;

/* ── Main Component ───────────────────────────────── */

export function PostOnboardingSetup() {
    const { user, isLoading } = useAuthUser();
    const [hydrated, setHydrated] = useState(false);
    const [shouldShow, setShouldShow] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set());
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installing, setInstalling] = useState(false);
    const [whatsAppLink, setWhatsAppLink] = useState<string | null>(null);
    const [subscribing, setSubscribing] = useState(false);
    const [locationModalOpen, setLocationModalOpen] = useState(false);

    // Profile query — check if location already set
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
        enabled: !!user?.isOnboarded,
    });

    const hasLocation = !!profile?.player?.state && !!profile?.player?.district && !!profile?.player?.town;

    // ── Hydrate + determine visibility ──
    useEffect(() => {
        if (isLoading || !user?.isOnboarded) return;
        // Wait for profile to load
        if (profile === undefined) return;

        // Already completed all steps
        if (localStorage.getItem(COMPLETED_KEY)) { setHydrated(true); return; }

        // Skipped recently?
        const skipUntil = localStorage.getItem(STORAGE_KEY);
        if (skipUntil && Date.now() < Number(skipUntil)) { setHydrated(true); return; }

        // Check which steps are already done
        const done = new Set<StepId>();

        // WhatsApp already joined?
        const waJoined = localStorage.getItem("whatsapp_joined_groups");
        if (waJoined) {
            try {
                const groups = JSON.parse(waJoined);
                if (Array.isArray(groups) && groups.length > 0) done.add("whatsapp");
            } catch {}
        }

        // PWA already installed?
        if (isStandalone() || localStorage.getItem("pwa-installed") === "true" || !isMobile()) {
            done.add("pwa");
        }

        // Notifications already granted?
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            done.add("notifications");
        }

        // Location already set?
        if (hasLocation) {
            done.add("location");
        }

        setCompletedSteps(done);

        // All done? Mark complete permanently
        if (done.size >= TOTAL_STEPS) {
            localStorage.setItem(COMPLETED_KEY, "true");
            setHydrated(true);
            return;
        }

        // Find first incomplete step
        const firstIncomplete = STEPS.findIndex(s => !done.has(s.id));
        setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : 0);
        setShouldShow(true);
        setHydrated(true);
    }, [isLoading, user?.isOnboarded, hasLocation, profile]);

    // ── Capture PWA install prompt ──
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        const installed = () => {
            localStorage.setItem("pwa-installed", "true");
            markStepDone("pwa");
        };
        window.addEventListener("beforeinstallprompt", handler);
        window.addEventListener("appinstalled", installed);
        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", installed);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Fetch WhatsApp link ──
    useEffect(() => {
        if (!shouldShow) return;
        fetch("/api/settings/public")
            .then(r => r.json())
            .then(json => {
                const link = (json.data?.whatsAppGroups || [])[0] || "";
                setWhatsAppLink(link);
            })
            .catch(() => setWhatsAppLink(""));
    }, [shouldShow]);

    // ── Step completed handler ──
    const markStepDone = useCallback((id: StepId) => {
        setCompletedSteps(prev => {
            const next = new Set(prev);
            next.add(id);

            // All done? Permanently dismiss
            if (next.size >= TOTAL_STEPS) {
                localStorage.setItem(COMPLETED_KEY, "true");
                setTimeout(() => setShouldShow(false), 800);
            }
            return next;
        });
    }, []);

    // ── Auto-advance to next incomplete step ──
    useEffect(() => {
        if (completedSteps.has(STEPS[currentStep]?.id)) {
            const nextIncomplete = STEPS.findIndex((s, i) => i > currentStep && !completedSteps.has(s.id));
            if (nextIncomplete >= 0) {
                setTimeout(() => setCurrentStep(nextIncomplete), 600);
            }
        }
    }, [completedSteps, currentStep]);

    // ── When location is set via profile refetch, mark step done ──
    useEffect(() => {
        if (hasLocation && shouldShow) {
            markStepDone("location");
        }
    }, [hasLocation, shouldShow, markStepDone]);

    // ── Actions ──
    const handleWhatsApp = useCallback(() => {
        if (!whatsAppLink) return;
        window.open(whatsAppLink, "_blank", "noopener,noreferrer");
        const groups = ["main-group"];
        localStorage.setItem("whatsapp_joined_groups", JSON.stringify(groups));
        markStepDone("whatsapp");
    }, [whatsAppLink, markStepDone]);

    const handleInstallPWA = useCallback(async () => {
        if (deferredPrompt) {
            setInstalling(true);
            try {
                await deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === "accepted") {
                    localStorage.setItem("pwa-installed", "true");
                    markStepDone("pwa");
                }
            } catch {}
            setInstalling(false);
            setDeferredPrompt(null);
        }
    }, [deferredPrompt, markStepDone]);

    const handleEnableNotifications = useCallback(async () => {
        if (typeof Notification === "undefined") {
            toast.error("Notifications are not supported in this browser");
            return;
        }
        setSubscribing(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                const reg = await navigator.serviceWorker?.ready;
                if (reg) {
                    const sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_TOKEN,
                    });
                    await fetch("/api/push/subscribe", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(sub.toJSON()),
                    });
                }
                toast.success("Notifications enabled! 🔔");
                markStepDone("notifications");
            } else {
                toast.error("Permission denied — you can enable later in Settings");
            }
        } catch {
            toast.error("Failed to enable notifications");
        }
        setSubscribing(false);
    }, [markStepDone]);

    const handleSkipAll = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, String(Date.now() + SKIP_DURATION));
        setShouldShow(false);
    }, []);

    const handleSkipStep = useCallback(() => {
        const nextIncomplete = STEPS.findIndex((s, i) => i > currentStep && !completedSteps.has(s.id));
        if (nextIncomplete >= 0) {
            setCurrentStep(nextIncomplete);
        } else {
            handleSkipAll();
        }
    }, [currentStep, completedSteps, handleSkipAll]);

    // Derived
    const activeStep = STEPS[currentStep];
    const progressCount = completedSteps.size;

    // iOS PWA instructions
    const showIOSInstructions = activeStep?.id === "pwa" && isIOS() && !deferredPrompt;
    const showAndroidManual = activeStep?.id === "pwa" && !isIOS() && !deferredPrompt && isMobile();
    const notifUnsupported = activeStep?.id === "notifications" &&
        (typeof Notification === "undefined" || !("serviceWorker" in navigator));

    if (!hydrated || !shouldShow || !activeStep) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                />

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    transition={{ type: "spring", damping: 28, stiffness: 300 }}
                    className="relative w-full max-w-sm mx-3 mb-3 sm:mb-0 rounded-2xl bg-background border border-divider shadow-2xl overflow-hidden"
                >
                    {/* Progress bar */}
                    <div className="h-1 bg-foreground/5">
                        <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(progressCount / TOTAL_STEPS) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>

                    {/* Header */}
                    <div className="px-5 pt-5 pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold">Quick Setup</h2>
                                <p className="text-xs text-foreground/40 mt-0.5">
                                    Step {currentStep + 1} of {TOTAL_STEPS} · {progressCount} done
                                </p>
                            </div>
                            <button
                                onClick={handleSkipAll}
                                className="text-[11px] text-foreground/30 hover:text-foreground/50 transition-colors"
                            >
                                Skip all
                            </button>
                        </div>
                    </div>

                    {/* Step indicators */}
                    <div className="px-5 pb-4 flex items-center gap-1.5">
                        {STEPS.map((step, i) => {
                            const isDone = completedSteps.has(step.id);
                            const isActive = i === currentStep;
                            return (
                                <div key={step.id} className="flex items-center gap-1.5 flex-1">
                                    <div className={`
                                        flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-all duration-300
                                        ${isDone ? step.color : isActive ? step.color : "bg-foreground/10"}
                                    `}>
                                        {isDone ? (
                                            <Check className="w-3.5 h-3.5 text-white" />
                                        ) : (
                                            <span className={isActive ? "" : "opacity-40"}>
                                                {step.icon}
                                            </span>
                                        )}
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${isDone ? "bg-primary/40" : "bg-foreground/10"}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Active step content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeStep.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="px-5 pb-5"
                        >
                            <div className="rounded-xl bg-foreground/[0.03] border border-divider p-4 space-y-4">
                                <div>
                                    <p className="text-sm font-bold">{activeStep.title}</p>
                                    <p className="text-xs text-foreground/40 mt-0.5">{activeStep.subtitle}</p>
                                </div>

                                {/* WhatsApp step */}
                                {activeStep.id === "whatsapp" && (
                                    <Button
                                        className="w-full font-bold text-white bg-[#25D366]"
                                        startContent={<WhatsAppIcon className="w-4 h-4" />}
                                        onPress={handleWhatsApp}
                                        isDisabled={!whatsAppLink}
                                    >
                                        Join Group
                                    </Button>
                                )}

                                {/* PWA step — Native prompt */}
                                {activeStep.id === "pwa" && deferredPrompt && (
                                    <Button
                                        color="primary"
                                        className="w-full font-bold"
                                        startContent={!installing ? <Download className="w-4 h-4" /> : undefined}
                                        isLoading={installing}
                                        onPress={handleInstallPWA}
                                    >
                                        {installing ? "Installing..." : "Install App"}
                                    </Button>
                                )}

                                {/* PWA step — iOS manual */}
                                {showIOSInstructions && (
                                    <div className="space-y-3">
                                        <div className="space-y-2 text-xs text-foreground/60">
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
                                            className="w-full font-semibold"
                                            onPress={() => {
                                                localStorage.setItem("pwa-installed", "true");
                                                markStepDone("pwa");
                                            }}
                                        >
                                            I&apos;ve added it ✓
                                        </Button>
                                    </div>
                                )}

                                {/* PWA step — Android manual (no prompt event) */}
                                {showAndroidManual && (
                                    <div className="space-y-3">
                                        <div className="space-y-2 text-xs text-foreground/60">
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
                                            className="w-full font-semibold"
                                            onPress={() => {
                                                localStorage.setItem("pwa-installed", "true");
                                                markStepDone("pwa");
                                            }}
                                        >
                                            I&apos;ve installed it ✓
                                        </Button>
                                    </div>
                                )}

                                {/* PWA — Desktop (auto-skip message) */}
                                {activeStep.id === "pwa" && !isMobile() && (
                                    <p className="text-xs text-foreground/40 text-center">Desktop detected — skipping</p>
                                )}

                                {/* Notifications step */}
                                {activeStep.id === "notifications" && !notifUnsupported && (
                                    <Button
                                        className="w-full font-bold bg-amber-500 text-white"
                                        startContent={!subscribing ? <Bell className="w-4 h-4" /> : undefined}
                                        isLoading={subscribing}
                                        onPress={handleEnableNotifications}
                                    >
                                        {subscribing ? "Enabling..." : "Enable Notifications"}
                                    </Button>
                                )}

                                {notifUnsupported && (
                                    <p className="text-xs text-foreground/40 text-center">
                                        Install the app first to enable notifications
                                    </p>
                                )}

                                {/* Location step — opens LocationModal */}
                                {activeStep.id === "location" && (
                                    <Button
                                        className="w-full font-bold bg-violet-500 text-white"
                                        startContent={<MapPin className="w-4 h-4" />}
                                        onPress={() => setLocationModalOpen(true)}
                                    >
                                        Add Location
                                    </Button>
                                )}
                            </div>

                            {/* Skip this step */}
                            <button
                                onClick={handleSkipStep}
                                className="w-full mt-3 text-xs text-foreground/30 hover:text-foreground/50 transition-colors flex items-center justify-center gap-1"
                            >
                                Skip for now
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Location Modal — opens on top of wizard */}
            <LocationModal
                isOpen={locationModalOpen}
                blocking={false}
                onComplete={() => {
                    setLocationModalOpen(false);
                    markStepDone("location");
                }}
            />
        </AnimatePresence>
    );
}
