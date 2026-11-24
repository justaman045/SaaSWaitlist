// Validates firestore.rules against the local Firestore emulator.
//
// The rules file is shared with nexusprods on project `company-24267`, so
// run this before every rules deploy:
//
//   firebase emulators:exec --only firestore --project demo-saaswaitlist \
//     --config scripts/firebase.emulator.json "node scripts/verify-firestore-rules.cjs"
//
// Note: the emulator reports "evaluation error" instead of a clean `false`
// when a document carries a pending `serverTimestamp()` and the rule denies
// it. That is an emulator diagnostic artifact — the write is rejected either
// way, and allowed documents are unaffected.
import { initializeApp } from "firebase/app"
import {
    getFirestore,
    connectFirestoreEmulator,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    runTransaction,
    serverTimestamp,
} from "firebase/firestore"

const app = initializeApp({
    apiKey: "demo-key",
    projectId: "demo-saaswaitlist",
})

const db = getFirestore(app)
connectFirestoreEmulator(db, "127.0.0.1", 8099)

const EMULATOR_HOST = "http://127.0.0.1:8099"
const DATABASE_PATH =
    "/v1/projects/demo-saaswaitlist/databases/(default)/documents"

/** Seeds a document as an emulator admin (the "owner" token bypasses rules). */
async function seedAdmin(collectionPath, docId, fields) {
    const url = `${EMULATOR_HOST}${DATABASE_PATH}/${collectionPath}/${docId}`
    const body = { fields }
    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer owner",
        },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        throw new Error(`seed failed: ${response.status} ${await response.text()}`)
    }
}

let passed = 0
let failed = 0

async function check(label, fn, expectation) {
    try {
        await fn()
        if (expectation === "allow") {
            passed++
            console.log(`  PASS  ${label} (allowed, as expected)`)
        } else {
            failed++
            console.log(`  FAIL  ${label} (allowed, expected ${expectation})`)
        }
    } catch (error) {
        const code = error?.code ?? error?.message ?? "unknown"
        if (expectation === "deny") {
            passed++
            console.log(`  PASS  ${label} (denied: ${code}, as expected)`)
        } else {
            failed++
            console.log(`  FAIL  ${label} (denied: ${code}, expected ${expectation})`)
        }
        // Surface rule-evaluation errors — a clean denial and an evaluation
        // error both reject the write, but only one of them is correct.
        const detail = String(error?.message ?? "")
        if (detail.includes("evaluation error")) {
            console.log(`        !! rule evaluation error: ${detail.split("\n").slice(0, 4).join(" | ")}`)
        }
    }
}

const validRequest = {
    title: "AI meeting notes",
    description: "Transcribes calls",
    email: "someone@example.com",
    projectId: "",
    status: "new",
    createdAt: null, // filled with serverTimestamp()
}

console.log("\n--- seeding a project as emulator admin ---")
await seedAdmin("projects", "seed-project", {
    title: { stringValue: "Seed Project" },
    slug: { stringValue: "seed-project" },
    status: { stringValue: "active" },
    waitlistCount: { integerValue: "0" },
})
console.log("  seeded projects/seed-project")

console.log("\n--- taxonomy ---")
await check("public read taxonomy/categories", async () => {
    await getDoc(doc(db, "taxonomy", "categories"))
}, "allow")
await check("public write taxonomy/categories", async () => {
    await setDoc(doc(db, "taxonomy", "categories"), { values: ["Hacked"] })
}, "deny")

