import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getCategoryFromKDValue, getCategoryFromWinRate } from "@/lib/logic/categoryUtils";
import { requireAdmin } from "@/lib/auth";
import { getBalance, getDiamondBalance } from "@/lib/wallet-service";
import { GAME } from "@/lib/game-config";
import { censorProfanity } from "@/lib/logic/profanityFilter";

const VALID_CATEGORIES = ["BOT", "ULTRA_NOOB", "NOOB", "PRO", "ULTRA_PRO", "LEGEND"] as const;

/**
 * GET /api/players/[id]
 * Fetch full player details for admin modal.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const player = await prisma.player.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        username: true,
                        email: true,
                        secondaryEmail: true,
                        imageUrl: true,
                    },
                },
                wallet: {
                    select: { balance: true, diamondBalance: true },
                },
                streak: {
                    select: {
                        current: true,
                        longest: true,
                    },
                },
                ban: {
                    select: {
                        banReason: true,
                        bannedAt: true,
                        banDuration: true,
                    },
                },
            },
        });

        if (!player) {
            return NextResponse.json(
                { error: "Player not found" },
                { status: 404 }
            );
        }

        // Compute stats from TeamPlayerStats (source of truth)
        const statsAgg = await prisma.teamPlayerStats.aggregate({
            where: { playerId: id, present: true },
            _count: { matchId: true },
            _sum: { kills: true },
        });
        const totalMatches = statsAgg._count.matchId;
        const totalKills = statsAgg._sum.kills ?? 0;
        const totalKd = totalMatches > 0 ? totalKills / totalMatches : 0;
        // Bracket wins/losses for PES
        let bracketWins = 0;
        let bracketPlayed = 0;
        if (GAME.scoringSystem === "bracket") {
            const [winsAgg, playedAgg] = await Promise.all([
                prisma.bracketMatch.count({
                    where: { winnerId: id, status: "CONFIRMED" },
                }),
                prisma.bracketMatch.count({
                    where: {
                        status: "CONFIRMED",
                        OR: [{ player1Id: id }, { player2Id: id }],
                    },
                }),
            ]);
            bracketWins = winsAgg;
            bracketPlayed = playedAgg;
        }

        const isBracketGame = GAME.scoringSystem === "bracket";
        const category = isBracketGame
            ? getCategoryFromWinRate(bracketWins, bracketPlayed)
            : getCategoryFromKDValue(totalKd);

        return NextResponse.json({
            id: player.id,
            displayName: player.displayName,
            realName: player.realName || null,
            username: player.user.username,
            email: player.user.email,
            secondaryEmail: player.user.secondaryEmail,
            imageUrl: player.customProfileImageUrl || player.user.imageUrl,
            category,
            isBanned: player.isBanned,
            hasRoyalPass: player.hasRoyalPass,
            isUCExempt: player.isUCExempt,
            isTrusted: player.isTrusted,
            uid: player.uid || null,
            phoneNumber: player.phoneNumber || null,
            bio: censorProfanity(player.bio || ""),
            createdAt: player.createdAt,
            balance: player.user.email ? await getBalance(player.user.email) : 0,
            diamondBalance: player.wallet?.diamondBalance ?? 0,
            stats: {
                kills: totalKills,
                matches: totalMatches,
                kd: Number(totalKd.toFixed(2)),
            },
            streak: player.streak
                ? { current: player.streak.current, longest: player.streak.longest }
                : { current: 0, longest: 0 },
            ban: player.ban
                ? {
                    reason: player.ban.banReason,
                    bannedAt: player.ban.bannedAt,
                    duration: player.ban.banDuration,
                }
                : null,
        });
    } catch (error) {
        console.error("Failed to fetch player:", error);
        return NextResponse.json(
            { error: "Failed to fetch player" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/players/[id]
 * Update player fields (e.g., category override).
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();

        const updateData: Record<string, unknown> = {};

        // Category override
        if (body.category) {
            if (!VALID_CATEGORIES.includes(body.category)) {
                return NextResponse.json(
                    { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
                    { status: 400 }
                );
            }
            updateData.category = body.category;
        }

        // Boolean toggles
        if (typeof body.isTrusted === "boolean") {
            updateData.isTrusted = body.isTrusted;
        }
        if (typeof body.isUCExempt === "boolean") {
            updateData.isUCExempt = body.isUCExempt;
        }

        // Display name rename
        if (typeof body.displayName === "string") {
            const trimmed = body.displayName.trim();
            if (trimmed.length < 2 || trimmed.length > 20) {
                return NextResponse.json(
                    { error: "Display name must be 2-20 characters" },
                    { status: 400 }
                );
            }
            updateData.displayName = censorProfanity(trimmed);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const updated = await prisma.player.update({
            where: { id },
            data: updateData,
            select: { id: true, displayName: true, category: true, isTrusted: true, isUCExempt: true, discordId: true },
        });

        // Auto-grant/revoke Discord UC Exempt role
        if (typeof body.isUCExempt === "boolean" && updated.discordId) {
            const ucExemptRoleId = process.env.DISCORD_UC_EXEMPT_ROLE_ID;
            if (ucExemptRoleId) {
                try {
                    const { grantRole, revokeRole } = await import("@/lib/discord-service");
                    if (body.isUCExempt) {
                        await grantRole(updated.discordId, ucExemptRoleId);
                    } else {
                        await revokeRole(updated.discordId, ucExemptRoleId);
                    }
                } catch (err) {
                    console.error("[UC Exempt] Discord role update failed:", err);
                }
            }
        }

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Failed to update player:", error);
        return NextResponse.json(
            { error: "Failed to update player" },
            { status: 500 }
        );
    }
}
