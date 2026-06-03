import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { progressFromHeats, progressFromHeatsLite, progressFromWildcard } from "@/lib/logic/championship";

/**
 * POST /api/tournaments/[id]/championship/progress
 * Admin advances championship to the next phase.
 * Body: { from: "HEATS" | "WILDCARD" }
 *
 * Auto-detects Lite mode (≤22 teams): Heats → Finals (skip Wildcard).
 * Also handles Discord channel lifecycle: deletes old group channels, creates new phase channel.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: tournamentId } = await params;
        const body = await req.json();
        const { from } = body as { from: "HEATS" | "WILDCARD" };

        if (!from || !["HEATS", "WILDCARD"].includes(from)) {
            return NextResponse.json(
                { error: "Invalid 'from' phase. Must be HEATS or WILDCARD." },
                { status: 400 }
            );
        }

        // Verify tournament exists and has championship entries
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                id: true,
                name: true,
                seasonId: true,
                discordChannelId: true,
                discordGroupChannels: true,
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        const entries = await prisma.championshipEntry.findMany({
            where: { tournamentId },
            select: { status: true },
        });

        if (entries.length === 0) {
            return NextResponse.json(
                { error: "No championship entries found. Generate teams first." },
                { status: 400 }
            );
        }

        // Auto-detect Lite mode: ≤22 active (non-standby) entries
        const activeCount = entries.filter(e => e.status !== "STANDBY").length;
        const isLite = activeCount > 0 && activeCount <= 22;

        let result;
        let message: string;
        let nextPhase: "wildcard" | "finals";

        if (from === "HEATS") {
            if (isLite) {
                const liteResult = await progressFromHeatsLite(tournamentId, tournament.seasonId!);
                result = liteResult;
                message = `Heats complete (Lite)! ${liteResult.directQualifiers} qualified to finals, ${liteResult.eliminated} eliminated. No wildcard phase.`;
                nextPhase = "finals";
            } else {
                const heatsResult = await progressFromHeats(tournamentId, tournament.seasonId!);
                result = heatsResult;
                message = `Heats complete! ${heatsResult.directQualifiers} direct qualifiers, ${heatsResult.wildcardTeams} to wildcard, ${heatsResult.eliminated} eliminated.`;
                nextPhase = "wildcard";
            }
        } else {
            const wcResult = await progressFromWildcard(tournamentId, tournament.seasonId!);
            result = wcResult;
            message = `Wildcard complete! ${wcResult.qualifiedToFinals} qualified to finals, ${wcResult.eliminated} eliminated. ${wcResult.totalFinalists} total finalists.`;
            nextPhase = "finals";
        }

        // ─── Discord Channel: create phase channel (no auto-granting) ─────
        // Channels are NOT deleted — they serve as archive. Access is managed
        // manually from the Room Info → Discord Access tab.
        // New phase channels were already created by the championship progression
        // functions (progressFromHeats / progressFromHeatsLite / progressFromWildcard),
        // so no additional channel creation is needed here.
        console.log(`[championship/progress] Phase progressed to ${nextPhase} — grant access from Discord Access tab`);

        return NextResponse.json({
            success: true,
            data: result,
            message,
        });
    } catch (error: any) {
        console.error("[championship/progress] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to progress championship" },
            { status: 500 }
        );
    }
}
