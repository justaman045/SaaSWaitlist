// Mints a Firebase ID token for an existing user so an automated browser
// audit can load the admin pages.
//
// It uses the Identity Toolkit admin API with a service account to create a
// custom token, which is then exchanged for a real ID token. The resulting
// token carries the user's email and `email_verified`, which is exactly what
// the Firestore rules check for `isAdmin()`.
//
// Usage:
//   node scripts/mint-admin-token.mjs <serviceAccountFile> <localId> <apiKey> [outputFile]
//
// The token is a live admin credential. Pass an output file: it is written
// with owner-only permissions (0600) and only a redacted summary is printed
// to stdout, so the token cannot end up in a terminal history or a CI log.
// Without an output file the token is printed to stdout — that is only safe
// when the output is piped straight into a file you control.
import { createSign } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"

const [, , serviceAccountFile, localId, apiKey, outputFile] = process.argv
const serviceAccount = JSON.parse(readFileSync(serviceAccountFile, "utf8"))
const projectId = serviceAccount.project_id

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
const issuedAt = Math.floor(Date.now() / 1000)

const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: issuedAt,
    exp: issuedAt + 3600,
    uid: localId,
})}`

const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(serviceAccount.private_key, "base64url")

const customToken = `${unsigned}.${signature}`

const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
)

const data = await response.json()
if (!response.ok) {
    console.error("signInWithCustomToken failed:", JSON.stringify(data))
    process.exit(1)
}

const claims = JSON.parse(
    Buffer.from(data.idToken.split(".")[1], "base64url").toString("utf8")
)

const payload = {
    projectId,
    apiKey,
    uid: claims.sub ?? localId,
    email: claims.email ?? null,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
}

if (outputFile) {
    // Owner-only permissions: the file holds a live admin credential.
    writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 })
    console.log(
        `Wrote an admin token for ${payload.email ?? payload.uid} to ${outputFile} (expires in ${payload.expiresIn}s).`
    )
} else {
    console.warn(
        "Warning: printing a live admin token to stdout. Pass an output file to keep it out of your terminal history."
    )
    console.log(JSON.stringify(payload))
}
