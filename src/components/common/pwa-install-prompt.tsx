"use client";

import { useState, useEffect } from "react";
import { Modal, ModalContent, ModalBody, Button } from "@heroui/react";
import { Download, Share, Plus, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { GAME, GAME_MODE } from "@/lib/game-config";
import { useAuthUser } from "@/hooks/use-auth-user";

const ICON_DIRS: Record<string, string> = { freefire: "freefire", pes: "pes", mlbb: "mlbb" };
const PWA_ICON = `/icons/${ICON_DIRS[GAME_MODE] ?? "bgmi"}/icon-192x192.png`;

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALLED_KEY = "pwa-installed";

/* ── Detection helpers ────────────────────────────── */

function isStandalone(): boolean {
    return window.matchMedia("(display-mode: standalone)").matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true;
}

function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

type AndroidBrowser = "brave" | "samsung" | "firefox" | "opera" | "chrome";

function detectAndroidBrowser(): AndroidBrowser {
    const ua = navigator.userAgent;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((navigator as any).brave) return "brave";
    if (/SamsungBrowser/i.test(ua)) return "samsung";
    if (/Firefox/i.test(ua) && !/Seamonkey/i.test(ua)) return "firefox";
    if (/OPR|Opera/i.test(ua)) return "opera";
    return "chrome"; // Chrome, Edge, Chromium-based
}

/** Browser-specific install instructions for Android */
function getAndroidInstructions(browser: AndroidBrowser): { steps: string[]; note?: string } {
    switch (browser) {
        case "brave":
            return {
                steps: [
                    "Tap the ⋮ menu (3 dots) at the bottom right",
                    'Tap "Add to Home screen"',
                    "Tap Add to confirm",
                    "Open the app from your home screen",
                ],
            };
        case "samsung":
            return {
                steps: [
                    "Tap the ≡ menu (3 lines) at the bottom right",
                    'Tap "Add page to" → "Home screen"',
                    "Tap Add to confirm",
                    "Open the app from your home screen",
                ],
            };
        case "firefox":
            return {
                steps: [
                    "Tap the ⋮ menu (3 dots) at the top right",
                    'Tap "Install"',
                    "Tap Add to Home screen",
                    "Open the app from your home screen",
                ],
            };
        case "opera":
            return {
                steps: [
                    "Tap the ⋮ menu (3 dots)",
                    'Tap "Add to Home screen"',
                    "Tap Add to confirm",
                    "Open the app from your home screen",
                ],
            };
        default: // chrome
            return {
                steps: [
                    "Tap the ⋮ menu (3 dots) at the top right",
                    'Tap "Add to Home screen" or "Install app"',
                    "Tap Install to confirm",
                    "Open the app from your home screen",
                ],
            };
    }
}

type PwaState = "loading" | "ok" | "android" | "ios" | "browser-nudge";

/**
 * PwaInstallPrompt — Mandatory PWA install gate.
 *
 * If a signed-in player is on mobile and hasn't installed the app,
 * shows an un-closable modal with browser-specific install instructions.
 *
 * - Android Chrome: Native install prompt via beforeinstallprompt
 * - Android Brave/Samsung/Firefox: Browser-specific manual steps
 * - iOS Safari: Share → Add to Home Screen guide
 * - Desktop: Skipped (not mandatory)
 * - Already installed: Skipped
 */
export function PwaInstallPrompt({ onSkip }: { onSkip?: () => void } = {}) {
    const { isSignedIn } = useAuthUser();
    const [state, setState] = useState<PwaState>("loading");
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installing, setInstalling] = useState(false);
    const [androidBrowser, setAndroidBrowser] = useState<AndroidBrowser>("chrome");

    // Capture beforeinstallprompt IMMEDIATELY on mount (before any delay)
    // The event can fire at any time, so we must listen from the start.
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        const installed = () => {
            localStorage.setItem(INSTALLED_KEY, "true");
            setState("ok");
        };

        window.addEventListener("beforeinstallprompt", handler);
        window.addEventListener("appinstalled", installed);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", installed);
        };
    }, []);

    useEffect(() => {
        // Delay check to let page render first
        const timer = setTimeout(() => {
            if (!isSignedIn) return;

            // Already installed as PWA (currently in standalone mode)
            if (isStandalone()) {
                localStorage.setItem(INSTALLED_KEY, "true");
                setState("ok");
                return;
            }

            // Already installed but browsing via browser — nudge (1-day dismiss)
            if (localStorage.getItem(INSTALLED_KEY) === "true" && isMobile()) {
                const nudgeDismissed = localStorage.getItem("pwa-nudge-until");
                if (nudgeDismissed && Date.now() < Number(nudgeDismissed)) {
                    setState("ok");
                } else {
                    setState("browser-nudge");
                }
                return;
            }

            // Already marked as installed on desktop — skip
            if (localStorage.getItem(INSTALLED_KEY) === "true") {
                setState("ok");
                return;
            }

            // Desktop — not mandatory
            if (!isMobile()) {
                setState("ok");
                return;
            }

            // iOS — show manual instructions
            if (isIOS()) {
                setState("ios");
                return;
            }

            // Android — detect browser
            setAndroidBrowser(detectAndroidBrowser());
            setState("android");
        }, 3000);

        return () => clearTimeout(timer);
    }, [isSignedIn]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        setInstalling(true);
        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === "accepted") {
                localStorage.setItem(INSTALLED_KEY, "true");
                setState("ok");
            }
        } catch {
            // Ignored
        }
        setInstalling(false);
        setDeferredPrompt(null);
    };

    if (state === "loading" || state === "ok") return null;

    // Gentle nudge — not blocking, just a banner
    if (state === "browser-nudge") {
        return (
            <motion.div
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                className="fixed top-0 left-0 right-0 z-50 safe-top"
            >
                <div className="mx-3 mt-3 rounded-xl bg-content1 border border-primary/20 shadow-lg p-3 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={PWA_ICON} alt="" className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{GAME.name}</p>
                        <p className="text-xs text-foreground/50">Open the installed app for best experience</p>
                    </div>
                    <button
                        onClick={() => {
                            localStorage.setItem("pwa-nudge-until", String(Date.now() + 24 * 60 * 60 * 1000));
                            setState("ok");
                        }}
                        className="text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors shrink-0"
                    >
                        Dismiss
                    </button>
                </div>
                {/* Reinstall option for users who uninstalled */}
                <div className="mx-3 mt-1.5 text-center">
                    <button
                        onClick={() => {
                            localStorage.removeItem(INSTALLED_KEY);
                            if (isIOS()) {
                                setState("ios");
                            } else {
                                setAndroidBrowser(detectAndroidBrowser());
                                setState("android");
                            }
                        }}
                        className="text-[11px] text-foreground/30 hover:text-foreground/50 transition-colors underline underline-offset-2"
                    >
                        Uninstalled? Tap to reinstall
                    </button>
                </div>
            </motion.div>
        );
    }

    const instructions = getAndroidInstructions(androidBrowser);
    const browserLabel = androidBrowser === "chrome" ? "Chrome"
        : androidBrowser === "brave" ? "Brave"
        : androidBrowser === "samsung" ? "Samsung Internet"
        : androidBrowser === "firefox" ? "Firefox"
        : "Opera";

    return (
        <Modal
            isOpen={true}
            isDismissable={!!onSkip}
            hideCloseButton
            onClose={onSkip}
            placement="center"
            size="sm"
            backdrop="blur"
            classNames={{ wrapper: "z-[60]", backdrop: "z-[59]" }}
        >
            <ModalContent>
                <ModalBody className="px-6 py-8">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-5 text-center"
                    >
                        {/* ── Android ── */}
                        {state === "android" && (
                            <>
                                <div className="flex justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={PWA_ICON} alt={GAME.name} className="w-10 h-10 rounded-xl" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Install {GAME.name}</h2>
                                    <p className="text-sm text-foreground/50 mt-1">
                                        Add to your home screen for the best experience
                                    </p>
                                </div>
                                <div className="text-left space-y-2 bg-foreground/[0.03] rounded-lg p-3">
                                    {[
                                        "⚡ Faster loading — works like a real app",
                                        "🔔 Push notifications for room info",
                                        "📱 Full-screen experience",
                                        "💾 Only ~1.5 MB",
                                    ].map((item) => (
                                        <div key={item} className="text-xs text-foreground/60">
                                            {item}
                                        </div>
                                    ))}
                                </div>
                                {deferredPrompt ? (
                                    <Button
                                        color="primary"
                                        size="lg"
                                        className="w-full font-semibold"
                                        isLoading={installing}
                                        startContent={!installing ? <Download className="w-4 h-4" /> : undefined}
                                        onPress={handleInstall}
                                    >
                                        {installing ? "Installing..." : "Install App"}
                                    </Button>
                                ) : (
                                    /* Browser-specific manual instructions */
                                    <>
                                        <div className="text-left space-y-3 bg-foreground/[0.03] rounded-lg p-4">
                                            <p className="text-[10px] font-medium text-foreground/40 uppercase tracking-wider mb-2">
                                                Steps for {browserLabel}
                                            </p>
                                            {instructions.steps.map((step, i) => (
                                                <div key={i} className="flex items-start gap-3 text-sm text-foreground/70">
                                                    <span className="text-lg shrink-0 font-semibold text-primary/60">{i + 1}.</span>
                                                    <span dangerouslySetInnerHTML={{ __html: step.replace(/"([^"]+)"/g, '<strong>"$1"</strong>') }} />
                                                </div>
                                            ))}
                                        </div>
                                        <Button
                                            color="default"
                                            variant="flat"
                                            size="lg"
                                            className="w-full font-semibold"
                                            onPress={() => {
                                                localStorage.setItem(INSTALLED_KEY, "true");
                                                window.location.reload();
                                            }}
                                        >
                                            I&apos;ve installed it — Refresh
                                        </Button>
                                    </>
                                )}
                            </>
                        )}

                        {/* ── iOS: Manual instructions ── */}
                        {state === "ios" && (
                            <>
                                <div className="flex justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <Smartphone className="w-7 h-7 text-primary" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Add to Home Screen</h2>
                                    <p className="text-sm text-foreground/50 mt-1">
                                        Install {GAME.name} on your iPhone for push notifications &amp; the best experience
                                    </p>
                                </div>
                                <div className="text-left space-y-3 bg-foreground/[0.03] rounded-lg p-4">
                                    <p className="text-[10px] font-medium text-foreground/40 uppercase tracking-wider mb-2">
                                        Steps for Safari
                                    </p>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0 font-semibold text-primary/60">1.</span>
                                        <span>
                                            Tap the <Share className="w-4 h-4 inline text-primary" /> <strong>Share</strong> button at the bottom
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0 font-semibold text-primary/60">2.</span>
                                        <span>
                                            Scroll down and tap <Plus className="w-4 h-4 inline text-primary" /> <strong>&quot;Add to Home Screen&quot;</strong>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0 font-semibold text-primary/60">3.</span>
                                        <span>Tap <strong>Add</strong> in the top right</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0 font-semibold text-primary/60">4.</span>
                                        <span>Open the app from your home screen</span>
                                    </div>
                                </div>
                                <p className="text-xs text-foreground/30">
                                    Push notifications &amp; full-screen mode only work when installed from home screen
                                </p>
                                <Button
                                    color="default"
                                    variant="flat"
                                    size="lg"
                                    className="w-full font-semibold"
                                    onPress={() => {
                                        localStorage.setItem(INSTALLED_KEY, "true");
                                        window.location.reload();
                                    }}
                                >
                                    I&apos;ve added it — Refresh
                                </Button>
                            </>
                        )}

                        {/* Skip option */}
                        {onSkip && (
                            <button
                                type="button"
                                onClick={onSkip}
                                className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors mt-2"
                            >
                                Maybe later
                            </button>
                        )}
                    </motion.div>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
