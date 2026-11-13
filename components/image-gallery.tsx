"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageGalleryProps {
    images: string[]
    title: string
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
    const [currentIndex, setCurrentIndex] = useState(0)

    if (!images || images.length === 0) return null

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
    }

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    return (
        <div className="relative w-full h-[calc(100%-40px)] group/gallery bg-black/40 flex items-center justify-center">
            <img
                src={images[currentIndex]}
                alt={`${title} screenshot ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain transition-opacity duration-300 rounded-md shadow-2xl"
            />

            {images.length > 1 && (
                <>
                    {/* Navigation Buttons */}
                    <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover/gallery:opacity-100 transition-opacity duration-300">
                        <Button
                            size="icon"
                            onClick={handlePrevious}
                            className="bg-muted/50 hover:bg-muted/80 text-foreground border-white/10 rounded-full h-10 w-10 backdrop-blur-md"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                            size="icon"
                            onClick={handleNext}
                            className="bg-muted/50 hover:bg-muted/80 text-foreground border-white/10 rounded-full h-10 w-10 backdrop-blur-md"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>

                    {/* Indicators */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                        {images.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex
                                    ? "w-6 bg-white"
                                    : "w-1.5 bg-white/50 hover:bg-white/80"
                                    }`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
