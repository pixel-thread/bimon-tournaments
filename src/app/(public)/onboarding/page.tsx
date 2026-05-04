"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Avatar, Chip, Input } from "@heroui/react";
import { GAME } from "@/lib/game-config";
import { useSession, signOut } from "next-auth/react";
import { Gamepad2, Loader2, CheckCircle, Phone } from "lucide-react";
import { PubgmiLogo } from "@/components/common/pubgmi-logo";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
    GameNameInput,
    validateDisplayName,
} from "@/components/common/GameNameInput";
import { useIGNTutorial } from "@/components/common/IGNTutorialModal";
import { useAuthUser } from "@/hooks/use-auth-user";
import { WhatsAppJoinModal } from "@/components/common/WhatsAppJoinModal";
import { useLocale } from "@/components/common/locale-provider";

/**
 * /onboarding — New user setup flow.
 * Single-page: paste Game Name + auto-filled username → submit.
 * Already-onboarded users are redirected to /vote.
 */
export default function OnboardingPage() {
    const { data: session, status } = useSession();
    const isLoaded = status !== "loading";
    const router = useRouter();
    const { user: authUser, refetch } = useAuthUser();
    const { tk } = useLocale();

    const [displayName, setDisplayName] = useState("");
    const [displayNameError, setDisplayNameError] = useState("");
    const [userName, setUserName] = useState("");
    const [isUserNameAutoFilled, setIsUserNameAutoFilled] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [justCompleted, setJustCompleted] = useState(false);
    const [uid, setUid] = useState("");
    const [isCheckingIGN, setIsCheckingIGN] = useState(false);
    const [phoneFocused, setPhoneFocused] = useState(false);
    const ignCheckTimer = useRef<NodeJS.Timeout | null>(null);
    const ignTutorial = useIGNTutorial({ autoOpen: GAME.pasteOnlyIGN });
    const requiresPhone = !GAME.features.hasBR; // PES only

    // Redirect already-onboarded users to home
    useEffect(() => {
        if (authUser?.isOnboarded && !justCompleted) {
            router.push("/vote");
        }
    }, [authUser?.isOnboarded, justCompleted, router]);

    // Auto-fill username from Google name
    useEffect(() => {
        const firstName = session?.user?.name?.split(" ")[0];
        if (!userName) {
            let sanitized = (firstName || "")
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "");

            // Fallback: use email prefix if name had no ASCII chars
            if (sanitized.length === 0 && session?.user?.email) {
                sanitized = session.user.email
                    .split("@")[0]
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                    .slice(0, 15);
            }

            // Still empty? Generate a random one
            if (sanitized.length === 0) {
                sanitized = "player" + Math.floor(Math.random() * 9000 + 1000);
            }

            if (sanitized.length > 0 && sanitized.length < 3) {
                const randomNum = Math.floor(Math.random() * 900) + 100;
                sanitized = sanitized + randomNum;
            }

            if (sanitized.length >= 3) {
                setUserName(sanitized);
                setIsUserNameAutoFilled(true);
            }
        }
    }, [session?.user?.name, session?.user?.email, userName]);

    // Debounced duplicate IGN check
    const checkDuplicateIGN = useCallback((name: string) => {
        if (ignCheckTimer.current) clearTimeout(ignCheckTimer.current);
        if (!name || name.length < 2) {
            setIsCheckingIGN(false);
            return;
        }

        setIsCheckingIGN(true);
        ignCheckTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/onboarding/check-ign?displayName=${encodeURIComponent(name)}`
                );
                const json = await res.json();
                if (json.data?.isTaken) {
                    setDisplayNameError(
                        `This ${GAME.ignLabel} is already taken by another player.`
                    );
                }
            } catch {
                // Silently fail — backend will catch on submit
            } finally {
                setIsCheckingIGN(false);
            }
        }, 500);
    }, []);

    // Cleanup timer
    useEffect(() => {
        return () => {
            if (ignCheckTimer.current) clearTimeout(ignCheckTimer.current);
        };
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const displayError = validateDisplayName(displayName);
        if (displayError) {
            setDisplayNameError(displayError);
            return;
        }
        if (!userName.trim() || userName.trim().length < 3) {
            toast.error("Username must be at least 3 characters");
            return;
        }
        if (requiresPhone && phoneNumber.replace(/\D/g, "").length < 10) {
            setPhoneError("Enter all 10 digits");
            return;
        }

        setIsSubmitting(true);
        try {
            // Grab referral code saved during sign-up redirect
            const referralCode = localStorage.getItem("referral-code") || undefined;

            const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: displayName.trim(),
                    uid: uid.trim() || undefined,
                    referralCode,
                    phoneNumber: phoneNumber.replace(/\D/g, "") || undefined,
                }),
            });

            // Clear referral code regardless of outcome
            localStorage.removeItem("referral-code");

            if (!res.ok) {
                const json = await res.json();
                setDisplayNameError(json.message || "Something went wrong");
                return;
            }

            setJustCompleted(true);
            localStorage.setItem("onboarded-at", String(Date.now()));
            toast.success(`Welcome to ${GAME.gameName} × Bimon Tournament! 🎮`);
            // Refresh auth cache immediately so coming back from WhatsApp
            // doesn't redirect to /onboarding again
            await refetch();
            // Show WhatsApp groups before redirecting
            setShowWhatsApp(true);
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!isLoaded) {
        return (
            <div className="flex min-h-dvh items-center justify-center">
                <PubgmiLogo variant="hero" className="text-3xl" />
            </div>
        );
    }

    // Show WhatsApp groups after successful onboarding
    if (showWhatsApp) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background px-4">
                <WhatsAppJoinModal
                    isOpen={true}
                    onClose={async () => {
                        await refetch(); // Refresh auth cache so OnboardingGuard sees isOnboarded=true
                        router.push("/vote");
                        router.refresh();
                    }}
                    mandatory={true}
                />
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh items-center justify-center px-4" style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--game-primary) 5%, transparent), var(--game-bg, #0a0a0a))' }}>
            {/* IGN Tutorial Modal (paste-only games) */}
            {GAME.pasteOnlyIGN && ignTutorial.Modal}

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="rounded-2xl border border-divider bg-background/80 backdrop-blur-xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background px-6 pt-8 pb-6 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--game-primary) 10%, transparent)', outline: '4px solid color-mix(in srgb, var(--game-primary) 5%, transparent)', outlineOffset: '0px' }}>
                                <Gamepad2 className="h-8 w-8 game-text" />
                            </div>
                        </div>
                        <h1 className="text-xl font-bold">Welcome to {GAME.gameName} × Bimon Tournament</h1>
                        <p className="text-sm text-foreground/50 mt-1">
                            {GAME.pasteOnlyIGN ? (
                                <>
                                    {tk("copyPaste")}{" "}
                                    <span className="font-semibold game-text">
                                        {`your ${GAME.gameName} name`}
                                    </span>
                                </>
                            ) : (
                                <>
                                    {"Enter"}{" "}
                                    <span className="font-semibold game-text">
                                        {`your ${GAME.gameName} name`}
                                    </span>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Body */}
                    <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
                        {/* User info from Google */}
                        {session?.user && (
                            <div>
                                <div className="flex items-center gap-3 rounded-xl bg-default-100 p-3 -mt-1">
                                    <Avatar
                                        src={session.user.image || undefined}
                                        name={
                                            session.user.name ||
                                            "User"
                                        }
                                        size="sm"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium truncate">
                                                {session.user.name}
                                            </p>
                                            {isUserNameAutoFilled && (
                                                <Chip
                                                    size="sm"
                                                    variant="flat"
                                                    color="success"
                                                    startContent={
                                                        <CheckCircle className="h-3 w-3" />
                                                    }
                                                >
                                                    {userName}
                                                </Chip>
                                            )}
                                        </div>
                                        <p className="text-xs text-foreground/40">
                                            {session.user.email}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-foreground/40 mt-1.5 text-right">
                                    Wrong account?{" "}
                                    <button
                                        type="button"
                                        onClick={() => signOut({ callbackUrl: "/sign-in" })}
                                        className="text-primary hover:underline font-medium"
                                    >
                                        Switch
                                    </button>
                                </p>
                            </div>
                        )}

                        {/* Game Name / Team Name input */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-sm font-medium text-foreground/70">
                                    Enter your {GAME.gameName} {GAME.ignLabel}
                                </label>
                                {GAME.pasteOnlyIGN && ignTutorial.HelpButton}
                            </div>

                            {GAME.pasteOnlyIGN ? (
                                /* BGMI: paste-only input */
                                <>
                                    <GameNameInput
                                        value={displayName}
                                        onChange={(val) => {
                                            setDisplayName(val);
                                            if (val.length >= 2) {
                                                checkDuplicateIGN(val);
                                            }
                                        }}
                                        error={displayNameError}
                                        onErrorChange={setDisplayNameError}
                                        disabled={isSubmitting}
                                    />
                                    <p className="mt-2 text-xs text-foreground/40">
                                        <button
                                            type="button"
                                            onClick={ignTutorial.openModal}
                                            className="text-primary hover:underline font-medium"
                                        >
                                            Kumno ban copy?
                                        </button>
                                        {" / "}
                                        <button
                                            type="button"
                                            onClick={ignTutorial.openModal}
                                            className="text-primary hover:underline font-medium"
                                        >
                                            Need help?
                                        </button>
                                    </p>
                                </>
                            ) : (
                                /* PES / Free Fire: free-text input */
                                <>
                                    <Input
                                        value={displayName}
                                        onChange={(e) => {
                                            setDisplayName(e.target.value);
                                            setDisplayNameError("");
                                        }}
                                        placeholder="e.g. iQOOSoulLeGIT"
                                        size="lg"
                                        variant="bordered"
                                        maxLength={20}
                                        isDisabled={isSubmitting}
                                        isInvalid={!!displayNameError}
                                        errorMessage={displayNameError}
                                        classNames={{
                                            input: "placeholder:text-foreground/30",
                                        }}
                                        startContent={
                                            <span className="text-foreground/30 text-sm">🎮</span>
                                        }
                                    />
                                </>
                            )}
                        </div>

                        {/* Phone number — PES only, required */}
                        {requiresPhone && (
                            <div>
                                <label className="text-sm font-medium text-foreground/70 mb-2 block">
                                    Phone Number <span className="text-danger text-xs">*</span>
                                </label>
                                <Input
                                    value={phoneNumber}
                                    onValueChange={(v) => {
                                        setPhoneNumber(v.replace(/\D/g, "").slice(0, 10));
                                        setPhoneError("");
                                    }}
                                    placeholder=""
                                    onFocus={() => setPhoneFocused(true)}
                                    onBlur={() => setPhoneFocused(false)}
                                    size="lg"
                                    variant="bordered"
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    isDisabled={isSubmitting}
                                    isInvalid={!!phoneError}
                                    errorMessage={phoneError}
                                    color={phoneError ? "danger" : "default"}
                                    description={!phoneError ? "WhatsApp preferred — visible to your match opponent only" : undefined}
                                    startContent={
                                        <span className="text-sm font-semibold text-foreground/60 select-none pr-2 border-r border-divider mr-1 flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> +91
                                        </span>
                                    }
                                />
                            </div>
                        )}

                        {/* Free Fire UID — paste only */}
                        {GAME.hasUID && (
                            <div>
                                <label className="text-sm font-medium text-foreground/70 mb-2 block">
                                    {GAME.idLabel}
                                </label>
                                <Input
                                    value={uid}
                                    onChange={(e) => setUid(e.target.value)}
                                    placeholder={GAME.idPlaceholder}
                                    size="lg"
                                    variant="bordered"
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const pasted = e.clipboardData.getData("text").trim();
                                        if (pasted) setUid(pasted);
                                    }}
                                    description={`Copy from ${GAME.gameName} profile or type your ID`}
                                    isDisabled={isSubmitting}
                                    startContent={
                                        <span className="text-foreground/30 text-sm">🆔</span>
                                    }
                                />
                            </div>
                        )}

                        {/* Submit */}
                        <Button
                            type="submit"
                            color="primary"
                            className="w-full font-medium"
                            size="lg"
                            isDisabled={
                                isSubmitting ||
                                !displayName.trim() ||
                                !!displayNameError ||
                                isCheckingIGN ||
                                (requiresPhone && phoneNumber.replace(/\D/g, "").length < 10)
                            }
                            isLoading={isSubmitting}
                        >
                            {isSubmitting ? "Setting up..." : "Continue to Tournament"}
                        </Button>
                    </form>

                    {/* Footer */}
                    <p className="text-center text-xs text-foreground/30 px-6 pb-4">
                        {tk("canChangeLater")}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
