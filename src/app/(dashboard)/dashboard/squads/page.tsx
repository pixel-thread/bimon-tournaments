"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardBody,
    Input,
    Button,
    Select,
    SelectItem,
    Skeleton,
    Avatar,
    Chip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Switch,
} from "@heroui/react";
import {
    Ghost,
    Plus,
    Crown,
    Phone,
    Users,
    Search,
    Shield,
    Check,
    ChevronRight,
    UserPlus,
    MoreVertical,
    RotateCcw,
    Pencil,
    Trash2,
    X,
    Share2,
    ClipboardPaste,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

// ─── Types ────────────────────────────────────────────────────

interface SquadMemberDTO {
    inviteId: string;
    playerId: string;
    displayName: string;
    imageUrl: string;
    isGhost: boolean;
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    isSub: boolean;
}

interface SquadDTO {
    id: string;
    name: string;
    fullName: string | null;
    status: "FORMING" | "FULL" | "CANCELLED" | "REGISTERED";
    entryFee: number;
    createdAt: string;
    confirmedAt: string | null;
    needsPayment: boolean;
    captain: { id: string; displayName: string; imageUrl: string };
    members: SquadMemberDTO[];
    acceptedCount: number;
    activeCount: number;
    totalSlots: number;
    isFull: boolean;
}


interface TournamentOption {
    id: string;
    name: string;
}

interface SeasonOption {
    id: string;
    name: string;
    isCurrent: boolean;
}
// ─── Reusable Player Search Input ─────────────────────────────

interface PlayerSearchResult {
    id: string;
    displayName: string;
    username: string;
    email: string;
    imageUrl: string;
}

function PlayerSearchInput({
    value,
    onChange,
    selectedPlayer,
    onSelectPlayer,
    onClearPlayer,
    placeholder = "Search or type name...",
    label,
    compact = false,
}: {
    value: string;
    onChange: (val: string) => void;
    selectedPlayer: PlayerSearchResult | null;
    onSelectPlayer: (p: PlayerSearchResult) => void;
    onClearPlayer: () => void;
    placeholder?: string;
    label?: string;
    compact?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PlayerSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showResults, setShowResults] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const doSearch = useCallback((q: string) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!q || q.length < 2) { setResults([]); setSearching(false); return; }
        setSearching(true);
        timerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`);
                if (!res.ok) { setResults([]); return; }
                const json = await res.json();
                setResults(json.data ?? []);
            } catch { setResults([]); }
            finally { setSearching(false); }
        }, 300);
    }, []);

    if (selectedPlayer) {
        return (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1.5">
                <Avatar src={selectedPlayer.imageUrl} name={selectedPlayer.displayName || selectedPlayer.username} size="sm" className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium text-primary flex-1 truncate">{selectedPlayer.displayName || selectedPlayer.username}</span>
                <button type="button" className="text-[10px] text-foreground/50 hover:text-foreground cursor-pointer" onClick={onClearPlayer}>✕</button>
            </div>
        );
    }

    return (
        <div className="relative">
            {compact ? (
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={e => {
                        const v = e.target.value;
                        onChange(v);
                        setQuery(v);
                        setShowResults(true);
                        doSearch(v);
                    }}
                    onFocus={() => { if (query.length >= 2) setShowResults(true); }}
                    onBlur={() => setTimeout(() => setShowResults(false), 300)}
                    maxLength={20}
                    className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-foreground/30"
                />
            ) : (
                <Input
                    label={label}
                    placeholder={placeholder}
                    value={value}
                    onValueChange={v => {
                        onChange(v);
                        setQuery(v);
                        setShowResults(true);
                        doSearch(v);
                    }}
                    onFocus={() => { if (query.length >= 2) setShowResults(true); }}
                    // @ts-ignore
                    onBlur={() => setTimeout(() => setShowResults(false), 300)}
                    size="sm"
                    maxLength={20}
                    startContent={<Search className="w-3 h-3 text-default-400" />}
                />
            )}
            {showResults && query.length >= 2 && (results.length > 0 || searching) && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-divider bg-content1 shadow-lg max-h-64 overflow-y-auto overscroll-contain"
                    onTouchStart={e => e.stopPropagation()}
                    onTouchMove={e => e.stopPropagation()}
                >
                    {searching && results.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-foreground/50">Searching...</div>
                    ) : (
                        results.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary/10 active:bg-primary/15 transition-colors text-left cursor-pointer"
                                onMouseDown={e => {
                                    e.preventDefault(); // prevent blur
                                    onSelectPlayer(p);
                                    onChange(p.displayName || p.username);
                                    setShowResults(false);
                                    setResults([]);
                                }}
                                onTouchEnd={e => {
                                    e.preventDefault(); // prevent blur on touch
                                    onSelectPlayer(p);
                                    onChange(p.displayName || p.username);
                                    setShowResults(false);
                                    setResults([]);
                                }}
                            >
                                <Avatar src={p.imageUrl} name={p.displayName || p.username} size="sm" className="w-7 h-7 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{p.displayName || p.username}</p>
                                    <p className="text-[10px] text-foreground/40 truncate">{p.email}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminSquadsPage() {
    const queryClient = useQueryClient();

    // Filters
    const [seasonId, setSeasonId] = useState("");
    const [tournamentId, setTournamentId] = useState("");
    const [pollId, setPollId] = useState("");
    const [search, setSearch] = useState("");

    // Ghost team form
    const [showGhostForm, setShowGhostForm] = useState(false);
    const [ghostTeamName, setGhostTeamName] = useState("");
    const [ghostTeamFullName, setGhostTeamFullName] = useState("");
    const [ghostCaptainName, setGhostCaptainName] = useState("");
    const [ghostCaptainPhone, setGhostCaptainPhone] = useState("");
    const [ghostCaptainPlayer, setGhostCaptainPlayer] = useState<PlayerSearchResult | null>(null);
    const [ghostMembers, setGhostMembers] = useState<{ name: string; player: PlayerSearchResult | null }[]>(
        Array(GAME.squadSize - 1).fill(null).map(() => ({ name: "", player: null }))
    );
    const [ghostCreating, setGhostCreating] = useState(false);
    const [chargeEntryFee, setChargeEntryFee] = useState(false);

    /** Parse pasted roster text and auto-fill the form */
    function parsePastedRoster(text: string) {
        const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        let teamName = "";
        const players: string[] = [];
        const subs: string[] = [];
        let section: "none" | "players" | "subs" = "none";

        for (const line of lines) {
            // Team line: "Team TSMent" or "Team-khorlih" or "Team - khorlih"
            const teamMatch = line.match(/^team[\s\-:]+(.+)$/i);
            if (teamMatch) {
                teamName = teamMatch[1].trim();
                continue;
            }

            // Section headers
            if (/^players?$/i.test(line)) {
                section = "players";
                continue;
            }
            if (/^substitut(e|es|ion|ions)?$/i.test(line)) {
                section = "subs";
                continue;
            }

            // "Players 1 NAME" — header + first player on same line
            const playersInline = line.match(/^players?\s+\d+[.\s)\-]*(.+)$/i);
            if (playersInline) {
                section = "players";
                players.push(playersInline[1].trim());
                continue;
            }

            // Numbered line: "1. Name" or "1 Name" or "1.Name" or "1)Name"
            const numMatch = line.match(/^\d+[.)\s\-]+(.+)$/);
            if (numMatch) {
                const name = numMatch[1].trim();
                if (name) {
                    if (section === "subs") subs.push(name);
                    else players.push(name);
                }
                continue;
            }

            // Bare numbered: "2TSM×SORRYbro" (digit directly followed by non-digit)
            const bareNum = line.match(/^\d+([^\d.\s].*)$/);
            if (bareNum) {
                const name = bareNum[1].trim();
                if (name) {
                    if (section === "subs") subs.push(name);
                    else players.push(name);
                }
                continue;
            }
        }

        // Apply parsed data
        if (teamName) {
            setGhostTeamName(teamName.slice(0, 7));
            if (teamName.length > 7) setGhostTeamFullName(teamName);
        }

        const allNames = [...players, ...subs];
        if (allNames.length > 0) {
            // First player = captain
            setGhostCaptainName(allNames[0]);
            setGhostCaptainPlayer(null);

            // Rest = members
            const memberNames = allNames.slice(1);
            const minSlots = Math.max(GAME.squadSize - 1, memberNames.length);
            const newMembers = Array.from({ length: minSlots }, (_, i) => ({
                name: memberNames[i] || "",
                player: null,
            }));
            setGhostMembers(newMembers);
        }

        toast.success(`Parsed: ${teamName ? `"${teamName}"` : "no team"} + ${allNames.length} player(s)`);
    }

    // Past roster for selected captain
    interface PastRosterMember {
        playerId: string;
        displayName: string;
        imageUrl: string;
        isGhost: boolean;
        isSub: boolean;
        available: boolean;
        existingTeamName: string | null;
    }
    const [pastRoster, setPastRoster] = useState<{ squadName: string; members: PastRosterMember[] } | null>(null);
    const [loadingRoster, setLoadingRoster] = useState(false);

    // Fetch past roster when captain is selected
    useEffect(() => {
        if (!ghostCaptainPlayer || !pollId) {
            setPastRoster(null);
            return;
        }
        setLoadingRoster(true);
        fetch(`/api/squads/previous-roster?pollId=${pollId}&captainId=${ghostCaptainPlayer.id}`)
            .then(r => r.json())
            .then(json => {
                if (json.data && json.data.members?.length > 0) {
                    setPastRoster({ squadName: json.data.squadName, members: json.data.members });
                    // Also auto-fill team name if empty
                    if (!ghostTeamName && json.data.squadName) {
                        setGhostTeamName(json.data.squadName);
                    }
                    if (!ghostTeamFullName && json.data.fullName) {
                        setGhostTeamFullName(json.data.fullName);
                    }
                } else {
                    setPastRoster(null);
                }
            })
            .catch(() => setPastRoster(null))
            .finally(() => setLoadingRoster(false));
    }, [ghostCaptainPlayer, pollId]);

    // Add member to existing squad
    const [addToSquad, setAddToSquad] = useState<SquadDTO | null>(null);
    const [addPlayerName, setAddPlayerName] = useState("");
    const [addPlayerPhone, setAddPlayerPhone] = useState("");
    const [addingPlayer, setAddingPlayer] = useState(false);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    // Edit squad
    const [renameSquad, setRenameSquad] = useState<SquadDTO | null>(null);
    const [renameName, setRenameName] = useState("");
    const [renameFullName, setRenameFullName] = useState("");
    const [renaming, setRenaming] = useState(false);

    // Confirm remove member
    const [confirmRemove, setConfirmRemove] = useState<{ member: SquadMemberDTO; squadName: string } | null>(null);
    const [removing, setRemoving] = useState(false);

    // Confirm cancel squad
    const [confirmCancel, setConfirmCancel] = useState<SquadDTO | null>(null);
    const [cancelling, setCancelling] = useState(false);

    // Player search autocomplete
    const [playerSearchQuery, setPlayerSearchQuery] = useState("");
    const [playerResults, setPlayerResults] = useState<{ id: string; displayName: string; username: string; email: string; imageUrl: string }[]>([]);
    const [searchingPlayers, setSearchingPlayers] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const searchPlayers = useCallback((query: string) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!query || query.length < 2) {
            setPlayerResults([]);
            setSearchingPlayers(false);
            return;
        }
        setSearchingPlayers(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
                if (!res.ok) { setPlayerResults([]); return; }
                const json = await res.json();
                setPlayerResults(json.data ?? []);
            } catch {
                setPlayerResults([]);
            } finally {
                setSearchingPlayers(false);
            }
        }, 300);
    }, []);

    // ─── Data queries ────────────────────────────────────────

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

    useEffect(() => {
        if (seasons.length > 0 && !seasonId) {
            const current = seasons.find(s => s.isCurrent);
            setSeasonId(current?.id ?? seasons[0].id);
        }
    }, [seasons, seasonId]);

    const { data: tournaments = [] } = useQuery<TournamentOption[]>({
        queryKey: ["admin-tournaments", seasonId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments?limit=50&seasonId=${seasonId}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }));
        },
        staleTime: 60_000,
        enabled: !!seasonId,
    });

    useEffect(() => {
        if (tournaments.length > 0 && !tournamentId) {
            setTournamentId(tournaments[0].id);
        }
    }, [tournaments, tournamentId]);

    // Poll is 1:1 with tournament — look up poll ID directly
    const { data: pollForTournament } = useQuery<{ id: string } | null>({
        queryKey: ["admin-poll-for-tournament", tournamentId],
        queryFn: async () => {
            // Use the polls endpoint with all=true to include inactive polls
            const res = await fetch(`/api/polls?all=true`);
            if (!res.ok) return null;
            const json = await res.json();
            // Response: { data: { polls: [...] } }
            const allPolls = json.data?.polls ?? [];
            const match = allPolls.find((p: any) => p.tournament?.id === tournamentId);
            return match ? { id: match.id } : null;
        },
        staleTime: 60_000,
        enabled: !!tournamentId,
    });

    // Auto-set pollId when tournament changes
    useEffect(() => {
        setPollId(pollForTournament?.id ?? "");
    }, [pollForTournament]);

    const { data: squadsResult, isLoading } = useQuery<SquadDTO[]>({
        queryKey: ["admin-squads", pollId],
        queryFn: async () => {
            const res = await fetch(`/api/squads?pollId=${pollId}&includeAll=true`);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            // API returns: { data: [...squads], meta: {...} }
            return json.data as SquadDTO[];
        },
        enabled: !!pollId,
        staleTime: 10_000,
    });

    const squads = squadsResult ?? [];

    const filteredSquads = useMemo(() => {
        if (!search) return squads;
        const q = search.toLowerCase();
        return squads.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.fullName?.toLowerCase().includes(q) ||
            s.captain.displayName.toLowerCase().includes(q) ||
            s.members.some(m => m.displayName.toLowerCase().includes(q))
        );
    }, [squads, search]);

    // ─── Ghost Team Submit ───────────────────────────────────

    async function handleCreateGhostTeam() {
        setGhostCreating(true);
        try {
            const res = await fetch("/api/squads/create-ghost-team", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pollId,
                    name: ghostTeamName.trim(),
                    fullName: ghostTeamFullName.trim() || undefined,
                    captainName: ghostCaptainName.trim(),
                    chargeEntryFee,
                    // If admin selected an existing player, send their ID; otherwise send phone
                    ...(ghostCaptainPlayer
                        ? { captainPlayerId: ghostCaptainPlayer.id }
                        : { captainPhone: ghostCaptainPhone.trim() }),
                    members: ghostMembers.filter(m => m.name.trim()).map(m => m.name.trim()),
                }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Failed"); return; }
            toast.success(json.message || "Team registered!");
            resetGhostForm();
            queryClient.invalidateQueries({ queryKey: ["squads", pollId] });
        } catch {
            toast.error("Failed to register team");
        } finally {
            setGhostCreating(false);
        }
    }

    function resetGhostForm() {
        setShowGhostForm(false);
        setGhostTeamName("");
        setGhostTeamFullName("");
        setGhostCaptainName("");
        setGhostCaptainPhone("");
        setGhostCaptainPlayer(null);
        setGhostMembers(Array(GAME.squadSize - 1).fill(null).map(() => ({ name: "", player: null })));
        setChargeEntryFee(false);
    }

    // ─── Add member to squad ─────────────────────────────────

    function resetAddPlayer() {
        setAddPlayerName("");
        setAddPlayerPhone("");
        setSelectedPlayerId(null);
        setPlayerSearchQuery("");
        setPlayerResults([]);
        setAddToSquad(null);
    }

    async function handleAddPlayer() {
        if (!addToSquad || !addPlayerName.trim()) return;
        setAddingPlayer(true);
        try {
            const res = await fetch(`/api/squads/${addToSquad.id}/add-member`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: addPlayerName.trim(),
                    phone: addPlayerPhone.trim() || undefined,
                    // If a DB player was selected, pass their ID + confirm to auto-add
                    ...(selectedPlayerId ? { playerId: selectedPlayerId, confirm: true } : {}),
                }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Failed"); return; }
            toast.success(json.message || "Player added!");
            resetAddPlayer();
            queryClient.invalidateQueries({ queryKey: ["admin-squads", pollId] });
        } catch {
            toast.error("Failed to add player");
        } finally {
            setAddingPlayer(false);
        }
    }

    // ─── Rename squad ────────────────────────────────────────

    async function handleRename() {
        if (!renameSquad || !renameName.trim()) return;
        setRenaming(true);
        try {
            const res = await fetch(`/api/squads/${renameSquad.id}/rename`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: renameName.trim(), fullName: renameFullName.trim() || null }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Failed"); return; }
            toast.success(json.message || "Renamed!");
            setRenameSquad(null);
            queryClient.invalidateQueries({ queryKey: ["admin-squads", pollId] });
        } catch {
            toast.error("Failed to rename");
        } finally {
            setRenaming(false);
        }
    }

    // ─── Cancel squad ────────────────────────────────────────

    async function handleCancelSquad() {
        if (!confirmCancel) return;
        setCancelling(true);
        try {
            const res = await fetch(`/api/squads/${confirmCancel.id}/cancel`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Failed"); return; }
            toast.success(json.message || "Squad cancelled");
            setConfirmCancel(null);
            queryClient.invalidateQueries({ queryKey: ["admin-squads", pollId] });
        } catch {
            toast.error("Failed to cancel");
        } finally {
            setCancelling(false);
        }
    }

    // ─── Remove member ───────────────────────────────────────

    async function handleRemoveMember() {
        if (!confirmRemove) return;
        setRemoving(true);
        try {
            const res = await fetch(`/api/squads/remove-member`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteId: confirmRemove.member.inviteId }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message || "Failed"); return; }
            toast.success(json.message || "Removed");
            setConfirmRemove(null);
            queryClient.invalidateQueries({ queryKey: ["admin-squads", pollId] });
        } catch {
            toast.error("Failed to remove");
        } finally {
            setRemoving(false);
        }
    }

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="space-y-6" style={{ maxWidth: "100%", overflowX: "hidden" }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Ghost className="w-5 h-5 text-purple-500" />
                        Squads
                    </h1>
                    <p className="text-xs text-foreground/50 mt-0.5">Register teams, add players, manage rosters</p>
                </div>
                {pollId && (
                    <Button
                        color="secondary"
                        startContent={<Plus className="w-4 h-4" />}
                        onPress={() => setShowGhostForm(true)}
                        size="sm"
                        className="font-semibold"
                    >
                        Register Team
                    </Button>
                )}
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {seasons.length > 0 && (
                    <Select
                        placeholder="Season"
                        size="sm"
                        selectedKeys={seasonId ? [seasonId] : []}
                        onSelectionChange={(keys) => {
                            const val = Array.from(keys as Set<string>)[0];
                            setSeasonId(val || "");
                            setTournamentId("");
                            setPollId("");
                        }}
                        classNames={{ trigger: "bg-default-100 border-none shadow-none" }}
                        aria-label="Season"
                        className="w-auto shrink-0"
                    >
                        {seasons.map(s => (
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
                    onSelectionChange={(keys) => {
                        const val = Array.from(keys as Set<string>)[0];
                        setTournamentId(val || "");
                        setPollId("");
                    }}
                    classNames={{ trigger: "bg-default-100 border-none shadow-none" }}
                    aria-label="Tournament"
                    className="flex-1 min-w-[160px]"
                >
                    {tournaments.map(t => (
                        <SelectItem key={t.id} textValue={t.name}>{t.name}</SelectItem>
                    ))}
                </Select>

            </div>

            {/* Search */}
            {pollId && (
                <Input
                    placeholder="Search squads or players..."
                    value={search}
                    onValueChange={setSearch}
                    startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
                    classNames={{ inputWrapper: "bg-default-100 border-none shadow-none h-9", input: "text-sm" }}
                    size="sm"
                    isClearable
                    onClear={() => setSearch("")}
                />
            )}

            {/* Loading */}
            {isLoading && pollId && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
            )}

            {/* No poll */}
            {!pollId && !isLoading && (
                <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-16 text-center">
                    <Shield className="w-10 h-10 text-foreground/20" />
                    <p className="text-sm text-foreground/50">Select a tournament to manage squads</p>
                </div>
            )}

            {/* Stats bar */}
            {pollId && squads.length > 0 && (
                <div className="flex gap-3 text-xs flex-wrap">
                    <Chip size="sm" variant="flat" color="success">{squads.filter(s => s.status !== "CANCELLED" && s.confirmedAt).length} Confirmed</Chip>
                    <Chip size="sm" variant="flat" color="danger">{squads.filter(s => s.status !== "CANCELLED" && !s.confirmedAt).length} Unconfirmed</Chip>
                    <Chip size="sm" variant="flat">{squads.filter(s => s.status === "CANCELLED").length} Cancelled</Chip>
                    <Chip size="sm" variant="flat">{squads.length} Total</Chip>
                </div>
            )}

            {/* Squad cards */}
            {pollId && !isLoading && (() => {
                const confirmed = filteredSquads.filter(s => s.status !== "CANCELLED" && s.confirmedAt);
                const unconfirmed = filteredSquads.filter(s => s.status !== "CANCELLED" && !s.confirmedAt);
                const cancelled = filteredSquads.filter(s => s.status === "CANCELLED");

                const groups = [
                    { label: "✅ Confirmed", squads: confirmed, color: "text-success" },
                    { label: "⚠️ Unconfirmed", squads: unconfirmed, color: "text-danger" },
                    { label: "❌ Cancelled", squads: cancelled, color: "text-foreground/40" },
                ].filter(g => g.squads.length > 0);

                if (filteredSquads.length === 0) {
                    return (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center">
                            <Users className="w-10 h-10 text-foreground/20" />
                            <p className="text-sm text-foreground/50">No squads found</p>
                        </div>
                    );
                }

                return groups.map(group => (
                    <div key={group.label} className="space-y-2">
                        <p className={`text-xs font-bold uppercase tracking-wider ${group.color}`}>
                            {group.label} · {group.squads.length}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {group.squads.map((squad, i) => (
                            <motion.div
                                key={squad.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.02 }}
                            >
                                <Card className="border border-divider overflow-hidden">
                                    <CardBody className="p-3 space-y-2">
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-sm font-bold truncate">{squad.name}</span>
                                                {squad.fullName && (
                                                    <span className="text-[11px] text-foreground/40 truncate">{squad.fullName}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Chip
                                                    size="sm"
                                                    variant="flat"
                                                    color={
                                                        squad.status === "CANCELLED" ? "danger" :
                                                        squad.confirmedAt ? "success" : "danger"
                                                    }
                                                    className="text-[10px]"
                                                >
                                                    {squad.status === "CANCELLED" ? "CANCELLED" :
                                                     squad.confirmedAt ? "CONFIRMED" : "UNCONFIRMED"}
                                                </Chip>
                                                <span className="text-[10px] text-foreground/40 font-medium">
                                                    {squad.acceptedCount}/{squad.totalSlots}
                                                </span>
                                                {squad.status !== "CANCELLED" && (
                                                    <Dropdown>
                                                        <DropdownTrigger>
                                                            <button className="p-1 rounded-md hover:bg-foreground/10 transition-colors cursor-pointer">
                                                                <MoreVertical className="w-3.5 h-3.5 text-foreground/40" />
                                                            </button>
                                                        </DropdownTrigger>
                                                        <DropdownMenu aria-label="Squad actions">
                                                            <DropdownItem
                                                                key="share"
                                                                startContent={<Share2 className="w-3.5 h-3.5" />}
                                                                onPress={() => {
                                                                    const url = `${window.location.origin}/invite/${squad.id}`;
                                                                    const text = `Join my team "${squad.name}"!\n${url}`;
                                                                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                                                                }}
                                                            >
                                                                Share Invite Link
                                                            </DropdownItem>
                                                            <DropdownItem
                                                                key="rename"
                                                                startContent={<Pencil className="w-3.5 h-3.5" />}
                                                                onPress={() => {
                                                                    setRenameSquad(squad);
                                                                    setRenameName(squad.name);
                                                                    setRenameFullName(squad.fullName || "");
                                                                }}
                                                            >
                                                                Rename
                                                            </DropdownItem>
                                                            <DropdownItem
                                                                key="cancel"
                                                                className="text-danger"
                                                                color="danger"
                                                                startContent={<Trash2 className="w-3.5 h-3.5" />}
                                                                onPress={() => setConfirmCancel(squad)}
                                                            >
                                                                Cancel Squad
                                                            </DropdownItem>
                                                        </DropdownMenu>
                                                    </Dropdown>
                                                )}
                                            </div>
                                        </div>

                                        {/* Captain */}
                                        <div className="flex items-center gap-2">
                                            <Avatar src={squad.captain.imageUrl} name={squad.captain.displayName} size="sm" className="w-6 h-6" />
                                            <span className="text-xs font-medium truncate">{squad.captain.displayName}</span>
                                            <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                        </div>

                                        {/* Members */}
                                        <div className="space-y-1">
                                            {squad.members.filter(m => m.status === "ACCEPTED" && m.playerId !== squad.captain.id).map(m => (
                                                <div key={m.inviteId} className="flex items-center gap-2 group">
                                                    {m.isGhost ? (
                                                        <div className="w-5 h-5 rounded-full border border-dashed border-purple-400/50 bg-purple-500/10 flex items-center justify-center shrink-0">
                                                            <Ghost className="w-3 h-3 text-purple-400" />
                                                        </div>
                                                    ) : (
                                                        <Avatar src={m.imageUrl} name={m.displayName} size="sm" className="w-5 h-5" />
                                                    )}
                                                    <span className="text-xs truncate flex-1">{m.displayName}</span>
                                                    {m.isSub && <span className="text-[9px] text-foreground/30">SUB</span>}
                                                    {squad.status !== "CANCELLED" && (
                                                        <button
                                                            className="p-0.5 rounded hover:bg-danger/10 transition-all cursor-pointer"
                                                            onClick={() => setConfirmRemove({ member: m, squadName: squad.name })}
                                                            title={`Remove ${m.displayName}`}
                                                        >
                                                            <X className="w-3 h-3 text-danger" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add player button */}
                                        {squad.status !== "CANCELLED" && (
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                className="w-full text-xs font-medium"
                                                startContent={<UserPlus className="w-3 h-3" />}
                                                onPress={() => setAddToSquad(squad)}
                                            >
                                                Add Player
                                            </Button>
                                        )}
                                    </CardBody>
                                </Card>
                            </motion.div>
                        ))}
                        </div>
                    </div>
                ));
            })()}

            {/* ─── Register Team Modal ─── */}
            <Modal
                isOpen={showGhostForm}
                onClose={resetGhostForm}
                placement="center"
                size="lg"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2 text-base pb-2">
                        <Ghost className="w-4 h-4 text-purple-500" />
                        Register Team
                    </ModalHeader>
                    <ModalBody className="pb-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-foreground/50">
                                {!ghostCaptainPlayer && "Captain phone is required for prize payouts via GPay."}
                                {ghostCaptainPlayer && "Existing player selected — no phone needed."}
                            </p>
                            <Button
                                size="sm"
                                variant="bordered"
                                color="secondary"
                                className="text-[11px] h-7 font-semibold shrink-0"
                                startContent={<ClipboardPaste className="w-3 h-3" />}
                                onPress={async () => {
                                    try {
                                        const text = await navigator.clipboard.readText();
                                        if (!text.trim()) {
                                            toast.error("Clipboard is empty");
                                            return;
                                        }
                                        parsePastedRoster(text);
                                    } catch {
                                        toast.error("Clipboard access denied — copy text first");
                                    }
                                }}
                            >
                                Paste Roster
                            </Button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    label="Team Tag"
                                    placeholder="Max 7 chars"
                                    value={ghostTeamName}
                                    onValueChange={setGhostTeamName}
                                    size="sm"
                                    maxLength={7}
                                    classNames={{ input: "font-semibold" }}
                                />
                                <Input
                                    label="Full Name"
                                    placeholder="Optional"
                                    value={ghostTeamFullName}
                                    onValueChange={setGhostTeamFullName}
                                    size="sm"
                                />
                            </div>

                            {/* Captain */}
                            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                                <p className="text-[11px] font-bold text-purple-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Crown className="w-3 h-3" /> Captain
                                </p>
                                <PlayerSearchInput
                                    label="Captain Name"
                                    placeholder="Search or type captain name..."
                                    value={ghostCaptainName}
                                    onChange={setGhostCaptainName}
                                    selectedPlayer={ghostCaptainPlayer}
                                    onSelectPlayer={(p) => {
                                        setGhostCaptainPlayer(p);
                                        setGhostCaptainName(p.displayName || p.username);
                                    }}
                                    onClearPlayer={() => {
                                        setGhostCaptainPlayer(null);
                                        setGhostCaptainName("");
                                    }}
                                />
                                {!ghostCaptainPlayer && (
                                    <Input
                                        label="Phone"
                                        placeholder="10-digit phone"
                                        description="Required — for GPay payouts"
                                        value={ghostCaptainPhone}
                                        onValueChange={v => {
                                            // Strip country code, spaces, dashes — keep only last 10 digits
                                            const digits = v.replace(/\D/g, "");
                                            const cleaned = digits.length > 10 ? digits.slice(-10) : digits;
                                            setGhostCaptainPhone(cleaned);
                                        }}
                                        size="sm"
                                        type="tel"
                                        maxLength={15}
                                        startContent={<Phone className="w-4 h-4 text-default-400" />}
                                    />
                                )}
                            </div>

                            {/* Past Roster */}
                            {loadingRoster && (
                                <div className="text-xs text-foreground/40 animate-pulse">Loading past roster...</div>
                            )}
                            {pastRoster && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <RotateCcw className="w-3 h-3" /> Past Roster · {pastRoster.squadName}
                                        </p>
                                        <Button
                                            size="sm"
                                            color="warning"
                                            variant="flat"
                                            className="text-[10px] h-6 font-semibold"
                                            onPress={() => {
                                                // Auto-fill members from past roster (use names only — ghost team creates new player records)
                                                const newMembers = pastRoster.members
                                                    .filter(m => !m.isSub) // skip subs, only fill core members
                                                    .map(m => ({
                                                        name: m.displayName,
                                                        player: null, // ghost team — always create new ghost players
                                                    }));
                                                // Pad to minimum squad size
                                                while (newMembers.length < GAME.squadSize - 1) {
                                                    newMembers.push({ name: "", player: null });
                                                }
                                                setGhostMembers(newMembers);
                                                toast.success(`Filled ${newMembers.filter(m => m.name).length} members from past roster`);
                                            }}
                                        >
                                            Use This Roster
                                        </Button>
                                    </div>
                                    <div className="space-y-1">
                                        {pastRoster.members.map(m => (
                                            <div key={m.playerId} className={`flex items-center gap-2 text-xs ${!m.available ? "opacity-40" : ""}`}>
                                                {m.isGhost ? (
                                                    <Ghost className="w-4 h-4 text-purple-400 shrink-0" />
                                                ) : (
                                                    <Avatar src={m.imageUrl} name={m.displayName} size="sm" className="w-4 h-4 shrink-0" />
                                                )}
                                                <span className="truncate flex-1">{m.displayName}</span>
                                                {m.isSub && <span className="text-[9px] text-foreground/30">SUB</span>}
                                                {!m.available && m.existingTeamName && (
                                                    <span className="text-[9px] text-danger">in {m.existingTeamName}</span>
                                                )}
                                                {m.available && <Check className="w-3 h-3 text-success shrink-0" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Members */}
                            <div className="space-y-2">
                                <p className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">Members</p>
                                {ghostMembers.map((member, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/40 shrink-0">
                                            {i + 2}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <PlayerSearchInput
                                                placeholder={`Player ${i + 2}`}
                                                compact
                                                value={member.name}
                                                onChange={v => {
                                                    const arr = [...ghostMembers];
                                                    arr[i] = { name: v, player: null };
                                                    setGhostMembers(arr);
                                                }}
                                                selectedPlayer={member.player}
                                                onSelectPlayer={p => {
                                                    const arr = [...ghostMembers];
                                                    arr[i] = { name: p.displayName || p.username, player: p };
                                                    setGhostMembers(arr);
                                                }}
                                                onClearPlayer={() => {
                                                    const arr = [...ghostMembers];
                                                    arr[i] = { name: "", player: null };
                                                    setGhostMembers(arr);
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {ghostMembers.length < GAME.maxSquadSize - 1 && (
                                    <Button
                                        size="sm"
                                        variant="light"
                                        className="text-xs"
                                        startContent={<Plus className="w-3 h-3" />}
                                        onPress={() => setGhostMembers(prev => [...prev, { name: "", player: null }])}
                                    >
                                        Add Sub Slot
                                    </Button>
                                )}
                            </div>

                            {/* Charge Entry Fee toggle — only when a real player is captain */}
                            {ghostCaptainPlayer && (
                                <div className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold">Charge Entry Fee</p>
                                        <p className="text-[11px] text-foreground/40">Check captain balance as usual</p>
                                    </div>
                                    <Switch
                                        size="sm"
                                        color="warning"
                                        isSelected={chargeEntryFee}
                                        onValueChange={setChargeEntryFee}
                                    />
                                </div>
                            )}

                            <Button
                                color="secondary"
                                className="w-full font-semibold"
                                size="lg"
                                isLoading={ghostCreating}
                                isDisabled={
                                    !ghostTeamName.trim() ||
                                    !ghostCaptainName.trim() ||
                                    (!ghostCaptainPlayer && ghostCaptainPhone.replace(/\D/g, "").length !== 10)
                                }
                                startContent={!ghostCreating && <Ghost className="w-4 h-4" />}
                                onPress={handleCreateGhostTeam}
                            >
                                Register Team
                            </Button>
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* ─── Add Player Modal ─── */}
            <Modal
                isOpen={!!addToSquad}
                onClose={resetAddPlayer}
                placement="center"
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="text-base pb-1 flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-primary" />
                        Add Player to {addToSquad?.name}
                    </ModalHeader>
                    <ModalBody className="pb-5 space-y-3">
                        {/* Search input */}
                        <div className="relative">
                            <Input
                                label="Search Player"
                                placeholder="Type name, username, or email..."
                                value={playerSearchQuery}
                                onValueChange={(val) => {
                                    setPlayerSearchQuery(val);
                                    setSelectedPlayerId(null);
                                    searchPlayers(val);
                                }}
                                size="sm"
                                startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
                                autoFocus
                                description={selectedPlayerId ? undefined : "Search existing players or type a new name below"}
                            />
                            {/* Results dropdown */}
                            {playerSearchQuery.length >= 2 && (playerResults.length > 0 || searchingPlayers) && !selectedPlayerId && (
                                <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border border-divider bg-content1 shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                                    {searchingPlayers && playerResults.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-foreground/50">Searching...</div>
                                    ) : (
                                        playerResults.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-primary/10 transition-colors text-left cursor-pointer"
                                                onClick={() => {
                                                    setSelectedPlayerId(p.id);
                                                    setAddPlayerName(p.displayName || p.username);
                                                    setPlayerSearchQuery(p.displayName || p.username);
                                                    setPlayerResults([]);
                                                }}
                                            >
                                                <Avatar src={p.imageUrl} name={p.displayName || p.username} size="sm" className="w-7 h-7 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{p.displayName || p.username}</p>
                                                    <p className="text-[10px] text-foreground/40 truncate">{p.email}</p>
                                                </div>
                                                <Check className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected player chip */}
                        {selectedPlayerId && (
                            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="text-xs font-medium text-primary flex-1 truncate">Matched: {addPlayerName}</span>
                                <button
                                    type="button"
                                    className="text-[10px] text-foreground/50 hover:text-foreground cursor-pointer"
                                    onClick={() => {
                                        setSelectedPlayerId(null);
                                        setAddPlayerName("");
                                        setPlayerSearchQuery("");
                                    }}
                                >
                                    Clear
                                </button>
                            </div>
                        )}

                        {/* Manual name (for ghost players) */}
                        {!selectedPlayerId && (
                            <Input
                                label="Player Name (manual)"
                                placeholder="In-game name for ghost player"
                                value={addPlayerName}
                                onValueChange={setAddPlayerName}
                                size="sm"
                                maxLength={20}
                            />
                        )}

                        <Input
                            label="Phone (optional)"
                            placeholder="10-digit phone"
                            value={addPlayerPhone}
                            onValueChange={setAddPlayerPhone}
                            size="sm"
                            type="tel"
                            maxLength={10}
                            startContent={<Phone className="w-4 h-4 text-default-400" />}
                        />
                        <Button
                            color="primary"
                            className="w-full font-semibold"
                            isLoading={addingPlayer}
                            isDisabled={!addPlayerName.trim()}
                            startContent={!addingPlayer && <UserPlus className="w-4 h-4" />}
                            onPress={handleAddPlayer}
                        >
                            {selectedPlayerId ? "Add Existing Player" : "Add as Ghost Player"}
                        </Button>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* ─── Rename Modal ─── */}
            <Modal
                isOpen={!!renameSquad}
                onClose={() => setRenameSquad(null)}
                placement="center"
                size="sm"
            >
                <ModalContent>
                    <ModalHeader className="text-base pb-1 flex items-center gap-2">
                        <Pencil className="w-4 h-4 text-primary" />
                        Rename {renameSquad?.name}
                    </ModalHeader>
                    <ModalBody className="pb-5 space-y-3">
                        <Input
                            label="Team Tag"
                            placeholder="Max 7 chars"
                            value={renameName}
                            onValueChange={setRenameName}
                            size="sm"
                            maxLength={7}
                            autoFocus
                            classNames={{ input: "font-semibold" }}
                        />
                        <Input
                            label="Full Name"
                            placeholder="Optional"
                            value={renameFullName}
                            onValueChange={setRenameFullName}
                            size="sm"
                        />
                        <Button
                            color="primary"
                            className="w-full font-semibold"
                            isLoading={renaming}
                            isDisabled={!renameName.trim()}
                            startContent={!renaming && <Check className="w-4 h-4" />}
                            onPress={handleRename}
                        >
                            Save
                        </Button>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* ─── Confirm Remove Member Modal ─── */}
            <Modal
                isOpen={!!confirmRemove}
                onClose={() => setConfirmRemove(null)}
                placement="center"
                size="sm"
            >
                <ModalContent>
                    <ModalHeader className="text-base pb-1 flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-danger" />
                        Remove Player
                    </ModalHeader>
                    <ModalBody className="pb-5 space-y-3">
                        {confirmRemove && (
                            <div className="flex items-center gap-3 rounded-xl bg-danger/5 border border-danger/20 p-3">
                                {confirmRemove.member.isGhost ? (
                                    <div className="w-8 h-8 rounded-full border border-dashed border-purple-400/50 bg-purple-500/10 flex items-center justify-center shrink-0">
                                        <Ghost className="w-4 h-4 text-purple-400" />
                                    </div>
                                ) : (
                                    <Avatar src={confirmRemove.member.imageUrl} name={confirmRemove.member.displayName} size="sm" className="w-8 h-8 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{confirmRemove.member.displayName}</p>
                                    <p className="text-[11px] text-foreground/50">from {confirmRemove.squadName}</p>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-foreground/60">
                            Are you sure you want to remove this player? They will be notified.
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="flat"
                                className="flex-1 font-medium"
                                onPress={() => setConfirmRemove(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                color="danger"
                                className="flex-1 font-semibold"
                                isLoading={removing}
                                startContent={!removing && <Trash2 className="w-4 h-4" />}
                                onPress={handleRemoveMember}
                            >
                                Remove
                            </Button>
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* ─── Confirm Cancel Squad Modal ─── */}
            <Modal
                isOpen={!!confirmCancel}
                onClose={() => setConfirmCancel(null)}
                placement="center"
                size="sm"
            >
                <ModalContent>
                    <ModalHeader className="text-base pb-1 flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-danger" />
                        Cancel Squad
                    </ModalHeader>
                    <ModalBody className="pb-5 space-y-3">
                        {confirmCancel && (
                            <div className="rounded-xl bg-danger/5 border border-danger/20 p-3 space-y-1">
                                <p className="text-sm font-bold">{confirmCancel.name}</p>
                                <p className="text-[11px] text-foreground/50">
                                    Captain: {confirmCancel.captain.displayName} · {confirmCancel.members.filter(m => m.status === "ACCEPTED").length} members
                                </p>
                            </div>
                        )}
                        <p className="text-xs text-danger/80 font-medium">
                            ⚠️ This cannot be undone. All members will be notified and released.
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="flat"
                                className="flex-1 font-medium"
                                onPress={() => setConfirmCancel(null)}
                            >
                                Keep Squad
                            </Button>
                            <Button
                                color="danger"
                                className="flex-1 font-semibold"
                                isLoading={cancelling}
                                startContent={!cancelling && <Trash2 className="w-4 h-4" />}
                                onPress={handleCancelSquad}
                            >
                                Cancel Squad
                            </Button>
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    );
}
