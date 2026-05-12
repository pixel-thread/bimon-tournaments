"use client";

import { useRef, useLayoutEffect } from "react";
import { Trophy } from "lucide-react";
import { GAME } from "@/lib/game-config";
import { CompactMatch, MatchRow, MyBracketMatch, BracketMatchData, RoundData, usePinchZoom, ZoomControls } from "./bracket-shared";

export type { BracketMatchData, RoundData };
export { MyBracketMatch };

/* ─── Entry point ───────────────────────────────────────────── */
interface BracketViewProps {
    rounds: RoundData[];
    totalRounds: number;
    currentPlayerId?: string;
    isAdmin?: boolean;
    winner?: { displayName: string | null } | null;
    maxPlacements?: number;
    onSubmitResult?: (id: string) => void;
    onConfirmResult?: (id: string) => void;
    onDispute?: (id: string) => void;
    onViewResult?: (id: string) => void;
}

export function BracketView({ rounds, totalRounds, currentPlayerId, isAdmin, winner, maxPlacements, onSubmitResult, onConfirmResult, onDispute, onViewResult }: BracketViewProps) {
    if (rounds.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Trophy className="h-10 w-10 text-foreground/20" />
                <p className="text-foreground/50 text-sm">Bracket not generated yet</p>
            </div>
        );
    }
    const positive = rounds.filter(r => r.round > 0).sort((a, b) => a.round - b.round);
    // A league has roughly equal match counts per round; knockout halves each round
    const isLeague = positive.length > 1
        && positive[0].matches.length > 1
        && rounds.every(r => r.round > 0)
        && positive.every(r => r.matches.length === positive[0].matches.length);
    if (isLeague) {
        return <LeagueView rounds={positive} currentPlayerId={currentPlayerId} isAdmin={isAdmin}
            onSubmitResult={onSubmitResult} onConfirmResult={onConfirmResult} onDispute={onDispute} onViewResult={onViewResult} />;
    }
    return <KOBracket rounds={rounds} currentPlayerId={currentPlayerId} isAdmin={isAdmin} winner={winner} maxPlacements={maxPlacements} onViewResult={onViewResult} />;
}

/* ─── KO Bracket ────────────────────────────────────────────── */
const MATCH_W = 200;
const MATCH_H = 63;  // 2×30px rows + 1px divider + 2px for accent bar
const ROW_GAP = 28;
const COL_GAP = 48;
const LABEL_H = 28;
const CURVE_R = 8;   // corner radius for connector curves

