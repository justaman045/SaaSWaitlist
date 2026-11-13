import { getProjects } from "@/lib/db-service"
import { ProjectFilters } from "@/lib/db-service"

export const revalidate = 60

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    const filters: ProjectFilters = {}
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const tag = searchParams.get("tag")

    if (search) filters.search = search
    if (category) filters.category = category
    if (tag) filters.tag = tag

    const projects = await getProjects(filters)

    return Response.json(
        {
            projects,
            count: projects.length,
        },
        {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        }
    )
}
