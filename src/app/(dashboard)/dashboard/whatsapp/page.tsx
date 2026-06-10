"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Check, Link2Off, QrCode, RefreshCw, Wifi, WifiOff } from "lucide-react";

/**
 * /dashboard/whatsapp — Admin page for WhatsApp bot management.
 * Scan QR code to link, check status, unlink.
 */
export default function WhatsAppDashboardPage() {
    const [status, setStatus] = useState<"checking" | "linked" | "unlinked" | "scanning">("checking");
    const [qrImage, setQrImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Check current status on mount
    useEffect(() => {
        fetch("/api/whatsapp/auth")
            .then(res => res.json())
            .then(json => setStatus(json.status === "linked" ? "linked" : "unlinked"))
            .catch(() => setStatus("unlinked"));
    }, []);

    // Start QR linking via SSE stream
    const startLinking = useCallback(async () => {
        setLoading(true);
        setStatus("scanning");
        setQrImage(null);

        try {
            // First check if already linked
            const checkRes = await fetch("/api/whatsapp/auth");
            const checkJson = await checkRes.json();
            if (checkJson.status === "linked") {
                setStatus("linked");
                setLoading(false);
                toast.success("WhatsApp already linked!");
                return;
            }

            // Start SSE stream for QR code
            const response = await fetch("/api/whatsapp/auth", { method: "POST" });

            // If it returned JSON (already linked), handle that
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                const json = await response.json();
                if (json.status === "linked") {
                    setStatus("linked");
                    setLoading(false);
                    toast.success("WhatsApp already linked!");
                    return;
                }
            }

            // It's an SSE stream — read it
            if (!response.body) {
                toast.error("Browser doesn't support streaming");
                setStatus("unlinked");
                setLoading(false);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events from buffer
                const events = buffer.split("\n\n");
                buffer = events.pop() || ""; // Keep incomplete event in buffer

                for (const event of events) {
                    const lines = event.trim().split("\n");
                    let eventType = "";
                    let data = "";

                    for (const line of lines) {
                        if (line.startsWith("event: ")) {
                            eventType = line.slice(7);
                        } else if (line.startsWith("data: ")) {
                            data = line.slice(6);
                        }
                    }

                    if (!eventType || !data) continue;

                    try {
                        const parsed = JSON.parse(data);

                        if (eventType === "qr") {
                            setQrImage(parsed.qr);
                            setLoading(false);
                            toast("Scan the QR code with WhatsApp", { icon: "📱" });
                        } else if (eventType === "connected") {
                            setStatus("linked");
                            setQrImage(null);
                            setLoading(false);
                            toast.success("WhatsApp linked successfully! 🎉");
                            return;
                        } else if (eventType === "error") {
                            toast.error(parsed.error || "Failed to link");
                            setStatus("unlinked");
                            setQrImage(null);
                            setLoading(false);
                            return;
                        }
                    } catch {}
                }
            }

            // Stream ended without connected event
            if (status !== "linked") {
                setStatus("unlinked");
                setLoading(false);
            }
        } catch (err) {
            toast.error("Failed to connect");
            setStatus("unlinked");
            setQrImage(null);
            setLoading(false);
        }
    }, []);

    // Unlink WhatsApp
    const unlink = useCallback(async () => {
        try {
            await fetch("/api/whatsapp/auth", { method: "DELETE" });
            setStatus("unlinked");
            setQrImage(null);
            toast.success("WhatsApp unlinked");
        } catch {
            toast.error("Failed to unlink");
        }
    }, []);

    return (
        <div className="max-w-lg mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp Bot
            </h1>
            <p className="text-foreground/50 text-sm mb-8">
                Link your second WhatsApp number to auto-send room info, rules, and standings to tournament groups.
            </p>

            {/* Status Card */}
            <div className="rounded-2xl border border-divider bg-background/80 backdrop-blur-xl shadow-lg overflow-hidden">
                {/* Status Header */}
                <div className={`px-6 py-4 flex items-center justify-between ${
                    status === "linked" 
                        ? "bg-green-500/10 border-b border-green-500/20"
                        : "bg-default-100 border-b border-divider"
                }`}>
                    <div className="flex items-center gap-3">
                        {status === "linked" ? (
                            <Wifi className="w-5 h-5 text-green-500" />
                        ) : status === "scanning" ? (
                            <QrCode className="w-5 h-5 text-blue-500 animate-pulse" />
                        ) : (
                            <WifiOff className="w-5 h-5 text-foreground/40" />
                        )}
                        <div>
                            <p className="font-semibold text-sm">
                                {status === "linked" ? "Connected" 
                                    : status === "scanning" ? "Waiting for scan..."
                                    : status === "checking" ? "Checking..."
                                    : "Not connected"}
                            </p>
                            <p className="text-xs text-foreground/40">
                                {status === "linked" 
                                    ? "WhatsApp bot is ready to send messages"
                                    : "Scan QR code with your second phone"}
                            </p>
                        </div>
                    </div>
                    {status === "linked" && (
                        <Check className="w-5 h-5 text-green-500" />
                    )}
                </div>

                {/* QR Code / Actions */}
                <div className="px-6 py-6">
                    {status === "scanning" && qrImage ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="bg-white p-3 rounded-xl shadow-md">
                                <img src={qrImage} alt="WhatsApp QR Code" className="w-64 h-64" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-sm font-medium">Scan with WhatsApp</p>
                                <p className="text-xs text-foreground/40">
                                    Open WhatsApp → Settings → Linked Devices → Link a Device
                                </p>
                            </div>
                            <p className="text-xs text-foreground/30 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Waiting for scan (55s timeout)...
                            </p>
                        </div>
                    ) : status === "scanning" && !qrImage ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center">
                                <RefreshCw className="w-8 h-8 text-foreground/30 animate-spin" />
                            </div>
                            <p className="text-sm text-foreground/50">Generating QR code...</p>
                        </div>
                    ) : status === "linked" ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                <Check className="w-8 h-8 text-green-500" />
                            </div>
                            <p className="text-sm text-foreground/60 text-center">
                                Your WhatsApp bot is connected and ready to send room info, standings, and rules to tournament groups.
                            </p>
                            <button
                                onClick={unlink}
                                className="flex items-center gap-2 text-sm text-danger hover:text-danger/80 transition-colors mt-2"
                            >
                                <Link2Off className="w-4 h-4" />
                                Unlink WhatsApp
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center">
                                <QrCode className="w-8 h-8 text-foreground/30" />
                            </div>
                            <p className="text-sm text-foreground/50 text-center">
                                Link your second WhatsApp number to enable automated tournament group messaging.
                            </p>
                            <button
                                onClick={startLinking}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <QrCode className="w-4 h-4" />
                                )}
                                {loading ? "Connecting..." : "Link WhatsApp"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Instructions */}
            <div className="mt-6 rounded-xl bg-default-50 border border-divider p-4 space-y-3">
                <p className="font-semibold text-sm">How it works</p>
                <ol className="text-xs text-foreground/50 space-y-2 list-decimal list-inside">
                    <li>Click <strong>&quot;Link WhatsApp&quot;</strong> and scan the QR with your <strong>second phone</strong></li>
                    <li>When you create a tournament group, players are auto-added to a WhatsApp group</li>
                    <li>Room info, rules, and standings — the <strong>green WA button</strong> sends to the group</li>
                    <li>When winners are declared, the group is auto-deleted</li>
                </ol>
            </div>
        </div>
    );
}
