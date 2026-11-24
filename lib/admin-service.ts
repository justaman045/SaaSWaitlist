import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    runTransaction,
    serverTimestamp,
    updateDoc,
    type Transaction,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
    DEFAULT_TAXONOMY,
    TAXONOMY_FIELDS,
    dedupeOptions,
    emptyTaxonomy,
    mergeOptions,
    normalizeOption,
} from "@/lib/taxonomy"
import type {
    RequestStatus,
    Taxonomy,
    TaxonomyField,
    ToolRequest,
    WaitlistEntry,
} from "@/types"

export interface TaxonomyResult {
    taxonomy: Taxonomy
    /** Non-null when the read failed — lets callers tell "empty" from "broken". */
    error: string | null
}

export interface WaitlistResult {
    entries: WaitlistEntry[]
    error: string | null
}

export interface RequestsResult {
    requests: ToolRequest[]
    error: string | null
}

export interface MutationResult {
    ok: boolean
    error: string | null
    /**
     * The raw Firebase error code (`permission-denied`, `unavailable`, …).
     *
     * The UI shows this next to the message — a bare "something went wrong"
     * is how a failed delete ends up looking like a button that does nothing.
     */
    code: string | null
}

const REQUEST_STATUSES: RequestStatus[] = ["new", "reviewing", "accepted", "rejected"]

/** Converts a Firestore Timestamp (or ISO string) into an ISO string. */
function toIsoString(value: unknown): string | undefined {
    if (!value) return undefined

    if (typeof value === "string") {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
    }

    if (typeof value === "object" && "toDate" in value) {
        const toDate = (value as { toDate?: () => Date }).toDate
        if (typeof toDate === "function") {
            const date = toDate.call(value)
            return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
        }
    }

    return undefined
}

/**
 * Reads the admin-managed option lists.
 *
 * The seeded defaults are only used when a document does not exist yet — once
 * an admin saves a list, that document becomes the source of truth so
 * deleting an option really deletes it.
 */
export async function getTaxonomyResult(): Promise<TaxonomyResult> {
    try {
        const snapshots = await Promise.all(
            TAXONOMY_FIELDS.map(async (field) => {
                const snap = await getDoc(doc(db, "taxonomy", field))
                return { field, snap }
            })
        )

        const taxonomy = emptyTaxonomy()

        for (const { field, snap } of snapshots) {
            if (!snap.exists()) {
                taxonomy[field] = [...DEFAULT_TAXONOMY[field]]
                continue
            }

            const data = snap.data()
            const values = Array.isArray(data.values)
                ? data.values.filter((value): value is string => typeof value === "string")
                : []

            taxonomy[field] = dedupeOptions(values)
        }

        return { taxonomy, error: null }
    } catch (error) {
        console.error("Error fetching taxonomy:", error)
        return {
            taxonomy: emptyTaxonomy(),
            error: error instanceof Error ? error.message : "Unknown error fetching options",
        }
    }
}

/** Builds a failed mutation result, keeping the raw Firebase error code. */
function mutationError(error: unknown, fallback: string): MutationResult {
    const code =
        typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : null

    return {
        ok: false,
        error: error instanceof Error ? error.message : fallback,
        code,
    }
}

/**
 * Thrown when an edit conflicts with a concurrent change by another admin.
 *
 * This is an expected outcome, not a system failure, so it is reported to
 * the admin without the noisy error log a real failure produces.
 */
class TaxonomyConflictError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "TaxonomyConflictError"
    }
}

/**
 * Reads the stored option list for a field from inside a transaction.
 *
 * A field that has never been written falls back to the seeded defaults, so
 * the first write does not silently drop them.
 */
async function taxonomyValuesIn(
    transaction: Transaction,
    field: TaxonomyField
): Promise<string[]> {
    const snap = await transaction.get(doc(db, "taxonomy", field))

    if (!snap.exists()) {
        return [...DEFAULT_TAXONOMY[field]]
    }

    const values = snap.data().values
    return Array.isArray(values)
        ? values.filter((value): value is string => typeof value === "string")
        : []
}

/**
 * Adds options to a list without touching the options that are already
 * there.
 *
 * Every taxonomy write is a read-modify-write against the *stored* list, not
 * against a snapshot the caller happened to have. A full-array replace based
 * on a stale snapshot (or on a list that failed to load) destroys the other
 * options — that is exactly how the shared list used to end up with a single
 * entry.
 */
export async function mergeTaxonomyOptions(
    field: TaxonomyField,
    values: readonly string[]
): Promise<MutationResult> {
    try {
        const ref = doc(db, "taxonomy", field)
        await runTransaction(db, async (transaction) => {
            const current = await taxonomyValuesIn(transaction, field)
            const next = mergeOptions(current, values)
            transaction.set(ref, { values: next, updatedAt: serverTimestamp() })
        })
        return { ok: true, error: null, code: null }
    } catch (error) {
        console.error(`Error merging taxonomy field ${field}:`, error)
        return mutationError(error, `Failed to update ${field}`)
    }
}

/** Removes a single option from a list. */
export async function removeTaxonomyOption(
    field: TaxonomyField,
    value: string
): Promise<MutationResult> {
    const target = normalizeOption(value).toLowerCase()

    if (!target) {
        return { ok: false, error: "An option cannot be empty.", code: null }
    }

    try {
        const ref = doc(db, "taxonomy", field)
        await runTransaction(db, async (transaction) => {
            const current = await taxonomyValuesIn(transaction, field)
            const next = current.filter(
                (entry) => normalizeOption(entry).toLowerCase() !== target
            )
            transaction.set(ref, { values: dedupeOptions(next), updatedAt: serverTimestamp() })
        })
        return { ok: true, error: null, code: null }
    } catch (error) {
        console.error(`Error removing taxonomy option from ${field}:`, error)
        return mutationError(error, `Failed to update ${field}`)
    }
}

