"use client";

import { Input, Select, SelectItem, Button } from "@heroui/react";
import { Search, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const tiers = [
    { value: "All", label: "All" },
    { value: "LEGEND", label: "Legend" },
    { value: "ULTRA_PRO", label: "Ultra Pro" },
    { value: "PRO", label: "Pro" },
    { value: "NOOB", label: "Noob" },
    { value: "ULTRA_NOOB", label: "Ultra Noob" },
    { value: "BOT", label: "Bot" },
];

import { GAME } from "@/lib/game-config";

const sortOptions = GAME.features.hasBR
    ? [
        { label: "K/D Ratio", value: "kd" },
        { label: "Total Kills", value: "kills" },
        { label: "Matches", value: "matches" },
        { label: "Name", value: "name" },
        { label: "Balance", value: "balance" },
    ]
    : [
        { label: "Win Rate", value: "winRate" },
        { label: "Wins", value: "wins" },
        { label: "Matches", value: "matches" },
        { label: "Name", value: "name" },
        { label: "Balance", value: "balance" },
    ];

interface PlayerFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    tier: string;
    onTierChange: (value: string) => void;
    sortBy: string;
    onSortByChange: (value: string) => void;
    sortOrder: "asc" | "desc";
    onSortOrderChange: (value: "asc" | "desc") => void;
}

export function PlayerFilters({
    search,
    onSearchChange,
    tier,
    onTierChange,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
}: PlayerFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);

    // Lazy-load category counts only when filter panel is opened
    const { data: counts } = useQuery<Record<string, number>>({
        queryKey: ["player-counts"],
        queryFn: async () => {
            const res = await fetch("/api/players/counts");
            return res.json();
        },
        enabled: showFilters,
        staleTime: 60 * 1000,
    });

    return (
        <div className="space-y-3">
            {/* Search + toggle */}
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Search players..."
                    value={search}
                    onValueChange={onSearchChange}
                    startContent={<Search className="h-4 w-4 text-default-400" />}
                    classNames={{
                        inputWrapper:
                            "bg-default-100 border border-divider shadow-none hover:bg-default-200 transition-colors !outline-none !ring-0 focus-within:!outline-none focus-within:!ring-0 focus-within:!border-none data-[focus=true]:!outline-none data-[focus=true]:!ring-0 data-[focus-within=true]:!outline-none data-[focus-within=true]:!ring-0",
                        input: "!outline-none !ring-0 focus:!outline-none focus:!ring-0",
                    }}
                    size="sm"
                    isClearable
                    onClear={() => onSearchChange("")}
                />
                <Button
                    isIconOnly
                    size="sm"
                    variant={showFilters ? "solid" : "flat"}
                    color={showFilters ? "primary" : "default"}
                    onPress={() => setShowFilters(!showFilters)}
                    className="shrink-0"
                >
                    <SlidersHorizontal className="h-4 w-4" />
                </Button>
            </div>

            {/* Expandable filters */}
            {showFilters && (
                <div className="flex items-center gap-2">
                    {/* Category dropdown */}
                    <Select
                        selectedKeys={[tier]}
                        onSelectionChange={(keys) => {
                            const key = Array.from(keys)[0] as string;
                            if (key) onTierChange(key);
                        }}
                        size="sm"
                        className="w-44"
                        classNames={{
                            trigger: "bg-default-100 border-none shadow-none min-h-8 h-8",
                        }}
                        aria-label="Category"
                    >
                        {tiers.map((t) => {
                            const label = counts
                                ? `${t.label} (${counts[t.value] ?? 0})`
                                : t.label;
                            return (
                                <SelectItem key={t.value} textValue={label}>
                                    {label}
                                </SelectItem>
                            );
                        })}
                    </Select>

                    {/* Sort */}
                    <div className="ml-auto flex items-center gap-2">
                        <Select
                            selectedKeys={[sortBy]}
                            onSelectionChange={(keys) => {
                                const key = Array.from(keys)[0] as string;
                                if (key) onSortByChange(key);
                            }}
                            size="sm"
                            className="w-32"
                            classNames={{
                                trigger: "bg-default-100 border-none shadow-none min-h-8 h-8",
                            }}
                            aria-label="Sort by"
                        >
                            {sortOptions.map((opt) => (
                                <SelectItem key={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </Select>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            onPress={() =>
                                onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")
                            }
                            className="shrink-0"
                        >
                            <ArrowUpDown
                                className={`h-4 w-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""
                                    }`}
                            />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
