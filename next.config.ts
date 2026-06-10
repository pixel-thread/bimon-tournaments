import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
  // Baileys uses the `ws` library which has native C++ addons for
  // WebSocket frame masking. Webpack breaks these during bundling,
  // so we tell Next.js to use them directly from node_modules.
  serverExternalPackages: ["@whiskeysockets/baileys", "ws"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  env: {
    NEXT_PUBLIC_BUILD_DATE: new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }),
  },
  async redirects() {
    return [
      // V1 → V2 route redirects (so old bookmarks/links still work)
      { source: "/tournament/players", destination: "/players", permanent: false },
      { source: "/tournament/vote", destination: "/vote", permanent: false },
      { source: "/tournament/winners", destination: "/winners", permanent: false },
      { source: "/tournament/rules", destination: "/rules", permanent: false },
      { source: "/tournament/recent-matches", destination: "/recent-matches", permanent: false },
      { source: "/tournament", destination: "/vote", permanent: false },
      { source: "/auth", destination: "/sign-in", permanent: false },
      { source: "/auth/:path*", destination: "/sign-in/:path*", permanent: false },
      { source: "/admin", destination: "/dashboard", permanent: false },
      { source: "/admin/admins", destination: "/dashboard/admins", permanent: false },
      { source: "/admin/players", destination: "/dashboard/players", permanent: false },
      { source: "/admin/polls", destination: "/dashboard/polls", permanent: false },
      { source: "/admin/teams", destination: "/dashboard/teams", permanent: false },
      { source: "/admin/income", destination: "/dashboard/income", permanent: false },
      { source: "/admin/rules", destination: "/dashboard/rules", permanent: false },
      { source: "/admin/settings", destination: "/settings", permanent: false },
      { source: "/admin/royal-pass", destination: "/dashboard/royal-pass", permanent: false },
      { source: "/admin/lucky-voters", destination: "/dashboard/lucky-voters", permanent: false },
      { source: "/admin/insights", destination: "/dashboard/player-insights", permanent: false },
      { source: "/admin/:path*", destination: "/dashboard/:path*", permanent: false },
    ];
  },
};

export default withSerwist(nextConfig);
