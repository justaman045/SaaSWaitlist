// Lists the request documents that exist in the Firestore emulator.
// Read-only — used to confirm that a UI delete really removed the document.
import { readFileSync } from "node:fs"

// The project id comes from .env.local so the script keeps working when
// the app is pointed at a different Firebase project.
const envFile = readFileSync(".env.local", "utf8")
const PROJECT_ID =
    envFile.match(/^NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.*)$/m)?.[1]?.trim() ?? "company-24267"

const DOCS = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const HOST = "http://127.0.0.1:8099"

const response = await fetch(`${HOST}${DOCS}/requests`, {
    headers: { Authorization: "Bearer owner" },
})

const text = await response.text()
if (!response.ok) {
    console.log(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    process.exit(1)
}

const data = JSON.parse(text)
const ids = (data.documents ?? []).map((doc) => doc.name.split("/").pop())
console.log(`requests in the emulator (${ids.length}): ${ids.join(", ") || "(none)"}`)
