"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageGalleryProps {
    images: string[]
    title: string
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    /**
     * The images that failed to load.
     *
     * Gallery images are user-supplied URLs, so one of them can 404 or point
     * at a host that refuses hotlinking. A broken image would otherwise
     * leave the browser's broken-image icon on the page.
     */
    const [failedImages, setFailedImages] = useState<string[]>([])

    if (!images || images.length === 0) return null

    /**
     * The index is clamped: the list can shrink when the admin removes an
     * image, and an out-of-range index would show nothing at all.
     */
    const safeIndex = Math.min(currentIndex, images.length - 1)
    const currentImage = images[safeIndex] ?? images[0]
    const currentImageFailed = failedImages.includes(currentImage)

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
    }

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    return (
        <div className="relative h-full w-full group/gallery bg-black/40 flex items-center justify-center">
            {currentImageFailed ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                    <ImageOff className="h-8 w-8 opacity-60" aria-hidden="true" />
                    <span className="text-sm">This screenshot could not be loaded.</span>
                </div>
            ) : (
                /* Gallery images are user-supplied URLs, so next/image's static
                    optimisation cannot be used for arbitrary hosts. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={currentImage}
                    alt={`${title} screenshot ${safeIndex + 1}`}
                    onError={() =>
                        setFailedImages((current) =>
                            current.includes(currentImage)
                                ? current
                                : [...current, currentImage]
                        )
                    }
                    className="max-w-full max-h-full object-contain transition-opacity duration-300 rounded-md shadow-2xl"
                />
            )}

            {images.length > 1 && (
                <>
                    {/* Navigation Buttons */}
                    <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover/gallery:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
                        <Button
                            size="icon"
                            onClick={handlePrevious}
                            aria-label="Previous image"
                            className="bg-muted/50 hover:bg-muted/80 text-foreground border-white/10 rounded-full h-10 w-10 backdrop-blur-md"
                        >
                            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={handleNext}
                            aria-label="Next image"
                            className="bg-muted/50 hover:bg-muted/80 text-foreground border-white/10 rounded-full h-10 w-10 backdrop-blur-md"
                        >
                            <ChevronRight className="h-6 w-6" aria-hidden="true" />
                        </Button>
                    </div>

                    {/* Indicators */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                        {images.map((image, index) => (
                            <button
                                key={`${image}-${index}`}
                                type="button"
                                onClick={() => setCurrentIndex(index)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === safeIndex
                                    ? "w-6 bg-white"
                                    : "w-1.5 bg-white/50 hover:bg-white/80"
                                    }`}
                                aria-label={`Go to slide ${index + 1}`}
                                aria-current={index === safeIndex ? "true" : undefined}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
