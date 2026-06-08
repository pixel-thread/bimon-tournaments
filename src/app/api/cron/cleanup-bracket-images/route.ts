import { prisma } from "@/lib/database";
import { getAuthEmail, userWhereEmail } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { BRACKET_TYPES } from "@/lib/bracket-types";

/**
 * POST /api/cron/cleanup-bracket-images
 *
 * Two-part cleanup:
 *
 * 1) Cloudinary: Deletes bracket screenshot images for tournaments
 *    that are no longer visible (winner declared > 24h ago).
 *
 * 2) Discord: Purges messages older than 14 days from the standings
 *    channel to keep users' Discord app lightweight.
 *    Uses bulk-delete (up to 100 messages/batch, < 14 days old).
 *
 * Can be called by:
 *  - Vercel cron (add to vercel.json)
 *  - Admin manually
 */
export async function POST() {
    try {
        // Auth check — must be admin or cron secret
        const userId = await getAuthEmail();
        if (!userId) return ErrorResponse({ message: "Unauthorized", status: 401 });

        const user = await prisma.user.findFirst({
            where: userWhereEmail(userId),
            select: { role: true },
        });
        if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
            return ErrorResponse({ message: "Admin access required", status: 403 });
        }

        // ── Part 1: Cloudinary bracket image cleanup ─────────────────

        const DAY_MS = 24 * 60 * 60 * 1000;
        const cutoff = new Date(Date.now() - DAY_MS);

        const expiredTournaments = await prisma.tournament.findMany({
            where: {
                isWinnerDeclared: true,
                updatedAt: { lt: cutoff },
                type: { in: [...BRACKET_TYPES] },
            },
            select: { id: true, name: true },
        });

        let deletedFromCloud = 0;
        let dbRecordsCleared = 0;

        if (expiredTournaments.length > 0) {
            const tournamentIds = expiredTournaments.map(t => t.id);

            const resultsWithScreenshots = await prisma.bracketResult.findMany({
                where: {
                    bracketMatch: { tournamentId: { in: tournamentIds } },
                    screenshotUrl: { not: null },
                },
                select: { id: true, screenshotUrl: true },
            });

            const cloudinaryResults = resultsWithScreenshots.filter(
                r => r.screenshotUrl?.includes("res.cloudinary.com")
            );

            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
            const apiKey = process.env.CLOUDINARY_API_KEY;
            const apiSecret = process.env.CLOUDINARY_API_SECRET;

            if (cloudName && apiKey && apiSecret && cloudinaryResults.length > 0) {
                const publicIds = cloudinaryResults
                    .map(r => {
                        const url = r.screenshotUrl!;
                        const match = url.match(/\/upload\/(?:[^/]+\/)*(.+)\.\w+$/);
                        return match?.[1] ?? null;
                    })
                    .filter((id): id is string => id !== null);

                for (let i = 0; i < publicIds.length; i += 100) {
                    const batch = publicIds.slice(i, i + 100);
                    const timestamp = Math.floor(Date.now() / 1000);
                    const paramsStr = `public_ids=${batch.join(",")}&timestamp=${timestamp}`;

                    const encoder = new TextEncoder();
                    const data = encoder.encode(paramsStr + apiSecret);
                    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
                    const signature = Array.from(new Uint8Array(hashBuffer))
                        .map(b => b.toString(16).padStart(2, "0"))
                        .join("");

                    const formData = new FormData();
                    batch.forEach(id => formData.append("public_ids[]", id));
                    formData.append("timestamp", String(timestamp));
                    formData.append("api_key", apiKey);
                    formData.append("signature", signature);

                    const res = await fetch(
                        `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`,
                        { method: "DELETE", body: formData }
                    );

                    if (res.ok) {
                        const result = await res.json();
                        deletedFromCloud += Object.keys(result.deleted || {}).length;
                    }
                }
            }

            const allResultIds = resultsWithScreenshots.map(r => r.id);
            if (allResultIds.length > 0) {
                await prisma.bracketResult.updateMany({
                    where: { id: { in: allResultIds } },
                    data: { screenshotUrl: null },
                });
                dbRecordsCleared = allResultIds.length;
            }
        }

        // ── Part 2: Discord message cleanup (standings channel) ──────

        let discordDeleted = 0;
        const discordErrors: string[] = [];

        const token = process.env.DISCORD_BOT_TOKEN;
        const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
        const discordCutoff = Date.now() - FOURTEEN_DAYS_MS;

        // Channels to clean: standings + announcements (add more IDs as needed)
        const channelsToClean = [
            process.env.DISCORD_STANDINGS_CHANNEL_ID,
            // Add clips channel ID here if you have one:
            // process.env.DISCORD_CLIPS_CHANNEL_ID,
        ].filter(Boolean) as string[];

        if (token && channelsToClean.length > 0) {
            for (const channelId of channelsToClean) {
                try {
                    const deleted = await cleanDiscordChannel(token, channelId, discordCutoff);
                    discordDeleted += deleted;
                } catch (err) {
                    discordErrors.push(`Channel ${channelId}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }

        return SuccessResponse({
            message: [
                expiredTournaments.length > 0
                    ? `Cloudinary: ${expiredTournaments.length} tournament(s), ${deletedFromCloud} images deleted, ${dbRecordsCleared} DB records cleared`
                    : "Cloudinary: nothing to clean",
                discordDeleted > 0
                    ? `Discord: ${discordDeleted} old messages deleted`
                    : "Discord: no old messages found",
                ...(discordErrors.length > 0 ? [`Discord errors: ${discordErrors.join("; ")}`] : []),
            ].join(" | "),
            data: {
                tournaments: expiredTournaments.map(t => t.name),
                imagesDeleted: deletedFromCloud,
                dbRecordsCleared,
                discordMessagesDeleted: discordDeleted,
                discordErrors,
            },
        });
    } catch (error) {
        return ErrorResponse({ message: "Cleanup failed", error });
    }
}


// ── Discord channel cleanup helper ───────────────────────────────

/**
 * Deletes all messages in a Discord channel that are older than `cutoffMs`.
 * Uses bulk-delete for messages < 14 days old (Discord API requirement).
 * Returns the number of messages deleted.
 */
async function cleanDiscordChannel(
    botToken: string,
    channelId: string,
    cutoffMs: number,
): Promise<number> {
    const headers = {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
    };

    let totalDeleted = 0;
    let beforeId: string | undefined;
    let reachedEnd = false;

    // Discord snowflake → timestamp: (snowflake / 2^22) + 1420070400000
    const snowflakeToTimestamp = (id: string) =>
        Math.floor(Number(id) / 4194304) + 1420070400000;

    while (!reachedEnd) {
        // Fetch messages (max 100 per request)
        const url = new URL(`https://discord.com/api/v10/channels/${channelId}/messages`);
        url.searchParams.set("limit", "100");
        if (beforeId) url.searchParams.set("before", beforeId);

        const res = await fetch(url.toString(), { headers });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to fetch messages: ${res.status} ${err}`);
        }

        const messages: { id: string }[] = await res.json();
        if (messages.length === 0) {
            reachedEnd = true;
            break;
        }

        // Update cursor for next page
        beforeId = messages[messages.length - 1].id;

        // Filter messages older than cutoff
        const oldMessages = messages.filter(
            m => snowflakeToTimestamp(m.id) < cutoffMs
        );

        if (oldMessages.length === 0) {
            // All messages in this batch are still recent — keep paginating
            // But if the LAST message is already older than cutoff and none matched,
            // that means we've gone past the cutoff window
            const lastMsgTime = snowflakeToTimestamp(messages[messages.length - 1].id);
            if (lastMsgTime < cutoffMs) {
                reachedEnd = true;
            }
            continue;
        }

        // Discord bulk-delete only works for messages < 14 days old
        // Since our cutoff IS 14 days, all messages we find should qualify
        // But just in case, split into bulk-deletable and individual
        const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        const bulkDeletable = oldMessages.filter(
            m => now - snowflakeToTimestamp(m.id) < FOURTEEN_DAYS
        );
        const tooOld = oldMessages.filter(
            m => now - snowflakeToTimestamp(m.id) >= FOURTEEN_DAYS
        );

        // Bulk delete (2-100 messages at a time)
        if (bulkDeletable.length >= 2) {
            const bulkRes = await fetch(
                `https://discord.com/api/v10/channels/${channelId}/messages/bulk-delete`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ messages: bulkDeletable.map(m => m.id) }),
                }
            );
            if (bulkRes.ok) {
                totalDeleted += bulkDeletable.length;
            }
            // Rate limit: wait a bit between bulk operations
            await sleep(1100);
        } else if (bulkDeletable.length === 1) {
            // Can't bulk-delete a single message — delete individually
            tooOld.push(bulkDeletable[0]);
        }

        // Individual delete for messages > 14 days old (rate limited)
        for (const msg of tooOld) {
            const delRes = await fetch(
                `https://discord.com/api/v10/channels/${channelId}/messages/${msg.id}`,
                { method: "DELETE", headers }
            );
            if (delRes.ok) {
                totalDeleted++;
            }
            // Discord rate limit: ~5 deletes/sec, be safe with 1.2s
            await sleep(1200);
        }

        // If we got fewer than 100 messages, we've reached the end
        if (messages.length < 100) {
            reachedEnd = true;
        }
    }

    return totalDeleted;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
