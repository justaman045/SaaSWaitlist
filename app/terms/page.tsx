export default function TermsPage() {
    return (
        <div className="container max-w-3xl py-12 md:py-24">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Terms of Service</h1>
            <div className="prose prose-invert max-w-none">
                <p>Last updated: {new Date().toLocaleDateString()}</p>

                <h2>1. Acceptance of Terms</h2>
                <p>
                    By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.
                </p>

                <h2>2. Description of Service</h2>
                <p>
                    SaaS Waitlist provides a curated directory of upcoming SaaS projects. We reserve the right to modify, suspend or discontinue the service with or without notice at any time.
                </p>

                <h2>3. User Conduct</h2>
                <p>
                    You agree to use the service only for lawful purposes. You are prohibited from posting or transmitting to or from this site any unlawful, threatening, libelous, defamatory, obscene, pornographic, or other material that would violate any law.
                </p>

                <h2>4. Intellectual Property</h2>
                <p>
                    The content, organization, graphics, design, compilation, magnetic translation, digital conversion and other matters related to the Site are protected under applicable copyrights, trademarks and other proprietary (including but not limited to intellectual property) rights.
                </p>

                <h2>5. Disclaimer</h2>
                <p>
                    The materials on SaaS Waitlist&apos;s website are provided on an &apos;as is&apos; basis. SaaS Waitlist makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                </p>
            </div>
        </div>
    )
}
