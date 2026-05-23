#!/usr/bin/env node

/**
 * Stream OCR Auto-Detect Script (Cross-platform: macOS + Windows)
 *
 * Captures a screen region (where the spectated player name appears in BGMI),
 * runs OCR on it, and POSTs the detected name to the stream overlay API.
 *
 * Usage:
 *   node scripts/stream-ocr.mjs --token YOUR_TOKEN --api https://bgmi.pixel-thread.in
 *   node scripts/stream-ocr.mjs --setup          # Configure capture region
 *
 * Requirements:
 *   npm install tesseract.js sharp screenshot-desktop
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, tmpdir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IS_WINDOWS = platform() === "win32";
const IS_MAC = platform() === "darwin";

const CONFIG_PATH = join(__dirname, ".stream-ocr-config.json");
const CAPTURE_PATH = join(tmpdir(), "stream-ocr-capture.png");
const PROCESSED_PATH = join(tmpdir(), "stream-ocr-processed.png");

// ── Default config ──
const DEFAULT_CONFIG = {
    // Default region: bottom-center of a 1920x1080 Scrcpy window
    // This targets the spectated player name in BGMI
    region: { x: 340, y: 490, width: 300, height: 40 },
    apiUrl: "https://bgmi.pixel-thread.in",
    token: "",
    intervalMs: 600,
    confidenceThreshold: 0.5,
    debounceCount: 2,
};

// ── Parse CLI args ──
const args = process.argv.slice(2);
const isSetup = args.includes("--setup");
const tokenArg = args.find((_, i) => args[i - 1] === "--token");
const apiUrlArg = args.find((_, i) => args[i - 1] === "--api");
const regionArg = args.find((_, i) => args[i - 1] === "--region");

// ── Load or create config ──
function loadConfig() {
    if (existsSync(CONFIG_PATH)) {
        try {
            return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) };
        } catch {
            return { ...DEFAULT_CONFIG };
        }
    }
    return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`✅ Config saved to ${CONFIG_PATH}`);
}

/**
 * Capture a screen region and save to a file.
 * - macOS: uses native `screencapture -R` (fast, region-only)
 * - Windows: uses `screenshot-desktop` + `sharp` crop
 */
async function captureRegion(region, outputPath, sharp, screenshotDesktop) {
    const { x, y, width, height } = region;

    if (IS_MAC) {
        execSync(`screencapture -x -R ${x},${y},${width},${height} "${outputPath}"`, {
            timeout: 3000,
        });
    } else {
        // Windows/Linux: capture full screen, then crop with sharp
        const fullScreenBuffer = await screenshotDesktop();
        await sharp(fullScreenBuffer)
            .extract({ left: x, top: y, width, height })
            .toFile(outputPath);
    }
}

/**
 * Capture full screen for setup mode.
 */
async function captureFullScreen(outputPath, screenshotDesktop) {
    if (IS_MAC) {
        execSync(`screencapture -x "${outputPath}"`);
    } else {
        const screenshotModule = screenshotDesktop || (await import("screenshot-desktop")).default;
        const buffer = await screenshotModule();
        writeFileSync(outputPath, buffer);
    }
}

/**
 * Open a file with the default viewer.
 */
function openFile(filePath) {
    try {
        if (IS_MAC) execSync(`open "${filePath}"`);
        else if (IS_WINDOWS) execSync(`start "" "${filePath}"`, { shell: true });
        else execSync(`xdg-open "${filePath}"`);
    } catch {}
}

// ── Setup mode ──
async function runSetup() {
    console.log("\n🔧 Stream OCR Setup\n");
    console.log(`   Platform: ${IS_WINDOWS ? "Windows" : IS_MAC ? "macOS" : "Linux"}`);
    console.log("   This will help you configure the capture region.");
    console.log("   The region should cover the spectated player name in BGMI.\n");

    // Try to load screenshot-desktop for Windows
    let screenshotDesktop = null;
    if (!IS_MAC) {
        try {
            screenshotDesktop = (await import("screenshot-desktop")).default;
        } catch {
            console.error("❌ Missing dependency for Windows screenshots:");
            console.error("   npm install screenshot-desktop");
            process.exit(1);
        }
    }

    // Capture full screen for reference
    const fullCapturePath = join(tmpdir(), "stream-ocr-fullscreen.png");
    console.log("📸 Capturing full screen...");
    await captureFullScreen(fullCapturePath, screenshotDesktop);
    console.log(`   Screenshot saved to: ${fullCapturePath}`);

    openFile(fullCapturePath);

    console.log("\n📐 Find the player name region:");
    console.log("   1. Open the screenshot");
    console.log("   2. Note the pixel coordinates of the player name area");
    console.log("   3. Run again with --region to set it\n");

    const config = loadConfig();

    // Parse region from CLI if provided
    if (regionArg) {
        const [x, y, w, h] = regionArg.split(",").map(Number);
        if (x >= 0 && y >= 0 && w > 0 && h > 0) {
            config.region = { x, y, width: w, height: h };
            console.log(`   ✅ Region set to: x=${x}, y=${y}, width=${w}, height=${h}`);
        }
    } else {
        console.log("   To set the region, run:");
        console.log('   node scripts/stream-ocr.mjs --setup --region "X,Y,WIDTH,HEIGHT"\n');
        console.log(`   Current region: x=${config.region.x}, y=${config.region.y}, w=${config.region.width}, h=${config.region.height}`);
    }

    // Set token & API URL
    if (tokenArg) config.token = tokenArg;
    if (apiUrlArg) config.apiUrl = apiUrlArg;

    // Test capture with region
    console.log("\n📸 Testing capture with current region...");
    try {
        let sharp = (await import("sharp")).default;
        await captureRegion(config.region, CAPTURE_PATH, sharp, screenshotDesktop);
        console.log(`   Test capture saved to: ${CAPTURE_PATH}`);
        openFile(CAPTURE_PATH);
        console.log("   ☝️ Check if this captures the player name area correctly.\n");
    } catch (e) {
        console.error(`   ❌ Capture failed: ${e.message}`);
    }

    saveConfig(config);
    console.log("\n✅ Setup complete! Start the OCR with:");
    console.log(`   node scripts/stream-ocr.mjs --token bimon-stream-2026 --api https://bgmi.pixel-thread.in\n`);
}

