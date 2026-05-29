import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
    createTicketsCategory,
    postTicketPanel,
} from "@/lib/discord-service";
import { discordFetch, getGuildId } from "@/lib/discord-bot";

/**
 * POST /api/discord/setup-ticket-panel
 *
 * Creates the TICKETS category (if needed) and a #open-ticket channel,
 * then posts the ticket panel embed with the Open Ticket button.
 *
 * Admin-only. Run once to set up the ticket system.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const guildId = getGuildId();

        // 1. Get or create the TICKETS category
        let categoryId = process.env.DISCORD_TICKETS_CATEGORY_ID;

        if (!categoryId) {
            categoryId = await createTicketsCategory();
            console.log(`✅ Created TICKETS category: ${categoryId}`);
            console.log(`→ Add to .env: DISCORD_TICKETS_CATEGORY_ID="${categoryId}"`);
        }

        // 2. Check if #open-ticket channel already exists
        const channelsRes = await discordFetch(`/guilds/${guildId}/channels`);
        const channels: any[] = channelsRes.ok ? await channelsRes.json() : [];

        let ticketChannelId = channels.find(
            (ch: any) => ch.name === "open-ticket" && ch.parent_id === categoryId,
        )?.id;

        // 3. Create #open-ticket if it doesn't exist (visible to everyone)
        if (!ticketChannelId) {
            const res = await discordFetch(`/guilds/${guildId}/channels`, {
                method: "POST",
                body: JSON.stringify({
                    name: "open-ticket",
                    type: 0, // GUILD_TEXT
                    parent_id: categoryId,
                    topic: "🎫 Click the button below to open a private support ticket",
                    permission_overwrites: [
                        {
                            id: guildId, // @everyone — can view but NOT send messages
                            type: 0,
                            allow: "1024", // VIEW_CHANNEL
                            deny: "2048",  // SEND_MESSAGES — only bot messages
                        },
                        ...(process.env.DISCORD_CLIENT_ID ? [{
                            id: process.env.DISCORD_CLIENT_ID, // Bot — can send + embed
                            type: 1, // member
                            allow: "52224", // VIEW_CHANNEL + SEND_MESSAGES + EMBED_LINKS
                        }] : []),
                    ],
                }),
            });

            if (!res.ok) {
                const err = await res.text().catch(() => "unknown");
                return NextResponse.json({ error: `Failed to create channel: ${err}` }, { status: 500 });
            }

            const channel = await res.json();
            ticketChannelId = channel.id;
        }

        // 4. Ensure bot has send permissions on the channel
        if (process.env.DISCORD_CLIENT_ID) {
            await discordFetch(`/channels/${ticketChannelId}/permissions/${process.env.DISCORD_CLIENT_ID}`, {
                method: "PUT",
                body: JSON.stringify({
                    type: 1, // member
                    allow: "52224", // VIEW_CHANNEL + SEND_MESSAGES + EMBED_LINKS
                }),
            });
        }

        // 5. Post the ticket panel
        await postTicketPanel(ticketChannelId);

        return NextResponse.json({
            success: true,
            message: "Ticket system set up!",
            categoryId,
            channelId: ticketChannelId,
        });
    } catch (error) {
        console.error("Setup ticket panel error:", error);
        return NextResponse.json({ error: "Failed to set up ticket system" }, { status: 500 });
    }
}
