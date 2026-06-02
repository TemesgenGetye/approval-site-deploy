import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Legacy types (for company_submissions table)
export type CompanyType =
  | "government"
  | "university"
  | "hospital"
  | "school"
  | "ngo"
  | "other";

export type SubmissionStatus = "pending" | "matched" | "approved" | "rejected";

export interface CompanySubmission {
  id: string;
  company_name: string;
  company_type: CompanyType;
  submitted_by_email: string;
  full_name: string;
  id_number: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  address: string | null;
  notes: string | null;
  status: SubmissionStatus;
  matched_profile_id: string | null;
  created_at: string;
}

export interface RecipientProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  verification_image_url: string | null;
  recipient_status: "unrequested" | "requested" | "approved";
  role: string;
  created_at: string;
}

// New verification system types
export type OrgTypeSlug = 'government' | 'university' | 'hospital' | 'school' | 'ngo' | 'company';

export interface VerificationSubmission {
  id: string;
  org_type_slug: OrgTypeSlug;
  form_config_id: string | null;
  company_name: string;
  company_contact_email: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  form_data: Record<string, unknown>;
  document_urls: string[];
  total_score: number;
  section_scores: Record<string, number>;
  priority_level: 'high' | 'medium' | 'low' | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  auto_account_created: boolean;
  auto_account_email: string | null;
  auto_account_password: string | null;
  created_at: string;
  updated_at: string;
}

export const ORG_TYPE_MAP: Record<OrgTypeSlug, { name: string; icon: string }> = {
  government: { name: 'Government', icon: '🏛️' },
  university: { name: 'University / College', icon: '🎓' },
  hospital: { name: 'Hospital / Clinic', icon: '🏥' },
  school: { name: 'School', icon: '🏫' },
  ngo: { name: 'NGO / Non-profit', icon: '🤝' },
  company: { name: 'Company', icon: '🏢' },
};
