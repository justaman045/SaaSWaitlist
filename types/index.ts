export interface Project {
    id: string
    title: string
    description: string
    shortDescription?: string
    slug: string
    status: "active" | "coming_soon"
    imageUrl?: string
    images?: string[]
    websiteUrl?: string
    category?: string
    tags?: string[]
    features?: string[]
    techStack?: string[]
    pricing?: string
    launchDate?: string
    waitlistCount?: number
    nexusProductId?: string // id of the mirrored product on nexusprods
    createdAt: string // ISO string for now
    updatedAt?: string
}

/** Admin-managed option lists used by the project form dropdowns. */
export type TaxonomyField = "categories" | "tags" | "techStack" | "features"

export interface Taxonomy {
    categories: string[]
    tags: string[]
    techStack: string[]
    features: string[]
}

/** A single waitlist signup, read from the `waitlist` collection. */
export interface WaitlistEntry {
    id: string
    projectId: string
    email: string
    /** ISO string */
    createdAt?: string
}

export type RequestStatus = "new" | "reviewing" | "accepted" | "rejected"

/** A public request for a tool or feature. */
export interface ToolRequest {
    id: string
    title: string
    description: string
    email: string
    /** Optional — the project this request relates to, when there is one. */
    projectId?: string
    status: RequestStatus
    /** ISO string */
    createdAt?: string
    updatedAt?: string
}
