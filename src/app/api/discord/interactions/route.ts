import { NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";
import {
    createTicketChannel,
    createTicketsCategory,
} from "@/lib/discord-service";
import { discordFetch } from "@/lib/discord-bot";

/**
 * POST /api/discord/interactions
 *
 * Discord Interactions endpoint — handles button clicks.
 * Discord sends a POST here when a user clicks a button on a bot message.
 *
 * Must verify Ed25519 signature on every request.
 */
export async function POST(req: NextRequest) {
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    if (!publicKey) {
        return NextResponse.json({ error: "DISCORD_PUBLIC_KEY not set" }, { status: 500 });
    }

    // 1. Verify Discord signature
    const signature = req.headers.get("x-signature-ed25519");
    const timestamp = req.headers.get("x-signature-timestamp");
    const body = await req.text();

    if (!signature || !timestamp) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const isValid = nacl.sign.detached.verify(
        new TextEncoder().encode(timestamp + body),
        hexToUint8Array(signature),
        hexToUint8Array(publicKey),
    );

    if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse the interaction
    const interaction = JSON.parse(body);

    // PING — Discord sends this to verify the endpoint
    if (interaction.type === 1) {
        return NextResponse.json({ type: 1 }); // PONG
    }

    // MESSAGE_COMPONENT — button click
    if (interaction.type === 3) {
        const customId = interaction.data?.custom_id;

        if (customId === "open_ticket") {
            return handleOpenTicket(interaction);
        }
    }

    return NextResponse.json({ error: "Unknown interaction" }, { status: 400 });
}

// ─── Handlers ───────────────────────────────────────────────

async function handleOpenTicket(interaction: any) {
    const user = interaction.member?.user || interaction.user;
    if (!user) {
        return interactionResponse("❌ Could not identify you.", true);
    }

    const discordUserId = user.id;
    const username = user.global_name || user.username || "user";

    try {
        // Get or create the TICKETS category
        let categoryId = process.env.DISCORD_TICKETS_CATEGORY_ID;

        if (!categoryId) {
            categoryId = await createTicketsCategory();
            // Log it so admin can set it in env for next time
            console.log(`Created TICKETS category: ${categoryId} — add to DISCORD_TICKETS_CATEGORY_ID`);
        }

        // Check if user already has an open ticket
        const existingChannel = await findExistingTicket(discordUserId, categoryId);
        if (existingChannel) {
            return interactionResponse(
                `You already have an open ticket: <#${existingChannel}>`,
                true,
            );
        }

        // Create the ticket channel
        const { channelId } = await createTicketChannel(discordUserId, username, categoryId);

        return interactionResponse(
            `✅ Ticket created! Head to <#${channelId}>`,
            true,
        );
    } catch (error) {
        console.error("Ticket creation error:", error);
        return interactionResponse(
            "❌ Failed to create ticket. Please try again or contact an admin.",
            true,
        );
    }
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Check if a user already has an open ticket channel in the category.
 */
async function findExistingTicket(
    discordUserId: string,
    categoryId: string,
): Promise<string | null> {
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) return null;

    try {
        const res = await discordFetch(`/guilds/${guildId}/channels`);
        if (!res.ok) return null;

        const channels: any[] = await res.json();

        // Find a ticket channel in the TICKETS category that this user can see
        const ticketChannel = channels.find(
            (ch: any) =>
                ch.parent_id === categoryId &&
                ch.name?.includes("🎫") &&
                ch.permission_overwrites?.some(
                    (ow: any) => ow.id === discordUserId && ow.type === 1,
                ),
        );

        return ticketChannel?.id ?? null;
    } catch {
        return null;
    }
}

/**
 * Build a Discord interaction response (ephemeral = only visible to the user).
 */
function interactionResponse(content: string, ephemeral: boolean) {
    return NextResponse.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
            content,
            flags: ephemeral ? 64 : 0, // 64 = EPHEMERAL
        },
    });
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}
