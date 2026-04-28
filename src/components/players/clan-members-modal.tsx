"use client";

import { useState } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    Avatar,
    Chip,
    Spinner,
} from "@heroui/react";
import { X, Shield, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { GAME } from "@/lib/game-config";
import { CategoryBadge } from "@/components/ui/category-badge";

interface ClanMember {
    id: string;
    displayName: string;
    username: string;
    imageUrl: string | null;
    category: string;
    role: "LEADER" | "MEMBER";
    joinedAt: string;
}

interface ClanDetail {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    logoUrl: string | null;
    leaderId: string;
    members: ClanMember[];
    memberCount: number;
    createdAt: string;
}

interface ClanMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    clanId: string;
    clanName: string;
    clanTag: string;
    /** Callback when a member row is clicked — opens their stats modal */
    onMemberClick?: (playerId: string) => void;
}

export function ClanMembersModal({
    isOpen,
    onClose,
    clanId,
    clanName,
    clanTag,
    onMemberClick,
}: ClanMembersModalProps) {
    const { data, isLoading } = useQuery<ClanDetail>({
        queryKey: ["clan-detail", clanId],
        queryFn: async () => {
            const res = await fetch(`/api/clans/${clanId}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data;
        },
        enabled: isOpen && !!clanId,
        staleTime: 60_000,
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            placement="center"
            scrollBehavior="inside"
            hideCloseButton
            classNames={{
                base: "bg-background border border-divider",
                backdrop: "bg-black/60 backdrop-blur-sm",
            }}
        >
            <ModalContent>
                {/* Header */}
                <ModalHeader className="flex items-center justify-between pb-2 pr-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                            src={data?.logoUrl || undefined}
                            name={clanTag}
                            className="h-8 w-8 shrink-0"
                            showFallback
                            fallback={<Shield className="h-4 w-4 text-primary" />}
                            classNames={{
                                base: data?.logoUrl ? "" : "bg-primary/10",
                            }}
                        />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <Chip size="sm" variant="flat" color="primary" className="text-[10px] h-4 px-1.5">
                                    {clanTag}
                                </Chip>
                                <span className="text-sm font-bold truncate">{clanName}</span>
                            </div>
                            {data && (
                                <p className="text-[11px] text-foreground/40 mt-0.5">
                                    {data.memberCount} {data.memberCount === 1 ? "member" : "members"}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-default-100 hover:bg-default-200 transition-colors shrink-0"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </ModalHeader>

                <ModalBody className="px-4 pb-4 pt-0">
                    {/* Description */}
                    {data?.description && (
                        <p className="text-xs text-foreground/50 mb-3 italic">
                            &ldquo;{data.description}&rdquo;
                        </p>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Spinner size="sm" />
                        </div>
                    ) : data?.members ? (
                        <div className="space-y-1">
                            {data.members.map((member) => (
                                <button
                                    key={member.id}
                                    onClick={() => onMemberClick?.(member.id)}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-default-100 transition-colors cursor-pointer text-left"
                                >
                                    <Avatar
                                        src={member.imageUrl || undefined}
                                        name={member.displayName}
                                        className="h-9 w-9 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium truncate">
                                                {member.displayName}
                                            </span>
                                            {member.role === "LEADER" && (
                                                <Crown className="h-3 w-3 text-yellow-500 shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] text-foreground/40">@{member.username}</span>
                                            <CategoryBadge category={member.category} size="sm" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-sm text-foreground/40 py-4">
                            No members found
                        </p>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
