import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

export function FAQSection() {
    return (
        <section className="container py-24 sm:py-32">
            <div className="mx-auto max-w-4xl">
                <h2 className="text-3xl font-bold tracking-tight text-center mb-16 sm:text-4xl">
                    Frequently Asked Questions
                </h2>
                <Accordion type="single" collapsible className="w-full flex flex-col gap-4">
                    <AccordionItem value="item-1" className="border-none rounded-2xl bg-white/5 px-6">
                        <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">What is SaaS Waitlist?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            SaaS Waitlist is a curated directory of upcoming software-as-a-service projects. We help you discover new tools and get early access before they launch publicly.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2" className="border-none rounded-2xl bg-white/5 px-6">
                        <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">Is it free to join a waitlist?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            Yes! Joining a waitlist is completely free. You simply provide your email to get notified when the project launches or opens up for beta testing.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3" className="border-none rounded-2xl bg-white/5 px-6">
                        <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">How do I submit my own project?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            If you are a builder, you can submit your project by clicking the &quot;Submit Project&quot; button in the navigation bar. You&apos;ll need to create a simple admin account to manage your listing.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-4" className="border-none rounded-2xl bg-white/5 px-6">
                        <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors text-left">How are projects vetted?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            We manually review every submission to ensure it meets our quality standards. We look for legitimate projects with clear value propositions and active development.
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </section>
    )
}
