"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

export function Hero() {
    return (
        <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center justify-center py-20">
            <div className="container relative z-10 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-xl mb-8 hover:bg-primary/20 transition-colors cursor-pointer">
                        <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                        New Projects Added Weekly
                        <ChevronRight className="ml-1 h-3 w-3" />
                    </div>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-5xl font-extrabold tracking-tight sm:text-7xl md:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 pb-6 max-w-4xl"
                >
                    The Waitlist <br />
                    For <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Next-Gen</span> SaaS.
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="max-w-[42rem] leading-normal text-muted-foreground sm:text-lg sm:leading-8 mb-10"
                >
                    Discover vetted, upcoming SaaS projects before they launch. Secure your spot, get early access, and shape the future of software.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex flex-wrap items-center justify-center gap-4"
                >
                    <Link href="/projects">
                        <Button size="lg" className="h-12 px-8 rounded-full text-base font-semibold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] transition-all">
                            Explore Projects
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="/admin/new">
                        <Button variant="outline" size="lg" className="h-12 px-8 rounded-full text-base border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm transition-all">
                            <Sparkles className="mr-2 h-4 w-4" />
                            Submit Project
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
