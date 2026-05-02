"use client";

import { useState, useMemo, useEffect } from "react";
import { GAME } from "@/lib/game-config";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Chip,
    Spinner,
    Tabs,
    Tab,
} from "@heroui/react";
import { Trophy, Plus, Trash2, Coins, ChevronDown, Undo2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    getPrizeDistribution,
    getTierInfo,
    getTeamSize,
    getFinalDistribution,
} from "@/lib/logic/prizeDistribution";

// ─── Types ───────────────────────────────────────────────────
type TeamRanking = {
    teamId: string;
    name: string;
    total: number;
    kills: number;
    pts: number;
    players: { id: string; name: string }[];
};

type RankingsMeta = {
    entryFee: number;
    totalPlayers: number;
    teamCount?: number;
    prizePool: number;
    teamType: string;
    isWinnerDeclared: boolean;
    ucExemptCount: number;
    isSquadTournament?: boolean;
    captainMap?: Record<string, { id: string; name: string }>;
};

type TaxPreviewData = Record<string, {
    previousWins: number;
    totalWins: number;
    taxRate: number;
    taxPercentage: string;
    repeatWinnerTaxRate: number;
    soloTaxRate: number;
    isSolo: boolean;
    matchesPlayed: number;
    totalMatches: number;
    participationRate: number;
}>;

type DeclaredWinner = {
    id: string;
    position: number;
    amount: number;
    isDistributed: boolean;
    teamId: string;
    teamName: string;
    teamNumber: number;
    players: { id: string; displayName: string; username: string }[];
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    tournamentName: string;
    isWinnerDeclared: boolean;
    seasonId?: string;
    tournamentType?: string;
    maxPlacements?: number;
};

const getMedal = (i: number) => ["🥇", "🥈", "🥉", "🏅", "🎖️"][i] ?? "🎖️";
const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const SOFTENING_FACTOR = 0.5;

