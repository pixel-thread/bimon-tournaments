import { prisma } from "@/lib/database";

/**
 * Log a squad event to the audit trail.
 * Fire-and-forget — never throws, never blocks.
 *
 * @param tx - Optional Prisma transaction client (use inside $transaction)
 */
export function logSquadEvent(params: {
    squadId: string;
    playerId: string;
    action: string;
    actorId?: string;
    details?: string;
    tx?: any; // Prisma transaction client
}) {
    const client = params.tx ?? prisma;
    // Fire-and-forget: don't await, don't throw
    client.squadAuditLog
        .create({
            data: {
                squadId: params.squadId,
                playerId: params.playerId,
                action: params.action,
                actorId: params.actorId ?? null,
                details: params.details ?? null,
            },
        })
        .catch((err: Error) => {
            console.error("[squad-audit] Failed to log event:", err.message);
        });
}

/**
 * Log a squad event inside a transaction (awaited).
 * Use this when the log MUST be part of the transaction.
 */
export async function logSquadEventTx(
    tx: any,
    params: {
        squadId: string;
        playerId: string;
        action: string;
        actorId?: string;
        details?: string;
    }
) {
    await tx.squadAuditLog.create({
        data: {
            squadId: params.squadId,
            playerId: params.playerId,
            action: params.action,
            actorId: params.actorId ?? null,
            details: params.details ?? null,
        },
    });
}
