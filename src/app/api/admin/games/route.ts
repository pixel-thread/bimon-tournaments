import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { requireAdmin } from "@/lib/auth";

/* ── Game type → DB difficulty key mapping ─────────────── */
const GAME_KEYS: Record<string, { difficulty: string; label: string }> = {
    memory: { difficulty: "hard", label: "Memory Game" },
    "number-rush": { difficulty: "number-rush", label: "Number Rush" },
};

function resolveGame(game: string | undefined) {
    return GAME_KEYS[game || "memory"] || null;
}

/**
 * GET /api/admin/games?game=memory|number-rush
 * Get per-game reward settings + score count
 */
export async function GET(req: Request) {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const gameKey = searchParams.get("game") || "memory";
    const gameConfig = resolveGame(gameKey);
    if (!gameConfig) return NextResponse.json({ error: "Unknown game" }, { status: 400 });

    const prefix = `game_reward_${gameKey}_`;
    const settings = await prisma.appSetting.findMany({
        where: { key: { startsWith: prefix } },
    });

    const rewards: Record<string, number> = {};
    for (const s of settings) {
        rewards[s.key.replace(prefix, "")] = parseInt(s.value) || 0;
    }

    const scoreCount = await prisma.gameScore.count({ where: { difficulty: gameConfig.difficulty } });

    // Get per-game end date
    const endDateSetting = await prisma.appSetting.findUnique({
        where: { key: `game_end_date_${gameKey}` },
    });

    // Get threshold percentage
    const thresholdSetting = await prisma.appSetting.findUnique({
        where: { key: `game_threshold_pct_${gameKey}` },
    });

    return NextResponse.json({
        rewards,
        scoreCount,
        endDate: endDateSetting?.value || "",
        thresholdPct: thresholdSetting ? parseInt(thresholdSetting.value) : 2,
    });
}

/**
 * POST /api/admin/games
 * Body: { game, action, ... }
 * Actions: updateRewards, resetScores, distributeRewards
 */
export async function POST(req: Request) {
    await requireAdmin();

    const body = await req.json();
    const { action, game: gameKey } = body;
    const gk = gameKey || "memory";
    const gameConfig = resolveGame(gk);
    if (!gameConfig) return NextResponse.json({ error: "Unknown game" }, { status: 400 });

    const prefix = `game_reward_${gk}_`;

    if (action === "updateRewards") {
        const { rewards, endDate, thresholdPct } = body as { rewards: Record<string, number>; endDate?: string; thresholdPct?: number };
        for (const [position, amount] of Object.entries(rewards)) {
            await prisma.appSetting.upsert({
                where: { key: `${prefix}${position}` },
                create: { key: `${prefix}${position}`, value: String(amount) },
                update: { value: String(amount) },
            });
        }
        // Save per-game end date
        if (endDate !== undefined) {
            await prisma.appSetting.upsert({
                where: { key: `game_end_date_${gk}` },
                create: { key: `game_end_date_${gk}`, value: endDate },
                update: { value: endDate },
            });
        }
        // Save threshold percentage
        if (thresholdPct !== undefined) {
            await prisma.appSetting.upsert({
                where: { key: `game_threshold_pct_${gk}` },
                create: { key: `game_threshold_pct_${gk}`, value: String(thresholdPct) },
                update: { value: String(thresholdPct) },
            });
        }
        return NextResponse.json({ success: true });
    }

    if (action === "resetScores") {
        await prisma.gameScore.deleteMany({ where: { difficulty: gameConfig.difficulty } });
        return NextResponse.json({ success: true });
    }

    if (action === "distributeRewards") {
        const settings = await prisma.appSetting.findMany({
            where: { key: { startsWith: prefix } },
        });
        const rewards: Record<number, number> = {};
        for (const s of settings) {
            const pos = parseInt(s.key.replace(prefix, ""));
            if (!isNaN(pos)) rewards[pos] = parseInt(s.value) || 0;
        }

        const topScores = await prisma.gameScore.findMany({
            where: { difficulty: gameConfig.difficulty },
            orderBy: { score: "desc" },
            take: Object.keys(rewards).length,
        });

        const distributed: { playerId: string; amount: number; position: number }[] = [];

        for (let i = 0; i < topScores.length; i++) {
            const amount = rewards[i + 1];
            if (!amount || amount <= 0) continue;

            const score = topScores[i];
            await prisma.wallet.update({
                where: { playerId: score.playerId },
                data: { balance: { increment: amount } },
            });
            await prisma.transaction.create({
                data: {
                    playerId: score.playerId,
                    amount,
                    type: "CREDIT",
                    description: `${gameConfig.label} reward (#${i + 1})`,
                },
            });

            // Read configurable threshold percentage (default 2%)
            const tSetting = await prisma.appSetting.findUnique({ where: { key: `game_threshold_pct_${gk}` } });
            const pct = tSetting ? parseInt(tSetting.value) : 2;
            const newThreshold = Math.ceil(score.score * (1 + pct / 100));
            await prisma.gameScoreThreshold.upsert({
                where: { playerId_gameType: { playerId: score.playerId, gameType: gk } },
                create: {
                    playerId: score.playerId,
                    gameType: gk,
                    threshold: newThreshold,
                    lastWinningScore: score.score,
                },
                update: {
                    threshold: newThreshold,
                    lastWinningScore: score.score,
                },
            });

            distributed.push({ playerId: score.playerId, amount, position: i + 1 });
        }

        return NextResponse.json({ success: true, distributed });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
