import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/whatsapp/set-invite
 * Admin fallback: manually set a WhatsApp invite link for a tournament
 * when the bot fails to create a group automatically.
 * Also resolves the group ID from the invite so the bot can send messages.
 *
 * Body: { tournamentId, inviteLink, group? }
 * - group: optional, for championship per-group links ("A", "B")
 */
export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { tournamentId, inviteLink, group } = await req.json();

    if (!tournamentId || !inviteLink) {
        return NextResponse.json(
            { error: "tournamentId and inviteLink are required" },
            { status: 400 },
        );
    }

    // Validate invite link format
    if (!inviteLink.startsWith("https://chat.whatsapp.com/")) {
        return NextResponse.json(
            { error: "Invalid WhatsApp invite link. Must start with https://chat.whatsapp.com/" },
            { status: 400 },
        );
    }

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, name: true, whatsappChannelInvites: true, whatsappGroupChannels: true },
    });

    if (!tournament) {
        return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Try to resolve the group ID from the invite link so bot can send messages
    let resolvedGroupId: string | null = null;
    try {
        const { getGroupIdFromInviteLink } = await import("@/lib/whatsapp");
        resolvedGroupId = await getGroupIdFromInviteLink(inviteLink);
        console.log(`[SetInvite] Resolved group ID: ${resolvedGroupId} for ${tournament.name}`);
    } catch (err) {
        console.warn(`[SetInvite] Could not resolve group ID from invite link:`, err);
        // Continue — we still save the invite link so players can join manually
    }

    if (group) {
        // Championship: update per-group invite + group ID
        const existingInvites = (tournament.whatsappChannelInvites as Record<string, string>) || {};
        existingInvites[group] = inviteLink;

        const existingChannels = (tournament.whatsappGroupChannels as Record<string, string>) || {};
        if (resolvedGroupId) {
            existingChannels[group] = resolvedGroupId;
        }

        await prisma.tournament.update({
            where: { id: tournamentId },
            data: {
                whatsappChannelInvites: existingInvites,
                whatsappGroupChannels: Object.keys(existingChannels).length > 0 ? existingChannels : undefined,
                whatsappJoinedPlayers: [],
            },
        });

        return NextResponse.json({
            success: true,
            groupIdResolved: !!resolvedGroupId,
            message: resolvedGroupId
                ? `Invite link set + bot connected to Group ${group} ✓`
                : `Invite link saved for Group ${group} (bot could not resolve group — messages won't auto-send)`,
        });
    } else {
        // Single group tournament
        await prisma.tournament.update({
            where: { id: tournamentId },
            data: {
                whatsappInviteLink: inviteLink,
                whatsappGroupId: resolvedGroupId || undefined,
                whatsappJoinedPlayers: [],
            },
        });

        return NextResponse.json({
            success: true,
            groupIdResolved: !!resolvedGroupId,
            message: resolvedGroupId
                ? `Invite link set + bot connected to group ✓`
                : `Invite link saved (bot could not resolve group — messages won't auto-send)`,
        });
    }
}
