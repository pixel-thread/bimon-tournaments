import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { ALL_TOURNAMENT_TYPES } from "@/lib/bracket-types";
import { getAvailableBalance } from "@/lib/wallet-service";

/**
 * PUT /api/tournaments/[id]
 * Update tournament details (admin only).
 * When entry fee is lowered, re-evaluates unconfirmed squads.
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

        const oldFee = tournament.fee ?? 0;
        const newFee = body.fee !== undefined ? (body.fee !== null ? Number(body.fee) : 0) : oldFee;

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
                ...(body.isMangoScrim !== undefined && { isMangoScrim: !!body.isMangoScrim }),
            },
        });

        // ── Re-evaluate unconfirmed squads when fee is lowered ──
        let confirmedCount = 0;
        if (body.fee !== undefined && newFee < oldFee) {
            const unconfirmedSquads = await prisma.squad.findMany({
                where: {
                    confirmedAt: null,
                    status: "FORMING",
                    poll: { tournamentId: id },
                },
                select: {
                    id: true,
                    captainId: true,
                    captain: {
                        select: {
                            isTrusted: true,
                            user: { select: { email: true, secondaryEmail: true } },
                        },
                    },
                },
            });

            for (const squad of unconfirmedSquads) {
                let canConfirm = false;

                if (newFee <= 0) {
                    canConfirm = true;
                } else if (squad.captain?.isTrusted) {
                    canConfirm = true;
                } else {
                    const email = squad.captain?.user?.email || squad.captain?.user?.secondaryEmail;
                    if (email) {
                        try {
                            const { balance } = await getAvailableBalance(email);
                            canConfirm = balance >= newFee;
                        } catch {
                            // Skip on error
                        }
                    }
                }

                if (canConfirm) {
                    await prisma.squad.update({
                        where: { id: squad.id },
                        data: { confirmedAt: new Date(), entryFee: newFee },
                    });
                    confirmedCount++;
                }
            }

            // Update entryFee snapshot on already-confirmed squads too
            await prisma.squad.updateMany({
                where: {
                    confirmedAt: { not: null },
                    status: "FORMING",
                    poll: { tournamentId: id },
                },
                data: { entryFee: newFee },
            });
        } else if (body.fee !== undefined && newFee !== oldFee) {
            // Fee increased — update entryFee snapshot on all active squads
            await prisma.squad.updateMany({
                where: {
                    status: "FORMING",
                    poll: { tournamentId: id },
                },
                data: { entryFee: newFee },
            });
        }

        return NextResponse.json({
            success: true,
            data: updated,
            ...(confirmedCount > 0 && { confirmedSquads: confirmedCount }),
        });
    } catch (error) {
        console.error("Error updating tournament:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
