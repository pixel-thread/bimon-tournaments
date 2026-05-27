/**
 * Discord Bot — Lightweight REST-only client.
 *
 * Uses plain fetch() instead of discord.js to avoid
 * native module issues on serverless (Vercel).
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN
 *   DISCORD_GUILD_ID
 */

const DISCORD_API = "https://discord.com/api/v10";

function getToken(): string {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
    return token;
}

export function getGuildId(): string {
    const id = process.env.DISCORD_GUILD_ID;
    if (!id) throw new Error("DISCORD_GUILD_ID is not set");
    return id;
}

/**
 * Make an authenticated request to the Discord API.
 */
export async function discordFetch(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const url = `${DISCORD_API}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bot ${getToken()}`,
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
    return res;
}
