import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendRoomInfo } from "@/lib/discord-service";
import { prisma } from "@/lib/database";

/**
 * POST /api/discord/send-room-info
 *
 * Sends a rich embed with room info to a per-tournament Discord channel.
 * Auto-creates the channel under TOURNAMENTS category on first send.
 * Admin or UC-exempt players.
 *
 * Body: { tournamentId, tournamentName, matchNumber, map, time, roomId, password, gameName }
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

        const body = await req.json();
        const { tournamentId, tournamentName, matchNumber, map, time, roomId, password, gameName, image, group } = body;

        if (!tournamentId || !tournamentName || !matchNumber || !map || !time || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await sendRoomInfo({
            tournamentId,
            tournamentName,
            matchNumber,
            map,
            time,
            roomId: roomId || "",
            password,
            gameName: gameName || "BGMI",
            image: image || undefined,
            group: group || undefined,
        });

        return NextResponse.json({ success: true, message: "Room info sent to Discord" });
    } catch (error) {
        console.error("Discord send-room-info error:", error);
        return NextResponse.json({ error: "Failed to send room info to Discord" }, { status: 500 });
    }
}
