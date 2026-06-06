import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { GAME } from "@/lib/game-config";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `Frequently Asked Questions | Bimon ${GAME.gameName} Tournament`,
    description: `Get answers to common questions about Bimon — how to join tournaments, team balancing, prizes, wallets, clans, and more. Everything you need to know about competitive ${GAME.gameName} on Bimon.`,
};

interface FAQItem {
    question: string;
    answer: string;
}

const FAQ_SECTIONS: { title: string; items: FAQItem[] }[] = [
    {
        title: "Getting Started",
        items: [
            {
                question: "What is Bimon?",
                answer: `Bimon is a community-driven esports platform for competitive ${GAME.gameName} tournaments. We organize fair, skill-balanced matches with real prize pools, detailed stat tracking, and seasonal leaderboards. Players can compete individually in Casual tournaments (where the algorithm creates balanced teams) or with premade squads in Ranked tournaments.`,
            },
            {
                question: "How do I create an account?",
                answer: "Click the \"Sign Up\" button on the homepage. You can register using your Discord account for quick authentication. Once registered, link your BGMI ID in your profile settings to start participating in tournaments.",
            },
            {
                question: "Is Bimon free to use?",
                answer: `Yes! Creating an account is completely free. Many tournaments are free to enter with no entry fee. Paid tournaments require ${GAME.currency} from your wallet, but free tournaments are always available for players who want to compete without spending.`,
            },
            {
                question: "How do I join a tournament?",
                answer: "Navigate to the Vote page and find an open tournament poll. Click \"Vote IN\" to register for the tournament. Once registration closes, teams are generated (for Casual) or confirmed (for Ranked), and you'll receive room details via WhatsApp before the match starts.",
            },
        ],
    },
    {
        title: "Tournaments & Matches",
        items: [
            {
                question: "What's the difference between Ranked and Casual tournaments?",
                answer: "Casual tournaments use our automatic team-balancing algorithm — you register individually and get assigned to a skill-balanced squad. Ranked tournaments require premade squads — you form a team with friends and compete as a unit. Both modes have separate leaderboards and stats.",
            },
            {
                question: "How does the team-balancing algorithm work?",
                answer: "Our algorithm analyzes each player's historical stats — K/D ratio, average kills, placement history, and total matches played — to assign a skill rating. Players are then distributed across teams using a snake-draft approach, ensuring each team has a balanced mix of skill levels. The system also checks recent tournaments to avoid pairing the same players together back-to-back.",
            },
            {
                question: "How is scoring calculated?",
                answer: "Tournament scoring uses two components: Placement Points (based on your team's final position — 1st place gets 10 points, 2nd gets 6, etc.) and Kill Points (1 point per elimination). Your total match score is Placement Points + Kill Points. In multi-match tournaments, scores are aggregated across all games.",
            },
            {
                question: "What tournament formats are available?",
                answer: `Bimon supports multiple formats: Battle Royale (classic squad BR), TDM (Team Deathmatch), 1v1 Knockout (single elimination brackets), Round-Robin League (everyone plays everyone), Group + Knockout (World Cup style with group stages leading to elimination rounds), and World of Wonder (creative custom maps).`,
            },
            {
                question: "How do I receive room details for a match?",
                answer: "After teams are generated, room details (Room ID and Password) are shared via WhatsApp. Make sure your WhatsApp number is linked in your Bimon profile settings. Room details are typically shared 5-15 minutes before the match start time.",
            },
        ],
    },
    {
        title: "Wallet & Prizes",
        items: [
            {
                question: `What is ${GAME.currency} and how does the wallet work?`,
                answer: `${GAME.currency} (${GAME.currencyPlural}) is the currency used on the Bimon platform. Your wallet holds your balance for tournament entry fees and winnings. You can add funds through designated payment methods, earn through tournament prizes and referrals, and request withdrawals to convert back to UC.`,
            },
            {
                question: "How are prizes distributed?",
                answer: "Prizes are distributed using a geometric decay system — the top team receives the largest share, with decreasing amounts for lower placements. The exact split depends on the number of teams and the tournament format. Prize amounts are always shown on the tournament page before registration, so you know what's at stake.",
            },
            {
                question: "How do I withdraw my winnings?",
                answer: "Go to your Wallet page and click \"Withdraw.\" Enter the amount you want to withdraw (must meet the minimum threshold shown on the page). Withdrawal requests are processed by the team, typically within 24-48 hours. Your wallet transaction history shows all deposits, fees, prizes, and withdrawals.",
            },
        ],
    },
    {
        title: "Clans & Squads",
        items: [
            {
                question: "What's the difference between a clan and a squad?",
                answer: "A squad is a temporary team formed for a specific Ranked tournament — you and your friends register together for one event. A clan is a permanent group with a shared identity, clan tag, treasury, and long-term stats. Clan members can form squads from within their clan for Ranked tournaments.",
            },
            {
                question: "How do I create a clan?",
                answer: "Navigate to the Clan section from your profile or main menu, click \"Create Clan,\" choose a name (max 30 characters) and tag (3-5 characters), and set your clan to Open or Invite Only. You'll automatically become the clan leader.",
            },
            {
                question: "Can I be in multiple clans?",
                answer: "No, each player can only be a member of one clan at a time. If you want to join a different clan, you'll need to leave your current clan first. This ensures loyalty and commitment to your competitive group.",
            },
        ],
    },
    {
        title: "Stats & Leaderboards",
        items: [
            {
                question: "How does the leaderboard work?",
                answer: "Bimon has separate leaderboards for Ranked and Casual play. Your position is determined by your total accumulated points across all tournaments in the current season. The leaderboard shows kills, K/D ratio, matches played, and total points. When a season ends, leaderboards reset and a new season begins.",
            },
            {
                question: "What is the Merit system?",
                answer: "Merit is a reputation score that reflects your reliability and sportsmanship. You gain merit by showing up for registered tournaments, playing fairly, and being a positive community member. You lose merit for no-shows, unsportsmanlike behavior, or rule violations. High merit can unlock priority access to special tournaments.",
            },
            {
                question: "Do my stats reset every season?",
                answer: "Seasonal stats (points, season kills, season K/D) reset at the start of each new season. However, your lifetime stats (all-time K/D, total kills, total matches) are preserved forever. Your wallet balance, merit score, and clan membership also carry over between seasons.",
            },
        ],
    },
    {
        title: "Technical & Account",
        items: [
            {
                question: "Can I install Bimon on my phone?",
                answer: "Yes! Bimon is a Progressive Web App (PWA). Open the site in your mobile browser, then use the \"Add to Home Screen\" option (or look for the install prompt). This gives you an app-like experience without needing to download from an app store.",
            },
            {
                question: "How do I report a player?",
                answer: "If you encounter cheating, toxic behavior, or rule violations, report the player through the platform. Reports are reviewed by the admin team confidentially — the reported player won't know who filed the report. Depending on severity, consequences range from warnings to permanent bans.",
            },
            {
                question: "I'm having technical issues. How do I get help?",
                answer: "Visit the Help page for common troubleshooting guides, or reach out to the admin team through our Discord server or the Contact page. For urgent issues during a live tournament, message an admin directly on Discord for the fastest response.",
            },
        ],
    },
];

