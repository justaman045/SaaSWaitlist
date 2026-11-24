import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"
import { getProjectsForPage } from "@/lib/db-service.server"
import { RequestForm } from "@/components/request-form"

export const metadata: Metadata = {
    title: "Submit a Project or Request a Tool | SaaS Waitlist",
    description:
        "Submit your project or tell us which tool or feature you want next. We read every submission and use it to decide what to build.",
}

/**
 * Public request form.
 *
 * `searchParams` is a Promise in Next 16 — awaiting it here (rather than
 * using `useSearchParams` in the client) keeps the page free of the
 * Suspense boundary that hook would require.
 */
export default async function RequestPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const requestedProject = typeof params.project === "string" ? params.project : undefined

    const { projects, error } = await getProjectsForPage()

    // The Firestore rules require a real project id, so a slug from the URL
    // is resolved before it is handed to the form.
    //
    // Every project is considered — including `coming_soon` ones. A visitor
    // who follows "request something like this" from a coming-soon project
    // would otherwise have their choice silently dropped, because the
    // project is not in the dropdown.
    const selectedProject = requestedProject
        ? projects.find(
              (project) => project.slug === requestedProject || project.id === requestedProject
          )
        : undefined

    // The dropdown lists the live projects, plus the selected project when
    // it is not live — otherwise the <select> would hold a value that has
    // no matching option and the browser would silently reset it.
    const options = projects
        .filter(
            (project) =>
                project.status === "active" || project.id === selectedProject?.id
        )
        .map((project) => ({ id: project.id, title: project.title }))

    return (
        <div className="container relative py-16 sm:py-24">
            <div className="mx-auto max-w-2xl">
                <div className="mb-10 text-center">
                    <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
                        Shape the roadmap
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Submit a project or request a tool
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Building something? Submit it here. Looking for a tool? Tell us what you
                        would love to see next. Every submission is read, and the most wanted ones
                        become projects on this site first.
                    </p>
                </div>

                {error && (
                    <div
                        role="status"
                        className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
                    >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                            The project list could not be loaded, so a request cannot be linked to
                            an existing tool. Your request will still be recorded — please try
                            again in a moment to link it.
                        </span>
                    </div>
                )}

                <RequestForm
                    projects={options}
                    defaultProjectId={selectedProject?.id}
                />
            </div>
        </div>
    )
}
