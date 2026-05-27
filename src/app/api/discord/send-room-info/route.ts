import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendRoomInfo } from "@/lib/discord-service";

/**
 * POST /api/discord/send-room-info
 *
 * Sends a rich embed with room info to the #ranked-room-id channel.
 * Admin-only.
 *
 * Body: { tournamentName, matchNumber, map, time, roomId, password, gameName }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { tournamentName, matchNumber, map, time, roomId, password, gameName } = body;

        if (!tournamentName || !matchNumber || !map || !time || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await sendRoomInfo({
            tournamentName,
            matchNumber,
            map,
            time,
            roomId: roomId || "",
            password,
            gameName: gameName || "BGMI",
        });

        return NextResponse.json({ success: true, message: "Room info sent to Discord" });
    } catch (error) {
        console.error("Discord send-room-info error:", error);
        return NextResponse.json({ error: "Failed to send room info to Discord" }, { status: 500 });
    }
}
