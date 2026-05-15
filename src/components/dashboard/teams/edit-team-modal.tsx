"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Avatar,
    Chip,
    Checkbox,
    Spinner,
    Switch,
} from "@heroui/react";
import { Search, Plus, X, Pencil, Trash2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

interface Player {
    id: string;
    displayName: string | null;
    username: string;
    imageUrl: string | null;
    category: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    teamId: string;
    teamName: string;
    teamNumber: number;
    initialPlayers: Player[];
}

export function EditTeamModal({
    isOpen,
    onClose,
    teamId,
    teamName,
    teamNumber,
    initialPlayers,
}: Props) {
    const [search, setSearch] = useState("");
    const [currentPlayers, setCurrentPlayers] = useState<Player[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [refundOnDelete, setRefundOnDelete] = useState(false);
    const [deductUC, setDeductUC] = useState(false);
    const [refundRemoved, setRefundRemoved] = useState(false);
    const queryClient = useQueryClient();

    // Initialize on open
    useEffect(() => {
        if (isOpen) {
            setCurrentPlayers([...initialPlayers]);
        }
    }, [isOpen, initialPlayers]);

    // Track changes
    const addedIds = useMemo(
        () => currentPlayers.filter(p => !initialPlayers.some(ip => ip.id === p.id)).map(p => p.id),
        [currentPlayers, initialPlayers]
    );
    const removedIds = useMemo(
        () => initialPlayers.filter(ip => !currentPlayers.some(p => p.id === ip.id)).map(p => p.id),
        [currentPlayers, initialPlayers]
    );
    const hasChanges = addedIds.length > 0 || removedIds.length > 0;

    // Search players
    const { data: searchResults = [], isFetching } = useQuery<Player[]>({
        queryKey: ["player-search-edit", search],
        queryFn: async () => {
            if (!search || search.length < 2) return [];
            const res = await fetch(`/api/players?search=${encodeURIComponent(search)}&limit=10`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data ?? []).map((p: Record<string, unknown>) => ({
                id: p.id,
                displayName: p.displayName,
                username: p.username,
                imageUrl: p.imageUrl,
                category: p.category,
            }));
        },
        enabled: search.length >= 2,
        staleTime: 10_000,
    });

    const currentIds = useMemo(() => new Set(currentPlayers.map(p => p.id)), [currentPlayers]);

    const availablePlayers = useMemo(
        () => searchResults.filter(p => !currentIds.has(p.id)),
        [searchResults, currentIds]
    );

    function addPlayer(player: Player) {
        setCurrentPlayers(prev => [...prev, player]);
    }

    function removePlayer(id: string) {
        setCurrentPlayers(prev => prev.filter(p => p.id !== id));
    }

    // Save mutation
    const { mutate: saveChanges, isPending } = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/teams/${teamId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    addPlayerIds: addedIds,
                    removePlayerIds: removedIds,
                    deductUC: addedIds.length > 0 ? deductUC : undefined,
                    refund: removedIds.length > 0 ? refundRemoved : undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to update team");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Team updated");
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            handleClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Delete team mutation
    const { mutate: deleteTeam, isPending: isDeletePending } = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/teams/${teamId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refund: refundOnDelete }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to delete team");
            return json;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Team deleted");
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            handleClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    function handleClose() {
        setSearch("");
        setCurrentPlayers([]);
        setShowDeleteConfirm(false);
        setRefundOnDelete(false);
        setDeductUC(false);
        setRefundRemoved(false);
        onClose();
    }

    return (
        <>
            <Modal isOpen={isOpen} onClose={handleClose} size="lg" scrollBehavior="inside" hideCloseButton>
                <ModalContent>
                    <ModalHeader className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Pencil className="h-5 w-5" />
                            Edit Team {teamNumber}
                        </div>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => setShowDeleteConfirm(true)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </ModalHeader>
                    <ModalBody>
                        {/* Current players */}
                        <div className="space-y-2">
                            <p className="text-xs text-foreground/50">
                                Current Players ({currentPlayers.length})
                            </p>
                            {currentPlayers.length === 0 ? (
                                <p className="py-2 text-sm text-foreground/30">No players in this team</p>
                            ) : (
                                <div className="space-y-1">
                                    {currentPlayers.map(p => {
                                        const isNew = addedIds.includes(p.id);
                                        return (
                                            <div
                                                key={p.id}
                                                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${isNew ? "bg-success/10 border border-success/20" : "bg-default-50"
                                                    }`}
                                            >
                                                <Avatar
                                                    src={p.imageUrl || undefined}
                                                    name={p.displayName || p.username}
                                                    size="sm"
                                                    className="h-7 w-7"
                                                />
                                                <span className="flex-1 truncate text-sm">
                                                    {p.displayName || p.username}
                                                </span>
                                                {isNew && (
                                                    <Chip size="sm" color="success" variant="flat" className="text-[10px]">
                                                        NEW
                                                    </Chip>
                                                )}
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="danger"
                                                    onPress={() => removePlayer(p.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {removedIds.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-danger/70">
                                        Removing ({removedIds.length})
                                    </p>
                                    {initialPlayers.filter(p => removedIds.includes(p.id)).map(p => (
                                        <div
                                            key={p.id}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 bg-danger/5 border border-danger/10 opacity-50 line-through"
                                        >
                                            <Avatar
                                                src={p.imageUrl || undefined}
                                                name={p.displayName || p.username}
                                                size="sm"
                                                className="h-7 w-7"
                                            />
                                            <span className="flex-1 truncate text-sm">
                                                {p.displayName || p.username}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                color="default"
                                                onPress={() => addPlayer(p)}
                                            >
                                                Undo
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add player search */}
                        <div className="pt-2">
                            <p className="text-xs text-foreground/50 mb-2">Add Player</p>
                            <Input
                                placeholder="Search players by name..."
                                value={search}
                                onValueChange={setSearch}
                                startContent={<Search className="h-4 w-4 text-default-400" />}
                                size="sm"
                                isClearable
                                onClear={() => setSearch("")}
                            />
                        </div>

                        {isFetching && (
                            <div className="flex justify-center py-4">
                                <Spinner size="sm" />
                            </div>
                        )}

                        {!isFetching && availablePlayers.length > 0 && (
                            <div className="max-h-40 space-y-1 overflow-y-auto">
                                {availablePlayers.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addPlayer(p)}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-default-100"
                                    >
                                        <Avatar
                                            src={p.imageUrl || undefined}
                                            name={p.displayName || p.username}
                                            size="sm"
                                            className="h-8 w-8"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {p.displayName || p.username}
                                            </p>
                                            <p className="text-xs text-foreground/40">@{p.username}</p>
                                        </div>
                                        <Plus className="h-4 w-4 text-foreground/30" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {search.length >= 2 && !isFetching && availablePlayers.length === 0 && (
                            <p className="py-2 text-center text-sm text-foreground/40">
                                No available players found
                            </p>
                        )}

                        {/* UC toggles for add/remove */}
                        {(addedIds.length > 0 || removedIds.length > 0) && (
                            <div className="space-y-2 pt-2">
                                {addedIds.length > 0 && (
                                    <Checkbox
                                        isSelected={deductUC}
                                        onValueChange={setDeductUC}
                                        size="sm"
                                    >
                                        <span className="text-sm">Deduct {GAME.currency} entry fee from added players</span>
                                    </Checkbox>
                                )}
                                {removedIds.length > 0 && (
                                    <Checkbox
                                        isSelected={refundRemoved}
                                        onValueChange={setRefundRemoved}
                                        size="sm"
                                    >
                                        <span className="text-sm">Refund {GAME.currency} entry fee to removed players</span>
                                    </Checkbox>
                                )}
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={handleClose} size="sm">
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            onPress={() => saveChanges()}
                            isLoading={isPending}
                            isDisabled={!hasChanges}
                            size="sm"
                        >
                            Save Changes
                            {hasChanges && ` (+${addedIds.length} -${removedIds.length})`}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Team Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => { setShowDeleteConfirm(false); setRefundOnDelete(false); }}
                size="sm"
            >
                <ModalContent>
                    <ModalHeader>Delete Team #{teamNumber}?</ModalHeader>
                    <ModalBody className="space-y-3">
                        <p className="text-sm text-foreground/60">
                            This will permanently delete the team and all associated stats, records, and winner data. This cannot be undone.
                        </p>
                        <div className="flex items-center justify-between rounded-lg bg-default-100 p-3">
                            <div>
                                <p className="text-sm font-medium">Refund {GAME.currency}</p>
                                <p className="text-xs text-foreground/50">
                                    Credit entry fee back to each player
                                </p>
                            </div>
                            <Switch
                                size="sm"
                                isSelected={refundOnDelete}
                                onValueChange={setRefundOnDelete}
                                color="success"
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            size="sm"
                            onPress={() => { setShowDeleteConfirm(false); setRefundOnDelete(false); }}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            size="sm"
                            onPress={() => deleteTeam()}
                            isLoading={isDeletePending}
                        >
                            {refundOnDelete ? "Delete & Refund" : "Delete"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
