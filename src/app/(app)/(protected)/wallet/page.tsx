"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
    useInfiniteQuery,
    useQuery,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import {
    Card,
    CardBody,
    CardHeader,
    Divider,
    Skeleton,
    Button,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
} from "@heroui/react";
import {
    Wallet as WalletIcon,
    ArrowUpRight,
    ArrowDownLeft,
    ArrowRightLeft,
    Clock,
    AlertCircle,
    Loader2,
    Plus,
    IndianRupee,
    Sparkles,
    QrCode,
    Camera,
    MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { GAME, GAME_MODE } from "@/lib/game-config";
import { CurrencyIcon } from "@/components/common/CurrencyIcon";
import { QRCodeSVG } from "qrcode.react";

const ICON_DIRS: Record<string, string> = { freefire: "freefire", pes: "pes", mlbb: "mlbb" };
const GAME_ICON = `/icons/${ICON_DIRS[GAME_MODE] ?? "bgmi"}/icon-192x192.png`;

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

// ─── Razorpay Types ─────────────────────────────────────────

declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
    }
}

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayResponse) => void;
    prefill?: { name?: string; email?: string };
    theme?: { color?: string };
    modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
    open: () => void;
    close: () => void;
}

interface RazorpayResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

interface CreateOrderResponse {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
}

// ─── Data Types ─────────────────────────────────────────────

interface TransactionDTO {
    id: string;
    amount: number;
    type: "CREDIT" | "DEBIT";
    description: string;
    createdAt: string;
}

interface TransactionsResponse {
    data: TransactionDTO[];
    meta: { hasMore: boolean; nextCursor: string | null };
}

interface WalletData {
    balance: number;
    diamondBalance: number;
    displayName: string;
    email: string;
}

// ─── Payment Methods Badge ──────────────────────────────────

