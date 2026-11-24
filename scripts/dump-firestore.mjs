// Dumps the raw Firestore documents of a collection through the REST API.
const [, , projectId, apiKey, ...paths] = process.argv
const HOST = "https://firestore.googleapis.com/v1"

for (const path of paths) {
    const url = `${HOST}/projects/${projectId}/databases/(default)/documents/${path}?key=${apiKey}&pageSize=1000`
    const response = await fetch(url)
    const text = await response.text()

    console.log(`\n=== ${projectId}/${path} ===`)
    if (!response.ok) {
        console.log("DENIED:", text.slice(0, 200))
        continue
    }

    const data = JSON.parse(text)
    for (const doc of data.documents ?? []) {
        console.log(`\n--- ${doc.name.split("/").pop()} ---`)
        console.log(JSON.stringify(doc.fields ?? {}, null, 2))
    }
}
