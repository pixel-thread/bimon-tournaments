"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import "./overlay.css";

interface PlayerStats {
    kills: number;
    matches: number;
    kd: number;
}

interface PlayerData {
    id: string;
    displayName: string;
    imageUrl: string | null;
    category: string;
    stats: PlayerStats;
    wins: number;
}

const TIER_LABELS: Record<string, string> = {
    LEGEND: "Legend",
    ULTRA_PRO: "Ultra Pro",
    PRO: "Pro",
    NOOB: "Noob",
    ULTRA_NOOB: "Ultra Noob",
    BOT: "Bot",
};

export default function StreamOverlay() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const bg = searchParams.get("bg");

    // Apply transparent background mode if requested (for OBS Browser Source)
    useEffect(() => {
        if (bg === "transparent") {
            document.documentElement.classList.add("bg-transparent");
        }
    }, [bg]);

    const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [animState, setAnimState] = useState<"idle" | "enter" | "exit">("idle");

    // Cache for instant switching
    const playersCache = useRef<Map<string, PlayerData>>(new Map());
    const currentPlayerIdRef = useRef<string | null>(null);
    const currentTournamentIdRef = useRef<string | null>(null);
    const isExiting = useRef(false);

    // Fetch all players for a tournament (pre-cache data + images)
    const preloadPlayers = useCallback(
        async (tournamentId: string) => {
            if (!token || tournamentId === currentTournamentIdRef.current) return;
            try {
                const res = await fetch(
                    `/api/stream/players?token=${token}&tournamentId=${tournamentId}`
                );
                const json = await res.json();
                if (json.data) {
                    const cache = new Map<string, PlayerData>();
                    for (const p of json.data) {
                        cache.set(p.id, p);
                        // Preload profile image into browser cache
                        if (p.imageUrl) {
                            const img = new Image();
                            img.src = p.imageUrl;
                        }
                    }
                    playersCache.current = cache;
                    currentTournamentIdRef.current = tournamentId;
                }
            } catch {
                // Silently fail — will use API data directly
            }
        },
        [token]
    );

    // Show a player with animation
    const showPlayer = useCallback((player: PlayerData) => {
        if (isExiting.current) {
            // Wait for exit animation to finish
            setTimeout(() => showPlayer(player), 250);
            return;
        }

        setCurrentPlayer(player);
        setAnimState("enter");
        currentPlayerIdRef.current = player.id;
    }, []);

    // Hide current player with animation
    const hidePlayer = useCallback(() => {
        if (!currentPlayer || isExiting.current) return;
        isExiting.current = true;
        setAnimState("exit");
        setTimeout(() => {
            setCurrentPlayer(null);
            setAnimState("idle");
            currentPlayerIdRef.current = null;
            isExiting.current = false;
        }, 230);
    }, [currentPlayer]);

    // WebSocket connection to local relay server (instant updates)
    const wsRef = useRef<WebSocket | null>(null);
    const wsConnected = useRef(false);

    // Handle incoming messages (from WebSocket, BroadcastChannel, or polling)
    const handleMessage = useCallback((msg: { type: string; playerId?: string; isVisible?: boolean; players?: PlayerData[]; tournamentId?: string; selectedPlayerId?: string }) => {
        if (msg.type === "sync" || msg.type === "players") {
            // Full player list — cache everything + preload images
            if (msg.players && msg.players.length > 0) {
                const cache = new Map<string, PlayerData>();
                for (const p of msg.players) {
                    cache.set(p.id, p);
                    if (p.imageUrl) {
                        const img = new Image();
                        img.src = p.imageUrl;
                    }
                }
                playersCache.current = cache;
            }
            if (msg.tournamentId) {
                currentTournamentIdRef.current = msg.tournamentId;
            }
            // For sync, also apply current selection
            if (msg.type === "sync" && msg.selectedPlayerId) {
                const playerData = playersCache.current.get(msg.selectedPlayerId);
                if (playerData) showPlayer(playerData);
            }
        } else if (msg.type === "select" && msg.playerId) {
            const playerData = playersCache.current.get(msg.playerId);
            if (playerData) {
                setIsVisible(true);
                if (currentPlayerIdRef.current && currentPlayerIdRef.current !== msg.playerId) {
                    isExiting.current = true;
                    setAnimState("exit");
                    setTimeout(() => {
                        setCurrentPlayer(null);
                        isExiting.current = false;
                        showPlayer(playerData);
                    }, 230);
                } else if (!currentPlayerIdRef.current) {
                    showPlayer(playerData);
                }
            }
        } else if (msg.type === "visibility") {
            setIsVisible(!!msg.isVisible);
            if (!msg.isVisible && currentPlayerIdRef.current) {
                hidePlayer();
            }
        } else if (msg.type === "clear") {
            hidePlayer();
            setIsVisible(false);
        }
    }, [showPlayer, hidePlayer]);

    // Connect to local WebSocket relay server
    useEffect(() => {
        let reconnectTimer: ReturnType<typeof setTimeout>;
        let mounted = true;

        const connect = () => {
            if (!mounted) return;
            try {
                const ws = new WebSocket("ws://localhost:9876");
                wsRef.current = ws;

                ws.onopen = () => {
                    wsConnected.current = true;
                    console.log("🟢 Connected to relay server");
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        handleMessage(msg);
                    } catch {}
                };

                ws.onclose = () => {
                    wsConnected.current = false;
                    wsRef.current = null;
                    // Reconnect after 2s
                    if (mounted) reconnectTimer = setTimeout(connect, 2000);
                };

                ws.onerror = () => {
                    ws.close();
                };
            } catch {
                // WebSocket not available — will use polling fallback
                if (mounted) reconnectTimer = setTimeout(connect, 2000);
            }
        };

        connect();

        return () => {
            mounted = false;
            clearTimeout(reconnectTimer);
            wsRef.current?.close();
        };
    }, [handleMessage]);

    // Also listen for BroadcastChannel (same-browser tabs, e.g. control panel)
    useEffect(() => {
        let bc: BroadcastChannel;
        try {
            bc = new BroadcastChannel("stream-overlay");
            bc.onmessage = (event) => handleMessage(event.data);
        } catch {}

        return () => { try { bc?.close(); } catch {} };
    }, [handleMessage]);

    // API polling fallback (when WebSocket relay is not running)
    useEffect(() => {
        if (!token) return;

        let mounted = true;

        const poll = async () => {
            // Skip polling if WebSocket is connected (relay handles updates)
            if (wsConnected.current) return;

            try {
                const res = await fetch(`/api/stream/state?token=${token}`);
                const json = await res.json();
                if (!mounted || !json.data) return;

                const { selectedPlayerId: newPlayerId, isVisible: visible, tournamentId } = json.data;

                if (tournamentId && tournamentId !== currentTournamentIdRef.current) {
                    preloadPlayers(tournamentId);
                }

                setIsVisible(visible);

                if (!visible) {
                    if (currentPlayerIdRef.current) hidePlayer();
                    return;
                }

                const oldPlayerId = currentPlayerIdRef.current;
                if (newPlayerId !== oldPlayerId) {
                    if (!newPlayerId) {
                        hidePlayer();
                    } else {
                        const playerData = playersCache.current.get(newPlayerId);
                        if (playerData) {
                            if (oldPlayerId) {
                                isExiting.current = true;
                                setAnimState("exit");
                                setTimeout(() => {
                                    setCurrentPlayer(null);
                                    isExiting.current = false;
                                    showPlayer(playerData);
                                }, 230);
                            } else {
                                showPlayer(playerData);
                            }
                        }
                    }
                }
            } catch {}
        };

        poll();
        const interval = setInterval(poll, 500);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [token, preloadPlayers, showPlayer, hidePlayer]);

    // Don't render anything if no player or hidden
    if (!currentPlayer || !isVisible) {
        return <div style={{ background: "transparent" }} />;
    }

    const tier = currentPlayer.category || "NOOB";

    return (
        <div className="overlay-container" data-tier={tier}>
            <div className={`stats-card ${animState === "enter" ? "card-enter" : ""} ${animState === "exit" ? "card-exit" : ""}`}>
                {/* Player Header */}
                <div className="player-header">
                    {currentPlayer.imageUrl ? (
                        <img
                            className="player-avatar"
                            src={currentPlayer.imageUrl}
                            alt={currentPlayer.displayName || "Player"}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden-placeholder");
                            }}
                        />
                    ) : (
                        <div className="player-avatar-placeholder">
                            {(currentPlayer.displayName || "?")[0].toUpperCase()}
                        </div>
                    )}
                    <div className="player-info">
                        <div className="player-name">
                            {currentPlayer.displayName || "Unknown"}
                        </div>
                        <div className="player-tier">
                            <span className="tier-dot" />
                            {TIER_LABELS[tier] || tier}
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-item">
                        <div className="stat-value kd-value">
                            {currentPlayer.stats.kd.toFixed(1)}
                        </div>
                        <div className="stat-label">K/D</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">{currentPlayer.stats.kills}</div>
                        <div className="stat-label">Kills</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">{currentPlayer.stats.matches}</div>
                        <div className="stat-label">Matches</div>
                    </div>
                </div>

                {/* Bottom Row */}
                <div className="stats-bottom">
                    <div className="stat-pill">
                        <span className="emoji">🍗</span>
                        <span className="pill-value">{currentPlayer.wins}</span>
                        Wins
                    </div>
                </div>
            </div>
        </div>
    );
}
