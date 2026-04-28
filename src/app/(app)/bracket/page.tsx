"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BracketView, MyBracketMatch } from "@/components/bracket/bracket-view";
import { roundLabel, type RoundData } from "@/components/bracket/bracket-shared";
import { GroupKnockoutView } from "@/components/bracket/group-knockout-view";
import { SubmitResultModal } from "@/components/bracket/submit-result-modal";
import { ViewResultModal, prefetchScreenshot } from "@/components/bracket/view-result-modal";
import { PendingConfirmationModal } from "@/components/bracket/pending-confirmation-modal";
import { useConfirmResult, useDisputeResult } from "@/components/bracket/submit-result-modal";
import { BracketOnboarding, DisputeOnboarding, useBracketOnboarding, useDisputeOnboarding } from "@/components/bracket/bracket-onboarding";
import { useAuthUser } from "@/hooks/use-auth-user";
import { Trophy, Swords, Clock, Info } from "lucide-react";
import { Chip, Tabs, Tab, Skeleton } from "@heroui/react";
import { snapToCutoff, addPausedDays, getISTDayOfWeek } from "@/lib/logic/deadline-utils";
import { GAME } from "@/lib/game-config";

// Fallback famous footballers (if gallery is empty)
const FAMOUS_PLAYERS = [
    "Messi", "Cristiano Ronaldo", "Neymar", "Mbappe", "Haaland",
    "Ronaldinho", "Zidane", "Beckham", "Maradona", "Pele",
    "Modric", "De Bruyne", "Salah", "Lewandowski", "Benzema", "Kaka",
];

/**
 * /bracket — Matches page.
 * Shows all active tournaments with tabs to switch between them.
 */
type SelectedMatch = {
    id: string;
    round: number;
    player1Id: string | null;
    player1Name: string | null;
    player1Avatar: string | null;
    player2Name: string | null;
    player2Avatar: string | null;
    isDisputing?: boolean;
    isEditing?: boolean;
} | null;

