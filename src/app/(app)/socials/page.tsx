"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Youtube, Copy, Check } from "lucide-react";
import { GAME } from "@/lib/game-config";

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

interface SocialLink {
    label: string;
    url: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    description: string;
    action: string;
}

export default function SocialsPage() {
    const { data: settings } = useQuery({
        queryKey: ["public-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) return {};
            const json = await res.json();
            return json.data ?? {};
        },
        staleTime: 5 * 60 * 1000,
    });

    const youtubeUrl = settings?.youtubeChannelUrl || "";
    const whatsappGroups: string[] = settings?.whatsAppGroups || [];
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const copyLink = (url: string, idx: number) => {
        navigator.clipboard.writeText(url);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const links: SocialLink[] = [];

    if (youtubeUrl) {
        links.push({
            label: "YouTube",
            url: youtubeUrl,
            icon: <Youtube className="h-6 w-6" />,
            color: "text-red-500",
            bgColor: "bg-red-500/10 border-red-500/20",
            description: "Subscribe for highlights, tutorials & recaps",
            action: "Go",
        });
    }

    const groupLabels = ["📢 Main Group", "🎮 Casual Room ID", "💬 Community Chat"];
    const groupDescs = ["Announcements & updates", "Get room ID & password for casual matches", "Open chat — discuss with the community"];

    whatsappGroups.forEach((url, i) => {
        if (url) {
            links.push({
                label: groupLabels[i] || `WhatsApp Group ${i + 1}`,
                url,
                icon: <WhatsAppIcon className="h-6 w-6" />,
                color: "text-[#25D366]",
                bgColor: "bg-[#25D366]/10 border-[#25D366]/20",
                description: groupDescs[i] || "Join our WhatsApp group",
                action: "Join",
            });
        }
    });

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">{GAME.name} Socials</h1>
                <p className="text-sm text-foreground/50 mt-1">Stay connected with the community</p>
            </div>

            {links.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-foreground/30 text-sm">No social links configured yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {links.map((link, i) => (
                        <div key={i} className={`rounded-xl border p-4 transition-all duration-200 ${link.bgColor}`}>
                            {/* Top row: icon + label */}
                            <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/60 ${link.color}`}>
                                    {link.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className={`font-semibold text-sm whitespace-nowrap ${link.color}`}>{link.label}</p>
                                    <p className="text-[11px] text-foreground/40">{link.description}</p>
                                </div>
                            </div>

                            {/* URL + actions inline */}
                            <div className="relative mt-3 flex items-center rounded-lg bg-background/60 border border-divider overflow-hidden">
                                <p className="flex-1 min-w-0 px-3 py-2 text-xs font-mono text-foreground/50 whitespace-nowrap overflow-hidden">
                                    {link.url}
                                </p>
                                <div className="absolute inset-y-0 right-20 w-16 bg-gradient-to-l from-background/95 to-transparent pointer-events-none" />
                                <div className="relative flex items-center gap-1 shrink-0 pr-1.5 bg-background/95">
                                    <button
                                        onClick={() => copyLink(link.url, i)}
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-default-100 transition-colors"
                                        title="Copy link"
                                    >
                                        {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`rounded-md px-3 py-1 text-xs font-semibold ${link.color} hover:opacity-80 transition-opacity`}
                                    >
                                        {link.action}
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
