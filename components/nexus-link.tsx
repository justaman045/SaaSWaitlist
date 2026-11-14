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
            <Button size={size} variant="default" className="w-full h-14 rounded-[1.25rem] group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[1.25rem] blur opacity-60 group-hover/btn:opacity-100 transition duration-500"></div>
                <span className="relative z-10 flex items-center justify-center gap-3 text-lg font-medium">
                    <Rocket className="h-5 w-5" />
                    Visit Nexus Website
                    <ExternalLink className="h-5 w-5" />
                </span>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {discount} off subscription
                </span>
            </Button>
        </Link>
    )
}
