// Dumps the source project's `projects` / `waitlist` documents (read-only,
// public REST API) so the migration plan can be reviewed before it is applied.
const FIRESTORE = "https://firestore.googleapis.com/v1"
const SOURCE_PROJECT_ID = process.env.SOURCE_PROJECT_ID ?? "saaswaitlist-7280f"
const SOURCE_API_KEY = process.env.SOURCE_API_KEY ?? ""

async function readCollection(path) {
    const url = `${FIRESTORE}/projects/${SOURCE_PROJECT_ID}/databases/(default)/documents/${path}?key=${SOURCE_API_KEY}&pageSize=1000`
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`${path}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`)
    }
    return JSON.parse(await response.text()).documents ?? []
}

for (const collection of ["projects", "waitlist"]) {
    const documents = await readCollection(collection)
    console.log(`\n=== ${SOURCE_PROJECT_ID}/${collection} (${documents.length}) ===`)
    for (const doc of documents) {
        console.log(`\n--- ${doc.name.split("/").pop()} ---`)
        for (const [field, value] of Object.entries(doc.fields ?? {})) {
            const kind = Object.keys(value)[0]
            const raw = kind === "timestampValue" || kind === "mapValue" || kind === "arrayValue"
                ? JSON.stringify(value[kind])
                : value[kind]
            console.log(`  ${field} (${kind}): ${String(raw).slice(0, 220)}`)
        }
    }
}