const PAYMENT_METHODS = [
    // Google Pay
    <svg key="gpay" width="18" height="18" viewBox="0 0 48 48" fill="none">
        <path fill="#e64a19" d="M42.858,11.975c-4.546-2.624-10.359-1.065-12.985,3.481L23.25,26.927c-1.916,3.312,0.551,4.47,3.301,6.119l6.372,3.678c2.158,1.245,4.914,0.506,6.158-1.649l6.807-11.789C48.176,19.325,46.819,14.262,42.858,11.975z" />
        <path fill="#fbc02d" d="M35.365,16.723l-6.372-3.678c-3.517-1.953-5.509-2.082-6.954,0.214l-9.398,16.275c-2.624,4.543-1.062,10.353,3.481,12.971c3.961,2.287,9.024,0.93,11.311-3.031l9.578-16.59C38.261,20.727,37.523,17.968,35.365,16.723z" />
        <path fill="#43a047" d="M36.591,8.356l-4.476-2.585c-4.95-2.857-11.28-1.163-14.137,3.787L9.457,24.317c-1.259,2.177-0.511,4.964,1.666,6.22l5.012,2.894c2.475,1.43,5.639,0.582,7.069-1.894l9.735-16.86c2.017-3.492,6.481-4.689,9.974-2.672L36.591,8.356z" />
        <path fill="#1e88e5" d="M19.189,13.781l-4.838-2.787c-2.158-1.242-4.914-0.506-6.158,1.646l-5.804,10.03c-2.857,4.936-1.163,11.252,3.787,14.101l3.683,2.121l4.467,2.573l1.939,1.115c-3.442-2.304-4.535-6.92-2.43-10.555l1.503-2.596l5.504-9.51C22.083,17.774,21.344,15.023,19.189,13.781z" />
    </svg>,
    // Paytm
    <svg key="paytm" width="18" height="18" viewBox="0 0 48 48" fill="none">
        <path fill="#0d47a1" d="M5.446 18.01H.548c-.277 0-.502.167-.503.502L0 30.519c-.001.3.196.45.465.45.735 0 1.335 0 2.07 0 .255 0 .465-.125.465-.375 0-1.111 0-2.483 0-3.594l2.126.009c1.399-.092 2.335-.742 2.725-2.052.117-.393.14-.733.14-1.137l.11-2.862C7.999 18.946 6.949 18.181 5.446 18.01zM4.995 23.465C4.995 23.759 4.754 24 4.461 24H3v-3h1.461c.293 0 .534.24.534.535V23.465zM13.938 18h-3.423c-.26 0-.483.08-.483.351 0 .706 0 1.495 0 2.201.028.294.231.448.52.448h2.855c.594 0 .532.972 0 1H11.84C10.101 22 9 23.562 9 25.137c0 .42.005 1.406 0 1.863-.008.651-.014 1.311.112 1.899C9.336 29.939 10.235 31 11.597 31h4.228c.541 0 1.173-.474 1.173-1.101v-8.274C17.026 19.443 15.942 18.117 13.938 18zM14 27.55c0 .248-.202.45-.448.45h-1.105C12.201 28 12 27.798 12 27.55v-2.101C12 25.202 12.201 25 12.447 25h1.105C13.798 25 14 25.202 14 25.449V27.55zM18 18.594v5.608c.124 1.6 1.608 2.798 3.171 2.798h1.414c.597 0 .561.969 0 .969H19.49c-.339 0-.462.177-.462.476v2.152c0 .226.183.396.422.396h2.959c2.416 0 3.592-1.159 3.591-3.757v-8.84c0-.276-.175-.383-.342-.383h-2.302c-.224 0-.355.243-.355.422v5.218c0 .199-.111.316-.29.316H21.41c-.264 0-.409-.143-.409-.396v-5.058C21 18.218 20.88 18 20.552 18c-.778 0-1.442 0-2.22 0C18.067 18 18 18.263 18 18.594z" />
        <path fill="#00adee" d="M27.038 20.569v-2.138c0-.237.194-.431.43-.431H28c1.368-.285 1.851-.62 2.688-1.522.514-.557.966-.704 1.298-.113L32 18h1.569C33.807 18 34 18.194 34 18.431v2.138C34 20.805 33.806 21 33.569 21H32v9.569C32 30.807 31.806 31 31.57 31h-2.14C29.193 31 29 30.807 29 30.569V21h-1.531C27.234 21 27.038 20.806 27.038 20.569zM42.991 30.465c0 .294-.244.535-.539.535h-1.91c-.297 0-.54-.241-.54-.535v-6.623-1.871c0-1.284-2.002-1.284-2.002 0v8.494C38 30.759 37.758 31 37.461 31H35.54C35.243 31 35 30.759 35 30.465V18.537C35 18.241 35.243 18 35.54 18h1.976c.297 0 .539.241.539.537v.292c1.32-1.266 3.302-.973 4.416.228 2.097-2.405 5.69-.262 5.523 2.375 0 2.916-.026 6.093-.026 9.033 0 .294-.244.535-.538.535h-1.891C45.242 31 45 30.759 45 30.465c0-2.786 0-5.701 0-8.44 0-1.307-2-1.37-2 0v8.44H42.991z" />
    </svg>,
    // PhonePe
    <svg key="phonepe" width="18" height="18" viewBox="0 0 48 48" fill="none">
        <path fill="#4527a0" d="M42,37c0,2.762-2.238,5-5,5H11c-2.761,0-5-2.238-5-5V11c0-2.762,2.239-5,5-5h26c2.762,0,5,2.238,5,5V37z" />
        <path fill="#fff" d="M32.267,20.171c0-0.681-0.584-1.264-1.264-1.264h-2.334l-5.35-6.25c-0.486-0.584-1.264-0.778-2.043-0.584l-1.848,0.584c-0.292,0.097-0.389,0.486-0.195,0.681l5.836,5.666h-8.851c-0.292,0-0.486,0.195-0.486,0.486v0.973c0,0.681,0.584,1.506,1.264,1.506h1.972v4.305c0,3.502,1.611,5.544,4.723,5.544c0.973,0,1.378-0.097,2.35-0.486v3.112c0,0.875,0.681,1.556,1.556,1.556h0.786c0.292,0,0.584-0.292,0.584-0.584V21.969h2.812c0.292,0,0.486-0.195,0.486-0.486V20.171z M26.043,28.413c-0.584,0.292-1.362,0.389-1.945,0.389c-1.556,0-2.097-0.778-2.097-2.529v-4.305h4.043V28.413z" />
    </svg>,
    // BHIM UPI
    <svg key="bhim" width="18" height="18" viewBox="0 0 48 48" fill="none">
        <polygon fill="#388e3c" points="29,4 18,45 40,24" />
        <polygon fill="#f57c00" points="21,3 10,44 32,23" />
    </svg>,
    // Cards
    <svg key="cards" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="14" height="10" rx="2" stroke="#fff" strokeWidth="1.3" fill="none" />
        <line x1="2" y1="8" x2="16" y2="8" stroke="#fff" strokeWidth="1.3" />
        <rect x="4" y="10" width="4" height="1.5" rx="0.5" fill="#fff" fillOpacity="0.6" />
    </svg>,
];

