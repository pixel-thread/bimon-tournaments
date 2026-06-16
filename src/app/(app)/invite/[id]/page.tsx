import type { Metadata } from "next";
import { prisma } from "@/lib/database";
import { GAME } from "@/lib/game-config";
import InviteClient from "./invite-client";

/* ─── Dynamic OG metadata for invite links ─────────────────── */

interface InvitePageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: InvitePageProps): Promise<Metadata> {
    const { id: squadId } = await params;

    try {
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            select: {
                name: true,
                captain: {
                    select: {
                        displayName: true,
                        user: { select: { username: true } },
                    },
                },
                poll: {
                    select: {
                        tournament: { select: { name: true } },
                    },
                },
            },
        });

        if (!squad) {
            return {
                title: "Invite Not Found",
                description: "This invite link may be expired or invalid.",
            };
        }

        const captainName = squad.captain.displayName ?? squad.captain.user.username;
        const tournamentName = squad.poll.tournament?.name ?? "Tournament";
        const teamName = squad.name;

        const title = `${captainName} invited you to join ${teamName}`;
        const description = `Join team "${teamName}" for ${tournamentName} on ${GAME.name}. Tap to accept the invite and compete!`;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                type: "website",
                siteName: GAME.name,
            },
            twitter: {
                card: "summary",
                title,
                description,
            },
        };
    } catch {
        return {
            title: `Team Invite — ${GAME.name}`,
            description: `You've been invited to join a team on ${GAME.name}. Tap to accept!`,
        };
    }
}

/* ─── Page (server component shell) ────────────────────────── */

export default function InvitePage() {
    return <InviteClient />;
}
