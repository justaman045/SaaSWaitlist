"use client"

import { useState } from "react"
import Image from "next/image"
import { isOptimizableImageHost } from "@/lib/images"

interface ProjectPreviewProps {
    /** The image URL, if the project has one. */
    imageSrc?: string
    /** Used for the alt text and the abstract fallback initials. */
    title: string
    sizes?: string
}

/**
 * The artwork at the top of a project card.
 *
 * Admin-supplied URLs can 404 or point at a host that refuses hotlinking, so
 * a failed load falls back to the abstract preview instead of leaving a
 * broken-image icon on the card.
 */
export function ProjectPreview({ imageSrc, title, sizes }: ProjectPreviewProps) {
    const [failed, setFailed] = useState(false)

    if (!imageSrc || failed) {
        return (
            <>
                <div className="absolute inset-0 bg-grid-small-white/5 [mask-image:linear-gradient(to_bottom,transparent,black)]"></div>
                <div className="z-10 flex flex-col items-center gap-2">
                    <span className="text-4xl font-bold opacity-10 tracking-widest uppercase">
                        {(title || "??").substring(0, 2)}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground/50">Project Preview</span>
                </div>
            </>
        )
    }

    if (isOptimizableImageHost(imageSrc)) {
        return (
            <Image
                src={imageSrc}
                alt={`${title} preview`}
                fill
                sizes={sizes ?? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
                className="object-cover"
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={imageSrc}
            alt={`${title} preview`}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
        />
    )
}
