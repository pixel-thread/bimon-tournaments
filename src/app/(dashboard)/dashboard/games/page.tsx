"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, CardBody, Input, Divider, Avatar, Tabs, Tab } from "@heroui/react";
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

export default function AdminGamesPage() {
    const queryClient = useQueryClient();
    const [rewards, setRewards] = useState<{ place: number; amount: string }[]>([{ place: 1, amount: "" }]);
    const [endDate, setEndDate] = useState("");
    const [lbTab, setLbTab] = useState<string>("memory");

    // Fetch settings
    const { data: settings } = useQuery({
        queryKey: ["admin-games"],
        queryFn: async () => {
            const res = await fetch("/api/admin/games");
            return res.json();
        },
    });

    // Fetch memory leaderboard
    const { data: memoryLb } = useQuery({
        queryKey: ["admin-games-lb", "memory"],
        queryFn: async () => {
            const res = await fetch("/api/games/leaderboard?all=1&game=memory");
            return res.json();
        },
    });

    // Fetch number rush leaderboard
    const { data: rushLb } = useQuery({
        queryKey: ["admin-games-lb", "number-rush"],
        queryFn: async () => {
            const res = await fetch("/api/games/leaderboard?all=1&game=number-rush");
            return res.json();
        },
    });

    // Fetch public settings for endDate
    const { data: publicSettings } = useQuery({
        queryKey: ["admin-games-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data;
        },
    });

    // Sync reward inputs when settings load
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
        if (publicSettings?.gameRewardEndDate) {
            const d = new Date(publicSettings.gameRewardEndDate);
            setEndDate(d.toISOString().slice(0, 16));
        }
    }, [publicSettings]);

    const updateRewardsMut = useMutation({
        mutationFn: async () => {
            const rewardMap: Record<string, number> = {};
            for (const r of rewards) {
                rewardMap[r.place.toString()] = parseInt(r.amount) || 0;
            }
            await fetch("/api/admin/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "updateRewards", rewards: rewardMap }),
            });
            if (publicSettings) {
                await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...publicSettings,
                        gameRewardEndDate: endDate ? new Date(endDate).toISOString() : "",
                    }),
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-games"] });
            queryClient.invalidateQueries({ queryKey: ["admin-games-settings"] });
        },
    });

    const resetScores = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "resetScores" }),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-games"] });
            queryClient.invalidateQueries({ queryKey: ["admin-games-lb"] });
        },
    });

    const distributeRewards = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "distributeRewards" }),
            });
            return res.json();
        },
        onSuccess: (data) => {
            if (data.distributed?.length) {
                alert(`Distributed rewards to ${data.distributed.length} players!`);
            }
            queryClient.invalidateQueries({ queryKey: ["admin-games"] });
        },
    });

    const currentLb = lbTab === "memory" ? memoryLb : rushLb;
    const scores: LeaderboardEntry[] = currentLb?.scores || [];
    const placeEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

    return (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            <div>
                <div className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-bold">Games Management</h1>
                </div>
                <p className="text-sm text-foreground/50">
                    Configure rewards and manage game leaderboards ({settings?.scoreCount ?? 0} memory players)
                </p>
            </div>

            {/* Rewards (memory game only for now) */}
            <Card className="border border-divider">
                <CardBody className="space-y-4 p-4">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        <h2 className="text-sm font-semibold">Free {GAME.currency} Rewards</h2>
                        <span className="text-[10px] text-foreground/30 bg-default-100 px-1.5 py-0.5 rounded">Memory Game</span>
                    </div>
                    <p className="text-xs text-foreground/50">
                        Set free {GAME.currency} prizes for top scores. Players see &quot;Free X {GAME.currency}&quot; with a countdown.
                    </p>
                    <div className="space-y-2">
                        {rewards.map((r, i) => (
                            <div key={r.place} className="flex items-center gap-2">
                                <Input
                                    label={`${placeEmojis[r.place - 1] || `#${r.place}`} ${r.place === 1 ? "1st" : r.place === 2 ? "2nd" : r.place === 3 ? "3rd" : `${r.place}th`}`}
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
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="flat"
                                        color="danger"
                                        onPress={() => setRewards(rewards.filter((_, j) => j !== i))}
                                    >
                                        ✕
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            size="sm"
                            variant="flat"
                            onPress={() => setRewards([...rewards, { place: rewards.length + 1, amount: "" }])}
                        >
                            + Add Place
                        </Button>
                    </div>
                    <Input
                        label="Ends On"
                        type="datetime-local"
                        size="sm"
                        value={endDate}
                        onValueChange={setEndDate}
                        description="Countdown timer shown on the games page"
                    />
                    <Button color="primary" size="sm" onPress={() => updateRewardsMut.mutate()} isLoading={updateRewardsMut.isPending}>
                        Save Rewards
                    </Button>
                </CardBody>
            </Card>

            <Divider />

            {/* Leaderboards */}
            <div className="space-y-4">
                <Tabs
                    selectedKey={lbTab}
                    onSelectionChange={(k) => setLbTab(k as string)}
                    variant="underlined"
                    classNames={{ tabList: "w-full", tab: "flex-1" }}
                >
                    <Tab key="memory" title={<div className="flex items-center gap-1.5"><Brain className="h-4 w-4" /><span>Memory</span></div>} />
                    <Tab key="number-rush" title={<div className="flex items-center gap-1.5"><Hash className="h-4 w-4" /><span>Number Rush</span></div>} />
                </Tabs>

                {scores.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-default-100 py-8 text-center">
                        <AlertCircle className="h-8 w-8 text-foreground/20" />
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

                {/* Actions — memory game only */}
                {lbTab === "memory" && (
                    <div className="flex gap-2">
                        <Button
                            color="success" variant="flat" size="sm"
                            onPress={() => distributeRewards.mutate()}
                            isLoading={distributeRewards.isPending}
                            isDisabled={scores.length === 0}
                            startContent={<Banknote className="h-4 w-4" />}
                        >
                            Distribute Rewards
                        </Button>
                        <Button
                            color="danger" variant="flat" size="sm"
                            onPress={() => { if (confirm("Reset ALL memory scores? This cannot be undone.")) resetScores.mutate(); }}
                            isLoading={resetScores.isPending}
                            startContent={<RotateCcw className="h-4 w-4" />}
                        >
                            Reset Scores
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
