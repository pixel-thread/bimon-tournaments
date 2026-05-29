import { discordFetch, getGuildId } from "./discord-bot";

/**
 * Discord Service — Business logic for tournament Discord operations.
 *
 * All functions use plain fetch() via discordFetch helper.
 * No discord.js — works on Vercel serverless.
 */

// ─── Role Management ────────────────────────────────────────

/**
 * Grant a role to a Discord user.
 */
export async function grantRole(discordUserId: string, roleId: string): Promise<void> {
    const guildId = getGuildId();
    await discordFetch(
        `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
        { method: "PUT" }
    );
}

/**
 * Revoke a role from a Discord user.
 */
export async function revokeRole(discordUserId: string, roleId: string): Promise<void> {
    const guildId = getGuildId();
    await discordFetch(
        `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
        { method: "DELETE" }
    );
}

/**
 * Revoke a role from multiple Discord users.
 * Skips users who don't have the role (no error).
 */
export async function revokeRoleFromAll(discordUserIds: string[], roleId: string): Promise<void> {
    const guildId = getGuildId();
    await Promise.allSettled(
        discordUserIds.map((userId) =>
            discordFetch(
                `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
                { method: "DELETE" }
            )
        )
    );
}

// ─── Member Lookup ──────────────────────────────────────────

interface DiscordMember {
    user: { id: string; username: string; global_name?: string };
}

/**
 * Look up a guild member by username.
 * Returns their Discord user ID if found, null otherwise.
 */
export async function findMemberByUsername(username: string): Promise<{
    userId: string;
    username: string;
    displayName: string;
} | null> {
    const guildId = getGuildId();

    try {
        const res = await discordFetch(
            `/guilds/${guildId}/members/search?query=${encodeURIComponent(username)}&limit=5`
        );

        if (!res.ok) return null;

        const members: DiscordMember[] = await res.json();

        // Find exact match
        const match = members.find(
            (m) => m.user.username.toLowerCase() === username.toLowerCase()
        );

        if (!match) return null;

        return {
            userId: match.user.id,
            username: match.user.username,
            displayName: match.user.global_name || match.user.username,
        };
    } catch (error) {
        console.error("Discord member lookup failed:", error);
        return null;
    }
}

// ─── Per-Tournament Channel Management ─────────────────────

/**
 * Create a Discord text channel under the TOURNAMENTS category.
 * Returns the new channel's ID.
 */
export async function createTournamentChannel(
    tournamentName: string,
): Promise<string> {
    const guildId = getGuildId();
    const categoryId = process.env.DISCORD_TOURNAMENTS_CATEGORY_ID;
    if (!categoryId) throw new Error("DISCORD_TOURNAMENTS_CATEGORY_ID is not set");

    const rankedRoleId = process.env.DISCORD_RANKED_PLAYER_ROLE_ID;

    // Slugify the tournament name for the channel (Discord max 100 chars)
    const slug = tournamentName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);
    const channelName = `🏆-${slug}`;

    // Permission overwrites: @everyone can't see, @Ranked-Player can see + send
    const permissionOverwrites: any[] = [
        {
            id: guildId, // @everyone role (same as guild ID)
            type: 0, // role
            deny: "1024", // VIEW_CHANNEL
        },
    ];
    if (rankedRoleId) {
        permissionOverwrites.push({
            id: rankedRoleId,
            type: 0, // role
            allow: "3072", // VIEW_CHANNEL + SEND_MESSAGES
        });
    }
    // Bot itself needs access (use bot's application/client ID)
    const botClientId = process.env.DISCORD_CLIENT_ID;
    if (botClientId) {
        permissionOverwrites.push({
            id: botClientId,
            type: 1, // member (bot user)
            allow: "52224", // VIEW_CHANNEL + SEND_MESSAGES + EMBED_LINKS + MENTION_EVERYONE
        });
    }

    const res = await discordFetch(`/guilds/${guildId}/channels`, {
        method: "POST",
        body: JSON.stringify({
            name: channelName,
            type: 0, // GUILD_TEXT
            parent_id: categoryId,
            topic: `🔒 Room IDs for ${tournamentName} — auto-managed by Bimon`,
            permission_overwrites: permissionOverwrites,
        }),
    });

    if (!res.ok) {
        const errorBody = await res.text().catch(() => "unknown");
        console.error(`Discord createChannel failed [${res.status}]:`, errorBody);
        throw new Error(`Failed to create Discord channel: ${errorBody}`);
    }

    const channel = await res.json();
    return channel.id;
}

/**
 * Delete a Discord channel (used when declaring winners).
 */
export async function deleteTournamentChannel(channelId: string): Promise<void> {
    const res = await discordFetch(`/channels/${channelId}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const errorBody = await res.text().catch(() => "unknown");
        console.error(`Discord deleteChannel failed [${res.status}]:`, errorBody);
        // Don't throw — channel deletion is best-effort cleanup
    }
}

// ─── Room Info Embed ────────────────────────────────────────

interface RoomInfoPayload {
    tournamentId: string;
    tournamentName: string;
    matchNumber: number;
    map: string;
    time: string;
    roomId: string;
    password: string;
    gameName: string;
}

/**
 * Send room info to a tournament-specific Discord channel.
 * Auto-creates the channel on first send and stores it on the tournament.
 */
export async function sendRoomInfo(payload: RoomInfoPayload): Promise<void> {
    // Dynamic import to avoid circular deps
    const { prisma } = await import("@/lib/database");

    // 1. Get or create the channel
    const tournament = await prisma.tournament.findUnique({
        where: { id: payload.tournamentId },
        select: { discordChannelId: true },
    });

    let channelId = tournament?.discordChannelId;

    if (!channelId) {
        // Create a new channel for this tournament
        channelId = await createTournamentChannel(payload.tournamentName);

        // Store it on the tournament
        await prisma.tournament.update({
            where: { id: payload.tournamentId },
            data: { discordChannelId: channelId },
        });
    }

    // 2. Send the rich embed
    const embed = {
        title: `🏆 ${payload.tournamentName}`,
        description: `**Match ${payload.matchNumber}** — Room details below`,
        color: 0xf59e0b, // amber
        fields: [
            { name: "🗺️ Map", value: payload.map, inline: true },
            { name: "🕐 Time", value: payload.time, inline: true },
            { name: "\u200b", value: "\u200b", inline: true }, // spacer
            { name: "🔐 Room ID", value: `\`${payload.roomId || "TBD"}\``, inline: true },
            { name: "🔑 Password", value: `\`${payload.password}\``, inline: true },
        ],
        footer: {
            text: `${payload.gameName} × Bimon Tournament`,
        },
        timestamp: new Date().toISOString(),
    };

    const res = await discordFetch(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
            embeds: [embed],
            content: "@everyone 🚨 Room info is here! Join now!",
        }),
    });

    if (!res.ok) {
        const errorBody = await res.text().catch(() => "unknown");
        console.error(`Discord sendRoomInfo failed [${res.status}]:`, errorBody);
        throw new Error(`Discord API error ${res.status}: ${errorBody}`);
    }

    // 3. Send a separate plain-text message with just the room ID for easy copying
    if (payload.roomId?.trim()) {
        await discordFetch(`/channels/${channelId}/messages`, {
            method: "POST",
            body: JSON.stringify({ content: payload.roomId.trim() }),
        });
    }
}

