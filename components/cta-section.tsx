import Link from "next/link"
import { Button } from "@/components/ui/button"

export function CTASection() {
    return (
        <section className="container py-24 sm:py-32">
            <div className="relative isolate overflow-hidden bg-white/5 px-6 py-24 text-center shadow-2xl rounded-[3rem] sm:px-16 border border-white/10 backdrop-blur-md">
                <div className="absolute inset-0 -z-10 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary via-slate-900 to-transparent"></div>

                <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Ready to launch your next big idea?
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                    Join hundreds of other founders who are building in public and gathering early users with SaaS Waitlist.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                    <Link href="/admin/new">
                        <Button size="lg" className="rounded-full px-8 font-semibold">
                            Submit Your Project
                        </Button>
                    </Link>
                    <Link href="#projects" className="text-sm font-semibold leading-6 text-white hover:text-primary transition-colors">
                        Browse Projects <span aria-hidden="true">→</span>
                    </Link>
                </div>
                <svg
                    viewBox="0 0 1024 1024"
                    className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-x-1/2 [mask-image:radial-gradient(closest-side,white,transparent)]"
                    aria-hidden="true"
                >
                    <circle cx={512} cy={512} r={512} fill="url(#gradient)" fillOpacity="0.15" />
                    <defs>
                        <radialGradient id="gradient">
                            <stop stopColor="#7775D6" />
                            <stop offset={1} stopColor="#E935C1" />
                        </radialGradient>
                    </defs>
                </svg>
            </div>
        </section>
    )
}
