"use client";

import { Share2 } from "lucide-react";

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
    isRanked?: boolean;
    discordInviteLink?: string | null;
}

/* ─── Component ─────────────────────────────────────────────── */

export function TeamDoneSection({
    whatsappGroupLink,
    whatsappJoined,
    onWhatsappJoin,
    createdSquadId,
}: TeamDoneSectionProps) {
    return (
        <div className="space-y-4">
            {/* WhatsApp group join (optional) */}
            {whatsappGroupLink && (
                <a
                    href={whatsappGroupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onWhatsappJoin}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${
                        whatsappJoined
                            ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                    }`}
                >
                    <WhatsAppIcon className="w-5 h-5" />
                    {whatsappJoined ? "Joined WhatsApp Group ✅" : "Join WhatsApp Group"}
                </a>
            )}

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

            {/* Hint to use squad card buttons */}
            <p className="text-xs text-foreground/40 text-center">
                Use the buttons on your squad card below to invite players, add members, or quick-add subscribers
            </p>
        </div>
    );
}
