import { prisma } from "@/lib/database";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/teams/[teamId]/deduct-points
 * Set point deduction for a team.
 * Body: { points: number } — the total points to deduct (0 = clear deduction).
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string }> },
) {
    try {
        const { teamId } = await params;
        const body = await req.json();
        const points = Number(body.points);

        if (isNaN(points) || points < 0) {
            return NextResponse.json(
                { error: "Points must be a non-negative number" },
                { status: 400 },
            );
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { name: true, pointDeduction: true },
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        await prisma.team.update({
            where: { id: teamId },
            data: { pointDeduction: points },
        });

        return NextResponse.json({
            success: true,
            teamName: team.name,
            pointDeduction: points,
            message: points > 0
                ? `${team.name}: ${points} point${points !== 1 ? "s" : ""} deducted from standings.`
                : `${team.name}: point deduction cleared.`,
        });
    } catch (error: any) {
        console.error("[teams/deduct-points] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to set point deduction" },
            { status: 500 },
        );
    }
}
