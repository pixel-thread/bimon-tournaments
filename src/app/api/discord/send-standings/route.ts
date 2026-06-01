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
        const { image, tournamentName, phase, matchCount, isFinal } = body;

        if (!image || !tournamentName) {
            return NextResponse.json({ error: "Missing image or tournamentName" }, { status: 400 });
        }

        const channelId = process.env.DISCORD_STANDINGS_CHANNEL_ID || process.env.DISCORD_RANKED_ROOM_CHANNEL_ID;
        if (!channelId) {
            return NextResponse.json({ error: "DISCORD_STANDINGS_CHANNEL_ID not set" }, { status: 500 });
        }

        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            return NextResponse.json({ error: "DISCORD_BOT_TOKEN not set" }, { status: 500 });
        }

        // Convert base64 data URL to Buffer — detect format (jpeg or png)
        const isJpeg = image.startsWith("data:image/jpeg");
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const imageExt = isJpeg ? "jpg" : "png";
        const imageMime = isJpeg ? "image/jpeg" : "image/png";

        // Phase label
        const phaseLabel = phase === "HEATS_A" ? "Heats · Group A"
            : phase === "HEATS_B" ? "Heats · Group B"
            : phase === "FINALS" ? "Finals"
            : "";

        // Build caption
        let caption: string;
        if (isFinal) {
            caption = phaseLabel
                ? `🏆 **${tournamentName}** — ${phaseLabel} (FINAL STANDINGS)`
                : `🏆 **${tournamentName}** — FINAL STANDINGS`;
        } else {
            const matchInfo = matchCount ? ` (After ${matchCount} Match${matchCount !== 1 ? "es" : ""})` : "";
            caption = phaseLabel
                ? `🏆 **${tournamentName}** — ${phaseLabel}${matchInfo}`
                : `🏆 **${tournamentName}** — Overall Standings${matchInfo}`;
        }

        // Random hype messages
        const finalHypeMessages = [
            "🎉 The dust has settled! Congratulations to the champions! 👑",
            "🏆 What a tournament! History has been written!",
            "👑 The champions have been crowned! GG WP to everyone!",
            "🥇 From start to finish, it was an incredible journey!",
            "🫡 Respect to every team that competed! Final standings are here!",
            "🎊 It's OVER! What a ride! Here are your final standings!",
            "💪 Blood, sweat, and chicken dinners! The results are IN!",
            "⭐ Legends were made today! Final results below!",
            "🔥 That was absolutely INSANE! Here are the final standings!",
            "🍗 The last chicken dinner has been served! Final standings!",
            "🏅 Season finale! Every point mattered and here's the proof!",
            "👏 What a show! Thank you to all teams! Final standings!",
            "💯 Tournament COMPLETE! The best have proven themselves!",
            "🎯 Aim true, play smart, win big! Final results are here!",
            "🥊 The final bell has rung! Here are your standings!",
        ];

        const regularHypeMessages = [
            "🔥 The battle heats up! Who's climbing the ranks?",
            "⚔️ Every kill counts. Every position matters!",
            "👀 Look at those standings! Things are getting intense!",
            "💪 Warriors are fighting hard for the top!",
            "🏅 The leaderboard is LIVE — who's your pick?",
            "🎯 Precision wins games. Strategy wins tournaments!",
            "⭐ Champions are made in moments like these!",
            "🚀 The competition is fierce! Can anyone catch the leaders?",
            "💥 What a showdown! Check out the current standings!",
            "🐔 Winner winner chicken dinner vibes! 🍗",
            "😤 No room for mistakes — it's all or nothing!",
            "📊 Numbers don't lie. The standings speak for themselves!",
            "🏆 Glory awaits the top teams. Who wants it more?",
            "🔝 Climbing the ranks one match at a time!",
            "💀 Survival of the fittest — only the best remain!",
            "🎮 This is what competitive gaming looks like!",
            "🫡 Respect to every team grinding it out!",
            "🧠 Big brain plays are separating the best from the rest!",
            "👑 The crown is up for grabs — who's taking it?",
            "⏰ Every second in the zone counts. Check the leaderboard!",
            "🪖 Squads are locked in. The grind never stops!",
            "😱 Plot twists everywhere! Look at those position changes!",
            "🥇 Only one team can be #1. The race is ON!",
            "🫣 Some teams are sweating right now... check why!",
            "🤯 The gap is closing! This is anyone's game!",
            "💯 Pure skill on display. The standings say it all!",
            "🗡️ No mercy in the battlegrounds! Rankings updated!",
            "🌟 Stars are rising! Keep an eye on the underdogs!",
            "📈 Moving up or sliding down? The table tells the story!",
            "🎪 What a tournament! The drama is REAL!",
        ];

        const messages = isFinal ? finalHypeMessages : regularHypeMessages;
        const hype = messages[Math.floor(Math.random() * messages.length)];

        // Build multipart form data for Discord file upload
        const boundary = "----BimonBoundary" + Date.now();
        const filename = `${tournamentName.replace(/\s+/g, "-")}-standings.${imageExt}`;

        const parts: Buffer[] = [];

        // Part 1: payload_json
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="payload_json"\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            JSON.stringify({ content: `${caption}\n${hype}` }) +
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
            console.error("Discord upload failed:", err);
            return NextResponse.json({ error: "Discord upload failed" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Standings image posted to Discord" });
    } catch (error) {
        console.error("Discord send-standings error:", error);
        return NextResponse.json({ error: "Failed to send standings to Discord" }, { status: 500 });
    }
}
