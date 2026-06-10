"use client";

import { useState, useEffect } from "react";
import { Send, Bell, Loader2, CheckCircle, AlertTriangle, Megaphone, Swords } from "lucide-react";

type SendingState = string | null;

interface ActiveTournament {
    id: string;
    name: string;
}

export default function PushTestPage() {
    const [roomId, setRoomId] = useState("ABCD1234");
    const [password, setPassword] = useState("9876");
    const [map, setMap] = useState("Erangel");
    const [matchNumber, setMatchNumber] = useState(1);
    const [sending, setSending] = useState<SendingState>(null);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [diagnostics, setDiagnostics] = useState<any>(null);

    // Broadcast fields
    const [broadcastTitle, setBroadcastTitle] = useState("");
    const [broadcastBody, setBroadcastBody] = useState("");

    // Tournament selector
    const [tournaments, setTournaments] = useState<ActiveTournament[]>([]);
    const [selectedTournament, setSelectedTournament] = useState("");

    useEffect(() => {
        fetch("/api/tournaments?status=ACTIVE&limit=10")
            .then((r) => r.json())
            .then((json) => {
                const list = json.data || [];
                setTournaments(list);
                if (list.length > 0) setSelectedTournament(list[0].id);
            })
            .catch(() => {});
    }, []);

    async function sendTest(mode: string) {
        setSending(mode);
        setResult(null);
        setDiagnostics(null);
        try {
            const res = await fetch("/api/push/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode, roomId, password, map, matchNumber,
                    tournamentId: selectedTournament || undefined,
                }),
            });
            const data = await res.json();
            setDiagnostics(data.data);
            setResult({
                ok: data.success,
                message: data.message || (data.success ? `✅ Sent! (${mode})` : `❌ ${data.message}`),
            });
        } catch {
            setResult({ ok: false, message: "❌ Network error" });
        } finally {
            setSending(null);
        }
    }

    async function sendBroadcast(target: "self" | "all") {
        if (!broadcastTitle.trim() || !broadcastBody.trim()) {
            setResult({ ok: false, message: "❌ Title and message are required" });
            return;
        }
        const key = `broadcast-${target}`;
        setSending(key);
        setResult(null);
        setDiagnostics(null);
        try {
            const res = await fetch("/api/push/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "broadcast",
                    target,
                    title: broadcastTitle.trim(),
                    body: broadcastBody.trim(),
                }),
            });
            const data = await res.json();
            setDiagnostics(data.data);
            setResult({
                ok: data.success,
                message: data.message || (data.success
                    ? `✅ Broadcast sent to ${data.data?.delivered || 0} device(s)!`
                    : `❌ ${data.message}`),
            });
        } catch {
            setResult({ ok: false, message: "❌ Network error" });
        } finally {
            setSending(null);
        }
    }

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "10px 12px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        color: "#fff",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 600,
        color: "#888",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        display: "block",
        marginBottom: 6,
    };

    return (
        <div style={{
            minHeight: "100dvh",
            background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
            color: "#e0e0e0",
            padding: "24px 16px",
            fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
            <div style={{ maxWidth: 480, margin: "0 auto" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
                    <Bell style={{ width: 24, height: 24, color: "#818cf8" }} />
                    <h1 style={{
                        fontSize: 22, fontWeight: 700, margin: 0,
                        background: "linear-gradient(90deg, #818cf8, #a78bfa)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}>
                        Push Notification Test
                    </h1>
                </div>

                {/* ═══════════ BROADCAST MESSAGE ═══════════ */}
                <div style={{
                    background: "linear-gradient(135deg, rgba(251, 146, 60, 0.08), rgba(249, 115, 22, 0.04))",
                    border: "1px solid rgba(251, 146, 60, 0.25)",
                    borderRadius: 16,
                    padding: "20px",
                    marginBottom: 32,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <Megaphone style={{ width: 20, height: 20, color: "#fb923c" }} />
                        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fb923c" }}>
                            Broadcast Message
                        </h2>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                        <div>
                            <label style={labelStyle}>Title</label>
                            <input
                                value={broadcastTitle}
                                onChange={(e) => setBroadcastTitle(e.target.value)}
                                placeholder="e.g. Tournament Update"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Message</label>
                            <textarea
                                value={broadcastBody}
                                onChange={(e) => setBroadcastBody(e.target.value)}
                                placeholder="Type your message here..."
                                rows={3}
                                style={{
                                    ...inputStyle,
                                    resize: "vertical",
                                    minHeight: 60,
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            onClick={() => sendBroadcast("self")}
                            disabled={!!sending}
                            style={{
                                flex: 1, padding: "12px", borderRadius: 10,
                                border: "1px solid rgba(129, 140, 248, 0.3)",
                                background: "rgba(129, 140, 248, 0.1)",
                                color: "#818cf8", fontSize: 13, fontWeight: 600,
                                cursor: sending ? "not-allowed" : "pointer",
                                opacity: sending && sending !== "broadcast-self" ? 0.4 : 1,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            }}
                        >
                            {sending === "broadcast-self"
                                ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                                : <Send style={{ width: 14, height: 14 }} />
                            }
                            Send to Me
                        </button>
                        <button
                            onClick={() => {
                                if (confirm(`🚨 This will send a push notification to ALL subscribed players.\n\nTitle: ${broadcastTitle}\nMessage: ${broadcastBody}\n\nContinue?`)) {
                                    sendBroadcast("all");
                                }
                            }}
                            disabled={!!sending}
                            style={{
                                flex: 1, padding: "12px", borderRadius: 10,
                                border: "1px solid rgba(251, 146, 60, 0.3)",
                                background: "linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(249, 115, 22, 0.1))",
                                color: "#fb923c", fontSize: 13, fontWeight: 600,
                                cursor: sending ? "not-allowed" : "pointer",
                                opacity: sending && sending !== "broadcast-all" ? 0.4 : 1,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            }}
                        >
                            {sending === "broadcast-all"
                                ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                                : <Megaphone style={{ width: 14, height: 14 }} />
                            }
                            Broadcast ALL
                        </button>
                    </div>
                </div>

                {/* ═══════════ ROOM INFO TEST ═══════════ */}
                <div style={{
                    background: "rgba(129, 140, 248, 0.04)",
                    border: "1px solid rgba(129, 140, 248, 0.15)",
                    borderRadius: 16,
                    padding: "20px",
                    marginBottom: 24,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <Bell style={{ width: 18, height: 18, color: "#818cf8" }} />
                        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#818cf8" }}>
                            Room Info Test (self only)
                        </h2>
                    </div>

                    {/* Tournament selector */}
                    {tournaments.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>
                                <Swords style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                                Post to Tournament Channel
                            </label>
                            <select
                                value={selectedTournament}
                                onChange={(e) => setSelectedTournament(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    cursor: "pointer",
                                    appearance: "none",
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 12px center",
                                    paddingRight: 32,
                                }}
                            >
                                <option value="" style={{ background: "#1a1a2e" }}>None (push only)</option>
                                {tournaments.map((t) => (
                                    <option key={t.id} value={t.id} style={{ background: "#1a1a2e" }}>
                                        ⚔️ {t.name}
                                    </option>
                                ))}
                            </select>
                            {selectedTournament && (
                                <p style={{ fontSize: 11, color: "#818cf8", marginTop: 4, opacity: 0.7 }}>
                                    Room info will also be posted to the tournament channel
                                </p>
                            )}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                        <button
                            onClick={async () => {
                                try {
                                    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                                        alert("❌ Push not supported"); return;
                                    }
                                    const permission = await Notification.requestPermission();
                                    if (permission !== "granted") { alert(`❌ Permission ${permission}`); return; }
                                    const registrations = await navigator.serviceWorker.getRegistrations();
                                    if (registrations.length === 0) {
                                        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
                                    }
                                    const reg = await Promise.race([
                                        navigator.serviceWorker.ready,
                                        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("SW timeout")), 10000)),
                                    ]);
                                    const old = await reg.pushManager.getSubscription();
                                    if (old) await old.unsubscribe();
                                    const vapidKey = process.env.NEXT_PUBLIC_VAPID_TOKEN;
                                    if (!vapidKey) { alert("❌ VAPID key missing"); return; }
                                    const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
                                    const b64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
                                    const raw = atob(b64);
                                    const arr = new Uint8Array(raw.length);
                                    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
                                    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr });
                                    const json = sub.toJSON();
                                    const res = await fetch("/api/push/subscribe", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
                                    });
                                    const data = await res.json();
                                    alert(data.success ? "✅ Subscribed!" : `❌ ${data.message}`);
                                } catch (err) {
                                    alert(`❌ ${err instanceof Error ? err.message : String(err)}`);
                                }
                            }}
                            style={{
                                flex: 1, padding: "10px", borderRadius: 8,
                                border: "1px solid rgba(52, 211, 153, 0.3)",
                                background: "rgba(52, 211, 153, 0.08)",
                                color: "#34d399", fontSize: 12, fontWeight: 600, cursor: "pointer",
                            }}
                        >
                            🔔 Subscribe
                        </button>
                        <button
                            onClick={async () => {
                                const res = await fetch("/api/push/test", { method: "DELETE" });
                                const data = await res.json();
                                alert(data.message);
                                setDiagnostics(null); setResult(null);
                            }}
                            style={{
                                flex: 1, padding: "10px", borderRadius: 8,
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                background: "rgba(239, 68, 68, 0.08)",
                                color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer",
                            }}
                        >
                            🗑️ Clear subs
                        </button>
                    </div>

                    {/* Form fields */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                        {[
                            { label: "Room ID", value: roomId, set: setRoomId },
                            { label: "Password", value: password, set: setPassword },
                            { label: "Map", value: map, set: setMap },
                        ].map(({ label, value, set }) => (
                            <div key={label}>
                                <label style={labelStyle}>{label}</label>
                                <input value={value} onChange={(e) => set(e.target.value)} style={inputStyle} />
                            </div>
                        ))}
                        <div>
                            <label style={labelStyle}>Match #</label>
                            <input type="number" value={matchNumber} onChange={(e) => setMatchNumber(Number(e.target.value))} min={1} style={inputStyle} />
                        </div>
                    </div>

                    {/* Test buttons */}
                    <div style={{ display: "flex", gap: 8 }}>
                        {[
                            { mode: "normal", label: "📨 Normal", color: "#e0e0e0", border: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.04)" },
                            { mode: "sticky", label: "🔒 Sticky", color: "#818cf8", border: "rgba(129,140,248,0.3)", bg: "rgba(129,140,248,0.08)" },
                            { mode: "update", label: "🔄 Update", color: "#34d399", border: "rgba(52,211,153,0.3)", bg: "rgba(52,211,153,0.08)" },
                        ].map(({ mode, label, color, border, bg }) => (
                            <button
                                key={mode}
                                onClick={() => {
                                    if (mode === "update") setMatchNumber((n) => n + 1);
                                    sendTest(mode);
                                }}
                                disabled={!!sending}
                                style={{
                                    flex: 1, padding: "10px", borderRadius: 8,
                                    border: `1px solid ${border}`, background: bg,
                                    color, fontSize: 12, fontWeight: 600,
                                    cursor: sending ? "not-allowed" : "pointer",
                                    opacity: sending && sending !== mode ? 0.4 : 1,
                                }}
                            >
                                {sending === mode ? "..." : label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Result */}
                {result && (
                    <div style={{
                        marginTop: 20, padding: "12px 16px", borderRadius: 10,
                        display: "flex", alignItems: "center", gap: 8, fontSize: 14,
                        background: result.ok ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)",
                        border: `1px solid ${result.ok ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`,
                        color: result.ok ? "#34d399" : "#ef4444",
                    }}>
                        {result.ok
                            ? <CheckCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                            : <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                        }
                        {result.message}
                    </div>
                )}

                {/* Diagnostics */}
                {diagnostics && (
                    <div style={{
                        marginTop: 16, padding: "16px",
                        background: "rgba(255,255,255,0.03)", borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.08)",
                        fontSize: 13, lineHeight: 1.7,
                    }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: "#818cf8" }}>
                            📊 Diagnostics
                        </h3>
                        <div style={{ color: "#a0a0b8" }}>
                            <div><strong>Target:</strong> {diagnostics.target || "self"}</div>
                            <div><strong>Subscriptions:</strong> {diagnostics.subscriptionCount ?? "N/A"}</div>
                            <div><strong>Delivered:</strong> {diagnostics.delivered ?? "N/A"}</div>
                            {diagnostics.staleRemoved > 0 && (
                                <div style={{ color: "#f59e0b" }}>⚠️ Removed {diagnostics.staleRemoved} stale sub(s)</div>
                            )}
                            {diagnostics.hint && (
                                <div style={{ color: "#f59e0b", marginTop: 8 }}>💡 {diagnostics.hint}</div>
                            )}
                        </div>
                        {diagnostics.results?.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <strong style={{ color: "#a0a0b8" }}>Per-device:</strong>
                                {diagnostics.results.map((r: { endpoint: string; status: string; error?: string }, i: number) => (
                                    <div key={i} style={{
                                        marginTop: 6, padding: "8px 10px",
                                        background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12,
                                        color: r.status.includes("✅") ? "#34d399" : "#ef4444",
                                    }}>
                                        <div>{r.status}</div>
                                        <div style={{ color: "#666", fontSize: 11 }}>{r.endpoint}</div>
                                        {r.error && <div style={{ color: "#ef4444", fontSize: 11 }}>{r.error}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════ SUBSCRIBER LIST ═══════════ */}
                <SubscriberList />
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

/* ═══════════ SUBSCRIBER LIST COMPONENT ═══════════ */

interface Subscriber {
    playerId: string;
    displayName: string;
    avatar: string | null;
    devices: number;
    lastSubscribed: string;
}

function SubscriberList() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [stats, setStats] = useState({ total: 0, unique: 0 });

    async function loadSubscribers() {
        setLoading(true);
        try {
            const res = await fetch("/api/push/test");
            const json = await res.json();
            if (json.success && json.data) {
                setSubscribers(json.data.players || []);
                setStats({
                    total: json.data.totalSubscriptions || 0,
                    unique: json.data.uniquePlayers || 0,
                });
            }
            setLoaded(true);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            marginTop: 24,
            background: "rgba(52, 211, 153, 0.04)",
            border: "1px solid rgba(52, 211, 153, 0.15)",
            borderRadius: 16,
            padding: "20px",
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bell style={{ width: 18, height: 18, color: "#34d399" }} />
                    <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#34d399" }}>
                        Subscribers
                    </h2>
                    {loaded && (
                        <span style={{
                            fontSize: 11, background: "rgba(52, 211, 153, 0.15)",
                            color: "#34d399", padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                        }}>
                            {stats.unique} players · {stats.total} devices
                        </span>
                    )}
                </div>
                <button
                    onClick={loadSubscribers}
                    disabled={loading}
                    style={{
                        padding: "6px 14px", borderRadius: 8,
                        border: "1px solid rgba(52, 211, 153, 0.3)",
                        background: "rgba(52, 211, 153, 0.1)",
                        color: "#34d399", fontSize: 12, fontWeight: 600,
                        cursor: loading ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                    }}
                >
                    {loading
                        ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                        : "🔄"
                    }
                    {loaded ? "Refresh" : "Load"}
                </button>
            </div>

            {loaded && subscribers.length === 0 && (
                <p style={{ fontSize: 13, color: "#666", textAlign: "center", padding: "20px 0" }}>
                    No subscribers yet
                </p>
            )}

            {loaded && subscribers.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {subscribers.map((sub) => (
                        <div
                            key={sub.playerId}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "8px 12px", borderRadius: 10,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            {sub.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={sub.avatar}
                                    alt=""
                                    style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                                />
                            ) : (
                                <div style={{
                                    width: 28, height: 28, borderRadius: "50%",
                                    background: "rgba(52, 211, 153, 0.15)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 12, fontWeight: 700, color: "#34d399",
                                }}>
                                    {sub.displayName[0]?.toUpperCase() || "?"}
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>
                                    {sub.displayName}
                                </div>
                                <div style={{ fontSize: 11, color: "#666" }}>
                                    {sub.devices} device{sub.devices !== 1 ? "s" : ""} · {new Date(sub.lastSubscribed).toLocaleDateString()}
                                </div>
                            </div>
                            <div style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 8,
                                background: "rgba(52, 211, 153, 0.1)", color: "#34d399",
                                fontWeight: 600,
                            }}>
                                ✅ Active
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
