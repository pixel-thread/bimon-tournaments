import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * GET /api/whatsapp/group/leaders?tournamentId=xxx
 * Returns team leaders with phone numbers for manual WhatsApp messaging.
 * Works in two modes:
 *   1. Post-generation: reads from tournament.teams (existing flow)
 *   2. Pre-generation:  reads directly from squads when no teams exist yet
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
    const hasTeams = tournament.teams.length > 0;

    // ═══════════════════════════════════════════════════════════════
    // PRE-GENERATION: no teams yet — build leaders from squads
    // ═══════════════════════════════════════════════════════════════
    if (!hasTeams && tournament.poll?.id && tournament.poll.allowSquads) {
        const squads = await prisma.squad.findMany({
            where: {
                pollId: tournament.poll.id,
                status: { in: ["FORMING", "FULL", "REGISTERED"] },
            },
            select: {
                name: true,
                fullName: true,
                confirmedAt: true,
                captain: {
                    select: {
                        id: true,
                        displayName: true,
                        phoneNumber: true,
                    },
                },
                invites: {
                    where: { status: "ACCEPTED" },
                    select: {
                        player: {
                            select: { id: true, displayName: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const leaders = squads.map((sq, idx) => {
            const teammates = sq.invites
                .filter(inv => inv.player.id !== sq.captain.id)
                .map(inv => inv.player.displayName || "Unknown");
            return {
                teamNumber: idx + 1,
                teamName: sq.fullName || sq.name,
                group: null,
                phase: null,
                status: null,
                isConfirmed: !!sq.confirmedAt,
                name: sq.captain.displayName || "Unknown",
                phone: sq.captain.phoneNumber || null,
                teammates,
            };
        });

        return NextResponse.json({
            tournamentName: tournament.name,
            isChampionship,
            currentPhase: null,
            leaders,
            inviteLink: tournament.whatsappInviteLink || null,
            channelInvites: {},
            preGeneration: true,
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // POST-GENERATION: teams exist — existing flow
    // ═══════════════════════════════════════════════════════════════

    // Build captain map + squad full name map
    const captainMap = new Map<string, boolean>();
    const captainFullNameMap = new Map<string, string>(); // captainId → fullName || name
    if (tournament.poll?.id && tournament.poll.allowSquads) {
        const squads = await prisma.squad.findMany({
            where: { pollId: tournament.poll.id, status: "REGISTERED" },
            select: { captainId: true, name: true, fullName: true },
        });
        for (const s of squads) {
            captainMap.set(s.captainId, true);
            captainFullNameMap.set(s.captainId, s.fullName || s.name);
        }
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
                if (entry.status === "ELIMINATED" || entry.status === "STANDBY") return false;
                if (currentPhase === "HEATS") {
                    return entry.status === "ACTIVE";
                } else if (currentPhase === "WILDCARD") {
                    return entry.status === "WILDCARD" || entry.status === "ACTIVE" || entry.status === "QUALIFIED";
                } else if (currentPhase === "FINALS") {
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
            // Use squad fullName (longer name) for WhatsApp messages, fall back to team.name
            const squadFullName = captainFullNameMap.get(leader.id);
            return {
                teamNumber: t.teamNumber,
                teamName: squadFullName || t.name,
                group: entry?.group || null,
                phase: entry?.phase || null,
                status: entry?.status || null,
                isConfirmed: true,
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
