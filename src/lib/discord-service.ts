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

// ─── Room Info Embed ────────────────────────────────────────

interface RoomInfoPayload {
    tournamentName: string;
    matchNumber: number;
    map: string;
    time: string;
    roomId: string;
    password: string;
    gameName: string;
}

/**
 * Send a rich embed with room info to the ranked room ID channel.
 */
export async function sendRoomInfo(payload: RoomInfoPayload): Promise<void> {
    const channelId = process.env.DISCORD_RANKED_ROOM_CHANNEL_ID;
    if (!channelId) throw new Error("DISCORD_RANKED_ROOM_CHANNEL_ID is not set");

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
}
