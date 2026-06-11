import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * POST /api/whatsapp/confirm-join
 * Player confirms they joined the WhatsApp group.
 * Body: { tournamentId }
 */
export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user?.player?.id) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { tournamentId } = await req.json();
    if (!tournamentId) {
        return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
    }

    // Verify player is in this tournament
    const team = await prisma.team.findFirst({
        where: {
            tournamentId,
            players: { some: { id: user.player!.id } },
        },
    });

    if (!team) {
        return NextResponse.json({ error: "Not in this tournament" }, { status: 403 });
    }

    // Get current joined list
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { whatsappJoinedPlayers: true },
    });

    const joinedPlayers = (tournament?.whatsappJoinedPlayers as string[]) || [];

    // Add player if not already in list
    if (!joinedPlayers.includes(user.player!.id)) {
        joinedPlayers.push(user.player!.id);
        await prisma.tournament.update({
            where: { id: tournamentId },
            data: { whatsappJoinedPlayers: joinedPlayers },
        });
    }

    return NextResponse.json({ success: true });
}
