"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
} from "@heroui/react";
import { Ghost, Plus, X, Phone, Crown, Users } from "lucide-react";
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
 * Modal for creating a ghost team directly on the Teams page.
 * Provides captain name + phone, member names, and team tag.
 */
export function CreateGhostTeamModal({ isOpen, onClose, tournamentId, matchId }: Props) {
    const [teamName, setTeamName] = useState("");
    const [captainName, setCaptainName] = useState("");
    const [captainPhone, setCaptainPhone] = useState("");
    const [members, setMembers] = useState<string[]>(
        Array(GAME.squadSize - 1).fill("")
    );
    const queryClient = useQueryClient();

    function updateMember(index: number, value: string) {
        setMembers(prev => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    }

    function addMemberSlot() {
        if (members.length < GAME.maxSquadSize - 1) {
            setMembers(prev => [...prev, ""]);
        }
    }

    function removeMemberSlot(index: number) {
        if (members.length > 1) {
            setMembers(prev => prev.filter((_, i) => i !== index));
        }
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
                    captainPhone: captainPhone.trim(),
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
        onClose();
    }

    const canSubmit = teamName.trim() && captainName.trim() && captainPhone.trim().replace(/\D/g, "").length >= 10;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="lg" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-2">
                    <Ghost className="h-5 w-5" />
                    Add Ghost Team
                </ModalHeader>
                <ModalBody className="space-y-3">
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
                                placeholder="Phone (10 digits)"
                                value={captainPhone}
                                onValueChange={v => setCaptainPhone(v.replace(/\D/g, "").slice(0, 10))}
                                size="sm"
                                isRequired
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
                        {members.length < GAME.maxSquadSize - 1 && (
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
                </ModalBody>
                <ModalFooter>
                    <Button variant="flat" onPress={handleClose} size="sm">
                        Cancel
                    </Button>
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
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
