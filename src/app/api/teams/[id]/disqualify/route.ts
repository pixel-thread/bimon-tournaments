import { prisma } from "@/lib/database";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/teams/[id]/disqualify
 * Toggle disqualification for a team (works for any tournament type).
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id: teamId } = await params;

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { name: true, disqualified: true, tournamentId: true },
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const newDQ = !team.disqualified;

        await prisma.team.update({
            where: { id: teamId },
            data: { disqualified: newDQ },
        });

        return NextResponse.json({
            success: true,
            teamName: team.name,
            disqualified: newDQ,
            message: newDQ
                ? `${team.name} has been disqualified. Their points will be zeroed in standings.`
                : `${team.name} has been reinstated.`,
        });
    } catch (error: any) {
        console.error("[teams/disqualify] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to toggle disqualification" },
            { status: 500 },
        );
    }
}
