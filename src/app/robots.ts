import type { MetadataRoute } from "next";

/**
 * robots.txt — tells search engines (and AdSense crawlers) what to crawl.
 * Allows all content pages while blocking dashboard/API/auth routes.
 */
export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://pixel-thread.in";

    return {
        rules: [
            {
                userAgent: "*",
                allow: [
                    "/",
                    "/players",
                    "/vote",
                    "/rules",
                    "/winners",
                    "/help",
                    "/community",
                    "/socials",
                    "/privacy",
                    "/terms",
                    "/contact",
                    "/recent-matches",
                    "/tournaments",
                    "/leaderboard",
                    "/about",
                    "/blog",
                ],
                disallow: [
                    "/api/",
                    "/dashboard/",
                    "/settings/",
                    "/profile/",
                    "/wallet/",
                    "/onboarding/",
                    "/sign-in/",
                    "/sign-up/",
                    "/sso-callback/",
                    "/clan/",
                    "/refer/",
                    "/coupon/",
                    "/royal-pass/",
                    "/promoter/",
                    "/notifications/",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
