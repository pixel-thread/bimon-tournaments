import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { addMembers } from "@/lib/whatsapp";

/**
 * POST /api/whatsapp/group/add-leaders
 * Add team leaders to an existing WhatsApp group (bot-created or manual).
 *
 * Body: { tournamentId, group? }
 */
export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    try {
        const { tournamentId, group } = await req.json();
        if (!tournamentId) {
            return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
        }

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                name: true,
                whatsappGroupId: true,
                whatsappGroupChannels: true,
                whatsappInviteLink: true,
                whatsappChannelInvites: true,
                poll: {
                    select: {
                        id: true,
                        allowSquads: true,
                    },
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
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        // Find group ID — auto-resolve from invite link if missing
        const channels = (tournament.whatsappGroupChannels as Record<string, string>) || {};
        let groupId = group ? channels[group] : tournament.whatsappGroupId;

        if (!groupId) {
            // Try to resolve from invite link
            const channelInvites = (tournament.whatsappChannelInvites as Record<string, string>) || {};
            const inviteLink = group ? channelInvites[group] : tournament.whatsappInviteLink;

            if (inviteLink) {
                try {
                    const { getGroupIdFromInviteLink } = await import("@/lib/whatsapp");
                    groupId = await getGroupIdFromInviteLink(inviteLink);
                    // Save resolved group ID for future use
                    if (group) {
                        channels[group] = groupId;
                        await prisma.tournament.update({
                            where: { id: tournamentId },
                            data: { whatsappGroupChannels: channels },
                        });
                    } else {
                        await prisma.tournament.update({
                            where: { id: tournamentId },
                            data: { whatsappGroupId: groupId },
                        });
                    }
                    console.log(`[AddLeaders] Auto-resolved group ID: ${groupId}`);
                } catch (err) {
                    console.error("[AddLeaders] Could not resolve group from invite:", err);
                }
            }
        }

        if (!groupId) {
            return NextResponse.json({
                error: "No WhatsApp group found. Create a group or set an invite link first.",
            }, { status: 404 });
        }

        // Build captain map for squad-based tournaments
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

        // Collect ONLY team leaders with phone numbers
        const leaderMap = new Map<string, { phone: string; name: string }>();
        for (const team of tournament.teams) {
            if (team.players.length === 0) continue;
            const leader = team.players.find(p => captainMap.has(p.id)) || team.players[0];
            if (leader.phoneNumber && !leaderMap.has(leader.id)) {
                leaderMap.set(leader.id, {
                    phone: leader.phoneNumber,
                    name: leader.displayName || "Unknown",
                });
            }
        }

        const phones = Array.from(leaderMap.values());
        let addResult = { added: [] as string[], failed: [] as { name: string; phone: string; reason: string }[] };

        if (phones.length > 0) {
            addResult = await addMembers(groupId, phones);
        }

        const noPhone = tournament.teams
            .filter(t => t.players.length > 0)
            .map(t => {
                const leader = t.players.find(p => captainMap.has(p.id)) || t.players[0];
                return { name: leader.displayName || "Unknown", phone: leader.phoneNumber, teamNumber: t.teamNumber };
            })
            .filter(l => !l.phone)
            .map(l => `T${l.teamNumber} — ${l.name}`);

        return NextResponse.json({
            success: true,
            added: addResult.added.length,
            failed: addResult.failed,
            noPhone,
            total: phones.length + noPhone.length,
        });
    } catch (error) {
        console.error("[WhatsApp] Add leaders error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to add leaders" },
            { status: 500 }
        );
    }
}
