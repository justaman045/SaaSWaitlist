"use server"

import { Project } from "@/types"
import { deleteProject } from "@/lib/db-service"

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
        imageUrl: project.imageUrl,
        demoUrl: project.websiteUrl,
        features: project.tags || [],
    }

    try {
        const response = await fetch(NEXUS_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(body),
        })

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
        const response = await fetch(`${NEXUS_API_URL}/${nexusProductId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        })

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
 * Fetches all products from nexusprods.
 * Requires a Firebase ID token (Bearer) for admin authorization.
 */
export async function getAllNexusProducts(idToken: string): Promise<NexusProduct[]> {
    try {
        const response = await fetch(NEXUS_API_URL, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        })

        if (!response.ok) {
            throw new Error(`Nexus fetch failed (HTTP ${response.status})`)
        }

        const data = await response.json()
        return data?.products ?? []
    } catch (error) {
        throw error instanceof Error ? error : new Error("Unknown nexus fetch error")
    }
}

/**
 * Compares local projects against nexus products and deletes local projects
 * that no longer exist on nexus (e.g. deleted directly on nexusprods).
 * Returns the list of deleted local project IDs.
 */
export async function syncDeletionsFromNexus(
    localProjects: Project[],
    idToken: string
): Promise<{ deleted: string[]; errors: string[] }> {
    const deleted: string[] = []
    const errors: string[] = []

    try {
        const nexusProducts = await getAllNexusProducts(idToken)
        const nexusIds = new Set(nexusProducts.map((p) => p.id))

        for (const project of localProjects) {
            if (!project.nexusProductId) continue
            if (nexusIds.has(project.nexusProductId)) continue

            // Product exists locally but was deleted on nexus — delete locally too
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
        }
    } catch (error) {
        errors.push(
            `Failed to fetch nexus products: ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    }

    return { deleted, errors }
}
