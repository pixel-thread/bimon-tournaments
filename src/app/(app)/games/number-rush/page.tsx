import { NumberRush } from "@/components/games/number-rush";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Number Rush",
    description: "Tap numbers 1 to 25 in order — fastest time wins! Compete for the top of the leaderboard.",
};

export default function NumberRushPage() {
    return <NumberRush />;
}
