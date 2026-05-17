"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Select,
    SelectItem,
    Switch,
} from "@heroui/react";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Vote, Loader2, Link as LinkIcon, Check, Plus, X } from "lucide-react";
import { GAME } from "@/lib/game-config";

interface PollOptionDTO {
    id: string;
    name: string;
    vote: string;
}

interface PollDTO {
    id: string;
    question: string;
    days: string;
    teamType: string;
    allowSquads?: boolean;
    isChampionship?: boolean;
    scheduledDate?: string | null;
    scheduledTime?: string;
    matchSchedule?: Record<string, string[]> | null;
    enableFund?: boolean;
    prizePoolFee?: number | null;
    expectedPrizePool?: number | null;
    whatsappGroupLink?: string | null;
    orgCutFixed?: number | null;
    isActive: boolean;
    options?: PollOptionDTO[];
    tournament?: { id: string; name: string; fee: number; type?: string };
}

interface TournamentOption {
    id: string;
    name: string;
    fee: number;
}

const TEAM_TYPES = ["DYNAMIC", "SOLO", "DUO", "TRIO", "SQUAD"];
const TOURNAMENT_FORMAT_LABELS: Record<string, string> = {
    BRACKET_1V1: "⚔️ Knockout",
    LEAGUE: "🏟️ League",
    GROUP_KNOCKOUT: "🌍 Group + Knockout",
};
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Mon - Sat", "Custom"];

interface PollFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    poll?: PollDTO | null; // null = create, object = edit
    onSaved: () => void;
}

