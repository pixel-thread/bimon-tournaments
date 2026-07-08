import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * POST /api/whatsapp/send-invite-to-leaders
 * DM each team leader the WhatsApp group invite link.
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
                },
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        // Get invite link
        const channelInvites = (tournament.whatsappChannelInvites as Record<string, string>) || {};
        const inviteLink = group ? channelInvites[group] : tournament.whatsappInviteLink;

        if (!inviteLink) {
            return NextResponse.json({
                error: "No invite link set. Set an invite link first.",
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

        // For championship mode, filter teams by group
        let teamsToProcess = tournament.teams;
        if (group) {
            const entries = await prisma.championshipEntry.findMany({
                where: { tournamentId, group, status: "ACTIVE" },
                select: { teamId: true },
            });
            const groupTeamIds = new Set(entries.map(e => e.teamId));
            teamsToProcess = tournament.teams.filter(t => groupTeamIds.has(t.id));
        }

        // Collect leaders with phone numbers
        const leaders: { phone: string; name: string; teamName: string; teamNumber: number }[] = [];
        const noPhone: string[] = [];
        const seen = new Set<string>();

        for (const team of teamsToProcess) {
            if (team.players.length === 0) continue;
            const leader = team.players.find(p => captainMap.has(p.id)) || team.players[0];
            if (seen.has(leader.id)) continue;
            seen.add(leader.id);

            if (leader.phoneNumber) {
                leaders.push({
                    phone: leader.phoneNumber,
                    name: leader.displayName || "Unknown",
                    teamName: team.name,
                    teamNumber: team.teamNumber,
                });
            } else {
                noPhone.push(`T${team.teamNumber} — ${leader.displayName || "Unknown"}`);
            }
        }

        if (leaders.length === 0) {
            return NextResponse.json({
                error: "No leaders with phone numbers found",
            }, { status: 404 });
        }

        // Send DM to each leader
        const { connectAndExecute } = await import("@/lib/whatsapp");

        const sent: string[] = [];
        const failed: { name: string; phone: string; reason: string }[] = [];

        // Use a single connection for all messages
        await connectAndExecute(async (sock) => {
            for (const leader of leaders) {
                try {
                    // Format phone number to JID
                    const cleanPhone = leader.phone.replace(/[^0-9]/g, "");
                    const phoneWithCountry = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

                    // Verify the number exists on WhatsApp
                    const waResult = await sock.onWhatsApp(phoneWithCountry);
                    const exists = waResult?.[0];
                    if (!exists?.exists) {
                        failed.push({
                            name: leader.name,
                            phone: leader.phone,
                            reason: "Not on WhatsApp",
                        });
                        continue;
                    }

                    // Use the verified JID from WhatsApp
                    const jid = exists.jid;
                    console.log(`[SendInvite] ${leader.name} (T${leader.teamNumber}): ${leader.phone} → ${jid}`);

                    const { getRandomSpiritLine } = await import("@/lib/spirit-lines");
                    const message = [
                        `Hi! 👋 Phi dei u leader jong ka *${leader.teamName}*.`,
                        ``,
                        `Join kane ka WhatsApp group ban ioh Room ID bad kiwei ki jingpyntip:`,
                        inviteLink,
                        ``,
                        `Sngewbha share lang ia kane ka link sha kine ki teammates phi, ba kin ioh lang ia ka Room ID. Khublei! 🙏`,
                        ``,
                        getRandomSpiritLine(),
                    ].join("\n");

                    // Longer delay between messages to avoid spam detection
                    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
                    await sock.sendMessage(jid, { text: message });
                    sent.push(leader.name);
                    console.log(`[SendInvite] ✓ Sent to ${leader.name}`);
                } catch (err) {
                    console.error(`[SendInvite] ✗ ${leader.name}:`, (err as Error).message);
                    failed.push({
                        name: leader.name,
                        phone: leader.phone,
                        reason: (err as Error).message || "Unknown error",
                    });
                }
            }
        });

        return NextResponse.json({
            success: true,
            sent: sent.length,
            failed,
            noPhone,
            total: leaders.length + noPhone.length,
        });
    } catch (error) {
        console.error("[WhatsApp] Send invite to leaders error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to send invites" },
            { status: 500 }
        );
    }
}
