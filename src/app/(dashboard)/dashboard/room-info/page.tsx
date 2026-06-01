"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoomInfoGenerator, RulesEditor } from "@/components/vote/room-info-generator";
import { Card, CardBody } from "@heroui/react";
import { KeyRound, BookOpen, Send, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface InPlayTournament {
    id: string;
    name: string;
    type: string;
    allowSquads: boolean;
}

/**
 * /dashboard/room-info — Dedicated page for room info generation & Discord management.
 */
export default function RoomInfoPage() {
    const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
    const [rulesSending, setRulesSending] = useState(false);
    const [rulesSent, setRulesSent] = useState(false);

    // Fetch in-play tournaments for the selector
    const { data: tournaments = [] } = useQuery<InPlayTournament[]>({
        queryKey: ["tournaments-in-play"],
        queryFn: async () => {
            const res = await fetch("/api/tournaments/in-play");
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 60 * 1000,
    });

    // Auto-select first tournament
    const selectedTournament = tournaments.find(t => t.id === selectedTournamentId) || tournaments[0];

    const handleSendRules = useCallback(async () => {
        if (!selectedTournament || rulesSending) return;
        setRulesSending(true);
        try {
            const res = await fetch("/api/discord/send-rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tournamentId: selectedTournament.id,
                    tournamentName: selectedTournament.name,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(json.error || "Failed to send rules");
            }
            setRulesSent(true);
            toast.success(`Rules sent to ${selectedTournament.name} Discord channel!`);
            setTimeout(() => setRulesSent(false), 3000);
        } catch (err: any) {
            toast.error(`Failed: ${err.message || "Unknown error"}`);
        } finally {
            setRulesSending(false);
        }
    }, [selectedTournament, rulesSending]);

    return (
        <div className="space-y-5 p-4">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                        <KeyRound className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">Room Info</h1>
                        <p className="text-xs text-foreground/40">
                            Generate room info, send to Discord & WhatsApp
                        </p>
                    </div>
                </div>
            </div>

            {/* Room Info Generator — always expanded, rules editor hidden */}
            <Card className="border border-divider">
                <CardBody className="p-4">
                    <RoomInfoGenerator alwaysExpanded hideRulesEditor />
                </CardBody>
            </Card>

            {/* Rules Editor — always visible with tournament selector */}
            <Card className="border border-divider">
                <CardBody className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-foreground/50" />
                        <p className="text-sm font-semibold">Tournament Rules</p>
                    </div>
                    <p className="text-xs text-foreground/40">
                        Edit rules below and send them to a tournament&apos;s Discord channel.
                    </p>

                    {/* Rules Editor */}
                    <RulesEditor />

                    {/* Tournament Selector + Send button */}
                    {tournaments.length > 0 && (
                        <div className="border-t border-divider pt-3 space-y-2">
                            <label className="text-[10px] text-foreground/40 uppercase tracking-wider block">
                                Send rules to
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <select
                                        value={selectedTournament?.id || ""}
                                        onChange={(e) => setSelectedTournamentId(e.target.value)}
                                        className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-default-100 border border-divider text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        {tournaments.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.allowSquads ? "🏆" : "🎮"} {t.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40 pointer-events-none" />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSendRules}
                                    disabled={rulesSending || !selectedTournament}
                                    className={`
                                        flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold shrink-0
                                        transition-all duration-200 cursor-pointer active:scale-[0.98]
                                        ${rulesSent
                                            ? "bg-emerald-500 text-white"
                                            : rulesSending
                                                ? "bg-default-200 text-foreground/40"
                                                : "bg-[#5865F2] text-white hover:bg-[#4752C4] shadow-lg shadow-[#5865F2]/25"
                                        }
                                    `}
                                >
                                    {rulesSent ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Sent!
                                        </>
                                    ) : rulesSending ? (
                                        <>
                                            <Send className="w-4 h-4 animate-pulse" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Send
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
