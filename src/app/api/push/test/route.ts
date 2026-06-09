import { SuccessResponse, ErrorResponse, CACHE } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { sendPush } from "@/lib/push";
import { type NextRequest } from "next/server";
import { z } from "zod";

const testSchema = z.object({
    /** "normal" | "sticky" | "update" */
    mode: z.enum(["normal", "sticky", "update"]).default("sticky"),
    /** Custom room ID to include */
    roomId: z.string().default("ABCD1234"),
    /** Custom password */
    password: z.string().default("9876"),
    /** Custom map name */
    map: z.string().default("Erangel"),
    /** Match number */
    matchNumber: z.number().default(1),
});

/**
 * POST /api/push/test
 * Super admin only — sends a mock room-info notification to yourself.
 * Used to test sticky notification behavior on Android.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Super admin only", status: 403 });
        }

        if (!user.player) {
            return ErrorResponse({
                message: "You need a player profile to test push",
                status: 400,
            });
        }

        const body = await req.json();
        const { mode, roomId, password, map, matchNumber } = testSchema.parse(body);

        const isSticky = mode === "sticky" || mode === "update";

        await sendPush(user.player.id, {
            title: `🔐 Match ${matchNumber} — ${map}`,
            body: `Room ID: ${roomId}\nPassword: ${password}\n\nJoin now! Lobby closing soon.`,
            tag: isSticky ? "live-room-info" : undefined,
            requireInteraction: isSticky,
            renotify: mode === "update",
            url: "/vote",
        });

        return SuccessResponse({
            message: `Test notification sent (mode: ${mode})`,
            data: { mode, roomId, password, map, matchNumber },
            cache: CACHE.NONE,
        });
    } catch (error) {
        return ErrorResponse({
            message: "Failed to send test notification",
            error,
        });
    }
}
