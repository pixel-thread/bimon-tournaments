"use client";

import { useState } from "react";
import { Send, Bell, RefreshCw, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

type Mode = "normal" | "sticky" | "update";

export default function PushTestPage() {
    const [roomId, setRoomId] = useState("ABCD1234");
    const [password, setPassword] = useState("9876");
    const [map, setMap] = useState("Erangel");
    const [matchNumber, setMatchNumber] = useState(1);
    const [sending, setSending] = useState<Mode | null>(null);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [diagnostics, setDiagnostics] = useState<any>(null);

    async function sendTest(mode: Mode) {
        setSending(mode);
        setResult(null);
        setDiagnostics(null);
        try {
            const res = await fetch("/api/push/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, roomId, password, map, matchNumber }),
            });
            const data = await res.json();
            setDiagnostics(data.data);
            setResult({
                ok: data.success,
                message: data.message || (data.success
                    ? `✅ Sent! (${mode})`
                    : `❌ ${data.message}`),
            });
        } catch {
            setResult({ ok: false, message: "❌ Network error" });
        } finally {
            setSending(null);
        }
    }

    return (
        <div style={{
            minHeight: "100dvh",
            background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
            color: "#e0e0e0",
            padding: "24px 16px",
            fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
            <div style={{
                maxWidth: 480,
                margin: "0 auto",
            }}>
                {/* Header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 32,
                }}>
                    <Bell style={{ width: 24, height: 24, color: "#818cf8" }} />
                    <h1 style={{
                        fontSize: 22,
                        fontWeight: 700,
                        margin: 0,
                        background: "linear-gradient(90deg, #818cf8, #a78bfa)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}>
                        Push Notification Test
                    </h1>
                </div>

                {/* Info box */}
                <div style={{
                    background: "rgba(129, 140, 248, 0.08)",
                    border: "1px solid rgba(129, 140, 248, 0.2)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    marginBottom: 24,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "#a0a0b8",
                }}>
                    <strong style={{ color: "#818cf8" }}>How to test:</strong>
                    <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                        <li>Open this page on your <strong>PC</strong></li>
                        <li>Make sure push is enabled on your <strong>Android phone</strong> (visit the site → enable notifications)</li>
                        <li>Click the buttons below to send test notifications to your phone</li>
                    </ol>
                </div>

                {/* Clear old subscriptions */}
                <button
                    onClick={async () => {
                        const res = await fetch("/api/push/test", { method: "DELETE" });
                        const data = await res.json();
                        alert(data.message);
                        setDiagnostics(null);
                        setResult(null);
                    }}
                    style={{
                        width: "100%",
                        padding: "12px",
                        marginBottom: 24,
                        borderRadius: 10,
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.08)",
                        color: "#ef4444",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    🗑️ Clear ALL old subscriptions from DB (do this first!)
                </button>

                {/* Form fields */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 24,
                }}>
                    {[
                        { label: "Room ID", value: roomId, set: setRoomId },
                        { label: "Password", value: password, set: setPassword },
                        { label: "Map", value: map, set: setMap },
                    ].map(({ label, value, set }) => (
                        <div key={label}>
                            <label style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#888",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                display: "block",
                                marginBottom: 6,
                            }}>{label}</label>
                            <input
                                value={value}
                                onChange={(e) => set(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 8,
                                    color: "#fff",
                                    fontSize: 14,
                                    outline: "none",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                    ))}
                    <div>
                        <label style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#888",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            display: "block",
                            marginBottom: 6,
                        }}>Match #</label>
                        <input
                            type="number"
                            value={matchNumber}
                            onChange={(e) => setMatchNumber(Number(e.target.value))}
                            min={1}
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                color: "#fff",
                                fontSize: 14,
                                outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>
                </div>

                {/* Test buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Normal notification */}
                    <button
                        onClick={() => sendTest("normal")}
                        disabled={!!sending}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "14px 18px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#e0e0e0",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: sending ? "not-allowed" : "pointer",
                            opacity: sending && sending !== "normal" ? 0.4 : 1,
                            transition: "all 0.2s",
                        }}
                    >
                        {sending === "normal"
                            ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                            : <Send style={{ width: 18, height: 18, color: "#60a5fa" }} />
                        }
                        <div style={{ textAlign: "left" }}>
                            <div>Normal Notification</div>
                            <div style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>
                                Auto-dismisses after a few seconds (default behavior)
                            </div>
                        </div>
                    </button>

                    {/* Sticky notification */}
                    <button
                        onClick={() => sendTest("sticky")}
                        disabled={!!sending}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "14px 18px",
                            borderRadius: 12,
                            border: "1px solid rgba(129, 140, 248, 0.3)",
                            background: "linear-gradient(135deg, rgba(129, 140, 248, 0.12), rgba(167, 139, 250, 0.08))",
                            color: "#e0e0e0",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: sending ? "not-allowed" : "pointer",
                            opacity: sending && sending !== "sticky" ? 0.4 : 1,
                            transition: "all 0.2s",
                        }}
                    >
                        {sending === "sticky"
                            ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                            : <Bell style={{ width: 18, height: 18, color: "#818cf8" }} />
                        }
                        <div style={{ textAlign: "left" }}>
                            <div>🔒 Sticky Notification</div>
                            <div style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>
                                Stays pinned until you swipe it away (Android only)
                            </div>
                        </div>
                    </button>

                    {/* Update existing */}
                    <button
                        onClick={() => {
                            setMatchNumber((n) => n + 1);
                            sendTest("update");
                        }}
                        disabled={!!sending}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "14px 18px",
                            borderRadius: 12,
                            border: "1px solid rgba(52, 211, 153, 0.3)",
                            background: "linear-gradient(135deg, rgba(52, 211, 153, 0.12), rgba(16, 185, 129, 0.08))",
                            color: "#e0e0e0",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: sending ? "not-allowed" : "pointer",
                            opacity: sending && sending !== "update" ? 0.4 : 1,
                            transition: "all 0.2s",
                        }}
                    >
                        {sending === "update"
                            ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                            : <RefreshCw style={{ width: 18, height: 18, color: "#34d399" }} />
                        }
                        <div style={{ textAlign: "left" }}>
                            <div>🔄 Update Existing Notification</div>
                            <div style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>
                                Replaces the sticky notification in-place with new match info + vibrates
                            </div>
                        </div>
                    </button>
                </div>

                {/* Result */}
                {result && (
                    <div style={{
                        marginTop: 20,
                        padding: "12px 16px",
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                        background: result.ok
                            ? "rgba(52, 211, 153, 0.1)"
                            : "rgba(239, 68, 68, 0.1)",
                        border: `1px solid ${result.ok
                            ? "rgba(52, 211, 153, 0.3)"
                            : "rgba(239, 68, 68, 0.3)"}`,
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
                        marginTop: 16,
                        padding: "16px",
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.08)",
                        fontSize: 13,
                        lineHeight: 1.7,
                    }}>
                        <h3 style={{
                            fontSize: 13,
                            fontWeight: 700,
                            margin: "0 0 10px",
                            color: "#818cf8",
                        }}>📊 Diagnostics</h3>
                        <div style={{ color: "#a0a0b8" }}>
                            <div><strong>Player ID:</strong> <code style={{ color: "#888", fontSize: 11 }}>{diagnostics.playerId}</code></div>
                            <div><strong>Subscriptions found:</strong> {diagnostics.subscriptionCount ?? "N/A"}</div>
                            {diagnostics.staleRemoved > 0 && (
                                <div style={{ color: "#f59e0b" }}>⚠️ Removed {diagnostics.staleRemoved} stale subscription(s)</div>
                            )}
                            {diagnostics.hint && (
                                <div style={{ color: "#f59e0b", marginTop: 8 }}>💡 {diagnostics.hint}</div>
                            )}
                        </div>
                        {diagnostics.results && diagnostics.results.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <strong style={{ color: "#a0a0b8" }}>Per-device results:</strong>
                                {diagnostics.results.map((r: { endpoint: string; status: string; error?: string }, i: number) => (
                                    <div key={i} style={{
                                        marginTop: 6,
                                        padding: "8px 10px",
                                        background: "rgba(255,255,255,0.03)",
                                        borderRadius: 8,
                                        fontSize: 12,
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

                {/* What to check */}
                <div style={{
                    marginTop: 32,
                    padding: "16px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.06)",
                }}>
                    <h3 style={{
                        fontSize: 14,
                        fontWeight: 600,
                        margin: "0 0 12px",
                        color: "#a0a0b8",
                    }}>🧪 What to verify on your phone:</h3>
                    <ul style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 13,
                        lineHeight: 1.8,
                        color: "#888",
                    }}>
                        <li><strong>Normal:</strong> Shows briefly, goes to notification tray</li>
                        <li><strong>Sticky:</strong> Stays on screen / in tray until you swipe it</li>
                        <li><strong>Update:</strong> Replaces the sticky one with new match info, vibrates again</li>
                        <li>Can you read Room ID + Password from the notification without opening the app?</li>
                    </ul>
                </div>
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
