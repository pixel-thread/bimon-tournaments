import { Swords, Users, Trophy, Shield, Zap, Target, Star, ChevronRight, BarChart3, Award, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { HeroCTA, HeroHeading } from "@/components/landing/hero-cta";
import { LastRouteRedirector } from "@/components/common/last-route-redirector";
import { PwaInstallPrompt } from "@/components/common/pwa-install-prompt";
import { GAME } from "@/lib/game-config";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `${GAME.gameName} Tournaments — Compete, Win & Earn | Bimon`,
    description: `Join organized ${GAME.gameName} tournaments on Bimon. Fair skill-balanced teams, ${GAME.currency} prize pools, real-time leaderboards, merit ratings, and a thriving competitive community across Northeast India.`,
    keywords: [
        GAME.gameName, "tournament", "esports", "competitive gaming",
        "Northeast India", "BGMI tournament", "mobile gaming",
        "prize pool", "leaderboard", "esports platform",
    ],
};

/**
 * Public landing page — / route.
 * Note: "/" redirects to "/players" via next.config.ts for returning users.
 * This page is still accessible and provides rich SEO content.
 */
export default function HomePage() {
    return (
        <div className="min-h-dvh bg-background text-foreground">
            <LastRouteRedirector />
            <PwaInstallPrompt />

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* HERO SECTION                                               */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 sm:pt-36">
                {/* Animated background blobs */}
                <div className="absolute left-1/4 top-20 -z-10 h-72 w-72 rounded-full bg-blue-600/20 blur-[100px]" />
                <div className="absolute right-1/4 top-40 -z-10 h-60 w-60 rounded-full bg-violet-600/20 blur-[100px]" />
                <div className="absolute bottom-0 left-1/2 -z-10 h-40 w-[600px] -translate-x-1/2 rounded-full bg-cyan-600/10 blur-[80px]" />

                <div className="mx-auto max-w-2xl text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60 backdrop-blur-sm">
                        <Swords className="h-3.5 w-3.5 text-blue-400" />
                        {GAME.gameName} Community Platform
                    </div>

                    <HeroHeading />

                    <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-foreground/50">
                        Join organized {GAME.gameName} tournaments with skill-balanced teams,
                        {GAME.currency} prize pools, and real-time stat tracking.
                    </p>

                    <div className="mt-10 flex items-center justify-center gap-4">
                        <HeroCTA />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ABOUT — What is Bimon Tournament?                          */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section id="about" className="px-4 py-16 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        What is Bimon Tournament?
                    </h2>
                    <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground/70">
                        <p>
                            Bimon is a community-driven esports platform built for {GAME.gameName} players
                            across Northeast India. We organize regular competitive tournaments where players
                            compete in fair, skill-balanced matches to win {GAME.currency} prizes and climb
                            the leaderboards.
                        </p>
                        <p>
                            Unlike random matchmaking, Bimon uses a smart team-generation system that balances
                            squads based on player performance history. This means every match is competitive,
                            every team has a fighting chance, and your individual skill truly matters. Our
                            platform tracks kills, placements, assists, and more — giving every player a
                            detailed stat profile.
                        </p>
                        <p>
                            Whether you&apos;re a casual player looking for organized matches or a competitive
                            grinder aiming for the top of the leaderboard, Bimon provides the structure,
                            fairness, and community that mobile esports deserves. We serve players across
                            Meghalaya, Nagaland, Manipur, and beyond.
                        </p>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* FEATURES GRID                                              */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section id="features" className="bg-foreground/[0.02] px-4 py-16 sm:px-6">
                <div className="mx-auto max-w-4xl">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Why Players Choose Bimon
                        </h2>
                        <p className="mx-auto mt-3 max-w-xl text-foreground/50">
                            Everything you need for a fair, competitive, and rewarding {GAME.gameName} experience.
                        </p>
                    </div>
                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <FeatureCard
                            icon={<Shield className="h-5 w-5" />}
                            title="Fair Team Balancing"
                            description={`Our algorithm creates skill-balanced squads using historical performance data. No more one-sided stomps — every team gets a fair shot at winning.`}
                            gradient="from-blue-500/20 to-cyan-500/20"
                        />
                        <FeatureCard
                            icon={<Trophy className="h-5 w-5" />}
                            title={`${GAME.currency} Prize Pools`}
                            description={`Compete for real ${GAME.currency} prizes distributed to top-performing players after every tournament. The better you play, the more you earn.`}
                            gradient="from-amber-500/20 to-orange-500/20"
                        />
                        <FeatureCard
                            icon={<BarChart3 className="h-5 w-5" />}
                            title="Detailed Statistics"
                            description="Track your kills, placement points, K/D ratio, average damage, and more. Every match is recorded with comprehensive stat breakdowns."
                            gradient="from-violet-500/20 to-purple-500/20"
                        />
                        <FeatureCard
                            icon={<Star className="h-5 w-5" />}
                            title="Merit Rating System"
                            description="Build your reputation with our merit system. Good sportsmanship and consistent performance are recognized and rewarded."
                            gradient="from-emerald-500/20 to-green-500/20"
                        />
                        <FeatureCard
                            icon={<Users className="h-5 w-5" />}
                            title="Squad & Clan System"
                            description="Create or join squads with friends, build clans, and compete as a team. Squad captains receive match details directly via WhatsApp."
                            gradient="from-rose-500/20 to-pink-500/20"
                        />
                        <FeatureCard
                            icon={<Zap className="h-5 w-5" />}
                            title="Multiple Tournament Formats"
                            description={`From Classic Battle Royale to TDM and World of Wonder — we run diverse tournament formats to keep the competition fresh and exciting.`}
                            gradient="from-cyan-500/20 to-blue-500/20"
                        />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* HOW IT WORKS                                               */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section id="how-it-works" className="px-4 py-16 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        How It Works
                    </h2>
                    <p className="mt-3 text-foreground/50">
                        Getting started with Bimon tournaments is simple. Here&apos;s how it works from sign-up to prize collection.
                    </p>

                    <div className="mt-10 space-y-8">
                        <Step
                            number={1}
                            title="Create Your Account"
                            description={`Sign up with your email or social account, then link your ${GAME.gameName} ID. Your in-game stats will be automatically tracked from your very first tournament.`}
                        />
                        <Step
                            number={2}
                            title="Vote in a Tournament Poll"
                            description={`Browse active tournament polls and vote to register. Each poll shows the tournament format, entry fee (if any), prize pool, and schedule. Your vote confirms your participation.`}
                        />
                        <Step
                            number={3}
                            title="Get Matched into a Balanced Team"
                            description={`Our team-generation algorithm assigns you to a skill-balanced squad. Teams are created using your performance history to ensure competitive, fair matches. Squad captains receive room details via WhatsApp.`}
                        />
                        <Step
                            number={4}
                            title="Play the Match"
                            description={`Join the custom room at the scheduled time, play your best, and let the results speak. Kills, placement, and assists are all tracked and scored using our point system.`}
                        />
                        <Step
                            number={5}
                            title={`Earn ${GAME.currency} & Climb the Leaderboard`}
                            description={`Top performers earn ${GAME.currency} prizes deposited directly to their Bimon wallet. Your stats update in real-time on the leaderboard, building your competitive profile over the season.`}
                        />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* TOURNAMENT FORMATS                                         */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section id="formats" className="bg-foreground/[0.02] px-4 py-16 sm:px-6">
                <div className="mx-auto max-w-4xl">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-center">
                        Tournament Formats
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-center text-foreground/50">
                        We run multiple tournament formats to keep competition diverse and engaging.
                    </p>
                    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <FormatCard
                            icon={<Target className="h-6 w-6 text-blue-400" />}
                            title="Battle Royale (Classic)"
                            description="The core format. Up to 64 players in skill-balanced squads compete in classic BR matches. Points are awarded for kills and placement using the BGMI scoring system."
                        />
                        <FormatCard
                            icon={<Swords className="h-6 w-6 text-rose-400" />}
                            title="Team Deathmatch (TDM)"
                            description="Fast-paced 4v4 or 8v8 elimination rounds. Pure combat skill matters here — no circle RNG, just aim and teamwork in intense close-quarters battles."
                        />
                        <FormatCard
                            icon={<Gamepad2 className="h-6 w-6 text-emerald-400" />}
                            title="World of Wonder (WoW)"
                            description="Creative custom map tournaments featuring unique game modes built in BGMI's World of Wonder editor. Fresh experiences every week with community-designed maps."
                        />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SCORING SYSTEM                                             */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section id="scoring" className="px-4 py-16 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        Scoring & Points System
                    </h2>
                    <p className="mt-3 text-foreground/50">
                        Our scoring system rewards both survival and aggression. Here&apos;s how points are calculated in Battle Royale tournaments.
                    </p>

                    <div className="mt-8 grid gap-6 sm:grid-cols-2">
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
                            <h3 className="flex items-center gap-2 text-lg font-bold">
                                <Award className="h-5 w-5 text-amber-400" />
                                Placement Points
                            </h3>
                            <div className="mt-4 space-y-2 text-sm text-foreground/70">
                                <div className="flex justify-between border-b border-foreground/5 pb-1">
                                    <span>🥇 1st Place (Chicken Dinner)</span>
                                    <span className="font-bold text-amber-400">10 pts</span>
                                </div>
                                <div className="flex justify-between border-b border-foreground/5 pb-1">
                                    <span>🥈 2nd Place</span>
                                    <span className="font-bold">6 pts</span>
                                </div>
                                <div className="flex justify-between border-b border-foreground/5 pb-1">
                                    <span>🥉 3rd Place</span>
                                    <span className="font-bold">5 pts</span>
                                </div>
                                <div className="flex justify-between border-b border-foreground/5 pb-1">
                                    <span>4th Place</span>
                                    <span className="font-bold">4 pts</span>
                                </div>
                                <div className="flex justify-between border-b border-foreground/5 pb-1">
                                    <span>5th Place</span>
                                    <span className="font-bold">3 pts</span>
                                </div>
                                <div className="flex justify-between border-b border-foreground/5 pb-1">
                                    <span>6th Place</span>
                                    <span className="font-bold">2 pts</span>
                                </div>
                                <div className="flex justify-between border-b border-foreground/5 pb-1">
                                    <span>7th–8th Place</span>
                                    <span className="font-bold">1 pt</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>9th–16th Place</span>
                                    <span className="font-bold text-foreground/40">0 pts</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
                            <h3 className="flex items-center gap-2 text-lg font-bold">
                                <Target className="h-5 w-5 text-rose-400" />
                                Kill Points
                            </h3>
                            <div className="mt-4 space-y-3 text-sm text-foreground/70">
                                <p>
                                    Every kill earns <span className="font-bold text-foreground">1 point</span> per
                                    elimination. This rewards aggressive play and fragging ability alongside
                                    survival strategy.
                                </p>
                                <p>
                                    Your total score per match = Placement Points + Kill Points. This balanced
                                    approach ensures that both fraggers and strategic players can excel.
                                </p>
                                <p>
                                    Season leaderboards aggregate scores across all matches, with separate
                                    rankings for Ranked (squad-based) and Casual (random team) tournaments.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* COMMUNITY & REGIONS                                        */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section id="community" className="bg-foreground/[0.02] px-4 py-16 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        Our Community
                    </h2>
                    <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground/70">
                        <p>
                            Bimon started as a small community tournament organizer in Meghalaya, and has grown
                            into a platform serving competitive {GAME.gameName} players across multiple states
                            in Northeast India. Our community includes players from Meghalaya, Nagaland,
                            Manipur, and beyond.
                        </p>
                        <p>
                            We believe in grassroots esports — making competitive gaming accessible to everyone,
                            not just professional teams. Every player gets the same fair treatment: balanced teams,
                            transparent scoring, real prizes, and a supportive community that helps each other
                            improve.
                        </p>
                        <p>
                            Our tournament schedule runs throughout the week with both Casual and Ranked events.
                            Casual tournaments use random team assignment for a fun, unpredictable experience.
                            Ranked tournaments allow premade squads to compete, testing coordinated team play
                            at the highest level.
                        </p>
                    </div>

                    <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
                            <div className="text-2xl font-extrabold text-blue-400">100+</div>
                            <div className="mt-1 text-xs text-foreground/50">Active Players</div>
                        </div>
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
                            <div className="text-2xl font-extrabold text-violet-400">500+</div>
                            <div className="mt-1 text-xs text-foreground/50">Matches Played</div>
                        </div>
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
                            <div className="text-2xl font-extrabold text-emerald-400">3</div>
                            <div className="mt-1 text-xs text-foreground/50">States Served</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* FAQ                                                        */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section id="faq" className="px-4 py-16 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        Frequently Asked Questions
                    </h2>
                    <div className="mt-8 space-y-6">
                        <FaqItem
                            question="Is Bimon free to use?"
                            answer={`Yes! Creating an account and browsing the platform is completely free. Some tournaments may have small ${GAME.currency} entry fees that go directly into the prize pool, while many tournaments are free-entry with prizes funded by the community.`}
                        />
                        <FaqItem
                            question="How are teams balanced?"
                            answer="Our algorithm analyzes each player's historical performance — K/D ratio, average kills, placement history, and overall points — then creates squads that are balanced in overall strength. This prevents stacking and ensures competitive matches."
                        />
                        <FaqItem
                            question={`How do I receive my ${GAME.currency} prizes?`}
                            answer={`Prizes are deposited to your Bimon wallet after match results are confirmed. You can request a withdrawal to receive ${GAME.currency} directly to your ${GAME.gameName} account. The process is transparent and tracked.`}
                        />
                        <FaqItem
                            question="What regions do you serve?"
                            answer="We currently serve players across Northeast India, including Meghalaya, Nagaland, and Manipur. We're expanding to more regions as our community grows. Each state has a dedicated help representative you can contact."
                        />
                        <FaqItem
                            question="How often are tournaments held?"
                            answer="We run tournaments multiple times per week, including both Casual (random teams) and Ranked (squad-based) events. Check the Vote page for upcoming tournament polls and register by voting."
                        />
                        <FaqItem
                            question="What is the Merit system?"
                            answer="Merit is a reputation score that reflects your sportsmanship and reliability. Players who consistently show up for matches, follow rules, and play fairly maintain high merit. Low merit may result in restrictions on tournament participation."
                        />
                        <FaqItem
                            question="Can I play with my friends?"
                            answer="Yes! In Ranked tournaments, you can create a squad with friends and compete as a premade team. Squad captains receive room details directly via WhatsApp. Casual tournaments use random team assignment for variety."
                        />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* CTA FOOTER                                                 */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="px-4 py-16 sm:px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        Ready to Compete?
                    </h2>
                    <p className="mx-auto mt-3 max-w-lg text-foreground/50">
                        Join the Bimon community and start earning {GAME.currency} in organized,
                        fair {GAME.gameName} tournaments today.
                    </p>
                    <div className="mt-8 flex items-center justify-center gap-4">
                        <HeroCTA />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SITE FOOTER                                                */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <footer className="border-t border-foreground/10 px-4 py-8 sm:px-6">
                <div className="mx-auto max-w-4xl">
                    <div className="grid gap-8 sm:grid-cols-3">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/40">Platform</h3>
                            <ul className="mt-3 space-y-2 text-sm">
                                <li><Link href="/players" className="text-foreground/60 hover:text-foreground transition-colors">Leaderboard</Link></li>
                                <li><Link href="/vote" className="text-foreground/60 hover:text-foreground transition-colors">Tournaments</Link></li>
                                <li><Link href="/rules" className="text-foreground/60 hover:text-foreground transition-colors">Rules</Link></li>
                                <li><Link href="/winners" className="text-foreground/60 hover:text-foreground transition-colors">Winners</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/40">Community</h3>
                            <ul className="mt-3 space-y-2 text-sm">
                                <li><Link href="/community" className="text-foreground/60 hover:text-foreground transition-colors">Community Hub</Link></li>
                                <li><Link href="/help" className="text-foreground/60 hover:text-foreground transition-colors">Help & Support</Link></li>
                                <li><Link href="/socials" className="text-foreground/60 hover:text-foreground transition-colors">Social Media</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/40">Legal</h3>
                            <ul className="mt-3 space-y-2 text-sm">
                                <li><Link href="/privacy" className="text-foreground/60 hover:text-foreground transition-colors">Privacy Policy</Link></li>
                                <li><Link href="/terms" className="text-foreground/60 hover:text-foreground transition-colors">Terms of Service</Link></li>
                                <li><Link href="/contact" className="text-foreground/60 hover:text-foreground transition-colors">Contact Us</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-8 border-t border-foreground/10 pt-6 text-center text-xs text-foreground/30">
                        <p>© {new Date().getFullYear()} Bimon Tournament — Pixel Thread. All rights reserved.</p>
                        <p className="mt-1">
                            {GAME.gameName} is a registered trademark of its respective owners. Bimon is not affiliated with or endorsed by the game publisher.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

/* ─── Sub-components (server components — no "use client") ─── */

function FeatureCard({ icon, title, description, gradient }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    gradient: string;
}) {
    return (
        <div className={`rounded-xl border border-foreground/10 bg-gradient-to-br ${gradient} p-5`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/10 text-foreground">
                {icon}
            </div>
            <h3 className="mt-4 text-base font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">{description}</p>
        </div>
    );
}

function Step({ number, title, description }: {
    number: number;
    title: string;
    description: string;
}) {
    return (
        <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white">
                {number}
            </div>
            <div className="flex-1">
                <h3 className="text-base font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/60">{description}</p>
            </div>
        </div>
    );
}

function FormatCard({ icon, title, description }: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-xl border border-foreground/10 bg-background p-5">
            <div className="mb-3">{icon}</div>
            <h3 className="text-base font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">{description}</p>
        </div>
    );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
    return (
        <div className="border-b border-foreground/10 pb-5">
            <h3 className="text-base font-semibold">{question}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">{answer}</p>
        </div>
    );
}
