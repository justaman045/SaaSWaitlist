"use client"

import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { syncProjectToNexus } from "@/lib/nexus"
import ImageUpload from "@/components/ui/image-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Project } from "@/types"

const formSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    shortDescription: z.string().max(200, "Short description must be less than 200 characters").optional(),
    description: z.string().min(10, "Description must be at least 10 characters"),
    slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
    status: z.enum(["active", "coming_soon"]),
    websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    category: z.string().optional(),
    tags: z.string().optional(),
    features: z.string().optional(),
    techStack: z.string().optional(),
    pricing: z.string().optional(),
    launchDate: z.string().optional(),
    images: z.array(z.string()).optional(),
})

type FormData = z.infer<typeof formSchema>

interface ProjectFormProps {
    initialData?: Project
}

export default function ProjectForm({ initialData }: ProjectFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    // Only generate suffix if creating new project
    const [slugSuffix] = useState(() => initialData ? "" : Math.random().toString(36).substring(2, 7))

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: initialData?.title || "",
            shortDescription: initialData?.shortDescription || "",
            description: initialData?.description || "",
            slug: initialData?.slug || "",
            status: initialData?.status || "active",
            websiteUrl: initialData?.websiteUrl || "",
            imageUrl: initialData?.imageUrl || "",
            category: initialData?.category || "",
            tags: initialData?.tags?.join(", ") || "",
            features: initialData?.features?.join("\n") || "",
            techStack: initialData?.techStack?.join(", ") || "",
            pricing: initialData?.pricing || "",
            launchDate: initialData?.launchDate || "",
            images: initialData?.images || [],
        },
    })

    const title = watch("title")

    // Auto-generate slug only for new projects
    useEffect(() => {
        if (!initialData && title) {
            const slugBase = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")

            setValue("slug", `${slugBase}-${slugSuffix}`)
        }
    }, [title, slugSuffix, setValue, initialData])

    const onSubmit = async (data: FormData) => {
        setIsLoading(true)
        try {
            // Get Firebase ID token for nexus admin authorization
            const currentUser = auth.currentUser
            if (!currentUser) {
                throw new Error("Not authenticated. Please sign in again.")
            }

            // Block nexus sync if email is not verified — nexusprods requires emailVerified === true
            if (!currentUser.emailVerified) {
                throw new Error(
                    "Email not verified. Please verify your email before creating a project. " +
                    "Check your inbox for a verification link, or click 'Resend Verification Link' in the admin dashboard."
                )
            }

            const idToken = await currentUser.getIdToken()

            const projectData = {
                ...data,
                tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
                features: data.features ? data.features.split("\n").map(t => t.trim()).filter(Boolean) : [],
                techStack: data.techStack ? data.techStack.split(",").map(t => t.trim()).filter(Boolean) : [],
                pricing: data.pricing,
                launchDate: data.launchDate,
            }

            // Determine if nexus sync is needed:
            // - Create: always sync
            // - Edit: only sync when flipping coming_soon -> active
            const shouldSyncToNexus = !initialData
                || (initialData.status === "coming_soon" && data.status === "active")

            let nexusProductId: string | undefined

            if (shouldSyncToNexus) {
                const projectForNexus: Project = {
                    id: initialData?.id || "",
                    title: data.title,
                    description: data.description,
                    shortDescription: data.shortDescription,
                    slug: data.slug,
                    status: data.status,
                    imageUrl: data.imageUrl,
                    websiteUrl: data.websiteUrl,
                    category: data.category,
                    tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
                    pricing: data.pricing,
                    createdAt: new Date().toISOString(),
                }

                const result = await syncProjectToNexus(projectForNexus, idToken)
                if (!result.ok) {
                    console.error("Nexus sync failed:", result.error)
                    throw new Error(result.error || "Nexus project creation failed")
                }
                nexusProductId = result.nexusId
            }

            if (initialData) {
                await updateDoc(doc(db, "projects", initialData.id), {
                    ...projectData,
                    ...(nexusProductId ? { nexusProductId } : {}),
                    updatedAt: serverTimestamp(),
                })
                toast.success("Project updated successfully")
            } else {
                await addDoc(collection(db, "projects"), {
                    ...projectData,
                    ...(nexusProductId ? { nexusProductId } : {}),
                    createdAt: serverTimestamp(),
                })
                toast.success("Project created successfully")
            }

            router.push("/admin")
            router.refresh()
        } catch (error) {
            console.error("Error saving project:", error)
            toast.error(initialData ? "Failed to update project" : "Failed to create project")
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!initialData || !confirm("Are you sure you want to delete this project? This action cannot be undone.")) return

        setIsLoading(true)
        try {
            // Import dynamically to avoid circular dependencies or use a direct import if safe
            // For now assuming deleteProject is available or we import it
            const { deleteProject } = await import("@/lib/db-service")
            await deleteProject(initialData.id)
            toast.success("Project deleted successfully")
            router.push("/admin")
            router.refresh()
        } catch (error) {
            console.error("Error deleting project:", error)
            toast.error("Failed to delete project")
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-6">
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
                        variant="ghost"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isLoading}
                        className="rounded-full px-6"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? "Save Changes" : "Create Project"}
                    </Button>
                    {initialData && (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isLoading}
                            className="rounded-full px-6 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                        >
                            Delete
                        </Button>
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
                                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="e.g. Acme Corp"
                                />
                                {errors.title && <p className="text-sm text-destructive pl-1">{errors.title.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="slug" className="text-base font-medium pl-1">Slug</Label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-3.5 text-muted-foreground/50 text-sm font-mono group-focus-within:text-primary/70 transition-colors">/projects/</span>
                                    <Input
                                        id="slug"
                                        {...register("slug")}
                                        disabled={true} // Always disabled as per requirements
                                        className="h-12 rounded-2xl bg-black/20 border-white/10 pl-24 font-mono focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="acme-corp"
                                    />
                                </div>
                                {errors.slug && <p className="text-sm text-destructive pl-1">{errors.slug.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="shortDescription" className="text-base font-medium pl-1">Short Description</Label>
                                <Input
                                    id="shortDescription"
                                    {...register("shortDescription")}
                                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="Brief summary for project cards (max 120 chars)"
                                />
                                {errors.shortDescription && <p className="text-sm text-destructive pl-1">{errors.shortDescription.message}</p>}
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
                                            className="min-h-[200px] rounded-2xl bg-black/20 border-white/10 resize-y focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40 p-4 font-mono text-sm"
                                            placeholder="Describe your project (Markdown supported)..."
                                        />
                                    </TabsContent>
                                    <TabsContent value="preview">
                                        <div className="min-h-[200px] w-full rounded-2xl border border-white/10 bg-black/40 p-4 prose prose-invert prose-sm max-w-none overflow-y-auto">
                                            {watch("description") ? (
                                                <ReactMarkdown>{watch("description")}</ReactMarkdown>
                                            ) : (
                                                <p className="text-muted-foreground italic">Nothing to preview</p>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                                {errors.description && <p className="text-sm text-destructive pl-1">{errors.description.message}</p>}
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
                                        className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                        placeholder="https://acme.com"
                                    />
                                    {errors.websiteUrl && <p className="text-sm text-destructive pl-1">{errors.websiteUrl.message}</p>}
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="imageUrl" className="text-base font-medium pl-1">Image URL</Label>
                                    <Input
                                        id="imageUrl"
                                        {...register("imageUrl")}
                                        className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                        placeholder="https://..."
                                    />
                                    {errors.imageUrl && <p className="text-sm text-destructive pl-1">{errors.imageUrl.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base font-medium pl-1">Project Gallery</Label>
                                <ImageUpload
                                    value={watch("images") || []}
                                    onChange={(urls) => setValue("images", urls)}
                                    onRemove={(url) => setValue("images", (watch("images") || []).filter((current) => current !== url))}
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
                                        className="w-full h-12 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition-all hover:bg-black/30"
                                    >
                                        <option value="active" className="bg-slate-900">Active (Live)</option>
                                        <option value="coming_soon" className="bg-slate-900">Coming Soon</option>
                                    </select>
                                    <div className="absolute right-4 top-3.5 pointer-events-none text-muted-foreground">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                                {errors.status && <p className="text-sm text-destructive pl-1">{errors.status.message}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl">
                        <CardHeader className="border-b border-white/5 pb-6">
                            <CardTitle className="text-xl">Categorization</CardTitle>
                            <CardDescription>Organize your project</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-3">
                                <Label htmlFor="category" className="text-base font-medium pl-1">Category</Label>
                                <Input
                                    id="category"
                                    {...register("category")}
                                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="e.g. SaaS"
                                />
                                {errors.category && <p className="text-sm text-destructive pl-1">{errors.category.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="tags" className="text-base font-medium pl-1">Tags</Label>
                                <Input
                                    id="tags"
                                    {...register("tags")}
                                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="AI, DevTool, B2B"
                                />
                                <p className="text-xs text-muted-foreground pl-1">Comma separated</p>
                                {errors.tags && <p className="text-sm text-destructive pl-1">{errors.tags.message}</p>}
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
                                    className="min-h-[100px] rounded-2xl bg-black/20 border-white/10 resize-y focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="Feature 1&#10;Feature 2&#10;Feature 3&#10;(One feature per line)"
                                />
                                {errors.features && <p className="text-sm text-destructive pl-1">{errors.features.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="techStack" className="text-base font-medium pl-1">Tech Stack</Label>
                                <Input
                                    id="techStack"
                                    {...register("techStack")}
                                    className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                    placeholder="Next.js, Firebase, Tailwind (Comma separated)"
                                />
                                {errors.techStack && <p className="text-sm text-destructive pl-1">{errors.techStack.message}</p>}
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label htmlFor="pricing" className="text-base font-medium pl-1">Pricing Model</Label>
                                    <Input
                                        id="pricing"
                                        {...register("pricing")}
                                        className="h-12 rounded-2xl bg-black/20 border-white/10 focus:ring-primary/50 transition-all hover:bg-black/30 placeholder:text-muted-foreground/40"
                                        placeholder="e.g. Freemium, Paid, Free"
                                    />
                                    {errors.pricing && <p className="text-sm text-destructive pl-1">{errors.pricing.message}</p>}
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-base font-medium pl-1">Launch Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal h-12 rounded-2xl bg-black/20 border-white/10 hover:bg-black/30",
                                                    !watch("launchDate") && "text-muted-foreground/40"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {watch("launchDate") ? (
                                                    new Date(watch("launchDate")!).toLocaleDateString()
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-[#0A0A0A] border-white/10" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={watch("launchDate") ? new Date(watch("launchDate")!) : undefined}
                                                onSelect={(date: Date | undefined) => {
                                                    // Store as YYYY-MM-DD string to match original behavior
                                                    const dateString = date ? date.toISOString().split('T')[0] : '';
                                                    setValue("launchDate", dateString, { shouldValidate: true });
                                                }}
                                                initialFocus
                                                className="bg-[#0A0A0A] text-white"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {errors.launchDate && <p className="text-sm text-destructive pl-1">{errors.launchDate.message}</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
