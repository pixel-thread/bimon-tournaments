import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { GAME } from "@/lib/game-config";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `${GAME.gameName} Tournament Guides & Tips | Bimon Blog`,
    description: `Learn about ${GAME.gameName} tournament strategies, scoring systems, team balancing, and prize distribution on Bimon. Guides and tips for competitive mobile gaming.`,
};

interface BlogPost {
    slug: string;
    title: string;
    description: string;
    date: string;
    readTime: string;
    category: string;
}

const POSTS: BlogPost[] = [
    {
        slug: "what-is-bimon",
        title: "What is Bimon? A Complete Guide to the Tournament Platform",
        description: "Everything you need to know about Bimon — the community-driven BGMI esports platform with fair team balancing, UC prize pools, and competitive leaderboards.",
        date: "2026-06-01",
        readTime: "6 min read",
        category: "Guides",
    },
    {
        slug: "bgmi-best-landing-spots",
        title: "Best Landing Spots in BGMI: A Map-by-Map Strategy Guide",
        description: "Discover the best drop locations for Erangel, Miramar, and Sanhok in BGMI tournaments. Learn hot drops, safe rotations, and loot-rich spots for competitive play.",
        date: "2026-05-28",
        readTime: "7 min read",
        category: "Tips & Strategy",
    },
    {
        slug: "how-to-create-clan",
        title: "How to Create & Manage a Clan on Bimon",
        description: "Step-by-step guide to creating a clan on Bimon, inviting members, managing your clan treasury, and competing in clan-based tournaments.",
        date: "2026-05-25",
        readTime: "5 min read",
        category: "Guides",
    },
    {
        slug: "ranked-vs-casual-tournaments",
        title: "Ranked vs Casual Tournaments: Which Should You Play?",
        description: "Understand the key differences between Ranked and Casual tournament modes on Bimon — team formation, scoring, leaderboards, and which one suits your playstyle.",
        date: "2026-05-22",
        readTime: "5 min read",
        category: "Guides",
    },
    {
        slug: "bgmi-weapon-tier-list",
        title: "BGMI Weapon Tier List: Best Guns for Tournament Play",
        description: "A comprehensive tier list of the best weapons in BGMI for competitive tournament play. Learn which guns to prioritize for kills and survival in Bimon tournaments.",
        date: "2026-05-18",
        readTime: "6 min read",
        category: "Tips & Strategy",
    },
    {
        slug: "how-scoring-works",
        title: "How Tournament Scoring Works in Bimon",
        description: "A deep dive into placement points, kill points, and how your total score determines your ranking in every Battle Royale tournament.",
        date: "2026-05-15",
        readTime: "4 min read",
        category: "Guides",
    },
    {
        slug: "how-wallets-work",
        title: "How the BP Wallet System Works on Bimon",
        description: "A complete guide to the Bimon wallet system — how to deposit BP, receive tournament prizes, request withdrawals, and manage your competitive earnings.",
        date: "2026-05-12",
        readTime: "5 min read",
        category: "Guides",
    },
    {
        slug: "team-balancing-algorithm",
        title: "How Teams Are Balanced: The Algorithm Behind Fair Matches",
        description: "Learn how Bimon's team-generation algorithm creates skill-balanced squads using K/D ratios, kill averages, and historical performance data.",
        date: "2026-05-10",
        readTime: "5 min read",
        category: "Behind the Scenes",
    },
    {
        slug: "championship-format-guide",
        title: "Championship Format: Groups, Heats & Finals Explained",
        description: "A detailed guide to how championships work on Bimon — from group stages and heat rounds to the grand finals. Understand the competitive ladder.",
        date: "2026-05-08",
        readTime: "5 min read",
        category: "Guides",
    },
    {
        slug: "prize-pool-distribution",
        title: "Prize Pool Distribution: How Winners Get Paid",
        description: "Understanding the geometric decay system that determines how prize pools are split among top-performing teams in every tournament.",
        date: "2026-05-05",
        readTime: "4 min read",
        category: "Guides",
    },
    {
        slug: "improve-kd-ratio",
        title: "How to Improve Your K/D Ratio in BGMI Tournaments",
        description: "Practical tips and strategies to improve your kill-to-death ratio in competitive BGMI tournament play on Bimon. From positioning to weapon skills.",
        date: "2026-05-02",
        readTime: "6 min read",
        category: "Tips & Strategy",
    },
    {
        slug: "tips-to-climb-leaderboard",
        title: "5 Tips to Climb the Bimon Leaderboard",
        description: "Practical strategies for improving your tournament performance, from positioning tips to kill maximization and team coordination.",
        date: "2026-04-28",
        readTime: "3 min read",
        category: "Tips & Strategy",
    },
    {
        slug: "season-system-explained",
        title: "Seasons, Resets & Leaderboards: How the Season System Works",
        description: "Everything about Bimon's seasonal system — when seasons reset, how leaderboards carry over, and what seasonal rewards look like.",
        date: "2026-04-25",
        readTime: "4 min read",
        category: "Behind the Scenes",
    },
    {
        slug: "tournament-formats-explained",
        title: "Tournament Formats Explained: BR, TDM, 1v1 & More",
        description: "A comprehensive guide to every tournament format available on Bimon — from classic Battle Royale to World Cup-style Group + Knockout.",
        date: "2026-04-20",
        readTime: "5 min read",
        category: "Guides",
    },
    {
        slug: "community-guidelines",
        title: "Community Guidelines: Fair Play & Sportsmanship on Bimon",
        description: "Bimon's community guidelines covering fair play, sportsmanship, reporting, and the merit system. Learn what's expected of every player on the platform.",
        date: "2026-04-18",
        readTime: "5 min read",
        category: "Guides",
    },
];

