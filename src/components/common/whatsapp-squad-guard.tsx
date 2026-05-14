"use client";

import { useState, useEffect, useCallback } from "react";
import { WhatsAppJoinModal } from "@/components/common/WhatsAppJoinModal";

/* ─── localStorage helpers ─────────────────────────────────── */

const WA_PENDING_PREFIX = "wa-squad-pending:";
const WA_JOINED_PREFIX = "wa-squad-joined:";

export interface WhatsAppPendingInfo {
    pollId: string;
    squadName: string;
    tournamentName: string;
    whatsappGroupLink: string;
}

/** Call after squad creation to register a pending WhatsApp join. */
export function markWhatsAppPending(info: WhatsAppPendingInfo) {
    try {
        localStorage.setItem(WA_PENDING_PREFIX + info.pollId, JSON.stringify(info));
    } catch { /* storage full / private mode */ }
}

/** Call when user clicks the WhatsApp join link. */
export function markWhatsAppJoined(pollId: string) {
    try {
        localStorage.setItem(WA_JOINED_PREFIX + pollId, "1");
    } catch { /* silent */ }
}

/** Check if a specific poll has pending WhatsApp join. */
export function hasWhatsAppPending(pollId: string): boolean {
    try {
        return !!localStorage.getItem(WA_PENDING_PREFIX + pollId) && !localStorage.getItem(WA_JOINED_PREFIX + pollId);
    } catch { return false; }
}

/** Find any pending WhatsApp join across all polls. */
function findPendingWhatsApp(): WhatsAppPendingInfo | null {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(WA_PENDING_PREFIX)) continue;
            const pollId = key.slice(WA_PENDING_PREFIX.length);
            if (localStorage.getItem(WA_JOINED_PREFIX + pollId)) continue;
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw) as WhatsAppPendingInfo;
        }
    } catch { /* silent */ }
    return null;
}

/* ─── Global Guard Component ───────────────────────────────── */

export function WhatsAppSquadGuard() {
    const [pending, setPending] = useState<WhatsAppPendingInfo | null>(null);

    useEffect(() => {
        const found = findPendingWhatsApp();
        setPending(found);
    }, []);

    // Re-check when window gains focus (user comes back from WhatsApp)
    useEffect(() => {
        const onFocus = () => {
            const found = findPendingWhatsApp();
            setPending(found);
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    const handleClose = useCallback(() => {
        if (!pending) return;
        markWhatsAppJoined(pending.pollId);
        setPending(null);
    }, [pending]);

    if (!pending) return null;

    return (
        <WhatsAppJoinModal
            isOpen={true}
            onClose={handleClose}
            mandatory={true}
            groups={[{
                id: `squad-${pending.pollId}`,
                name: `🛡️ ${pending.squadName} — ${pending.tournamentName}`,
                link: pending.whatsappGroupLink,
            }]}
        />
    );
}
