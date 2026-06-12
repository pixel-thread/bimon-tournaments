"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
    Users, Copy, Check, Lock, Clock, Trophy,
    ChevronRight, ExternalLink, Shield, Crosshair,
    BookOpen, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

/* ─── WhatsApp icon ─────────────────────────────────── */

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

/* ─── Copy helper ────────────────────────────────────── */

function CopyButton({ text, label }: { text: string; label: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(`${label} copied!`);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xs font-mono"
        >
            <span className="text-foreground/90">{text}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-foreground/40" />}
        </button>
    );
}

/* ─── Types ──────────────────────────────────────────── */

interface MyGameData {
    active: boolean;
    tournament?: {
        id: string;
        name: string;
        type: string;
        seasonName?: string;
    };
    myTeam?: {
        id: string;
        name: string;
        teamNumber: number;
        players: {
            id: string;
            displayName: string;
            imageUrl: string | null;
            isMe: boolean;
        }[];
    };
    group?: string | null;
    availableGroups?: string[];
    whatsappInviteLink?: string | null;
    highlightedRules?: string[];
    roomInfo?: {
        roomId: string;
        password: string;
        map: string;
        matchNumber: number;
        time: string;
        updatedAt: string;
    } | null;
    standings?: {
        rank: number;
        teamId: string;
        teamName: string;
        teamNumber: number;
        totalKills: number;
        placementPts: number;
        totalPoints: number;
        wins: number;
        isMyTeam: boolean;
        playerNames: string[];
    }[];
}


const DEFAULT_RULES = [
    "🚫 No use of emulators, triggers, or hacks",
    "⏰ Join lobby within 5 minutes of room ID being shared",
    "📵 No team killing — results in immediate disqualification",
    "🎮 All players must use the IGN registered on the platform",
];

/* ─── My Slot Component ─────────────────────────────── */

