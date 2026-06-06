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

    "what-is-bimon": {
        title: "What is Bimon? A Complete Guide to the Tournament Platform",
        description: "Everything you need to know about Bimon — the community-driven BGMI esports platform with fair team balancing, UC prize pools, and competitive leaderboards.",
        date: "2026-06-01",
        readTime: "6 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    If you&apos;ve been looking for a way to compete in organized BGMI (Battlegrounds Mobile India)
                    tournaments without relying on random matchmaking or WhatsApp groups, Bimon is built
                    specifically for you. Bimon is a community-driven esports platform that organizes fair,
                    competitive tournaments with real UC prize pools, skill-balanced teams, and detailed
                    stat tracking for every player.
                </p>

                <h2>How Bimon Started</h2>
                <p>
                    Bimon began as a small project among friends in Northeast India who were frustrated with
                    the lack of organized competitive BGMI experiences. Random custom rooms were chaotic —
                    teams were unbalanced, results were tracked on paper (or not at all), and prize distribution
                    was often unclear. The founders built Bimon to solve all of these problems with technology.
                </p>
                <p>
                    What started as a Discord-managed bracket has evolved into a full-fledged web platform
                    with automated team generation, real-time leaderboards, wallet systems, and multi-format
                    tournament support. Today, Bimon serves hundreds of active players across multiple seasons.
                </p>

                <h2>Key Features</h2>
                <p>
                    Bimon is not just another tournament organizer — it&apos;s a complete competitive ecosystem.
                    Here are the core features that set it apart:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Smart Team Balancing:</strong> Our algorithm analyzes each player&apos;s historical K/D ratio, kill average, and placement stats to create skill-balanced squads for every tournament.</li>
                    <li><strong>UC Prize Pools:</strong> Every tournament has a real UC prize pool funded by entry fees. Prizes are distributed transparently to top-performing teams.</li>
                    <li><strong>Detailed Statistics:</strong> Every kill, placement, assist, and match is tracked. Your player profile shows comprehensive stats across all seasons.</li>
                    <li><strong>Merit System:</strong> A reputation score that rewards good sportsmanship, consistent attendance, and fair play.</li>
                    <li><strong>Multiple Formats:</strong> Battle Royale, TDM, World of Wonder, 1v1 Knockout, Round-Robin League, and Group + Knockout formats.</li>
                    <li><strong>Squad &amp; Clan System:</strong> Form permanent squads with friends, create or join clans, and compete as a team in Ranked tournaments.</li>
                    <li><strong>BP Wallet:</strong> A digital wallet system for managing entry fees, winnings, and withdrawals.</li>
                </ul>

                <h2>How Tournaments Work</h2>
                <p>
                    The tournament lifecycle on Bimon follows a simple flow that any player can understand:
                </p>
                <ol className="space-y-3 list-decimal pl-5">
                    <li><strong>Poll Creation:</strong> Admins create a tournament poll specifying the format, entry fee, prize pool, and schedule.</li>
                    <li><strong>Player Registration:</strong> Players vote &quot;IN&quot; on the poll to register. The system tracks who&apos;s in and shows real-time registration counts.</li>
                    <li><strong>Team Generation:</strong> Once registration closes, the team-balancing algorithm creates fair squads (for Casual) or accepts premade squads (for Ranked).</li>
                    <li><strong>Match Play:</strong> Teams receive room details (ID and password) via WhatsApp. Players join the custom room and compete.</li>
                    <li><strong>Result Entry:</strong> After the match, admins enter results including kills, placement, and any relevant stats.</li>
                    <li><strong>Prize Distribution:</strong> Prizes are automatically calculated and deposited to winners&apos; wallets.</li>
                </ol>

                <h2>Ranked vs Casual Tournaments</h2>
                <p>
                    Bimon offers two main tournament types. <strong>Casual tournaments</strong> use the automatic
                    team-balancing system — you register individually and the algorithm assigns you to a squad.
                    This is great for solo players who want fair matches without needing a premade team.
                </p>
                <p>
                    <strong>Ranked tournaments</strong> are for premade squads. You form a team with your friends,
                    register together, and compete as a unit. Ranked tournaments have separate leaderboards and
                    are generally more competitive.
                </p>

                <h2>The Leaderboard &amp; Seasons</h2>
                <p>
                    Bimon operates on a seasonal system. Each season lasts several weeks, and all stats reset
                    at the beginning of a new season. This gives every player a fresh start and keeps the
                    competition dynamic. Season leaderboards track total points, kills, K/D ratio, and more
                    — with separate rankings for Ranked and Casual play.
                </p>

                <h2>Getting Started</h2>
                <p>
                    Getting started on Bimon is completely free. Create an account, link your BGMI ID,
                    and join the next tournament poll. Your stats will be tracked from your very first match,
                    and you&apos;ll start building your competitive profile immediately. Whether you&apos;re a casual
                    player looking for organized matches or a competitive grinder aiming for the top of the
                    leaderboard, Bimon has something for you.
                </p>
            </div>
        ),
    },

    "bgmi-best-landing-spots": {
        title: "Best Landing Spots in BGMI: A Map-by-Map Strategy Guide",
        description: "Discover the best drop locations for Erangel, Miramar, and Sanhok in BGMI tournaments. Learn hot drops, safe rotations, and loot-rich spots for competitive play.",
        date: "2026-05-28",
        readTime: "7 min read",
        category: "Tips & Strategy",
        content: (
            <div className="space-y-6">
                <p>
                    Where you land in a BGMI tournament match can make or break your performance. Unlike casual
                    games where you might hot-drop for fun, tournament play requires a more calculated approach.
                    Your landing spot determines your early loot quality, rotation options, and survival chances
                    — all of which directly impact your placement and kill points on Bimon.
                </p>

                <h2>Erangel: The Classic Map</h2>
                <p>
                    Erangel remains the most-played tournament map in BGMI. Its mix of open fields, urban areas,
                    and diverse terrain makes it ideal for both aggressive and passive playstyles. Here are the
                    best tournament landing spots:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Pochinki:</strong> High-risk, high-reward. Dense urban layout with excellent loot. Expect early fights but you&apos;ll be well-equipped if you survive. Best for confident fraggers.</li>
                    <li><strong>Georgopol Crates:</strong> The shipping containers offer fast, concentrated loot. Good for squads that want to gear up quickly and rotate. Central location means good zone access.</li>
                    <li><strong>Military Base:</strong> Premium loot but isolated on the island. You&apos;ll need to cross the bridge or swim, which can be dangerous in late zones. Best when the zone favors the south.</li>
                    <li><strong>Rozhok:</strong> Central location with decent loot spread across houses. Good rotation to any zone. Less contested than Pochinki but still competitive.</li>
                    <li><strong>Sosnovka Island (Power Plant):</strong> Consistent level 3 gear and scopes. Less contested than Military Base but still on the island.</li>
                </ul>

                <h2>Miramar: The Desert Map</h2>
                <p>
                    Miramar&apos;s vast desert terrain rewards long-range combat and vehicle rotations. The map
                    has some of the best loot concentrations in the game, but the open terrain makes rotations
                    dangerous. Here are the top spots:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Hacienda del Patrón:</strong> The Pochinki of Miramar. Compact, loot-rich, and always contested. Drop here if you want early action and premium gear.</li>
                    <li><strong>El Pozo:</strong> Large city with multiple buildings. Less contested than Hacienda but still offers solid loot. The boxing ring and warehouses are key areas.</li>
                    <li><strong>Pecado:</strong> Central location with good loot. The casino and arena buildings are loot hotspots. Great for squads who want a central position for rotations.</li>
                    <li><strong>Los Leones:</strong> The largest city on Miramar. Tons of loot spread across a wide area. Best for squads that want to avoid early fights and gear up in peace.</li>
                    <li><strong>Water Treatment:</strong> Underrated spot with consistent vehicle spawns and decent loot. Good for safe early games.</li>
                </ul>

                <h2>Sanhok: The Fast-Paced Map</h2>
                <p>
                    Sanhok&apos;s smaller size means faster zone closings and more frequent encounters. The lush
                    vegetation provides cover but also limits long-range visibility. Every squad will have
                    multiple fights per game.
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Boot Camp:</strong> The ultimate hot drop. Three main buildings with premium loot. Only drop here if your squad excels at close-range combat.</li>
                    <li><strong>Paradise Resort:</strong> Large compound with excellent loot distribution. Less chaotic than Boot Camp but still competitive. Central location for rotations.</li>
                    <li><strong>Ruins:</strong> Good loot with natural cover from the temple structures. A balanced spot between hot and cold drops.</li>
                    <li><strong>Pai Nan:</strong> Coastal town with solid loot and vehicle spawns. Less contested, making it good for teams that prefer a quieter start.</li>
                </ul>

                <h2>Tournament-Specific Tips</h2>
                <p>
                    In Bimon tournaments, your landing strategy should consider more than just loot:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Consistency over aggression:</strong> In multi-match tournaments, surviving to the top 5 consistently is worth more than one chicken dinner followed by early eliminations.</li>
                    <li><strong>Vehicle control:</strong> Securing a vehicle early gives your squad rotation flexibility, especially on Erangel and Miramar.</li>
                    <li><strong>Zone prediction:</strong> Experienced teams study zone patterns and position themselves for favorable rotations before the zone forces them to move.</li>
                    <li><strong>Communication:</strong> Call out enemy positions, share ammo and meds, and coordinate pushes. Tournament matches are won by teamwork, not individual heroics.</li>
                </ul>

                <h2>Adapting Your Strategy</h2>
                <p>
                    The best tournament players don&apos;t have a single landing spot — they have a rotation of
                    2-3 preferred locations and adapt based on the flight path, zone, and how many other teams
                    are dropping nearby. Watch where other squads are heading during the plane phase and adjust
                    accordingly. Flexibility is the key to consistently scoring high placement points on Bimon.
                </p>
            </div>
        ),
    },

    "how-to-create-clan": {
        title: "How to Create & Manage a Clan on Bimon",
        description: "Step-by-step guide to creating a clan on Bimon, inviting members, managing your clan treasury, and competing in clan-based tournaments.",
        date: "2026-05-25",
        readTime: "5 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    Clans are the social backbone of the Bimon community. A clan is a group of players who
                    share a common identity, compete together, and build a reputation on the platform. Whether
                    you&apos;re creating a clan with your real-life friends or building one with players you&apos;ve
                    met through tournaments, this guide covers everything you need to know.
                </p>

                <h2>What is a Clan?</h2>
                <p>
                    A clan on Bimon is a permanent group that persists across tournaments and seasons. Unlike
                    squads (which are formed for individual tournaments), clans provide a long-term competitive
                    identity. Clan members share a clan tag that appears next to their name, and the clan itself
                    has a profile page showing aggregate stats, member lists, and tournament history.
                </p>

                <h2>Creating a Clan</h2>
                <p>
                    To create a clan, you need to have an active Bimon account with at least one tournament
                    under your belt. Here&apos;s how:
                </p>
                <ol className="space-y-3 list-decimal pl-5">
                    <li>Navigate to the <strong>Clan</strong> section from your profile or the main menu.</li>
                    <li>Click <strong>&quot;Create Clan&quot;</strong> and enter your clan name (max 30 characters).</li>
                    <li>Choose a clan tag (3-5 characters) that will appear next to member names.</li>
                    <li>Set your clan to <strong>Open</strong> (anyone can join) or <strong>Invite Only</strong> (requires approval).</li>
                    <li>Your clan is live! You&apos;re automatically the clan leader.</li>
                </ol>

                <h2>Inviting Members</h2>
                <p>
                    Once your clan is created, you can invite players in several ways. Share your clan&apos;s
                    invite link directly, or search for players by their Bimon username. If your clan is set
                    to &quot;Open,&quot; any player can join by visiting your clan page and clicking the join button.
                    For &quot;Invite Only&quot; clans, join requests must be approved by the clan leader or co-leaders.
                </p>

                <h2>Clan Roles</h2>
                <p>
                    Clans have a hierarchy of roles to help manage the group:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Leader:</strong> Full control over clan settings, member management, and treasury. Only one leader per clan.</li>
                    <li><strong>Co-Leader:</strong> Can approve join requests and manage members. Appointed by the leader.</li>
                    <li><strong>Member:</strong> Standard role. Can participate in clan tournaments and view clan stats.</li>
                </ul>

                <h2>Clan Treasury</h2>
                <p>
                    Each clan has a shared treasury where UC from tournament winnings can be pooled. The leader
                    controls how treasury funds are distributed — whether evenly among members, based on
                    performance, or saved for future tournament entry fees. The treasury system is fully
                    transparent, with a transaction log that all members can view.
                </p>

                <h2>Tips for Building a Strong Clan</h2>
                <ul className="space-y-2 list-disc pl-5">
                    <li>Recruit players who are active and reliable — consistency matters more than raw skill.</li>
                    <li>Set clear expectations about tournament participation and communication.</li>
                    <li>Use a Discord or WhatsApp group for real-time coordination outside of Bimon.</li>
                    <li>Participate in tournaments regularly to build your clan&apos;s reputation and stats.</li>
                    <li>Celebrate wins as a team — the social aspect is what keeps clans together long-term.</li>
                </ul>
            </div>
        ),
    },

    "ranked-vs-casual-tournaments": {
        title: "Ranked vs Casual Tournaments: Which Should You Play?",
        description: "Understand the key differences between Ranked and Casual tournament modes on Bimon — team formation, scoring, leaderboards, and which one suits your playstyle.",
        date: "2026-05-22",
        readTime: "5 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    Bimon offers two distinct tournament modes — Ranked and Casual — each designed for different
                    types of players. Understanding the differences between them is key to choosing the right
                    competitive experience for you. This guide breaks down everything you need to know.
                </p>

                <h2>Casual Tournaments</h2>
                <p>
                    Casual tournaments are the default experience on Bimon and are perfect for solo players or
                    anyone who wants to compete without needing a premade squad.
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Team Formation:</strong> The algorithm automatically assigns you to a skill-balanced squad. You don&apos;t need to find teammates — the system does it for you.</li>
                    <li><strong>Entry:</strong> You register individually by voting on a tournament poll.</li>
                    <li><strong>Team Names:</strong> In Casual mode, team names are your individual player names since teams change every tournament.</li>
                    <li><strong>Leaderboard:</strong> Separate Casual leaderboard tracking your individual performance across algorithmically-generated teams.</li>
                    <li><strong>Best For:</strong> Solo players, new players learning the platform, and anyone who enjoys the variety of playing with different teammates every time.</li>
                </ul>

                <h2>Ranked Tournaments</h2>
                <p>
                    Ranked tournaments are for players who want to compete with a consistent team. You bring
                    your own squad and face other premade teams.
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Team Formation:</strong> You create a squad with your friends and register together. Your squad has a custom team name.</li>
                    <li><strong>Entry:</strong> The squad captain registers the entire squad for the tournament.</li>
                    <li><strong>Team Names:</strong> Your squad&apos;s custom name appears on standings and overlays.</li>
                    <li><strong>Leaderboard:</strong> Separate Ranked leaderboard. Your performance here reflects coordinated team play.</li>
                    <li><strong>Best For:</strong> Premade squads, competitive players who practice together, and clans.</li>
                </ul>

                <h2>Key Differences at a Glance</h2>
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-foreground/[0.05] text-left text-xs uppercase tracking-wider text-foreground/40">
                                <th className="px-4 py-2">Feature</th>
                                <th className="px-4 py-2">Casual</th>
                                <th className="px-4 py-2">Ranked</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            <tr><td className="px-4 py-2">Team Formation</td><td className="px-4 py-2">Auto-balanced</td><td className="px-4 py-2">Premade</td></tr>
                            <tr><td className="px-4 py-2">Registration</td><td className="px-4 py-2">Individual</td><td className="px-4 py-2">Squad</td></tr>
                            <tr><td className="px-4 py-2">Leaderboard</td><td className="px-4 py-2">Casual rankings</td><td className="px-4 py-2">Ranked rankings</td></tr>
                            <tr><td className="px-4 py-2">Skill Level</td><td className="px-4 py-2">Mixed</td><td className="px-4 py-2">Competitive</td></tr>
                            <tr><td className="px-4 py-2">Best For</td><td className="px-4 py-2">Solo players</td><td className="px-4 py-2">Premade squads</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>Which Should You Choose?</h2>
                <p>
                    If you&apos;re new to Bimon, start with Casual. It&apos;s the easiest way to get into competitive
                    play without needing to find teammates first. You&apos;ll experience the platform&apos;s team-balancing
                    algorithm firsthand and meet other players who could become future squad members.
                </p>
                <p>
                    If you have a group of friends who play BGMI together regularly, jump into Ranked. The
                    chemistry and communication of a premade squad gives you a significant advantage, and the
                    Ranked leaderboard is where the most competitive players prove themselves.
                </p>
                <p>
                    Many players participate in both — using Casual for solo sessions and Ranked when their
                    squad is online. Both modes contribute to your overall player profile and stats.
                </p>
            </div>
        ),
    },

    "bgmi-weapon-tier-list": {
        title: "BGMI Weapon Tier List: Best Guns for Tournament Play",
        description: "A comprehensive tier list of the best weapons in BGMI for competitive tournament play. Learn which guns to prioritize for kills and survival in Bimon tournaments.",
        date: "2026-05-18",
        readTime: "6 min read",
        category: "Tips & Strategy",
        content: (
            <div className="space-y-6">
                <p>
                    Weapon choice in BGMI tournaments is not just about personal preference — it&apos;s about
                    maximizing your effectiveness in different combat scenarios. In Bimon tournaments where every
                    kill point matters, knowing which weapons to prioritize can be the difference between first
                    and fifth place. This tier list is based on tournament meta and competitive viability.
                </p>

                <h2>S-Tier: Must-Pick Weapons</h2>
                <p>These weapons are dominant in the current meta and should always be picked up when found:</p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>M416:</strong> The most versatile assault rifle in the game. Low recoil, high rate of fire, and effective at all ranges. With a full attachment setup (compensator, vertical grip, stock, extended mag), it becomes a laser beam. This is the default competitive weapon.</li>
                    <li><strong>AWM:</strong> The ultimate sniper rifle. One-shot headshot through any helmet. Only found in airdrops, making it rare but game-changing. If you get one, protect it.</li>
                    <li><strong>DP-28:</strong> Surprisingly effective in competitive play. The bipod reduces recoil significantly when prone, and the 47-round magazine means you can suppress enemies without reloading. Excellent for final circles.</li>
                </ul>

                <h2>A-Tier: Excellent Choices</h2>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>AKM:</strong> Highest damage AR in the game. Harder to control than the M416 but devastating at close to mid-range. Pair with a compensator and vertical grip for best results.</li>
                    <li><strong>M762:</strong> High damage with manageable recoil. A strong alternative to the AKM with better rate of fire. Excels in mid-range combat.</li>
                    <li><strong>Kar98k:</strong> The most common bolt-action sniper. One-shot headshot through level 2 helmets. Reliable and available as floor loot. Pairs well with any AR.</li>
                    <li><strong>UZI:</strong> The king of close-range combat. Insane rate of fire that shreds enemies in buildings and tight spaces. Always carry one if you&apos;re playing aggressively.</li>
                </ul>

                <h2>B-Tier: Solid Options</h2>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>SCAR-L:</strong> Easy to control but lower damage than the M416. Good for beginners but slightly outclassed in competitive play.</li>
                    <li><strong>Mini 14:</strong> Excellent DMR for mid to long range. Fast fire rate and low recoil make it a great sniping alternative when you can&apos;t find a bolt-action.</li>
                    <li><strong>SLR:</strong> High-damage DMR that rewards accuracy. Two headshots at any range. Harder to control but devastating in skilled hands.</li>
                    <li><strong>Groza:</strong> Airdrop AR with the highest DPS in the game. Melts enemies at close range but burns through ammo fast. High risk, high reward.</li>
                </ul>

                <h2>Tournament Loadout Tips</h2>
                <p>
                    In Bimon tournaments, your ideal loadout depends on the zone and your playstyle. Here are
                    some proven tournament loadout combinations:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>All-Rounder:</strong> M416 + Kar98k — covers all ranges effectively. The most popular competitive loadout.</li>
                    <li><strong>Aggressive Fragger:</strong> AKM/M762 + UZI — maximum close to mid-range firepower. Best for teams that push fights.</li>
                    <li><strong>Support/Anchor:</strong> DP-28 + DMR — hold angles and suppress enemies while your squad rotates or pushes.</li>
                    <li><strong>Sniper:</strong> Kar98k/AWM + M416 — pick off enemies from distance and switch to AR for close encounters.</li>
                </ul>

                <h2>Ammo Management</h2>
                <p>
                    In tournament play, ammo management is critical. Carry 150-200 rounds for your primary AR
                    and 30-40 rounds for your sniper. Don&apos;t overstock — inventory space for meds, throwables,
                    and scopes is equally important. Share surplus ammo with teammates who need it.
                </p>
            </div>
        ),
    },

    "how-wallets-work": {
        title: "How the BP Wallet System Works on Bimon",
        description: "A complete guide to the Bimon wallet system — how to deposit BP, receive tournament prizes, request withdrawals, and manage your competitive earnings.",
        date: "2026-05-12",
        readTime: "5 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    Every player on Bimon has a digital wallet that manages their tournament entry fees,
                    prize winnings, and transactions. The wallet system is designed to be transparent,
                    secure, and easy to use. This guide explains everything about how the BP wallet works.
                </p>

                <h2>What is the BP Wallet?</h2>
                <p>
                    BP (Bimon Points) is the internal currency used on the Bimon platform. Your wallet
                    balance represents the BP you have available for tournament entries and the winnings
                    you&apos;ve accumulated from your competitive performances. BP can be converted to and
                    from UC (Unknown Cash) in BGMI.
                </p>

                <h2>How to Add Funds</h2>
                <p>
                    To participate in paid tournaments, you need BP in your wallet. There are several
                    ways to add funds:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Direct Deposit:</strong> Transfer UC to the platform through the designated payment methods shown in your wallet page.</li>
                    <li><strong>Tournament Winnings:</strong> Prizes from tournaments are automatically deposited to your wallet after results are confirmed.</li>
                    <li><strong>Referral Bonuses:</strong> Earn bonus BP by referring new players to the platform using your unique referral link.</li>
                    <li><strong>Promotional Credits:</strong> Occasional bonuses from events, seasonal promotions, or community activities.</li>
                </ul>

                <h2>Tournament Entry Fees</h2>
                <p>
                    When you register for a paid tournament, the entry fee is deducted from your wallet
                    balance. If you don&apos;t have enough BP, you&apos;ll need to add funds before you can register.
                    Free tournaments have no entry fee and are open to everyone.
                </p>
                <p>
                    Entry fees from all participants are pooled together to form the prize pool. This
                    means the more players who participate, the larger the prize pool becomes. Bimon
                    takes a small platform fee to cover operational costs, and the rest goes directly
                    to the winners.
                </p>

                <h2>Prize Distribution</h2>
                <p>
                    After tournament results are confirmed, prizes are calculated using a geometric decay
                    system. This means the top team gets the largest share, with decreasing amounts for
                    lower placements. The exact distribution depends on the tournament format and the number
                    of participating teams. Prize amounts are shown on the tournament page before you register,
                    so you always know what&apos;s at stake.
                </p>

                <h2>Withdrawals</h2>
                <p>
                    When you want to convert your BP back to UC, you can request a withdrawal from
                    your wallet page. Withdrawal requests are processed by the platform team, typically
                    within 24-48 hours. The minimum withdrawal amount and any applicable fees are
                    clearly displayed on the withdrawal page.
                </p>

                <h2>Transaction History</h2>
                <p>
                    Your wallet page shows a complete transaction log — every deposit, entry fee,
                    prize receipt, and withdrawal is recorded with timestamps and descriptions. This
                    ensures full transparency and lets you track your competitive earnings over time.
                    You can filter transactions by type and date range to find specific entries.
                </p>

                <h2>Security</h2>
                <p>
                    Your wallet is protected by your Bimon account authentication. All transactions
                    are logged and cannot be modified after processing. If you notice any unauthorized
                    activity, contact the support team immediately through the Help page or Discord.
                </p>
            </div>
        ),
    },

    "championship-format-guide": {
        title: "Championship Format: Groups, Heats & Finals Explained",
        description: "A detailed guide to how championships work on Bimon — from group stages and heat rounds to the grand finals. Understand the competitive ladder.",
        date: "2026-05-08",
        readTime: "5 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    Beyond regular daily tournaments, Bimon occasionally hosts larger championship events
                    that run over multiple days or weeks. These championships use a multi-stage format
                    designed to find the truly best players through extended competition. This guide
                    explains how championship formats work on the platform.
                </p>

                <h2>Why Championships Are Different</h2>
                <p>
                    Regular tournaments are standalone events — you register, play, and get results in
                    a single session. Championships are different because they span multiple rounds of
                    play, with elimination at each stage. This format tests consistency and adaptability
                    rather than single-game performance, making championships the ultimate test of skill.
                </p>

                <h2>Stage 1: Group Phase</h2>
                <p>
                    The championship begins with a group phase where all registered teams are divided
                    into groups. Each group plays a set number of matches (typically 3-5 games), and
                    points are accumulated across all matches. The top teams from each group advance
                    to the next stage.
                </p>
                <p>
                    The group phase tests consistency — you can&apos;t rely on one good game. Teams that
                    perform well across all matches will advance, while teams with inconsistent results
                    will be eliminated regardless of individual peaks.
                </p>

                <h2>Stage 2: Heat Rounds</h2>
                <p>
                    Teams that survive the group phase enter heat rounds. Heats combine teams from
                    different groups into larger lobbies, increasing the competition level. Performance
                    in heats determines seeding for the finals — the better you perform here, the more
                    favorable your position in the grand finals.
                </p>
                <p>
                    Heat rounds also serve as a buffer — they ensure that teams advancing to the finals
                    have proven themselves against a diverse set of opponents, not just the teams in their
                    original group.
                </p>

                <h2>Stage 3: Grand Finals</h2>
                <p>
                    The grand finals bring together the top teams from all heat rounds for the ultimate
                    showdown. Finals typically consist of 4-6 matches played in a single session, with
                    the overall point total determining the champion. Prize pools are largest in the
                    finals, with significant rewards for the top finishers.
                </p>

                <h2>Scoring Across Stages</h2>
                <p>
                    Each stage uses the standard Bimon scoring system (placement points + kill points),
                    but accumulated across multiple matches within that stage. Some championships may
                    carry over partial points between stages, while others start fresh at each stage.
                    The specific rules are always announced before the championship begins.
                </p>

                <h2>How to Prepare</h2>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Play regular tournaments first:</strong> Build your skills and stats in daily tournaments before attempting a championship.</li>
                    <li><strong>Form a reliable squad:</strong> Championships require multiple sessions. Make sure your squad can commit to the full schedule.</li>
                    <li><strong>Study the format:</strong> Read the championship rules carefully. Know how many matches per stage, how many teams advance, and how points carry over.</li>
                    <li><strong>Manage fatigue:</strong> Multi-match sessions are mentally exhausting. Take breaks between games, stay hydrated, and keep your focus sharp.</li>
                </ul>
            </div>
        ),
    },

    "improve-kd-ratio": {
        title: "How to Improve Your K/D Ratio in BGMI Tournaments",
        description: "Practical tips and strategies to improve your kill-to-death ratio in competitive BGMI tournament play on Bimon. From positioning to weapon skills.",
        date: "2026-05-02",
        readTime: "6 min read",
        category: "Tips & Strategy",
        content: (
            <div className="space-y-6">
                <p>
                    Your K/D (kill-to-death) ratio is one of the most important stats on your Bimon profile.
                    It influences your tier ranking, how the team-balancing algorithm evaluates you, and your
                    overall reputation on the leaderboard. A higher K/D doesn&apos;t just mean more kill points
                    per tournament — it means you&apos;re contributing more to your team&apos;s success. Here are
                    proven strategies to improve your K/D in competitive play.
                </p>

                <h2>1. Master Your Sensitivity Settings</h2>
                <p>
                    Before anything else, find sensitivity settings that work for you and stick with them.
                    Tournament performance requires muscle memory, and constantly changing your settings
                    prevents you from building it. Spend time in the training ground testing different
                    sensitivity levels for gyroscope, ADS (aim down sight), and general camera movement
                    until you find what feels natural.
                </p>
                <p>
                    A good starting point: use lower sensitivity for better recoil control at range, and
                    slightly higher sensitivity for close-range fights where you need to snap to targets
                    quickly. Most pro players use different sensitivity levels for different scope types.
                </p>

                <h2>2. Positioning Is Everything</h2>
                <p>
                    In tournament play, positioning wins more fights than raw aim. Here&apos;s what good
                    positioning looks like:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>High ground advantage:</strong> Always try to hold elevated positions. Shooting downward is easier than shooting upward.</li>
                    <li><strong>Cover discipline:</strong> Never stand in the open. Always have a tree, rock, or building to retreat behind.</li>
                    <li><strong>Zone awareness:</strong> Move into the safe zone early. Fighting while running from the blue is a recipe for death.</li>
                    <li><strong>Peek mechanics:</strong> Use lean/peek to expose as little of your body as possible during gunfights.</li>
                </ul>

                <h2>3. Pick Your Fights Wisely</h2>
                <p>
                    Not every enemy needs to be engaged. In tournaments where placement points matter,
                    sometimes the smartest play is to let two other squads fight each other and then
                    clean up the survivors. Consider these factors before engaging:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li>Can you finish the fight quickly, or will it drag into a long engagement that attracts third parties?</li>
                    <li>Is the zone moving? If you need to rotate soon, avoid fights that could trap you outside the safe zone.</li>
                    <li>Do you have a clear advantage (better position, element of surprise, better gear)?</li>
                    <li>What will you gain from this fight? If the enemy has nothing you need, consider letting them pass.</li>
                </ul>

                <h2>4. Improve Your Close-Range Combat</h2>
                <p>
                    Most deaths in BGMI tournaments happen at close range — building fights, compound
                    pushes, and final circle chaos. To improve your close-range game:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li>Practice hip-fire in the training ground with SMGs and shotguns.</li>
                    <li>Learn jiggle peeking — strafing in and out of cover while shooting to make yourself harder to hit.</li>
                    <li>Pre-aim common angles. When entering a building, aim where enemies are most likely to be.</li>
                    <li>Use throwables (grenades, molotovs) to flush enemies out of cover before pushing.</li>
                </ul>

                <h2>5. Review Your Gameplay</h2>
                <p>
                    After every tournament, review your stats on your Bimon player profile. Look at:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li>Which matches did you die early? What went wrong?</li>
                    <li>Where were your kills coming from — early game, mid game, or end game?</li>
                    <li>Are you consistently dying to the same type of situation (third parties, zone damage, close-range fights)?</li>
                </ul>
                <p>
                    Identifying patterns in your deaths is the fastest way to improve. Most players die
                    to the same mistakes repeatedly — fixing even one recurring mistake can significantly
                    boost your K/D over a season.
                </p>

                <h2>6. Communication and Teamwork</h2>
                <p>
                    In team-based tournaments, your K/D is heavily influenced by how well your squad
                    coordinates. Call out enemy positions, coordinate pushes, share resources, and
                    support each other during fights. A well-coordinated squad where everyone has
                    a 2.0 K/D will outperform a squad with one 5.0 K/D player and three 0.5 K/D players
                    every time.
                </p>
            </div>
        ),
    },

    "season-system-explained": {
        title: "Seasons, Resets & Leaderboards: How the Season System Works",
        description: "Everything about Bimon's seasonal system — when seasons reset, how leaderboards carry over, and what seasonal rewards look like.",
        date: "2026-04-25",
        readTime: "4 min read",
        category: "Behind the Scenes",
        content: (
            <div className="space-y-6">
                <p>
                    Bimon operates on a seasonal system that resets leaderboards and stats periodically,
                    giving every player a fresh start and keeping the competitive landscape dynamic. If
                    you&apos;ve ever wondered how seasons work, when they reset, and what happens to your
                    stats — this guide has all the answers.
                </p>

                <h2>What Is a Season?</h2>
                <p>
                    A season on Bimon is a defined period (typically several weeks to a few months) during
                    which all tournament results contribute to that season&apos;s leaderboards. When a season
                    ends, leaderboards reset and a new season begins with everyone starting from zero.
                    This prevents established players from building insurmountable leads and ensures
                    new players always have a realistic path to the top.
                </p>

                <h2>What Resets Between Seasons</h2>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Leaderboard rankings:</strong> All seasonal point totals reset to zero. Everyone starts the new season equally.</li>
                    <li><strong>Season-specific stats:</strong> Kill totals, match counts, and placement stats for the season are archived and a fresh counter begins.</li>
                </ul>

                <h2>What Does NOT Reset</h2>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Lifetime stats:</strong> Your all-time K/D ratio, total kills, and match history are preserved across all seasons.</li>
                    <li><strong>Wallet balance:</strong> Your BP wallet is not affected by season resets. Winnings are yours to keep.</li>
                    <li><strong>Merit score:</strong> Your reputation carries over between seasons. Good sportsmanship is a permanent asset.</li>
                    <li><strong>Clan membership:</strong> Your clan and squad affiliations persist across seasons.</li>
                    <li><strong>Player tier:</strong> Your internal skill tier (used for team balancing) carries over, though it may be adjusted based on recent performance.</li>
                </ul>

                <h2>Why Seasonal Resets Matter</h2>
                <p>
                    Seasonal resets serve several important purposes in the Bimon ecosystem:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Fresh competition:</strong> New seasons create excitement and motivate players to compete for top positions again.</li>
                    <li><strong>Fair opportunity:</strong> New players aren&apos;t permanently behind veterans. A new season means everyone competes on equal footing.</li>
                    <li><strong>Meta adaptation:</strong> As BGMI updates change the game meta, seasonal resets reflect the evolving competitive landscape.</li>
                    <li><strong>Engagement:</strong> Season-end pushes for leaderboard positions create intense, exciting tournament periods.</li>
                </ul>

                <h2>Viewing Past Seasons</h2>
                <p>
                    All past season data is archived and viewable on your player profile. You can browse
                    leaderboards from previous seasons, compare your performance across seasons, and
                    track your improvement over time. This historical data is one of the most valuable
                    features for players who want to see their competitive growth.
                </p>

                <h2>Season Rewards</h2>
                <p>
                    At the end of each season, top performers on the leaderboard may receive special
                    recognition — from profile badges to bonus BP prizes. The exact rewards vary by
                    season and are announced at the start of each new season. Consistently finishing
                    in the top ranks across multiple seasons is the mark of a truly elite Bimon player.
                </p>
            </div>
        ),
    },

    "community-guidelines": {
        title: "Community Guidelines: Fair Play & Sportsmanship on Bimon",
        description: "Bimon's community guidelines covering fair play, sportsmanship, reporting, and the merit system. Learn what's expected of every player on the platform.",
        date: "2026-04-18",
        readTime: "5 min read",
        category: "Guides",
        content: (
            <div className="space-y-6">
                <p>
                    Bimon is built on the principle that competitive gaming should be fair, respectful,
                    and enjoyable for everyone. These community guidelines outline the behavior we expect
                    from every player on the platform. Following these guidelines helps maintain a
                    positive competitive environment and protects your merit score.
                </p>

                <h2>Fair Play</h2>
                <p>
                    Fair play is the foundation of competitive integrity on Bimon. Every player is
                    expected to compete honestly and within the rules:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>No cheating:</strong> Using hacks, aimbots, wall hacks, or any third-party software that provides an unfair advantage is strictly prohibited. Cheaters are permanently banned.</li>
                    <li><strong>No teaming:</strong> Colluding with players on other teams during a match (sharing positions, avoiding fights, coordinating kills) is not allowed.</li>
                    <li><strong>No exploitation:</strong> Deliberately exploiting game bugs or glitches for competitive advantage is prohibited.</li>
                    <li><strong>Honest results:</strong> Tournament results must be reported accurately. Falsifying scores or stats will result in penalties.</li>
                </ul>

                <h2>Sportsmanship</h2>
                <p>
                    Good sportsmanship means treating every player — teammates and opponents alike —
                    with respect and dignity:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>Respect all players:</strong> Toxic behavior, harassment, bullying, and personal attacks have no place on Bimon. Treat others as you want to be treated.</li>
                    <li><strong>Grace in victory and defeat:</strong> Win with humility and lose with dignity. Every tournament is a learning experience.</li>
                    <li><strong>Constructive communication:</strong> Feedback and criticism should be constructive. Help your teammates improve rather than tearing them down.</li>
                    <li><strong>Show up:</strong> If you register for a tournament, show up and play. Consistently abandoning tournaments wastes other players&apos; time and entry fees.</li>
                </ul>

                <h2>The Merit System</h2>
                <p>
                    Bimon uses a merit system to track player behavior and reliability. Your merit
                    score is a numerical representation of your sportsmanship and consistency:
                </p>
                <ul className="space-y-2 list-disc pl-5">
                    <li><strong>High merit:</strong> Earned by showing up for tournaments, playing fairly, and being a positive community member. High merit unlocks priority access to special tournaments.</li>
                    <li><strong>Low merit:</strong> Caused by no-shows, unsportsmanlike behavior, or rule violations. Low merit may restrict your ability to join certain tournaments.</li>
                    <li><strong>Merit recovery:</strong> If your merit drops, you can recover it by consistently participating in tournaments and maintaining good behavior over time.</li>
                </ul>

                <h2>Reporting</h2>
                <p>
                    If you encounter a player who is cheating, being abusive, or violating these guidelines,
                    report them through the platform. Reports are reviewed by the admin team, and appropriate
                    action is taken. All reports are treated confidentially — the reported player will not
                    know who filed the report.
                </p>

                <h2>Consequences</h2>
                <p>
                    Violations of these guidelines result in escalating consequences:
                </p>
                <ol className="space-y-2 list-decimal pl-5">
                    <li><strong>Warning:</strong> First-time minor violations receive a warning and merit deduction.</li>
                    <li><strong>Temporary ban:</strong> Repeated violations or serious offenses result in a temporary suspension from tournaments.</li>
                    <li><strong>Permanent ban:</strong> Severe violations (cheating, harassment) result in a permanent ban from the platform.</li>
                </ol>

                <h2>Building a Better Community</h2>
                <p>
                    Every player contributes to the culture of the Bimon community. By following these
                    guidelines and holding yourself to a high standard of sportsmanship, you help create
                    an environment where competitive gaming thrives and every player feels welcome.
                    Remember: the goal is not just to win — it&apos;s to compete with honor and earn the
                    respect of your fellow players.
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
