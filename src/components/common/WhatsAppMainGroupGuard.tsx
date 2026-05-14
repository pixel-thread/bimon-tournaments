"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { WhatsAppJoinModal } from "@/components/common/WhatsAppJoinModal";

/**
 * Global guard — forces all authenticated, onboarded users to join
 * the main WhatsApp group before they can use the app.
 * Fetches only the first (main) group link — same as onboarding.
 */
export function WhatsAppMainGroupGuard({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthUser();
    const [hasJoined, setHasJoined] = useState(true); // Default true to avoid flash
    const [hydrated, setHydrated] = useState(false);
    const [mainGroupLink, setMainGroupLink] = useState<string | null>(null);

    // Check the same localStorage key that WhatsAppJoinModal writes to
    useEffect(() => {
        const stored = localStorage.getItem("whatsapp_joined_groups");
        if (stored) {
            try {
                const groups = JSON.parse(stored);
                setHasJoined(Array.isArray(groups) && groups.length > 0);
            } catch {
                setHasJoined(false);
            }
        } else {
            setHasJoined(false);
        }
        setHydrated(true);
    }, []);

    // Fetch only the main group link (same as onboarding)
    const isOnboarded = !!user?.isOnboarded;
    const shouldShow = hydrated && !isLoading && isOnboarded && !hasJoined;

    useEffect(() => {
        if (!shouldShow) return;
        fetch("/api/settings/public")
            .then((r) => r.json())
            .then((json) => {
                const link = (json.data?.whatsAppGroups || [])[0] || "";
                setMainGroupLink(link);
            })
            .catch(() => setMainGroupLink(""));
    }, [shouldShow]);

    const handleClose = useCallback(() => {
        setHasJoined(true);
    }, []);

    if (!shouldShow) return <>{children}</>;

    // No main group configured → skip
    if (mainGroupLink === "") {
        return <>{children}</>;
    }

    // Still loading the link
    if (mainGroupLink === null) return <>{children}</>;

    return (
        <>
            {children}
            <WhatsAppJoinModal
                isOpen={true}
                onClose={handleClose}
                mandatory={true}
                groups={[{
                    id: "main-group",
                    name: "📢 Main Group",
                    link: mainGroupLink,
                }]}
            />
        </>
    );
}
