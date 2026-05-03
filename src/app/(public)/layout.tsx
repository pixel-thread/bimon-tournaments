import { Header } from "@/components/layout/header";
import { AdSenseScript } from "@/components/common/adsense-script";

/**
 * Route group: (public)
 * Unauthenticated pages — home, about, FAQ, recent matches.
 * Uses the same shared Header as app pages for consistency.
 * AdSense is loaded here because these pages have substantial content.
 */
export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <Header />
            <AdSenseScript />
            {children}
        </>
    );
}

