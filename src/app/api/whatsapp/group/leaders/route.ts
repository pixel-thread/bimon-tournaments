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

    // Build championship entry map: teamId -> { group, phase, status }
    const entryMap = new Map<string, { group: string | null; phase: string; status: string }>();
    let currentPhase = "HEATS";
    if (isChampionship) {
        const [entries, champMatches] = await Promise.all([
            prisma.championshipEntry.findMany({
                where: { tournamentId },
                select: { teamId: true, group: true, phase: true, status: true },
            }),
            prisma.match.findMany({
                where: { tournamentId, phase: { not: null } },
                select: { phase: true },
            }),
        ]);
        for (const e of entries) {
            entryMap.set(e.teamId, { group: e.group, phase: e.phase, status: e.status });
        }
        // Determine current phase from matches (same logic as teams page)
        const matchPhases = new Set(champMatches.map(m => m.phase));
        if (matchPhases.has("FINALS")) {
            currentPhase = "FINALS";
        } else if (matchPhases.has("WILDCARD")) {
            currentPhase = "WILDCARD";
        } else {
            currentPhase = "HEATS";
        }
    }

    const leaders = tournament.teams
        .filter(t => {
            if (t.players.length === 0) return false;
            if (isChampionship) {
                const entry = entryMap.get(t.id);
                if (!entry) return false;
                // Always exclude eliminated and standby
                if (entry.status === "ELIMINATED" || entry.status === "STANDBY") return false;
                // Filter by current phase to match teams page
                if (currentPhase === "HEATS") {
                    // During heats: show all ACTIVE teams
                    return entry.status === "ACTIVE";
                } else if (currentPhase === "WILDCARD") {
                    // During wildcard: show wildcard teams + direct qualifiers
                    return entry.status === "WILDCARD" || entry.status === "ACTIVE" || entry.status === "QUALIFIED";
                } else if (currentPhase === "FINALS") {
                    // During finals: show only finalists (ACTIVE in finals phase)
                    return entry.phase === "FINALS" && (entry.status === "ACTIVE" || entry.status === "QUALIFIED");
                }
            }
            return true;
        })
        .map(t => {
            const leader = t.players.find(p => captainMap.has(p.id)) || t.players[0];
            const teammates = t.players
                .filter(p => p.id !== leader.id)
                .map(p => p.displayName || "Unknown");
            const entry = entryMap.get(t.id);
            return {
                teamNumber: t.teamNumber,
                teamName: t.name,
                group: entry?.group || null,
                phase: entry?.phase || null,
                status: entry?.status || null,
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
        currentPhase: isChampionship ? currentPhase : null,
        leaders,
        inviteLink: tournament.whatsappInviteLink || null,
        channelInvites,
    });
}
