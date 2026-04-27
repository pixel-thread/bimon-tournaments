"use client";

import { useState, useEffect } from "react";
import {
    Card,
    CardBody,
    CardHeader,
    Input,
    Switch,
    Button,
    Divider,
    Chip,
    Textarea,
    Spinner,
} from "@heroui/react";
import {
    DollarSign,
    Crown,
    Users,
    Clover,
    Gamepad2,
    Save,
    RotateCcw,
    Shield,
    Swords,
    Upload,
    Image as ImageIcon,
    Trash2,
    Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { GAME } from "@/lib/game-config";

/** Real WhatsApp SVG icon */
function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

interface Settings {
    orgCutMode: "percent" | "fixed";
    orgCutFixed: number;
    orgCutPercent: number;
    enableFund: boolean;
    defaultEntryFee: number;
    enableTopUps: boolean;
    nameChangeFee: number;
    rankedOrgCutMode: "percent" | "fixed";
    rankedOrgCutFixed: number;
    rankedOrgCutPercent: number;
    rankedEnableFund: boolean;
    rankedDefaultEntryFee: number;
    enableElitePass: boolean;
    elitePassPrice: number;
    elitePassOrigPrice: number;
    streakMilestone: number;
    streakRewardAmount: number;
    enableReferrals: boolean;
    referralReward: number;
    referralTournamentsReq: number;
    enableLuckyVoters: boolean;
    allowedTeamSizes: string;
    maxIGNLength: number;
    defaultPollDays: number;
    whatsAppGroups: string[];
    welcomeMessage: string;
    customRules: string;
    meritBanThreshold: number;
    meritSoloRestrictThreshold: number;
    upiQrImageUrl: string;
    upiId: string;
    upiPayeeName: string;
    upiWhatsAppNumber: string;
    matchDeadlineGroupHours: number;
    matchDeadlineKOHours: number;
    deadlineCutoffTime: string;
    deadlinePausedDays: number[];
    youtubeChannelUrl: string;
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [original, setOriginal] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingQr, setUploadingQr] = useState(false);
    const [financeMode, setFinanceMode] = useState<"casual" | "ranked">("casual");

    useEffect(() => {
        fetch("/api/settings")
            .then((r) => r.json())
            .then((res) => {
                if (res.success) {
                    setSettings(res.data);
                    setOriginal(res.data);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const hasChanges = JSON.stringify(settings) !== JSON.stringify(original);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (data.success) {
                setOriginal(data.data);
                setSettings(data.data);
                toast.success("Settings saved!");
            } else {
                toast.error(data.message || "Failed to save");
            }
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (original) setSettings({ ...original });
    };

    const update = (key: keyof Settings, value: any) => {
        setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="text-center text-foreground/50 py-20">
                Failed to load settings.
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-sm text-foreground/50">
                        Configure platform-wide settings
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="flat"
                        size="sm"
                        startContent={<RotateCcw className="h-4 w-4" />}
                        isDisabled={!hasChanges}
                        onPress={handleReset}
                    >
                        Reset
                    </Button>
                    <Button
                        color="primary"
                        size="sm"
                        startContent={<Save className="h-4 w-4" />}
                        isDisabled={!hasChanges}
                        isLoading={saving}
                        onPress={handleSave}
                    >
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Financial */}
            <Card>
                <CardHeader className="flex gap-2 items-center pb-0">
                    <DollarSign className="h-5 w-5 text-warning" />
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold">Financial</h2>
                        <p className="text-xs text-foreground/50">Prize pool cuts, fees, and top-ups</p>
                    </div>
                </CardHeader>
                <CardBody className="gap-4">
                    {/* Casual / Ranked toggle — BR games only */}
                    {GAME.features.hasBR && (
                    <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-default-100">
                        {([
                            { key: "casual" as const, label: "Casual", icon: "🎮" },
                            { key: "ranked" as const, label: "Ranked", icon: "🏆" },
                        ]).map(({ key, label, icon }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFinanceMode(key)}
                                className={`
                                    flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium
                                    transition-all duration-200 cursor-pointer
                                    ${financeMode === key
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-foreground/50 hover:text-foreground/70"
                                    }
                                `}
                            >
                                <span>{icon}</span>
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                    )}

                    {financeMode === "casual" ? (
                        /* ── Casual Settings ── */
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Org Cut Mode:</span>
                                        <div className="flex gap-1">
                                            {(["percent", "fixed"] as const).map((mode) => (
                                                <Chip
                                                    key={mode}
                                                    variant={settings.orgCutMode === mode ? "solid" : "bordered"}
                                                    color={settings.orgCutMode === mode ? "primary" : "default"}
                                                    className="cursor-pointer"
                                                    onClick={() => update("orgCutMode", mode)}
                                                >
                                                    {mode === "percent" ? "%" : `Fixed ${GAME.currency}`}
                                                </Chip>
                                            ))}
                                        </div>
                                    </div>
                                    {settings.orgCutMode === "percent" ? (
                                        <Input
                                            label="Org Cut"
                                            type="number"
                                            size="sm"
                                            value={String(settings.orgCutPercent)}
                                            onValueChange={(v) => update("orgCutPercent", Number(v))}
                                            description="Percentage of prize pool"
                                            endContent={<span className="text-foreground/40">%</span>}
                                        />
                                    ) : (
                                        <Input
                                            label="Org Cut"
                                            type="number"
                                            size="sm"
                                            value={String(settings.orgCutFixed)}
                                            onValueChange={(v) => update("orgCutFixed", Number(v))}
                                            description="Fixed org cut per tournament"
                                            endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                        />
                                    )}
                                </div>
                                <Input
                                    label="Default Entry Fee"
                                    type="number"
                                    size="sm"
                                    value={String(settings.defaultEntryFee)}
                                    onValueChange={(v) => update("defaultEntryFee", Number(v))}
                                    description={`Default casual entry fee (${GAME.currency})`}
                                    endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                />
                                <Input
                                    label="Name Change Fee"
                                    type="number"
                                    size="sm"
                                    value={String(settings.nameChangeFee)}
                                    onValueChange={(v) => update("nameChangeFee", Number(v))}
                                    description={`Cost to change IGN (${GAME.currency})`}
                                    endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                />
                            </div>
                            <Divider />
                            <Switch
                                size="sm"
                                isSelected={settings.enableFund}
                                onValueChange={(v) => update("enableFund", v)}
                            >
                                <div>
                                    <p className="text-sm">Community Fund</p>
                                    <p className="text-xs text-foreground/40">
                                        {settings.enableFund
                                            ? "ON — Solo & back-to-back taxes go to fund"
                                            : "OFF — No taxes, winners get full prize"}
                                    </p>
                                </div>
                            </Switch>
                        </>
                    ) : (
                        /* ── Ranked Settings ── */
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Org Cut Mode:</span>
                                        <div className="flex gap-1">
                                            {(["percent", "fixed"] as const).map((mode) => (
                                                <Chip
                                                    key={mode}
                                                    variant={settings.rankedOrgCutMode === mode ? "solid" : "bordered"}
                                                    color={settings.rankedOrgCutMode === mode ? "primary" : "default"}
                                                    className="cursor-pointer"
                                                    onClick={() => update("rankedOrgCutMode", mode)}
                                                >
                                                    {mode === "percent" ? "%" : `Fixed ${GAME.currency}`}
                                                </Chip>
                                            ))}
                                        </div>
                                    </div>
                                    {settings.rankedOrgCutMode === "percent" ? (
                                        <Input
                                            label="Org Cut"
                                            type="number"
                                            size="sm"
                                            value={String(settings.rankedOrgCutPercent)}
                                            onValueChange={(v) => update("rankedOrgCutPercent", Number(v))}
                                            description="Percentage of prize pool (ranked)"
                                            endContent={<span className="text-foreground/40">%</span>}
                                        />
                                    ) : (
                                        <Input
                                            label="Org Cut"
                                            type="number"
                                            size="sm"
                                            value={String(settings.rankedOrgCutFixed)}
                                            onValueChange={(v) => update("rankedOrgCutFixed", Number(v))}
                                            description="Fixed org cut per ranked tournament"
                                            endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                        />
                                    )}
                                </div>
                                <Input
                                    label="Default Entry Fee"
                                    type="number"
                                    size="sm"
                                    value={String(settings.rankedDefaultEntryFee)}
                                    onValueChange={(v) => update("rankedDefaultEntryFee", Number(v))}
                                    description={`Default ranked entry fee (${GAME.currency})`}
                                    endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                />
                            </div>
                            <Divider />
                            <Switch
                                size="sm"
                                isSelected={settings.rankedEnableFund}
                                onValueChange={(v) => update("rankedEnableFund", v)}
                            >
                                <div>
                                    <p className="text-sm">Community Fund (Ranked)</p>
                                    <p className="text-xs text-foreground/40">
                                        {settings.rankedEnableFund
                                            ? "ON — Solo & back-to-back taxes go to fund"
                                            : "OFF — No taxes, winners get full prize"}
                                    </p>
                                </div>
                            </Switch>
                        </>
                    )}

                    {GAME.features.hasTopUps && (
                        <>
                            <Divider />
                            <Switch
                                isSelected={settings.enableTopUps}
                                onValueChange={(v) => update("enableTopUps", v)}
                                size="sm"
                            >
                                Enable Top-Ups ({GAME.currency} purchases)
                            </Switch>
                        </>
                    )}
                </CardBody>
            </Card>

            {/* Manual Top-Up (UPI) */}
            {!GAME.features.hasTopUps && (
                <Card>
                    <CardHeader className="flex gap-2 items-center pb-0">
                        <DollarSign className="h-5 w-5 text-success" />
                        <div>
                            <h2 className="text-lg font-semibold">Manual Top-Up (UPI)</h2>
                            <p className="text-xs text-foreground/50">QR code is auto-generated from UPI ID</p>
                        </div>
                    </CardHeader>
                    <CardBody className="gap-4">
                        <Input
                            label="UPI ID"
                            size="sm"
                            value={settings.upiId ?? ""}
                            onValueChange={(v) => update("upiId", v)}
                            placeholder="yourname@upi"
                            description="A QR code with your game icon will be auto-generated for players"
                        />
                        <Input
                            label="Payee Name"
                            size="sm"
                            value={settings.upiPayeeName ?? ""}
                            onValueChange={(v) => update("upiPayeeName", v)}
                            placeholder="Joe"
                            description="Shown to players so they know they are paying the right person"
                        />
                        <Input
                            label="WhatsApp Number"
                            size="sm"
                            value={settings.upiWhatsAppNumber ?? ""}
                            onValueChange={(v) => update("upiWhatsAppNumber", v)}
                            placeholder="8837011018"
                            startContent={<span className="text-sm text-foreground/50">+91</span>}
                            description="Enter 10-digit number without country code"
                        />
                    </CardBody>
                </Card>
            )}

            {/* Royal Pass — BR games only */}
            {GAME.features.hasRoyalPass && (
                <Card>
                    <CardHeader className="flex gap-2 items-center pb-0">
                        <Crown className="h-5 w-5 text-warning" />
                        <div>
                            <h2 className="text-lg font-semibold">{GAME.passName}</h2>
                            <p className="text-xs text-foreground/50">Premium pass pricing and streak rewards</p>
                        </div>
                    </CardHeader>
                    <CardBody className="gap-4">
                        <Switch
                            isSelected={settings.enableElitePass}
                            onValueChange={(v) => update("enableElitePass", v)}
                            size="sm"
                        >
                            Enable {GAME.passName}
                        </Switch>
                        {settings.enableElitePass && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label={`${GAME.passName} Price`}
                                    type="number"
                                    size="sm"
                                    value={String(settings.elitePassPrice)}
                                    onValueChange={(v) => update("elitePassPrice", Number(v))}
                                    endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                />
                                <Input
                                    label="Original Price (strikethrough)"
                                    type="number"
                                    size="sm"
                                    value={String(settings.elitePassOrigPrice)}
                                    onValueChange={(v) => update("elitePassOrigPrice", Number(v))}
                                    endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                />
                                <Input
                                    label="Streak Milestone"
                                    type="number"
                                    size="sm"
                                    value={String(settings.streakMilestone)}
                                    onValueChange={(v) => update("streakMilestone", Number(v))}
                                    description="Tournaments needed for streak reward"
                                />
                                <Input
                                    label="Streak Reward"
                                    type="number"
                                    size="sm"
                                    value={String(settings.streakRewardAmount)}
                                    onValueChange={(v) => update("streakRewardAmount", Number(v))}
                                    endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                />
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            {/* Referrals */}
            {GAME.features.hasReferrals && (
                <Card>
                    <CardHeader className="flex gap-2 items-center pb-0">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                            <h2 className="text-lg font-semibold">Referrals</h2>
                            <p className="text-xs text-foreground/50">Referral rewards and requirements</p>
                        </div>
                    </CardHeader>
                    <CardBody className="gap-4">
                        <Switch
                            isSelected={settings.enableReferrals}
                            onValueChange={(v) => update("enableReferrals", v)}
                            size="sm"
                        >
                            Enable Referrals
                        </Switch>
                        {settings.enableReferrals && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label="Referral Reward"
                                    type="number"
                                    size="sm"
                                    value={String(settings.referralReward)}
                                    onValueChange={(v) => update("referralReward", Number(v))}
                                    description={`${GAME.currency} earned per referral`}
                                    endContent={<span className="text-foreground/40">{GAME.currency}</span>}
                                />
                                <Input
                                    label="Tournaments Required"
                                    type="number"
                                    size="sm"
                                    value={String(settings.referralTournamentsReq)}
                                    onValueChange={(v) => update("referralTournamentsReq", Number(v))}
                                    description="Referee must play this many before reward"
                                />
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            {/* Lucky Voters — all games */}
            <Card>
                <CardHeader className="flex gap-2 items-center pb-0">
                    <Clover className="h-5 w-5 text-success" />
                    <div>
                        <h2 className="text-lg font-semibold">Lucky Voters</h2>
                        <p className="text-xs text-foreground/50">Random voter rewards</p>
                    </div>
                </CardHeader>
                <CardBody>
                    <Switch
                        isSelected={settings.enableLuckyVoters}
                        onValueChange={(v) => update("enableLuckyVoters", v)}
                        size="sm"
                    >
                        Enable Lucky Voters
                    </Switch>
                </CardBody>
            </Card>

            {/* Gameplay */}
            <Card>
                <CardHeader className="flex gap-2 items-center pb-0">
                    <Gamepad2 className="h-5 w-5 text-secondary" />
                    <div>
                        <h2 className="text-lg font-semibold">Gameplay</h2>
                        <p className="text-xs text-foreground/50">Team sizes, IGN limits, poll duration</p>
                    </div>
                </CardHeader>
                <CardBody className="gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="Max IGN Length"
                            type="number"
                            size="sm"
                            value={String(settings.maxIGNLength)}
                            onValueChange={(v) => update("maxIGNLength", Number(v))}
                        />
                        <Input
                            label="Default Poll Days"
                            type="number"
                            size="sm"
                            value={String(settings.defaultPollDays)}
                            onValueChange={(v) => update("defaultPollDays", Number(v))}
                            description="Default poll duration text"
                        />
                    </div>
                    {GAME.features.hasTeamSizes && (
                        <div>
                            <p className="text-sm font-medium mb-2">Allowed Team Sizes</p>
                            <div className="flex flex-wrap gap-2">
                                {["SOLO", "DUO", "TRIO", "SQUAD"].map((size) => {
                                    const active = settings.allowedTeamSizes.includes(size);
                                    return (
                                        <Chip
                                            key={size}
                                            variant={active ? "solid" : "bordered"}
                                            color={active ? "primary" : "default"}
                                            className="cursor-pointer"
                                            onClick={() => {
                                                const sizes = settings.allowedTeamSizes
                                                    .split(",")
                                                    .filter(Boolean);
                                                if (active) {
                                                    update(
                                                        "allowedTeamSizes",
                                                        sizes.filter((s) => s !== size).join(",")
                                                    );
                                                } else {
                                                    update(
                                                        "allowedTeamSizes",
                                                        [...sizes, size].join(",")
                                                    );
                                                }
                                            }}
                                        >
                                            {size}
                                        </Chip>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Bracket Deadlines — only for games with bracket/league support */}
            {GAME.features.hasBracket && (
                <Card>
                    <CardHeader className="flex gap-2 items-center pb-0">
                        <Swords className="h-5 w-5 text-primary" />
                        <div>
                            <h2 className="text-lg font-semibold">Bracket Deadlines</h2>
                            <p className="text-xs text-foreground/50">How long players have to complete each match before admin intervention</p>
                        </div>
                    </CardHeader>
                    <CardBody className="gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="Group / League Deadline"
                                type="number"
                                size="sm"
                                value={String(settings.matchDeadlineGroupHours ?? 48)}
                                onValueChange={(v) => update("matchDeadlineGroupHours", Number(v))}
                                description="Hours for a group or league match"
                                endContent={<span className="text-foreground/40 text-xs">hrs</span>}
                                min={1}
                            />
                            <Input
                                label="Knockout Stage Deadline"
                                type="number"
                                size="sm"
                                value={String(settings.matchDeadlineKOHours ?? 72)}
                                onValueChange={(v) => update("matchDeadlineKOHours", Number(v))}
                                description="Hours to complete a KO match"
                                endContent={<span className="text-foreground/40 text-xs">hrs</span>}
                                min={1}
                            />
                        </div>
                        <Divider />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="Deadline Cutoff Time (IST)"
                                size="sm"
                                value={settings.deadlineCutoffTime ?? "05:30"}
                                onValueChange={(v) => update("deadlineCutoffTime", v)}
                                description='All deadlines snap to this time, e.g. "05:30"'
                                placeholder="05:30"
                            />
                        </div>
                        <p className="text-[11px] text-foreground/30">
                            ⏰ Deadlines snap forward to the cutoff time (IST). Example: 24h deadline started at 5PM → ends next day 5:30 AM. Leave empty to disable snapping.
                        </p>
                        <Divider />
                        <div>
                            <p className="text-sm font-medium mb-2">Paused Days</p>
                            <p className="text-xs text-foreground/40 mb-3">
                                Deadline timers pause on selected days. Players can still play as usual — only the countdown timer stops.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { day: 1, label: "Mon" },
                                    { day: 2, label: "Tue" },
                                    { day: 3, label: "Wed" },
                                    { day: 4, label: "Thu" },
                                    { day: 5, label: "Fri" },
                                    { day: 6, label: "Sat" },
                                    { day: 0, label: "Sun" },
                                ].map(({ day, label }) => {
                                    const active = (settings.deadlinePausedDays ?? []).includes(day);
                                    return (
                                        <Chip
                                            key={day}
                                            variant={active ? "solid" : "bordered"}
                                            color={active ? "primary" : "default"}
                                            className="cursor-pointer"
                                            onClick={() => {
                                                const current = settings.deadlinePausedDays ?? [];
                                                if (active) {
                                                    update("deadlinePausedDays", current.filter((d: number) => d !== day));
                                                } else {
                                                    update("deadlinePausedDays", [...current, day]);
                                                }
                                            }}
                                        >
                                            {label}
                                        </Chip>
                                    );
                                })}
                            </div>
                        </div>
                    </CardBody>
                </Card>
            )}

            {GAME.features.hasMerit && (
                <Card>
                    <CardHeader className="flex gap-2 items-center pb-0">
                        <Shield className="h-5 w-5 text-danger" />
                        <div>
                            <h2 className="text-lg font-semibold">Merit System</h2>
                            <p className="text-xs text-foreground/50">Auto-actions based on merit score thresholds</p>
                        </div>
                    </CardHeader>
                    <CardBody className="gap-4">
                        <p className="text-xs text-foreground/40">
                            When a player&apos;s merit score drops to or below these thresholds, the action is applied automatically. Set to 0 to disable.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="🚫 Auto-Ban Threshold"
                                type="number"
                                size="sm"
                                value={String(settings.meritBanThreshold ?? 0)}
                                onValueChange={(v) => update("meritBanThreshold", Number(v))}
                                description="Full ban at this merit %"
                                endContent={<span className="text-foreground/40">%</span>}
                            />
                            <Input
                                label="⚠️ Solo-Restrict Threshold"
                                type="number"
                                size="sm"
                                value={String(settings.meritSoloRestrictThreshold ?? 0)}
                                onValueChange={(v) => update("meritSoloRestrictThreshold", Number(v))}
                                description="Warning zone at this merit %"
                                endContent={<span className="text-foreground/40">%</span>}
                            />
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Community */}
            <Card>
                <CardHeader className="flex gap-2 items-center pb-0">
                    <div className="w-5 h-5 text-[#25D366]">
                        <WhatsAppIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Community</h2>
                        <p className="text-xs text-foreground/50">WhatsApp groups and welcome message</p>
                    </div>
                </CardHeader>
                <CardBody className="gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="WhatsApp Group 1"
                            size="sm"
                            value={(settings.whatsAppGroups || [])[0] || ""}
                            onValueChange={(v) => {
                                const groups = [...(settings.whatsAppGroups || ["", ""])];
                                groups[0] = v;
                                update("whatsAppGroups", groups.filter((_, i) => i < 2));
                            }}
                            placeholder="https://chat.whatsapp.com/..."
                            startContent={<WhatsAppIcon className="w-4 h-4 text-[#25D366]" />}
                        />
                        <Input
                            label="WhatsApp Group 2"
                            size="sm"
                            value={(settings.whatsAppGroups || [])[1] || ""}
                            onValueChange={(v) => {
                                const groups = [...(settings.whatsAppGroups || ["", ""])];
                                groups[1] = v;
                                update("whatsAppGroups", groups.filter((_, i) => i < 2));
                            }}
                            placeholder="https://chat.whatsapp.com/..."
                            startContent={<WhatsAppIcon className="w-4 h-4 text-[#25D366]" />}
                        />
                    </div>
                    <Textarea
                        label="Welcome Message"
                        size="sm"
                        value={settings.welcomeMessage}
                        onValueChange={(v) => update("welcomeMessage", v)}
                        placeholder={`Welcome to ${GAME.name}!`}
                        minRows={2}
                    />
                    <Divider />
                    <div className="flex items-center gap-2 mb-1">
                        <Youtube className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">YouTube Channel</span>
                    </div>
                    <Input
                        label="YouTube Channel URL"
                        size="sm"
                        value={settings.youtubeChannelUrl ?? ""}
                        onValueChange={(v) => update("youtubeChannelUrl", v)}
                        placeholder="https://youtube.com/@yourchannel"
                        description="Shown in the navigation menu for all players"
                        startContent={<Youtube className="w-4 h-4 text-red-500" />}
                    />
                </CardBody>
            </Card>

            {/* Sticky save bar */}
            {hasChanges && (
                <div className="sticky bottom-4 flex justify-end">
                    <Card className="shadow-lg border border-primary/20">
                        <CardBody className="flex-row items-center gap-3 py-2 px-4">
                            <span className="text-sm text-foreground/60">Unsaved changes</span>
                            <Button
                                variant="flat"
                                size="sm"
                                onPress={handleReset}
                            >
                                Discard
                            </Button>
                            <Button
                                color="primary"
                                size="sm"
                                isLoading={saving}
                                onPress={handleSave}
                            >
                                Save
                            </Button>
                        </CardBody>
                    </Card>
                </div>
            )}
        </div>
    );
}
