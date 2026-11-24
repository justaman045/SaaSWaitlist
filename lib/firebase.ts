import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { FIREBASE_TARGET } from "@/lib/firebase-target";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "mock-key",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mock-project.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mock-project",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock-project.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Points the SDK at the local Firebase emulators.
 *
 * Set `NEXT_PUBLIC_FIREBASE_EMULATOR=true` to run the app against the
 * emulator instead of production. The emulators accept the same rules as
 * the live project, which makes it possible to exercise the admin flows
 * (sign-in, read, delete) without touching real data.
 */
export { FIREBASE_TARGET }

if (FIREBASE_TARGET === "emulator") {
    connectFirestoreEmulator(db, "127.0.0.1", 8099);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

/**
 * The Firebase project this build talks to.
 *
 * Surfaced in the admin UI because "which project am I signing in to?" is
 * the question behind most confusing auth failures: the same email can
 * exist in several projects, and a credential that works in one does not
 * work in the other.
 */
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export { app, db, auth };
