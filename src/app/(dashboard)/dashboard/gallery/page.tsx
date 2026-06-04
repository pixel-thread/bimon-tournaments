"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Chip, Skeleton, Slider } from "@heroui/react";
import { ImageIcon, Upload, Trash2, Loader2, Plus, X, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/compress-image";
import { GAME } from "@/lib/game-config";
import Image from "next/image";

/**
 * /dashboard/gallery — Manage background images.
 * Upload images for bracket/standings backgrounds.
 * Uses /api/gallery/upload (ImgBB server-side) for storage.
 * Includes global background selection (moved from operations page).
 */
export default function GalleryPage() {
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [label, setLabel] = useState("");
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(65);
    const [slotOpacity, setSlotOpacity] = useState(50);

    // Fetch background images only (excludes character images)
    const { data: images, isLoading } = useQuery({
        queryKey: ["gallery"],
        queryFn: async () => {
            const res = await fetch("/api/gallery?type=background");
            if (!res.ok) return [];
            const json = await res.json();
            return json.data ?? [];
        },
    });

    // Global background state
    const { data: globalBg } = useQuery<{ id: string; publicUrl: string; name: string } | null>({
        queryKey: ["global-background"],
        queryFn: async () => {
            const res = await fetch("/api/gallery/global-background");
            if (!res.ok) return null;
            const json = await res.json();
            return json.data ?? null;
        },
    });

    // Upload via existing /api/gallery/upload endpoint
    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!selectedFile) throw new Error("No file selected");
            setUploading(true);

            // Compress before upload
            const compressed = await compressImage(selectedFile, 1200, 0.85);

            // Upload via server endpoint (handles ImgBB)
            const formData = new FormData();
            formData.append("image", compressed, label || selectedFile.name);

            const res = await fetch("/api/gallery/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Image uploaded!");
            queryClient.invalidateQueries({ queryKey: ["gallery"] });
            setLabel("");
            setPreview(null);
            setSelectedFile(null);
            setUploading(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Upload failed");
            setUploading(false);
        },
    });

    // Delete image (hard delete from DB)
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/gallery/backgrounds", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error("Failed to delete");
        },
        onSuccess: () => {
            toast.success("Image deleted");
            queryClient.invalidateQueries({ queryKey: ["gallery"] });
            queryClient.invalidateQueries({ queryKey: ["global-background"] });
        },
        onError: () => toast.error("Failed to delete"),
    });

    // Set global background
    const setBg = useMutation({
        mutationFn: async (galleryId: string) => {
            const res = await fetch("/api/gallery/global-background", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ galleryId }),
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            toast.success("Background set!");
            queryClient.invalidateQueries({ queryKey: ["global-background"] });
        },
        onError: () => toast.error("Failed to set background"),
    });

    // Remove global background
    const deleteBg = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/gallery/global-background", { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            toast.success("Background removed");
            queryClient.invalidateQueries({ queryKey: ["global-background"] });
        },
        onError: () => toast.error("Failed to remove background"),
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
    };

    // Game-adaptive labels
    const pageTitle = GAME.features.hasBR ? "Gallery" : "Bracket Backgrounds";
    const pageDesc = GAME.features.hasBR
        ? "Upload images for standings & match backgrounds."
        : "Upload images shown as bracket page backgrounds. Random one per visit.";
    const labelPlaceholder = GAME.features.hasBR
        ? "Label (e.g. Map, Erangel)"
        : "Label (e.g. Messi, Ronaldo)";

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ImageIcon className="h-6 w-6 text-primary" />
                    {pageTitle}
                </h1>
                <p className="text-sm text-foreground/50 mt-1">
                    {pageDesc}
                </p>
            </div>

            {/* Active Background */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                        Standings Background
                    </h2>
                    {globalBg && (
                        <Button
                            size="sm"
                            color="danger"
                            variant="light"
                            startContent={<Trash2 className="h-3.5 w-3.5" />}
                            onPress={() => deleteBg.mutate()}
                            isLoading={deleteBg.isPending}
                        >
                            Remove
                        </Button>
                    )}
                </div>
                {globalBg ? (
                    <div className="relative w-full rounded-xl overflow-hidden border border-divider">
                        {/* Full preview with overlays */}
                        <div className="relative w-full h-56">
                            <Image
                                src={globalBg.publicUrl}
                                alt={globalBg.name}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                            {/* Overall gradient overlay */}
                            <div
                                className="absolute inset-0"
                                style={{
                                    background: `linear-gradient(to bottom, rgba(0,0,0,${overlayOpacity / 100}), rgba(0,0,0,${(overlayOpacity - 10) / 100}), rgba(0,0,0,${overlayOpacity / 100}))`,
                                }}
                            />
                            {/* Slot preview card */}
                            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-10">
                                <div
                                    className="rounded-xl border border-white/10 p-3 backdrop-blur-sm shadow-2xl"
                                    style={{ backgroundColor: `rgba(0,0,0,${slotOpacity / 100})` }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-xs font-black">#1</div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-zinc-200">Sample Team Name</p>
                                            <p className="text-[10px] text-zinc-400">24 kills · 156 pts</p>
                                        </div>
                                        <span className="text-orange-400 font-bold text-sm">180</span>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute bottom-2 left-2 z-10">
                                <Chip size="sm" color="success" variant="flat" startContent={<CheckCircle2 className="h-3 w-3" />}>
                                    Active
                                </Chip>
                            </div>
                        </div>

                        {/* Opacity Controls */}
                        <div className="bg-foreground/[0.03] border-t border-divider p-4 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <SlidersHorizontal className="h-3.5 w-3.5 text-foreground/40" />
                                <span className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">Overlay Preview</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-foreground/50">Overall Darkness</span>
                                        <span className="text-xs font-mono text-foreground/40">{overlayOpacity}%</span>
                                    </div>
                                    <Slider
                                        size="sm"
                                        step={5}
                                        minValue={0}
                                        maxValue={100}
                                        value={overlayOpacity}
                                        onChange={(v) => setOverlayOpacity(v as number)}
                                        className="max-w-full"
                                        color="warning"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-foreground/50">Slot Card Darkness</span>
                                        <span className="text-xs font-mono text-foreground/40">{slotOpacity}%</span>
                                    </div>
                                    <Slider
                                        size="sm"
                                        step={5}
                                        minValue={0}
                                        maxValue={100}
                                        value={slotOpacity}
                                        onChange={(v) => setSlotOpacity(v as number)}
                                        className="max-w-full"
                                        color="primary"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-foreground/30">
                                Adjust sliders to preview. Currently standings uses ~65% overall and ~50% slot.
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-foreground/40 py-4 text-center">
                        No background set. Select one from the gallery below.
                    </p>
                )}
            </div>

            {/* Upload Section */}
            <div className="rounded-2xl border border-divider bg-foreground/[0.02] p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">Add New</h2>

                {preview ? (
                    <div className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={preview}
                            alt="Preview"
                            className="w-full max-h-64 object-contain rounded-xl bg-black/20"
                        />
                        <button
                            onClick={() => { setPreview(null); setSelectedFile(null); }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="w-full h-40 rounded-xl border-2 border-dashed border-foreground/10 hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-2 text-foreground/30 hover:text-primary/60"
                    >
                        <Upload className="h-8 w-8" />
                        <span className="text-sm font-medium">Click to select image</span>
                        <span className="text-[10px]">PNG, JPG — auto-compressed</span>
                    </button>
                )}

                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                />

                <div className="flex items-center gap-3">
                    <Input
                        size="sm"
                        placeholder={labelPlaceholder}
                        value={label}
                        onValueChange={setLabel}
                        className="flex-1"
                    />
                    <Button
                        color="primary"
                        size="sm"
                        isDisabled={!selectedFile || uploading}
                        isLoading={uploading}
                        onPress={() => uploadMutation.mutate()}
                        startContent={!uploading ? <Plus className="h-4 w-4" /> : undefined}
                    >
                        Upload
                    </Button>
                </div>
            </div>

            {/* Image Grid */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                        All Images
                    </h2>
                    <Chip size="sm" variant="flat" color="primary">
                        {images?.length ?? 0} images
                    </Chip>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : !images?.length ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <ImageIcon className="h-10 w-10 text-foreground/15" />
                        <p className="text-sm text-foreground/40">No images yet. Upload your first one!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {images.map((img: any) => {
                            const isActiveBg = globalBg?.id === img.id;
                            return (
                                <div key={img.id} className={`group relative rounded-xl overflow-hidden border-2 bg-black/10 ${isActiveBg ? "border-primary ring-2 ring-primary/20" : "border-divider"}`}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={img.publicUrl}
                                        alt={img.name || "Background"}
                                        className="w-full h-36 object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />

                                    {/* Active badge */}
                                    {isActiveBg && (
                                        <div className="absolute top-2 left-2">
                                            <Chip size="sm" color="success" variant="flat" startContent={<CheckCircle2 className="h-3 w-3" />}>
                                                Active BG
                                            </Chip>
                                        </div>
                                    )}

                                    {/* Actions — always visible on mobile, hover on desktop */}
                                    <div className="absolute bottom-0 inset-x-0 p-2 flex items-end justify-between sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <span className="text-[11px] text-white font-medium truncate">
                                            {img.name}
                                        </span>
                                        <div className="flex gap-1 shrink-0">
                                            {!isActiveBg && (
                                                <button
                                                    onClick={() => setBg.mutate(img.id)}
                                                    disabled={setBg.isPending}
                                                    className="p-1.5 rounded-lg bg-primary/80 hover:bg-primary text-white transition-colors text-[10px] font-medium px-2"
                                                >
                                                    Set as BG
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (confirm("Delete this image?")) {
                                                        deleteMutation.mutate(img.id);
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors shrink-0"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