function PaymentMethodsBadge() {
    const [idx, setIdx] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIdx((prev) => (prev + 1) % PAYMENT_METHODS.length);
        }, 1500);
        return () => clearInterval(timer);
    }, []);

    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center"
            >
                {PAYMENT_METHODS[idx]}
            </motion.span>
        </AnimatePresence>
    );
}

// ─── Constants ──────────────────────────────────────────────

const PLATFORM_FEE_PERCENT = 2.4;
const QUICK_UC_AMOUNTS = [10, 50, 100, 200];

/** Calculate rupee amount to charge for desired UC (includes 2.4% Razorpay fee) */
const calculateRupees = (uc: number) => {
    const exactAmount = uc / (1 - PLATFORM_FEE_PERCENT / 100);
    return Math.round(exactAmount * 100) / 100;
};

const formatRupees = (amount: number) =>
    amount % 1 === 0 ? amount.toString() : amount.toFixed(2);

/** Load Razorpay checkout script */
const loadRazorpayScript = (): Promise<boolean> =>
    new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

// ─── Cross-Game Promo ───────────────────────────────────────
// Moved to @/components/common/cross-game-promo
import { CrossGamePromo } from "@/components/common/cross-game-promo";
import { CrossGameTransferModal } from "@/components/wallet/cross-game-transfer-modal";

// ─── Component ──────────────────────────────────────────────

