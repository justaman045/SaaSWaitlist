"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
    AlertCircle,
    ArrowUpRight,
    FolderGit2,
    Inbox,
    Loader2,
    Plus,
    Users,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NexusPendingDeletions } from "@/components/nexus-pending-deletions"
import { BarChart, HorizontalBars, StatCard } from "@/components/admin/charts"
import {
    useAdminProjects,
    useAdminRequests,
    useAdminWaitlist,
    useNow,
} from "@/components/admin/use-admin-data"
import { buildDemandRanking, buildSignupTimeline } from "@/lib/demand"

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function timeAgo(value?: string): string {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return formatDistanceToNow(date, { addSuffix: true })
}

export default function AdminOverview() {
    const { data: projects, loading, error } = useAdminProjects()
    const { data: entries, error: waitlistError } = useAdminWaitlist()
    const { data: requests } = useAdminRequests()
    const now = useNow()

    // The reference time comes from `useNow()` — the clock is read after
    // mount, never during the render.
    const timeline = useMemo(
        () => buildSignupTimeline(entries, 30, now ? new Date(now) : new Date()),
        [entries, now]
    )
    const demand = useMemo(
        () =>
            buildDemandRanking(projects, entries, requests, {
                // The stored counter is only a safe stand-in when the waitlist
                // collection could not be read at all.
                useCounterFallback: Boolean(waitlistError),
            }),
        [projects, entries, requests, waitlistError]
    )

    const liveProjects = projects.filter((project) => project.status === "active").length
    const comingSoonProjects = projects.length - liveProjects
    const signupsLast7Days = now
        ? entries.filter((entry) => {
              if (!entry.createdAt) return false
              const time = new Date(entry.createdAt).getTime()
              return Number.isFinite(time) && now - time < SEVEN_DAYS_MS
          }).length
        : 0
    const openRequests = requests.filter(
        (request) => request.status === "new" || request.status === "reviewing"
    ).length
    const mirroredProjects = projects.filter((project) => project.nexusProductId).length

    const topProjects = demand.listed
        .filter((row) => row.total > 0)
        .slice(0, 5)
        .map((row) => ({
            label: row.label,
            value: row.total,
            hint: `${row.signups} signup${row.signups === 1 ? "" : "s"} · ${row.requests} request${
                row.requests === 1 ? "" : "s"
            }`,
        }))

    const demandRows = demand.listed.filter((row) => row.total > 0).slice(0, 10)
    const latestSignups = entries.slice(0, 8)

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                    <p className="text-sm text-muted-foreground">
                        Demand across every tool in your catalogue.
                    </p>
                </div>
                <Button asChild className="rounded-full">
                    <Link href="/admin/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Link>
                </Button>
            </div>

            <NexusPendingDeletions />

            {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Could not load projects from Firestore: {error}. Check your connection and
                        that your account is allowed to read this collection.
                    </span>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Projects"
                    value={loading ? "—" : projects.length}
                    hint={`${liveProjects} live · ${comingSoonProjects} coming soon`}
                    icon={<FolderGit2 className="h-4 w-4" />}
                />
                <StatCard
                    label="Waitlist signups"
                    value={loading ? "—" : entries.length}
                    hint={now ? `${signupsLast7Days} in the last 7 days` : "Loading…"}
                    icon={<Users className="h-4 w-4" />}
                />
                <StatCard
                    label="Open requests"
                    value={loading ? "—" : openRequests}
                    hint={`${requests.length} total received`}
                    icon={<Inbox className="h-4 w-4" />}
                />
                <StatCard
                    label="Mirrored to Nexus"
                    value={loading ? "—" : mirroredProjects}
                    hint={`${projects.length - mirroredProjects} not synced yet`}
                    icon={<ArrowUpRight className="h-4 w-4" />}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-xl">
                    <div className="mb-6 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-semibold text-white">Signups — last 30 days</h2>
                            <p className="text-xs text-muted-foreground">
                                {entries.length} signup{entries.length === 1 ? "" : "s"} in total
                            </p>
                        </div>
                        <Link
                            href="/admin/signups"
                            className="text-xs font-medium text-primary hover:underline"
                        >
                            View all
                        </Link>
                    </div>
                    <BarChart
                        data={timeline.map((bucket) => ({
                            label: bucket.label,
                            count: bucket.count,
                        }))}
                    />
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-xl">
                    <div className="mb-6 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="font-semibold text-white">Most wanted tools</h2>
                            <p className="text-xs text-muted-foreground">
                                Signups plus requests, highest demand first
                            </p>
                        </div>
                        <Link
                            href="/admin/projects"
                            className="text-xs font-medium text-primary hover:underline"
                        >
                            All projects
                        </Link>
                    </div>
                    <HorizontalBars
                        data={topProjects}
                        emptyText="No signups or requests yet"
                    />
                </section>
            </div>

            <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
                    <div>
                        <h2 className="font-semibold text-white">Demand leaderboard</h2>
                        <p className="text-xs text-muted-foreground">
                            What people are actually asking for
                        </p>
                    </div>
                    <Link
                        href="/admin/requests"
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        Review requests
                    </Link>
                </div>

                {demandRows.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                        No demand data yet. Share a project or publish a request form to start
                        collecting signups.
                    </p>
                ) : (
                    <ul className="divide-y divide-white/5">
                        {demandRows.map((row) => (
                            <li key={row.key}>
                                <Link
                                    href={`/admin/edit/${row.projectId}`}
                                    className="flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5"
                                >
                                    <span className="min-w-0 flex-1 truncate font-medium text-white">
                                        {row.label}
                                    </span>
                                    {row.status && (
                                        <Badge
                                            variant={row.status === "active" ? "default" : "secondary"}
                                            className={
                                                row.status === "active"
                                                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/20"
                                                    : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/20"
                                            }
                                        >
                                            {row.status === "active" ? "Live" : "Coming Soon"}
                                        </Badge>
                                    )}
                                    <span className="w-24 text-right text-sm text-muted-foreground">
                                        {row.signups} signup{row.signups === 1 ? "" : "s"}
                                    </span>
                                    <span className="w-24 text-right text-sm text-muted-foreground">
                                        {row.requests} request{row.requests === 1 ? "" : "s"}
                                    </span>
                                    <span className="w-16 text-right font-semibold text-primary">
                                        {row.total}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {demand.unlisted.length > 0 && (
                <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 backdrop-blur-md shadow-xl">
                    <h2 className="font-semibold text-amber-100">Requested but not listed yet</h2>
                    <p className="mb-5 mt-1 text-xs text-amber-200/70">
                        These tools do not have a project page. High demand here means a candidate
                        for the catalogue.
                    </p>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {demand.unlisted.slice(0, 9).map((row) => (
                            <li
                                key={row.key}
                                className="rounded-2xl border border-amber-500/20 bg-black/20 px-4 py-3"
                            >
                                <p className="truncate font-medium text-amber-100">{row.label}</p>
                                <p className="mt-1 text-xs text-amber-200/70">
                                    {row.requests} request{row.requests === 1 ? "" : "s"}
                                    {row.emails?.length ? ` · ${row.emails.length} people` : ""}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
                    <h2 className="font-semibold text-white">Latest signups</h2>
                    <Link
                        href="/admin/signups"
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        View all
                    </Link>
                </div>

                {latestSignups.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                        {loading ? (
                            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        ) : (
                            "No signups yet."
                        )}
                    </p>
                ) : (
                    <ul className="divide-y divide-white/5">
                        {latestSignups.map((entry) => {
                            const project = projects.find((item) => item.id === entry.projectId)
                            return (
                                <li
                                    key={entry.id}
                                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm"
                                >
                                    <span className="min-w-0 truncate text-white">{entry.email}</span>
                                    <span className="truncate text-muted-foreground">
                                        {project?.title ?? "Unknown project"}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground/70">
                                        {timeAgo(entry.createdAt)}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>
        </div>
    )
}
