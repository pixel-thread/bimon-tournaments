"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Check, ChevronDown, Phone, RefreshCw, Link, Copy, ImagePlus, BookOpen } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { toast } from "sonner";
import { SPIRIT_LINES } from "@/lib/spirit-lines";

interface InPlayTournament {
    id: string;
    name: string;
    type: string;
    hasTeams: boolean;
    hasSquads: boolean;
    allowSquads: boolean;
    seasonName: string | null;
}

/**
 * /dashboard/room-info — Clean WhatsApp Manual Send page.
 * For each in-play tournament: invite link entry + leader list with WA send buttons.
 */
export default function RoomInfoPage() {
    const [selectedId, setSelectedId] = useState("");
    const [dropOpen, setDropOpen] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

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
    useEffect(() => {
        if (tournaments.length > 0 && !selectedId) {
            setSelectedId(tournaments[0].id);
        }
    }, [tournaments, selectedId]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selected = tournaments.find(t => t.id === selectedId) || tournaments[0];

    return (
        <div className="space-y-4 p-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
                    <WhatsAppIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h1 className="text-lg font-bold">WhatsApp Send</h1>
                    <p className="text-xs text-foreground/40">
                        Set invite links · Send to leaders
                    </p>
                </div>
            </div>

            {/* Custom Tournament Selector */}
            {tournaments.length > 0 && (
                <div ref={dropRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setDropOpen(prev => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-default-100 border border-divider text-sm font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                        <span className="flex items-center gap-2 truncate">
                            <span>{selected?.allowSquads ? "🏆" : "🎮"}</span>
                            <span className="truncate">{selected?.name}</span>
                            {selected && !selected.hasTeams && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold shrink-0">Registration</span>
                            )}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-foreground/40 shrink-0 transition-transform ${dropOpen ? "rotate-180" : ""}`} />
                    </button>

                    {dropOpen && (
                        <div className="absolute z-50 top-full mt-1 w-full rounded-xl bg-content1 border border-divider shadow-lg overflow-hidden">
                            {tournaments.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => { setSelectedId(t.id); setDropOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold cursor-pointer transition-colors ${
                                        t.id === selected?.id
                                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                            : "hover:bg-default-100 text-foreground"
                                    }`}
                                >
                                    <span>{t.allowSquads ? "🏆" : "🎮"}</span>
                                    <span className="flex-1 truncate">{t.name}</span>
                                    {!t.hasTeams && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold shrink-0">Registration</span>
                                    )}
                                    {t.id === selected?.id && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tournaments.length === 0 && (
                <div className="rounded-xl bg-default-50 border border-divider p-8 text-center">
                    <p className="text-sm text-foreground/40">No in-play tournaments</p>
                </div>
            )}

            {selected && (
                <TournamentCard key={selected.id} tournament={selected} />
            )}
        </div>
    );
}


/* ─── Copy Button with visual feedback ─────────────────────────── */

function CopyBtn({ text, label }: { text: string; label: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                copied
                    ? "bg-green-500/10 border-green-500/20 text-green-500"
                    : "bg-default-50 border-divider text-foreground/50 hover:bg-default-100 hover:text-foreground/70"
            }`}
        >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied ✓" : label}
        </button>
    );
}


/* ─── Group Icon Copy (copies image to clipboard) ──────────────── */

function GroupIconCopy() {
    const [copied, setCopied] = useState(false);

    const handleDownload = () => {
        const a = document.createElement("a");
        a.href = "/images/wa-group-icon.jpg";
        a.download = "wa-group-icon.jpg";
        a.click();
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            type="button"
            onClick={handleDownload}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                copied
                    ? "bg-green-500/10 border-green-500/20 text-green-500"
                    : "bg-default-50 border-divider text-foreground/50 hover:bg-default-100 hover:text-foreground/70"
            }`}
        >
            {copied ? <Check className="w-3 h-3" /> : <ImagePlus className="w-3 h-3" />}
            {copied ? "Copied ✓" : "Group Icon"}
        </button>
    );
}


