"use client"

import { useEffect, useSyncExternalStore } from "react"
import { NexusLink } from "@/components/nexus-link"
import { CheckCircle2 } from "lucide-react"

export function WaitlistStatus({ projectId }: { projectId: string }) {
  const isRegistered = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {}
      window.addEventListener("storage", callback)
      return () => window.removeEventListener("storage", callback)
    },
    () => {
      if (typeof window === "undefined") return false
      return !!localStorage.getItem(`saaswaitlist_waitlist_${projectId}`)
    },
    () => false
  )

  // Redirect unregistered users to Nexus website
  useEffect(() => {
    if (typeof window !== "undefined" && isRegistered === false) {
      const nexusUrl =
        process.env.NEXT_PUBLIC_NEXUS_URL ||
        (process.env.NODE_ENV === "development"
          ? "http://localhost:3001"
          : "https://nexusprods.vercel.app")
      window.location.href = nexusUrl
    }
  }, [isRegistered])

  if (isRegistered) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-200">
            You&apos;re already on the waitlist!
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-zinc-400">
            Secure your spot &mdash; you&apos;ll be notified when the project launches.
          </span>
          <NexusLink discount="5%" />
        </div>
      </div>
    )
  }

  // Not registered — redirect to Nexus (handled by useEffect above)
  return null
}
