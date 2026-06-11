import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * GET /api/whatsapp/group/status?tournamentId=xxx
 * Admin-only: Check if a tournament has a WhatsApp group set up.
 */
export async function GET(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const tournamentId = req.nextUrl.searchParams.get("tournamentId");
    if (!tournamentId) {
        return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
    }

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
            whatsappGroupId: true,
            whatsappInviteLink: true,
            whatsappGroupChannels: true,
            whatsappChannelInvites: true,
        },
    });

    if (!tournament) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const hasGroup = !!(tournament.whatsappGroupId || 
        tournament.whatsappInviteLink ||
        (tournament.whatsappGroupChannels && Object.keys(tournament.whatsappGroupChannels as object).length > 0) ||
        (tournament.whatsappChannelInvites && Object.keys(tournament.whatsappChannelInvites as object).length > 0));
    
    return NextResponse.json({
        hasGroup,
        inviteLink: tournament.whatsappInviteLink || null,
        groupId: tournament.whatsappGroupId || null,
    });
}
