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

type PwaState = "loading" | "ok" | "android" | "ios";

/**
 * PwaInstallPrompt — Mandatory PWA install gate.
 *
 * If a signed-in player is on mobile and hasn't installed the app,
 * shows an un-closable modal with install instructions.
 *
 * - Android Chrome: Native install prompt via beforeinstallprompt
 * - iOS Safari: Step-by-step instructions (Share → Add to Home Screen)
 * - Desktop: Skipped (not mandatory)
 * - Already installed: Skipped
 */
export function PwaInstallPrompt() {
    const { isSignedIn } = useAuthUser();
    const [state, setState] = useState<PwaState>("loading");
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        // Delay check to let page render first
        const timer = setTimeout(() => {
            if (!isSignedIn) return;

            // Already installed as PWA
            if (isStandalone()) {
                localStorage.setItem(INSTALLED_KEY, "true");
                setState("ok");
                return;
            }

            // Already marked as installed
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

            // Android — wait for beforeinstallprompt
            setState("android");
        }, 3000);

        return () => clearTimeout(timer);
    }, [isSignedIn]);

    // Listen for beforeinstallprompt (Android Chrome/Edge)
    useEffect(() => {
        if (state !== "android") return;

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener("beforeinstallprompt", handler);

        // If already installed
        const installed = () => {
            localStorage.setItem(INSTALLED_KEY, "true");
            setState("ok");
        };
        window.addEventListener("appinstalled", installed);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", installed);
        };
    }, [state]);

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
                        {/* ── Android: Native install ── */}
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
                                    /* Prompt not fired yet — show manual instructions */
                                    <>
                                        <div className="text-left space-y-3 bg-foreground/[0.03] rounded-lg p-4">
                                            <div className="flex items-start gap-3 text-sm text-foreground/70">
                                                <span className="text-lg shrink-0">1.</span>
                                                <span>Tap the <strong>⋮ menu</strong> (3 dots) at the top right</span>
                                            </div>
                                            <div className="flex items-start gap-3 text-sm text-foreground/70">
                                                <span className="text-lg shrink-0">2.</span>
                                                <span>Tap <strong>&quot;Add to Home screen&quot;</strong> or <strong>&quot;Install app&quot;</strong></span>
                                            </div>
                                            <div className="flex items-start gap-3 text-sm text-foreground/70">
                                                <span className="text-lg shrink-0">3.</span>
                                                <span>Open the app from your home screen</span>
                                            </div>
                                        </div>
                                        <Button
                                            color="default"
                                            variant="flat"
                                            size="lg"
                                            className="w-full font-semibold"
                                            onPress={() => window.location.reload()}
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
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">1.</span>
                                        <span>
                                            Tap the <Share className="w-4 h-4 inline text-primary" /> <strong>Share</strong> button at the bottom of Safari
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">2.</span>
                                        <span>
                                            Scroll down and tap <Plus className="w-4 h-4 inline text-primary" /> <strong>&quot;Add to Home Screen&quot;</strong>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">3.</span>
                                        <span>Tap <strong>Add</strong> in the top right</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-foreground/70">
                                        <span className="text-lg shrink-0">4.</span>
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
                                    onPress={() => window.location.reload()}
                                >
                                    I&apos;ve added it — Refresh
                                </Button>
                            </>
                        )}
                    </motion.div>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
