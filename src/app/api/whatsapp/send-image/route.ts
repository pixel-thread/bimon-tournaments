import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";

/**
 * POST /api/whatsapp/send-image
 * Send a base64 image to a tournament's WhatsApp group.
 *
 * Body: { image: string (base64 data URL), tournamentId, caption?, group? }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { image, tournamentId, caption, group } = await req.json();

        if (!image || !tournamentId) {
            return NextResponse.json({ error: "Missing image or tournamentId" }, { status: 400 });
        }

        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                name: true,
                whatsappGroupId: true,
                whatsappGroupChannels: true,
                whatsappInviteLink: true,
            },
        });

        if (!tournament) {
            return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
        }

        // Determine group ID
        let groupId: string | null = null;
        if (group && tournament.whatsappGroupChannels) {
            const channels = tournament.whatsappGroupChannels as Record<string, string>;
            groupId = channels[group] || null;
        } else {
            groupId = tournament.whatsappGroupId || null;
        }

        // Auto-resolve from invite link if missing
        if (!groupId && tournament.whatsappInviteLink && !group) {
            try {
                const { getGroupIdFromInviteLink } = await import("@/lib/whatsapp");
                groupId = await getGroupIdFromInviteLink(tournament.whatsappInviteLink);
                await prisma.tournament.update({
                    where: { id: tournamentId },
                    data: { whatsappGroupId: groupId },
                });
            } catch (err) {
                console.error("[SendImage] Could not resolve group:", err);
            }
        }

        if (!groupId) {
            return NextResponse.json({
                error: "No WhatsApp group found. Set an invite link first.",
            }, { status: 404 });
        }

        // Convert base64 to Buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        const { sendImage } = await import("@/lib/whatsapp");
        await sendImage(groupId, imageBuffer, caption || `📋 ${tournament.name} — Team Slots`);

        return NextResponse.json({ success: true, message: "Image sent to WhatsApp" });
    } catch (error) {
        console.error("[SendImage] Error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Failed to send image" },
            { status: 500 }
        );
    }
}
