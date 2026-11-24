import type { Taxonomy, TaxonomyField } from "@/types"

/**
 * The option lists that drive the admin form dropdowns.
 *
 * Each field is stored in its own document (`taxonomy/<field>`) so editing
 * one list can never clobber a concurrent edit of another.
 */
export const TAXONOMY_FIELDS = ["categories", "tags", "techStack", "features"] as const

export const TAXONOMY_FIELD_LABELS: Record<TaxonomyField, string> = {
    categories: "Categories",
    tags: "Tags",
    techStack: "Tech Stack",
    features: "Feature Suggestions",
}

export const TAXONOMY_FIELD_DESCRIPTIONS: Record<TaxonomyField, string> = {
    categories: "The single category a project belongs to.",
    tags: "Free-form labels shown on project cards and filters.",
    techStack: "Technologies a project is built with.",
    features: "Reusable feature bullets. These are suggestions only — the project form still keeps a free-text list.",
}

/**
 * Seed values used until the admin customises the lists. They are merged
 * with whatever is stored in Firestore, so a fresh install still gets a
 * usable dropdown.
 */
export const DEFAULT_TAXONOMY: Record<TaxonomyField, string[]> = {
    categories: [
        "AI",
        "Developer Tools",
        "Design",
        "Marketing",
        "Productivity",
        "SaaS",
        "Security",
    ],
    tags: [
        "AI",
        "API",
        "B2B",
        "Developer",
        "Free",
        "Open Source",
        "SaaS",
        "Self Hosted",
    ],
    techStack: [
        "Cloudinary",
        "Firebase",
        "Next.js",
        "Node.js",
        "PostgreSQL",
        "React",
        "Stripe",
        "Tailwind CSS",
        "TypeScript",
    ],
    features: [],
}

/** Trims an option and collapses internal whitespace. */
export function normalizeOption(value: string): string {
    return value.trim().replace(/\s+/g, " ")
}

/**
 * Normalises, de-duplicates (case-insensitively) and sorts a list of
 * options. The first spelling of an option wins, so "Next.js" and "next.js"
 * never both appear.
 */
export function dedupeOptions(values: readonly string[]): string[] {
    const seen = new Map<string, string>()

    for (const raw of values) {
        if (typeof raw !== "string") continue
        const normalized = normalizeOption(raw)
        if (!normalized) continue

        const key = normalized.toLowerCase()
        if (!seen.has(key)) {
            seen.set(key, normalized)
        }
    }

    return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/** Merges several option lists into one de-duplicated, sorted list. */
export function mergeOptions(...lists: (readonly string[] | undefined)[]): string[] {
    return dedupeOptions(lists.flatMap((list) => list ?? []))
}

/** A taxonomy with every field guaranteed to be an array. */
export function emptyTaxonomy(): Taxonomy {
    return { categories: [], tags: [], techStack: [], features: [] }
}
