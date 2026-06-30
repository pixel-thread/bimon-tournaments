import { prisma } from "@/lib/database";
import { GAME } from "@/lib/game-config";
import { getCategoryFromKDValue, type PlayerTier } from "./categoryUtils";
import { createTeamsByPoll } from "./createTeamsByPoll";
import { getBalancesBatch } from "@/lib/wallet-service";

// ─── Types ───────────────────────────────────────────────────

type Props = {
    groupSize: 1 | 2 | 3 | 4;
    tournamentId: string;
    seasonId: string;
    pollId: string;
    entryFee?: number;
};

export type TeamPreviewPlayer = {
    id: string;
    username: string;
    displayName?: string | null;
    balance: number;
    kills: number;
    kd: number;
    category: PlayerTier;
    weightedScore: number;
};

export type TeamPreview = {
    teamNumber: number;
    teamName: string;
    players: TeamPreviewPlayer[];
    totalKills: number;
    weightedScore: number;
};

export type PreviewTeamsByPollsResult = {
    teams: TeamPreview[];
    playersWithInsufficientBalance: { id: string; username: string; balance: number }[];
    soloPlayers: { id: string; username: string }[];
    entryFee: number;
    tournamentName: string;
    totalPlayersEligible: number;
    isMangoScrim?: boolean;
};

// ─── Service ─────────────────────────────────────────────────

/**
 * Preview teams by running createTeamsByPoll in dry-run mode.
 * This guarantees the preview matches exactly what will be created on confirm.
 */
export async function previewTeamsByPoll({
    groupSize,
    pollId,
    tournamentId,
    seasonId,
    entryFee = 0,
}: Props): Promise<PreviewTeamsByPollsResult> {
    // Run the actual team generation logic in dry-run mode
    const dryRunResult = await createTeamsByPoll({
        groupSize,
        pollId,
        tournamentId,
        seasonId,
        entryFee,
        dryRun: true,
    });

    if (!dryRunResult.dryRunData) {
        throw new Error("Dry run did not return team data");
    }

    const { teams: rawTeams, tournamentName } = dryRunResult.dryRunData;

    // Collect all player IDs to fetch balances
    const allPlayerIds = rawTeams.flatMap((t) => t.players.map((p) => p.id));

    // Fetch wallet balances from central wallet (batch)
    const playerEmails = await prisma.player.findMany({
        where: { id: { in: allPlayerIds } },
        select: { id: true, user: { select: { email: true } } },
    });

    const emailMap = new Map(playerEmails.map((pe) => [pe.id, pe.user?.email]));
    const emails = playerEmails.map((pe) => pe.user?.email).filter(Boolean) as string[];
    const balanceMap = emails.length > 0 ? await getBalancesBatch(emails) : new Map<string, number>();

    // Map email balances back to player IDs
    const playerBalanceMap = new Map<string, number>();
    for (const [playerId, email] of emailMap) {
        if (email) {
            playerBalanceMap.set(playerId, balanceMap.get(email) ?? 0);
        }
    }

    // Convert to preview format
    let randomTeamNum = 1;
    const teamPreviews: TeamPreview[] = rawTeams.map((t, index) => {
        const teamPlayers: TeamPreviewPlayer[] = t.players.map((p: any) => {
            const stats = (p.stats || p.playerStats || []).find((s: any) => s.seasonId === seasonId);
            const kills = stats?.kills ?? 0;
            const matches = stats?.matches ?? 0;
            const kd = matches > 0 ? kills / matches : 0;

            return {
                id: p.id,
                username: p.user?.username ?? "Unknown",
                displayName: p.displayName,
                balance: playerBalanceMap.get(p.id) ?? 0,
                kills,
                kd: Math.round(kd * 100) / 100,
                category: getCategoryFromKDValue(kd),
                weightedScore: (p as any).weightedScore ?? 0,
            };
        });

        const squadName = (t as any).squadName;
        return {
            teamNumber: index + 1,
            teamName: squadName || `${GAME.name} Team ${randomTeamNum++}`,
            players: teamPlayers,
            totalKills: t.totalKills,
            weightedScore: t.weightedScore,
        };
    });

    // Find players with insufficient balance
    // Squad members don't pay — only the captain pays the full team fee
    const { squadPlayerIds, squadCaptainIds } = dryRunResult.dryRunData;
    const playersWithInsufficientBalance = entryFee > 0
        ? teamPreviews
            .flatMap((t) => t.players)
            .filter((p) => {
                if (squadPlayerIds.has(p.id)) {
                    // Squad captain pays full entry fee; other squad members don't pay
                    if (squadCaptainIds.has(p.id)) {
                        return p.balance < entryFee;
                    }
                    return false; // Non-captain squad members don't pay
                }
                // Regular players pay their per-player share
                return p.balance < entryFee;
            })
            .map((p) => ({ id: p.id, username: p.displayName || p.username, balance: p.balance }))
        : [];

    // Extract solo player names for info display
    const soloPlayerNames = teamPreviews
        .filter((t) => t.players.length === 1)
        .map((t) => ({
            id: t.players[0].id,
            username: t.players[0].displayName || t.players[0].username,
        }));

    // Check if tournament is mango scrim
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { isMangoScrim: true },
    });

    return {
        teams: teamPreviews,
        playersWithInsufficientBalance,
        soloPlayers: soloPlayerNames,
        entryFee,
        tournamentName: tournamentName,
        totalPlayersEligible: allPlayerIds.length,
        isMangoScrim: tournament?.isMangoScrim ?? false,
    };
}
