"use client";

import { useState } from "react";
import { BracketView, MyBracketMatch } from "@/components/bracket/bracket-view";
import { SubmitResultModal } from "@/components/bracket/submit-result-modal";
import { Trophy, Swords, Users, Globe, Eye, CheckCircle, XCircle } from "lucide-react";
import { Chip, Tabs, Tab, Card, CardBody, Progress, Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/react";

/**
 * /bracket/demo — Demo page to preview all three tournament formats:
 *   1. ⚔️ Knockout (single elimination bracket)
 *   2. 🏟️ League (round-robin with standings table)
 *   3. 🌍 Group + Knockout (group stage → knockout)
 */

const CURRENT_PLAYER_ID = "p3";

// ─── Shared player data ────────────────────────────────────
const P = {
    p1: { id: "p1", displayName: "KingMessi10", userId: "u1" },
    p2: { id: "p2", displayName: "CR7_Legend", userId: "u2" },
    p3: { id: "p3", displayName: "NeymarSkillz", userId: "u3" },
    p4: { id: "p4", displayName: "MbappeSpeed", userId: "u4" },
    p5: { id: "p5", displayName: "HaalandBeast", userId: "u5" },
    p6: { id: "p6", displayName: "SalahKing", userId: "u6" },
    p7: { id: "p7", displayName: "ViníciusJR", userId: "u7" },
    p8: { id: "p8", displayName: "BellinghamX", userId: "u8" },
} as const;

const mkMatch = (overrides: any) => ({
    winnerId: null,
    score1: null,
    score2: null,
    status: "PENDING" as const,
    disputeDeadline: null,
    player1Avatar: null,
    player2Avatar: null,
    winner: null,
    results: [],
    ...overrides,
});

// ─── 1. KNOCKOUT DATA (8 players, 3 rounds + 3rd place) ───
const KNOCKOUT_ROUNDS = [
    {
        round: 1,
        name: "Quarter-Finals",
        matches: [
            mkMatch({ id: "k1", round: 1, position: 0, player1Id: "p1", player2Id: "p2", winnerId: "p1", score1: 3, score2: 1, status: "CONFIRMED", player1: P.p1, player2: P.p2, winner: P.p1 }),
            mkMatch({ id: "k2", round: 1, position: 1, player1Id: "p3", player2Id: "p4", winnerId: "p3", score1: 2, score2: 1, status: "CONFIRMED", player1: P.p3, player2: P.p4, winner: P.p3, results: [{ id: "r0", submittedById: "p3", claimedScore1: 2, claimedScore2: 1, screenshotUrl: null, isDispute: false, createdAt: new Date().toISOString() }] }),
            mkMatch({ id: "k3", round: 1, position: 2, player1Id: "p5", player2Id: "p6", winnerId: "p5", score1: 2, score2: 0, status: "CONFIRMED", player1: P.p5, player2: P.p6, winner: P.p5 }),
            mkMatch({ id: "k4", round: 1, position: 3, player1Id: "p7", player2Id: "p8", winnerId: "p7", score1: 1, score2: 0, status: "CONFIRMED", player1: P.p7, player2: P.p8, winner: P.p7 }),
        ],
    },
    {
        round: 2,
        name: "Semi-Finals",
        matches: [
            mkMatch({ id: "k5", round: 2, position: 0, player1Id: "p1", player2Id: "p3", winnerId: "p3", score1: 1, score2: 3, status: "SUBMITTED", disputeDeadline: new Date(Date.now() + 25 * 60 * 1000).toISOString(), player1: P.p1, player2: P.p3, results: [{ id: "r2", submittedById: "p3", claimedScore1: 1, claimedScore2: 3, screenshotUrl: null, isDispute: false, createdAt: new Date().toISOString() }] }),
            mkMatch({ id: "k6", round: 2, position: 1, player1Id: "p5", player2Id: "p7", winnerId: "p5", score1: 4, score2: 2, status: "CONFIRMED", player1: P.p5, player2: P.p7, winner: P.p5, results: [{ id: "r1", submittedById: "p5", claimedScore1: 4, claimedScore2: 2, screenshotUrl: null, isDispute: false, createdAt: new Date().toISOString() }] }),
        ],
    },
    {
        round: 3,
        name: "Final & 3rd Place",
        matches: [
            mkMatch({ id: "k7", round: 3, position: 0, player1Id: null, player2Id: null, status: "PENDING", player1: null, player2: null }),
            mkMatch({ id: "k8", round: 3, position: 1, player1Id: null, player2Id: null, status: "PENDING", player1: null, player2: null }),
        ],
    },
];

// ─── 2. LEAGUE DATA (6 players, round-robin standings) ─────
type LeaguePlayer = { id: string; name: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; points: number };
const LEAGUE_STANDINGS: LeaguePlayer[] = [
    { id: "p1", name: "KingMessi10", played: 5, wins: 4, draws: 1, losses: 0, gf: 14, ga: 3, gd: 11, points: 13 },
    { id: "p3", name: "NeymarSkillz", played: 5, wins: 3, draws: 1, losses: 1, gf: 10, ga: 5, gd: 5, points: 10 },
    { id: "p5", name: "HaalandBeast", played: 5, wins: 3, draws: 0, losses: 2, gf: 11, ga: 8, gd: 3, points: 9 },
    { id: "p7", name: "ViníciusJR", played: 5, wins: 2, draws: 1, losses: 2, gf: 8, ga: 7, gd: 1, points: 7 },
    { id: "p2", name: "CR7_Legend", played: 5, wins: 1, draws: 0, losses: 4, gf: 5, ga: 12, gd: -7, points: 3 },
    { id: "p4", name: "MbappeSpeed", played: 5, wins: 0, draws: 1, losses: 4, gf: 2, ga: 15, gd: -13, points: 1 },
];

const LEAGUE_FIXTURES = [
    {
        round: 1, label: "Match Day 1", matches: [
            { home: "KingMessi10", away: "CR7_Legend", score: "3-0", done: true },
            { home: "NeymarSkillz", away: "MbappeSpeed", score: "2-1", done: true },
            { home: "HaalandBeast", away: "ViníciusJR", score: "1-2", done: true },
        ]
    },
    {
        round: 2, label: "Match Day 2", matches: [
            { home: "CR7_Legend", away: "ViníciusJR", score: "0-1", done: true },
            { home: "MbappeSpeed", away: "HaalandBeast", score: "0-3", done: true },
            { home: "KingMessi10", away: "NeymarSkillz", score: "1-1", done: true },
        ]
    },
    {
        round: 3, label: "Match Day 3", matches: [
            { home: "NeymarSkillz", away: "ViníciusJR", score: "2-0", done: true },
            { home: "HaalandBeast", away: "KingMessi10", score: "1-2", done: true },
            { home: "CR7_Legend", away: "MbappeSpeed", score: "1-0", done: false },
        ]
    },
    {
        round: 4, label: "Match Day 4", matches: [
            { home: "ViníciusJR", away: "MbappeSpeed", score: "—", done: false },
            { home: "KingMessi10", away: "HaalandBeast", score: "—", done: false },
            { home: "NeymarSkillz", away: "CR7_Legend", score: "—", done: false },
        ]
    },
    {
        round: 5, label: "Match Day 5", matches: [
            { home: "MbappeSpeed", away: "KingMessi10", score: "—", done: false },
            { home: "ViníciusJR", away: "NeymarSkillz", score: "—", done: false },
            { home: "CR7_Legend", away: "HaalandBeast", score: "—", done: false },
        ]
    },
];

// ─── 3. GROUP + KNOCKOUT DATA ─────────────────────────────
type GroupEntry = { name: string; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number };
const GROUP_A: GroupEntry[] = [
    { name: "KingMessi10", w: 2, d: 1, l: 0, gf: 6, ga: 1, gd: 5, pts: 7 },
    { name: "MbappeSpeed", w: 1, d: 1, l: 1, gf: 3, ga: 3, gd: 0, pts: 4 },
    { name: "SalahKing", w: 1, d: 0, l: 2, gf: 2, ga: 5, gd: -3, pts: 3 },
    { name: "BellinghamX", w: 0, d: 0, l: 3, gf: 1, ga: 3, gd: -2, pts: 0 },
];

const GROUP_B: GroupEntry[] = [
    { name: "HaalandBeast", w: 3, d: 0, l: 0, gf: 8, ga: 2, gd: 6, pts: 9 },
    { name: "NeymarSkillz", w: 2, d: 0, l: 1, gf: 5, ga: 3, gd: 2, pts: 6 },
    { name: "ViníciusJR", w: 1, d: 0, l: 2, gf: 3, ga: 5, gd: -2, pts: 3 },
    { name: "CR7_Legend", w: 0, d: 0, l: 3, gf: 1, ga: 7, gd: -6, pts: 0 },
];

const GROUP_MATCHES_A = [
    { home: "KingMessi10", away: "MbappeSpeed", score: "2-1", done: true },
    { home: "SalahKing", away: "BellinghamX", score: "1-0", done: true },
    { home: "KingMessi10", away: "SalahKing", score: "3-0", done: true },
    { home: "MbappeSpeed", away: "BellinghamX", score: "1-0", done: true },
    { home: "KingMessi10", away: "BellinghamX", score: "1-1", done: true },
    { home: "MbappeSpeed", away: "SalahKing", score: "1-1", done: true },
];

const GROUP_MATCHES_B = [
    { home: "HaalandBeast", away: "NeymarSkillz", score: "3-1", done: true },
    { home: "ViníciusJR", away: "CR7_Legend", score: "2-0", done: true },
    { home: "HaalandBeast", away: "ViníciusJR", score: "2-1", done: true },
    { home: "NeymarSkillz", away: "CR7_Legend", score: "3-0", done: true },
    { home: "HaalandBeast", away: "CR7_Legend", score: "3-1", done: true },
    { home: "NeymarSkillz", away: "ViníciusJR", score: "1-2", done: false },
];

const GK_KNOCKOUT_ROUNDS = [
    {
        round: 1,
        name: "Semi-Finals",
        matches: [
            mkMatch({ id: "gk1", round: 1, position: 0, player1Id: "p1", player2Id: "p3", status: "PENDING", player1: P.p1, player2: P.p3 }),
            mkMatch({ id: "gk2", round: 1, position: 1, player1Id: "p5", player2Id: "p4", winnerId: "p5", score1: 3, score2: 0, status: "CONFIRMED", player1: P.p5, player2: P.p4, winner: P.p5 }),
        ],
    },
    {
        round: 2,
        name: "Final & 3rd Place",
        matches: [
            mkMatch({ id: "gk3", round: 2, position: 0, player1Id: null, player2Id: "p5", status: "PENDING", player1: null, player2: P.p5 }),
            mkMatch({ id: "gk4", round: 2, position: 1, player1Id: null, player2Id: "p4", status: "PENDING", player1: null, player2: P.p4 }),
        ],
    },
];

// ─── Component ─────────────────────────────────────────────
export default function BracketDemoPage() {
    type DemoMatch = { id: string; player1Id: string | null; player1Name: string | null; player1Avatar: string | null; player2Name: string | null; player2Avatar: string | null } | null;
    const [selectedMatch, setSelectedMatch] = useState<DemoMatch>(null);
    const [activeTab, setActiveTab] = useState("knockout");
    type MatchResult = { home: string; away: string; score: string; winner: string } | null;
    const [viewingResult, setViewingResult] = useState<MatchResult>(null);

    const allDemoMatches = [...KNOCKOUT_ROUNDS.flatMap(r => r.matches), ...GK_KNOCKOUT_ROUNDS.flatMap(r => r.matches)];
    const openSubmit = (matchId: string) => {
        const m = allDemoMatches.find(x => x.id === matchId) as any;
        setSelectedMatch({
            id: matchId,
            player1Id: m?.player1Id ?? null,
            player1Name: m?.player1?.displayName ?? null,
            player1Avatar: m?.player1Avatar ?? null,
            player2Name: m?.player2?.displayName ?? null,
            player2Avatar: m?.player2Avatar ?? null,
        });
    };

    const viewResult = (home: string, away: string, score: string) => {
        const [s1, s2] = score.split("-").map(Number);
        const winner = s1 > s2 ? home : s2 > s1 ? away : "Draw";
        setViewingResult({ home, away, score, winner });
    };

    const viewBracketResult = (matchId: string) => {
        const m = allDemoMatches.find(x => x.id === matchId) as any;
        if (!m) return;
        const home = m.player1?.displayName ?? "TBD";
        const away = m.player2?.displayName ?? "TBD";
        const score = `${m.score1 ?? 0}-${m.score2 ?? 0}`;
        viewResult(home, away, score);
    };

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-warning-500/10">
                        <Trophy className="h-6 w-6 text-warning-500" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">Tournament Formats</h1>
                        <p className="text-sm text-foreground/50">Explore available tournament structures</p>
                    </div>
                </div>

                {/* Format Tabs */}
                <Tabs
                    selectedKey={activeTab}
                    onSelectionChange={(key) => setActiveTab(key as string)}
                    color="primary"
                    variant="solid"
                    classNames={{
                        tabList: "bg-foreground/5 w-full",
                        tab: "font-semibold",
                    }}
                    fullWidth
                >
                    <Tab key="knockout" title={<span className="flex items-center gap-1.5"><Swords className="h-3.5 w-3.5" /> Knockout</span>} />
                    <Tab key="league" title={<span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> League</span>} />
                    <Tab key="group" title={<span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Group + KO</span>} />
                </Tabs>

                {/* ─── KNOCKOUT TAB ─── */}
                {activeTab === "knockout" && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-foreground/5 border border-divider">
                            <Swords className="h-5 w-5 text-secondary" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold">⚔️ Single Elimination Knockout</p>
                                <p className="text-xs text-foreground/50">8 Players • 3 Rounds • 3rd Place Match</p>
                            </div>
                            <Chip size="sm" color="success" variant="dot">In Progress</Chip>
                        </div>

                        <MyBracketMatch
                            rounds={KNOCKOUT_ROUNDS}
                            currentPlayerId={CURRENT_PLAYER_ID}
                            onSubmitResult={(id) => openSubmit(id)}
                            onConfirmResult={() => {}}
                            onDispute={() => {}}
                        />

                        <div>
                            <h2 className="text-lg font-bold mb-4">Tournament Bracket</h2>
                            <BracketView
                                rounds={KNOCKOUT_ROUNDS}
                                totalRounds={3}
                                currentPlayerId={CURRENT_PLAYER_ID}
                                onSubmitResult={(id) => openSubmit(id)}
                                onConfirmResult={() => {}}
                                onDispute={() => {}}
                                onViewResult={(id) => viewBracketResult(id)}
                            />
                        </div>

                        {/* Prize Distribution */}
                        <Card className="border border-divider">
                            <CardBody className="p-4 space-y-3">
                                <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Prize Distribution (8 × 50 = 400 Pool)</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: "🏆 1st Place", amount: "190", pct: "50%", color: "text-warning" },
                                        { label: "🥈 2nd Place", amount: "114", pct: "30%", color: "text-foreground/70" },
                                        { label: "🥉 3rd Place", amount: "76", pct: "20%", color: "text-orange-400" },
                                        { label: "💰 4th Place", amount: "50", pct: "Refund", color: "text-success" },
                                    ].map((p) => (
                                        <div key={p.label} className="text-center p-3 rounded-xl bg-foreground/5">
                                            <p className={`text-lg font-bold ${p.color}`}>{p.amount}</p>
                                            <p className="text-[10px] text-foreground/40">{p.label}</p>
                                            <p className="text-[10px] text-foreground/30">{p.pct}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-foreground/30 text-center">Semi-final losers play 3rd place match</p>
                            </CardBody>
                        </Card>
                    </div>
                )}

                {/* ─── LEAGUE TAB ─── */}
                {activeTab === "league" && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-foreground/5 border border-divider">
                            <Users className="h-5 w-5 text-success" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold">🏟️ Round-Robin League</p>
                                <p className="text-xs text-foreground/50">6 Players • 15 Total Matches • 5 Match Days</p>
                            </div>
                            <Chip size="sm" color="success" variant="dot">In Progress</Chip>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-foreground/50">
                                <span>Match Progress</span>
                                <span>9/15 completed</span>
                            </div>
                            <Progress value={60} color="success" size="sm" />
                        </div>

                        {/* Standings Table */}
                        <Card className="border border-divider">
                            <CardBody className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-divider text-foreground/50 text-xs">
                                                <th className="text-left p-3 w-8">#</th>
                                                <th className="text-left p-3">Player</th>
                                                <th className="text-center p-3">P</th>
                                                <th className="text-center p-3">W</th>
                                                <th className="text-center p-3">D</th>
                                                <th className="text-center p-3">L</th>
                                                <th className="text-center p-3">GF</th>
                                                <th className="text-center p-3">GA</th>
                                                <th className="text-center p-3">GD</th>
                                                <th className="text-center p-3 font-bold">Pts</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {LEAGUE_STANDINGS.map((p, i) => (
                                                <tr
                                                    key={p.id}
                                                    className={`border-b border-divider/50 transition-colors hover:bg-foreground/5 ${p.id === CURRENT_PLAYER_ID ? "bg-primary/5 border-l-2 border-l-primary" : ""
                                                        } ${i === 0 ? "bg-warning/5" : ""}`}
                                                >
                                                    <td className="p-3">
                                                        <span className={`font-bold ${i === 0 ? "text-warning" : i === 1 ? "text-foreground/60" : i === 2 ? "text-orange-400" : "text-foreground/40"}`}>
                                                            {i + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{p.name}</span>
                                                            {i === 0 && <span className="text-[10px]">🏆</span>}
                                                            {p.id === CURRENT_PLAYER_ID && (
                                                                <Chip size="sm" variant="flat" color="primary" className="h-4 text-[10px]">YOU</Chip>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center text-foreground/60">{p.played}</td>
                                                    <td className="p-3 text-center text-success font-medium">{p.wins}</td>
                                                    <td className="p-3 text-center text-foreground/50">{p.draws}</td>
                                                    <td className="p-3 text-center text-danger">{p.losses}</td>
                                                    <td className="p-3 text-center text-foreground/60">{p.gf}</td>
                                                    <td className="p-3 text-center text-foreground/60">{p.ga}</td>
                                                    <td className={`p-3 text-center font-medium ${p.gd > 0 ? "text-success" : p.gd < 0 ? "text-danger" : "text-foreground/40"}`}>
                                                        {p.gd > 0 ? `+${p.gd}` : p.gd}
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-lg">{p.points}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Fixtures */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold">Fixtures</h2>
                            {LEAGUE_FIXTURES.map((day) => (
                                <Card key={day.round} className="border border-divider">
                                    <CardBody className="p-3 space-y-2">
                                        <p className="text-xs font-bold text-foreground/50 uppercase">{day.label}</p>
                                        {day.matches.map((m, i) => {
                                            const isYou = m.home === "NeymarSkillz" || m.away === "NeymarSkillz";
                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex items-center p-2.5 rounded-xl transition-colors ${m.done ? "bg-success/5 cursor-pointer hover:bg-success/10" :
                                                        isYou ? "bg-primary/5 border border-primary/20" :
                                                            "bg-foreground/5"
                                                        }`}
                                                >
                                                    <span className={`text-sm font-medium flex-1 text-center ${m.home === "NeymarSkillz" ? "text-primary" : ""}`}>
                                                        {m.home}
                                                    </span>
                                                    <span className={`mx-3 px-3 py-0.5 rounded-lg text-sm font-bold ${m.done ? "bg-success/10 text-success" : "bg-foreground/10 text-foreground/40"
                                                        }`}>
                                                        {m.score}
                                                    </span>
                                                    <span className={`text-sm font-medium flex-1 text-center ${m.away === "NeymarSkillz" ? "text-primary" : ""}`}>
                                                        {m.away}
                                                    </span>
                                                    {/* Action icon */}
                                                    <div className="ml-2 shrink-0">
                                                        {m.done ? (
                                                            <button
                                                                className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors"
                                                                onClick={() => viewResult(m.home, m.away, m.score)}
                                                            >
                                                                <Eye className="h-4 w-4 text-foreground/40" />
                                                            </button>
                                                        ) : isYou ? (
                                                            <Chip size="sm" variant="flat" color="primary" className="text-[10px]">Upcoming</Chip>
                                                        ) : (
                                                            <div className="w-7 h-7" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </CardBody>
                                </Card>
                            ))}
                        </div>

                        {/* Scoring Legend */}
                        <div className="p-4 rounded-2xl bg-foreground/5 border border-divider space-y-2">
                            <p className="text-xs font-bold text-foreground/60 uppercase">Scoring System</p>
                            <div className="flex gap-4 text-xs">
                                <span className="text-success font-medium">Win = 3 pts</span>
                                <span className="text-foreground/50">Draw = 1 pt</span>
                                <span className="text-danger">Loss = 0 pts</span>
                            </div>
                            <p className="text-[10px] text-foreground/40">Tiebreaker: Points → Goal Difference → Goals For</p>
                        </div>
                    </div>
                )}

                {/* ─── GROUP + KNOCKOUT TAB ─── */}
                {activeTab === "group" && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-foreground/5 border border-divider">
                            <Globe className="h-5 w-5 text-warning" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold">🌍 Group + Knockout (World Cup)</p>
                                <p className="text-xs text-foreground/50">8 Players • 2 Groups of 4 • Top 2 → Knockout</p>
                            </div>
                            <Chip size="sm" color="warning" variant="dot">Knockout Phase</Chip>
                        </div>

                        {/* Group Stage Results */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { name: "Group A", data: GROUP_A, color: "primary" as const },
                                { name: "Group B", data: GROUP_B, color: "secondary" as const },
                            ].map((group) => (
                                <Card key={group.name} className="border border-divider">
                                    <CardBody className="p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Chip size="sm" color={group.color} variant="flat">{group.name}</Chip>
                                            <Chip size="sm" variant="flat" color="success">Completed</Chip>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-foreground/40">
                                                        <th className="text-left py-1.5 pr-2">#</th>
                                                        <th className="text-left py-1.5">Player</th>
                                                        <th className="text-center py-1.5 px-1">W</th>
                                                        <th className="text-center py-1.5 px-1">D</th>
                                                        <th className="text-center py-1.5 px-1">L</th>
                                                        <th className="text-center py-1.5 px-1">GD</th>
                                                        <th className="text-center py-1.5 font-bold">Pts</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.data.map((row, i) => (
                                                        <tr key={row.name} className={i < 2 ? "bg-success/5" : ""}>
                                                            <td className="py-1.5 pr-2 font-bold text-foreground/40">{i + 1}</td>
                                                            <td className="py-1.5">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-medium">{row.name}</span>
                                                                    {i < 2 && <span className="text-[8px] text-success">▲</span>}
                                                                </div>
                                                            </td>
                                                            <td className="py-1.5 px-1 text-center text-success">{row.w}</td>
                                                            <td className="py-1.5 px-1 text-center text-foreground/50">{row.d}</td>
                                                            <td className="py-1.5 px-1 text-center text-danger">{row.l}</td>
                                                            <td className={`py-1.5 px-1 text-center ${row.gd > 0 ? "text-success" : row.gd < 0 ? "text-danger" : ""}`}>
                                                                {row.gd > 0 ? `+${row.gd}` : row.gd}
                                                            </td>
                                                            <td className="py-1.5 text-center font-bold">{row.pts}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-[10px] text-success/60">✅ Top 2 advance to knockout</p>
                                    </CardBody>
                                </Card>
                            ))}
                        </div>

                        {/* Group Match Fixtures */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold">Group Matches</h2>
                            {[
                                { name: "Group A", matches: GROUP_MATCHES_A },
                                { name: "Group B", matches: GROUP_MATCHES_B },
                            ].map((group) => (
                                <Card key={group.name} className="border border-divider">
                                    <CardBody className="p-3 space-y-2">
                                        <p className="text-xs font-bold text-foreground/50 uppercase">{group.name} Fixtures</p>
                                        {group.matches.map((m, i) => {
                                            const isYou = m.home === "NeymarSkillz" || m.away === "NeymarSkillz";
                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex items-center p-2.5 rounded-xl transition-colors ${m.done ? "bg-success/5" :
                                                        isYou ? "bg-primary/5 border border-primary/20" :
                                                            "bg-foreground/5"
                                                        }`}
                                                >
                                                    <span className={`text-sm font-medium flex-1 text-center ${m.home === "NeymarSkillz" ? "text-primary" : ""}`}>
                                                        {m.home}
                                                    </span>
                                                    <span className={`mx-3 px-3 py-0.5 rounded-lg text-sm font-bold ${m.done ? "bg-success/10 text-success" : "bg-foreground/10 text-foreground/40"
                                                        }`}>
                                                        {m.score}
                                                    </span>
                                                    <span className={`text-sm font-medium flex-1 text-center ${m.away === "NeymarSkillz" ? "text-primary" : ""}`}>
                                                        {m.away}
                                                    </span>
                                                    <div className="ml-2 shrink-0">
                                                        {m.done ? (
                                                            <button
                                                                className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors"
                                                                onClick={() => viewResult(m.home, m.away, m.score)}
                                                            >
                                                                <Eye className="h-4 w-4 text-foreground/40" />
                                                            </button>
                                                        ) : isYou ? (
                                                            <Chip size="sm" variant="flat" color="primary" className="text-[10px]">Upcoming</Chip>
                                                        ) : (
                                                            <div className="w-7 h-7" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </CardBody>
                                </Card>
                            ))}
                        </div>

                        {/* Seeding Explanation */}
                        <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 text-xs space-y-1">
                            <p className="font-bold text-warning">Cross-Group Seeding (FIFA World Cup Style)</p>
                            <div className="grid grid-cols-2 gap-1 text-foreground/60">
                                <p>A1 <span className="text-foreground/30">(KingMessi10)</span> vs B2 <span className="text-foreground/30">(NeymarSkillz)</span></p>
                                <p>B1 <span className="text-foreground/30">(HaalandBeast)</span> vs A2 <span className="text-foreground/30">(MbappeSpeed)</span></p>
                            </div>
                        </div>

                        {/* Knockout Bracket */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold">Knockout Stage</h2>
                            <MyBracketMatch
                                rounds={GK_KNOCKOUT_ROUNDS}
                                currentPlayerId={CURRENT_PLAYER_ID}
                                onSubmitResult={(id) => openSubmit(id)}
                                onConfirmResult={() => {}}
                                onDispute={() => {}}
                            />
                            <BracketView
                                rounds={GK_KNOCKOUT_ROUNDS}
                                totalRounds={2}
                                currentPlayerId={CURRENT_PLAYER_ID}
                                onSubmitResult={(id) => openSubmit(id)}
                                onConfirmResult={() => {}}
                                onDispute={() => {}}
                                onViewResult={(id) => viewBracketResult(id)}
                            />
                        </div>
                    </div>
                )}

                {/* Status Legend */}
                <div className="p-4 rounded-2xl bg-foreground/5 border border-divider space-y-3">
                    <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Status Legend</p>
                    <div className="flex flex-wrap gap-3">
                        <Chip size="sm" variant="flat" color="default">⏳ Pending</Chip>
                        <Chip size="sm" variant="flat" color="warning">⏰ Awaiting Confirm</Chip>
                        <Chip size="sm" variant="flat" color="danger">⚠️ Disputed</Chip>
                        <Chip size="sm" variant="flat" color="success">✅ Confirmed</Chip>
                        <Chip size="sm" variant="flat" color="secondary">— Bye</Chip>
                    </div>
                </div>

                {selectedMatch && (
                    <SubmitResultModal
                        matchId={selectedMatch.id}
                        isOpen={!!selectedMatch}
                        onClose={() => setSelectedMatch(null)}
                        player1Id={selectedMatch.player1Id}
                        player1Name={selectedMatch.player1Name}
                        player1Avatar={selectedMatch.player1Avatar}
                        player2Name={selectedMatch.player2Name}
                        player2Avatar={selectedMatch.player2Avatar}
                        currentPlayerId={CURRENT_PLAYER_ID}
                    />
                )}

                {/* Match Result Modal */}
                <Modal isOpen={!!viewingResult} onClose={() => setViewingResult(null)} placement="center" size="sm">
                    <ModalContent>
                        {viewingResult && (
                            <>
                                <ModalHeader className="flex items-center gap-2 pb-1">
                                    <CheckCircle className="h-4 w-4 text-success" />
                                    Match Result
                                </ModalHeader>
                                <ModalBody className="pb-6">
                                    <div className="flex items-center justify-center gap-4 py-4">
                                        <div className="text-center flex-1">
                                            <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center mx-auto text-lg font-bold">
                                                {viewingResult.home.charAt(0)}
                                            </div>
                                            <p className={`mt-2 text-sm font-semibold ${viewingResult.winner === viewingResult.home ? "text-success" : ""}`}>
                                                {viewingResult.home}
                                            </p>
                                            {viewingResult.winner === viewingResult.home && (
                                                <Chip size="sm" color="success" variant="flat" className="mt-1">Winner</Chip>
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <p className="text-3xl font-black tracking-wider">{viewingResult.score}</p>
                                            <p className="text-[10px] text-foreground/40 mt-1">FINAL</p>
                                        </div>
                                        <div className="text-center flex-1">
                                            <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center mx-auto text-lg font-bold">
                                                {viewingResult.away.charAt(0)}
                                            </div>
                                            <p className={`mt-2 text-sm font-semibold ${viewingResult.winner === viewingResult.away ? "text-success" : ""}`}>
                                                {viewingResult.away}
                                            </p>
                                            {viewingResult.winner === viewingResult.away && (
                                                <Chip size="sm" color="success" variant="flat" className="mt-1">Winner</Chip>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-foreground/40 justify-center">
                                        <CheckCircle className="h-3 w-3 text-success" />
                                        Result confirmed by both players
                                    </div>
                                </ModalBody>
                            </>
                        )}
                    </ModalContent>
                </Modal>
            </div>
        </div>
    );
}
