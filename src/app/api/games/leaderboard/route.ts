import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";

const DIFFICULTY = "hard"; // Single mode — everyone plays the same
const MIN_MOVES = 10;     // Can't finish with fewer than 10 moves (10 pairs)
const MIN_TIME = 10;      // Can't finish in under 10 seconds realistically

/**
 * GET /api/games/leaderboard
 * Returns top 10 scores (single global leaderboard)
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "1";

    const scores = await prisma.gameScore.findMany({
        where: { difficulty: DIFFICULTY },
        orderBy: { score: "desc" },
        ...(showAll ? {} : { take: 50 }), // fetch extra to filter below
        include: {
            player: {
                select: {
                    displayName: true,
                    customProfileImageUrl: true,
                    user: { select: { username: true, imageUrl: true } },
                },
            },
        },
    });

    // Fetch all thresholds for players on the leaderboard
    const playerIds = scores.map(s => s.playerId);
    const thresholds = await prisma.gameScoreThreshold.findMany({
        where: { playerId: { in: playerIds }, gameType: "memory" },
    });
    const thresholdMap = new Map(thresholds.map(t => [t.playerId, t.threshold]));

    // Mark blocked entries (below threshold) — they still show but don't count for ranking
    let eligibleRank = 0;
    const rankedScores = scores.map(s => {
        const minScore = thresholdMap.get(s.playerId);
        const isBlocked = !!minScore && s.score < minScore;
        if (!isBlocked) eligibleRank++;
        return {
            rank: isBlocked ? null : eligibleRank,
            score: s.score,
            displayName: s.player.displayName || s.player.user.username,
            imageUrl: s.player.customProfileImageUrl || s.player.user.imageUrl,
            playerId: s.playerId,
            blocked: isBlocked,
        };
    });

    // For public view: take enough entries to fill 10 eligible + any blocked mixed in
    let finalScores = rankedScores;
    if (!showAll) {
        const result: typeof rankedScores = [];
        let eligibleCount = 0;
        for (const entry of rankedScores) {
            if (eligibleCount >= 10 && !entry.blocked) break;
            result.push(entry);
            if (!entry.blocked) eligibleCount++;
        }
        finalScores = result;
    }

    // Get reward config
    const rewardSettings = await prisma.appSetting.findMany({
        where: { key: { startsWith: "game_reward_" } },
    });

    const rewards: Record<string, number> = {};
    for (const s of rewardSettings) {
        rewards[s.key.replace("game_reward_", "")] = parseInt(s.value) || 0;
    }

    // Get current user's personal best + threshold (if logged in)
    let myBest = 0;
    let myThreshold = 0;
    try {
        const email = await getAuthEmail();
        if (email) {
            const user = await prisma.user.findFirst({
                where: userWhereEmail(email),
                select: { player: { select: { id: true } } },
            });
            if (user?.player) {
                const myScore = await prisma.gameScore.findUnique({
                    where: { playerId_difficulty: { playerId: user.player.id, difficulty: DIFFICULTY } },
                    select: { score: true },
                });
                myBest = myScore?.score ?? 0;

                const myThresholdRecord = await prisma.gameScoreThreshold.findUnique({
                    where: { playerId_gameType: { playerId: user.player.id, gameType: "memory" } },
                });
                myThreshold = myThresholdRecord?.threshold ?? 0;
            }
        }
    } catch { /* guest user — no best */ }

    // Get reward end date from settings
    const endDateSetting = await prisma.appConfig.findUnique({
        where: { key: "app_settings" },
    });
    let gameRewardEndDate = "";
    if (endDateSetting) {
        try {
            const parsed = JSON.parse(endDateSetting.value);
            gameRewardEndDate = parsed.gameRewardEndDate || "";
        } catch { /* ignore */ }
    }

    return NextResponse.json({
        scores: finalScores,
        rewards,
        myBest,
        myThreshold,
        gameRewardEndDate,
    });
}

/**
 * POST /api/games/leaderboard
 * Submit a score. Validates server-side, only saves if new personal best.
 * Body: { score, moves, time }
 */
export async function POST(req: Request) {
    const email = await getAuthEmail();
    if (!email) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
        where: userWhereEmail(email),
        select: { player: { select: { id: true } } },
    });

    if (!user?.player) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const playerId = user.player.id;
    const body = await req.json();
    const { score, moves, time } = body;

    if (score == null || moves == null || time == null) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // ── Anti-abuse validation ──
    // 1. Verify score matches formula
    const expectedScore = Math.max(0, 1000 - (moves * 10) - time);
    if (score !== expectedScore) {
        return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    // 2. Minimum moves (can't match 10 pairs in fewer than 10 moves)
    if (moves < MIN_MOVES) {
        return NextResponse.json({ error: "Invalid moves" }, { status: 400 });
    }

    // 3. Minimum time (can't physically click 20 cards in under 10s)
    if (time < MIN_TIME) {
        return NextResponse.json({ error: "Invalid time" }, { status: 400 });
    }

    // 4. Score must be positive
    if (score <= 0) {
        return NextResponse.json({ error: "Score too low" }, { status: 400 });
    }

    // Check if player has a threshold from a previous win
    const thresholdRecord = await prisma.gameScoreThreshold.findUnique({
        where: { playerId_gameType: { playerId, gameType: "memory" } },
    });

    if (thresholdRecord && score < thresholdRecord.threshold) {
        // Score below threshold — don't save to leaderboard
        return NextResponse.json({ saved: false, isNewBest: false, blocked: true, threshold: thresholdRecord.threshold });
    }

    // Only save if new personal best
    const existing = await prisma.gameScore.findUnique({
        where: { playerId_difficulty: { playerId, difficulty: DIFFICULTY } },
    });

    if (!existing || score > existing.score) {
        await prisma.gameScore.upsert({
            where: { playerId_difficulty: { playerId, difficulty: DIFFICULTY } },
            create: { playerId, difficulty: DIFFICULTY, score, moves, time },
            update: { score, moves, time },
        });

        return NextResponse.json({ saved: true, isNewBest: true });
    }

    return NextResponse.json({ saved: false, isNewBest: false });
}
