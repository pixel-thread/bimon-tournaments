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

// ─── Rate-limited batch access granting ─────────────────────

/**
 * Grant channel access to multiple Discord users with rate-limit-safe
 * batched processing (3 parallel per batch, 400ms between batches).
 * Handles up to 100+ players (e.g. 17 squads × 6 = 102).
 */
export async function batchGrantChannelAccess(
    channelId: string,
    discordUserIds: string[],
): Promise<{ granted: number; failed: number }> {
    let granted = 0;
    let failed = 0;
    const BATCH_SIZE = 3; // Discord allows ~10 req/10s per channel endpoint

    for (let i = 0; i < discordUserIds.length; i += BATCH_SIZE) {
        const batch = discordUserIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(userId => grantChannelAccess(channelId, userId))
        );
        for (const r of results) {
            if (r.status === "fulfilled") granted++;
            else { failed++; console.error("grantChannelAccess failed:", r.reason); }
        }
        // Delay between batches to stay under rate limit
        if (i + BATCH_SIZE < discordUserIds.length) {
            await new Promise(r => setTimeout(r, 400));
        }
    }

    if (failed > 0) {
        console.warn(`batchGrantChannelAccess: ${granted} granted, ${failed} failed out of ${discordUserIds.length}`);
    }
    return { granted, failed };
}

// ─── Per-Tournament Channel Management ─────────────────────

/**
 * Create a Discord text channel under the TOURNAMENTS category.
 * Returns the new channel's ID.
 */
