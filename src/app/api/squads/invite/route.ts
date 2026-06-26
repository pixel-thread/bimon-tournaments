import { prisma } from "@/lib/database";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { GAME } from "@/lib/game-config";
import { type NextRequest } from "next/server";
import { sendPush } from "@/lib/push";
import { logSquadEvent, logSquadEventTx } from "@/lib/squad-audit";
import { checkKdGate } from "@/lib/logic/kd-gate";

/**
 * POST /api/squads/invite
 * Leader invites a player to their squad. Creates a PENDING invite.
 * Player auto-joins when they click the squad's invite link (link-join overrides pending).
 * Body: { squadId, playerId }
 */
export async function POST(request: NextRequest) {
    try {
        if (!GAME.features.hasSquads) {
            return ErrorResponse({ message: "Squads are not available for this game", status: 400 });
        }

        const user = await getCurrentUser();
        if (!user?.player) {
            return ErrorResponse({ message: "Player profile required", status: 403 });
        }

        const body = await request.json();
        const { squadId, playerId } = body as { squadId: string; playerId: string };

        if (!squadId || !playerId) {
            return ErrorResponse({ message: "squadId and playerId are required", status: 400 });
        }

        const currentPlayerId = user.player.id;

        // Fetch squad with details
        const squad = await prisma.squad.findUnique({
            where: { id: squadId },
            include: {
                poll: {
                    select: {
                        id: true,
                        isActive: true,
                        allowSquads: true,
                        tournament: { select: { name: true } },
                    },
                },
                invites: { select: { playerId: true, status: true } },
            },
        });

        if (!squad) {
            return ErrorResponse({ message: "Squad not found", status: 404 });
        }

        // Must be the leader or admin
        const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
        if (squad.captainId !== currentPlayerId && !isAdmin) {
            return ErrorResponse({ message: "Only the squad leader can invite players", status: 403 });
        }

        // Squad must be FORMING or FULL (FULL = active roster full, but sub slots may remain)
        if (!['FORMING', 'FULL'].includes(squad.status)) {
            return ErrorResponse({ message: "Squad is no longer accepting invites", status: 400 });
        }

        // Poll must be active
        if (!squad.poll.isActive || !squad.poll.allowSquads) {
            return ErrorResponse({ message: "Poll is no longer active", status: 400 });
        }

        // Check if squad is full
        const acceptedCount = squad.invites.filter((i) => i.status === "ACCEPTED").length;
        if (acceptedCount >= GAME.maxSquadSize) {
            return ErrorResponse({ message: "Squad is already full", status: 400 });
        }

        // Check if player is already invited/in this squad
        const existingInvite = squad.invites.find((i) => i.playerId === playerId);
        if (existingInvite) {
            if (existingInvite.status === "ACCEPTED") {
                return ErrorResponse({ message: "This player is already in your squad", status: 400 });
            }
            if (existingInvite.status === "PENDING") {
                return ErrorResponse({ message: "This player already has a pending invite", status: 400 });
            }
            // DECLINED — they can be re-invited (delete old invite, create fresh)
            await prisma.squadInvite.deleteMany({
                where: { squadId, playerId, status: "DECLINED" },
            });
        }

        // Check if player is already in another squad for this poll
        const inOtherSquad = await prisma.squadInvite.findFirst({
            where: {
                playerId,
                status: { in: ["PENDING", "ACCEPTED"] },
                squad: {
                    pollId: squad.pollId,
                    status: { in: ["FORMING", "FULL"] },
                },
            },
        });

        if (inOtherSquad) {
            return ErrorResponse({ message: "This player is already in another squad for this tournament", status: 400 });
        }

        // Get invited player info and leader name
        const [invitedPlayer, leaderName] = await Promise.all([
            prisma.player.findUnique({
                where: { id: playerId },
                select: { id: true, displayName: true, user: { select: { id: true, username: true } } },
            }),
            Promise.resolve(user.player.displayName),
        ]);

        if (!invitedPlayer) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }

        // KD range gate — block invite if invited player's KD is out of range
        const kdResult = await checkKdGate(playerId, squad.pollId, { isAdmin });
        if (!kdResult.allowed) {
            return ErrorResponse({ message: `Can't invite — ${kdResult.message}`, status: 403 });
        }

        const playerName = invitedPlayer.displayName ?? invitedPlayer.user.username;
        const tournamentName = squad.poll.tournament?.name ?? "tournament";

        // ─── Auto-accept check ──────────────────────────────────────
        // Check 1: Player-level auto-accept (invitee trusts this captain)
        let shouldAutoAccept = false;
        const playerAutoAccept = await prisma.playerAutoAccept.findUnique({
            where: { playerId_captainId: { playerId, captainId: currentPlayerId } },
        });
        if (playerAutoAccept) {
            shouldAutoAccept = true;
        }

        // Check 2: Clan auto-accept — if the squad represents a clan AND the
        // invited player is a member of that same clan with autoAcceptSquadInvites
        // enabled, skip PENDING and immediately accept.
        if (!shouldAutoAccept && squad.clanId) {
            const clanMembership = await prisma.clanMember.findUnique({
                where: { playerId },
                select: { clanId: true, autoAcceptSquadInvites: true, role: true },
            });
            if (
                clanMembership &&
                clanMembership.clanId === squad.clanId &&
                clanMembership.autoAcceptSquadInvites &&
                clanMembership.role !== "LEADER" // Leaders create squads, not auto-join
            ) {
                shouldAutoAccept = true;
            }
        }

        if (shouldAutoAccept) {
            // Auto-accept: create as ACCEPTED immediately
            const newAcceptedCount = acceptedCount + 1;
            const isFull = newAcceptedCount >= GAME.maxSquadSize;
            const shouldBeSub = newAcceptedCount > GAME.squadSize;

            await prisma.$transaction(async (tx) => {
                // Create invite as ACCEPTED
                await tx.squadInvite.create({
                    data: {
                        squadId,
                        playerId,
                        status: "ACCEPTED",
                        initiatedBy: "CAPTAIN",
                        respondedAt: new Date(),
                        isSub: shouldBeSub,
                    },
                });

                // Mark squad as FULL if needed
                if (isFull) {
                    await tx.squad.update({
                        where: { id: squadId },
                        data: { status: "FULL" },
                    });
                }

                // Remove any existing poll vote (silent remove as approved by user)
                await tx.playerPollVote.deleteMany({
                    where: { pollId: squad.pollId, playerId },
                });

                // Auto-decline other pending invites/requests for the same poll
                const otherPending = await tx.squadInvite.findMany({
                    where: {
                        playerId,
                        status: "PENDING",
                        squad: { pollId: squad.pollId, status: { in: ["FORMING", "FULL"] } },
                    },
                    select: { id: true, squadId: true },
                });
                if (otherPending.length > 0) {
                    await tx.squadInvite.updateMany({
                        where: { id: { in: otherPending.map(p => p.id) } },
                        data: { status: "DECLINED", respondedAt: new Date() },
                    });
                    for (const op of otherPending) {
                        await logSquadEventTx(tx, { squadId: op.squadId, playerId, action: "AUTO_DECLINED_OTHER", details: `Auto-accepted into ${squad.name}` });
                    }
                }

                await logSquadEventTx(tx, { squadId, playerId, action: "INVITE_ACCEPTED", actorId: currentPlayerId, details: "Auto-accept" });

                // Notify captain
                await tx.notification.create({
                    data: {
                        title: isFull ? "🛡 Squad Complete!" : "🛡 Auto-Joined",
                        message: isFull
                            ? `${playerName} auto-joined "${squad.name}" — your squad is now full for ${tournamentName}! 🎉`
                            : `${playerName} auto-joined "${squad.name}" (auto-accept enabled)`,
                        type: "squad_accept",
                        userId: user.id,
                        playerId: currentPlayerId,
                        link: "/vote",
                    },
                });
            });

            // Push to the auto-joined player
            sendPush(playerId, {
                title: "🛡 Auto-Joined Squad",
                body: `You were auto-joined to "${squad.name}" for ${tournamentName}`,
                url: "/vote",
            });

            // Push to captain
            const pushTitle = isFull ? "🛡 Squad Complete!" : "🛡 Auto-Joined";
            const pushBody = isFull
                ? `${playerName} auto-joined "${squad.name}" — squad full! 🎉`
                : `${playerName} auto-joined "${squad.name}"`;
            sendPush(currentPlayerId, { title: pushTitle, body: pushBody, url: "/vote" });

            return SuccessResponse({
                message: `${playerName} auto-joined "${squad.name}"!`,
                data: { autoAccepted: true },
            });
        }

        // ─── Normal flow: create PENDING invite ─────────────────────
        // No Discord access yet — player must accept first
        await prisma.squadInvite.create({
            data: {
                squadId,
                playerId,
                status: "PENDING",
                initiatedBy: "CAPTAIN",
            },
        });

        logSquadEvent({ squadId, playerId, action: "INVITE_SENT", actorId: currentPlayerId });

        // Push notification
        sendPush(invitedPlayer.id, {
            title: "🛡 Squad Invite",
            body: `${leaderName} invited you to join "${squad.name}" for ${tournamentName}`,
            url: "/vote",
        });

        return SuccessResponse({
            message: `Invite sent to ${playerName}!`,
        });
    } catch (error) {
        return ErrorResponse({ message: "Failed to send invite", error });
    }
}
