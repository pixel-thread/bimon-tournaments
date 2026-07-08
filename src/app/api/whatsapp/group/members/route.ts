import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * GET /api/whatsapp/group/members?tournamentId=xxx
 * Check which tournament leaders have joined the WhatsApp group.
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

    try {
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                whatsappGroupId: true,
                whatsappInviteLink: true,
                poll: {
                    select: { id: true, allowSquads: true },
                },
                teams: {
                    select: {
                        teamNumber: true,
                        players: {
                            select: {
                                id: true,
                                displayName: true,
                                phoneNumber: true,
                            },
                            orderBy: { createdAt: "asc" as const },
                        },
                    },
                },
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        let groupId = tournament.whatsappGroupId;

        // Auto-resolve from invite link if missing
        if (!groupId && tournament.whatsappInviteLink) {
            try {
                const { getGroupIdFromInviteLink } = await import("@/lib/whatsapp");
                groupId = await getGroupIdFromInviteLink(tournament.whatsappInviteLink);
                await prisma.tournament.update({
                    where: { id: tournamentId },
                    data: { whatsappGroupId: groupId },
                });
            } catch {
                return NextResponse.json({ error: "Could not resolve group" }, { status: 500 });
            }
        }

        if (!groupId) {
            return NextResponse.json({ error: "No WhatsApp group set" }, { status: 404 });
        }

        // Get group participants
        const { getGroupParticipants } = await import("@/lib/whatsapp");
        const participants = await getGroupParticipants(groupId);

        // Normalize participants to a set of cleaned phone numbers
        const memberPhones = new Set(
            participants.map(p => p.replace(/^91/, "").replace(/\D/g, ""))
        );

        // Build captain map
        const captainMap = new Map<string, boolean>();
        if (tournament.poll?.id && tournament.poll.allowSquads) {
            const squads = await prisma.squad.findMany({
                where: { pollId: tournament.poll.id, status: "FORMING" },
                select: { captainId: true },
            });
            for (const s of squads) {
                captainMap.set(s.captainId, true);
            }
        }

        // Check each leader
        const joined: { name: string; teamNumber: number }[] = [];
        const notJoined: { name: string; teamNumber: number; phone: string | null }[] = [];

        for (const team of tournament.teams) {
            if (team.players.length === 0) continue;
            const leader = team.players.find(p => captainMap.has(p.id)) || team.players[0];
            const name = leader.displayName || "Unknown";

            if (!leader.phoneNumber) {
                notJoined.push({ name, teamNumber: team.teamNumber, phone: null });
                continue;
            }

            const cleanPhone = leader.phoneNumber.replace(/^(\+?91)/, "").replace(/\D/g, "");
            if (memberPhones.has(cleanPhone)) {
                joined.push({ name, teamNumber: team.teamNumber });
            } else {
                notJoined.push({ name, teamNumber: team.teamNumber, phone: leader.phoneNumber });
            }
        }

        return NextResponse.json({
            totalMembers: participants.length,
            joined,
            notJoined,
        });
    } catch (error) {
        console.error("[WhatsApp] Group members check error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to check members" },
            { status: 500 }
        );
    }
}
