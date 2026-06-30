"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Textarea,
} from "@heroui/react";
import { Ghost, Plus, X, Phone, Crown, Users, ClipboardPaste } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    matchId: string;
}

/**
 * Parse pasted text into team name + player names.
 * Supports:
 *   Format 1: "Team Name - XXX\nPlayer Name - A\n- B\n- C"
 *   Format 2: "A\nB\nC\nD" (plain player names, one per line)
 */
function parsePastedTeam(text: string): { teamName: string; players: string[] } {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    let teamName = "";
    const players: string[] = [];

    for (const line of lines) {
        const teamMatch = line.match(/^team\s*name\s*[-:–—]\s*(.+)/i);
        if (teamMatch) {
            teamName = teamMatch[1].trim();
            continue;
        }
        const playerMatch = line.match(/^(?:player\s*name\s*)?[-:–—]\s*(.+)/i);
        if (playerMatch) {
            players.push(playerMatch[1].trim());
        } else {
            players.push(line);
        }
    }

    return { teamName, players };
}

/**
 * Modal for creating a ghost team directly on the Teams page.
 * Supports paste mode for quick creation from text.
 */
export function CreateGhostTeamModal({ isOpen, onClose, tournamentId, matchId }: Props) {
    const [teamName, setTeamName] = useState("");
    const [captainName, setCaptainName] = useState("");
    const [captainPhone, setCaptainPhone] = useState("");
    const [members, setMembers] = useState<string[]>(
        Array(GAME.squadSize - 1).fill("")
    );
    const [pasteText, setPasteText] = useState("");
    const [mode, setMode] = useState<"manual" | "paste">("paste");
    const queryClient = useQueryClient();

    function updateMember(index: number, value: string) {
        setMembers(prev => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    }

    function addMemberSlot() {
        if (members.length < 10) {
            setMembers(prev => [...prev, ""]);
        }
    }

    function removeMemberSlot(index: number) {
        if (members.length > 1) {
            setMembers(prev => prev.filter((_, i) => i !== index));
        }
    }

    /** Apply pasted text → fill captain + members + team name */
    function applyPaste() {
        const { teamName: parsed, players } = parsePastedTeam(pasteText);
        if (players.length === 0) {
            toast.error("No player names found in pasted text");
            return;
        }

        setCaptainName(players[0]);
        setMembers(players.slice(1).length > 0 ? players.slice(1) : [""]);

        if (parsed) {
            setTeamName(parsed.slice(0, 7));
        } else {
            const tag = players[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase();
            setTeamName(tag || "GHOST");
        }

        toast.success(`Parsed ${players.length} player(s)${parsed ? ` — team: ${parsed}` : ""}`);
        setMode("manual");
    }

    const { mutate: createGhostTeam, isPending } = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/teams/create-ghost", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tournamentId,
                    matchId,
                    name: teamName.trim(),
                    captainName: captainName.trim(),
                    captainPhone: captainPhone.trim() || undefined,
                    members: members.filter(m => m.trim()),
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Ghost team created");
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            handleClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    function handleClose() {
        setTeamName("");
        setCaptainName("");
        setCaptainPhone("");
        setMembers(Array(GAME.squadSize - 1).fill(""));
        setPasteText("");
        setMode("paste");
        onClose();
    }

    const canSubmit = teamName.trim() && captainName.trim();

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="lg" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2">
                    <Ghost className="h-5 w-5" />
                    Add Ghost Team
                </ModalHeader>
                <ModalBody className="space-y-3">
                    {/* Mode toggle */}
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={mode === "paste" ? "solid" : "flat"}
                            color={mode === "paste" ? "primary" : "default"}
                            onPress={() => setMode("paste")}
                            startContent={<ClipboardPaste className="h-3.5 w-3.5" />}
                            className="flex-1"
                        >
                            Paste
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === "manual" ? "solid" : "flat"}
                            color={mode === "manual" ? "primary" : "default"}
                            onPress={() => setMode("manual")}
                            startContent={<Users className="h-3.5 w-3.5" />}
                            className="flex-1"
                        >
                            Manual
                        </Button>
                    </div>

                    {mode === "paste" ? (
                        /* ─── Paste Mode ─── */
                        <div className="space-y-2">
                            <Textarea
                                label="Paste player list"
                                placeholder={`Paste any format:\n\nTeam Name - KOLIS Esport\nPlayer Name - No1xAhhhhhh\n- TKLxChilly B\n- RRxVenom\n\nOr just names:\nKolisTheOGzV\nRR•Venom\nTKLxChilly b`}
                                value={pasteText}
                                onValueChange={setPasteText}
                                minRows={5}
                                maxRows={10}
                                size="sm"
                            />
                            <Button
                                color="primary"
                                size="sm"
                                onPress={applyPaste}
                                isDisabled={!pasteText.trim()}
                                className="w-full"
                                startContent={<ClipboardPaste className="h-3.5 w-3.5" />}
                            >
                                Parse & Fill
                            </Button>
                        </div>
                    ) : (
                        /* ─── Manual Mode ─── */
                        <>
                            {/* Team tag */}
                            <Input
                                label="Team Tag"
                                placeholder="e.g. ALPHA"
                                value={teamName}
                                onValueChange={v => setTeamName(v.slice(0, 7))}
                                maxLength={7}
                                size="sm"
                                isRequired
                                description={`${teamName.length}/7`}
                                startContent={<Users className="h-3.5 w-3.5 text-foreground/40" />}
                            />

                            {/* Captain */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-foreground/50 flex items-center gap-1">
                                    <Crown className="h-3 w-3" /> Captain
                                </p>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Captain name"
                                        value={captainName}
                                        onValueChange={v => setCaptainName(v.slice(0, 20))}
                                        size="sm"
                                        isRequired
                                        className="flex-1"
                                    />
                                    <Input
                                        placeholder="Phone (optional)"
                                        value={captainPhone}
                                        onValueChange={v => setCaptainPhone(v.replace(/\D/g, "").slice(0, 10))}
                                        size="sm"
                                        className="w-[140px]"
                                        startContent={<Phone className="h-3 w-3 text-foreground/40" />}
                                    />
                                </div>
                            </div>

                            {/* Members */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-foreground/50">
                                    Members ({members.filter(m => m.trim()).length})
                                </p>
                                {members.map((name, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input
                                            placeholder={`Member ${i + 1} name`}
                                            value={name}
                                            onValueChange={v => updateMember(i, v.slice(0, 20))}
                                            size="sm"
                                            className="flex-1"
                                        />
                                        {members.length > 1 && (
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                color="danger"
                                                onPress={() => removeMemberSlot(i)}
                                                className="shrink-0"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                {members.length < 10 && (
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        startContent={<Plus className="h-3.5 w-3.5" />}
                                        onPress={addMemberSlot}
                                        className="w-full"
                                    >
                                        Add Member Slot
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="flat" onPress={handleClose} size="sm">
                        Cancel
                    </Button>
                    {mode === "manual" && (
                        <Button
                            color="primary"
                            onPress={() => createGhostTeam()}
                            isLoading={isPending}
                            isDisabled={!canSubmit}
                            size="sm"
                            startContent={!isPending && <Ghost className="h-3.5 w-3.5" />}
                        >
                            Create Ghost Team
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
