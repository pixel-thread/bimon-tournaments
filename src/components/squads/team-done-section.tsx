"use client";

import { useState } from "react";
import { Input, Button, Spinner, Avatar } from "@heroui/react";
import { Search, X, Share2 } from "lucide-react";
import { motion } from "motion/react";
import { useSearchPlayers, useInvitePlayer } from "@/hooks/use-squads";

/* ─── WhatsApp Icon ─────────────────────────────────────────── */

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
    );
}

/* ─── Types ─────────────────────────────────────────────────── */

interface TeamDoneSectionProps {
    whatsappGroupLink?: string | null;
    whatsappJoined: boolean;
    onWhatsappJoin: () => void;
    createdSquadId: string | null;
    pollId: string;
}

/* ─── Component ─────────────────────────────────────────────── */

export function TeamDoneSection({
    whatsappGroupLink,
    whatsappJoined,
    onWhatsappJoin,
    createdSquadId,
    pollId,
}: TeamDoneSectionProps) {
    const [inviteSearch, setInviteSearch] = useState("");
    const [invitingPlayerId, setInvitingPlayerId] = useState<string | null>(null);
    const inviteMutation = useInvitePlayer();
    const { data: searchResults, isLoading: isSearching } = useSearchPlayers(
        inviteSearch,
        pollId
    );

    const mustJoinWhatsapp = !!whatsappGroupLink && !whatsappJoined;

    return (
        <div className="space-y-4">
            {/* WhatsApp join — prominent unskippable button */}
            {whatsappGroupLink && (
                <div className="space-y-2">
                    {!whatsappJoined && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">
                                Required
                            </span>
                            <span className="text-xs text-foreground/50">
                                Join the group for match details
                            </span>
                        </div>
                    )}
                    <a
                        href={whatsappGroupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onWhatsappJoin}
                        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${
                            whatsappJoined
                                ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/40 animate-pulse"
                        }`}
                    >
                        <WhatsAppIcon className="w-5 h-5" />
                        {whatsappJoined ? "Joined WhatsApp Group ✅" : "Join WhatsApp Group"}
                    </a>
                </div>
            )}

            {/* Gate: show invite tools only after WhatsApp joined (or if no link) */}
            {!mustJoinWhatsapp ? (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-4"
                >
                    {/* Share invite on WhatsApp */}
                    {createdSquadId && (
                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(`Join my team for the tournament! 🎮🔥\n${typeof window !== "undefined" ? window.location.origin : ""}/invite/${createdSquadId}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                        >
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <WhatsAppIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                    Share Invite on WhatsApp
                                </p>
                                <p className="text-[11px] text-emerald-600/60 dark:text-emerald-400/60">
                                    Send invite link to your teammates
                                </p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </a>
                    )}

                    {/* Search & Invite players */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                            Or invite existing players
                        </p>
                        <Input
                            placeholder="Search player..."
                            value={inviteSearch}
                            onValueChange={setInviteSearch}
                            size="sm"
                            startContent={<Search className="w-3.5 h-3.5 text-default-400" />}
                            endContent={inviteSearch ? (
                                <button type="button" onClick={() => setInviteSearch("")} className="p-0.5">
                                    <X className="w-3 h-3 text-default-400" />
                                </button>
                            ) : undefined}
                        />
                        {isSearching && (
                            <div className="flex justify-center py-2">
                                <Spinner size="sm" />
                            </div>
                        )}
                        {searchResults && searchResults.length > 0 && (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {searchResults.map((player) => (
                                    <div key={player.id} className="flex items-center gap-2 py-1.5">
                                        <Avatar
                                            src={player.imageUrl}
                                            name={player.displayName}
                                            size="sm"
                                            className="w-7 h-7 shrink-0"
                                        />
                                        <span className="text-sm font-medium truncate flex-1">
                                            {player.displayName}
                                        </span>
                                        <Button
                                            size="sm"
                                            color="primary"
                                            variant="flat"
                                            className="min-w-0 px-3 h-7"
                                            isLoading={inviteMutation.isPending && invitingPlayerId === player.id}
                                            isDisabled={inviteMutation.isPending && invitingPlayerId !== player.id}
                                            onPress={() => {
                                                if (!createdSquadId) return;
                                                setInvitingPlayerId(player.id);
                                                inviteMutation.mutate({ squadId: createdSquadId, playerId: player.id });
                                            }}
                                        >
                                            Invite
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {searchResults && searchResults.length >= 10 && (
                            <p className="text-[11px] text-foreground/40 text-center py-1.5">Player not found? Type more</p>
                        )}
                        {searchResults && searchResults.length === 0 && inviteSearch.length >= 2 && (
                            <p className="text-xs text-foreground/40 text-center py-2">No players found</p>
                        )}
                    </div>
                </motion.div>
            ) : (
                <p className="text-xs text-foreground/40 text-center">
                    Join the WhatsApp group to invite teammates
                </p>
            )}
        </div>
    );
}
