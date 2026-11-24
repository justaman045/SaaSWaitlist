"use client"

import { useState } from "react"
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react"
import { useNexusReconciliation } from "@/components/nexus-reconciliation-provider"
import { Button } from "@/components/ui/button"
import type { PendingDeletion } from "@/lib/nexus-reconciliation"

export function NexusPendingDeletions() {
    const {
        pendingDeletions,
        running,
        error,
        waitlistError,
        confirmDeletions,
        dismissDeletions,
    } = useNexusReconciliation()

    /**
     * The exact list the admin reviewed when they armed the confirmation.
     *
     * The provider re-runs every five minutes and the list can change while
     * the confirmation is armed. Confirming the *current* list would delete
     * projects the admin never saw, so the reviewed snapshot is stored and
     * passed to the provider instead. If the list changed in the meantime,
     * the confirmation is no longer armed.
     */
    const [reviewed, setReviewed] = useState<{
        ids: string[]
        deletions: PendingDeletion[]
    } | null>(null)

    const currentIds = pendingDeletions.map((deletion) => deletion.id)
    const reviewedIsCurrent =
        reviewed !== null &&
        reviewed.ids.length === currentIds.length &&
        reviewed.ids.every((id, index) => id === currentIds[index])

    const snapshot = reviewedIsCurrent ? reviewed.deletions : null

    if (pendingDeletions.length === 0 && !error && !waitlistError) return null

    return (
        <div className="space-y-4">
            {error && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {waitlistError && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{waitlistError}</span>
                </div>
            )}

            {pendingDeletions.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                            <div className="space-y-1">
                                <h2 className="font-semibold text-amber-100">
                                    {pendingDeletions.length} project
                                    {pendingDeletions.length === 1 ? "" : "s"} missing from Nexus
                                </h2>
                                <p className="text-sm text-amber-200/80">
                                    These projects still exist in Firestore but no longer exist in the
                                    Nexus catalogue. Nothing has been deleted — confirm below if the
                                    removal was intentional.
                                </p>
                            </div>
                        </div>

                        <ul className="space-y-1 rounded-xl bg-black/20 p-3 text-sm text-amber-100/90">
                            {pendingDeletions.map((deletion) => (
                                <li key={deletion.id} className="flex items-center justify-between gap-4">
                                    <span className="truncate">{deletion.title}</span>
                                    <span className="shrink-0 font-mono text-xs text-amber-200/60">
                                        {deletion.nexusProductId}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {snapshot ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        const deletions = snapshot
                                        setReviewed(null)
                                        void confirmDeletions(deletions)
                                    }}
                                    disabled={running}
                                    className="rounded-full bg-red-500/15 px-6 text-red-200 hover:bg-red-500/25 border border-red-500/30"
                                >
                                    {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Yes, delete {snapshot.length} project
                                    {snapshot.length === 1 ? "" : "s"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setReviewed(null)}
                                    disabled={running}
                                    className="rounded-full px-6"
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant="destructive"
                                    onClick={() =>
                                        setReviewed({
                                            ids: currentIds,
                                            deletions: [...pendingDeletions],
                                        })
                                    }
                                    disabled={running}
                                    className="rounded-full bg-red-500/15 px-6 text-red-200 hover:bg-red-500/25 border border-red-500/30"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete {pendingDeletions.length} project
                                    {pendingDeletions.length === 1 ? "" : "s"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={dismissDeletions}
                                    disabled={running}
                                    className="rounded-full px-6"
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Dismiss
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
