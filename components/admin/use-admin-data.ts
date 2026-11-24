"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getProjectsResult, PROJECTS_UPDATED_EVENT } from "@/lib/db-service"
import {
    getRequestsResult,
    getTaxonomyResult,
    getWaitlistEntriesResult,
    mergeTaxonomyOptions,
    removeTaxonomyOption,
    renameTaxonomyOption,
    type MutationResult,
} from "@/lib/admin-service"
import type {
    Project,
    Taxonomy,
    TaxonomyField,
    ToolRequest,
    WaitlistEntry,
} from "@/types"

interface AsyncState<T> {
    data: T
    loading: boolean
    error: string | null
    reload: () => Promise<void>
}

/**
 * A stable reference time for the relative-date filters.
 *
 * `Date.now()` is impure, so it is read after mount rather than during
 * render. It returns 0 until then, which callers treat as "no cutoff".
 */
export function useNow(): number {
    const [now, setNow] = useState(0)

    useEffect(() => {
        const timer = setTimeout(() => setNow(Date.now()), 0)
        return () => clearTimeout(timer)
    }, [])

    return now
}

/**
 * Guards a hook against out-of-order responses and state updates after the
 * component is gone.
 *
 * The initial read and an event-triggered reload can overlap. Without a
 * request counter the slower (older) response can land last and overwrite
 * fresh data with stale data.
 */
function useRequestGuard() {
    const mounted = useRef(true)
    const requestId = useRef(0)

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    /** Starts a new request and returns a guard that checks it is still current. */
    const begin = useCallback(() => {
        requestId.current += 1
        const id = requestId.current
        return () => mounted.current && id === requestId.current
    }, [])

    return { begin, isMounted: () => mounted.current }
}

/** Loads the project catalogue for the admin views. */
export function useAdminProjects(): AsyncState<Project[]> {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { begin } = useRequestGuard()

    const reload = useCallback(async () => {
        const isCurrent = begin()
        const result = await getProjectsResult()
        if (!isCurrent()) return
        setProjects(result.projects)
        setError(result.error)
        setLoading(false)
    }, [begin])

    useEffect(() => {
        const isCurrent = begin()

        getProjectsResult().then((result) => {
            if (!isCurrent()) return
            setProjects(result.projects)
            setError(result.error)
            setLoading(false)
        })

        // The background Nexus reconciliation dispatches this event after it
        // changes a project, so the admin views stay in sync.
        const handleProjectsUpdated = () => void reload()
        window.addEventListener(PROJECTS_UPDATED_EVENT, handleProjectsUpdated)

        return () => {
            window.removeEventListener(PROJECTS_UPDATED_EVENT, handleProjectsUpdated)
        }
    }, [begin, reload])

    return { data: projects, loading, error, reload }
}

/** Loads every waitlist signup (admin-only collection). */
export function useAdminWaitlist(): AsyncState<WaitlistEntry[]> {
    const [entries, setEntries] = useState<WaitlistEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { begin } = useRequestGuard()

    const reload = useCallback(async () => {
        const isCurrent = begin()
        const result = await getWaitlistEntriesResult()
        if (!isCurrent()) return
        setEntries(result.entries)
        setError(result.error)
        setLoading(false)
    }, [begin])

    useEffect(() => {
        const isCurrent = begin()

        getWaitlistEntriesResult().then((result) => {
            if (!isCurrent()) return
            setEntries(result.entries)
            setError(result.error)
            setLoading(false)
        })

        const handleProjectsUpdated = () => void reload()
        window.addEventListener(PROJECTS_UPDATED_EVENT, handleProjectsUpdated)

        return () => {
            window.removeEventListener(PROJECTS_UPDATED_EVENT, handleProjectsUpdated)
        }
    }, [begin, reload])

    return { data: entries, loading, error, reload }
}

