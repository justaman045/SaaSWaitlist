import type { Project, ToolRequest, WaitlistEntry } from "@/types"

export interface DemandRow {
    /** Stable identifier — the project id, or a slug of the requested title. */
    key: string
    label: string
    projectId?: string
    status?: Project["status"]
    /** Waitlist signups for this tool. */
    signups: number
    /** Public requests attached to this tool. */
    requests: number
    /** signups + requests — the raw demand signal. */
    total: number
    /** Emails of everyone who requested an unlisted tool. */
    emails?: string[]
}

export interface DemandRanking {
    /** Tools that exist in the catalogue, highest demand first. */
    listed: DemandRow[]
    /** Requested tools that are not in the catalogue — build candidates. */
    unlisted: DemandRow[]
}

/** Normalises a requested title so "AI  Chat" and "ai chat" group together. */
function normalizeTitle(title: string): string {
    return title.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Combines waitlist signups and public requests into a demand ranking.
 *
 * This is the number that answers "what should I build next?" — a tool with
 * 40 signups and 0 requests still outranks one with 0 signups and 5
 * requests, and a requested tool with no project page shows up as a
 * candidate to add to the catalogue.
 */
export function buildDemandRanking(
    projects: readonly Project[],
    entries: readonly WaitlistEntry[],
    requests: readonly ToolRequest[],
    options: { useCounterFallback?: boolean } = {}
): DemandRanking {
    const signupsByProject = new Map<string, number>()
    for (const entry of entries) {
        if (!entry.projectId) continue
        signupsByProject.set(
            entry.projectId,
            (signupsByProject.get(entry.projectId) ?? 0) + 1
        )
    }

    const requestsByProject = new Map<string, number>()
    const unlistedGroups = new Map<
        string,
        { label: string; count: number; emails: Set<string> }
    >()

    for (const request of requests) {
        if (request.projectId) {
            requestsByProject.set(
                request.projectId,
                (requestsByProject.get(request.projectId) ?? 0) + 1
            )
            continue
        }

        const key = normalizeTitle(request.title)
        if (!key) continue

        const group = unlistedGroups.get(key) ?? {
            label: request.title.trim(),
            count: 0,
            emails: new Set<string>(),
        }
        group.count += 1
        if (request.email) group.emails.add(request.email)
        unlistedGroups.set(key, group)
    }

    const listed: DemandRow[] = projects.map((project) => {
        // The number of waitlist entries is the truth. The counter stored on
        // the project document is only used as a stand-in when the waitlist
        // collection could not be read at all — otherwise a project without
        // entries would still report the stale counter.
        const entryCount = signupsByProject.get(project.id)
        const signups =
            entryCount ??
            (options.useCounterFallback ? (project.waitlistCount ?? 0) : 0)
        const requestCount = requestsByProject.get(project.id) ?? 0

        return {
            key: project.id,
            label: project.title,
            projectId: project.id,
            status: project.status,
            signups,
            requests: requestCount,
            total: signups + requestCount,
        }
    })

    const unlisted: DemandRow[] = [...unlistedGroups.entries()].map(([key, group]) => ({
        key: `requested:${key}`,
        label: group.label,
        signups: 0,
        requests: group.count,
        total: group.count,
        emails: [...group.emails],
    }))

    listed.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    unlisted.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))

    return { listed, unlisted }
}

/**
 * Local calendar-day key (`YYYY-MM-DD`).
 *
 * Deliberately local rather than UTC: a signup at 23:30 in UTC+5 belongs to
 * that local day, and bucketing on the UTC date would move it a day earlier.
 */
function localDayKey(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Counts signups per day for the last `days` days.
 *
 * Days without signups are included as zero so the chart keeps a stable
 * x-axis instead of collapsing gaps.
 *
 * `now` is the reference point for the last day. It is passed in so the
 * result only depends on its arguments — reading the clock inside the
 * function would make it impossible to reason about, and the React purity
 * rules forbid it during a render.
 */
export function buildSignupTimeline(
    entries: readonly WaitlistEntry[],
    days = 30,
    now: Date = new Date()
): { date: string; label: string; count: number }[] {
    const buckets = new Map<string, number>()
    const labels = new Map<string, string>()

    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const day = new Date(today)
        day.setDate(day.getDate() - offset)

        const key = localDayKey(day)
        buckets.set(key, 0)
        labels.set(key, day.toLocaleDateString(undefined, { month: "short", day: "numeric" }))
    }

    for (const entry of entries) {
        if (!entry.createdAt) continue
        const date = new Date(entry.createdAt)
        if (Number.isNaN(date.getTime())) continue

        const key = localDayKey(date)
        if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) ?? 0) + 1)
        }
    }

    return [...buckets.entries()].map(([key, count]) => ({
        date: key,
        label: labels.get(key) ?? key,
        count,
    }))
}
