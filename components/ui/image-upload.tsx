"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ImagePlus, X, Loader2 } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { isOptimizableImageHost } from "@/lib/images"

interface ImageUploadProps {
    value: string[]
    /**
     * Applies a change to the list.
     *
     * The updater receives the *current* list instead of a pre-computed
     * array: an upload can take a while, and the list may have changed in
     * the meantime (an image removed, the form reset). Merging with a
     * stale snapshot would resurrect what the admin just deleted.
     */
    onChange: (updater: (current: string[]) => string[]) => void
    onRemove: (value: string) => void
    disabled?: boolean
}

/** Cloudinary rejects anything larger than this for an unsigned preset. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export default function ImageUpload({
    value,
    onChange,
    onRemove,
    disabled
}: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    /**
     * The latest `onChange`.
     *
     * The upload runs asynchronously, so the callback it captured when the
     * upload started can be several renders out of date.
     */
    const latestOnChange = useRef(onChange)
    useEffect(() => {
        latestOnChange.current = onChange
    }, [onChange])

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        const newUrls: string[] = []
        const failures: string[] = []

        for (const file of Array.from(files)) {
            if (!file.type.startsWith("image/")) {
                failures.push(`${file.name} is not an image`)
                continue
            }

            if (file.size > MAX_FILE_SIZE_BYTES) {
                failures.push(`${file.name} is larger than 10 MB`)
                continue
            }

            try {
                const formData = new FormData()
                formData.append("file", file)
                formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "")

                const response = await fetch(
                    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
                    {
                        method: "POST",
                        body: formData,
                    }
                )

                if (!response.ok) {
                    let errorMsg = `Upload failed (HTTP ${response.status})`
                    try {
                        const errorBody = await response.json()
                        errorMsg = errorBody?.error?.message || errorBody?.message || errorMsg
                    } catch {
                        // ignore parse errors
                    }
                    throw new Error(errorMsg)
                }

                const data = await response.json()
                const secureUrl = data?.secure_url

                // The response shape is not guaranteed. An undefined URL
                // would end up in the gallery and break the image component.
                if (typeof secureUrl !== "string" || !secureUrl.startsWith("https://")) {
                    throw new Error("Cloudinary did not return an image URL")
                }

                newUrls.push(secureUrl)
            } catch (error) {
                console.error("Upload error:", error)
                failures.push(
                    error instanceof Error ? error.message : "Upload failed"
                )
            }
        }

        // The images that did upload are kept even when another file
        // failed — otherwise the successful uploads are lost.
        if (newUrls.length > 0) {
            latestOnChange.current((current) => [...current, ...newUrls])
        }

        if (failures.length === 0) {
            toast.success(
                newUrls.length === 1
                    ? "Image uploaded successfully"
                    : `${newUrls.length} images uploaded successfully`
            )
        } else if (newUrls.length > 0) {
            toast.warning(
                `${newUrls.length} image${newUrls.length === 1 ? "" : "s"} uploaded, ${failures.length} failed: ${failures.join("; ")}`
            )
        } else {
            toast.error(`Upload failed: ${failures.join("; ")}`)
        }

        setIsUploading(false)
        // Reset the input so the same file can be picked again.
        e.target.value = ""
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-4">
                {value.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative w-[200px] h-[200px] rounded-md overflow-hidden group">
                        <div className="z-10 absolute top-2 right-2">
                            <Button
                                type="button"
                                onClick={() => onRemove(url)}
                                variant="destructive"
                                size="icon"
                                aria-label={`Remove image ${index + 1}`}
                                title="Remove this image"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </div>
                        {isOptimizableImageHost(url) ? (
                            <Image
                                fill
                                className="object-cover"
                                alt={`Gallery image ${index + 1}`}
                                src={url}
                                sizes="(max-width: 768px) 100vw, 200px"
                                style={{ objectFit: "cover" }}
                            />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={url}
                                alt={`Gallery image ${index + 1}`}
                                className="h-full w-full object-cover"
                                style={{ objectFit: "cover" }}
                            />
                        )}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-4">
                <Button
                    type="button"
                    disabled={disabled || isUploading}
                    variant="secondary"
                    onClick={() => inputRef.current?.click()}
                    className="bg-white/10 hover:bg-white/20 text-white"
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <ImagePlus className="h-4 w-4 mr-2" aria-hidden="true" />
                            Upload Images
                        </>
                    )}
                </Button>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onUpload}
                    disabled={disabled || isUploading}
                    aria-label="Choose images to upload"
                />
            </div>
        </div>
    )
}
