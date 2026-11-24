/**
 * The admin allowlist, parsed once.
 *
 * `NEXT_PUBLIC_ADMIN_EMAILS` is inlined at build time, so the list has to
 * be read at module scope. The same addresses must be hardcoded in the
 * `isAdmin()` function in `firestore.rules` — the rules are the real
 * security boundary; this list only drives the UI.
 */
const ADMIN_EMAILS: string[] = (
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "developerlife69@gmail.com"
)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

/** True when the address is on the allowlist (case-insensitive). */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false
    return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
