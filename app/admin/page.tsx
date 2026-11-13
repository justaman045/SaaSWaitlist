import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getProjects } from "@/lib/db-service"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
    const projects = await getProjects()
    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
                <Link href="/admin/new">
                    <Button className="rounded-full">
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                </Link>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="text-gray-300">Name</TableHead>
                            <TableHead className="text-gray-300">Status</TableHead>
                            <TableHead className="text-gray-300">Slug</TableHead>
                            <TableHead className="text-gray-300">Created</TableHead>
                            <TableHead className="text-right text-gray-300">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.map((project) => (
                            <TableRow key={project.id} className="border-white/10 hover:bg-white/5 transition-colors">
                                <TableCell className="font-medium text-white">{project.title}</TableCell>
                                <TableCell>
                                    <Badge variant={project.status === "active" ? "default" : "secondary"} className={project.status === "active" ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/20" : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/20"}>
                                        {project.status === "active" ? "Live" : "Coming Soon"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{project.slug}</TableCell>
                                <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/admin/edit/${project.id}`}>
                                        <Button variant="ghost" size="sm" className="hover:bg-white/10 hover:text-white">Edit</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                        {projects.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                                    No projects found. Click &quot;New Project&quot; to get started.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
