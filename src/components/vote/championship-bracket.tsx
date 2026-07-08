"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    Chip,
    Spinner,
} from "@heroui/react";
import {
    Trophy,
    ChevronRight,
    Users,
    Shield,
    Zap,
    Crown,
    Clock,
    Check,
    XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { PollTheme } from "./pollTheme";

/* ─── Types ─────────────────────────────────────────────────── */

interface ChampionshipEntry {
    teamId: string;
    teamName: string;
    group: string | null;
    phase: string;
    status: string;
}

interface ChampionshipStatus {
    currentPhase: "HEATS" | "WILDCARD" | "FINALS" | "COMPLETE";
    entries: ChampionshipEntry[];
    matches: { id: string; matchNumber: number; phase: string | null; hasStats: boolean }[];
}

interface ChampionshipBracketProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    tournamentName: string;
    theme?: PollTheme | null;
}

/* ─── Status Styles ─────────────────────────────────────────── */

const STATUS_ICON: Record<string, React.ReactNode> = {
    ACTIVE: <Zap className="w-2.5 h-2.5 text-blue-500" />,
    QUALIFIED: <Check className="w-2.5 h-2.5 text-emerald-500" />,
    WILDCARD: <Clock className="w-2.5 h-2.5 text-amber-500" />,
    ELIMINATED: <XCircle className="w-2.5 h-2.5 text-red-500/50" />,
    STANDBY: <Clock className="w-2.5 h-2.5 text-foreground/30" />,
};

const STATUS_CLASS: Record<string, string> = {
    ACTIVE: "text-foreground",
    QUALIFIED: "text-emerald-600 dark:text-emerald-400",
    WILDCARD: "text-amber-600 dark:text-amber-400",
    ELIMINATED: "text-foreground/30 line-through",
    STANDBY: "text-foreground/30",
};

const PHASE_INFO: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
    HEATS: { label: "Heats", icon: <Users className="w-3.5 h-3.5" />, description: "32 squads split into 2 groups × 4 matches" },
    WILDCARD: { label: "Wildcard", icon: <Zap className="w-3.5 h-3.5" />, description: "16 teams compete for 8 finals spots" },
    FINALS: { label: "Grand Finals", icon: <Crown className="w-3.5 h-3.5" />, description: "16 best squads battle for the championship" },
    COMPLETE: { label: "Complete", icon: <Trophy className="w-3.5 h-3.5" />, description: "Championship concluded" },
};

/* ─── Main ──────────────────────────────────────────────────── */

