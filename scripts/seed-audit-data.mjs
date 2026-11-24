// Seeds the Firestore emulator with a catalogue that exercises the UI edge
// cases: duplicate tags, duplicate image URLs, a project without a category,
// waitlist entries and public requests.
//
// Run inside `firebase emulators:exec --only auth,firestore`.
const PROJECT_ID = "company-24267"
const DOCS = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const HOST = "http://127.0.0.1:8099"
const AUTH_HOST = "http://127.0.0.1:9099"
const API_KEY = "fake-api-key"

async function authRequest(path, body, admin = false) {
    const base = admin
        ? `${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`
        : `${AUTH_HOST}/identitytoolkit.googleapis.com/v1`

    const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
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
    const response = await fetch(`${HOST}${DOCS}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    return { status: response.status, ok: response.ok, text: await response.text() }
}

// --- admin user -----------------------------------------------------------
const signIn = await authRequest("/accounts:signInWithPassword", {
    email: "developerlife69@gmail.com",
    password: "local-test-password",
    returnSecureToken: true,
})

let token
let localId = signIn.json?.localId

if (!signIn.ok) {
    const signUp = await authRequest("/accounts:signUp", {
        email: "developerlife69@gmail.com",
        password: "local-test-password",
        returnSecureToken: true,
    })
    if (!signUp.ok) {
        console.error("signUp failed:", JSON.stringify(signUp.json))
        process.exit(1)
    }
    localId = signUp.json?.localId
} else {
    token = signIn.json.idToken
}

const update = await authRequest(
    "/accounts:update",
    { localId, email: "developerlife69@gmail.com", password: "local-test-password", emailVerified: true },
    true
)
if (!update.ok) {
    console.error("verify failed:", JSON.stringify(update.json))
    process.exit(1)
}

const verifiedSignIn = await authRequest("/accounts:signInWithPassword", {
    email: "developerlife69@gmail.com",
    password: "local-test-password",
    returnSecureToken: true,
})
token = verifiedSignIn.json.idToken
console.log(`auth: admin ready (${localId})`)

// --- projects -------------------------------------------------------------
const now = new Date().toISOString()

const projects = [
    {
        id: "seedProjectOne",
        title: "Seed Project One",
        slug: "seed-project-one",
        description: "A normal project with ordinary data.",
        shortDescription: "Ordinary data.",
        status: "active",
        category: "SaaS",
        pricing: "29",
        tags: ["alpha", "beta"],
        techStack: ["Next.js", "Firebase"],
        features: ["Feature one", "Feature two"],
        images: [],
        websiteUrl: "https://example.com",
        imageUrl: "",
        launchDate: "2026-01-01",
        waitlistCount: 1,
    },
    {
        id: "seedProjectTwo",
        title: "Seed Project Two",
        slug: "seed-project-two",
        description: "A project with duplicate tags, duplicate images and no category.",
        shortDescription: "Duplicate values everywhere.",
        status: "coming_soon",
        // Deliberate duplicates: React needs unique keys and the UI should
        // not show the same badge twice.
        tags: ["dup", "dup", "other"],
        techStack: ["React", "React"],
        features: ["Only feature"],
        images: ["https://example.com/a.png", "https://example.com/a.png"],
        websiteUrl: "",
        imageUrl: "",
        waitlistCount: 0,
    },
]

for (const project of projects) {
    const fields = {}
    for (const [key, value] of Object.entries(project)) {
        if (key === "id") continue
        if (typeof value === "number") fields[key] = { integerValue: String(value) }
        else if (Array.isArray(value)) {
            fields[key] = { arrayValue: { values: value.map((item) => ({ stringValue: item })) } }
        } else fields[key] = { stringValue: value }
    }
    fields.createdAt = { timestampValue: now }
    fields.updatedAt = { timestampValue: now }

    const result = await firestoreRequest(
        "PATCH",
        `/projects/${project.id}`,
        token,
        { fields }
    )
    console.log(`firestore: projects/${project.id} -> HTTP ${result.status}`)
}

// --- waitlist -------------------------------------------------------------
for (const [id, projectId, email] of [
    ["seedProjectOne_audit@example.com", "seedProjectOne", "audit@example.com"],
    ["seedProjectTwo_audit@example.com", "seedProjectTwo", "audit@example.com"],
]) {
    const result = await firestoreRequest("PATCH", `/waitlist/${id}`, token, {
        fields: {
            projectId: { stringValue: projectId },
            email: { stringValue: email },
            createdAt: { timestampValue: now },
        },
    })
    console.log(`firestore: waitlist/${id} -> HTTP ${result.status}`)
}

// --- requests -------------------------------------------------------------
for (const [id, title, projectId] of [
    ["seedRequestOne", "A tool that does something useful", "seedProjectOne"],
    ["seedRequestTwo", "Another tool idea", ""],
]) {
    const result = await firestoreRequest("PATCH", `/requests/${id}`, token, {
        fields: {
            title: { stringValue: title },
            description: { stringValue: "Seeded for the audit." },
            email: { stringValue: "requester@example.com" },
            projectId: { stringValue: projectId },
            status: { stringValue: "new" },
            createdAt: { timestampValue: now },
        },
    })
    console.log(`firestore: requests/${id} -> HTTP ${result.status}`)
}

// --- taxonomy -------------------------------------------------------------
for (const [field, values] of [
    ["categories", ["SaaS", "Finance", "Productivity"]],
    ["tags", ["alpha", "beta", "dup"]],
    ["techStack", ["Next.js", "Firebase", "React"]],
    ["features", ["Feature one", "Feature two", "Only feature"]],
]) {
    const result = await firestoreRequest("PATCH", `/taxonomy/${field}`, token, {
        fields: {
            values: { arrayValue: { values: values.map((value) => ({ stringValue: value })) } },
            updatedAt: { timestampValue: now },
        },
    })
    console.log(`firestore: taxonomy/${field} -> HTTP ${result.status}`)
}

console.log("\nseed complete")
