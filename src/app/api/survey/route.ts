import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { NextRequest } from "next/server";

const VALID_MAPS = ["Erangel", "Miramar", "Rondo", "Sanhok", "Vikendi", "Livik", "Karakin", "Nusa"];
const VALID_DEVICES = ["iPhone", "iPad", "Android Phone", "Android Tablet", "PC / Emulator"];

/**
 * GET /api/survey
 * Returns the current player's survey response (if any).
 */
export async function GET() {
    try {
        const userId = await getAuthEmail();
        if (!userId) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { player: { select: { id: true, survey: true } } },
        });

        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        return SuccessResponse({ data: user.player.survey ?? null });
    } catch (error) {
        return ErrorResponse({ message: "Failed to fetch survey", error });
    }
}

/**
 * POST /api/survey
 * Submit or update the player's survey response.
 * Body: { maps: string[2], timing: string, device: string }
 */
export async function POST(req: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const body = await req.json();
        const { maps, timing, device } = body;

        // Validate maps — exactly 2, from valid list
        if (!Array.isArray(maps) || maps.length !== 2) {
            return ErrorResponse({ message: "Please select exactly 2 maps", status: 400 });
        }
        if (!maps.every((m: string) => VALID_MAPS.includes(m))) {
            return ErrorResponse({ message: "Invalid map selection", status: 400 });
        }
        if (maps[0] === maps[1]) {
            return ErrorResponse({ message: "Please select 2 different maps", status: 400 });
        }

        // Validate timing
        if (!timing || typeof timing !== "string" || timing.trim().length === 0) {
            return ErrorResponse({ message: "Please select a preferred timing", status: 400 });
        }

        // Validate device
        if (!device || !VALID_DEVICES.includes(device)) {
            return ErrorResponse({ message: "Please select your device", status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { player: { select: { id: true } } },
        });

        if (!user?.player) return ErrorResponse({ message: "Player not found", status: 404 });

        // Upsert — one response per player
        const survey = await prisma.playerSurvey.upsert({
            where: { playerId: user.player.id },
            create: {
                playerId: user.player.id,
                maps,
                timing: timing.trim(),
                device,
            },
            update: {
                maps,
                timing: timing.trim(),
                device,
            },
        });

        return SuccessResponse({ data: survey, message: "Survey submitted!" });
    } catch (error) {
        return ErrorResponse({ message: "Failed to submit survey", error });
    }
}
