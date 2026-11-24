// Inventories the documents in a Firebase project through the Firestore REST
// API. Read-only — used to plan the data migration between projects.
const [, , projectId, apiKey] = process.argv
const HOST = "https://firestore.googleapis.com/v1"

const COLLECTIONS = [
    "projects",
    "waitlist",
    "requests",
    "taxonomy/categories",
    "taxonomy/tags",
    "taxonomy/techStack",
    "taxonomy/features",
    "products",
    "content",
    "settings",
]

async function readCollection(path) {
    const url = `${HOST}/projects/${projectId}/databases/(default)/documents/${path}?key=${apiKey}&pageSize=1000`
    const response = await fetch(url)
    const text = await response.text()

    if (!response.ok) {
        let message = text.slice(0, 120)
        try {
            message = JSON.parse(text).error?.message ?? message
        } catch {}
        return { error: message, docs: [] }
    }

    const data = JSON.parse(text)
    return { error: null, docs: data.documents ?? [] }
}

for (const collection of COLLECTIONS) {
    const { error, docs } = await readCollection(collection)
    if (error) {
        console.log(`${collection.padEnd(24)} DENIED  ${error.slice(0, 70)}`)
        continue
    }
    console.log(`${collection.padEnd(24)} ${String(docs.length).padStart(4)} docs`)
    for (const doc of docs) {
        const fields = doc.fields ?? {}
        const title =
            fields.title?.stringValue ??
            fields.name?.stringValue ??
            fields.slug?.stringValue ??
            fields.email?.stringValue ??
            fields.projectId?.stringValue ??
            "(no title)"
        console.log(`                 - ${doc.name.split("/").pop()}  ${title}`)
    }
}
