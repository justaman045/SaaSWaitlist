"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, sendEmailVerification, type User } from "firebase/auth"
import { AdminLogin } from "@/components/admin-login"
import {
    AlertCircle,
    FolderGit2,
    Inbox,
    LayoutDashboard,
    LogOut,
    Loader2,
    Mail,
    PauseCircle,
    Tags,
    Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { signOut } from "firebase/auth"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { isAdminEmail } from "@/lib/admin-emails"
import {
    NexusReconciliationProvider,
    useNexusReconciliation,
} from "@/components/nexus-reconciliation-provider"

const ADMIN_NAV = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/projects", label: "Projects", icon: FolderGit2 },
    { href: "/admin/signups", label: "Signups", icon: Users },
    { href: "/admin/requests", label: "Requests", icon: Inbox },
    { href: "/admin/taxonomy", label: "Options", icon: Tags },
] as const

/** Highlights the current section; nested routes map to their parent. */
function isActive(pathname: string, href: string): boolean {
    if (href === "/admin") return pathname === "/admin"
    return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Shows what the Nexus sync is doing right now.
 *
 * Three states matter to an admin: it is running, it failed (the catalogue
 * may have drifted), or it cannot run in this build at all. Anything the
 * sync does not manage to report has to be visible here — a silent sync is
 * indistinguishable from a broken one.
 */
function NexusSyncBadge() {
    const { running, error, disabledReason } = useNexusReconciliation()

    if (disabledReason) {
        return (
            <span
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                title={disabledReason}
            >
                <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sm:hidden">Paused</span>
                <span className="hidden sm:inline">Nexus sync paused</span>
            </span>
        )
    }

    if (error) {
        return (
            <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200"
                title={error}
            >
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sm:hidden">Sync failed</span>
                <span className="hidden sm:inline">Nexus sync failed</span>
            </Link>
        )
    }

    if (!running) return null

    return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span className="sm:hidden">Syncing</span>
            <span className="hidden sm:inline">Syncing Nexus</span>
        </span>
    )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [resending, setResending] = useState(false)
    const [authError, setAuthError] = useState<string | null>(null)

    useEffect(() => {
        // The error callback matters: without it a Firebase Auth
        // initialisation failure (invalid config, blocked network) leaves
        // `loading` stuck on true and the admin sees an endless spinner
        // instead of the sign-in card.
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                setUser(user)
                setAuthError(null)
                setLoading(false)
            },
            (error) => {
                // A broken auth listener is not the same as "not signed in".
                // Showing the ordinary sign-in card would hide the real
                // problem, so the reason is surfaced to the admin.
                console.error("Auth state listener failed:", error)
                setUser(null)
                setAuthError(
                    error instanceof Error
                        ? error.message
                        : "Could not reach the Firebase authentication service."
                )
                setLoading(false)
            }
        )
        return () => unsubscribe()
    }, [])

    const handleResendVerification = async () => {
        if (!user) return
        setResending(true)
        try {
            await sendEmailVerification(user)
            toast.success("Verification email sent. Please check your inbox.")
        } catch (error) {
            console.error("Error resending verification email:", error)
            toast.error("Failed to resend verification email")
        } finally {
            setResending(false)
        }
    }

    const handleLogout = async () => {
        try {
            await signOut(auth)
            toast.success("Logged out successfully")
        } catch (error) {
            console.error("Sign out failed:", error)
            toast.error("Could not sign out. Please try again.")
        }
    }

    if (loading) {
        return (
            <div
                className="flex h-screen items-center justify-center"
                role="status"
                aria-live="polite"
            >
                <Loader2 className="animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading the dashboard…</span>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="space-y-4">
                {authError && (
                    <div
                        role="alert"
                        className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            Could not reach the Firebase authentication service: {authError}. Signing
                            in will not work until this is fixed.
                        </span>
                    </div>
                )}
                <AdminLogin />
            </div>
        )
    }

    // The Firestore rules are the real security boundary, but hiding the UI
    // for non-allowlisted accounts avoids confusing failed writes.
    if (!isAdminEmail(user.email)) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-6">
                <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center shadow-2xl">
                    <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
                    <h1 className="mt-4 text-xl font-semibold text-white">Access denied</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {user.email} is not on the admin allowlist. Ask the site owner to add it to{" "}
                        <code className="rounded bg-white/5 px-1.5 py-0.5">NEXT_PUBLIC_ADMIN_EMAILS</code>{" "}
                        and the Firestore rules.
                    </p>
                    <Button variant="ghost" size="sm" onClick={handleLogout} className="mt-6">
                        Sign out
                    </Button>
                </div>
            </div>
        )
    }

    // Show verification banner when email is not verified
    if (!user.emailVerified) {
        return (
            <div className="flex min-h-screen flex-col space-y-6 relative bg-background overflow-x-hidden">
                <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none -z-20" />
                <div className="absolute inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] pointer-events-none -z-20" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/20 blur-[100px] opacity-20 pointer-events-none -z-30" />

                <header className="sticky top-0 z-40 border-b border-white/10 bg-background/50 backdrop-blur-xl">
                    <div className="container flex h-16 items-center justify-between py-4">
                        <div className="flex items-center gap-2 font-bold">
                            <LayoutDashboard className="h-6 w-6" />
                            <span>Admin Dashboard</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
                                View Site
                            </Link>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                                Logout
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="container flex flex-1 items-center justify-center">
                    <div className="w-full max-w-md">
                        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md p-8 shadow-2xl ring-1 ring-amber-500/20">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="h-8 w-8 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Verify your email</h3>
                                    <p className="text-amber-200 mb-6">
                                        Your email ({user.email}) is not verified yet. Please check your inbox and click the verification link before creating or updating projects.
                                    </p>
                                    <Button
                                        onClick={handleResendVerification}
                                        disabled={resending}
                                        className="w-full bg-amber-500 hover:bg-amber-400 text-white"
                                    >
                                        {resending ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Mail className="h-4 w-4 animate-spin" />
                                                Resending...
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                Resend Verification Link
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <NexusReconciliationProvider enabled>
            <div className="flex min-h-screen flex-col space-y-6 relative bg-background overflow-x-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none -z-20" />
                <div className="absolute inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] pointer-events-none -z-20"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/20 blur-[100px] opacity-20 pointer-events-none -z-30"></div>

                <header className="sticky top-0 z-40 border-b border-white/10 bg-background/50 backdrop-blur-xl">
                    <div className="container flex h-16 items-center justify-between py-4">
                        <div className="flex items-center gap-2 font-bold">
                            <LayoutDashboard className="h-6 w-6" />
                            <span>Admin Dashboard</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
                                View Site
                            </Link>
                            <NexusSyncBadge />
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </Button>
                        </div>
                    </div>
                </header>
                <div className="container grid flex-1 gap-12 md:grid-cols-[200px_1fr]">
                    <aside className="hidden w-[200px] flex-col md:flex">
                        <nav className="grid items-start gap-2">
                            {ADMIN_NAV.map((item) => (
                                <Button
                                    asChild
                                    key={item.href}
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start",
                                        isActive(pathname, item.href) &&
                                            "bg-white/10 text-white hover:bg-white/15"
                                    )}
                                >
                                    <Link href={item.href}>
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                        </nav>
                    </aside>
                    {/* The root layout already renders the page <main>; this
                        is a content column, not a second landmark. */}
                    <div className="flex w-full flex-1 flex-col overflow-hidden">
                        {/* The sidebar is hidden below md, so the sections need
                            their own navigation on small screens. */}
                        <nav className="mb-6 flex gap-1 overflow-x-auto pb-1 md:hidden">
                            {ADMIN_NAV.map((item) => (
                                <Button
                                    asChild
                                    key={item.href}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "shrink-0 rounded-full",
                                        isActive(pathname, item.href) &&
                                            "bg-white/10 text-white hover:bg-white/15"
                                    )}
                                >
                                    <Link href={item.href}>
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                        </nav>
                        {children}
                    </div>
                </div>
            </div>
        </NexusReconciliationProvider>
    )
}
