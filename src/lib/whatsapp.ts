/**
 * WhatsApp integration via Baileys.
 *
 * Uses a connect → execute → disconnect pattern so we don't need
 * a persistent server. Auth credentials are stored in the DB
 * (WhatsAppAuth table) so the session survives across Vercel
 * function invocations.
 */

import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    initAuthCreds,
    BufferJSON,
    Browsers,
    type WASocket,
    type ConnectionState,
    type AuthenticationCreds,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { prisma } from "@/lib/database";

// ── DB-backed auth state ──────────────────────────────────────

/**
 * Custom auth state that stores Baileys credentials in the
 * WhatsAppAuth table instead of the filesystem.
 *
 * IMPORTANT: Uses BufferJSON for serialization to preserve
 * Buffer instances in the auth data (noise keys, etc.).
 */
async function useDBAuthState() {
    // Load creds — use BufferJSON.reviver to restore Buffer instances
    const credsRow = await prisma.whatsAppAuth.findUnique({ where: { key: "creds" } });
    const creds: AuthenticationCreds = credsRow
        ? JSON.parse(credsRow.value, BufferJSON.reviver)
        : initAuthCreds();

    // Helper to read a key
    const readData = async (key: string) => {
        const row = await prisma.whatsAppAuth.findUnique({ where: { key } });
        return row ? JSON.parse(row.value, BufferJSON.reviver) : null;
    };

    // Helper to write a key — use BufferJSON.replacer to serialize Buffers
    const writeData = async (key: string, data: any) => {
        await prisma.whatsAppAuth.upsert({
            where: { key },
            update: { value: JSON.stringify(data, BufferJSON.replacer) },
            create: { key, value: JSON.stringify(data, BufferJSON.replacer) },
        });
    };

    // Helper to remove a key
    const removeData = async (key: string) => {
        await prisma.whatsAppAuth.deleteMany({ where: { key } });
    };

    return {
        state: {
            creds,
            keys: {
                get: async (type: string, ids: string[]) => {
                    const result: Record<string, any> = {};
                    for (const id of ids) {
                        const val = await readData(`${type}-${id}`);
                        if (val) result[id] = val;
                    }
                    return result;
                },
                set: async (data: Record<string, Record<string, any>>) => {
                    for (const [type, entries] of Object.entries(data)) {
                        for (const [id, value] of Object.entries(entries)) {
                            if (value) {
                                await writeData(`${type}-${id}`, value);
                            } else {
                                await removeData(`${type}-${id}`);
                            }
                        }
                    }
                },
            },
        },
        saveCreds: async (updatedCreds: any) => {
            await writeData("creds", updatedCreds);
        },
    };
}

// ── Shared silent logger (pino-compatible) ────────────────────

const silentLogger = {
    level: "silent" as const,
    child: () => silentLogger as any,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (...args: any[]) => console.error("[Baileys]", ...args),
    fatal: (...args: any[]) => console.error("[Baileys FATAL]", ...args),
} as any;

// ── Connection helper ─────────────────────────────────────────

/**
 * Connect to WhatsApp, execute an action, then disconnect.
 * Returns the result of the action.
 */
export async function connectAndExecute<T>(
    action: (sock: WASocket) => Promise<T>
): Promise<T> {
    // Check if WhatsApp has been linked (creds row exists in DB from a successful QR scan)
    const credsRow = await prisma.whatsAppAuth.findUnique({ where: { key: "creds" } });
    if (!credsRow) {
        throw new Error("WhatsApp not linked. Please scan QR code first at /dashboard/whatsapp");
    }

    const { state, saveCreds } = await useDBAuthState();
    const { version } = await fetchLatestBaileysVersion();

    return new Promise<T>((resolve, reject) => {
        let settled = false;
        let timeoutId: NodeJS.Timeout;

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys as any, silentLogger),
            },
            browser: Browsers.macOS("Chrome"),
            printQRInTerminal: false,
            logger: silentLogger,
            syncFullHistory: false,
        });

        // Save creds whenever they update
        sock.ev.on("creds.update", saveCreds);

        // Set a timeout to prevent hanging
        timeoutId = setTimeout(() => {
            if (!settled) {
                settled = true;
                try { sock.end(undefined); } catch {}
                reject(new Error("WhatsApp connection timed out (30s)"));
            }
        }, 30_000);

        sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {
                try {
                    const result = await action(sock);
                    settled = true;
                    clearTimeout(timeoutId);
                    // Disconnect cleanly
                    try { sock.end(undefined); } catch {}
                    resolve(result);
                } catch (err) {
                    settled = true;
                    clearTimeout(timeoutId);
                    try { sock.end(undefined); } catch {}
                    reject(err);
                }
            }

            if (connection === "close") {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    // Session invalidated — clear all auth data
                    await prisma.whatsAppAuth.deleteMany({});
                    if (!settled) {
                        settled = true;
                        clearTimeout(timeoutId);
                        reject(new Error("WhatsApp session logged out. Please re-scan QR code."));
                    }
                } else if (!settled) {
                    settled = true;
                    clearTimeout(timeoutId);
                    reject(new Error(`WhatsApp connection closed (code: ${statusCode})`));
                }
            }
        });
    });
}

