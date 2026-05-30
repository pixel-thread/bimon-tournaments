import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendTournamentRules } from "@/lib/discord-service";

/**
 * POST /api/discord/send-rules
 *
 * Sends pre-configured tournament rules (banned items, slot scam prevention,
 * server issues) to the tournament's Discord channel.
 * Admin-only.
 *
 * Body: { tournamentId, tournamentName }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { tournamentId, tournamentName } = await req.json();

        if (!tournamentId || !tournamentName) {
            return NextResponse.json({ error: "Missing tournamentId or tournamentName" }, { status: 400 });
        }

        await sendTournamentRules(tournamentId, tournamentName);

        return NextResponse.json({ success: true, message: "Tournament rules sent to Discord" });
    } catch (error) {
        console.error("Discord send-rules error:", error);
        return NextResponse.json({ error: "Failed to send rules to Discord" }, { status: 500 });
    }
}
