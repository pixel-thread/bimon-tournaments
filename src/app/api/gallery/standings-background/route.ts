import { NextResponse } from "next/server";
import { getAuthEmail } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * GET /api/gallery/standings-background
 * Returns the current standings-specific background image (1:1).
 * Falls back to global background if none is set.
 */
export async function GET() {
    try {
        // First try standings-specific background
        const standingsBg = await prisma.gallery.findFirst({
            where: { isStandingsBackground: true, status: "ACTIVE" },
            select: { id: true, publicUrl: true, name: true },
        });
        if (standingsBg) {
            return NextResponse.json({ success: true, data: standingsBg });
        }

        // Fallback to global background
        const globalBg = await prisma.gallery.findFirst({
            where: { isGlobalBackground: true, status: "ACTIVE" },
            select: { id: true, publicUrl: true, name: true },
        });
        return NextResponse.json({ success: true, data: globalBg });
    } catch (error) {
        console.error("Failed to fetch standings background:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

/**
 * POST /api/gallery/standings-background
 * Set a gallery image as the standings background.
 * Body: { galleryId: string }
 */
export async function POST(req: Request) {
    const userId = await getAuthEmail();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { galleryId } = await req.json();

        if (!galleryId) {
            return NextResponse.json({ error: "galleryId is required" }, { status: 400 });
        }

        // Clear any existing standings background
        await prisma.gallery.updateMany({
            where: { isStandingsBackground: true },
            data: { isStandingsBackground: false },
        });

        // Set new one
        const gallery = await prisma.gallery.update({
            where: { id: galleryId },
            data: { isStandingsBackground: true },
            select: { id: true, publicUrl: true, name: true },
        });

        return NextResponse.json({ success: true, data: gallery });
    } catch (error) {
        console.error("Failed to set standings background:", error);
        return NextResponse.json({ error: "Failed to set background" }, { status: 500 });
    }
}

/**
 * DELETE /api/gallery/standings-background
 * Clears the standings background (will fall back to global).
 */
export async function DELETE() {
    const userId = await getAuthEmail();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await prisma.gallery.updateMany({
            where: { isStandingsBackground: true },
            data: { isStandingsBackground: false },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to clear standings background:", error);
        return NextResponse.json({ error: "Failed to clear" }, { status: 500 });
    }
}