/**
 * Link WhatsApp by generating a QR code and waiting for the scan.
 *
 * The socket MUST stay alive while the user scans the QR code.
 * Baileys may close/reconnect during initial setup — we allow retries.
 *
 * @param onQR - Called when a QR code is ready (may be called multiple times as QR refreshes)
 * @returns Promise that resolves when connected, or rejects on timeout/fatal error
 */
export async function linkWhatsApp(
    onQR: (qrString: string) => void
): Promise<{ connected: boolean }> {
    const { version } = await fetchLatestBaileysVersion();
    let attempt = 0;
    const maxAttempts = 3;

    const tryConnect = (): Promise<{ connected: boolean }> => {
        return new Promise(async (resolve, reject) => {
            attempt++;
            console.log(`[WhatsApp] Link attempt ${attempt}/${maxAttempts}`);

            // Re-load auth state on each attempt (might have partial creds from prior attempt)
            const { state, saveCreds } = await useDBAuthState();
            let settled = false;

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys as any, silentLogger),
                },
                browser: Browsers.macOS("Chrome"),
                printQRInTerminal: false,
                logger: silentLogger,
                syncFullHistory: false,
                connectTimeoutMs: 20_000,
            });

            sock.ev.on("creds.update", saveCreds);

            // Timeout after 55 seconds total
            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    try { sock.end(undefined); } catch {}
                    reject(new Error("QR scan timed out (55s) — click Link WhatsApp to try again"));
                }
            }, 55_000);

            sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
                const { connection, qr, lastDisconnect } = update;

                console.log(`[WhatsApp] Connection update:`, {
                    connection,
                    hasQR: !!qr,
                    disconnectStatus: (lastDisconnect?.error as any)?.output?.statusCode,
                });

                // QR code generated — send to caller but DON'T disconnect
                if (qr) {
                    onQR(qr);
                }

                // User scanned and connected!
                if (connection === "open" && !settled) {
                    settled = true;
                    clearTimeout(timeout);
                    console.log("[WhatsApp] Connected successfully!");
                    try { sock.end(undefined); } catch {}
                    resolve({ connected: true });
                }

                if (connection === "close" && !settled) {
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    console.log(`[WhatsApp] Connection closed, status: ${statusCode}`);

                    // Fatal: logged out — clear creds
                    if (statusCode === DisconnectReason.loggedOut) {
                        settled = true;
                        clearTimeout(timeout);
                        await prisma.whatsAppAuth.deleteMany({});
                        try { sock.end(undefined); } catch {}
                        reject(new Error("WhatsApp session logged out. Please try again."));
                        return;
                    }

                    // Non-fatal close — Baileys does this during init
                    // Don't reject yet, let it retry by creating a new socket
                    try { sock.end(undefined); } catch {}

                    if (attempt < maxAttempts) {
                        console.log(`[WhatsApp] Retrying (attempt ${attempt + 1})...`);
                        // Small delay before retry
                        await new Promise(r => setTimeout(r, 1000));
                        try {
                            const result = await tryConnect();
                            settled = true;
                            clearTimeout(timeout);
                            resolve(result);
                        } catch (err) {
                            settled = true;
                            clearTimeout(timeout);
                            reject(err);
                        }
                    } else {
                        settled = true;
                        clearTimeout(timeout);
                        reject(new Error(
                            `WhatsApp connection failed after ${maxAttempts} attempts (status: ${statusCode}). ` +
                            `This may be a network issue on the server. Please try again.`
                        ));
                    }
                }
            });
        });
    };

    return tryConnect();
}

// ── Group operations ──────────────────────────────────────────

