"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Loader2, Trash2, X } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deleteRequest, updateRequestStatus } from "@/lib/admin-service"
import { useAdminProjects, useAdminRequests } from "@/components/admin/use-admin-data"
import type { RequestStatus, ToolRequest } from "@/types"

const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
    { value: "new", label: "New" },
    { value: "reviewing", label: "Reviewing" },
    { value: "accepted", label: "Accepted" },
    { value: "rejected", label: "Rejected" },
]

const STATUS_STYLES: Record<RequestStatus, string> = {
    new: "bg-blue-500/20 text-blue-400 border-blue-500/20",
    reviewing: "bg-amber-500/20 text-amber-400 border-amber-500/20",
    accepted: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/20 text-red-400 border-red-500/20",
}

/**
 * Turns a failed mutation into a message worth reading.
 *
 * The Firebase error code is kept because it is the difference between
 * "your account is not an admin" and "the network is down".
 */
function describeError(
    result: { error: string | null; code: string | null },
    fallback: string
): string {
    const raw = result.error?.trim()
    const message = raw
        ? raw.replace(/^FirebaseError:\s*/, "")
        : fallback

    return result.code ? `${message} (${result.code})` : message
}

export default function AdminRequestsPage() {
    const { data: requests, loading, error, reload } = useAdminRequests()
    const { data: projects } = useAdminProjects()

    const [status, setStatus] = useState<"all" | RequestStatus>("all")
    const [busyId, setBusyId] = useState<string | null>(null)

    /**
     * The request whose delete button is armed.
     *
     * Deleting is a two-step action: the first click arms it and the second
     * one deletes. A native `window.confirm()` was used before, but a
     * suppressed or dismissed browser dialog fails silently — the button
     * then looks completely broken.
     */
    const [confirmingId, setConfirmingId] = useState<string | null>(null)

    /** Requests removed from the list optimistically, pending the write. */
    const [removedIds, setRemovedIds] = useState<string[]>([])

    /**
     * Statuses applied optimistically, keyed by request id.
     *
     * The dropdown is a controlled element: without an optimistic value the
     * browser snaps straight back to the stored status when the admin picks
     * a new one, and the change only becomes visible after the write and the
     * reload have finished. The override is dropped as soon as the write
     * settles — on success the reloaded document is the truth, on failure
     * the stored status is shown again.
     */
    const [statusOverrides, setStatusOverrides] = useState<Record<string, RequestStatus>>({})

    /** Per-request error text, rendered inline on the card. */
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

    const projectNames = useMemo(
        () => new Map(projects.map((project) => [project.id, project.title])),
        [projects]
    )

    /** The status that is currently shown for a request. */
    const effectiveStatus = (request: ToolRequest): RequestStatus =>
        statusOverrides[request.id] ?? request.status

    const visible = useMemo(
        () =>
            requests.filter(
                (request) =>
                    !removedIds.includes(request.id) &&
                    (status === "all" || request.status === status)
            ),
        [requests, status, removedIds]
    )

    const setRowError = (id: string, message: string | null) => {
        setRowErrors((current) => {
            if (message === null) {
                if (!(id in current)) return current
                const next = { ...current }
                delete next[id]
                return next
            }
            return { ...current, [id]: message }
        })
    }

    const handleStatusChange = async (request: ToolRequest, next: RequestStatus) => {
        const previous = effectiveStatus(request)

        // Nothing to do when the admin picks the status that is already set.
        if (previous === next) return

        setBusyId(request.id)
        setRowError(request.id, null)
        // Show the new status straight away; the write settles it below.
        setStatusOverrides((current) => ({ ...current, [request.id]: next }))

        try {
            const result = await updateRequestStatus(request.id, next)
            if (!result.ok) {
                const message = describeError(
                    result,
                    "Could not update the request status."
                )
                console.error("Update request status failed:", result.code, result.error)
                // The stored status is shown again — the change never landed.
                setStatusOverrides((current) => {
                    const nextOverrides = { ...current }
                    delete nextOverrides[request.id]
                    return nextOverrides
                })
                setRowError(request.id, message)
                toast.error(message)
                return
            }
            toast.success("Status updated")
            await reload()
        } catch (error) {
            console.error("Update request status threw:", error)
            setStatusOverrides((current) => {
                const nextOverrides = { ...current }
                delete nextOverrides[request.id]
                return nextOverrides
            })
            setRowError(
                request.id,
                "Could not update the request status. See the browser console."
            )
            toast.error("Could not update the request status.")
        } finally {
            setBusyId(null)
        }
    }

    const handleDelete = async (request: ToolRequest) => {
        // First click only arms the delete — nothing is written yet.
        if (confirmingId !== request.id) {
            setConfirmingId(request.id)
            setRowError(request.id, null)
            return
        }

        setConfirmingId(null)
        setBusyId(request.id)

        // Optimistic removal: the card disappears straight away and comes
        // back if Firestore refuses the delete.
        setRemovedIds((current) => [...current, request.id])

        try {
            const result = await deleteRequest(request.id)

            if (!result.ok) {
                const message = describeError(result, "Could not delete the request.")
                console.error("Delete request failed:", result.code, result.error)

                setRemovedIds((current) => current.filter((id) => id !== request.id))
                setRowError(request.id, message)
                toast.error(message)
                return
            }

            toast.success("Request deleted")
            await reload()
        } catch (error) {
            // A thrown error must never leave the card silently removed.
            console.error("Delete request threw:", error)
            setRemovedIds((current) => current.filter((id) => id !== request.id))
            setRowError(request.id, "Could not delete the request. See the browser console.")
            toast.error("Could not delete the request.")
        } finally {
            setBusyId(null)
        }
    }

    const counts = useMemo(() => {
        const result: Record<RequestStatus, number> = {
            new: 0,
            reviewing: 0,
            accepted: 0,
            rejected: 0,
        }
        // The optimistic statuses are counted too, so the filter badges stay
        // in step with what the admin sees on the cards.
        for (const request of requests) result[effectiveStatus(request)] += 1
        return result
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requests, statusOverrides])

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Requests</h1>
                    <p className="text-sm text-muted-foreground">
                        {visible.length} of {requests.length} request
                        {requests.length === 1 ? "" : "s"}
                    </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={() => setStatus("all")}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            status === "all"
                                ? "bg-white/10 text-white"
                                : "text-muted-foreground hover:text-white"
                        }`}
                    >
                        All ({requests.length})
                    </button>
                    {STATUS_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setStatus(option.value)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                status === option.value
                                    ? "bg-white/10 text-white"
                                    : "text-muted-foreground hover:text-white"
                            }`}
                        >
                            {option.label} ({counts[option.value]})
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Could not load requests: {error}. The requests collection is admin-only —
                        make sure your account is allowlisted and verified.
                    </span>
                </div>
            )}

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : visible.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-muted-foreground">
                    {requests.length === 0
                        ? "No requests yet. Share the request page to start collecting them."
                        : "No requests match this filter."}
                </div>
            ) : (
                <ul className="grid gap-4">
                    {visible.map((request) => (
                        <li
                            key={request.id}
                            className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-xl"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-semibold text-white">{request.title}</h2>
                                        <Badge
                                            variant="outline"
                                            className={STATUS_STYLES[effectiveStatus(request)]}
                                        >
                                            {STATUS_OPTIONS.find(
                                                (option) =>
                                                    option.value === effectiveStatus(request)
                                            )?.label ?? effectiveStatus(request)}
                                        </Badge>
                                    </div>

                                    {request.description && (
                                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                                            {request.description}
                                        </p>
                                    )}

                                    <p className="mt-3 text-xs text-muted-foreground/70">
                                        {request.email}
                                        {request.projectId && (
                                            <>
                                                {" · related to "}
                                                <span className="text-primary">
                                                    {projectNames.get(request.projectId) ??
                                                        "Unknown project"}
                                                </span>
                                            </>
                                        )}
                                        {request.createdAt && (
                                            <> · {format(new Date(request.createdAt), "PPpp")}</>
                                        )}
                                    </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <select
                                        value={effectiveStatus(request)}
                                        disabled={busyId === request.id}
                                        onChange={(event) =>
                                            void handleStatusChange(
                                                request,
                                                event.target.value as RequestStatus
                                            )
                                        }
                                        aria-label={`Status for ${request.title}`}
                                        className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                                    >
                                        {STATUS_OPTIONS.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                                className="bg-slate-900"
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>

                                    {confirmingId === request.id ? (
                                        <div className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-2 py-1">
                                            <span className="text-xs font-medium text-red-200">
                                                Delete?
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void handleDelete(request)}
                                                disabled={busyId === request.id}
                                                aria-label={`Confirm deleting ${request.title}`}
                                                className="h-7 px-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200"
                                            >
                                                Yes
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setConfirmingId(null)}
                                                className="h-7 px-2 text-xs text-muted-foreground hover:text-white"
                                                aria-label={`Cancel deleting ${request.title}`}
                                            >
                                                No
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={busyId === request.id}
                                            onClick={() => void handleDelete(request)}
                                            aria-label={`Delete request ${request.title}`}
                                            title="Delete this request"
                                            className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                                        >
                                            {busyId === request.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {rowErrors[request.id] && (
                                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span className="flex-1">{rowErrors[request.id]}</span>
                                    <button
                                        type="button"
                                        onClick={() => setRowError(request.id, null)}
                                        aria-label="Dismiss error"
                                        className="rounded p-0.5 text-red-300/70 transition-colors hover:text-red-200"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
