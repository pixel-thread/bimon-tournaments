import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/discord/authorize
 *
 * Server-side redirect to Discord OAuth.
 * Routing through our own server prevents Android/iOS from
 * intercepting the discord.com URL and opening the Discord app
 * (which doesn't handle OAuth authorize URLs properly).
 *
 * Query params:
 *   - returnTo: where to redirect after linking (e.g. "profile", "vote", "onboarding", "invite_xxx")
 *   - pollId:   optional poll ID to include in state
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const returnTo = searchParams.get("returnTo") || "";
    const pollId = searchParams.get("pollId") || "";

    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return NextResponse.json(
            { error: "Discord OAuth is not configured" },
            { status: 500 }
        );
    }

    // Build state: "pollId|returnTo" (same format the callback expects)
    const state = `${pollId}|${returnTo}`;

    const discordUrl = new URL("https://discord.com/oauth2/authorize");
    discordUrl.searchParams.set("client_id", clientId);
    discordUrl.searchParams.set("redirect_uri", redirectUri);
    discordUrl.searchParams.set("response_type", "code");
    discordUrl.searchParams.set("scope", "identify guilds.join");
    discordUrl.searchParams.set("state", state);
    // prompt=consent forces the auth screen even if previously authorized
    discordUrl.searchParams.set("prompt", "consent");

    return NextResponse.redirect(discordUrl.toString());
}
