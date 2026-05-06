"use client";

import { useState } from "react";
import { GAME } from "@/lib/game-config";

/**
 * /razorpay-verify — Public page for Razorpay website verification.
 * Shows the Razorpay checkout integration without requiring login.
 * Remove this page after Razorpay approves the account.
 */

const PLATFORM_FEE_PERCENT = 2.4;
const AMOUNTS = [50, 100, 200];

const loadRazorpayScript = (): Promise<boolean> =>
    new Promise((resolve) => {
        if (typeof window !== "undefined" && window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

export default function RazorpayVerifyPage() {
    const [selected, setSelected] = useState(100);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

    const rupees = Math.round((selected / (1 - PLATFORM_FEE_PERCENT / 100)) * 100) / 100;

    const handlePay = async () => {
        setLoading(true);
        setStatus("idle");
        try {
            // Create order via API
            const res = await fetch("/api/payments/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: rupees,
                    amountInPaise: Math.round(rupees * 100),
                }),
            });

            if (!res.ok) {
                // If not logged in, show a demo checkout instead
                const scriptLoaded = await loadRazorpayScript();
                if (!scriptLoaded) {
                    setStatus("error");
                    return;
                }

                // Demo mode — opens Razorpay checkout with the live key
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const RzpConstructor = (window as any).Razorpay;
                const rzp = new RzpConstructor({
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_demo",
                    amount: Math.round(rupees * 100),
                    currency: "INR",
                    name: GAME.fullName,
                    description: `Add ${selected} ${GAME.currency}`,
                    theme: { color: "#f59e0b" },
                    modal: {
                        ondismiss: () => setStatus("idle"),
                    },
                    handler: () => {
                        setStatus("success");
                    },
                });
                rzp.open();
                return;
            }

            const json = await res.json();
            const { orderId, amount: orderAmount, currency, keyId } = json.data;

            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                setStatus("error");
                return;
            }

            const rzp = new window.Razorpay({
                key: keyId,
                amount: orderAmount,
                currency,
                name: GAME.fullName,
                description: `Add ${selected} ${GAME.currency}`,
                order_id: orderId,
                theme: { color: "#f59e0b" },
                modal: {
                    ondismiss: () => setStatus("idle"),
                },
                handler: async (response: any) => {
                    // Verify payment
                    try {
                        const verifyRes = await fetch("/api/payments/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(response),
                        });
                        if (verifyRes.ok) {
                            setStatus("success");
                        } else {
                            setStatus("error");
                        }
                    } catch {
                        setStatus("error");
                    }
                },
            });
            rzp.open();
        } catch {
            setStatus("error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                        <span className="text-amber-400 text-xs font-medium">Secure Payments</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">{GAME.fullName}</h1>
                    <p className="text-gray-400 text-sm">
                        Add {GAME.currency} to your wallet using UPI, Cards, or Net Banking
                    </p>
                </div>

                {/* Card */}
                <div className="rounded-2xl bg-gray-800/50 border border-gray-700/50 backdrop-blur-sm overflow-hidden">
                    {/* Amount Selection */}
                    <div className="p-6 space-y-4">
                        <label className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                            Select {GAME.currency} Amount
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {AMOUNTS.map((amount) => (
                                <button
                                    key={amount}
                                    onClick={() => setSelected(amount)}
                                    className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                                        selected === amount
                                            ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                                            : "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                                    }`}
                                >
                                    {amount} {GAME.currency}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price breakdown */}
                    <div className="mx-6 rounded-xl bg-gray-900/50 p-4 space-y-2">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>{GAME.currency} to receive</span>
                            <span className="text-emerald-400 font-semibold">{selected} {GAME.currency}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Processing fee ({PLATFORM_FEE_PERCENT}%)</span>
                            <span>included</span>
                        </div>
                        <div className="border-t border-gray-700/50 pt-2 flex justify-between items-center">
                            <span className="text-xs font-medium text-gray-300">You pay</span>
                            <span className="text-xl font-bold text-white">₹{rupees % 1 === 0 ? rupees : rupees.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Pay button */}
                    <div className="p-6">
                        <button
                            onClick={handlePay}
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-base transition-all hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Processing..." : `Pay ₹${rupees % 1 === 0 ? rupees : rupees.toFixed(2)}`}
                        </button>

                        {/* Payment methods */}
                        <div className="flex items-center justify-center gap-4 mt-4">
                            <span className="text-[10px] text-gray-500">UPI</span>
                            <span className="text-[10px] text-gray-500">•</span>
                            <span className="text-[10px] text-gray-500">Cards</span>
                            <span className="text-[10px] text-gray-500">•</span>
                            <span className="text-[10px] text-gray-500">Net Banking</span>
                            <span className="text-[10px] text-gray-500">•</span>
                            <span className="text-[10px] text-gray-500">Wallets</span>
                        </div>
                    </div>

                    {/* Status messages */}
                    {status === "success" && (
                        <div className="mx-6 mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                            <p className="text-sm text-emerald-400 font-medium">✅ Payment successful!</p>
                        </div>
                    )}
                    {status === "error" && (
                        <div className="mx-6 mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                            <p className="text-sm text-red-400 font-medium">Payment failed. Please try again.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-6">
                    <p className="text-[10px] text-gray-600">
                        Powered by Razorpay • 256-bit SSL Encrypted
                    </p>
                </div>
            </div>
        </div>
    );
}
