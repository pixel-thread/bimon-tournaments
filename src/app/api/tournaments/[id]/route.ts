import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { ALL_TOURNAMENT_TYPES } from "@/lib/bracket-types";

/**
 * PUT /api/tournaments/[id]
 * Update tournament details (admin only).
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();

        const tournament = await prisma.tournament.findUnique({ where: { id } });
        if (!tournament) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const VALID_TYPES: readonly string[] = ALL_TOURNAMENT_TYPES;
        const updated = await prisma.tournament.update({
            where: { id },
            data: {
                name: body.name?.trim() ?? tournament.name,
                description: body.description !== undefined ? (body.description?.trim() || null) : tournament.description,
                fee: body.fee !== undefined ? (body.fee !== null ? Number(body.fee) : null) : tournament.fee,
                seasonId: body.seasonId !== undefined ? (body.seasonId || null) : tournament.seasonId,
                status: body.status ?? tournament.status,
                ...(body.type && VALID_TYPES.includes(body.type) && { type: body.type }),
                ...(body.maxPlacements !== undefined && { maxPlacements: Math.min(Math.max(Number(body.maxPlacements), 1), 5) }),
            },
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error("Error updating tournament:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
