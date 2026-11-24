import { cache } from "react"
import { unstable_cache } from "next/cache"
import {
    filterProjects,
    getProjectBySlugResult,
    getProjectsResult,
    type ProjectFilters,
} from "@/lib/db-service"
import type { Project } from "@/types"

/** How long a catalogue read stays fresh. */
const REVALIDATE_SECONDS = 60

/**
 * Server-only cached reads of the project catalogue.
 *
 * `unstable_cache` persists across deployments and serverless instances, so
 * the Firestore read is not repeated on every request. It is not available in
 * the browser — client components must keep using `getProjectsResult` from
 * `lib/db-service`.
 */

/**
 * The raw, unfiltered project list.
 *
 * The callback *throws* when the Firestore read fails. `unstable_cache` only
 * writes to the cache when the callback resolves, so a failed read is never
 * stored — an empty catalogue can no longer be served for a minute (and
 * then for another minute by the CDN on `/api/projects`).
 *
 * A cache entry that is stale but cannot be revalidated keeps being served:
 * `unstable_cache` swallows the revalidation error and returns the stale
 * value. A short outage therefore shows the last known catalogue instead of
 * an empty page. Only a *cold* cache plus a failed read surfaces an error.
 */
const fetchProjects = unstable_cache(
    async () => {
        const result = await getProjectsResult()

        if (result.error) {
            throw new Error(result.error)
        }

        return result.projects
    },
    ["projects"],
    { revalidate: REVALIDATE_SECONDS }
)

/**
 * A single project, looked up by slug.
 *
 * Throws on a failed read for the same reason as `fetchProjects`: a broken
 * read must not be cached as "this project does not exist".
 */
const fetchProjectBySlug = unstable_cache(
    async (slug: string) => {
        const result = await getProjectBySlugResult(slug)

        if (result.error) {
            throw new Error(result.error)
        }

        return result.project
    },
    ["project-by-slug"],
    { revalidate: REVALIDATE_SECONDS }
)

export interface ProjectsPageData {
    projects: Project[]
    /** Non-null when the read failed — lets callers tell "empty" from "broken". */
    error: string | null
}

/**
 * The project list for a page, with the filters applied in memory.
 *
 * Filtering happens *outside* the cache. The cache key is derived from the
 * function arguments, so caching the filtered list directly would create
 * one cache entry per distinct `?search=` value — an unbounded key space
 * that a single visitor could fill with junk entries.
 */
export async function getProjectsForPage(filters?: ProjectFilters): Promise<ProjectsPageData> {
    try {
        const projects = await fetchProjects()
        return { projects: filterProjects(projects, filters), error: null }
    } catch (error) {
        console.error("Failed to read the project catalogue:", error)
        return {
            projects: [],
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

export interface ProjectPageData {
    project: Project | null
    /** Non-null when the read failed — lets callers tell "missing" from "broken". */
    error: string | null
}

/**
 * Reads a project for its detail page.
 *
 * Wrapped in React `cache()` so `generateMetadata` and the page component
 * share a single read per request instead of querying Firestore twice.
 */
export const getProjectForPage = cache(
    async (slug: string): Promise<ProjectPageData> => {
        try {
            const project = await fetchProjectBySlug(slug)
            return { project, error: null }
        } catch (error) {
            console.error(`Failed to read the project "${slug}":`, error)
            return {
                project: null,
                error: error instanceof Error ? error.message : String(error),
            }
        }
    }
)
