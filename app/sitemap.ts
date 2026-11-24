import type { MetadataRoute } from "next"
import { getProjectsForPage } from "@/lib/db-service.server"
import { getSiteUrl } from "@/lib/site"

export const revalidate = 3600

/**
 * The build phase constant.
 *
 * `next/constants` cannot be imported safely here (it is a CommonJS
 * re-export), so the literal is used instead. Next sets `NEXT_PHASE` while
 * it runs `next build`.
 */
const PRODUCTION_BUILD_PHASE = "phase-production-build"

function parseDate(value?: string): Date {
    if (!value) return new Date()
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date() : date
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = getSiteUrl()

    const staticEntries: MetadataRoute.Sitemap = [
        {
            url: base,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1,
        },
        {
            url: `${base}/projects`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
    ]

    const { projects, error } = await getProjectsForPage()

    if (error) {
        if (process.env.NEXT_PHASE === PRODUCTION_BUILD_PHASE) {
            // A build must not fail because Firestore was unreachable for a
            // moment. The static entries are still correct, and the sitemap
            // is regenerated within the hour.
            console.error("Sitemap generated without projects — the catalogue read failed:", error)
            return staticEntries
        }

        // At runtime the error is re-thrown on purpose: a sitemap without
        // any project URLs can make crawlers drop those pages, while a
        // failed regeneration keeps the previous sitemap in place.
        throw new Error(`Could not read the project catalogue for the sitemap: ${error}`)
    }

    return [
        ...staticEntries,
        // Every project with a slug is advertised. Coming-soon projects are
        // linked from the directory too — their detail page carries the
        // waitlist signup form — so leaving them out would keep the pages
        // that sign-ups depend on out of the search index.
        ...projects
            .filter((project) => project.slug)
            .map((project) => ({
                url: `${base}/projects/${encodeURIComponent(project.slug)}`,
                lastModified: parseDate(project.updatedAt ?? project.createdAt),
                changeFrequency: "weekly" as const,
                priority: project.status === "active" ? 0.7 : 0.6,
            })),
    ]
}
