"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Tabs, Tab, Avatar, Skeleton, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { RotateCcw, Trophy, Timer, MousePointerClick, Gamepad2, Medal, Heart, Square, Lock } from "lucide-react";
import { AdSlot } from "@/components/common/AdSlot";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";

/* ── Config ────────────────────────────────────────────── */
const EMOJI_SETS = [
    ["🐶", "🐱", "🐼", "🦊", "🐸", "🦁", "🐯", "🐰", "🐻", "🐨", "🐵", "🦄"],
    ["🍕", "🍔", "🍟", "🌮", "🍩", "🍪", "🎂", "🍦", "🍫", "🍿", "☕", "🧃"],
    ["⚽", "🏀", "🎾", "🏐", "🎱", "🏓", "🎯", "🏆", "🎪", "🎨", "🎸", "🎲"],
    ["🚀", "✈️", "🚁", "🚂", "🏎️", "🚢", "🛸", "🎡", "🌋", "⛰️", "🌊", "🌈"],
];

const PAIRS = 10;
const COLS = "grid-cols-5";
const MAX_HEARTS = 5;
const HEART_REGEN_MS = 10 * 60 * 1000;

interface Card { id: number; emoji: string; isFlipped: boolean; isMatched: boolean; }

interface ServerScore {
    rank: number | null; score: number;
    displayName: string; imageUrl: string | null; playerId: string;
    blocked?: boolean;
}

function calcScore(moves: number, time: number): number {
    return Math.max(0, 1000 - (moves * 10) - time);
}

function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function createCards(): Card[] {
    const emojiSet = EMOJI_SETS[Math.floor(Math.random() * EMOJI_SETS.length)];
    const selected = shuffleArray(emojiSet).slice(0, PAIRS);
    const cards = [...selected, ...selected].map((emoji, i) => ({
        id: i, emoji, isFlipped: false, isMatched: false,
    }));
    return shuffleArray(cards);
}

function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ── Hearts ─────────────────────────────────────────────── */
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

/**
 * Consume one heart, preserving partial regen progress.
 * 
 * If the regen timer was 5 min into a 10 min cycle, after consuming
 * a heart the timer continues from 5 min (not reset to 10:00).
 */
