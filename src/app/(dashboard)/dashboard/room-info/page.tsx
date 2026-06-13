"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoomInfoGenerator, RulesEditor } from "@/components/vote/room-info-generator";
import { DiscordAccessManager } from "@/components/vote/discord-access-manager";
import { Card, CardBody } from "@heroui/react";
import { KeyRound, Shield, BookOpen, Send, Check, ChevronDown, Phone, Users, RefreshCw, UserCheck, Link } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { toast } from "sonner";

interface InPlayTournament {
    id: string;
    name: string;
    type: string;
    hasTeams: boolean;
    allowSquads: boolean;
}

type Tab = "room-info" | "discord-access" | "unlinked";
type V2Tab = "room-info" | "wa-groups";
type Mode = "v1" | "v2";

/**
 * /dashboard/room-info — Dedicated page for room info generation & Discord management.
 */
export default function RoomInfoPage() {
    const [mode, setMode] = useState<Mode>("v2");
    const [activeTab, setActiveTab] = useState<Tab>("room-info");
    const [v2Tab, setV2Tab] = useState<V2Tab>("room-info");
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
            {/* Header */}
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

                {/* V1/V2 Mode Switcher — top level */}
                <div className="flex gap-1 p-1 rounded-xl bg-default-100 border border-divider">
                    <button
                        type="button"
                        onClick={() => setMode("v2")}
                        className={`
                            flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold
                            transition-all duration-200 cursor-pointer
                            ${mode === "v2"
                                ? "bg-green-500 text-white shadow-sm"
                                : "text-foreground/40 hover:text-foreground/60"
                            }
                        `}
                    >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        V2 — WhatsApp
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("v1")}
                        className={`
                            flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold
                            transition-all duration-200 cursor-pointer
                            ${mode === "v1"
                                ? "bg-indigo-500 text-white shadow-sm"
                                : "text-foreground/40 hover:text-foreground/60"
                            }
                        `}
                    >
                        <Send className="w-3.5 h-3.5" />
                        V1 — Discord + App
                    </button>
                </div>

                {/* Sub-tabs — only in V1 mode */}
                {mode === "v1" && (
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
                )}
            </div>

            {/* V2 Content — WhatsApp only */}
            {mode === "v2" && (
                <>
                    {/* Shared tournament selector */}
                    {tournaments.length > 1 && (
                        <div className="flex items-center gap-2">
                            <ChevronDown className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
                            <select
                                value={selectedTournament?.id || ""}
                                onChange={(e) => setSelectedTournamentId(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg bg-default-100 border border-divider text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                                {tournaments.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* V2 sub-tabs */}
                    <div className="flex gap-1 p-1 rounded-xl bg-default-100 border border-divider">
                        <button
                            type="button"
                            onClick={() => setV2Tab("room-info")}
                            className={`
                                flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                                transition-all duration-200 cursor-pointer
                                ${v2Tab === "room-info"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-foreground/40 hover:text-foreground/60"
                                }
                            `}
                        >
                            <KeyRound className="w-3.5 h-3.5" />
                            Room Info
                        </button>
                        <button
                            type="button"
                            onClick={() => setV2Tab("wa-groups")}
                            className={`
                                flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                                transition-all duration-200 cursor-pointer
                                ${v2Tab === "wa-groups"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-foreground/40 hover:text-foreground/60"
                                }
                            `}
                        >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            Groups
                        </button>
                    </div>

                    {v2Tab === "room-info" && (
                        <>
                            <Card className="border border-divider">
                                <CardBody className="p-4">
                                    <RoomInfoGenerator alwaysExpanded hideRulesEditor defaultMode="v2" />
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
                                        Edit rules below. Send Rules in the room info section above to push to WhatsApp & player My Slot page.
                                    </p>
                                    <RulesEditor />
                                </CardBody>
                            </Card>
                        </>
                    )}

                    {v2Tab === "wa-groups" && (
                        <WhatsAppGroupManager tournaments={tournaments} />
                    )}
                </>
            )}

            {/* V1 Content — existing tabs */}
            {mode === "v1" && (
                <>
                    {activeTab === "room-info" && (
                        <>
                            {/* Room Info Generator */}
                            <Card className="border border-divider">
                                <CardBody className="p-4">
                                    <RoomInfoGenerator alwaysExpanded hideRulesEditor defaultMode="v1" />
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
                </>
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
    data: {
        leaders: UnlinkedLeader[];
        whatsappGroupLink: string | null;
        tournamentName: string;
    };
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

    const leaders = response?.data?.leaders ?? [];
    const whatsappGroupLink = response?.data?.whatsappGroupLink ?? null;
    const tournamentName = response?.data?.tournamentName ?? "";

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


/* ─── WhatsApp Group Manager ───────────────────────────────────── */



interface MembersData {
    totalMembers: number;
    joined: { name: string; teamNumber: number }[];
    notJoined: { name: string; teamNumber: number; phone: string | null }[];
}

function WhatsAppGroupManager({ tournaments }: { tournaments: InPlayTournament[] }) {
    const [creating, setCreating] = useState<string | null>(null);
    const [inviteInputs, setInviteInputs] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [addingLeaders, setAddingLeaders] = useState<string | null>(null);
    const [sendingInvites, setSendingInvites] = useState<string | null>(null);
    const [groupStatus, setGroupStatus] = useState<Record<string, { hasGroup: boolean; inviteLink?: string }>>({});
    const [membersData, setMembersData] = useState<Record<string, MembersData>>({});
    const [checkingMembers, setCheckingMembers] = useState<string | null>(null);
    const [leadersData, setLeadersData] = useState<Record<string, { tournamentName: string; leaders: { teamNumber: number; name: string; phone: string | null; teammates: string[] }[]; inviteLink: string | null }>>({});
    const [sentLeaders, setSentLeaders] = useState<Record<string, Set<number>>>(() => {
        if (typeof window === "undefined") return {};
        try {
            const saved = localStorage.getItem("wa-sent-leaders");
            if (!saved) return {};
            const parsed = JSON.parse(saved);
            // Convert arrays back to Sets
            const result: Record<string, Set<number>> = {};
            for (const [tid, nums] of Object.entries(parsed)) {
                result[tid] = new Set(nums as number[]);
            }
            return result;
        } catch { return {}; }
    });
    const [showSettings, setShowSettings] = useState<Record<string, boolean>>({});

    // Persist sentLeaders to localStorage
    useEffect(() => {
        const serialized: Record<string, number[]> = {};
        for (const [tid, set] of Object.entries(sentLeaders)) {
            serialized[tid] = [...set];
        }
        localStorage.setItem("wa-sent-leaders", JSON.stringify(serialized));
    }, [sentLeaders]);

    // Fetch group status for each tournament
    useEffect(() => {
        tournaments.forEach(async (t) => {
            try {
                const res = await fetch(`/api/whatsapp/group/status?tournamentId=${t.id}`);
                if (res.ok) {
                    const json = await res.json();
                    setGroupStatus(prev => ({
                        ...prev,
                        [t.id]: { hasGroup: !!json.hasGroup, inviteLink: json.inviteLink },
                    }));
                }
            } catch {}
        });
    }, [tournaments]);

    const handleCreateGroup = async (tournamentId: string) => {
        setCreating(tournamentId);
        try {
            const res = await fetch("/api/whatsapp/group", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tournamentId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            toast.success(`Group created! Added ${json.added} leaders`);
            if (json.noPhone?.length > 0) {
                toast(`${json.noPhone.length} leaders have no phone`, { icon: "⚠️" });
            }
            setGroupStatus(prev => ({ ...prev, [tournamentId]: { hasGroup: true } }));
        } catch (err: any) {
            toast.error(err.message || "Failed to create group");
        } finally {
            setCreating(null);
        }
    };

    const handleSetInvite = async (tournamentId: string) => {
        const link = inviteInputs[tournamentId]?.trim();
        if (!link) return;
        setSaving(tournamentId);
        try {
            const res = await fetch("/api/whatsapp/set-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tournamentId, inviteLink: link }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            toast.success(json.message);
            setGroupStatus(prev => ({ ...prev, [tournamentId]: { hasGroup: true, inviteLink: link } }));
            setInviteInputs(prev => ({ ...prev, [tournamentId]: "" }));
        } catch (err: any) {
            toast.error(err.message || "Failed to set invite");
        } finally {
            setSaving(null);
        }
    };

    const handleAddLeaders = async (tournamentId: string) => {
        setAddingLeaders(tournamentId);
        try {
            const res = await fetch("/api/whatsapp/group/add-leaders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tournamentId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");

            const log = [
                `✅ Added: ${json.added}/${json.total} leaders`,
                ...(json.failed?.length > 0 ? [
                    ``,
                    `❌ Failed (${json.failed.length}):`,
                    ...json.failed.map((f: any) => `  • ${f.name} (${f.phone}) — ${f.reason}`),
                ] : []),
                ...(json.noPhone?.length > 0 ? [
                    ``,
                    `📵 No phone (${json.noPhone.length}):`,
                    ...json.noPhone.map((n: string) => `  • ${n}`),
                ] : []),
            ].join("\n");

            navigator.clipboard.writeText(log).catch(() => {});
            toast.success(`Added ${json.added} leaders — log copied!`);
        } catch (err: any) {
            toast.error(err.message || "Failed to add leaders");
        } finally {
            setAddingLeaders(null);
        }
    };

    const handleSendInviteToLeaders = async (tournamentId: string) => {
        setSendingInvites(tournamentId);
        try {
            const res = await fetch("/api/whatsapp/send-invite-to-leaders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tournamentId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");

            const log = [
                `✅ Invite sent to ${json.sent}/${json.total} leaders`,
                ...(json.failed?.length > 0 ? [
                    ``,
                    `❌ Failed (${json.failed.length}):`,
                    ...json.failed.map((f: any) => `  • ${f.name} (${f.phone}) — ${f.reason}`),
                ] : []),
                ...(json.noPhone?.length > 0 ? [
                    ``,
                    `📵 No phone (${json.noPhone.length}):`,
                    ...json.noPhone.map((n: string) => `  • ${n}`),
                ] : []),
            ].join("\n");

            navigator.clipboard.writeText(log).catch(() => {});
            toast.success(`Invite sent to ${json.sent} leaders — log copied!`);
        } catch (err: any) {
            toast.error(err.message || "Failed to send invites");
        } finally {
            setSendingInvites(null);
        }
    };

    const handleCheckMembers = async (tournamentId: string) => {
        setCheckingMembers(tournamentId);
        try {
            const res = await fetch(`/api/whatsapp/group/members?tournamentId=${tournamentId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            setMembersData(prev => ({ ...prev, [tournamentId]: json }));
            toast.success(`${json.joined.length} joined, ${json.notJoined.length} not yet`);
        } catch (err: any) {
            toast.error(err.message || "Failed to check members");
        } finally {
            setCheckingMembers(null);
        }
    };

    if (tournaments.length === 0) return null;

    return (
        <Card className="border border-divider">
            <CardBody className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <WhatsAppIcon className="w-4 h-4 text-green-500" />
                    <p className="text-sm font-semibold">WhatsApp Groups</p>
                </div>

                <div className="space-y-2">
                    {tournaments.map(t => {
                        const status = groupStatus[t.id];
                        const hasGroup = status?.hasGroup;
                        const members = membersData[t.id];
                        const isSettingsOpen = showSettings[t.id];

                        return (
                            <div key={t.id} className="rounded-xl border border-divider p-3 space-y-2">
                                {/* Header */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">{t.allowSquads ? "🏆" : "🎮"}</span>
                                    <p className="text-xs font-semibold flex-1 truncate">{t.name}</p>
                                    {hasGroup ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-bold">
                                            Group ✓
                                        </span>
                                    ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">
                                            No group
                                        </span>
                                    )}
                                </div>

                                {/* No group — Setup */}
                                {!hasGroup && (
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => handleCreateGroup(t.id)}
                                            disabled={creating === t.id}
                                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {creating === t.id ? "Creating..." : "Create Group (Bot)"}
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 border-t border-divider" />
                                            <span className="text-[10px] text-foreground/30 font-medium">OR paste link</span>
                                            <div className="flex-1 border-t border-divider" />
                                        </div>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="text"
                                                value={inviteInputs[t.id] || ""}
                                                onChange={(e) => setInviteInputs(prev => ({ ...prev, [t.id]: e.target.value }))}
                                                placeholder="https://chat.whatsapp.com/..."
                                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-default-100 border border-divider text-xs focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-foreground/25"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleSetInvite(t.id)}
                                                disabled={!inviteInputs[t.id]?.trim() || saving === t.id}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-default-200 hover:bg-default-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                {saving === t.id ? "..." : "Set"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Has group — show content based on whether teams exist */}
                                {hasGroup && t.hasTeams && (
                                    <MembersTab
                                        tournamentId={t.id}
                                        status={status}
                                        addingLeaders={addingLeaders}
                                        sendingInvites={sendingInvites}
                                        checkingMembers={checkingMembers}
                                        membersData={membersData}
                                        leadersData={leadersData}
                                        sentLeaders={sentLeaders}
                                        onAddLeaders={handleAddLeaders}
                                        onSendInvites={handleSendInviteToLeaders}
                                        onCheckMembers={handleCheckMembers}
                                        onLoadLeaders={async (tid) => {
                                            try {
                                                const res = await fetch(`/api/whatsapp/group/leaders?tournamentId=${tid}`);
                                                const json = await res.json();
                                                if (res.ok) setLeadersData(prev => ({ ...prev, [tid]: json }));
                                            } catch {}
                                        }}
                                        onSetSent={(tid, teamNum) => {
                                            setSentLeaders(prev => {
                                                const s = new Set(prev[tid] || []);
                                                s.add(teamNum);
                                                return { ...prev, [tid]: s };
                                            });
                                        }}
                                        setMembersData={(tid, data) => setMembersData(prev => ({ ...prev, [tid]: data }))}
                                        inviteInputs={inviteInputs}
                                        setInviteInputs={setInviteInputs}
                                        saving={saving}
                                        onSetInvite={handleSetInvite}
                                        isSettingsOpen={isSettingsOpen}
                                        onToggleSettings={() => setShowSettings(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                                    />
                                )}

                                {/* Group ready but no teams generated yet */}
                                {hasGroup && !t.hasTeams && (
                                    <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 p-3 text-center space-y-1">
                                        <p className="text-xs font-semibold text-blue-400">✅ Group ready!</p>
                                        <p className="text-[10px] text-foreground/40">
                                            Generate teams to start sending invites to leaders
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardBody>
        </Card>
    );
}

/* ─── Members Panel (flat layout, no tabs) ─────────────────────── */

interface MembersTabProps {
    tournamentId: string;
    status?: { hasGroup: boolean; inviteLink?: string };
    addingLeaders: string | null;
    sendingInvites: string | null;
    checkingMembers: string | null;
    membersData: Record<string, MembersData>;
    leadersData: Record<string, { tournamentName: string; leaders: { teamNumber: number; name: string; phone: string | null; teammates: string[] }[]; inviteLink: string | null }>;
    sentLeaders: Record<string, Set<number>>;
    onAddLeaders: (tid: string) => void;
    onSendInvites: (tid: string) => void;
    onCheckMembers: (tid: string) => void;
    onLoadLeaders: (tid: string) => Promise<void>;
    onSetSent: (tid: string, teamNum: number) => void;
    setMembersData: (tid: string, data: MembersData) => void;
    inviteInputs: Record<string, string>;
    setInviteInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    saving: string | null;
    onSetInvite: (tid: string) => void;
    isSettingsOpen?: boolean;
    onToggleSettings: () => void;
}

function MembersTab({
    tournamentId,
    status,
    addingLeaders,
    sendingInvites,
    checkingMembers,
    membersData,
    leadersData,
    sentLeaders,
    onAddLeaders,
    onSendInvites,
    onCheckMembers,
    onLoadLeaders,
    onSetSent,
    inviteInputs,
    setInviteInputs,
    saving,
    onSetInvite,
    isSettingsOpen,
    onToggleSettings,
}: MembersTabProps) {
    const members = membersData[tournamentId];
    const leaders = leadersData[tournamentId];
    const [loadingLeaders, setLoadingLeaders] = useState(false);

    // Auto-load leaders and check members on mount
    useEffect(() => {
        if (!leaders) {
            setLoadingLeaders(true);
            onLoadLeaders(tournamentId).finally(() => setLoadingLeaders(false));
        }
        if (!members) {
            onCheckMembers(tournamentId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId]);

    return (
        <div className="space-y-2">

            {/* ── 1. Manual Send List (primary section) ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-foreground/50">📋 Manual Send</p>
                    {leaders && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            (sentLeaders[tournamentId]?.size || 0) === leaders.leaders.filter(l => l.phone).length
                                ? "bg-green-500/15 text-green-500"
                                : "bg-foreground/5 text-foreground/40"
                        }`}>
                            {sentLeaders[tournamentId]?.size || 0}/{leaders.leaders.filter(l => l.phone).length}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setLoadingLeaders(true);
                        onLoadLeaders(tournamentId).finally(() => setLoadingLeaders(false));
                    }}
                    disabled={loadingLeaders}
                    className="text-[10px] font-semibold text-blue-500 hover:text-blue-400 cursor-pointer disabled:opacity-50"
                >
                    {loadingLeaders ? "Loading..." : "Refresh"}
                </button>
            </div>

            {/* Loading skeleton */}
            {loadingLeaders && !leaders && (
                <div className="space-y-1.5 animate-pulse">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-default-50">
                            <div className="w-5 h-3 bg-default-200 rounded" />
                            <div className="flex-1 h-3 bg-default-200 rounded" />
                            <div className="w-12 h-5 bg-default-200 rounded" />
                        </div>
                    ))}
                </div>
            )}

            {leaders && (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                    {leaders.leaders.map((l) => {
                        const isSent = sentLeaders[tournamentId]?.has(l.teamNumber);
                        const invLink = leaders.inviteLink || status?.inviteLink;
                        const tName = leaders.tournamentName;
                        const cleanPhone = l.phone?.replace(/[^0-9]/g, "") || "";
                        const fullPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
                        const teammatesList = l.teammates.length > 0
                            ? `\nKi teammates phi:\n${l.teammates.map(t => `• ${t}`).join("\n")}`
                            : "";
                        const waText = encodeURIComponent(
                            `Hi ${l.name}! 👋 Phi dei u leader jong ka Team ${l.teamNumber} haka *${tName}*.\n\nJoin kane ka WhatsApp group ban ioh Room ID bad kiwei ki jingpyntip:\n${invLink || ""}\n\nSngewbha share lang ia kane ka link sha kine ki teammates phi ha rum, ba kin ioh lang ia ka Room ID. Khublei! 🙏${teammatesList}`
                        );
                        const waUrl = `https://wa.me/${fullPhone}?text=${waText}`;

                        return (
                            <div key={l.teamNumber} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isSent ? "bg-green-500/5" : "bg-default-50"}`}>
                                <span className="text-[10px] font-bold text-foreground/30 w-5 text-right shrink-0">
                                    T{l.teamNumber}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium truncate">{l.name}</p>
                                    {l.teammates.length > 0 && (
                                        <p className="text-[9px] text-foreground/30 truncate">
                                            + {l.teammates.join(", ")}
                                        </p>
                                    )}
                                </div>
                                {l.phone ? (
                                    isSent ? (
                                        <a
                                            href={waUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-foreground/5 text-foreground/40 hover:bg-foreground/10 transition-colors cursor-pointer shrink-0"
                                        >
                                            Resend
                                        </a>
                                    ) : (
                                        <a
                                            href={waUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => onSetSent(tournamentId, l.teamNumber)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-colors cursor-pointer shrink-0"
                                        >
                                            <WhatsAppIcon className="w-3 h-3" />
                                            Send
                                        </a>
                                    )
                                ) : (
                                    <span className="text-[10px] text-amber-500 italic shrink-0">No phone</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── 2. Group Status (who joined) ── */}
            <div className="border-t border-divider pt-2">
                <button
                    type="button"
                    onClick={() => onCheckMembers(tournamentId)}
                    disabled={checkingMembers === tournamentId}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                    <RefreshCw className={`w-3 h-3 ${checkingMembers === tournamentId ? "animate-spin" : ""}`} />
                    {checkingMembers === tournamentId ? "Checking..." : "Check Who Joined"}
                </button>

                {/* Skeleton */}
                {checkingMembers === tournamentId && !members && (
                    <div className="mt-1.5 rounded-lg bg-default-50 border border-divider p-2 space-y-1.5 animate-pulse">
                        <div className="h-3 w-24 bg-default-200 rounded" />
                        {[1, 2, 3].map(i => <div key={i} className="h-3 bg-default-200 rounded w-3/4" />)}
                    </div>
                )}

                {members && (
                    <div className="mt-1.5 rounded-lg bg-default-50 border border-divider p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-foreground/50">
                                Group: {members.totalMembers} members
                            </span>
                            <span className="text-[10px] font-bold text-green-500">
                                {members.joined.length} ✓ / {members.notJoined.length} ✗
                            </span>
                        </div>
                        {members.notJoined.length > 0 && (
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-bold text-red-400">Not joined:</p>
                                {members.notJoined.map((m, i) => (
                                    <p key={i} className="text-[10px] text-foreground/50 pl-2">
                                        T{m.teamNumber} — {m.name}
                                        {!m.phone && <span className="text-amber-500 ml-1">(no phone)</span>}
                                    </p>
                                ))}
                            </div>
                        )}
                        {members.joined.length > 0 && members.notJoined.length === 0 && (
                            <p className="text-[10px] text-green-500 font-bold text-center py-1">
                                🎉 All leaders joined!
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ── 3. Settings (collapsible) ── */}
            <div className="border-t border-divider pt-2">
                <button
                    type="button"
                    onClick={onToggleSettings}
                    className="w-full flex items-center justify-between py-1 text-[10px] font-bold text-foreground/40 hover:text-foreground/60 cursor-pointer transition-colors"
                >
                    <span>⚙️ Settings & Bulk Actions</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isSettingsOpen ? "rotate-180" : ""}`} />
                </button>

                {isSettingsOpen && (
                    <div className="mt-1.5 space-y-2">
                        {/* Invite link */}
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                value={inviteInputs[tournamentId] || ""}
                                onChange={(e) => setInviteInputs(prev => ({ ...prev, [tournamentId]: e.target.value }))}
                                placeholder={status?.inviteLink || "https://chat.whatsapp.com/..."}
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-default-100 border border-divider text-xs focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-foreground/25"
                            />
                            <button
                                type="button"
                                onClick={() => onSetInvite(tournamentId)}
                                disabled={!inviteInputs[tournamentId]?.trim() || saving === tournamentId}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-default-200 hover:bg-default-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                {saving === tournamentId ? "..." : "Update Link"}
                            </button>
                        </div>
                        {status?.inviteLink && (
                            <p className="text-[10px] text-foreground/30 truncate">
                                ✓ {status.inviteLink}
                            </p>
                        )}

                        {/* Bulk actions */}
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => onAddLeaders(tournamentId)}
                                disabled={addingLeaders === tournamentId}
                                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold bg-default-100 border border-divider hover:bg-default-200 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <Users className="w-3 h-3" />
                                {addingLeaders === tournamentId ? "Adding..." : "Add to Group"}
                            </button>
                            {status?.inviteLink && (
                                <button
                                    type="button"
                                    onClick={() => onSendInvites(tournamentId)}
                                    disabled={sendingInvites === tournamentId}
                                    className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <Send className="w-3 h-3" />
                                    {sendingInvites === tournamentId ? "Sending..." : "DM Invite All"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

