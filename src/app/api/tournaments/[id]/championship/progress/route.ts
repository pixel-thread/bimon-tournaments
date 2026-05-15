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
            select: { id: true, seasonId: true },
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

        if (from === "HEATS") {
            if (isLite) {
                // Lite: Heats → Finals directly (skip Wildcard)
                const liteResult = await progressFromHeatsLite(tournamentId, tournament.seasonId!);
                result = liteResult;
                message = `Heats complete (Lite)! ${liteResult.directQualifiers} qualified to finals, ${liteResult.eliminated} eliminated. No wildcard phase.`;
            } else {
                // Full: Heats → Wildcard → Finals
                const heatsResult = await progressFromHeats(tournamentId, tournament.seasonId!);
                result = heatsResult;
                message = `Heats complete! ${heatsResult.directQualifiers} direct qualifiers, ${heatsResult.wildcardTeams} to wildcard, ${heatsResult.eliminated} eliminated.`;
            }
        } else {
            const wcResult = await progressFromWildcard(tournamentId, tournament.seasonId!);
            result = wcResult;
            message = `Wildcard complete! ${wcResult.qualifiedToFinals} qualified to finals, ${wcResult.eliminated} eliminated. ${wcResult.totalFinalists} total finalists.`;
        }

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

