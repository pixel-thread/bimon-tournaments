import { NextRequest } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { sendPushToTournament } from "@/lib/send-push";

const ACTIVE_ROOM_KEY = "active-room-info";

export interface ActiveRoomInfo {
    roomId: string;
    password: string;
    map: string;
    matchNumber: number;
    tournamentId: string;
    tournamentName: string;
    time: string;
    updatedAt: string; // ISO string
}

/**
 * GET /api/room-info/active
 * Returns the current active room info (public — any signed-in user).
 */
export async function GET() {
    try {
        const setting = await prisma.appSetting.findUnique({
            where: { key: ACTIVE_ROOM_KEY },
        });

        if (!setting) {
            return SuccessResponse({
                message: "No active room",
                data: null,
                cache: CACHE.SHORT,
            });
        }

        const data = JSON.parse(setting.value) as ActiveRoomInfo;

        // Auto-expire after 4 hours
        const updatedAt = new Date(data.updatedAt).getTime();
        if (Date.now() - updatedAt > 4 * 60 * 60 * 1000) {
            // Expired — clean up
            await prisma.appSetting.delete({ where: { key: ACTIVE_ROOM_KEY } }).catch(() => {});
            return SuccessResponse({
                message: "No active room",
                data: null,
                cache: CACHE.SHORT,
            });
        }

        return SuccessResponse({
            message: "Active room info",
            data,
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to get room info", error });
    }
}

/**
 * POST /api/room-info/active
 * Sets the active room info + posts to tournament channel + push notification.
 * Admin/UC-exempt only.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
        const isUCExempt = user?.player
            ? (await prisma.player.findUnique({ where: { id: user.player.id }, select: { isUCExempt: true } }))?.isUCExempt
            : false;

        if (!user || (!isAdmin && !isUCExempt)) {
            return ErrorResponse({ message: "Unauthorized", status: 403 });
        }

        const body = await req.json();
        const { roomId, password, map, matchNumber, tournamentId, tournamentName, time } = body;

        if (!roomId || !password || !map || !matchNumber || !tournamentId) {
            return ErrorResponse({ message: "Missing required fields", status: 400 });
        }

        const roomInfo: ActiveRoomInfo = {
            roomId,
            password,
            map,
            matchNumber,
            tournamentId,
            tournamentName: tournamentName || "Tournament",
            time: time || "Now",
            updatedAt: new Date().toISOString(),
        };

        // Save to DB
        await prisma.appSetting.upsert({
            where: { key: ACTIVE_ROOM_KEY },
            create: { key: ACTIVE_ROOM_KEY, value: JSON.stringify(roomInfo) },
            update: { value: JSON.stringify(roomInfo) },
        });

        // Auto-post to tournament channel as room-info card
        await prisma.announcement.create({
            data: {
                type: "room-info",
                channel: tournamentId,
                content: `Match ${matchNumber} — ${map}\nRoom ID: ${roomId}\nPassword: ${password}\nMap: ${map}`,
                pinned: true,
                authorId: user.player!.id,
            },
        }).catch((err) => console.error("[RoomInfo] Channel post failed:", err));

        // Push to confirmed players in this tournament — MUST await on Vercel
        try {
            const result = await sendPushToTournament(tournamentId, {
                title: `🔐 Match ${matchNumber} — ${map}`,
                body: `Room ID: ${roomId}\nPassword: ${password}\n\nJoin now! Lobby closing soon.`,
                tag: "live-room-info",
                url: `/channel?tab=${tournamentId}`,
                requireInteraction: true,
            });
            console.log(`[RoomInfo] Push: ${result.sent} sent, ${result.failed} failed for ${tournamentId}`);
        } catch (err) {
            console.error("[RoomInfo] Push error:", err);
        }

        return SuccessResponse({
            message: "Room info published",
            data: roomInfo,
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to publish room info", error });
    }
}

/**
 * DELETE /api/room-info/active
 * Clears the active room info banner.
 * Admin only.
 */
export async function DELETE() {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return ErrorResponse({ message: "Admin only", status: 403 });
        }

        await prisma.appSetting.delete({ where: { key: ACTIVE_ROOM_KEY } }).catch(() => {});

        return SuccessResponse({
            message: "Room info cleared",
            data: null,
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to clear room info", error });
    }
}
