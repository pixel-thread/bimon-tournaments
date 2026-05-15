import { prisma } from "@/lib/database";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tournaments/[id]/championship/disqualify
 * Toggle disqualification for a team in a championship tournament.
 * Body: { teamId: string }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id: tournamentId } = await params;
        const { teamId } = (await req.json()) as { teamId: string };

        if (!teamId) {
            return NextResponse.json({ error: "teamId is required" }, { status: 400 });
        }

        // Find the championship entry
        const entry = await prisma.championshipEntry.findFirst({
            where: { tournamentId, teamId },
            include: { team: { select: { name: true } } },
        });

        if (!entry) {
            return NextResponse.json({ error: "Team not found in championship" }, { status: 404 });
        }

        const isDQ = entry.status === "DISQUALIFIED";
        const newStatus = isDQ ? "ACTIVE" : "DISQUALIFIED";

        await prisma.championshipEntry.update({
            where: { id: entry.id },
            data: { status: newStatus },
        });

        return NextResponse.json({
            success: true,
            teamName: entry.team.name,
            status: newStatus,
            message: isDQ
                ? `${entry.team.name} has been reinstated.`
                : `${entry.team.name} has been disqualified. Their points will be zeroed in standings.`,
        });
    } catch (error: any) {
        console.error("[championship/disqualify] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to toggle disqualification" },
            { status: 500 },
        );
    }
}
