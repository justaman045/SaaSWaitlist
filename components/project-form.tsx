"use client"

import { z } from "zod"
import { useForm, useWatch, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState, useEffect, useMemo, useCallback } from "react"
import {
    addDoc,
    collection,
    deleteField,
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { syncProjectToNexus, updateProjectToNexus, deleteProductFromNexus, NEXUS_AVAILABLE } from "@/lib/nexus"
import { deleteProject, deleteWaitlistEntriesForProject, getProjectByIdResult } from "@/lib/db-service"
import ImageUpload from "@/components/ui/image-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Combobox } from "@/components/ui/combobox"
import { getTaxonomyResult, mergeTaxonomyOptions } from "@/lib/admin-service"
import { mergeOptions } from "@/lib/taxonomy"
import { cn } from "@/lib/utils"
import { isNumericPrice, parsePrice } from "@/lib/price"
import { Project, Taxonomy, TaxonomyField } from "@/types"

/**
 * A URL that is safe to put in an `href`.
 *
 * `z.string().url()` also accepts `data:`, `ftp:` and `javascript:`. The
 * website URL is rendered as a link the admin clicks, so only `http` and
 * `https` are allowed.
 */
const webUrl = z
    .string()
    .trim()
    .url("Must be a valid URL")
    .refine(
        (value) => value === "" || /^https?:\/\//i.test(value),
        "Only http and https URLs are allowed"
    )

/**
 * Builds the validation schema for one form instance.
 *
 * `legacyPricing` is the pricing value of the project being edited. Older
 * documents store free text such as "Free"; that value has to survive an
 * edit untouched, so it is accepted verbatim. Anything else has to be a
 * number — new pricing is always numeric.
 *
 * The schema cannot be a plain constant because the accepted legacy value
 * depends on the project being edited.
 */
function buildFormSchema(legacyPricing?: string) {
    const legacyOption =
        legacyPricing && !isNumericPrice(legacyPricing)
            ? [z.literal(legacyPricing, "Pricing must be a number, e.g. 29 or 29.99")]
            : []

    return z.object({
        // `.trim()` makes "  " fail the minimum-length check instead of being
        // accepted as a two-character title.
        title: z.string().trim().min(2, "Title must be at least 2 characters"),
        shortDescription: z.string().trim().max(200, "Short description must be less than 200 characters").optional(),
        description: z.string().trim().min(10, "Description must be at least 10 characters"),
        slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
        status: z.enum(["active", "coming_soon"]),
        websiteUrl: webUrl.optional().or(z.literal("")),
        imageUrl: webUrl.optional().or(z.literal("")),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        features: z.string().optional(),
        techStack: z.array(z.string()).optional(),
        // The accepted forms match `parsePrice` exactly. A stricter regex
        // made a project with, say, " 29 " impossible to save unchanged.
        pricing: z.union([
            z.literal(""),
            z
                .string()
                .trim()
                .refine(
                    (value) => isNumericPrice(value),
                    "Pricing must be a number, e.g. 29 or 29.99"
                ),
            ...legacyOption,
        ]).optional(),
        launchDate: z.string().optional(),
        images: z.array(z.string()).optional(),
    })
}

type FormData = z.infer<ReturnType<typeof buildFormSchema>>

/** Splits a free-text list field (one entry per line) into an array. */
function splitList(value: string | undefined, separator: string): string[] {
    return value
        ? value.split(separator).map((item) => item.trim()).filter(Boolean)
        : []
}

/**
 * Removes duplicate entries while keeping the original order.
 *
 * Tags, tech stack entries and images are user-editable lists. Without this
 * a repeated tag ends up in the document twice, which renders two React
 * elements with the same key (React logs a warning) and shows the same badge
 * twice on the project page.
 */
function dedupe(values: readonly string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

/**
 * Normalises a numeric price to its canonical string form.
 *
 * " 29 " and "29.00" are valid prices, but storing them verbatim makes the
 * catalogue inconsistent and breaks comparisons. Legacy free-text prices
 * ("Free", "Freemium") are not numeric and are left exactly as they are.
 */
function canonicalizePrice(value: string): string {
    const parsed = parsePrice(value)
    return parsed === null ? value : String(parsed)
}

/**
 * Formats a `Date` as a local calendar day (`YYYY-MM-DD`).
 *
 * `toISOString()` converts to UTC, so picking the 1st of a month in a
 * positive-offset timezone stores the last day of the previous month. The
 * local getters keep the day the admin actually clicked.
 */
function toLocalDateString(date: Date): string {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    return `${year}-${month}-${day}`
}

/**
 * Parses a stored `YYYY-MM-DD` string into a local calendar date.
 *
 * `new Date("2026-07-23")` is parsed as UTC midnight, which is the previous
 * day in every negative-offset timezone.
 */
function parseLocalDateString(value: string): Date | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
    if (!match) return undefined

    const [, year, month, day] = match
    const date = new Date(Number(year), Number(month) - 1, Number(day))

    return Number.isNaN(date.getTime()) ? undefined : date
}

/** Optional string fields that may legitimately be cleared by the admin. */
const OPTIONAL_STRING_FIELDS = [
    "shortDescription",
    "websiteUrl",
    "imageUrl",
    "category",
    "pricing",
    "launchDate",
] as const

interface ProjectFields {
    title: string
    shortDescription: string
    description: string
    slug: string
    status: "active" | "coming_soon"
    websiteUrl: string
    imageUrl: string
    category: string
    pricing: string
    launchDate: string
    tags: string[]
    features: string[]
    techStack: string[]
    images: string[]
}

/**
 * Builds the Firestore payload for a project.
 *
 * On create, empty optional fields are omitted so no empty strings are
 * stored. On update they are explicitly deleted — `updateDoc` merges, so
 * omitting a field would leave the old value behind and clearing the field
 * in the UI would silently do nothing.
 */
function buildProjectPayload(fields: ProjectFields, mode: "create" | "update") {
    const payload: Record<string, unknown> = {
        title: fields.title,
        description: fields.description,
        slug: fields.slug,
        status: fields.status,
        tags: fields.tags,
        features: fields.features,
        techStack: fields.techStack,
        images: fields.images,
    }

    for (const key of OPTIONAL_STRING_FIELDS) {
        const value = fields[key]
        const isEmpty = value === undefined || value === null || value === ""

        if (mode === "create") {
            if (!isEmpty) payload[key] = value
        } else {
            payload[key] = isEmpty ? deleteField() : value
        }
    }

    return payload
}

/**
 * Turns a Firestore error into an actionable message. `permission-denied`
 * almost always means the signed-in email is missing from the hardcoded
 * `firestore.rules` allowlist — `NEXT_PUBLIC_ADMIN_EMAILS` is inlined at
 * build time, so the two lists can silently drift apart.
 */
function describeWriteError(error: unknown, initialData?: Project): string {
    const code =
        error && typeof error === "object" && "code" in error
            ? String((error as { code?: unknown }).code)
            : ""

    if (code === "permission-denied") {
        return (
            "Firestore denied this write. Your email must be listed in the firestore.rules " +
            "allowlist, and NEXT_PUBLIC_ADMIN_EMAILS must match it (both are inlined at build time)."
        )
    }

    if (error instanceof Error) return error.message

    return initialData ? "Failed to update project" : "Failed to create project"
}

interface ProjectFormProps {
    initialData?: Project
}

export default function ProjectForm({ initialData }: ProjectFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    /**
     * The delete button is two-step: the first click arms it, the second one
     * deletes. The id of the armed project is stored so switching to another
     * project cannot leave a delete armed on the wrong record.
     */
    const [deleteArmedFor, setDeleteArmedFor] = useState<string | null>(null)
    const isDeleteArmed = deleteArmedFor !== null && deleteArmedFor === initialData?.id
    // Only generate suffix if creating new project
    const [slugSuffix] = useState(() => initialData ? "" : Math.random().toString(36).substring(2, 7))
    // Admin-managed option lists behind the category / tag / tech-stack
    // dropdowns. Loaded from Firestore and refreshed whenever a new option
    // is created inline.
    const [taxonomy, setTaxonomy] = useState<Taxonomy>({
        categories: [],
        tags: [],
        techStack: [],
        features: [],
    })
    const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
    /**
     * Set when the shared option lists could not be read.
     *
     * Creating a new option is disabled in that state: the form would not
     * know the current list, and a write based on that unknown state can
     * replace the stored list with the new option alone.
     */
    const [taxonomyLoadFailed, setTaxonomyLoadFailed] = useState(false)

    // The pricing value of the project being edited. A non-numeric value is
    // a legacy free-text price ("Free", "Freemium") that has to survive an
    // edit unchanged.
    const legacyPricing =
        initialData?.pricing && !isNumericPrice(initialData.pricing)
            ? initialData.pricing
            : undefined

    // The schema depends on the project being edited (it accepts that
    // project's legacy pricing value), so it is built once per project.
    const schema = useMemo(
        () => buildFormSchema(initialData?.pricing),
        [initialData?.pricing]
    )

    /** The form defaults for a project. */
    const buildDefaults = useCallback(
        (project?: Project): FormData => ({
            title: project?.title || "",
            shortDescription: project?.shortDescription || "",
            description: project?.description || "",
            slug: project?.slug || "",
            status: project?.status || "active",
            websiteUrl: project?.websiteUrl || "",
            imageUrl: project?.imageUrl || "",
            category: project?.category || "",
            tags: project?.tags ?? [],
            features: project?.features?.join("\n") || "",
            techStack: project?.techStack ?? [],
            pricing: project?.pricing || "",
            launchDate: project?.launchDate || "",
            images: project?.images || [],
        }),
        []
    )

    const {
        register,
        control,
        handleSubmit,
        setValue,
        reset,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: buildDefaults(initialData),
    })

    // `defaultValues` only apply when the form mounts. When the admin
    // navigates from one project to another the mounted form would keep the
    // previous project's values and save them over the new one.
    useEffect(() => {
        reset(buildDefaults(initialData))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData?.id])

    const title = useWatch({ control, name: "title" })
    const descriptionValue = useWatch({ control, name: "description" })
    const imagesValue = useWatch({ control, name: "images" })
    const launchDateValue = useWatch({ control, name: "launchDate" })
    const categoryValue = useWatch({ control, name: "category" }) ?? ""
    const tagsValue = useWatch({ control, name: "tags" }) ?? []
    const techStackValue = useWatch({ control, name: "techStack" }) ?? []
    const featuresValue = useWatch({ control, name: "features" }) ?? ""

    // Load the option lists once. A failure is non-fatal — the dropdowns
    // still work with the values already on the project.
    useEffect(() => {
        let active = true

        getTaxonomyResult().then((result) => {
            if (!active) return
            setTaxonomy(result.taxonomy)
            setTaxonomyError(result.error)
            setTaxonomyLoadFailed(Boolean(result.error))
        })

        return () => {
            active = false
        }
    }, [])

    /**
     * Persists a brand-new option so it can be reused by other projects.
     *
     * The write is a read-modify-write against the *stored* list, so it can
     * never replace the shared list with a single entry — the old code sent
     * a full array built from the local snapshot, which was empty whenever
     * the load had failed.
     */
    const createOption = async (field: TaxonomyField, option: string) => {
        const trimmed = option.trim()
        if (!trimmed) return

        if (taxonomyLoadFailed) {
            toast.error(
                "The shared option lists could not be loaded, so new options cannot be saved. Reload the page and try again."
            )
            return
        }

        const result = await mergeTaxonomyOptions(field, [trimmed])

        if (!result.ok) {
            setTaxonomyError(result.error)
            toast.error(`Could not save the new "${trimmed}" option.`)
            return
        }

        // Re-read the list so the dropdown shows exactly what is stored.
        const refreshed = await getTaxonomyResult()
        if (refreshed.error) {
            // The option was saved, but the refreshed list could not be read.
            // Clearing the error here would hide a broken read behind an
            // empty dropdown, so it stays visible.
            setTaxonomyError(
                `The option was saved, but the option lists could not be re-read (${refreshed.error}).`
            )
            toast.error(
                `The option was saved, but the option lists could not be re-read (${refreshed.error}).`
            )
            return
        }
        setTaxonomy(refreshed.taxonomy)
        setTaxonomyError(null)
    }

    // Values already used by this project are always offered, even when they
    // are not (yet) part of the shared option list.
    const categoryOptions = mergeOptions(taxonomy.categories, [categoryValue])
    const tagOptions = mergeOptions(taxonomy.tags, tagsValue)
    const techStackOptions = mergeOptions(taxonomy.techStack, techStackValue)

    // Auto-generate slug only for new projects
    useEffect(() => {
        if (!initialData && title) {
            const slugBase = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")

            setValue("slug", `${slugBase}-${slugSuffix}`, { shouldValidate: true })
        }
    }, [title, slugSuffix, setValue, initialData])

    const onSubmit = async (data: FormData) => {
        // ID of a Nexus product created during this submit, so it can be rolled
        // back if the local Firestore write fails afterwards.
        let createdNexusId: string | undefined

        try {
            // Get Firebase ID token for nexus admin authorization
            const currentUser = auth.currentUser
            if (!currentUser) {
                throw new Error("Not authenticated. Please sign in again.")
            }

            // Block nexus sync if email is not verified — nexusprods requires emailVerified === true
            if (!currentUser.emailVerified) {
                throw new Error(
                    "Email not verified. Please verify your email before saving a project. " +
                    "Check your inbox for a verification link, or click 'Resend Verification Link' in the admin dashboard."
                )
            }

            // The slug field is disabled, so a slug can only collide if another
            // project already uses it. Fail loudly instead of creating a
            // duplicate public URL.
            const slugMatches = await getDocs(
                query(collection(db, "projects"), where("slug", "==", data.slug))
            )
            const slugTaken = slugMatches.docs.some((docSnap) => docSnap.id !== initialData?.id)
            if (slugTaken) {
                throw new Error(
                    `The slug "/projects/${data.slug}" is already in use. Change the title to generate a different slug.`
                )
            }

            const idToken = await currentUser.getIdToken()

            const tags = dedupe(data.tags ?? [])
            const features = dedupe(splitList(data.features, "\n"))
            const techStack = dedupe(data.techStack ?? [])

            const fields: ProjectFields = {
                title: data.title,
                shortDescription: data.shortDescription ?? "",
                description: data.description,
                slug: data.slug,
                status: data.status,
                websiteUrl: data.websiteUrl ?? "",
                imageUrl: data.imageUrl ?? "",
                category: data.category ?? "",
                pricing: canonicalizePrice(data.pricing ?? ""),
                launchDate: data.launchDate ?? "",
                tags,
                features,
                techStack,
                images: dedupe(data.images ?? []),
            }

            // Capture the live pre-edit state so a failed local write can be
            // rolled back to the real values rather than the possibly stale
            // snapshot that was loaded when the edit page opened.
            //
            // `getProjectByIdResult` reports read errors instead of
            // swallowing them: a failed read would silently fall back to the
            // stale page snapshot and the rollback would restore the wrong
            // values.
            let previousProject: Project | undefined
            if (initialData) {
                const live = await getProjectByIdResult(initialData.id)
                if (live.error) {
                    throw new Error(
                        `Could not read the current project from Firestore (${live.error}). The save was cancelled so nothing would be overwritten with stale data.`
                    )
                }
                previousProject = live.project ?? undefined
            }

            // Determine if nexus sync is needed:
            // - Create: always sync (create on nexus)
            // - Edit with nexusProductId: always sync (update on nexus)
            // - Edit without nexusProductId, flipping coming_soon -> active: create on nexus
            // - Edit without nexusProductId, not flipping to active: no sync
            //
            // NEXUS_AVAILABLE is false in emulator builds: Nexus only accepts
            // tokens from the production Firebase project, so a sync could
            // never succeed there. The local catalogue is still written, and
            // an existing nexusProductId is left untouched.
            //
            // The decision is based on the live document, not on the page
            // snapshot — another admin may have changed the status or the
            // mirrored product id since the page was opened.
            const liveNexusProductId = previousProject?.nexusProductId
            const liveStatus = previousProject?.status

            const shouldCreateOnNexus = NEXUS_AVAILABLE && (
                !initialData
                || (liveStatus === "coming_soon" && data.status === "active" && !liveNexusProductId)
            )
            const shouldUpdateOnNexus = NEXUS_AVAILABLE && !!liveNexusProductId

            const projectForNexus: Project = {
                id: initialData?.id || "",
                title: fields.title,
                description: fields.description,
                shortDescription: fields.shortDescription || undefined,
                slug: fields.slug,
                status: fields.status,
                imageUrl: fields.imageUrl || undefined,
                images: fields.images,
                websiteUrl: fields.websiteUrl || undefined,
                category: fields.category || undefined,
                tags,
                pricing: fields.pricing || undefined,
                createdAt: initialData?.createdAt ?? new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }

            let nexusProductId: string | undefined

            if (shouldCreateOnNexus) {
                const result = await syncProjectToNexus(projectForNexus, idToken)
                if (!result.ok) {
                    throw new Error(result.error || "Nexus project creation failed")
                }
                // A successful response without an id would leave an orphaned
                // Nexus product behind a local project that cannot be synced.
                if (!result.nexusId) {
                    throw new Error(
                        "Nexus accepted the project but did not return an id, so it cannot be linked. Nothing was saved locally."
                    )
                }
                nexusProductId = result.nexusId
                createdNexusId = result.nexusId
            } else if (shouldUpdateOnNexus) {
                nexusProductId = liveNexusProductId
                const result = await updateProjectToNexus(nexusProductId!, projectForNexus, idToken)

                if (!result.ok && result.status === 404) {
                    // The mirrored product was deleted on Nexus — recreate it
                    // rather than leaving the local project unsynced.
                    const createResult = await syncProjectToNexus(projectForNexus, idToken)
                    if (!createResult.ok) {
                        throw new Error(createResult.error || "Nexus project creation failed")
                    }
                    if (!createResult.nexusId) {
                        throw new Error(
                            "Nexus accepted the replacement product but did not return an id, so it cannot be linked. Nothing was saved locally."
                        )
                    }
                    nexusProductId = createResult.nexusId
                    createdNexusId = createResult.nexusId
                } else if (!result.ok) {
                    throw new Error(result.error || "Nexus project update failed")
                }
            }

            try {
                if (initialData) {
                    await updateDoc(doc(db, "projects", initialData.id), {
                        ...buildProjectPayload(fields, "update"),
                        ...(nexusProductId ? { nexusProductId } : {}),
                        updatedAt: serverTimestamp(),
                    })
                } else {
                    await addDoc(collection(db, "projects"), {
                        ...buildProjectPayload(fields, "create"),
                        ...(nexusProductId ? { nexusProductId } : {}),
                        waitlistCount: 0,
                        createdAt: serverTimestamp(),
                    })
                }
            } catch (localError) {
                // The local write failed after Nexus succeeded — undo the Nexus
                // change so the two stores stay consistent. The rollback
                // helpers return a result instead of throwing, so the outcome
                // has to be checked: a silent rollback failure leaves the two
                // stores out of sync and the admin would never find out.
                let rollbackError: string | null = null

                if (createdNexusId) {
                    const rollback = await deleteProductFromNexus(createdNexusId, idToken)
                    if (!rollback.ok) {
                        rollbackError = `The local save failed and the Nexus product could not be removed (${rollback.error ?? "unknown error"}). Nexus still has a product for this project.`
                    }
                } else if (shouldUpdateOnNexus && nexusProductId && previousProject) {
                    // Best-effort revert to the real pre-edit values.
                    const rollback = await updateProjectToNexus(nexusProductId, previousProject, idToken)
                    if (!rollback.ok) {
                        rollbackError = `The local save failed and Nexus could not be restored to its previous values (${rollback.error ?? "unknown error"}). The two catalogues may be out of sync.`
                    }
                }

                if (rollbackError) {
                    console.error("Nexus rollback failed:", rollbackError)
                    throw new Error(
                        `${describeWriteError(localError, initialData)} ${rollbackError}`
                    )
                }

                throw localError
            }

            toast.success(initialData ? "Project updated successfully" : "Project created successfully")
            router.push("/admin/projects")
            router.refresh()
        } catch (error) {
            console.error("Error saving project:", error)
            toast.error(describeWriteError(error, initialData))
        }
    }

    /**
     * The submit handler for the whole form.
     *
     * `handleSubmit` validates asynchronously before it calls `onSubmit`, so
     * the button was still enabled during that window and two rapid clicks
     * could create two projects (and two Nexus products). The lock is taken
     * here — synchronously, before validation starts — and released once the
     * write has finished, whether it succeeded or the validation failed.
     */
    const submitHandler = handleSubmit(onSubmit)

    const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (isLoading) return

        setIsLoading(true)
        try {
            await submitHandler(event)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!initialData) return

        // Two-step confirmation. A native `window.confirm()` was used
        // before, but a suppressed or dismissed browser dialog fails
        // silently, so the button looks broken.
        if (!isDeleteArmed) {
            setDeleteArmedFor(initialData.id)
            return
        }

        setDeleteArmedFor(null)
        setIsLoading(true)
        try {
            // Get Firebase ID token for nexus admin authorization
            const currentUser = auth.currentUser
            if (!currentUser) {
                throw new Error("Not authenticated. Please sign in again.")
            }
            const idToken = await currentUser.getIdToken()

            // Read the live document so the Nexus restore below uses the real
            // values and the real mirrored product id, not the snapshot that
            // was loaded when the edit page opened.
            //
            // A failed read is not "no project": aborting here is the only
            // safe answer. Deleting from the stale snapshot could remove the
            // wrong Nexus product (the link may have changed since the page
            // was opened) and could leave the current Nexus product
            // orphaned.
            const live = await getProjectByIdResult(initialData.id)
            if (live.error) {
                throw new Error(
                    `Could not read the current project (${live.error}) — nothing was deleted.`
                )
            }
            const liveProject = live.project ?? initialData
            const liveNexusProductId = liveProject.nexusProductId

            // If project was synced to nexus, delete it there first
            if (NEXUS_AVAILABLE && liveNexusProductId) {
                const nexusResult = await deleteProductFromNexus(liveNexusProductId, idToken)
                if (!nexusResult.ok) {
                    throw new Error(nexusResult.error || "Failed to delete project from Nexus")
                }
            }

            try {
                await deleteProject(initialData.id)
            } catch (localError) {
                // The local delete failed after Nexus succeeded — restore the
                // mirrored product so the two stores stay consistent.
                //
                // The restore creates a *new* Nexus product, so it gets a new
                // id. The local document still points at the old one, which
                // no longer exists, so the new id has to be written back.
                if (NEXUS_AVAILABLE && liveNexusProductId) {
                    const restore = await syncProjectToNexus(liveProject, idToken)
                    if (!restore.ok) {
                        throw new Error(
                            `${describeWriteError(localError, initialData)} The Nexus product could not be restored either (${restore.error ?? "unknown error"}), so the two catalogues are out of sync.`
                        )
                    }

                    if (restore.nexusId && restore.nexusId !== liveNexusProductId) {
                        try {
                            await updateDoc(doc(db, "projects", initialData.id), {
                                nexusProductId: restore.nexusId,
                                updatedAt: serverTimestamp(),
                            })
                        } catch (relinkError) {
                            throw new Error(
                                `${describeWriteError(localError, initialData)} The Nexus product was restored under a new id (${restore.nexusId}) but the local link could not be updated (${relinkError instanceof Error ? relinkError.message : "unknown error"}).`
                            )
                        }
                    }
                }
                throw localError
            }

            toast.success("Project deleted successfully")

            // The waitlist entries hold visitor email addresses. Removing them
            // with the project keeps that personal data from lingering with
            // no way for the visitor to withdraw it.
            try {
                const removed = await deleteWaitlistEntriesForProject(initialData.id)
                if (removed > 0) {
                    toast.success(
                        `Project and ${removed} waitlist ${removed === 1 ? "entry" : "entries"} deleted.`
                    )
                }
            } catch (cleanupError) {
                console.error("Failed to remove waitlist entries:", cleanupError)
                toast.error(
                    "The project was deleted, but its waitlist entries could not be removed. The visitor email addresses are still stored — ask the site owner to delete them from the `waitlist` collection in Firestore."
                )
            }

            router.push("/admin/projects")
            router.refresh()
        } catch (error) {
            console.error("Error deleting project:", error)
            toast.error(describeWriteError(error, initialData))
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={(event) => void handleFormSubmit(event)} className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                        {initialData ? "Edit Project" : "New Project"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {initialData ? "Update existing project details" : "Add a new project to your portfolio"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="rounded-full px-6"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? "Save Changes" : "Create Project"}
                    </Button>
                    {initialData && (
                        isDeleteArmed ? (
                            <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
                                <span className="text-sm text-red-200">
                                    Delete this project permanently?
                                </span>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={isLoading}
                                    className="rounded-full px-4 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                                >
                                    Yes, delete
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setDeleteArmedFor(null)}
                                    disabled={isLoading}
                                    className="rounded-full px-4 text-muted-foreground hover:text-white"
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="rounded-full px-6 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                            >
                                Delete
                            </Button>
                        )
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl">
                        <CardHeader className="border-b border-white/5 pb-6">
                            <CardTitle className="text-xl">Project Details</CardTitle>
                            <CardDescription>Basic information about your SaaS project</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-3">
                                <Label htmlFor="title" className="text-base font-medium pl-1">Project Title</Label>
                                <Input
                                    id="title"
                                    {...register("title")}
                                        aria-invalid={!!errors.title}
                                        aria-describedby={errors.title ? "title-error" : undefined}
                                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="e.g. Acme Corp"
                                />
                                {errors.title && <p id="title-error" role="alert" className="text-sm text-destructive pl-1">{errors.title.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="slug" className="text-base font-medium pl-1">Slug</Label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-3.5 text-muted-foreground/50 text-sm font-mono group-focus-within:text-primary/70 transition-colors">/projects/</span>
                                    <Input
                                        id="slug"
                                        {...register("slug")}
                                        aria-invalid={!!errors.slug}
                                        aria-describedby={errors.slug ? "slug-error" : undefined}
                                        disabled={true} // Always disabled as per requirements
                                        className="h-12 rounded-2xl bg-black/20 border-white/10 pl-24 font-mono focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="acme-corp"
                                    />
                                </div>
                                {errors.slug && <p id="slug-error" role="alert" className="text-sm text-destructive pl-1">{errors.slug.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="shortDescription" className="text-base font-medium pl-1">Short Description</Label>
                                <Input
                                    id="shortDescription"
                                    {...register("shortDescription")}
                                        aria-invalid={!!errors.shortDescription}
                                        aria-describedby={errors.shortDescription ? "shortDescription-error" : undefined}
                                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="Brief summary for project cards (max 200 chars)"
                                />
                                {errors.shortDescription && <p id="shortDescription-error" role="alert" className="text-sm text-destructive pl-1">{errors.shortDescription.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="description" className="text-base font-medium pl-1">Description</Label>
                                <Tabs defaultValue="write" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 mb-2">
                                        <TabsTrigger value="write">Write</TabsTrigger>
                                        <TabsTrigger value="preview">Preview</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="write">
                                        <Textarea
                                            id="description"
                                            {...register("description")}
                                        aria-invalid={!!errors.description}
                                        aria-describedby={errors.description ? "description-error" : undefined}
                                            className="min-h-[200px] rounded-2xl bg-black/20 border-white/10 resize-y focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40 p-4 font-mono text-sm"
                                            placeholder="Describe your project (Markdown supported)..."
                                        />
                                    </TabsContent>
                                    <TabsContent value="preview">
                                        <div className="min-h-[200px] w-full rounded-2xl border border-white/10 bg-black/40 p-4 prose prose-invert prose-sm max-w-none overflow-y-auto">
                                            {descriptionValue ? (
                                                <ReactMarkdown>{descriptionValue}</ReactMarkdown>
                                            ) : (
                                                <p className="text-muted-foreground italic">Nothing to preview</p>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                                {errors.description && <p id="description-error" role="alert" className="text-sm text-destructive pl-1">{errors.description.message}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl">
                        <CardHeader className="border-b border-white/5 pb-6">
                            <CardTitle className="text-xl">Media & Links</CardTitle>
                            <CardDescription>External links and assets</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label htmlFor="websiteUrl" className="text-base font-medium pl-1">Website URL</Label>
                                    <Input
                                        id="websiteUrl"
                                        {...register("websiteUrl")}
                                        aria-invalid={!!errors.websiteUrl}
                                        aria-describedby={errors.websiteUrl ? "websiteUrl-error" : undefined}
                                        className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                        placeholder="https://acme.com"
                                    />
                                    {errors.websiteUrl && <p id="websiteUrl-error" role="alert" className="text-sm text-destructive pl-1">{errors.websiteUrl.message}</p>}
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="imageUrl" className="text-base font-medium pl-1">Image URL</Label>
                                    <Input
                                        id="imageUrl"
                                        {...register("imageUrl")}
                                        aria-invalid={!!errors.imageUrl}
                                        aria-describedby={errors.imageUrl ? "imageUrl-error" : undefined}
                                        className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                        placeholder="https://..."
                                    />
                                    {errors.imageUrl && <p id="imageUrl-error" role="alert" className="text-sm text-destructive pl-1">{errors.imageUrl.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base font-medium pl-1">Project Gallery</Label>
                                <ImageUpload
                                    value={imagesValue || []}
                                    onChange={(updater) =>
                                        setValue("images", updater(imagesValue || []))
                                    }
                                    onRemove={(url) => setValue("images", (imagesValue || []).filter((current) => current !== url))}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl">
                        <CardHeader className="border-b border-white/5 pb-6">
                            <CardTitle className="text-xl">Visibility</CardTitle>
                            <CardDescription>Control project availability</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-3">
                                <Label htmlFor="status" className="text-base font-medium pl-1">Status</Label>
                                <div className="relative">
                                    <select
                                        id="status"
                                        {...register("status")}
                                        aria-invalid={!!errors.status}
                                        aria-describedby={errors.status ? "status-error" : undefined}
                                        className="w-full h-12 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition-all hover:bg-black/30"
                                    >
                                        <option value="active" className="bg-slate-900">Active (Live)</option>
                                        <option value="coming_soon" className="bg-slate-900">Coming Soon</option>
                                    </select>
                                    <div className="absolute right-4 top-3.5 pointer-events-none text-muted-foreground">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                                {errors.status && <p id="status-error" role="alert" className="text-sm text-destructive pl-1">{errors.status.message}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl">
                        <CardHeader className="border-b border-white/5 pb-6">
                            <CardTitle className="text-xl">Categorization</CardTitle>
                            <CardDescription>Organize your project</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            {taxonomyError && (
                                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>
                                        {taxonomyLoadFailed
                                            ? "Could not load the shared option lists, so these dropdowns only show the values already on this project. Creating new options is disabled until the lists load again."
                                            : taxonomyError}
                                    </span>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label id="category-label" className="text-base font-medium pl-1">Category</Label>
                                <Controller
                                    name="category"
                                    control={control}
                                    render={({ field }) => (
                                        <Combobox
                                            id="category"
                                            labelledBy="category-label"
                                            aria-invalid={!!errors.category}
                                            aria-describedby={errors.category ? "category-error" : undefined}
                                            options={categoryOptions}
                                            value={field.value ? [field.value] : []}
                                            onChange={(next) => field.onChange(next[0] ?? "")}
                                            onCreate={(option) => void createOption("categories", option)}
                                            allowCreate={!taxonomyLoadFailed}
                                            placeholder="Pick or create a category"
                                        />
                                    )}
                                />
                                {errors.category?.message && <p id="category-error" role="alert" className="text-sm text-destructive pl-1">{errors.category.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label id="tags-label" className="text-base font-medium pl-1">Tags</Label>
                                <Controller
                                    name="tags"
                                    control={control}
                                    render={({ field }) => (
                                        <Combobox
                                            id="tags"
                                            labelledBy="tags-label"
                                            aria-invalid={!!errors.tags}
                                            aria-describedby={errors.tags ? "tags-error" : undefined}
                                            multiple
                                            options={tagOptions}
                                            value={field.value ?? []}
                                            onChange={field.onChange}
                                            onCreate={(option) => void createOption("tags", option)}
                                            allowCreate={!taxonomyLoadFailed}
                                            placeholder="Pick or create tags"
                                        />
                                    )}
                                />
                                <p className="text-xs text-muted-foreground pl-1">
                                    Pick from the shared list, or type a new tag and press Enter to add it.
                                </p>
                                {errors.tags?.message && <p id="tags-error" role="alert" className="text-sm text-destructive pl-1">{errors.tags.message}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl">
                        <CardHeader className="border-b border-white/5 pb-6">
                            <CardTitle className="text-xl">Extended Details</CardTitle>
                            <CardDescription>Additional information about your project</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-3">
                                <Label htmlFor="features" className="text-base font-medium pl-1">Key Features</Label>
                                <Textarea
                                    id="features"
                                    {...register("features")}
                                        aria-invalid={!!errors.features}
                                        aria-describedby={errors.features ? "features-error" : undefined}
                                    className="min-h-[100px] rounded-2xl bg-black/20 border-white/10 resize-y focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="Feature 1&#10;Feature 2&#10;Feature 3&#10;(One feature per line)"
                                />
                                {taxonomy.features.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pl-1">
                                        {taxonomy.features.map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                onClick={() => {
                                                    const current = featuresValue.trim()
                                                    const next = current
                                                        ? `${current}\n${suggestion}`
                                                        : suggestion
                                                    setValue("features", next, { shouldValidate: true })
                                                }}
                                                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                            >
                                                + {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {errors.features && <p id="features-error" role="alert" className="text-sm text-destructive pl-1">{errors.features.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label id="techStack-label" className="text-base font-medium pl-1">Tech Stack</Label>
                                <Controller
                                    name="techStack"
                                    control={control}
                                    render={({ field }) => (
                                        <Combobox
                                            id="techStack"
                                            labelledBy="techStack-label"
                                            aria-invalid={!!errors.techStack}
                                            aria-describedby={errors.techStack ? "techStack-error" : undefined}
                                            multiple
                                            options={techStackOptions}
                                            value={field.value ?? []}
                                            onChange={field.onChange}
                                            onCreate={(option) => void createOption("techStack", option)}
                                            allowCreate={!taxonomyLoadFailed}
                                            placeholder="Pick or create technologies"
                                        />
                                    )}
                                />
                                <p className="text-xs text-muted-foreground pl-1">
                                    Pick from the shared list, or type a new technology and press Enter.
                                </p>
                                {errors.techStack?.message && <p id="techStack-error" role="alert" className="text-sm text-destructive pl-1">{errors.techStack.message}</p>}
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label htmlFor="pricing" className="text-base font-medium pl-1">Pricing Model</Label>
                                    {/* Not type="number": a number input silently
                                        discards legacy free-text values such as
                                        "Free" — the browser reports the value as
                                        empty, React warns about the
                                        unparseable value, and saving the form
                                        would wipe the stored price. */}
                                    <Input
                                        id="pricing"
                                        type="text"
                                        inputMode="decimal"
                                        {...register("pricing")}
                                        aria-invalid={!!errors.pricing}
                                        aria-describedby={errors.pricing ? "pricing-error" : undefined}
                                        className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                        placeholder="e.g. 29"
                                    />
                                    {legacyPricing && (
                                        <p className="text-xs text-muted-foreground pl-1">
                                            Legacy pricing “{legacyPricing}” — leave it as is, or
                                            replace it with a number.
                                        </p>
                                    )}
                                    {errors.pricing && <p id="pricing-error" role="alert" className="text-sm text-destructive pl-1">{errors.pricing.message}</p>}
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-base font-medium pl-1">Launch Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="launchDate"
                                                variant={"outline"}
                                                aria-invalid={!!errors.launchDate}
                                                aria-describedby={errors.launchDate ? "launchDate-error" : undefined}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal h-12 rounded-2xl bg-black/20 border-white/10 hover:bg-black/30",
                                                    !launchDateValue && "text-muted-foreground/40"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {launchDateValue ? (
                                                    (parseLocalDateString(launchDateValue)?.toLocaleDateString() ??
                                                        launchDateValue)
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-[#0A0A0A] border-white/10" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={launchDateValue ? parseLocalDateString(launchDateValue) : undefined}
                                                onSelect={(date: Date | undefined) => {
                                                    // Store the local calendar day the admin picked.
                                                    // `toISOString()` would convert it to UTC and shift
                                                    // the date by a day in positive-offset timezones.
                                                    const dateString = date ? toLocalDateString(date) : '';
                                                    setValue("launchDate", dateString, { shouldValidate: true });
                                                }}
                                                autoFocus
                                                className="bg-[#0A0A0A] text-white"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {errors.launchDate && <p id="launchDate-error" role="alert" className="text-sm text-destructive pl-1">{errors.launchDate.message}</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    )
}
