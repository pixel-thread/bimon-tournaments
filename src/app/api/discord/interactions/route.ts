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
 * Discord Interactions endpoint — handles button clicks and modal submits.
 * Discord sends a POST here when a user interacts with a bot component.
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
            return showTicketModal(interaction);
        }
    }

    // MODAL_SUBMIT — form submitted
    if (interaction.type === 5) {
        const customId = interaction.data?.custom_id;

        if (customId === "ticket_modal") {
            return handleTicketSubmit(interaction);
        }
    }

    return NextResponse.json({ error: "Unknown interaction" }, { status: 400 });
}

// ─── Handlers ───────────────────────────────────────────────

/**
 * Show the ticket form modal when user clicks "Open Ticket".
 */
function showTicketModal(interaction: any) {
    const user = interaction.member?.user || interaction.user;
    const discordUserId = user?.id;

    return NextResponse.json({
        type: 9, // MODAL
        data: {
            custom_id: "ticket_modal",
            title: "🎫 Open Support Ticket",
            components: [
                {
                    type: 1, // ACTION_ROW
                    components: [{
                        type: 4, // TEXT_INPUT
                        custom_id: "issue_type",
                        label: "Issue Type",
                        style: 1, // SHORT
                        placeholder: "Server Timeout / Dispute / Bug / Other",
                        required: true,
                        max_length: 50,
                    }],
                },
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: "description",
                        label: "Describe your issue",
                        style: 2, // PARAGRAPH (multi-line)
                        placeholder: "Tell us what happened...",
                        required: true,
                        max_length: 1000,
                    }],
                },
                {
                    type: 1,
                    components: [{
                        type: 4,
                        custom_id: "match_info",
                        label: "Match / Tournament (optional)",
                        style: 1, // SHORT
                        placeholder: "e.g. Match 3, Lehkai Chicha tournament",
                        required: false,
                        max_length: 100,
                    }],
                },
            ],
        },
    });
}

/**
 * Handle the modal submission — create the ticket channel with the info.
 */
async function handleTicketSubmit(interaction: any) {
    const user = interaction.member?.user || interaction.user;
    if (!user) {
        return interactionResponse("❌ Could not identify you.", true);
    }

    const discordUserId = user.id;
    const username = user.global_name || user.username || "user";

    // Extract form values
    const components = interaction.data?.components || [];
    const getValue = (id: string) => {
        for (const row of components) {
            for (const comp of row.components || []) {
                if (comp.custom_id === id) return comp.value || "";
            }
        }
        return "";
    };

    const issueType = getValue("issue_type");
    const description = getValue("description");
    const matchInfo = getValue("match_info");

    try {
        // Get or create the TICKETS category
        let categoryId = process.env.DISCORD_TICKETS_CATEGORY_ID;

        if (!categoryId) {
            categoryId = await createTicketsCategory();
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

        // Post the issue details in the ticket channel
        const fields = [
            { name: "📋 Issue Type", value: issueType, inline: true },
            ...(matchInfo ? [{ name: "🎮 Match / Tournament", value: matchInfo, inline: true }] : []),
            { name: "📝 Description", value: description },
        ];

        await discordFetch(`/channels/${channelId}/messages`, {
            method: "POST",
            body: JSON.stringify({
                embeds: [{
                    title: `Issue Report from ${username}`,
                    color: 0xed4245, // red
                    fields,
                    footer: { text: "Attach screenshots or recordings below" },
                    timestamp: new Date().toISOString(),
                }],
            }),
        });

        return interactionResponse(
            `✅ Ticket created! Go to <#${channelId}> to continue.`,
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
