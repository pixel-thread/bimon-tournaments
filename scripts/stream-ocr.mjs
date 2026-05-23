#!/usr/bin/env node

/**
 * Stream OCR Auto-Detect (Cross-platform: macOS + Windows)
 *
 * Captures the spectated player name from the Scrcpy window,
 * matches it against known tournament players, and pushes
 * the result to the overlay via WebSocket relay.
 *
 * Usage:
 *   node scripts/stream-ocr.mjs --setup                    # Find capture region
 *   node scripts/stream-ocr.mjs --token TOKEN --tournament ID  # Run live
 *
 * Requirements:
 *   npm install tesseract.js sharp screenshot-desktop ws
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, tmpdir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IS_MAC = platform() === "darwin";
const IS_WIN = platform() === "win32";

const CONFIG_PATH = join(__dirname, ".stream-ocr-config.json");
const CAPTURE_PATH = join(tmpdir(), "stream-ocr-capture.png");
const PROCESSED_PATH = join(tmpdir(), "stream-ocr-processed.png");

// ── CLI Args ──
const args = process.argv.slice(2);
const isSetup = args.includes("--setup");
const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const tokenArg = getArg("--token");
const apiUrlArg = getArg("--api");
const regionArg = getArg("--region");
const tournamentArg = getArg("--tournament");

// ── Config ──
const DEFAULT_CONFIG = {
    region: { x: 340, y: 490, width: 300, height: 40 },
    apiUrl: "https://bgmi.pixel-thread.in",
    token: "",
    tournamentId: "",
    intervalMs: 400,
    debounceCount: 2,
};

function loadConfig() {
    if (existsSync(CONFIG_PATH)) {
        try { return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) }; }
        catch { return { ...DEFAULT_CONFIG }; }
    }
    return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`✅ Config saved`);
}

// ══════════════════════════════════════════════════════
// ── MATCHING ENGINE (the accuracy secret) ──
// ══════════════════════════════════════════════════════

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            d[i][j] = a[i - 1] === b[j - 1]
                ? d[i - 1][j - 1]
                : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
        }
    }
    return d[m][n];
}

/**
 * Longest Common Subsequence length.
 */
function lcsLength(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

/**
 * Character frequency similarity (0-1).
 * How many of the same characters appear in both strings.
 */
function charFreqSimilarity(a, b) {
    const freqA = {}, freqB = {};
    for (const c of a) freqA[c] = (freqA[c] || 0) + 1;
    for (const c of b) freqB[c] = (freqB[c] || 0) + 1;
    let overlap = 0, total = 0;
    const allChars = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
    for (const c of allChars) {
        overlap += Math.min(freqA[c] || 0, freqB[c] || 0);
        total += Math.max(freqA[c] || 0, freqB[c] || 0);
    }
    return total > 0 ? overlap / total : 0;
}

/**
 * Match OCR text against a list of known player names.
 * Returns the best match { player, score, details } or null.
 */
function matchPlayer(ocrText, players) {
    if (!ocrText || ocrText.length < 2) return null;

    const clean = ocrText.toLowerCase().trim();
    let bestMatch = null;

    for (const player of players) {
        const name = player.matchName; // pre-computed lowercase alphanumeric

        if (!name || name.length < 2) continue;

        let score = 0;
        const details = {};

        // 1. Exact match
        if (clean === name) {
            return { player, score: 100, details: { exact: true } };
        }

        // 2. Contains match (OCR reads partial or full name within garbage)
        if (clean.includes(name)) {
            score = Math.max(score, 95);
            details.contains = true;
        } else if (name.includes(clean) && clean.length >= 3) {
            score = Math.max(score, 85);
            details.partialContains = true;
        }

        // 3. Levenshtein similarity
        const maxLen = Math.max(clean.length, name.length);
        const lev = levenshtein(clean, name);
        const levScore = ((maxLen - lev) / maxLen) * 100;
        details.levenshtein = Math.round(levScore);
        score = Math.max(score, levScore);

        // 4. LCS similarity
        const lcs = lcsLength(clean, name);
        const lcsScore = (lcs / maxLen) * 100;
        details.lcs = Math.round(lcsScore);
        score = Math.max(score, lcsScore * 1.1); // slight boost

        // 5. Character frequency
        const charScore = charFreqSimilarity(clean, name) * 100;
        details.charFreq = Math.round(charScore);
        score = Math.max(score, charScore * 0.9);

        // 6. Word overlap (handles clan tags like "TAG | PLAYER")
        const ocrWords = clean.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 2);
        const nameWords = name.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 2);

        if (ocrWords.length > 0 && nameWords.length > 0) {
            let wordHits = 0;
            for (const ow of ocrWords) {
                for (const nw of nameWords) {
                    if (ow === nw) wordHits += 1;
                    else if (ow.length >= 3 && nw.includes(ow)) wordHits += 0.7;
                    else if (nw.length >= 3 && ow.includes(nw)) wordHits += 0.7;
                }
            }
            const wordScore = (wordHits / Math.max(ocrWords.length, nameWords.length)) * 100;
            details.wordOverlap = Math.round(wordScore);
            score = Math.max(score, wordScore);
        }

        // 7. Starts-with bonus (first 3+ chars match)
        if (clean.length >= 3 && name.length >= 3) {
            const prefixLen = Math.min(clean.length, name.length, 5);
            let prefixMatch = 0;
            for (let i = 0; i < prefixLen; i++) {
                if (clean[i] === name[i]) prefixMatch++;
            }
            if (prefixMatch >= 3) {
                score = Math.max(score, 70 + prefixMatch * 5);
                details.prefixMatch = prefixMatch;
            }
        }

        if (score > (bestMatch?.score ?? 0)) {
            bestMatch = { player, score: Math.round(score), details };
        }
    }

    // Require minimum 45% confidence
    return bestMatch && bestMatch.score >= 45 ? bestMatch : null;
}

