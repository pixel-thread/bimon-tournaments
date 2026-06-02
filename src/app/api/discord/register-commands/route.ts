import { NextResponse } from "next/server";
import { discordFetch, getGuildId } from "@/lib/discord-bot";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/discord/register-commands
 *
 * Registers (or updates) the bot's slash commands with Discord.
 * Admin-only. Call this once after adding new commands.
 */
export async function POST() {
    const user = await getCurrentUser();
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const appId = process.env.DISCORD_CLIENT_ID;
    if (!appId) {
        return NextResponse.json({ error: "DISCORD_CLIENT_ID not set" }, { status: 500 });
    }

    const guildId = getGuildId();

    // Define all slash commands
    const commands = [
        {
            name: "nextmatch",
            description: "See your active tournaments, team, and teammates",
            type: 1, // CHAT_INPUT
        },
    ];

    try {
        // Register guild-scoped commands (instant, no 1h cache)
        const res = await discordFetch(
            `/applications/${appId}/guilds/${guildId}/commands`,
            {
                method: "PUT",
                body: JSON.stringify(commands),
            },
        );

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: res.statusText }));
            console.error("Command registration failed:", error);
            return NextResponse.json({ error: "Registration failed", details: error }, { status: res.status });
        }

        const registered = await res.json();
        console.log(`✅ Registered ${registered.length} slash command(s)`);

        return NextResponse.json({
            success: true,
            commands: registered.map((c: any) => ({ name: c.name, id: c.id })),
        });
    } catch (error) {
        console.error("Command registration error:", error);
        return NextResponse.json({ error: "Failed to register commands" }, { status: 500 });
    }
}
