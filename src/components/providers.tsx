"use client";

import { HeroUIProvider } from "@heroui/react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useState, Suspense } from "react";
import { PostHogProvider } from "@/components/providers/posthog-provider";

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        retry: (failureCount, error) => {
                            // Don't retry on 4xx errors
                            if (error instanceof Error && error.message.includes("4")) {
                                return false;
                            }
                            return failureCount < 3;
                        },
                        refetchOnWindowFocus: false,
                    },
                    mutations: {
                        retry: false,
                    },
                },
            })
    );

    return (
        <SessionProvider>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <HeroUIProvider>
                        <Suspense fallback={null}>
                            <PostHogProvider>
                                {children}
                            </PostHogProvider>
                        </Suspense>
                        <Toaster
                            position="top-center"
                            richColors
                            closeButton
                            theme="dark"
                            duration={2500}
                            toastOptions={{
                                style: { zIndex: 9999 },
                            }}
                            style={{ zIndex: 9999 }}
                        />
                    </HeroUIProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </SessionProvider>
    );
}