export function MySlotPage() {
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

    const { data, isLoading } = useQuery<MyGameData>({
        queryKey: ["my-game"],
        queryFn: () => fetch("/api/my-game").then(r => r.json()),
        refetchInterval: 15_000,
    });


    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-foreground/30" />
            </div>
        );
    }

    if (!data?.active) return null;

    const { tournament, myTeam, roomInfo, standings, group, availableGroups, whatsappInviteLink, highlightedRules } = data;
    const activeGroup = selectedGroup || group;
    const displayRules = highlightedRules && highlightedRules.length > 0 ? highlightedRules : DEFAULT_RULES;

    // Filter standings by group if championship
    const displayStandings = standings || [];

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6 space-y-4">

            {/* ── Tournament Header ──────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-background to-background border border-primary/20"
            >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
                <div className="relative p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{tournament?.name}</h1>
                            <p className="text-xs text-foreground/40">{tournament?.seasonName}</p>
                        </div>
                    </div>
                    {group && (
                        <span className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning/20 text-warning border border-warning/30">
                            Group {group}
                        </span>
                    )}
                </div>
            </motion.div>

            {/* ── WhatsApp Group Banner ──────────────────── */}
            {whatsappInviteLink && (
                <motion.a
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    href={whatsappInviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-success/10 border border-success/20 hover:bg-success/15 active:scale-[0.98] transition-all"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success shrink-0">
                        <WhatsAppIcon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-success">Join WhatsApp Group</p>
                        <p className="text-[11px] text-foreground/40">Get Room ID, passwords & updates</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-success/60 shrink-0" />
                </motion.a>
            )}

            {/* ── My Team / Slot ─────────────────────────── */}
            {myTeam && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-xl border border-divider bg-content1 overflow-hidden"
                >
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-divider">
                        <Users className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-bold">My Team</h2>
                        <span className="ml-auto text-xs text-foreground/30 font-mono">#{myTeam.teamNumber}</span>
                    </div>
                    <div className="p-3 space-y-2">
                        {myTeam.players.map((player) => (
                            <div
                                key={player.id}
                                className={`flex items-center gap-3 p-2.5 rounded-lg ${player.isMe ? "bg-primary/10 border border-primary/20" : "bg-default-100"}`}
                            >
                                <div className="w-8 h-8 rounded-full bg-default-200 flex items-center justify-center text-xs font-bold overflow-hidden">
                                    {player.imageUrl ? (
                                        <img src={player.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        player.displayName.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">
                                        {player.displayName}
                                        {player.isMe && <span className="ml-1.5 text-[10px] text-primary font-bold">(You)</span>}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ── Room Info (Live) ───────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-divider bg-content1 overflow-hidden"
            >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-divider">
                    <Lock className="w-4 h-4 text-danger" />
                    <h2 className="text-sm font-bold">Room Info</h2>
                    {roomInfo && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-success">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            Live
                        </span>
                    )}
                </div>
                <div className="p-4">
                    {roomInfo ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-foreground/40">Match {roomInfo.matchNumber} — {roomInfo.map}</span>
                                <span className="flex items-center gap-1 text-[11px] text-foreground/30">
                                    <Clock className="w-3 h-3" />
                                    {roomInfo.time}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Room ID</p>
                                    <CopyButton text={roomInfo.roomId} label="Room ID" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Password</p>
                                    <CopyButton text={roomInfo.password} label="Password" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <div className="w-10 h-10 mx-auto rounded-full bg-default-100 flex items-center justify-center mb-2">
                                <Lock className="w-5 h-5 text-foreground/20" />
                            </div>
                            <p className="text-sm text-foreground/30">Waiting for Room ID...</p>
                            <p className="text-[11px] text-foreground/20 mt-0.5">Auto-refreshes every 15 seconds</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── Highlighted Rules ──────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-divider bg-content1 overflow-hidden"
            >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-divider">
                    <BookOpen className="w-4 h-4 text-warning" />
                    <h2 className="text-sm font-bold">Important Rules</h2>
                </div>
                <div className="p-3 space-y-1.5">
                    {displayRules.map((rule, i) => (
                        <p key={i} className="text-xs text-foreground/60 pl-1">{rule}</p>
                    ))}
                </div>
                <Link
                    href="/rules"
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-divider text-xs text-primary font-semibold hover:bg-primary/5 transition-colors"
                >
                    View All Rules <ChevronRight className="w-3.5 h-3.5" />
                </Link>
            </motion.div>

            {/* ── Standings ──────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-xl border border-divider bg-content1 overflow-hidden"
            >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-divider">
                    <Trophy className="w-4 h-4 text-warning" />
                    <h2 className="text-sm font-bold">Standings</h2>
                </div>

                {/* Group switcher (championship) */}
                {availableGroups && availableGroups.length > 1 && (
                    <div className="flex gap-1.5 px-3 pt-3">
                        {availableGroups.map(g => (
                            <button
                                key={g}
                                onClick={() => setSelectedGroup(g)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    activeGroup === g
                                        ? "bg-primary text-white"
                                        : "bg-default-100 text-foreground/50 hover:bg-default-200"
                                }`}
                            >
                                Group {g}
                            </button>
                        ))}
                    </div>
                )}

                {displayStandings.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-divider text-foreground/30">
                                    <th className="text-left px-3 py-2.5 w-8">#</th>
                                    <th className="text-left px-2 py-2.5">Team</th>
                                    <th className="text-center px-2 py-2.5">
                                        <Crosshair className="w-3 h-3 mx-auto" />
                                    </th>
                                    <th className="text-center px-2 py-2.5">Pts</th>
                                    <th className="text-center px-3 py-2.5">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayStandings.map((row) => (
                                    <tr
                                        key={row.teamId}
                                        className={`border-b border-divider/50 ${
                                            row.isMyTeam
                                                ? "bg-primary/10 font-semibold"
                                                : ""
                                        } ${row.rank <= 3 ? "text-foreground" : "text-foreground/60"}`}
                                    >
                                        <td className="px-3 py-2.5">
                                            {row.rank <= 3 ? (
                                                <span className={`text-sm ${
                                                    row.rank === 1 ? "text-yellow-400" :
                                                    row.rank === 2 ? "text-gray-300" : "text-amber-600"
                                                }`}>
                                                    {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : "🥉"}
                                                </span>
                                            ) : (
                                                <span className="text-foreground/30">{row.rank}</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2.5">
                                            <p className="truncate max-w-[120px]">
                                                {row.teamName}
                                                {row.isMyTeam && <span className="text-primary text-[10px] ml-1">★</span>}
                                            </p>
                                        </td>
                                        <td className="text-center px-2 py-2.5 text-foreground/50">{row.totalKills}</td>
                                        <td className="text-center px-2 py-2.5 text-foreground/50">{row.placementPts}</td>
                                        <td className="text-center px-3 py-2.5 font-bold">{row.totalPoints}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-6 text-foreground/20 text-xs">
                        No standings yet — match results pending
                    </div>
                )}
            </motion.div>

        </div>
    );
}
