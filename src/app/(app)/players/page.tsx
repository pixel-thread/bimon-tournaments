"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { usePlayers, flattenPlayers } from "@/hooks/use-players";
import { usePlayerFilters } from "@/hooks/use-player-filters";
import { PlayerFiltersBar } from "@/components/players/player-filters-bar";
import { PlayerPodium } from "@/components/players/player-podium";
import { PlayerTable } from "@/components/players/player-table";
import { PlayerStatsModal } from "@/components/players/player-stats-modal";
import { PlayersSkeleton } from "@/components/players/players-skeleton";
import { GAME } from "@/lib/game-config";
import { ArenaDropdown } from "@/components/players/arena-dropdown";


/**
 * /players — Main players page.
 * Features: search, tier filter, sort, top-3 podium, scrollable table,
 * player stats modal, infinite scroll.
 * BGMI: Ranked / Casual / All tabs for separate leaderboards.
 */
export default function PlayersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const playerId = searchParams.get("player") ?? "";
    const filters = usePlayerFilters();
    const { search, tier, sortBy, sortOrder, season, locationState, locationDistrict, locationTown, teamMode } = filters;

    // Fetch players
    const query = usePlayers({ search, tier, sortBy, sortOrder, season, state: locationState, district: locationDistrict, town: locationTown, teamMode });
    const { players, meta } = flattenPlayers(query.data);

    const isLoading = query.isLoading;

    // Show podium when no search/tier/location filter is active and sorted desc
    const showPodium = !search && tier === "All" && sortOrder === "desc" && !locationState;

    // Players for the table (skip first 3 if podium is shown)
    const tablePlayers = showPodium ? players.slice(3) : players;
    const tableStartIndex = showPodium ? 3 : 0;

    // Find selected player for modal
    const selectedPlayer = playerId
        ? players.find((p) => p.id === playerId) ?? null
        : null;

    function handlePlayerClick(id: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("player", id);
        router.push(`?${params.toString()}`, { scroll: false });
    }

    function handleModalClose() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("player");
        router.push(`?${params.toString()}`, { scroll: false });
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            <div className="space-y-6">
                {/* Ranked / Casual / Arena mode tabs */}
                {(GAME.features.hasRankedCasual || GAME.features.hasTDM || GAME.features.hasWoW) && (
                    <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-default-100">
                        {GAME.features.hasRankedCasual && ([
                            { key: "casual", label: "Casual", icon: "🎮" },
                            { key: "ranked", label: "Ranked", icon: "🏆" },
                        ] as const).map(({ key, label, icon }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => filters.setTeamMode(key)}
                                className={`
                                    flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium
                                    transition-all duration-200 cursor-pointer
                                    ${teamMode === key
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-foreground/50 hover:text-foreground/70"
                                    }
                                `}
                            >
                                <span>{icon}</span>
                                <span>{label}</span>
                            </button>
                        ))}
                        {(GAME.features.hasTDM || GAME.features.hasWoW) && (
                            <ArenaDropdown
                                teamMode={teamMode}
                                onSelect={filters.setTeamMode}
                                hasTDM={GAME.features.hasTDM}
                                hasWoW={GAME.features.hasWoW}
                            />
                        )}
                    </div>
                )}

                <PlayerFiltersBar {...filters} />

                {/* Content */}
                {isLoading ? (
                    <PlayersSkeleton showPodium={showPodium} />
                ) : (
                    <>
                        {/* Podium */}
                        {showPodium && players.length >= 3 && (
                            <PlayerPodium
                                players={players.slice(0, 3)}
                                onPlayerClick={handlePlayerClick}
                                sortBy={sortBy}
                            />
                        )}

                        {/* Table */}
                        <PlayerTable
                            players={tablePlayers}
                            meta={meta}
                            startIndex={tableStartIndex}
                            onPlayerClick={handlePlayerClick}
                            fetchNextPage={() => query.fetchNextPage()}
                            hasNextPage={query.hasNextPage}
                            isFetchingNextPage={query.isFetchingNextPage}
                            sortBy={sortBy}
                            totalCount={players.length}
                        />
                    </>
                )}
            </div>

            {/* Stats Modal */}
            <PlayerStatsModal
                isOpen={!!playerId}
                onClose={handleModalClose}
                player={selectedPlayer}
            />
        </div>
    );
}
