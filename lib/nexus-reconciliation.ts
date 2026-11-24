import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { deleteProject, deleteWaitlistEntriesForProject } from "@/lib/db-service"
import { asPrice, asString, getAllNexusProducts, type NexusProduct } from "@/lib/nexus"
import { parsePrice } from "@/lib/price"
import { Project } from "@/types"

/** A project that exists locally but is missing from Nexus. */
export interface PendingDeletion {
    id: string
    title: string
    nexusProductId: string
}

/** A project whose local fields drifted from its Nexus counterpart. */
export interface PendingUpdate {
    id: string
    title: string
    changes: Record<string, unknown>
}

export interface ReconciliationPlan {
    deletions: PendingDeletion[]
    updates: PendingUpdate[]
    errors: string[]
}

const NEXUS_TO_LOCAL_STATUS: Record<string, Project["status"]> = {
    live: "active",
    upcoming: "coming_soon",
    draft: "coming_soon",
    archived: "coming_soon",
}

/**
 * Compares a local project against its Nexus counterpart and returns the
 * Firestore fields that need to change, or null when they already agree.
 *
 * The returned object must never contain `undefined` — Firestore rejects
 * undefined values.
 *
 * Internal to the reconciliation: the plan is the only thing callers need.
 */
function diffProjectAgainstNexus(
    project: Project,
    nexusProduct: NexusProduct
): Record<string, unknown> | null {
    const nexusName = asString(nexusProduct.name) ?? project.title
    const nexusLongDescription = asString(nexusProduct.longDescription) ?? project.description
    const nexusDescription = asString(nexusProduct.description)

    // nexus "description" is shortDescription || description. Only treat it
    // as a short description when it is genuinely different from the long one.
    const nexusShortDescription =
        nexusDescription && nexusDescription !== nexusLongDescription
            ? nexusDescription
            : project.shortDescription

    const nexusStatusRaw = asString(nexusProduct.status)
    const nexusStatus = nexusStatusRaw
        ? NEXUS_TO_LOCAL_STATUS[nexusStatusRaw] ?? project.status
        : project.status

    const nexusImageUrl = asString(nexusProduct.imageUrl)
    const nexusDemoUrl = asString(nexusProduct.demoUrl)
    const nexusCategory = asString(nexusProduct.category)
    const nexusPrice = asPrice(nexusProduct.price)
    // The local price goes through the same strict parser as the form, so a
    // malformed stored value ("0x10", "1e3") or a legacy free-text value
    // ("Free") is left alone instead of being rewritten from a different
    // number than the one it stands for.
    const localPrice = parsePrice(project.pricing) ?? undefined

    const nexusTags = Array.isArray(nexusProduct.features)
        ? nexusProduct.features.filter((tag): tag is string => typeof tag === "string")
        : project.tags ?? []

    const localTags = project.tags ?? []
    const tagsDiffer =
        JSON.stringify([...localTags].sort()) !== JSON.stringify([...nexusTags].sort())

    const pricingDiffers =
        nexusPrice !== undefined &&
        localPrice !== undefined &&
        nexusPrice !== localPrice

    const changes: Record<string, unknown> = {}

    if (nexusName !== project.title) changes.title = nexusName
    if (nexusLongDescription !== project.description) changes.description = nexusLongDescription
    if (nexusShortDescription !== project.shortDescription) {
        changes.shortDescription = nexusShortDescription ?? ""
    }
    if (nexusStatus !== project.status) changes.status = nexusStatus
    if (nexusImageUrl !== undefined && nexusImageUrl !== (project.imageUrl ?? "")) {
        changes.imageUrl = nexusImageUrl
    }
    if (nexusDemoUrl !== undefined && nexusDemoUrl !== (project.websiteUrl ?? "")) {
        changes.websiteUrl = nexusDemoUrl
    }
    if (nexusCategory && nexusCategory !== (project.category ?? "")) {
        changes.category = nexusCategory
    }
    if (tagsDiffer) changes.tags = nexusTags
    if (pricingDiffers && nexusPrice !== undefined) changes.pricing = String(nexusPrice)

    return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Builds a *dry-run* plan describing how local projects differ from Nexus.
 *
 * This function never writes to Firestore. Deletions are returned as
 * "pending" so the admin can confirm them explicitly — a project must never
 * disappear from the catalogue because of an incomplete or broken Nexus
 * response.
 */
export async function planNexusReconciliation(
    localProjects: Project[],
    idToken: string
): Promise<ReconciliationPlan> {
    const deletions: PendingDeletion[] = []
    const updates: PendingUpdate[] = []
    const errors: string[] = []

    let nexusProducts: NexusProduct[]
    let nexusTotal: number
    try {
        const result = await getAllNexusProducts(idToken)
        nexusProducts = result.products
        nexusTotal = result.total
    } catch (error) {
        return {
            deletions,
            updates,
            errors: [error instanceof Error ? error.message : String(error)],
        }
    }

    const mirroredProjects = localProjects.filter((project) => !!project.nexusProductId)

    // Safety guard: a completely empty Nexus response must never be read as
    // "every product was deleted".
    if (mirroredProjects.length > 0 && nexusProducts.length === 0) {
        return {
            deletions,
            updates,
            errors: [
                "Nexus returned an empty product list — reconciliation skipped to avoid removing local projects.",
            ],
        }
    }

    // Safety guard: a *partial* Nexus response is just as dangerous. If
    // Nexus itself counts more products than it returned, the missing ones
    // are not really missing — the response was filtered or truncated.
    if (nexusTotal > nexusProducts.length) {
        return {
            deletions,
            updates,
            errors: [
                `Nexus returned an incomplete product list (${nexusProducts.length} of ${nexusTotal}) — reconciliation skipped to avoid removing local projects.`,
            ],
        }
    }

    const nexusMap = new Map(nexusProducts.map((product) => [product.id, product]))

    for (const project of localProjects) {
        if (!project.nexusProductId) continue

        const nexusProduct = nexusMap.get(project.nexusProductId)

        // Product exists locally but is missing on nexus — flag it as pending
        // deletion instead of deleting it straight away.
        if (!nexusProduct) {
            deletions.push({
                id: project.id,
                title: project.title,
                nexusProductId: project.nexusProductId,
            })
            continue
        }

        const changes = diffProjectAgainstNexus(project, nexusProduct)
        if (changes) {
            updates.push({ id: project.id, title: project.title, changes })
        }
    }

    return { deletions, updates, errors }
}

/**
 * Applies the field-level drift fixes from a plan. These are non-destructive:
 * Nexus is the source of truth for mirrored projects.
 */
export async function applyNexusUpdates(updates: PendingUpdate[]): Promise<string[]> {
    const errors: string[] = []

    for (const update of updates) {
        try {
            await updateDoc(doc(db, "projects", update.id), {
                ...update.changes,
                updatedAt: serverTimestamp(),
            })
        } catch (error) {
            errors.push(
                `Failed to update local project ${update.id}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
        }
    }

    return errors
}

/**
 * Deletes the locally mirrored projects an admin explicitly confirmed.
 * The projects are already absent from Nexus, so only Firestore is touched.
 */
export async function applyNexusDeletions(deletions: PendingDeletion[]): Promise<string[]> {
    const errors: string[] = []

    for (const deletion of deletions) {
        try {
            await deleteProject(deletion.id)
        } catch (error) {
            errors.push(
                `Failed to delete local project ${deletion.id}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
            continue
        }

        // The waitlist collection holds personal data (email addresses).
        // Leaving the entries behind after the project is gone keeps that
        // data around forever with no way for the visitor to withdraw it —
        // the privacy policy promises the entries are removed with the
        // project.
        try {
            await deleteWaitlistEntriesForProject(deletion.id)
        } catch (error) {
            errors.push(
                `Deleted project ${deletion.id} but could not remove its waitlist entries: ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
        }
    }

    return errors
}