// ══════════════════════════════════════════════════════
// ── SCREEN CAPTURE ──
// ══════════════════════════════════════════════════════

async function captureRegion(region, outputPath, sharp, screenshotDesktop) {
    const { x, y, width, height } = region;
    if (IS_MAC) {
        execSync(`screencapture -x -R ${x},${y},${width},${height} "${outputPath}"`, { timeout: 3000 });
    } else {
        const buf = await screenshotDesktop();
        await sharp(buf).extract({ left: x, top: y, width, height }).toFile(outputPath);
    }
}

async function captureFullScreen(outputPath, screenshotDesktop) {
    if (IS_MAC) {
        execSync(`screencapture -x "${outputPath}"`);
    } else {
        const buf = await screenshotDesktop();
        writeFileSync(outputPath, buf);
    }
}

function openFile(path) {
    try {
        if (IS_MAC) execSync(`open "${path}"`);
        else if (IS_WIN) execSync(`start "" "${path}"`, { shell: true });
        else execSync(`xdg-open "${path}"`);
    } catch {}
}

// ══════════════════════════════════════════════════════
// ── SETUP MODE ──
// ══════════════════════════════════════════════════════

async function runSetup() {
    console.log("\n🔧 Stream OCR Setup\n");

    let screenshotDesktop = null;
    let sharp = null;
    try { sharp = (await import("sharp")).default; } catch {}

    if (!IS_MAC) {
        try { screenshotDesktop = (await import("screenshot-desktop")).default; }
        catch { console.error("❌ npm install screenshot-desktop"); process.exit(1); }
    }

    const fullPath = join(tmpdir(), "stream-ocr-fullscreen.png");
    console.log("📸 Capturing full screen...");
    await captureFullScreen(fullPath, screenshotDesktop);
    console.log(`   Saved: ${fullPath}`);
    openFile(fullPath);

    const config = loadConfig();

    if (regionArg) {
        const [x, y, w, h] = regionArg.split(",").map(Number);
        if (x >= 0 && y >= 0 && w > 0 && h > 0) {
            config.region = { x, y, width: w, height: h };
            console.log(`\n   ✅ Region: x=${x} y=${y} w=${w} h=${h}`);
        }
    } else {
        console.log(`\n   Current region: x=${config.region.x} y=${config.region.y} w=${config.region.width} h=${config.region.height}`);
        console.log('   Set with: --region "X,Y,WIDTH,HEIGHT"');
    }

    if (tokenArg) config.token = tokenArg;
    if (apiUrlArg) config.apiUrl = apiUrlArg;
    if (tournamentArg) config.tournamentId = tournamentArg;

    // Test capture
    if (sharp) {
        console.log("\n📸 Testing region capture...");
        try {
            await captureRegion(config.region, CAPTURE_PATH, sharp, screenshotDesktop);
            openFile(CAPTURE_PATH);
            console.log("   Check if this captures the player name area.");
        } catch (e) {
            console.error(`   ❌ ${e.message}`);
        }
    }

    saveConfig(config);
    console.log(`\n✅ Done! Run live with:`);
    console.log(`   node scripts/stream-ocr.mjs --token ${config.token || "YOUR_TOKEN"} --tournament TOURNAMENT_ID\n`);
}

