import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setupTournamentGroup } from "@/lib/whatsapp";
import { prisma } from "@/lib/database";

export const maxDuration = 120;

/**
 * POST /api/whatsapp/test-tournament
 * Creates a WhatsApp group for the active tournament and adds all players.
 * Everything in ONE connection — no 401 errors.
 */
export async function POST() {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    // Find the latest active tournament with its season
    const tournament = await prisma.tournament.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: {
            season: true,
            teams: {
                include: {
                    players: {
                        select: {
                            id: true,
                            displayName: true,
                            phoneNumber: true,
                        },
                    },
                },
            },
        },
    });

    if (!tournament) {
        return NextResponse.json({ error: "No active tournament found" }, { status: 404 });
    }

    const seasonName = tournament.season?.name || "Season";
    const totalPlayers = tournament.teams.reduce((sum, t) => sum + t.players.length, 0);

    // Collect all players with phone numbers (deduplicated)
    const phonesMap = new Map<string, { phone: string; name: string }>();
    for (const team of tournament.teams) {
        for (const player of team.players) {
            if (player.phoneNumber && player.phoneNumber.length >= 10) {
                phonesMap.set(player.id, {
                    phone: player.phoneNumber,
                    name: player.displayName || "Player",
                });
            }
        }
    }
    const phones = Array.from(phonesMap.values());

    // Build group name and description
    const groupName = `🎮 ${tournament.name} | ${seasonName}`;
    const description = [
        `🏆 ${tournament.name}`,
        `📅 ${seasonName}`,
        `👥 ${totalPlayers} Players | ${tournament.teams.length} Teams`,
        ``,
        `Room info, rules & standings will be shared here.`,
        `🔗 bgmi.pixel-thread.in`,
    ].join("\n");

    // Do everything in ONE connection
    const result = await setupTournamentGroup({
        name: groupName,
        description,
        adminPhone: "8837011018",
        players: phones,
    });

    // Save group ID to tournament
    await prisma.tournament.update({
        where: { id: tournament.id },
        data: { whatsappGroupId: result.groupId },
    });

    return NextResponse.json({
        success: true,
        tournament: tournament.name,
        season: seasonName,
        groupId: result.groupId,
        inviteLink: result.inviteLink,
        totalPlayers,
        playersWithPhone: phones.length,
        added: result.added.length,
        failed: result.failed,
    });
}
