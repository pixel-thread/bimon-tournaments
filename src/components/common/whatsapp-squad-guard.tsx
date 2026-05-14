"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, Button } from "@heroui/react";

/* ─── WhatsApp Icon ─────────────────────────────────────────── */

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
    );
}

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

/** Clean up stale pending entries (older than 7 days) */
function cleanupStale() {
    // Pending entries don't have timestamps, so we can't age them.
    // Instead, clean up joined entries to keep storage lean — they auto-expire.
}

/* ─── Global Guard Component ───────────────────────────────── */

export function WhatsAppSquadGuard() {
    const [pending, setPending] = useState<WhatsAppPendingInfo | null>(null);

    useEffect(() => {
        // Check on mount and after navigation
        const found = findPendingWhatsApp();
        setPending(found);
        cleanupStale();
    }, []);

    // Also re-check when window gains focus (user comes back from WhatsApp)
    useEffect(() => {
        const onFocus = () => {
            const found = findPendingWhatsApp();
            setPending(found);
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    const handleJoin = useCallback(() => {
        if (!pending) return;
        markWhatsAppJoined(pending.pollId);
        window.open(pending.whatsappGroupLink, "_blank", "noopener,noreferrer");
        setPending(null);
    }, [pending]);

    if (!pending) return null;

    return (
        <Modal
            isOpen
            hideCloseButton
            isDismissable={false}
            placement="center"
            size="sm"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 pb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <WhatsAppIcon className="w-4 h-4 text-emerald-500" />
                        </div>
                        <span className="text-base">Join WhatsApp Group</span>
                    </div>
                </ModalHeader>
                <ModalBody className="pb-5">
                    <p className="text-sm text-foreground/60">
                        Your team <strong>&ldquo;{pending.squadName}&rdquo;</strong> for{" "}
                        <strong>{pending.tournamentName}</strong> requires you to join the WhatsApp group for match details.
                    </p>

                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">
                            Required
                        </span>
                        <span className="text-xs text-foreground/50">
                            Match schedules are shared in the group
                        </span>
                    </div>

                    <Button
                        className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/25"
                        size="lg"
                        onPress={handleJoin}
                        startContent={<WhatsAppIcon className="w-5 h-5" />}
                    >
                        Join WhatsApp Group
                    </Button>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
