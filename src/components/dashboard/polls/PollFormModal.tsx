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
import { Vote, Loader2 } from "lucide-react";
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
    enableFund?: boolean;
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
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    const [teamType, setTeamType] = useState(GAME.features.hasTeamSizes ? "DYNAMIC" : "SOLO");
    const [tournamentFormat, setTournamentFormat] = useState(GAME.defaultTournamentType ?? "BRACKET_1V1");
    const [tournamentId, setTournamentId] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [allowSquads, setAllowSquads] = useState(false);
    const [enableFund, setEnableFund] = useState(true);
    const [options, setOptions] = useState<PollOptionDTO[]>([]);
    const [saving, setSaving] = useState(false);

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
            setEnableFund(poll.enableFund ?? true);
            setOptions(poll.options?.map(o => ({ ...o })) ?? []);
        } else {
            setQuestion("");
            setDays("Monday");
            setTeamType(GAME.features.hasTeamSizes ? "DYNAMIC" : "SOLO");
            setTournamentFormat(GAME.defaultTournamentType ?? "BRACKET_1V1");
            setTournamentId("");
            setIsActive(true);
            setAllowSquads(GAME.features.hasSquads);
            setEnableFund(true);
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

    const handleSave = useCallback(async () => {
        if (!question.trim()) {
            toast.error("Question is required");
            return;
        }
        if (!isEdit && !tournamentId) {
            toast.error("Select a tournament");
            return;
        }

        setSaving(true);
        try {
            const body = isEdit
                ? {
                    id: poll!.id, question, days, teamType, isActive, allowSquads, enableFund,
                    options: options.map(o => ({ id: o.id, name: o.name })),
                    // Send tournament format on edit too (PES)
                    ...(!GAME.features.hasTeamSizes && { tournamentType: tournamentFormat }),
                }
                : {
                    question, days, teamType, tournamentId, allowSquads, enableFund,
                    // For PES: send format so poll creation can update tournament type
                    ...(!GAME.features.hasTeamSizes && { tournamentType: tournamentFormat }),
                    // Send custom option names
                    options: options.map(o => ({ name: o.name, vote: o.vote })),
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
    }, [isEdit, poll, question, days, teamType, tournamentId, tournamentFormat, isActive, allowSquads, enableFund, options, onSaved, onClose]);

    const handleOptionNameChange = useCallback((optionId: string, newName: string) => {
        setOptions(prev => prev.map(o => o.id === optionId ? { ...o, name: newName } : o));
    }, []);

    const VOTE_LABEL: Record<string, string> = { IN: "IN 😎", OUT: "OUT 🏳️", SOLO: "SOLO 🫩" };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" placement="center">
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
                        <div className="rounded-lg bg-default-100 px-3 py-2 text-sm">
                            <span className="text-foreground/50">Tournament: </span>
                            <span className="font-medium">{poll.tournament.name}</span>
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
                            selectedKeys={[days]}
                            onSelectionChange={(keys) => {
                                const key = Array.from(keys)[0] as string;
                                if (key) setDays(key);
                            }}
                            size="sm"
                        >
                            {DAYS.map((d) => (
                                <SelectItem key={d} textValue={d}>{d}</SelectItem>
                            ))}
                        </Select>
                    </div>

                    {isEdit && (
                        <div className="flex items-center justify-between rounded-lg bg-default-100 px-3 py-2">
                            <span className="text-sm">Active</span>
                            <Switch
                                size="sm"
                                isSelected={isActive}
                                onValueChange={setIsActive}
                            />
                        </div>
                    )}

                    {/* Allow Squads toggle — for games that support squads */}
                    {GAME.features.hasSquads && (
                        <div className="flex items-center justify-between rounded-lg bg-default-100 px-3 py-2">
                            <div>
                                <span className="text-sm">Allow Squads</span>
                                <p className="text-xs text-foreground/40">Players can form their own teams</p>
                            </div>
                            <Switch
                                size="sm"
                                isSelected={allowSquads}
                                onValueChange={(v) => {
                                    setAllowSquads(v);
                                    if (v) {
                                        setEnableFund(false); // Auto-disable fund for squad polls
                                        if (GAME.features.hasTeamSizes) setTeamType("SQUAD");
                                    } else {
                                        if (GAME.features.hasTeamSizes) setTeamType("DYNAMIC");
                                    }
                                }}
                            />
                        </div>
                    )}

                    {/* Fund toggle — shown when allowSquads is on (default OFF for squads) */}
                    {GAME.features.hasSquads && allowSquads && (
                        <div className="flex items-center justify-between rounded-lg bg-warning/5 border border-warning/10 px-3 py-2">
                            <div>
                                <span className="text-sm">Enable Fund</span>
                                <p className="text-xs text-foreground/40">Apply repeat winner tax & solo tax</p>
                            </div>
                            <Switch
                                size="sm"
                                isSelected={enableFund}
                                onValueChange={setEnableFund}
                            />
                        </div>
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
