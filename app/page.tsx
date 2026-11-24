import { Hero } from "@/components/hero"
import { FeaturesSection } from "@/components/features-section"
import { FAQSection } from "@/components/faq-section"
import { TestimonialsSection } from "@/components/testimonials-section"
import { CTASection } from "@/components/cta-section"
import { ProjectCard } from "@/components/project-card"
import { CatalogueUnavailable } from "@/components/catalogue-unavailable"
import { getProjectsForPage } from "@/lib/db-service.server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export const revalidate = 60; // Revalidate every minute

export default async function Home() {
  const { projects: allProjects, error } = await getProjectsForPage()
  const featuredProjects = allProjects.slice(0, 6)

  return (
    <div className="flex flex-col pb-10">
      <Hero />

      <section id="featured-projects" className="container py-12 md:py-24">
        <div className="flex flex-col gap-6 md:gap-8">
          <div className="flex flex-col gap-4 md:items-center md:text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Featured Projects</h2>
            <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Check out the latest and most popular SaaS tools launching soon.
            </p>
          </div>

          {error ? (
            <CatalogueUnavailable detail={error} />
          ) : featuredProjects.length === 0 ? (
            // The catalogue is empty — not broken. Say so instead of
            // leaving a bare heading over an empty grid. The wording
            // matches `/projects` so the two pages agree.
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center text-muted-foreground">
              No projects available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              {featuredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          <div className="flex justify-center mt-10">
            <Button asChild variant="outline" size="lg" className="h-12 px-8 rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all">
              <Link href="/projects">
                View All Projects
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <FeaturesSection />
      <TestimonialsSection />
      <CTASection />
      <FAQSection />
    </div>
  )
}
