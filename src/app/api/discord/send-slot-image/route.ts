import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { createTournamentChannel } from "@/lib/discord-service";

/**
 * POST /api/discord/send-slot-image
 *
 * Uploads a slot/team image to the tournament's per-tournament Discord channel.
 * Auto-creates the channel if it doesn't exist yet.
 * Admin-only.
 *
 * Body (JSON): { image: string (base64 data URL), tournamentId: string, tournamentName: string }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { image, tournamentId, tournamentName, group } = body;

        if (!image || !tournamentId || !tournamentName) {
            return NextResponse.json({ error: "Missing image, tournamentId, or tournamentName" }, { status: 400 });
        }

        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            return NextResponse.json({ error: "DISCORD_BOT_TOKEN not set" }, { status: 500 });
        }

        // 1. Get or create the tournament's Discord channel (group-aware)
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                discordChannelId: true,
                discordGroupChannels: true,
            },
        });

        let channelId: string | null | undefined;

        if (group) {
            const groupChannels = (tournament?.discordGroupChannels as Record<string, string>) || {};
            channelId = groupChannels[group] || null;
        } else {
            channelId = tournament?.discordChannelId;
        }

        if (!channelId) {
            // Create channel (no auto-granting — managed from Discord Access tab)
            const suffix = group ? `group-${group.toLowerCase()}` : undefined;
            channelId = await createTournamentChannel(tournamentName, suffix);

            if (group) {
                const groupChannels = (tournament?.discordGroupChannels as Record<string, string>) || {};
                groupChannels[group] = channelId;
                await prisma.tournament.update({
                    where: { id: tournamentId },
                    data: { discordGroupChannels: groupChannels },
                });
            } else {
                await prisma.tournament.update({
                    where: { id: tournamentId },
                    data: { discordChannelId: channelId },
                });
            }
        }

        // 2. Convert base64 data URL to Buffer — detect format (jpeg or png)
        const isJpeg = image.startsWith("data:image/jpeg");
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const imageExt = isJpeg ? "jpg" : "png";
        const imageMime = isJpeg ? "image/jpeg" : "image/png";

        // 3. Build multipart form data for Discord file upload
        const boundary = "----BimonSlotBoundary" + Date.now();
        const filename = `${tournamentName.replace(/\s+/g, "-")}-slots.${imageExt}`;

        const caption = `📋 **${tournamentName}** — Team Slots`;

        const parts: Buffer[] = [];

        // Part 1: payload_json
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="payload_json"\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            JSON.stringify({ content: caption }) +
            `\r\n`
        ));

        // Part 2: file
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="files[0]"; filename="${filename}"\r\n` +
            `Content-Type: ${imageMime}\r\n\r\n`
        ));
        parts.push(imageBuffer);
        parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

        const bodyBuffer = Buffer.concat(parts);

        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: bodyBuffer,
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("Discord slot image upload failed:", err);
            return NextResponse.json({ error: "Discord upload failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Slot image posted to Discord" });
    } catch (error) {
        console.error("Discord send-slot-image error:", error);
        return NextResponse.json({ error: "Failed to send slot image to Discord" }, { status: 500 });
    }
}
