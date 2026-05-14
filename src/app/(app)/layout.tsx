import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OnboardingGuard } from "@/components/common/OnboardingGuard";
import { AuthGateProvider } from "@/components/common/auth-gate-provider";

import { ReferralPromoModal } from "@/components/common/referral-promo-modal";
import { PwaInstallPrompt } from "@/components/common/pwa-install-prompt";
import { LocationGuard } from "@/components/common/location-guard";
import { PhoneGuard } from "@/components/common/phone-guard";
import { AdSenseScript } from "@/components/common/adsense-script";
import { WhatsAppSquadGuard } from "@/components/common/whatsapp-squad-guard";


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
        <OnboardingGuard>
            <AuthGateProvider>
                <div className="flex min-h-dvh flex-col">
                    <Header />
                    <main className="flex-1 pt-16 pb-16 lg:pb-0">{children}</main>
                    <MobileNav />

                    <ReferralPromoModal />
                    <PwaInstallPrompt />
                    <LocationGuard />
                    <PhoneGuard />
                    <AdSenseScript />
                    <WhatsAppSquadGuard />

                </div>
            </AuthGateProvider>
        </OnboardingGuard>
    );
}
