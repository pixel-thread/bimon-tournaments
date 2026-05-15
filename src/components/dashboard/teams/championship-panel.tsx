"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Chip,
    Spinner,
    Divider,
} from "@heroui/react";
import {
    Trophy,
    ChevronRight,
    Users,
    Shield,
    Zap,
    Crown,
    AlertCircle,
    Check,
    Clock,
    XCircle,
    Ban,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────────── */

interface ChampionshipEntry {
    teamId: string;
    teamName: string;
    group: string | null;
    phase: string;
    status: string;
    disqualified?: boolean;
}

interface ChampionshipMatch {
    id: string;
    matchNumber: number;
    phase: string | null;
    hasStats: boolean;
}

interface ChampionshipStatus {
    currentPhase: "HEATS" | "WILDCARD" | "FINALS" | "COMPLETE";
    isLite: boolean;
    entries: ChampionshipEntry[];
    matches: ChampionshipMatch[];
}

interface ChampionshipPanelProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    tournamentName: string;
}

/* ─── Status Colors ─────────────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    ACTIVE: { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", icon: <Zap className="w-3 h-3" /> },
    QUALIFIED: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", icon: <Check className="w-3 h-3" /> },
    WILDCARD: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", icon: <Clock className="w-3 h-3" /> },
    ELIMINATED: { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400", icon: <XCircle className="w-3 h-3" /> },
    STANDBY: { bg: "bg-foreground/10", text: "text-foreground/50", icon: <Clock className="w-3 h-3" /> },
};

const PHASE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    HEATS: { label: "Heats", icon: <Users className="w-4 h-4" />, color: "text-blue-500" },
    WILDCARD: { label: "Wildcard", icon: <Zap className="w-4 h-4" />, color: "text-amber-500" },
    FINALS: { label: "Grand Finals", icon: <Crown className="w-4 h-4" />, color: "text-emerald-500" },
    COMPLETE: { label: "Complete", icon: <Trophy className="w-4 h-4" />, color: "text-amber-500" },
};

/* ─── Main Component ────────────────────────────────────────── */

