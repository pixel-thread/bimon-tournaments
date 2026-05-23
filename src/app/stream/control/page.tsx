"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import "./control.css";

interface PlayerData {
    id: string;
    displayName: string;
    imageUrl: string | null;
    category: string;
    stats: { kills: number; matches: number; kd: number };
    streak: { current: number; longest: number };
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
                if (json.data) setPlayers(json.data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));

        // Also set the tournament in the stream state
        fetch(`/api/stream/state?token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournamentId: selectedTournament }),
        }).catch(() => {});
    }, [token, selectedTournament]);

    // Poll state to stay in sync with OCR
    useEffect(() => {
        if (!token) return;
        let mounted = true;

        const poll = async () => {
            try {
                const res = await fetch(`/api/stream/state?token=${token}`);
                const json = await res.json();
                if (!mounted || !json.data) return;

                setSelectedPlayerId(json.data.selectedPlayer?.id || null);
                setIsVisible(json.data.isVisible);

                // Track tournament from state
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
            try {
                await fetch(`/api/stream/state?token=${token}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        selectedPlayerId: playerId,
                        isVisible: true,
                    }),
                });
                setIsVisible(true);
            } catch {}
        },
        [token]
    );

    // Toggle visibility
    const toggleVisibility = useCallback(async () => {
        if (!token) return;
        const newVisible = !isVisible;
        setIsVisible(newVisible);
        try {
            await fetch(`/api/stream/state?token=${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isVisible: newVisible }),
            });
        } catch {}
    }, [token, isVisible]);

    // Clear selection
    const clearSelection = useCallback(async () => {
        if (!token) return;
        setSelectedPlayerId(null);
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

            {/* OCR Status */}
            <div className="ocr-status">
                <span className={`ocr-dot ${lastOcrName ? "active" : ""}`} />
                {lastOcrName ? (
                    <>
                        OCR detected: <span className="ocr-name">&quot;{lastOcrName}&quot;</span>
                    </>
                ) : (
                    "OCR: Waiting for detection... (run the OCR script)"
                )}
            </div>
        </div>
    );
}
