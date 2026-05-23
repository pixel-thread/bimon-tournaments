"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import "./overlay.css";

interface PlayerStats {
    kills: number;
    matches: number;
    kd: number;
}

interface PlayerStreak {
    current: number;
    longest: number;
}

interface PlayerData {
    id: string;
    displayName: string;
    imageUrl: string | null;
    category: string;
    stats: PlayerStats;
    streak: PlayerStreak;
    wins: number;
}

interface StreamState {
    selectedPlayer: PlayerData | null;
    isVisible: boolean;
    tournamentId: string | null;
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

    const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [animState, setAnimState] = useState<"idle" | "enter" | "exit">("idle");

    // Cache for instant switching
    const playersCache = useRef<Map<string, PlayerData>>(new Map());
    const currentPlayerIdRef = useRef<string | null>(null);
    const currentTournamentIdRef = useRef<string | null>(null);
    const isExiting = useRef(false);

    // Fetch all players for a tournament (pre-cache)
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

    // Poll stream state
    useEffect(() => {
        if (!token) return;

        let mounted = true;

        const poll = async () => {
            try {
                const res = await fetch(`/api/stream/state?token=${token}`);
                const json = await res.json();
                if (!mounted || !json.data) return;

                const state: StreamState = json.data;

                // Handle tournament change — preload players
                if (state.tournamentId && state.tournamentId !== currentTournamentIdRef.current) {
                    preloadPlayers(state.tournamentId);
                }

                // Handle visibility
                setIsVisible(state.isVisible);

                // Handle player change
                const newPlayerId = state.selectedPlayer?.id || null;
                const oldPlayerId = currentPlayerIdRef.current;

                if (!state.isVisible) {
                    if (currentPlayerIdRef.current) hidePlayer();
                    return;
                }

                if (newPlayerId !== oldPlayerId) {
                    if (!newPlayerId) {
                        hidePlayer();
                    } else {
                        // Try cache first, fall back to API response
                        const cached = playersCache.current.get(newPlayerId);
                        const playerData = cached || state.selectedPlayer;

                        if (playerData) {
                            if (oldPlayerId) {
                                // Transition: exit old, enter new
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
            } catch {
                // Network error — keep current state
            }
        };

        poll(); // Initial fetch
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
                        <span className="emoji">🔥</span>
                        <span className="pill-value">{currentPlayer.streak.current}</span>
                        Streak
                    </div>
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