export function ChampionshipPanel({
    isOpen,
    onClose,
    tournamentId,
    tournamentName,
}: ChampionshipPanelProps) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<"HEATS" | "WILDCARD" | "FINALS">("HEATS");

    const { data: status, isLoading } = useQuery<ChampionshipStatus>({
        queryKey: ["championship-status", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/championship/status`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data;
        },
        enabled: isOpen && !!tournamentId,
        staleTime: 10_000,
    });

    const isLite = status?.isLite ?? false;

    const progressMutation = useMutation({
        mutationFn: async (from: "HEATS" | "WILDCARD") => {
            const res = await fetch(`/api/tournaments/${tournamentId}/championship/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to progress");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["championship-status", tournamentId] });
            queryClient.invalidateQueries({ queryKey: ["matches-brief", tournamentId] });
            queryClient.invalidateQueries({ queryKey: ["teams", tournamentId] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleProgress = useCallback(() => {
        if (!status) return;
        const from = status.currentPhase === "HEATS" ? "HEATS" : "WILDCARD";
        if (!window.confirm(
            `Are you sure you want to progress from ${from}? This will rank teams, qualify/eliminate them, and create matches for the next phase. This cannot be undone.`
        )) return;
        progressMutation.mutate(from as "HEATS" | "WILDCARD");
    }, [status, progressMutation]);

    // Derived data
    const groupAEntries = status?.entries.filter(e => e.group === "A") ?? [];
    const groupBEntries = status?.entries.filter(e => e.group === "B") ?? [];
    const wildcardEntries = status?.entries.filter(e => e.phase === "WILDCARD" || e.status === "WILDCARD") ?? [];
    const finalsEntries = status?.entries.filter(e => e.phase === "FINALS" || e.status === "QUALIFIED") ?? [];
    const standbyEntries = status?.entries.filter(e => e.status === "STANDBY") ?? [];

    const heatsMatches = status?.matches.filter(m => m.phase?.startsWith("HEATS")) ?? [];
    const wildcardMatches = status?.matches.filter(m => m.phase === "WILDCARD") ?? [];
    const finalsMatches = status?.matches.filter(m => m.phase === "FINALS") ?? [];

    // Can progress?
    const canProgressHeats = status?.currentPhase === "HEATS" &&
        heatsMatches.length > 0 &&
        heatsMatches.every(m => m.hasStats);

    // Wildcard progression only available in full (non-Lite) mode
    const canProgressWildcard = !isLite &&
        status?.currentPhase === "WILDCARD" &&
        wildcardMatches.length > 0 &&
        wildcardMatches.every(m => m.hasStats);

    const canProgress = canProgressHeats || canProgressWildcard;

    // Unscored match counts for display
    const unscoredHeats = heatsMatches.filter(m => !m.hasStats).length;
    const unscoredWildcard = wildcardMatches.filter(m => !m.hasStats).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" placement="center" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-base pb-1">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="truncate block">{tournamentName}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-normal text-foreground/50">
                                Championship{isLite ? " Lite" : ""}
                            </span>
                            {status && (
                                <Chip
                                    size="sm"
                                    variant="flat"
                                    className={`${PHASE_LABELS[status.currentPhase]?.color ?? ""}`}
                                    startContent={PHASE_LABELS[status.currentPhase]?.icon}
                                >
                                    {PHASE_LABELS[status.currentPhase]?.label ?? status.currentPhase}
                                </Chip>
                            )}
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-4 py-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner size="lg" />
                        </div>
                    ) : !status || status.entries.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                            <AlertCircle className="h-10 w-10 text-foreground/20" />
                            <p className="text-sm text-foreground/50">
                                No championship entries yet. Generate teams first.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Phase Progress Bar */}
                            <div className="flex items-center gap-1 px-2">
                                {(isLite
                                    ? ["HEATS", "FINALS"] as const
                                    : ["HEATS", "WILDCARD", "FINALS"] as const
                                ).map((phase, i, arr) => {
                                    const isCurrent = status.currentPhase === phase;
                                    const isPast = (
                                        (phase === "HEATS" && (status.currentPhase === "WILDCARD" || status.currentPhase === "FINALS" || status.currentPhase === "COMPLETE")) ||
                                        (phase === "WILDCARD" && (status.currentPhase === "FINALS" || status.currentPhase === "COMPLETE")) ||
                                        (phase === "FINALS" && status.currentPhase === "COMPLETE")
                                    );
                                    return (
                                        <div key={phase} className="flex items-center flex-1">
                                            <button
                                                onClick={() => setActiveTab(phase)}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer
                                                    ${activeTab === phase
                                                        ? isCurrent
                                                            ? "bg-primary/15 text-primary border border-primary/30"
                                                            : isPast
                                                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                                                : "bg-default-100 text-foreground/60 border border-default-200"
                                                        : isPast
                                                            ? "bg-emerald-500/5 text-emerald-600/50 dark:text-emerald-400/50"
                                                            : "bg-default-50 text-foreground/30"
                                                    }
                                                `}
                                            >
                                                {PHASE_LABELS[phase].label}
                                                {isPast && " ✓"}
                                            </button>
                                            {i < arr.length - 1 && (
                                                <ChevronRight className="w-3 h-3 text-foreground/20 mx-0.5 shrink-0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Phase Content */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.15 }}
                                    className="space-y-3"
                                >
                                    {activeTab === "HEATS" && (
                                        <>
                                            {/* Group A */}
                                            <GroupSection
                                                title="Group A"
                                                subtitle={isLite ? "Top 8 advance to Finals" : undefined}
                                                entries={groupAEntries}
                                                matches={heatsMatches.filter(m => m.phase === "HEATS_A")}
                                                qualifyCutoff={isLite ? 8 : undefined}
                                            />
                                            {/* Group B */}
                                            <GroupSection
                                                title="Group B"
                                                subtitle={isLite ? "Top 8 advance to Finals" : undefined}
                                                entries={groupBEntries}
                                                matches={heatsMatches.filter(m => m.phase === "HEATS_B")}
                                                qualifyCutoff={isLite ? 8 : undefined}
                                            />
                                            {standbyEntries.length > 0 && (
                                                <div className="rounded-lg bg-foreground/5 p-3 space-y-2">
                                                    <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">
                                                        ⌛ Standby ({standbyEntries.length})
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {standbyEntries.map(e => (
                                                            <Chip key={e.teamId} size="sm" variant="flat" className="bg-foreground/10 text-foreground/40">
                                                                {e.teamName}
                                                            </Chip>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {unscoredHeats > 0 && (
                                                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                                                    ⚠️ {unscoredHeats} match{unscoredHeats > 1 ? "es" : ""} still need scores before progression.
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {activeTab === "WILDCARD" && (
                                        <GroupSection
                                            title="Wildcard Round"
                                            subtitle="Top 8 advance to Finals"
                                            entries={wildcardEntries}
                                            matches={wildcardMatches}
                                        />
                                    )}

                                    {activeTab === "FINALS" && (
                                        <GroupSection
                                            title="Grand Finals"
                                            subtitle="8 direct qualifiers + 8 wildcard survivors"
                                            entries={finalsEntries}
                                            matches={finalsMatches}
                                        />
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="border-t border-divider pt-3">
                    <Button variant="flat" size="sm" onPress={onClose}>
                        Close
                    </Button>
                    {canProgress && (
                        <Button
                            color="primary"
                            size="sm"
                            onPress={handleProgress}
                            isLoading={progressMutation.isPending}
                            startContent={!progressMutation.isPending && <ChevronRight className="w-3.5 h-3.5" />}
                            className="font-semibold"
                        >
                            {status?.currentPhase === "HEATS"
                                ? isLite ? "Progress to Finals" : "Progress to Wildcard"
                                : "Progress to Finals"}
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

/* ─── Group Section ─────────────────────────────────────────── */

function GroupSection({
    title,
    subtitle,
    entries,
    matches,
    qualifyCutoff,
}: {
    title: string;
    subtitle?: string;
    entries: ChampionshipEntry[];
    matches: ChampionshipMatch[];
    qualifyCutoff?: number;
}) {
    return (
        <div className="rounded-lg border border-divider overflow-hidden">
            <div className="px-3 py-2 bg-default-50 flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider">{title}</p>
                    {subtitle && <p className="text-[10px] text-foreground/40">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                    <Chip size="sm" variant="flat" className="bg-foreground/10">
                        {entries.length} teams
                    </Chip>
                    {matches.length > 0 && (
                        <Chip
                            size="sm"
                            variant="flat"
                            className={matches.every(m => m.hasStats)
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            }
                        >
                            {matches.filter(m => m.hasStats).length}/{matches.length} scored
                        </Chip>
                    )}
                </div>
            </div>
            <div className="p-2 space-y-1">
                {entries.length === 0 ? (
                    <p className="text-xs text-foreground/30 text-center py-4">No teams in this phase yet</p>
                ) : (
                    entries.map((entry, i) => {
                        const isDQ = !!entry.disqualified;
                        const style = isDQ
                            ? { bg: "bg-red-500/25", text: "text-red-500 dark:text-red-400 font-bold", icon: <Ban className="w-3 h-3" /> }
                            : (STATUS_STYLES[entry.status] ?? STATUS_STYLES.ACTIVE);
                        const isEliminated = qualifyCutoff != null && i >= qualifyCutoff;
                        return (
                            <div key={entry.teamId}>
                                {/* Divider between qualified and eliminated */}
                                {qualifyCutoff != null && i === qualifyCutoff && (
                                    <div className="flex items-center gap-2 py-1.5 px-2">
                                        <div className="flex-1 h-px bg-red-500/20" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-red-400/60">Eliminated</span>
                                        <div className="flex-1 h-px bg-red-500/20" />
                                    </div>
                                )}
                                <div
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-default-100/50 transition-colors ${isEliminated || isDQ ? "opacity-40" : ""}`}
                                >
                                    <span className="w-5 text-center text-[10px] font-bold text-foreground/30">
                                        {i + 1}
                                    </span>
                                    <Shield className="w-3 h-3 text-foreground/30 shrink-0" />
                                    <span className={`text-sm font-medium truncate flex-1 ${isEliminated || isDQ ? "line-through" : ""}`}>
                                        {entry.teamName}
                                    </span>
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        className={`${style.bg} ${style.text}`}
                                        startContent={style.icon}
                                    >
                                        {isDQ ? "DQ" : entry.status}
                                    </Chip>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
