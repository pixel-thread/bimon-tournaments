import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * GET /api/whatsapp/group/leaders?tournamentId=xxx
 * Returns team leaders with phone numbers for manual WhatsApp messaging.
 * For championship tournaments, includes group assignment and per-group invite links.
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
            name: true,
            whatsappInviteLink: true,
            whatsappChannelInvites: true,
            poll: { select: { id: true, allowSquads: true, isChampionship: true } },
            teams: {
                select: {
                    id: true,
                    teamNumber: true,
                    name: true,
                    players: {
                        select: {
                            id: true,
                            displayName: true,
                            phoneNumber: true,
                        },
                        orderBy: { createdAt: "asc" as const },
                    },
                },
                orderBy: { teamNumber: "asc" as const },
            },
        },
    });

    if (!tournament) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isChampionship = tournament.poll?.isChampionship ?? false;

    // Build captain map
    const captainMap = new Map<string, boolean>();
    if (tournament.poll?.id && tournament.poll.allowSquads) {
        const squads = await prisma.squad.findMany({
            where: { pollId: tournament.poll.id, status: "REGISTERED" },
            select: { captainId: true },
        });
        for (const s of squads) captainMap.set(s.captainId, true);
    }

    // Build group map for championship
    const groupMap = new Map<string, string>(); // teamId -> group letter
    if (isChampionship) {
        const entries = await prisma.championshipEntry.findMany({
            where: { tournamentId, status: "ACTIVE" },
            select: { teamId: true, group: true },
        });
        for (const e of entries) {
            if (e.group) groupMap.set(e.teamId, e.group);
        }
    }

    const leaders = tournament.teams
        .filter(t => t.players.length > 0)
        .map(t => {
            const leader = t.players.find(p => captainMap.has(p.id)) || t.players[0];
            const teammates = t.players
                .filter(p => p.id !== leader.id)
                .map(p => p.displayName || "Unknown");
            return {
                teamNumber: t.teamNumber,
                teamName: t.name,
                group: groupMap.get(t.id) || null,
                name: leader.displayName || "Unknown",
                phone: leader.phoneNumber || null,
                teammates,
            };
        });

    // Per-group invite links (championship)
    const channelInvites = (isChampionship && tournament.whatsappChannelInvites)
        ? tournament.whatsappChannelInvites as Record<string, string>
        : {};

    return NextResponse.json({
        tournamentName: tournament.name,
        isChampionship,
        leaders,
        inviteLink: tournament.whatsappInviteLink || null,
        channelInvites,
    });
}
