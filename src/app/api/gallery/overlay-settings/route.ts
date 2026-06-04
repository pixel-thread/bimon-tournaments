import { NextResponse } from "next/server";
import { getAuthEmail } from "@/lib/auth";
import { prisma } from "@/lib/database";

const OVERLAY_KEY = "standings_overlay_opacity";
const CARD_TINT_KEY = "standings_card_tint";
const CARD_BLUR_KEY = "standings_blur_card";
const ROW_TINT_KEY = "standings_row_tint";

const ALL_KEYS = [OVERLAY_KEY, CARD_TINT_KEY, CARD_BLUR_KEY, ROW_TINT_KEY];

/**
 * GET /api/gallery/overlay-settings
 * Returns saved standings visual settings.
 *  - overlayOpacity: darkness of the background gradient (0-100)
 *  - cardTint: darkness of the card surface on top of blur (0-100)
 *  - cardBlur: backdrop-blur px on the card (0-40)
 */
export async function GET() {
    try {
        const settings = await prisma.appSetting.findMany({
            where: { key: { in: ALL_KEYS } },
        });

        const map: Record<string, number> = {};
        for (const s of settings) {
            map[s.key] = parseInt(s.value, 10);
        }

        return NextResponse.json({
            success: true,
            data: {
                overlayOpacity: map[OVERLAY_KEY] ?? 50,
                cardTint: map[CARD_TINT_KEY] ?? 40,
                cardBlur: map[CARD_BLUR_KEY] ?? 12,
                rowTint: map[ROW_TINT_KEY] ?? 5,
            },
        });
    } catch (error) {
        console.error("Failed to fetch overlay settings:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

/**
 * POST /api/gallery/overlay-settings
 * Save overlay settings.
 * Body: { overlayOpacity?, cardTint?, cardBlur? }
 */
export async function POST(req: Request) {
    const email = await getAuthEmail();
    if (!email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        const pairs: [string, number | undefined][] = [
            [OVERLAY_KEY, body.overlayOpacity],
            [CARD_TINT_KEY, body.cardTint],
            [CARD_BLUR_KEY, body.cardBlur],
            [ROW_TINT_KEY, body.rowTint],
        ];

        for (const [key, val] of pairs) {
            if (val != null) {
                await prisma.appSetting.upsert({
                    where: { key },
                    update: { value: String(Math.round(val)) },
                    create: { key, value: String(Math.round(val)) },
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save overlay settings:", error);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
}