const CATEGORY_COLORS: Record<string, string> = {
    "Guides": "text-blue-400 bg-blue-400/10",
    "Behind the Scenes": "text-violet-400 bg-violet-400/10",
    "Tips & Strategy": "text-emerald-400 bg-emerald-400/10",
};

export default function BlogPage() {
    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60">
                        <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                        Blog
                    </div>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        {GAME.gameName} Tournament Guides & Tips
                    </h1>
                    <p className="mt-2 text-base text-foreground/50">
                        Deep dives into tournament mechanics, strategy guides, and behind-the-scenes looks at how
                        Bimon builds fair, competitive {GAME.gameName} experiences.
                    </p>
                </div>

                {/* Posts */}
                <div className="space-y-4">
                    {POSTS.map((post) => (
                        <Link key={post.slug} href={`/blog/${post.slug}`}>
                            <article className="group rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 transition-all hover:bg-foreground/[0.04] hover:border-foreground/15">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CATEGORY_COLORS[post.category] ?? "text-foreground/40 bg-foreground/5"}`}>
                                                {post.category}
                                            </span>
                                            <span className="text-[11px] text-foreground/30">{post.readTime}</span>
                                        </div>
                                        <h2 className="text-lg font-bold group-hover:text-blue-400 transition-colors">
                                            {post.title}
                                        </h2>
                                        <p className="mt-1.5 text-sm text-foreground/50 line-clamp-2">
                                            {post.description}
                                        </p>
                                        <span className="mt-2 text-xs text-foreground/30">
                                            {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                        </span>
                                    </div>
                                    <ChevronRight className="mt-6 h-5 w-5 shrink-0 text-foreground/20 group-hover:text-blue-400 transition-colors" />
                                </div>
                            </article>
                        </Link>
                    ))}
                </div>

                {/* SEO Footer */}
                <div className="mt-16 space-y-4 text-sm text-foreground/50">
                    <p>
                        The Bimon blog covers everything from tournament strategy and scoring mechanics to
                        behind-the-scenes looks at our team-balancing algorithms. Whether you&apos;re new to
                        competitive {GAME.gameName} or a veteran looking to optimize your gameplay, our guides
                        are written by tournament organizers who understand the competitive landscape.
                    </p>
                </div>

                <div className="mt-12 border-t border-foreground/10 pt-6">
                    <Link href="/" className="text-sm text-foreground/40 hover:text-foreground/60 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
