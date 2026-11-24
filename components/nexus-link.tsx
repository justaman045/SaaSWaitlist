"use client"

import { ExternalLink, Rocket } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { getNexusSiteUrl } from "@/lib/nexus-url"
import { cn } from "@/lib/utils"

interface NexusLinkProps {
    className?: string
    size?: "sm" | "default" | "lg"
    discount?: string
}

export function NexusLink({ className, size = "lg", discount = "5%" }: NexusLinkProps) {
    return (
        <div className={cn("flex w-full flex-col gap-2", className)}>
            <a
                href={getNexusSiteUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    buttonVariants({ size, variant: "default" }),
                    "group/btn relative h-14 w-full rounded-[1.25rem] text-lg font-medium transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                )}
            >
                <span
                    aria-hidden="true"
                    className="absolute -inset-1 -z-10 rounded-[1.25rem] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 blur transition duration-500 group-hover/btn:opacity-100"
                />
                <Rocket className="relative z-10 h-5 w-5" />
                <span className="relative z-10">Visit Nexus Website</span>
                <ExternalLink className="relative z-10 h-5 w-5" />
            </a>
            <div className="flex items-center justify-center">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-400">
                    {discount} off subscription
                </span>
            </div>
        </div>
    )
}