function consumeHeart(): number {
    const saved = loadHearts();
    const actual = getRegenedHearts(saved);
    if (actual <= 0) return 0;

    const newActual = actual - 1;

    if (newActual >= MAX_HEARTS) {
        // Still at max — no regen needed
        localStorage.setItem("memory-hearts", JSON.stringify({
            count: newActual, lastUsed: Date.now(),
        }));
    } else {
        // Preserve partial progress toward the next heart
        // elapsed % period = how far into current regen cycle we are
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
function Leaderboard() {
    const { data, isLoading } = useQuery<{ scores: ServerScore[]; rewards: Record<string, number>; gameRewardEndDate?: string }>({
        queryKey: ["game-leaderboard"],
        queryFn: async () => {
            const res = await fetch("/api/games/leaderboard");
            return res.json();
        },
        staleTime: 30_000,
    });

    const scores = data?.scores || [];
    const rewards = data?.rewards || {};
    const topPrize = rewards["1"] || 0;
    const endDate = data?.gameRewardEndDate ? new Date(data.gameRewardEndDate) : null;

    // Countdown
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
            {/* Prize banner — "Free X UC" */}
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

            {/* Header */}
            <div className="flex items-center gap-3 rounded-lg bg-default-100 px-4 py-2 text-xs font-semibold text-foreground/50">
                <span className="w-8 text-center">#</span>
                <span className="flex-1">Player</span>
                <span className="w-16 text-right">Points</span>
            </div>

            {/* Rows */}
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
export function MemoryGame() {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<string>("play");
    const [cards, setCards] = useState<Card[]>([]);
    const [flippedIds, setFlippedIds] = useState<number[]>([]);
    const [wrongIds, setWrongIds] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [time, setTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isStopped, setIsStopped] = useState(false);
    const [gameWon, setGameWon] = useState(false);
    const [isNewBest, setIsNewBest] = useState(false);
    const [hearts, setHearts] = useState(MAX_HEARTS);
    const [showNoHearts, setShowNoHearts] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [regenCountdown, setRegenCountdown] = useState("");
    const [personalBest, setPersonalBest] = useState(0);
    const [myThreshold, setMyThreshold] = useState(0);
    const [gameCount, setGameCount] = useState(0);
    const [isScrambling, setIsScrambling] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load personal best from server
    useEffect(() => {
        fetch("/api/games/leaderboard")
            .then(r => r.json())
            .then(data => {
                if (data.myBest) setPersonalBest(data.myBest);
                if (data.myThreshold) setMyThreshold(data.myThreshold);
            })
            .catch(() => {});
    }, []);

    // Hearts regen + countdown
    useEffect(() => {
        function tick() {
            const saved = loadHearts();
            const current = getRegenedHearts(saved);
            setHearts(current);

            // Auto-dismiss "out of hearts" when a heart regens
            if (current > 0) setShowNoHearts(false);

            if (current < MAX_HEARTS) {
                const elapsed = Date.now() - saved.lastUsed;
                const heartsSoFar = Math.floor(elapsed / HEART_REGEN_MS);
                const rem = HEART_REGEN_MS - (elapsed - heartsSoFar * HEART_REGEN_MS);
                setRegenCountdown(`${Math.floor(rem / 60000)}:${Math.floor((rem % 60000) / 1000).toString().padStart(2, "0")}`);
            } else setRegenCountdown("");
        }
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    // Game timer
    useEffect(() => {
        if (isRunning) timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isRunning]);

    // Auto-start on mount
    useEffect(() => { startGame(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Save score
    const saveScore = useCallback(async (m: number, t: number) => {
        const sc = calcScore(m, t);
        try {
            const res = await fetch("/api/games/leaderboard", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ score: sc, moves: m, time: t }),
            });
            const data = await res.json();
            if (data.blocked) {
                // Score below threshold — won't appear on leaderboard
                setMyThreshold(data.threshold);
            } else if (data.isNewBest) {
                setIsNewBest(true); setPersonalBest(sc);
            }
            queryClient.invalidateQueries({ queryKey: ["game-leaderboard"] });
        } catch { /* silent */ }
    }, [queryClient]);

    // Start / restart — scramble animation then deal fresh cards
    const startGame = useCallback(() => {
        // Only animate if cards already exist (reset, not initial)
        if (cards.length > 0) {
            setIsScrambling(true);
            // After scatter animation, deal new cards
            setTimeout(() => {
                setCards(createCards());
                setFlippedIds([]); setWrongIds([]); setMoves(0); setTime(0);
                setIsRunning(false); setIsStopped(false); setGameWon(false); setIsNewBest(false);
                setShowNoHearts(false); setHasStarted(true);
                setGameCount(c => c + 1);
                // Let new cards settle in
                setTimeout(() => setIsScrambling(false), 50);
            }, 400);
        } else {
            setCards(createCards());
            setFlippedIds([]); setWrongIds([]); setMoves(0); setTime(0);
            setIsRunning(false); setIsStopped(false); setGameWon(false); setIsNewBest(false);
            setShowNoHearts(false); setHasStarted(true);
            setGameCount(c => c + 1);
        }
    }, [cards.length]);

    // Stop — freeze timer + lock cards
    function stopGame() {
        setIsRunning(false);
        setIsStopped(true);
    }

    // Card click
    function handleCardClick(id: number) {
        if (flippedIds.length >= 2 || gameWon || isStopped) return;
        const card = cards.find(c => c.id === id);
        if (!card || card.isFlipped || card.isMatched) return;

        // First flip — consume a heart
        if (!isRunning) {
            const saved = loadHearts();
            const current = getRegenedHearts(saved);
            if (current <= 0) { setShowNoHearts(true); setHearts(0); return; }
            const remaining = consumeHeart();
            setHearts(remaining);
            setIsRunning(true);
        }

        const newFlipped = [...flippedIds, id];
        setFlippedIds(newFlipped);
        setCards(prev => prev.map(c => c.id === id ? { ...c, isFlipped: true } : c));

        if (newFlipped.length === 2) {
            setMoves(m => m + 1);
            const [a, b] = newFlipped;
            const ca = cards.find(c => c.id === a)!;
            const cb = cards.find(c => c.id === b)!;

            if (ca.emoji === cb.emoji) {
                setTimeout(() => {
                    setCards(prev => prev.map(c => c.id === a || c.id === b ? { ...c, isMatched: true } : c));
                    setFlippedIds([]);
                    if (cards.filter(c => !c.isMatched && c.id !== a && c.id !== b).length === 0) {
                        setIsRunning(false); setGameWon(true); saveScore(moves + 1, time);
                    }
                }, 500);
            } else {
                setWrongIds([a, b]);
                setTimeout(() => {
                    setCards(prev => prev.map(c => c.id === a || c.id === b ? { ...c, isFlipped: false } : c));
                    setFlippedIds([]); setWrongIds([]);
                }, 900);
            }
        }
    }

    const score = calcScore(moves, time);

    function cardClass(card: Card) {
        const c = ["flip-card", "aspect-square", "select-none"];
        if (card.isMatched) c.push("flipped", "matched");
        else if (card.isFlipped) c.push("flipped");
        if (wrongIds.includes(card.id)) c.push("wrong");
        if (!card.isMatched && !card.isFlipped && !gameWon) c.push("cursor-pointer");
        return c.join(" ");
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <Gamepad2 className="h-5 w-5 game-text" />
                        <h1 className="text-lg font-bold">Memory Game</h1>
                    </div>
                    <p className="text-sm text-foreground/50">Fewer moves + faster time = higher score</p>
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
                <Tab key="play" title={<div className="flex items-center gap-1.5"><Gamepad2 className="h-4 w-4" /><span>Play</span></div>} />
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
                            {gameCount >= 3 && <AdSlot format="banner" className="mt-2 w-full rounded-lg overflow-hidden" />}
                        </div>
                    ) : !hasStarted ? (
                        <div className="flex items-center justify-center py-16">
                            <Gamepad2 className="h-8 w-8 text-foreground/20 animate-pulse" />
                        </div>
                    ) : (
                        <>
                            {/* Stats — moves, best, timer */}
                            <div className="mb-3 flex items-center justify-between rounded-lg bg-default-100 px-4 py-2.5">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <MousePointerClick className="h-4 w-4 text-foreground/40" />
                                    <span className="font-semibold">{moves}</span>
                                </div>
                                <div className="text-xs text-foreground/40">
                                    Best: <span className="font-semibold text-foreground/60">{personalBest > 0 ? personalBest : "—"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Timer className="h-4 w-4 text-foreground/40" />
                                    <span className="font-semibold">{formatTime(time)}</span>
                                </div>
                            </div>

                            {/* Threshold notice — only for past winners */}
                            {myThreshold > 0 && (
                                <div className="mb-3 flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
                                    <Lock className="h-3.5 w-3.5 text-warning shrink-0" />
                                    <p className="text-xs text-warning">
                                        Champ, you need to beat <span className="font-bold">{myThreshold} pts</span> to get back on the leaderboard!
                                    </p>
                                </div>
                            )}

                            {/* 5×4 flip card grid */}
                            <div className={`grid ${COLS} gap-1.5 sm:gap-2`}>
                                {cards.map((card, i) => (
                                    <div
                                        key={`${gameCount}-${card.id}`}
                                        className={cardClass(card)}
                                        onClick={() => handleCardClick(card.id)}
                                        onDoubleClick={(e) => e.preventDefault()}
                                        style={isScrambling ? {
                                            transform: `translate(${(Math.random() - 0.5) * 120}px, ${(Math.random() - 0.5) * 120}px) rotate(${(Math.random() - 0.5) * 60}deg) scale(0.7)`,
                                            opacity: 0.4,
                                            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                        } : {
                                            transform: 'translate(0, 0) rotate(0deg) scale(1)',
                                            opacity: 1,
                                            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                                            transitionDelay: `${i * 20}ms`,
                                        }}
                                    >
                                        <div className="flip-card-inner">
                                            <div className="flip-card-front bg-default-100 border-2 border-default-200 hover:bg-default-200 transition-colors">
                                                <span className="text-base sm:text-lg text-foreground/15 select-none">?</span>
                                            </div>
                                            <div className={`flip-card-back text-xl sm:text-3xl select-none ${
                                                card.isMatched
                                                    ? "bg-success/15 border-2 border-success/30 opacity-50"
                                                    : wrongIds.includes(card.id)
                                                        ? "bg-danger/15 border-2 border-danger/30"
                                                        : "bg-primary/15 border-2 border-primary/30"
                                            }`}>
                                                {card.emoji}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Stop + Reset below grid — only after first flip */}
                            {(isRunning || isStopped) && !gameWon && (
                                <>
                                    <div className="mt-3 flex gap-2">
                                        {!isStopped && (
                                            <Button size="sm" variant="flat" color="danger" className="flex-1" onPress={stopGame} startContent={<Square className="h-3.5 w-3.5 fill-current" />}>
                                                Stop
                                            </Button>
                                        )}
                                        <Button size="sm" variant="flat" className="flex-1" onPress={() => startGame()} startContent={<RotateCcw className="h-3.5 w-3.5" />}>
                                            Reset
                                        </Button>
                                    </div>
                                </>
                            )}

                            {/* Ad below game — fills empty space for high view time */}
                            {gameCount >= 1 && (
                                <AdSlot format="banner" className="mt-4 rounded-lg overflow-hidden" />
                            )}

                            {/* Win modal */}
                            {gameWon && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                                    <div className="w-full max-w-sm rounded-2xl bg-background border border-divider p-6 text-center space-y-4 shadow-2xl">
                                        <div className="text-5xl">🎉</div>
                                        <div>
                                            <p className="text-lg font-bold text-success">{isNewBest ? "New Personal Best! 🏆" : "You won!"}</p>
                                            <p className="text-3xl font-black game-text mt-1">{score} pts</p>
                                            <p className="text-sm text-foreground/50 mt-1">{moves} moves • {formatTime(time)}</p>
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
