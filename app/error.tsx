"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function Error({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    /**
     * Next 16 `retry()` re-fetches and re-renders the failed segment.
     * `reset()` only clears the error state, so it cannot recover from a
     * Server Component (Firestore) failure — the page would immediately
     * render the same error again.
     */
    retry: () => void
}) {
    useEffect(() => {
        console.error("Unhandled application error:", error)
    }, [error])

    return (
        <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-6 py-24 text-center">
            <div className="rounded-full border border-red-500/20 bg-red-500/10 p-4">
                <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
                <p className="max-w-md text-sm text-muted-foreground">
                    The page failed to load. Try again, or head back to the project directory.
                </p>
                {error.digest && (
                    <p className="font-mono text-xs text-muted-foreground/70">Error ID: {error.digest}</p>
                )}
            </div>
            <div className="flex items-center gap-3">
                <Button onClick={() => retry()} className="rounded-full px-6">
                    Try again
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6">
                    <Link href="/projects">Browse projects</Link>
                </Button>
            </div>
        </div>
    )
}
