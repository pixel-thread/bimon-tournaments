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

interface UnlinkedResponse {
    data: UnlinkedLeader[];
    whatsappGroupLink: string | null;
    tournamentName: string;
}

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

function buildWhatsAppMessage(playerName: string, tournamentName: string, groupLink: string | null): string {
    const lines = [
        `Hi ${playerName}! 👋`,
        ``,
        `🎉 Great news! Bimon Tournament is now on Discord!`,
        ``,
        `✅ Benefits:`,
        `• Room IDs delivered instantly`,
        `• Match announcements & updates`,
        `• Discord is for gamers`,
        `• Never miss a tournament`,
        ``,
        `🏆 Tournament: ${tournamentName}`,
    ];

    if (groupLink) {
        lines.push(
            ``,
            `📲 Join the WhatsApp group for room IDs:`,
            groupLink,
        );
    }

    return lines.join("\n");
}

function UnlinkedLeadersSection({ tournaments }: { tournaments: InPlayTournament[] }) {
    const [selectedId, setSelectedId] = useState(tournaments[0]?.id || "");
    const selected = tournaments.find(t => t.id === selectedId) || tournaments[0];

    const { data: response, isLoading } = useQuery<UnlinkedResponse>({
        queryKey: ["unlinked-leaders", selected?.id],
        queryFn: async () => {
            if (!selected) return { data: [], whatsappGroupLink: null, tournamentName: "" };
            const res = await fetch(`/api/tournaments/unlinked-leaders?tournamentId=${selected.id}`);
            if (!res.ok) return { data: [], whatsappGroupLink: null, tournamentName: "" };
            return res.json();
        },
        enabled: !!selected,
        staleTime: 30 * 1000,
    });

    const leaders = response?.data ?? [];
    const whatsappGroupLink = response?.whatsappGroupLink ?? null;
    const tournamentName = response?.tournamentName ?? "";

    const openWhatsApp = (phone: string, name: string) => {
        const msg = buildWhatsAppMessage(name, tournamentName, whatsappGroupLink);
        const cleanPhone = phone.replace(/[^0-9]/g, "");
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
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
                    Send a WhatsApp message inviting leaders to Discord + share the group link for room IDs.
                </p>

                {/* WhatsApp group link status */}
                {whatsappGroupLink ? (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <p className="text-[10px] text-emerald-600 font-medium truncate flex-1">Group link set ✓</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <WhatsAppIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <p className="text-[10px] text-amber-600 font-medium">No WhatsApp group link set on poll</p>
                    </div>
                )}

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
                                        onClick={() => openWhatsApp(leader.phoneNumber!, leader.playerName)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors text-[11px] font-semibold text-[#25D366] cursor-pointer shrink-0"
                                    >
                                        <WhatsAppIcon className="w-3.5 h-3.5" />
                                        Message
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-foreground/20 italic">No phone</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardBody>
        </Card>
    );
}


