// Migrates the SaaSWaitlist catalogue from the project's previous Firebase
// project into the one this repo is configured against.
//
// Why it exists: `saaswaitlist-7280f` (the previous project) still holds the
// catalogue and the waitlist entries, but it runs an old ruleset that has no
// `requests` block and allows public reads of the waitlist. `company-24267`
// (the project this repo targets) has the current ruleset but no data.
//
// The target is written with a service account so the new Firestore rules are
// bypassed — this is a deliberate one-off data move, not an app write path.
//
// Usage:
//   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
//   SOURCE_API_KEY=... node scripts/migrate-to-company-24267.mjs            # dry run
//   FIREBASE_SERVICE_ACCOUNT='...' SOURCE_API_KEY=... \
//   node scripts/migrate-to-company-24267.mjs --apply                      # write
//
// Notes:
//   - Document ids are preserved for `projects` (other documents reference
//     them by id).
//   - `waitlist` documents are re-keyed to `<projectId>_<email>`, which is
//     what the current rules require. The legacy auto-generated ids would
//     otherwise let the same email sign up twice.
//   - `waitlistCount` is recalculated from the migrated entries.
import { createSign } from "node:crypto"
import { readFileSync } from "node:fs"

const FIRESTORE = "https://firestore.googleapis.com/v1"

const SOURCE_PROJECT_ID = process.env.SOURCE_PROJECT_ID ?? "saaswaitlist-7280f"
const TARGET_PROJECT_ID = process.env.TARGET_PROJECT_ID ?? "company-24267"
const SOURCE_API_KEY = process.env.SOURCE_API_KEY ?? ""
const APPLY = process.argv.includes("--apply")

if (!SOURCE_API_KEY) {
    console.error("SOURCE_API_KEY is required (the API key of the source project)")
    process.exit(1)
}

function readServiceAccount() {
    const fileIndex = process.argv.indexOf("--service-account-file")
    if (fileIndex !== -1) {
        return JSON.parse(readFileSync(process.argv[fileIndex + 1], "utf8"))
    }
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) {
        console.error(
            "Set FIREBASE_SERVICE_ACCOUNT (JSON) or pass --service-account-file <path>"
        )
        process.exit(1)
    }
    return JSON.parse(raw)
}

/** Mints an access token for the service account (RS256 JWT bearer flow). */
async function serviceAccountToken(serviceAccount) {
    const issuedAt = Math.floor(Date.now() / 1000)
    const header = { alg: "RS256", typ: "JWT" }
    const claims = {
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: issuedAt,
        exp: issuedAt + 3600,
    }

    const encode = (value) =>
        Buffer.from(JSON.stringify(value)).toString("base64url")

    const unsigned = `${encode(header)}.${encode(claims)}`
    const signature = createSign("RSA-SHA256")
        .update(unsigned)
        .sign(serviceAccount.private_key, "base64url")

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: `${unsigned}.${signature}`,
        }),
    })

    const data = await response.json()
    if (!response.ok || !data.access_token) {
        throw new Error(`token exchange failed: ${JSON.stringify(data)}`)
    }
    return data.access_token
}

/** Reads a whole collection through the public REST API. */
async function readCollection(projectId, apiKey, path) {
    const url = `${FIRESTORE}/projects/${projectId}/databases/(default)/documents/${path}?key=${apiKey}&pageSize=1000`
    const response = await fetch(url)
    const text = await response.text()

    if (!response.ok) {
        let message = text.slice(0, 160)
        try {
            message = JSON.parse(text).error?.message ?? message
        } catch {}
        throw new Error(`${projectId}/${path}: ${message}`)
    }

    return JSON.parse(text).documents ?? []
}

/** Writes a document with the service account (bypasses the Firestore rules). */
async function writeDocument(token, projectId, path, id, fields) {
    const url = `${FIRESTORE}/projects/${projectId}/databases/(default)/documents/${path}/${encodeURIComponent(id)}`
    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields }),
    })

    const text = await response.text()
    if (!response.ok) {
        throw new Error(`write ${path}/${id} failed (HTTP ${response.status}): ${text.slice(0, 300)}`)
    }
    return text
}

// --- read the source -------------------------------------------------------
const sourceProjects = await readCollection(
    SOURCE_PROJECT_ID,
    SOURCE_API_KEY,
    "projects"
)
const sourceWaitlist = await readCollection(
    SOURCE_PROJECT_ID,
    SOURCE_API_KEY,
    "waitlist"
)

console.log(
    `source ${SOURCE_PROJECT_ID}: ${sourceProjects.length} project(s), ${sourceWaitlist.length} waitlist entry(ies)\n`
)

// --- build the plan --------------------------------------------------------
const plan = []

// Waitlist entries are re-keyed to `<projectId>_<email>`.
for (const doc of sourceWaitlist) {
    const fields = doc.fields ?? {}
    const projectId = fields.projectId?.stringValue
    const email = fields.email?.stringValue
    if (!projectId || !email) {
        console.error(`skipping waitlist/${doc.name.split("/").pop()}: no projectId/email`)
        continue
    }
    plan.push({
        collection: "waitlist",
        id: `${projectId}_${email}`,
        fromId: doc.name.split("/").pop(),
        fields,
    })
}

// The waitlist count per project, recalculated from the migrated entries.
const counts = new Map()
for (const entry of plan) {
    const projectId = entry.fields.projectId?.stringValue
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1)
}

for (const doc of sourceProjects) {
    const id = doc.name.split("/").pop()
    const fields = { ...(doc.fields ?? {}) }
    fields.waitlistCount = { integerValue: String(counts.get(id) ?? 0) }
    plan.push({ collection: "projects", id, fromId: id, fields })
}

console.log("plan:")
for (const item of plan) {
    const label =
        item.fields.title?.stringValue ?? item.fields.email?.stringValue ?? ""
    console.log(
        `  ${item.collection}/${item.id}${item.fromId !== item.id ? `  (re-keyed from ${item.fromId})` : ""}  ${label}`
    )
}

if (!APPLY) {
    console.log("\n(dry run — pass --apply to write)")
    process.exit(0)
}

// --- write the target ------------------------------------------------------
const serviceAccount = readServiceAccount()
if (serviceAccount.project_id !== TARGET_PROJECT_ID) {
    console.error(
        `service account belongs to ${serviceAccount.project_id}, expected ${TARGET_PROJECT_ID}`
    )
    process.exit(1)
}

const token = await serviceAccountToken(serviceAccount)
for (const item of plan) {
    await writeDocument(token, TARGET_PROJECT_ID, item.collection, item.id, item.fields)
    console.log(`  wrote ${item.collection}/${item.id}`)
}

console.log(`\nmigrated ${plan.length} document(s) into ${TARGET_PROJECT_ID}`)
