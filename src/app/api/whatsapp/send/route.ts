import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { sendMessage, sendImage } from "@/lib/whatsapp";

/**
 * POST /api/whatsapp/send
 * Send a text or image message to a tournament's WhatsApp group.
 *
 * Body: { tournamentId, message?, image?, caption?, group? }
 * - message: text message to send
 * - image: base64 data URL of image
 * - caption: caption for the image
 * - group: championship group name (e.g. "A"). If omitted, uses main group.
 */
export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    try {
        const { tournamentId, message, image, caption, group } = await req.json();

        if (!tournamentId) {
            return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 });
        }
        if (!message && !image) {
            return NextResponse.json({ error: "Provide message or image" }, { status: 400 });
        }

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
            // No WhatsApp group — silently skip (not all tournaments have WhatsApp)
            return NextResponse.json({ success: true, skipped: true, reason: "No WhatsApp group" });
        }

        if (image) {
            // Send image
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = Buffer.from(base64Data, "base64");
            await sendImage(groupId, imageBuffer, caption || message || undefined);
        } else if (message) {
            // Send text
            await sendMessage(groupId, message);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[WhatsApp Send] Error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to send" },
            { status: 500 }
        );
    }
}
