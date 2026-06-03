"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardBody } from "@heroui/react";
import { Shield, Check, X, Users, RefreshCw, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface PlayerAccess {
    id: string;
    displayName: string;
    imageUrl: string;
    discordId: string | null;
    discordUsername: string | null;
    hasAccess: boolean;
    isLinked: boolean;
}

interface TeamAccess {
    id: string;
    name: string;
    teamNumber: number;
    players: PlayerAccess[];
}

interface ChannelAccessData {
    teams: TeamAccess[];
    channelId: string | null;
    availableChannels: string[];
    totalPlayers: number;
    linkedPlayers: number;
    grantedPlayers: number;
}

interface InPlayTournament {
    id: string;
    name: string;
    type: string;
    allowSquads: boolean;
    isChampionship: boolean;
    groups: string[];
}

export function DiscordAccessManager() {
    const queryClient = useQueryClient();
    const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
    const [selectedGroup, setSelectedGroup] = useState<string>("");
    const [grantingTeam, setGrantingTeam] = useState<string | null>(null);
    const [grantingAll, setGrantingAll] = useState(false);

    // Fetch tournaments
    const { data: tournaments = [] } = useQuery<InPlayTournament[]>({
        queryKey: ["tournaments-in-play-discord"],
        queryFn: async () => {
            const res = await fetch("/api/tournaments/in-play");
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 60 * 1000,
    });

    const selectedTournament = tournaments.find(t => t.id === selectedTournamentId) || tournaments[0];

    // Fetch channel access data
    const queryKey = ["discord-access", selectedTournament?.id, selectedGroup];
    const { data, isLoading, refetch } = useQuery<ChannelAccessData>({
        queryKey,
        queryFn: async () => {
            const params = new URLSearchParams({ tournamentId: selectedTournament!.id });
            if (selectedGroup) params.set("group", selectedGroup);
            const res = await fetch(`/api/discord/channel-access?${params}`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
        enabled: !!selectedTournament?.id,
        staleTime: 30 * 1000,
    });

    // Grant access to specific discord IDs
    const grantAccess = useCallback(async (discordIds: string[], label: string) => {
        if (!selectedTournament || !data?.channelId) return;
        const body: any = {
            tournamentId: selectedTournament.id,
            playerDiscordIds: discordIds,
            action: "grant",
        };
        if (selectedGroup) body.group = selectedGroup;

        try {
            const res = await fetch("/api/discord/channel-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const result = await res.json();

            if (result.rateLimited) {
                toast.warning(`Granted ${result.success}/${discordIds.length} for ${label} — rate limited. Retrying in ${Math.ceil(result.retryAfterMs / 1000)}s...`);
                // Wait and retry remaining
                await new Promise(r => setTimeout(r, result.retryAfterMs));
                const remaining = discordIds.slice(result.success + result.failed);
                if (remaining.length > 0) {
                    await grantAccess(remaining, label);
                    return;
                }
            }

            if (result.failed > 0) {
                toast.warning(`${label}: ${result.success} granted, ${result.failed} failed`);
            } else {
                toast.success(`${label}: ${result.success} granted ✅`);
            }
            refetch();
        } catch {
            toast.error(`Failed to grant for ${label}`);
        }
    }, [selectedTournament, selectedGroup, data?.channelId, refetch]);

    // Grant access for a single team
    const grantTeam = useCallback(async (team: TeamAccess) => {
        const ungrantedIds = team.players
            .filter(p => p.isLinked && !p.hasAccess && p.discordId)
            .map(p => p.discordId!);

        if (ungrantedIds.length === 0) {
            toast.info(`${team.name}: all players already have access`);
            return;
        }

        setGrantingTeam(team.id);
        await grantAccess(ungrantedIds, team.name);
        setGrantingTeam(null);
    }, [grantAccess]);

    // Grant access for ALL teams
    const grantAll = useCallback(async () => {
        if (!data?.teams) return;
        const allUngranted = data.teams.flatMap(t =>
            t.players.filter(p => p.isLinked && !p.hasAccess && p.discordId).map(p => p.discordId!)
        );

        if (allUngranted.length === 0) {
            toast.info("All linked players already have access");
            return;
        }

        setGrantingAll(true);
        await grantAccess(allUngranted, "All teams");
        setGrantingAll(false);
    }, [data, grantAccess]);

    const linkedCount = data?.linkedPlayers ?? 0;
    const grantedCount = data?.grantedPlayers ?? 0;
    const totalCount = data?.totalPlayers ?? 0;
    const allGranted = linkedCount > 0 && grantedCount >= linkedCount;

    return (
        <Card className="border border-divider">
            <CardBody className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold">Discord Channel Access</h2>
                        <p className="text-[10px] text-foreground/40">
                            Manage who can see the tournament Discord channel
                        </p>
                    </div>
                </div>

                {/* Tournament + Group Selector */}
                {tournaments.length > 0 && (
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <select
                                value={selectedTournament?.id || ""}
                                onChange={(e) => { setSelectedTournamentId(e.target.value); setSelectedGroup(""); }}
                                className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-default-100 border border-divider text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                {tournaments.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.allowSquads ? "🏆" : "🎮"} {t.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40 pointer-events-none" />
                        </div>
                        {selectedTournament?.isChampionship && (data?.availableChannels?.length ?? 0) > 0 && (
                            <div className="relative">
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    className="appearance-none px-3 py-2 pr-8 rounded-xl bg-default-100 border border-divider text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">Main</option>
                                    {(data?.availableChannels ?? []).map(ch => (
                                        <option key={ch} value={ch}>
                                            {ch === "WILDCARD" ? "🃏 Wildcard" : ch === "FINALS" ? "🏆 Finals" : `Group ${ch}`}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40 pointer-events-none" />
                            </div>
                        )}
                    </div>
                )}

                {/* Stats bar */}
                {data && (
                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-foreground/40" />
                            <span>{totalCount} players</span>
                        </div>
                        <span className="text-foreground/20">•</span>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                            <span>{linkedCount} linked</span>
                        </div>
                        <span className="text-foreground/20">•</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`inline-block w-2 h-2 rounded-full ${allGranted ? "bg-green-500" : "bg-yellow-500"}`} />
                            <span>{grantedCount}/{linkedCount} granted</span>
                        </div>
                        <div className="flex-1" />
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isLoading}
                            className="p-1 rounded hover:bg-default-100 transition-colors cursor-pointer"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 text-foreground/40 ${isLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                )}

                {/* Grant All button */}
                {data && !allGranted && linkedCount > grantedCount && (
                    <button
                        type="button"
                        onClick={grantAll}
                        disabled={grantingAll || grantingTeam !== null}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#5865F2] text-white hover:bg-[#4752C4] transition-all cursor-pointer active:scale-[0.98] shadow-lg shadow-[#5865F2]/25 disabled:opacity-50"
                    >
                        {grantingAll ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Granting...</>
                        ) : (
                            <><Shield className="w-4 h-4" /> Grant All ({linkedCount - grantedCount} remaining)</>
                        )}
                    </button>
                )}

                {/* All granted badge */}
                {allGranted && linkedCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-500">All {linkedCount} linked players have access</span>
                    </div>
                )}

                {/* Teams list */}
                {data?.teams && data.teams.length > 0 && (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {data.teams.map(team => {
                            const teamLinked = team.players.filter(p => p.isLinked);
                            const teamGranted = team.players.filter(p => p.hasAccess);
                            const teamAllGranted = teamLinked.length > 0 && teamGranted.length >= teamLinked.length;
                            const isGranting = grantingTeam === team.id;

                            return (
                                <div key={team.id} className="rounded-xl border border-divider bg-default-50 p-3">
                                    {/* Team header */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-bold text-foreground/50">#{team.teamNumber}</span>
                                        <span className="text-sm font-semibold flex-1 truncate">{team.name}</span>
                                        {!teamAllGranted && teamLinked.length > teamGranted.length && (
                                            <button
                                                type="button"
                                                onClick={() => grantTeam(team)}
                                                disabled={isGranting || grantingAll}
                                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[#5865F2] text-white hover:bg-[#4752C4] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                                            >
                                                {isGranting ? "..." : `Grant ${teamLinked.length - teamGranted.length}`}
                                            </button>
                                        )}
                                        {teamAllGranted && teamLinked.length > 0 && (
                                            <span className="text-[10px] font-medium text-emerald-500 shrink-0">✅ All</span>
                                        )}
                                    </div>
                                    {/* Players */}
                                    <div className="space-y-1">
                                        {team.players.map(player => (
                                            <div key={player.id} className="flex items-center gap-2 text-xs py-0.5">
                                                {/* Access indicator */}
                                                {player.isLinked ? (
                                                    player.hasAccess ? (
                                                        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    ) : (
                                                        <X className="w-3 h-3 text-red-400 shrink-0" />
                                                    )
                                                ) : (
                                                    <span className="w-3 h-3 rounded-full bg-foreground/10 shrink-0" title="Not linked" />
                                                )}
                                                {/* Player info */}
                                                <span className="truncate flex-1">
                                                    {player.displayName}
                                                </span>
                                                {player.discordUsername && (
                                                    <span className="text-[10px] text-foreground/30 shrink-0 truncate max-w-[100px]">
                                                        @{player.discordUsername}
                                                    </span>
                                                )}
                                                {!player.isLinked && (
                                                    <span className="text-[10px] text-foreground/20 shrink-0">no discord</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {isLoading && (
                    <div className="text-center py-4 text-xs text-foreground/40">Loading teams...</div>
                )}

                {!isLoading && data?.teams?.length === 0 && (
                    <div className="text-center py-4 text-xs text-foreground/40">No teams found — generate teams first</div>
                )}
            </CardBody>
        </Card>
    );
}
