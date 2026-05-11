import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/**
 * POST /api/tournaments/[id]/post-declare
 * 
 * Handles deferred post-declaration processing:
 * - Merit reset for solo-restricted players
 * - Referral commission processing
 * 
 * Designed to be called separately from declare-winners to keep
 * the main declaration flow fast.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { id } = await params;

        const tournament = await prisma.tournament.findUnique({
            where: { id },
            select: { id: true, name: true, isWinnerDeclared: true },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        if (!tournament.isWinnerDeclared) {
            return NextResponse.json({ error: "Winners not declared yet" }, { status: 400 });
        }

        // Load dynamic settings
        const settings = await getSettings();
        const REFERRAL_COMMISSION = settings.referralReward;
        const REFERRAL_TOURNAMENTS_REQUIRED = settings.referralTournamentsReq;

        // Get all participant player IDs via TeamPlayerStats (works for migrated data)
        const matchIds = (await prisma.match.findMany({
            where: { tournamentId: id },
            select: { id: true },
        })).map(m => m.id);

        const allPlayerStats = await prisma.teamPlayerStats.findMany({
            where: { matchId: { in: matchIds }, present: true },
            select: { playerId: true },
            distinct: ["playerId"],
        });
        const allParticipantIds = allPlayerStats.map(s => s.playerId);

        if (allParticipantIds.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No participants found",
                data: { meritUpdated: 0, referralsProcessed: 0 },
            });
        }

        // Fetch solo-restricted players and referrals in parallel
        const [soloRestricted, referrals] = await Promise.all([
            prisma.player.findMany({
                where: { id: { in: allParticipantIds }, isSoloRestricted: true },
                select: { id: true, soloMatchesNeeded: true },
            }),
            prisma.referral.findMany({
                where: { referredPlayerId: { in: allParticipantIds }, status: { not: "PAID" } },
                include: { promoter: { select: { id: true } } },
            }),
        ]);

        // Merit ops
        const meritOps = soloRestricted.map((p) => {
            const remaining = (p.soloMatchesNeeded || 1) - 1;
            if (remaining <= 0) {
                return prisma.player.update({
                    where: { id: p.id },
                    data: { meritScore: 100, isSoloRestricted: false, soloMatchesNeeded: 0 },
                });
            }
            return prisma.player.update({
                where: { id: p.id },
                data: { soloMatchesNeeded: remaining },
            });
        });

        // Referral ops
        const referralOps: Promise<unknown>[] = [];
        let referralsProcessed = 0;
        for (const ref of referrals) {
            const newCount = ref.tournamentsCompleted + 1;
            if (newCount >= REFERRAL_TOURNAMENTS_REQUIRED) {
                // Qualify and pay
                referralOps.push(prisma.referral.update({
                    where: { id: ref.id },
                    data: { tournamentsCompleted: newCount, status: "PAID", amountPaid: REFERRAL_COMMISSION, qualifiedAt: new Date(), paidAt: new Date() },
                }));
                referralOps.push(prisma.user.update({
                    where: { id: ref.promoterId },
                    data: { promoterEarnings: { increment: REFERRAL_COMMISSION } },
                }));
                // Create pending referral reward for promoter
                const promoterPlayer = await prisma.player.findFirst({
                    where: { userId: ref.promoterId },
                    select: { id: true },
                });
                if (promoterPlayer) {
                    referralOps.push(prisma.pendingReward.create({
                        data: {
                            playerId: promoterPlayer.id,
                            type: "REFERRAL",
                            amount: REFERRAL_COMMISSION,
                            message: `Referral bonus: player completed ${REFERRAL_TOURNAMENTS_REQUIRED} tournaments`,
                        },
                    }));
                }
                referralsProcessed++;
            } else {
                referralOps.push(prisma.referral.update({
                    where: { id: ref.id },
                    data: { tournamentsCompleted: newCount },
                }));
            }
        }

        // Run all ops in parallel
        await Promise.all([...meritOps, ...referralOps]);

        return NextResponse.json({
            success: true,
            message: "Post-declaration processing complete",
            data: {
                meritUpdated: soloRestricted.length,
                referralsProcessed,
                referralsIncremented: referrals.length - referralsProcessed,
            },
        });
    } catch (error) {
        console.error("Error in post-declare:", error);
        return NextResponse.json({ error: "Failed to process" }, { status: 500 });
    }
}