export async function createTournamentChannel(
    tournamentName: string,
    /** Optional suffix for championship groups/phases: "group-a", "group-b", "wildcard", "finals" */
    suffix?: string,
): Promise<string> {
    const guildId = getGuildId();
    const categoryId = process.env.DISCORD_TOURNAMENTS_CATEGORY_ID;
    if (!categoryId) throw new Error("DISCORD_TOURNAMENTS_CATEGORY_ID is not set");

    // Slugify the tournament name for the channel (Discord max 100 chars)
    const slug = tournamentName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 60);
    const channelName = suffix ? `🏆-${slug}-${suffix}` : `🏆-${slug}`;
    const topicLabel = suffix ? `${tournamentName} — ${suffix.toUpperCase()}` : tournamentName;

    // Permission overwrites: @everyone can't see or send messages, per-user access granted separately
    const permissionOverwrites: any[] = [
        {
            id: guildId, // @everyone role (same as guild ID)
            type: 0, // role
            deny: "3072", // VIEW_CHANNEL + SEND_MESSAGES
        },
    ];
    // Bot itself needs access (use bot's application/client ID)
    const botClientId = process.env.DISCORD_CLIENT_ID;
    if (botClientId) {
        // VIEW_CHANNEL (1<<10) + SEND_MESSAGES (1<<11) + EMBED_LINKS (1<<14) + ATTACH_FILES (1<<15) + MENTION_EVERYONE (1<<17)
        // = 1024 + 2048 + 16384 + 32768 + 131072 = 183296
        permissionOverwrites.push({
            id: botClientId,
            type: 1, // member (bot user)
            allow: "183296",
        });
    }

    const res = await discordFetch(`/guilds/${guildId}/channels`, {
        method: "POST",
        body: JSON.stringify({
            name: channelName,
            type: 0, // GUILD_TEXT
            parent_id: categoryId,
            topic: `🔒 Room IDs for ${topicLabel} — auto-managed by Bimon`,
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

/**
 * Grant a Discord user access to a specific tournament channel.
 * They can VIEW the channel and CREATE/REPLY to THREADS but NOT send regular messages.
 */
export async function grantChannelAccess(channelId: string, discordUserId: string): Promise<void> {
    // VIEW_CHANNEL (1<<10) + CREATE_PUBLIC_THREADS (1<<35) + SEND_MESSAGES_IN_THREADS (1<<38)
    // = 1024 + 34359738368 + 274877906944 = 309237646336
    const allow = "309237646336";
    const res = await discordFetch(`/channels/${channelId}/permissions/${discordUserId}`, {
        method: "PUT",
        body: JSON.stringify({
            type: 1,   // member (user)
            allow,
        }),
    });
    if (!res.ok) {
        const errorBody = await res.text().catch(() => "unknown");
        console.error(`Discord grantChannelAccess failed [${res.status}]:`, errorBody);
    }
}

/**
 * Revoke a Discord user's VIEW_CHANNEL access from a specific channel.
 * Deletes the per-user permission overwrite.
 */
export async function revokeChannelAccess(channelId: string, discordUserId: string): Promise<void> {
    const res = await discordFetch(`/channels/${channelId}/permissions/${discordUserId}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const errorBody = await res.text().catch(() => "unknown");
        console.error(`Discord revokeChannelAccess failed [${res.status}]:`, errorBody);
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
    image?: string; // optional base64 data URL
    group?: string; // championship group name: "A", "B", "C", etc.
}

/**
 * Send room info to a tournament-specific Discord channel.
 * For championship heats, routes to group-specific channels.
 * Auto-creates the channel on first send and stores it on the tournament.
 */
export async function sendRoomInfo(payload: RoomInfoPayload): Promise<void> {
    // Dynamic import to avoid circular deps
    const { prisma } = await import("@/lib/database");

    // 1. Get or create the channel
    const tournament = await prisma.tournament.findUnique({
        where: { id: payload.tournamentId },
        select: {
            discordChannelId: true,
            discordGroupChannels: true,
        },
    });

    let channelId: string | null | undefined;
    const group = payload.group;

    if (group) {
        // Championship group channel
        const groupChannels = (tournament?.discordGroupChannels as Record<string, string>) || {};
        channelId = groupChannels[group] || null;
    } else {
        channelId = tournament?.discordChannelId;
    }

    if (!channelId) {
        // Create the channel
        const suffix = group ? `group-${group.toLowerCase()}` : undefined;
        channelId = await createTournamentChannel(payload.tournamentName, suffix);

        // Store it on the tournament
        if (group) {
            const groupChannels = (tournament?.discordGroupChannels as Record<string, string>) || {};
            groupChannels[group] = channelId;
            await prisma.tournament.update({
                where: { id: payload.tournamentId },
                data: { discordGroupChannels: groupChannels },
            });
        } else {
            await prisma.tournament.update({
                where: { id: payload.tournamentId },
                data: { discordChannelId: channelId },
            });
        }

        // Grant access to the right players
        const playerFilter: any = {
            teams: { some: { tournamentId: payload.tournamentId } },
            discordId: { not: null },
        };

        // For group channels, only grant access to players in that group
        if (group) {
            playerFilter.teams = {
                some: {
                    tournamentId: payload.tournamentId,
                    championshipEntry: { group },
                },
            };
        }

        const teamPlayers = await prisma.player.findMany({
            where: playerFilter,
            select: { discordId: true },
        });
        const discordIds = teamPlayers.map(p => p.discordId).filter((id): id is string => !!id);
        await batchGrantChannelAccess(channelId!, discordIds);
    }

    // 2. Send the rich embed (with optional image attachment)
    const embed: any = {
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

    let res: Response;

    if (payload.image) {
        // Multipart upload: embed + image in one message
        const base64Data = payload.image.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const filename = `match-${payload.matchNumber}.png`;

        // Reference the attached file in the embed
        embed.image = { url: `attachment://${filename}` };

        const boundary = "----BimonRoomInfo" + Date.now();
        const messagePayload = {
            content: "@everyone 🚨 Room info is here! Join now!",
            embeds: [embed],
            attachments: [{ id: 0, filename }],
        };

        const parts: Buffer[] = [];
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="payload_json"\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            JSON.stringify(messagePayload) +
            `\r\n`
        ));
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="files[0]"; filename="${filename}"\r\n` +
            `Content-Type: image/png\r\n\r\n`
        ));
        parts.push(imageBuffer);
        parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

        res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: Buffer.concat(parts),
        });
    } else {
        // Simple JSON message (no image)
        res = await discordFetch(`/channels/${channelId}/messages`, {
            method: "POST",
            body: JSON.stringify({
                embeds: [embed],
                content: "@everyone 🚨 Room info is here! Join now!",
            }),
        });
    }

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

// ─── Tournament Rules ───────────────────────────────────────

/**
 * Send saved tournament rules to a tournament's Discord channel.
 * Reads rules from AppConfig (managed via /api/settings/tournament-rules).
 * Each rule becomes a Discord embed with optional image.
 */
export async function sendTournamentRules(tournamentId: string, tournamentName: string): Promise<void> {
    const { prisma } = await import("@/lib/database");

    // Get channel (or create it)
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { discordChannelId: true },
    });

    let channelId = tournament?.discordChannelId;
    if (!channelId) {
        channelId = await createTournamentChannel(tournamentName);
        await prisma.tournament.update({
            where: { id: tournamentId },
            data: { discordChannelId: channelId },
        });
    }

    // Load saved rules from AppConfig
    const rulesRow = await prisma.appConfig.findUnique({
        where: { key: "tournament_rules" },
    });

    interface SavedRule { id: string; text: string; imageUrl?: string }
    const rules: SavedRule[] = rulesRow ? JSON.parse(rulesRow.value) : [];

    if (rules.length === 0) {
        // No rules saved — send a simple message
        await discordFetch(`/channels/${channelId}/messages`, {
            method: "POST",
            body: JSON.stringify({
                content: `📜 No tournament rules configured yet. Add them in Dashboard → Room Info → Edit Rules.`,
            }),
        });
        return;
    }

    // Build embeds from saved rules (Discord allows max 10 embeds per message)
    const colors = [0xef4444, 0xf59e0b, 0x22c55e, 0x3b82f6, 0x8b5cf6, 0xec4899];
    const ruleEmbeds = rules.slice(0, 9).map((rule, idx) => {
        const embed: any = {
            description: rule.text,
            color: colors[idx % colors.length],
        };
        if (rule.imageUrl) {
            embed.image = { url: rule.imageUrl };
        }
        return embed;
    });

    // Add a link embed at the bottom
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bgmi.pixel-thread.in";
    ruleEmbeds.push({
        description: `📖 [**View full rules on the website →**](${siteUrl}/rules)`,
        color: 0x5865f2, // Discord blurple
    });

    // Send embeds (max 10 per message)
    const res = await discordFetch(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
            content: `@everyone 📜 **Tournament Rules — ${tournamentName}**`,
            embeds: ruleEmbeds,
        }),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => "unknown");
        throw new Error(`Discord sendRules failed [${res.status}]: ${err}`);
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
