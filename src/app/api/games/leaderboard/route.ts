import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";

/* ── Game type → difficulty key mapping ─────────────────── */
const GAME_KEYS: Record<string, string> = {
    memory: "hard",
    "number-rush": "number-rush",
};

/* ── Per-game validation rules ──────────────────────────── */
const GAME_RULES: Record<string, {
    calcScore: (data: Record<string, number>) => number;
    validate: (data: Record<string, number>) => string | null;
}> = {
    memory: {
        calcScore: ({ moves, time }) => Math.max(0, 1000 - (moves * 10) - time),
        validate: ({ score, moves, time }) => {
            const expected = Math.max(0, 1000 - (moves * 10) - time);
            if (score !== expected) return "Invalid score";
            if (moves < 10) return "Invalid moves";
            if (time < 10) return "Invalid time";
            if (score <= 0) return "Score too low";
            return null;
        },
    },
    "number-rush": {
        calcScore: ({ time, penalties }) => Math.max(0, 1000 - Math.floor((time + (penalties * 2000)) / 100)),
        validate: ({ score, time, penalties }) => {
            const expected = Math.max(0, 1000 - Math.floor((time + (penalties * 2000)) / 100));
            if (score !== expected) return "Invalid score";
            if (time < 5000) return "Too fast"; // < 5 seconds impossible
            if (penalties < 0) return "Invalid penalties";
            if (score <= 0) return "Score too low";
            return null;
        },
    },
};

function resolveGame(gameParam: string | null): { key: string; difficulty: string } | null {
    const game = gameParam || "memory";
    const difficulty = GAME_KEYS[game];
    if (!difficulty) return null;
    return { key: game, difficulty };
}

/**
 * GET /api/games/leaderboard?game=memory|number-rush
 * Returns top scores for the specified game (defaults to memory)
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "1";
    const resolved = resolveGame(searchParams.get("game"));
    if (!resolved) return NextResponse.json({ error: "Unknown game" }, { status: 400 });

    const { key: gameType, difficulty } = resolved;

    const scores = await prisma.gameScore.findMany({
        where: { difficulty },
        orderBy: { score: "desc" },
        ...(showAll ? {} : { take: 50 }),
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

    // Fetch thresholds
    const playerIds = scores.map(s => s.playerId);
    const thresholds = await prisma.gameScoreThreshold.findMany({
        where: { playerId: { in: playerIds }, gameType },
    });
    const thresholdMap = new Map(thresholds.map(t => [t.playerId, t.threshold]));

    // Rank — blocked entries don't count
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

    // Public view: cap at 10 eligible
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

    // Reward config (per-game)
    const rewardPrefix = `game_reward_${gameType}_`;
    const rewardSettings = await prisma.appSetting.findMany({
        where: { key: { startsWith: rewardPrefix } },
    });
    const rewards: Record<string, number> = {};
    for (const s of rewardSettings) {
        rewards[s.key.replace(rewardPrefix, "")] = parseInt(s.value) || 0;
    }

    // Current user's personal best + threshold
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
                    where: { playerId_difficulty: { playerId: user.player.id, difficulty } },
                    select: { score: true },
                });
                myBest = myScore?.score ?? 0;

                const myThresholdRecord = await prisma.gameScoreThreshold.findUnique({
                    where: { playerId_gameType: { playerId: user.player.id, gameType } },
                });
                myThreshold = myThresholdRecord?.threshold ?? 0;
            }
        }
    } catch { /* guest user */ }

    // Per-game reward end date
    const endDateSetting = await prisma.appSetting.findUnique({
        where: { key: `game_end_date_${gameType}` },
    });
    const gameRewardEndDate = endDateSetting?.value || "";

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
 * Submit a score. Body: { game?, score, moves?, time, penalties? }
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
    const { game: gameParam, score, moves, time, penalties } = body;

    const resolved = resolveGame(gameParam || "memory");
    if (!resolved) return NextResponse.json({ error: "Unknown game" }, { status: 400 });

    const { key: gameType, difficulty } = resolved;
    const rules = GAME_RULES[gameType];
    if (!rules) return NextResponse.json({ error: "Unknown game rules" }, { status: 400 });

    if (score == null || time == null) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate with game-specific rules
    const error = rules.validate({ score, moves: moves ?? 0, time, penalties: penalties ?? 0 });
    if (error) {
        return NextResponse.json({ error }, { status: 400 });
    }

    // Check threshold
    const thresholdRecord = await prisma.gameScoreThreshold.findUnique({
        where: { playerId_gameType: { playerId, gameType } },
    });

    if (thresholdRecord && score < thresholdRecord.threshold) {
        return NextResponse.json({ saved: false, isNewBest: false, blocked: true, threshold: thresholdRecord.threshold });
    }

    // Only save if new personal best
    const existing = await prisma.gameScore.findUnique({
        where: { playerId_difficulty: { playerId, difficulty } },
    });

    if (!existing || score > existing.score) {
        await prisma.gameScore.upsert({
            where: { playerId_difficulty: { playerId, difficulty } },
            create: { playerId, difficulty, score, moves: moves ?? 0, time },
            update: { score, moves: moves ?? 0, time },
        });

        return NextResponse.json({ saved: true, isNewBest: true });
    }

    return NextResponse.json({ saved: false, isNewBest: false });
}
