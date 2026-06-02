"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Heart,
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  UserPlus,
  CheckCircle2,
  X,
  ChevronRight,
  Building2,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { OrgTypeSlug, CompanyType } from "@/lib/supabase";
import { ORG_TYPE_MAP, type SubmissionStatus } from "@/lib/types";
import { FORM_REGISTRY } from "@/lib/verificationForms";
import DynamicForm from "@/components/DynamicForm";

type Mode = "choose" | "form" | "excel" | "dynamic" | "success" | string;

interface RecipientRow {
  id: string;
  full_name: string;
  id_number: string;
  phone: string;
  email: string;
  date_of_birth: string;
  address: string;
  notes: string;
}

const COMPANY_TYPES: { value: CompanyType; label: string; emoji: string }[] = [
  { value: "government", label: "Government", emoji: "🏛️" },
  { value: "university", label: "University / College", emoji: "🎓" },
  { value: "hospital", label: "Hospital / Clinic", emoji: "🏥" },
  { value: "school", label: "School", emoji: "🏫" },
  { value: "ngo", label: "NGO / Non-profit", emoji: "🤝" },
  { value: "other", label: "Other Company", emoji: "🏢" },
];

const emptyRow = (): RecipientRow => ({
  id: crypto.randomUUID(),
  full_name: "",
  id_number: "",
  phone: "",
  email: "",
  date_of_birth: "",
  address: "",
  notes: "",
});

