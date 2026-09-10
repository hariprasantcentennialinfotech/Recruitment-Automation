import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, ArrowLeft, Mail, Phone, MapPin, Globe } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy | Centennial Infotech',
  description: 'Privacy Policy for Centennial Infotech recruitment, staffing, and automation services.',
}

export default function PrivacyPolicyPage() {
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
            <Shield className="size-3.5" />
            Legal & Compliance
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Effective Date:</strong> August 25, 2026
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Centennial Infotech (&ldquo;Centennial Infotech,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed to protecting the personal information you provide to us through our website, recruitment services, staffing services, IT services, and communications.
          </p>
        </div>

        <div className="space-y-8">
          {/* Section 1 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                1
              </span>
              <h2 className="text-xl font-semibold">Information We Collect</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              We may collect information that you voluntarily provide to us, including:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Resume and employment information</li>
              <li>Professional qualifications and work experience</li>
              <li>Job preferences and availability</li>
              <li>Company and business information</li>
              <li>Information submitted through contact, recruitment, or inquiry forms</li>
              <li>Information provided through SMS, email, telephone, or other communications</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              We may also automatically collect limited technical information such as IP address, browser type, device information, and website usage information.
            </p>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                2
              </span>
              <h2 className="text-xl font-semibold">How We Use Your Information</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              We may use personal information to:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Respond to inquiries and requests</li>
              <li>Provide recruitment and staffing services</li>
              <li>Communicate with candidates regarding job opportunities</li>
              <li>Communicate with clients regarding staffing and business services</li>
              <li>Schedule interviews, calls, or appointments</li>
              <li>Evaluate candidates for employment opportunities</li>
              <li>Provide IT and digital services</li>
              <li>Send service-related communications</li>
              <li>Send SMS or other communications when you have provided appropriate consent</li>
              <li>Improve our website and services</li>
              <li>Maintain business records and comply with applicable laws</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                3
              </span>
              <h2 className="text-xl font-semibold">SMS Communications</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                If you voluntarily opt in to receive SMS messages from Centennial Infotech, we may send messages related to recruitment opportunities, staffing communications, inquiries, appointments, or other communications for which you have provided consent.
              </p>
              <p>
                Message frequency may vary. Message and data rates may apply.
              </p>
              <p>
                You may opt out of SMS communications at any time by replying <strong>STOP</strong>. For assistance, reply <strong>HELP</strong>.
              </p>
              <p>
                Your consent to receive SMS messages is not a condition of purchasing any goods or services.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                4
              </span>
              <h2 className="text-xl font-semibold">Sharing of Information</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                We may share information when reasonably necessary to provide our services, including with clients, prospective employers, service providers, technology providers, or other parties involved in delivering recruitment, staffing, or business services.
              </p>
              <p className="font-medium text-foreground">
                We do not sell personal information for monetary consideration.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                5
              </span>
              <h2 className="text-xl font-semibold">Data Security</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                We use reasonable administrative, technical, and organizational safeguards designed to protect personal information against unauthorized access, use, alteration, or disclosure.
              </p>
              <p>
                However, no method of electronic transmission or storage is completely secure, and we cannot guarantee absolute security.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                6
              </span>
              <h2 className="text-xl font-semibold">Third-Party Services</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our website or services may contain links to third-party websites, platforms, job boards, communication providers, or other services. We are not responsible for the privacy practices of third-party websites.
            </p>
          </section>

          {/* Section 7 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                7
              </span>
              <h2 className="text-xl font-semibold">Data Retention</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We retain personal information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including business, recruitment, contractual, legal, and compliance purposes.
            </p>
          </section>

          {/* Section 8 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                8
              </span>
              <h2 className="text-xl font-semibold">Your Choices</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Depending on applicable law, you may have rights regarding your personal information, including requesting access, correction, or deletion of certain information. To submit a privacy-related request, contact us using the information below.
            </p>
          </section>

          {/* Section 9 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                9
              </span>
              <h2 className="text-xl font-semibold">Children&apos;s Privacy</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our services are not directed toward children under the age of 13, and we do not knowingly collect personal information from children under 13.
            </p>
          </section>

          {/* Section 10 */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-sm">
                10
              </span>
              <h2 className="text-xl font-semibold">Changes to This Privacy Policy</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date.
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
              If you have questions about this Privacy Policy or our use of personal information, please contact us:
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
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; 2026 Centennial Infotech. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms-and-conditions" className="hover:text-foreground underline">
              Terms &amp; Conditions
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
