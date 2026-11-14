"use client"

import Link from "next/link"
import { ExternalLink, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"

const NEXUS_URL =
    process.env.NEXT_PUBLIC_NEXUS_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://nexusprods.vercel.app")

interface NexusLinkProps {
    className?: string
    size?: "sm" | "default" | "lg"
    discount?: string
}

export function NexusLink({ className, size = "lg", discount = "5%" }: NexusLinkProps) {
    return (
        <Link
            href={NEXUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
        >
            <div className="relative w-full group">
                <Button size={size} variant="default" className="w-full h-14 rounded-[1.25rem] flex items-center justify-center gap-3 text-lg font-medium transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[1.25rem] blur opacity-60 group-hover/btn:opacity-100 transition duration-500"></div>
                    <Rocket className="h-5 w-5 relative z-10" />
                    <span className="relative z-10">Visit Nexus Website</span>
                    <ExternalLink className="h-5 w-5 relative z-10" />
                </Button>
                <div className="mt-2 flex items-center justify-center gap-1">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium tracking-wide uppercase">
                        {discount} off subscription
                    </span>
                </div>
            </div>
        </Link>
    )
}
