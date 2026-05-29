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
    const rawState = searchParams.get("state") || "";
    const errorParam = searchParams.get("error");

    // State format: "pollId|returnTo" (pipe-delimited)
    const [pollId, returnTo] = rawState.split("|");
    const isProfileReturn = returnTo === "profile";

    // User denied access
    if (errorParam) {
        const errorUrl = isProfileReturn
            ? `/profile?discord=denied`
            : `/vote?tab=ranked&discord=denied`;
        return NextResponse.redirect(new URL(errorUrl, req.url));
    }

    if (!code) {
        const errorUrl = isProfileReturn
            ? `/profile?discord=error`
            : `/vote?tab=ranked&discord=error`;
        return NextResponse.redirect(new URL(errorUrl, req.url));
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
            const errorUrl = isProfileReturn
                ? `/profile?discord=error`
                : `/vote?tab=ranked&discord=error`;
            return NextResponse.redirect(new URL(errorUrl, req.url));
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // 3. Get Discord user profile
        const userRes = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userRes.ok) {
            const errorUrl = isProfileReturn
                ? `/profile?discord=error`
                : `/vote?tab=ranked&discord=error`;
            return NextResponse.redirect(new URL(errorUrl, req.url));
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
            const alreadyUrl = isProfileReturn
                ? `/profile?discord=already_linked`
                : `/vote?tab=ranked&discord=already_linked`;
            return NextResponse.redirect(new URL(alreadyUrl, req.url));
        }

        // 5. Save Discord ID to player
        await prisma.player.update({
            where: { id: user.player.id },
            data: { discordId, discordUsername },
        });

        // 6. Auto-join user to server (if not already a member) + grant role
        const guildId = getGuildId();
        const roleId = process.env.DISCORD_RANKED_PLAYER_ROLE_ID;
        const memberRes = await discordFetch(`/guilds/${guildId}/members/${discordId}`);

        if (!memberRes.ok) {
            // User not in server — auto-add them using guilds.join scope
            await discordFetch(`/guilds/${guildId}/members/${discordId}`, {
                method: "PUT",
                body: JSON.stringify({
                    access_token: accessToken,
                    // Auto-assign the Ranked-Player role on join
                    ...(roleId ? { roles: [roleId] } : {}),
                }),
            });
        } else if (roleId) {
            // Already in server — just grant the role
            await grantRole(discordId, roleId);
        }

        // 7. Redirect back to app
        let redirectUrl: string;
        if (isProfileReturn) {
            redirectUrl = `/profile?discord=linked`;
        } else if (pollId) {
            redirectUrl = `/vote?tab=ranked&poll=${pollId}&discord=linked`;
        } else {
            redirectUrl = `/vote?tab=ranked&discord=linked`;
        }

        return NextResponse.redirect(new URL(redirectUrl, req.url));
    } catch (error) {
        console.error("Discord OAuth callback error:", error);
        const errorUrl = isProfileReturn
            ? `/profile?discord=error`
            : `/vote?tab=ranked&discord=error`;
        return NextResponse.redirect(new URL(errorUrl, req.url));
    }
}
