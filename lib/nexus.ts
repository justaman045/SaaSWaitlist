import { Project } from "@/types"
import { getNexusApiUrl } from "@/lib/nexus-url"
import { parsePrice } from "@/lib/price"
import { IS_EMULATOR } from "@/lib/firebase-target"

const REQUEST_TIMEOUT_MS = 15_000

/**
 * Whether the Nexus integration can work at all in this build.
 *
 * Nexus is a production service that validates the caller against the
 * production Firebase project. The local emulator issues unsigned
 * (`alg: none`) tokens, which Nexus's edge rejects with 403 — so syncing
 * while the emulator is running can never succeed and would only produce
 * misleading errors. Callers skip the sync instead.
 */
export const NEXUS_AVAILABLE = !IS_EMULATOR

/** Shown wherever the admin needs to know why the sync is not running. */
export const NEXUS_UNAVAILABLE_REASON = IS_EMULATOR
    ? "Nexus sync is paused because this build runs against the local Firebase emulator."
    : ""

export interface NexusSyncResult {
    ok: boolean
    nexusId?: string
    error?: string
    status?: number
}

export interface NexusProduct {
    id: string
    [key: string]: unknown
}

export function asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined
}

export function asFiniteNumber(value: unknown): number | undefined {
    const parsed = typeof value === "number" ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Parses a price that comes from Nexus.
 *
 * `Number()` would accept "0x10" (16) and "1e3" (1000), which are not
 * prices. A malformed value is ignored instead of silently becoming a
 * different amount and overwriting the local price.
 */
export function asPrice(value: unknown): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0 ? value : undefined
    }
    if (typeof value !== "string") return undefined
    return parsePrice(value) ?? undefined
}

function debugLog(...args: unknown[]) {
    if (process.env.NODE_ENV === "development") {
        console.log(...args)
    }
}

/**
 * Wraps fetch with an abort timeout so a slow/unreachable nexusprods instance
 * can never leave the admin UI stuck in a loading state.
 *
 * The request goes to this app's own `/api/nexus/...` route, which proxies
 * it to Nexus server-side — so there is no CORS involved and the browser
 * always sees the real HTTP status.
 */
async function nexusFetch(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        return await fetch(url, { ...init, signal: controller.signal })
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("Nexus request timed out — is nexusprods reachable?")
        }
        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    let errorMsg = fallback
    try {
        const errorBody = await response.json()
        errorMsg = errorBody?.error || errorBody?.message || errorMsg
        if (process.env.NODE_ENV === "development" && errorBody?.details) {
            errorMsg += ` — ${errorBody.details}`
        }
    } catch {
        // ignore parse errors, use status-based message
    }
    return errorMsg
}

/**
 * Maps a local Project to the nexus product payload.
 * Kept in one place so create and update can never drift apart.
 */
function toNexusPayload(project: Project) {
    const images = Array.isArray(project.images) ? project.images : []

    return {
        name: project.title,
        price: parsePrice(project.pricing) ?? 0,
        category: project.category?.trim() || "General",
        status: project.status === "active" ? "live" : "upcoming",
        description: project.shortDescription?.trim() || project.description,
        longDescription: project.description,
        descriptionType: "plain" as const,
        imageUrl: project.imageUrl?.trim() || images[0] || "",
        images,
        // Always send the field — even when empty. Nexus only overwrites a
        // field it receives, so sending `undefined` would leave a stale
        // `demoUrl` on the mirrored product after the website URL is
        // cleared locally.
        demoUrl: project.websiteUrl || "",
        features: project.tags ?? [],
    }
}

/**
 * Creates the mirrored product on nexusprods.
 * Requires a Firebase ID token (Bearer) for admin authorization.
 */
