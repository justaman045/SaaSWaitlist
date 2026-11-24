"use client"

import * as React from "react"

export type ResolvedTheme = "dark"

interface ThemeContextType {
    /**
     * The product ships a single dark theme.
     *
     * The UI is built from hard-coded dark surfaces (`bg-[#0A0A0A]`,
     * `text-white`, white-to-transparent gradients). A light palette would
     * render the hero headline and several headings invisible on a white
     * background, so the light theme was removed rather than half-fixed.
     */
    resolvedTheme: ResolvedTheme
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

/**
 * Provides the resolved theme to the app.
 *
 * There is no toggle and no `localStorage` read: storage can throw a
 * `SecurityError` when cookies are blocked, which used to take down the
 * whole React tree during render.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const value = React.useMemo<ThemeContextType>(() => ({ resolvedTheme: "dark" }), [])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextType {
    const context = React.useContext(ThemeContext)

    if (!context) {
        throw new Error("useTheme must be used inside a <ThemeProvider>")
    }

    return context
}
