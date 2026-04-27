import { getRequestPrisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getAuthEmail, getAuthName, getAuthImage, userWhereEmail } from "@/lib/auth";
import { type NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { GAME } from "@/lib/game-config";
import { checkPlayerForDuplicates } from "@/lib/duplicate-check";

/**
 * POST /api/onboarding
 * Creates or updates the user's player profile during onboarding.
 * Auto-creates the DB User record for new Clerk users.
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthEmail();
        if (!userId) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const body = await request.json();
        const { displayName, uid, referralCode, phoneNumber } = body as {
            displayName?: string;
            uid?: string;
            referralCode?: string;
            phoneNumber?: string;
        };

        const requiresPhone = !GAME.features.hasBR; // PES only

        // Find user
        const db = await getRequestPrisma();
        let user = await db.user.findFirst({
            where: userWhereEmail(userId),
            include: { player: true },
        });

        // ── Phone-only update for existing PES players ──────────────────
        // Called when addPhone=1 param is set (existing user missing phone)
        if (user?.isOnboarded && user.player && requiresPhone) {
            const cleaned = phoneNumber?.replace(/\D/g, "") ?? "";
            if (!cleaned || cleaned.length < 10) {
                return ErrorResponse({ message: "Enter a valid 10-digit phone number", status: 400 });
            }
            await db.player.update({
                where: { id: user.player.id },
                data: { phoneNumber: `+91${cleaned.slice(-10)}` },
            });
            return SuccessResponse({ message: "Phone number saved" });
        }

        // ── Full onboarding ─────────────────────────────────────────────
        if (!displayName?.trim() || displayName.trim().length < 3) {
            return ErrorResponse({
                message: "Display name must be at least 3 characters",
                status: 400,
            });
        }

        // Phone is required for PES
        if (requiresPhone) {
            const cleaned = phoneNumber?.replace(/\D/g, "") ?? "";
            if (!cleaned || cleaned.length < 10) {
                return ErrorResponse({ message: "Enter a valid 10-digit phone number", status: 400 });
            }
        }

        // Grab real name from auth session (Google display name)
        const authRealName = await getAuthName();

        // Find or create the user
        if (!user) {
            // New user — create DB record using NextAuth session data
            const image = await getAuthImage();

            const username =
                (authRealName || "user")
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "") +
                Math.floor(Math.random() * 9000 + 1000);

            user = await db.user.create({
                data: {
                    clerkId: `google_${Date.now()}`, // placeholder for backward compat
                    username,
                    email: userId!,
                    imageUrl: image || null,
                },
                include: { player: true },
            });
        }

        if (user.isOnboarded && user.player) {
            return SuccessResponse({
                data: { playerId: user.player.id },
                message: "Already onboarded",
            });
        }

        // Create player + wallet + streak in a transaction
        const result = await db.$transaction(async (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => {
            // Create player if doesn't exist
            let player = user.player;

            if (!player) {
                player = await tx.player.create({
                    data: {
                        userId: user.id,
                        displayName: (displayName ?? "").trim(),
                        realName: authRealName || null,
                        ...(uid?.trim() && { uid: uid.trim() }),
                        ...(requiresPhone && phoneNumber && {
                            phoneNumber: `+91${phoneNumber.replace(/\D/g, "").slice(-10)}`,
                        }),
                    },
                });

                // Create wallet
                await tx.wallet.create({
                    data: {
                        playerId: player.id,
                    },
                });

                // Create streak tracker
                await tx.playerStreak.create({
                    data: {
                        playerId: player.id,
                    },
                });

                // Create referral record if referrals enabled and valid code provided
                const settings = await getSettings();
                if (settings.enableReferrals && referralCode) {
                    const promoter = await tx.user.findFirst({
                        where: { username: referralCode },
                    });
                    // Only create if promoter exists and isn't self-referring
                    if (promoter && promoter.id !== user.id) {
                        await tx.referral.create({
                            data: {
                                promoterId: promoter.id,
                                referredPlayerId: player.id,
                            },
                        });
                    }
                }
            } else {
                // Update display name
                player = await tx.player.update({
                    where: { id: player.id },
                    data: { displayName: displayName.trim() },
                });
            }

            // Mark user as onboarded
            await tx.user.update({
                where: { id: user.id },
                data: { isOnboarded: true },
            });

            return player;
        });

        // Silent duplicate check — fire and forget, never blocks onboarding
        checkPlayerForDuplicates(result.id, db).catch(() => {});

        return SuccessResponse({
            data: { playerId: result.id },
            message: "Onboarding complete",
        });
    } catch (error) {
        return ErrorResponse({ message: "Onboarding failed", error });
    }
}