// JSON-LD FAQ structured data for rich search results
function getFAQJsonLd() {
    const allItems = FAQ_SECTIONS.flatMap((s) => s.items);
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: allItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
            },
        })),
    };
}

export default function FAQPage() {
    return (
        <div className="min-h-dvh bg-background text-foreground">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(getFAQJsonLd()) }}
            />

            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60">
                        <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
                        FAQ
                    </div>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        Frequently Asked Questions
                    </h1>
                    <p className="mt-2 text-lg text-foreground/50">
                        Everything you need to know about competing on Bimon. Can&apos;t find your answer?{" "}
                        <Link href="/contact" className="text-blue-400 hover:underline">
                            Contact us
                        </Link>
                        .
                    </p>
                </div>

                {/* FAQ Sections */}
                <div className="space-y-10">
                    {FAQ_SECTIONS.map((section) => (
                        <section key={section.title}>
                            <h2 className="text-xl font-bold text-foreground mb-4">{section.title}</h2>
                            <div className="space-y-3">
                                {section.items.map((item) => (
                                    <details
                                        key={item.question}
                                        className="group rounded-xl border border-foreground/10 bg-foreground/[0.02] transition-colors hover:bg-foreground/[0.04]"
                                    >
                                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-foreground list-none [&::-webkit-details-marker]:hidden">
                                            <span>{item.question}</span>
                                            <span className="shrink-0 text-foreground/30 transition-transform group-open:rotate-45 text-lg">
                                                +
                                            </span>
                                        </summary>
                                        <div className="px-5 pb-4 text-sm leading-relaxed text-foreground/60">
                                            {item.answer}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                {/* CTA */}
                <div className="mt-16 rounded-xl border border-foreground/10 bg-gradient-to-br from-blue-600/10 to-violet-600/10 p-6 text-center">
                    <h3 className="text-lg font-bold">Still have questions?</h3>
                    <p className="mt-2 text-sm text-foreground/50">
                        Join our Discord community or check out our blog for in-depth guides.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-foreground/10"
                        >
                            Read the Blog
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:brightness-110"
                        >
                            Contact Us
                        </Link>
                    </div>
                </div>

                {/* SEO Footer */}
                <div className="mt-16 space-y-4 text-sm text-foreground/50">
                    <p>
                        This FAQ covers the most common questions about the Bimon {GAME.gameName} tournament
                        platform. From getting started and joining your first tournament to understanding the
                        wallet system, team balancing, and seasonal leaderboards — we&apos;ve compiled answers
                        to help you make the most of your competitive experience. For more detailed guides,
                        visit our <Link href="/blog" className="text-blue-400 hover:underline">blog</Link>.
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
