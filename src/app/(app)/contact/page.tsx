import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import { GAME } from "@/lib/game-config";

export const metadata: Metadata = {
    title: "Contact Us",
    description: `Get in touch with the Bimon Tournament team. Contact us for support, feedback, partnerships, or any questions about our ${GAME.gameName} esports platform.`,
};

export default function ContactPage() {
    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/60">
                        <Mail className="h-3.5 w-3.5 text-blue-400" />
                        Get in Touch
                    </div>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                        Contact Us
                    </h1>
                    <p className="mt-3 text-lg text-foreground/50">
                        Have questions, feedback, or need support? We&apos;re here to help.
                    </p>
                </div>

                {/* Contact Methods */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                                <MessageCircle className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">WhatsApp Support</h2>
                                <p className="mt-1 text-sm text-foreground/60">
                                    The fastest way to get help. Each state has a dedicated representative
                                    you can contact directly via WhatsApp for tournament queries, account
                                    issues, or general questions.
                                </p>
                                <Link
                                    href="/help"
                                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                    View State Representatives →
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">Email</h2>
                                <p className="mt-1 text-sm text-foreground/60">
                                    For formal inquiries, partnership proposals, or matters that require
                                    detailed communication, reach out via email. We typically respond
                                    within 24–48 hours.
                                </p>
                                <p className="mt-3 text-sm font-semibold text-blue-400">
                                    contact@pixel-thread.in
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">Our Community</h2>
                                <p className="mt-1 text-sm text-foreground/60">
                                    Bimon serves {GAME.gameName} players across Northeast India, with active
                                    communities in Meghalaya, Nagaland, and Manipur. Join our social channels
                                    to stay updated with tournament schedules, results, and community events.
                                </p>
                                <Link
                                    href="/socials"
                                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                    Follow Us on Social Media →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="mt-12 space-y-4 text-sm text-foreground/50">
                    <h2 className="text-lg font-bold text-foreground">Common Topics</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-foreground/10 p-4">
                            <h3 className="font-semibold text-foreground/80">Account Issues</h3>
                            <p className="mt-1 text-xs">
                                Problems with login, profile setup, or linking your {GAME.gameName} ID?
                                Contact your state representative for quick resolution.
                            </p>
                        </div>
                        <div className="rounded-lg border border-foreground/10 p-4">
                            <h3 className="font-semibold text-foreground/80">Tournament Disputes</h3>
                            <p className="mt-1 text-xs">
                                Questions about match results, scoring, or team assignments?
                                Use the in-app dispute system or contact an administrator.
                            </p>
                        </div>
                        <div className="rounded-lg border border-foreground/10 p-4">
                            <h3 className="font-semibold text-foreground/80">{GAME.currency} & Wallet</h3>
                            <p className="mt-1 text-xs">
                                Issues with prize payouts, wallet balance, or {GAME.currency} transactions?
                                These are handled by tournament administrators.
                            </p>
                        </div>
                        <div className="rounded-lg border border-foreground/10 p-4">
                            <h3 className="font-semibold text-foreground/80">Report a Player</h3>
                            <p className="mt-1 text-xs">
                                Encountered cheating, harassment, or rule violations?
                                Report directly to your state representative with evidence.
                            </p>
                        </div>
                    </div>
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