export function KOBracket({ rounds, currentPlayerId, isAdmin, winner: propWinner, maxPlacements = 3, onViewResult }: { rounds: RoundData[]; currentPlayerId?: string; isAdmin?: boolean; winner?: { displayName: string | null } | null; maxPlacements?: number; onViewResult?: (id: string) => void }) {
    const { zoom, zoomIn, zoomOut, reset, containerRef: scrollRef } = usePinchZoom();
    const outerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const svgGroupRef = useRef<SVGGElement>(null);
    const cardRefs = useRef<Record<string, HTMLDivElement>>({});

    /* 3rd place */
    const thirdPlace = rounds.at(-1)?.matches.find(m => m.position === 1) ?? null;
    const bRounds = rounds.map((r, ri) =>
        ri === rounds.length - 1 && thirdPlace
            ? { ...r, name: "Final", matches: r.matches.filter(m => m.position !== 1) }
            : r
    );
    const N = bRounds.length;

    /* Geometry */
    const spacing = (ri: number) => (MATCH_H + ROW_GAP) * Math.pow(2, ri);
    const padTop = (ri: number) => ri === 0 ? 0 : (spacing(ri) - MATCH_H - ROW_GAP) / 2;
    const itemGap = (ri: number) => spacing(ri) - MATCH_H;
    const colLeft = (ri: number) => ri * (MATCH_W + COL_GAP);

    /* Draw smooth SVG connectors */
    useLayoutEffect(() => {
        const g = svgGroupRef.current;
        const wrapper = wrapperRef.current;
        if (!g || !wrapper || N === 0) return;

        while (g.firstChild) g.removeChild(g.firstChild);

        const wr = wrapper.getBoundingClientRect();
        const px = (sx: number) => (sx - wr.left) / zoom;
        const py = (sy: number) => (sy - wr.top) / zoom;

        const path = (d: string, color: string, op: number) => {
            const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
            el.setAttribute("d", d);
            el.setAttribute("fill", "none");
            el.setAttribute("stroke", color);
            el.setAttribute("stroke-width", "1.5");
            el.setAttribute("stroke-opacity", `${op}`);
            el.setAttribute("stroke-linecap", "round");
            g.appendChild(el);
        };

        for (let ri = 0; ri < N - 1; ri++) {
            const cur = bRounds[ri];
            const nxt = bRounds[ri + 1];
            if (!nxt) continue;

            for (let p = 0; p < Math.ceil(cur.matches.length / 2); p++) {
                const m1 = cur.matches[p * 2];
                const m2 = cur.matches[p * 2 + 1] ?? null;
                const mN = nxt.matches[p];
                if (!mN) continue;

                const e1 = cardRefs.current[m1.id];
                const eN = cardRefs.current[mN.id];
                if (!e1 || !eN) continue;

                const r1 = e1.getBoundingClientRect();
                const rN = eN.getBoundingClientRect();
                const x1 = px(r1.right);
                const y1 = py(r1.top + r1.height / 2);
                const x2 = px(rN.left);
                const y2 = py(rN.top + rN.height / 2);
                const midX = (x1 + x2) / 2;

                // Per-match arm colors
                const armColor = (m: typeof m1) => {
                    if (m.status === "DISPUTED") return { color: "#ef4444", op: 0.6 };
                    if (m.status === "CONFIRMED" || m.status === "BYE") return { color: "#22c55e", op: 0.6 };
                    if (m.status === "SUBMITTED") return { color: "#f59e0b", op: 0.6 };
                    return { color: "#94a3b8", op: 0.4 };
                };


                if (m2) {
                    const e2 = cardRefs.current[m2.id];
                    if (e2) {
                        const r2 = e2.getBoundingClientRect();
                        const y1b = py(r2.top + r2.height / 2);

                        const top = armColor(m1);
                        const bot = armColor(m2);

                        // Top match → horizontal → curve down into vertical
                        const r = Math.min(CURVE_R, Math.abs(y2 - y1) / 2);
                        path(`M${x1},${y1} L${midX - r},${y1} Q${midX},${y1} ${midX},${y1 + r}`, top.color, top.op);
                        // Vertical bar — split at midpoint (y2), top half = top color, bottom half = bot color
                        path(`M${midX},${y1 + r} L${midX},${y2}`, top.color, top.op);
                        path(`M${midX},${y2} L${midX},${y1b - r}`, bot.color, bot.op);
                        // Bottom match → horizontal → curve up into vertical
                        path(`M${x1},${y1b} L${midX - r},${y1b} Q${midX},${y1b} ${midX},${y1b - r}`, bot.color, bot.op);
                        // Center → next match — green if any player advanced (confirmed/bye)
                        const fwdColor = (top.color === "#22c55e" || bot.color === "#22c55e")
                            ? { color: "#22c55e", op: 0.6 }
                            : (top.color === "#f59e0b" || bot.color === "#f59e0b") ? { color: "#f59e0b", op: 0.6 }
                            : { color: "#94a3b8", op: 0.4 };
                        path(`M${midX},${y2} L${x2},${y2}`, fwdColor.color, fwdColor.op);
                    }
                } else {
                    const solo = armColor(m1);
                    path(`M${x1},${y1} L${x2},${y2}`, solo.color, solo.op);
                }
            }
        }
    });

    if (N === 0) return null;
    const n0 = bRounds[0].matches.length;
    const totalMatchH = n0 * MATCH_H + (n0 - 1) * ROW_GAP;
    const totalW = N * MATCH_W + (N - 1) * COL_GAP + 72;
    // Use passed-in winner prop first; fall back to reading from the final match's winnerId + player data
    const finalMatch = bRounds[N - 1]?.matches[0];
    const winner = propWinner ?? (finalMatch?.winnerId
        ? (finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player1 : finalMatch.player2)
        : null);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-end">
                <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} />
            </div>

            <div ref={scrollRef} className="overflow-x-auto pb-4">
                <div style={{ zoom, width: totalW }} className="relative" ref={outerRef}>

                    {/* Round labels */}
                    <div className="flex" style={{ height: LABEL_H, marginBottom: 6 }}>
                        {bRounds.map((r, ri) => (
                            <div key={`lbl-${ri}`} style={{ width: MATCH_W, marginRight: ri < N - 1 ? COL_GAP : 0, flexShrink: 0 }}
                                className="flex items-end justify-center pb-1">
                                <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.15em]">
                                    {r.name}
                                </span>
                            </div>
                        ))}
                        <div style={{ width: 72 }} />
                    </div>

                    {/* Match area */}
                    <div className="relative" ref={wrapperRef} style={{ height: totalMatchH, width: totalW }}>
                        <svg className="absolute inset-0 pointer-events-none"
                            style={{ width: "100%", height: "100%", overflow: "visible" }}>
                            <g ref={svgGroupRef} />
                        </svg>

                        {bRounds.map((r, ri) => (
                            <div key={r.round}
                                style={{ position: "absolute", left: colLeft(ri), top: padTop(ri), width: MATCH_W }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: itemGap(ri) }}>
                                    {r.matches.map(m => (
                                        <div key={m.id} ref={el => { if (el) cardRefs.current[m.id] = el; }}>
                                            <CompactMatch match={m} currentPlayerId={currentPlayerId} isAdmin={isAdmin} onViewResult={onViewResult} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Trophy / Champion */}
                        <div style={{ position: "absolute", left: colLeft(N), top: padTop(N - 1) + MATCH_H / 2 - (winner ? 44 : 26), width: 72 }}
                            className="flex flex-col items-center gap-1.5 pl-2">
                            {winner ? (
                                /* Champion card — golden glow */
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-lg scale-150" />
                                        <div className="relative p-2.5 rounded-full bg-gradient-to-b from-yellow-400/25 to-yellow-600/15 border border-yellow-400/30">
                                            <Trophy className="h-5 w-5 text-yellow-400 drop-shadow-sm" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[7px] text-yellow-400/50 uppercase font-bold tracking-[0.15em] leading-none">Champion</p>
                                        <p className="text-[9px] font-bold text-yellow-400 leading-tight mt-0.5 max-w-[68px] truncate">
                                            {winner.displayName}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                /* Pending — muted */
                                <>
                                    <div className="p-2 rounded-full bg-foreground/5">
                                        <Trophy className="h-5 w-5 text-foreground/15" />
                                    </div>
                                    <p className="text-[8px] font-semibold text-foreground/20 text-center leading-tight">TBD</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3rd place — only when tournament allows it (maxPlacements >= 3) */}
            {thirdPlace && maxPlacements >= 3 && (
                <div className="max-w-[200px]">
                    <p className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.15em] mb-2">🥉 3rd Place</p>
                    <div ref={el => { if (el) cardRefs.current[thirdPlace.id] = el; }}>
                        <CompactMatch match={thirdPlace} currentPlayerId={currentPlayerId} isAdmin={isAdmin} onViewResult={onViewResult} />
                    </div>
                </div>
            )}

            {/* Branding */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
                <div className="h-px w-6 bg-foreground/10" />
                <span className="text-foreground/25 font-medium">{GAME.name} × Bimon Tournament</span>
                <div className="h-px w-6 bg-foreground/10" />
            </div>
        </div>
    );
}

/* ─── League View ───────────────────────────────────────────── */
function LeagueView({ rounds, currentPlayerId, isAdmin, onSubmitResult, onConfirmResult, onDispute, onViewResult }: {
    rounds: RoundData[]; currentPlayerId?: string; isAdmin?: boolean;
    onSubmitResult?: (id: string) => void; onConfirmResult?: (id: string) => void;
    onDispute?: (id: string) => void; onViewResult?: (id: string) => void;
}) {
    return (
        <div className="space-y-4">
            {rounds.map(round => {
                const confirmed = round.matches.filter(m => m.status === "CONFIRMED").length;
                const total = round.matches.filter(m => m.player1Id && m.player2Id).length;
                const allDone = confirmed === total && total > 0;
                return (
                    <div key={round.round} className="rounded-2xl border border-divider overflow-hidden">
                        <div className={`px-4 py-2.5 flex items-center justify-between ${allDone ? "bg-success/10" : "bg-default-50/60"}`}>
                            <span className="text-sm font-bold">{round.name}</span>
                            <span className={`text-[11px] font-medium ${allDone ? "text-success-600" : "text-foreground/40"}`}>{confirmed}/{total} done</span>
                        </div>
                        <div className="p-3 space-y-1.5">
                            {round.matches.filter(m => m.player1Id && m.player2Id).map(m => (
                                <MatchRow key={m.id} match={m} currentPlayerId={currentPlayerId} isAdmin={isAdmin}
                                    onSubmitResult={onSubmitResult} onConfirmResult={onConfirmResult}
                                    onDispute={onDispute} onViewResult={onViewResult} />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Branding */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
                <div className="h-px w-6 bg-foreground/10" />
                <span className="text-foreground/25 font-medium">{GAME.name} × Bimon Tournament</span>
                <div className="h-px w-6 bg-foreground/10" />
            </div>
        </div>
    );
}
