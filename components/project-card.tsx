import Link from "next/link"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Users, ArrowUpRight } from "lucide-react"
import { Project } from "@/types"
import { formatDistanceToNow } from "date-fns"
import { ProjectPreview } from "@/components/project-preview"

function timeAgo(value?: string): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return formatDistanceToNow(date, { addSuffix: true })
}

export function ProjectCard({ project }: { project: Project }) {
    const imageSrc = project.imageUrl || project.images?.[0]
    const createdAt = timeAgo(project.createdAt)
    // Legacy documents can be missing a slug — linking to `/projects/undefined`
    // would render a 404, so the button is disabled instead.
    const hasSlug = Boolean(project.slug)

    return (
        <Card className="group relative flex flex-col overflow-hidden rounded-3xl border-white/10 bg-white/5 backdrop-blur-md transition-all duration-300 hover:border-primary/20 hover:bg-white/10 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1">
            <CardHeader className="p-0">
                <div className="aspect-[16/9] w-full bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                    <ProjectPreview imageSrc={imageSrc} title={project.title} />

                    <Badge
                        variant={project.status === "active" ? "default" : "secondary"}
                        className="absolute top-4 right-4 shadow-sm z-20"
                    >
                        {project.status === "active" ? "Live" : "Coming Soon"}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-xl tracking-tight leading-none group-hover:text-primary transition-colors">
                        {hasSlug ? (
                            <Link href={`/projects/${project.slug}`}>{project.title}</Link>
                        ) : (
                            project.title
                        )}
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {project.shortDescription || project.description}
                </p>
            </CardContent>

            <CardFooter className="p-6 pt-0 flex justify-between items-center text-xs text-muted-foreground">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{createdAt ?? "Recently added"}</span>
                    </div>
                    {project.waitlistCount !== undefined && (
                        <div className="flex items-center gap-1.5 text-primary/80">
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-medium">{project.waitlistCount.toLocaleString()} waiting</span>
                        </div>
                    )}
                </div>

                {hasSlug ? (
                    <Button asChild size="sm" className="bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground hover:bg-secondary/80 hover:text-secondary-foreground rounded-full px-4 h-8 transition-colors">
                        <Link href={`/projects/${project.slug}`}>
                            {project.status === "active" ? "View" : "Join Waitlist"}
                            <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Link>
                    </Button>
                ) : (
                    <Button size="sm" disabled className="bg-muted text-muted-foreground border border-muted/40 rounded-full px-4 h-8 transition-colors">
                        Unavailable
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}