export function PollFormModal({ isOpen, onClose, poll, onSaved }: PollFormModalProps) {
    const isEdit = !!poll;

    const [question, setQuestion] = useState("");
    const [days, setDays] = useState("Monday");
    const [customDays, setCustomDays] = useState("");
    const [teamType, setTeamType] = useState(GAME.features.hasTeamSizes ? "DYNAMIC" : "SOLO");
    const [tournamentFormat, setTournamentFormat] = useState(GAME.defaultTournamentType ?? "BRACKET_1V1");
    const [tournamentId, setTournamentId] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [allowSquads, setAllowSquads] = useState(false);

    const [enableFund, setEnableFund] = useState(true);
    const [prizePoolFee, setPrizePoolFee] = useState<string>("");
    const [expectedPrizePool, setExpectedPrizePool] = useState<string>("");
    const [arenaMode, setArenaMode] = useState<"none" | "tdm" | "wow">("none");
    const [scheduledDate, setScheduledDate] = useState("");
    const [scheduledTime, setScheduledTime] = useState("20:00");
    const [options, setOptions] = useState<PollOptionDTO[]>([]);
    const [saving, setSaving] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [whatsappGroupLink, setWhatsappGroupLink] = useState("");
    const [orgCutFixed, setOrgCutFixed] = useState<string>("");
    // Per-day match schedule: { "Friday": ["20:00", "20:45"], "Saturday": ["20:00", "21:00"] }
    const [matchSchedule, setMatchSchedule] = useState<Record<string, string[]>>({});

    // Load tournaments for select
    const { data: tournaments } = useQuery<TournamentOption[]>({
        queryKey: ["tournaments-for-poll"],
        queryFn: async () => {
            const res = await fetch("/api/tournaments");
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data?.map((t: any) => ({ id: t.id, name: t.name, fee: t.fee ?? 0 })) ?? [];
        },
        enabled: isOpen,
    });

    // Reset form when poll changes
    useEffect(() => {
        if (poll) {
            setQuestion(poll.question);
            setDays(poll.days);
            setTeamType(poll.teamType);
            setTournamentId(poll.tournament?.id ?? "");
            setTournamentFormat(poll.tournament?.type ?? GAME.defaultTournamentType ?? "BRACKET_1V1");
            setIsActive(poll.isActive);
            setAllowSquads(poll.allowSquads ?? false);

            setScheduledDate(poll.scheduledDate ? new Date(poll.scheduledDate).toISOString().split("T")[0] : "");
            setScheduledTime(poll.scheduledTime || "20:00");
            setEnableFund(poll.enableFund ?? true);
            setPrizePoolFee(poll.prizePoolFee != null ? String(poll.prizePoolFee) : "");
            setExpectedPrizePool(poll.expectedPrizePool != null ? String(poll.expectedPrizePool) : "");
            setArenaMode("none"); // Arena mode is determined by tournament flags, not poll
            setOptions(poll.options?.map(o => ({ ...o })) ?? []);
            setWhatsappGroupLink(poll.whatsappGroupLink ?? "");
            setOrgCutFixed(poll.orgCutFixed != null ? String(poll.orgCutFixed) : "");
            setMatchSchedule((poll.matchSchedule as Record<string, string[]>) ?? {});
        } else {
            setQuestion("");
            setDays("Monday");
            setTeamType(GAME.features.hasTeamSizes ? "DYNAMIC" : "SOLO");
            setTournamentFormat(GAME.defaultTournamentType ?? "BRACKET_1V1");
            setTournamentId("");
            setIsActive(true);
            setAllowSquads(GAME.features.hasSquads);

            setScheduledDate("");
            setScheduledTime("20:00");
            setEnableFund(GAME.features.hasBR);
            setPrizePoolFee("");
            setExpectedPrizePool("");
            setArenaMode("none");
            setWhatsappGroupLink("");
            setOrgCutFixed("");
            setMatchSchedule({});
            // Pre-populate default options for create
            const defaultOpts: PollOptionDTO[] = GAME.features.hasTeamSizes
                ? [
                    { id: "new-in", name: "Nga Leh 😎", vote: "IN" },
                    { id: "new-out", name: "Leh rei", vote: "OUT" },
                    { id: "new-solo", name: "Nga Leh solo 🫩", vote: "SOLO" },
                ]
                : [
                    { id: "new-in", name: "Nga Leh 😎", vote: "IN" },
                    { id: "new-out", name: "Leh rei", vote: "OUT" },
                ];
            setOptions(defaultOpts);
        }
    }, [poll, isOpen]);

    // Auto-select latest tournament for new polls
    useEffect(() => {
        if (!isEdit && tournaments && tournaments.length > 0 && !tournamentId) {
            const latest = tournaments[0];
            setTournamentId(latest.id);
            setQuestion(latest.name);
        }
    }, [tournaments, isEdit, tournamentId]);

    // Derive fee from the selected tournament
    const selectedTournamentFee = isEdit
        ? (poll?.tournament?.fee ?? 0)
        : (tournaments?.find(t => t.id === tournamentId)?.fee ?? 0);

    const handleSave = useCallback(async () => {
        if (!question.trim()) {
            toast.error("Question is required");
            return;
        }
        if (days === "Custom" && !customDays.trim()) {
            toast.error("Enter a custom schedule");
            return;
        }
        if (!isEdit && !tournamentId) {
            toast.error("Select a tournament");
            return;
        }

        const actualDays = days === "Custom" ? customDays.trim() : days;

        setSaving(true);
        try {
            const body = isEdit
                ? {
                    id: poll!.id, question, days: actualDays, teamType, isActive, allowSquads, enableFund,
                    prizePoolFee: prizePoolFee ? Number(prizePoolFee) : null,
                    expectedPrizePool: expectedPrizePool ? Number(expectedPrizePool) : null,
                    scheduledDate: scheduledDate || null,
                    scheduledTime,
                    matchSchedule: Object.keys(matchSchedule).length > 0 ? matchSchedule : null,
                    options: options.map(o => ({ id: o.id, name: o.name })),
                    whatsappGroupLink: whatsappGroupLink.trim() || null,
                    orgCutFixed: orgCutFixed !== "" ? Number(orgCutFixed) : null,
                    // Send tournament format on edit too (PES)
                    ...(!GAME.features.hasTeamSizes && { tournamentType: tournamentFormat }),
                }
                : {
                    question, days: actualDays, teamType, tournamentId, allowSquads, enableFund,
                    prizePoolFee: prizePoolFee ? Number(prizePoolFee) : null,
                    scheduledDate: scheduledDate || null,
                    scheduledTime,
                    matchSchedule: Object.keys(matchSchedule).length > 0 ? matchSchedule : null,
                    // For PES or arena modes: send format so poll creation can update tournament type
                    ...((!GAME.features.hasTeamSizes || arenaMode !== "none") && { tournamentType: tournamentFormat }),
                    // TDM flag — API will set tournament.isTDM
                    ...(arenaMode === "tdm" && { isTDM: true }),
                    // WoW flag — API will set tournament.isWoW
                    ...(arenaMode === "wow" && { isWoW: true }),
                    // Send custom option names
                    options: options.map(o => ({ name: o.name, vote: o.vote })),
                    whatsappGroupLink: whatsappGroupLink.trim() || null,
                };

            const res = await fetch("/api/polls", {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed");

            toast.success(isEdit ? "Poll updated" : "Poll created");
            onSaved();
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    }, [isEdit, poll, question, days, teamType, tournamentId, tournamentFormat, isActive, allowSquads, enableFund, prizePoolFee, expectedPrizePool, scheduledDate, scheduledTime, matchSchedule, arenaMode, options, whatsappGroupLink, orgCutFixed, onSaved, onClose]);

    const handleOptionNameChange = useCallback((optionId: string, newName: string) => {
        setOptions(prev => prev.map(o => o.id === optionId ? { ...o, name: newName } : o));
    }, []);

    const VOTE_LABEL: Record<string, string> = { IN: "IN 😎", OUT: "OUT 🏳️", SOLO: "SOLO 🫩" };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" placement="center" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-base">
                    <Vote className="h-4 w-4" />
                    {isEdit ? "Edit Poll" : "New Poll"}
                </ModalHeader>

                <ModalBody className="space-y-4">
                    {/* Tournament select (only for create) */}
                    {!isEdit && (
                        <Select
                            label="Tournament"
                            placeholder="Select tournament"
                            selectedKeys={tournamentId ? [tournamentId] : []}
                            onSelectionChange={(keys) => {
                                const key = Array.from(keys)[0] as string;
                                if (key) {
                                    setTournamentId(key);
                                    const t = tournaments?.find((t) => t.id === key);
                                    if (t) setQuestion(t.name);
                                }
                            }}
                            size="sm"
                            isRequired
                            items={tournaments ?? []}
                        >
                            {(t) => (
                                <SelectItem key={t.id} textValue={`${t.name}${t.fee > 0 ? ` (${t.fee} ${GAME.currency})` : ""}`}>
                                    {t.name}{t.fee > 0 ? ` (${t.fee} ${GAME.currency})` : ""}
                                </SelectItem>
                            )}
                        </Select>
                    )}

                    {isEdit && poll?.tournament && (
                        <div className="space-y-2">
                            <div className="rounded-lg bg-default-100 px-3 py-2 text-sm">
                                <span className="text-foreground/50">Tournament: </span>
                                <span className="font-medium">{poll.tournament.name}</span>
                            </div>
                            {allowSquads && (
                                <Button
                                    variant="flat"
                                    size="sm"
                                    className="w-full"
                                    startContent={linkCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <LinkIcon className="h-3.5 w-3.5" />}
                                    color={linkCopied ? "success" : "default"}
                                    onPress={() => {
                                        const url = `${window.location.origin}/join/${poll.id}`;
                                        navigator.clipboard.writeText(url);
                                        setLinkCopied(true);
                                        toast.success("Registration link copied!");
                                        setTimeout(() => setLinkCopied(false), 2000);
                                    }}
                                >
                                    {linkCopied ? "Link Copied!" : "📋 Copy Registration Link"}
                                </Button>
                            )}
                        </div>
                    )}

                    <Input
                        label="Question"
                        value={question}
                        onValueChange={setQuestion}
                        size="sm"
                        isRequired
                    />

                    <div className="grid grid-cols-2 gap-3">
                        {GAME.features.hasTeamSizes ? (
                            <Select
                                label="Team Type"
                                selectedKeys={[teamType]}
                                onSelectionChange={(keys) => {
                                    const key = Array.from(keys)[0] as string;
                                    if (key) setTeamType(key);
                                }}
                                size="sm"
                            >
                                {TEAM_TYPES.map((t) => (
                                    <SelectItem key={t} textValue={t}>{t}</SelectItem>
                                ))}
                            </Select>
                        ) : (
                            <Select
                                label="Format"
                                selectedKeys={[tournamentFormat]}
                                onSelectionChange={(keys) => {
                                    const key = Array.from(keys)[0] as string;
                                    if (key) setTournamentFormat(key);
                                }}
                                size="sm"
                            >
                                {(GAME.tournamentTypes ?? ["BRACKET_1V1"]).map((t: string) => (
                                    <SelectItem key={t} textValue={TOURNAMENT_FORMAT_LABELS[t] ?? t}>
                                        {TOURNAMENT_FORMAT_LABELS[t] ?? t}
                                    </SelectItem>
                                ))}
                            </Select>
                        )}

                        <Select
                            label="Day"
                            selectedKeys={[DAYS.includes(days) ? days : "Custom"]}
                            onSelectionChange={(keys) => {
                                const key = Array.from(keys)[0] as string;
                                if (key === "Custom") {
                                    setDays("Custom");
                                } else if (key) {
                                    setDays(key);
                                    setCustomDays("");
                                }
                            }}
                            size="sm"
                        >
                            {DAYS.map((d) => (
                                <SelectItem key={d} textValue={d}>{d}</SelectItem>
                            ))}
                        </Select>
                        {(days === "Custom" || (!DAYS.includes(days) && days !== "Monday")) && (
                            <Input
                                label="Custom schedule"
                                placeholder="e.g. Fri - Sun"
                                value={days === "Custom" ? customDays : days}
                                onValueChange={(v) => {
                                    setCustomDays(v);
                                    if (v.trim()) setDays(v.trim());
                                }}
                                size="sm"
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Scheduled Date"
                            placeholder="Pick a date"
                            type="date"
                            value={scheduledDate}
                            onValueChange={setScheduledDate}
                            size="sm"
                        />
                        <Input
                            label="Start Time"
                            type="time"
                            value={scheduledTime}
                            onValueChange={setScheduledTime}
                            size="sm"
                        />
                    </div>

                    {/* Per-day match schedule editor */}
                    {(() => {
                        // Derive day names from the "days" field
                        const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                        const singleIdx = FULL_DAYS.findIndex(d => d.toLowerCase() === days?.toLowerCase());
                        const scheduleDays = singleIdx >= 0
                            ? [FULL_DAYS[singleIdx], FULL_DAYS[(singleIdx + 1) % 7]]
                            : (DAYS.includes(days) && days === "Mon - Sat")
                                ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
                                : days && !DAYS.includes(days)
                                    ? days.split(/[&,]+/).map((d: string) => d.trim()).filter(Boolean)
                                    : ["Day 1"];

                        return (
                            <div className="space-y-3">
                                <p className="text-xs font-medium text-foreground/50">Match Schedule (per day)</p>
                                {scheduleDays.map((dayName: string) => {
                                    const times = matchSchedule[dayName] ?? [];
                                    return (
                                        <div key={dayName} className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-foreground/70">{dayName}</span>
                                                <button
                                                    type="button"
                                                    className="flex items-center gap-0.5 text-[10px] text-primary font-medium cursor-pointer hover:opacity-80"
                                                    onClick={() => {
                                                        setMatchSchedule(prev => ({
                                                            ...prev,
                                                            [dayName]: [...(prev[dayName] ?? []), scheduledTime || "20:00"],
                                                        }));
                                                    }}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add
                                                </button>
                                            </div>
                                            {times.length === 0 ? (
                                                <p className="text-[10px] text-foreground/30 italic">No times set — schedule hidden for ranked</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {times.map((time: string, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-1 bg-default-100 rounded-lg px-1 border border-divider">
                                                            <input
                                                                type="time"
                                                                value={time}
                                                                onChange={(e) => {
                                                                    setMatchSchedule(prev => {
                                                                        const updated = [...(prev[dayName] ?? [])];
                                                                        updated[idx] = e.target.value;
                                                                        return { ...prev, [dayName]: updated };
                                                                    });
                                                                }}
                                                                className="text-xs bg-transparent border-none outline-none py-1 w-[80px]"
                                                            />
                                                            <button
                                                                type="button"
                                                                className="p-0.5 text-foreground/30 hover:text-danger transition-colors cursor-pointer"
                                                                onClick={() => {
                                                                    setMatchSchedule(prev => {
                                                                        const updated = [...(prev[dayName] ?? [])];
                                                                        updated.splice(idx, 1);
                                                                        const next = { ...prev };
                                                                        if (updated.length === 0) delete next[dayName];
                                                                        else next[dayName] = updated;
                                                                        return next;
                                                                    });
                                                                }}
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {isEdit && (
                        <div className="flex items-center justify-between rounded-lg bg-default-100 px-3 py-2">
                            <span className="text-sm">Active</span>
                            <Switch
                                size="sm"
                                color="primary"
                                isSelected={isActive}
                                onValueChange={setIsActive}
                                classNames={{ wrapper: isActive ? "" : "bg-default-300" }}
                            />
                        </div>
                    )}

                    {/* Allow Squads toggle — for BR games with squad support (MLBB always has squads on) */}
                    {GAME.features.hasSquads && GAME.features.hasTeamSizes && arenaMode === "none" && (
                        <div className="flex items-center justify-between rounded-lg bg-default-100 px-3 py-2">
                            <div>
                                <span className="text-sm">Allow Squads</span>
                                <p className="text-xs text-foreground/40">Players can form their own teams</p>
                            </div>
                            <Switch
                                size="sm"
                                color="primary"
                                isSelected={allowSquads}
                                onValueChange={(v) => {
                                    setAllowSquads(v);
                                    if (v) {
                                        setEnableFund(false);
                                        if (GAME.features.hasTeamSizes) setTeamType("SQUAD");
                                    } else {
                                        if (GAME.features.hasTeamSizes) setTeamType("DYNAMIC");
                                    }
                                }}
                                classNames={{ wrapper: allowSquads ? "" : "bg-default-300" }}
                            />
                        </div>
                    )}



                    {/* Arena Mode selector — TDM / WoW (for games that support them) */}
                    {(GAME.features.hasTDM || GAME.features.hasWoW) && !isEdit && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-foreground/50">Arena Mode</p>
                            <div className="flex gap-2">
                                {([
                                    { key: "none" as const, label: "None", icon: "❌" },
                                    ...(GAME.features.hasTDM ? [{ key: "tdm" as const, label: "TDM", icon: "⚔️" }] : []),
                                    ...(GAME.features.hasWoW ? [{ key: "wow" as const, label: "WoW", icon: "🌟" }] : []),
                                ]).map(({ key, label, icon }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            setArenaMode(key);
                                            if (key !== "none") {
                                                setAllowSquads(true);
                                                setEnableFund(false);
                                                if (GAME.features.hasTeamSizes) setTeamType("SQUAD");
                                                setTournamentFormat("BRACKET_1V1");
                                            } else {
                                                if (GAME.features.hasTeamSizes) setTeamType("DYNAMIC");
                                            }
                                        }}
                                        className={`
                                            flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium
                                            transition-all duration-200 cursor-pointer border
                                            ${arenaMode === key
                                                ? key === "none"
                                                    ? "bg-default-100 border-default-300 text-foreground"
                                                    : key === "tdm"
                                                        ? "bg-danger/10 border-danger/30 text-danger"
                                                        : "bg-warning/10 border-warning/30 text-warning"
                                                : "bg-default-50 border-transparent text-foreground/40 hover:text-foreground/60"
                                            }
                                        `}
                                    >
                                        <span>{icon}</span>
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Arena Bracket Format selector */}
                    {arenaMode !== "none" && (
                        <Select
                            label={`${arenaMode === "tdm" ? "TDM" : "WoW"} Bracket Format`}
                            selectedKeys={[tournamentFormat]}
                            onSelectionChange={(keys) => {
                                const key = Array.from(keys)[0] as string;
                                if (key) setTournamentFormat(key);
                            }}
                            size="sm"
                        >
                            {["BRACKET_1V1", "LEAGUE", "GROUP_KNOCKOUT"].map((t) => (
                                <SelectItem key={t} textValue={TOURNAMENT_FORMAT_LABELS[t] ?? t}>
                                    {TOURNAMENT_FORMAT_LABELS[t] ?? t}
                                </SelectItem>
                            ))}
                        </Select>
                    )}

                    {/* Fund toggle — shown for BR games when allowSquads is on (default OFF for squads) */}
                    {GAME.features.hasTeamSizes && GAME.features.hasSquads && allowSquads && (
                        <div className="flex items-center justify-between rounded-lg bg-warning/5 border border-warning/10 px-3 py-2">
                            <div>
                                <span className="text-sm">Enable Fund</span>
                                <p className="text-xs text-foreground/40">Apply repeat winner tax & solo tax</p>
                            </div>
                            <Switch
                                size="sm"
                                color="warning"
                                isSelected={enableFund}
                                onValueChange={setEnableFund}
                                classNames={{ wrapper: enableFund ? "" : "bg-default-300" }}
                            />
                        </div>
                    )}

                    {/* Prize Pool Per Entry — org cut per entry */}
                    {selectedTournamentFee > 0 && (
                        <Input
                            label={`Prize Pool Per Entry (${GAME.currency})`}
                            placeholder={`e.g. ${selectedTournamentFee}`}
                            description={prizePoolFee ? `Org cut: ${selectedTournamentFee - Number(prizePoolFee)} ${GAME.currency} per entry` : `Defaults to full entry fee (${selectedTournamentFee} ${GAME.currency})`}
                            value={prizePoolFee}
                            onValueChange={(v) => setPrizePoolFee(v.replace(/\D/g, ""))}
                            size="sm"
                            type="number"
                            inputMode="numeric"
                        />
                    )}

                    {/* Expected Prize Pool — shown on share/registration links */}
                    {allowSquads && (
                        <Input
                            label={`Expected Prize Pool (${GAME.currency})`}
                            placeholder="e.g. 500"
                            description="Shown on the team registration share link"
                            value={expectedPrizePool}
                            onValueChange={(v) => setExpectedPrizePool(v.replace(/\D/g, ""))}
                            size="sm"
                            type="number"
                            inputMode="numeric"
                        />
                    )}

                    {/* WhatsApp Group Link — for squad captains */}
                    {allowSquads && (
                        <Input
                            label="WhatsApp Group Link"
                            placeholder="https://chat.whatsapp.com/..."
                            description="Squad captains will see this link to join the tournament group"
                            value={whatsappGroupLink}
                            onValueChange={setWhatsappGroupLink}
                            size="sm"
                            startContent={<span className="text-sm">💬</span>}
                        />
                    )}



                    {/* Per-tournament Org Cut Fixed — only for squad + championship polls on edit */}
                    {isEdit && allowSquads && poll?.isChampionship && (
                        <Input
                            label={`Org Cut Fixed (${GAME.currency})`}
                            placeholder="Use global setting"
                            description={orgCutFixed ? `₹${orgCutFixed} org cut for this tournament` : "Leave empty to use global setting"}
                            value={orgCutFixed}
                            onValueChange={(v) => setOrgCutFixed(v.replace(/\D/g, ""))}
                            size="sm"
                            type="number"
                            inputMode="numeric"
                        />
                    )}

                    {/* Editable poll options */}
                    {options.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-foreground/50">Answer Options</p>
                            {options.map((opt) => (
                                <Input
                                    key={opt.id}
                                    label={VOTE_LABEL[opt.vote] ?? opt.vote}
                                    value={opt.name}
                                    onValueChange={(v) => handleOptionNameChange(opt.id, v)}
                                    size="sm"
                                />
                            ))}
                        </div>
                    )}
                </ModalBody>

                <ModalFooter>
                    <Button variant="flat" onPress={onClose} isDisabled={saving} size="sm">
                        Cancel
                    </Button>
                    <Button
                        color="primary"
                        onPress={handleSave}
                        isDisabled={saving}
                        size="sm"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Saving...
                            </>
                        ) : isEdit ? (
                            "Update"
                        ) : (
                            "Create"
                        )}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
