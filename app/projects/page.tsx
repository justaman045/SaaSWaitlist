import { ProjectCard } from "@/components/project-card"
import { CatalogueUnavailable } from "@/components/catalogue-unavailable"
import { getProjectsForPage } from "@/lib/db-service.server"

export const revalidate = 60; // Revalidate every minute

export default async function ProjectsPage() {
  const { projects: allProjects, error } = await getProjectsForPage()

  return (
    <div className="flex flex-col pb-10">
      <section className="container py-12 md:py-24">
        <div className="flex flex-col gap-6 md:gap-8">
          <div className="flex flex-col gap-4 md:items-center md:text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">All Projects</h1>
            <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Discover all the innovative SaaS tools launching soon.
            </p>
          </div>

          {error ? (
            <CatalogueUnavailable detail={error} />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {allProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>

              {allProjects.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  No projects available yet.
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
