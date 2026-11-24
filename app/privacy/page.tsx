export default function PrivacyPage() {
    return (
        <div className="container max-w-3xl py-12 md:py-24">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Privacy Policy</h1>
            <div className="prose dark:prose-invert max-w-none">
                <p>Last updated: November 14, 2026</p>

                <h2>1. Introduction</h2>
                <p>
                    Welcome to SaaS Waitlist. We respect your privacy and are committed to protecting your personal data.
                    This policy explains what we collect, how we use it, and the choices you have when you visit this website.
                </p>

                <h2>2. Data We Collect</h2>
                <ul>
                    <li><strong>Waitlist email:</strong> the email address you submit when you join a project&apos;s waitlist.</li>
                    <li><strong>Admin account data:</strong> if you sign in to the admin dashboard, Firebase Authentication stores your email address and authentication metadata.</li>
                    <li><strong>Local browser storage:</strong> we remember which waitlists you joined in <code>localStorage</code> so we can show your confirmation state. This stays on your device.</li>
                </ul>
                <p>We do not collect names, payment details, or precise location data on this site.</p>

                <h2>3. How We Use Your Data</h2>
                <ul>
                    <li>To add you to a project&apos;s waitlist and notify you when it launches.</li>
                    <li>To operate the admin dashboard and keep project listings up to date.</li>
                    <li>To maintain aggregate waitlist counts shown on the site.</li>
                </ul>
                <p>We do not sell or rent your personal data.</p>

                <h2>4. Service Providers</h2>
                <p>
                    Data is stored in Google Firebase (Firestore and Authentication) and images may be hosted by Cloudinary.
                    These providers process data on our behalf under their own terms and security commitments.
                </p>

                <h2>5. Retention and Your Rights</h2>
                <p>
                    Waitlist entries are kept until the related project launches or you ask us to remove your address.
                    To request access, correction, or deletion of your email, contact the site owner through the contact
                    details on the Nexus website.
                </p>
            </div>
        </div>
    )
}
