"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { getProjectByIdResult } from "@/lib/db-service"
import ProjectForm from "@/components/project-form"
import { Button } from "@/components/ui/button"
import type { Project } from "@/types"

export default function EditProjectPage() {
    const params = useParams<{ id: string }>()
    const id = params.id
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        const request = id ? getProjectByIdResult(id) : Promise.resolve({ project: null, error: null })

        request
            .then((result) => {
                if (!active) return
                setProject(result.project)
                setError(result.error)
            })
            .catch((err) => {
                console.error("Failed to load project:", err)
                if (!active) return
                setError(err instanceof Error ? err.message : "Failed to load project")
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [id])

    if (loading) {
        return (
            <div
                className="flex h-64 items-center justify-center"
                role="status"
                aria-live="polite"
            >
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading the project…</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-muted-foreground">
                    Could not load this project: {error}
                </p>
                <Button asChild variant="outline">
                    <Link href="/admin">Back to dashboard</Link>
                </Button>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
                <p className="text-muted-foreground">Project not found.</p>
                <Button asChild variant="outline">
                    <Link href="/admin">Back to dashboard</Link>
                </Button>
            </div>
        )
    }

    return <ProjectForm initialData={project} />
}
