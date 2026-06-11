import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToTournament } from "@/lib/send-push";

/**
 * POST /api/whatsapp/send-room-info
 * V2: Auto-sends room info to WhatsApp group + publishes to DB.
 * Falls back to the same DB publish as V1 so room-info-banner + My Slot still work.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
        const isUCExempt = user?.player
            ? (await prisma.player.findUnique({ where: { id: user.player.id }, select: { isUCExempt: true } }))?.isUCExempt
            : false;

        if (!user || (!isAdmin && !isUCExempt)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { tournamentId, roomId, password, map, matchNumber, time, group } = await req.json();

        if (!tournamentId || !roomId || !password || !map || !matchNumber) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                id: true,
                name: true,
                whatsappGroupId: true,
                whatsappGroupChannels: true,
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        const timeDisplay = time || "Now";

        // 1. Save to DB (same as V1 — powers room-info-banner + My Slot)
        const roomInfo = {
            roomId,
            password,
            map,
            matchNumber,
            tournamentId,
            tournamentName: tournament.name,
            time: timeDisplay,
            updatedAt: new Date().toISOString(),
        };

        await prisma.appSetting.upsert({
            where: { key: "active-room-info" },
            create: { key: "active-room-info", value: JSON.stringify(roomInfo) },
            update: { value: JSON.stringify(roomInfo) },
        });

        // 2. Post to channel (same as V1)
        await prisma.announcement.create({
            data: {
                type: "room-info",
                channel: tournamentId,
                content: `Match ${matchNumber} — ${map}\nRoom ID: ${roomId}\nPassword: ${password}\nMap: ${map}\nTime: ${timeDisplay}`,
                pinned: true,
                authorId: user.player!.id,
            },
        }).catch((err) => console.error("[V2 RoomInfo] Channel post failed:", err));

        // 3. Push notification (same as V1)
        try {
            await sendPushToTournament(tournamentId, {
                title: `🔐 Match ${matchNumber} — ${map}`,
                body: `Room ID: ${roomId}\nPassword: ${password}\n⏰ ${timeDisplay}\n\nJoin now! Lobby closing soon.`,
                tag: "live-room-info",
                url: `/games`,
                requireInteraction: true,
            });
        } catch (err) {
            console.error("[V2 RoomInfo] Push error:", err);
        }

        // 4. Send to WhatsApp group (the V2 primary action)
        let whatsappSent = false;
        try {
            const { sendMessage } = await import("@/lib/whatsapp");

            // Determine which group to send to
            let groupId: string | null = null;
            if (group && tournament.whatsappGroupChannels) {
                const channels = tournament.whatsappGroupChannels as Record<string, string>;
                groupId = channels[group] || null;
            } else {
                groupId = tournament.whatsappGroupId || null;
            }

            if (groupId) {
                const waMessage = [
                    `🔐 *Match ${matchNumber} — ${map}*`,
                    ``,
                    `🆔 Room ID: \`${roomId}\``,
                    `🔑 Password: \`${password}\``,
                    `⏰ Time: ${timeDisplay}`,
                    ``,
                    `Join now! Lobby closing soon. 🏃‍♂️`,
                ].join("\n");

                await sendMessage(groupId, waMessage);
                // Send room ID alone for quick copy
                await sendMessage(groupId, roomId);
                whatsappSent = true;
                console.log(`[V2 RoomInfo] WhatsApp sent for ${tournamentId}${group ? ` (Group ${group})` : ""}`);
            }
        } catch (err) {
            console.error("[V2 RoomInfo] WhatsApp error:", err);
        }

        return NextResponse.json({
            success: true,
            whatsappSent,
            message: whatsappSent
                ? "Room info sent to WhatsApp group"
                : "Room info published (WhatsApp send failed — use copy fallback)",
        });
    } catch (error) {
        console.error("[V2 RoomInfo] Error:", error);
        return NextResponse.json({ error: "Failed to send room info" }, { status: 500 });
    }
}
