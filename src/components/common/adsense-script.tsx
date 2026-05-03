import Script from "next/script";

/**
 * AdSense script component — only include this on pages that have
 * substantial publisher content. This prevents AdSense rejection for
 * "ads on screens without publisher-content".
 *
 * Usage: Add <AdSenseScript /> to layouts or pages with real content.
 */
export function AdSenseScript() {
    return (
        <Script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2651043074081875"
            crossOrigin="anonymous"
            strategy="lazyOnload"
        />
    );
}
