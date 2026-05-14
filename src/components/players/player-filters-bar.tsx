"use client";

import {
    Input,
    Button,
    Select,
    SelectItem,
    Popover,
    PopoverTrigger,
    PopoverContent,
    Tabs,
    Tab,
} from "@heroui/react";
import { Search, SlidersHorizontal, MapPin } from "lucide-react";
import { type PlayerFilters } from "@/hooks/use-player-filters";
import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";
import { GAME } from "@/lib/game-config";

const TIERS = [
    { key: "All", label: "All Tiers" },
    { key: "LEGEND", label: "Legend" },
    { key: "ULTRA_PRO", label: "Ultra Pro" },
    { key: "PRO", label: "Pro" },
    { key: "NOOB", label: "Noob" },
    { key: "ULTRA_NOOB", label: "Ultra Noob" },
    { key: "BOT", label: "Bot" },
] as const;

interface ProfileLocation {
    player: {
        state: string | null;
        district: string | null;
        town: string | null;
    } | null;
}

/**
 * Reusable search + filter popover bar for player pages.
 * Contains: search input, filter popover, and location tabs.
 * Location tabs show: All | [Player's State] | [Player's District] | [Player's Town]
 */
export function PlayerFiltersBar({
    search,
    setSearch,
    tier,
    setTier,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    season,
    setSeason,
    seasons,
    tierCounts,
    locationState,
    setLocationState,
    locationDistrict,
    setLocationDistrict,
    locationTown,
    setLocationTown,
    hasActiveFilters,
    resetFilters,
    onFilterOpen,
}: PlayerFilters) {
    const totalPlayers = Object.values(tierCounts).reduce((a, b) => a + b, 0);
    const { isSignedIn, isLoading: authLoading } = useAuthUser();

    // Get current player's location from their profile
    const { data: profile, isLoading: profileLoading } = useQuery<ProfileLocation>({
        queryKey: ["profile"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) return null;
            return (await res.json()).data;
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!isSignedIn,
    });

    const myState = profile?.player?.state;
    const myDistrict = profile?.player?.district;
    const myTown = profile?.player?.town;
    const hasLocation = !!myState && !!myDistrict && !!myTown;
    const locationLoading = authLoading || (!!isSignedIn && profileLoading);

    // Determine current tab based on which filters are active
    const activeTab = locationTown
        ? "town"
        : locationDistrict
          ? "district"
          : locationState
            ? "state"
            : "all";

    function handleTabChange(key: string | number) {
        const tab = key as string;
        if (tab === "all") {
            setLocationState("");
            setLocationDistrict("");
            setLocationTown("");
        } else if (tab === "state" && myState) {
            setLocationState(myState);
            setLocationDistrict("");
            setLocationTown("");
        } else if (tab === "district" && myState && myDistrict) {
            setLocationState(myState);
            setLocationDistrict(myDistrict);
            setLocationTown("");
        } else if (tab === "town" && myState && myDistrict && myTown) {
            setLocationState(myState);
            setLocationDistrict(myDistrict);
            setLocationTown(myTown);
        }
    }

    return (
        <div className="space-y-2">
            {/* Search + filter button */}
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Search players..."
                    value={search}
                    onValueChange={setSearch}
                    startContent={<Search className="h-4 w-4 text-default-400" />}
                    classNames={{
                        inputWrapper: "bg-default-100 dark:bg-[var(--game-surface)] border-none shadow-none",
                    }}
                    className="flex-1 sm:max-w-xs"
                    size="sm"
                    isClearable
                    onClear={() => setSearch("")}
                />
                <Popover placement="bottom-end" onOpenChange={(open) => { if (open) onFilterOpen(); }}>
                    <PopoverTrigger>
                        <Button
                            size="sm"
                            variant="flat"
                            startContent={<SlidersHorizontal className="h-4 w-4" />}
                            className="bg-default-100 dark:bg-[var(--game-surface)] shrink-0"
                        >
                            <span className="hidden sm:inline">Filters</span>
                            {hasActiveFilters && (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                                    !
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4">
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold">Filters & Sort</h4>

                            {/* Season */}
                            {seasons.length > 0 && season && (
                                <div className="space-y-1.5">
                                    <label className="text-xs text-foreground/50">Season</label>
                                    <Select
                                        size="sm"
                                        items={seasons}
                                        selectedKeys={[season]}
                                        disallowEmptySelection
                                        onSelectionChange={(keys) => {
                                            const val = Array.from(keys)[0] as string;
                                            if (val) setSeason(val);
                                        }}
                                        aria-label="Season"
                                    >
                                        {(s) => (
                                            <SelectItem key={s.id} textValue={`${s.name}${s.isCurrent ? " ✦" : ""}`}>
                                                {s.name}{s.isCurrent ? " ✦" : ""}
                                            </SelectItem>
                                        )}
                                    </Select>
                                </div>
                            )}

                            {/* Category */}
                            <div className="space-y-1.5">
                                <label className="text-xs text-foreground/50">Category</label>
                                <Select
                                    size="sm"
                                    selectedKeys={[tier]}
                                    disallowEmptySelection
                                    onSelectionChange={(keys) => {
                                        const val = Array.from(keys)[0] as string;
                                        if (val) setTier(val);
                                    }}
                                    aria-label="Category"
                                >
                                    {TIERS.map((t) => {
                                        const count = t.key === "All"
                                            ? totalPlayers
                                            : tierCounts[t.key] ?? 0;
                                        return (
                                            <SelectItem key={t.key} textValue={t.label}>
                                                <div className="flex items-center justify-between w-full">
                                                    <span>{t.label}</span>
                                                    {count > 0 && (
                                                        <span className="text-xs text-foreground/40">{count}</span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </Select>
                            </div>

                            {/* Sort by */}
                            <div className="space-y-1.5">
                                <label className="text-xs text-foreground/50">Sort by</label>
                                <Select
                                    size="sm"
                                    selectedKeys={[sortBy]}
                                    disallowEmptySelection
                                    classNames={{
                                        trigger: "bg-default-100",
                                        value: "text-foreground",
                                    }}
                                    onSelectionChange={(keys) => {
                                        const val = Array.from(keys)[0] as string;
                                        if (val) {
                                            setSortBy(val);
                                            setSortOrder("desc");
                                        }
                                    }}
                                    aria-label="Sort by"
                                >
                                    {(GAME.features.hasBR
                                        ? [
                                            { key: "kd", label: "K/D Ratio" },
                                            { key: "kills", label: "Total Kills" },
                                        ]
                                        : [
                                            { key: "wins", label: "Wins" },
                                            { key: "winRate", label: "Win Rate" },
                                        ]
                                    ).concat([
                                        { key: "balance", label: `Balance (${GAME.currency})` },
                                        { key: "matches", label: "Matches Played" },
                                    ]).map(item => (
                                        <SelectItem key={item.key} textValue={item.label}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </div>

                            {/* Order */}
                            <div className="space-y-1.5">
                                <label className="text-xs text-foreground/50">Order</label>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant={sortOrder === "desc" ? "solid" : "flat"}
                                        color={sortOrder === "desc" ? "primary" : "default"}
                                        onPress={() => setSortOrder("desc")}
                                        className="flex-1"
                                    >
                                        Highest First
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={sortOrder === "asc" ? "solid" : "flat"}
                                        color={sortOrder === "asc" ? "primary" : "default"}
                                        onPress={() => setSortOrder("asc")}
                                        className="flex-1"
                                    >
                                        Lowest First
                                    </Button>
                                </div>
                            </div>

                            {/* Reset */}
                            {hasActiveFilters && (
                                <Button
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    onPress={resetFilters}
                                    className="w-full"
                                >
                                    Reset to Default
                                </Button>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Location tabs — fixed based on player's own location */}
            {locationLoading ? (
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-8 rounded-lg bg-default-100 animate-pulse" style={{ width: i === 1 ? 48 : 64 }} />
                    ))}
                </div>
            ) : hasLocation && (
                <Tabs
                    size="sm"
                    variant="underlined"
                    color="primary"
                    selectedKey={activeTab}
                    onSelectionChange={handleTabChange}
                    classNames={{
                        base: "w-full overflow-x-auto scrollbar-hide",
                        tabList: "gap-0 w-max min-w-full",
                        tab: "px-3 h-8 whitespace-nowrap",
                        cursor: "bg-primary",
                    }}
                >
                    <Tab
                        key="all"
                        title={
                            <div className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" />
                                <span>All</span>
                            </div>
                        }
                    />
                    <Tab
                        key="state"
                        title={<span className="truncate max-w-[80px]">{myState}</span>}
                    />
                    <Tab
                        key="district"
                        title={<span className="truncate max-w-[80px]">{myDistrict}</span>}
                    />
                    <Tab
                        key="town"
                        title={<span className="truncate max-w-[80px]">{myTown}</span>}
                    />
                </Tabs>
            )}
        </div>
    );
}
