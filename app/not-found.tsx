import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
    return (
        <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-6 py-24 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">404</p>
            <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
            <p className="max-w-md text-sm text-muted-foreground">
                The page you are looking for does not exist or has been removed.
            </p>
            <Button asChild className="rounded-full px-6">
                <Link href="/projects">Browse projects</Link>
            </Button>
        </div>
    )
}
