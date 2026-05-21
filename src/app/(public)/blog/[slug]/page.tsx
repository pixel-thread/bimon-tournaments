import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAME } from "@/lib/game-config";
import type { Metadata } from "next";

// ─── Blog Post Content ─────────────────────────────────────

interface BlogPostContent {
    title: string;
    description: string;
    date: string;
    readTime: string;
    category: string;
    content: React.ReactNode;
}

const POSTS: Record<string, BlogPostContent> = {
    "how-scoring-works": {
        title: "How Tournament Scoring Works in Bimon",
        description: "A deep dive into placement points, kill points, and how your total score determines your ranking in every Battle Royale tournament.",
        date: "2026-05-15",
        readTime: "4 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    Understanding how scoring works is the first step to improving your tournament performance on Bimon.
                    Our scoring system is designed to reward both survival strategy and aggressive gameplay, ensuring
                    that different playstyles can all succeed.
                </p>

                <h2>Placement Points</h2>
                <p>
                    Every team earns points based on their final placement in a match. The scoring follows
                    a standard competitive format used in professional BGMI tournaments:
                </p>
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-foreground/[0.05] text-left text-xs uppercase tracking-wider text-foreground/40">
                                <th className="px-4 py-2">Placement</th>
                                <th className="px-4 py-2">Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            {[
                                ["🥇 1st Place (Winner Winner Chicken Dinner)", "10"],
                                ["🥈 2nd Place", "6"],
                                ["🥉 3rd Place", "5"],
                                ["4th Place", "4"],
                                ["5th Place", "3"],
                                ["6th Place", "2"],
                                ["7th–8th Place", "1"],
                                ["9th–16th Place", "0"],
                            ].map(([place, pts]) => (
                                <tr key={place}>
                                    <td className="px-4 py-2">{place}</td>
                                    <td className="px-4 py-2 font-bold">{pts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>Kill Points</h2>
                <p>
                    Every elimination your team earns adds <strong>1 point per kill</strong> to your team&apos;s total.
                    This system rewards aggressive players who push fights and secure eliminations, not just players
                    who hide until the final circle.
                </p>
                <p>
                    Your total match score is simply: <strong>Placement Points + Kill Points</strong>.
                    For example, a team that finishes 2nd with 8 kills would score 6 + 8 = 14 points.
                </p>

                <h2>Multi-Match Tournaments</h2>
                <p>
                    In tournaments with multiple matches, your scores are aggregated across all games.
                    This means consistency matters — a player who performs well across multiple matches will
                    rank higher than one who has one great game and several poor ones.
                </p>

                <h2>Individual Player Stats</h2>
                <p>
                    While team placement determines prize distribution, individual stats (kills, K/D ratio,
                    average damage) are tracked on your player profile. These stats influence your tier ranking
                    on the leaderboard and how the team-balancing algorithm assigns you to future squads.
                </p>

                <h2>Why This Scoring System?</h2>
                <p>
                    Our scoring system strikes a balance between survival and aggression. Pure campers get
                    minimal points without kills, while ultra-aggressive players who die early miss out on
                    valuable placement points. The best players on Bimon master both — surviving to the
                    end while securing eliminations along the way.
                </p>
            </div>
        ),
    },

    "team-balancing-algorithm": {
        title: "How Teams Are Balanced: The Algorithm Behind Fair Matches",
        description: "Learn how Bimon's team-generation algorithm creates skill-balanced squads using K/D ratios, kill averages, and historical performance data.",
        date: "2026-05-10",
        readTime: "5 min read",
        category: "Behind the Scenes",
        content: (
            <div className="space-y-6">
                <p>
                    One of Bimon&apos;s core promises is fair competition. Unlike random matchmaking where you might
                    end up with all beginners or face a stacked squad of veterans, our team-generation algorithm
                    ensures every squad has a balanced mix of skill levels.
                </p>

                <h2>The Problem with Random Teams</h2>
                <p>
                    In random team generation, you might get lucky and end up with three high-K/D players,
                    or unlucky and be stuck with three new players. This leads to one-sided matches that aren&apos;t
                    fun for anyone — the winning team dominates without challenge, and the losing team feels
                    helpless. Bimon solves this with data-driven team balancing.
                </p>

                <h2>How It Works</h2>
                <p>
                    When you vote &quot;IN&quot; on a tournament poll, the system already knows your historical stats.
                    Here&apos;s the simplified process:
                </p>
                <ol className="space-y-3 list-decimal pl-5">
                    <li>
                        <strong>Player Rating:</strong> Each registered player gets a rating based on their
                        historical K/D ratio, average kills per match, and total matches played. New players
                        get a neutral rating.
                    </li>
                    <li>
                        <strong>Tier Assignment:</strong> Players are grouped into performance tiers (Conqueror,
                        Ace, Crown, Diamond, etc.) based on their rating. This gives the algorithm a clear
                        picture of skill distribution.
                    </li>
                    <li>
                        <strong>Snake Draft:</strong> The algorithm uses a snake-draft approach — the strongest
                        player goes to Team 1, second strongest to Team 2, and so on. When it reaches the last
                        team, it reverses direction. This ensures even distribution.
                    </li>
                    <li>
                        <strong>Historical Pairing Check:</strong> The system also checks recent tournaments to
                        avoid putting the same players together back-to-back. This keeps the experience fresh
                        and prevents repetitive team compositions.
                    </li>
                    <li>
                        <strong>Leftover Handling:</strong> If the player count doesn&apos;t divide evenly, the algorithm
                        ensures leftover players are distributed fairly rather than all being dumped into one team.
                    </li>
                </ol>

                <h2>Squad (Premade) Tournaments</h2>
                <p>
                    In Ranked tournaments where players form their own squads, the algorithm doesn&apos;t
                    control team composition — you play with your chosen teammates. However, the squad system
                    still tracks individual ratings, and squads are matched against other squads of similar
                    aggregate skill when possible.
                </p>

                <h2>The Result</h2>
                <p>
                    After hundreds of tournaments, our data shows that team-balanced matches have significantly
                    closer final scores than randomly assigned ones. The top team and bottom team typically
                    differ by less than 20% in total points — a sign that every match is genuinely competitive.
                </p>
            </div>
        ),
    },

    "prize-pool-distribution": {
        title: "Prize Pool Distribution: How Winners Get Paid",
        description: "Understanding the geometric decay system that determines how prize pools are split among top-performing teams in every tournament.",
        date: "2026-05-05",
        readTime: "4 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    Transparency in prize distribution is one of Bimon&apos;s core values. Every player should
                    know exactly how prize pools are calculated and distributed before they enter a tournament.
                    Here&apos;s how it works.
                </p>

                <h2>Prize Pool Formula</h2>
                <p>
                    The total prize pool is straightforward:
                </p>
                <div className="rounded-lg border border-foreground/10 bg-foreground/[0.05] px-4 py-3 text-center font-mono text-lg font-bold">
                    Prize Pool = Entry Fee × Total Players
                </div>
                <p className="mt-3">
                    If 16 squads of 4 players each enter a tournament with a 30 BP per-player entry fee,
                    the total pool is 30 × 64 = 1,920 BP. It&apos;s that simple — what goes in is what comes out.
                </p>

                <h2>Tier-Based Winner Count</h2>
                <p>
                    The number of winning positions depends on the total prize pool size:
                </p>
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-foreground/[0.05] text-left text-xs uppercase tracking-wider text-foreground/40">
                                <th className="px-4 py-2">Pool Size</th>
                                <th className="px-4 py-2">Positions Paid</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            <tr><td className="px-4 py-2">Under 1,200 BP</td><td className="px-4 py-2 font-bold">Top 3</td></tr>
                            <tr><td className="px-4 py-2">1,200 – 3,000 BP</td><td className="px-4 py-2 font-bold">Top 6</td></tr>
                            <tr><td className="px-4 py-2">3,000 – 6,000 BP</td><td className="px-4 py-2 font-bold">Top 8</td></tr>
                            <tr><td className="px-4 py-2">Over 6,000 BP</td><td className="px-4 py-2 font-bold">Top 10</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>Geometric Decay Distribution</h2>
                <p>
                    Within each tier, prizes are distributed using a <strong>50% geometric decay</strong> system.
                    This means each position earns roughly half of the position above it:
                </p>
                <ul className="space-y-1 list-disc pl-5">
                    <li>1st place gets the largest share</li>
                    <li>2nd place gets ~50% of 1st place</li>
                    <li>3rd place gets ~50% of 2nd place</li>
                    <li>And so on down the line</li>
                </ul>
                <p>
                    The last winning position always receives at least a refund of the entry fee — so the
                    worst-case scenario for a winning team is getting their entry fee back.
                </p>

                <h2>Example: 16 Squads, 120 BP Entry</h2>
                <p>
                    Total pool: 1,920 BP → Tier 2 (Top 6 paid):
                </p>
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-foreground/[0.05] text-left text-xs uppercase tracking-wider text-foreground/40">
                                <th className="px-4 py-2">Position</th>
                                <th className="px-4 py-2">Prize</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            <tr><td className="px-4 py-2">🥇 1st</td><td className="px-4 py-2 font-bold text-amber-400">894 BP</td></tr>
                            <tr><td className="px-4 py-2">🥈 2nd</td><td className="px-4 py-2 font-bold">444 BP</td></tr>
                            <tr><td className="px-4 py-2">🥉 3rd</td><td className="px-4 py-2 font-bold">222 BP</td></tr>
                            <tr><td className="px-4 py-2">4th</td><td className="px-4 py-2">120 BP</td></tr>
                            <tr><td className="px-4 py-2">5th</td><td className="px-4 py-2">120 BP</td></tr>
                            <tr><td className="px-4 py-2">6th</td><td className="px-4 py-2">120 BP</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>Automatic Distribution</h2>
                <p>
                    Once tournament results are finalized by admins, prizes are automatically deposited to
                    the winning players&apos; wallets. There&apos;s no manual payout process, no waiting for bank
                    transfers — it&apos;s instant and transparent.
                </p>
            </div>
        ),
    },

    "tips-to-climb-leaderboard": {
        title: "5 Tips to Climb the Bimon Leaderboard",
        description: "Practical strategies for improving your tournament performance, from positioning tips to kill maximization and team coordination.",
        date: "2026-04-28",
        readTime: "3 min read",
        category: "Tips & Strategy",
        content: (
            <div className="space-y-6">
                <p>
                    Climbing the Bimon leaderboard isn&apos;t just about raw aim — it&apos;s about consistent performance
                    across multiple tournaments. Here are five practical tips from top-ranked players.
                </p>

                <h2>1. Balance Kills with Survival</h2>
                <p>
                    Remember that your K/D ratio is kills divided by matches played, not deaths. Every match
                    you play without securing kills brings your K/D down. But dying early in hot drops
                    means zero placement points. The sweet spot is landing in medium-traffic areas where
                    you can secure 2-3 early kills while still surviving to the top 5.
                </p>

                <h2>2. Learn the Point System</h2>
                <p>
                    A team that finishes 1st with 3 kills scores 13 points (10 + 3). A team that finishes
                    5th with 10 kills scores 13 points (3 + 10). Understanding this math helps you make
                    strategic decisions — sometimes it&apos;s worth playing safe for placement instead of
                    pushing a risky fight.
                </p>

                <h2>3. Communicate with Your Random Team</h2>
                <p>
                    Even in casual tournaments with random teams, communication wins matches. Use the in-game
                    voice chat, call out enemy positions, and coordinate pushes. The squads that communicate
                    consistently outperform silent ones, even when individual skill levels are similar.
                </p>

                <h2>4. Play Consistently Across Matches</h2>
                <p>
                    Leaderboard rankings aggregate across all matches in a season. One amazing game won&apos;t
                    compensate for several poor ones. Focus on performing well in every match rather than
                    going for highlight-reel plays. Consistent 5-6 kill games are better for your stats than
                    one 15-kill game followed by three 0-kill games.
                </p>

                <h2>5. Review Your Stats After Each Tournament</h2>
                <p>
                    Bimon tracks detailed match-by-match stats on your profile. After each tournament, review
                    your performance: Where did you place? How many kills did you average? Which matches
                    went wrong and why? This self-analysis is what separates improving players from stagnant ones.
                </p>

                <h2>Bonus: Participate Regularly</h2>
                <p>
                    The more tournaments you play, the more data the team-balancing algorithm has on you.
                    This means you&apos;ll be placed in more accurately balanced teams, leading to better,
                    more competitive matches. Consistency in participation is key to a great competitive experience.
                </p>
            </div>
        ),
    },

    "tournament-formats-explained": {
        title: "Tournament Formats Explained: BR, TDM, 1v1 & More",
        description: "A comprehensive guide to every tournament format available on Bimon — from classic Battle Royale to World Cup-style Group + Knockout.",
        date: "2026-04-20",
        readTime: "5 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    Bimon runs multiple tournament formats to keep competition diverse and cater to different
                    player preferences. Here&apos;s a complete guide to every format we offer.
                </p>

                <h2>Battle Royale (BR) — Classic Format</h2>
                <p>
                    The flagship format. Players are assigned to skill-balanced squads (Duos, Trios, or Squads)
                    and compete in classic Battle Royale matches. Points are awarded for both placement and kills.
                    This is the format most players start with and where the team-balancing algorithm shines.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Team sizes: Solo, Duo, Trio, or Squad (4 players)</li>
                    <li>Scoring: Placement points + Kill points</li>
                    <li>Winner count: Based on prize pool tier (Top 3 to Top 10)</li>
                </ul>

                <h2>Team Deathmatch (TDM)</h2>
                <p>
                    Fast-paced elimination matches where two teams face off in close-quarters combat.
                    No circle, no looting — pure aim and teamwork. TDM tournaments use a bracket format
                    where winning teams advance and losing teams are eliminated.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Format: Single-elimination bracket</li>
                    <li>Team sizes: 4v4 or 8v8</li>
                    <li>Win condition: First team to reach the kill target</li>
                </ul>

                <h2>1v1 Knockout Bracket</h2>
                <p>
                    The ultimate test of individual skill. Players are seeded into a single-elimination bracket
                    and face off one-on-one. After each match, both players submit the result and the winner
                    advances. A dispute window ensures fair outcomes.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Format: Single-elimination bracket</li>
                    <li>Players submit match results with a dispute window</li>
                    <li>Auto-generated bracket with fair seeding</li>
                </ul>

                <h2>Round-Robin League</h2>
                <p>
                    Every player or team plays against every other player or team in their group. Points
                    are tallied across all matches, and the player with the most points wins. This format
                    tests consistency and stamina — one bad game won&apos;t eliminate you.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Format: Everyone plays everyone</li>
                    <li>Ranking: Points table (win = 3, draw = 1, loss = 0)</li>
                    <li>Best for: Players who prefer consistency over single-elimination pressure</li>
                </ul>

                <h2>Group + Knockout (World Cup Style)</h2>
                <p>
                    Inspired by the FIFA World Cup format. Players are divided into groups for a round-robin
                    stage, and the top performers from each group advance to a single-elimination knockout bracket.
                    This combines the consistency test of a league with the excitement of knockout rounds.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Phase 1: Group stage (round-robin within groups)</li>
                    <li>Phase 2: Knockout bracket (top players from each group)</li>
                    <li>Best for: Large player pools with competitive finishes</li>
                </ul>

                <h2>World of Wonder (WoW)</h2>
                <p>
                    Creative custom map tournaments featuring unique game modes built in BGMI&apos;s World of
                    Wonder editor. These are more casual and experimental — expect unusual rules, creative
                    maps, and a focus on fun rather than pure competition.
                </p>

                <h2>Choosing Your Format</h2>
                <p>
                    Each format appeals to different playstyles. If you love team coordination and survival,
                    BR is your home. If you&apos;re a fragger who wants pure combat, try TDM or 1v1.
                    If you prefer consistency over single-game pressure, leagues and group stages are ideal.
                    Try them all to find your sweet spot!
                </p>
            </div>
        ),
    },
};

// Generate metadata for each blog post
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const post = POSTS[slug];
    if (!post) return { title: "Post Not Found" };
    return {
        title: post.title,
        description: post.description,
    };
}

