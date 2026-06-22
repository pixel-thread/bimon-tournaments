import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { sendPush } from "@/lib/push";
import { logSquadEventTx } from "@/lib/squad-audit";

/**
 * POST /api/squads/import-roster
 * Import members from a previous squad into a newly created squad.
 * Body: { squadId: string, memberIds: string[] }
 *
 * - Ghost players → auto-added (ACCEPTED)
 * - Real players with auto-accept for this captain → auto-added (ACCEPTED)
 * - Real players without auto-accept → sent PENDING invite
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { squadId, memberIds } = body as { squadId: string; memberIds: string[] };

        if (!squadId || !memberIds?.length) {
            return ErrorResponse({ message: "squadId and memberIds are required", status: 400 });
        }

        const currentPlayerId = user.player.id;

        // Verify squad exists, is FORMING, and user is captain
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            select: {
                id: true,
                captainId: true,
                status: true,
                pollId: true,
                name: true,
                clanId: true,
                invites: { select: { playerId: true, status: true, isSub: true } },
                poll: { select: { tournament: { select: { name: true } } } },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }
        if (squad.captainId !== currentPlayerId) {
            return ErrorResponse({ message: "Only the captain can import roster", status: 403 });
        }
        if (squad.status !== "FORMING") {
            return ErrorResponse({ message: "Squad is not accepting members", status: 400 });
        }

        const tournamentName = squad.poll.tournament?.name ?? "tournament";

        // Current roster count
        const currentAccepted = squad.invites.filter((i) => i.status === "ACCEPTED" && !i.isSub).length;
        const currentSubs = squad.invites.filter((i) => i.status === "ACCEPTED" && i.isSub).length;
        let activeSlots = currentAccepted;
        let subSlots = currentSubs;

        // Fetch player info for all requested members
        const players = await prisma.player.findMany({
            where: { id: { in: memberIds }, isBanned: false },
            select: {
                id: true,
                displayName: true,
                isGhost: true,
                user: { select: { id: true, username: true } },
            },
        });

        const playerMap = new Map(players.map((p) => [p.id, p]));

        // Check which are already in a squad for this poll
        const inPoll = await prisma.squadInvite.findMany({
            where: {
                playerId: { in: memberIds },
                status: { in: ["PENDING", "ACCEPTED"] },
                squad: {
                    pollId: squad.pollId,
                    status: { in: ["FORMING", "FULL"] },
                },
            },
            select: { playerId: true },
        });
        const inPollSet = new Set(inPoll.map((i) => i.playerId));

        // Check auto-accept for this captain
        const autoAccepts = await prisma.playerAutoAccept.findMany({
            where: {
                captainId: currentPlayerId,
                playerId: { in: memberIds },
            },
            select: { playerId: true },
        });
        const autoAcceptSet = new Set(autoAccepts.map((a) => a.playerId));

        // Also check clan auto-accept
        let clanAutoAcceptSet = new Set<string>();
        if (squad.clanId) {
            const clanMembers = await prisma.clanMember.findMany({
                where: {
                    clanId: squad.clanId,
                    playerId: { in: memberIds },
                    autoAcceptSquadInvites: true,
                },
                select: { playerId: true },
            });
            clanAutoAcceptSet = new Set(clanMembers.map((m) => m.playerId));
        }

        const results: { playerId: string; name: string; status: "added" | "invited" | "skipped"; reason?: string }[] = [];

        await prisma.$transaction(async (tx) => {
            for (const memberId of memberIds) {
                const player = playerMap.get(memberId);
                if (!player) {
                    results.push({ playerId: memberId, name: "Unknown", status: "skipped", reason: "not found" });
                    continue;
                }

                // Skip if already in a squad for this poll
                if (inPollSet.has(memberId)) {
                    results.push({
                        playerId: memberId,
                        name: player.displayName ?? player.user.username ?? "Player",
                        status: "skipped",
                        reason: "already in another team",
                    });
                    continue;
                }

                // Determine slot type
                const isSub = activeSlots >= GAME.squadSize;
                if (isSub && subSlots >= GAME.maxSquadSize - GAME.squadSize) {
                    results.push({
                        playerId: memberId,
                        name: player.displayName ?? player.user.username ?? "Player",
                        status: "skipped",
                        reason: "roster full",
                    });
                    continue;
                }
                if (!isSub && activeSlots >= GAME.squadSize) {
                    // Active is full but sub slots still open
                    // Will be added as sub
                }

                const shouldAutoAccept = player.isGhost || autoAcceptSet.has(memberId) || clanAutoAcceptSet.has(memberId);
                const inviteStatus = shouldAutoAccept ? "ACCEPTED" : "PENDING";

                await tx.squadInvite.create({
                    data: {
                        squadId,
                        playerId: memberId,
                        status: inviteStatus,
                        initiatedBy: "CAPTAIN",
                        isSub,
                        ...(shouldAutoAccept ? { respondedAt: new Date() } : {}),
                    },
                });

                if (shouldAutoAccept) {
                    // Remove any individual poll vote
                    await tx.playerPollVote.deleteMany({
                        where: { pollId: squad.pollId, playerId: memberId },
                    });

                    await logSquadEventTx(tx, {
                        squadId,
                        playerId: memberId,
                        action: "INVITE_ACCEPTED",
                        actorId: currentPlayerId,
                        details: "Auto-accept (roster import)",
                    });

                    if (isSub) subSlots++;
                    else activeSlots++;

                    results.push({
                        playerId: memberId,
                        name: player.displayName ?? player.user.username ?? "Player",
                        status: "added",
                    });
                } else {
                    await logSquadEventTx(tx, {
                        squadId,
                        playerId: memberId,
                        action: "INVITE_SENT",
                        actorId: currentPlayerId,
                        details: "Roster import invite",
                    });

                    results.push({
                        playerId: memberId,
                        name: player.displayName ?? player.user.username ?? "Player",
                        status: "invited",
                    });
                }
            }

            // Update squad status if full
            if (activeSlots >= GAME.squadSize) {
                await tx.squad.update({
                    where: { id: squadId, status: "FORMING" },
                    data: { status: "FULL" },
                });
            }
        });

        // Fire-and-forget push notifications for invited (non-ghost) players
        const invitedPlayers = results.filter((r) => r.status === "invited");
        for (const inv of invitedPlayers) {
            sendPush(inv.playerId, {
                title: "🛡 Squad Invite",
                body: `${user.player.displayName} invited you to join "${squad.name}" for ${tournamentName}`,
                url: "/vote",
            });
        }

        const addedCount = results.filter((r) => r.status === "added").length;
        const invitedCount = results.filter((r) => r.status === "invited").length;
        const skippedCount = results.filter((r) => r.status === "skipped").length;

        let message = "";
        if (addedCount > 0) message += `${addedCount} auto-added`;
        if (invitedCount > 0) message += `${message ? ", " : ""}${invitedCount} invite${invitedCount > 1 ? "s" : ""} sent`;
        if (skippedCount > 0) message += `${message ? ", " : ""}${skippedCount} skipped`;

        return SuccessResponse({
            data: { results },
            message: message || "No members imported",
        });
    } catch (error) {
        console.error("Failed to import roster:", error);
        return ErrorResponse({ message: "Failed to import roster", error });
    }
}
