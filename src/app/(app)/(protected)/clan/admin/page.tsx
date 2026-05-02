"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Avatar,
    Input,
    Spinner,
    Chip,
} from "@heroui/react";
import {
    Shield,
    Crown,
    Search,
    Users,
    ArrowLeft,
    Swords,
} from "lucide-react";
import { motion } from "motion/react";
import { GAME } from "@/lib/game-config";
import { useRouter } from "next/navigation";

const label = GAME.clanLabel;

interface ClanItem {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    logoUrl: string | null;
    createdAt: string;
    leader: {
        id: string;
        displayName: string;
        imageUrl: string;
    };
    memberCount: number;
    teamCount: number;
}

export default function AdminClansPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce search
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
    const handleSearch = (value: string) => {
        setSearch(value);
        if (debounceTimer) clearTimeout(debounceTimer);
        const timer = setTimeout(() => setDebouncedSearch(value), 300);
        setDebounceTimer(timer);
    };

    const { data: clans, isLoading } = useQuery<ClanItem[]>({
        queryKey: ["admin-clans", debouncedSearch],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (debouncedSearch) params.set("search", debouncedSearch);
            const res = await fetch(`/api/clans/all?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 30_000,
    });

    return (
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => router.back()}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-default-100 hover:bg-default-200 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                    <h1 className="text-lg font-bold">All {label}s</h1>
                    <p className="text-xs text-foreground/40">
                        {clans ? `${clans.length} ${label.toLowerCase()}${clans.length !== 1 ? "s" : ""} registered` : "Loading..."}
                    </p>
                </div>
            </div>

            {/* Search */}
            <Input
                placeholder={`Search by name, tag, or leader...`}
                value={search}
                onValueChange={handleSearch}
                startContent={<Search className="h-4 w-4 text-foreground/40" />}
                variant="bordered"
                size="sm"
                classNames={{ inputWrapper: "bg-default-50" }}
                className="mb-4"
                isClearable
                onClear={() => { setSearch(""); setDebouncedSearch(""); }}
            />

            {/* Content */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Spinner size="lg" />
                </div>
            ) : clans && clans.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="w-14 h-14 rounded-full bg-default-100 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-foreground/25" />
                    </div>
                    <p className="text-sm text-foreground/50">
                        {debouncedSearch ? "No clans found" : `No ${label.toLowerCase()}s yet`}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {clans?.map((clan, index) => (
                        <motion.div
                            key={clan.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="flex items-center gap-3 p-3 rounded-xl border border-divider bg-default-50 hover:bg-default-100 transition-colors"
                        >
                            {/* Logo */}
                            <Avatar
                                src={clan.logoUrl || undefined}
                                name={clan.tag}
                                className="h-11 w-11 shrink-0"
                                showFallback
                                fallback={
                                    <Shield className="w-5 h-5 text-primary" />
                                }
                                classNames={{
                                    base: clan.logoUrl ? "" : "bg-primary/20",
                                }}
                            />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        color="primary"
                                        className="text-[10px] h-4 px-1.5"
                                    >
                                        {clan.tag}
                                    </Chip>
                                    <span className="text-sm font-semibold truncate">
                                        {clan.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex items-center gap-1 text-[10px] text-foreground/40">
                                        <Crown className="h-3 w-3 text-amber-500" />
                                        <span className="truncate max-w-[100px]">{clan.leader.displayName}</span>
                                    </div>
                                    <span className="h-2.5 w-px bg-foreground/10" />
                                    <div className="flex items-center gap-1 text-[10px] text-foreground/40">
                                        <Users className="h-3 w-3" />
                                        <span>{clan.memberCount}</span>
                                    </div>
                                    <span className="h-2.5 w-px bg-foreground/10" />
                                    <div className="flex items-center gap-1 text-[10px] text-foreground/40">
                                        <Swords className="h-3 w-3" />
                                        <span>{clan.teamCount} team{clan.teamCount !== 1 ? "s" : ""}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Date */}
                            <span className="text-[10px] text-foreground/30 shrink-0">
                                {new Date(clan.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
