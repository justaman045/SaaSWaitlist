"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"
import { AdminLogin } from "@/components/admin-login"
import { Loader2, LayoutDashboard, LogOut } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { signOut } from "firebase/auth"
import { toast } from "sonner"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user)
            setLoading(false)
        })
        return () => unsubscribe()
    }, [])

    const handleLogout = async () => {
        await signOut(auth)
        toast.success("Logged out successfully")
    }

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>
    }

    if (!user) {
        return <AdminLogin />
    }

    return (
        <div className="flex min-h-screen flex-col space-y-6 relative bg-background overflow-x-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none -z-20" />
            <div className="absolute inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] pointer-events-none -z-20"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/20 blur-[100px] rounded-full opacity-20 pointer-events-none -z-30"></div>

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
                        <Button variant="ghost" size="sm" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </div>
            </header>
            <div className="container grid flex-1 gap-12 md:grid-cols-[200px_1fr]">
                <aside className="hidden w-[200px] flex-col md:flex">
                    <nav className="grid items-start gap-2">
                        <Link href="/admin">
                            <Button variant="ghost" className="w-full justify-start">
                                Projects
                            </Button>
                        </Link>
                        {/* Add more links here later */}
                    </nav>
                </aside>
                <main className="flex w-full flex-1 flex-col overflow-hidden">
                    {children}
                </main>
            </div>
        </div>
    )
}
