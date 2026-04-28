"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, CardBody, Input, Avatar } from "@heroui/react";
import { Trophy, Banknote, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

interface LeaderboardEntry {
    rank: number;
    score: number;
    displayName: string;
    imageUrl: string | null;
    playerId: string;
}

const PLACE_EMOJIS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export function GameManagement({ gameKey, label, icon: Icon, color, image }: {
    gameKey: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    image: string;
}) {
    const queryClient = useQueryClient();
    const [rewards, setRewards] = useState<{ place: number; amount: string }[]>([{ place: 1, amount: "" }]);
    const [endDate, setEndDate] = useState("");
    const [thresholdPct, setThresholdPct] = useState("2");

    // Fetch per-game settings
    const { data: settings } = useQuery({
        queryKey: ["admin-games", gameKey],
        queryFn: async () => {
            const res = await fetch(`/api/admin/games?game=${gameKey}`);
            return res.json();
        },
    });

    // Fetch per-game leaderboard
    const { data: leaderboard } = useQuery({
        queryKey: ["admin-games-lb", gameKey],
        queryFn: async () => {
            const res = await fetch(`/api/games/leaderboard?all=1&game=${gameKey}`);
            return res.json();
        },
    });

    // Sync rewards
    useEffect(() => {
        if (settings?.rewards) {
            const entries = Object.entries(settings.rewards as Record<string, number>)
                .filter(([, v]) => v > 0)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([k, v]) => ({ place: parseInt(k), amount: v.toString() }));
            if (entries.length > 0) setRewards(entries);
        }
    }, [settings]);

    // Sync end date
    useEffect(() => {
        if (settings?.endDate) {
            try {
                const d = new Date(settings.endDate);
                if (!isNaN(d.getTime())) setEndDate(d.toISOString().slice(0, 16));
            } catch { /* ignore */ }
        }
    }, [settings]);

    // Sync threshold
    useEffect(() => {
        if (settings?.thresholdPct !== undefined) {
            setThresholdPct(String(settings.thresholdPct));
        }
    }, [settings]);

    const updateRewardsMut = useMutation({
        mutationFn: async () => {
            const rewardMap: Record<string, number> = {};
            for (const r of rewards) {
                rewardMap[r.place.toString()] = parseInt(r.amount) || 0;
            }
            await fetch("/api/admin/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "updateRewards",
                    game: gameKey,
                    rewards: rewardMap,
                    endDate: endDate ? new Date(endDate).toISOString() : "",
                    thresholdPct: parseInt(thresholdPct) || 2,
                }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-games", gameKey] });
        },
    });

    const distributeAndReset = useMutation({
        mutationFn: async () => {
            // Step 1: Distribute rewards
            const distRes = await fetch("/api/admin/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "distributeRewards", game: gameKey }),
            });
            const distData = await distRes.json();

            // Step 2: Reset scores
            await fetch("/api/admin/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "resetScores", game: gameKey }),
            });

            return distData;
        },
        onSuccess: (data) => {
            if (data.distributed?.length) {
                alert(`Distributed ${label} rewards to ${data.distributed.length} players & reset scores!`);
            } else {
                alert(`No rewards to distribute. Scores reset!`);
            }
            queryClient.invalidateQueries({ queryKey: ["admin-games", gameKey] });
            queryClient.invalidateQueries({ queryKey: ["admin-games-lb", gameKey] });
        },
    });

    const scores: LeaderboardEntry[] = leaderboard?.scores || [];

    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {/* Back link + header */}
            <div>
                <Link href="/dashboard/games" className="inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground transition-colors mb-3">
                    <ArrowLeft className="h-4 w-4" />
                    <span>All Games</span>
                </Link>

                {/* Banner */}
                <div className="relative h-28 rounded-2xl overflow-hidden">
                    <img src={image} alt={label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                            <Icon className={`h-5 w-5 ${color}`} />
                            <h1 className="text-lg font-bold text-white">{label}</h1>
                        </div>
                        <span className="text-xs text-white/50 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            {settings?.scoreCount ?? 0} players
                        </span>
                    </div>
                </div>
            </div>

            {/* Rewards config */}
            <Card className="border border-divider">
                <CardBody className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-semibold">Prizes</span>
                    </div>
                    <div className="space-y-2">
                        {rewards.map((r, i) => (
                            <div key={r.place} className="flex items-center gap-2">
                                <Input
                                    label={`${PLACE_EMOJIS[r.place - 1] || `#${r.place}`} ${r.place === 1 ? "1st" : r.place === 2 ? "2nd" : r.place === 3 ? "3rd" : `${r.place}th`}`}
                                    type="number"
                                    size="sm"
                                    value={r.amount}
                                    onValueChange={(v) => {
                                        const updated = [...rewards];
                                        updated[i] = { ...r, amount: v };
                                        setRewards(updated);
                                    }}
                                    endContent={<CurrencyIcon size={14} />}
                                    className="flex-1"
                                />
                                {i > 0 && (
                                    <Button isIconOnly size="sm" variant="flat" color="danger"
                                        onPress={() => setRewards(rewards.filter((_, j) => j !== i))}>
                                        ✕
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button size="sm" variant="flat"
                            onPress={() => setRewards([...rewards, { place: rewards.length + 1, amount: "" }])}>
                            + Add Place
                        </Button>
                    </div>

                    {/* Native date input — HeroUI Input type="datetime-local" has rendering issues */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground/60">Ends On</label>
                        <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded-lg bg-default-100 border border-default-200 px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors [color-scheme:dark]"
                        />
                        <p className="text-[11px] text-foreground/40">Countdown shown to players</p>
                    </div>

                    <Input
                        label="Winner Threshold %"
                        type="number"
                        size="sm"
                        value={thresholdPct}
                        onValueChange={setThresholdPct}
                        endContent={<span className="text-xs text-foreground/40">%</span>}
                        description="After winning, player must beat their score + this % to rejoin leaderboard"
                    />
                    <Button color="primary" size="sm" onPress={() => updateRewardsMut.mutate()} isLoading={updateRewardsMut.isPending}>
                        Save
                    </Button>
                </CardBody>
            </Card>

            {/* Leaderboard */}
            <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground/60">Leaderboard</h2>
                {scores.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-default-100 py-6 text-center">
                        <AlertCircle className="h-6 w-6 text-foreground/20" />
                        <p className="text-sm text-foreground/50">No scores yet</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 rounded-lg bg-default-100 px-4 py-2 text-xs font-semibold text-foreground/50">
                            <span className="w-8 text-center">#</span>
                            <span className="flex-1">Player</span>
                            <span className="w-14 text-right">Score</span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto space-y-1">
                        {scores.map((entry) => (
                            <div key={entry.playerId} className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${entry.rank <= 3 ? "bg-amber-500/10" : "hover:bg-default-100"}`}>
                                <span className={`w-8 text-center text-xs font-medium ${entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-foreground/50" : entry.rank === 3 ? "text-orange-400" : "text-foreground/30"}`}>
                                    {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                                </span>
                                <div className="flex flex-1 items-center gap-2 min-w-0">
                                    <Avatar src={entry.imageUrl || undefined} name={entry.displayName} size="sm" className="h-7 w-7 shrink-0" />
                                    <span className="text-sm font-medium truncate">{entry.displayName}</span>
                                </div>
                                <span className="w-14 text-right text-sm font-bold game-text">{entry.score}</span>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Players on Threshold */}
            {(settings?.thresholdPlayers?.length > 0) && (
                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-foreground/60 flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-warning" />
                        Players on Threshold
                        <span className="text-[10px] text-foreground/30 font-normal">
                            (need to beat score + {settings?.thresholdPct ?? 2}% to rejoin)
                        </span>
                    </h2>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 rounded-lg bg-default-100 px-4 py-2 text-xs font-semibold text-foreground/50">
                            <span className="flex-1">Player</span>
                            <span className="w-16 text-right">Won With</span>
                            <span className="w-20 text-right">Must Beat</span>
                        </div>
                        <div className="max-h-[250px] overflow-y-auto space-y-1">
                            {settings.thresholdPlayers.map((tp: { playerId: string; displayName: string; imageUrl: string | null; lastWinningScore: number; threshold: number }) => (
                                <div key={tp.playerId} className="flex items-center gap-3 rounded-lg px-4 py-2.5 bg-warning/5 border border-warning/10">
                                    <div className="flex flex-1 items-center gap-2 min-w-0">
                                        <Avatar src={tp.imageUrl || undefined} name={tp.displayName} size="sm" className="h-7 w-7 shrink-0" />
                                        <span className="text-sm font-medium truncate">{tp.displayName}</span>
                                    </div>
                                    <span className="w-16 text-right text-sm text-foreground/50">{tp.lastWinningScore}</span>
                                    <span className="w-20 text-right text-sm font-bold text-warning">{tp.threshold}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <Button
                    color="success" variant="flat" size="sm"
                    onPress={() => {
                        if (scores.length === 0) return;
                        if (confirm(`Distribute ${label} rewards to prize winners and reset all scores?\n\nThis cannot be undone.`)) {
                            distributeAndReset.mutate();
                        }
                    }}
                    isLoading={distributeAndReset.isPending}
                    isDisabled={scores.length === 0}
                    startContent={<Banknote className="h-4 w-4" />}
                >
                    Distribute & Reset
                </Button>
            </div>
        </div>
    );
}
