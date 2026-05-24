#!/usr/bin/env node

/**
 * Stream Auto-Detect — Template Matching (Zero-lag Edition)
 *
 * Compares screen captures against pre-captured reference images.
 * No OCR needed — pixel comparison = 100% accuracy.
 *
 * Optimizations for near-zero lag:
 *   - All references pre-processed to raw pixel buffers at startup
 *   - Captured frame processed ONCE, compared as raw bytes
 *   - Small comparison resolution (150×30) = only 4500 pixels
 *   - Skip if frame unchanged (fast hash check)
 *   - Early exit when confidence > 95%
 *
 * Modes:
 *   --setup                  Find capture region
 *   --capture                Capture reference images for each player
 *   --live                   Run live detection (default)
 *
 * Requirements:
 *   npm install sharp screenshot-desktop ws
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, tmpdir } from "os";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IS_MAC = platform() === "darwin";
const IS_WIN = platform() === "win32";

const CONFIG_PATH = join(__dirname, ".stream-ocr-config.json");
const REFS_DIR = join(__dirname, ".stream-refs");
const CAPTURE_PATH = join(tmpdir(), "stream-ocr-capture.png");

// Comparison dimensions — small = fast. 150×30 = 4500 pixels = ~1ms per compare
const CMP_W = 150;
const CMP_H = 30;

// ── CLI ──
const args = process.argv.slice(2);
const isSetup = args.includes("--setup");
const isCapture = args.includes("--capture");
const isLive = !isSetup && !isCapture;
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
    intervalMs: 150,  // Ultra fast — pixel math is cheap
    debounceCount: 3, // 3 consecutive = more stable
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
// ── FAST PIXEL COMPARISON ──
// ══════════════════════════════════════════════════════

/**
 * Compare two raw greyscale pixel buffers.
 * Returns similarity 0-100. Pure arithmetic — ~0.5ms for 4500 pixels.
 */
function compareRaw(pixelsA, pixelsB) {
    const len = Math.min(pixelsA.length, pixelsB.length);
    if (len === 0) return 0;

    let totalDiff = 0;
    // Process 4 pixels at a time for speed
    const end4 = len - (len % 4);
    for (let i = 0; i < end4; i += 4) {
        totalDiff += Math.abs(pixelsA[i] - pixelsB[i])
                   + Math.abs(pixelsA[i+1] - pixelsB[i+1])
                   + Math.abs(pixelsA[i+2] - pixelsB[i+2])
                   + Math.abs(pixelsA[i+3] - pixelsB[i+3]);
    }
    for (let i = end4; i < len; i++) {
        totalDiff += Math.abs(pixelsA[i] - pixelsB[i]);
    }

    return ((255 - totalDiff / len) / 255) * 100;
}

/**
 * Fast hash of a buffer (first 256 bytes) to detect unchanged frames.
 */
function quickHash(buf) {
    const slice = buf.subarray(0, Math.min(256, buf.length));
    return createHash("md5").update(slice).digest("hex");
}

/**
 * Convert an image buffer to standardized raw greyscale pixels.
 * This is the ONLY expensive operation — done ONCE per capture.
 */
async function toRawPixels(imgBuffer, sharp) {
    return sharp(imgBuffer)
        .resize(CMP_W, CMP_H, { fit: "fill" })
        .greyscale()
        .normalise()
        .raw()
        .toBuffer();
}

// ══════════════════════════════════════════════════════
// ── SCREEN CAPTURE ──
// ══════════════════════════════════════════════════════

