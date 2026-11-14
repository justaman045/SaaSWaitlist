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
