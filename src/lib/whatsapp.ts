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

/**
 * Connect to WhatsApp, execute an action, then disconnect.
 * Handles 515 "restart required" with auto-reconnect.
 */
export async function connectAndExecute<T>(
    action: (sock: WASocket) => Promise<T>
): Promise<T> {
    // Check if WhatsApp has been linked
    const credsRow = await prisma.whatsAppAuth.findUnique({ where: { key: "creds" } });
    if (!credsRow) {
        throw new Error("WhatsApp not linked. Please scan QR code first at /dashboard/whatsapp");
    }

    // Load auth state ONCE — reuse across reconnections
    const { state, saveCreds } = await useDBAuthState();
    const cachedKeys = makeCacheableSignalKeyStore(state.keys as any, silentLogger);
    const { version } = await fetchLatestBaileysVersion();
    let attempt = 0;
    const maxAttempts = 3;

    return new Promise<T>((resolve, reject) => {
        let settled = false;

        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error("WhatsApp connection timed out (30s)"));
            }
        }, 30_000);

        const startSocket = () => {
            attempt++;
            console.log(`[WhatsApp] Connect attempt ${attempt}/${maxAttempts}`);

            const sock = makeWASocket({
                version,
                auth: { creds: state.creds, keys: cachedKeys },
                browser: Browsers.macOS("Chrome"),
                printQRInTerminal: false,
                logger: silentLogger,
                syncFullHistory: false,
            });

            sock.ev.on("creds.update", async (creds) => {
                Object.assign(state.creds, creds);
                await saveCreds(creds);
            });

            sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
                const { connection, lastDisconnect } = update;
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

                if (connection === "open") {
                    try {
                        const result = await action(sock);
                        settled = true;
                        clearTimeout(timeout);
                        try { sock.end(undefined); } catch {}
                        resolve(result);
                    } catch (err) {
                        settled = true;
                        clearTimeout(timeout);
                        try { sock.end(undefined); } catch {}
                        reject(err);
                    }
                }

                if (connection === "close" && !settled) {
                    console.log(`[WhatsApp] Connection closed, status: ${statusCode}`);
                    try { sock.end(undefined); } catch {}

                    if (statusCode === DisconnectReason.loggedOut) {
                        settled = true;
                        clearTimeout(timeout);
                        await prisma.whatsAppAuth.deleteMany({});
                        reject(new Error("WhatsApp session logged out. Please re-scan QR code."));
                        return;
                    }

                    // 515 or other non-fatal — retry with same auth state
                    if (attempt < maxAttempts) {
                        const delay = statusCode === 515 ? 500 : 1500;
                        console.log(`[WhatsApp] Reconnecting in ${delay}ms...`);
                        setTimeout(startSocket, delay);
                    } else {
                        settled = true;
                        clearTimeout(timeout);
                        reject(new Error(`WhatsApp connection failed after ${maxAttempts} attempts (status: ${statusCode})`));
                    }
                }
            });
        };

        startSocket();
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

    // Load auth state ONCE — reuse across reconnections so in-memory
    // creds from QR scan survive the 515 "restart required" disconnect
    const { state, saveCreds } = await useDBAuthState();
    const cachedKeys = makeCacheableSignalKeyStore(state.keys as any, silentLogger);
    let attempt = 0;
    const maxAttempts = 4;

    return new Promise((resolve, reject) => {
        let settled = false;

        // Global timeout for the entire linking process
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error("QR scan timed out (55s) — click Link WhatsApp to try again"));
            }
        }, 55_000);

        const startSocket = () => {
            attempt++;
            console.log(`[WhatsApp] Link attempt ${attempt}/${maxAttempts}`);

            const sock = makeWASocket({
                version,
                auth: { creds: state.creds, keys: cachedKeys },
                browser: Browsers.macOS("Chrome"),
                printQRInTerminal: false,
                logger: silentLogger,
                syncFullHistory: false,
                connectTimeoutMs: 20_000,
            });

            sock.ev.on("creds.update", async (creds) => {
                // Update in-memory creds AND persist to DB
                Object.assign(state.creds, creds);
                await saveCreds(creds);
            });

            sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
                const { connection, qr, lastDisconnect } = update;
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

                console.log(`[WhatsApp] Connection update:`, {
                    connection, hasQR: !!qr, statusCode, attempt,
                });

                // QR code generated — send to client
                if (qr) {
                    onQR(qr);
                }

                // Successfully connected!
                if (connection === "open" && !settled) {
                    settled = true;
                    clearTimeout(timeout);
                    console.log("[WhatsApp] ✅ Connected successfully!");
                    try { sock.end(undefined); } catch {}
                    resolve({ connected: true });
                }

                if (connection === "close" && !settled) {
                    console.log(`[WhatsApp] Connection closed, status: ${statusCode}`);
                    try { sock.end(undefined); } catch {}

                    // Fatal: logged out
                    if (statusCode === DisconnectReason.loggedOut) {
                        settled = true;
                        clearTimeout(timeout);
                        await prisma.whatsAppAuth.deleteMany({});
                        reject(new Error("WhatsApp session logged out. Please try again."));
                        return;
                    }

                    // 515 = "restart required" — this is NORMAL after scanning
                    // Reconnect with the SAME in-memory auth state
                    if (attempt < maxAttempts) {
                        const delay = statusCode === 515 ? 500 : 1500;
                        console.log(`[WhatsApp] Reconnecting in ${delay}ms (status: ${statusCode})...`);
                        setTimeout(startSocket, delay);
                    } else {
                        settled = true;
                        clearTimeout(timeout);
                        reject(new Error(
                            `WhatsApp connection failed after ${maxAttempts} attempts (last status: ${statusCode}). Try again.`
                        ));
                    }
                }
            });
        };

        startSocket();
    });
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

        // Add admin if provided (with delay to appear natural)
        if (adminPhone) {
            await humanDelay(1000);
            const adminJid = formatPhoneToJid(adminPhone);
            try {
                await sock.groupParticipantsUpdate(groupId, [adminJid], "add");
                await humanDelay(500);
                await sock.groupParticipantsUpdate(groupId, [adminJid], "promote");
            } catch (err) {
                console.error(`[WhatsApp] Failed to add admin ${adminPhone}:`, err);
            }
        }

        return groupId;
    });
}

