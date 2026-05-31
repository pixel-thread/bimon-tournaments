import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCurrentUser } from "@/lib/auth";
import { discordFetch, getGuildId } from "@/lib/discord-bot";

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
    const isOnboardingReturn = returnTo === "onboarding";
    const isInviteReturn = returnTo?.startsWith("invite_");
    const inviteSquadId = isInviteReturn ? returnTo.replace("invite_", "") : null;

    /** Build redirect URL based on return context */
    function getRedirectUrl(suffix: string): string {
        if (isOnboardingReturn) return `/onboarding?discord=${suffix}`;
        if (isProfileReturn) return `/profile?discord=${suffix}`;
        if (isInviteReturn && inviteSquadId) return `/invite/${inviteSquadId}?discord=${suffix}`;
        return `/vote?tab=ranked&discord=${suffix}`;
    }

    // User denied access
    if (errorParam) {
        return NextResponse.redirect(new URL(getRedirectUrl("denied"), req.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL(getRedirectUrl("error"), req.url));
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
            return NextResponse.redirect(new URL(getRedirectUrl("error"), req.url));
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // 3. Get Discord user profile
        const userRes = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userRes.ok) {
            return NextResponse.redirect(new URL(getRedirectUrl("error"), req.url));
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
            return NextResponse.redirect(new URL(getRedirectUrl("already_linked"), req.url));
        }

        // 5. Save Discord ID to player
        await prisma.player.update({
            where: { id: user.player.id },
            data: { discordId, discordUsername },
        });

        // 6. Ensure user is in the Discord server
        const guildId = getGuildId();
        const memberRes = await discordFetch(`/guilds/${guildId}/members/${discordId}`);

        if (!memberRes.ok) {
            // User not in server — auto-add them using guilds.join scope
            const joinRes = await discordFetch(`/guilds/${guildId}/members/${discordId}`, {
                method: "PUT",
                body: JSON.stringify({
                    access_token: accessToken,
                }),
            });

            // 201 = added, 204 = already member
            if (!joinRes.ok && joinRes.status !== 204) {
                const errBody = await joinRes.text().catch(() => "unknown");
                console.error(`[discord-callback] Auto-join failed for ${discordUsername} (${discordId}) [${joinRes.status}]:`, errBody);
            } else {
                console.log(`[discord-callback] Auto-joined ${discordUsername} (${discordId}) to guild`);
            }
        }

        // 7. Verify they're actually in the server — if not, rollback and block
        const verifyRes = await discordFetch(`/guilds/${guildId}/members/${discordId}`);
        if (!verifyRes.ok) {
            // Rollback: clear discordId since they're not in the server
            await prisma.player.update({
                where: { id: user.player.id },
                data: { discordId: null, discordUsername: null },
            });
            console.error(`[discord-callback] ${discordUsername} (${discordId}) is NOT in the server after auto-join attempt — blocking link`);
            return NextResponse.redirect(new URL(getRedirectUrl("not_in_server"), req.url));
        }

        // 7. Redirect back to app
        let redirectUrl: string;
        if (isOnboardingReturn) {
            redirectUrl = `/onboarding?discord=linked`;
        } else if (isProfileReturn) {
            redirectUrl = `/profile?discord=linked`;
        } else if (pollId) {
            redirectUrl = `/vote?tab=ranked&poll=${pollId}&discord=linked`;
        } else {
            redirectUrl = `/vote?tab=ranked&discord=linked`;
        }

        return NextResponse.redirect(new URL(redirectUrl, req.url));
    } catch (error) {
        console.error("Discord OAuth callback error:", error);
        return NextResponse.redirect(new URL(getRedirectUrl("error"), req.url));
    }
}