export default function MatchesPage() {
    const { user, isAdmin } = useAuthUser();
    const [selectedMatch, setSelectedMatch] = useState<SelectedMatch>(null);
    const [viewingMatch, setViewingMatch] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>("");
    const playerId = user?.player?.id;


    // Fetch bracket background: existing gallery images, TheSportsDB fallback
    const [bgSeed] = useState(() => Math.random());
    const bgQuery = useQuery({
        queryKey: ["bracket-bg", bgSeed],
        queryFn: async () => {
            // Try existing gallery (non-character images)
            try {
                const res = await fetch("/api/gallery");
                if (res.ok) {
                    const json = await res.json();
                    const items = (json.data ?? []).filter((g: any) => !g.isCharacterImg);
                    if (items.length > 0) {
                        const pick = items[Math.floor(Math.random() * items.length)];
                        return { name: pick.name, img: pick.publicUrl };
                    }
                }
            } catch { /* fall through */ }

            // Fallback: TheSportsDB
            const name = FAMOUS_PLAYERS[Math.floor(Math.random() * FAMOUS_PLAYERS.length)];
            const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`);
            const data = await res.json();
            const player = data?.player?.find((p: any) => p.strCutout && p.strSport === "Soccer");
            if (player) return { name: player.strPlayer, img: player.strCutout };
            return null;
        },
        staleTime: 0,
        retry: false,
    });

    // Fetch ALL active + recently completed tournaments
    const { data: tournaments, isLoading } = useQuery({
        queryKey: ["active-tournaments"],
        queryFn: async () => {
            // Fetch active tournaments
            const res = await fetch("/api/tournaments?type=BRACKET_1V1,LEAGUE,GROUP_KNOCKOUT&status=ACTIVE&limit=50");
            if (!res.ok) return [];
            const json = await res.json();
            const active = json.data ?? [];

            // Also fetch inactive (winner-declared) tournaments from same types
            const res2 = await fetch("/api/tournaments?type=BRACKET_1V1,LEAGUE,GROUP_KNOCKOUT&status=INACTIVE&limit=50");
            const inactive = res2.ok ? ((await res2.json()).data ?? []) : [];

            // Combine, dedup by id
            const all = [...active, ...inactive];
            const seen = new Set<string>();
            return all.filter((t: any) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
        },
    });

    // Show active tournaments + winner-declared within last 24h
    const DAY_MS = 24 * 60 * 60 * 1000;
    const activeTournaments = (tournaments ?? []).filter((t: any) => {
        if (t.bracketMatchCount <= 0) return false;
        if (t.status === "ACTIVE") return true;
        // Winner declared — show for 24h after updatedAt
        if (t.isWinnerDeclared && t.updatedAt) {
            return Date.now() - new Date(t.updatedAt).getTime() < DAY_MS;
        }
        return false;
    });
    const currentId = activeTab || activeTournaments[0]?.id || "";
    const currentTournament = activeTournaments.find((t: any) => t.id === currentId);

    // Loading
    if (isLoading) {
        return <FootballLoader />;
    }

    // No active tournaments
    if (activeTournaments.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
                <div className="p-4 rounded-2xl bg-foreground/5">
                    <Swords className="h-12 w-12 text-foreground/20" />
                </div>
                <div>
                    <h2 className="text-lg font-bold">No Active Matches</h2>
                    <p className="text-sm text-foreground/50 mt-1">
                        Check the Vote page for upcoming tournaments
                    </p>
                </div>
            </div>
        );
    }

    const formatIcon = (type: string) =>
        type === "LEAGUE" ? "🏟️" :
            type === "GROUP_KNOCKOUT" ? "🌍" : "⚔️";

    return (
        <div className="relative min-h-[80vh]">
            {/* Background image from gallery or TheSportsDB */}
            {bgQuery.data?.img && (
                <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={bgQuery.data.img}
                        alt=""
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[90vh] w-auto object-contain opacity-[0.25]"
                        style={{ filter: "grayscale(100%)" }}
                    />
                    {/* Radial vignette — fades edges so content stays readable */}
                    <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 20%, var(--background) 75%)" }} />
                    <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
                    <span className="absolute bottom-4 right-4 text-[9px] text-foreground/10 font-medium tracking-wider uppercase">
                        {bgQuery.data.name}
                    </span>
                </div>
            )}

            <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
                {/* Tournament tabs (only show if multiple) */}
                {activeTournaments.length > 1 && (
                    <Tabs
                        selectedKey={currentId}
                        onSelectionChange={(key) => {
                            setActiveTab(key as string);
                            setSelectedMatch(null);
                            setViewingMatch(null);
                        }}
                        color="primary"
                        variant="solid"
                        classNames={{
                            tabList: "bg-foreground/5 w-full overflow-x-auto flex-nowrap",
                            tab: "font-semibold whitespace-nowrap",
                        }}
                        fullWidth
                    >
                        {activeTournaments.map((t: any) => (
                            <Tab
                                key={t.id}
                                title={
                                    <span className="flex items-center gap-1.5">
                                        <span>{formatIcon(t.type)}</span>
                                        <span>{t.name}</span>
                                    </span>
                                }
                            />
                        ))}
                    </Tabs>
                )}

                {/* Selected tournament content */}
                {currentTournament && (
                    <TournamentContent
                        tournament={currentTournament}
                        playerId={playerId}
                        isAdmin={isAdmin}
                        showName={activeTournaments.length <= 1}
                        selectedMatch={selectedMatch}
                        viewingMatch={viewingMatch}
                        onSelectMatch={setSelectedMatch}
                        onViewMatch={setViewingMatch}
                    />
                )}
            </div>
        </div>
    );
}

/* ─── Single Tournament Content ─────────────────────────────── */

function TournamentContent({
    tournament,
    playerId,
    isAdmin,
    showName = true,
    selectedMatch,
    viewingMatch,
    onSelectMatch,
    onViewMatch,
}: {
    tournament: any;
    playerId?: string;
    isAdmin?: boolean;
    showName?: boolean;
    selectedMatch: SelectedMatch;
    viewingMatch: string | null;
    onSelectMatch: (m: SelectedMatch) => void;
    onViewMatch: (id: string | null) => void;
}) {
    const tournamentId = tournament.id;
    const tournamentType = tournament.type ?? "BRACKET_1V1";

    // Fetch bracket/match data
    const { data: bracketData, isLoading } = useQuery({
        queryKey: ["bracket", tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/tournaments/${tournamentId}/bracket`);
            if (!res.ok) return null;
            const json = await res.json();
            return json.data;
        },
        enabled: !!tournamentId,
    });

    const confirmResult = useConfirmResult(tournamentId);
    const disputeResult = useDisputeResult(tournamentId);

    const allMatches = bracketData?.rounds?.flatMap((r: any) => r.matches) ?? [];

    // Prefetch all match screenshots so they're cached when modals open
    useEffect(() => {
        allMatches.forEach((m: any) => {
            const url = m.results?.find((r: any) => r.screenshotUrl)?.screenshotUrl;
            if (url) prefetchScreenshot(url);
        });
    }, [allMatches]);

    // Does the player have a SUBMITTED match where they need to confirm/dispute?
    const hasSubmittedMatch = allMatches.some(
        (m: any) =>
            m.status === "SUBMITTED" &&
            (m.player1Id === playerId || m.player2Id === playerId) &&
            m.winnerId !== playerId
    );
    const { showOnboarding, dismissOnboarding } = useBracketOnboarding(playerId);
    const { showDisputeOnboarding, dismissDisputeOnboarding } = useDisputeOnboarding(playerId, hasSubmittedMatch);

    // Find the first SUBMITTED match where this player needs to confirm (opponent submitted)
    const pendingConfirmMatch = playerId
        ? allMatches.find(
              (m: any) =>
                  m.status === "SUBMITTED" &&
                  (m.player1Id === playerId || m.player2Id === playerId) &&
                  m.winnerId !== playerId
          ) ?? null
        : null;


    // Compute stage deadlines with rollover + cutoff snapping:
    // Each KO round deadline = snapToCutoff(T0 + roundPosition × koHours)
    // Unused time from a faster round rolls over to the next.
    // NOTE: must be before early returns to comply with Rules of Hooks
    const stageDeadlines = useMemo(() => {
        if (!bracketData?.deadlines || !bracketData?.rounds) return null;
        const matches = bracketData.rounds.flatMap((r: any) => r.matches);
        const rounds: RoundData[] = bracketData.rounds;
        const cutoff = bracketData.deadlines.cutoffTime || "";
        const paused: number[] = bracketData.deadlines.pausedDays || [];

        if (tournamentType === "GROUP_KNOCKOUT") {
            const groupMatches = matches.filter((m: any) => m.round < 0 && m.status !== "CONFIRMED");
            const allKoMatches = matches.filter((m: any) => m.round > 0);
            const koStarted = allKoMatches.some((m: any) => m.player1Id && m.player2Id);
            const koAllConfirmed = koStarted && allKoMatches.every((m: any) => m.status === "CONFIRMED" || m.status === "BYE");

            // Group deadline: latest match creation + group hours → snap
            let groupDeadlineMs = groupMatches.length > 0
                ? Math.max(...groupMatches.map((m: any) => new Date(m.createdAt).getTime())) + bracketData.deadlines.groupHours * 3600000
                : null;
            if (groupDeadlineMs && paused.length > 0) {
                const latestCreated = Math.max(...groupMatches.map((m: any) => new Date(m.createdAt).getTime()));
                groupDeadlineMs = addPausedDays(latestCreated, groupDeadlineMs, paused);
            }
            if (groupDeadlineMs && cutoff) groupDeadlineMs = snapToCutoff(groupDeadlineMs, cutoff, paused);

            // KO rollover: find T0 (earliest KO match creation), get sorted unique KO rounds
            const koRoundNums = [...new Set<number>(allKoMatches.map((m: any) => m.round))].sort((a: number, b: number) => a - b);
            const t0 = allKoMatches.length > 0
                ? Math.min(...allKoMatches.map((m: any) => new Date(m.createdAt).getTime()))
                : null;

            // Current active KO round = lowest round with unfinished matches
            const activeKoRound = koRoundNums.find(rn =>
                allKoMatches.some((m: any) => m.round === rn && m.status !== "CONFIRMED" && m.status !== "BYE")
            ) ?? null;

            // Rollover deadline: T0 + (1-based position of active round) × koHours → snap
            let koDeadlineMs: number | null = null;
            let activeRoundLabel: string | null = null;
            if (t0 !== null && activeKoRound !== null) {
                const roundPos = koRoundNums.indexOf(activeKoRound) + 1;
                const raw = t0 + roundPos * bracketData.deadlines.koHours * 3600000;
                const extended = addPausedDays(t0, raw, paused);
                koDeadlineMs = cutoff ? snapToCutoff(extended, cutoff, paused) : extended;
                activeRoundLabel = roundLabel(activeKoRound, rounds);
            }

            return {
                groupDone: groupMatches.length === 0,
                groupDeadlineMs,
                koStarted,
                koDone: koAllConfirmed,
                koDeadlineMs,
                koRoundLabel: activeRoundLabel,
            };
        } else {
            // Pure bracket (BRACKET_1V1 / LEAGUE)
            const allMatches = matches.filter((m: any) => m.player1Id && m.player2Id);
            const done = allMatches.every((m: any) => m.status === "CONFIRMED" || m.status === "BYE");

            const roundNums = [...new Set<number>(allMatches.map((m: any) => m.round))].sort((a: number, b: number) => a - b);
            const t0 = allMatches.length > 0
                ? Math.min(...allMatches.map((m: any) => new Date(m.createdAt).getTime()))
                : null;

            const activeRound = roundNums.find(rn =>
                allMatches.some((m: any) => m.round === rn && m.status !== "CONFIRMED" && m.status !== "BYE")
            ) ?? null;

            let deadlineMs: number | null = null;
            let activeRoundLbl: string | null = null;
            if (t0 !== null && activeRound !== null) {
                const roundPos = roundNums.indexOf(activeRound) + 1;
                const raw = t0 + roundPos * bracketData.deadlines.koHours * 3600000;
                const extended = addPausedDays(t0, raw, paused);
                deadlineMs = cutoff ? snapToCutoff(extended, cutoff, paused) : extended;
                activeRoundLbl = roundLabel(activeRound, rounds);
            }

            return {
                done,
                deadlineMs,
                roundLabel: activeRoundLbl,
            };
        }
    }, [bracketData, tournamentType]);

    // Helper — build submit context from a match id
    const matchContext = (matchId: string, isDisputing = false): SelectedMatch => {
        const m = allMatches.find((x: any) => x.id === matchId);
        if (!m) return { id: matchId, round: 1, player1Id: null, player1Name: null, player1Avatar: null, player2Name: null, player2Avatar: null, isDisputing };
        const isEditing = m.status === "SUBMITTED" && m.winnerId === playerId;
        return {
            id: matchId,
            round: m.round ?? 1,
            player1Id: m.player1Id ?? null,
            player1Name: m.team1?.name ?? m.player1?.displayName ?? null,
            player1Avatar: m.player1Avatar ?? null,
            player2Name: m.team2?.name ?? m.player2?.displayName ?? null,
            player2Avatar: m.player2Avatar ?? null,
            isDisputing,
            isEditing,
        };
    };

    const viewMatch = viewingMatch ? allMatches.find((m: any) => m.id === viewingMatch) : null;
    const viewMatchData = viewMatch ? {
        id: viewMatch.id,
        player1: viewMatch.team1?.name ?? viewMatch.player1?.displayName ?? null,
        player2: viewMatch.team2?.name ?? viewMatch.player2?.displayName ?? null,
        player1Avatar: viewMatch.player1Avatar,
        player2Avatar: viewMatch.player2Avatar,
        score1: viewMatch.score1,
        score2: viewMatch.score2,
        winnerId: viewMatch.winnerId,
        player1Id: viewMatch.player1Id,
        player2Id: viewMatch.player2Id,
        status: viewMatch.status,
        screenshotUrl: viewMatch.results?.find((r: any) => r.screenshotUrl)?.screenshotUrl ?? null,
        notes: viewMatch.results?.find((r: any) => r.notes && !r.notes.startsWith("Confirmed by"))?.notes ?? null,
        confirmedBy: viewMatch.results?.find((r: any) => r.notes?.startsWith("Confirmed by"))?.notes ?? null,
        disputeDeadline: viewMatch.disputeDeadline ?? null,
        mvpPlayerName: viewMatch.mvpPlayerName ?? null,
    } : null;

    const formatLabel =
        tournamentType === "LEAGUE" ? "League" :
            tournamentType === "GROUP_KNOCKOUT" ? "Group + Knockout" :
                "Knockout";

    if (isLoading) {
        return (
            <div className="space-y-5">
                {/* Tournament info skeleton */}
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-40 rounded-md" />
                            <Skeleton className="h-3 w-24 rounded-md" />
                        </div>
                        <Skeleton className="h-6 w-14 rounded-full" />
                    </div>
                </div>

                {/* Match rows skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32 rounded-md" />
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-divider">
                            <Skeleton className="h-4 w-24 rounded-md" />
                            <span className="text-[10px] text-foreground/15 font-bold">VS</span>
                            <Skeleton className="h-4 w-24 rounded-md" />
                            <div className="ml-auto">
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // No matches generated yet
    if (!bracketData?.rounds || bracketData.rounds.length === 0) {
        return (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-foreground/5 border border-divider">
                <Swords className="h-5 w-5 text-primary" />
                <div className="flex-1">
                    <p className="text-sm font-semibold">{tournament.name}</p>
                    <p className="text-xs text-foreground/50">Matches not generated yet</p>
                </div>
                <Chip size="sm" color="warning" variant="dot">Waiting</Chip>
            </div>
        );
    }



    return (
        <>
            {/* Onboarding spotlights — skip dispute onboarding if confirmation modal is showing */}
            {showOnboarding && <BracketOnboarding onDone={dismissOnboarding} />}
            {showDisputeOnboarding && !pendingConfirmMatch && <DisputeOnboarding onDone={dismissDisputeOnboarding} />}

            {/* Auto-popup confirmation modal — non-dismissable */}
            {playerId && pendingConfirmMatch && (
                <PendingConfirmationModal
                    match={pendingConfirmMatch}
                    rounds={bracketData.rounds}
                    currentPlayerId={playerId}
                    onConfirm={(id) => confirmResult.mutate(id)}
                    onDispute={(id) => onSelectMatch(matchContext(id, true))}
                    isConfirming={confirmResult.isPending}
                    isConfirmSuccess={confirmResult.isSuccess}
                />
            )}

            {/* Tournament Info */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 space-y-3">
                {/* Glow blob */}
                <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-primary/15 blur-2xl pointer-events-none" />

                <div className="relative flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/15 text-xl shrink-0">
                        {tournamentType === "LEAGUE" ? "🏟️" : tournamentType === "GROUP_KNOCKOUT" ? "🌍" : "⚔️"}
                    </div>
                    <div className="flex-1 min-w-0">
                        {showName && (
                            <p className="font-bold text-base leading-tight">{tournament.name}</p>
                        )}
                        <div className={`flex items-center gap-2 flex-wrap ${showName ? 'mt-0.5' : ''}`}>
                            <span className="text-[11px] text-foreground/40 font-medium">
                                {bracketData.totalPlayers} players
                            </span>
                            <span className="h-1 w-1 rounded-full bg-foreground/20" />
                            <span className="text-[11px] text-foreground/40 font-medium">{formatLabel}</span>
                        </div>
                    </div>
                    {bracketData.winner ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/20 shrink-0">
                            <Trophy className="h-3 w-3 text-primary" />
                            <span className="text-[11px] font-bold text-primary">Completed</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 border border-success/20 shrink-0">
                            <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                            <span className="text-[11px] font-bold text-success">Live</span>
                        </div>
                    )}
                </div>

                {/* Stage deadlines — hide when tournament is completed */}
                {stageDeadlines && !bracketData.winner && (
                    <div className="relative flex items-center gap-2 flex-wrap">
                        <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                        {tournamentType === "GROUP_KNOCKOUT" ? (
                            <>
                                <span className={`text-[11px] font-medium ${stageDeadlines.groupDone ? 'text-success' : 'text-warning'}`}>
                                    Group: {stageDeadlines.groupDone ? "✓ Done" : stageDeadlines.groupDeadlineMs ? `~${Math.ceil((stageDeadlines.groupDeadlineMs - Date.now()) / 3600_000)}h` : "—"}
                                </span>
                                <span className="h-1 w-1 rounded-full bg-foreground/20" />
                                {stageDeadlines.koDone ? (
                                    <span className="text-[11px] font-medium text-success">KO: ✓ Done</span>
                                ) : stageDeadlines.koStarted && stageDeadlines.koDeadlineMs ? (
                                    <span className="text-[11px] font-medium text-warning">
                                        {stageDeadlines.koRoundLabel}: ~{Math.ceil((stageDeadlines.koDeadlineMs - Date.now()) / 3600_000)}h
                                    </span>
                                ) : (
                                    <span className={`text-[11px] font-medium ${stageDeadlines.groupDone ? 'text-primary' : 'text-foreground/30'}`}>
                                        KO: {stageDeadlines.groupDone ? "⏳ Starting soon" : "Not started"}
                                    </span>
                                )}
                            </>
                        ) : (
                            stageDeadlines.done ? (
                                <span className="text-[11px] font-medium text-success">✓ All matches complete</span>
                            ) : stageDeadlines.deadlineMs ? (
                                <span className="text-[11px] font-medium text-warning">
                                    {stageDeadlines.roundLabel}: ~{Math.ceil((stageDeadlines.deadlineMs - Date.now()) / 3600_000)}h
                                </span>
                            ) : (
                                <span className="text-[11px] font-medium text-foreground/30">Not started</span>
                            )
                        )}
                    </div>
                )}

                {/* Paused day banner */}
                {bracketData?.deadlines?.pausedDays?.length > 0 &&
                 bracketData.deadlines.pausedDays.includes(getISTDayOfWeek(Date.now())) &&
                 !bracketData.winner && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                        <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="text-[11px] text-blue-300">
                            Deadline paused today — you can still play as usual, timer resumes tomorrow
                        </span>
                    </div>
                )}
            </div>


            {/* My Current Match */}
            {playerId && (
                <MyBracketMatch
                    rounds={bracketData.rounds}
                    currentPlayerId={playerId}
                    onSubmitResult={(id) => onSelectMatch(matchContext(id))}
                    onConfirmResult={(id) => confirmResult.mutate(id)}
                    onDispute={(id) => onSelectMatch(matchContext(id, true))}
                    deadlines={bracketData.deadlines}
                    tournamentType={tournamentType}
                    rolloverDeadlineMs={
                        tournamentType === "GROUP_KNOCKOUT"
                            ? stageDeadlines?.koDeadlineMs ?? undefined
                            : stageDeadlines?.deadlineMs ?? undefined
                    }
                    roundLabel={
                        tournamentType === "GROUP_KNOCKOUT"
                            ? stageDeadlines?.koRoundLabel ?? undefined
                            : stageDeadlines?.roundLabel ?? undefined
                    }
                    tournamentName={tournament.name}
                />
            )}

            {/* Matches */}
            <div>
                <h2 className="text-lg font-bold mb-4">
                    {tournamentType === "LEAGUE" ? "All Matches" :
                        tournamentType === "GROUP_KNOCKOUT" ? "Tournament" :
                            "Tournament Bracket"}
                </h2>
                {tournamentType === "GROUP_KNOCKOUT" ? (
                    <GroupKnockoutView
                        rounds={bracketData.rounds}
                        totalRounds={bracketData.totalRounds}
                        currentPlayerId={playerId}
                        isAdmin={isAdmin}
                        onSubmitResult={(id) => onSelectMatch(matchContext(id))}
                        onConfirmResult={(id) => confirmResult.mutate(id)}
                        onDispute={(id) => onSelectMatch(matchContext(id, true))}
                        onViewResult={(id) => onViewMatch(id)}
                    />
                ) : (
                    <BracketView
                        rounds={bracketData.rounds}
                        totalRounds={bracketData.totalRounds}
                        currentPlayerId={playerId}
                        isAdmin={isAdmin}
                        winner={bracketData.winner}
                        maxPlacements={bracketData.maxPlacements}
                        onSubmitResult={(id) => onSelectMatch(matchContext(id))}
                        onConfirmResult={(id) => confirmResult.mutate(id)}
                        onDispute={(id) => onSelectMatch(matchContext(id, true))}
                        onViewResult={(id) => onViewMatch(id)}
                    />
                )}
            </div>

            {/* Winner banner + confetti */}
            {bracketData.winner && (
                <>
                    <ConfettiBurst />
                    <div className="relative overflow-hidden rounded-2xl">
                        {/* Golden gradient top border */}
                        <div className="h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
                        <div className="flex flex-col items-center gap-3 px-6 py-5 bg-gradient-to-b from-yellow-500/8 to-transparent">
                            {/* Trophy with glow */}
                            <div className="relative">
                                <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl scale-150" />
                                <div className="relative p-3 rounded-full bg-yellow-400/10 border border-yellow-400/20">
                                    <Trophy className="h-6 w-6 text-yellow-400" />
                                </div>
                            </div>
                            {/* Label + Name */}
                            <div className="text-center space-y-0.5">
                                <p className="text-[10px] text-yellow-400/60 uppercase font-bold tracking-[0.2em]">Champion</p>
                                <p className="text-lg font-black text-yellow-400">{bracketData.winner.displayName}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Submit Result Modal */}
            {selectedMatch && (
                <SubmitResultModal
                    matchId={selectedMatch.id}
                    tournamentId={tournamentId}
                    isOpen={!!selectedMatch}
                    onClose={() => onSelectMatch(null)}
                    player1Id={selectedMatch.player1Id}
                    player1Name={selectedMatch.player1Name}
                    player1Avatar={selectedMatch.player1Avatar}
                    player2Name={selectedMatch.player2Name}
                    player2Avatar={selectedMatch.player2Avatar}
                    currentPlayerId={playerId}
                    isAdmin={isAdmin}
                    isDisputing={selectedMatch.isDisputing}
                    isEditing={selectedMatch.isEditing}
                    drawsAllowed={selectedMatch.round < 0}
                />
            )}

            {/* View Result Modal */}
            <ViewResultModal
                isOpen={!!viewingMatch}
                onClose={() => onViewMatch(null)}
                match={viewMatchData}
                isAdmin={isAdmin}
                tournamentId={tournamentId}
            />
        </>
    );
}

