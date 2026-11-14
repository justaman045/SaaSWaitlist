"use server"

import { Project } from "@/types"

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
