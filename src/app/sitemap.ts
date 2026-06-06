import type { MetadataRoute } from "next";

/**
 * sitemap.xml — lists all public, content-rich pages for search engines.
 * This helps Google discover and index all pages that have publisher content.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://bgmi.pixel-thread.in";
    const now = new Date();

    const blogSlugs = [
        "what-is-bimon",
        "bgmi-best-landing-spots",
        "how-to-create-clan",
        "ranked-vs-casual-tournaments",
        "bgmi-weapon-tier-list",
        "how-scoring-works",
        "how-wallets-work",
        "team-balancing-algorithm",
        "championship-format-guide",
        "prize-pool-distribution",
        "improve-kd-ratio",
        "tips-to-climb-leaderboard",
        "season-system-explained",
        "tournament-formats-explained",
        "community-guidelines",
    ];

    return [
        {
            url: baseUrl,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 1.0,
        },
        {
            url: `${baseUrl}/players`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/vote`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/tournaments`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/leaderboard`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/rules`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/winners`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/blog`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/faq`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        ...blogSlugs.map((slug) => ({
            url: `${baseUrl}/blog/${slug}`,
            lastModified: now,
            changeFrequency: "monthly" as const,
            priority: 0.7,
        })),
        {
            url: `${baseUrl}/about`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/help`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/community`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/recent-matches`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/privacy`,
            lastModified: now,
            changeFrequency: "yearly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified: now,
            changeFrequency: "yearly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/contact`,
            lastModified: now,
            changeFrequency: "yearly",
            priority: 0.6,
        },
        {
            url: `${baseUrl}/socials`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.6,
        },
    ];
}
