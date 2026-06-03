"use client";

import { useState, useCallback } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { CompareModalUI } from "@/components/common/discord-compare-modal";

/**
 * Global guard — forces unlinked users to see WhatsApp vs Discord comparison
 * before they can use the app.
 */
export function DiscordGuard({ children }: { children: React.ReactNode }) {
    const { user, isLoading, isSignedIn } = useAuthUser();
    const [dismissed, setDismissed] = useState(false);

    const handleLinkDiscord = useCallback(() => {
        const returnTo = window.location.pathname.replace("/", "") || "vote";
        window.location.href = `/api/discord/authorize?returnTo=${returnTo}`;
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
                onSkip={() => setDismissed(true)}
            />
        </>
    );
}
