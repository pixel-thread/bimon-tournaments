import type { Metadata } from "next";
import { GAME } from "@/lib/game-config";

export const metadata: Metadata = {
    title: `About Bimon — Grassroots ${GAME.gameName} Esports Platform`,
    description: `Learn about Bimon Tournament — an open platform for competitive ${GAME.gameName} players. Fair team balancing, transparent prizes, and a thriving community. Powered by Pixel Thread.`,
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
    return children;
}
