"use client";

import { useState, useCallback } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { CompareModalUI } from "@/components/common/discord-compare-modal";

const LS_KEY = "discord-modal-dismissed";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function wasRecentlyDismissed(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const ts = localStorage.getItem(LS_KEY);
        if (!ts) return false;
        return Date.now() - Number(ts) < COOLDOWN_MS;
    } catch { return false; }
}

/**
 * Global guard — nudges unlinked users to link Discord.
 * Shows once, then waits 7 days before showing again if skipped.
 * 
 * NOTE: Discord linking is currently disabled — using WhatsApp instead.
 * The guard now always passes through. Re-enable by uncommenting below.
 */
export function DiscordGuard({ children }: { children: React.ReactNode }) {
    // ── Discord disabled — always pass through ──
    return <>{children}</>;

    /* ── Discord linking (disabled — kept for future use) ──
    const { user, isLoading, isSignedIn } = useAuthUser();
    const [dismissed, setDismissed] = useState(() => wasRecentlyDismissed());

    const handleLinkDiscord = useCallback(() => {
        const returnTo = window.location.pathname.replace("/", "") || "vote";
        window.location.href = `/api/discord/authorize?returnTo=${returnTo}`;
    }, []);

    const handleSkip = useCallback(() => {
        setDismissed(true);
        try { localStorage.setItem(LS_KEY, String(Date.now())); } catch {}
    }, []);

    // Don't block guests, loading state, or non-onboarded users
    if (isLoading || !isSignedIn || !user?.isOnboarded) return <>{children}</>;

    // Already linked or no player profile yet → pass through
    if (!user.player || user.player.discordId || dismissed) return <>{children}</>;

    return (
        <>
            {children}
            <CompareModalUI
                isOpen={true}
                onLink={handleLinkDiscord}
                hideClose
                onSkip={handleSkip}
            />
        </>
    );
    */
}