console.log("\n--- requests: public create ---")
await check("valid request (empty projectId)", async () => {
    await addDoc(collection(db, "requests"), {
        ...validRequest,
        createdAt: serverTimestamp(),
    })
}, "allow")
await check("valid request (existing projectId)", async () => {
    await addDoc(collection(db, "requests"), {
        ...validRequest,
        projectId: "seed-project",
        createdAt: serverTimestamp(),
    })
}, "allow")
await check("request missing the projectId field entirely", async () => {
    const { projectId, ...withoutProjectId } = validRequest
    void projectId
    await addDoc(collection(db, "requests"), {
        ...withoutProjectId,
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("request with non-existent projectId", async () => {
    await addDoc(collection(db, "requests"), {
        ...validRequest,
        projectId: "does-not-exist",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("request trying to set status=accepted", async () => {
    await addDoc(collection(db, "requests"), {
        ...validRequest,
        status: "accepted",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("request with invalid email", async () => {
    await addDoc(collection(db, "requests"), {
        ...validRequest,
        email: "not-an-email",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("request with empty title", async () => {
    await addDoc(collection(db, "requests"), {
        ...validRequest,
        title: "",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("request with extra field", async () => {
    await addDoc(collection(db, "requests"), {
        ...validRequest,
        sneaky: "value",
        createdAt: serverTimestamp(),
    })
}, "deny")

console.log("\n--- requests: admin-only reads/writes ---")
await check("public read requests", async () => {
    await getDocs(collection(db, "requests"))
}, "deny")
await check("public update requests", async () => {
    const snap = await getDocs(collection(db, "requests"))
    await updateDoc(doc(db, "requests", snap.docs[0].id), { status: "accepted" })
}, "deny")
await check("public delete requests", async () => {
    const snap = await getDocs(collection(db, "requests"))
    await deleteDoc(doc(db, "requests", snap.docs[0].id))
}, "deny")

console.log("\n--- existing rules still intact ---")
await check("public read projects", async () => {
    await getDocs(collection(db, "projects"))
}, "allow")
await check("public read waitlist", async () => {
    await getDocs(collection(db, "waitlist"))
}, "deny")

console.log("\n--- waitlist: public create ---")
await check("valid waitlist entry", async () => {
    await setDoc(doc(db, "waitlist", "seed-project_someone@example.com"), {
        projectId: "seed-project",
        email: "someone@example.com",
        createdAt: serverTimestamp(),
    })
}, "allow")
await check("waitlist entry with a mismatched document id", async () => {
    await setDoc(doc(db, "waitlist", "seed-project_other@example.com"), {
        projectId: "seed-project",
        email: "someoneelse@example.com",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("waitlist entry with an uppercase email", async () => {
    await setDoc(doc(db, "waitlist", "seed-project_Mixed@example.com"), {
        projectId: "seed-project",
        email: "Mixed@example.com",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("waitlist entry with whitespace in the email", async () => {
    await setDoc(doc(db, "waitlist", "seed-project_spacey@example.com"), {
        projectId: "seed-project",
        email: " spacey@example.com",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("waitlist entry with a non-timestamp createdAt", async () => {
    await setDoc(doc(db, "waitlist", "seed-project_stamped@example.com"), {
        projectId: "seed-project",
        email: "stamped@example.com",
        createdAt: "2026-01-01T00:00:00.000Z",
    })
}, "deny")
await check("waitlist entry missing the email field", async () => {
    await setDoc(doc(db, "waitlist", "seed-project_noemail"), {
        projectId: "seed-project",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("waitlist entry with an extra field", async () => {
    await setDoc(doc(db, "waitlist", "seed-project_extra@example.com"), {
        projectId: "seed-project",
        email: "extra@example.com",
        createdAt: serverTimestamp(),
        sneaky: "value",
    })
}, "deny")
await check("waitlist entry for a non-existent project", async () => {
    await setDoc(doc(db, "waitlist", "does-not-exist_orphan@example.com"), {
        projectId: "does-not-exist",
        email: "orphan@example.com",
        createdAt: serverTimestamp(),
    })
}, "deny")
await check("public update of a waitlist entry", async () => {
    await updateDoc(doc(db, "waitlist", "seed-project_someone@example.com"), {
        email: "someoneelse@example.com",
    })
}, "deny")
await check("public delete of a waitlist entry", async () => {
    await deleteDoc(doc(db, "waitlist", "seed-project_someone@example.com"))
}, "deny")

console.log("\n--- projects: the public waitlist counter bump ---")
await check("public counter increment by exactly one", async () => {
    await updateDoc(doc(db, "projects", "seed-project"), { waitlistCount: 1 })
}, "allow")
await check("public counter increment by more than one", async () => {
    await updateDoc(doc(db, "projects", "seed-project"), { waitlistCount: 99 })
}, "deny")
await check("public counter decrement", async () => {
    await updateDoc(doc(db, "projects", "seed-project"), { waitlistCount: 0 })
}, "deny")
await check("public update of another project field", async () => {
    await updateDoc(doc(db, "projects", "seed-project"), { title: "Renamed" })
}, "deny")
await check("public update of the counter together with another field", async () => {
    await updateDoc(doc(db, "projects", "seed-project"), {
        waitlistCount: 2,
        title: "Renamed",
    })
}, "deny")
await check("public create of a project", async () => {
    await setDoc(doc(db, "projects", "sneaky-project"), {
        title: "Sneaky",
        slug: "sneaky",
        status: "active",
        waitlistCount: 1000,
    })
}, "deny")
await check("public delete of a project", async () => {
    await deleteDoc(doc(db, "projects", "seed-project"))
}, "deny")

console.log("\n--- waitlist: the atomic signup transaction ---")
await check("transaction that creates an entry and bumps the counter", async () => {
    await runTransaction(db, async (transaction) => {
        const projectRef = doc(db, "projects", "seed-project")
        const projectSnap = await transaction.get(projectRef)
        const current = projectSnap.data().waitlistCount
        transaction.set(doc(db, "waitlist", "seed-project_ticket@example.com"), {
            projectId: "seed-project",
            email: "ticket@example.com",
            createdAt: serverTimestamp(),
        })
        transaction.update(projectRef, {
            waitlistCount: (typeof current === "number" ? current : 0) + 1,
        })
    })
}, "allow")

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