export function ChampionshipBracket({
    isOpen,
    onClose,
    tournamentId,
    tournamentName,
    theme,
}: ChampionshipBracketProps) {
    const [activeTab, setActiveTab] = useState<"HEATS" | "WILDCARD" | "FINALS">("HEATS");

    const { data: status, isLoading } = useQuery<ChampionshipStatus>({
        queryKey: ["championship-bracket", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/championship/status`);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data;
        },
        enabled: isOpen && !!tournamentId,
        staleTime: 30_000,
    });

    const groupA = status?.entries.filter(e => e.group === "A") ?? [];
    const groupB = status?.entries.filter(e => e.group === "B") ?? [];
    const wildcard = status?.entries.filter(e => e.phase === "WILDCARD" || e.status === "WILDCARD") ?? [];
    const finals = status?.entries.filter(e => e.phase === "FINALS" || e.status === "QUALIFIED") ?? [];

    const currentInfo = PHASE_INFO[status?.currentPhase ?? "HEATS"];

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" placement="center" scrollBehavior="inside"
            classNames={{ body: "px-4 py-3 max-h-[65vh] overflow-y-auto" }}>
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-base pb-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${theme ? `bg-gradient-to-r ${theme.header}` : 'bg-amber-500/20'}`}>
                        <Trophy className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="truncate block">{tournamentName}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-normal text-foreground/50">Championship Bracket</span>
                            {status && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                    {currentInfo.label}
                                </span>
                            )}
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner size="lg" />
                        </div>
                    ) : !status || status.entries.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                            <Trophy className="h-10 w-10 text-foreground/15" />
                            <p className="text-sm text-foreground/40">
                                Championship bracket will appear once teams are generated.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Flow diagram */}
                            <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-default-50">
                                {(["HEATS", "WILDCARD", "FINALS"] as const).map((phase, i) => {
                                    const isPast = (
                                        (phase === "HEATS" && status.currentPhase !== "HEATS") ||
                                        (phase === "WILDCARD" && (status.currentPhase === "FINALS" || status.currentPhase === "COMPLETE")) ||
                                        (phase === "FINALS" && status.currentPhase === "COMPLETE")
                                    );
                                    const isCurrent = status.currentPhase === phase;
                                    return (
                                        <div key={phase} className="flex items-center flex-1">
                                            <button
                                                onClick={() => setActiveTab(phase)}
                                                className={`flex-1 py-1.5 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center
                                                    ${activeTab === phase
                                                        ? isCurrent
                                                            ? "bg-primary/15 text-primary"
                                                            : isPast
                                                                ? "bg-emerald-500/15 text-emerald-500"
                                                                : "bg-default-100 text-foreground/40"
                                                        : isPast
                                                            ? "text-emerald-500/40"
                                                            : "text-foreground/20"
                                                    }
                                                `}
                                            >
                                                {PHASE_INFO[phase].label}
                                            </button>
                                            {i < 2 && <ChevronRight className="w-3 h-3 text-foreground/15 mx-0.5 shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Phase description */}
                            <p className="text-[11px] text-foreground/40 text-center">
                                {PHASE_INFO[activeTab].description}
                            </p>

                            {/* Content */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.15 }}
                                    className="space-y-3"
                                >
                                    {activeTab === "HEATS" && (
                                        <>
                                            <TeamList title="Group A" icon="🅰️" entries={groupA} />
                                            <TeamList title="Group B" icon="🅱️" entries={groupB} />
                                        </>
                                    )}
                                    {activeTab === "WILDCARD" && (
                                        <TeamList title="Wildcard" icon="⚡" entries={wildcard} subtitle="Top 8 → Finals" />
                                    )}
                                    {activeTab === "FINALS" && (
                                        <TeamList title="Grand Finals" icon="👑" entries={finals} subtitle="16 teams" />
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

/* ─── Team List ─────────────────────────────────────────────── */

function TeamList({
    title,
    icon,
    entries,
    subtitle,
}: {
    title: string;
    icon: string;
    entries: ChampionshipEntry[];
    subtitle?: string;
}) {
    if (entries.length === 0) {
        return (
            <div className="rounded-lg border border-divider p-4 text-center">
                <p className="text-xs text-foreground/30">No teams in {title.toLowerCase()} yet</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-divider overflow-hidden">
            <div className="px-3 py-2 bg-default-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm">{icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-foreground/40 font-medium">{entries.length} teams</span>
                    {subtitle && (
                        <span className="text-[10px] text-foreground/30">• {subtitle}</span>
                    )}
                </div>
            </div>
            <div className="p-1.5 space-y-0.5">
                {entries.map((entry, i) => (
                    <div
                        key={entry.teamId}
                        className="flex items-center gap-2 px-2 py-1 rounded-md"
                    >
                        <span className="w-4 text-center text-[10px] font-bold text-foreground/25">
                            {i + 1}
                        </span>
                        {STATUS_ICON[entry.status]}
                        <span className={`text-xs font-medium truncate flex-1 ${STATUS_CLASS[entry.status] ?? ""}`}>
                            {entry.teamName}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                            entry.status === "QUALIFIED" ? "text-emerald-500" :
                            entry.status === "ELIMINATED" ? "text-red-400/40" :
                            entry.status === "WILDCARD" ? "text-amber-500" :
                            entry.status === "STANDBY" ? "text-foreground/25" :
                            "text-foreground/30"
                        }`}>
                            {entry.status === "FORMING" ? "" : entry.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
