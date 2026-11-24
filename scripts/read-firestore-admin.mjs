// Reads documents with a service account (bypasses the Firestore rules).
// Read-only — used to verify documents that the rules hide from the public.
import { createSign } from "node:crypto"
import { readFileSync } from "node:fs"

const [, , projectId, path, serviceAccountFile] = process.argv
const FIRESTORE = "https://firestore.googleapis.com/v1"

const serviceAccount = JSON.parse(readFileSync(serviceAccountFile, "utf8"))

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
const issuedAt = Math.floor(Date.now() / 1000)
const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
})}`
const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(serviceAccount.private_key, "base64url")

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${signature}`,
    }),
})
const { access_token: token } = await tokenResponse.json()

const response = await fetch(
    `${FIRESTORE}/projects/${projectId}/databases/(default)/documents/${path}?pageSize=1000`,
    { headers: { Authorization: `Bearer ${token}` } }
)
const text = await response.text()

if (!response.ok) {
    console.log(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    process.exit(1)
}

const data = JSON.parse(text)
console.log(`${projectId}/${path}: ${(data.documents ?? []).length} doc(s)`)
for (const doc of data.documents ?? []) {
    console.log(`\n--- ${doc.name.split("/").pop()} ---`)
    console.log(JSON.stringify(doc.fields ?? {}, null, 2))
}
