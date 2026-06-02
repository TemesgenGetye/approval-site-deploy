import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  ArrowRight,
  Heart,
  Landmark,
  GraduationCap,
  HeartPulse,
  BookOpen,
  Handshake,
  Building,
} from "lucide-react";

const companyTypes = [
  { icon: <Landmark className="h-5 w-5" />, label: "Government" },
  { icon: <GraduationCap className="h-5 w-5" />, label: "Universities" },
  { icon: <HeartPulse className="h-5 w-5" />, label: "Hospitals" },
  { icon: <BookOpen className="h-5 w-5" />, label: "Schools" },
  { icon: <Handshake className="h-5 w-5" />, label: "NGOs" },
  { icon: <Building className="h-5 w-5" />, label: "Companies" },
];

const steps = [
  {
    step: "01",
    title: "Company Submits Data",
    desc: "Organizations submit recipient records through a detailed form or by uploading an Excel file with their beneficiaries.",
  },
  {
    step: "02",
    title: "Recipient Registers",
    desc: "The recipient signs up on the mobile platform, uploads their verification photo, and requests approval.",
  },
  {
    step: "03",
    title: "Auto-Matching",
    desc: "Our system automatically compares the recipient's profile with the company-submitted data to find a match.",
  },
  {
    step: "04",
    title: "Admin Approves",
    desc: "An admin reviews both records side-by-side — including images — and approves or rejects the match.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Heart className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              DonationVerify
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/company"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Submit Data
            </Link>
            <Link href="/admin/login" className="btn-primary">
              Admin Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-6 py-28 text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12),_transparent_60%)]"
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4" />
            Trusted Verification Portal
          </div>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Verify Recipients.
            <br />
            <span className="text-blue-200">Approve with Confidence.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-blue-100">
            A dedicated portal for organizations to submit beneficiary records
            and for admins to match and approve recipient identities — ensuring
            every donation reaches the right person.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/company"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-blue-700 shadow-lg hover:bg-blue-50 transition-colors"
            >
              Submit Recipient Data
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Org types */}
      <section className="border-b border-slate-100 bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-slate-400">
            Trusted by organizations of all types
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {companyTypes.map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{t.icon}</span>
                <span className="text-sm font-semibold text-slate-700">
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-slate-900">
              Everything you need to manage verifications
            </h2>
            <p className="text-lg text-slate-500">
              Streamlined from submission to approval
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <FileSpreadsheet className="h-6 w-6" />,
                color: "bg-emerald-100 text-emerald-700",
                title: "Excel Upload",
                desc: "Upload a bulk Excel sheet with all your beneficiary records at once. Supports .xlsx and .csv formats.",
              },
              {
                icon: <Building2 className="h-6 w-6" />,
                color: "bg-blue-100 text-blue-700",
                title: "Detailed Forms",
                desc: "Submit individual recipient records with full details — name, ID number, date of birth, contact info, and more.",
              },
              {
                icon: <Users className="h-6 w-6" />,
                color: "bg-purple-100 text-purple-700",
                title: "Smart Matching",
                desc: "Automatically matches company-submitted data with registered recipients on the donation platform.",
              },
              {
                icon: <ShieldCheck className="h-6 w-6" />,
                color: "bg-orange-100 text-orange-700",
                title: "Image Verification",
                desc: "Compare recipient selfies and verification images side-by-side with company records for identity confirmation.",
              },
              {
                icon: <CheckCircle2 className="h-6 w-6" />,
                color: "bg-rose-100 text-rose-700",
                title: "One-Click Approval",
                desc: "Admins can approve or reject recipient matches with a single click and add notes for each decision.",
              },
              {
                icon: <Heart className="h-6 w-6" />,
                color: "bg-sky-100 text-sky-700",
                title: "Real-time Updates",
                desc: "Approved recipients immediately gain access to the donation platform with verified status.",
              },
            ].map((f) => (
              <div key={f.title} className="card p-6">
                <div
                  className={`mb-4 inline-flex rounded-xl p-3 ${f.color}`}
                >
                  {f.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-900 px-6 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight">
              How It Works
            </h2>
            <p className="text-lg text-slate-400">
              A simple four-step process from submission to approval
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.step} className="relative">
                <div className="mb-4 text-5xl font-black text-blue-500/30">
                  {s.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-slate-900">
            Ready to get started?
          </h2>
          <p className="mb-8 text-lg text-slate-500">
            Submit your beneficiary data now or log in as an admin to review
            pending verifications.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/company" className="btn-primary px-8 py-3.5 text-base">
              Submit Data
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/admin/login" className="btn-secondary px-8 py-3.5 text-base">
              Admin Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <Heart className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700">
              DonationVerify
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-slate-400 hover:text-blue-600 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-300">|</span>
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} DonationVerify. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
