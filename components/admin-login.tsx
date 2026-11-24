"use client"

import { useState, useEffect } from "react"
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    signOut,
    GoogleAuthProvider,
    onAuthStateChanged,
} from "firebase/auth"
import { auth, FIREBASE_PROJECT_ID, FIREBASE_TARGET } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { AlertCircle, Mail } from "lucide-react"
import { isAdminEmail } from "@/lib/admin-emails"

const googleProvider = new GoogleAuthProvider()

/** Pulls the Firebase error code (`auth/invalid-credential`, …) off an error. */
function authErrorCode(error: unknown): string {
    if (typeof error === "object" && error !== null && "code" in error) {
        return String((error as { code?: unknown }).code)
    }
    return "unknown"
}

/**
 * Turns a Firebase auth failure into something the user can act on.
 *
 * Firebase answers a wrong email *and* a wrong password with the same
 * `auth/invalid-credential` code (it refuses to say which one was wrong),
 * so that case can only say "incorrect email or password".
 */
function describeAuthError(error: unknown): string {
    switch (authErrorCode(error)) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Incorrect email or password."
        case "auth/operation-not-allowed":
            return "Email/password sign-in is disabled for this Firebase project — use “Sign in with Google”."
        case "auth/user-disabled":
            return "This account has been disabled."
        case "auth/too-many-requests":
            return "Too many attempts. Wait a minute and try again."
        case "auth/network-request-failed":
            return "Network error — check your connection."
        default:
            return "Sign-in failed. Check the browser console for details."
    }
}

export function AdminLogin() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [notAllowed, setNotAllowed] = useState<string | null>(null)
    const [listenerError, setListenerError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                if (!user) return

                // Only allowlisted accounts are sent to the dashboard. Everyone
                // else gets an explicit message instead of a bounce to a page
                // that will just say "access denied".
                if (isAdminEmail(user.email)) {
                    router.push("/admin")
                } else {
                    setNotAllowed(user.email ?? "This account")
                }
            },
            (error) => {
                // Without this the listener can fail silently and the sign-in
                // card would never react to an already authenticated session.
                // A broken listener is also shown, so the admin knows that
                // signing in will not work.
                console.error("Auth state listener failed:", error)
                setListenerError(
                    error instanceof Error
                        ? error.message
                        : "Could not reach the Firebase authentication service."
                )
            }
        )
        return () => unsubscribe()
    }, [router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            await signInWithEmailAndPassword(auth, email, password)
            toast.success("Welcome back!")
            router.push("/admin")
        } catch (error) {
            // A rejected credential is a user mistake, not an app fault.
            // Logging it as an error makes the Next.js dev overlay flag it
            // as a broken app, so it is logged as a warning instead — the
            // error object is still printed in full.
            console.warn(`Login failed (${authErrorCode(error)}):`, error)
            toast.error(describeAuthError(error))
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setIsLoading(true)
        // A redirect navigates the whole tab away. The button must stay
        // disabled until that happens, otherwise it becomes clickable again
        // while the browser is still leaving the page and a second sign-in
        // attempt can start.
        let redirecting = false
        try {
            try {
                await signInWithPopup(auth, googleProvider)
            } catch (error) {
                // A popup blocker refuses the sign-in window. Redirecting
                // instead keeps Google sign-in working — it navigates the
                // whole tab away and comes back to this page afterwards.
                // A popup the user *closed* is left alone on purpose:
                // redirecting then would trap them in a loop.
                if (authErrorCode(error) !== "auth/popup-blocked") throw error
                console.warn("Google popup blocked — falling back to a redirect")
                redirecting = true
                await signInWithRedirect(auth, googleProvider)
                return
            }
            toast.success("Signed in with Google!")
            router.push("/admin")
        } catch (error) {
            redirecting = false
            console.warn(`Google login failed (${authErrorCode(error)}):`, error)
            toast.error(
                authErrorCode(error) === "auth/popup-closed-by-user"
                    ? "Google sign-in was cancelled."
                    : "Google sign-in failed. Check the browser console for details."
            )
        } finally {
            // The redirect path leaves the page, so the loading state stays.
            if (!redirecting) {
                setIsLoading(false)
            }
        }
    }

    if (notAllowed) {
        return (
            <div className="flex min-h-screen items-center justify-center relative overflow-hidden bg-background px-6">
                <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />
                <Card className="w-full max-w-sm relative z-10 bg-white/5 border-white/10 backdrop-blur-md rounded-3xl shadow-2xl">
                    <CardHeader className="space-y-1 text-center pb-6 pt-10">
                        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
                        <CardTitle className="text-2xl font-bold tracking-tight">Access denied</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            {notAllowed} is signed in but is not on the admin allowlist. Ask the site
                            owner to add it to NEXT_PUBLIC_ADMIN_EMAILS and the Firestore rules.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-10 px-8">
                        <Button
                            variant="outline"
                            className="w-full h-12 rounded-full"
                            onClick={async () => {
                                try {
                                    await signOut(auth)
                                    setNotAllowed(null)
                                } catch (error) {
                                    console.error("Sign out failed:", error)
                                    toast.error("Could not sign out. Please try again.")
                                }
                            }}
                        >
                            Sign out
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center relative overflow-hidden bg-background">
            <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] pointer-events-none"></div>

            <Card className="w-full max-w-sm relative z-10 bg-white/5 border-white/10 backdrop-blur-md rounded-3xl shadow-2xl">
                <CardHeader className="space-y-1 text-center pb-8 pt-10">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-6 w-6 text-primary"
                            aria-hidden="true"
                        >
                            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                        </svg>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Enter your credentials to access the dashboard
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-10 px-8">
                    {listenerError && (
                        <div
                            role="alert"
                            className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                Could not reach the Firebase authentication service: {listenerError}.
                                Signing in will not work until this is fixed.
                            </span>
                        </div>
                    )}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="admin-email" className="text-sm font-medium">
                                Email
                            </Label>
                            <Input
                                id="admin-email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/60 rounded-xl h-12 px-4 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-password" className="text-sm font-medium">
                                Password
                            </Label>
                            <Input
                                id="admin-password"
                                type="password"
                                name="password"
                                autoComplete="current-password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/60 rounded-xl h-12 px-4 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                            />
                        </div>
                        <Button className="w-full h-12 rounded-full font-semibold text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all" type="submit" disabled={isLoading}>
                            {isLoading ? "Signing in..." : "Sign in"}
                        </Button>
                    </form>
                    {/*
                      The same email can exist in several Firebase projects,
                      and a credential that works in one does not work in
                      the other. Naming the project turns "invalid
                      credential" into a solvable problem.
                    */}
                    <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/60">
                        Signing in to{" "}
                        <code className="text-muted-foreground/80">{FIREBASE_PROJECT_ID}</code>
                        {" · "}
                        {FIREBASE_TARGET === "emulator" ? "local emulator" : "production"}
                    </p>
                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0A0A0A] px-2 text-muted-foreground">Or continue with</span>
                            </div>
                        </div>
                        <Button
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="w-full h-12 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors"
                        >
                            <Mail className="h-4 w-4" />
                            Sign in with Google
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
