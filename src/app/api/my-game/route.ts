import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";

// BGMI placement points
const PLACEMENT_PTS: Record<number, number> = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1,
};

/**
 * GET /api/my-game
 * Returns everything a tournament player needs:
 * - Tournament info
 * - My team/slot
 * - Room info (live)
 * - Standings (latest match)
 * - Championship group (if applicable)
 *
 * Player-facing — no admin required.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user?.player?.id) {
            return NextResponse.json({ active: false });
        }

        const playerId = user.player.id;

        // Find active tournament where player is on a team
        const team = await prisma.team.findFirst({
            where: {
                players: { some: { id: playerId } },
                tournament: { status: "ACTIVE" },
            },
            select: {
                id: true,
                name: true,
                teamNumber: true,
                clanId: true,
                players: {
                    select: {
                        id: true,
                        displayName: true,
                        user: { select: { username: true, imageUrl: true } },
                    },
                },
                tournament: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        type: true,
                        whatsappInviteLink: true,
                        whatsappChannelInvites: true,
                        highlightedRules: true,
                        season: { select: { name: true } },
                    },
                },
            },
        });

        if (!team || !team.tournament) {
            return NextResponse.json({ active: false });
        }

        const tournament = team.tournament;

        // Check championship group
        let group: string | null = null;
        const championshipEntry = await prisma.championshipEntry.findFirst({
            where: { tournamentId: tournament.id, teamId: team.id },
            select: { group: true },
        });
        if (championshipEntry?.group) {
            group = championshipEntry.group;
        }

        // Get all championship groups (for group switcher)
        let availableGroups: string[] = [];
        if (group) {
            const entries = await prisma.championshipEntry.findMany({
                where: { tournamentId: tournament.id },
                select: { group: true },
                distinct: ["group"],
            });
            availableGroups = entries.map(e => e.group).filter(Boolean) as string[];
        }

        // Resolve WhatsApp invite link
        let whatsappInviteLink: string | null = null;
        if (group && tournament.whatsappChannelInvites) {
            const channelInvites = tournament.whatsappChannelInvites as Record<string, string>;
            whatsappInviteLink = channelInvites[group] || null;
        } else {
            whatsappInviteLink = tournament.whatsappInviteLink || null;
        }

        // Get room info
        const roomSetting = await prisma.appSetting.findUnique({
            where: { key: "active-room-info" },
        });
        let roomInfo = null;
        if (roomSetting) {
            const data = JSON.parse(roomSetting.value);
            // Only show if room is for this tournament and not expired (4 hours)
            const updatedAt = new Date(data.updatedAt).getTime();
            if (data.tournamentId === tournament.id && Date.now() - updatedAt < 4 * 60 * 60 * 1000) {
                roomInfo = {
                    roomId: data.roomId,
                    password: data.password,
                    map: data.map,
                    matchNumber: data.matchNumber,
                    time: data.time,
                    updatedAt: data.updatedAt,
                };
            }
        }

        // Get standings — latest match only
        const standings = await getStandings(tournament.id, playerId, group);

        return NextResponse.json({
            active: true,
            tournament: {
                id: tournament.id,
                name: tournament.name,
                type: tournament.type,
                seasonName: tournament.season?.name,
            },
            myTeam: {
                id: team.id,
                name: team.name,
                teamNumber: team.teamNumber,
                players: team.players.map(p => ({
                    id: p.id,
                    displayName: p.displayName || p.user?.username || "Unknown",
                    imageUrl: p.user?.imageUrl,
                    isMe: p.id === playerId,
                })),
            },
            group,
            availableGroups,
            whatsappInviteLink,
            highlightedRules: tournament.highlightedRules || [],
            roomInfo,
            standings,
        });
    } catch (error) {
        console.error("[my-game] Error:", error);
        return NextResponse.json({ active: false, error: "Failed to load" });
    }
}

/**
 * Get standings for the tournament.
 * Shows cumulative standings across all matches (not just latest).
 * For championship: filter by group.
 */
async function getStandings(tournamentId: string, myPlayerId: string, group: string | null) {
    // Determine phase filter for championship
    let phaseFilter: object = {};
    if (group) {
        phaseFilter = { match: { phase: `HEATS_${group}` } };
    }

    const teamStats = await prisma.teamStats.findMany({
        where: { tournamentId, ...phaseFilter },
        include: {
            match: { select: { matchNumber: true, phase: true } },
            team: {
                select: {
                    id: true,
                    name: true,
                    teamNumber: true,
                    disqualified: true,
                    players: {
                        select: {
                            id: true,
                            displayName: true,
                            user: { select: { username: true } },
                        },
                    },
                },
            },
            teamPlayerStats: {
                select: {
                    playerId: true,
                    kills: true,
                    present: true,
                },
            },
        },
        orderBy: { match: { matchNumber: "asc" } },
    });

    // Aggregate by team
    const teamMap = new Map<string, {
        teamId: string;
        teamName: string;
        teamNumber: number;
        totalKills: number;
        placementPts: number;
        totalPoints: number;
        wins: number;
        isMyTeam: boolean;
        isDisqualified: boolean;
        playerNames: string[];
    }>();

    for (const stat of teamStats) {
        const kills = stat.teamPlayerStats.reduce((sum, ps) => sum + (ps.present !== false ? ps.kills : 0), 0);
        const pts = PLACEMENT_PTS[stat.position] ?? 0;

        const existing = teamMap.get(stat.teamId);
        if (existing) {
            existing.totalKills += kills;
            existing.placementPts += pts;
            existing.totalPoints += kills + pts;
            if (stat.position === 1) existing.wins++;
        } else {
            const isMyTeam = stat.team.players.some(p => p.id === myPlayerId);
            const playerNames = stat.team.players.map(p => p.displayName || p.user?.username || "Unknown");

            teamMap.set(stat.teamId, {
                teamId: stat.teamId,
                teamName: stat.team.name,
                teamNumber: stat.team.teamNumber,
                totalKills: kills,
                placementPts: pts,
                totalPoints: kills + pts,
                wins: stat.position === 1 ? 1 : 0,
                isMyTeam,
                isDisqualified: stat.team.disqualified,
                playerNames,
            });
        }
    }

    // Sort by total points (same tiebreaker as rankings)
    return Array.from(teamMap.values())
        .filter(t => !t.isDisqualified)
        .sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.placementPts !== a.placementPts) return b.placementPts - a.placementPts;
            return b.totalKills - a.totalKills;
        })
        .map((t, i) => ({ ...t, rank: i + 1 }));
}
