import { getProjectBySlug } from "@/lib/db-service"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Users, ExternalLink, ArrowLeft } from "lucide-react"
import { ImageGallery } from "@/components/image-gallery"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WaitlistStatus } from "@/components/waitlist-status"
import { NexusLink } from "@/components/nexus-link"

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug)

    if (!project) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-slate-50 relative overflow-hidden">
            {/* Ambient Animated Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[150px]" />
                <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-pink-600/5 blur-[100px]" />
            </div>

            <div className="container py-12 md:py-24 pb-20 relative z-10">
                <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-all hover:-translate-x-1 mb-8 group">
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:scale-110" />
                    Back to Projects
                </Link>

                <div className="flex flex-col gap-10 mb-16">
                    {/* Premium Header */}
                    <div className="space-y-6">
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-wrap items-center gap-5">
                                <h1 className="text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500 drop-shadow-sm">
                                    {project.title}
                                </h1>
                                <Badge
                                    variant="outline"
                                    className={`h-8 px-4 border text-sm shadow-xl backdrop-blur-md rounded-full shadow-black/50 ${project.status === "active"
                                        ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                                        : "border-indigo-500/40 text-indigo-300 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                                        }`}
                                >
                                    {project.status === "active" ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                            Live
                                        </span>
                                    ) : "Coming Soon"}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm mt-3">
                                <div className="flex items-center gap-2.5 bg-white/5 backdrop-blur-lg px-4 py-2 rounded-full border border-white/10 shadow-lg shadow-black/20 text-slate-300">
                                    <CalendarDays className="h-4 w-4 text-indigo-400" />
                                    <span>Launched {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
                                </div>
                                {project.waitlistCount !== undefined && (
                                    <div className="flex items-center gap-2.5 bg-white/5 backdrop-blur-lg px-4 py-2 rounded-full border border-white/10 shadow-lg shadow-black/20 text-slate-300">
                                        <Users className="h-4 w-4 text-pink-400" />
                                        <span><strong className="text-white">{project.waitlistCount}</strong> people waiting</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Banner Image with Ultra Premium Glow */}
                    <div className="relative group w-full mt-6">
                        <div className="absolute -inset-[2px] bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-40 group-hover:opacity-70 transition duration-1000 -z-10"></div>
                        <div className="relative aspect-video xl:aspect-[21/9] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
                            {/* Chrome Browser Head */}
                            <div className="h-12 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 flex items-center px-5 gap-3 shrink-0 relative z-20">
                                <div className="w-3.5 h-3.5 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/80 shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                <div className="ml-4 flex-1 h-7 bg-white/5 rounded-full border border-white/10 flex items-center justify-center px-4 text-[11px] text-slate-400 font-mono tracking-wide">
                                    {project.websiteUrl ? new URL(project.websiteUrl).hostname : `${project.slug}.saaswaitlist.com`}
                                </div>
                                <div className="w-[54px]"></div>{/* Balance flex spacer */}
                            </div>
                            {/* Content */}
                            <div className="relative h-[calc(100%-48px)] w-full">
                                {project.imageUrl || (project.images && project.images.length > 0) ? (
                                    <div className="absolute inset-0">
                                        <ImageGallery
                                            images={Array.from(new Set([project.imageUrl, ...(project.images || [])].filter(Boolean) as string[]))}
                                            title={project.title}
                                        />
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
                                        <div className="text-center space-y-4">
                                            <div className="w-20 h-20 bg-white/5 rounded-3xl mx-auto flex items-center justify-center border border-white/10 backdrop-blur-xl shadow-2xl">
                                                <span className="text-4xl">⚡️</span>
                                            </div>
                                            <p className="text-slate-400 font-medium tracking-wide">Project Demo Preview</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-10 lg:gap-16 grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px] items-start">
                    {/* Main Content Details */}
                    <div className="flex flex-col gap-12 w-full min-w-0 order-2 lg:order-1">
                        {/* Description Box - Ultra Glassmorphism */}
                        <div className="relative group/prose">
                            <div className="absolute -inset-0.5 bg-gradient-to-b from-white/10 to-transparent rounded-[2.5rem] blur-sm opacity-50 group-hover/prose:opacity-100 transition duration-700"></div>
                            <div className="relative bg-zinc-900/40 border border-white/[0.08] rounded-[2.5rem] p-8 md:p-12 lg:p-16 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-white/5">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
                                <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

                                <h2 className="text-3xl lg:text-4xl font-extrabold mb-10 flex items-center gap-4 text-white drop-shadow-md">
                                    <span className="w-2 h-10 bg-gradient-to-b from-indigo-400 to-purple-500 rounded-full"></span>
                                    About the Project
                                </h2>
                                <div className="prose prose-invert lg:prose-lg max-w-none 
                                            prose-headings:text-zinc-100 prose-headings:font-bold prose-headings:tracking-tight
                                            prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
                                            prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:tracking-wide
                                            prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-a:no-underline hover:prose-a:underline prose-a:underline-offset-4 prose-a:transition-colors
                                            prose-strong:text-white prose-strong:font-semibold
                                            prose-ul:list-none prose-ul:pl-0 prose-li:relative prose-li:pl-8 prose-li:my-3
                                            [&_li]:before:content-[''] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[12px] [&_li]:before:h-2.5 [&_li]:before:w-2.5 [&_li]:before:rounded-full [&_li]:before:bg-gradient-to-r [&_li]:before:from-indigo-400 [&_li]:before:to-purple-500 [&_li]:before:shadow-[0_0_8px_rgba(99,102,241,0.5)]
                                            prose-table:w-full prose-table:border-collapse prose-table:my-10 block overflow-x-auto
                                            prose-th:bg-white/5 prose-th:px-6 prose-th:py-4 prose-th:text-left prose-th:font-semibold prose-th:text-white prose-th:border prose-th:border-white/10
                                            prose-td:px-6 prose-td:py-4 prose-td:border prose-td:border-white/5 prose-td:text-slate-300
                                            prose-tr:border-b prose-tr:border-white/5 hover:prose-tr:bg-white/[0.02] transition-colors
                                            prose-blockquote:border-l-indigo-500 prose-blockquote:bg-indigo-500/5 prose-blockquote:px-8 prose-blockquote:py-5 prose-blockquote:rounded-r-2xl prose-blockquote:not-italic prose-blockquote:text-zinc-300 prose-blockquote:border-l-4 prose-blockquote:shadow-inner
                                            prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:px-2 prose-code:py-1 prose-code:rounded-lg prose-code:before:content-none prose-code:after:content-none prose-code:border prose-code:border-indigo-500/20
                                            prose-img:rounded-2xl prose-img:shadow-2xl prose-img:border prose-img:border-white/10"
                                >
                                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>{project.description}</ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        {/* Premium Bento Grid Features */}
                        {project.features && project.features.length > 0 && (
                            <div className="relative rounded-[2.5rem] border border-white/[0.08] bg-zinc-900/40 p-8 md:p-12 lg:p-16 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-white/5 mt-4">
                                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-[120px] -z-10 pointer-events-none"></div>
                                <h3 className="mb-12 text-3xl lg:text-4xl font-extrabold text-white flex items-center gap-5 drop-shadow-md">
                                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)] backdrop-blur-sm">
                                        <span className="text-2xl">✨</span>
                                    </div>
                                    Key Features
                                </h3>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {project.features.map((feature: string, i: number) => (
                                        <li key={i} className="group relative p-8 rounded-3xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/20 transition-all duration-500 hover:-translate-y-1 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 cursor-default overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                            <div className="relative z-10 flex items-start gap-5">
                                                <div className="mt-1.5 h-3 w-3 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 shrink-0 shadow-[0_0_15px_rgba(129,140,248,0.8)] group-hover:scale-125 transition-transform duration-500" />
                                                <span className="text-lg text-zinc-300 group-hover:text-white leading-relaxed transition-colors duration-300 font-medium">{feature}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Sticky Panel */}
                    <div className="flex flex-col gap-8 h-full order-1 lg:order-2">
                        <div className="rounded-[2.5rem] border border-white/[0.08] bg-zinc-900/60 p-8 lg:p-10 backdrop-blur-3xl shadow-2xl sticky top-28 ring-1 ring-white/5 group/sidebar overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-50 group-hover/sidebar:opacity-100 transition-opacity duration-1000 -z-10"></div>

                            <h3 className="text-2xl font-extrabold mb-5 text-white">
                                {project.status === "active" ? "Experience It Live" : "Get Early Access"}
                            </h3>
                            <p className="text-zinc-400 mb-8 text-base leading-relaxed">
                                {project.status === "active"
                                    ? "This project is currently live and available. Hit the link below to experience the platform directly."
                                    : "Join the exclusive waitlist to secure your spot and receive direct notifications when this revolutionary project drops."}
                            </p>

                            <div className="flex flex-col gap-4">
                                {project.status === "active" ? (
                                    <div className="flex flex-col gap-3">
                                        <NexusLink discount="5%" />
                                        {project.nexusProductId && (
                                            <div className="group/btn relative">
                                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[1.25rem] blur opacity-60 group-hover/btn:opacity-100 transition duration-500"></div>
                                                <Button asChild variant="outline" size="lg" className="relative w-full rounded-[1.25rem] h-14 border border-white/10 shadow-xl transition-all duration-300">
                                                    <a href={`https://nexusprods.vercel.app/products/${project.nexusProductId}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 text-lg font-medium">
                                                        Open on Nexus
                                                        <ExternalLink className="h-5 w-5" />
                                                    </a>
                                                </Button>
                                            </div>
                                        )}
                                        {project.websiteUrl && (
                                            <div className="group/btn relative">
                                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[1.25rem] blur opacity-60 group-hover/btn:opacity-100 transition duration-500"></div>
                                                <Button asChild variant="outline" size="lg" className="relative w-full rounded-[1.25rem] h-14 border border-white/10 shadow-xl transition-all duration-300">
                                                    <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 text-lg font-medium">
                                                        Visit Application
                                                        <ExternalLink className="h-5 w-5" />
                                                    </a>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <WaitlistStatus projectId={project.id} />
                                )}
                            </div>

                            {project.category && (
                                <div className="mt-10 pt-8 border-t border-white/[0.08]">
                                    <div className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-4">Category</div>
                                    <Badge variant="secondary" className="rounded-xl px-4 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 border border-white/5 backdrop-blur-md shadow-sm transition-colors text-sm font-medium">
                                        {project.category}
                                    </Badge>
                                </div>
                            )}

                            {project.tags && project.tags.length > 0 && (
                                <div className="mt-8">
                                    <div className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-4">Tags</div>
                                    <div className="flex flex-wrap gap-2.5">
                                        {project.tags.map((tag: string) => (
                                            <Badge key={tag} variant="outline" className="rounded-xl px-4 py-1.5 border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-all text-sm font-medium">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {project.techStack && project.techStack.length > 0 && (
                                <div className="mt-8">
                                    <div className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-4">Tech Stack</div>
                                    <div className="flex flex-wrap gap-2.5">
                                        {project.techStack.map((tech: string) => (
                                            <Badge key={tech} variant="secondary" className="rounded-xl px-4 py-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors shadow-inner text-sm font-medium">
                                                <span className="opacity-70 mr-1.5">⚡</span> {tech}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