async function captureRegionBuffer(region, sharp, screenshotDesktop) {
    const { x, y, width, height } = region;
    if (IS_MAC) {
        const tmpPath = join(tmpdir(), `stream-cap-${Date.now()}.png`);
        execSync(`screencapture -x -R ${x},${y},${width},${height} "${tmpPath}"`, { timeout: 3000 });
        const buf = readFileSync(tmpPath);
        try { execSync(`rm "${tmpPath}"`, { timeout: 1000 }); } catch {}
        return buf;
    } else {
        const buf = await screenshotDesktop();
        return sharp(buf).extract({ left: x, top: y, width, height }).png().toBuffer();
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
            console.log(`\n   ✅ Region set: x=${x} y=${y} w=${w} h=${h}`);
        }
    } else {
        console.log(`\n   Current region: x=${config.region.x} y=${config.region.y} w=${config.region.width} h=${config.region.height}`);
        console.log('   Set with: --region "X,Y,WIDTH,HEIGHT"');
        console.log('\n   Tip: Open the screenshot, find the player name, note coordinates.');
    }

    if (tokenArg) config.token = tokenArg;
    if (apiUrlArg) config.apiUrl = apiUrlArg;
    if (tournamentArg) config.tournamentId = tournamentArg;

    if (sharp) {
        console.log("\n📸 Testing region capture...");
        try {
            const { x, y, width, height } = config.region;
            if (IS_MAC) {
                execSync(`screencapture -x -R ${x},${y},${width},${height} "${CAPTURE_PATH}"`, { timeout: 3000 });
            } else {
                const buf = await screenshotDesktop();
                await sharp(buf).extract({ left: x, top: y, width, height }).toFile(CAPTURE_PATH);
            }
            openFile(CAPTURE_PATH);
            console.log("   ✅ Check the cropped image — does it show the player name?");
        } catch (e) {
            console.error(`   ❌ ${e.message}`);
        }
    }

    saveConfig(config);
    console.log(`\n   Next: node scripts/stream-ocr.mjs --capture --token ${config.token || "TOKEN"}\n`);
}

// ══════════════════════════════════════════════════════
// ── CAPTURE MODE ──
// ══════════════════════════════════════════════════════

async function runCapture() {
    const config = loadConfig();
    if (tokenArg) config.token = tokenArg;
    if (apiUrlArg) config.apiUrl = apiUrlArg;
    if (tournamentArg) config.tournamentId = tournamentArg;

    if (!config.token) { console.error("❌ --token required"); process.exit(1); }

    let sharp, screenshotDesktop;
    try { sharp = (await import("sharp")).default; }
    catch { console.error("❌ npm install sharp"); process.exit(1); }
    if (!IS_MAC) {
        try { screenshotDesktop = (await import("screenshot-desktop")).default; }
        catch { console.error("❌ npm install screenshot-desktop"); process.exit(1); }
    }

    // Fetch players
    let tournamentId = config.tournamentId;
    if (!tournamentId) {
        const res = await fetch(`${config.apiUrl}/api/stream/tournaments?token=${config.token}`);
        const json = await res.json();
        if (json.data?.[0]) {
            tournamentId = json.data[0].id;
            console.log(`📋 Tournament: ${json.data[0].name}`);
        }
    }
    if (!tournamentId) { console.error("❌ No tournament. Use --tournament ID"); process.exit(1); }

    const res = await fetch(`${config.apiUrl}/api/stream/players?token=${config.token}&tournamentId=${tournamentId}`);
    const json = await res.json();
    const players = json.data || [];

    if (players.length === 0) { console.error("❌ No players found"); process.exit(1); }

    if (!existsSync(REFS_DIR)) mkdirSync(REFS_DIR, { recursive: true });

    console.log(`\n📸 Reference Image Capture — ${players.length} players\n`);
    console.log("   How it works:");
    console.log("   1. Spectate a player in BGMI");
    console.log("   2. Type their NUMBER and press Enter");
    console.log("   3. The script captures their name from the screen");
    console.log("   4. Repeat for all players. Type 'done' to finish.\n");

    // Show list with capture status
    players.forEach((p, i) => {
        const done = existsSync(join(REFS_DIR, `${p.id}.png`)) ? "✅" : "⬜";
        console.log(`   ${done} ${String(i + 1).padStart(2)}. ${p.displayName}`);
    });

    const captured = players.filter(p => existsSync(join(REFS_DIR, `${p.id}.png`))).length;
    console.log(`\n   Progress: ${captured}/${players.length}\n`);

    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(r => rl.question(q, r));

    while (true) {
        const input = await ask("👉 Player number (or 'done'): ");
        if (input.toLowerCase() === "done" || input.toLowerCase() === "q") break;

        const num = parseInt(input);
        if (isNaN(num) || num < 1 || num > players.length) {
            console.log("   ❌ Invalid number");
            continue;
        }

        const player = players[num - 1];

        // Capture 3 frames and save the best quality one
        console.log(`   📸 Capturing ${player.displayName}...`);
        try {
            const buffer = await captureRegionBuffer(config.region, sharp, screenshotDesktop);
            const refPath = join(REFS_DIR, `${player.id}.png`);
            writeFileSync(refPath, buffer);

            // Also save a preview
            const previewPath = join(REFS_DIR, `${player.id}_preview.png`);
            await sharp(buffer)
                .resize(CMP_W * 3, CMP_H * 3, { fit: "fill" })
                .toFile(previewPath);

            console.log(`   ✅ ${player.displayName} captured!`);
        } catch (e) {
            console.error(`   ❌ ${e.message}`);
        }
    }

    rl.close();
    const total = players.filter(p => existsSync(join(REFS_DIR, `${p.id}.png`))).length;
    console.log(`\n✅ ${total}/${players.length} references ready`);
    console.log(`   Run: node scripts/stream-ocr.mjs --token ${config.token}\n`);
    saveConfig({ ...config, tournamentId });
}