/* ─── Invite Link Row with copy feedback ───────────────────────── */

function InvLinkRow({ link }: { link: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="flex items-center gap-1.5 px-1">
            <p className="text-[10px] text-green-500/70 font-medium break-all flex-1">{link}</p>
            <button
                type="button"
                onClick={() => {
                    navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
                className={`shrink-0 p-1 rounded-lg transition-colors cursor-pointer ${
                    copied ? "text-green-500" : "text-foreground/30 hover:text-foreground/60 hover:bg-default-100"
                }`}
            >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
        </div>
    );
}


/* ─── Tournament Card ──────────────────────────────────────────── */

interface LeaderData {
    teamNumber: number;
    teamName: string;
    group: string | null;
    phase: string | null;
    status: string | null;
    name: string;
    phone: string | null;
    teammates: string[];
}

interface LeadersResponse {
    tournamentName: string;
    isChampionship: boolean;
    currentPhase: string | null;
    leaders: LeaderData[];
    inviteLink: string | null;
    channelInvites: Record<string, string>;
    preGeneration?: boolean;
}

function TournamentCard({ tournament }: { tournament: InPlayTournament }) {
    const [inviteInput, setInviteInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [copyToolsOpen, setCopyToolsOpen] = useState(false);
    const [groupStatus, setGroupStatus] = useState<{ hasGroup: boolean; inviteLink?: string } | null>(null);
    const [leadersData, setLeadersData] = useState<LeadersResponse | null>(null);
    const [loadingLeaders, setLoadingLeaders] = useState(false);
    const [loadingGroup, setLoadingGroup] = useState(true);
    const [sentLeaders, setSentLeaders] = useState<Set<number>>(() => {
        if (typeof window === "undefined") return new Set();
        try {
            const saved = localStorage.getItem("wa-sent-leaders");
            if (!saved) return new Set();
            const parsed = JSON.parse(saved);
            return new Set(parsed[tournament.id] || []);
        } catch { return new Set(); }
    });

    // Persist sent state
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem("wa-sent-leaders") || "{}");
            saved[tournament.id] = [...sentLeaders];
            localStorage.setItem("wa-sent-leaders", JSON.stringify(saved));
        } catch {}
    }, [sentLeaders, tournament.id]);

    // Fetch group status
    useEffect(() => {
        setLoadingGroup(true);
        (async () => {
            try {
                const res = await fetch(`/api/whatsapp/group/status?tournamentId=${tournament.id}`);
                if (res.ok) {
                    const json = await res.json();
                    setGroupStatus({ hasGroup: !!json.hasGroup, inviteLink: json.inviteLink });
                }
            } catch {}
            setLoadingGroup(false);
        })();
    }, [tournament.id]);

    // Auto-load leaders
    useEffect(() => {
        if ((tournament.hasTeams || tournament.hasSquads) && !leadersData) {
            loadLeaders();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournament.id, tournament.hasTeams, tournament.hasSquads]);

    const loadLeaders = async () => {
        setLoadingLeaders(true);
        try {
            const res = await fetch(`/api/whatsapp/group/leaders?tournamentId=${tournament.id}`);
            const json = await res.json();
            if (res.ok) setLeadersData(json);
        } catch {}
        setLoadingLeaders(false);
    };

    const handleSetInvite = async () => {
        const link = inviteInput.trim();
        if (!link) return;
        setSaving(true);
        try {
            const res = await fetch("/api/whatsapp/set-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tournamentId: tournament.id, inviteLink: link }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed");
            toast.success(json.message);
            setGroupStatus({ hasGroup: true, inviteLink: link });
            setInviteInput("");
        } catch (err: any) {
            toast.error(err.message || "Failed");
        } finally {
            setSaving(false);
        }
    };

    const mainInvLink = leadersData?.inviteLink || groupStatus?.inviteLink;
    const leaders = leadersData?.leaders || [];
    const phase = leadersData?.currentPhase || "HEATS";
    const isChamp = leadersData?.isChampionship || false;

    // ── Championship tab logic ─────────────────────────────────
    // Build tabs: [Main] [Group A] [Group B] ... for HEATS, [Wildcard] / [Finals] for later phases
    const champTabs: { key: string; label: string; leaders: LeaderData[]; invLink: string | null }[] = [];
    if (isChamp && leaders.length > 0) {
        if (phase === "HEATS") {
            champTabs.push({ key: "main", label: "Heats Main", leaders, invLink: mainInvLink || null });
            const groups = new Map<string, LeaderData[]>();
            for (const l of leaders) {
                const g = l.group || "?";
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g)!.push(l);
            }
            [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([letter, gl]) => {
                champTabs.push({ key: letter, label: `Group ${letter}`, leaders: gl, invLink: leadersData?.channelInvites[letter] || null });
            });
        } else {
            const phaseLabel = phase === "WILDCARD" ? "Wildcard" : "Finals";
            champTabs.push({ key: phase, label: phaseLabel, leaders, invLink: leadersData?.channelInvites[phase] || mainInvLink || null });
        }
    }

    const [champTab, setChampTab] = useState("main");
    const activeChampTab = champTabs.find(t => t.key === champTab) || champTabs[0];
    const activeInvLink = isChamp && activeChampTab ? activeChampTab.invLink : mainInvLink;
    const activeLeaders = isChamp && activeChampTab ? activeChampTab.leaders : leaders;

    const initialLoading = loadingGroup || ((tournament.hasTeams || tournament.hasSquads) && loadingLeaders && !leadersData);

    if (initialLoading) {
        return (
            <div className="space-y-3 animate-pulse">
                <div className="h-10 rounded-xl bg-default-100" />
                <div className="flex gap-2">
                    <div className="flex-1 h-9 rounded-xl bg-default-100" />
                    <div className="flex-1 h-9 rounded-xl bg-default-100" />
                </div>
                <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-default-50" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Championship tabs — right below tournament selector */}
            {isChamp && champTabs.length > 1 && (
                <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
                    {champTabs.map(tab => {
                        const tabWithPhone = tab.leaders.filter(l => l.phone);
                        const tabSent = tabWithPhone.filter(l => sentLeaders.has(l.teamNumber)).length;
                        const isActive = champTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setChampTab(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                                    isActive
                                        ? "bg-green-500/15 text-green-500 border border-green-500/30"
                                        : "bg-default-50 text-foreground/50 border border-transparent hover:bg-default-100"
                                }`}
                            >
                                {tab.label}
                                <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                                    tabSent === tabWithPhone.length && tabWithPhone.length > 0
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-foreground/5 text-foreground/30"
                                }`}>
                                    {tabSent}/{tabWithPhone.length}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Phase badge (non-tabbed championship or single phase) */}
            {isChamp && champTabs.length <= 1 && (
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">
                    {phase === "HEATS" ? "Heats" : phase === "WILDCARD" ? "Wildcard" : phase === "FINALS" ? "Finals" : phase}
                </span>
            )}

            {/* Invite link — scoped to active tab */}
            <div className="space-y-1.5">
                <div className="flex gap-1.5">
                    <input
                        type="text"
                        value={inviteInput}
                        onChange={(e) => setInviteInput(e.target.value)}
                        placeholder={activeInvLink || "https://chat.whatsapp.com/..."}
                        className="flex-1 px-3 py-2 rounded-xl bg-default-100 border border-divider text-xs focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-foreground/25"
                    />
                    <button
                        type="button"
                        onClick={handleSetInvite}
                        disabled={!inviteInput.trim() || saving}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {saving ? "..." : activeInvLink ? "Update" : "Set"}
                    </button>
                </div>
                {activeInvLink && <InvLinkRow link={activeInvLink} />}
            </div>

            {/* Quick copy tools — collapsed by default */}
            <div className="rounded-xl border border-divider bg-default-50 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setCopyToolsOpen(prev => !prev)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-default-100 transition-colors"
                >
                    <Copy className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                    <span className="text-xs font-semibold text-foreground/50 flex-1">Copy Tools</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-foreground/30 transition-transform ${copyToolsOpen ? "rotate-180" : ""}`} />
                </button>
                {copyToolsOpen && (
                    <div className="px-2 pb-2 pt-1">
                    {(() => {
                        const tName = tournament.name;
                        const sName = tournament.seasonName;
                        const spiritLine = SPIRIT_LINES[Math.floor(Math.random() * SPIRIT_LINES.length)];
                        const seasonLine = sName ? `📅 Season: ${sName}` : "";
                        const tabLabel = activeChampTab?.label || "";
                        let groupTitle = tName;
                        let groupDesc = "";

                        const buildDesc = (header: string, welcome: string) => [
                            header,
                            ...(seasonLine ? [seasonLine] : []),
                            ``,
                            welcome,
                            ``,
                            `📋 How it works:`,
                            `• Room ID and password will be shared here`,
                            `• Share the link with your teammates only`,
                            `• Do NOT share Room ID with anyone outside this group`,
                            ``,
                            `⚠️ Anyone caught sharing Room ID will be disqualified.`,
                            ``,
                            spiritLine,
                        ].join("\n");

                        if (isChamp && phase === "HEATS") {
                            const suffix = champTab === "main" ? "Heats" : tabLabel;
                            groupTitle = `${tName} - ${suffix}`;
                            groupDesc = buildDesc(`🎮 ${tName} — ${suffix}`, `Welcome to ${suffix}!`);
                        } else if (isChamp && phase === "WILDCARD") {
                            groupTitle = `${tName} - Wildcard`;
                            groupDesc = buildDesc(`🏆 ${tName} — Wildcard Round`, `Congratulations on making it to the Wildcard Round!`);
                        } else if (isChamp && phase === "FINALS") {
                            groupTitle = `${tName} - Finals`;
                            groupDesc = buildDesc(`🏆 ${tName} — FINALS`, `Congratulations on making it to the FINALS!`);
                        } else {
                            groupDesc = buildDesc(`🎮 ${tName}`, `Welcome!`);
                        }

                        return (
                            <div className="flex gap-2">
                                <CopyBtn text={groupTitle} label="Group Title" />
                                <CopyBtn text={groupDesc} label="Group Desc" />
                                <GroupIconCopy />
                                <RulesCopyBtn />
                            </div>
                        );
                    })()}
                    </div>
                )}
            </div>
            {/* No teams yet */}
            {!tournament.hasTeams && !tournament.hasSquads && (
                <div className="rounded-lg bg-default-50 border border-divider p-3 text-center">
                    <p className="text-[11px] text-foreground/40">No teams or squads yet</p>
                </div>
            )}

            {/* Leaders list — scoped to active tab */}
            {(tournament.hasTeams || tournament.hasSquads) && (
                <LeadersList
                    tournamentId={tournament.id}
                    leaders={activeLeaders}
                    leadersData={leadersData}
                    isChamp={isChamp}
                    phase={phase}
                    mainInvLink={activeInvLink || null}
                    groupStatus={groupStatus}
                    sentLeaders={sentLeaders}
                    loadingLeaders={loadingLeaders}
                    onRefresh={loadLeaders}
                    onSetSent={(teamNum) => setSentLeaders(prev => new Set([...prev, teamNum]))}
                />
            )}
        </div>
    );
}


/* ─── Rules Copy Button ────────────────────────────────────────── */

function RulesCopyBtn() {
    const [copied, setCopied] = useState(false);

    const { data: rules = [] } = useQuery<{ id: string; text: string }[]>({
        queryKey: ["tournament-rules"],
        queryFn: async () => {
            const res = await fetch("/api/settings/tournament-rules");
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 5 * 60_000,
    });

    if (rules.length === 0) return null;

    const handleCopy = () => {
        const formatted = rules.map((r, i) => `*${i + 1}.* ${r.text}`).join("\n\n");
        const message = `📋 *Tournament Rules*\n\n${formatted}\n\n⚠️ *Breaking any rule = disqualification*`;
        navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                copied
                    ? "bg-green-500/10 border-green-500/20 text-green-500"
                    : "bg-default-50 border-divider text-foreground/50 hover:bg-default-100 hover:text-foreground/70"
            }`}
        >
            {copied ? <Check className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
            {copied ? "Copied ✓" : "Rules"}
        </button>
    );
}


/* ─── Leaders List ─────────────────────────────────────────────── */

function LeadersList({
    tournamentId,
    leaders,
    leadersData,
    isChamp,
    phase,
    mainInvLink,
    groupStatus,
    sentLeaders,
    loadingLeaders,
    onRefresh,
    onSetSent,
}: {
    tournamentId: string;
    leaders: LeaderData[];
    leadersData: LeadersResponse | null;
    isChamp: boolean;
    phase: string;
    mainInvLink: string | null;
    groupStatus: { hasGroup: boolean; inviteLink?: string } | null;
    sentLeaders: Set<number>;
    loadingLeaders: boolean;
    onRefresh: () => void;
    onSetSent: (teamNum: number) => void;
}) {
    const tName = leadersData?.tournamentName || "";

    // Render a single leader row
    const renderLeader = (l: LeaderData, invLink?: string | null) => {
        const isSent = sentLeaders.has(l.teamNumber);
        const link = invLink || mainInvLink;
        const cleanPhone = l.phone?.replace(/[^0-9]/g, "") || "";
        const fullPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
        const isPreGen = !!leadersData?.preGeneration;
        const teammatesList = (!isPreGen && l.teammates.length > 0)
            ? `\nKi teammates phi:\n${l.teammates.map(t => `•  ${t}`).join("\n")}`
            : "";
        const spiritLine = SPIRIT_LINES[(l.teamNumber + Date.now() % 97) % SPIRIT_LINES.length];

        // Build phase-aware message
        let waMessage = "";
        if (isChamp && phase === "HEATS") {
            const groupLabel = l.group ? ` ha *Group ${l.group}*` : "";
            waMessage = `Hi ${l.name}! 👋 Phi dei u leader jong ka *${l.teamName}*${groupLabel} haka *${tName}*.\n\nJoin kane ka WhatsApp group ban ioh Room ID bad kiwei ki jingpyntip:\n${link || ""}\n\nSngewbha share lang ia kane ka link sha kine ki teammates phi, ba kin ioh lang ia ka Room ID. Khublei! 🙏${teammatesList}\n\n${spiritLine}`;
        } else if (isChamp && phase === "WILDCARD") {
            waMessage = `Hi ${l.name}! 👋\n\n🎉 *Congratulations!* Ka team phi *${l.teamName}* la qualify sha ka *Wildcard Round* jong ka *${tName}*!\n\nJoin kane ka WhatsApp group ban ioh Room ID bad kiwei ki jingpyntip:\n${link || ""}\n\nSngewbha share lang ia kane ka link sha kine ki teammates phi. Khublei! 🙏${teammatesList}\n\n${spiritLine}`;
        } else if (isChamp && phase === "FINALS") {
            waMessage = `Hi ${l.name}! 👋\n\n🏆 *Congratulations!* Ka team phi *${l.teamName}* la qualify sha ka *FINALS* jong ka *${tName}*!\n\nJoin kane ka WhatsApp group ban ioh Room ID bad kiwei ki jingpyntip:\n${link || ""}\n\nSngewbha share lang ia kane ka link sha kine ki teammates phi. Khublei! 🙏${teammatesList}\n\n${spiritLine}`;
        } else {
            waMessage = `Hi ${l.name}! 👋 Phi dei u leader jong ka *${l.teamName}* haka *${tName}*.\n\nJoin kane ka WhatsApp group ban ioh Room ID bad kiwei ki jingpyntip:\n${link || ""}\n\nSngewbha share lang ia kane ka link sha kine ki teammates phi, ba kin ioh lang ia ka Room ID. Khublei! 🙏${teammatesList}\n\n${spiritLine}`;
        }

        const waText = encodeURIComponent(waMessage);
        const waUrl = `https://wa.me/${fullPhone}?text=${waText}`;

        return (
            <div key={l.teamNumber} className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${isSent ? "bg-green-500/5 border-green-500/10" : "bg-default-50 border-transparent"}`}>
                <span className={`text-xs font-bold w-6 text-center shrink-0 ${isSent ? "text-green-500" : "text-foreground/30"}`}>
                    {isSent ? "✓" : l.teamNumber}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{l.name}</p>
                    <p className="text-xs text-foreground/35 truncate">{l.teamName}</p>
                </div>
                {l.phone ? (
                    <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onSetSent(l.teamNumber)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                            isSent
                                ? "bg-green-500/10 text-green-500"
                                : "bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366]"
                        }`}
                    >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        {isSent ? "Sent" : "Send"}
                    </a>
                ) : (
                    <span className="text-[10px] text-foreground/20 italic shrink-0">No phone</span>
                )}
            </div>
        );
    };

    const withPhone = leaders.filter(l => l.phone);
    const sentCount = withPhone.filter(l => sentLeaders.has(l.teamNumber)).length;

    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        sentCount === withPhone.length && withPhone.length > 0
                            ? "bg-green-500/15 text-green-500"
                            : "bg-foreground/5 text-foreground/40"
                    }`}>
                        {sentCount}/{withPhone.length}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loadingLeaders}
                    className="text-[10px] font-semibold text-blue-500 hover:text-blue-400 cursor-pointer disabled:opacity-50"
                >
                    {loadingLeaders ? "..." : "↻"}
                </button>
            </div>

            {/* Loading */}
            {loadingLeaders && leaders.length === 0 && (
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

            {/* Leader rows */}
            {leaders.length > 0 && (
                <div className="space-y-1">
                    {leaders.map(l => renderLeader(l))}
                </div>
            )}

            {/* Empty */}
            {!loadingLeaders && leaders.length === 0 && (
                <div className="rounded-lg bg-default-50 border border-divider p-4 text-center">
                    <p className="text-[11px] text-foreground/30">No leaders found</p>
                </div>
            )}
        </div>
    );
}


/* ─── Group Section ────────────────────────────────────────────── */

function GroupSection({
    label,
    leaders,
    inviteLink,
    sentLeaders,
    renderLeader,
    tournamentName,
}: {
    label: string;
    leaders: LeaderData[];
    inviteLink: string | null;
    sentLeaders: Set<number>;
    renderLeader: (l: LeaderData, invLink?: string | null) => React.ReactNode;
    tournamentName?: string;
}) {
    const withPhone = leaders.filter(l => l.phone);
    const sentCount = withPhone.filter(l => sentLeaders.has(l.teamNumber)).length;

    const copyTitle = () => {
        const title = tournamentName ? `${tournamentName} — ${label.replace(/^[🏠🏆]\s*/, "")}` : label;
        navigator.clipboard.writeText(title);
        toast.success("Title copied!");
    };

    return (
        <div className="rounded-lg border border-divider overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-default-50">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold">{label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        sentCount === withPhone.length && withPhone.length > 0
                            ? "bg-green-500/15 text-green-500"
                            : "bg-foreground/5 text-foreground/40"
                    }`}>
                        {sentCount}/{withPhone.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={copyTitle}
                        className="text-foreground/20 hover:text-foreground/50 cursor-pointer transition-colors"
                        title="Copy group title"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                    {inviteLink ? (
                        <span className="text-[9px] text-green-500 font-medium">Link ✓</span>
                    ) : (
                        <span className="text-[9px] text-amber-500 font-medium">No link</span>
                    )}
                </div>
            </div>
            <div className="space-y-1 p-1">
                {leaders.map(l => renderLeader(l, inviteLink))}
            </div>
        </div>
    );
}
