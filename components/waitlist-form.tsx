"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/firebase"
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export function WaitlistForm({ projectId }: { projectId: string }) {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            // Check if email already exists for this project
            const q = query(
                collection(db, "waitlist"),
                where("projectId", "==", projectId),
                where("email", "==", email)
            )
            const querySnapshot = await getDocs(q)

            if (!querySnapshot.empty) {
                toast.info("You are already on the waitlist!")
                setIsLoading(false)
                return
            }

            await setDoc(doc(db, "waitlist", `${projectId}_${email}`), {
                projectId,
                email,
                createdAt: serverTimestamp(),
            })

            toast.success("Successfully joined the waitlist!")
            setEmail("")
        } catch (error) {
            console.error("Error joining waitlist:", error)
            toast.error("Failed to join waitlist. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex w-full max-w-sm items-center space-x-2">
            <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Waitlist"}
            </Button>
        </form>
    )
}
