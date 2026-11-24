"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { reconcileWaitlistCounts, getProjectsResult, PROJECTS_UPDATED_EVENT } from "@/lib/db-service"
import {
    applyNexusDeletions,
    applyNexusUpdates,
    planNexusReconciliation,
    type PendingDeletion,
} from "@/lib/nexus-reconciliation"
import { NEXUS_AVAILABLE, NEXUS_UNAVAILABLE_REASON } from "@/lib/nexus"
import { toast } from "sonner"

const SYNC_INTERVAL_MS = 5 * 60 * 1000

/**
 * The waitlist counter is re-derived from the waitlist collection on every
 * cycle.
 *
 * The public signup form maintains the counter, and the Firestore rules
 * cannot tie an increment to the entry that caused it. Re-deriving the count
 * repairs any drift — the number of entries is the truth.
 */

interface NexusReconciliationContextValue {
    /** Projects that exist locally but are missing from Nexus. */
    pendingDeletions: PendingDeletion[]
    running: boolean
    error: string | null
    /**
     * Set when the waitlist-counter repair failed. It is kept apart from
     * `error` so a successful Nexus cycle cannot hide a warning about
     * drifted public counters.
     */
    waitlistError: string | null
    /**
     * Set when the sync cannot run at all (for example while the app is
     * pointed at the local Firebase emulator). The admin UI shows it so the
     * missing sync is never a mystery.
     */
    disabledReason: string | null
    /**
     * Deletes exactly the projects that were reviewed. The snapshot is passed
     * in so a list that changed in the meantime can never be deleted by
     * accident.
     */
    confirmDeletions: (deletions: PendingDeletion[]) => Promise<void>
    dismissDeletions: () => void
}

const NexusReconciliationContext = createContext<NexusReconciliationContextValue | null>(null)

