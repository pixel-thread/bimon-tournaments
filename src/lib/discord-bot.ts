import { Client, GatewayIntentBits, REST, Routes } from "discord.js";

/**
 * Discord Bot — Lazy singleton client.
 *
 * The bot connects on first use and stays connected for the life of the
 * serverless function invocation. In production (Vercel), each cold start
 * creates a new connection; warm invocations reuse it.
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN
 *   DISCORD_GUILD_ID
 */

let _client: Client | null = null;
let _rest: REST | null = null;

function getToken(): string {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
    return token;
}

function getGuildId(): string {
    const id = process.env.DISCORD_GUILD_ID;
    if (!id) throw new Error("DISCORD_GUILD_ID is not set");
    return id;
}

/**
 * Get the Discord REST client (no gateway connection needed).
 * Preferred for API-only operations like role management.
 */
export function getDiscordRest(): REST {
    if (!_rest) {
        _rest = new REST({ version: "10" }).setToken(getToken());
    }
    return _rest;
}

/**
 * Get the full Discord.js client (with gateway).
 * Only use this if you need real-time events.
 */
export async function getDiscordClient(): Promise<Client> {
    if (_client?.isReady()) return _client;

    _client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    await _client.login(getToken());
    return _client;
}

export { getGuildId };
