import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGuildId } from "@/lib/discord-bot";

/**
 * POST /api/discord/send-standings
 *
 * Uploads a standings screenshot image to a Discord channel.
 * Admin-only.
 *
 * Body (JSON): { image: string (base64 data URL), tournamentName: string, phase?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { image, tournamentName, phase } = body;

        if (!image || !tournamentName) {
            return NextResponse.json({ error: "Missing image or tournamentName" }, { status: 400 });
        }

        const channelId = process.env.DISCORD_RANKED_ROOM_CHANNEL_ID;
        if (!channelId) {
            return NextResponse.json({ error: "DISCORD_RANKED_ROOM_CHANNEL_ID not set" }, { status: 500 });
        }

        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            return NextResponse.json({ error: "DISCORD_BOT_TOKEN not set" }, { status: 500 });
        }

        // Convert base64 data URL to Buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        // Phase label
        const phaseLabel = phase === "HEATS_A" ? "Heats · Group A"
            : phase === "HEATS_B" ? "Heats · Group B"
            : phase === "FINALS" ? "Finals"
            : "";

        const caption = phaseLabel
            ? `🏆 **${tournamentName}** — ${phaseLabel}`
            : `🏆 **${tournamentName}** — Overall Standings`;

        // Build multipart form data for Discord file upload
        const boundary = "----BimonBoundary" + Date.now();
        const filename = `${tournamentName.replace(/\s+/g, "-")}-standings.png`;

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
            `Content-Type: image/png\r\n\r\n`
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
            console.error("Discord upload failed:", err);
            return NextResponse.json({ error: "Discord upload failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Standings image posted to Discord" });
    } catch (error) {
        console.error("Discord send-standings error:", error);
        return NextResponse.json({ error: "Failed to send standings to Discord" }, { status: 500 });
    }
}
