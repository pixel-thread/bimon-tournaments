"use client";

import { Brain } from "lucide-react";
import { GameManagement } from "@/components/dashboard/games/game-management";

export default function AdminMemoryGamePage() {
    return (
        <GameManagement
            gameKey="memory"
            label="Memory Game"
            icon={Brain}
            color="text-purple-400"
            image="/images/game-memory.png"
        />
    );
}
