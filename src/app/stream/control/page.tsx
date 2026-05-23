"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import "./control.css";

interface PlayerData {
    id: string;
    displayName: string;
    imageUrl: string | null;
    category: string;
    stats: { kills: number; matches: number; kd: number };
    wins: number;
}

interface Tournament {
    id: string;
    name: string;
    startDate: string;
    status: string;
    type: string;
    teamCount: number;
}

const TIER_LABELS: Record<string, string> = {
    LEGEND: "Legend",
    ULTRA_PRO: "Ultra Pro",
    PRO: "Pro",
    NOOB: "Noob",
    ULTRA_NOOB: "Ultra Noob",
    BOT: "Bot",
};

export default function StreamControl() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [selectedTournament, setSelectedTournament] = useState<string>("");
    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [loading, setLoading] = useState(false);
    const [lastOcrName, setLastOcrName] = useState<string | null>(null);
    const [wsStatus, setWsStatus] = useState<"connected" | "disconnected">("disconnected");

    // WebSocket connection to local relay server
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let reconnectTimer: ReturnType<typeof setTimeout>;
        let mounted = true;

        const connect = () => {
            if (!mounted) return;
            try {
                const ws = new WebSocket("ws://localhost:9876");
                wsRef.current = ws;
                ws.onopen = () => setWsStatus("connected");
                ws.onclose = () => {
                    setWsStatus("disconnected");
                    wsRef.current = null;
                    if (mounted) reconnectTimer = setTimeout(connect, 2000);
                };
                ws.onerror = () => ws.close();
            } catch {
                if (mounted) reconnectTimer = setTimeout(connect, 2000);
            }
        };

        connect();
        return () => { mounted = false; clearTimeout(reconnectTimer); wsRef.current?.close(); };
    }, []);

    // Send message through WebSocket + BroadcastChannel
    const relay = useCallback((msg: Record<string, unknown>) => {
        // WebSocket (for OBS overlay)
        try {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(msg));
            }
        } catch {}
        // BroadcastChannel (for same-browser overlay tab)
        try {
            const bc = new BroadcastChannel("stream-overlay");
            bc.postMessage(msg);
            bc.close();
        } catch {}
    }, []);

    // Fetch tournaments on mount
    useEffect(() => {
        if (!token) return;
        fetch(`/api/stream/tournaments?token=${token}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.data) setTournaments(json.data);
            })
            .catch(() => {});
    }, [token]);

    // Fetch players when tournament changes
    useEffect(() => {
        if (!token || !selectedTournament) {
            setPlayers([]);
            return;
        }

        setLoading(true);
        fetch(`/api/stream/players?token=${token}&tournamentId=${selectedTournament}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.data) {
                    setPlayers(json.data);

                    // Preload all images on this tab
                    for (const p of json.data) {
                        if (p.imageUrl) {
                            const img = new Image();
                            img.src = p.imageUrl;
                        }
                    }

                    // Send full player list to overlay (WebSocket + BroadcastChannel)
                    relay({
                        type: "players",
                        players: json.data,
                        tournamentId: selectedTournament,
                    });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));

        // Also set the tournament in the stream state
        fetch(`/api/stream/state?token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournamentId: selectedTournament }),
        }).catch(() => {});
    }, [token, selectedTournament, relay]);

    // Poll state to stay in sync with OCR
    useEffect(() => {
        if (!token) return;
        let mounted = true;

        const poll = async () => {
            try {
                const res = await fetch(`/api/stream/state?token=${token}`);
                const json = await res.json();
                if (!mounted || !json.data) return;

                setSelectedPlayerId(json.data.selectedPlayerId || null);
                setIsVisible(json.data.isVisible);

                if (json.data.tournamentId && !selectedTournament) {
                    setSelectedTournament(json.data.tournamentId);
                }
            } catch {}
        };

        poll();
        const interval = setInterval(poll, 2000);
        return () => { mounted = false; clearInterval(interval); };
    }, [token, selectedTournament]);

    // Select a player
    const selectPlayer = useCallback(
        async (playerId: string) => {
            if (!token) return;
            setSelectedPlayerId(playerId);
            setIsVisible(true);

            // Instant relay to overlay
            relay({ type: "select", playerId });

            // Save to API for persistence
            try {
                await fetch(`/api/stream/state?token=${token}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ selectedPlayerId: playerId, isVisible: true }),
                });
            } catch {}
        },
        [token, relay]
    );

    // Toggle visibility
    const toggleVisibility = useCallback(async () => {
        if (!token) return;
        const newVisible = !isVisible;
        setIsVisible(newVisible);

        relay({ type: "visibility", isVisible: newVisible });

        try {
            await fetch(`/api/stream/state?token=${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isVisible: newVisible }),
            });
        } catch {}
    }, [token, isVisible, relay]);

    // Clear selection
    const clearSelection = useCallback(async () => {
        if (!token) return;
        setSelectedPlayerId(null);
        setIsVisible(false);

        relay({ type: "clear" });

        try {
            await fetch(`/api/stream/state?token=${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selectedPlayerId: null, isVisible: false }),
            });
            setIsVisible(false);
        } catch {}
    }, [token]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLSelectElement) return;

            if (e.code === "Space") {
                e.preventDefault();
                toggleVisibility();
            } else if (e.code === "Escape") {
                e.preventDefault();
                clearSelection();
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [toggleVisibility, clearSelection]);

    if (!token) {
        return (
            <div className="control-container">
                <div className="empty-text">
                    Missing token. Use: /stream/control?token=YOUR_STREAM_TOKEN
                </div>
            </div>
        );
    }

    return (
        <div className="control-container">
            {/* Header */}
            <div className="control-header">
                <div className="control-title">
                    <span className="icon">🎮</span>
                    Stream Overlay Control
                </div>
                <div className="header-actions">
                    <button
                        className={`toggle-btn ${isVisible ? "visible" : "hidden"}`}
                        onClick={toggleVisibility}
                    >
                        {isVisible ? "👁️ Overlay: Visible" : "🚫 Overlay: Hidden"}
                    </button>
                    {selectedPlayerId && (
                        <button
                            className="toggle-btn hidden"
                            onClick={clearSelection}
                        >
                            ✕ Clear
                        </button>
                    )}
                    <span className="shortcut-hint">
                        <kbd>Space</kbd> toggle &nbsp; <kbd>Esc</kbd> clear
                    </span>
                </div>
            </div>

            {/* Tournament Select */}
            <div className="tournament-select-wrapper">
                <label>Tournament</label>
                <select
                    className="tournament-select"
                    value={selectedTournament}
                    onChange={(e) => setSelectedTournament(e.target.value)}
                >
                    <option value="">— Select a tournament —</option>
                    {tournaments.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name} ({t.teamCount} teams) —{" "}
                            {new Date(t.startDate).toLocaleDateString()}
                        </option>
                    ))}
                </select>
            </div>

            {/* Player Grid */}
            {loading ? (
                <div className="loading-text">Loading players...</div>
            ) : players.length === 0 && selectedTournament ? (
                <div className="empty-text">No players found for this tournament</div>
            ) : (
                <div className="player-grid">
                    {players.map((p) => (
                        <div
                            key={p.id}
                            className={`player-card ${selectedPlayerId === p.id ? "active" : ""}`}
                            data-tier={p.category}
                            onClick={() => selectPlayer(p.id)}
                        >
                            <div className="card-player-name">
                                {p.displayName || "Unknown"}
                            </div>
                            <div className="card-tier-badge">
                                <span className="card-tier-dot" />
                                {TIER_LABELS[p.category] || p.category}
                            </div>
                            <div className="card-stats">
                                KD: <span>{p.stats.kd.toFixed(1)}</span>
                                &nbsp;&nbsp;Kills: <span>{p.stats.kills}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Relay Status */}
            <div className="ocr-status">
                <span className={`ocr-dot ${wsStatus === "connected" ? "active" : ""}`} />
                {wsStatus === "connected"
                    ? "Relay: 🟢 Connected (instant mode)"
                    : "Relay: ⚪ Not running — run: node scripts/stream-relay.mjs"}
            </div>

            {/* OCR Status */}
            <div className="ocr-status">
                <span className={`ocr-dot ${lastOcrName ? "active" : ""}`} />
                {lastOcrName ? (
                    <>
                        OCR detected: <span className="ocr-name">&quot;{lastOcrName}&quot;</span>
                    </>
                ) : (
                    "OCR: Waiting for detection..."
                )}
            </div>
        </div>
    );
}
