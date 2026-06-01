"use client";

import { useState, useCallback, useMemo } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { Modal, ModalContent, ModalBody, Button } from "@heroui/react";

const DISCORD_BLURPLE = "#5865F2";

/**
 * Global guard — forces new authenticated + onboarded users to link Discord
 * before they can use the app.
 *
 * "New user" = has `onboarded-at` in localStorage (set during onboarding flow).
 * Legacy users who onboarded before this guard was added are NOT blocked.
 *
 * Shows a mandatory modal with:
 *  1. Join server link (invite)
 *  2. Link Discord via OAuth
 */
export function DiscordGuard({ children }: { children: React.ReactNode }) {
    const { user, isLoading, isSignedIn } = useAuthUser();
    const [dismissed, setDismissed] = useState(false);

    // All hooks MUST be called before any conditional returns
    const handleLinkDiscord = useCallback(() => {
        const returnTo = window.location.pathname.replace("/", "") || "vote";
        window.location.href = `/api/discord/authorize?returnTo=${returnTo}`;
    }, []);

    // Only gate users who onboarded AFTER this guard was deployed
    const GUARD_DEPLOYED_AT = 1780318164000; // 2026-06-01 ~6:15 PM IST
    const isNewUser = useMemo(() => {
        if (typeof window === "undefined") return false;
        const onboardedAt = localStorage.getItem("onboarded-at");
        if (!onboardedAt) return false;
        return Number(onboardedAt) >= GUARD_DEPLOYED_AT;
    }, []);

    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_LINK || "";

    // Now safe to do conditional returns
    // Don't block guests, loading state, or non-onboarded users
    if (isLoading || !isSignedIn || !user?.isOnboarded) return <>{children}</>;

    // Already linked or no player profile yet → pass through
    if (!user.player || user.player.discordId || dismissed) return <>{children}</>;

    // Only gate new users (onboarded after this feature was added)
    if (!isNewUser) return <>{children}</>;


    return (
        <>
            {children}
            <Modal
                isOpen={true}
                hideCloseButton
                isDismissable={false}
                isKeyboardDismissDisabled
                placement="center"
                size="sm"
                classNames={{
                    backdrop: "bg-black/70 backdrop-blur-sm",
                    base: "border border-[#5865F2]/30",
                }}
            >
                <ModalContent>
                    <ModalBody className="py-8 px-6 text-center space-y-5">
                        {/* Discord Icon */}
                        <div className="flex justify-center">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                                style={{ backgroundColor: DISCORD_BLURPLE }}
                            >
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                </svg>
                            </div>
                        </div>

                        {/* Title + Description */}
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold">Join Our Discord</h3>
                            <p className="text-sm text-foreground/50 leading-relaxed">
                                Link your Discord account to receive room IDs, match updates, and participate in tournaments.
                            </p>
                        </div>

                        {/* Steps */}
                        <div className="space-y-3 text-left">
                            {/* Step 1: Join Server */}
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-default-100 dark:bg-white/5">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5865F2] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                                    1
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">Join the Discord server</p>
                                    {discordInvite ? (
                                        <a
                                            href={discordInvite}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-medium mt-1 inline-block"
                                            style={{ color: DISCORD_BLURPLE }}
                                        >
                                            Open Invite Link →
                                        </a>
                                    ) : (
                                        <p className="text-[11px] text-foreground/40 mt-0.5">
                                            Ask an admin for the invite link
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Link Account */}
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-default-100 dark:bg-white/5">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5865F2] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                                    2
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">Link your Discord account</p>
                                    <p className="text-[11px] text-foreground/40 mt-0.5">
                                        We&apos;ll verify you&apos;re in the server
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <Button
                            className="w-full font-semibold text-white"
                            style={{ backgroundColor: DISCORD_BLURPLE }}
                            size="lg"
                            onPress={handleLinkDiscord}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="mr-1.5">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                            </svg>
                            Link with Discord
                        </Button>

                        <p className="text-[10px] text-foreground/30">
                            You must be in the server to link successfully
                        </p>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
}
