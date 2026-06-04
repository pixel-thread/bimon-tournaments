"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Modal, ModalContent, ModalBody } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Download, Shield, Link2, Loader2, Smartphone } from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth-user";

const DISCORD_BLURPLE = "#5865F2";
const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE_LINK || "https://discord.gg/Bgq8MaRB";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.discord";
const APP_STORE = "https://apps.apple.com/app/discord-talk-chat-hang-out/id985746746";

/* ─── All text labels — replace with Khasi below ─────────────── */

const LABELS = {
    // Header
    headerTitle: "Link your Discord",
    headerSubtitle: "Follow these steps to connect — takes ~3 minutes",

    // Steps titles & subtitles
    step1Title: "Download Discord",
    step1Subtitle: "Get the app on your phone",
    step2Title: "Create & Verify Account",
    step2Subtitle: "Sign up with phone number",
    step3Title: "Link to Bimon",
    step3Subtitle: "Connect & auto-join our server",

    // Step 1 content
    step1Desc: "Discord is a free gaming chat app used by",
    step1Gamers: "200M+ gamers",
    step1Worldwide: "worldwide.",
    step1Android: "Android",
    step1PlayStore: "Play Store",
    step1iPhone: "iPhone",
    step1AppStore: "App Store",
    step1Done: "✅ I have Discord installed",

    // Step 2 content
    step2Action1: "Open the Discord app and tap",
    step2Action1Bold: "Register",
    step2Action2: "Sign up with your",
    step2Action2Bold: "phone number",
    step2Action2Suffix: "",
    step2Action2Hint: "Only the app lets you use phone number — auto-verifies, no extra steps!",
    step2Action3: "Complete the",
    step2Action3Bold: "robot check",
    step2Action3Hint: "Drag puzzle — this is normal, everyone does it!",
    step2EmailWarning: "⚠️ Don't sign up on the website — it only allows email and you'll need to verify it separately. Use the app instead!",
    step2Done: "✅ Done, I'm verified",

    // Step 3 content (Link — auto-joins server)
    step3Desc: "This will open Discord in a new tab. Just tap",
    step3DescBold: "\"Authorize\"",
    step3DescEnd: "and come back here. You'll auto-join our server too!",
    step3LinkBtn: "Link Discord Account",
    step3Waiting: "Waiting for you to authorize...",
    step3WaitingHint: "Complete the authorization in the other tab",
    step3OpenAgain: "Open Discord again →",

    // Success
    successTitle: "You're all set!",
    successSubtitle: "Discord linked & server joined 🎉",

    // Initial question
    askTitle: "Do you have a Discord account?",
    askYes: "Yes, I have one",
    askNo: "No, I'm new to Discord",
    switchToExisting: "I already have Discord →",

    // Collapsible image
    seeExample: "See example",

    // Skip
    skip: "Skip for now →",
};

/* ─── Collapsible Screenshot ─────────────────────────────────── */

function CollapsibleImage({ src, alt }: { src: string; alt: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mx-4">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer"
                style={{ color: DISCORD_BLURPLE }}
            >
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                {LABELS.seeExample}
            </button>
            {open && (
                <div className="mt-1.5 rounded-lg overflow-hidden border border-divider/50 animate-in slide-in-from-top-2 duration-200">
                    <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
                </div>
            )}
        </div>
    );
}

/* ─── Icons ──────────────────────────────────────────────────── */

function DiscordIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
        </svg>
    );
}

/* ─── Step Data ──────────────────────────────────────────────── */

interface StepConfig {
    id: number;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
}

const STEPS: StepConfig[] = [
    {
        id: 1,
        title: LABELS.step1Title,
        subtitle: LABELS.step1Subtitle,
        icon: <Download className="w-4 h-4" />,
    },
    {
        id: 2,
        title: LABELS.step2Title,
        subtitle: LABELS.step2Subtitle,
        icon: <Shield className="w-4 h-4" />,
    },
    {
        id: 3,
        title: LABELS.step3Title,
        subtitle: LABELS.step3Subtitle,
        icon: <Link2 className="w-4 h-4" />,
    },
];

/* ─── Hook (kept for backward compat) ────────────────────────── */

export function useDiscordCompareModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [redirectUrl, setRedirectUrl] = useState("");

    const openDiscordModal = useCallback((url: string) => {
        setRedirectUrl(url);
        setIsOpen(true);
    }, []);

    const handleLink = useCallback(() => {
        if (redirectUrl) {
            window.open(redirectUrl, "_blank");
        }
    }, [redirectUrl]);

    const DiscordCompareModal = useCallback(() => (
        <CompareModalUI isOpen={isOpen} onClose={() => setIsOpen(false)} onLink={handleLink} />
    ), [isOpen, handleLink]);

    return { openDiscordModal, DiscordCompareModal };
}

