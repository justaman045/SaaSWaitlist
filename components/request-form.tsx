"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { submitRequest } from "@/lib/admin-service"
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react"

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Mirrors the maximum length enforced by the Firestore request rules. */
const MAX_EMAIL_LENGTH = 320
const MAX_TITLE_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 2000

export interface RequestProjectOption {
    id: string
    title: string
}

/** Which field an error message belongs to. */
type RequestErrorField = "title" | "email" | "form"

export function RequestForm({
    projects,
    defaultProjectId,
}: {
    projects: RequestProjectOption[]
    defaultProjectId?: string
}) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [email, setEmail] = useState("")
    const [projectId, setProjectId] = useState(defaultProjectId ?? "")
    const [isLoading, setIsLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<{ field: RequestErrorField; message: string } | null>(null)

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)

        const trimmedTitle = title.trim()
        const normalizedEmail = email.trim().toLowerCase()

        if (!trimmedTitle) {
            setError({
                field: "title",
                message: "Please tell us which tool or feature you want.",
            })
            return
        }

        if (trimmedTitle.length > MAX_TITLE_LENGTH) {
            setError({
                field: "title",
                message: `Keep the title under ${MAX_TITLE_LENGTH} characters.`,
            })
            return
        }

        if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
            setError({
                field: "form",
                message: `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`,
            })
            return
        }

        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            setError({
                field: "email",
                message: "Please enter a valid email address.",
            })
            return
        }

        if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
            setError({
                field: "email",
                message: "That email address is too long.",
            })
            return
        }

        setIsLoading(true)

        try {
            const result = await submitRequest({
                title: trimmedTitle,
                description: description.trim(),
                email: normalizedEmail,
                projectId: projectId || undefined,
            })

            if (!result.ok) {
                setError({
                    field: "form",
                    message: result.error?.includes("permission-denied")
                        ? "Requests are not accepting submissions yet. Please try again later."
                        : result.error ?? "Could not submit your request. Please try again.",
                })
                return
            }

            setSubmitted(true)
        } finally {
            setIsLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                <h2 className="mt-4 text-xl font-semibold text-white">Request received</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Thanks — your request is now in the queue. If we build it, you will be the
                    first to know.
                </p>
                <Button
                    variant="outline"
                    className="mt-6 rounded-full"
                    onClick={() => {
                        setSubmitted(false)
                        setTitle("")
                        setDescription("")
                        // The address and the selected tool belong to the
                        // request that was just sent. Keeping them would
                        // silently re-use them for the next one.
                        setEmail("")
                        setProjectId(defaultProjectId ?? "")
                    }}
                >
                    Submit another request
                </Button>
            </div>
        )
    }

    return (
        // `noValidate` turns off the browser's native bubbles so the custom
        // validation below is what the visitor actually sees. Without it the
        // browser blocks the submit on `required` / `type="email"` and the
        // error message wired up with `role="alert"` and `aria-describedby`
        // never appears. The attributes stay on the inputs — they still drive
        // autofill and the mobile keyboard.
        <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-2xl sm:p-8"
        >
            <div className="space-y-2">
                <Label htmlFor="request-title" className="text-base font-medium">
                    What should we build?
                </Label>
                <Input
                    id="request-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={MAX_TITLE_LENGTH}
                    required
                    placeholder="e.g. An AI meeting-notes tool"
                    aria-invalid={error?.field === "title"}
                    aria-describedby={error?.field === "title" ? "request-error" : undefined}
                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="request-description" className="text-base font-medium">
                    Tell us more <span className="text-sm font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                    id="request-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    placeholder="What problem would it solve? Who is it for?"
                    className="min-h-[120px] rounded-2xl bg-black/20 border-white/10 resize-y focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                />
            </div>

            {projects.length > 0 && (
                <div className="space-y-2">
                    <Label htmlFor="request-project" className="text-base font-medium">
                        Related tool <span className="text-sm font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <select
                        id="request-project"
                        value={projectId}
                        onChange={(event) => setProjectId(event.target.value)}
                        className="w-full h-12 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition-all hover:bg-black/30"
                    >
                        <option value="" className="bg-slate-900">
                            Not related to a specific tool
                        </option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id} className="bg-slate-900">
                                {project.title}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="request-email" className="text-base font-medium">
                    Your email
                </Label>
                <Input
                    id="request-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={MAX_EMAIL_LENGTH}
                    required
                    placeholder="you@company.com"
                    aria-invalid={error?.field === "email"}
                    aria-describedby={error?.field === "email" ? "request-error" : undefined}
                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                />
                <p className="text-xs text-muted-foreground">
                    We only use this to follow up about your request.
                </p>
            </div>

            {error && (
                <div
                    id="request-error"
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error.message}</span>
                </div>
            )}

            <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-full text-base">
                {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Send className="mr-2 h-4 w-4" />
                )}
                Send request
            </Button>
        </form>
    )
}
