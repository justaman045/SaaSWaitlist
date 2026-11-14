"use client"

import { useState, useEffect } from "react"
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    type User,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Mail } from "lucide-react"

const googleProvider = new GoogleAuthProvider()

export function AdminLogin() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                router.push("/admin")
            }
        })
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
            console.error("Login error:", error)
            toast.error("Invalid credentials")
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setIsLoading(true)
        try {
            await signInWithPopup(auth, googleProvider)
            toast.success("Signed in with Google!")
            router.push("/admin")
        } catch (error) {
            console.error("Google login error:", error)
            toast.error("Google sign-in failed")
        } finally {
            setIsLoading(false)
        }
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
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/60 rounded-xl h-12 px-4 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
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
