import { Hash } from "lucide-react";
import { GameManagement } from "@/components/dashboard/games/game-management";

export default function AdminNumberRushPage() {
    return (
        <GameManagement
            gameKey="number-rush"
            label="Number Rush"
            icon={Hash}
            color="text-amber-400"
            image="/images/game-number-rush.png"
        />
    );
}