export async function syncProjectToNexus(
    project: Project,
    idToken: string
): Promise<NexusSyncResult> {
    const url = getNexusApiUrl()
    const body = toNexusPayload(project)

    try {
        debugLog(`[Nexus Sync] POST ${url}`, { body, hasAuth: !!idToken })

        const response = await nexusFetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(body),
        })

        debugLog(`[Nexus Sync] POST ${url} -> ${response.status}`, response.ok ? "success" : "failed")

        if (!response.ok) {
            return {
                ok: false,
                error: await readErrorMessage(response, `Nexus create failed (HTTP ${response.status})`),
                status: response.status,
            }
        }

        const data = await response.json()
        const nexusId = asString(data?.id)
        return { ok: true, nexusId }
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown nexus sync error",
        }
    }
}

/**
 * Deletes a product from nexusprods by its nexus product ID.
 */
export async function deleteProductFromNexus(
    nexusProductId: string,
    idToken: string
): Promise<NexusSyncResult> {
    const url = `${getNexusApiUrl()}/${encodeURIComponent(nexusProductId)}`

    try {
        debugLog(`[Nexus Sync] DELETE ${url}`, { hasAuth: !!idToken })

        const response = await nexusFetch(url, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
        })

        debugLog(`[Nexus Sync] DELETE ${url} -> ${response.status}`, response.ok ? "success" : "failed")

        // 404 means product already deleted on nexus — treat as success
        if (response.status === 404) {
            return { ok: true }
        }

        if (!response.ok) {
            return {
                ok: false,
                error: await readErrorMessage(response, `Nexus delete failed (HTTP ${response.status})`),
                status: response.status,
            }
        }

        return { ok: true }
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown nexus sync error",
        }
    }
}

/**
 * Updates a product on nexusprods by its nexus product ID.
 */
export async function updateProjectToNexus(
    nexusProductId: string,
    project: Project,
    idToken: string
): Promise<NexusSyncResult> {
    const url = `${getNexusApiUrl()}/${encodeURIComponent(nexusProductId)}`
    const body = toNexusPayload(project)

    try {
        debugLog(`[Nexus Sync] PATCH ${url}`, { body, hasAuth: !!idToken })

        // Nexus exposes PATCH on `/api/products/[id]` — there is no PUT
        // handler, so a PUT is answered with 405 and every mirrored edit
        // fails. PATCH accepts the same payload shape.
        const response = await nexusFetch(url, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(body),
        })

        debugLog(`[Nexus Sync] PATCH ${url} -> ${response.status}`, response.ok ? "success" : "failed")

        // 404 means product doesn't exist on nexus — caller should create it instead
        if (response.status === 404) {
            return { ok: false, error: "Product not found on nexus", status: 404 }
        }

        if (!response.ok) {
            return {
                ok: false,
                error: await readErrorMessage(response, `Nexus update failed (HTTP ${response.status})`),
                status: response.status,
            }
        }

        const data = await response.json()
        return { ok: true, nexusId: asString(data?.id) ?? nexusProductId }
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown nexus update error",
        }
    }
}

/**
 * Fetches all products from nexusprods.
 *
 * Throws when the response is malformed so callers never treat a broken
 * response as "everything was deleted".
 *
 * The `total` is the number of products Nexus itself counts. A response
 * whose `products` array is shorter than `total` was filtered or truncated
 * upstream, and must not be used to decide that local projects are missing.
 */
export async function getAllNexusProducts(
    idToken: string
): Promise<{ products: NexusProduct[]; total: number }> {
    const url = getNexusApiUrl()

    debugLog(`[Nexus Sync] GET ${url}`, { hasAuth: !!idToken })

    const response = await nexusFetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
    })

    debugLog(`[Nexus Sync] GET ${url} -> ${response.status}`, response.ok ? "success" : "failed")

    if (!response.ok) {
        throw new Error(`Nexus fetch failed (HTTP ${response.status})`)
    }

    const data = await response.json()

    if (!Array.isArray(data?.products)) {
        throw new Error("Nexus response did not include a products array")
    }

    const products = data.products as NexusProduct[]
    const total = asFiniteNumber(data?.summary?.total) ?? products.length

    return { products, total }
}
