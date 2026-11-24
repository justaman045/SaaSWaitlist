"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AlertCircle, Loader2, Plus, Search } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useAdminProjects } from "@/components/admin/use-admin-data"

type SortKey = "newest" | "waitlist" | "title"

function timeAgo(value?: string): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return formatDistanceToNow(date, { addSuffix: true })
}

export default function AdminProjectsPage() {
    const { data: projects, loading, error } = useAdminProjects()

    const [search, setSearch] = useState("")
    const [status, setStatus] = useState<"all" | "active" | "coming_soon">("all")
    const [category, setCategory] = useState("all")
    const [sort, setSort] = useState<SortKey>("newest")

    const categories = useMemo(() => {
        const values = new Set<string>()
        for (const project of projects) {
            if (project.category) values.add(project.category)
        }
        return [...values].sort((a, b) => a.localeCompare(b))
    }, [projects])

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase()

        const filtered = projects.filter((project) => {
            if (status !== "all" && project.status !== status) return false
            if (category !== "all" && project.category !== category) return false

            if (needle) {
                const haystack = [
                    project.title,
                    project.description,
                    project.category ?? "",
                    ...(project.tags ?? []),
                ]
                    .join(" ")
                    .toLowerCase()
                if (!haystack.includes(needle)) return false
            }

            return true
        })

        return [...filtered].sort((a, b) => {
            if (sort === "waitlist") {
                return (b.waitlistCount ?? 0) - (a.waitlistCount ?? 0)
            }
            if (sort === "title") {
                return a.title.localeCompare(b.title)
            }
            const aTime = new Date(a.createdAt).getTime()
            const bTime = new Date(b.createdAt).getTime()
            return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
        })
    }, [projects, search, status, category, sort])

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
                    <p className="text-sm text-muted-foreground">
                        {visible.length} of {projects.length} project
                        {projects.length === 1 ? "" : "s"}
                    </p>
                </div>
                <Button asChild className="rounded-full">
                    <Link href="/admin/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Link>
                </Button>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Could not load projects from Firestore: {error}. Check your connection and
                        that your account is allowed to read this collection.
                    </span>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search projects…"
                        aria-label="Search projects"
                        className="h-11 rounded-2xl bg-white/5 border-white/10 pl-9"
                    />
                </div>

                <select
                    value={status}
                    onChange={(event) =>
                        setStatus(event.target.value as "all" | "active" | "coming_soon")
                    }
                    aria-label="Filter by status"
                    className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                    <option value="all" className="bg-slate-900">
                        All statuses
                    </option>
                    <option value="active" className="bg-slate-900">
                        Live
                    </option>
                    <option value="coming_soon" className="bg-slate-900">
                        Coming Soon
                    </option>
                </select>

                <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    aria-label="Filter by category"
                    className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                    <option value="all" className="bg-slate-900">
                        All categories
                    </option>
                    {categories.map((entry) => (
                        <option key={entry} value={entry} className="bg-slate-900">
                            {entry}
                        </option>
                    ))}
                </select>

                <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                    aria-label="Sort projects"
                    className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                    <option value="newest" className="bg-slate-900">
                        Newest first
                    </option>
                    <option value="waitlist" className="bg-slate-900">
                        Most signups
                    </option>
                    <option value="title" className="bg-slate-900">
                        Name (A–Z)
                    </option>
                </select>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="text-gray-300">Name</TableHead>
                            <TableHead className="text-gray-300">Status</TableHead>
                            <TableHead className="text-gray-300">Category</TableHead>
                            <TableHead className="text-gray-300">Tags</TableHead>
                            <TableHead className="text-right text-gray-300">Waitlist</TableHead>
                            <TableHead className="text-gray-300">Created</TableHead>
                            <TableHead className="text-right text-gray-300">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {visible.map((project) => (
                                    <TableRow
                                        key={project.id}
                                        className="border-white/10 hover:bg-white/5 transition-colors"
                                    >
                                        <TableCell className="font-medium text-white">
                                            <Link
                                                href={`/admin/edit/${project.id}`}
                                                className="hover:text-primary"
                                            >
                                                {project.title}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">
                                                /{project.slug}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    project.status === "active" ? "default" : "secondary"
                                                }
                                                className={
                                                    project.status === "active"
                                                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/20"
                                                        : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/20"
                                                }
                                            >
                                                {project.status === "active" ? "Live" : "Coming Soon"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {project.category || "—"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex max-w-[14rem] flex-wrap gap-1">
                                                {(project.tags ?? []).slice(0, 4).map((tag, tagIndex) => (
                                                    <Badge
                                                        key={`${tag}-${tagIndex}`}
                                                        variant="outline"
                                                        className="border-white/10 text-[10px] font-normal text-muted-foreground"
                                                    >
                                                        {tag}
                                                    </Badge>
                                                ))}
                                                {(project.tags?.length ?? 0) > 4 && (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-white/10 text-[10px] font-normal text-muted-foreground"
                                                    >
                                                        +{(project.tags?.length ?? 0) - 4}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-white">
                                            {project.waitlistCount ?? 0}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {timeAgo(project.createdAt) ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="sm"
                                                className="hover:bg-white/10 hover:text-white"
                                            >
                                                <Link href={`/admin/edit/${project.id}`}>Edit</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {visible.length === 0 && !error && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                                            {projects.length === 0 ? (
                                                <>
                                                    No projects found. Click{" "}
                                                    <span className="font-medium">New Project</span>{" "}
                                                    to get started.
                                                </>
                                            ) : (
                                                "No projects match these filters."
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
