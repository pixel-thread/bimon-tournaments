import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { requireAdmin } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { getBalance, debitWallet, creditWallet, getEmailByPlayerId } from "@/lib/wallet-service";

/**
 * GET /api/tournaments/[id]/donations
 * List all prize pool donations for a tournament.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAdmin();
        const { id } = await params;

        const donations = await prisma.prizePoolDonation.findMany({
            where: { tournamentId: id },
            orderBy: { createdAt: "desc" },
        });

        const total = donations.reduce((sum, d) => sum + d.amount, 0);

        return NextResponse.json({
            success: true,
            data: { donations, total },
        });
    } catch (error) {
        console.error("List donations error:", error);
        return NextResponse.json({ error: "Failed to load donations" }, { status: 500 });
    }
}

/**
 * POST /api/tournaments/[id]/donations
 * Add a prize pool donation.
 * Body: { amount, playerId?, isAnonymous }
 * - If playerId is provided (not anonymous), deducts from player's wallet.
 * - If anonymous, just adds to the donation pool (no wallet deduction).
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAdmin();
        const { id: tournamentId } = await params;
        const body = await req.json();
        const { amount, playerId, isAnonymous } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
        }

        // Verify tournament exists
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { id: true, name: true },
        });
        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        let playerName: string | null = null;

        // If a player is selected, deduct from their wallet
        if (playerId && !isAnonymous) {
            const player = await prisma.player.findUnique({
                where: { id: playerId },
                include: {
                    wallet: true,
                    user: { select: { username: true, email: true } },
                },
            });

            if (!player) {
                return NextResponse.json({ error: "Player not found" }, { status: 404 });
            }

            const email = player.user?.email;
            if (!email) {
                return NextResponse.json({ error: "Player email not found" }, { status: 400 });
            }

            const centralBalance = await getBalance(email);
            if (centralBalance < amount) {
                return NextResponse.json(
                    { error: `Insufficient balance. Player has ${centralBalance} ${GAME.currency}.` },
                    { status: 400 }
                );
            }

            playerName = player.displayName || player.user.username;

            // Debit central wallet (handles routing for Free Fire automatically)
            await debitWallet(email, amount, `Prize pool donation — ${tournament.name}`, "OTHER");

            // Record the donation
            await prisma.prizePoolDonation.create({
                data: {
                    amount,
                    tournamentId,
                    playerId,
                    playerName,
                    isAnonymous: false,
                },
            });
        } else {
            // Anonymous donation — no wallet deduction, but record admin's playerId for expense tracking
            const admin = await requireAdmin();
            const adminPlayerId = admin.player?.id ?? null;

            await prisma.prizePoolDonation.create({
                data: {
                    amount,
                    tournamentId,
                    playerId: adminPlayerId, // Link to admin for income tracking
                    playerName: null,        // Name hidden from players
                    isAnonymous: true,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: isAnonymous
                ? `Added ${amount} ${GAME.currency} anonymous donation`
                : `Added ${amount} ${GAME.currency} donation from ${playerName}`,
        });
    } catch (error) {
        console.error("Add donation error:", error);
        return NextResponse.json({ error: "Failed to add donation" }, { status: 500 });
    }
}

/**
 * DELETE /api/tournaments/[id]/donations
 * Remove a specific donation. Body: { donationId }
 * If donation was from a player, refunds their wallet.
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAdmin();
        await params; // consume params
        const body = await req.json();
        const { donationId } = body;

        const donation = await prisma.prizePoolDonation.findUnique({
            where: { id: donationId },
        });
        if (!donation) {
            return NextResponse.json({ error: "Donation not found" }, { status: 404 });
        }

        // If it was a player donation, refund their wallet
        if (donation.playerId && !donation.isAnonymous) {
            const email = await getEmailByPlayerId(donation.playerId);
            if (email) {
                await creditWallet(email, donation.amount, `Prize pool donation refund`, "OTHER");
            }
        }

        await prisma.prizePoolDonation.delete({
            where: { id: donationId },
        });

        return NextResponse.json({
            success: true,
            message: "Donation removed" + (donation.playerId ? " and refunded" : ""),
        });
    } catch (error) {
        console.error("Delete donation error:", error);
        return NextResponse.json({ error: "Failed to remove donation" }, { status: 500 });
    }
}
