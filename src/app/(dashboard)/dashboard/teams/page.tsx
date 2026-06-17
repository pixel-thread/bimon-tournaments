"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    CardHeader,
    Divider,
    Avatar,
    Chip,
    Skeleton,
    Input,
    Select,
    SelectItem,
    Button,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/react";
import {
    Users,
    Search,
    Trophy,
    Swords,
    Medal,
    Crown,
    AlertCircle,
    Plus,
    ArrowLeftRight,
    Pencil,
    Trash2,
    BarChart3,
    TableProperties,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CreateTeamModal } from "@/components/dashboard/teams/create-team-modal";
import { SwapPlayersModal } from "@/components/dashboard/teams/swap-players-modal";
import { BulkEditStatsModal } from "@/components/dashboard/teams/bulk-edit-stats-modal";
import { StandingsModal } from "@/components/dashboard/teams/standings-modal";
import { SlotsModal } from "@/components/dashboard/teams/slots-modal";
import { EditTeamModal } from "@/components/dashboard/teams/edit-team-modal";
import { ChampionshipPanel } from "@/components/dashboard/teams/championship-panel";
import { GAME } from "@/lib/game-config";

// ─── Types ────────────────────────────────────────────────────

interface TeamPlayer {
    id: string;
    displayName: string | null;
    username: string;
    imageUrl: string | null;
    category: string;
}

interface TeamDTO {
    id: string;
    name: string;
    fullName?: string | null;
    teamNumber: number;
    matchCount: number;
    winner: {
        position: number;
        amount: number;
        isDistributed: boolean;
    } | null;
    players: TeamPlayer[];
}

interface TournamentOption {
    id: string;
    name: string;
    isMangoScrim?: boolean;
}

interface SeasonOption {
    id: string;
    name: string;
    isCurrent: boolean;
}

interface MatchOption {
    id: string;
    matchNumber: number;
    teamCount: number;
    phase: string | null;
}

const PHASE_LABELS: Record<string, string> = {
    HEATS_A: "Grp A",
    HEATS_B: "Grp B",
    WILDCARD: "Wildcard",
    FINALS: "Finals",
};

const CHAMP_TABS = [
    { key: "HEATS", label: "Heats", phases: ["HEATS_A", "HEATS_B"] },
    { key: "WILDCARD", label: "Wildcard", phases: ["WILDCARD"] },
    { key: "FINALS", label: "Finals", phases: ["FINALS"] },
];

// ─── Constants ────────────────────────────────────────────────

const categoryColors: Record<string, "warning" | "primary" | "success" | "secondary" | "danger" | "default"> = {
    LEGEND: "warning",
    ULTRA_PRO: "primary",
    PRO: "success",
    NOOB: "secondary",
    ULTRA_NOOB: "danger",
    BOT: "default",
};

const positionLabels: Record<number, { label: string; color: string }> = {
    1: { label: "🥇 1st", color: "text-yellow-500" },
    2: { label: "🥈 2nd", color: "text-gray-400" },
    3: { label: "🥉 3rd", color: "text-amber-700" },
};

// ─── Page Component ───────────────────────────────────────────

/**
 * /dashboard/teams — Admin teams management.
 * Features: season/tournament/match selectors, create team, swap players,
 * bulk edit stats, delete match, team cards with winner info.
 */