// ══════════════════════════════════════════════════════
// ── LIVE OCR MODE ──
// ══════════════════════════════════════════════════════

async function runLive() {
    const config = loadConfig();
    if (tokenArg) config.token = tokenArg;
    if (apiUrlArg) config.apiUrl = apiUrlArg;
    if (tournamentArg) config.tournamentId = tournamentArg;
    if (regionArg) {
        const [x, y, w, h] = regionArg.split(",").map(Number);
        if (x >= 0 && y >= 0 && w > 0 && h > 0) config.region = { x, y, width: w, height: h };
    }

    if (!config.token) { console.error("❌ --token required"); process.exit(1); }

    // ── Load dependencies ──
    let Tesseract, sharp, screenshotDesktop, WebSocket;
    try {
        Tesseract = await import("tesseract.js");
        sharp = (await import("sharp")).default;
    } catch {
        console.error("❌ npm install tesseract.js sharp screenshot-desktop ws");
        process.exit(1);
    }
    if (!IS_MAC) {
        try { screenshotDesktop = (await import("screenshot-desktop")).default; }
        catch { console.error("❌ npm install screenshot-desktop"); process.exit(1); }
    }
    try {
        WebSocket = (await import("ws")).default;
    } catch {
        console.error("❌ npm install ws");
        process.exit(1);
    }

    // ── Fetch tournament players ──
    let tournamentId = config.tournamentId;

    // If no tournament ID, fetch the latest one
    if (!tournamentId) {
        console.log("⏳ Fetching latest tournament...");
        try {
            const res = await fetch(`${config.apiUrl}/api/stream/tournaments?token=${config.token}`);
            const json = await res.json();
            if (json.data && json.data.length > 0) {
                tournamentId = json.data[0].id;
                console.log(`   Using: ${json.data[0].name}`);
            }
        } catch (e) {
            console.error(`   ❌ ${e.message}`);
        }
    }

    if (!tournamentId) {
        console.error("❌ No tournament found. Use --tournament ID");
        process.exit(1);
    }

    console.log("⏳ Fetching player list...");
    let players = [];
    try {
        const res = await fetch(`${config.apiUrl}/api/stream/players?token=${config.token}&tournamentId=${tournamentId}`);
        const json = await res.json();
        if (json.data) {
            players = json.data.map(p => ({
                ...p,
                // Pre-compute a clean lowercase version for matching
                matchName: (p.displayName || "")
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, "")
                    .trim(),
                // Also keep original parts for word matching
                matchWords: (p.displayName || "")
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, " ")
                    .split(/\s+/)
                    .filter(w => w.length >= 2),
            }));
        }
    } catch (e) {
        console.error(`   ❌ ${e.message}`);
        process.exit(1);
    }

    if (players.length === 0) {
        console.error("❌ No players found for this tournament");
        process.exit(1);
    }

    console.log(`   ✅ ${players.length} players loaded\n`);

    // Print player list
    console.log("   Players:");
    for (const p of players) {
        console.log(`     ${p.displayName} → "${p.matchName}"`);
    }

    // ── Connect WebSocket relay ──
    let ws = null;
    let wsConnected = false;

    function connectWS() {
        try {
            ws = new WebSocket("ws://localhost:9876");
            ws.on("open", () => {
                wsConnected = true;
                console.log("\n🟢 Relay connected (instant mode)");
                // Send player list to relay for overlay cache
                ws.send(JSON.stringify({
                    type: "players",
                    players: players,
                    tournamentId: tournamentId,
                }));
            });
            ws.on("close", () => {
                wsConnected = false;
                setTimeout(connectWS, 2000);
            });
            ws.on("error", () => { try { ws.close(); } catch {} });
        } catch {
            setTimeout(connectWS, 2000);
        }
    }

    connectWS();

    // ── Initialize Tesseract ──
    console.log("\n⏳ Loading OCR engine...");
    const worker = await Tesseract.createWorker("eng");
    await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-|.",
        tessedit_pageseg_mode: "7", // Single line
    });
    console.log("✅ OCR engine ready!\n");

    // ── State ──
    let lastMatchedId = "";
    let lastOcrText = "";
    let consecutiveCount = 0;
    let totalScans = 0;
    let totalMatches = 0;

    const { width, height } = config.region;

    // ── Main loop ──
    console.log("🎮 Stream OCR — Watching for player names...");
    console.log(`   Region: x=${config.region.x} y=${config.region.y} w=${width} h=${height}`);
    console.log(`   Interval: ${config.intervalMs}ms`);
    console.log(`   Press Ctrl+C to stop\n`);

    const tick = async () => {
        try {
            totalScans++;

            // 1. Capture
            await captureRegion(config.region, CAPTURE_PATH, sharp, screenshotDesktop);

            // 2. Pre-process for OCR
            await sharp(CAPTURE_PATH)
                .greyscale()
                .negate()       // White text on dark → dark text on light
                .normalise()    // Max contrast
                .sharpen({ sigma: 2 })
                .resize(width * 4, height * 4, { fit: "fill" })  // 4x upscale
                .toFile(PROCESSED_PATH);

            // 3. OCR
            const result = await worker.recognize(PROCESSED_PATH);
            let rawText = result.data.text.trim();

            // 4. Clean up game UI artifacts
            rawText = rawText
                .replace(/^Team\s*\d+\s*/i, "")     // "Team7 Lehkaibha" → "Lehkaibha"
                .replace(/^\d+\s+/, "")              // Leading numbers
                .replace(/^#\d+\s*/i, "")            // "#12 Name"
                .replace(/\bKilled\b.*/i, "")        // Kill feed
                .replace(/\bKnocked\b.*/i, "")       // Knock feed
                .replace(/[^\w\s\-_|.]/g, "")        // Strip special chars
                .trim();

            if (!rawText || rawText.length < 2) return;

            // Clean for matching (lowercase, alphanumeric only)
            const cleanText = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

            if (!cleanText || cleanText.length < 2) return;

            // 5. Match against known players
            const match = matchPlayer(cleanText, players);

            if (!match) return;

            // 6. Debounce — require consecutive matches
            if (match.player.id === lastMatchedId) {
                consecutiveCount++;
            } else {
                lastOcrText = rawText;
                lastMatchedId = match.player.id;
                consecutiveCount = 1;
            }

            // Only act after N consecutive matches of the same player
            if (consecutiveCount === config.debounceCount) {
                totalMatches++;
                const pct = ((totalMatches / totalScans) * 100).toFixed(0);

                console.log(
                    `🔍 "${rawText}" → ✅ ${match.player.displayName} (${match.score}% match) [${totalMatches}/${totalScans} = ${pct}% hit rate]`
                );

                // 7. Send to WebSocket relay (instant)
                if (wsConnected && ws) {
                    try {
                        ws.send(JSON.stringify({
                            type: "select",
                            playerId: match.player.id,
                        }));
                    } catch {}
                }

                // 8. Also POST to API (backup / persistence)
                try {
                    fetch(`${config.apiUrl}/api/stream/state?token=${config.token}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            selectedPlayerName: rawText,
                            isVisible: true,
                        }),
                    }).catch(() => {});
                } catch {}
            }
        } catch (e) {
            if (e.message && !e.message.includes("timeout")) {
                // Only log unexpected errors
            }
        }
    };

    setInterval(tick, config.intervalMs);

    // Graceful shutdown
    process.on("SIGINT", async () => {
        console.log(`\n\n🛑 Stopping OCR...`);
        console.log(`   Scans: ${totalScans}, Matches: ${totalMatches}`);
        await worker.terminate();
        if (ws) ws.close();
        process.exit(0);
    });
}

// ── Entry ──
if (isSetup) {
    runSetup();
} else {
    runLive();
}