/* ─── Live Ticking Countdown ─────────────────────────────── */
function RoundTicker({ deadlineMs }: { deadlineMs: number }) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const diff = deadlineMs - now;
    if (diff <= 0) return <span className="text-danger font-bold">Time&apos;s up</span>;

    const h = Math.floor(diff / 3600_000);
    const m = Math.floor((diff % 3600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1000);
    const urgent = h < 2;
    const pad = (n: number) => String(n).padStart(2, "0");

    return (
        <span className={`tabular-nums font-mono font-bold ${urgent ? "text-danger animate-pulse" : ""}`} suppressHydrationWarning>
            {h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : m > 0 ? `${m}m ${pad(s)}s` : `${s}s`}
        </span>
    );
}

/* ─── Game-Aware Bracket Loader ──────────────────────────── */
function FootballLoader() {
    const isMlbb = GAME.mode === "mlbb";
    return (
        <div className="flex flex-col items-center justify-center" style={{ height: "calc(100vh - 200px)" }}>
            {isMlbb ? (
                <>
                    {/* MLBB: crossed swords with glow pulse */}
                    <span
                        className="text-3xl block"
                        style={{ animation: "swordPulse 1.5s ease-in-out infinite" }}
                    >
                        ⚔️
                    </span>
                    <div
                        className="mt-2 w-8 h-2 rounded-full bg-primary/15 blur-[3px]"
                        style={{ animation: "swordGlow 1.5s ease-in-out infinite" }}
                    />
                    <style>{`
                        @keyframes swordPulse {
                            0%, 100% { transform: scale(1); opacity: 0.7; }
                            50% { transform: scale(1.15); opacity: 1; }
                        }
                        @keyframes swordGlow {
                            0%, 100% { opacity: 0.3; transform: scaleX(0.8); }
                            50% { opacity: 0.7; transform: scaleX(1.2); }
                        }
                    `}</style>
                </>
            ) : (
                <>
                    {/* PES/default: bouncing football */}
                    <span
                        className="text-3xl block"
                        style={{ animation: "ballBounce 0.6s ease-in-out infinite alternate" }}
                    >
                        ⚽
                    </span>
                    <div
                        className="mt-1 w-7 h-1.5 rounded-full bg-foreground/10 blur-[2px]"
                        style={{ animation: "ballShadow 0.6s ease-in-out infinite alternate" }}
                    />
                    <style>{`
                        @keyframes ballBounce {
                            from { transform: translateY(0); }
                            to { transform: translateY(-24px); }
                        }
                        @keyframes ballShadow {
                            from { opacity: 0.8; transform: scaleX(1); }
                            to { opacity: 0.2; transform: scaleX(0.5); }
                        }
                    `}</style>
                </>
            )}
        </div>
    );
}

