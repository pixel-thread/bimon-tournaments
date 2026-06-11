import type { Metadata, Viewport } from "next";
import { Rajdhani } from "next/font/google";
import { Providers } from "@/components/providers";

import { AutoUpdater } from "@/components/common/auto-updater";
import { ColorThemeProvider } from "@/components/common/color-theme-provider";
import { LocaleProvider } from "@/components/common/locale-provider";
import { WhatsAppTournamentGuard } from "@/components/common/whatsapp-tournament-guard";

import { GAME } from "@/lib/game-config";

const GAME_ID = process.env.NEXT_PUBLIC_GAME_MODE || "bgmi";

import "./globals.css";

const rajdhani = Rajdhani({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-rajdhani",
});


const ICON_DIRS: Record<string, string> = { freefire: "freefire", pes: "pes", mlbb: "mlbb" };
const ICON_DIR = `/icons/${ICON_DIRS[GAME_ID] ?? "bgmi"}`;

export const metadata: Metadata = {
  applicationName: GAME.name,
  title: {
    default: `${GAME.name} — Bimon Tournament`,
    template: `%s | ${GAME.name}`,
  },
  description:
    `Join ${GAME.gameName} tournaments, win ${GAME.currencyPlural}, and compete with the best players.`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: GAME.name,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: `${ICON_DIR}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${ICON_DIR}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
    ],
    shortcut: `${ICON_DIR}/favicon.ico`,
    apple: `${ICON_DIR}/apple-touch-icon.png`,
  },
  openGraph: {
    type: "website",
    siteName: GAME.name,
    title: {
      default: `${GAME.name} — Bimon Tournament`,
      template: `%s | ${GAME.name}`,
    },
    description:
      `Join ${GAME.gameName} tournaments, win ${GAME.currencyPlural}, and compete with the best players.`,
    images: [
      {
        url: `${ICON_DIR}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${GAME.name} — Bimon Tournament`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: {
      default: `${GAME.name} — Bimon Tournament`,
      template: `%s | ${GAME.name}`,
    },
    description:
      `Join ${GAME.gameName} tournaments, win ${GAME.currencyPlural}, and compete with the best players.`,
    images: [`${ICON_DIR}/og-image.png`],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* JSON-LD Structured Data — helps Google classify the site */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Bimon Tournament",
              url: "https://bgmi.pixel-thread.in",
              description: `Community-driven ${GAME.gameName} esports platform with fair team balancing, UC prize pools, and competitive leaderboards.`,
              foundingDate: "2024",
              sameAs: [],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Bimon Tournament",
              url: "https://bgmi.pixel-thread.in",
              description: `Join ${GAME.gameName} tournaments, win ${GAME.currencyPlural}, and compete with the best players.`,
              publisher: {
                "@type": "Organization",
                name: "Pixel Thread",
              },
            }),
          }}
        />
        {/* Google AdSense — native script tag so it's SSR'd for Google's crawler verification */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2651043074081875"
          crossOrigin="anonymous"
        />
      </head>

      <body className={`${rajdhani.variable} font-sans antialiased`}>
        <Providers>
          <ColorThemeProvider>
            <LocaleProvider>

              <AutoUpdater />
              <WhatsAppTournamentGuard />

              {children}
            </LocaleProvider>
          </ColorThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
