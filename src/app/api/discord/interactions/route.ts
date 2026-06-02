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

    // APPLICATION_COMMAND — slash command
    if (interaction.type === 2) {
        const commandName = interaction.data?.name;

        if (commandName === "nextmatch") {
            return handleNextMatch(interaction);
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

        // Auto-lookup the player's Bimon profile and post it for admins
        try {
            const { prisma } = await import("@/lib/database");
            const player = await prisma.player.findFirst({
                where: { discordId: discordUserId },
                select: {
                    displayName: true,
                    phoneNumber: true,
                    uid: true,
                    category: true,
                    isBanned: true,
                    discordUsername: true,
                    user: { select: { username: true } },
                    teams: {
                        take: 3,
                        orderBy: { createdAt: "desc" },
                        select: {
                            name: true,
                            tournament: { select: { name: true } },
                        },
                    },
                    wallet: { select: { balance: true } },
                },
            });

            if (player) {
                const profileFields = [
                    { name: "🎮 IGN", value: player.displayName || "Not set", inline: true },
                    { name: "👤 Username", value: player.user?.username || "—", inline: true },
                    { name: "🏷️ Tier", value: player.category, inline: true },
                    ...(player.phoneNumber ? [{ name: "📱 Phone", value: `||${player.phoneNumber}||`, inline: true }] : []),
                    ...(player.uid ? [{ name: "🆔 UID", value: player.uid, inline: true }] : []),
                    ...(player.wallet ? [{ name: "💰 Balance", value: `${player.wallet.balance} UC`, inline: true }] : []),
                ];

                if (player.teams.length > 0) {
                    const teamList = player.teams
                        .map(t => `• ${t.name}${t.tournament ? ` (${t.tournament.name})` : ""}`)
                        .join("\n");
                    profileFields.push({ name: "🏆 Recent Teams", value: teamList, inline: false });
                }

                await discordFetch(`/channels/${channelId}/messages`, {
                    method: "POST",
                    body: JSON.stringify({
                        embeds: [{
                            title: "🔍 Player Profile (Auto-Lookup)",
                            description: player.isBanned ? "⚠️ **This player is currently BANNED**" : undefined,
                            color: player.isBanned ? 0xed4245 : 0x5865f2,
                            fields: profileFields,
                            footer: { text: "Matched by Discord ID → Bimon database" },
                        }],
                    }),
                });
            } else {
                // Player not found — they haven't linked their Discord
                await discordFetch(`/channels/${channelId}/messages`, {
                    method: "POST",
                    body: JSON.stringify({
                        content: "⚠️ *This Discord user is not linked to any Bimon player account.*",
                    }),
                });
            }
        } catch (profileError) {
            console.error("Profile lookup in ticket failed (non-critical):", profileError);
            // Don't fail the ticket — profile lookup is best-effort
        }

        return interactionResponse(
            `✅ Ticket created! Go to <#${channelId}> to upload screenshots or screen recordings.`,
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
 * Handle /nextmatch — show the player their active tournaments and team info.
 */
async function handleNextMatch(interaction: any) {
    const user = interaction.member?.user || interaction.user;
    if (!user) {
        return interactionResponse("❌ Could not identify you.", true);
    }

    const discordUserId = user.id;

    try {
        const { prisma } = await import("@/lib/database");

        // Find the player linked to this Discord account
        const player = await prisma.player.findFirst({
            where: { discordId: discordUserId },
            select: {
                id: true,
                displayName: true,
                category: true,
            },
        });

        if (!player) {
            return embeddedResponse({
                title: "❌ Account Not Linked",
                description: "Your Discord is not linked to a Bimon account.\nGo to the Bimon app → Settings → Link Discord.",
                color: 0xed4245,
            }, true);
        }

        // Find active tournaments where this player is on a team
        const teams = await prisma.team.findMany({
            where: {
                players: { some: { id: player.id } },
                tournament: {
                    status: "ACTIVE",
                    isWinnerDeclared: false,
                },
            },
            select: {
                name: true,
                teamNumber: true,
                disqualified: true,
                championshipEntry: {
                    select: { group: true, phase: true, status: true },
                },
                tournament: {
                    select: {
                        id: true,
                        name: true,
                        isTDM: true,
                        isWoW: true,
                        poll: { select: { allowSquads: true, isChampionship: true } },
                        matches: {
                            select: { matchNumber: true },
                            orderBy: { matchNumber: "desc" },
                            take: 1,
                        },
                    },
                },
                players: {
                    select: { displayName: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        if (teams.length === 0) {
            return embeddedResponse({
                title: "📭 No Active Matches",
                description: `**${player.displayName || "Player"}**, you're not in any active tournament right now.\n\nKeep an eye on the polls for the next one! 🎮`,
                color: 0xfee75c,
            }, true);
        }

        // Build fields for each active tournament
        const fields = teams.map((team) => {
            const t = team.tournament!;
            const isRanked = t.poll?.allowSquads;
            const isChamp = t.poll?.isChampionship;
            const ce = team.championshipEntry;
            const type = t.isTDM ? "TDM" : t.isWoW ? "WoW" : isChamp ? "🏅 Championship" : isRanked ? "🏆 Ranked" : "🎮 Casual";
            const matchesPlayed = t.matches.length > 0 ? t.matches[0].matchNumber : 0;
            const teammates = team.players
                .filter((p) => p.displayName !== player.displayName)
                .map((p) => p.displayName || "Unknown")
                .join(", ");
            const status = team.disqualified ? "⛔ DQ'd" : ce?.status === "ELIMINATED" ? "💀 Eliminated" : ce?.status === "QUALIFIED" ? "🎉 Qualified" : "✅ Active";

            const lines = [
                `**Team:** ${team.name} (#${team.teamNumber})`,
                teammates ? `**Teammates:** ${teammates}` : "**Solo**",
            ];

            // Championship group + phase info
            if (ce?.group) lines.push(`**Group:** ${ce.group}`);
            if (ce?.phase) lines.push(`**Phase:** ${ce.phase}`);

            lines.push(`**Matches played:** ${matchesPlayed}`);
            lines.push(`**Status:** ${status}`);

            return {
                name: `${type} — ${t.name}`,
                value: lines.join("\n"),
                inline: false,
            };
        });

        return embeddedResponse({
            title: `🎯 ${player.displayName}'s Active Matches`,
            description: `You're in **${teams.length}** active tournament${teams.length > 1 ? "s" : ""}. Good luck! 💪`,
            color: 0x5865f2,
            fields,
            footer: { text: `Tier: ${player.category}` },
        }, true);
    } catch (error) {
        console.error("nextmatch error:", error);
        return interactionResponse("❌ Something went wrong. Try again later.", true);
    }
}

/**
 * Build a Discord interaction response with an embed (ephemeral = only visible to the user).
 */
function embeddedResponse(embed: Record<string, unknown>, ephemeral: boolean) {
    return NextResponse.json({
        type: 4,
        data: {
            embeds: [embed],
            flags: ephemeral ? 64 : 0,
        },
    });
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
