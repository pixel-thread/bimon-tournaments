"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { WhatsAppJoinModal } from "@/components/common/WhatsAppJoinModal";

/**
 * Tournament WhatsApp Group Guard — shows a mandatory modal
 * for tournament players who haven't joined their WhatsApp group yet.
 *
 * - Fetches from /api/whatsapp/my-invite (server-side check)
 * - Supports single groups and championship per-group invites
 * - Non-dismissable until player confirms joining
 * - Disappears when winner is declared (no invite link in DB)
 */
export function WhatsAppTournamentGuard() {
    const { user, isLoading: authLoading } = useAuthUser();
    const [invite, setInvite] = useState<{
        needsJoin: boolean;
        tournamentId?: string;
        tournamentName?: string;
        inviteLink?: string;
        group?: string;
    } | null>(null);
    const [confirming, setConfirming] = useState(false);

    // Fetch invite status from API
    useEffect(() => {
        if (authLoading || !user?.player?.id) return;

        fetch("/api/whatsapp/my-invite")
            .then((r) => r.json())
            .then(setInvite)
            .catch(() => setInvite({ needsJoin: false }));
    }, [authLoading, user?.player?.id]);

    const handleClose = useCallback(async () => {
        if (!invite?.tournamentId) return;

        setConfirming(true);
        try {
            await fetch("/api/whatsapp/confirm-join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tournamentId: invite.tournamentId }),
            });
            setInvite({ needsJoin: false });
        } catch {
            // Silent fail — let them retry
        } finally {
            setConfirming(false);
        }
    }, [invite?.tournamentId]);

    // Don't show if: loading, not a player, or no pending invite
    if (!invite || !invite.needsJoin || !invite.inviteLink) return null;

    const groupName = invite.group
        ? `🎮 ${invite.tournamentName} — Group ${invite.group}`
        : `🎮 ${invite.tournamentName}`;

    return (
        <WhatsAppJoinModal
            isOpen={true}
            onClose={handleClose}
            mandatory={true}
            groups={[{
                id: `tournament-${invite.tournamentId}`,
                name: groupName,
                link: invite.inviteLink,
            }]}
        />
    );
}