export function NexusReconciliationProvider({
    enabled,
    children,
}: {
    enabled: boolean
    children: React.ReactNode
}) {
    const router = useRouter()
    const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([])
    const [running, setRunning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    /**
     * A separate slot for the waitlist-counter repair, which runs
     * independently of the Nexus sync. Keeping it apart means a successful
     * Nexus cycle cannot wipe the warning about drifted counters.
     */
    const [waitlistError, setWaitlistError] = useState<string | null>(null)

    const runningRef = useRef(false)
    const dismissedRef = useRef<Set<string>>(new Set())
    /** False once the provider is unmounted — no writes after that. */
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const run = useCallback(async () => {
        if (!enabled || runningRef.current) return

        const currentUser = auth.currentUser
        if (!currentUser) return

        runningRef.current = true

        try {
            if (!mountedRef.current) return
            setRunning(true)

            // The waitlist counter is re-derived from the waitlist
            // collection. A failed read is not fatal — the cycle continues
            // and the counter is repaired on the next one.
            //
            // This runs *before* the Nexus check and independently of it: the
            // counter has nothing to do with Nexus, and a paused or failing
            // Nexus sync must not stop the counter from being repaired.
            try {
                const repaired = await reconcileWaitlistCounts()
                if (mountedRef.current) {
                    setWaitlistError(null)
                }
                if (repaired > 0) {
                    toast.success(
                        `Reconciled the waitlist counter for ${repaired} project(s)`
                    )
                }
            } catch (reconcileError) {
                // The public counters can be wrong until this succeeds, so
                // the failure has to be visible rather than console-only.
                const message =
                    reconcileError instanceof Error
                        ? reconcileError.message
                        : String(reconcileError)
                console.warn("Waitlist count reconciliation failed:", reconcileError)
                if (mountedRef.current) {
                    setWaitlistError(
                        `Could not reconcile the waitlist counters (${message}) — the public signup counts may be out of date.`
                    )
                }
            }

            // Nexus cannot be reached from an emulator build — skip the rest
            // of the cycle instead of firing requests that are guaranteed to
            // fail.
            if (!NEXUS_AVAILABLE) return

            const idToken = await currentUser.getIdToken()

            if (!mountedRef.current) return

            // `getProjectsResult` reports read errors instead of swallowing
            // them: a failed read would look exactly like an empty
            // catalogue and the cycle would report "no drift".
            const local = await getProjectsResult()
            if (local.error) {
                setError(
                    `Could not read the local catalogue (${local.error}) — reconciliation skipped.`
                )
                return
            }

            const plan = await planNexusReconciliation(local.projects, idToken)

            if (!mountedRef.current) return

            // Field drift is corrected automatically — Nexus is the source of
            // truth for mirrored projects. Removals are never automatic.
            const visibleDeletions = plan.deletions.filter(
                (deletion) => !dismissedRef.current.has(deletion.id)
            )

            setPendingDeletions(visibleDeletions)
            setError(plan.errors.length > 0 ? plan.errors.join(" ") : null)

            if (plan.updates.length > 0) {
                const updateErrors = await applyNexusUpdates(plan.updates)

                if (!mountedRef.current) return

                const succeeded = plan.updates.length - updateErrors.length

                if (updateErrors.length > 0) {
                    // The failure has to be visible, not just in a toast that
                    // disappears — the catalogue may have drifted.
                    setError(
                        `Failed to update ${updateErrors.length} project(s) from Nexus: ${updateErrors.join(" ")}`
                    )
                    updateErrors.forEach((message) => toast.error(message))
                }

                if (succeeded > 0) {
                    toast.success(`${succeeded} project(s) updated from Nexus`)
                    window.dispatchEvent(new Event(PROJECTS_UPDATED_EVENT))
                    router.refresh()
                }
            }
        } catch (runError) {
            // A failed reconciliation must be visible, not just logged: the
            // admin has to know that the catalogue may have drifted.
            const message =
                runError instanceof Error ? runError.message : String(runError)
            if (mountedRef.current) {
                setError(`Nexus reconciliation failed: ${message}`)
            }
            console.warn("Nexus reconciliation failed:", runError)
        } finally {
            runningRef.current = false
            if (mountedRef.current) {
                setRunning(false)
            }
        }
    }, [enabled, router])

    useEffect(() => {
        if (!enabled) return

        // The first sync is scheduled instead of called directly: the effect
        // itself must not set state synchronously, and deferring the run
        // lets the dashboard paint before the sync starts.
        const initialRun = window.setTimeout(run, 0)
        const intervalId = setInterval(run, SYNC_INTERVAL_MS)

        return () => {
            window.clearTimeout(initialRun)
            clearInterval(intervalId)
        }
    }, [enabled, run])

    const confirmDeletions = useCallback(
        async (deletions: PendingDeletion[]) => {
            if (deletions.length === 0) return

            // The same mutex the automatic cycle uses. Without it a cycle
            // could start while a manual deletion is in flight, and the
            // cycle's `finally` would clear the `running` state and
            // re-enable the destructive button mid-deletion.
            if (runningRef.current) return
            runningRef.current = true

            setRunning(true)
            try {
                const errors = await applyNexusDeletions(deletions)

                if (errors.length > 0) {
                    const message = `Failed to delete ${errors.length} project(s): ${errors.join(" ")}`
                    setError(message)
                    errors.forEach((entry) => toast.error(entry))
                    return
                }

                toast.success(`${deletions.length} project(s) deleted`)
                setPendingDeletions([])
                window.dispatchEvent(new Event(PROJECTS_UPDATED_EVENT))
                router.refresh()
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error)
                setError(`Failed to delete the confirmed project(s): ${message}`)
                toast.error("Failed to delete the confirmed project(s).")
            } finally {
                runningRef.current = false
                if (mountedRef.current) {
                    setRunning(false)
                }
            }
        },
        [router]
    )

    const dismissDeletions = useCallback(() => {
        pendingDeletions.forEach((deletion) => dismissedRef.current.add(deletion.id))
        setPendingDeletions([])
    }, [pendingDeletions])

    const value = useMemo<NexusReconciliationContextValue>(
        () => ({
            pendingDeletions,
            running,
            error,
            waitlistError,
            disabledReason: NEXUS_AVAILABLE ? null : NEXUS_UNAVAILABLE_REASON,
            confirmDeletions,
            dismissDeletions,
        }),
        [
            pendingDeletions,
            running,
            error,
            waitlistError,
            confirmDeletions,
            dismissDeletions,
        ]
    )

    return (
        <NexusReconciliationContext.Provider value={value}>
            {children}
        </NexusReconciliationContext.Provider>
    )
}

export function useNexusReconciliation(): NexusReconciliationContextValue {
    const context = useContext(NexusReconciliationContext)
    if (!context) {
        throw new Error("useNexusReconciliation must be used inside a NexusReconciliationProvider")
    }
    return context
}