/**
 * Add members to a WhatsApp group. Returns success/fail lists.
 *
 * Anti-ban: small batches of 5 with 3s delays between batches.
 * WhatsApp flags accounts that add too many people too quickly.
 */
export async function addMembers(
    groupId: string,
    phones: { phone: string; name: string }[]
): Promise<{ added: string[]; failed: { name: string; phone: string; reason: string }[] }> {
    return connectAndExecute(async (sock) => {
        const added: string[] = [];
        const failed: { name: string; phone: string; reason: string }[] = [];

        // Small batches + delays to avoid ban
        const batchSize = 5;
        for (let i = 0; i < phones.length; i += batchSize) {
            const batch = phones.slice(i, i + batchSize);
            const jids = batch.map((p) => formatPhoneToJid(p.phone));

            // Delay between batches (not on first batch)
            if (i > 0) {
                await humanDelay(3000);
            }

            try {
                const result = await sock.groupParticipantsUpdate(groupId, jids, "add");
                for (let j = 0; j < result.length; j++) {
                    const r = result[j];
                    const player = batch[j];
                    const status = r.status?.toString();
                    if (status === "200" || status === "409") {
                        // 200 = added, 409 = already in group
                        added.push(player.name);
                    } else {
                        failed.push({
                            name: player.name,
                            phone: player.phone,
                            reason: `Status: ${status}`,
                        });
                    }
                }
            } catch (err) {
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
            const metadata = await sock.groupMetadata(groupId);
            const botJid = sock.user?.id;
            const memberJids = metadata.participants
                .filter((p) => p.id !== botJid)
                .map((p) => p.id);

            // Small batches with delays to avoid ban
            const batchSize = 5;
            for (let i = 0; i < memberJids.length; i += batchSize) {
                if (i > 0) await humanDelay(2000);
                const batch = memberJids.slice(i, i + batchSize);
                await sock.groupParticipantsUpdate(groupId, batch, "remove");
            }

            await humanDelay(1000);
            await sock.groupLeave(groupId);
        } catch (err) {
            console.error("[WhatsApp] Failed to delete group:", err);
            try { await sock.groupLeave(groupId); } catch {}
        }
    });
}

// ── Messaging ─────────────────────────────────────────────────

/** Send a text message to a WhatsApp group */
export async function sendMessage(groupId: string, text: string): Promise<void> {
    return connectAndExecute(async (sock) => {
        // Small delay before sending to appear natural
        await humanDelay(500);
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
        await humanDelay(500);
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
    const digits = phone.replace(/\D/g, "");
    const fullNumber = digits.length === 10 ? `91${digits}` : digits;
    return `${fullNumber}@s.whatsapp.net`;
}

/** Human-like delay with small jitter to avoid detection */
function humanDelay(baseMs: number): Promise<void> {
    const jitter = Math.floor(Math.random() * 500);
    return new Promise((r) => setTimeout(r, baseMs + jitter));
}
