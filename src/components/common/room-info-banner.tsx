"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, KeyRound, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ActiveRoomInfo } from "@/app/api/room-info/active/route";

/**
 * RoomInfoBanner — Sticky banner showing active room details.
 *
 * Polls /api/room-info/active every 30s.
 * Shows Room ID, Password, Map, Match # with a quick-copy button for Room ID.
 * Appears at the top of the page for all signed-in users.
 */
export function RoomInfoBanner() {
    const [dismissed, setDismissed] = useState(false);
    const [copied, setCopied] = useState(false);

    const { data: roomInfo } = useQuery<ActiveRoomInfo | null>({
        queryKey: ["active-room-info"],
        queryFn: async () => {
            const res = await fetch("/api/room-info/active");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data || null;
        },
        refetchInterval: 30_000, // Poll every 30s
        staleTime: 15_000,
    });

    const handleCopy = useCallback(async () => {
        if (!roomInfo) return;
        try {
            await navigator.clipboard.writeText(roomInfo.roomId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement("textarea");
            ta.value = roomInfo.roomId;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [roomInfo]);

    if (!roomInfo || dismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="fixed top-16 left-0 right-0 z-40"
            >
                <div className="mx-auto max-w-2xl px-3 py-1.5">
                    <div className="relative rounded-xl border border-primary/20 bg-background/95 backdrop-blur-xl shadow-lg shadow-primary/5 overflow-hidden">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />

                        <div className="relative px-4 py-3">
                            {/* Top row: Match info */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                                    </span>
                                    <span className="text-xs font-semibold text-foreground/70">
                                        Match {roomInfo.matchNumber} — {roomInfo.map}
                                    </span>
                                    {roomInfo.tournamentName && (
                                        <span className="text-xs text-foreground/30 hidden sm:inline">
                                            • {roomInfo.tournamentName}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setDismissed(true)}
                                    className="p-1 rounded-full hover:bg-foreground/10 transition-colors"
                                >
                                    <X className="w-3 h-3 text-foreground/30" />
                                </button>
                            </div>

                            {/* Room details row */}
                            <div className="flex items-center gap-3">
                                <KeyRound className="w-4 h-4 text-primary shrink-0" />

                                {/* Room ID + Copy */}
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg px-3 py-1.5 transition-colors group"
                                >
                                    <span className="text-sm font-mono font-bold tracking-wider text-primary">
                                        {roomInfo.roomId}
                                    </span>
                                    {copied ? (
                                        <Check className="w-3.5 h-3.5 text-success" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                                    )}
                                </button>

                                {/* Divider */}
                                <div className="w-px h-5 bg-foreground/10" />

                                {/* Password */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-foreground/40">Pass:</span>
                                    <span className="text-sm font-mono font-bold text-foreground/80">
                                        {roomInfo.password}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
