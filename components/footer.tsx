import Link from "next/link"
import { Rocket } from "lucide-react"
import { CopyrightYear } from "@/components/copyright-year"

export function Footer() {
    return (
        <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm py-12">
            <div className="container flex flex-col items-center justify-between gap-8 md:flex-row">
                <div className="flex flex-col items-center md:items-start gap-2">
                    <div className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        <span className="font-bold text-lg">SaaSWaitlist</span>
                    </div>
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        Discover the next big thing before everyone else.
                    </p>
                </div>

                <div className="flex gap-8 text-sm text-muted-foreground">
                    <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                    <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                    <a href="https://x.com/justaman045" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter</a>
                    <a href="https://github.com/justaman045" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
                </div>
            </div>
            <div className="container mt-8 border-t border-border/40 pt-8 text-center text-xs text-muted-foreground">
                © <CopyrightYear initialYear={new Date().getFullYear()} /> SaaS Waitlist. All
                rights reserved. Built by Aman.
            </div>
        </footer>
    )
}
