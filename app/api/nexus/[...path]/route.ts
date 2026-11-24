import { getNexusUpstreamApiUrl } from "@/lib/nexus-url"
import { IS_EMULATOR } from "@/lib/firebase-target"

/**
 * Same-origin proxy for the Nexus products API.
 *
 * Why this exists: the browser cannot call nexusprods directly. Nexus only
 * returns `Access-Control-Allow-Origin` for a fixed list of origins, and a
 * request from an origin that is not on that list is reported to the user as
 * "blocked by CORS policy" — the real HTTP status is swallowed by the
 * browser. The deployed SaaSWaitlist origin was not on Nexus's list, so the
 * admin dashboard (reconciliation, create, update, delete) could not talk to
 * Nexus at all.
 *
 * Forwarding the call server-side removes CORS from the equation entirely
 * and keeps the two Vercel projects independent of each other's
 * configuration.
 *
 * The proxy is deliberately narrow:
 *   - it only forwards the `products` collection and a single product id,
 *   - it only ever talks to the configured Nexus base URL,
 *   - it requires the caller's Firebase ID token and passes it straight
 *     through, so Nexus remains the authority on who may write.
 */

/** Route handlers are never cached — every call carries an admin token. */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * How long the upstream Nexus call may take.
 *
 * Without a timeout a hanging upstream keeps the request open until the
 * platform kills it. The admin then waits for a generic timeout instead of
 * a message that says what went wrong.
 */
const UPSTREAM_TIMEOUT_MS = 15_000

type ProxyContext = { params: Promise<{ path: string[] }> }

/**
 * Builds the upstream URL from the requested path.
 *
 * Only `/products` and `/products/<id>` are allowed — anything else is a
 * 404. Path segments are re-encoded so a crafted id cannot escape the
 * products collection.
 */
function buildUpstreamUrl(path: string[]): string | null {
    if (path[0] !== "products") return null
    if (path.length > 2) return null

    const base = getNexusUpstreamApiUrl()
    if (path.length === 1) return base

    return `${base}/${encodeURIComponent(path[1])}`
}

async function proxy(request: Request, context: ProxyContext): Promise<Response> {
    const { path } = await context.params

    const upstreamUrl = buildUpstreamUrl(path ?? [])
    if (!upstreamUrl) {
        return Response.json(
            { error: "Unknown Nexus endpoint." },
            { status: 404, headers: { "Cache-Control": "no-store" } }
        )
    }

    // The emulator issues unsigned (`alg: none`) tokens. Nexus's edge
    // rejects those with 403 before the request reaches the app, and the
    // browser then reports the missing CORS header instead. Refuse early
    // with a message that explains what is actually going on.
    if (IS_EMULATOR) {
        return Response.json(
            {
                error:
                    "Nexus sync is unavailable while the app runs against the local Firebase emulator.",
            },
            { status: 503, headers: { "Cache-Control": "no-store" } }
        )
    }

    const authorization = request.headers.get("authorization")
    if (!authorization) {
        return Response.json(
            { error: "Missing Authorization header — sign in as an admin before syncing." },
            { status: 401, headers: { "Cache-Control": "no-store" } }
        )
    }

    const headers: Record<string, string> = { Authorization: authorization }
    const contentType = request.headers.get("content-type")
    if (contentType) headers["Content-Type"] = contentType

    const hasBody = request.method !== "GET" && request.method !== "HEAD"
    const body = hasBody ? await request.text() : undefined

    let upstream: Response
    try {
        upstream = await fetch(upstreamUrl, {
            method: request.method,
            headers,
            body: body && body.length > 0 ? body : undefined,
            cache: "no-store",
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
    } catch (error) {
        const timedOut =
            error instanceof Error &&
            (error.name === "TimeoutError" || error.name === "AbortError")

        return Response.json(
            {
                error: timedOut
                    ? `Nexus did not respond within ${UPSTREAM_TIMEOUT_MS / 1000} seconds.`
                    : `Could not reach Nexus: ${
                          error instanceof Error ? error.message : String(error)
                      }`,
            },
            {
                status: timedOut ? 504 : 502,
                headers: { "Cache-Control": "no-store" },
            }
        )
    }

    const payload = await upstream.text()

    return new Response(payload, {
        status: upstream.status,
        headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "application/json",
            "Cache-Control": "no-store",
        },
    })
}

export const GET = proxy
export const POST = proxy
// Nexus exposes PATCH (not PUT) on `/api/products/[id]`. Forwarding PUT
// would only ever produce an upstream 405.
export const PATCH = proxy
export const DELETE = proxy
