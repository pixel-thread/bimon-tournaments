"use client";

import { useState, useCallback, useEffect, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
} from "@heroui/react";
import { LogIn, Eye, Gamepad2 } from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { GAME } from "@/lib/game-config";

interface AuthGateContextValue {
    /** Returns true if signed in. If not, shows login modal and returns false. */
    requireAuth: (action?: () => void) => boolean;
    /** Whether user is signed in */
    isSignedIn: boolean;
    /** Whether auth status is still loading */
    isLoading: boolean;
}

const AuthGateContext = createContext<AuthGateContextValue>({
    requireAuth: () => false,
    isSignedIn: false,
    isLoading: true,
});

export function useAuthGate() {
    return useContext(AuthGateContext);
}

/**
 * Provider for auth-gated actions.
 * - Shows a skippable welcome modal on first visit for guests
 * - Any component can call `requireAuth(() => doSomething())`
 *   → signed in: runs action | guest: shows login modal
 */
export function AuthGateProvider({ children }: { children: React.ReactNode }) {
    const { isSignedIn, isLoading } = useAuthUser();
    const [showActionModal, setShowActionModal] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);

    const pathname = usePathname();

    // Show welcome modal once for guests (persisted via sessionStorage)
    // Skip on /invite/ and /join/ pages — they have their own join flow
    useEffect(() => {
        if (isLoading) return;
        if (!isSignedIn && !sessionStorage.getItem("bimon-welcomed") && !pathname.startsWith("/invite/") && !pathname.startsWith("/join/")) {
            setShowWelcome(true);
            sessionStorage.setItem("bimon-welcomed", "1");
        }
    }, [isSignedIn, isLoading, pathname]);

    const requireAuth = useCallback(
        (action?: () => void) => {
            if (isSignedIn) {
                action?.();
                return true;
            }
            setShowActionModal(true);
            return false;
        },
        [isSignedIn]
    );

    function handleLogin() {
        window.location.href = "/sign-in";
    }

    return (
        <AuthGateContext.Provider value={{ requireAuth, isSignedIn: !!isSignedIn, isLoading: !!isLoading }}>
            {children}

            {/* Welcome modal — first visit for guests */}
            <Modal
                isOpen={showWelcome}
                onClose={() => setShowWelcome(false)}
                size="sm"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <Gamepad2 className="h-5 w-5 game-text" />
                        {GAME.name} Tournament!
                    </ModalHeader>
                    <ModalBody className="space-y-2">
                        <p className="text-sm text-foreground/70">
                            {GAME.features.hasBR
                                ? <>The platform where <strong>pros and casuals</strong> team up for fair, balanced {GAME.name} tournaments.</>
                                : <>The platform for <strong>fair, skill-based</strong> {GAME.name} tournaments where every player gets a chance to compete.</>
                            }
                        </p>
                        <p className="text-sm text-foreground/70">
                            Sign in to participate or browse around to see how it works!
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            size="sm"
                            startContent={<Eye className="h-4 w-4" />}
                            onPress={() => setShowWelcome(false)}
                        >
                            Skip
                        </Button>
                        <Button
                            color="primary"
                            size="sm"
                            startContent={<LogIn className="h-4 w-4" />}
                            onPress={handleLogin}
                        >
                            Sign In
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Action-gated modal — when guest tries auth action */}
            <Modal
                isOpen={showActionModal}
                onClose={() => setShowActionModal(false)}
                size="sm"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-2">
                        <LogIn className="h-5 w-5 game-text" />
                        Sign In Required
                    </ModalHeader>
                    <ModalBody>
                        <p className="text-sm text-foreground/70">
                            Sign in to participate in {GAME.name} tournaments, vote on maps, manage your profile, and track your stats.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            size="sm"
                            startContent={<Eye className="h-4 w-4" />}
                            onPress={() => setShowActionModal(false)}
                        >
                            Skip
                        </Button>
                        <Button
                            color="primary"
                            size="sm"
                            startContent={<LogIn className="h-4 w-4" />}
                            onPress={handleLogin}
                        >
                            Sign In
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </AuthGateContext.Provider>
    );
}
