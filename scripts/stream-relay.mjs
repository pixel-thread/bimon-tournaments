#!/usr/bin/env node

/**
 * Stream Relay Server (Local WebSocket)
 *
 * Runs on your streaming PC. The overlay + control panel + OCR script
 * all connect to this, so switching is instant (no network round-trip).
 *
 * Usage:
 *   node scripts/stream-relay.mjs
 *
 * Requirements:
 *   npm install ws
 *
 * Connects:
 *   - Overlay (OBS Browser Source) → ws://localhost:9876
 *   - Control Panel (browser tab) → ws://localhost:9876
 *   - OCR Script → ws://localhost:9876
 */

import { WebSocketServer, WebSocket } from "ws";

const PORT = 9876;
const wss = new WebSocketServer({ port: PORT });

// Track current state
let currentState = {
    selectedPlayerId: null,
    isVisible: true,
    tournamentId: null,
    players: [], // full player list for cache
};

const clients = new Set();

wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`✅ Client connected (${clients.size} total)`);

    // Send current state to new client immediately
    ws.send(JSON.stringify({ type: "sync", ...currentState }));

    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data.toString());

            // Update local state
            if (msg.type === "select" && msg.playerId) {
                currentState.selectedPlayerId = msg.playerId;
                currentState.isVisible = true;
                console.log(`🎯 Player selected: ${msg.playerId}`);
            } else if (msg.type === "visibility") {
                currentState.isVisible = msg.isVisible;
                console.log(`👁️ Visibility: ${msg.isVisible}`);
            } else if (msg.type === "clear") {
                currentState.selectedPlayerId = null;
                currentState.isVisible = false;
                console.log(`🚫 Cleared`);
            } else if (msg.type === "players") {
                currentState.players = msg.players || [];
                currentState.tournamentId = msg.tournamentId || currentState.tournamentId;
                console.log(`📋 Players cached: ${currentState.players.length}`);
            } else if (msg.type === "ocr") {
                // OCR detected a player — fuzzy match locally
                currentState.selectedPlayerId = msg.playerId;
                currentState.isVisible = true;
                console.log(`🔍 OCR matched: ${msg.playerId}`);
            }

            // Broadcast to ALL clients (including sender for confirmation)
            const broadcast = JSON.stringify(msg);
            for (const client of clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(broadcast);
                }
            }
        } catch (e) {
            console.error("⚠️ Bad message:", e.message);
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        console.log(`❌ Client disconnected (${clients.size} total)`);
    });

    ws.on("error", () => {
        clients.delete(ws);
    });
});

console.log(`\n🚀 Stream Relay Server running on ws://localhost:${PORT}`);
console.log(`\n   Waiting for connections from:`);
console.log(`   • Overlay (OBS Browser Source)`);
console.log(`   • Control Panel (browser tab)`);
console.log(`   • OCR Script`);
console.log(`\n   Press Ctrl+C to stop\n`);
