import { MemoryGame } from "@/components/games/memory-game";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Memory Game",
    description: "Match pairs and test your memory! A fun mini-game to pass the time between tournaments.",
};

export default function MemoryGamePage() {
    return <MemoryGame />;
}
