"use client"

import { useEffect, useState } from "react"
import { NexusLink } from "@/components/nexus-link"
import { WaitlistForm } from "@/components/waitlist-form"
import { CheckCircle2 } from "lucide-react"
import { WAITLIST_EVENT, isOnWaitlist } from "@/lib/waitlist"

export function WaitlistStatus({ projectId }: { projectId: string }) {
  const [isRegistered, setIsRegistered] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    const sync = () => {
      setIsRegistered(isOnWaitlist(projectId))
      setHasMounted(true)
    }

    sync()
    window.addEventListener(WAITLIST_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(WAITLIST_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [projectId])

  // Avoid a hydration mismatch: the server cannot know about localStorage.
  if (!hasMounted) {
    return <div className="h-24" aria-hidden="true" />
  }

  if (!isRegistered) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-400">
          Join the waitlist to get notified at launch and unlock the Nexus discount.
        </p>
        <WaitlistForm projectId={projectId} />
      </div>
    )
  }

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
