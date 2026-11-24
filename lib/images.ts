/**
 * Remote hosts that `next/image` is allowed to optimise.
 *
 * Both `next.config.ts` (for the `remotePatterns` allowlist) and the
 * components that decide between `next/image` and a plain `<img>` read from
 * here, so the two can never drift apart.
 */
export const ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com", "images.unsplash.com"] as const

/**
 * True when the source can be passed to `next/image`. Admin-supplied URLs
 * point at arbitrary hosts, which `next/image` refuses to optimise, so those
 * fall back to a plain `<img>`.
 *
 * The protocol is checked too: `next.config.ts` only allows `https` for the
 * configured hosts, so an `http://` URL on an allowed host would make
 * `next/image` throw instead of rendering.
 */
export function isOptimizableImageHost(src: string): boolean {
    try {
        const url = new URL(src)
        if (url.protocol !== "https:") return false
        return (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(url.hostname)
    } catch {
        return false
    }
}
