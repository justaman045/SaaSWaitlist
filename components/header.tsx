"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, Rocket, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, signOut, User } from "firebase/auth"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { isAdminEmail } from "@/lib/admin-emails"

export function Header() {
    const [user, setUser] = useState<User | null>(null)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [signingOut, setSigningOut] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        // The error callback matters: without it a Firebase Auth initialisation
        // failure leaves the header permanently blank instead of falling back
        // to the signed-out state.
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => setUser(user),
            (error) => {
                console.error("Auth state listener failed:", error)
                setUser(null)
            }
        )
        return () => unsubscribe()
    }, [])

    const handleLogout = useCallback(async () => {
        if (signingOut) return
        setSigningOut(true)
        try {
            await signOut(auth)
            setMobileOpen(false)
        } catch (error) {
            console.error("Sign out failed:", error)
            toast.error("Could not sign out. Please try again.")
        } finally {
            setSigningOut(false)
        }
    }, [signingOut])

    const closeMenu = useCallback(() => setMobileOpen(false), [])

    // Don't show the global header on admin routes since they have their own layout
    if (pathname?.startsWith('/admin')) {
        return null
    }

    // Only an allowlisted account can reach the dashboard — anyone else is
    // sent to the "access denied" card.
    const isAdmin = isAdminEmail(user?.email)

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 max-w-screen-2xl items-center">
                <div className="mr-4 flex">
                    <Link className="mr-6 flex items-center space-x-2" href="/" onClick={closeMenu}>
                        <div className="rounded-full bg-primary/20 p-1">
                            <Rocket className="h-5 w-5 text-primary" />
                        </div>
                        <span className="hidden font-bold sm:inline-block tracking-tight text-lg">
                            SaaS<span className="text-primary">Waitlist</span>
                        </span>
                    </Link>
                </div>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <nav className="hidden items-center space-x-4 sm:flex">
                        {isAdmin ? (
                            <div className="flex items-center gap-4">
                                <Link href="/admin" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                                    Dashboard
                                </Link>
                                <Button size="sm" variant="ghost" onClick={handleLogout} disabled={signingOut} className="text-muted-foreground hover:text-foreground">
                                    Logout
                                </Button>
                            </div>
                        ) : (
                            <Link href="/signin" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                                Sign In
                            </Link>
                        )}
                        <Link href="/projects" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                            Explore
                        </Link>
                        <Button asChild size="sm" className="rounded-full px-4">
                            <Link href="/request">Submit Project</Link>
                        </Button>
                    </nav>

                    <div className="flex items-center gap-1 sm:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMobileOpen((open) => !open)}
                            aria-label="Toggle navigation menu"
                            aria-expanded={mobileOpen}
                            aria-controls="mobile-nav"
                        >
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
            </div>

            {mobileOpen && (
                <div id="mobile-nav" className="border-t border-border/40 bg-background/95 backdrop-blur-xl sm:hidden">
                    <nav className="container flex flex-col gap-1 py-4">
                        <Link href="/projects" onClick={closeMenu} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                            Explore
                        </Link>
                        <Link href="/request" onClick={closeMenu} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                            Submit Project
                        </Link>
                        {isAdmin ? (
                            <>
                                <Link href="/admin" onClick={closeMenu} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                                    Dashboard
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={signingOut}
                                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link href="/signin" onClick={closeMenu} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                                Sign In
                            </Link>
                        )}
                    </nav>
                </div>
            )}
        </header>
    )
}
