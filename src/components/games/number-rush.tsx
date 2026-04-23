"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Tabs, Tab, Avatar, Skeleton, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { RotateCcw, Trophy, Timer, Hash, Gamepad2, Medal, Heart, Lock } from "lucide-react";
import { AdSlot } from "@/components/common/AdSlot";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

/* ── Config ────────────────────────────────────────────── */
const GRID_SIZE = 25;
const COLS = 5;
const MAX_HEARTS = 5;
const HEART_REGEN_MS = 10 * 60 * 1000;
const PENALTY_MS = 2000; // 2 seconds added per wrong tap

function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function calcScore(timeMs: number, penalties: number): number {
    return Math.max(0, 1000 - Math.floor((timeMs + (penalties * PENALTY_MS)) / 100));
}

function formatTimeMs(ms: number): string {
    const totalSec = ms / 1000;
    const sec = Math.floor(totalSec);
    const tenths = Math.floor((totalSec - sec) * 10);
    return `${sec}.${tenths}s`;
}

/* ── Hearts (shared with memory game) ──────────────────── */
function loadHearts(): { count: number; lastUsed: number } {
    try {
        const saved = localStorage.getItem("memory-hearts");
        if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { count: MAX_HEARTS, lastUsed: Date.now() };
}

function getRegenedHearts(saved: { count: number; lastUsed: number }): number {
    if (saved.count >= MAX_HEARTS) return MAX_HEARTS;
    const elapsed = Date.now() - saved.lastUsed;
    const regened = Math.floor(elapsed / HEART_REGEN_MS);
    return Math.min(MAX_HEARTS, saved.count + regened);
}

function consumeHeart(): number {
    const saved = loadHearts();
    const actual = getRegenedHearts(saved);
    if (actual <= 0) return 0;

    const newActual = actual - 1;

    if (newActual >= MAX_HEARTS) {
        localStorage.setItem("memory-hearts", JSON.stringify({
            count: newActual, lastUsed: Date.now(),
        }));
    } else {
        const elapsed = Date.now() - saved.lastUsed;
        const partialProgress = actual < MAX_HEARTS ? (elapsed % HEART_REGEN_MS) : 0;
        localStorage.setItem("memory-hearts", JSON.stringify({
            count: newActual,
            lastUsed: Date.now() - partialProgress,
        }));
    }

    return newActual;
}

/* ── Leaderboard ────────────────────────────────────────── */
interface ServerScore {
    rank: number | null; score: number;
    displayName: string; imageUrl: string | null; playerId: string;
    blocked?: boolean;
}

function Leaderboard() {
    const { data, isLoading } = useQuery<{ scores: ServerScore[]; rewards: Record<string, number>; gameRewardEndDate?: string }>({
        queryKey: ["game-leaderboard", "number-rush"],
        queryFn: async () => {
            const res = await fetch("/api/games/leaderboard?game=number-rush");
            return res.json();
        },
        staleTime: 30_000,
    });

    const scores = data?.scores || [];
    const rewards = data?.rewards || {};
    const topPrize = rewards["1"] || 0;
    const endDate = data?.gameRewardEndDate ? new Date(data.gameRewardEndDate) : null;

    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
        if (!endDate) return;
        const tick = () => {
            const diff = endDate.getTime() - Date.now();
            if (diff <= 0) { setTimeLeft("Ended"); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endDate?.getTime()]);

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
        );
    }
    if (scores.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-default-100 py-12 text-center">
                <Medal className="h-10 w-10 text-foreground/20" />
                <div>
                    <p className="font-medium text-foreground/60">No scores yet</p>
                    <p className="text-sm text-foreground/40">Be the first to set a score!</p>
                </div>
            </div>
        );
    }

    const prizeCount = Object.values(rewards).filter(v => v > 0).length;
    const tooltipText = prizeCount === 1
        ? "Top scorer wins this prize!"
        : `Top ${prizeCount} scorers win prizes!`;

    return (
        <div className="space-y-2">
            {topPrize > 0 && (
                <div className="flex flex-col items-center gap-1 rounded-xl bg-success/10 border border-success/20 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-success" />
                        <span className="text-xl font-bold text-success">
                            Free {topPrize} <CurrencyIcon size={16} />
                        </span>
                        <Popover placement="bottom">
                            <PopoverTrigger>
                                <button className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-[10px] font-bold text-success">?</button>
                            </PopoverTrigger>
                            <PopoverContent>
                                <p className="text-xs px-1 py-0.5">{tooltipText}</p>
                            </PopoverContent>
                        </Popover>
                    </div>
                    {(rewards["2"] > 0 || rewards["3"] > 0) && (
                        <div className="flex items-center gap-3 text-xs text-foreground/50">
                            {rewards["2"] > 0 && <span>#2: {rewards["2"]} <CurrencyIcon size={10} /></span>}
                            {rewards["3"] > 0 && <span>#3: {rewards["3"]} <CurrencyIcon size={10} /></span>}
                        </div>
                    )}
                    {endDate && timeLeft && timeLeft !== "Ended" && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <Timer className="h-3 w-3 text-warning" />
                            <span className="text-xs font-semibold text-warning">{timeLeft}</span>
                        </div>
                    )}
                    {timeLeft === "Ended" && (
                        <span className="text-[10px] text-foreground/30 mt-0.5">Event ended</span>
                    )}
                </div>
            )}

            <div className="flex items-center gap-3 rounded-lg bg-default-100 px-4 py-2 text-xs font-semibold text-foreground/50">
                <span className="w-8 text-center">#</span>
                <span className="flex-1">Player</span>
                <span className="w-16 text-right">Points</span>
            </div>

            {scores.map((entry) => (
                <div
                    key={entry.playerId}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors ${
                        entry.blocked
                            ? "opacity-40"
                            : entry.rank === 1
                                ? "bg-amber-500/15 border border-amber-500/25 shadow-sm"
                                : entry.rank !== null && entry.rank <= 3
                                    ? "bg-amber-500/5"
                                    : "hover:bg-default-100"
                    }`}
                >
                    <span className={`w-8 text-center text-xs font-medium ${
                        entry.blocked ? "text-foreground/20" : entry.rank === 1 ? "text-yellow-500 text-sm" : entry.rank === 2 ? "text-foreground/50" : entry.rank === 3 ? "text-orange-400" : "text-foreground/30"
                    }`}>
                        {entry.blocked
                            ? <Lock className="h-3.5 w-3.5 mx-auto text-foreground/20" />
                            : entry.rank !== null && entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                    </span>
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                        <Avatar src={entry.imageUrl || undefined} name={entry.displayName} size="sm" className={`shrink-0 ${entry.blocked ? "h-7 w-7 grayscale" : entry.rank === 1 ? "h-8 w-8 ring-2 ring-amber-500/50" : "h-7 w-7"}`} />
                        <span className={`font-medium truncate ${entry.blocked ? "text-sm line-through" : entry.rank === 1 ? "text-sm text-amber-500" : "text-sm"}`}>{entry.displayName}</span>
                    </div>
                    <span className={`w-16 text-right font-bold ${entry.blocked ? "text-sm text-foreground/30 line-through" : entry.rank === 1 ? "text-base game-text" : "text-sm game-text"}`}>{entry.score}</span>
                </div>
            ))}
        </div>
    );
}

/* ── Main game ─────────────────────────────────────────── */
export function NumberRush() {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<string>("play");
    const [grid, setGrid] = useState<number[]>([]);
    const [nextNumber, setNextNumber] = useState(1);
    const [wrongTap, setWrongTap] = useState<number | null>(null);
    const [penalties, setPenalties] = useState(0);
    const [startTime, setStartTime] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [gameWon, setGameWon] = useState(false);
    const [isNewBest, setIsNewBest] = useState(false);
    const [hearts, setHearts] = useState(MAX_HEARTS);
    const [showNoHearts, setShowNoHearts] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [regenCountdown, setRegenCountdown] = useState("");
    const [personalBest, setPersonalBest] = useState(0);
    const [myThreshold, setMyThreshold] = useState(0);
    const [gameCount, setGameCount] = useState(0);
    const [finalTime, setFinalTime] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load personal best
    useEffect(() => {
        fetch("/api/games/leaderboard?game=number-rush")
            .then(r => r.json())
            .then(data => {
                if (data.myBest) setPersonalBest(data.myBest);
                if (data.myThreshold) setMyThreshold(data.myThreshold);
            })
            .catch(() => {});
    }, []);

    // Hearts regen
    useEffect(() => {
        function tick() {
            const saved = loadHearts();
            const current = getRegenedHearts(saved);
            setHearts(current);
            if (current > 0) setShowNoHearts(false);

            if (current < MAX_HEARTS) {
                const el = Date.now() - saved.lastUsed;
                const heartsSoFar = Math.floor(el / HEART_REGEN_MS);
                const rem = HEART_REGEN_MS - (el - heartsSoFar * HEART_REGEN_MS);
                setRegenCountdown(`${Math.floor(rem / 60000)}:${Math.floor((rem % 60000) / 1000).toString().padStart(2, "0")}`);
            } else setRegenCountdown("");
        }
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    // Timer
    useEffect(() => {
        if (isRunning) {
            timerRef.current = setInterval(() => {
                setElapsed(Date.now() - startTime);
            }, 50);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isRunning, startTime]);

    // Auto-start
    useEffect(() => { startGame(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Save score
    const saveScore = useCallback(async (timeMs: number, pen: number) => {
        const sc = calcScore(timeMs, pen);
        try {
            const res = await fetch("/api/games/leaderboard", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ game: "number-rush", score: sc, time: timeMs, penalties: pen }),
            });
            const data = await res.json();
            if (data.blocked) {
                setMyThreshold(data.threshold);
            } else if (data.isNewBest) {
                setIsNewBest(true); setPersonalBest(sc);
            }
            queryClient.invalidateQueries({ queryKey: ["game-leaderboard", "number-rush"] });
        } catch { /* silent */ }
    }, [queryClient]);

    const startGame = useCallback(() => {
        const numbers = shuffleArray(Array.from({ length: GRID_SIZE }, (_, i) => i + 1));
        setGrid(numbers);
        setNextNumber(1);
        setPenalties(0);
        setElapsed(0);
        setStartTime(0);
        setIsRunning(false);
        setGameWon(false);
        setIsNewBest(false);
        setShowNoHearts(false);
        setWrongTap(null);
        setFinalTime(0);
        setHasStarted(true);
        setGameCount(c => c + 1);
    }, []);

    function handleTap(num: number) {
        if (gameWon) return;

        // First tap — consume heart + start timer
        if (!isRunning) {
            const saved = loadHearts();
            const current = getRegenedHearts(saved);
            if (current <= 0) { setShowNoHearts(true); setHearts(0); return; }

            if (num !== nextNumber) {
                // Wrong first tap — don't consume heart
                setWrongTap(num);
                setTimeout(() => setWrongTap(null), 300);
                setPenalties(p => p + 1);
                return;
            }

            const remaining = consumeHeart();
            setHearts(remaining);
            const now = Date.now();
            setStartTime(now);
            setIsRunning(true);
            setNextNumber(2);
            return;
        }

        if (num === nextNumber) {
            const next = nextNumber + 1;
            setNextNumber(next);
            setWrongTap(null);

            if (next > GRID_SIZE) {
                // Won!
                const finalMs = Date.now() - startTime;
                setFinalTime(finalMs);
                setElapsed(finalMs);
                setIsRunning(false);
                setGameWon(true);
                saveScore(finalMs, penalties);
            }
        } else {
            // Wrong tap
            setWrongTap(num);
            setTimeout(() => setWrongTap(null), 300);
            setPenalties(p => p + 1);
        }
    }

    const score = calcScore(elapsed || finalTime, penalties);

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <Hash className="h-5 w-5 game-text" />
                        <h1 className="text-lg font-bold">Number Rush</h1>
                    </div>
                    <p className="text-sm text-foreground/50">Tap 1→25 in order — fastest wins!</p>
                </div>
                <div className="flex items-center gap-1">
                    {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                        <Heart key={i} className={`h-4 w-4 transition-all ${i < hearts ? "text-red-500 fill-red-500" : "text-foreground/15 scale-90"}`} />
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <Tabs selectedKey={tab} onSelectionChange={(k) => {
                const newTab = k as string;
                if (newTab === "play" && gameWon) startGame();
                setTab(newTab);
            }} variant="underlined" classNames={{ tabList: "w-full", tab: "flex-1" }} className="mb-4">
                <Tab key="play" title={<div className="flex items-center gap-1.5"><Hash className="h-4 w-4" /><span>Play</span></div>} />
                <Tab key="leaderboard" title={<div className="flex items-center gap-1.5"><Trophy className="h-4 w-4" /><span>Leaderboard</span></div>} />
            </Tabs>

            {tab === "play" ? (
                <>
                    {showNoHearts ? (
                        <div className="flex flex-col items-center gap-4 rounded-xl bg-default-100 py-12 text-center">
                            <div className="flex gap-1">
                                {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                                    <Heart key={i} className="h-6 w-6 text-foreground/15" />
                                ))}
                            </div>
                            <div>
                                <p className="font-medium text-foreground/60">Out of hearts!</p>
                                <p className="text-sm text-foreground/40 mt-1">Hearts regenerate 1 every 10 minutes</p>
                                <p className="text-2xl font-bold text-foreground/70 mt-3">
                                    ⏱ {regenCountdown || "..."}
                                </p>
                                <p className="text-xs text-foreground/30 mt-1">until next heart</p>
                            </div>
                        </div>
                    ) : !hasStarted ? (
                        <div className="flex items-center justify-center py-16">
                            <Hash className="h-8 w-8 text-foreground/20 animate-pulse" />
                        </div>
                    ) : (
                        <>
                            {/* Stats */}
                            <div className="mb-3 flex items-center justify-between rounded-lg bg-default-100 px-4 py-2.5">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-foreground/40 text-xs">Next:</span>
                                    <span className="font-bold game-text text-base">{nextNumber > GRID_SIZE ? "✓" : nextNumber}</span>
                                </div>
                                <div className="text-xs text-foreground/40">
                                    Best: <span className="font-semibold text-foreground/60">{personalBest > 0 ? personalBest : "—"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Timer className="h-4 w-4 text-foreground/40" />
                                    <span className="font-semibold font-mono">{formatTimeMs(elapsed)}</span>
                                </div>
                            </div>

                            {/* Penalties */}
                            {penalties > 0 && (
                                <div className="mb-3 text-center">
                                    <span className="text-xs text-danger">
                                        {penalties} wrong tap{penalties !== 1 ? "s" : ""} (+{penalties * 2}s penalty)
                                    </span>
                                </div>
                            )}

                            {/* Threshold notice */}
                            {myThreshold > 0 && (
                                <div className="mb-3 flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
                                    <Lock className="h-3.5 w-3.5 text-warning shrink-0" />
                                    <p className="text-xs text-warning">
                                        Champ, you need to beat <span className="font-bold">{myThreshold} pts</span> to get back on the leaderboard!
                                    </p>
                                </div>
                            )}

                            {/* 5×5 number grid */}
                            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                                {grid.map((num) => {
                                    const isTapped = num < nextNumber;
                                    const isNext = num === nextNumber;
                                    const isWrong = wrongTap === num;

                                    return (
                                        <button
                                            key={`${gameCount}-${num}`}
                                            onClick={() => handleTap(num)}
                                            disabled={isTapped || gameWon}
                                            className={`
                                                aspect-square rounded-xl text-lg sm:text-xl font-bold
                                                flex items-center justify-center
                                                transition-all duration-150 select-none
                                                ${isTapped
                                                    ? "bg-success/15 text-success/40 scale-90 border-2 border-success/20"
                                                    : isWrong
                                                        ? "bg-danger/20 text-danger border-2 border-danger/40 scale-95 animate-shake"
                                                        : isNext && isRunning
                                                            ? "bg-primary/10 text-foreground border-2 border-primary/30 hover:bg-primary/20 active:scale-95"
                                                            : "bg-default-100 text-foreground border-2 border-default-200 hover:bg-default-200 active:scale-95 cursor-pointer"
                                                }
                                            `}
                                        >
                                            {isTapped ? "✓" : num}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Reset button */}
                            {isRunning && (
                                <div className="mt-3">
                                    <Button size="sm" variant="flat" className="w-full" onPress={startGame} startContent={<RotateCcw className="h-3.5 w-3.5" />}>
                                        Reset
                                    </Button>
                                </div>
                            )}

                            {/* Ad */}
                            {gameCount >= 1 && (
                                <AdSlot format="banner" className="mt-4 rounded-lg overflow-hidden" />
                            )}

                            {/* Win modal */}
                            {gameWon && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                                    <div className="w-full max-w-sm rounded-2xl bg-background border border-divider p-6 text-center space-y-4 shadow-2xl">
                                        <div className="text-5xl">⚡</div>
                                        <div>
                                            <p className="text-lg font-bold text-success">{isNewBest ? "New Personal Best! 🏆" : "Complete!"}</p>
                                            <p className="text-3xl font-black game-text mt-1">{score} pts</p>
                                            <p className="text-sm text-foreground/50 mt-1">
                                                {formatTimeMs(finalTime)}
                                                {penalties > 0 && ` • ${penalties} wrong (+${penalties * 2}s)`}
                                            </p>
                                            {myThreshold > 0 && score < myThreshold && (
                                                <p className="text-xs text-warning/80 mt-2">
                                                    Champ, you need {myThreshold} pts to reclaim your spot! 💪
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 justify-center">
                                            <Button color="success" variant="flat" onPress={() => { startGame(); setTab("play"); }} startContent={<RotateCcw className="h-4 w-4" />}>Play Again</Button>
                                            <Button variant="flat" onPress={() => setTab("leaderboard")} startContent={<Trophy className="h-4 w-4" />}>Leaderboard</Button>
                                        </div>
                                        {gameCount >= 3 && gameCount % 3 === 0 && <AdSlot format="banner" className="mt-2 rounded-lg overflow-hidden" />}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            ) : (
                <Leaderboard />
            )}
        </div>
    );
}
