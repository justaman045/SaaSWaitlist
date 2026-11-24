"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Download, Loader2, Search } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    useAdminProjects,
    useAdminWaitlist,
    useNow,
} from "@/components/admin/use-admin-data"

type Range = "all" | "7" | "30" | "90"

const RANGE_MS: Record<Exclude<Range, "all">, number> = {
    "7": 7 * 24 * 60 * 60 * 1000,
    "30": 30 * 24 * 60 * 60 * 1000,
    "90": 90 * 24 * 60 * 60 * 1000,
}

/**
 * Escapes a single CSV cell.
 *
 * A cell that starts with `=`, `+`, `-` or `@` is executed as a formula when
 * the file is opened in Excel or Sheets. The exported email column comes
 * straight from the public sign-up form, so those cells are prefixed with a
 * single quote — the spreadsheet treats the value as text and the quote is
 * not displayed.
 */
function csvCell(value: string | number): string {
    let text = String(value)

    if (/^[=+\-@\t\r]/.test(text) && !Number.isFinite(Number(text))) {
        text = `'${text}`
    }

    return `"${text.replace(/"/g, '""')}"`
}

/** Builds a CSV file client-side and triggers a download. */
function downloadCsv(filename: string, rows: (string | number)[][]) {
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n")
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export default function AdminSignupsPage() {
    const { data: entries, loading, error } = useAdminWaitlist()
    const { data: projects, error: projectsError } = useAdminProjects()
    const now = useNow()

    const [search, setSearch] = useState("")
    const [projectId, setProjectId] = useState("all")
    const [range, setRange] = useState<Range>("all")

    const projectNames = useMemo(
        () => new Map(projects.map((project) => [project.id, project.title])),
        [projects]
    )

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase()
        const cutoff = range === "all" || !now ? 0 : now - RANGE_MS[range]

        return entries.filter((entry) => {
            if (projectId !== "all" && entry.projectId !== projectId) return false

            if (cutoff) {
                const time = entry.createdAt ? new Date(entry.createdAt).getTime() : 0
                if (!Number.isFinite(time) || time < cutoff) return false
            }

            if (needle && !entry.email.toLowerCase().includes(needle)) return false

            return true
        })
    }, [entries, search, projectId, range, now])

    const handleExport = () => {
        // The export names the project for every signup. Without the
        // catalogue it can only write "Unknown project", so the export is
        // blocked rather than silently incomplete.
        if (projectsError) {
            toast.error(
                "The project list could not be loaded — the export would not name the projects."
            )
            return
        }

        const rows: (string | number)[][] = [
            ["Email", "Project", "Project slug", "Signed up"],
            ...visible.map((entry) => {
                const project = projects.find((item) => item.id === entry.projectId)
                return [
                    entry.email,
                    project?.title ?? "Unknown project",
                    project?.slug ?? "",
                    entry.createdAt ?? "",
                ]
            }),
        ]

        downloadCsv(`saaswaitlist-signups-${format(new Date(), "yyyy-MM-dd")}.csv`, rows)
    }

    const handleCopy = async (email: string) => {
        try {
            await navigator.clipboard.writeText(email)
            toast.success("Email address copied")
        } catch {
            // Clipboard access can be denied — the email is still visible in
            // the table, so this is a no-op rather than an error state.
            toast.error("Could not copy the email address.")
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Signups</h1>
                    <p className="text-sm text-muted-foreground">
                        {visible.length} of {entries.length} signup
                        {entries.length === 1 ? "" : "s"}
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExport}
                    disabled={visible.length === 0 || Boolean(projectsError)}
                    title={
                        projectsError
                            ? "The project list could not be loaded — the export would not name the projects."
                            : undefined
                    }
                    className="rounded-full"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {error && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Could not load signups: {error}. The waitlist collection is admin-only —
                        make sure your account is allowlisted and verified.
                    </span>
                </div>
            )}

            {projectsError && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Could not load the project list: {projectsError}. The signups below are
                        shown, but their project names and the CSV export are incomplete.
                    </span>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by email…"
                        aria-label="Search signups by email"
                        className="h-11 rounded-2xl bg-white/5 border-white/10 pl-9"
                    />
                </div>

                <select
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    aria-label="Filter by project"
                    className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                    <option value="all" className="bg-slate-900">
                        All projects
                    </option>
                    {projects.map((project) => (
                        <option key={project.id} value={project.id} className="bg-slate-900">
                            {project.title}
                        </option>
                    ))}
                </select>

                <select
                    value={range}
                    onChange={(event) => setRange(event.target.value as Range)}
                    aria-label="Filter by date range"
                    className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                    <option value="all" className="bg-slate-900">
                        All time
                    </option>
                    <option value="7" className="bg-slate-900">
                        Last 7 days
                    </option>
                    <option value="30" className="bg-slate-900">
                        Last 30 days
                    </option>
                    <option value="90" className="bg-slate-900">
                        Last 90 days
                    </option>
                </select>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="text-gray-300">Email</TableHead>
                            <TableHead className="text-gray-300">Project</TableHead>
                            <TableHead className="text-gray-300">Signed up</TableHead>
                            <TableHead className="text-right text-gray-300">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-64 text-center text-muted-foreground">
                                    <div role="status" aria-live="polite">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden="true" />
                                        <span className="sr-only">Loading the signups…</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {visible.map((entry) => (
                                    <TableRow
                                        key={entry.id}
                                        className="border-white/10 hover:bg-white/5 transition-colors"
                                    >
                                        <TableCell className="font-medium text-white">
                                            {entry.email}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {projectNames.get(entry.projectId) ?? "Unknown project"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {entry.createdAt
                                                ? format(new Date(entry.createdAt), "PPpp")
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void handleCopy(entry.email)}
                                                className="hover:bg-white/10 hover:text-white"
                                            >
                                                Copy email
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {visible.length === 0 && !error && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-64 text-center text-muted-foreground">
                                            {entries.length === 0
                                                ? "No signups yet."
                                                : "No signups match these filters."}
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
