"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Check, Download, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    TAXONOMY_FIELD_DESCRIPTIONS,
    TAXONOMY_FIELD_LABELS,
    normalizeOption,
} from "@/lib/taxonomy"
import { useAdminProjects, useAdminTaxonomy } from "@/components/admin/use-admin-data"
import type { TaxonomyField } from "@/types"

const FIELDS: TaxonomyField[] = ["categories", "tags", "techStack", "features"]

/** Identifies one option row so the confirmation can be bound to it. */
interface OptionRef {
    field: TaxonomyField
    value: string
}

export default function AdminTaxonomyPage() {
    const { data: taxonomy, loading, error, mutationError, add, remove, rename, merge } =
        useAdminTaxonomy()
    const { data: projects, error: projectsError } = useAdminProjects()

    const [drafts, setDrafts] = useState<Partial<Record<TaxonomyField, string>>>({})
    const [editing, setEditing] = useState<{
        field: TaxonomyField
        /** The option's value when the editor was opened. */
        original: string
        value: string
    } | null>(null)
    const [busyField, setBusyField] = useState<TaxonomyField | null>(null)

    /**
     * The option whose delete button is armed.
     *
     * Deleting an option is a two-step action: the first click arms it and
     * the second one deletes it. A native `window.confirm()` was used
     * before, but a suppressed or dismissed browser dialog fails silently —
     * the button then looks completely broken.
     */
    const [confirmingDelete, setConfirmingDelete] = useState<OptionRef | null>(null)

    /** Per-option error text, rendered inline on the row. */
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

    const rowKey = (field: TaxonomyField, value: string) => `${field}:${value.toLowerCase()}`

    const setRowError = (field: TaxonomyField, value: string, message: string | null) => {
        const key = rowKey(field, value)
        setRowErrors((current) => {
            if (message === null) {
                if (!(key in current)) return current
                const next = { ...current }
                delete next[key]
                return next
            }
            return { ...current, [key]: message }
        })
    }

    /** How many projects currently use each option. */
    const usage = useMemo(() => {
        const counts: Record<TaxonomyField, Map<string, number>> = {
            categories: new Map(),
            tags: new Map(),
            techStack: new Map(),
            features: new Map(),
        }

        // A project that lists the same tag twice still uses the option
        // once, so each project's values are de-duplicated before counting.
        const bump = (field: TaxonomyField, values: readonly (string | undefined)[]) => {
            const seen = new Set<string>()
            for (const value of values) {
                if (!value) continue
                const normalized = normalizeOption(value)
                if (!normalized) continue
                const key = normalized.toLowerCase()
                if (seen.has(key)) continue
                seen.add(key)
                counts[field].set(key, (counts[field].get(key) ?? 0) + 1)
            }
        }

        for (const project of projects) {
            bump("categories", [project.category])
            bump("tags", project.tags ?? [])
            bump("techStack", project.techStack ?? [])
            bump("features", project.features ?? [])
        }

        return counts
    }, [projects])

    const handleAdd = async (field: TaxonomyField) => {
        const draft = (drafts[field] ?? "").trim()
        if (!draft) return

        setBusyField(field)
        try {
            const result = await add(field, draft)
            if (!result.ok) {
                setRowError(field, draft, result.error ?? `Could not save ${field}`)
                toast.error(result.error ?? `Could not save ${field}`)
                return
            }
            setDrafts((current) => ({ ...current, [field]: "" }))
        } finally {
            setBusyField(null)
        }
    }

    const handleRename = async (field: TaxonomyField) => {
        if (!editing) return

        // The option is identified by its *value*, not by the position it
        // had when the editor was opened. Every write sorts the list, so an
        // index would point at a different option as soon as anything else
        // changed the list (an import, another admin's edit).
        const previous = editing.original
        const next = editing.value.trim()

        if (!next) {
            setEditing(null)
            return
        }

        if (next === previous) {
            setEditing(null)
            return
        }

        setBusyField(field)
        try {
            const result = await rename(field, previous, next)
            if (!result.ok) {
                setRowError(field, previous, result.error ?? `Could not rename ${field}`)
                toast.error(result.error ?? `Could not rename ${field}`)
                return
            }
            setEditing(null)
        } finally {
            setBusyField(null)
        }
    }

    const handleDelete = async (field: TaxonomyField, value: string) => {
        // First click only arms the delete — nothing is written yet.
        if (confirmingDelete?.field !== field || confirmingDelete.value !== value) {
            setConfirmingDelete({ field, value })
            setRowError(field, value, null)
            return
        }

        setConfirmingDelete(null)
        setBusyField(field)
        try {
            const result = await remove(field, value)
            if (!result.ok) {
                const message = result.error ?? `Could not delete ${value}`
                setRowError(field, value, message)
                toast.error(message)
                return
            }
            toast.success(`Deleted ${value}`)
        } finally {
            setBusyField(null)
        }
    }

    /** Pulls every value already used by a project into the option lists. */
    const handleImport = async () => {
        const collected: Record<TaxonomyField, string[]> = {
            categories: [],
            tags: [],
            techStack: [],
            features: [],
        }

        for (const project of projects) {
            if (project.category) collected.categories.push(project.category)
            collected.tags.push(...(project.tags ?? []))
            collected.techStack.push(...(project.techStack ?? []))
            collected.features.push(...(project.features ?? []))
        }

        setBusyField("categories")
        try {
            for (const field of FIELDS) {
                if (collected[field].length === 0) continue

                const result = await merge(field, collected[field])
                if (!result.ok) {
                    toast.error(result.error ?? `Could not import ${field}`)
                    return
                }
            }
            toast.success("Imported options used by your projects")
        } finally {
            setBusyField(null)
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Options</h1>
                    <p className="text-sm text-muted-foreground">
                        The vocabulary behind the category, tag and tech-stack dropdowns.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => void handleImport()}
                    disabled={busyField !== null || projects.length === 0 || Boolean(projectsError)}
                    title={
                        projectsError
                            ? "The project list could not be loaded — there is nothing to import from."
                            : undefined
                    }
                    className="rounded-full"
                >
                    {busyField ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    Import from projects
                </Button>
            </div>

            {error && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Could not load the option lists: {error}. Make sure your account is
                        allowlisted and verified, and that the Firestore rules have been deployed.
                    </span>
                </div>
            )}

            {projectsError && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Could not load the project list: {projectsError}. The usage counters and
                        the &ldquo;Import from projects&rdquo; button are unavailable until it loads.
                    </span>
                </div>
            )}

            {mutationError && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        The change was not saved: {mutationError}. The option lists were not
                        modified.
                    </span>
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
                {FIELDS.map((field) => {
                    const values = taxonomy[field]
                    const isEditingThis = editing?.field === field

                    return (
                        <section
                            key={field}
                            className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-xl"
                        >
                            <div className="mb-1 flex items-center justify-between gap-3">
                                <h2 className="font-semibold text-white">
                                    {TAXONOMY_FIELD_LABELS[field]}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {values.length} option{values.length === 1 ? "" : "s"}
                                </span>
                            </div>
                            <p className="mb-5 text-xs text-muted-foreground/80">
                                {TAXONOMY_FIELD_DESCRIPTIONS[field]}
                            </p>

                            <div className="flex gap-2">
                                <Input
                                    value={drafts[field] ?? ""}
                                    onChange={(event) =>
                                        setDrafts((current) => ({
                                            ...current,
                                            [field]: event.target.value,
                                        }))
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault()
                                            void handleAdd(field)
                                        }
                                    }}
                                    placeholder={`Add a new ${field === "techStack" ? "technology" : field.replace(/s$/, "")}…`}
                                    aria-label={`Add a new ${TAXONOMY_FIELD_LABELS[field]} option`}
                                    className="h-10 rounded-xl bg-black/20 border-white/10"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => void handleAdd(field)}
                                    disabled={busyField === field || !(drafts[field] ?? "").trim()}
                                    aria-label={`Add ${TAXONOMY_FIELD_LABELS[field]} option`}
                                    className="h-10 w-10 shrink-0 rounded-xl"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {loading ? (
                                <div
                                    className="flex justify-center py-10"
                                    role="status"
                                    aria-live="polite"
                                >
                                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                    <span className="sr-only">
                                        Loading the {TAXONOMY_FIELD_LABELS[field]} options…
                                    </span>
                                </div>
                            ) : values.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No options yet — add one above.
                                </p>
                            ) : (
                                <ul className="mt-4 space-y-1">
                                    {values.map((value) => {
                                        const count =
                                            usage[field].get(
                                                normalizeOption(value).toLowerCase()
                                            ) ?? 0
                                        const isArmed =
                                            confirmingDelete?.field === field &&
                                            confirmingDelete.value === value
                                        const rowError = rowErrors[rowKey(field, value)]

                                        return (
                                            <li
                                                key={`${field}-${value}`}
                                                className="group flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5"
                                            >
                                                {isEditingThis && editing.original === value ? (
                                                    <>
                                                        <Input
                                                            autoFocus
                                                            value={editing.value}
                                                            onChange={(event) =>
                                                                setEditing({
                                                                    field,
                                                                    original: editing.original,
                                                                    value: event.target.value,
                                                                })
                                                            }
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault()
                                                                    void handleRename(field)
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setEditing(null)
                                                                }
                                                            }}
                                                            aria-label={`New name for ${value}`}
                                                            className="h-8 rounded-lg bg-black/30 border-white/10 text-sm"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => void handleRename(field)}
                                                            disabled={busyField === field}
                                                            aria-label="Save"
                                                            className="h-8 w-8 shrink-0"
                                                        >
                                                            <Check className="h-4 w-4 text-emerald-400" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setEditing(null)}
                                                            aria-label="Cancel"
                                                            className="h-8 w-8 shrink-0"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : isArmed ? (
                                                    <div className="flex flex-1 items-center gap-2">
                                                        <span className="text-xs font-medium text-red-200">
                                                            Delete “{value}”?
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => void handleDelete(field, value)}
                                                            disabled={busyField === field}
                                                            aria-label={`Confirm deleting ${value}`}
                                                            className="h-7 px-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200"
                                                        >
                                                            {busyField === field ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                "Yes"
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setConfirmingDelete(null)}
                                                            aria-label={`Cancel deleting ${value}`}
                                                            className="h-7 px-2 text-xs text-muted-foreground hover:text-white"
                                                        >
                                                            No
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                                                            {value}
                                                        </span>
                                                        {count > 0 && (
                                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                                used by {count}
                                                            </span>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setEditing({
                                                                    field,
                                                                    original: value,
                                                                    value,
                                                                })
                                                            }
                                                            disabled={busyField === field}
                                                            aria-label={`Rename ${value}`}
                                                            className="h-8 w-8 shrink-0 opacity-60 transition-opacity group-hover:opacity-100 focus:opacity-100"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => void handleDelete(field, value)}
                                                            disabled={busyField === field}
                                                            aria-label={`Delete ${value}`}
                                                            className="h-8 w-8 shrink-0 text-muted-foreground opacity-60 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                                {rowError && (
                                                    <p
                                                        role="alert"
                                                        className="w-full px-1 text-xs text-red-300"
                                                    >
                                                        {rowError}
                                                    </p>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </section>
                    )
                })}
            </div>
        </div>
    )
}