/* ─── Main Stepper Modal ─────────────────────────────────────── */

export function CompareModalUI({
    isOpen,
    onClose,
    onLink,
    hideClose,
    onSkip,
}: {
    isOpen: boolean;
    onClose?: () => void;
    onLink: () => void;
    hideClose?: boolean;
    onSkip?: () => void;
}) {
    const { user, refetch } = useAuthUser();
    const queryClient = useQueryClient();
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [activeStep, setActiveStep] = useState(1);
    const [isPolling, setIsPolling] = useState(false);
    const [isLinked, setIsLinked] = useState(false);
    const [hasAccount, setHasAccount] = useState<boolean | null>(null); // null = not answered yet
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Check if already linked on mount
    useEffect(() => {
        if (user?.player?.discordId) {
            setIsLinked(true);
            setCompletedSteps(new Set([1, 2, 3]));
        }
    }, [user?.player?.discordId]);

    // Auto-close after linking
    useEffect(() => {
        if (isLinked) {
            const timer = setTimeout(() => {
                onClose?.();
                onSkip?.();
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [isLinked, onClose, onSkip]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const markComplete = useCallback((step: number) => {
        setCompletedSteps(prev => {
            const next = new Set(prev);
            next.add(step);
            return next;
        });
        // Auto-advance to next step
        if (step < 3) setActiveStep(step + 1);
    }, []);

    const startPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIsPolling(true);

        pollingRef.current = setInterval(async () => {
            try {
                const result = await refetch();
                if (result.data?.player?.discordId) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    pollingRef.current = null;
                    setIsPolling(false);
                    setIsLinked(true);
                    setCompletedSteps(new Set([1, 2, 3]));
                    // Invalidate profile & auth queries so the UI updates everywhere
                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                    queryClient.invalidateQueries({ queryKey: ["auth-user"] });
                }
            } catch {
                // ignore polling errors
            }
        }, 3000);
    }, [refetch]);

    const isPwa = typeof window !== "undefined" && (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
    );

    /** Open a URL in the system browser (not inside PWA webview) */
    const openExternal = useCallback((url: string) => {
        if (isPwa) {
            // Create a temporary <a> with target=_blank and rel=noopener
            // This forces the system browser on most PWA implementations
            const a = document.createElement("a");
            a.href = url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            window.open(url, "_blank");
        }
    }, [isPwa]);

    const handleLinkClick = useCallback(() => {
        const returnTo = window.location.pathname.replace("/", "") || "vote";
        const authUrl = `/api/discord/authorize?returnTo=${returnTo}`;

        if (isPwa) {
            // In PWA, navigate away — callback will redirect back to the app
            window.location.href = authUrl;
        } else {
            // In browser, open new tab and poll for completion
            window.open(authUrl, "_blank");
            startPolling();
        }
    }, [isPwa, startPolling]);

    // The highest step the player can reach (completed + the next one)
    const nextAvailableStep = completedSteps.size > 0
        ? Math.max(...Array.from(completedSteps)) + 1
        : 1;

    const handleToggleStep = useCallback((step: number) => {
        // Can expand completed steps or the next available step
        if (completedSteps.has(step) || step <= nextAvailableStep) {
            setActiveStep(prev => prev === step ? -1 : step);
        }
    }, [completedSteps, nextAvailableStep]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            hideCloseButton={hideClose}
            isDismissable={!hideClose}
            isKeyboardDismissDisabled={hideClose}
            placement="center"
            size="md"
            classNames={{
                backdrop: "bg-black/60 backdrop-blur-sm",
                base: "border border-divider bg-background mx-3 shadow-2xl max-h-[90dvh] overflow-y-auto",
            }}
        >
            <ModalContent>
                <ModalBody className="py-5 px-4 space-y-4">
                    {/* Header */}
                    <div className="text-center space-y-1.5">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-1" style={{ backgroundColor: `${DISCORD_BLURPLE}20` }}>
                            <DiscordIcon className="w-6 h-6" style={{ color: DISCORD_BLURPLE }} />
                        </div>
                        <h3 className="text-lg font-bold">{LABELS.headerTitle}</h3>
                        <p className="text-[11px] text-foreground/40">
                            {LABELS.headerSubtitle}
                        </p>
                    </div>

                    {/* Success State */}
                    {isLinked && (
                        <div className="flex flex-col items-center gap-2 py-4 animate-in fade-in zoom-in duration-300">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <Check className="w-7 h-7 text-emerald-500" strokeWidth={3} />
                            </div>
                            <p className="text-sm font-bold text-emerald-500">{LABELS.successTitle}</p>
                            <p className="text-[11px] text-foreground/40">{LABELS.successSubtitle}</p>
                        </div>
                    )}

                    {/* Initial Question: Do you have Discord? */}
                    {!isLinked && hasAccount === null && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                            <p className="text-center text-[13px] font-semibold">{LABELS.askTitle}</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasAccount(true);
                                        setCompletedSteps(new Set([1, 2]));
                                        setActiveStep(3);
                                    }}
                                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 border-[#5865F2]/30 bg-[#5865F2]/[0.04] hover:bg-[#5865F2]/[0.08] transition-colors"
                                >
                                    <Check className="w-5 h-5" style={{ color: DISCORD_BLURPLE }} />
                                    <span className="text-[11px] font-semibold">{LABELS.askYes}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasAccount(false);
                                        setActiveStep(1);
                                    }}
                                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 border-divider bg-default-50 hover:bg-default-100 transition-colors"
                                >
                                    <Download className="w-5 h-5 text-foreground/40" />
                                    <span className="text-[11px] font-semibold">{LABELS.askNo}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Steps — only show after answering the question */}
                    {!isLinked && hasAccount !== null && (
                        <div className="space-y-2">
                            {STEPS.map((step) => {
                                const isCompleted = completedSteps.has(step.id);
                                const isActive = activeStep === step.id;
                                const isLocked = step.id > nextAvailableStep && !isCompleted;

                                return (
                                    <div
                                        key={step.id}
                                        className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                                            isCompleted
                                                ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                                                : isActive
                                                ? "border-[#5865F2]/40 bg-[#5865F2]/[0.04]"
                                                : isLocked
                                                ? "border-divider/50 bg-default-50/30 opacity-50"
                                                : "border-divider bg-default-50/50"
                                        }`}
                                    >
                                        {/* Step Header (clickable) */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleStep(step.id)}
                                            disabled={isLocked}
                                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
                                        >
                                            {/* Step Number / Check */}
                                            <div
                                                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                                                    isCompleted
                                                        ? "bg-emerald-500 text-white"
                                                        : isActive
                                                        ? "text-white"
                                                        : "bg-default-200 text-foreground/40"
                                                }`}
                                                style={isActive && !isCompleted ? { backgroundColor: DISCORD_BLURPLE } : undefined}
                                            >
                                                {isCompleted ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : step.id}
                                            </div>

                                            {/* Title & Subtitle */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[13px] font-semibold ${isCompleted ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                                                    {step.title}
                                                </p>
                                                <p className="text-[10px] text-foreground/35 truncate">{step.subtitle}</p>
                                            </div>

                                            {/* Chevron */}
                                            {!isLocked && (
                                                <ChevronDown
                                                    className={`w-4 h-4 text-foreground/25 transition-transform duration-200 ${isActive ? "rotate-180" : ""}`}
                                                />
                                            )}
                                        </button>

                                        {/* Expanded Content */}
                                        {isActive && (
                                            <div className="px-3.5 pb-3.5 pt-0 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                <div className="h-px bg-divider/50" />

                                                {step.id === 1 && (
                                                    <StepDownload onDone={() => markComplete(1)} openExternal={openExternal} />
                                                )}
                                                {step.id === 2 && (
                                                    <StepVerify onDone={() => markComplete(2)} />
                                                )}
                                                {step.id === 3 && (
                                                    <StepLink
                                                        onLinkClick={handleLinkClick}
                                                        isPolling={isPolling}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Switch path + Skip */}
                    {!isLinked && (
                        <div className="flex flex-col items-center gap-1.5 pt-1">
                            {/* Show "I already have Discord" when on the new-user path */}
                            {hasAccount === false && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasAccount(true);
                                        setCompletedSteps(new Set([1, 2]));
                                        setActiveStep(3);
                                    }}
                                    className="text-[11px] font-medium hover:text-foreground/60 transition-colors cursor-pointer" style={{ color: DISCORD_BLURPLE }}
                                >
                                    {LABELS.switchToExisting}
                                </button>
                            )}
                            {onSkip && (
                                <button
                                    type="button"
                                    onClick={onSkip}
                                    className="text-[11px] text-foreground/20 hover:text-foreground/40 transition-colors cursor-pointer"
                                >
                                    {LABELS.skip}
                                </button>
                            )}
                        </div>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

/* ─── Step 1: Download ───────────────────────────────────────── */

function StepDownload({ onDone, openExternal }: { onDone: () => void; openExternal: (url: string) => void }) {
    return (
        <div className="space-y-3">
            <p className="text-[11px] text-foreground/50">
                {LABELS.step1Desc} <span className="font-semibold text-foreground/70">{LABELS.step1Gamers}</span> {LABELS.step1Worldwide}
            </p>

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => openExternal(PLAY_STORE)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-divider bg-default-50 hover:bg-default-100 transition-colors text-left"
                >
                    <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                        <p className="text-[9px] text-foreground/30 uppercase tracking-wider">{LABELS.step1Android}</p>
                        <p className="text-[11px] font-semibold">{LABELS.step1PlayStore}</p>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => openExternal(APP_STORE)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-divider bg-default-50 hover:bg-default-100 transition-colors text-left"
                >
                    <Smartphone className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                        <p className="text-[9px] text-foreground/30 uppercase tracking-wider">{LABELS.step1iPhone}</p>
                        <p className="text-[11px] font-semibold">{LABELS.step1AppStore}</p>
                    </div>
                </button>
            </div>

            <button
                type="button"
                onClick={onDone}
                className="w-full text-[12px] font-semibold py-2 rounded-lg transition-colors text-white"
                style={{ backgroundColor: DISCORD_BLURPLE }}
            >
                {LABELS.step1Done}
            </button>
        </div>
    );
}

/* ─── Step 2: Create & Verify ────────────────────────────────── */

function StepVerify({ onDone }: { onDone: () => void }) {
    return (
        <div className="space-y-3">
            <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#5865F2]/15 flex items-center justify-center text-[9px] font-bold" style={{ color: DISCORD_BLURPLE }}>1</span>
                    <p className="text-[11px] text-foreground/60">
                        {LABELS.step2Action1} <span className="font-semibold text-foreground/80">{LABELS.step2Action1Bold}</span>
                    </p>
                </div>
                {/* Screenshot: Discord register screen */}
                <CollapsibleImage src="/discord-guide/step2-register.png" alt="Discord Register button" />
                <div className="flex items-start gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#5865F2]/15 flex items-center justify-center text-[9px] font-bold" style={{ color: DISCORD_BLURPLE }}>2</span>
                    <div>
                        <p className="text-[11px] text-foreground/60">
                            {LABELS.step2Action2} <span className="font-bold text-emerald-500">{LABELS.step2Action2Bold}</span> {LABELS.step2Action2Suffix}
                        </p>
                        <p className="text-[9px] text-foreground/30 mt-0.5">
                            {LABELS.step2Action2Hint}
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#5865F2]/15 flex items-center justify-center text-[9px] font-bold" style={{ color: DISCORD_BLURPLE }}>3</span>
                    <div>
                        <p className="text-[11px] text-foreground/60">
                            {LABELS.step2Action3} <span className="font-semibold text-foreground/80">{LABELS.step2Action3Bold}</span>
                        </p>
                        <p className="text-[9px] text-foreground/30 mt-0.5">
                            {LABELS.step2Action3Hint}
                        </p>
                    </div>
                </div>
                {/* Screenshot: Captcha puzzle */}
                <CollapsibleImage src="/discord-guide/step2-captcha.png" alt="Discord captcha puzzle" />
            </div>

            {/* Warning for email users */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    {LABELS.step2EmailWarning}
                </p>
            </div>

            <button
                type="button"
                onClick={onDone}
                className="w-full text-[12px] font-semibold py-2 rounded-lg transition-colors text-white"
                style={{ backgroundColor: DISCORD_BLURPLE }}
            >
                {LABELS.step2Done}
            </button>
        </div>
    );
}

/* ─── Step 3: Link Account (auto-joins server) ───────────────── */

function StepLink({ onLinkClick, isPolling }: { onLinkClick: () => void; isPolling: boolean }) {
    return (
        <div className="space-y-3">
            <p className="text-[11px] text-foreground/50">
                {LABELS.step3Desc} <span className="font-bold text-foreground/70">{LABELS.step3DescBold}</span> {LABELS.step3DescEnd}
            </p>

            {/* Screenshot: Authorize screen */}
            <CollapsibleImage src="/discord-guide/step3-authorize.png" alt="Discord Authorize button" />

            {!isPolling ? (
                <button
                    type="button"
                    onClick={onLinkClick}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-[12px] font-semibold transition-all hover:brightness-110 shadow-lg"
                    style={{
                        backgroundColor: DISCORD_BLURPLE,
                        boxShadow: `0 4px 15px ${DISCORD_BLURPLE}40`,
                    }}
                >
                    <DiscordIcon className="w-4 h-4" />
                    {LABELS.step3LinkBtn}
                </button>
            ) : (
                <div className="flex flex-col items-center gap-2 py-3">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: DISCORD_BLURPLE }} />
                    <p className="text-[11px] text-foreground/50 font-medium">
                        {LABELS.step3Waiting}
                    </p>
                    <p className="text-[9px] text-foreground/25">
                        {LABELS.step3WaitingHint}
                    </p>
                </div>
            )}

            {isPolling && (
                <button
                    type="button"
                    onClick={onLinkClick}
                    className="w-full text-[11px] font-medium py-1.5 rounded-lg border border-divider text-foreground/40 hover:text-foreground/60 transition-colors"
                >
                    {LABELS.step3OpenAgain}
                </button>
            )}
        </div>
    );
}
