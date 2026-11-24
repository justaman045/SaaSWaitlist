"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/firebase"
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { markOnWaitlist, normalizeEmail, isStorableEmail, waitlistDocumentId } from "@/lib/waitlist"

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Mirrors the maximum length enforced by the Firestore waitlist rules. */
const MAX_EMAIL_LENGTH = 320

/**
 * True when the project still exists.
 *
 * The waitlist rules require the project to be there. A denied write is
 * therefore ambiguous — it can mean "already registered" or "the project is
 * gone" — and the two need very different messages.
 */
async function projectExists(projectId: string): Promise<boolean> {
    try {
        const snapshot = await getDoc(doc(db, "projects", projectId))
        return snapshot.exists()
    } catch (error) {
        console.warn("Could not verify that the project still exists:", error)
        // The read failed — assume the project is still there so the visitor
        // is not told the project is gone when it is not.
        return true
    }
}

export function WaitlistForm({ projectId }: { projectId: string }) {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    /**
     * The validation message, shown next to the field.
     *
     * A toast alone is not enough: it disappears after a few seconds and a
     * visitor on a phone can easily miss it. The message is also wired up
     * with `role="alert"` so a screen reader announces it.
     */
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const normalizedEmail = normalizeEmail(email)
        if (!normalizedEmail) {
            setError("Please enter your email address.")
            return
        }

        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            setError("Please enter a valid email address.")
            return
        }

        // The Firestore rules reject emails longer than 320 characters. By
        // enforcing the same limit here, a `permission-denied` response can
        // only mean "this address is already registered".
        if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
            setError("That email address is too long.")
            return
        }

        // The waitlist document id embeds the raw address and a Firestore
        // document id cannot contain a slash. The check happens here so the
        // visitor gets a readable message instead of an SDK error — and so a
        // `permission-denied` response keeps meaning "already registered".
        if (!isStorableEmail(normalizedEmail)) {
            setError(
                "Email addresses containing “/” cannot be used here. Please use another address."
            )
            return
        }

        setIsLoading(true)

        try {
            const waitlistRef = doc(
                db,
                "waitlist",
                waitlistDocumentId(projectId, normalizedEmail)
            )
            const projectRef = doc(db, "projects", projectId)

            // Atomic: create the entry and bump the public counter together.
            // The deterministic id + create-only rules make a repeat signup
            // fail with permission-denied instead of creating a duplicate.
            await runTransaction(db, async (transaction) => {
                const projectSnap = await transaction.get(projectRef)

                if (!projectSnap.exists()) {
                    throw new Error("Project not found")
                }

                const currentCount = projectSnap.data().waitlistCount
                transaction.set(waitlistRef, {
                    projectId,
                    email: normalizedEmail,
                    createdAt: serverTimestamp(),
                })
                transaction.update(projectRef, {
                    waitlistCount: (typeof currentCount === "number" ? currentCount : 0) + 1,
                })
            })

            markOnWaitlist(projectId, normalizedEmail)
            toast.success("Successfully joined the waitlist!")
            setEmail("")
        } catch (error) {
            const code =
                error && typeof error === "object" && "code" in error
                    ? String((error as { code?: unknown }).code)
                    : ""

            if (code === "permission-denied") {
                // A denied write usually means the entry already exists. It
                // can also mean the project was deleted while the page was
                // open — the rules require the project to exist — so the
                // project is checked before the visitor is told anything.
                const projectStillExists = await projectExists(projectId)

                if (!projectStillExists) {
                    toast.error("This project is no longer available.")
                    return
                }

                // The waitlist document already exists. Treat it as an
                // existing signup so the user sees the confirmation state
                // instead of a dead end.
                markOnWaitlist(projectId, normalizedEmail)
                toast.info("You are already on the waitlist!")
            } else {
                console.error("Error joining waitlist:", error)
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to join waitlist. Please try again."
                )
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        // `noValidate` turns off the browser's native bubbles so the custom
        // validation above is what the visitor actually sees. Without it the
        // browser blocks the submit on `required` / `type="email"` and the
        // inline message never appears.
        <form
            onSubmit={handleSubmit}
            noValidate
            className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"
        >
            <div className="flex w-full flex-col gap-1">
                <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError(null)
                    }}
                    required
                    disabled={isLoading}
                    aria-label="Email address"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "waitlist-email-error" : undefined}
                    className="h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/60"
                />
                {error && (
                    <p
                        id="waitlist-email-error"
                        role="alert"
                        className="text-xs text-red-300"
                    >
                        {error}
                    </p>
                )}
            </div>
            <Button type="submit" disabled={isLoading} className="h-12 rounded-xl px-6 shrink-0">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Waitlist"}
            </Button>
        </form>
    )
}
