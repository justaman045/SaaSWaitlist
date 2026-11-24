export const WAITLIST_EVENT = "saaswaitlist:waitlist-updated"

function waitlistStorageKey(projectId: string): string {
    return `saaswaitlist_waitlist_${projectId}`
}

/**
 * Reads the "already registered" flag for a project.
 *
 * `localStorage` throws a `SecurityError` when cookies are blocked (a
 * hardened privacy mode, an embedded webview, some corporate proxies). The
 * flag is a convenience — the Firestore rules are what actually prevent a
 * duplicate signup — so a storage failure must never take the page down.
 */
export function isOnWaitlist(projectId: string): boolean {
    if (typeof window === "undefined") return false

    try {
        return Boolean(window.localStorage.getItem(waitlistStorageKey(projectId)))
    } catch (error) {
        console.warn("Could not read the waitlist state from localStorage:", error)
        return false
    }
}

/**
 * Records that the visitor joined the waitlist.
 *
 * The write happens *after* the Firestore transaction has committed. A
 * storage failure therefore must not turn a successful signup into an error
 * message — the signup really did go through. The flag is only used to
 * render the confirmation state, so it is safe to skip it.
 */
export function markOnWaitlist(projectId: string, email: string): void {
    if (typeof window === "undefined") return

    try {
        window.localStorage.setItem(waitlistStorageKey(projectId), email)
    } catch (error) {
        console.warn("Could not save the waitlist state to localStorage:", error)
    }

    // The event is dispatched even when the write failed, so the UI still
    // switches to the confirmation state.
    window.dispatchEvent(new Event(WAITLIST_EVENT))
}

/** Normalises an email so the same address can't register twice by casing. */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

/**
 * Stable Firestore document id for a (project, email) pair.
 *
 * The raw email keeps the id readable/verifiable by Firestore rules. A
 * Firestore document id cannot contain a slash, so an address that has one
 * cannot be stored — the waitlist form rejects it before it gets this far.
 */
export function waitlistDocumentId(projectId: string, email: string): string {
    return `${projectId}_${normalizeEmail(email)}`
}

/**
 * True when the address can be used as a Firestore document id.
 *
 * The waitlist document id embeds the raw address, and Firestore rejects a
 * document id that contains a slash. The address is checked *before* the
 * transaction so the visitor gets a readable message instead of an
 * `invalid-argument` error from the SDK.
 */
export function isStorableEmail(email: string): boolean {
    return !email.includes("/")
}