export default function WalletPage() {
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { isOpen: isQrOpen, onOpen: onQrOpen, onClose: onQrClose } = useDisclosure();
    const { isOpen: isCrossGameOpen, onOpen: onCrossGameOpen, onClose: onCrossGameClose } = useDisclosure();
    const [desiredUC, setDesiredUC] = useState<number>(50);

    const rupeeAmount = calculateRupees(desiredUC);
    const isValidAmount = desiredUC >= 10 && rupeeAmount <= 10000;

    // ── Balance ─────────────────────────────────────────────
    const { data: wallet, isLoading: isLoadingWallet } = useQuery<WalletData>({
        queryKey: ["wallet"],
        queryFn: async () => {
            const res = await fetch("/api/profile");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return {
                balance: json.data?.player?.wallet?.balance ?? 0,
                diamondBalance: json.data?.player?.wallet?.diamondBalance ?? 0,
                displayName: json.data?.player?.displayName ?? "",
                email: json.data?.email ?? "",
            };
        },
        staleTime: 30 * 1000,
    });

    // ── Current season ──────────────────────────────────────
    const { data: currentSeasonId } = useQuery<string | null>({
        queryKey: ["current-season"],
        queryFn: async () => {
            const res = await fetch("/api/seasons");
            if (!res.ok) return null;
            const json = await res.json();
            const current = (json.data ?? []).find(
                (s: { isCurrent: boolean }) => s.isCurrent
            );
            return current?.id ?? null;
        },
        staleTime: 5 * 60 * 1000,
    });

    // ── Auto-recover missed payments (BGMI only) ──────────────
    // On mobile, UPI intents redirect outside the browser. When the user returns,
    // the Razorpay callback may not fire. This checks for "created" payments that
    // were actually captured and credits the UC.
    useEffect(() => {
        if (!GAME.features.hasTopUps) return;
        const recover = async () => {
            try {
                const res = await fetch("/api/payments/check-pending", { method: "POST" });
                if (!res.ok) return;
                const json = await res.json();
                const recovered = json.data?.recovered ?? 0;
                if (recovered > 0) {
                    toast.success(`🎉 Recovered ${recovered} pending payment(s)! Your ${GAME.currency} has been credited.`);
                    queryClient.invalidateQueries({ queryKey: ["wallet"] });
                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                    queryClient.invalidateQueries({ queryKey: ["transactions"] });
                }
            } catch {
                // Silent fail — recovery is best-effort
            }
        };
        recover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Public settings (UPI QR for non-Razorpay games) ─────
    const { data: publicSettings } = useQuery<{ upiQrImageUrl?: string; upiId?: string; upiPayeeName?: string; upiWhatsAppNumber?: string; whatsAppGroups?: string[] }>({
        queryKey: ["public-settings-wallet"],
        queryFn: async () => {
            const res = await fetch("/api/settings/public");
            if (!res.ok) return {};
            const json = await res.json();
            return json.data ?? {};
        },
        staleTime: 5 * 60 * 1000,
    });

    // ── Transactions (infinite scroll) ──────────────────────
    const {
        data: txData,
        isLoading: isLoadingTx,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery<TransactionsResponse>({
        queryKey: ["transactions", currentSeasonId],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({
                limit: "10",
                ...(pageParam ? { cursor: pageParam as string } : {}),
                ...(currentSeasonId ? { seasonId: currentSeasonId } : {}),
            });
            const res = await fetch(`/api/transactions?${params}`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
        initialPageParam: null as string | null,
        getNextPageParam: (last) =>
            last.meta.hasMore ? last.meta.nextCursor : undefined,
        staleTime: 60 * 1000,
    });

    const transactions = txData?.pages.flatMap((p) => p.data) ?? [];

    // ── Razorpay: Create Order ──────────────────────────────
    const createOrder = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/payments/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: rupeeAmount,
                    amountInPaise: Math.round(rupeeAmount * 100),
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to create order");
            }
            const json = await res.json();
            return json.data as CreateOrderResponse;
        },
        onSuccess: async (data) => {
            const { orderId, amount: orderAmount, currency, keyId } = data;

            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                toast.error("Failed to load payment gateway");
                return;
            }

            const options: RazorpayOptions = {
                key: keyId,
                amount: orderAmount,
                currency,
                name: GAME.name,
                description: `Add ${desiredUC} ${GAME.currency} to your balance`,
                order_id: orderId,
                handler: (response: RazorpayResponse) => {
                    verifyPayment.mutate(response);
                },
                theme: { color: "#6366f1" },
                modal: {
                    ondismiss: () => toast.info("Payment cancelled"),
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to initiate payment");
        },
    });

    // ── Razorpay: Verify Payment ────────────────────────────
    const verifyPayment = useMutation({
        mutationFn: async (paymentResponse: RazorpayResponse) => {
            const res = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(paymentResponse),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(
                    data.message || "Payment verification failed"
                );
            }
            return res.json();
        },
        onSuccess: (data) => {
            const ucAdded = data?.data?.ucAdded ?? 0;
            toast.success(`🎉 Added ${ucAdded} ${GAME.currency}! 7x chance for free tournament entry 🎯`);
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            onClose();
            setDesiredUC(50);
        },
        onError: (err: Error) => {
            toast.error(
                err.message ||
                "Payment verification failed. Please contact support."
            );
        },
    });

    const isPaymentLoading = createOrder.isPending || verifyPayment.isPending;

    // ── IntersectionObserver for infinite scroll ─────────────
    const handleIntersection = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            if (
                entries[0].isIntersecting &&
                hasNextPage &&
                !isFetchingNextPage
            ) {
                fetchNextPage();
            }
        },
        [hasNextPage, isFetchingNextPage, fetchNextPage]
    );

    useEffect(() => {
        if (!loadMoreRef.current) return;
        const observer = new IntersectionObserver(handleIntersection, {
            threshold: 0.1,
        });
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [handleIntersection]);

    // Check if player has topped up via Razorpay
    const hasRazorpayTopUp = transactions.some((t) =>
        t.description.toLowerCase().includes("razorpay")
    );


    return (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="mb-6 space-y-1">
                <div className="flex items-center gap-2">
                    <WalletIcon className="h-5 w-5 game-text" />
                    <h1 className="text-lg font-bold">Wallet</h1>
                </div>
                <p className="text-sm text-foreground/50">
                    Your {GAME.currency} balance and transactions
                </p>
            </div>

            <div className="space-y-4">
                {/* ── Balance Card ────────────────────────────── */}
                {isLoadingWallet ? (
                    <Skeleton className="h-44 w-full rounded-2xl" />
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card
                            className="overflow-hidden border-none"
                            style={{ background: 'linear-gradient(to bottom right, color-mix(in srgb, var(--game-primary) 15%, transparent), color-mix(in srgb, var(--game-primary) 8%, transparent), color-mix(in srgb, var(--game-primary-light) 5%, transparent))' }}
                        >
                            {/* Decorative elements */}
                            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--game-primary) 10%, transparent)' }} />
                            <div className="pointer-events-none absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-secondary/10 blur-xl" />

                            <CardBody className="relative z-10 gap-4 p-6">
                                <div className="space-y-1">
                                    <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-foreground/50">
                                        <Sparkles className="h-3 w-3" />
                                        Available Balance
                                    </span>
                                    <p
                                        className={`whitespace-nowrap text-4xl font-bold tracking-tight ${(wallet?.balance ?? 0) < 0
                                            ? "text-danger"
                                            : "text-foreground"
                                            }`}
                                    >
                                        {(
                                            wallet?.balance ?? 0
                                        ).toLocaleString()}{" "}
                                        <span className="text-lg font-semibold text-foreground/40 inline-flex items-center gap-1">
                                            {GAME.hasDualCurrency ? GAME.entryCurrency : <CurrencyIcon size={18} />}
                                        </span>
                                    </p>
                                    {GAME.hasDualCurrency && (
                                        <p className="text-lg font-semibold text-foreground/60 mt-1">
                                            {(wallet?.diamondBalance ?? 0).toLocaleString()}{" "}
                                            <span className="text-sm font-semibold text-foreground/40">
                                                {GAME.rewardCurrencyEmoji} {GAME.rewardCurrency}
                                            </span>
                                        </p>
                                    )}
                                </div>

                                {(publicSettings?.upiId || publicSettings?.upiQrImageUrl) && (
                                <Button
                                    size="lg"
                                    color="success"
                                    className="w-full font-semibold text-white text-base"
                                    startContent={
                                        <Plus className="h-5 w-5" />
                                    }
                                    onPress={onQrOpen}
                                >
                                    Add {GAME.currency}
                                </Button>
                                )}

                            </CardBody>
                        </Card>
                    </motion.div>
                )}

                {/* ── Sponsor Coupons ─────────────────────────── */}
                <WalletCoupons />

                {/* ── Transfer to Game ────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <button
                        onClick={onCrossGameOpen}
                        className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-secondary/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--game-primary) 20%, transparent)' }}>
                            <ArrowRightLeft className="h-4 w-4 game-text" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-semibold">Transfer to Another Game</p>
                            <p className="text-[11px] text-foreground/50">Move {GAME.currency} between your game wallets</p>
                        </div>
                    </button>
                </motion.div>

                {/* ── Cross-Game Promo ───────────────────────── */}
                <CrossGamePromo />

                {/* ── Cross-Game Transfer Modal ──────────────── */}
                <CrossGameTransferModal
                    isOpen={isCrossGameOpen}
                    onClose={onCrossGameClose}
                    currentBalance={wallet?.balance ?? 0}
                />

                {/* ── Transaction History ─────────────────────── */}
                <Card className="border border-divider">
                    <CardHeader className="flex items-center justify-between pb-2">
                        <h3 className="text-sm font-semibold">
                            Transaction History
                        </h3>
                        {transactions.length > 0 && (
                            <span className="text-[10px] text-foreground/30">
                                This season
                            </span>
                        )}
                    </CardHeader>
                    <Divider />
                    <CardBody className="p-0">
                        {error && (
                            <div className="flex items-center gap-2 p-4 text-sm text-danger">
                                <AlertCircle className="h-4 w-4" />
                                Failed to load transactions.
                            </div>
                        )}

                        {isLoadingTx && (
                            <div className="space-y-0 p-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <Skeleton className="h-9 w-9 rounded-full" />
                                        <div className="flex-1 space-y-1.5">
                                            <Skeleton className="h-3 w-32 rounded" />
                                            <Skeleton className="h-2 w-20 rounded" />
                                        </div>
                                        <Skeleton className="h-4 w-14 rounded" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!isLoadingTx &&
                            transactions.length === 0 &&
                            !error && (
                                <div className="flex flex-col items-center gap-3 py-8 text-center">
                                    <Clock className="h-8 w-8 text-foreground/20" />
                                    <p className="text-sm text-foreground/40">
                                        No transactions yet
                                    </p>
                                </div>
                            )}

                        {transactions.length > 0 && (
                            <div className="divide-y divide-divider">
                                {transactions.map((tx, i) => {
                                    // Compute balance after this tx by working backwards
                                    // from current balance through all prior transactions
                                    const laterTxs = transactions.slice(0, i);
                                    let balAfter = wallet?.balance ?? 0;
                                    for (const lt of laterTxs) {
                                        balAfter -= lt.type === "CREDIT" ? lt.amount : -lt.amount;
                                    }
                                    const balBefore = tx.type === "CREDIT"
                                        ? balAfter - tx.amount
                                        : balAfter + tx.amount;

                                    return (
                                        <motion.div
                                            key={tx.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: i * 0.02 }}
                                            className="flex items-center gap-3 px-4 py-3"
                                        >
                                            <div
                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tx.type === "CREDIT"
                                                    ? "bg-success/10"
                                                    : "bg-danger/10"
                                                    }`}
                                            >
                                                {tx.type === "CREDIT" ? (
                                                    <ArrowDownLeft className="h-4 w-4 text-success" />
                                                ) : (
                                                    <ArrowUpRight className="h-4 w-4 text-danger" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs">
                                                    {tx.description}
                                                </p>
                                                <div className="flex items-center gap-1.5 text-[10px] text-foreground/40">
                                                    <span>
                                                        {new Date(
                                                            tx.createdAt
                                                        ).toLocaleDateString("en-IN", {
                                                            day: "numeric",
                                                            month: "short",
                                                        })}
                                                    </span>
                                                    <span>·</span>
                                                    <span>
                                                        {balBefore.toLocaleString()} → {balAfter.toLocaleString()} <CurrencyIcon size={10} />
                                                    </span>
                                                </div>
                                            </div>
                                            <span
                                                className={`shrink-0 text-sm font-semibold ${tx.type === "CREDIT"
                                                    ? "text-success"
                                                    : "text-danger"
                                                    }`}
                                            >
                                                {tx.type === "CREDIT" ? "+" : "-"}
                                                {tx.amount.toLocaleString()} <CurrencyIcon size={13} />
                                            </span>
                                        </motion.div>
                                    );
                                })}

                                {/* Infinite scroll trigger */}
                                <div
                                    ref={loadMoreRef}
                                    className="flex justify-center py-3"
                                >
                                    {isFetchingNextPage && (
                                        <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
                                    )}
                                    {!hasNextPage &&
                                        transactions.length > 0 && (
                                            <p className="text-[10px] text-foreground/25">
                                                All transactions loaded
                                            </p>
                                        )}
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* ── Add Balance Modal ──────────────────────────── */}
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                placement="center"
                size="sm"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col items-center gap-1 pb-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-green-500">
                            <WalletIcon className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-base font-semibold">
                            Add {GAME.currency} Balance
                        </span>
                        <span className="text-[11px] text-foreground/40">
                            {PLATFORM_FEE_PERCENT}% Razorpay fee included
                        </span>
                    </ModalHeader>

                    <ModalBody className="gap-4">
                        {/* Quick select */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-foreground/40">
                                Quick Select
                            </span>
                            <div className="grid grid-cols-4 gap-2">
                                {QUICK_UC_AMOUNTS.map((uc) => (
                                    <Button
                                        key={uc}
                                        size="sm"
                                        variant={
                                            desiredUC === uc
                                                ? "solid"
                                                : "bordered"
                                        }
                                        color={
                                            desiredUC === uc
                                                ? "primary"
                                                : "default"
                                        }
                                        className="text-xs font-semibold"
                                        onPress={() => setDesiredUC(uc)}
                                        isDisabled={isPaymentLoading}
                                    >
                                        {uc} <CurrencyIcon size={12} />
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Custom amount */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium uppercase tracking-wider text-foreground/40">
                                Custom {GAME.currency} Amount
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min={10}
                                    max={9756}
                                    value={desiredUC || ""}
                                    onChange={(e) => {
                                        const n = parseInt(e.target.value, 10);
                                        if (!isNaN(n) && n >= 0) setDesiredUC(n);
                                        else if (e.target.value === "") setDesiredUC(0);
                                    }}
                                    placeholder={`Enter ${GAME.currency} amount`}
                                    disabled={isPaymentLoading}
                                    className="w-full rounded-xl border border-divider bg-default-100 px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                                />
                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground/30">
                                    <CurrencyIcon size={14} />
                                </span>
                            </div>
                            <p className="text-[10px] text-foreground/30">
                                Min: 10 {GAME.currency} · Max: 9,756 {GAME.currency} (₹10,000)
                            </p>
                        </div>

                        {/* Payment preview */}
                        <div className="space-y-2 rounded-xl bg-gradient-to-br from-success/10 to-success/5 p-4">
                            <div className="flex items-center justify-between text-xs text-foreground/60">
                                <span>{GAME.currency} to receive</span>
                                <span className="font-semibold text-success">
                                    {desiredUC.toLocaleString()} <CurrencyIcon size={13} />
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-foreground/60">
                                <span>
                                    Razorpay Fee ({PLATFORM_FEE_PERCENT}%)
                                </span>
                                <span className="text-foreground/40">
                                    included
                                </span>
                            </div>
                            <Divider className="my-1" />
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">
                                    You pay
                                </span>
                                <div className="flex items-center gap-0.5">
                                    <IndianRupee className="h-5 w-5" />
                                    <span className="text-2xl font-bold">
                                        {formatRupees(rupeeAmount)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </ModalBody>

                    <ModalFooter className="gap-2">
                        <Button
                            variant="flat"
                            onPress={onClose}
                            isDisabled={isPaymentLoading}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            color="success"
                            className="flex-1 font-semibold text-white"
                            isLoading={isPaymentLoading}
                            isDisabled={!isValidAmount}
                            startContent={
                                !isPaymentLoading && <PaymentMethodsBadge />
                            }
                            onPress={() => createOrder.mutate()}
                        >
                            Pay ₹{formatRupees(rupeeAmount)}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* ── UPI QR Manual Top-Up Modal ──────────────────── */}
            <Modal
                isOpen={isQrOpen}
                onClose={onQrClose}
                placement="center"
                size="sm"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col items-center gap-1 pb-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-emerald-500">
                            <QrCode className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-base font-semibold">
                            Add {GAME.currency}
                        </span>
                        <span className="text-[11px] text-foreground/40">
                            Scan QR code to pay via UPI
                        </span>
                    </ModalHeader>

                    <ModalBody className="gap-3 py-3">
                        {/* QR Code — auto-generated from UPI ID */}
                        {publicSettings?.upiId ? (() => {
                            // Build a clean transaction note — no special chars that banks might reject
                            const playerName = (wallet?.displayName || "Player").replace(/[^a-zA-Z0-9 ]/g, "");
                            const emailId = wallet?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") || "";
                            const tn = `${GAME.name} ${playerName}${emailId ? ` ${emailId}` : ""}`.slice(0, 50);
                            const upiUrl = `upi://pay?pa=${encodeURIComponent(publicSettings.upiId)}&pn=${encodeURIComponent(publicSettings.upiPayeeName || GAME.name)}&tn=${encodeURIComponent(tn)}&mode=00`;

                            return (
                                <div className="mx-auto rounded-2xl bg-white p-3">
                                    <QRCodeSVG
                                        value={upiUrl}
                                        size={160}
                                        level="H"
                                        bgColor="#ffffff"
                                        fgColor="#1a1a2e"
                                        imageSettings={{
                                            src: GAME_ICON,
                                            height: 32,
                                            width: 32,
                                            excavate: true,
                                        }}
                                    />
                                </div>
                            );
                        })() : publicSettings?.upiQrImageUrl ? (
                            <div className="mx-auto w-44 h-44 rounded-xl overflow-hidden border border-divider bg-white p-2">
                                <img
                                    src={publicSettings.upiQrImageUrl}
                                    alt="UPI QR Code"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : null}

                        {/* Payee name for trust */}
                        {publicSettings?.upiPayeeName && (
                            <p className="text-xs text-center font-medium text-foreground/60">
                                Paying to: <span className="text-foreground">{publicSettings.upiPayeeName}</span>
                            </p>
                        )}


                        {/* Compact steps */}
                        <div className="flex items-center justify-between gap-1 text-[10px] text-foreground/50 px-1">
                            <span className="flex items-center gap-1"><span className="text-success font-bold">1.</span> Scan & Pay</span>
                            <span>→</span>
                            <span className="flex items-center gap-1"><span className="text-primary font-bold">2.</span> Screenshot</span>
                            <span>→</span>
                            <span className="flex items-center gap-1"><span className="text-warning font-bold">3.</span> Send</span>
                        </div>

                        <p className="text-[10px] text-center text-foreground/30">
                            Send screenshot via WhatsApp{publicSettings?.upiWhatsAppNumber ? ` +91 ${publicSettings.upiWhatsAppNumber}` : ''} · {GAME.currency} credited after verification
                        </p>
                    </ModalBody>

                    <ModalFooter className="gap-2 pt-1">
                        <Button
                            variant="flat"
                            onPress={onQrClose}
                            className="flex-1"
                        >
                            Close
                        </Button>
                        <Button
                            color="success"
                            className="flex-1 font-semibold text-white"
                            startContent={
                                <WhatsAppIcon className="h-4 w-4" />
                            }
                            onPress={() => {
                                const raw = publicSettings?.upiWhatsAppNumber || "8837011018";
                                const num = raw.startsWith("91") ? raw : `91${raw}`;
                                window.open(`https://wa.me/${num}?text=${encodeURIComponent(`Hi, I just paid for ${GAME.currency} top-up. Sending screenshot.`)}`, "_blank");
                            }}
                        >
                            WhatsApp
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}

// ─── Wallet Coupons Section ─────────────────────────────────

interface CouponData {
    id: string;
    code: string;
    discountPct: number;
    maxDiscount: number;
    sponsorName: string;
    description: string;
    expiresAt: string;
    claimedAt: string | null;
    tournamentName: string | null;
}

function WalletCoupons() {
    const { data: coupons, isLoading } = useQuery<CouponData[]>({
        queryKey: ["my-coupons"],
        queryFn: async () => {
            const res = await fetch("/api/coupons/my");
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
        staleTime: 60_000,
    });

    if (isLoading || !coupons || coupons.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="space-y-2"
        >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/40 flex items-center gap-1.5 px-1">
                🎟️ Your Coupons
            </h3>
            {coupons.map((coupon) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(coupon.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                return (
                    <div
                        key={coupon.id}
                        className="relative overflow-hidden rounded-2xl border border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20"
                    >
                        {/* Decorative ticket notch */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-background" />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 rounded-full bg-background" />

                        <div className="px-6 py-4 space-y-3">
                            {/* Discount headline */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                                        {coupon.discountPct}% OFF
                                    </p>
                                    <p className="text-xs text-foreground/50">
                                        up to ₹{coupon.maxDiscount} at {coupon.sponsorName}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-foreground/40 uppercase tracking-wide">Expires in</p>
                                    <p className={`text-sm font-bold ${daysLeft <= 7 ? "text-danger" : "text-foreground/60"}`}>
                                        {daysLeft}d
                                    </p>
                                </div>
                            </div>

                            {/* Tournament badge */}
                            {coupon.tournamentName && (
                                <p className="text-[10px] text-foreground/40">
                                    Won from: {coupon.tournamentName}
                                </p>
                            )}

                            {/* Code */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-white/60 dark:bg-white/10 border border-dashed border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 text-center">
                                    <span className="text-base font-mono font-bold tracking-widest text-amber-800 dark:text-amber-200">
                                        {coupon.code}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(coupon.code);
                                        toast.success("Code copied! 📋");
                                    }}
                                    className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors cursor-pointer"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </motion.div>
    );
}
