"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoomInfoGenerator, RulesEditor } from "@/components/vote/room-info-generator";
import { DiscordAccessManager } from "@/components/vote/discord-access-manager";
import { Card, CardBody } from "@heroui/react";
import { KeyRound, Shield, BookOpen, Send, Check, ChevronDown, Phone, Copy, Users } from "lucide-react";
import { toast } from "sonner";

interface InPlayTournament {
    id: string;
    name: string;
    type: string;
    allowSquads: boolean;
}

type Tab = "room-info" | "discord-access" | "unlinked";

/**
 * /dashboard/room-info — Dedicated page for room info generation & Discord management.
 */
export default function RoomInfoPage() {
    const [activeTab, setActiveTab] = useState<Tab>("room-info");
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

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "room-info", label: "Room Info", icon: <KeyRound className="w-3.5 h-3.5" /> },
        { id: "unlinked", label: "Unlinked", icon: <Phone className="w-3.5 h-3.5" /> },
        { id: "discord-access", label: "Discord", icon: <Shield className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="space-y-5 p-4">
            {/* Header + Tabs */}
            <div className="space-y-3">
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

                {/* Tab switcher */}
                <div className="flex gap-1 p-1 rounded-xl bg-default-100 border border-divider">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                                transition-all duration-200 cursor-pointer
                                ${activeTab === tab.id
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-foreground/40 hover:text-foreground/60"
                                }
                            `}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            {activeTab === "room-info" && (
                <>
                    {/* Room Info Generator */}
                    <Card className="border border-divider">
                        <CardBody className="p-4">
                            <RoomInfoGenerator alwaysExpanded hideRulesEditor />
                        </CardBody>
                    </Card>

                    {/* Rules Editor */}
                    <Card className="border border-divider">
                        <CardBody className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-foreground/50" />
                                <p className="text-sm font-semibold">Tournament Rules</p>
                            </div>
                            <p className="text-xs text-foreground/40">
                                Edit rules below and send them to a tournament&apos;s Discord channel.
                            </p>

                            <RulesEditor />

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
                </>
            )}

            {activeTab === "discord-access" && (
                <DiscordAccessManager />
            )}

            {activeTab === "unlinked" && (
                <UnlinkedLeadersSection tournaments={tournaments} />
            )}
        </div>
    );
}

/* ─── Unlinked Leaders Section ──────────────────────────────── */

interface UnlinkedLeader {
    teamName: string;
    teamNumber: number;
    playerName: string;
    phoneNumber: string | null;
}

function UnlinkedLeadersSection({ tournaments }: { tournaments: InPlayTournament[] }) {
    const [selectedId, setSelectedId] = useState(tournaments[0]?.id || "");
    const selected = tournaments.find(t => t.id === selectedId) || tournaments[0];

    const { data: leaders = [], isLoading } = useQuery<UnlinkedLeader[]>({
        queryKey: ["unlinked-leaders", selected?.id],
        queryFn: async () => {
            if (!selected) return [];
            const res = await fetch(`/api/tournaments/unlinked-leaders?tournamentId=${selected.id}`);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        enabled: !!selected,
        staleTime: 30 * 1000,
    });

    const copyPhone = (phone: string) => {
        navigator.clipboard.writeText(phone);
        toast.success(`Copied ${phone}`);
    };

    const copyAllPhones = () => {
        const phones = leaders.filter(l => l.phoneNumber).map(l => l.phoneNumber!);
        if (phones.length === 0) return;
        navigator.clipboard.writeText(phones.join("\n"));
        toast.success(`Copied ${phones.length} phone numbers`);
    };

    return (
        <Card className="border border-divider">
            <CardBody className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-amber-500" />
                    <p className="text-sm font-semibold">Unlinked Leaders</p>
                    {leaders.length > 0 && (
                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                            {leaders.length}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-foreground/40">
                    Team leaders without Discord. Add their numbers to a WhatsApp group to send room IDs.
                </p>

                {/* Tournament selector */}
                {tournaments.length > 1 && (
                    <div className="relative">
                        <select
                            value={selected?.id || ""}
                            onChange={(e) => setSelectedId(e.target.value)}
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
                )}

                {/* List */}
                {isLoading ? (
                    <p className="text-[11px] text-foreground/30 text-center py-4">Loading...</p>
                ) : leaders.length === 0 ? (
                    <div className="text-center py-6 space-y-1">
                        <Users className="w-6 h-6 text-emerald-500/50 mx-auto" />
                        <p className="text-[11px] text-emerald-500 font-medium">All leaders have Discord linked! 🎉</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                            {leaders.map((leader, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-default-50 border border-divider"
                                >
                                    <span className="text-[10px] font-bold text-foreground/25 w-5 text-center shrink-0">
                                        {leader.teamNumber}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{leader.playerName}</p>
                                        <p className="text-[10px] text-foreground/40 truncate">{leader.teamName}</p>
                                    </div>
                                    {leader.phoneNumber ? (
                                        <button
                                            type="button"
                                            onClick={() => copyPhone(leader.phoneNumber!)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-default-100 hover:bg-default-200 transition-colors text-[11px] font-mono text-foreground/60 cursor-pointer shrink-0"
                                        >
                                            {leader.phoneNumber}
                                            <Copy className="w-3 h-3 text-foreground/30" />
                                        </button>
                                    ) : (
                                        <span className="text-[10px] text-foreground/20 italic">No phone</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Copy all */}
                        <button
                            type="button"
                            onClick={copyAllPhones}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer active:scale-[0.98]"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            Copy All Numbers ({leaders.filter(l => l.phoneNumber).length})
                        </button>
                    </>
                )}
            </CardBody>
        </Card>
    );
}

