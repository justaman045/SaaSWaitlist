import { AlertTriangle } from "lucide-react"

/**
 * Shown in place of the project grid when the catalogue could not be read.
 *
 * The site must never present a failed read as an empty catalogue: visitors
 * would conclude that no projects exist. The notice says what happened and
 * offers a way forward.
 */
export function CatalogueUnavailable({ detail }: { detail?: string | null }) {
    return (
        <div
            role="status"
            className="flex flex-col items-center gap-3 rounded-3xl border border-amber-500/30 bg-amber-500/10 px-6 py-12 text-center"
        >
            <AlertTriangle className="h-8 w-8 text-amber-400" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-amber-100">
                The project catalogue is temporarily unavailable
            </h2>
            <p className="max-w-md text-sm text-amber-200/80">
                We could not load the project list just now. Please try again in a moment — the
                page is refreshed every minute.
            </p>
            {detail ? (
                <p className="max-w-md break-words text-xs text-amber-200/50">{detail}</p>
            ) : null}
        </div>
    )
}
