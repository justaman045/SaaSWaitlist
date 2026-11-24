// Verifies the admin paths in firestore.rules using a crafted admin JWT
// (the emulator decodes the claims without verifying the signature).
import { initializeApp } from "firebase/app"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"

const app = initializeApp({ apiKey: "demo-key", projectId: "demo-saaswaitlist" })
const db = getFirestore(app)
connectFirestoreEmulator(db, "127.0.0.1", 8099)

function craftJwt(payload) {
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url")
    return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.`
}

const ADMIN = craftJwt({
    sub: "admin-user-id",
    user_id: "admin-user-id",
    email: "developerlife69@gmail.com",
    email_verified: true,
    firebase: { sign_in_provider: "password" },
    aud: "demo-saaswaitlist",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
})

const NON_ADMIN = craftJwt({
    sub: "random-user-id",
    user_id: "random-user-id",
    email: "someone@example.com",
    email_verified: true,
    firebase: { sign_in_provider: "password" },
    aud: "demo-saaswaitlist",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
})

const HOST = "http://127.0.0.1:8099"
const DOCS = "/v1/projects/demo-saaswaitlist/databases/(default)/documents"

async function rest(method, path, token, body) {
    const response = await fetch(`${HOST}${DOCS}${path}`, {
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

let passed = 0
let failed = 0
function report(label, result, expectedOk) {
    if (result.ok === expectedOk) {
        passed++
        console.log(`  PASS  ${label} (HTTP ${result.status})`)
    } else {
        failed++
        console.log(`  FAIL  ${label} (HTTP ${result.status}) :: ${result.text.slice(0, 220)}`)
    }
}

// Seed one request as an admin, via the REST API.
const seeded = await rest("POST", "/requests", ADMIN, {
    fields: {
        title: { stringValue: "Admin test request" },
        description: { stringValue: "" },
        email: { stringValue: "admin-test@example.com" },
        projectId: { stringValue: "" },
        status: { stringValue: "new" },
        createdAt: { timestampValue: new Date().toISOString() },
    },
})
report("admin create request (seed)", seeded, true)

// The REST API returns the full resource name — keep just the document id.
const requestId = seeded.ok ? JSON.parse(seeded.text).name.split("/").pop() : "missing"

console.log("\n--- admin (developerlife69@gmail.com, verified) ---")
report("admin read requests", await rest("GET", "/requests", ADMIN), true)
report("admin update request status", await rest("PATCH", `/requests/${requestId}`, ADMIN, {
    fields: { status: { stringValue: "accepted" } },
}), true)
report("admin delete request", await rest("DELETE", `/requests/${requestId}`, ADMIN), true)
report("admin write taxonomy", await rest("PATCH", "/taxonomy/categories", ADMIN, {
    fields: { values: { arrayValue: { values: [{ stringValue: "AI" }] } } },
}), true)
report("admin read waitlist", await rest("GET", "/waitlist", ADMIN), true)

console.log("\n--- signed-in but NOT allowlisted ---")
report("non-admin read requests", await rest("GET", "/requests", NON_ADMIN), false)
report("non-admin delete request", await rest("DELETE", "/requests/anything", NON_ADMIN), false)
report("non-admin write taxonomy", await rest("PATCH", "/taxonomy/tags", NON_ADMIN, {
    fields: { values: { arrayValue: { values: [{ stringValue: "X" }] } } },
}), false)

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
