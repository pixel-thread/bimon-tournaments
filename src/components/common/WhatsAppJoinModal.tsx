"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Check, X } from "lucide-react";

import { GAME } from "@/lib/game-config";

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

interface WhatsAppGroup {
    id: string;
    name: string;
    link: string;
}

interface WhatsAppJoinModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Called when user dismisses (only allowed after joining all groups) */
    onClose: () => void;
    /** Whether this is mandatory (hides close until all joined) */
    mandatory?: boolean;
    /** Optional pre-loaded groups (skip API fetch) */
    groups?: WhatsAppGroup[];
}

/**
 * WhatsApp group join modal — shows after onboarding.
 * Mandatory: user must join both groups before proceeding.
 * Tracks joined groups in localStorage.
 */
export function WhatsAppJoinModal({
    isOpen,
    onClose,
    mandatory = true,
    groups: propGroups,
}: WhatsAppJoinModalProps) {
    const [joinedGroups, setJoinedGroups] = useState<Set<string>>(new Set());
    const [isHydrated, setIsHydrated] = useState(false);
    const [loadedGroups, setLoadedGroups] = useState<WhatsAppGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch groups from settings API if not provided via props
    useEffect(() => {
        if (propGroups) {
            setLoadedGroups(propGroups);
            return;
        }
        if (!isOpen) return;

        setIsLoading(true);
        fetch("/api/settings/public")
            .then((res) => res.json())
            .then((json) => {
                const links: string[] = json.data?.whatsAppGroups || [];
                const groupNames = ["📢 Main Group", "🎮 Casual Room ID", "💬 Community Chat"];
                const groups = links
                    .filter((link) => link && link.trim())
                    .map((link, i) => ({
                        id: `group${i + 1}`,
                        name: groupNames[i] || `Group ${i + 1}`,
                        link: link.trim(),
                    }));
                setLoadedGroups(groups);
                // If no groups configured, skip modal
                if (groups.length === 0) onClose();
            })
            .catch(() => onClose()) // skip if fetch fails
            .finally(() => setIsLoading(false));
    }, [isOpen, propGroups, onClose]);

    // Load joined state from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("whatsapp_joined_groups");
        if (stored) {
            try {
                setJoinedGroups(new Set(JSON.parse(stored)));
            } catch {
                // ignore
            }
        }
        setIsHydrated(true);
    }, []);

    const handleJoin = (groupId: string, link: string) => {
        window.open(link, "_blank", "noopener,noreferrer");
        const updated = new Set(joinedGroups);
        updated.add(groupId);
        setJoinedGroups(updated);
        localStorage.setItem("whatsapp_joined_groups", JSON.stringify([...updated]));

        // Auto-dismiss after 2s so user switches to WhatsApp first
        const allNowJoined = loadedGroups.every((g) => updated.has(g.id));
        if (allNowJoined) {
            setTimeout(() => onClose(), 2000);
        }
    };

    if (!isHydrated || isLoading) return null;

    const allJoined = loadedGroups.every((g) => joinedGroups.has(g.id));
    const canClose = !mandatory || allJoined;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={canClose ? onClose : undefined}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative bg-background border border-divider rounded-2xl shadow-2xl mx-4 max-w-sm w-full overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-success/10 px-6 pt-6 pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center">
                                        <WhatsAppIcon className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-lg font-bold">
                                        Join WhatsApp
                                    </h2>
                                </div>
                                {canClose && (
                                    <button
                                        onClick={onClose}
                                        className="text-foreground/40 hover:text-foreground transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            <p className="text-sm text-foreground/50 mt-2">
                                Join our WhatsApp groups to get{" "}
                                <span className="text-danger font-semibold">
                                    {GAME.features.hasBR ? "Room ID, passwords" : "match schedules, brackets"}
                                </span>
                                , and important updates.
                            </p>
                        </div>

                        {/* Groups */}
                        <div className="px-6 py-4 space-y-3">
                            {loadedGroups.map((group) => {
                                const isJoined = joinedGroups.has(group.id);
                                return (
                                    <div
                                        key={group.id}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isJoined
                                            ? "bg-success/10 border border-success/30"
                                            : "bg-default-100"
                                            }`}
                                    >
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isJoined
                                                ? "bg-success"
                                                : "bg-success/80"
                                                }`}
                                        >
                                            {isJoined ? (
                                                <Check className="w-5 h-5 text-white" />
                                            ) : (
                                                <WhatsAppIcon className="w-5 h-5 text-white" />
                                            )}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">
                                                {group.name}
                                            </p>
                                            <p className="text-xs text-foreground/40">
                                                {isJoined
                                                    ? "Joined ✓"
                                                    : "Tap Join to open"}
                                            </p>
                                        </div>
                                        {!isJoined && (
                                            <Button
                                                size="sm"
                                                color="success"
                                                variant="solid"
                                                className="shrink-0 font-bold text-white"
                                                onPress={() => handleJoin(group.id, group.link)}
                                            >
                                                Join
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-5">
                            {allJoined ? (
                                <Button
                                    color="primary"
                                    className="w-full"
                                    onPress={onClose}
                                >
                                    Continue to Tournament
                                </Button>
                            ) : (
                                <p className="text-xs text-center text-foreground/30">
                                    Join {loadedGroups.length === 1 ? "the group" : "all groups"} to continue
                                </p>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
