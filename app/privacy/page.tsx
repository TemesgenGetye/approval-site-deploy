import Link from "next/link";
import { Shield, ArrowLeft, Heart } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Heart className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">DonationVerify</span>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
        </div>
        <p className="text-sm text-slate-400 mb-10">
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <Section title="1. Introduction">
          <p>DonationVerify (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our donation verification platform.</p>
        </Section>

        <Section title="2. Information We Collect">
          <p>We collect information you provide directly to us, including:</p>
          <ul className="mt-2 space-y-2">
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Full name, email address, phone number, and physical address</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Government-issued ID numbers required for verification</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Profile photos and verification images</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Organization details for companies and institutions</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Bank account or mobile money account information for donations</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Device information, IP address, and usage data</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>Your information is used to:</p>
          <ul className="mt-2 space-y-2">
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Verify recipient identities against data submitted by organizations</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Process and record donations to campaigns</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Match beneficiaries with organization-submitted records</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Communicate about account status and verification results</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Prevent fraud and ensure platform security</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="4. Prohibited Conduct & Enforcement">
          <p>We reserve the right to suspend or permanently block accounts that violate our community guidelines or receive multiple valid reports. Users who engage in fraudulent activity, identity theft, or abuse of the platform will have their accounts terminated and may be reported to relevant authorities.</p>
        </Section>

        <Section title="5. Data Sharing and Disclosure">
          <p>We may share your information with:</p>
          <ul className="mt-2 space-y-2">
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Organizations that submitted beneficiary data for verification matching</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Payment processors (Chapa, CBE, Telebirr, and other banking partners) for donation processing</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Legal authorities when required by law or to protect our rights</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Service providers who assist in platform operations</li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <p>We retain your information for as long as your account is active or as needed to provide services. Verification records may be retained longer to comply with legal obligations and auditing requirements. You may request deletion of your data by contacting our support team.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>You have the right to:</p>
          <ul className="mt-2 space-y-2">
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Access the personal data we hold about you</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Request correction of inaccurate data</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Request deletion of your data (subject to legal obligations)</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Withdraw consent for data processing where applicable</li>
            <li className="flex items-start gap-2 text-slate-600"><span className="text-blue-500 mt-0.5">&bull;</span> Lodge a complaint with relevant data protection authorities</li>
          </ul>
        </Section>

        <Section title="8. Security">
          <p>We implement appropriate technical and organizational measures to protect your data, including encryption in transit and at rest, access controls, and regular security audits. However, no method of transmission over the internet is 100% secure.</p>
        </Section>

        <Section title="9. Contact Us">
          <p>If you have questions about this Privacy Policy or wish to exercise your rights, please contact us at <a href="mailto:support@donationverify.com" className="text-blue-600 underline">support@donationverify.com</a> or call 8181 for immediate assistance.</p>
        </Section>
      </div>

      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto max-w-3xl flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <Heart className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700">DonationVerify</span>
          </div>
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} DonationVerify. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-slate-600 leading-relaxed text-[15px]">{children}</div>
    </div>
  );
}
