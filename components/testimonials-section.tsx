import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

const testimonials = [
    {
        name: "Alex Rivera",
        role: "Product Designer @ Stripe",
        content: "SaaS Waitlist is my go-to for finding inspiration. The quality of projects here is unmatched.",
        avatar: "AR"
    },
    {
        name: "Sarah Chen",
        role: "Indie Hacker",
        content: "I launched my project here and got my first 100 users in 24 hours. The community is incredibly supportive.",
        avatar: "SC"
    },
    {
        name: "Marcus Johnson",
        role: "VC @ SeedFund",
        content: "We use this platform to scout for early-stage startups. It's a goldmine for innovation.",
        avatar: "MJ"
    }
]

export function TestimonialsSection() {
    return (
        <section className="container py-24 sm:py-32">
            <div className="mx-auto max-w-2xl lg:text-center mb-16">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-center">Loved by Builders & Users</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {testimonials.map((testimonial) => (
                    <Card key={testimonial.name} className="bg-white/5 border-white/10 shadow-lg rounded-3xl backdrop-blur-sm hover:bg-muted/50 transition-colors">
                        <CardHeader className="flex flex-row items-center gap-4 pb-4">
                            <Avatar>
                                <AvatarFallback>{testimonial.avatar}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold">{testimonial.name}</span>
                                <span className="text-xs text-muted-foreground">{testimonial.role}</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                &quot;{testimonial.content}&quot;
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    )
}
