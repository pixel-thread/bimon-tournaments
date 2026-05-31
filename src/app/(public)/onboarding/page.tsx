"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Avatar, Chip, Input } from "@heroui/react";
import { GAME } from "@/lib/game-config";
import { useSession, signOut } from "next-auth/react";
import { Gamepad2, Loader2, CheckCircle, Phone, Clipboard } from "lucide-react";
import { PubgmiLogo } from "@/components/common/pubgmi-logo";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
    GameNameInput,
    validateDisplayName,
} from "@/components/common/GameNameInput";
import { useIGNTutorial } from "@/components/common/IGNTutorialModal";
import { useAuthUser } from "@/hooks/use-auth-user";
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
    const [showDiscord, setShowDiscord] = useState(false);
    const [justCompleted, setJustCompleted] = useState(false);
    const [uid, setUid] = useState("");
    const [isCheckingIGN, setIsCheckingIGN] = useState(false);
    const [phoneFocused, setPhoneFocused] = useState(false);
    const ignCheckTimer = useRef<NodeJS.Timeout | null>(null);
    const showIGNTutorial = GAME.pasteOnlyIGN || GAME.features.hasBR;
    const ignTutorial = useIGNTutorial({ autoOpen: showIGNTutorial, mandatory: showIGNTutorial });
    const requiresPhone = true; // All games require phone now

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
            // Refresh auth cache immediately
            await refetch();

            // Auto-join pending squad from invite link (if any)
            const pendingSquad = localStorage.getItem("pending-squad-join");
            if (pendingSquad) {
                localStorage.removeItem("pending-squad-join");
                try {
                    const joinRes = await fetch(`/api/squads/${pendingSquad}/link-join`, { method: "POST" });
                    const joinJson = await joinRes.json();
                    if (joinRes.ok) {
                        toast.success(joinJson.message || "Joined the squad! 🛡");
                    }
                } catch {
                    // Non-critical — they can join manually later
                }
            }

            // Redirect to Discord OAuth (mandatory)
            setShowDiscord(true);
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

    // Handle Discord OAuth callback result via URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const discordResult = params.get("discord");
        if (!discordResult) return;

        // Clean the URL
        const url = new URL(window.location.href);
        url.searchParams.delete("discord");
        window.history.replaceState({}, "", url.toString());

        switch (discordResult) {
            case "linked":
                toast.success("Discord linked successfully!");
                sessionStorage.setItem("discord_linked", "true");
                // Redirect to vote page
                refetch().then(() => { router.push("/vote"); router.refresh(); });
                break;
            case "denied":
                toast.error("Discord authorization is required — please try again");
                setShowDiscord(true); // Stay on Discord screen
                break;
            case "already_linked":
                toast.error("This Discord account is already linked to another player");
                setShowDiscord(true); // Show Discord screen again
                break;
            case "not_in_server":
                toast.error("You must join our Discord server first! Join the server, then link again.");
                setShowDiscord(true);
                break;
            default:
                toast.error("Failed to link Discord — please try again");
                setShowDiscord(true); // Stay on Discord screen
        }
    }, []);

    // Show Discord linking screen after successful onboarding
    if (showDiscord) {
        return (
            <div className="flex min-h-dvh items-center justify-center px-4" style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--game-primary) 5%, transparent), var(--game-bg, #0a0a0a))' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    <div className="rounded-2xl border border-divider bg-background/80 backdrop-blur-xl shadow-xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-[#5865F2]/10 via-[#5865F2]/5 to-background px-6 pt-8 pb-6 text-center">
                            <div className="flex justify-center mb-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5865F2]/10" style={{ outline: '4px solid rgba(88,101,242,0.1)', outlineOffset: '0px' }}>
                                    <svg className="w-8 h-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                                </div>
                            </div>
                            <h1 className="text-xl font-bold">Link Your Discord</h1>
                            <p className="text-sm text-foreground/50 mt-1">
                                Connect your Discord to receive <span className="font-semibold text-[#5865F2]">room IDs</span> and <span className="font-semibold text-[#5865F2]">match updates</span>
                            </p>
                        </div>

                        {/* Body */}
                        <div className="px-6 pb-6 space-y-4 pt-4">
                            <div className="space-y-2 text-sm text-foreground/60">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">🎮</span>
                                    <span>Get room IDs directly on Discord</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base">📢</span>
                                    <span>Match updates & tournament announcements</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base">🎫</span>
                                    <span>Support tickets & quick help</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
                                    const redirectUri = encodeURIComponent(
                                        `${window.location.origin}/api/discord/callback`
                                    );
                                    const state = encodeURIComponent(`|onboarding`);
                                    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds.join&state=${state}`;
                                    window.location.href = url;
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base transition-all bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-lg shadow-[#5865F2]/25 cursor-pointer active:scale-[0.98]"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                                Link with Discord
                            </button>
                        </div>

                        <p className="text-center text-xs text-foreground/30 px-6 pb-4">
                            Discord is required to participate in tournaments
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh items-center justify-center px-4" style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--game-primary) 5%, transparent), var(--game-bg, #0a0a0a))' }}>
            {/* IGN Tutorial Modal (BGMI and paste-only games) */}
            {showIGNTutorial && ignTutorial.Modal}

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
                                {showIGNTutorial && ignTutorial.HelpButton}
                            </div>

                            <Input
                                        value={displayName}
                                        onChange={(e) => {
                                            setDisplayName(e.target.value);
                                            setDisplayNameError("");
                                            if (e.target.value.length >= 2) {
                                                checkDuplicateIGN(e.target.value);
                                            }
                                        }}
                                        onPaste={(e) => {
                                            // Sanitize BGMI invisible characters on paste
                                            e.preventDefault();
                                            const text = e.clipboardData.getData("text")
                                                .replace(/[ĀāĒēĪīŌōŪū]/g, " ")
                                                .replace(/\s+/g, " ")
                                                .trim()
                                                .slice(0, 20);
                                            if (text) {
                                                setDisplayName(text);
                                                setDisplayNameError("");
                                                if (text.length >= 2) checkDuplicateIGN(text);
                                            }
                                        }}
                                        placeholder={`Enter your ${GAME.ignLabel.toLowerCase()}`}
                                        size="lg"
                                        variant="bordered"
                                        maxLength={20}
                                        isDisabled={isSubmitting}
                                        isInvalid={!!displayNameError}
                                        errorMessage={displayNameError}
                                        classNames={{
                                            input: "placeholder:text-foreground/30",
                                            inputWrapper: "!border-default-400",
                                        }}
                                        startContent={
                                            <span className="text-foreground/30 text-sm">🎮</span>
                                        }
                                        endContent={
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const text = await navigator.clipboard.readText();
                                                        if (text.trim()) {
                                                            const sanitized = text.trim()
                                                                .replace(/[ĀāĒēĪīŌōŪū]/g, " ")
                                                                .replace(/\s+/g, " ")
                                                                .trim()
                                                                .slice(0, 20);
                                                            setDisplayName(sanitized);
                                                            setDisplayNameError("");
                                                            if (sanitized.length >= 2) checkDuplicateIGN(sanitized);
                                                            toast.success("Pasted!");
                                                        } else {
                                                            toast.error("Clipboard is empty");
                                                        }
                                                    } catch {
                                                        toast.error("Paste failed — long press the input instead");
                                                    }
                                                }}
                                                className="text-foreground/40 hover:text-primary active:scale-90 transition-all p-1"
                                                title="Paste from clipboard"
                                            >
                                                <Clipboard className="h-4 w-4" />
                                            </button>
                                        }
                                    />
                                    {showIGNTutorial && (
                                        <p className="mt-2 text-xs text-foreground/40">
                                            <button
                                                type="button"
                                                onClick={ignTutorial.openModal}
                                                className="text-primary hover:underline font-medium"
                                            >
                                                Need help finding your name?
                                            </button>
                                        </p>
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
                                    description={!phoneError ? "WhatsApp preferred — keeps you updated on match details" : undefined}
                                    classNames={{
                                        inputWrapper: "!border-default-400",
                                    }}
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
                                    classNames={{
                                        inputWrapper: "!border-default-400",
                                    }}
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