/** Create a WhatsApp group and return its JID */
export async function createGroup(
    name: string,
    adminPhone?: string
): Promise<string> {
    return connectAndExecute(async (sock) => {
        // Create group with bot as the only initial member
        const group = await sock.groupCreate(name, []);
        const groupId = group.id;

        // Add admin if provided
        if (adminPhone) {
            const adminJid = formatPhoneToJid(adminPhone);
            try {
                await sock.groupParticipantsUpdate(groupId, [adminJid], "add");
                // Make admin a group admin
                await sock.groupParticipantsUpdate(groupId, [adminJid], "promote");
            } catch (err) {
                console.error(`[WhatsApp] Failed to add admin ${adminPhone}:`, err);
            }
        }

        return groupId;
    });
}

/** Add members to a WhatsApp group. Returns success/fail lists. */
export async function addMembers(
    groupId: string,
    phones: { phone: string; name: string }[]
): Promise<{ added: string[]; failed: { name: string; phone: string; reason: string }[] }> {
    return connectAndExecute(async (sock) => {
        const added: string[] = [];
        const failed: { name: string; phone: string; reason: string }[] = [];

        // WhatsApp limits batch additions — add in batches of 20
        const batchSize = 20;
        for (let i = 0; i < phones.length; i += batchSize) {
            const batch = phones.slice(i, i + batchSize);
            const jids = batch.map((p) => formatPhoneToJid(p.phone));

            try {
                const result = await sock.groupParticipantsUpdate(groupId, jids, "add");
                // Process results
                for (let j = 0; j < result.length; j++) {
                    const r = result[j];
                    const player = batch[j];
                    if (r.status === "200" || r.status?.toString() === "200") {
                        added.push(player.name);
                    } else {
                        failed.push({
                            name: player.name,
                            phone: player.phone,
                            reason: `Status: ${r.status}`,
                        });
                    }
                }
            } catch (err) {
                // If batch fails, mark all as failed
                for (const player of batch) {
                    failed.push({
                        name: player.name,
                        phone: player.phone,
                        reason: (err as Error).message || "Unknown error",
                    });
                }
            }
        }

        return { added, failed };
    });
}

/** Remove a member from a WhatsApp group */
export async function removeMember(groupId: string, phone: string): Promise<void> {
    return connectAndExecute(async (sock) => {
        const jid = formatPhoneToJid(phone);
        await sock.groupParticipantsUpdate(groupId, [jid], "remove");
    });
}

/** Remove all members and leave the group (effectively delete it) */
export async function deleteGroup(groupId: string): Promise<void> {
    return connectAndExecute(async (sock) => {
        try {
            // Get all participants
            const metadata = await sock.groupMetadata(groupId);
            const botJid = sock.user?.id;
            const memberJids = metadata.participants
                .filter((p) => p.id !== botJid)
                .map((p) => p.id);

            // Remove all members in batches
            const batchSize = 20;
            for (let i = 0; i < memberJids.length; i += batchSize) {
                const batch = memberJids.slice(i, i + batchSize);
                await sock.groupParticipantsUpdate(groupId, batch, "remove");
            }

            // Leave the group
            await sock.groupLeave(groupId);
        } catch (err) {
            console.error("[WhatsApp] Failed to delete group:", err);
            // Try to at least leave
            try { await sock.groupLeave(groupId); } catch {}
        }
    });
}

// ── Messaging ─────────────────────────────────────────────────

/** Send a text message to a WhatsApp group */
export async function sendMessage(groupId: string, text: string): Promise<void> {
    return connectAndExecute(async (sock) => {
        await sock.sendMessage(groupId, { text });
    });
}

/** Send an image (as buffer) with optional caption to a WhatsApp group */
export async function sendImage(
    groupId: string,
    imageBuffer: Buffer,
    caption?: string
): Promise<void> {
    return connectAndExecute(async (sock) => {
        await sock.sendMessage(groupId, {
            image: imageBuffer,
            caption: caption || undefined,
        });
    });
}

// ── Status check ──────────────────────────────────────────────

/** Check if WhatsApp is linked (auth credentials exist) */
export async function isLinked(): Promise<boolean> {
    const creds = await prisma.whatsAppAuth.findUnique({ where: { key: "creds" } });
    return !!creds;
}

/** Clear all WhatsApp auth data (unlink) */
export async function unlinkWhatsApp(): Promise<void> {
    await prisma.whatsAppAuth.deleteMany({});
}

// ── Utility ───────────────────────────────────────────────────

/** Convert a 10-digit Indian phone number to WhatsApp JID */
function formatPhoneToJid(phone: string): string {
    // Strip non-digits
    const digits = phone.replace(/\D/g, "");
    // If already has country code (91...), use as-is; otherwise prepend 91
    const fullNumber = digits.length === 10 ? `91${digits}` : digits;
    return `${fullNumber}@s.whatsapp.net`;
}