// ── Main OCR loop ──
async function runOCR() {
    const config = loadConfig();

    // Override from CLI
    if (tokenArg) config.token = tokenArg;
    if (apiUrlArg) config.apiUrl = apiUrlArg;
    if (regionArg) {
        const [x, y, w, h] = regionArg.split(",").map(Number);
        if (x >= 0 && y >= 0 && w > 0 && h > 0) {
            config.region = { x, y, width: w, height: h };
        }
    }

    if (!config.token) {
        console.error("❌ No token set. Run with --token YOUR_TOKEN");
        process.exit(1);
    }

    // Dynamically import dependencies
    let Tesseract, sharp, screenshotDesktop;
    try {
        Tesseract = await import("tesseract.js");
        sharp = (await import("sharp")).default;
    } catch {
        console.error("❌ Missing dependencies. Install them:");
        console.error("   npm install tesseract.js sharp screenshot-desktop");
        process.exit(1);
    }

    // Windows needs screenshot-desktop
    if (!IS_MAC) {
        try {
            screenshotDesktop = (await import("screenshot-desktop")).default;
        } catch {
            console.error("❌ Missing dependency for Windows screenshots:");
            console.error("   npm install screenshot-desktop");
            process.exit(1);
        }
    }

    console.log("\n🎮 Stream OCR Auto-Detect");
    console.log(`   Platform: ${IS_WINDOWS ? "Windows" : IS_MAC ? "macOS" : "Linux"}`);
    console.log(`   API: ${config.apiUrl}`);
    console.log(`   Region: x=${config.region.x} y=${config.region.y} w=${config.region.width} h=${config.region.height}`);
    console.log(`   Interval: ${config.intervalMs}ms`);
    console.log(`   Press Ctrl+C to stop\n`);

    // Initialize Tesseract worker
    console.log("⏳ Loading OCR engine...");
    const worker = await Tesseract.createWorker("eng");
    await worker.setParameters({
        tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-|.·•",
        tessedit_pageseg_mode: "7", // Single line
    });
    console.log("✅ OCR engine ready!\n");

    let lastDetectedName = "";
    let consecutiveCount = 0;
    let lastSentName = "";

    const { width, height } = config.region;

    // Main loop
    const tick = async () => {
        try {
            // 1. Capture screen region
            await captureRegion(config.region, CAPTURE_PATH, sharp, screenshotDesktop);

            // 2. Pre-process image for better OCR
            await sharp(CAPTURE_PATH)
                .greyscale()
                .negate() // Invert — white text on dark bg → dark text on light bg
                .normalise() // Maximize contrast
                .sharpen()
                .resize(width * 3, height * 3, { fit: "fill" }) // Scale up 3x for better OCR
                .toFile(PROCESSED_PATH);

            // 3. Run OCR
            const result = await worker.recognize(PROCESSED_PATH);
            let rawText = result.data.text.trim();

            // 4. Clean up — strip team number prefix and artifacts
            // BGMI format: "Team7  Lehkaibha" or just "Lehkaibha"
            rawText = rawText
                .replace(/^Team\s*\d+\s*/i, "") // Remove "Team7" prefix
                .replace(/^\d+\s+/, "") // Remove leading numbers
                .replace(/[^\w\s\-_|.·•「」]/g, "") // Keep basic chars
                .trim();

            if (!rawText || rawText.length < 2) {
                return;
            }

            const confidence = result.data.confidence;

            // 5. Debounce — require consistent detection
            if (rawText === lastDetectedName) {
                consecutiveCount++;
            } else {
                lastDetectedName = rawText;
                consecutiveCount = 1;
            }

            // Only act when we've seen the same name N times in a row
            if (consecutiveCount >= config.debounceCount && rawText !== lastSentName) {
                console.log(
                    `🔍 Detected: "${rawText}" (confidence: ${confidence.toFixed(0)}%)`
                );

                // 6. POST to API
                try {
                    const res = await fetch(
                        `${config.apiUrl}/api/stream/state?token=${config.token}`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                selectedPlayerName: rawText,
                                isVisible: true,
                            }),
                        }
                    );

                    const json = await res.json();
                    if (json.data?.selectedPlayerId) {
                        console.log(`   ✅ Matched → Player ID: ${json.data.selectedPlayerId}`);
                        lastSentName = rawText;
                    } else {
                        console.log(`   ⚠️ No match found for "${rawText}"`);
                    }
                } catch (e) {
                    console.error(`   ❌ API error: ${e.message}`);
                }
            }
        } catch (e) {
            // Capture or processing error — skip this tick
            if (e.message && !e.message.includes("timeout")) {
                console.error(`⚠️ Error: ${e.message}`);
            }
        }
    };

    // Run the loop
    console.log("👁️ Watching for player names...\n");
    setInterval(tick, config.intervalMs);

    // Graceful shutdown
    process.on("SIGINT", async () => {
        console.log("\n\n🛑 Stopping OCR...");
        await worker.terminate();
        console.log("👋 Bye!");
        process.exit(0);
    });
}

// ── Entry point ──
if (isSetup) {
    runSetup();
} else {
    runOCR();
}
