import type { MetadataRoute } from "next";

/**
 * sitemap.xml — lists all public, content-rich pages for search engines.
 * This helps Google discover and index all pages that have publisher content.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://pixel-thread.in";
    const now = new Date();

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
