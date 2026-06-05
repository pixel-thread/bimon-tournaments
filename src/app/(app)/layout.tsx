import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OnboardingGuard } from "@/components/common/OnboardingGuard";
import { AuthGateProvider } from "@/components/common/auth-gate-provider";

import { PwaInstallPrompt } from "@/components/common/pwa-install-prompt";
import { LocationGuard } from "@/components/common/location-guard";
import { PhoneGuard } from "@/components/common/phone-guard";
import { AdSenseScript } from "@/components/common/adsense-script";
import { WhatsAppSquadGuard } from "@/components/common/whatsapp-squad-guard";
import { WhatsAppMainGroupGuard } from "@/components/common/WhatsAppMainGroupGuard";


/**
 * Route group: (app)
 * Public-first pages — players, vote, profile, wallet.
 * Shows the main header and bottom mobile nav.
 * Guests can browse freely; auth-gated actions show a login modal.
 */
export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <WhatsAppMainGroupGuard>
        <OnboardingGuard>
            <AuthGateProvider>
                <div className="flex min-h-dvh flex-col">
                    <Header />
                    <main className="flex-1 pt-16 pb-16 lg:pb-0">{children}</main>

                    {/* Compact footer — visible on all app pages (AdSense compliance) */}
                    <footer className="hidden lg:block border-t border-divider px-4 py-4 text-center text-xs text-foreground/30">
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            <span>© {new Date().getFullYear()} Bimon Tournament</span>
                            <span>·</span>
                            <a href="/privacy" className="hover:text-foreground/50 transition-colors">Privacy Policy</a>
                            <span>·</span>
                            <a href="/terms" className="hover:text-foreground/50 transition-colors">Terms of Service</a>
                            <span>·</span>
                            <a href="/contact" className="hover:text-foreground/50 transition-colors">Contact</a>
                        </div>
                    </footer>
                    <MobileNav />

                    <PwaInstallPrompt />
                    <LocationGuard />
                    <PhoneGuard />
                    <AdSenseScript />
                    <WhatsAppSquadGuard />

                </div>
            </AuthGateProvider>
        </OnboardingGuard>
        </WhatsAppMainGroupGuard>
    );
}
