import type { Metadata } from "next";
import { GAME } from "@/lib/game-config";

export const metadata: Metadata = {
    title: `${GAME.gameName} Leaderboard — Top Players | Bimon`,
    description: `View the top ${GAME.gameName} players ranked by K/D ratio, kills, and tournament performance. Updated after every tournament season on Bimon.`,
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
    return children;
}