export function DeclareWinnersModal({
    isOpen,
    onClose,
    tournamentId,
    tournamentName,
    isWinnerDeclared,
    seasonId,
    tournamentType,
    maxPlacements: maxPlacementsProp,
}: Props) {
    const queryClient = useQueryClient();
    const isBracket = ["BRACKET_1V1", "LEAGUE", "GROUP_KNOCKOUT"].includes(tournamentType ?? "");
    const [placementCount, setPlacementCount] = useState(2);
    const [poolOpen, setPoolOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("simple");
    const [diamondAmounts, setDiamondAmounts] = useState<Record<number, number>>({});

    // Fetch org/fund percentages from settings (always fresh when modal opens)
    const { data: publicSettings } = useQuery({
        queryKey: ["public-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) return { orgCutFixed: 0, orgCutPercent: 0, orgCutMode: "fixed" };
            const json = await res.json();
            return json.data ?? { orgCutFixed: 0, orgCutPercent: 0, orgCutMode: "fixed" };
        },
        staleTime: 0, // Always fetch fresh — admin may have just changed settings
    });
    const orgCutMode = publicSettings?.orgCutMode ?? "fixed";
    const orgCut = orgCutMode === "percent" ? (publicSettings?.orgCutPercent ?? 0) : (publicSettings?.orgCutFixed ?? 0);
    const enableFund = publicSettings?.enableFund ?? false;

    // Fetch rankings (BGMI) OR bracket results (PES)
    const { data: rankingsData, isLoading } = useQuery<{
        data: TeamRanking[];
        meta: RankingsMeta;
    }>({
        queryKey: ["tournament-rankings", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/rankings`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: isOpen && !!tournamentId && !isBracket,
        staleTime: 0,
    });

    type BracketPlayer = { id: string; name: string };
    type BracketPlacement = { position: number; amount: number; player: BracketPlayer };
    const { data: bracketData, isLoading: bracketLoading } = useQuery<{
        rounds: { round: number; matches: { id: string; status: string; winnerId: string | null; player1Id: string | null; player2Id: string | null; player1?: { id: string; displayName: string | null } | null; player2?: { id: string; displayName: string | null } | null }[] }[];
        totalPlayers: number;
        prizePool?: number;
        entryFee?: number;
        deadlines?: unknown;
    }>({
        queryKey: ["bracket", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/bracket`);
            if (!res.ok) return null;
            const json = await res.json();
            return json.data;
        },
        enabled: isOpen && !!tournamentId && isBracket,
        staleTime: 0,
    });

    // Derive bracket placements from bracket data
    const bracketPlacements = useMemo((): BracketPlacement[] => {
        if (!bracketData?.rounds || !isBracket) return [];
        const confirmed = bracketData.rounds
            .flatMap(r => r.matches.map(m => ({ ...m, _round: r.round })))
            .filter(m => m.status === "CONFIRMED" && m.winnerId);
        if (confirmed.length === 0) return [];
        const maxRound = Math.max(...confirmed.map(m => m._round));
        const result: BracketPlacement[] = [];
        const getPlayer = (m: typeof confirmed[0], id: string | null) =>
            id === m.player1Id ? m.player1 : m.player2;
        const getLoser = (m: typeof confirmed[0]) =>
            getPlayer(m, m.winnerId === m.player1Id ? m.player2Id : m.player1Id);

        const finals = confirmed.filter(m => m._round === maxRound);
        const semis = confirmed.filter(m => m._round === maxRound - 1);

        // Actual Final = position 0, 3rd Place Match = position 1
        const actualFinal = finals.filter(m => (m as any).position === 0);
        const thirdPlaceMatch = finals.filter(m => (m as any).position === 1);

        // 1st and 2nd from Final
        for (const m of (actualFinal.length > 0 ? actualFinal : finals.slice(0, 1))) {
            const w = getPlayer(m, m.winnerId);
            const l = getLoser(m);
            if (w) result.push({ position: 1, amount: 0, player: { id: w.id, name: w.displayName || "?" } });
            if (l) result.push({ position: 2, amount: 0, player: { id: l.id, name: l.displayName || "?" } });
        }

        // 3rd/4th from 3rd place match (if exists)
        let pos = 3;
        for (const m of thirdPlaceMatch) {
            const w = getPlayer(m, m.winnerId);
            const l = getLoser(m);
            if (w) result.push({ position: pos++, amount: 0, player: { id: w.id, name: w.displayName || "?" } });
            if (l) result.push({ position: pos++, amount: 0, player: { id: l.id, name: l.displayName || "?" } });
        }

        // If no 3rd place match, derive from semi-final losers
        if (thirdPlaceMatch.length === 0) {
            for (const m of semis) {
                const l = getLoser(m);
                if (l) result.push({ position: pos++, amount: 0, player: { id: l.id, name: l.displayName || "?" } });
            }
        }

        return result;
    }, [bracketData, isBracket]);

    // Bracket prize pool (from bracket route)
    const bracketPrizePool = bracketData?.prizePool ?? 0;
    const bracketOrgCut = orgCutMode === "percent"
        ? Math.floor(bracketPrizePool * (orgCut / 100))
        : Math.min(orgCut, bracketPrizePool);
    const bracketDistributable = bracketPrizePool - bracketOrgCut;

    // Auto-split: hidden from admin, amounts shown in ₹
    const SPLIT_2 = [65, 35];
    const SPLIT_3 = [60, 30, 10];
    const bracketSplit = placementCount >= 3 ? SPLIT_3 : SPLIT_2;
    const bracketAmounts = bracketSplit.map(pct => Math.floor(bracketDistributable * pct / 100));

    // Max placements = 3 (1st, 2nd, 3rd) for all bracket types
    // Max placements — from tournament setting (default 3)
    const maxBracketPlacements = maxPlacementsProp ?? 3;

    const rankings = rankingsData?.data ?? [];
    const meta = rankingsData?.meta;
    const entryFee = meta?.entryFee ?? 0;
    const totalPlayers = meta?.totalPlayers ?? 0;
    const teamCount = meta?.teamCount ?? 0;
    const isSquadTournament = meta?.isSquadTournament ?? false;
    const captainMap = meta?.captainMap ?? {};
    const teamSize = isSquadTournament ? 1 : getTeamSize(meta?.teamType ?? "DUO");
    const ucExemptCount = meta?.ucExemptCount ?? 0;

    // Fetch solo tax pool (only in detailed)
    const { data: bonusPoolData } = useQuery<{ amount: number; donorName: string | null }>({
        queryKey: ["solo-tax-pool", seasonId],
        queryFn: async () => {
            if (!seasonId) return { amount: 0, donorName: null };
            const res = await fetch(`/api/solo-tax-pool?seasonId=${seasonId}`);
            if (!res.ok) return { amount: 0, donorName: null };
            const json = await res.json();
            return json.data || { amount: 0, donorName: null };
        },
        enabled: isOpen && !!seasonId && activeTab === "detailed",
    });

    const bonusPool = activeTab === "detailed" ? (bonusPoolData?.amount || 0) : 0;
    const basePrizePool = meta?.prizePool ?? 0;
    const prizePool = basePrizePool + bonusPool;

    // Auto-set placement count from tier
    useEffect(() => {
        if (isOpen) {
            if (isBracket) {
                // Default to 2 placements, auto-include 3rd if configured
                setPlacementCount(maxPlacementsProp && maxPlacementsProp >= 3 ? 3 : 2);
                setDiamondAmounts({});
            } else if (basePrizePool > 0) {
                const tier = getTierInfo(basePrizePool);
                setPlacementCount(Math.min(tier.winnerCount, rankings.length || tier.winnerCount));
            }
        }
    }, [isOpen, isBracket, basePrizePool, rankings.length, maxPlacementsProp]);

    // Get player IDs for tax preview
    const topTeamPlayerIds = useMemo(() => {
        const ids: string[] = [];
        rankings.slice(0, placementCount).forEach(team => {
            team.players?.forEach(p => ids.push(p.id));
        });
        return ids;
    }, [rankings, placementCount]);

    // Prize distribution (must be before placementsParam which uses baseDist)
    // distribution uses basePrizePool for Org/Fund (matching declare-winners which excludes bonus pool)
    const distribution = useMemo(
        () => basePrizePool > 0 ? getFinalDistribution(basePrizePool, entryFee, teamSize, ucExemptCount, orgCut, orgCutMode) : null,
        [basePrizePool, entryFee, teamSize, ucExemptCount, orgCut, orgCutMode]
    );

    // baseDist calculates prize placements — must use pool AFTER UC exempt deduction
    // UC exempt players didn't pay, so their entry fee reduces what's available for prizes
    const ucExemptCost = ucExemptCount * entryFee;
    const effectivePool = prizePool - ucExemptCost;
    const baseDist = useMemo(
        () => effectivePool > 0 ? getPrizeDistribution(effectivePool, entryFee, teamSize, orgCut, orgCutMode) : null,
        [effectivePool, entryFee, teamSize, orgCut, orgCutMode]
    );

    // Build placements param: "pos:amount:p1|p2,pos:amount:p1|p2"
    const placementsParam = useMemo(() => {
        if (!baseDist) return "";
        return rankings.slice(0, placementCount).map((team, idx) => {
            const pos = idx + 1;
            const amount = baseDist.prizes.get(pos)?.amount ?? 0;
            const pids = (team.players || []).map(p => p.id).join("|");
            return `${pos}:${amount}:${pids}`;
        }).join(",");
    }, [rankings, placementCount, baseDist]);

    // Fetch tax preview (only in detailed tab, and only if not already declared)
    const { data: taxPreviewRes, isLoading: taxLoading } = useQuery<{
        data: TaxPreviewData;
        taxTotals?: { totalTax: number; orgContribution: number; fundContribution: number };
        soloTaxTotal?: number;
        finalOrg?: number;
        finalFund?: number;
        storedPlayerAmounts?: Record<string, number>;
    }>({
        queryKey: ["tax-preview", tournamentId, topTeamPlayerIds.join(","), placementsParam],
        queryFn: async () => {
            let url = `/api/tournaments/${tournamentId}/tax-preview?playerIds=${topTeamPlayerIds.join(",")}`;
            if (placementsParam) url += `&placements=${encodeURIComponent(placementsParam)}`;
            const res = await fetch(url);
            if (!res.ok) return { data: {} };
            return res.json();
        },
        enabled: isOpen && activeTab === "detailed" && topTeamPlayerIds.length > 0,
        staleTime: 0, // Always refetch — settings may have changed
    });

    // Fetch stored results when already declared (no recalculation)
    const { data: storedResults } = useQuery<{ playerId: string; amount: number; position: number }[]>({
        queryKey: ["stored-winner-rewards", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/stored-results`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: isOpen && isWinnerDeclared,
        staleTime: 0,
    });

    // Fetch declared winners (same source as /winners page)
    const { data: declaredWinners } = useQuery<DeclaredWinner[]>({
        queryKey: ["declared-winners-detail", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/winners?tournamentId=${tournamentId}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: isOpen && isWinnerDeclared,
    });

    // Map of playerId -> stored amount (for display when already declared)
    const storedAmounts = useMemo(() => {
        const map = new Map<string, number>();
        if (storedResults) {
            for (const r of storedResults) map.set(r.playerId, r.amount);
        }
        return map;
    }, [storedResults]);

    // Dry-run declare-winners to get exact Org/Fund that would be stored
    const { data: dryRunRes } = useQuery<{
        data?: {
            finalOrg: number;
            finalFund: number;
            breakdown?: {
                orgBase: number;
                fundBase: number;
                ucExemptCost: number;
                orgAfterExempt: number;
                orgTaxContribution: number;
                fundTaxContribution: number;
                totalRepeatTax: number;
                roundingRemainder: number;
            };
            winners?: {
                position: number;
                teamAmount: number;
                players: { playerId: string; finalAmount: number; repeatTax: number; soloTax: number }[];
            }[];
        };
    }>({
        queryKey: ["declare-dryrun", tournamentId, placementsParam],
        queryFn: async () => {
            if (!baseDist) return {};
            const placements = Array.from({ length: placementCount }, (_, i) => ({
                position: i + 1, amount: baseDist.prizes.get(i + 1)?.amount ?? 0,
            }));
            const res = await fetch(`/api/tournaments/${tournamentId}/declare-winners`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ placements, dryRun: true }),
            });
            if (!res.ok) return {};
            return res.json();
        },
        enabled: isOpen && activeTab === "detailed" && !!baseDist && placementCount > 0 && !isWinnerDeclared,
        staleTime: 0, // Always refetch — settings may have changed
    });

    const taxPreview = taxPreviewRes?.data || {};
    const storedPlayerAmounts: Record<string, number> = taxPreviewRes?.storedPlayerAmounts || {};

    // Helper: per-player base amount
    const getPerPlayerAmount = (position: number, playerCount: number) => {
        if (playerCount === 0) return 0;
        return Math.floor((baseDist?.prizes.get(position)?.amount ?? 0) / playerCount);
    };

    // Helper: participation-adjusted amounts
    const getParticipationAdjustedAmounts = (
        players: { id: string; name: string }[], basePerPlayer: number
    ) => {
        const result = new Map<string, {
            base: number; adjusted: number; bonus: number; penalty: number;
            matchesPlayed: number; totalMatches: number; rate: number;
        }>();
        if (players.length === 0 || basePerPlayer === 0) return result;

        const rates = players.map(p => {
            const tax = taxPreview[p.id];
            return { id: p.id, rate: tax?.participationRate ?? 1, matchesPlayed: tax?.matchesPlayed ?? 0, totalMatches: tax?.totalMatches ?? 1 };
        });
        const first = rates[0];
        if (!first || first.totalMatches === 0) {
            for (const p of players) result.set(p.id, { base: basePerPlayer, adjusted: basePerPlayer, bonus: 0, penalty: 0, matchesPlayed: 0, totalMatches: 0, rate: 1 });
            return result;
        }
        const avgRate = rates.reduce((s, r) => s + r.rate, 0) / players.length;
        for (const r of rates) {
            const adj = Math.floor((r.rate - avgRate) * basePerPlayer * SOFTENING_FACTOR);
            result.set(r.id, { base: basePerPlayer, adjusted: basePerPlayer + adj, bonus: adj > 0 ? adj : 0, penalty: adj < 0 ? -adj : 0, matchesPlayed: r.matchesPlayed, totalMatches: r.totalMatches, rate: r.rate });
        }
        return result;
    };

    // Helper: tax-adjusted amount (uses stored amount when available)
    const getTaxedAmount = (playerId: string, baseAmount: number) => {
        // If tournament is declared and we have stored amounts, use those directly
        if (isWinnerDeclared && storedPlayerAmounts[playerId] !== undefined) {
            return storedPlayerAmounts[playerId];
        }
        const tax = taxPreview[playerId];
        if (!tax || tax.taxRate === 0) return baseAmount;
        return Math.floor(baseAmount * (1 - tax.taxRate));
    };

    // Tax totals from backend (exact same logic as declare-winners)
    const taxTotals = useMemo(() => {
        const bt = taxPreviewRes?.taxTotals;
        const soloTotal = taxPreviewRes?.soloTaxTotal ?? 0;
        if (!bt || activeTab !== "detailed") return { total: 0, repeatTax: 0, soloTax: 0, soloToLosers: 0, soloToPool: 0 };
        return {
            total: bt.totalTax + soloTotal,
            repeatTax: bt.totalTax,
            soloTax: soloTotal,
            soloToLosers: Math.floor(soloTotal * 0.60),
            soloToPool: Math.ceil(soloTotal * 0.40),
        };
    }, [taxPreviewRes, activeTab]);

    const organizerAmount = distribution?.finalOrgAmount ?? 0;
    // Declare: runs all 3 steps (declare → streaks → process rewards)
    const [declareStatus, setDeclareStatus] = useState<{
        step: string;
        error?: string;
        done?: boolean;
    } | null>(null);

    const declare = useMutation({
        mutationFn: async () => {
            // Step 1: Declare winners
            setDeclareStatus({ step: "Declaring winners..." });

            let placements;
            if (isBracket) {
                // Bracket: send auto-computed amounts based on prize split
                // For dual-currency games (MLBB), include custom Diamond amounts
                placements = bracketPlacements.slice(0, placementCount).map((bp, idx) => ({
                    position: bp.position,
                    amount: bracketAmounts[idx] ?? 0,
                    ...(GAME.hasDualCurrency ? { diamondAmount: diamondAmounts[idx] ?? 0 } : {}),
                }));
            } else if (isSquadTournament) {
                // Squad: full team amount goes to captain
                placements = rankings.slice(0, placementCount).map((team, i) => {
                    const pos = i + 1;
                    const teamAmount = baseDist?.prizes.get(pos)?.amount ?? 0;
                    const captain = captainMap[team.teamId];
                    const captainId = captain?.id || team.players?.[0]?.id || "";
                    return { position: pos, amount: teamAmount, teamId: team.teamId, players: [{ playerId: captainId, amount: teamAmount }] };
                });
            } else {
                // BGMI: build placements with exact per-player amounts from preview
                placements = rankings.slice(0, placementCount).map((team, i) => {
                    const pos = i + 1;
                    const teamAmount = baseDist?.prizes.get(pos)?.amount ?? 0;
                    const playerCount = team.players?.length || 0;
                    const perPlayer = getPerPlayerAmount(pos, playerCount);
                    const pa = getParticipationAdjustedAmounts(team.players || [], perPlayer);
                    const players = (team.players || []).map(p => {
                        const adjusted = pa.get(p.id)?.adjusted ?? perPlayer;
                        const final = getTaxedAmount(p.id, adjusted);
                        return { playerId: p.id, amount: final };
                    });
                    return { position: pos, amount: teamAmount, teamId: team.teamId, players };
                });
            }

            const res1 = await fetch(`/api/tournaments/${tournamentId}/declare-winners`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ placements }),
            });
            if (!res1.ok) {
                let msg = "Declare failed";
                try { const d = await res1.json(); msg = d.error || msg; } catch {}
                throw new Error(msg);
            }

            // Step 2: Update streaks
            setDeclareStatus({ step: "Updating streaks..." });
            const res2 = await fetch(`/api/tournaments/${tournamentId}/update-streaks`, { method: "POST" });
            if (!res2.ok) {
                let msg = "Unknown error";
                try { const d = await res2.json(); msg = d.error || msg; } catch {}
                setDeclareStatus({ step: "Streaks failed", error: msg });
                // Don't throw — declaration succeeded, just log the error
            }

            // Step 3: Process rewards (merit + referrals)
            setDeclareStatus({ step: "Processing rewards..." });
            const res3 = await fetch(`/api/tournaments/${tournamentId}/post-declare`, { method: "POST" });
            if (!res3.ok) {
                let msg = "Unknown error";
                try { const d = await res3.json(); msg = d.error || msg; } catch {}
                setDeclareStatus({ step: "Rewards failed", error: msg });
            }
        },
        onSuccess: async () => {
            setDeclareStatus({ step: "Done!", done: true });
            toast.success("Winners declared, streaks updated & rewards processed!");
            queryClient.removeQueries({ queryKey: ["admin-tournaments"] });
            queryClient.removeQueries({ queryKey: ["tournament-rankings", tournamentId] });
            await queryClient.invalidateQueries({ queryKey: ["admin-tournaments"] });
            await queryClient.invalidateQueries({ queryKey: ["tournament-rankings"] });
            queryClient.invalidateQueries({ queryKey: ["solo-tax-pool"] });
            queryClient.invalidateQueries({ queryKey: ["stored-winner-rewards"] });
            setTimeout(() => { setDeclareStatus(null); onClose(); }, 1000);
        },
        onError: (err: Error) => {
            setDeclareStatus({ step: "Failed", error: err.message });
        },
    });

    // Undo mutation
    const undo = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/undo-winner`, { method: "POST" });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
        },
        onSuccess: async () => {
            toast.success("Winner declaration undone!");
            queryClient.removeQueries({ queryKey: ["admin-tournaments"] });
            queryClient.removeQueries({ queryKey: ["tournament-rankings", tournamentId] });
            await queryClient.invalidateQueries({ queryKey: ["admin-tournaments"] });
            await queryClient.invalidateQueries({ queryKey: ["tournament-rankings"] });
            queryClient.invalidateQueries({ queryKey: ["solo-tax-pool"] });
            queryClient.invalidateQueries({ queryKey: ["stored-winner-rewards"] });
            onClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // ─── Render helpers ──────────────────────────────────────
    const renderTeamCard = (team: TeamRanking, idx: number, detailed: boolean) => {
        const playerCount = team.players?.length || 0;
        const teamPrize = baseDist?.prizes.get(idx + 1)?.amount ?? 0;
        const perPlayer = isSquadTournament ? teamPrize : getPerPlayerAmount(idx + 1, playerCount);
        const captain = captainMap[team.teamId];

        return (
            <div
                key={team.teamId}
                className={`rounded-lg border p-3 ${idx === 0 ? "border-warning/40 bg-warning/[0.04]" :
                    idx === 1 ? "border-foreground/15 bg-foreground/[0.02]" :
                        idx === 2 ? "border-orange-500/30 bg-orange-500/[0.03]" :
                            "border-divider"
                    }`}
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{getMedal(idx)}</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {isSquadTournament && team.name
                                ? team.name
                                : team.players?.map(p => p.name).join(", ") || team.name || "No players"}
                        </p>
                        <p className="text-xs text-foreground/40">
                            {team.total} pts • {team.kills} kills
                        </p>
                    </div>
                    {teamPrize > 0 && (
                        <div className="text-right shrink-0">
                            <Chip size="sm" color="success" variant="flat" className="font-semibold">
                                ₹{teamPrize.toLocaleString()}
                            </Chip>
                            {isSquadTournament && captain ? (
                                <p className="text-[10px] text-foreground/30 mt-0.5">→ {captain.name}</p>
                            ) : playerCount > 1 ? (
                                <p className="text-[10px] text-foreground/30 mt-0.5">₹{perPlayer}/player</p>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* Per-player details: always show stored amounts after declaration, detailed preview only before */}
                {((isWinnerDeclared && storedAmounts.size > 0) || (detailed && !isWinnerDeclared)) && teamPrize > 0 && playerCount > 0 && (
                    <div className="mt-2 pt-2 border-t border-dashed border-divider space-y-1.5">
                        {taxLoading && !isWinnerDeclared ? (
                            <div className="flex justify-center py-1"><Spinner size="sm" /></div>
                        ) : isSquadTournament ? (
                            /* Squad mode: show players for tracking only (wins, attendance) — no per-player amounts */
                            team.players?.map(p => {
                                const tax = taxPreview[p.id];
                                const isCaptain = captain?.id === p.id;
                                return (
                                    <div key={p.id} className="text-xs">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`font-medium ${isCaptain ? "text-warning" : ""}`}>
                                                    {p.name}{isCaptain ? " 👑" : ""}
                                                </span>
                                                {tax && tax.totalMatches > 0 && (
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                        tax.participationRate >= 1 ? "bg-success/10 text-success" :
                                                        tax.participationRate >= 0.5 ? "bg-warning/10 text-warning" :
                                                        "bg-danger/10 text-danger"
                                                    }`}>
                                                        {tax.matchesPlayed}/{tax.totalMatches} matches
                                                    </span>
                                                )}
                                                {tax?.repeatWinnerTaxRate && tax.repeatWinnerTaxRate > 0 && (
                                                    <span className="text-warning text-[10px]">🔄 {tax.totalWins} wins</span>
                                                )}
                                            </div>
                                            {isCaptain && (
                                                <span className="text-[10px] text-success font-medium">₹{teamPrize}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            /* Regular mode: show per-player amounts with participation adjustments */
                            team.players?.map(p => {
                                // If already declared, use stored amounts from DB
                                if (isWinnerDeclared && storedAmounts.size > 0) {
                                    const stored = storedAmounts.get(p.id);
                                    if (stored !== undefined) {
                                        return (
                                            <div key={p.id} className="text-xs space-y-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium">{p.name}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-foreground/50">
                                                    <span>₹{perPlayer} →</span>
                                                    <span className="font-semibold text-foreground">₹{stored}</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                }

                                // Preview mode: use server dry-run amounts when available
                                const tax = taxPreview[p.id];
                                const pa = getParticipationAdjustedAmounts(team.players || [], perPlayer).get(p.id);
                                const afterParticipation = pa?.adjusted ?? perPlayer;

                                // Prefer exact server-computed amounts
                                const dryRunTeam = dryRunRes?.data?.winners?.find(w => w.position === idx + 1);
                                const dryRunPlayer = dryRunTeam?.players.find(dp => dp.playerId === p.id);

                                let finalAmount: number;
                                let taxDeduction: number;

                                if (!enableFund) {
                                    // Fund OFF — no taxes at all
                                    finalAmount = afterParticipation;
                                    taxDeduction = 0;
                                } else if (dryRunPlayer) {
                                    // Exact server amounts
                                    finalAmount = dryRunPlayer.finalAmount;
                                    taxDeduction = dryRunPlayer.repeatTax + dryRunPlayer.soloTax;
                                } else {
                                    // Fallback: local approximation
                                    finalAmount = getTaxedAmount(p.id, afterParticipation);
                                    taxDeduction = afterParticipation - finalAmount;
                                }

                                return (
                                    <div key={p.id} className="text-xs space-y-0.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-medium">{p.name}</span>
                                            {pa && pa.totalMatches > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pa.rate >= 1 ? "bg-success/10 text-success" :
                                                    pa.rate >= 0.5 ? "bg-warning/10 text-warning" :
                                                        "bg-danger/10 text-danger"
                                                    }`}>
                                                    {pa.matchesPlayed}/{pa.totalMatches} matches
                                                </span>
                                            )}
                                            {tax?.isSolo && (
                                                <span className="bg-secondary/10 text-secondary px-1.5 py-0.5 rounded text-[10px] font-medium">SOLO</span>
                                            )}
                                            {tax?.repeatWinnerTaxRate && tax.repeatWinnerTaxRate > 0 && (
                                                <span className="text-warning text-[10px]">🔄 {tax.totalWins} wins</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-foreground/50">
                                            <div className="flex items-center gap-1">
                                                <span>₹{perPlayer}</span>
                                                {pa && pa.bonus > 0 && <span className="text-success">+{pa.bonus}</span>}
                                                {pa && pa.penalty > 0 && <span className="text-warning">-{pa.penalty}</span>}
                                                {taxDeduction > 0 && <span className="text-danger">-{taxDeduction} tax</span>}
                                                <span className="mx-0.5">→</span>
                                            </div>
                                            <span className={`font-semibold ${pa && pa.bonus > 0 ? "text-success" :
                                                pa && pa.penalty > 0 ? "text-warning" :
                                                    "text-foreground"
                                                }`}>
                                                ₹{finalAmount}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} placement="center" size="lg" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-warning" />
                    <div>
                        <p>{isWinnerDeclared ? "Tournament Results" : `Declare Winners & Distribute ${GAME.currency}`}</p>
                        <p className="text-xs font-normal text-foreground/50">{tournamentName}</p>
                    </div>
                </ModalHeader>

                <ModalBody className="gap-3">
                    {isLoading || bracketLoading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : isBracket ? (
                        // ── Bracket mode: show results from bracket ──
                        bracketPlacements.length === 0 ? (
                            <div className="text-center py-8 text-foreground/40 text-sm">
                                No confirmed matches yet. Bracket needs a final match confirmed.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Prize pool breakdown — bracket only */}
                                {bracketPrizePool > 0 && (
                                    <div className="rounded-xl border border-success/25 bg-success/5 p-3 space-y-1.5 mb-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-foreground/50">Total Prize Pool</span>
                                            <span className="font-semibold">₹{bracketPrizePool.toLocaleString()}</span>
                                        </div>
                                        {bracketOrgCut > 0 && (
                                            <div className="flex justify-between text-xs text-foreground/40">
                                                <span>💼 Org Cut</span>
                                                <span>- ₹{bracketOrgCut.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-xs border-t border-divider pt-1.5 font-semibold text-success">
                                            <span>Distributable</span>
                                            <span>₹{bracketDistributable.toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2">
                                    {isWinnerDeclared ? "Declared Winners" : `Bracket Results (Top ${placementCount})`}
                                </p>
                                {isWinnerDeclared && declaredWinners && declaredWinners.length > 0 ? (
                                    declaredWinners.map((winner, idx) => (
                                        <div key={winner.teamId} className={`rounded-lg border p-3 ${idx === 0 ? "border-warning/40 bg-warning/[0.04]" : idx === 1 ? "border-foreground/15 bg-foreground/[0.02]" : "border-divider"}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl shrink-0">{getMedal(idx)}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">{winner.players.map(p => p.displayName || p.username).join(", ")}</p>
                                                </div>
                                                <Chip size="sm" color="success" variant="flat" className="font-semibold">₹{winner.amount.toLocaleString()}</Chip>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    bracketPlacements.slice(0, placementCount).map((bp, idx) => (
                                        <div key={bp.player.id} className={`rounded-lg border p-3 ${idx === 0 ? "border-warning/40 bg-warning/[0.04]" : idx === 1 ? "border-foreground/15 bg-foreground/[0.02]" : "border-divider"}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl shrink-0">{getMedal(idx)}</span>
                                                <p className="text-sm font-medium flex-1">{bp.player.name}</p>
                                                {bracketDistributable > 0 && (
                                                    <Chip size="sm" color="success" variant="flat" className="font-semibold">
                                                        ₹{(bracketAmounts[idx] ?? 0).toLocaleString()}
                                                    </Chip>
                                                )}
                                            </div>
                                            {/* Diamond amount input for MLBB */}
                                            {GAME.hasDualCurrency && !isWinnerDeclared && (
                                                <div className="mt-2 pt-2 border-t border-dashed border-divider">
                                                    <label className="text-[10px] font-medium text-foreground/40 uppercase tracking-wider">
                                                        {GAME.rewardCurrencyEmoji} {GAME.rewardCurrency} Reward
                                                    </label>
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        min={0}
                                                        value={diamondAmounts[idx] ?? ""}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value, 10);
                                                            setDiamondAmounts(prev => ({
                                                                ...prev,
                                                                [idx]: isNaN(val) ? 0 : val,
                                                            }));
                                                        }}
                                                        placeholder={`${GAME.rewardCurrency} amount for ${getOrdinal(bp.position)} place`}
                                                        className="w-full mt-1 rounded-lg border border-divider bg-default-100 px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-primary focus:ring-1 focus:ring-primary/30"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                                {!isWinnerDeclared && (
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        {/* Allow up to confirmed bracket placements (min 3) */}
                                        {placementCount < maxBracketPlacements && (
                                            <Button size="sm" variant="flat" startContent={<Plus className="h-3.5 w-3.5" />}
                                                onPress={() => setPlacementCount(c => c + 1)} className="gap-1 text-xs h-8">
                                                Add {getOrdinal(placementCount + 1)} Place
                                            </Button>
                                        )}
                                        {placementCount > 1 && (
                                            <Button size="sm" variant="flat" color="danger" startContent={<Trash2 className="h-3.5 w-3.5" />}
                                                onPress={() => setPlacementCount(c => c - 1)} className="gap-1 text-xs h-8">
                                                Remove {getOrdinal(placementCount)} Place
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    ) : rankings.length === 0 ? (
                        <div className="text-center py-8 text-foreground/40 text-sm">
                            No team stats found for this tournament.
                        </div>
                    ) : (
                        <>
                            {/* Tabs: Simple / Detailed */}
                            <Tabs
                                selectedKey={activeTab}
                                onSelectionChange={(key) => setActiveTab(key as string)}
                                variant="bordered"
                                size="sm"
                                fullWidth
                                classNames={{ tabList: "w-full" }}
                            >
                                <Tab key="simple" title="Simple" />
                                <Tab key="detailed" title="Detailed Preview" />
                            </Tabs>

                            {/* ─ Prize Pool (Detailed only) ─ */}
                            {activeTab === "detailed" && prizePool > 0 && baseDist && distribution && (
                                <div className="rounded-lg border border-success/30 bg-gradient-to-br from-success/5 to-success/10">
                                    <button
                                        onClick={() => setPoolOpen(!poolOpen)}
                                        className="w-full p-3 flex items-center justify-between hover:bg-success/5 rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Coins className="h-4 w-4 text-success" />
                                            <span className="font-semibold text-success text-sm">Prize Pool</span>
                                            <Chip size="sm" color="success" variant="flat">₹{prizePool.toLocaleString()}</Chip>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 text-foreground/30 transition-transform duration-200 ${poolOpen ? "rotate-180" : ""}`} />
                                    </button>

                                    {poolOpen && (
                                        <div className="px-4 pb-3 space-y-2">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                <span className="text-foreground/40">Entry Fee:</span>
                                                <span className="font-medium">₹{entryFee}</span>
                                                <span className="text-foreground/40">{isSquadTournament ? "Teams:" : "Players:"}</span>
                                                <span className="font-medium">{isSquadTournament ? teamCount : totalPlayers}</span>
                                                {bonusPool > 0 && (
                                                    <>
                                                        <span className="text-foreground/40">Base Pool:</span>
                                                        <span className="font-medium">₹{basePrizePool.toLocaleString()}</span>
                                                        <span className="text-foreground/40">🎁 Bonus:</span>
                                                        <span className="font-medium text-secondary">+₹{bonusPool.toLocaleString()}</span>
                                                    </>
                                                )}
                                            </div>

                                            <div className="pt-2 border-t border-success/20 space-y-0.5 text-xs">

                                                <div className="flex justify-between text-foreground/50">
                                                    <span>💼 Org Cut:</span>
                                                    <span className="font-medium text-foreground">
                                                        ₹{(dryRunRes?.data?.finalOrg ?? taxPreviewRes?.finalOrg ?? organizerAmount).toLocaleString()}
                                                    </span>
                                                </div>

                                                {ucExemptCount > 0 && (
                                                    <div className="flex justify-between text-foreground/50">
                                                        <span>🎫 UC Exempt ({ucExemptCount}):</span>
                                                        <span className="font-medium text-foreground">
                                                            -₹{(ucExemptCount * entryFee).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}

                                                {enableFund && (
                                                    <div className="flex justify-between text-foreground/50">
                                                        <span>🏦 Fund:</span>
                                                        <span className="font-medium text-foreground">
                                                            ₹{(dryRunRes?.data?.finalFund ?? taxPreviewRes?.finalFund ?? distribution.finalFundAmount).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {taxTotals.total > 0 && (
                                                <div className="mt-2 pt-2 border-t border-dashed border-success/20 space-y-1 opacity-80 italic">
                                                    {taxTotals.repeatTax > 0 && (
                                                        <p className="text-[10px] text-warning">
                                                            Note: ₹{taxTotals.repeatTax} Repeat Winner Tax added to Org.
                                                        </p>
                                                    )}
                                                    {taxTotals.soloTax > 0 && (
                                                        <p className="text-[10px] text-secondary">
                                                            Note: ₹{taxTotals.soloTax} Solo Tax → Loser Support (₹{taxTotals.soloToLosers}) & Next Pool (₹{taxTotals.soloToPool}).
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─ Simple tab: just show prize pool chip ─ */}
                            {activeTab === "simple" && basePrizePool > 0 && baseDist && (
                                <div className="flex items-center gap-2 text-sm text-foreground/60">
                                    <Coins className="h-4 w-4 text-success" />
                                    <span>Prize Pool:</span>
                                    <Chip size="sm" color="success" variant="flat" className="font-semibold">
                                        ₹{basePrizePool.toLocaleString()}
                                    </Chip>
                                    <span className="text-xs text-foreground/30">
                                        ({baseDist.tier.winnerCount} winners)
                                    </span>
                                </div>
                            )}

                            {/* ─ Team Rankings / Declared Winners ─ */}
                            <div>
                                <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2">
                                    {isWinnerDeclared ? "Declared Winners" : `Rankings (Top ${placementCount})`}
                                </p>
                                <div className="space-y-2">
                                    {isWinnerDeclared && declaredWinners && declaredWinners.length > 0 ? (
                                        declaredWinners.map((winner, idx) => {
                                            const borderClass = idx === 0 ? "border-warning/40 bg-warning/[0.04]" :
                                                idx === 1 ? "border-foreground/15 bg-foreground/[0.02]" :
                                                    idx === 2 ? "border-orange-500/30 bg-orange-500/[0.03]" :
                                                        "border-divider";
                                            return (
                                                <div key={winner.teamId} className={`rounded-lg border p-3 ${borderClass}`}>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl shrink-0">{getMedal(idx)}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">
                                                                {isSquadTournament
                                                                    ? winner.teamName
                                                                    : winner.players.map(p => p.displayName || p.username).join(", ")}
                                                            </p>
                                                            <p className="text-xs text-foreground/40">{isSquadTournament ? winner.players.map(p => p.displayName || p.username).join(", ") : winner.teamName}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <Chip size="sm" color="success" variant="flat" className="font-semibold">
                                                                ₹{winner.amount.toLocaleString()}
                                                            </Chip>
                                                            {isSquadTournament ? (
                                                                captainMap[winner.teamId] && (
                                                                    <p className="text-[10px] text-foreground/30 mt-0.5">→ {captainMap[winner.teamId].name}</p>
                                                                )
                                                            ) : winner.players.length > 1 ? (
                                                                <p className="text-[10px] text-foreground/30 mt-0.5">
                                                                    ₹{Math.floor(winner.amount / winner.players.length)}/player
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    {/* Per-player stored amounts */}
                                                    {storedAmounts.size > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-dashed border-divider space-y-1.5">
                                                            {winner.players.map(p => {
                                                                const stored = storedAmounts.get(p.id);
                                                                return (
                                                                    <div key={p.id} className="text-xs flex items-center justify-between">
                                                                        <span className="font-medium">{p.displayName || p.username}</span>
                                                                        {stored !== undefined && (
                                                                            <span className="font-semibold">₹{stored}</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        rankings.slice(0, placementCount).map((team, idx) =>
                                            renderTeamCard(team, idx, activeTab === "detailed")
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Add/Remove placement controls */}
                            {!isWinnerDeclared && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {placementCount < rankings.length && placementCount < 10 && (
                                        <Button size="sm" variant="flat" startContent={<Plus className="h-3.5 w-3.5" />}
                                            onPress={() => setPlacementCount(c => c + 1)} className="gap-1 text-xs h-8">
                                            Add {getOrdinal(placementCount + 1)} Place
                                        </Button>
                                    )}
                                    {placementCount > 2 && (
                                        <Button size="sm" variant="flat" color="danger" startContent={<Trash2 className="h-3.5 w-3.5" />}
                                            onPress={() => setPlacementCount(c => c - 1)} className="gap-1 text-xs h-8">
                                            Remove {getOrdinal(placementCount)} Place
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </ModalBody>

                <ModalFooter className="flex-col items-stretch gap-2">
                    {declareStatus && (
                        <div className={`text-xs text-center px-3 py-1.5 rounded-lg ${declareStatus.error ? "bg-danger/10 text-danger" :
                            declareStatus.done ? "bg-success/10 text-success" :
                                "bg-warning/10 text-warning"
                            }`}>
                            {declareStatus.done ? "✅ " : declareStatus.error ? "❌ " : "⏳ "}
                            {declareStatus.step}
                            {declareStatus.error && <span className="block text-[10px] opacity-80 mt-0.5">{declareStatus.error}</span>}
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="flat" onPress={onClose}>Close</Button>
                        {isWinnerDeclared ? (
                            <Button color="danger" variant="flat" isLoading={undo.isPending}
                                startContent={<Undo2 className="h-4 w-4" />}
                                onPress={() => { if (confirm(`Undo winner declaration? This will reverse ${GAME.currency} transactions.`)) undo.mutate(); }}>
                                Undo Declaration
                            </Button>
                        ) : (
                            <Button className="bg-gradient-to-r from-warning to-[#f97316] text-white font-semibold"
                                isLoading={declare.isPending} isDisabled={isBracket ? bracketPlacements.length === 0 : rankings.length === 0}
                                startContent={<Trophy className="h-4 w-4" />}
                                onPress={() => declare.mutate()}>
                                {declare.isPending ? (declareStatus?.step || "Processing...") : prizePool > 0 ? "Declare & Distribute" : "Declare Winners"}
                            </Button>
                        )}
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