// ─── Ticket System ──────────────────────────────────────────

/**
 * Create the TICKETS category (hidden from @everyone).
 * Returns the category channel ID.
 */
export async function createTicketsCategory(): Promise<string> {
    const guildId = getGuildId();

    const res = await discordFetch(`/guilds/${guildId}/channels`, {
        method: "POST",
        body: JSON.stringify({
            name: "TICKETS",
            type: 4, // GUILD_CATEGORY
            permission_overwrites: [
                {
                    id: guildId, // @everyone
                    type: 0,
                    deny: "1024", // VIEW_CHANNEL — hide from everyone
                },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => "unknown");
        throw new Error(`Failed to create TICKETS category: ${err}`);
    }

    const channel = await res.json();
    return channel.id;
}

/**
 * Create a private ticket channel visible only to the requesting user + admins.
 */
export async function createTicketChannel(
    discordUserId: string,
    username: string,
    categoryId: string,
): Promise<{ channelId: string }> {
    const guildId = getGuildId();
    const botClientId = process.env.DISCORD_CLIENT_ID;

    const slug = username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 40);

    const permissionOverwrites: any[] = [
        {
            id: guildId, // @everyone — hide
            type: 0,
            deny: "1024",
        },
        {
            id: discordUserId, // ticket creator — can see + send + attach
            type: 1,
            allow: "52224", // VIEW_CHANNEL + SEND_MESSAGES + EMBED_LINKS + ATTACH_FILES
        },
    ];

    if (botClientId) {
        permissionOverwrites.push({
            id: botClientId,
            type: 1,
            allow: "52224",
        });
    }

    const res = await discordFetch(`/guilds/${guildId}/channels`, {
        method: "POST",
        body: JSON.stringify({
            name: `🎫-${slug}`,
            type: 0, // GUILD_TEXT
            parent_id: categoryId,
            topic: `Support ticket for ${username}`,
            permission_overwrites: permissionOverwrites,
        }),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => "unknown");
        throw new Error(`Failed to create ticket channel: ${err}`);
    }

    const channel = await res.json();

    // Send welcome message
    await discordFetch(`/channels/${channel.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
            embeds: [{
                title: "🎫 Support Ticket",
                description: `Hey <@${discordUserId}>, your ticket is open!\n\nDescribe your issue below. You can attach screenshots and recordings.\n\nAn admin will respond as soon as possible.`,
                color: 0x5865f2, // Discord blurple
                footer: { text: "Bimon Tournament Support" },
                timestamp: new Date().toISOString(),
            }],
        }),
    });

    return { channelId: channel.id };
}

/**
 * Close (delete) a ticket channel.
 */
export async function closeTicketChannel(channelId: string): Promise<void> {
    await discordFetch(`/channels/${channelId}`, { method: "DELETE" });
}

/**
 * Post the "Open Ticket" panel with a button in a channel.
 */
export async function postTicketPanel(channelId: string): Promise<void> {
    const res = await discordFetch(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
            embeds: [{
                title: "🎫 Support & Disputes",
                description: "Having an issue? Server timeout? Need to report something?\n\nClick the button below to open a **private ticket**. Only you and the admins can see it.\n\nYou can share screenshots, screen recordings, and any evidence.",
                color: 0x5865f2,
                footer: { text: "Bimon Tournament • Each ticket is private" },
            }],
            components: [{
                type: 1, // ACTION_ROW
                components: [{
                    type: 2, // BUTTON
                    style: 1, // PRIMARY (blurple)
                    label: "Open Ticket",
                    emoji: { name: "🎫" },
                    custom_id: "open_ticket",
                }],
            }],
        }),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => "unknown");
        throw new Error(`Failed to post ticket panel: ${err}`);
    }
}
