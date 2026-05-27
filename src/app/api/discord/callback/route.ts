import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { discordFetch, getGuildId } from "@/lib/discord-bot";
import { grantRole } from "@/lib/discord-service";

/**
 * GET /api/discord/callback
 *
 * Discord OAuth2 callback — exchanges the authorization code for an access token,
 * fetches the user's Discord profile, saves it to Player, and grants the role.
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // pollId
    const errorParam = searchParams.get("error");

    // User denied access
    if (errorParam) {
        return NextResponse.redirect(
            new URL(`/vote?tab=ranked&discord=denied`, req.url)
        );
    }

    if (!code) {
        return NextResponse.redirect(
            new URL(`/vote?tab=ranked&discord=error`, req.url)
        );
    }

    try {
        // 1. Get current user (must be logged in)
        const user = await getCurrentUser();
        if (!user?.player?.id) {
            return NextResponse.redirect(
                new URL(`/sign-in`, req.url)
            );
        }

        // 2. Exchange code for access token
        const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID!,
                client_secret: process.env.DISCORD_CLIENT_SECRET!,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI!,
            }),
        });

        if (!tokenRes.ok) {
            console.error("Discord token exchange failed:", await tokenRes.text());
            return NextResponse.redirect(
                new URL(`/vote?tab=ranked&discord=error`, req.url)
            );
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // 3. Get Discord user profile
        const userRes = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userRes.ok) {
            return NextResponse.redirect(
                new URL(`/vote?tab=ranked&discord=error`, req.url)
            );
        }

        const discordUser = await userRes.json();
        const discordId = discordUser.id;
        const discordUsername = discordUser.username;

        // 4. Check if this Discord account is already linked to another player
        const existing = await prisma.player.findFirst({
            where: {
                discordId,
                id: { not: user.player.id },
            },
            select: { id: true },
        });

        if (existing) {
            return NextResponse.redirect(
                new URL(`/vote?tab=ranked&discord=already_linked`, req.url)
            );
        }

        // 5. Save Discord ID to player
        await prisma.player.update({
            where: { id: user.player.id },
            data: { discordId, discordUsername },
        });

        // 6. Check if user is in the guild and grant role
        const guildId = getGuildId();
        const memberRes = await discordFetch(`/guilds/${guildId}/members/${discordId}`);
        const roleId = process.env.DISCORD_RANKED_PLAYER_ROLE_ID;

        if (memberRes.ok && roleId) {
            // User is in the server — grant role
            await grantRole(discordId, roleId);
        }

        // 7. Redirect back to app
        const redirectUrl = state
            ? `/vote?tab=ranked&poll=${state}&discord=linked`
            : `/vote?tab=ranked&discord=linked`;

        return NextResponse.redirect(new URL(redirectUrl, req.url));
    } catch (error) {
        console.error("Discord OAuth callback error:", error);
        return NextResponse.redirect(
            new URL(`/vote?tab=ranked&discord=error`, req.url)
        );
    }
}
