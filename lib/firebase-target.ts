/**
 * Which Firebase backend this build talks to.
 *
 * Kept in its own module (no Firebase imports) so server-side route
 * handlers can read it without pulling the client SDK into their bundle.
 */

/**
 * `"emulator"` when `NEXT_PUBLIC_FIREBASE_EMULATOR=true`, `"production"`
 * otherwise.
 *
 * The variable is inlined at build time, so the dev server has to be
 * started with it set — changing it afterwards has no effect.
 */
export const FIREBASE_TARGET =
    process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "true" ? "emulator" : "production"

/** True when the app is running against the local Firebase emulators. */
export const IS_EMULATOR = FIREBASE_TARGET === "emulator"
