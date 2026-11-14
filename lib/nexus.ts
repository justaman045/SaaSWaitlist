import { Project } from "@/types"
import { deleteProject } from "@/lib/db-service"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"

const NEXUS_API_URL =
    process.env.NEXT_PUBLIC_NEXUS_API_URL ||
    (process.env.NODE_ENV === "development"
        ? "http://localhost:3001/api/products"
        : "https://nexusprods.vercel.app/api/products")

const NEXUS_SITE_URL =
    process.env.NEXT_PUBLIC_NEXUS_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://nexusprods.vercel.app")

export interface NexusSyncResult {
    ok: boolean
    nexusId?: string
    error?: string
    status?: number
    productPageUrl?: string
}

export interface NexusProduct {
    id: string
    name: string
    description?: string
    status?: string
    [key: string]: unknown
}

/**
 * Maps a local Project to the nexus product payload and creates it on nexusprods.
 * Requires a Firebase ID token (Bearer) for admin authorization.
 */
export async function syncProjectToNexus(
    project: Project,
    idToken: string
): Promise<NexusSyncResult> {
    // Map local status to nexus status
    const statusMap: Record<string, string> = {
        active: "live",
        coming_soon: "upcoming",
    }

    // price is required (number >= 0) on nexus; local pricing is a string like "Freemium"
    const price = Number(project.pricing)
    const numericPrice = Number.isFinite(price) ? price : 0

    // category is required on nexus; optional locally
    const category = project.category || "General"

    const body = {
        name: project.title,
        price: numericPrice,
        category,
        status: statusMap[project.status] || "upcoming",
        description: project.shortDescription || project.description,
        longDescription: project.description,
        descriptionType: "plain",
        imageUrl: project.imageUrl || project.images?.[0] || "",
        demoUrl: project.websiteUrl,
        features: project.tags || [],
    }

    try {
        console.log(`[Nexus Sync] POST ${NEXUS_API_URL}`, { body, hasAuth: !!idToken })

        const response = await fetch(NEXUS_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(body),
        })

        console.log(`[Nexus Sync] POST ${NEXUS_API_URL} -> ${response.status}`, response.ok ? "success" : "failed")

        if (!response.ok) {
            let errorMsg = `Nexus create failed (HTTP ${response.status})`
            try {
                const errorBody = await response.json()
                errorMsg = errorBody?.error || errorBody?.message || errorMsg
                // Include details in development for debugging (e.g. FIREBASE_SERVICE_ACCOUNT missing)
                if (process.env.NODE_ENV === "development" && errorBody?.details) {
                    errorMsg += ` — ${errorBody.details}`
                }
            } catch {
                // ignore parse errors, use status-based message
            }
            return { ok: false, error: errorMsg, status: response.status }
        }

        const data = await response.json()
        const nexusId = data?.id
        return {
            ok: true,
            nexusId,
            productPageUrl: nexusId
                ? `${NEXUS_SITE_URL}/products/${nexusId}`
                : undefined,
        }
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown nexus sync error",
        }
    }
}

/**
 * Deletes a product from nexusprods by its nexus product ID.
 * Requires a Firebase ID token (Bearer) for admin authorization.
 */
export async function deleteProductFromNexus(
    nexusProductId: string,
    idToken: string
): Promise<NexusSyncResult> {
    try {
        console.log(`[Nexus Sync] DELETE ${NEXUS_API_URL}/${nexusProductId}`, { hasAuth: !!idToken })

        const response = await fetch(`${NEXUS_API_URL}/${nexusProductId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        })

        console.log(`[Nexus Sync] DELETE ${NEXUS_API_URL}/${nexusProductId} -> ${response.status}`, response.ok ? "success" : "failed")

        // 404 means product already deleted on nexus — treat as success
        if (response.status === 404) {
            return { ok: true }
        }

        if (!response.ok) {
            let errorMsg = `Nexus delete failed (HTTP ${response.status})`
            try {
                const errorBody = await response.json()
                errorMsg = errorBody?.error || errorBody?.message || errorMsg
            } catch {
                // ignore parse errors
            }
            return { ok: false, error: errorMsg, status: response.status }
        }

        return { ok: true }
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown nexus delete error",
        }
    }
}

/**
 * Updates a product on nexusprods by its nexus product ID.
 * Requires a Firebase ID token (Bearer) for admin authorization.
 * Uses PUT to update all fields.
 */
export async function updateProjectToNexus(
    nexusProductId: string,
    project: Project,
    idToken: string
): Promise<NexusSyncResult> {
    // Map local status to nexus status
    const statusMap: Record<string, string> = {
        active: "live",
        coming_soon: "upcoming",
    }

    const price = Number(project.pricing)
    const numericPrice = Number.isFinite(price) ? price : 0

    const category = project.category || "General"

    const body = {
        name: project.title,
        price: numericPrice,
        category,
        status: statusMap[project.status] || "upcoming",
        description: project.shortDescription || project.description,
        longDescription: project.description,
        descriptionType: "plain",
        imageUrl: project.imageUrl || project.images?.[0] || "",
        demoUrl: project.websiteUrl,
        features: project.tags || [],
    }

    try {
        console.log(`[Nexus Sync] PUT ${NEXUS_API_URL}/${nexusProductId}`, { body, hasAuth: !!idToken })

        const response = await fetch(`${NEXUS_API_URL}/${nexusProductId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(body),
        })

        console.log(`[Nexus Sync] PUT ${NEXUS_API_URL}/${nexusProductId} -> ${response.status}`, response.ok ? "success" : "failed")

        // 404 means product doesn't exist on nexus — caller should create it instead
        if (response.status === 404) {
            return { ok: false, error: "Product not found on nexus", status: 404 }
        }

        if (!response.ok) {
            let errorMsg = `Nexus update failed (HTTP ${response.status})`
            try {
                const errorBody = await response.json()
                errorMsg = errorBody?.error || errorBody?.message || errorMsg
                if (process.env.NODE_ENV === "development" && errorBody?.details) {
                    errorMsg += ` — ${errorBody.details}`
                }
            } catch {
                // ignore parse errors
            }
            return { ok: false, error: errorMsg, status: response.status }
        }

        const data = await response.json()
        return {
            ok: true,
            nexusId: data?.id ?? nexusProductId,
        }
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown nexus update error",
        }
    }
}

