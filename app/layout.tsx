import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Toaster } from "@/components/ui/sonner"
import { Background } from "@/components/background"
import { cn } from "@/lib/utils"

/**
 * Inter is self-hosted instead of fetched from Google Fonts.
 *
 * `next/font/google` downloads the font at build time, which fails on a
 * flaky or firewalled network — the build then falls back to a system font
 * and the warning is easy to miss. The files in `fonts/` are the same
 * variable subsets Google serves, committed to the repository, so a build
 * never depends on reaching `fonts.googleapis.com`.
 *
 * Inter is licensed under the SIL Open Font License 1.1; the license text
 * ships next to the font files in `fonts/Inter-LICENSE.txt`.
 */
const inter = localFont({
    src: [
        {
            path: "../fonts/Inter-Variable-latin.woff2",
            weight: "100 900",
            style: "normal",
        },
        {
            path: "../fonts/Inter-Variable-latin-ext.woff2",
            weight: "100 900",
            style: "normal",
        },
    ],
    variable: "--font-sans",
    display: "swap",
    fallback: ["system-ui", "sans-serif"],
})

/**
 * The site is a single dark theme. The class is set before paint so the
 * `dark:` variants never flash, and no stored preference is read — a light
 * palette would make the white-on-white marketing headings invisible.
 */
const themeScript = `(function(){try{var root=document.documentElement;root.classList.remove("light");root.classList.add("dark");root.style.colorScheme="dark";}catch(e){}})();`

export const metadata: Metadata = {
  title: "SaaS Waitlist",
  description: "Discover and join waitlists for upcoming SaaS projects.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        <ThemeProvider>
          <Background />
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
