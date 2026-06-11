import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * GET /api/whatsapp/my-invite
 * Returns the WhatsApp invite link for the current player's active tournament.
 * Used by the mandatory join modal in root layout.
 */
export async function GET() {
    const user = await getCurrentUser();
    if (!user?.player?.id) {
        return NextResponse.json({ needsJoin: false });
    }

    const playerId = user.player.id;

    // Find active tournaments where this player is on a team
    const teams = await prisma.team.findMany({
        where: {
            players: { some: { id: playerId } },
            tournament: {
                status: "ACTIVE",
                OR: [
                    { whatsappInviteLink: { not: null } },
                    { whatsappChannelInvites: { not: Prisma.AnyNull } },
                ],
            },
        },
        select: {
            id: true,
            tournament: {
                select: {
                    id: true,
                    name: true,
                    whatsappInviteLink: true,
                    whatsappChannelInvites: true,
                    whatsappJoinedPlayers: true,
                },
            },
        },
    });

    if (!teams.length) {
        return NextResponse.json({ needsJoin: false });
    }

    // Check each tournament for pending joins
    const pendingJoins: {
        tournamentId: string;
        tournamentName: string;
        inviteLink: string;
        group?: string;
    }[] = [];

    for (const team of teams) {
        const t = team.tournament;
        if (!t) continue;
        const joinedPlayers = (t.whatsappJoinedPlayers as string[]) || [];
        const alreadyJoined = joinedPlayers.includes(playerId);

        if (alreadyJoined) continue;

        // Championship with per-group invites — look up group from ChampionshipEntry
        if (t.whatsappChannelInvites) {
            const entry = await prisma.championshipEntry.findFirst({
                where: { tournamentId: t.id, teamId: team.id },
                select: { group: true },
            });

            if (entry?.group) {
                const channelInvites = t.whatsappChannelInvites as Record<string, string>;
                const inviteLink = channelInvites[entry.group];
                if (inviteLink) {
                    pendingJoins.push({
                        tournamentId: t.id,
                        tournamentName: t.name,
                        inviteLink,
                        group: entry.group,
                    });
                }
            }
        }
        // Single group tournament
        else if (t.whatsappInviteLink) {
            pendingJoins.push({
                tournamentId: t.id,
                tournamentName: t.name,
                inviteLink: t.whatsappInviteLink,
            });
        }
    }

    if (!pendingJoins.length) {
        return NextResponse.json({ needsJoin: false });
    }

    // Return the first pending join (show one at a time)
    return NextResponse.json({
        needsJoin: true,
        ...pendingJoins[0],
    });
}
