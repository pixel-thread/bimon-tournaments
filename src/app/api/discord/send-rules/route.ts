import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendTournamentRules } from "@/lib/discord-service";
import { prisma } from "@/lib/database";

/**
 * POST /api/discord/send-rules
 *
 * Sends pre-configured tournament rules (banned items, slot scam prevention,
 * server issues) to the tournament's Discord channel.
 * Admin or UC-exempt players.
 *
 * Body: { tournamentId, tournamentName }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
        const isUCExempt = user?.player
            ? (await prisma.player.findUnique({ where: { id: user.player.id }, select: { isUCExempt: true } }))?.isUCExempt
            : false;
        if (!user || (!isAdmin && !isUCExempt)) {
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