/* ─── Confetti Burst ──────────────────────────────────────── */
function ConfettiBurst() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const COLORS = [
            "#fbbf24", "#f59e0b", "#d97706", "#fcd34d", "#fef3c7",
            "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#ec4899",
            "#ffffff", "#fef08a",
        ];

        type Particle = {
            x: number; y: number; vx: number; vy: number;
            w: number; h: number; color: string; rot: number; vr: number;
            life: number; maxLife: number;
        };

        const particles: Particle[] = [];
        const COUNT = 100;

        for (let i = 0; i < COUNT; i++) {
            particles.push({
                x: canvas.width * 0.3 + Math.random() * canvas.width * 0.4,
                y: -20 - Math.random() * 40,
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 3 + 2,
                w: Math.random() * 8 + 4,
                h: Math.random() * 6 + 2,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.3,
                life: 0,
                maxLife: 80 + Math.random() * 60,
            });
        }

        let raf: number;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;

            for (const p of particles) {
                p.life++;
                if (p.life > p.maxLife) continue;
                alive = true;

                p.x += p.vx;
                p.vy += 0.12; // gravity
                p.y += p.vy;
                p.vx *= 0.99;
                p.rot += p.vr;

                const fade = Math.max(0, 1 - p.life / p.maxLife);
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.globalAlpha = fade;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }

            if (alive) raf = requestAnimationFrame(animate);
        };

        // Small delay so the user sees the banner first
        const timer = setTimeout(() => { raf = requestAnimationFrame(animate); }, 200);

        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-50"
            style={{ width: "100vw", height: "100vh" }}
        />
    );
}
