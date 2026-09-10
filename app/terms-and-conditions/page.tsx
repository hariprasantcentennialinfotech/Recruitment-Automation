import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, ArrowLeft, Mail, Phone, MapPin, Globe } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms & Conditions | Centennial Infotech',
  description: 'Terms and Conditions for Centennial Infotech recruitment, staffing, and automation services.',
}

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Recruiting Automation</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Centennial Infotech" className="size-8 object-contain" />
            <span className="font-semibold text-sm">Centennial Infotech</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary mb-4">
            <FileText className="size-3.5" />
            Legal Agreement
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Terms &amp; Conditions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Effective Date:</strong> August 25, 2026
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Welcome to Centennial Infotech. By accessing or using our website and services, you agree to these Terms &amp; Conditions.
          </p>
        </div>

        <div className="space-y-8">
          {/* Section 1 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                1
              </span>
              <h2 className="text-xl font-semibold">About Centennial Infotech</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Centennial Infotech provides recruitment, staffing, talent acquisition, IT, software development, and related professional services.
            </p>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                2
              </span>
              <h2 className="text-xl font-semibold">Website Use</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              You agree to use this website only for lawful purposes and in a manner that does not violate applicable laws or the rights of others.
            </p>
            <p className="text-sm font-medium mb-2 text-foreground">You must not:</p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Submit false or misleading information</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with the operation or security of our website</li>
              <li>Use our website for fraudulent or unlawful activities</li>
              <li>Copy or misuse our website content without authorization</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                3
              </span>
              <h2 className="text-xl font-semibold">Recruitment and Staffing Services</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                Information regarding job opportunities is provided for recruitment purposes. A job posting or communication does not guarantee employment, an interview, selection, or placement.
              </p>
              <p>
                Final hiring decisions are made by the applicable employer or client.
              </p>
              <p>
                Candidates are responsible for providing accurate and complete information regarding their qualifications, experience, employment history, work authorization, and other relevant information.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                4
              </span>
              <h2 className="text-xl font-semibold">Client Services</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                Clients are responsible for providing accurate information regarding their staffing and business requirements.
              </p>
              <p>
                Any recruitment, staffing, or IT engagement may be subject to a separate agreement, statement of work, or other written terms between the parties.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                5
              </span>
              <h2 className="text-xl font-semibold">SMS Communications</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                If you voluntarily provide consent to receive SMS communications from Centennial Infotech, you may receive messages related to recruitment, staffing, inquiries, appointments, or other services for which you have provided consent.
              </p>
              <p>
                Message frequency may vary. Message and data rates may apply.
              </p>
              <p>
                You can opt out at any time by replying <strong>STOP</strong>. For assistance, reply <strong>HELP</strong>.
              </p>
              <p>
                Consent to receive SMS messages is not a condition of purchasing any goods or services.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                6
              </span>
              <h2 className="text-xl font-semibold">Intellectual Property</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Unless otherwise stated, website content, text, graphics, logos, designs, and other materials are owned by or licensed to Centennial Infotech and may not be reproduced, distributed, modified, or used without prior written permission.
            </p>
          </section>

          {/* Section 7 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                7
              </span>
              <h2 className="text-xl font-semibold">Third-Party Links</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our website may contain links to third-party websites or services. These links are provided for convenience, and Centennial Infotech does not control or assume responsibility for third-party websites or their content, policies, or practices.
            </p>
          </section>

          {/* Section 8 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                8
              </span>
              <h2 className="text-xl font-semibold">Disclaimer</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We make reasonable efforts to maintain accurate information on our website. However, we do not guarantee that all website content will always be complete, accurate, current, or free from errors.
            </p>
          </section>

          {/* Section 9 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                9
              </span>
              <h2 className="text-xl font-semibold">Limitation of Liability</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To the extent permitted by applicable law, Centennial Infotech will not be responsible for indirect, incidental, consequential, or other damages arising from your use of our website or services.
            </p>
          </section>

          {/* Section 10 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                10
              </span>
              <h2 className="text-xl font-semibold">Changes to These Terms</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these Terms &amp; Conditions from time to time. Updated terms will be posted on this page with a revised effective date.
            </p>
          </section>

          {/* Section 11 - Contact */}
          <section className="rounded-2xl border border-primary/30 bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                11
              </span>
              <h2 className="text-xl font-semibold">Contact Us</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              If you have questions about these Terms &amp; Conditions, please contact us:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Company</p>
                <p className="font-medium">Centennial Infotech</p>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Email</p>
                <a
                  href="mailto:sales@centennialinfotech.com"
                  className="font-medium text-primary hover:underline flex items-center gap-1.5"
                >
                  <Mail className="size-3.5" />
                  sales@centennialinfotech.com
                </a>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Phone</p>
                <div className="space-y-1 font-medium text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-primary" />
                    US: +1 (419) 847 3416
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-primary" />
                    IND: +91-81465 11568
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Website</p>
                <a
                  href="https://centennialinfotech.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline flex items-center gap-1.5"
                >
                  <Globe className="size-3.5" />
                  https://centennialinfotech.com/
                </a>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Address</p>
                <p className="font-medium flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>C-124, VIII, Phase-8, Industrial Area, Sector 73, Sahibzada Ajit Singh Nagar, Punjab 140308</span>
                </p>
              </div>
            </div>

            <p className="mt-6 text-xs text-muted-foreground border-t border-border pt-4">
              By continuing to use our website or services after changes are posted, you acknowledge the updated Terms &amp; Conditions.
            </p>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; 2026 Centennial Infotech. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-foreground underline">
              Privacy Policy
            </Link>
            <Link href="/" className="hover:text-foreground">
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