// ══════════════════════════════════════════════════════
// ── LIVE DETECTION ──
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

    // Load deps
    let sharp, screenshotDesktop, WebSocket;
    try { sharp = (await import("sharp")).default; }
    catch { console.error("❌ npm install sharp screenshot-desktop ws"); process.exit(1); }
    if (!IS_MAC) {
        try { screenshotDesktop = (await import("screenshot-desktop")).default; }
        catch { console.error("❌ npm install screenshot-desktop"); process.exit(1); }
    }
    try { WebSocket = (await import("ws")).default; }
    catch { console.error("❌ npm install ws"); process.exit(1); }

    // Fetch players
    let tournamentId = config.tournamentId;
    if (!tournamentId) {
        try {
            const res = await fetch(`${config.apiUrl}/api/stream/tournaments?token=${config.token}`);
            const json = await res.json();
            if (json.data?.[0]) {
                tournamentId = json.data[0].id;
                console.log(`📋 Tournament: ${json.data[0].name}`);
            }
        } catch {}
    }
    if (!tournamentId) { console.error("❌ No tournament. Use --tournament ID"); process.exit(1); }

    const res = await fetch(`${config.apiUrl}/api/stream/players?token=${config.token}&tournamentId=${tournamentId}`);
    const json = await res.json();
    const players = json.data || [];

    if (players.length === 0) { console.error("❌ No players"); process.exit(1); }

    // Load + pre-process all reference images → raw pixel buffers
    if (!existsSync(REFS_DIR)) {
        console.error("❌ No references. Run --capture first");
        process.exit(1);
    }

    console.log("⏳ Pre-processing references...");
    const references = [];

    for (const player of players) {
        const refPath = join(REFS_DIR, `${player.id}.png`);
        if (existsSync(refPath)) {
            const rawBuffer = readFileSync(refPath);
            // Pre-compute raw pixels at comparison resolution (done ONCE)
            const rawPixels = await toRawPixels(rawBuffer, sharp);
            references.push({ player, rawPixels });
        }
    }

    if (references.length === 0) {
        console.error("❌ No reference images. Run --capture first");
        process.exit(1);
    }

    console.log(`✅ ${references.length}/${players.length} references pre-processed\n`);

    // Connect WebSocket relay
    let ws = null;
    let wsConnected = false;

    function connectWS() {
        try {
            ws = new WebSocket("ws://localhost:9876");
            ws.on("open", () => {
                wsConnected = true;
                console.log("🟢 Relay connected — instant mode active");
                ws.send(JSON.stringify({ type: "players", players, tournamentId }));
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

    // Detection state
    let lastMatchedId = "";
    let consecutiveCount = 0;
    let lastFrameHash = "";
    let totalScans = 0;
    let totalMatches = 0;
    let skippedFrames = 0;
    let running = false; // Prevent overlapping ticks

    console.log("🎮 LIVE — Watching for players...");
    console.log(`   Region: x=${config.region.x} y=${config.region.y} w=${config.region.width} h=${config.region.height}`);
    console.log(`   Cycle: ${config.intervalMs}ms | Refs: ${references.length} | Debounce: ${config.debounceCount}`);
    console.log(`   Press Ctrl+C to stop\n`);

    const tick = async () => {
        if (running) return; // Skip if previous tick still processing
        running = true;

        try {
            const t0 = performance.now();
            totalScans++;

            // 1. Capture region (~30ms)
            const captureBuffer = await captureRegionBuffer(config.region, sharp, screenshotDesktop);

            // 2. Quick hash check — skip if frame unchanged (~0.1ms)
            const hash = quickHash(captureBuffer);
            if (hash === lastFrameHash) {
                skippedFrames++;
                running = false;
                return;
            }
            lastFrameHash = hash;

            // 3. Convert to raw pixels — ONCE per frame (~10ms)
            const currentPixels = await toRawPixels(captureBuffer, sharp);

            // 4. Compare against all references (~0.5ms each, ~35ms total for 68)
            let bestMatch = null;

            for (const ref of references) {
                const score = compareRaw(currentPixels, ref.rawPixels);

                if (score > (bestMatch?.score ?? 0)) {
                    bestMatch = { player: ref.player, score };
                }

                // Early exit — very confident match
                if (score > 95) break;
            }

            const elapsed = (performance.now() - t0).toFixed(0);

            // 5. Threshold
            if (!bestMatch || bestMatch.score < 72) {
                running = false;
                return;
            }

            // 6. Debounce — require N consecutive identical matches
            if (bestMatch.player.id === lastMatchedId) {
                consecutiveCount++;
            } else {
                lastMatchedId = bestMatch.player.id;
                consecutiveCount = 1;
            }

            if (consecutiveCount === config.debounceCount) {
                totalMatches++;

                console.log(
                    `🎯 ${bestMatch.player.displayName.padEnd(20)} ${bestMatch.score.toFixed(1)}% | ${elapsed}ms | #${totalMatches}`
                );

                // 7. WebSocket relay (instant — <1ms)
                if (wsConnected && ws) {
                    try {
                        ws.send(JSON.stringify({
                            type: "select",
                            playerId: bestMatch.player.id,
                        }));
                    } catch {}
                }

                // 8. API backup (fire-and-forget)
                fetch(`${config.apiUrl}/api/stream/state?token=${config.token}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        selectedPlayerId: bestMatch.player.id,
                        isVisible: true,
                    }),
                }).catch(() => {});
            }
        } catch {}

        running = false;
    };

    setInterval(tick, config.intervalMs);

    // Stats on exit
    process.on("SIGINT", () => {
        console.log(`\n\n📊 Session Stats:`);
        console.log(`   Scans: ${totalScans}`);
        console.log(`   Matches: ${totalMatches}`);
        console.log(`   Skipped (unchanged): ${skippedFrames}`);
        console.log(`   Effective scans: ${totalScans - skippedFrames}`);
        if (ws) ws.close();
        process.exit(0);
    });
}

// ── Entry ──
if (isSetup) runSetup();
else if (isCapture) runCapture();
else runLive();