// Generate static params for all blog posts
export function generateStaticParams() {
    return Object.keys(POSTS).map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = POSTS[slug];
    if (!post) notFound();

    const CATEGORY_COLORS: Record<string, string> = {
        "Guides": "text-blue-400 bg-blue-400/10",
        "Behind the Scenes": "text-violet-400 bg-violet-400/10",
        "Tips & Strategy": "text-emerald-400 bg-emerald-400/10",
    };

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Back link */}
                <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-foreground/40 hover:text-foreground/60 transition-colors mb-8">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All Posts
                </Link>

                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${CATEGORY_COLORS[post.category] ?? "text-foreground/40 bg-foreground/5"}`}>
                            {post.category}
                        </span>
                        <span className="text-xs text-foreground/30">{post.readTime}</span>
                        <span className="text-xs text-foreground/30">·</span>
                        <span className="text-xs text-foreground/30">
                            {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                        {post.title}
                    </h1>
                    <p className="mt-3 text-lg text-foreground/50">
                        {post.description}
                    </p>
                </div>

                {/* Article Content */}
                <article className="prose-custom text-base leading-relaxed text-foreground/70 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:mt-3 [&_strong]:text-foreground/90 [&_ol]:mt-3 [&_ul]:mt-3">
                    {post.content}
                </article>

                {/* CTA */}
                <div className="mt-16 rounded-xl border border-foreground/10 bg-gradient-to-br from-blue-600/10 to-violet-600/10 p-6 text-center">
                    <h3 className="text-lg font-bold">Ready to Compete?</h3>
                    <p className="mt-2 text-sm text-foreground/50">
                        Join the next {GAME.gameName} tournament on Bimon and put these strategies to the test.
                    </p>
                    <Link
                        href="/sign-up"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:brightness-110"
                    >
                        Join Now — It&apos;s Free
                    </Link>
                </div>

                <div className="mt-12 border-t border-foreground/10 pt-6">
                    <Link href="/blog" className="text-sm text-foreground/40 hover:text-foreground/60 transition-colors">
                        ← All Posts
                    </Link>
                </div>
            </div>
        </div>
    );
}
