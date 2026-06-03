import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/database";
import { discordFetch } from "@/lib/discord-bot";

/**
 * POST /api/discord/announce-poll
 *
 * Sends a poll announcement embed to the dedicated announcements channel.
 * Admin-only, manual trigger from the poll manager.
 *
 * Body: { pollId }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { pollId } = await req.json();
        if (!pollId) {
            return NextResponse.json({ error: "pollId is required" }, { status: 400 });
        }

        const channelId = process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
        if (!channelId) {
            return NextResponse.json({ error: "DISCORD_ANNOUNCEMENTS_CHANNEL_ID is not set" }, { status: 500 });
        }

        // Fetch poll + tournament
        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            select: {
                question: true,
                teamType: true,
                allowSquads: true,
                scheduledDate: true,
                scheduledTime: true,
                tournament: {
                    select: {
                        id: true,
                        name: true,
                        fee: true,
                    },
                },
            },
        });

        if (!poll) {
            return NextResponse.json({ error: "Poll not found" }, { status: 404 });
        }

        const tournament = poll.tournament;
        if (!tournament) {
            return NextResponse.json({ error: "Poll has no linked tournament" }, { status: 400 });
        }

        const isRanked = poll.allowSquads;
        const typeLabel = isRanked ? "🏆 Ranked (Squad)" : "🎮 Casual";
        const appUrl = process.env.APP_URL || "https://bgmi.pixel-thread.in";

        // Build schedule text
        let scheduleText = "";
        if (poll.scheduledDate) {
            const date = new Date(poll.scheduledDate);
            scheduleText = date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
            if (poll.scheduledTime) {
                scheduleText += ` at ${poll.scheduledTime}`;
            }
        }

        const embed = {
            title: `📋 ${tournament.name}`,
            description: `Tournament registration is now open!\nVote **IN** to secure your spot.`,
            color: isRanked ? 0xf59e0b : 0x10b981, // amber for ranked, emerald for casual
            fields: [
                { name: "🎮 Mode", value: typeLabel, inline: true },
                { name: "👥 Team", value: poll.teamType, inline: true },
                ...(tournament.fee && tournament.fee > 0
                    ? [{ name: "💰 Entry", value: `${tournament.fee} UC`, inline: true }]
                    : []),
                ...(scheduleText
                    ? [{ name: "📅 Schedule", value: scheduleText, inline: true }]
                    : []),
                { name: "🔗 Register", value: `[Register Now](${appUrl}/join/${pollId})` },
            ],
            footer: { text: "Bimon Tournament" },
            timestamp: new Date().toISOString(),
        };

        const res = await discordFetch(`/channels/${channelId}/messages`, {
            method: "POST",
            body: JSON.stringify({
                embeds: [embed],
                content: "@everyone 📢 New tournament — register now!",
            }),
        });

        if (!res.ok) {
            const errorBody = await res.text().catch(() => "unknown");
            console.error(`Discord announce-poll failed [${res.status}]:`, errorBody);
            return NextResponse.json({ error: `Discord error: ${errorBody}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Announcement sent to Discord" });
    } catch (error) {
        console.error("Discord announce-poll error:", error);
        return NextResponse.json({ error: "Failed to send announcement" }, { status: 500 });
    }
}