/** Loads every public tool/feature request. */
export function useAdminRequests(): AsyncState<ToolRequest[]> {
    const [requests, setRequests] = useState<ToolRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { begin } = useRequestGuard()

    const reload = useCallback(async () => {
        const isCurrent = begin()
        const result = await getRequestsResult()
        if (!isCurrent()) return
        setRequests(result.requests)
        setError(result.error)
        setLoading(false)
    }, [begin])

    useEffect(() => {
        const isCurrent = begin()

        getRequestsResult().then((result) => {
            if (!isCurrent()) return
            setRequests(result.requests)
            setError(result.error)
            setLoading(false)
        })

        const handleProjectsUpdated = () => void reload()
        window.addEventListener(PROJECTS_UPDATED_EVENT, handleProjectsUpdated)

        return () => {
            window.removeEventListener(PROJECTS_UPDATED_EVENT, handleProjectsUpdated)
        }
    }, [begin, reload])

    return { data: requests, loading, error, reload }
}

/**
 * Loads the admin-managed option lists and exposes the mutations that edit
 * them.
 *
 * Every mutation is a read-modify-write against the stored list, so two
 * admins editing different options at the same time cannot wipe each
 * other's work. The lists are re-read afterwards instead of being patched
 * locally, which keeps the UI in step with what was actually saved.
 */
export function useAdminTaxonomy(): AsyncState<Taxonomy> & {
    /** The error from the last rejected write, if any. */
    mutationError: string | null
    add: (field: TaxonomyField, value: string) => Promise<MutationResult>
    remove: (field: TaxonomyField, value: string) => Promise<MutationResult>
    rename: (field: TaxonomyField, from: string, to: string) => Promise<MutationResult>
    merge: (field: TaxonomyField, values: readonly string[]) => Promise<MutationResult>
} {
    const [taxonomy, setTaxonomy] = useState<Taxonomy>({
        categories: [],
        tags: [],
        techStack: [],
        features: [],
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    /**
     * The error from the last *write*.
     *
     * It is kept apart from `error` (the read error) because the two mean
     * different things: a failed read means the lists could not be loaded,
     * a failed write means one specific edit was rejected. Mixing them
     * would tell the admin their lists are missing when the real problem is
     * a conflict.
     */
    const [mutationError, setMutationError] = useState<string | null>(null)
    const { begin } = useRequestGuard()

    const reload = useCallback(async () => {
        const isCurrent = begin()
        const result = await getTaxonomyResult()
        if (!isCurrent()) return
        setTaxonomy(result.taxonomy)
        setError(result.error)
        setLoading(false)
    }, [begin])

    useEffect(() => {
        const isCurrent = begin()

        getTaxonomyResult().then((result) => {
            if (!isCurrent()) return
            setTaxonomy(result.taxonomy)
            setError(result.error)
            setLoading(false)
        })

        return () => {
            // no cleanup needed — the guard handles unmounted writes
        }
    }, [begin])

    /** Runs a mutation and refreshes the lists from Firestore afterwards. */
    const runMutation = useCallback(
        async (
            mutate: () => Promise<MutationResult>
        ): Promise<MutationResult> => {
            const result = await mutate()

            if (!result.ok) {
                setMutationError(result.error)
                return result
            }

            setMutationError(null)
            await reload()
            return result
        },
        [reload]
    )

    const add = useCallback(
        (field: TaxonomyField, value: string) =>
            runMutation(() => mergeTaxonomyOptions(field, [value])),
        [runMutation]
    )

    const remove = useCallback(
        (field: TaxonomyField, value: string) =>
            runMutation(() => removeTaxonomyOption(field, value)),
        [runMutation]
    )

    const rename = useCallback(
        (field: TaxonomyField, from: string, to: string) =>
            runMutation(() => renameTaxonomyOption(field, from, to)),
        [runMutation]
    )

    const merge = useCallback(
        (field: TaxonomyField, values: readonly string[]) =>
            runMutation(() => mergeTaxonomyOptions(field, values)),
        [runMutation]
    )

    return { data: taxonomy, loading, error, mutationError, reload, add, remove, rename, merge }
}
