"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, CardBody, Input, Divider, Avatar } from "@heroui/react";
import { Gamepad2, Trophy, RotateCcw, Banknote, AlertCircle, Brain, Hash } from "lucide-react";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { GAME } from "@/lib/game-config";

interface LeaderboardEntry {
    rank: number;
    score: number;
    displayName: string;
    imageUrl: string | null;
    playerId: string;
}

const PLACE_EMOJIS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

/* ── Per-Game Section ──────────────────────────────────── */
function GameSection({ gameKey, label, icon: Icon, color }: {
    gameKey: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
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

    const resetScores = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "resetScores", game: gameKey }),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-games", gameKey] });
            queryClient.invalidateQueries({ queryKey: ["admin-games-lb", gameKey] });
        },
    });

    const distributeRewards = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "distributeRewards", game: gameKey }),
            });
            return res.json();
        },
        onSuccess: (data) => {
            if (data.distributed?.length) {
                alert(`Distributed ${label} rewards to ${data.distributed.length} players!`);
            }
            queryClient.invalidateQueries({ queryKey: ["admin-games", gameKey] });
        },
    });

    const scores: LeaderboardEntry[] = leaderboard?.scores || [];

    return (
        <div className="space-y-4">
            {/* Section header */}
            <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                <h2 className="text-base font-bold">{label}</h2>
                <span className="text-xs text-foreground/30 bg-default-100 px-2 py-0.5 rounded-full">
                    {settings?.scoreCount ?? 0} players
                </span>
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
                    <Input
                        label="Ends On"
                        type="datetime-local"
                        size="sm"
                        value={endDate}
                        onValueChange={setEndDate}
                        description="Countdown shown to players"
                    />
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
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <Button
                    color="success" variant="flat" size="sm"
                    onPress={() => distributeRewards.mutate()}
                    isLoading={distributeRewards.isPending}
                    isDisabled={scores.length === 0}
                    startContent={<Banknote className="h-4 w-4" />}
                >
                    Distribute
                </Button>
                <Button
                    color="danger" variant="flat" size="sm"
                    onPress={() => { if (confirm(`Reset ALL ${label} scores? This cannot be undone.`)) resetScores.mutate(); }}
                    isLoading={resetScores.isPending}
                    startContent={<RotateCcw className="h-4 w-4" />}
                >
                    Reset
                </Button>
            </div>
        </div>
    );
}

/* ── Main Page ─────────────────────────────────────────── */
export default function AdminGamesPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
            <div>
                <div className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-bold">Games Management</h1>
                </div>
                <p className="text-sm text-foreground/50">
                    Configure rewards and leaderboards for each game independently.
                </p>
            </div>

            <GameSection gameKey="memory" label="Memory Game" icon={Brain} color="text-purple-400" />

            <Divider />

            <GameSection gameKey="number-rush" label="Number Rush" icon={Hash} color="text-amber-400" />
        </div>
    );
}
