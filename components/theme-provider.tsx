"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
    resolvedTheme: "light" | "dark"
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

function getStoredTheme(defaultTheme: Theme): Theme {
    if (typeof window === "undefined") return defaultTheme
    const stored = localStorage.getItem("theme")
    if (stored === "light" || stored === "dark" || stored === "system") {
        return stored
    }
    return defaultTheme
}

function resolveTheme(theme: Theme, enableSystem: boolean): "light" | "dark" {
    if (theme === "system" && enableSystem && typeof window !== "undefined") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
    }
    return theme === "system" ? "dark" : theme
}

function applyTheme(resolvedTheme: "light" | "dark", attribute: string) {
    if (typeof document === "undefined") return
    if (attribute === "class") {
        document.documentElement.classList.remove("light", "dark")
        document.documentElement.classList.add(resolvedTheme)
    } else if (attribute === "data-attribute") {
        document.documentElement.setAttribute("data-theme", resolvedTheme)
    }
}

interface ThemeProviderProps {
    children: React.ReactNode
    attribute?: string
    defaultTheme?: Theme
    enableSystem?: boolean
    disableTransitionOnChange?: boolean
}

export function ThemeProvider({
    children,
    attribute = "class",
    defaultTheme = "system",
    enableSystem = true,
    disableTransitionOnChange = false,
}: ThemeProviderProps) {
    const [theme, setThemeState] = React.useState<Theme>(() =>
        getStoredTheme(defaultTheme)
    )

    const resolvedTheme = resolveTheme(theme, enableSystem)

    React.useEffect(() => {
        applyTheme(resolvedTheme, attribute)

        if (enableSystem) {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
            const handler = (e: MediaQueryListEvent) => {
                if (theme === "system") {
                    const newResolved = e.matches ? "dark" : "light"
                    applyTheme(newResolved, attribute)
                }
            }
            mediaQuery.addEventListener("change", handler)
            return () => mediaQuery.removeEventListener("change", handler)
        }
    }, [theme, enableSystem, attribute, resolvedTheme])

    const setTheme = React.useCallback(
        (newTheme: Theme) => {
            setThemeState(newTheme)
            localStorage.setItem("theme", newTheme)

            if (disableTransitionOnChange) {
                document.documentElement.classList.add("theme-transition")
                setTimeout(() => {
                    document.documentElement.classList.remove("theme-transition")
                }, 50)
            }
        },
        [disableTransitionOnChange]
    )

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme(): ThemeContextType {
    const context = React.useContext(ThemeContext)
    if (!context) {
        // Fallback for edge cases where provider is not available (e.g., SSR hydration mismatches)
        return {
            theme: "system",
            setTheme: () => {},
            resolvedTheme: "dark",
        }
    }
    return context
}

export type { Theme }