export default function CompanyPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState<1 | 2>(1);

  // Company info
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType | "">("");
  const [contactEmail, setContactEmail] = useState("");

  // Form rows (legacy manual form)
  const [rows, setRows] = useState<RecipientRow[]>([emptyRow()]);

  // Excel
  const [excelRows, setExcelRows] = useState<RecipientRow[]>([]);
  const [excelFileName, setExcelFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const companyValid =
    companyName.trim() && companyType && contactEmail.trim().includes("@");

  const updateRow = (id: string, field: keyof RecipientRow, val: string) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );

  const handleExcelUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setExcelFileName(file.name);
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
      });
      const mapped: RecipientRow[] = data.map((r) => ({
        id: crypto.randomUUID(),
        full_name: String(
          r["full_name"] ?? r["Full Name"] ?? r["name"] ?? r["Name"] ?? ""
        ),
        id_number: String(
          r["id_number"] ??
            r["ID Number"] ??
            r["id"] ??
            r["ID"] ??
            r["national_id"] ??
            ""
        ),
        phone: String(r["phone"] ?? r["Phone"] ?? r["mobile"] ?? ""),
        email: String(r["email"] ?? r["Email"] ?? ""),
        date_of_birth: String(
          r["date_of_birth"] ?? r["DOB"] ?? r["Date of Birth"] ?? ""
        ),
        address: String(r["address"] ?? r["Address"] ?? ""),
        notes: String(r["notes"] ?? r["Notes"] ?? r["remarks"] ?? ""),
      }));
      setExcelRows(mapped);
    },
    []
  );

  const handleLegacySubmit = async () => {
    setError("");
    const recipientsToSubmit = mode === "excel" ? excelRows : rows;
    if (!recipientsToSubmit.length) {
      setError("No recipients to submit.");
      return;
    }
    const hasNames = recipientsToSubmit.every((r) => r.full_name.trim());
    if (!hasNames) {
      setError("All recipients must have a full name.");
      return;
    }
    setLoading(true);
    const inserts = recipientsToSubmit.map((r) => ({
      company_name: companyName.trim(),
      company_type: companyType,
      submitted_by_email: contactEmail.trim(),
      full_name: r.full_name.trim(),
      id_number: r.id_number.trim() || null,
      phone: r.phone.trim() || null,
      email: r.email.trim() || null,
      date_of_birth: r.date_of_birth || null,
      address: r.address.trim() || null,
      notes: r.notes.trim() || null,
    }));
    const { error: err } = await supabase
      .from("company_submissions")
      .insert(inserts);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMode("success");
  };

  const handleDynamicSuccess = () => {
    setMode("success");
  };

  const handleBackFromForm = () => {
    setMode("choose");
    setStep(1);
  };

  const resetAll = () => {
    setMode("choose");
    setStep(1);
    setRows([emptyRow()]);
    setExcelRows([]);
    setExcelFileName("");
    setCompanyName("");
    setCompanyType("");
    setContactEmail("");
  };

  const isOrgWithDynamicForm = companyType && companyType !== "other" && FORM_REGISTRY[companyType as OrgTypeSlug];

  if (mode === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 px-6">
        <div className="card max-w-lg w-full p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="mb-3 text-3xl font-bold text-slate-900">
            Submitted Successfully!
          </h2>
          <p className="mb-2 text-slate-600">
            Thank you,{" "}
            <span className="font-semibold text-slate-800">{companyName}</span>.
          </p>
          <p className="mb-8 text-sm text-slate-500">
            Your verification data has been received. An administrator will review
            the submission and approve it. Upon approval, an account will be
            automatically created for the applicant.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={resetAll}
              className="btn-primary"
            >
              Submit More Data
            </button>
            <Link href="/" className="btn-secondary">
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "dynamic" && companyType && isOrgWithDynamicForm) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mx-auto max-w-5xl flex items-center justify-between">
            <button
              onClick={handleBackFromForm}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to selection
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Heart className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-slate-900">DonationVerify</span>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-6 py-10">
          <DynamicForm
            orgType={companyType as OrgTypeSlug}
            companyName={companyName}
            contactEmail={contactEmail}
            onSuccess={handleDynamicSuccess}
            onBack={handleBackFromForm}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Heart className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">DonationVerify</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Step indicator */}
        {mode !== "choose" && (
          <div className="mb-10 flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step >= 1 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}
            >
              1
            </div>
            <div
              className={`h-0.5 flex-1 max-w-16 ${step >= 2 ? "bg-blue-600" : "bg-slate-200"}`}
            />
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step >= 2 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}
            >
              2
            </div>
            <span className="ml-2 text-sm text-slate-500">
              {step === 1 ? "Organization Information" : "Verification Data"}
            </span>
          </div>
        )}

        {/* Step 1 – Company Info */}
        {(mode === "choose" || step === 1) && mode !== "success" && (
          <div className="card p-8 max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Organization Information
              </h1>
              <p className="text-slate-500">
                Tell us about your organization before submitting verification data.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="label">Organization Name *</label>
                <input
                  className="input-field"
                  placeholder="e.g. Ministry of Social Affairs"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Organization Type *</label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {COMPANY_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setCompanyType(t.value)}
                      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                        companyType === t.value
                          ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-xl">{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Contact Email *</label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="contact@organization.org"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              {isOrgWithDynamicForm ? (
                <button
                  disabled={!companyValid}
                  onClick={() => {
                    setMode("dynamic");
                    setStep(2);
                  }}
                  className="btn-primary flex-1 justify-center py-3"
                >
                  Fill Verification Form
                  <ClipboardCheck className="h-4 w-4" />
                </button>
              ) : (
                <button
                  disabled={!companyValid}
                  onClick={() => {
                    setMode("form");
                    setStep(2);
                  }}
                  className="btn-primary flex-1 justify-center py-3"
                >
                  Fill Form Manually
                  <UserPlus className="h-4 w-4" />
                </button>
              )}
              <button
                disabled={!companyValid}
                onClick={() => {
                  setMode("excel");
                  setStep(2);
                }}
                className="btn-secondary flex-1 justify-center py-3"
              >
                Upload Excel File
                <FileSpreadsheet className="h-4 w-4" />
              </button>
            </div>

            {companyType && isOrgWithDynamicForm && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                <p className="font-medium">
                  {ORG_TYPE_MAP[companyType as OrgTypeSlug]?.icon} {ORG_TYPE_MAP[companyType as OrgTypeSlug]?.name} Verification
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  This organization type has a custom verification form with scoring.
                  Fill out the detailed form or upload recipient data via Excel.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2 – Manual Form (legacy for "other") */}
        {mode === "form" && step === 2 && (
          <div>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Add Recipients
                </h2>
                <p className="text-slate-500 flex items-center gap-1.5 mt-1">
                  <Building2 className="h-4 w-4" />
                  {companyName}
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="btn-secondary text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-6">
              {rows.map((row, idx) => (
                <div key={row.id} className="card p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      Recipient #{idx + 1}
                    </h3>
                    {rows.length > 1 && (
                      <button
                        onClick={() =>
                          setRows((prev) =>
                            prev.filter((r) => r.id !== row.id)
                          )
                        }
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Full Name *</label>
                      <input
                        className="input-field"
                        placeholder="e.g. Abebe Bekele"
                        value={row.full_name}
                        onChange={(e) =>
                          updateRow(row.id, "full_name", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">National ID / Student ID</label>
                      <input
                        className="input-field"
                        placeholder="ID number"
                        value={row.id_number}
                        onChange={(e) =>
                          updateRow(row.id, "id_number", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Phone Number</label>
                      <input
                        className="input-field"
                        placeholder="+251 9..."
                        value={row.phone}
                        onChange={(e) =>
                          updateRow(row.id, "phone", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Email Address</label>
                      <input
                        className="input-field"
                        type="email"
                        placeholder="recipient@email.com"
                        value={row.email}
                        onChange={(e) =>
                          updateRow(row.id, "email", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Date of Birth</label>
                      <input
                        className="input-field"
                        type="text"
                        placeholder="e.g. 27/01/2003 or 2003-01-27"
                        value={row.date_of_birth}
                        onChange={(e) =>
                          updateRow(row.id, "date_of_birth", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Address / Location</label>
                      <input
                        className="input-field"
                        placeholder="City, Region"
                        value={row.address}
                        onChange={(e) =>
                          updateRow(row.id, "address", e.target.value)
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Additional Notes</label>
                      <textarea
                        className="input-field resize-none"
                        rows={2}
                        placeholder="Any additional information..."
                        value={row.notes}
                        onChange={(e) =>
                          updateRow(row.id, "notes", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => setRows((prev) => [...prev, emptyRow()])}
                className="btn-secondary"
              >
                <Plus className="h-4 w-4" />
                Add Another Recipient
              </button>
              <button
                onClick={handleLegacySubmit}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Submit {rows.length} Recipient{rows.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 – Excel Upload */}
        {mode === "excel" && step === 2 && (
          <div>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Upload Excel File
                </h2>
                <p className="text-slate-500 flex items-center gap-1.5 mt-1">
                  <Building2 className="h-4 w-4" />
                  {companyName}
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="btn-secondary text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Upload zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`card cursor-pointer border-2 border-dashed p-12 text-center transition-all hover:border-blue-400 hover:bg-blue-50/30 ${excelFileName ? "border-emerald-400 bg-emerald-50/30" : "border-slate-300"}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelUpload}
              />
              {excelFileName ? (
                <>
                  <FileSpreadsheet className="mx-auto mb-4 h-14 w-14 text-emerald-600" />
                  <p className="text-lg font-semibold text-slate-900">
                    {excelFileName}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {excelRows.length} recipients found — click to replace
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto mb-4 h-14 w-14 text-slate-300" />
                  <p className="text-lg font-semibold text-slate-700">
                    Drop your Excel file here
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    or click to browse — supports .xlsx, .xls, .csv
                  </p>
                </>
              )}
            </div>

            {/* Template hint */}
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
              <p className="font-medium mb-1">Expected columns:</p>
              <p className="font-mono text-xs text-blue-600">
                full_name | id_number | phone | email | date_of_birth | address
                | notes
              </p>
            </div>

            {/* Preview table */}
            {excelRows.length > 0 && (
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    Preview ({excelRows.length} recipients)
                  </h3>
                  <button
                    onClick={() => {
                      setExcelRows([]);
                      setExcelFileName("");
                    }}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                </div>
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left">
                        <tr>
                          {[
                            "Full Name",
                            "ID Number",
                            "Phone",
                            "Email",
                            "DOB",
                            "Address",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 font-medium text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {excelRows.slice(0, 10).map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {r.full_name || (
                                <span className="text-red-500">Missing</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {r.id_number || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {r.phone || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {r.email || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {r.date_of_birth || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {r.address || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {excelRows.length > 10 && (
                      <p className="px-4 py-3 text-sm text-slate-400 border-t border-slate-100">
                        ...and {excelRows.length - 10} more rows
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleLegacySubmit}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Submit {excelRows.length} Recipients
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
