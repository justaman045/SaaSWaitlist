import { getProjectsForPage } from "@/lib/db-service.server"
import { ProjectFilters } from "@/lib/db-service"

/**
 * Route handlers are not cached by the Next.js data cache — the
 * `Cache-Control` header below is what lets CDNs cache the response. The
 * underlying Firestore read is cached server-side by `getProjectsForPage`.
 */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}

/** The longest filter value that is still applied to the response. */
const MAX_FILTER_LENGTH = 120

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
    })
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    const filters: ProjectFilters = {}

    // Filter values are trimmed and capped. They are applied in memory
    // (outside the cache), so this is about keeping the response sane — a
    // multi-kilobyte search term is never a real query.
    const readFilter = (name: string) => {
        const value = searchParams.get(name)?.trim()
        return value ? value.slice(0, MAX_FILTER_LENGTH) : undefined
    }

    const search = readFilter("search")
    const category = readFilter("category")
    const tag = readFilter("tag")

    if (search) filters.search = search
    if (category) filters.category = category
    if (tag) filters.tag = tag

    const { projects, error } = await getProjectsForPage(filters)

    if (error) {
        // The catalogue could not be read. A `200` with an empty list would
        // be indistinguishable from "there are no projects", and the CDN
        // would cache that empty list for another minute.
        return Response.json(
            {
                error: "The project catalogue is temporarily unavailable.",
                projects: [],
                count: 0,
            },
            {
                status: 503,
                headers: {
                    ...CORS_HEADERS,
                    "Cache-Control": "no-store",
                    "Retry-After": "60",
                },
            }
        )
    }

    return Response.json(
        {
            projects,
            count: projects.length,
        },
        {
            headers: {
                ...CORS_HEADERS,
                "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
            },
        }
    )
}
