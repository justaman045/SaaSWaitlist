/**
 * Base URL of the live Nexus deployment.
 *
 * This is the single source of truth for every outbound Nexus link and API
 * call — the marketing site, the product pages, and the products API all
 * resolve from it. A trailing slash is stripped by the helpers below.
 */
const NEXUS_SITE = "https://nexusprods.vercel.app"

/**
 * Base URL of the Nexus website (product pages, marketing links).
 *
 * Override with NEXT_PUBLIC_NEXUS_URL — set it to `http://localhost:3001` to
 * develop against a local Nexus instance.
 */
export function getNexusSiteUrl(): string {
    return (process.env.NEXT_PUBLIC_NEXUS_URL || NEXUS_SITE).replace(/\/$/, "")
}

/**
 * Absolute URL of the Nexus products API.
 *
 * **Server-side only.** The browser must not call this URL directly: Nexus
 * answers cross-origin requests with `Access-Control-Allow-Origin` only for
 * a fixed list of origins, and a browser that is not on that list sees an
 * opaque CORS error instead of the real HTTP status. The deployed
 * SaaSWaitlist origin was not on that list, so every Nexus call made from
 * the admin dashboard failed with "blocked by CORS policy".
 *
 * The browser therefore goes through this app's own route handler
 * (`/api/nexus/...`), which forwards the request server-side. Server-to-
 * server calls are not subject to CORS, so the two apps stay independent of
 * each other's deployment configuration.
 */
export function getNexusUpstreamApiUrl(): string {
    return (
        process.env.NEXT_PUBLIC_NEXUS_API_URL || `${getNexusSiteUrl()}/api/products`
    ).replace(/\/$/, "")
}

/**
 * Same-origin path the browser uses to reach the Nexus products API.
 *
 * Always relative, so the request never leaves this app's origin and never
 * needs a CORS preflight.
 */
export function getNexusApiUrl(): string {
    return "/api/nexus/products"
}

/** Public product page on the Nexus website for a mirrored product. */
export function getNexusProductUrl(nexusProductId: string): string {
    return `${getNexusSiteUrl()}/products/${encodeURIComponent(nexusProductId)}`
}
