import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { GAME } from "@/lib/game-config";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: `Terms of Service for Bimon Tournament — ${GAME.gameName} esports platform. Rules, eligibility, virtual currency policies, and user conduct guidelines.`,
};

export default function TermsOfServicePage() {
    const lastUpdated = "May 3, 2026";

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60">
                        <FileText className="h-3.5 w-3.5 text-blue-400" />
                        Legal
                    </div>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        Terms of Service
                    </h1>
                    <p className="mt-2 text-sm text-foreground/40">Last updated: {lastUpdated}</p>
                </div>

                {/* Content */}
                <div className="prose-custom space-y-8 text-base leading-relaxed text-foreground/70">
                    <section>
                        <h2 className="text-xl font-bold text-foreground">1. Acceptance of Terms</h2>
                        <p className="mt-3">
                            By accessing or using the Bimon Tournament platform (&quot;Platform&quot;), operated
                            by Pixel Thread at pixel-thread.in, you agree to be bound by these Terms of Service
                            (&quot;Terms&quot;). If you do not agree to these Terms, you must not use the Platform.
                        </p>
                        <p className="mt-3">
                            We reserve the right to modify these Terms at any time. Continued use of the Platform
                            after changes constitutes acceptance of the modified Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">2. Eligibility</h2>
                        <p className="mt-3">To use the Platform, you must:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Be at least 13 years of age</li>
                            <li>Have a valid {GAME.gameName} account</li>
                            <li>Provide accurate and complete registration information</li>
                            <li>Comply with all applicable laws and regulations</li>
                        </ul>
                        <p className="mt-3">
                            Players under 18 should have parental consent before participating in tournaments
                            with entry fees or {GAME.currency} prize pools.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">3. Account Registration</h2>
                        <p className="mt-3">
                            You are responsible for maintaining the confidentiality of your account credentials
                            and for all activities that occur under your account. You must:
                        </p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Provide your real {GAME.gameName} in-game name (IGN) and character ID</li>
                            <li>Not create multiple accounts or share your account with others</li>
                            <li>Notify us immediately of any unauthorized use of your account</li>
                            <li>Keep your account information up to date</li>
                        </ul>
                        <p className="mt-3">
                            We reserve the right to suspend or terminate accounts that violate these Terms or
                            provide false information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">4. Tournament Participation</h2>
                        <h3 className="mt-4 text-lg font-semibold text-foreground/90">4.1 Registration & Voting</h3>
                        <p className="mt-2">
                            Tournament participation is registered through the voting system. By voting in a
                            tournament poll, you commit to participating in the scheduled match. Failure to
                            show up after registering may affect your merit score.
                        </p>

                        <h3 className="mt-4 text-lg font-semibold text-foreground/90">4.2 Team Assignment</h3>
                        <p className="mt-2">
                            In Casual tournaments, teams are assigned automatically using our skill-balancing
                            algorithm. In Ranked tournaments, players may form premade squads. You agree to
                            play with your assigned team and follow instructions from tournament administrators.
                        </p>

                        <h3 className="mt-4 text-lg font-semibold text-foreground/90">4.3 Match Conduct</h3>
                        <p className="mt-2">During tournaments, you must:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Join the match room at the scheduled time</li>
                            <li>Play fairly without using hacks, cheats, or exploits</li>
                            <li>Not intentionally sabotage your team or other players</li>
                            <li>Follow all {GAME.gameName} community guidelines</li>
                            <li>Accept match results as recorded by the Platform</li>
                        </ul>

                        <h3 className="mt-4 text-lg font-semibold text-foreground/90">4.4 Results & Disputes</h3>
                        <p className="mt-2">
                            Match results are submitted by administrators based on in-game screenshots and data.
                            Players have a dispute window to contest results. Final decisions on disputes are
                            made by tournament administrators and are binding.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">5. Virtual Currency ({GAME.currency})</h2>
                        <p className="mt-3">
                            The Platform uses {GAME.currency} as a virtual currency for entry fees, prizes, and
                            rewards. Important points about {GAME.currency}:
                        </p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>{GAME.currency} held in your Bimon wallet has no real-world monetary value</li>
                            <li>{GAME.currency} can be earned through tournament prizes, referrals, and promotions</li>
                            <li>{GAME.currency} can be used for tournament entry fees and transferred between players</li>
                            <li>Prize distributions are processed after match results are confirmed</li>
                            <li>We reserve the right to adjust {GAME.currency} balances in cases of fraud or error</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">6. Merit & Reputation System</h2>
                        <p className="mt-3">
                            The Platform maintains a merit system to encourage fair play and reliability.
                            Your merit score may be affected by:
                        </p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Consistently showing up for registered tournaments (positive)</li>
                            <li>Good sportsmanship and fair play (positive)</li>
                            <li>Failing to attend registered tournaments (negative)</li>
                            <li>Cheating, toxicity, or rule violations (negative)</li>
                        </ul>
                        <p className="mt-3">
                            Low merit scores may result in restrictions on tournament participation, reduced
                            priority in team assignment, or account suspension.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">7. Prohibited Conduct</h2>
                        <p className="mt-3">You agree not to:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Use hacks, cheats, or third-party software to gain unfair advantages</li>
                            <li>Create multiple accounts to manipulate rankings or prizes</li>
                            <li>Harass, bully, or use abusive language toward other players or administrators</li>
                            <li>Intentionally lose matches or collude with opponents</li>
                            <li>Attempt to exploit bugs or vulnerabilities in the Platform</li>
                            <li>Impersonate other players or administrators</li>
                            <li>Use the Platform for any illegal or unauthorized purpose</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">8. Intellectual Property</h2>
                        <p className="mt-3">
                            The Platform, including its design, features, and content, is owned by Pixel Thread.
                            {GAME.gameName} and all related trademarks are the property of their respective owners.
                            Bimon is an independent community platform and is not affiliated with, endorsed by,
                            or sponsored by the game publisher.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">9. Limitation of Liability</h2>
                        <p className="mt-3">
                            The Platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties
                            of any kind. We are not liable for:
                        </p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Service interruptions, downtime, or technical issues</li>
                            <li>Loss of {GAME.currency} balance due to technical errors</li>
                            <li>Actions of other players during or outside of tournaments</li>
                            <li>Changes to {GAME.gameName} that affect tournament functionality</li>
                            <li>Any indirect, incidental, or consequential damages</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">10. Termination</h2>
                        <p className="mt-3">
                            We reserve the right to suspend or terminate your account at any time for
                            violations of these Terms, cheating, or any behavior deemed harmful to the
                            community. Upon termination, you may lose access to your account data,
                            {GAME.currency} balance, and tournament history.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">11. Governing Law</h2>
                        <p className="mt-3">
                            These Terms are governed by the laws of India. Any disputes arising from these
                            Terms or your use of the Platform shall be resolved through good-faith negotiation
                            first, and if necessary, through the courts of competent jurisdiction.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">12. Contact</h2>
                        <p className="mt-3">
                            For questions about these Terms, please contact us through the{" "}
                            <Link href="/help" className="text-blue-400 underline hover:text-blue-300">Help & Support</Link> page
                            or the <Link href="/contact" className="text-blue-400 underline hover:text-blue-300">Contact</Link> page.
                        </p>
                    </section>
                </div>

                {/* Back link */}
                <div className="mt-12 border-t border-foreground/10 pt-6">
                    <Link href="/" className="text-sm text-foreground/40 hover:text-foreground/60 transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
