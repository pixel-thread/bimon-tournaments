import type { Metadata } from "next";
import { GAME } from "@/lib/game-config";

export const metadata: Metadata = {
    title: `Tournament Results & History | ${GAME.gameName} — Bimon`,
    description: `View all completed ${GAME.gameName} tournament results on Bimon. See past winners, prize pool breakdowns, team standings, and performance data from every tournament.`,
};

export default function TournamentsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
