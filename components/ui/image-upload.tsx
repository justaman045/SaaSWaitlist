"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ImagePlus, X, Loader2 } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

interface ImageUploadProps {
    value: string[]
    onChange: (value: string[]) => void
    onRemove: (value: string) => void
    disabled?: boolean
}

export default function ImageUpload({
    value,
    onChange,
    onRemove,
    disabled
}: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false)

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        const newUrls: string[] = []

        try {
            for (const file of Array.from(files)) {
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
                newUrls.push(data.secure_url)
            }

            onChange([...value, ...newUrls])
            toast.success("Images uploaded successfully")
        } catch (error) {
            console.error("Upload error:", error)
            toast.error("Failed to upload images. Check your Cloudinary configuration.")
        } finally {
            setIsUploading(false)
            // Reset input
            e.target.value = ""
        }
    }

    return (
        <div>
            <div className="mb-4 flex items-center gap-4">
                {value.map((url) => (
                    <div key={url} className="relative w-[200px] h-[200px] rounded-md overflow-hidden group">
                        <div className="z-10 absolute top-2 right-2">
                            <Button
                                type="button"
                                onClick={() => onRemove(url)}
                                variant="destructive"
                                size="icon"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <Image
                            fill
                            className="object-cover"
                            alt="Image"
                            src={url}
                            sizes="(max-width: 768px) 100vw, 200px"
                            style={{ objectFit: "cover" }}
                        />
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-4">
                <Button
                    type="button"
                    disabled={disabled || isUploading}
                    variant="secondary"
                    onClick={() => document.getElementById("image-upload-input")?.click()}
                    className="bg-white/10 hover:bg-white/20 text-white"
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <ImagePlus className="h-4 w-4 mr-2" />
                            Upload Images
                        </>
                    )}
                </Button>
                <input
                    id="image-upload-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onUpload}
                    disabled={disabled || isUploading}
                />
            </div>
        </div>
    )
}