export default function TeamsPage() {
    // Filter state
    const [seasonId, setSeasonId] = useState("");
    const [tournamentId, setTournamentId] = useState("");
    const [matchId, setMatchId] = useState("all");
    const [search, setSearch] = useState("");
    const [champPhase, setChampPhase] = useState<string | null>(null);
    const [heatsGroup, setHeatsGroup] = useState<"A" | "B">("A");

    // Modal state
    const [showCreateTeam, setShowCreateTeam] = useState(false);
    const [showSwapPlayers, setShowSwapPlayers] = useState(false);
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showStandings, setShowStandings] = useState(false);
    const [showSlots, setShowSlots] = useState(false);
    const [showChampionship, setShowChampionship] = useState(false);
    const [editTeam, setEditTeam] = useState<TeamDTO | null>(null);

    const queryClient = useQueryClient();

    // ── Data queries ──────────────────────────────────────────

    const { data: seasons = [] } = useQuery<SeasonOption[]>({
        queryKey: ["seasons"],
        queryFn: async () => {
            const res = await fetch("/api/seasons");
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 5 * 60_000,
    });

    const { data: globalBg } = useQuery<{ publicUrl: string } | null>({
        queryKey: ["global-background"],
        queryFn: async () => {
            const res = await fetch("/api/gallery/global-background");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data ?? null;
        },
        staleTime: 5 * 60_000,
    });

    // Auto-select current season on load
    useEffect(() => {
        if (seasons.length > 0 && !seasonId) {
            const current = seasons.find((s) => s.isCurrent);
            setSeasonId(current?.id ?? seasons[0].id);
        }
    }, [seasons, seasonId]);

    const { data: tournaments = [] } = useQuery<TournamentOption[]>({
        queryKey: ["tournaments-brief", seasonId],
        queryFn: async () => {
            const url = seasonId
                ? `/api/tournaments?limit=50&seasonId=${seasonId}`
                : "/api/tournaments?limit=50";
            const res = await fetch(url);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data.map((t: { id: string; name: string; isMangoScrim?: boolean }) => ({
                id: t.id,
                name: t.name,
                isMangoScrim: t.isMangoScrim ?? false,
            }));
        },
        staleTime: 60_000,
        enabled: !!seasonId,
    });

    // Auto-select latest tournament when tournaments load
    useEffect(() => {
        if (tournaments.length > 0 && !tournamentId) {
            setTournamentId(tournaments[0].id);
        }
    }, [tournaments, tournamentId]);

    const { data: matches = [] } = useQuery<MatchOption[]>({
        queryKey: ["matches-brief", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/matches?tournamentId=${tournamentId}`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data ?? []).map((m: { id: string; matchNumber: number; phase?: string | null }) => ({
                id: m.id,
                matchNumber: m.matchNumber,
                teamCount: 0,
                phase: m.phase ?? null,
            }));
        },
        enabled: !!tournamentId,
        staleTime: 0,
    });

    const { data: teamsResponse, isLoading, error } = useQuery<{ data: TeamDTO[]; allowSquads: boolean }>({
        queryKey: ["teams", tournamentId, matchId],
        queryFn: async () => {
            let url = `/api/teams?tournamentId=${tournamentId}`;
            if (matchId && matchId !== "all") url += `&matchId=${matchId}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return { data: json.data, allowSquads: json.meta?.allowSquads ?? false };
        },
        enabled: !!tournamentId,
        staleTime: 30_000,
    });

    const teams = teamsResponse?.data;
    const allowSquads = teamsResponse?.allowSquads ?? false;

    // ── Derived state ─────────────────────────────────────────

    const filteredTeams = useMemo(() => {
        if (!teams) return [];
        return teams.filter((t) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                t.name.toLowerCase().includes(q) ||
                t.players.some(
                    (p) =>
                        p.displayName?.toLowerCase().includes(q) ||
                        p.username.toLowerCase().includes(q)
                )
            );
        });
    }, [teams, search]);

    const existingPlayerIds = useMemo(
        () => (teams ?? []).flatMap((t) => t.players.map((p) => p.id)),
        [teams]
    );

    const selectedMatch = useMemo(
        () => matches.find((m) => m.id === matchId),
        [matches, matchId]
    );

    // Championship phase detection & filtering
    const isChamp = useMemo(() => matches.some(m => m.phase?.startsWith("HEATS")), [matches]);

    // Fetch championship group assignments
    const { data: champEntries } = useQuery<{ teamId: string; group: string | null; status: string }[]>({
        queryKey: ["champ-entries", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/championship/status`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data?.entries ?? []).map((e: { teamId: string; group: string | null; status: string }) => ({
                teamId: e.teamId,
                group: e.group,
                status: e.status,
            }));
        },
        enabled: isChamp && !!tournamentId,
    });
    const champGroupMap = useMemo(() => {
        if (!champEntries) return null;
        const map = new Map<string, string>();
        champEntries.forEach(e => { if (e.group) map.set(e.teamId, e.group); });
        return map.size > 0 ? map : null;
    }, [champEntries]);
    // Set of team IDs that qualified for finals
    const finalsTeamIds = useMemo(() => {
        if (!champEntries) return null;
        const ids = new Set<string>();
        champEntries.filter(e => e.status === "QUALIFIED").forEach(e => ids.add(e.teamId));
        return ids.size > 0 ? ids : null;
    }, [champEntries]);
    const dqTeamIds = useMemo(() => {
        const ids = new Set<string>();
        // From championship entries (disqualified flag from status API)
        champEntries?.filter(e => e.status === "DISQUALIFIED" || (e as any).disqualified).forEach(e => ids.add(e.teamId));
        // From team.disqualified flag (works for casual tournaments too)
        teams?.filter((t: any) => t.disqualified).forEach((t: any) => ids.add(t.id));
        return Array.from(ids);
    }, [champEntries, teams]);
    const pointDeductionMap = useMemo(() => {
        const map: Record<string, number> = {};
        teams?.forEach((t: any) => {
            if (t.pointDeduction > 0) map[t.id] = t.pointDeduction;
        });
        return map;
    }, [teams]);
    const availableTabs = useMemo(() => {
        if (!isChamp) return [];
        const matchPhases = new Set(matches.map(m => m.phase).filter(Boolean));
        // Always show Heats if championship; for Finals/Wildcard show if matches exist OR heats have matches (progression possible)
        const heatsExist = matchPhases.has("HEATS_A") || matchPhases.has("HEATS_B");
        if (!heatsExist) return [];
        // Determine if lite (no wildcard phase matches exist or expected)
        const hasWildcard = matchPhases.has("WILDCARD");
        const hasFinals = matchPhases.has("FINALS");
        // Show: Heats always, Wildcard only if it has matches, Finals always (for navigation)
        return CHAMP_TABS.filter(tab => {
            if (tab.key === "HEATS") return true;
            if (tab.key === "WILDCARD") return hasWildcard;
            if (tab.key === "FINALS") return hasFinals || !hasWildcard; // Lite: show Finals always; Full: only if matches exist
            return false;
        });
    }, [matches, isChamp]);
    const phaseFilteredMatches = useMemo(() => {
        if (!isChamp || !champPhase) return matches;
        if (champPhase === "HEATS") {
            return matches.filter(m => m.phase === `HEATS_${heatsGroup}`);
        }
        const tab = CHAMP_TABS.find(t => t.key === champPhase);
        if (!tab) return matches;
        return matches.filter(m => m.phase && tab.phases.includes(m.phase));
    }, [matches, isChamp, champPhase, heatsGroup]);

    // Auto-select phase when championship detected
    useEffect(() => {
        if (isChamp && !champPhase && availableTabs.length > 0) {
            setChampPhase(availableTabs[0].key);
        } else if (!isChamp) {
            setChampPhase(null);
        }
    }, [isChamp, champPhase, availableTabs]);

    // Auto-select first match when phase or group changes
    useEffect(() => {
        if (isChamp && champPhase && phaseFilteredMatches.length > 0) {
            setMatchId(phaseFilteredMatches[0].id);
        }
    }, [champPhase, heatsGroup]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Create match mutation ─────────────────────────────────

    const { mutate: createMatch, isPending: isCreating } = useMutation({
        mutationFn: async (count: number = 1) => {
            // For championship, pass the current phase so the new match
            // inherits the same phase and only clones that phase's teams
            const currentPhase = isChamp && champPhase
                ? champPhase === "HEATS" ? `HEATS_${heatsGroup}` : champPhase
                : undefined;
            const res = await fetch("/api/matches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tournamentId, phase: currentPhase, count }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed");
            return json;
        },
        onSuccess: async (data) => {
            toast.success(data.message || "Match created");
            // Remove stale cache first, then refetch
            queryClient.removeQueries({ queryKey: ["matches-brief", tournamentId] });
            await queryClient.invalidateQueries({ queryKey: ["matches-brief"] });
            await queryClient.invalidateQueries({ queryKey: ["teams"] });
            // Auto-select the newly created match
            if (data.data?.id) {
                setMatchId(data.data.id);
            }
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // ── Delete match mutation ─────────────────────────────────

    const { mutate: deleteMatch, isPending: isDeleting } = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed");
            return json;
        },
        onSuccess: async (data) => {
            toast.success(data.message || "Match deleted");
            setMatchId("all");
            queryClient.removeQueries({ queryKey: ["matches-brief", tournamentId] });
            await queryClient.invalidateQueries({ queryKey: ["teams"] });
            await queryClient.invalidateQueries({ queryKey: ["matches-brief"] });
            setShowDeleteConfirm(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // ── Handlers ──────────────────────────────────────────────

    function handleSeasonChange(keys: "all" | Set<string | number>) {
        const val = Array.from(keys as Set<string>)[0] as string;
        setSeasonId(val || "");
        setTournamentId("");
        setMatchId("all");
    }

    function handleTournamentChange(keys: "all" | Set<string | number>) {
        const val = Array.from(keys as Set<string>)[0] as string;
        setTournamentId(val || "");
        setMatchId("all");
    }

    function handleMatchChange(keys: "all" | Set<string | number>) {
        const val = Array.from(keys as Set<string>)[0] as string;
        if (val?.startsWith("create-new")) {
            const count = parseInt(val.replace("create-new-", "")) || 1;
            createMatch(count);
            return;
        }
        setMatchId(val || "");
    }

    // ── Render ────────────────────────────────────────────────

    return (
        <div className="space-y-6" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
            {/* Header + Filters */}
            <div className="space-y-2">
                <h1 className="text-xl font-bold">Teams</h1>

                {/* Season + Tournament side by side */}
                <div className="flex gap-2 w-full">
                    {seasons.length > 0 && (
                        <Select
                            placeholder="Season"
                            size="sm"
                            selectedKeys={seasonId ? [seasonId] : []}
                            onSelectionChange={handleSeasonChange}
                            classNames={{ trigger: "bg-default-100 border-none shadow-none", value: "text-foreground" }}
                            aria-label="Season"
                            className="w-auto shrink-0"
                        >
                            {seasons.map((s) => (
                                <SelectItem key={s.id} textValue={`${s.name}${s.isCurrent ? " ✦" : ""}`}>
                                    {s.name}{s.isCurrent ? " ✦" : ""}
                                </SelectItem>
                            ))}
                        </Select>
                    )}
                    <Select
                        placeholder="Tournament"
                        size="sm"
                        selectedKeys={tournamentId ? [tournamentId] : []}
                        onSelectionChange={handleTournamentChange}
                        classNames={{ trigger: "bg-default-100 border-none shadow-none", value: "text-foreground" }}
                        aria-label="Tournament"
                        className="flex-1 min-w-0"
                        popoverProps={{ className: "w-fit" }}
                    >
                        {tournaments.map((t) => (
                            <SelectItem key={t.id} textValue={t.name}>{t.name}</SelectItem>
                        ))}
                    </Select>
                </div>

                {/* Championship Phase Tabs */}
                {tournamentId && isChamp && availableTabs.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                        {availableTabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setChampPhase(tab.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                    champPhase === tab.key
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-default-100 text-foreground/50 hover:text-foreground/80 hover:bg-default-200"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}

                        {/* Group sub-selector for Heats */}
                        {champPhase === "HEATS" && (
                            <>
                                <div className="w-px h-5 bg-default-200 mx-1" />
                                {(["A", "B"] as const).map((g) => (
                                    <button
                                        key={g}
                                        onClick={() => setHeatsGroup(g)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                            heatsGroup === g
                                                ? g === "A" ? "bg-blue-500/20 text-blue-500 border border-blue-500/30" : "bg-purple-500/20 text-purple-500 border border-purple-500/30"
                                                : "bg-default-100 text-foreground/40 hover:text-foreground/70 hover:bg-default-200 border border-transparent"
                                        }`}
                                    >
                                        Group {g}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* Match + Action Buttons — same row */}
                {tournamentId && (
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        <Select
                            placeholder="Match"
                            size="sm"
                            selectedKeys={matchId ? [matchId] : []}
                            onSelectionChange={handleMatchChange}
                            classNames={{ trigger: "bg-default-100 border-none shadow-none", value: "text-foreground" }}
                            aria-label="Match"
                            isLoading={isCreating}
                            className="w-[160px] min-w-[160px]"
                        >
                            {[
                                <SelectItem key="all" textValue="All Matches">All Matches</SelectItem>,
                                ...phaseFilteredMatches.map((m, idx) => {
                                    const phaseLabel = m.phase ? PHASE_LABELS[m.phase] : null;
                                    // In championship, show group-relative number (M1, M2 per group)
                                    const matchNum = phaseLabel ? idx + 1 : m.matchNumber;
                                    const displayText = phaseLabel
                                        ? `M${matchNum} · ${phaseLabel}`
                                        : `Match ${m.matchNumber}`;
                                    return (
                                        <SelectItem key={m.id} textValue={displayText}>
                                            {displayText}
                                        </SelectItem>
                                    );
                                }),
                                <SelectItem
                                    key="create-new-1"
                                    textValue="+ 1 Match"
                                    className="text-success data-[hover=true]:text-success"
                                >
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                        <Plus className="h-3 w-3" />
                                        1 Match
                                    </span>
                                </SelectItem>,
                                <SelectItem
                                    key="create-new-2"
                                    textValue="+ 2 Matches"
                                    className="text-success data-[hover=true]:text-success"
                                >
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                        <Plus className="h-3 w-3" />
                                        2 Matches
                                    </span>
                                </SelectItem>,
                                <SelectItem
                                    key="create-new-3"
                                    textValue="+ 3 Matches"
                                    className="text-success data-[hover=true]:text-success"
                                >
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                        <Plus className="h-3 w-3" />
                                        3 Matches
                                    </span>
                                </SelectItem>,
                            ]}
                        </Select>
                        <Divider orientation="vertical" className="h-5" />
                        <Button size="sm" color="primary" variant="flat" isIconOnly onPress={() => setShowCreateTeam(true)} isDisabled={!matchId || matchId === "all"} className="h-8 w-8 min-w-8 shrink-0">
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="flat" isIconOnly onPress={() => setShowSwapPlayers(true)} className="h-8 w-8 min-w-8 shrink-0">
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="flat" isIconOnly onPress={() => setShowBulkEdit(true)} className="h-8 w-8 min-w-8 shrink-0">
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="flat" isIconOnly onPress={() => setShowStandings(true)} className="h-8 w-8 min-w-8 shrink-0">
                            <BarChart3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="flat" isIconOnly onPress={() => setShowSlots(true)} className="h-8 w-8 min-w-8 shrink-0">
                            <TableProperties className="h-3.5 w-3.5" />
                        </Button>
                        {matchId && matchId !== "all" && (
                            <Button size="sm" variant="flat" color="danger" isIconOnly onPress={() => setShowDeleteConfirm(true)} className="h-8 w-8 min-w-8 shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        <Divider orientation="vertical" className="h-5" />
                        {isChamp && (
                            <Button size="sm" variant="flat" isIconOnly onPress={() => setShowChampionship(true)} className="h-8 w-8 min-w-8 shrink-0" title="Championship">
                                <Trophy className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                )}

                {/* Search */}
                {tournamentId && (
                    <Input
                        placeholder="Search teams..."
                        value={search}
                        onValueChange={setSearch}
                        startContent={<Search className="h-3.5 w-3.5 text-default-400" />}
                        classNames={{
                            inputWrapper: "bg-default-100 border-none shadow-none h-9",
                            input: "text-sm",
                        }}
                        size="sm"
                        isClearable
                        onClear={() => setSearch("")}
                    />
                )}
            </div>

            {/* No tournament selected */}
            {!tournamentId && (
                <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center">
                    <Swords className="h-10 w-10 text-foreground/20" />
                    <p className="text-sm text-foreground/50">
                        Select a tournament to view teams
                    </p>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger dark:bg-danger-50/10">
                    <AlertCircle className="h-4 w-4" />
                    Failed to load teams.
                </div>
            )}

            {isLoading && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-40 rounded-xl" />
                    ))}
                </div>
            )}
            {/* Championship phase with no matches yet */}
            {isChamp && champPhase && phaseFilteredMatches.length === 0 && !isLoading && (
                <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-amber-500/40" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground/70">
                            {champPhase === "FINALS" ? "Finals" : champPhase === "WILDCARD" ? "Wildcard" : "This phase"} — No matches yet
                        </p>
                        <p className="text-xs text-foreground/40 mt-1 max-w-xs mx-auto">
                            {champPhase === "FINALS"
                                ? "Progress from Heats to create Finals matches. Top 8 from each group will advance."
                                : champPhase === "WILDCARD"
                                ? "Progress from Heats to create Wildcard matches."
                                : "No matches have been created for this phase yet."}
                        </p>
                    </div>
                </div>
            )}

            {/* Team cards */}
            {filteredTeams && !(isChamp && champPhase && phaseFilteredMatches.length === 0) && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 overflow-hidden">
                    {filteredTeams.length === 0 && !isLoading ? (
                        <div className="col-span-full flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center">
                            <Users className="h-10 w-10 text-foreground/20" />
                            <p className="text-sm text-foreground/50">No teams found</p>
                        </div>
                    ) : (
                        filteredTeams.map((team, i) => (
                            <motion.div
                                key={team.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.02 }}
                            >
                                <Card className="border border-divider" style={{ overflow: 'hidden', maxWidth: '100%' }}>
                                    <CardHeader className="justify-between pb-1 gap-2" style={{ overflow: 'hidden' }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                {team.teamNumber}
                                            </span>
                                            <span className="text-sm font-semibold text-foreground/50 truncate">
                                                {allowSquads && team.name && team.name !== `Team ${team.teamNumber}` ? team.name : `Team ${team.teamNumber}`}
                                            </span>
                                        </div>
                                        {team.winner && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Medal className="h-3.5 w-3.5 text-warning" />
                                                <span
                                                    className={`text-xs font-semibold whitespace-nowrap ${positionLabels[team.winner.position]?.color ?? ""}`}
                                                >
                                                    {positionLabels[team.winner.position]?.label ??
                                                        `#${team.winner.position}`}
                                                </span>
                                                {team.winner.amount > 0 && (
                                                    <Chip
                                                        size="sm"
                                                        variant="flat"
                                                        color="warning"
                                                        className="ml-1"
                                                    >
                                                        {team.winner.amount} {GAME.currency}
                                                    </Chip>
                                                )}
                                            </div>
                                        )}
                                    </CardHeader>
                                    <Divider />
                                    <CardBody className="space-y-2 pt-2">
                                        {team.players.map((player) => (
                                            <div
                                                key={player.id}
                                                className="flex items-center gap-2 min-w-0"
                                            >
                                                <Avatar
                                                    src={player.imageUrl || undefined}
                                                    name={player.displayName || player.username}
                                                    size="sm"
                                                    className="h-7 w-7"
                                                />
                                                <span className="flex-1 truncate text-sm">
                                                    {player.displayName || player.username}
                                                </span>
                                                <Chip
                                                    size="sm"
                                                    variant="flat"
                                                    color={categoryColors[player.category] ?? "default"}
                                                    className="text-[10px] shrink-0"
                                                >
                                                    {player.category.replace("_", " ")}
                                                </Chip>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs text-foreground/30">
                                                {team.matchCount} matches played
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="light"
                                                isIconOnly
                                                onPress={() => setEditTeam(team)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </CardBody>
                                </Card>
                            </motion.div>
                        ))
                    )}
                </div>
            )}

            {/* ── Modals ── */}

            {/* Create Team */}
            <CreateTeamModal
                isOpen={showCreateTeam}
                onClose={() => setShowCreateTeam(false)}
                tournamentId={tournamentId}
                matchId={matchId}
                existingPlayerIds={existingPlayerIds}
            />

            {/* Swap Players */}
            <SwapPlayersModal
                isOpen={showSwapPlayers}
                onClose={() => setShowSwapPlayers(false)}
                tournamentId={tournamentId}
                teams={(teams ?? []).map((t) => ({
                    id: t.id,
                    name: t.name,
                    teamNumber: t.teamNumber,
                    players: t.players.map((p) => ({
                        id: p.id,
                        displayName: p.displayName,
                        username: p.username,
                        imageUrl: p.imageUrl,
                    })),
                }))}
            />

            {/* Bulk Edit Stats */}
            <BulkEditStatsModal
                isOpen={showBulkEdit}
                onClose={() => setShowBulkEdit(false)}
                tournamentId={tournamentId}
                matchId={matchId}
                matches={matches}
                phaseFilter={
                    isChamp && champPhase
                        ? champPhase === "HEATS" ? `HEATS_${heatsGroup}` : champPhase
                        : undefined
                }
            />

            {/* Overall Standings */}
            <StandingsModal
                isOpen={showStandings}
                onClose={() => setShowStandings(false)}
                tournamentId={tournamentId}
                teams={teams ?? []}
                tournamentTitle={tournaments.find((t) => t.id === tournamentId)?.name ?? ""}
                seasonName={seasons.find((s) => s.id === seasonId)?.name ?? ""}
                backgroundImage={
                    tournaments.find((t) => t.id === tournamentId)?.isMangoScrim
                        ? "/images/mango-scrim-bg.png"
                        : (globalBg?.publicUrl || "/images/image.webp")
                }
                allowSquads={allowSquads}
                isChampionship={isChamp}
                initialGroup={isChamp && champPhase === "HEATS" ? heatsGroup : undefined}
                disqualifiedTeamIds={dqTeamIds}
                pointDeductionMap={isChamp && champPhase !== "HEATS" ? {} : pointDeductionMap}
                championshipPhase={isChamp ? champPhase ?? undefined : undefined}
            />

            {/* Slots Export */}
            <SlotsModal
                isOpen={showSlots}
                onClose={() => setShowSlots(false)}
                tournamentTitle={tournaments.find((t) => t.id === tournamentId)?.name ?? ""}
                tournamentId={tournamentId}
                teams={
                    // Finals: show only qualified teams (flat, no A/B grouping)
                    isChamp && champPhase === "FINALS" && finalsTeamIds
                        ? (teams ?? []).filter(t => finalsTeamIds.has(t.id))
                        : (teams ?? [])
                }
                seasonName={seasons.find((s) => s.id === seasonId)?.name ?? ""}
                backgroundImage={
                    tournaments.find((t) => t.id === tournamentId)?.isMangoScrim
                        ? "/images/mango-scrim-bg.png"
                        : (globalBg?.publicUrl || "/images/image.webp")
                }
                allowSquads={allowSquads}
                championshipGroups={isChamp && champPhase === "HEATS" ? (champGroupMap ?? undefined) : undefined}
                phaseLabel={isChamp && champPhase ? (champPhase === "HEATS" ? `Heats · Group ${heatsGroup}` : PHASE_LABELS[champPhase] ?? champPhase) : undefined}
            />

            {/* Delete Match Confirmation */}
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} size="sm">
                <ModalContent>
                    <ModalHeader>
                        {selectedMatch?.matchNumber === 1 ? "Reset Tournament?" : "Delete Match?"}
                    </ModalHeader>
                    <ModalBody>
                        {selectedMatch?.matchNumber === 1 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-danger font-medium">
                                    ⚠️ This will fully reset the tournament!
                                </p>
                                <ul className="text-sm text-foreground/60 list-disc pl-4 space-y-1">
                                    <li>Delete ALL matches, teams & stats</li>
                                    <li>Refund entry fees to player wallets</li>
                                    <li>Reactivate the poll for voting</li>
                                    <li>Set tournament back to ACTIVE</li>
                                </ul>
                            </div>
                        ) : (
                            <p className="text-sm text-foreground/60">
                                This will permanently delete Match #{selectedMatch?.matchNumber} and all
                                associated team stats, player stats, and records. This cannot be undone.
                            </p>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            onPress={() => setShowDeleteConfirm(false)}
                            size="sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            onPress={() => deleteMatch()}
                            isLoading={isDeleting}
                            size="sm"
                        >
                            {selectedMatch?.matchNumber === 1 ? "Reset Tournament" : "Delete"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Team Modal */}
            {editTeam && (
                <EditTeamModal
                    isOpen={!!editTeam}
                    onClose={() => setEditTeam(null)}
                    teamId={editTeam.id}
                    teamName={editTeam.name}
                    teamNumber={editTeam.teamNumber}
                    initialPlayers={editTeam.players}
                    isChampionship={isChamp}
                    tournamentId={tournamentId}
                />
            )}

            {/* Championship Panel */}
            <ChampionshipPanel
                isOpen={showChampionship}
                onClose={() => setShowChampionship(false)}
                tournamentId={tournamentId}
                tournamentName={tournaments.find((t) => t.id === tournamentId)?.name ?? ""}
            />
        </div>
    );
}
