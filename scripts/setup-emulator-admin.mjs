// Sets up the local Firebase emulators for an end-to-end admin test.
//
//  1. Creates the admin user in the Auth emulator and marks it verified
//     (the Firestore rules require `email_verified == true`).
//  2. Seeds a couple of request documents.
//  3. Prints the credentials so the browser can sign in.
//
// Run inside `firebase emulators:exec --only auth,firestore`.
import { readFileSync } from "node:fs"

// The Auth emulator checks the API key the same way production does.
const envFile = readFileSync(".env.local", "utf8")
const API_KEY =
    envFile.match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.*)$/m)?.[1]?.trim() ?? "fake-api-key"

// The project id comes from .env.local so the script keeps working when
// the app is pointed at a different Firebase project. The emulator accepts
// any project id, but the SDK and the emulator must agree on the namespace.
const PROJECT_ID =
    envFile.match(/^NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.*)$/m)?.[1]?.trim() ?? "company-24267"

const AUTH_HOST = "http://127.0.0.1:9099"
const FIRESTORE_HOST = "http://127.0.0.1:8099"
const DOCS = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const ADMIN_EMAIL = "developerlife69@gmail.com"
const ADMIN_PASSWORD = "local-test-password"

console.log(`emulator: project id ${PROJECT_ID}`)

/**
 * Calls the Auth emulator.
 *
 * Public client endpoints live at `/v1/accounts:*`; the admin endpoint
 * (needed to flip `emailVerified`) lives at `/v1/projects/<id>/accounts:update`.
 */
async function authRequest(path, body, admin = false) {
    const base = admin
        ? `${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`
        : `${AUTH_HOST}/identitytoolkit.googleapis.com/v1`

    const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            // The emulator treats "owner" as an administrator.
            ...(admin ? { Authorization: "Bearer owner" } : {}),
        },
        body: JSON.stringify(body),
    })
    const text = await response.text()
    let json
    try {
        json = JSON.parse(text)
    } catch {
        json = { raw: text }
    }
    return { status: response.status, ok: response.ok, json }
}

async function firestoreRequest(method, path, token, body) {
    const response = await fetch(`${FIRESTORE_HOST}${DOCS}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()
    return { status: response.status, ok: response.ok, text }
}

// --- 1. create + verify the admin user -------------------------------------
// Sign in first: it works for both a brand-new and an existing account, and
// it hands back the uid we need for the admin endpoint. If the account does
// not exist yet, create it and take the uid from that response instead.
let auth = await authRequest("/accounts:signInWithPassword", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    returnSecureToken: true,
})

if (!auth.ok) {
    auth = await authRequest("/accounts:signUp", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        returnSecureToken: true,
    })
    if (!auth.ok) {
        console.error("signUp failed:", JSON.stringify(auth.json))
        process.exit(1)
    }
}

const localId = auth.json?.localId
if (!localId) {
    console.error("could not determine the admin uid:", JSON.stringify(auth.json))
    process.exit(1)
}
console.log(`auth: ${ADMIN_EMAIL} (uid ${localId})`)

const update = await authRequest(
    "/accounts:update",
    {
        localId,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        emailVerified: true,
    },
    true
)

if (!update.ok) {
    console.error("verify failed:", JSON.stringify(update.json))
    process.exit(1)
}
console.log("auth: email marked verified")

// Sign in again so the id token carries email_verified: true.
const signIn = await authRequest("/accounts:signInWithPassword", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    returnSecureToken: true,
})

if (!signIn.ok) {
    console.error("signIn failed:", JSON.stringify(signIn.json))
    process.exit(1)
}

const token = signIn.json.idToken
const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
console.log(`auth: token claims email=${claims.email} email_verified=${claims.email_verified}`)

if (claims.email_verified !== true) {
    console.error("token is not verified — isAdmin() would reject it")
    process.exit(1)
}

// --- 2. seed request documents --------------------------------------------
for (const [id, title] of [
    ["E2ErequestOne", "E2E request one — should disappear"],
    ["E2ErequestTwo", "E2E request two — should disappear"],
]) {
    const result = await firestoreRequest(
        "PATCH",
        `/requests/${id}`,
        token,
        {
            fields: {
                title: { stringValue: title },
                description: { stringValue: "Seeded by the local end-to-end test." },
                email: { stringValue: "e2e@example.com" },
                projectId: { stringValue: "" },
                status: { stringValue: "new" },
                createdAt: { timestampValue: new Date().toISOString() },
            },
        }
    )
    console.log(`firestore: seeded requests/${id} -> HTTP ${result.status}`)
}
// --- 3. hand the credentials to the caller --------------------------------
console.log(`\nADMIN_EMAIL=${ADMIN_EMAIL}`)
console.log(`ADMIN_PASSWORD=${ADMIN_PASSWORD}`)
console.log(`ADMIN_TOKEN=${token}`)
