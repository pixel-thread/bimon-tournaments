"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Gamepad2, Hash, Brain, ChevronRight } from "lucide-react";

const GAMES = [
    {
        id: "memory",
        name: "Memory Game",
        description: "Match pairs and test your memory!",
        icon: Brain,
        emoji: "🧠",
        href: "/games/memory",
        gradient: "from-purple-500/20 to-pink-500/20",
        borderColor: "border-purple-500/20",
        iconColor: "text-purple-400",
    },
    {
        id: "number-rush",
        name: "Number Rush",
        description: "Tap 1→25 in order — fastest wins!",
        icon: Hash,
        emoji: "⚡",
        href: "/games/number-rush",
        gradient: "from-amber-500/20 to-orange-500/20",
        borderColor: "border-amber-500/20",
        iconColor: "text-amber-400",
    },
];

export default function GamesPage() {
    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="mb-6 space-y-1">
                <div className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 game-text" />
                    <h1 className="text-lg font-bold">Games</h1>
                </div>
                <p className="text-sm text-foreground/50">Play mini-games, compete on the leaderboard!</p>
            </div>

            {/* Game cards */}
            <div className="space-y-3">
                {GAMES.map((game, i) => (
                    <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                    >
                        <Link href={game.href}>
                            <div className={`
                                group relative overflow-hidden rounded-2xl border ${game.borderColor}
                                bg-gradient-to-br ${game.gradient}
                                p-4 transition-all hover:scale-[1.02] active:scale-[0.98]
                            `}>
                                <div className="flex items-center gap-4">
                                    {/* Icon */}
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-background/50 backdrop-blur-sm text-3xl">
                                        {game.emoji}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-base font-bold">{game.name}</h2>
                                        <p className="text-sm text-foreground/50 mt-0.5">{game.description}</p>
                                    </div>

                                    {/* Arrow */}
                                    <ChevronRight className="h-5 w-5 text-foreground/20 group-hover:text-foreground/50 transition-colors shrink-0" />
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
