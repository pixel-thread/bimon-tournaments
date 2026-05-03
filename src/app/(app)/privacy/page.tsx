import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import { GAME } from "@/lib/game-config";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: `Privacy Policy for Bimon Tournament — ${GAME.gameName} esports platform. Learn how we collect, use, and protect your personal information.`,
};

export default function PrivacyPolicyPage() {
    const lastUpdated = "May 3, 2026";

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60">
                        <Shield className="h-3.5 w-3.5 text-blue-400" />
                        Legal
                    </div>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        Privacy Policy
                    </h1>
                    <p className="mt-2 text-sm text-foreground/40">Last updated: {lastUpdated}</p>
                </div>

                {/* Content */}
                <div className="prose-custom space-y-8 text-base leading-relaxed text-foreground/70">
                    <section>
                        <h2 className="text-xl font-bold text-foreground">1. Introduction</h2>
                        <p className="mt-3">
                            Welcome to Bimon Tournament (&quot;Bimon&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;),
                            operated by Pixel Thread. This Privacy Policy explains how we collect, use,
                            disclose, and safeguard your information when you use our {GAME.gameName} tournament
                            platform at pixel-thread.in (the &quot;Platform&quot;).
                        </p>
                        <p className="mt-3">
                            By using our Platform, you agree to the collection and use of information in
                            accordance with this policy. If you do not agree with the terms of this privacy
                            policy, please do not access the Platform.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">2. Information We Collect</h2>
                        <h3 className="mt-4 text-lg font-semibold text-foreground/90">2.1 Personal Information</h3>
                        <p className="mt-2">When you create an account, we may collect:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Your name and email address (via authentication provider)</li>
                            <li>Your {GAME.gameName} in-game name (IGN) and character ID</li>
                            <li>Your profile picture (from your authentication provider)</li>
                            <li>Your WhatsApp phone number (optional, for squad captain communications)</li>
                            <li>Your state/region for community assignment</li>
                        </ul>

                        <h3 className="mt-4 text-lg font-semibold text-foreground/90">2.2 Game & Tournament Data</h3>
                        <p className="mt-2">During your use of the Platform, we automatically collect:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Tournament participation records and match results</li>
                            <li>In-game statistics (kills, placement, assists, damage)</li>
                            <li>Team assignments and squad membership</li>
                            <li>{GAME.currency} wallet balance and transaction history</li>
                            <li>Voting and poll participation records</li>
                            <li>Merit and reputation scores</li>
                        </ul>

                        <h3 className="mt-4 text-lg font-semibold text-foreground/90">2.3 Technical Data</h3>
                        <p className="mt-2">We automatically collect certain technical information:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Device type and browser information</li>
                            <li>IP address and approximate location</li>
                            <li>Pages visited and features used</li>
                            <li>Session duration and interaction patterns</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">3. How We Use Your Information</h2>
                        <p className="mt-3">We use the collected information to:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Create and manage your account on the Platform</li>
                            <li>Organize tournaments and generate balanced teams</li>
                            <li>Track match results, statistics, and leaderboard rankings</li>
                            <li>Process {GAME.currency} prize distributions and wallet transactions</li>
                            <li>Send tournament notifications and match details to squad captains</li>
                            <li>Maintain the merit and reputation system</li>
                            <li>Improve the Platform&apos;s features and user experience</li>
                            <li>Prevent fraud, cheating, and abuse</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">4. Information Sharing</h2>
                        <p className="mt-3">
                            We do not sell your personal information. We may share your information in the following circumstances:
                        </p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li><strong>Public Profiles:</strong> Your in-game name, statistics, and leaderboard ranking are publicly visible to other players.</li>
                            <li><strong>Team Members:</strong> When you&apos;re assigned to a team, your IGN and basic stats are shared with teammates.</li>
                            <li><strong>Tournament Administration:</strong> Platform administrators can view your account details for tournament management and dispute resolution.</li>
                            <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights and safety.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">5. Data Security</h2>
                        <p className="mt-3">
                            We implement appropriate technical and organizational measures to protect your
                            personal information. This includes encrypted data transmission (HTTPS), secure
                            authentication via trusted providers, and access controls for administrative functions.
                            However, no method of transmission over the Internet is 100% secure, and we cannot
                            guarantee absolute security.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">6. Cookies & Tracking</h2>
                        <p className="mt-3">
                            We use cookies and similar technologies to maintain your session, remember your
                            preferences, and analyze Platform usage. Third-party services we use (such as
                            authentication providers and analytics) may also set cookies. You can control
                            cookie preferences through your browser settings.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">7. Third-Party Services</h2>
                        <p className="mt-3">Our Platform uses the following third-party services:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li><strong>Authentication Providers:</strong> For secure sign-in (Google, email)</li>
                            <li><strong>Hosting:</strong> Vercel for application hosting</li>
                            <li><strong>Database:</strong> Secure cloud databases for data storage</li>
                            <li><strong>WhatsApp Cloud API:</strong> For optional tournament notifications to squad captains</li>
                            <li><strong>Google AdSense:</strong> For displaying relevant advertisements</li>
                        </ul>
                        <p className="mt-3">
                            Each third-party service has its own privacy policy governing how they handle your data.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">8. Your Rights</h2>
                        <p className="mt-3">You have the right to:</p>
                        <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Access the personal information we hold about you</li>
                            <li>Request correction of inaccurate information</li>
                            <li>Request deletion of your account and associated data</li>
                            <li>Opt out of optional communications (WhatsApp notifications)</li>
                            <li>Export your tournament statistics and match history</li>
                        </ul>
                        <p className="mt-3">
                            To exercise any of these rights, please contact us through the{" "}
                            <Link href="/help" className="text-blue-400 underline hover:text-blue-300">Help & Support</Link> page
                            or via the <Link href="/contact" className="text-blue-400 underline hover:text-blue-300">Contact</Link> page.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">9. Children&apos;s Privacy</h2>
                        <p className="mt-3">
                            Our Platform is not intended for children under the age of 13. We do not knowingly
                            collect personal information from children under 13. If we discover that a child
                            under 13 has provided us with personal information, we will delete such information
                            from our systems.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">10. Changes to This Policy</h2>
                        <p className="mt-3">
                            We may update this Privacy Policy from time to time. We will notify you of any
                            changes by posting the new Privacy Policy on this page and updating the &quot;Last
                            updated&quot; date. You are advised to review this Privacy Policy periodically for
                            any changes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-foreground">11. Contact Us</h2>
                        <p className="mt-3">
                            If you have questions about this Privacy Policy or our data practices, please
                            contact us through the{" "}
                            <Link href="/help" className="text-blue-400 underline hover:text-blue-300">Help & Support</Link> page
                            or reach out to our state representatives.
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
