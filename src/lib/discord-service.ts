import { Routes } from "discord.js";
import { getDiscordRest, getGuildId } from "./discord-bot";

/**
 * Discord Service — Business logic for tournament Discord operations.
 *
 * All functions use the REST API (no gateway needed).
 * Designed for serverless — each call is stateless.
 */

// ─── Role Management ────────────────────────────────────────

/**
 * Grant a role to a Discord user.
 */
export async function grantRole(discordUserId: string, roleId: string): Promise<void> {
    const rest = getDiscordRest();
    const guildId = getGuildId();
    await rest.put(
        Routes.guildMemberRole(guildId, discordUserId, roleId)
    );
}

/**
 * Revoke a role from a Discord user.
 */
export async function revokeRole(discordUserId: string, roleId: string): Promise<void> {
    const rest = getDiscordRest();
    const guildId = getGuildId();
    await rest.delete(
        Routes.guildMemberRole(guildId, discordUserId, roleId)
    );
}

/**
 * Revoke a role from multiple Discord users.
 * Skips users who don't have the role (no error).
 */
export async function revokeRoleFromAll(discordUserIds: string[], roleId: string): Promise<void> {
    const rest = getDiscordRest();
    const guildId = getGuildId();
    await Promise.allSettled(
        discordUserIds.map((userId) =>
            rest.delete(Routes.guildMemberRole(guildId, userId, roleId))
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
    const rest = getDiscordRest();
    const guildId = getGuildId();

    try {
        // Search guild members by query (Discord API v10)
        const members = (await rest.get(
            Routes.guildMembersSearch(guildId),
            { query: new URLSearchParams({ query: username, limit: "5" }) }
        )) as DiscordMember[];

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
    const rest = getDiscordRest();
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

    await rest.post(Routes.channelMessages(channelId), {
        body: {
            embeds: [embed],
            content: "@everyone 🚨 Room info is here! Join now!",
        },
    });
}
