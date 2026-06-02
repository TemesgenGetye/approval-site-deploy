"use client";

import { ORG_TYPE_MAP, supabase, type CompanySubmission, type RecipientProfile, type VerificationSubmission } from "@/lib/supabase";
import OrgTypeIcon from "@/components/OrgTypeIcon";
import {
  AlertCircle,
  Ban,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  FileText,
  Flag,
  Gift,
  Hash,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Trash2,
  Trophy,
  User,
  Users,
  XCircle
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const DonationMap = dynamic(() => import("@/components/DonationMap"), { ssr: false });

type Tab = "approved" | "verifications" | "donations" | "campaigns" | "reports" | "users" | "history" | "data-fillers";

interface MatchedRecord {
  profile: RecipientProfile;
  match: CompanySubmission | null;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-slate-400">{icon}</div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-base font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    matched: "bg-blue-100 text-blue-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
    requested: "bg-amber-100 text-amber-700",
    unrequested: "bg-slate-100 text-slate-500",
    available: "bg-emerald-100 text-emerald-700",
    active: "bg-blue-100 text-blue-700",
    completed: "bg-violet-100 text-violet-700",
    claimed: "bg-indigo-100 text-indigo-700",
    paused: "bg-orange-100 text-orange-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ level, score }: { level: string | null; score: number }) {
  const colorMap: Record<string, string> = {
    high: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-slate-100 text-slate-600",
  };
  const label = level || "unscored";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[label] ?? "bg-slate-100 text-slate-600"}`}
    >
      {level === "high" && <Trophy className="h-3 w-3" />}
      {level === "medium" && <ShieldAlert className="h-3 w-3" />}
      <span className="font-mono">{score}</span>
      <span>{label}</span>
    </span>
  );
}

function CredentialsCard({ email, password }: { email: string | null; password: string | null }) {
  if (!email) return null;
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-800">Account Auto-Created</span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-emerald-100">
          <div>
            <span className="text-xs text-slate-500">Email</span>
            <p className="font-mono text-sm text-slate-800">{email}</p>
          </div>
          <button
            onClick={() => copyToClipboard(email, "Email")}
            className="p-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
            title="Copy email"
          >
            <Copy className="h-4 w-4 text-emerald-600" />
          </button>
        </div>
        {password && (
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-emerald-100">
            <div>
              <span className="text-xs text-slate-500">Password</span>
              <p className="font-mono text-sm text-slate-800">{password}</p>
            </div>
            <button
              onClick={() => copyToClipboard(password, "Password")}
              className="p-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
              title="Copy password"
            >
              <Copy className="h-4 w-4 text-emerald-600" />
            </button>
          </div>
        )}
        {copied && (
          <p className="text-xs text-emerald-600">Copied to clipboard!</p>
        )}
      </div>
      <p className="mt-2 text-xs text-emerald-600">
        Share these credentials with the applicant. They can log in to the donation app.
      </p>
    </div>
  );
}

// NOTE: Card components removed — now using table-list + detail modal pattern

export default function AdminDashboard() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ email: string } | null>(null);
  const [tab, setTab] = useState<Tab>("verifications");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Original data
  const [pendingProfiles, setPendingProfiles] = useState<MatchedRecord[]>([]);
  const [approvedProfiles, setApprovedProfiles] = useState<MatchedRecord[]>([]);
  const [rejectedProfiles, setRejectedProfiles] = useState<MatchedRecord[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<CompanySubmission[]>([]);

  // Verification submissions
  const [verifications, setVerifications] = useState<VerificationSubmission[]>([]);

  // New admin tabs data
  const [allDonations, setAllDonations] = useState<any[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [donationFilter, setDonationFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [dataFillerProfiles, setDataFillerProfiles] = useState<any[]>([]);
  const [showCreateDataFiller, setShowCreateDataFiller] = useState(false);
  const [createFillerEmail, setCreateFillerEmail] = useState("");
  const [createFillerPassword, setCreateFillerPassword] = useState("");
  const [createFillerName, setCreateFillerName] = useState("");
  const [createFillerOrgType, setCreateFillerOrgType] = useState("");
  const [createFillerOrgName, setCreateFillerOrgName] = useState("");
  const [creatingFiller, setCreatingFiller] = useState(false);
  const [createdFillerCreds, setCreatedFillerCreds] = useState<{ email: string; password: string } | null>(null);
  const [selectedReporter, setSelectedReporter] = useState<any>(null);
  const [showReporterModal, setShowReporterModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [selectedDetailType, setSelectedDetailType] = useState<string>("");

  // History tab data
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    submissions: 0,
    verificationsPending: 0,
    verificationsApproved: 0,
    verificationsRejected: 0,
    pendingDonations: 0,
    pendingCampaigns: 0,
    reportsCount: 0,
    usersCount: 0,
    historyCount: 0,
    dataFillersCount: 0,
  });

  const tryMatchProfile = useCallback(
    (profile: RecipientProfile, submissions: CompanySubmission[]) => {
      const normalize = (v: string | null | undefined) =>
        (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

      const profileName = normalize(profile.full_name);
      const profileEmail = normalize(profile.email);
      const profilePhone = (profile.phone ?? "").replace(/\D/g, "");

      return (
        submissions.find((s) => {
          if (profileEmail && s.email) {
            if (normalize(s.email) === profileEmail) return true;
          }
          if (profilePhone.length >= 7 && s.phone) {
            const sPhone = s.phone.replace(/\D/g, "");
            if (sPhone.length >= 7) {
              const pTail = profilePhone.slice(-9);
              const sTail = sPhone.slice(-9);
              if (pTail === sTail) return true;
            }
          }
          const sName = normalize(s.full_name);
          if (profileName && sName && sName === profileName) return true;
          if (profileName && sName) {
            const pParts = profileName.split(" ");
            const sParts = sName.split(" ");
            if (pParts.length >= 2 && sParts.length >= 2) {
              if (pParts[0] === sParts[0] && pParts[pParts.length - 1] === sParts[sParts.length - 1]) {
                return true;
              }
            }
          }
          return false;
        }) ?? null
      );
    },
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/admin/login");
      return;
    }
    setAdminUser({ email: user.email ?? "" });

    // Fetch company submissions
    const { data: submissionsData, error: subErr } = await supabase
      .from("company_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (subErr) {
      setError("Failed to load company submissions: " + subErr.message);
    }
    const submissions: CompanySubmission[] = submissionsData ?? [];
    setAllSubmissions(submissions);

    // Fetch recipient profiles
    const { data: profilesData, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "recipient")
      .order("created_at", { ascending: false });

    if (profErr) {
      setError("Failed to load profiles: " + profErr.message);
    }
    const profiles: RecipientProfile[] = profilesData ?? [];

    const pending: MatchedRecord[] = [];
    const approved: MatchedRecord[] = [];
    const rejected: MatchedRecord[] = [];

    for (const p of profiles) {
      const match = tryMatchProfile(p, submissions);
      const record: MatchedRecord = { profile: p, match };
      if (p.recipient_status === "requested") pending.push(record);
      else if (p.recipient_status === "approved") approved.push(record);
      else if (p.recipient_status === "rejected" as string) rejected.push(record);
    }

    setPendingProfiles(pending);
    setApprovedProfiles(approved);
    setRejectedProfiles(rejected);

    // Fetch verification submissions
    const { data: verData, error: verErr } = await supabase
      .from("verification_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (verErr) {
      setError("Failed to load verifications: " + verErr.message);
    }
    const verificationsData: VerificationSubmission[] = verData ?? [];
    setVerifications(verificationsData);

    // Fetch all donations
    const { data: donationsData } = await supabase
      .from("donations")
      .select("*, profiles:donor_id(full_name)")
      .order("created_at", { ascending: false });
    setAllDonations(donationsData || []);

    // Fetch all campaigns
    const { data: campaignsData } = await supabase
      .from("campaigns")
      .select("*, profiles:recipient_id(full_name)")
      .order("created_at", { ascending: false });
    setAllCampaigns(campaignsData || []);

    // Fetch reports with reporter profile
    const { data: reportsData } = await supabase
      .from("reports")
      .select("*, profiles:reporter_id(full_name, email)")
      .order("created_at", { ascending: false });
    setReportsList(reportsData || []);

    // Fetch users (exclude current admin)
    const adminId = user?.id || "";
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, blocked, avatar_url, location, phone, created_at")
      .neq("id", adminId)
      .order("full_name", { ascending: true });
    setUsersList(usersData || []);

    // Fetch data fillers
    const { data: fillerData } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, blocked, created_at, org_type, organization_name")
      .eq("role", "data_filler")
      .order("created_at", { ascending: false });
    setDataFillerProfiles(fillerData || []);

    // Fetch all data for history
    const [histDonations, histCampaigns, histRequests, histRatings, histReports, histVerifications] = await Promise.all([
      supabase.from("donations").select("*, profiles:donor_id(full_name, email)").order("created_at", { ascending: false }).limit(200),
      supabase.from("campaigns").select("*, profiles:recipient_id(full_name, email)").order("created_at", { ascending: false }).limit(200),
      supabase.from("requests").select("*, profiles:recipient_id(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("ratings").select("*, profiles:recipient_id(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("reports").select("*, profiles:reporter_id(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("verification_submissions").select("*").order("created_at", { ascending: false }),
    ]);

    const entries: any[] = [];

    (histDonations.data || []).forEach((d: any) => {
      entries.push({
        id: `donation-${d.id}`, type: "donation", timestamp: d.created_at,
        title: d.title || "Donation", status: d.status, category: d.category,
        person: d.profiles?.full_name || "Unknown", email: d.profiles?.email,
        location: d.location, quantity: d.quantity, unit: d.unit,
        details: `by ${d.profiles?.full_name || "Unknown"} · ${d.quantity || ""} ${d.unit || ""} · ${d.category || ""}`,
      });
    });
    (histCampaigns.data || []).forEach((c: any) => {
      entries.push({
        id: `campaign-${c.id}`, type: "campaign", timestamp: c.created_at,
        title: c.title || "Campaign", status: c.status, category: c.category,
        person: c.profiles?.full_name || "Unknown", email: c.profiles?.email,
        location: c.location, goal: c.goal_amount, collected: c.collected_amount,
        details: `by ${c.profiles?.full_name || "Unknown"} · goal ${c.goal_amount || "?"} ETB · ${c.category || ""}`,
      });
    });
    (histRequests.data || []).forEach((r: any) => {
      entries.push({
        id: `request-${r.id}`, type: "request", timestamp: r.created_at,
        title: "Donation Request", status: r.status,
        person: r.profiles?.full_name || "Unknown", email: r.profiles?.email,
        details: `by ${r.profiles?.full_name || "Unknown"} · ${r.donation_id ? `donation: ${r.donation_id.slice(0, 8)}` : ""}`,
      });
    });
    (histRatings.data || []).forEach((r: any) => {
      entries.push({
        id: `rating-${r.id}`, type: "rating", timestamp: r.created_at,
        title: `Rating: ${r.rating} stars`, status: "completed",
        person: r.profiles?.full_name || "Unknown", email: r.profiles?.email,
        details: `${r.rating}/5 by ${r.profiles?.full_name || "Unknown"}`,
      });
    });
    (histReports.data || []).forEach((r: any) => {
      entries.push({
        id: `report-${r.id}`, type: "report", timestamp: r.created_at,
        title: `Report: ${r.report_type || "unknown"}`, status: r.status || "open",
        person: r.profiles?.full_name || "Unknown", email: r.profiles?.email,
        details: `${r.report_type} reported by ${r.profiles?.full_name || "Unknown"} · ${r.reason || ""}`,
      });
    });
    (histVerifications.data || []).forEach((v: any) => {
      entries.push({
        id: `verification-${v.id}`, type: "verification", timestamp: v.created_at,
        title: v.company_name || "Verification", status: v.status,
        person: v.applicant_name || "Unknown", email: v.applicant_email,
        details: `${v.org_type_slug || ""} · ${v.company_name || ""} · score ${v.total_score || "?"}`,
      });
    });
    // Add user profiles (registrations)
    (usersData || []).forEach((u: any) => {
      if (u.created_at) {
        entries.push({
          id: `user-${u.id}`, type: "user", timestamp: u.created_at,
          title: `${u.full_name || "User"} registered`, status: u.blocked ? "blocked" : "active",
          person: u.full_name || "Unknown", email: u.email,
          details: `${u.role || "user"} · ${u.blocked ? "blocked" : "active"}`,
        });
      }
    });

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setHistoryEntries(entries);

    setStats({
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      submissions: submissions.length,
      verificationsPending: verificationsData.filter((v) => v.status === "pending").length,
      verificationsApproved: verificationsData.filter((v) => v.status === "approved").length,
      verificationsRejected: verificationsData.filter((v) => v.status === "rejected").length,
      pendingDonations: (donationsData || []).filter((d: any) => d.status === "pending").length,
      pendingCampaigns: (campaignsData || []).filter((c: any) => c.status === "pending").length,
      reportsCount: (reportsData || []).length,
      usersCount: (usersData || []).length,
      historyCount: entries.length,
      dataFillersCount: (fillerData || []).length,
    });
    setLoading(false);
  }, [router, tryMatchProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sendCredentialsEmail = async (verification: VerificationSubmission) => {
    try {
      const response = await fetch("/api/send-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: verification.id,
          applicant_name: verification.applicant_name,
          applicant_email: verification.auto_account_email || verification.applicant_email,
          applicant_phone: verification.applicant_phone,
          org_type: verification.org_type_slug,
          company_name: verification.company_name,
          score: verification.total_score,
        }),
      });

      const result = await response.json();
      if (result.success) {
        if (result.email_sent) {
          console.log("Credentials emailed to", verification.applicant_email);
        } else if (result.credentials) {
          setError(
            `SMTP not configured. Share credentials manually: Email: ${result.credentials.email}  Password: ${result.credentials.password}`
          );
        }
      } else {
        setError("Failed to create account: " + (result.message || "Unknown error"));
      }
    } catch (emailErr) {
      setError("Account creation error: " + (emailErr instanceof Error ? emailErr.message : "Unknown error"));
    }
  };

  const handleApproveVerification = async (verification: VerificationSubmission) => {
    setActionLoading(verification.id);
    const { error: err } = await supabase
      .from("verification_submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", verification.id);
    if (err) {
      setError("Failed to approve: " + err.message);
      setActionLoading(null);
      return;
    }

    // The trigger already ran on status change.
    // Now send invite via Supabase Auth (creates user + sends email).
    await sendCredentialsEmail(verification);

    await fetchData();
    setActionLoading(null);
  };

  const handleRejectVerification = async (verification: VerificationSubmission) => {
    setActionLoading(verification.id + "_reject");
    const { error: err } = await supabase
      .from("verification_submissions")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", verification.id);
    if (err) {
      setError("Failed to reject: " + err.message);
    }
    setActionLoading(null);
    await fetchData();
  };

  const handleDonationApproval = async (donationId: string, approved: boolean) => {
    setActionLoading(donationId);
    const { error } = await supabase
      .from("donations")
      .update({ status: approved ? "available" : "rejected" })
      .eq("id", donationId);
    if (error) setError("Failed to update donation: " + error.message);
    setActionLoading(null);
    await fetchData();
  };

  const handleCampaignApproval = async (campaignId: string, approved: boolean) => {
    setActionLoading(campaignId);
    const { error } = await supabase
      .from("campaigns")
      .update({ status: approved ? "active" : "rejected" })
      .eq("id", campaignId);
    if (error) setError("Failed to update campaign: " + error.message);
    setActionLoading(null);
    await fetchData();
  };

  const handleRemoveReported = async (type: string, id: string) => {
    setActionLoading(id);
    const tableMap: Record<string, string> = {
      user: "profiles", donation: "donations", campaign: "campaigns", request: "requests",
    };
    const table = tableMap[type];
    if (!table) { setActionLoading(null); return; }
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) setError("Failed to remove: " + error.message);
    else await fetchData();
    setActionLoading(null);
  };

  const handleViewReporter = async (reporterId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", reporterId)
      .single();
    if (error) { setError("Failed to load reporter: " + error.message); return; }
    setSelectedReporter(data);
    setShowReporterModal(true);
  };

  const handleBlockUser = async (userId: string, currentlyBlocked: boolean) => {
    setActionLoading(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ blocked: !currentlyBlocked })
      .eq("id", userId);
    if (error) setError("Failed to update user: " + error.message);
    else await fetchData();
    setActionLoading(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const filterVerifications = (records: VerificationSubmission[]) => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (v) =>
        v.applicant_name?.toLowerCase().includes(q) ||
        v.applicant_email?.toLowerCase().includes(q) ||
        v.company_name?.toLowerCase().includes(q) ||
        String(v.form_data?.id_number || '').toLowerCase().includes(q)
    );
  };

  const filteredVerifications = tab === "verifications"
    ? filterVerifications(verifications)
    : [];

  const renderScoreSection = (verification: VerificationSubmission) => {
    const sectionScores = verification.section_scores as Record<string, number> | null;
    if (!sectionScores || Object.keys(sectionScores).length === 0) return null;

    return (
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {Object.entries(sectionScores).map(([key, score]) => (
          <div key={key} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
            <p className="text-xs text-slate-500 capitalize truncate">{key.replace(/_/g, ' ')}</p>
            <p className="text-sm font-bold text-slate-800">{score} pts</p>
          </div>
        ))}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5">
          <p className="text-xs text-blue-600 font-medium">Total</p>
          <p className="text-sm font-bold text-blue-700">{verification.total_score} / 100</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-6 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Heart className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">DonationVerify</p>
              <p className="text-xs text-slate-400">Admin Portal</p>
            </div>
          </div>

          <div className="border-b border-slate-100 p-4 grid grid-cols-2 gap-2">
            {[
              { label: "Ver. Pending", value: stats.verificationsPending, color: "text-amber-600 bg-amber-50" },
              { label: "Ver. Approved", value: stats.verificationsApproved, color: "text-emerald-600 bg-emerald-50" },
              { label: "Approved", value: stats.approved, color: "text-emerald-600 bg-emerald-50" },
              { label: "Don. Pending", value: stats.pendingDonations, color: "text-amber-600 bg-amber-50" },
              { label: "Camp. Pending", value: stats.pendingCampaigns, color: "text-blue-600 bg-blue-50" },
              { label: "Reports", value: stats.reportsCount, color: "text-red-600 bg-red-50" },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs font-medium opacity-80">{s.label}</p>
              </div>
            ))}
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {[
              { id: "verifications" as Tab, label: "Verification Forms", icon: <ClipboardCheck className="h-4 w-4" />, count: stats.verificationsPending },
              { id: "approved" as Tab, label: "Approved Recipients", icon: <CheckCircle2 className="h-4 w-4" />, count: stats.approved },
              { id: "donations" as Tab, label: "Donations", icon: <Gift className="h-4 w-4" />, count: stats.pendingDonations },
              { id: "campaigns" as Tab, label: "Campaigns", icon: <Flag className="h-4 w-4" />, count: stats.pendingCampaigns },
              { id: "reports" as Tab, label: "Reports", icon: <Shield className="h-4 w-4" />, count: stats.reportsCount },
              { id: "data-fillers" as Tab, label: "Data Fillers", icon: <ClipboardList className="h-4 w-4" />, count: stats.dataFillersCount },
              { id: "users" as Tab, label: "Users", icon: <Users className="h-4 w-4" />, count: stats.usersCount },
              { id: "history" as Tab, label: "Activity Log", icon: <Clock className="h-4 w-4" />, count: stats.historyCount },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setTab(item.id); setExpandedId(null); }}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  {item.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    tab === item.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            ))}
            <Link
              href="/admin/forms"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Form Config
            </Link>
            <Link
              href="/admin/analytics"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Link>
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                {adminUser?.email?.[0]?.toUpperCase() ?? "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {adminUser?.email ?? "Admin"}
                </p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="ml-64 flex-1 p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {tab === "verifications" && "Verification Form Submissions"}
                {tab === "approved" && "Approved Recipients"}
                {tab === "donations" && "All Donations"}
                {tab === "campaigns" && "All Campaigns"}
                {tab === "reports" && "Reports"}
                {tab === "users" && "User Management"}
                {tab === "history" && "Activity Log"}
                {tab === "data-fillers" && "Data Filler Management"}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {tab === "verifications" && "Review verification form submissions, approve applicant accounts"}
                {tab === "approved" && "Approved recipients — click any row for full details"}
                {tab === "donations" && "All donations with donor info, images, and status"}
                {tab === "campaigns" && "All campaigns with goal progress and status"}
                {tab === "reports" && "Grouped by reported person — review and take action"}
                {tab === "users" && "Manage all registered users (block/unblock)"}
                {tab === "history" && "Complete chronological history of every action on the platform"}
                {tab === "data-fillers" && "Create and manage data filler accounts"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="input-field pl-9 w-60"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="btn-secondary"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* VERIFICATION SUBMISSIONS TAB - modern table with modal */}
              {tab === "verifications" && (
                <div className="card overflow-hidden">
                  {filteredVerifications.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                      <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-slate-200" />
                      <p className="text-slate-500 font-medium">No verification submissions found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {["", "Applicant", "Email", "Org Type", "Company", "Score", "Status", "Submitted"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredVerifications.map((v) => (
                            <tr key={v.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => { setSelectedDetail(v); setSelectedDetailType("verification"); }}>
                              <td className="px-4 py-3">
                                <OrgTypeIcon slug={v.org_type_slug} className="bg-blue-50 text-blue-600 h-9 w-9" />
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{v.applicant_name}</p>
                                <StatusBadge status={v.status} />
                              </td>
                              <td className="px-4 py-3 text-slate-600">{v.applicant_email}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700 capitalize">{v.org_type_slug}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{v.company_name || "—"}</td>
                              <td className="px-4 py-3">
                                <PriorityBadge level={v.priority_level} score={v.total_score} />
                              </td>
                              <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                              <td className="px-4 py-3 text-slate-400 text-xs">{v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* APPROVED RECIPIENTS TAB - modern table list */}
              {tab === "approved" && (
                <div className="card overflow-hidden">
                  {approvedProfiles.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                      <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-slate-200" />
                      <p className="text-slate-500 font-medium">No approved recipients yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {["", "Name", "Email", "Phone", "Location", "Matched Company", "Registered"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {approvedProfiles.map(({ profile, match }) => (
                            <tr key={profile.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => setSelectedDetail(profile)}>
                              <td className="px-4 py-3">
                                {profile.verification_image_url ? (
                                  <img src={profile.verification_image_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <User className="h-4 w-4 text-slate-400" />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{profile.full_name || "Unnamed"}</p>
                                <StatusBadge status={profile.recipient_status || "approved"} />
                              </td>
                              <td className="px-4 py-3 text-slate-600">{profile.email}</td>
                              <td className="px-4 py-3 text-slate-600">{profile.phone || "—"}</td>
                              <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{profile.location || "—"}</td>
                              <td className="px-4 py-3">
                                {match ? (
                                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                    {match.company_name}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-400 text-xs">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* DONATIONS TAB - modern table with modal */}
              {tab === "donations" && (
                <>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {["all", "pending", "available", "completed", "claimed", "rejected"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setDonationFilter(s)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                          donationFilter === s
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {s === "available" ? "approved" : s}
                      </button>
                    ))}
                  </div>
                  <div className="card overflow-hidden">
                    {(() => {
                      const filtered = donationFilter === "all"
                        ? allDonations
                        : allDonations.filter((d) => d.status === donationFilter);
                      return filtered.length === 0 ? (
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                          <Gift className="mx-auto mb-4 h-12 w-12 text-slate-200" />
                          <p className="text-slate-500 font-medium">No {donationFilter === "all" ? "" : donationFilter} donations</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                {["", "Title", "Donor", "Category", "Location", "Status", "Created"].map((h) => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filtered.map((d: any) => (
                                <tr key={d.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => { setSelectedDetail(d); setSelectedDetailType("donation"); }}>
                                  <td className="px-4 py-3">
                                    {d.image_url ? (
                                      <img src={d.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                                    ) : (
                                      <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                                        <Gift className="h-5 w-5 text-amber-500" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-slate-900 truncate max-w-[200px]">{d.title || d.description?.slice(0, 40) || "Untitled"}</p>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{d.profiles?.full_name || "Unknown"}</td>
                                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">{d.category || "—"}</span></td>
                                  <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{d.location || "—"}</td>
                                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                                  <td className="px-4 py-3 text-slate-400 text-xs">{d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* CAMPAIGNS TAB - modern table with modal */}
              {tab === "campaigns" && (
                <>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {["all", "pending", "active", "completed", "paused", "rejected"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setCampaignFilter(s)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                          campaignFilter === s
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="card overflow-hidden">
                    {(() => {
                      const filtered = campaignFilter === "all"
                        ? allCampaigns
                        : allCampaigns.filter((c) => c.status === campaignFilter);
                      return filtered.length === 0 ? (
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                          <Flag className="mx-auto mb-4 h-12 w-12 text-slate-200" />
                          <p className="text-slate-500 font-medium">No {campaignFilter === "all" ? "" : campaignFilter} campaigns</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                {["", "Title", "Recipient", "Goal", "Raised", "Org Type", "Status", "Created"].map((h) => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filtered.map((c: any) => (
                                <tr key={c.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => { setSelectedDetail(c); setSelectedDetailType("campaign"); }}>
                                  <td className="px-4 py-3">
                                    {c.image_url ? (
                                      <img src={c.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                                    ) : (
                                      <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Flag className="h-5 w-5 text-blue-500" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-slate-900 truncate max-w-[200px]">{c.title || "Untitled"}</p>
                                    {c.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{c.description.slice(0, 60)}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{c.profiles?.full_name || "Unknown"}</td>
                                  <td className="px-4 py-3 font-medium text-slate-800">{c.goal_amount ? `${c.goal_amount} ETB` : "—"}</td>
                                  <td className="px-4 py-3 font-medium text-emerald-600">{c.collected_amount ? `${c.collected_amount} ETB` : "0 ETB"}</td>
                                  <td className="px-4 py-3">
                                    {c.org_type ? (
                                      <span className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700 capitalize">{c.org_type}</span>
                                    ) : "—"}
                                  </td>
                                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                  <td className="px-4 py-3 text-slate-400 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* REPORTS TAB - grouped by reported person */}
              {tab === "reports" && (
                <div>
                  {(() => {
                    const grouped: Record<string, any> = {};
                    reportsList.forEach((r) => {
                      const key = r.reported_id || "unknown";
                      if (!grouped[key]) grouped[key] = { reported_id: key, reports: [], profiles: r.profiles };
                      grouped[key].reports.push(r);
                    });
                    const entries = Object.entries(grouped);
                    if (entries.length === 0) {
                      return (
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                          <Shield className="mx-auto mb-4 h-12 w-12 text-slate-200" />
                          <p className="text-slate-500 font-medium">No reports yet</p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-6">
                        {entries.map(([reportedId, group]) => (
                          <div key={reportedId} className="card overflow-hidden">
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
                                    <Shield className="h-6 w-6" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900 text-lg">{group.profiles?.full_name || `User ${reportedId.slice(0, 8)}`}</p>
                                    <p className="text-sm text-slate-500">{group.reports[0]?.report_type || ""} &middot; {group.reports[0]?.reason || "No reason"}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-sm font-bold text-red-700">
                                    {group.reports.length} {group.reports.length === 1 ? "report" : "reports"}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                {group.reports.map((rep: any, i: number) => (
                                  <div key={rep.id} className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                                    <span className="font-medium text-slate-600">#{i + 1}</span>
                                    <span className="text-slate-400">|</span>
                                    <span className="text-slate-500 capitalize">{rep.report_type}</span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-slate-500 max-w-[150px] truncate">{rep.reason || "—"}</span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-slate-400">{new Date(rep.created_at).toLocaleDateString()}</span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-blue-600 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); handleViewReporter(rep.reporter_id); }}>
                                      reporter
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {group.reports.length >= 2 && (
                                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                                  <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-sm font-semibold text-red-800">Suggest Blocking This User</p>
                                      <p className="text-xs text-red-600 mt-1">
                                        This person has {group.reports.length} reports against them. Per our
                                        Privacy Policy (Section 4: Prohibited Conduct & Enforcement), users with
                                        multiple verified reports may be blocked to protect the community.
                                      </p>
                                      <p className="text-xs text-red-500 mt-1 italic">
                                        "We reserve the right to suspend or permanently block accounts that
                                        violate our community guidelines or receive multiple valid reports."
                                      </p>
                                      <button
                                        onClick={async () => {
                                          const { error } = await supabase
                                            .from("profiles")
                                            .update({ blocked: true })
                                            .eq("id", reportedId);
                                          if (error) setError("Failed to block user: " + error.message);
                                          else { fetchData(); setError("User blocked successfully"); }
                                        }}
                                        disabled={!!actionLoading}
                                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                                      >
                                        {actionLoading === reportedId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                        Block This User
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* DATA FILLERS TAB - modern table with modal */}
              {/* USERS TAB - modern table with modal */}
              {tab === "users" && (
                <div className="card overflow-hidden">
                  {usersList.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                      <Users className="mx-auto mb-4 h-12 w-12 text-slate-200" />
                      <p className="text-slate-500 font-medium">No users found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {["", "Name", "Email", "Role", "Location", "Blocked", "Registered"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {usersList.map((u) => (
                            <tr key={u.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => { setSelectedDetail(u); setSelectedDetailType("user"); }}>
                              <td className="px-4 py-3">
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                                ) : (
                                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
                                    <User className="h-4 w-4 text-slate-400" />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{u.full_name || "Unnamed"}</p>
                                {u.blocked && <span className="text-xs text-red-500 font-medium">Blocked</span>}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{u.email}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">{u.role || "user"}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate">{u.location || "—"}</td>
                              <td className="px-4 py-3">
                                {u.blocked ? (
                                  <span className="text-red-600 font-medium text-xs">Yes</span>
                                ) : (
                                  <span className="text-emerald-600 font-medium text-xs">No</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === "data-fillers" && (
                <div className="card overflow-hidden">
                  {dataFillerProfiles.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                      <ClipboardList className="mx-auto mb-4 h-12 w-12 text-slate-200" />
                      <p className="text-slate-500 font-medium">No data filler submissions found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {["Applicant", "Email", "Phone", "Status", "Submitted"].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dataFillerProfiles.map((f) => (
                            <tr key={f.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => { setSelectedDetail(f); setSelectedDetailType("datafiller"); }}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{f.full_name || f.applicant_name}</p>
                                <span className="text-xs text-slate-400">{f.email || f.applicant_email}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{f.email || f.applicant_email}</td>
                              <td className="px-4 py-3 text-slate-600">{f.phone || f.applicant_phone || "—"}</td>
                              <td className="px-4 py-3"><StatusBadge status={f.status || "active"} /></td>
                              <td className="px-4 py-3 text-slate-400 text-xs">{f.created_at ? new Date(f.created_at).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

                  {/* Create Data Filler Modal */}
                  {showCreateDataFiller && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!creatingFiller) setShowCreateDataFiller(false); }}>
                      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-slate-900">
                            {createdFillerCreds ? "Account Created" : "Create Data Filler"}
                          </h3>
                          <button onClick={() => { if (!creatingFiller) setShowCreateDataFiller(false); }} className="text-slate-400 hover:text-slate-600">
                            <XCircle className="h-5 w-5" />
                          </button>
                        </div>

                        {createdFillerCreds ? (
                          <div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                <span className="font-semibold text-emerald-800">Account created successfully</span>
                              </div>
                              <div className="space-y-2 mt-3">
                                <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                                  <p className="text-xs text-slate-400">Email</p>
                                  <p className="font-mono text-sm text-slate-800">{createdFillerCreds.email}</p>
                                </div>
                                <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                                  <p className="text-xs text-slate-400">Password</p>
                                  <p className="font-mono text-sm text-slate-800">{createdFillerCreds.password}</p>
                                </div>
                              </div>
                              <p className="mt-3 text-xs text-emerald-600">Share these credentials with the data filler.</p>
                            </div>
                            <button onClick={() => { setShowCreateDataFiller(false); setCreatedFillerCreds(null); }} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                              Done
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                              <input type="text" value={createFillerName} onChange={(e) => setCreateFillerName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="e.g. Abebe Kebede" />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                              <input type="email" value={createFillerEmail} onChange={(e) => setCreateFillerEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="filler@example.com" />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">Organization Type</label>
                              <select value={createFillerOrgType} onChange={(e) => setCreateFillerOrgType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none">
                                <option value="">Select org type...</option>
                                {Object.entries(ORG_TYPE_MAP).map(([slug, info]) => (
                                  <option key={slug} value={slug}>{info.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">Organization Name</label>
                              <input type="text" value={createFillerOrgName} onChange={(e) => setCreateFillerOrgName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="e.g. Addis Ababa University" />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                              <input type="text" value={createFillerPassword} onChange={(e) => setCreateFillerPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="Auto-generated if empty" />
                            </div>
                            <button onClick={async () => {
                              if (!createFillerName.trim() || !createFillerEmail.trim() || !createFillerOrgType || !createFillerOrgName.trim()) { setError("Full name, email, org type, and org name are required"); return; }
                              setCreatingFiller(true);
                              setError("");
                              try {
                                const password = createFillerPassword.trim() || Math.random().toString(36).slice(-10) + "A1!";
                                const res = await fetch("/api/create-data-filler", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ email: createFillerEmail.trim(), password, full_name: createFillerName.trim(), org_type: createFillerOrgType, organization_name: createFillerOrgName.trim() }),
                                });
                                const result = await res.json();
                                if (!result.success) throw new Error(result.message);
                                setCreatedFillerCreds({ email: result.credentials.email, password: result.credentials.password });
                                fetchData();
                              } catch (err: any) {
                                setError(err.message || "Failed to create account");
                              } finally {
                                setCreatingFiller(false);
                              }
                            }} disabled={creatingFiller} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                              {creatingFiller ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              {creatingFiller ? "Creating..." : "Create Account"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

              {/* HISTORY TAB */}
              {tab === "history" && (
                <div>
                  {/* Type filter pills */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {["all", "donation", "campaign", "user", "request", "report", "verification", "rating"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setHistoryFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          historyFilter === f
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
                      </button>
                    ))}
                  </div>

                  {historyEntries.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                      <Clock className="mx-auto mb-4 h-12 w-12 text-slate-200" />
                      <p className="text-slate-500 font-medium">No activity recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {historyEntries
                        .filter((e) => historyFilter === "all" || e.type === historyFilter)
                        .map((entry) => {
                          const statusColor: Record<string, string> = {
                            pending: "bg-amber-50 text-amber-700 border-amber-200",
                            active: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            completed: "bg-blue-50 text-blue-700 border-blue-200",
                            rejected: "bg-red-50 text-red-700 border-red-200",
                            available: "bg-green-50 text-green-700 border-green-200",
                            approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            open: "bg-amber-50 text-amber-700 border-amber-200",
                            blocked: "bg-red-50 text-red-700 border-red-200",
                          };
                          const typeColors: Record<string, string> = {
                            donation: "text-amber-600 bg-amber-50",
                            campaign: "text-blue-600 bg-blue-50",
                            user: "text-emerald-600 bg-emerald-50",
                            request: "text-purple-600 bg-purple-50",
                            report: "text-red-600 bg-red-50",
                            verification: "text-indigo-600 bg-indigo-50",
                            rating: "text-pink-600 bg-pink-50",
                          };
                          return (
                            <div key={entry.id} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-colors">
                              <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${typeColors[entry.type] || "text-slate-600 bg-slate-100"}`}>
                                {entry.type === "donation" ? "D" : entry.type === "campaign" ? "C" : entry.type === "user" ? "U" : entry.type === "request" ? "R" : entry.type === "report" ? "Rp" : entry.type === "verification" ? "V" : "Rt"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-900 truncate">{entry.title}</span>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor[entry.status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                    {entry.status}
                                  </span>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                                    {entry.type}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.details}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""} · {entry.email || entry.person}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* Detail Modal */}
        {selectedDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setSelectedDetail(null); setSelectedDetailType(""); }}>
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-900 capitalize">
                  {selectedDetailType} Details
                </h3>
                <button onClick={() => { setSelectedDetail(null); setSelectedDetailType(""); }} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {selectedDetailType === "donation" && (
                <div className="space-y-4">
                  {selectedDetail.image_url && (
                    <img src={selectedDetail.image_url} alt="" className="w-full h-56 rounded-xl object-cover border border-slate-200" />
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow icon={<Gift className="h-4 w-4" />} label="Title" value={selectedDetail.title} />
                    <InfoRow icon={<FileText className="h-4 w-4" />} label="Description" value={selectedDetail.description} />
                    <InfoRow icon={<User className="h-4 w-4" />} label="Donor" value={selectedDetail.profiles?.full_name || "Unknown"} />
                    <InfoRow icon={<Hash className="h-4 w-4" />} label="Category" value={selectedDetail.category} />
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={selectedDetail.location} />
                    <InfoRow icon={<Calendar className="h-4 w-4" />} label="Created" value={selectedDetail.created_at ? new Date(selectedDetail.created_at).toLocaleString() : null} />
                    <div><StatusBadge status={selectedDetail.status} /></div>
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                    {selectedDetail.status === "pending" && (
                      <>
                        <button onClick={async () => { await handleDonationApproval(selectedDetail.id, true); setSelectedDetail(null); }} disabled={!!actionLoading} className="btn-success text-sm py-2">
                          Approve
                        </button>
                        <button onClick={async () => { await handleDonationApproval(selectedDetail.id, false); setSelectedDetail(null); }} disabled={!!actionLoading} className="btn-danger text-sm py-2">
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedDetailType === "campaign" && (
                <div className="space-y-4">
                  {selectedDetail.image_url && (
                    <img src={selectedDetail.image_url} alt="" className="w-full h-56 rounded-xl object-cover border border-slate-200" />
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow icon={<Flag className="h-4 w-4" />} label="Title" value={selectedDetail.title} />
                    <InfoRow icon={<FileText className="h-4 w-4" />} label="Description" value={selectedDetail.description} />
                    <InfoRow icon={<User className="h-4 w-4" />} label="Recipient" value={selectedDetail.profiles?.full_name || "Unknown"} />
                    <InfoRow icon={<Hash className="h-4 w-4" />} label="Goal" value={selectedDetail.goal_amount ? `${selectedDetail.goal_amount} ETB` : null} />
                    <InfoRow icon={<Hash className="h-4 w-4" />} label="Raised" value={selectedDetail.collected_amount ? `${selectedDetail.collected_amount} ETB` : "0 ETB"} />
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Org Type" value={selectedDetail.org_type ? selectedDetail.org_type.charAt(0).toUpperCase() + selectedDetail.org_type.slice(1) : null} />
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={selectedDetail.location} />
                    <InfoRow icon={<Calendar className="h-4 w-4" />} label="Created" value={selectedDetail.created_at ? new Date(selectedDetail.created_at).toLocaleString() : null} />
                    <div><StatusBadge status={selectedDetail.status} /></div>
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                    {selectedDetail.status === "pending" && (
                      <>
                        <button onClick={async () => { await handleCampaignApproval(selectedDetail.id, true); setSelectedDetail(null); }} disabled={!!actionLoading} className="btn-success text-sm py-2">
                          Approve
                        </button>
                        <button onClick={async () => { await handleCampaignApproval(selectedDetail.id, false); setSelectedDetail(null); }} disabled={!!actionLoading} className="btn-danger text-sm py-2">
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedDetailType === "user" && (
                <div className="space-y-4">
                  {selectedDetail.avatar_url ? (
                    <img src={selectedDetail.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-slate-200" />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="h-8 w-8 text-slate-400" />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow icon={<User className="h-4 w-4" />} label="Full Name" value={selectedDetail.full_name} />
                    <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedDetail.email} />
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedDetail.phone} />
                    <InfoRow icon={<Shield className="h-4 w-4" />} label="Role" value={selectedDetail.role} />
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={selectedDetail.location} />
                    <InfoRow icon={<Ban className="h-4 w-4" />} label="Blocked" value={selectedDetail.blocked ? "Yes" : "No"} />
                    <InfoRow icon={<Calendar className="h-4 w-4" />} label="Registered" value={selectedDetail.created_at ? new Date(selectedDetail.created_at).toLocaleDateString() : null} />
                  </div>
                  <div className="flex justify-end mt-4">
                    <button onClick={async () => {
                      await handleBlockUser(selectedDetail.id, selectedDetail.blocked);
                      setSelectedDetail(null);
                    }} disabled={!!actionLoading}
                      className={`text-sm py-2 px-4 rounded-lg font-medium transition-colors ${
                        selectedDetail.blocked
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                          : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                      }`}>
                      {actionLoading === selectedDetail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                        <Ban className="h-4 w-4 inline mr-1" />
                        {selectedDetail.blocked ? "Unblock" : "Block"}
                      </>}
                    </button>
                  </div>
                </div>
              )}

              {selectedDetailType === "verification" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                    <OrgTypeIcon slug={selectedDetail.org_type_slug} className="bg-blue-50 text-blue-600 h-12 w-12" />
                    <div>
                      <p className="font-semibold text-slate-900 text-lg">{selectedDetail.applicant_name}</p>
                      <p className="text-sm text-slate-500">{selectedDetail.applicant_email}</p>
                      <div className="flex gap-2 mt-1">
                        <StatusBadge status={selectedDetail.status} />
                        <PriorityBadge level={selectedDetail.priority_level} score={selectedDetail.total_score} />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow icon={<User className="h-4 w-4" />} label="Full Name" value={selectedDetail.applicant_name} />
                    <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedDetail.applicant_email} />
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedDetail.applicant_phone} />
                    <InfoRow icon={<Hash className="h-4 w-4" />} label="National ID" value={selectedDetail.form_data?.id_number as string} />
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company" value={selectedDetail.company_name} />
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Org Type" value={selectedDetail.org_type_slug} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Score</h3>
                    </div>
                    {renderScoreSection(selectedDetail)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Form Data</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {Object.entries(selectedDetail.form_data || {}).map(([key, val]) => {
                        if (key.startsWith('applicant_') || (typeof val === 'string' && val.startsWith('http'))) return null;
                        return (
                          <div key={key} className="flex items-start gap-2 border-b border-slate-100 pb-2">
                            <p className="text-sm text-slate-500 w-1/3 capitalize shrink-0">{key.replace(/_/g, ' ')}</p>
                            <p className="text-base text-slate-800">{String(val || '—')}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {selectedDetail.document_urls && selectedDetail.document_urls.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Documents</h3>
                      <div className="space-y-2">
                        {selectedDetail.document_urls.map((url: string, idx: number) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50">
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="truncate">Document {idx + 1}</span>
                            <Eye className="h-3.5 w-3.5 ml-auto shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedDetail.auto_account_created && (
                    <CredentialsCard email={selectedDetail.auto_account_email} password={selectedDetail.auto_account_password} />
                  )}
                  <div className="flex justify-end gap-2 mt-4">
                    {selectedDetail.status === "pending" ? (
                      <>
                        <button onClick={async () => { await handleApproveVerification(selectedDetail); setSelectedDetail(null); }} disabled={!!actionLoading} className="btn-success text-sm py-2">
                          {actionLoading === selectedDetail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Approve
                        </button>
                        <button onClick={async () => { await handleRejectVerification(selectedDetail); setSelectedDetail(null); }} disabled={!!actionLoading} className="btn-danger text-sm py-2">
                          {actionLoading === selectedDetail.id + "_reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${selectedDetail.status === "approved" ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                        {selectedDetail.status === "approved" ? "Approved" : "Rejected"}
                        {selectedDetail.reviewed_at && ` — ${new Date(selectedDetail.reviewed_at).toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {selectedDetailType === "datafiller" && (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-slate-100">
                    <p className="font-semibold text-slate-900 text-lg">{selectedDetail.full_name || selectedDetail.applicant_name}</p>
                    <p className="text-sm text-slate-500">{selectedDetail.email || selectedDetail.applicant_email}</p>
                    <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">Data Filler</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow icon={<User className="h-4 w-4" />} label="Full Name" value={selectedDetail.full_name || selectedDetail.applicant_name} />
                    <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedDetail.email || selectedDetail.applicant_email} />
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedDetail.phone || selectedDetail.applicant_phone} />
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="Organization" value={selectedDetail.organization_name || selectedDetail.org_type} />
                    <InfoRow icon={<Shield className="h-4 w-4" />} label="Role" value={selectedDetail.role || "data_filler"} />
                    <InfoRow icon={<Calendar className="h-4 w-4" />} label="Registered" value={selectedDetail.created_at ? new Date(selectedDetail.created_at).toLocaleDateString() : null} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reporter Detail Modal */}
        {showReporterModal && selectedReporter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReporterModal(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Reporter Details</h3>
                <button onClick={() => setShowReporterModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{selectedReporter.full_name || "Unnamed"}</p>
                    <p className="text-sm text-slate-500">{selectedReporter.email}</p>
                  </div>
                </div>
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedReporter.phone} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={selectedReporter.location} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Registered" value={selectedReporter.created_at ? new Date(selectedReporter.created_at).toLocaleDateString() : null} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