/**
 * Fetches all products from nexusprods.
 * Requires a Firebase ID token (Bearer) for admin authorization.
 */
export async function getAllNexusProducts(idToken: string): Promise<NexusProduct[]> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
        console.log(`[Nexus Sync] GET ${NEXUS_API_URL}`, { hasAuth: !!idToken })

        const response = await fetch(NEXUS_API_URL, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
            signal: controller.signal,
        })

        clearTimeout(timeoutId)
        console.log(`[Nexus Sync] GET ${NEXUS_API_URL} -> ${response.status}`, response.ok ? "success" : "failed")

        if (!response.ok) {
            throw new Error(`Nexus fetch failed (HTTP ${response.status})`)
        }

        const data = await response.json()
        return data?.products ?? []
    } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("Nexus fetch timed out — is nexusprods running on localhost:3001?")
        }
        throw error instanceof Error ? error : new Error("Unknown nexus fetch error")
    }
}

/**
 * Compares local projects against nexus products and deletes local projects
 * that no longer exist on nexus (e.g. deleted directly on nexusprods).
 * Returns the list of deleted local project IDs.
 */
/**
 * Compares local projects against nexus products and:
 * 1. Deletes local projects that no longer exist on nexus
 * 2. Updates local projects whose fields differ from nexus
 * Returns the list of deleted/updated local project IDs.
 */
export async function syncDeletionsFromNexus(
    localProjects: Project[],
    idToken: string
): Promise<{ deleted: string[]; updated: string[]; errors: string[] }> {
    const deleted: string[] = []
    const updated: string[] = []
    const errors: string[] = []

    try {
        const nexusProducts = await getAllNexusProducts(idToken)
        const nexusMap = new Map(nexusProducts.map((p) => [p.id, p]))

        // Nexus status → local status mapping
        const nexusToLocalStatus: Record<string, string> = {
            live: "active",
            upcoming: "coming_soon",
            draft: "coming_soon",
            archived: "coming_soon",
        }

        for (const project of localProjects) {
            if (!project.nexusProductId) continue

            const nexusProduct = nexusMap.get(project.nexusProductId)

            // Product exists locally but was deleted on nexus — delete locally too
            if (!nexusProduct) {
                try {
                    await deleteProject(project.id)
                    deleted.push(project.id)
                } catch (error) {
                    errors.push(
                        `Failed to delete local project ${project.id}: ${
                            error instanceof Error ? error.message : String(error)
                        }`
                    )
                }
                continue
            }

            // Product exists on both sides — check if nexus has different fields
            const localTags = project.tags ?? []
            const nexusTags = (nexusProduct.features as string[]) ?? []

            const localPricing = Number(project.pricing)
            const nexusPrice = Number(nexusProduct.price)

            const nexusProductAny = nexusProduct as any

            const needsUpdate =
                project.title !== nexusProduct.name ||
                project.description !== nexusProduct.longDescription ||
                project.shortDescription !== nexusProduct.description ||
                project.slug !== nexusProductAny.slug ||
                project.status !== nexusToLocalStatus[nexusProduct.status ?? ""] ||
                project.imageUrl !== nexusProduct.imageUrl ||
                project.websiteUrl !== nexusProduct.demoUrl ||
                project.category !== nexusProduct.category ||
                JSON.stringify([...localTags].sort()) !== JSON.stringify([...nexusTags].sort()) ||
                localPricing !== nexusPrice

            if (needsUpdate) {
                try {
                    await updateDoc(doc(db, "projects", project.id), {
                        title: nexusProduct.name,
                        description: nexusProduct.longDescription,
                        shortDescription: nexusProduct.description,
                        slug: nexusProductAny.slug,
                        status: nexusToLocalStatus[nexusProduct.status ?? ""] ?? project.status,
                        imageUrl: nexusProduct.imageUrl,
                        websiteUrl: nexusProduct.demoUrl,
                        category: nexusProduct.category,
                        tags: nexusTags,
                        pricing: String(nexusPrice),
                        updatedAt: new Date().toISOString(),
                    })
                    updated.push(project.id)
                } catch (error) {
                    errors.push(
                        `Failed to update local project ${project.id}: ${
                            error instanceof Error ? error.message : String(error)
                        }`
                    )
                }
            }
        }
    } catch (error) {
        // Silent failure for fetch errors — nexusprods may be down or unreachable
        console.log("Nexus sync skipped:", error instanceof Error ? error.message : String(error))
    }

    return { deleted, updated, errors }
}
