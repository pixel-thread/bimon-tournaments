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
        "mobile gaming", `${GAME.gameName} tournament`,
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
                            {GAME.name} is a community-driven esports platform built for {GAME.gameName} players.
                            We organize regular competitive tournaments where players compete to win {GAME.currency} prizes
                            and climb the leaderboards.
                        </p>
                        {GAME.features.hasBR ? (
                            <p>
                                Unlike random matchmaking, {GAME.name} uses a smart team-generation system that balances
                                squads based on player performance history. This means every match is competitive,
                                every team has a fighting chance, and your individual skill truly matters. Our
                                platform tracks kills, placements, assists, and more — giving every player a
                                detailed stat profile.
                            </p>
                        ) : (
                            <p>
                                {GAME.name} provides automated bracket generation, live score tracking, and a fair
                                dispute system for every match. Whether it&apos;s a 1v1 knockout, round-robin league,
                                or World Cup-style group stage — every result is tracked transparently and your
                                competitive record builds over time.
                            </p>
                        )}
                        <p>
                            Whether you&apos;re a casual player looking for organized matches or a competitive
                            grinder aiming for the top of the leaderboard, {GAME.name} provides the structure,
                            fairness, and community that mobile esports deserves.
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
                        {GAME.features.hasBR && (
                            <FeatureCard
                                icon={<Shield className="h-5 w-5" />}
                                title="Fair Team Balancing"
                                description="Our algorithm creates skill-balanced squads using historical performance data. No more one-sided stomps — every team gets a fair shot at winning."
                                gradient="from-blue-500/20 to-cyan-500/20"
                            />
                        )}
                        {GAME.features.hasBracket && (
                            <FeatureCard
                                icon={<Shield className="h-5 w-5" />}
                                title="Auto Bracket & Seeding"
                                description="Brackets are generated automatically with fair seeding. No manual draws, no bias — just sign up and compete."
                                gradient="from-blue-500/20 to-cyan-500/20"
                            />
                        )}
                        <FeatureCard
                            icon={<Trophy className="h-5 w-5" />}
                            title={`${GAME.currency} Prize Pools`}
                            description={`Compete for real ${GAME.currency} prizes distributed to top-performing players after every tournament. The better you play, the more you earn.`}
                            gradient="from-amber-500/20 to-orange-500/20"
                        />
                        <FeatureCard
                            icon={<BarChart3 className="h-5 w-5" />}
                            title="Detailed Statistics"
                            description={GAME.features.hasBR
                                ? "Track your kills, placement points, K/D ratio, average damage, and more. Every match is recorded with comprehensive stat breakdowns."
                                : "Track your match history, win rate, tournament results, and competitive record. Every result is recorded on your player profile."
                            }
                            gradient="from-violet-500/20 to-purple-500/20"
                        />
                        {GAME.features.hasMerit && (
                            <FeatureCard
                                icon={<Star className="h-5 w-5" />}
                                title="Merit Rating System"
                                description="Build your reputation with our merit system. Good sportsmanship and consistent performance are recognized and rewarded."
                                gradient="from-emerald-500/20 to-green-500/20"
                            />
                        )}
                        {GAME.features.hasBracket && (
                            <FeatureCard
                                icon={<Shield className="h-5 w-5" />}
                                title="Fair Dispute System"
                                description="Submit your match score and your opponent has a window to confirm or dispute. Fair results, every time — no arguments."
                                gradient="from-emerald-500/20 to-green-500/20"
                            />
                        )}
                        {(GAME.features.hasSquads || GAME.features.hasClans) && (
                            <FeatureCard
                                icon={<Users className="h-5 w-5" />}
                                title={GAME.features.hasSquads ? "Squad & Clan System" : "Clan System"}
                                description={GAME.features.hasSquads
                                    ? "Create or join squads with friends, build clans, and compete as a team. Squad captains receive match details directly via WhatsApp."
                                    : `Join or create a ${GAME.clanLabel.toLowerCase()} to represent your community and compete together.`
                                }
                                gradient="from-rose-500/20 to-pink-500/20"
                            />
                        )}
                        <FeatureCard
                            icon={<Zap className="h-5 w-5" />}
                            title="Multiple Tournament Formats"
                            description={GAME.features.hasBR
                                ? "From Classic Battle Royale to TDM and World of Wonder — we run diverse tournament formats to keep the competition fresh and exciting."
                                : `From 1v1 Knockout to ${GAME.features.hasLeague ? "Round-Robin League and " : ""}World Cup-style Group + Knockout — we run diverse formats for every skill level.`
                            }
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
                        Getting started with {GAME.name} tournaments is simple. Here&apos;s how it works from sign-up to prize collection.
                    </p>

                    <div className="mt-10 space-y-8">
                        <Step
                            number={1}
                            title="Create Your Account"
                            description={`Sign up with your email or social account, then link your ${GAME.gameName} ID. Your stats will be automatically tracked from your very first tournament.`}
                        />
                        <Step
                            number={2}
                            title="Register for a Tournament"
                            description="Browse active tournament polls and vote to register. Each poll shows the format, entry fee (if any), prize pool, and schedule. Your vote confirms your spot."
                        />
                        <Step
                            number={3}
                            title={GAME.features.hasBR ? "Get Matched into a Balanced Team" : "Get Seeded into the Bracket"}
                            description={GAME.features.hasBR
                                ? "Our team-generation algorithm assigns you to a skill-balanced squad. Teams are created using your performance history to ensure competitive, fair matches."
                                : "Once registration closes, the bracket is generated automatically. You'll see your opponent and match schedule right on the platform."
                            }
                        />
                        <Step
                            number={4}
                            title="Play the Match"
                            description={GAME.features.hasBR
                                ? "Join the custom room at the scheduled time, play your best, and let the results speak. Kills, placement, and assists are all tracked and scored."
                                : "Play your match, then submit the result. Your opponent has a fair window to confirm or dispute. No screenshots on WhatsApp — everything is tracked on the platform."
                            }
                        />
                        <Step
                            number={5}
                            title={`Earn ${GAME.currency} & Climb the Leaderboard`}
                            description={`Top performers earn ${GAME.currency} prizes deposited directly to their ${GAME.name} wallet. Your stats update in real-time on the leaderboard, building your competitive profile.`}
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
                        {GAME.features.hasBR && (
                            <FormatCard
                                icon={<Target className="h-6 w-6 text-blue-400" />}
                                title="Battle Royale (Classic)"
                                description={`The core format. Up to 64 players in skill-balanced squads compete in classic BR matches. Points are awarded for kills and placement using the ${GAME.gameName} scoring system.`}
                            />
                        )}
                        {GAME.features.hasTDM && (
                            <FormatCard
                                icon={<Swords className="h-6 w-6 text-rose-400" />}
                                title="Team Deathmatch (TDM)"
                                description={`Fast-paced ${GAME.tdmTeamSizes.map(s => `${s}v${s}`).join(" or ")} elimination rounds. Pure combat skill matters here — no circle RNG, just aim and teamwork.`}
                            />
                        )}
                        {GAME.features.hasWoW && (
                            <FormatCard
                                icon={<Gamepad2 className="h-6 w-6 text-emerald-400" />}
                                title="World of Wonder (WoW)"
                                description={`Creative custom map tournaments featuring unique game modes built in ${GAME.gameName}'s World of Wonder editor. Fresh experiences every week.`}
                            />
                        )}
                        {GAME.features.hasBracket && (
                            <FormatCard
                                icon={<Swords className="h-6 w-6 text-rose-400" />}
                                title="1v1 Knockout Bracket"
                                description="Single-elimination bracket tournament. Win your match to advance, lose and you're out. Simple, intense, and rewarding."
                            />
                        )}
                        {GAME.features.hasLeague && (
                            <FormatCard
                                icon={<BarChart3 className="h-6 w-6 text-violet-400" />}
                                title="Round-Robin League"
                                description="Play every opponent in your group. Points are tallied across all matches — consistency and stamina win the day."
                            />
                        )}
                        {GAME.features.hasGroupKnockout && (
                            <FormatCard
                                icon={<Trophy className="h-6 w-6 text-amber-400" />}
                                title="Group + Knockout (World Cup)"
                                description="Group stage into knockout rounds — just like the FIFA World Cup. Survive your group, then battle through the bracket to the final."
                            />
                        )}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SCORING SYSTEM                                             */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Scoring: only show for BR games */}
            {GAME.features.hasBR && (
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
                                        Season leaderboards aggregate scores across all matches{GAME.features.hasRankedCasual ? ", with separate rankings for Ranked and Casual tournaments" : ""}.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Scoring: bracket games get a simpler explanation */}
            {GAME.features.hasBracket && (
                <section id="scoring" className="px-4 py-16 sm:px-6">
                    <div className="mx-auto max-w-3xl">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            How Matches Work
                        </h2>
                        <p className="mt-3 text-foreground/50">
                            Simple, transparent, and fair — here&apos;s what happens in every match.
                        </p>
                        <div className="mt-8 grid gap-6 sm:grid-cols-2">
                            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
                                <h3 className="flex items-center gap-2 text-lg font-bold">
                                    <Swords className="h-5 w-5 text-rose-400" />
                                    Score Submission
                                </h3>
                                <div className="mt-4 space-y-3 text-sm text-foreground/70">
                                    <p>After playing your match, submit the final score on the platform. No screenshots on WhatsApp — everything is recorded digitally.</p>
                                    <p>Your opponent gets a <span className="font-bold text-foreground">{GAME.disputeWindowMinutes}-minute window</span> to confirm or dispute the result.</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
                                <h3 className="flex items-center gap-2 text-lg font-bold">
                                    <Trophy className="h-5 w-5 text-amber-400" />
                                    Advancing & Prizes
                                </h3>
                                <div className="mt-4 space-y-3 text-sm text-foreground/70">
                                    <p>Win your match to advance to the next round. The bracket updates in real-time so everyone can follow the action.</p>
                                    <p>{GAME.currency} prizes are distributed to top finishers and deposited directly to your {GAME.name} wallet.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

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
                            {GAME.name} is a growing competitive platform for {GAME.gameName} players.
                            We organize regular tournaments where every player gets a fair shot
                            at winning {GAME.currency} prizes.
                        </p>
                        <p>
                            We believe in grassroots esports — making competitive gaming accessible to everyone,
                            not just professional teams. Every player gets transparent scoring, real prizes,
                            and a supportive community that helps each other improve.
                        </p>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4 text-center">
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
                            <div className="text-2xl font-extrabold text-blue-400">🎮</div>
                            <div className="mt-1 text-xs text-foreground/50">Active Tournaments</div>
                        </div>
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
                            <div className="text-2xl font-extrabold text-violet-400">{GAME.currencyEmoji}</div>
                            <div className="mt-1 text-xs text-foreground/50">Real {GAME.currency} Prizes</div>
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
                            question={`Is ${GAME.name} free to use?`}
                            answer={`Yes! Creating an account and browsing the platform is completely free. Some tournaments may have small ${GAME.currency} entry fees that go directly into the prize pool, while many tournaments are free-entry.`}
                        />
                        {GAME.features.hasBR && (
                            <FaqItem
                                question="How are teams balanced?"
                                answer="Our algorithm analyzes each player's historical performance — K/D ratio, average kills, placement history, and overall points — then creates squads that are balanced in overall strength. This prevents stacking and ensures competitive matches."
                            />
                        )}
                        {GAME.features.hasBracket && (
                            <FaqItem
                                question="How does the bracket work?"
                                answer={`After registration closes, the bracket is generated automatically. You play your match and submit the score. Your opponent has ${GAME.disputeWindowMinutes} minutes to confirm or dispute. Once confirmed, the bracket updates and the next round begins.`}
                            />
                        )}
                        <FaqItem
                            question={`How do I receive my ${GAME.currency} prizes?`}
                            answer={`Prizes are deposited to your ${GAME.name} wallet after match results are confirmed. You can request a withdrawal to receive ${GAME.currency} directly. The process is transparent and tracked.`}
                        />
                        <FaqItem
                            question="How often are tournaments held?"
                            answer="We run tournaments regularly. Check the Vote page for upcoming tournament polls and register by voting."
                        />
                        {GAME.features.hasMerit && (
                            <FaqItem
                                question="What is the Merit system?"
                                answer="Merit is a reputation score that reflects your sportsmanship and reliability. Players who consistently show up for matches, follow rules, and play fairly maintain high merit. Low merit may result in restrictions on tournament participation."
                            />
                        )}
                        {GAME.features.hasSquads ? (
                            <FaqItem
                                question="Can I play with my friends?"
                                answer="Yes! In Ranked tournaments, you can create a squad with friends and compete as a premade team. Squad captains receive room details directly via WhatsApp."
                            />
                        ) : GAME.features.hasBracket ? (
                            <FaqItem
                                question="What if my opponent doesn't show up?"
                                answer="If your opponent fails to submit a result within the time window, you can claim a walkover win. The platform handles no-shows fairly."
                            />
                        ) : null}
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
                        Join the {GAME.name} community and start earning {GAME.currency} in organized,
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