/** Renames a single option in a list. */
export async function renameTaxonomyOption(
    field: TaxonomyField,
    from: string,
    to: string
): Promise<MutationResult> {
    const source = normalizeOption(from).toLowerCase()
    const replacement = normalizeOption(to)

    if (!replacement) {
        return { ok: false, error: "An option cannot be empty.", code: null }
    }

    try {
        const ref = doc(db, "taxonomy", field)
        await runTransaction(db, async (transaction) => {
            const current = await taxonomyValuesIn(transaction, field)

            // The source may have been renamed or removed by another admin
            // between the moment the editor was opened and this write. A
            // silent no-op would close the editor and claim a rename that
            // never happened, so the conflict is reported instead.
            const exists = current.some(
                (entry) => normalizeOption(entry).toLowerCase() === source
            )
            if (!exists) {
                throw new TaxonomyConflictError(
                    `“${from}” is no longer in the ${field} list — it was changed by someone else.`
                )
            }

            const next = current.map((entry) =>
                normalizeOption(entry).toLowerCase() === source ? replacement : entry
            )
            transaction.set(ref, { values: dedupeOptions(next), updatedAt: serverTimestamp() })
        })
        return { ok: true, error: null, code: null }
    } catch (error) {
        if (error instanceof TaxonomyConflictError) {
            return { ok: false, error: error.message, code: null }
        }
        console.error(`Error renaming taxonomy option in ${field}:`, error)
        return mutationError(error, `Failed to update ${field}`)
    }
}

/**
 * Reads every waitlist signup.
 *
 * The `waitlist` collection is admin-only (it holds email addresses), which
 * is exactly the audience of the admin dashboard.
 */
export async function getWaitlistEntriesResult(): Promise<WaitlistResult> {
    try {
        const snapshot = await getDocs(collection(db, "waitlist"))

        const entries: WaitlistEntry[] = snapshot.docs.map((entryDoc) => {
            const data = entryDoc.data()
            return {
                id: entryDoc.id,
                projectId: typeof data.projectId === "string" ? data.projectId : "",
                email: typeof data.email === "string" ? data.email : "",
                createdAt: toIsoString(data.createdAt),
            }
        })

        entries.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))

        return { entries, error: null }
    } catch (error) {
        console.error("Error fetching waitlist entries:", error)
        return {
            entries: [],
            error: error instanceof Error ? error.message : "Unknown error fetching signups",
        }
    }
}

/** Reads every public tool/feature request. */
export async function getRequestsResult(): Promise<RequestsResult> {
    try {
        const snapshot = await getDocs(collection(db, "requests"))

        const requests: ToolRequest[] = snapshot.docs.map((requestDoc) => {
            const data = requestDoc.data()
            const status = REQUEST_STATUSES.includes(data.status as RequestStatus)
                ? (data.status as RequestStatus)
                : "new"

            return {
                id: requestDoc.id,
                title: typeof data.title === "string" ? data.title : "",
                description: typeof data.description === "string" ? data.description : "",
                email: typeof data.email === "string" ? data.email : "",
                projectId: typeof data.projectId === "string" && data.projectId ? data.projectId : undefined,
                status,
                createdAt: toIsoString(data.createdAt),
                updatedAt: toIsoString(data.updatedAt),
            }
        })

        requests.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))

        return { requests, error: null }
    } catch (error) {
        console.error("Error fetching requests:", error)
        return {
            requests: [],
            error: error instanceof Error ? error.message : "Unknown error fetching requests",
        }
    }
}

/** Updates the workflow status of a request. */
export async function updateRequestStatus(
    id: string,
    status: RequestStatus
): Promise<MutationResult> {
    try {
        await updateDoc(doc(db, "requests", id), {
            status,
            updatedAt: serverTimestamp(),
        })
        return { ok: true, error: null, code: null }
    } catch (error) {
        console.error(`Error updating request ${id}:`, error)
        return mutationError(error, "Failed to update request")
    }
}

/** Deletes a request permanently. */
export async function deleteRequest(id: string): Promise<MutationResult> {
    try {
        await deleteDoc(doc(db, "requests", id))
        return { ok: true, error: null, code: null }
    } catch (error) {
        console.error(`Error deleting request ${id}:`, error)
        return mutationError(error, "Failed to delete request")
    }
}

export interface NewRequestInput {
    title: string
    description: string
    email: string
    projectId?: string
}

/**
 * Submits a public tool/feature request.
 *
 * The Firestore rules decide what a visitor is allowed to store — the
 * request is always created with status "new" because the rules reject any
 * other value from an unauthenticated write.
 */
export async function submitRequest(input: NewRequestInput): Promise<MutationResult> {
    try {
        const payload: Record<string, unknown> = {
            title: input.title.trim(),
            description: input.description.trim(),
            email: input.email.trim().toLowerCase(),
            // Always present (empty string when unrelated) — the Firestore
            // rules require the field and interpolate it into a path.
            projectId: input.projectId ?? "",
            status: "new",
            createdAt: serverTimestamp(),
        }

        await addDoc(collection(db, "requests"), payload)
        return { ok: true, error: null, code: null }
    } catch (error) {
        console.error("Error submitting request:", error)
        return mutationError(error, "Failed to submit request")
    }
}
