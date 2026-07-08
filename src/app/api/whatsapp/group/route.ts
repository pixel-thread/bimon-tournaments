import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { createGroup, addMembers, deleteGroup } from "@/lib/whatsapp";

/**
 * POST /api/whatsapp/group
 * Create a WhatsApp group for a tournament and add team leaders only.
 *
 * Body: { tournamentId, group? }
 * - group: championship group name (e.g. "A", "B"). If omitted, creates main group.
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

        // Build group name
        const groupName = group
            ? `BT — ${tournament.name} · Group ${group}`
            : `BT — ${tournament.name}`;

        // Check if group already exists
        const existingChannels = (tournament.whatsappGroupChannels as Record<string, string>) || {};
        const existingGroupId = group ? existingChannels[group] : tournament.whatsappGroupId;

        if (existingGroupId) {
            return NextResponse.json({
                error: `WhatsApp group already exists for ${group ? `Group ${group}` : "this tournament"}`,
            }, { status: 409 });
        }

        // Admin phone from env
        const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;

        // Create WhatsApp group
        const groupId = await createGroup(groupName, { adminPhone });

        // Store group ID
        if (group) {
            existingChannels[group] = groupId;
            await prisma.tournament.update({
                where: { id: tournamentId },
                data: { whatsappGroupChannels: existingChannels },
            });
        } else {
            await prisma.tournament.update({
                where: { id: tournamentId },
                data: { whatsappGroupId: groupId },
            });
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

        // Collect ONLY team leaders (captain or first player) with phone numbers
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

        // Add leaders to group
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
            groupId,
            groupName,
            added: addResult.added.length,
            failed: addResult.failed,
            noPhone,
            total: phones.length + noPhone.length,
            note: "Only team leaders were added. They share room IDs with their team.",
        });
    } catch (error) {
        console.error("[WhatsApp Group] Create error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to create group" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/whatsapp/group
 * Delete a WhatsApp group for a tournament (remove all members + leave).
 *
 * Body: { tournamentId, group? }
 */
export async function DELETE(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    try {
        const { tournamentId, group } = await req.json();

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { whatsappGroupId: true, whatsappGroupChannels: true },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        const channels = (tournament.whatsappGroupChannels as Record<string, string>) || {};
        const groupId = group ? channels[group] : tournament.whatsappGroupId;

        if (!groupId) {
            return NextResponse.json({ error: "No WhatsApp group found" }, { status: 404 });
        }

        // Delete the group
        await deleteGroup(groupId);

        // Clear from DB
        if (group) {
            delete channels[group];
            await prisma.tournament.update({
                where: { id: tournamentId },
                data: { whatsappGroupChannels: Object.keys(channels).length > 0 ? channels : undefined },
            });
        } else {
            await prisma.tournament.update({
                where: { id: tournamentId },
                data: { whatsappGroupId: null },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[WhatsApp Group] Delete error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to delete group" },
            { status: 500 }
        );
    }
}
