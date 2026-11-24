import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
    const base = getSiteUrl()

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                // The admin dashboard and the Nexus proxy are not for
                // crawlers — the proxy is an internal relay for the
                // signed-in admin.
                disallow: ["/admin", "/api/nexus"],
            },
        ],
        sitemap: `${base}/sitemap.xml`,
        host: base,
    }
}
