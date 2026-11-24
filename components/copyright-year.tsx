"use client"

import { useEffect, useState } from "react"

/**
 * The current year, kept up to date in the browser.
 *
 * The footer is part of the static root layout, so the year it renders on
 * the server is the year of the last build. The value is corrected after
 * mount, which keeps the copyright line right even when the site has not
 * been rebuilt for a while.
 */
export function CopyrightYear({ initialYear }: { initialYear: number }) {
    const [year, setYear] = useState(initialYear)

    useEffect(() => {
        // The clock is read after mount — reading it during the render would
        // make the component impure.
        const timer = setTimeout(() => setYear(new Date().getFullYear()), 0)
        return () => clearTimeout(timer)
    }, [])

    return <span suppressHydrationWarning>{year}</span>
}
