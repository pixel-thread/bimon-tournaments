import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { getAvailableBalance, debitWallet } from "@/lib/wallet-service";

/**
 * POST /api/tournaments/[id]/donations/self
 * Player self-donation to a tournament's prize pool.
 * Body: { amount: number, isAnonymous?: boolean }
 * Always deducts from wallet. If anonymous, name isn't shown.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user?.player?.id || !user.email) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { id: tournamentId } = await params;
        const body = await req.json();
        const { amount, isAnonymous = false } = body as { amount: number; isAnonymous?: boolean };

        if (!amount || amount <= 0 || !Number.isInteger(amount)) {
            return NextResponse.json({ error: "Amount must be a positive integer" }, { status: 400 });
        }

        // Verify tournament exists and has an active poll
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { id: true, name: true, status: true, poll: { select: { isActive: true } } },
        });
        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }
        if (!tournament.poll?.isActive) {
            return NextResponse.json({ error: "Tournament voting is closed" }, { status: 400 });
        }

        // @bimon (org account) can donate without balance — tracked as org expense
        const BIMON_EMAIL = "bimonlangnongsiej@gmail.com";
        const isBimon = user.email === BIMON_EMAIL;

        if (!isBimon) {
            // Check wallet balance (skip for @bimon)
            const { available, reserved } = await getAvailableBalance(user.email);
            if (available < amount) {
                const reservedNote = reserved > 0 ? ` (${reserved} ${GAME.currency} reserved for tournaments)` : "";
                return NextResponse.json(
                    { error: `Insufficient balance. You have ${available} ${GAME.currency} available${reservedNote}.` },
                    { status: 400 }
                );
            }
        }

        const playerName = user.player.displayName || user.username;

        // Debit wallet (skip for @bimon — org-funded donation)
        if (!isBimon) {
            await debitWallet(user.email, amount, `Prize pool donation — ${tournament.name}`, "OTHER");
        }

        // Record the donation
        await prisma.prizePoolDonation.create({
            data: {
                amount,
                tournamentId,
                playerId: user.player.id,
                playerName: isAnonymous ? null : playerName,
                isAnonymous,
            },
        });

        return NextResponse.json({
            success: true,
            message: `Donated ${amount} ${GAME.currency} to ${tournament.name}!`,
        });
    } catch (error) {
        console.error("Self-donation error:", error);
        return NextResponse.json({ error: "Failed to donate" }, { status: 500 });
    }
}
