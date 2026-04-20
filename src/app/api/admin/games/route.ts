import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { requireAdmin } from "@/lib/auth";

const DIFFICULTY = "hard";

/**
 * GET /api/admin/games — Get reward settings + score count
 */
export async function GET() {
    await requireAdmin();

    const settings = await prisma.appSetting.findMany({
        where: { key: { startsWith: "game_reward_" } },
    });

    const rewards: Record<string, number> = {};
    for (const s of settings) {
        rewards[s.key.replace("game_reward_", "")] = parseInt(s.value) || 0;
    }

    const scoreCount = await prisma.gameScore.count({ where: { difficulty: DIFFICULTY } });

    return NextResponse.json({ rewards, scoreCount });
}

/**
 * POST /api/admin/games — updateRewards, resetScores, distributeRewards
 */
export async function POST(req: Request) {
    await requireAdmin();

    const body = await req.json();
    const { action } = body;

    if (action === "updateRewards") {
        const { rewards } = body as { rewards: Record<string, number> };
        for (const [position, amount] of Object.entries(rewards)) {
            await prisma.appSetting.upsert({
                where: { key: `game_reward_${position}` },
                create: { key: `game_reward_${position}`, value: String(amount) },
                update: { value: String(amount) },
            });
        }
        return NextResponse.json({ success: true });
    }

    if (action === "resetScores") {
        await prisma.gameScore.deleteMany({ where: { difficulty: DIFFICULTY } });
        return NextResponse.json({ success: true });
    }

    if (action === "distributeRewards") {
        const settings = await prisma.appSetting.findMany({
            where: { key: { startsWith: "game_reward_" } },
        });
        const rewards: Record<number, number> = {};
        for (const s of settings) {
            const pos = parseInt(s.key.replace("game_reward_", ""));
            rewards[pos] = parseInt(s.value) || 0;
        }

        const topScores = await prisma.gameScore.findMany({
            where: { difficulty: DIFFICULTY },
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
                    description: `Memory Game reward (#${i + 1})`,
                },
            });

            // Set 2% threshold for next round — player must beat this to reappear
            const newThreshold = Math.ceil(score.score * 1.02);
            await prisma.gameScoreThreshold.upsert({
                where: { playerId_gameType: { playerId: score.playerId, gameType: "memory" } },
                create: {
                    playerId: score.playerId,
                    gameType: "memory",
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
