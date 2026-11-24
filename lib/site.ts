const FALLBACK_SITE_URL = "https://projektnotify.vercel.app"

/**
 * Canonical base URL for absolute links (sitemap, robots, metadata).
 * Set NEXT_PUBLIC_SITE_URL in production; Vercel previews fall back to
 * VERCEL_URL, and local development falls back to the deployed site.
 */
export function getSiteUrl(): string {
    const configured = process.env.NEXT_PUBLIC_SITE_URL
    if (configured) return configured.replace(/\/$/, "")

    const vercelUrl = process.env.VERCEL_URL
    if (vercelUrl) return `https://${vercelUrl}`

    return FALLBACK_SITE_URL
}
